"""Fail-closed tests for the K2 hosted read-only schema probe."""

from __future__ import annotations

from typing import Any

import pytest

from tests.acceptance.support import k2_hosted_probe as probe


class Result:
    def __init__(self, rows: list[tuple[Any, ...]] | None = None, row: tuple[Any, ...] | None = None):
        self._rows = rows or []
        self._row = row

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self._rows

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._row


class InventoryConnection:
    def __init__(
        self, *, extra_table: bool = False, select_missing: bool = False,
        write_grant: bool = False, missing_policy: bool = False,
        restrictive_policy: bool = False,
    ):
        self.calls: list[str] = []
        self.extra_table = extra_table
        self.select_missing = select_missing
        self.write_grant = write_grant
        self.missing_policy = missing_policy
        self.restrictive_policy = restrictive_policy

    def execute(self, query: Any, params: Any = None) -> Result:
        statement = str(query)
        self.calls.append(statement)
        if "WITH RECURSIVE learner_owned_tables" in statement:
            names = list(sorted(probe.EXPECTED_LEARNER_TABLES))
            if self.extra_table:
                names.append("new_owner_table")
                names.sort()
            return Result(rows=[(name, name != "users", True) for name in names])
        if "has_table_privilege(current_user, %s, 'SELECT')" in statement:
            return Result(row=(not self.select_missing, False, False, False, False, False))
        if "has_table_privilege(current_user, relation.oid, 'SELECT')" in statement:
            names = sorted(set(probe.EXPECTED_LEARNER_TABLES) | set(probe.EXPECTED_CATALOG_TABLES))
            return Result(rows=[
                (name, True, self.write_grant and name == "users", False, False, False, False)
                for name in names
            ])
        if "FROM pg_policy AS policy" in statement:
            without_rls = {"assessment_attempt_items", "assessment_idempotency_log"}
            return Result(rows=[
                (
                    name, name not in without_rls, False,
                    name not in without_rls and not (self.missing_policy and name == "users"),
                    self.restrictive_policy and name == "users",
                )
                for name in sorted(probe.EXPECTED_LEARNER_TABLES)
            ])
        raise AssertionError("unexpected probe query")


def test_inventory_uses_unfiltered_catalog_and_checks_select_and_all_write_privileges() -> None:
    connection = InventoryConnection()
    names = probe._table_inventory(connection)  # noqa: SLF001

    assert names == tuple(sorted(probe.EXPECTED_LEARNER_TABLES))
    assert "pg_class" in connection.calls[0]
    assert "pg_attribute" in connection.calls[0]
    assert "information_schema" not in connection.calls[0]
    assert sum("has_table_privilege(current_user, %s, 'SELECT')" in statement
               for statement in connection.calls) == 27
    assert any("relation.oid, 'TRIGGER'" in statement for statement in connection.calls)
    assert any("FROM pg_policy AS policy" in statement for statement in connection.calls)


def test_inventory_fails_if_pg_catalog_finds_an_unpinned_owner_table() -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(extra_table=True))  # noqa: SLF001


def test_inventory_fails_if_any_pinned_table_is_not_selectable() -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(select_missing=True))  # noqa: SLF001


def test_inventory_fails_if_read_role_has_any_effective_public_write_grant() -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(write_grant=True))  # noqa: SLF001


@pytest.mark.parametrize("policy_failure", ["missing_policy", "restrictive_policy"])
def test_inventory_fails_if_rls_cannot_prove_complete_snapshot(policy_failure: str) -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(**{policy_failure: True}))  # noqa: SLF001


def test_probe_connection_rejects_noncanonical_or_writable_database_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeConnection:
        def __init__(self, status: tuple[Any, ...]):
            self.status = status
            self.closed = False

        def execute(self, query: str) -> Result:
            if query.startswith("SET TRANSACTION"):
                return Result()
            return Result(row=self.status)

        def close(self) -> None:
            self.closed = True

    monkeypatch.setenv(
        "K2_STAGING_READONLY_DATABASE_URL",
        "postgresql://k2_hosted_acceptance_reader.example:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
    )
    safe_status = (
        "k2_hosted_acceptance_reader", "on", "on", False, False, False, False,
        False, False, True, 5, 0, False, False,
    )
    safe = FakeConnection(safe_status)
    monkeypatch.setattr(probe.psycopg, "connect", lambda *_args, **_kwargs: safe)
    assert probe._connection() is safe  # noqa: SLF001

    unsafe = FakeConnection((
        "k2_hosted_acceptance_reader", "on", "on", False, False, False, False,
        True, False, True, 5, 0, False, False,
    ))
    monkeypatch.setattr(probe.psycopg, "connect", lambda *_args, **_kwargs: unsafe)
    with pytest.raises(probe.ProbeError):
        probe._connection()  # noqa: SLF001
    assert unsafe.closed


def test_probe_failure_output_never_echoes_database_url(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setenv("K2_STAGING_READONLY_DATABASE_URL", "")
    monkeypatch.setenv("K2_ACCEPTANCE_PROBE_ACTION", "migrations")
    monkeypatch.delenv("K2_ACCEPTANCE_ACTOR_ID", raising=False)

    assert probe.main() == 2
    captured = capsys.readouterr()
    assert captured.err == "K2 hosted acceptance read-only probe failed closed.\n"


def test_migration_probe_distinguishes_application_and_supabase_ledgers() -> None:
    class MigrationConnection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(rows=[
                    (f"{number:04d}", "knowledge_v2_learner_retrievability" if number == 17 else "older")
                    for number in range(1, 18)
                ])
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(rows=[
                    ("20260927034218", "concept_save_intent_auth_erasure_0019"),
                    ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                ])
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    assert probe._migration_head(MigrationConnection()) == {  # noqa: SLF001
        "appMigrationHead": "0017", "appliedMigrations": 17,
    }


def test_migration_probe_fails_if_supabase_ledger_is_not_at_reader_migration() -> None:
    class OlderMigrationConnection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(rows=[
                    (f"{number:04d}", "knowledge_v2_learner_retrievability" if number == 17 else "older")
                    for number in range(1, 18)
                ])
            return Result(rows=[("20260927034218", "concept_save_intent_auth_erasure_0019")])

    with pytest.raises(probe.ProbeError):
        probe._migration_head(OlderMigrationConnection())  # noqa: SLF001
