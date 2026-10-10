"""Fail-closed tests for the K2 hosted read-only schema probe."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Any, ClassVar
from uuid import UUID

import pytest

from tests.acceptance.support import k2_hosted_probe as probe


class Result:
    def __init__(
        self, rows: list[tuple[Any, ...]] | None = None, row: tuple[Any, ...] | None = None
    ):
        self._rows = rows or []
        self._row = row

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self._rows

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._row


class InventoryConnection:
    def __init__(
        self,
        *,
        extra_table: bool = False,
        select_missing: bool = False,
        write_grant: bool = False,
        missing_policy: bool = False,
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
            return Result(
                rows=[
                    (
                        name,
                        True,
                        self.write_grant and name == "users",
                        False,
                        False,
                        False,
                        False,
                        False,
                        False,
                    )
                    for name in names
                ]
            )
        if "FROM pg_policy AS policy" in statement:
            without_rls = {"assessment_attempt_items", "assessment_idempotency_log"}
            return Result(
                rows=[
                    (
                        name,
                        name not in without_rls,
                        False,
                        name not in without_rls and not (self.missing_policy and name == "users"),
                        self.restrictive_policy and name == "users",
                    )
                    for name in sorted(probe.EXPECTED_LEARNER_TABLES)
                ]
            )
        raise AssertionError("unexpected probe query")


def test_inventory_uses_unfiltered_catalog_and_checks_select_and_all_write_privileges() -> None:
    connection = InventoryConnection()
    names = probe._table_inventory(connection)

    assert names == tuple(sorted(probe.EXPECTED_LEARNER_TABLES))
    assert "pg_class" in connection.calls[0]
    assert "pg_attribute" in connection.calls[0]
    assert "information_schema" not in connection.calls[0]
    assert (
        sum(
            "has_table_privilege(current_user, %s, 'SELECT')" in statement
            for statement in connection.calls
        )
        == 27
    )
    assert any("relation.oid, 'TRIGGER'" in statement for statement in connection.calls)
    assert any("FROM pg_policy AS policy" in statement for statement in connection.calls)


def test_inventory_fails_if_pg_catalog_finds_an_unpinned_owner_table() -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(extra_table=True))


def test_inventory_fails_if_any_pinned_table_is_not_selectable() -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(select_missing=True))


def test_inventory_fails_if_read_role_has_any_effective_public_write_grant() -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(write_grant=True))


@pytest.mark.parametrize("policy_failure", ["missing_policy", "restrictive_policy"])
def test_inventory_fails_if_rls_cannot_prove_complete_snapshot(policy_failure: str) -> None:
    with pytest.raises(probe.ProbeError):
        probe._table_inventory(InventoryConnection(**{policy_failure: True}))


def test_probe_connection_rejects_noncanonical_or_writable_database_roles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        "postgresql://k2_hosted_acceptance_reader.bdmtdvvnbicgkfririjo:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
    )
    monkeypatch.setenv(
        "PGSSLROOTCERT",
        str(Path(probe.__file__).resolve().parents[3] / "database/certs/supabase-prod-ca-2021.crt"),
    )
    safe_status = (
        "k2_hosted_acceptance_reader",
        "on",
        "on",
        False,
        False,
        False,
        False,
        False,
        False,
        True,
        5,
        0,
        False,
        False,
    )
    safe = FakeConnection(safe_status)
    monkeypatch.setattr(probe.psycopg, "connect", lambda *_args, **_kwargs: safe)
    assert probe._connection() is safe

    unsafe = FakeConnection(
        (
            "k2_hosted_acceptance_reader",
            "on",
            "on",
            False,
            False,
            False,
            False,
            True,
            False,
            True,
            5,
            0,
            False,
            False,
        )
    )
    monkeypatch.setattr(probe.psycopg, "connect", lambda *_args, **_kwargs: unsafe)
    with pytest.raises(probe.ProbeError):
        probe._connection()
    assert unsafe.closed


def test_probe_requires_exact_pooler_tenant_verified_tls_and_pinned_root(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = Path(probe.__file__).resolve().parents[3] / "database/certs/supabase-prod-ca-2021.crt"
    monkeypatch.setenv("PGSSLROOTCERT", str(root))
    good = "postgresql://k2_hosted_acceptance_reader.bdmtdvvnbicgkfririjo:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full"
    probe._require_verified_staging_connection(good)
    for bad in (
        good.replace("verify-full", "require"),
        good + "&sslrootcert=/tmp/untrusted.crt",
        good.replace("bdmtdvvnbicgkfririjo", "otherproject"),
        good.replace("aws-0-ap-southeast-1.pooler.supabase.com", "db.example.invalid"),
    ):
        with pytest.raises(probe.ProbeError):
            probe._require_verified_staging_connection(bad)
    monkeypatch.delenv("PGSSLROOTCERT")
    with pytest.raises(probe.ProbeError):
        probe._require_verified_staging_connection(good)


def test_probe_failure_output_never_echoes_database_url(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
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
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "k2_09_hosted_fixture_control" if number == 21 else "older",
                        )
                        for number in range(1, 22)
                    ]
                )
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(
                    rows=[
                        ("20260927034218", "concept_save_intent_auth_erasure_0019"),
                        ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                        ("20261001000000", "today_remediation_reason_codes_0020"),
                        ("20261007000000", "k2_09_hosted_fixture_control_0021"),
                    ]
                )
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    assert probe._migration_head(MigrationConnection()) == {
        "appMigrationHead": "0021",
        "appliedMigrations": 21,
    }


def test_migration_probe_fails_if_supabase_ledger_is_not_at_reader_migration() -> None:
    class OlderMigrationConnection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "k2_09_hosted_fixture_control" if number == 21 else "older",
                        )
                        for number in range(1, 22)
                    ]
                )
            return Result(rows=[("20260927034218", "concept_save_intent_auth_erasure_0019")])

    with pytest.raises(probe.ProbeError):
        probe._migration_head(OlderMigrationConnection())


class PilotReaderMigrationConnection:
    def __init__(
        self,
        *,
        app_rows: list[tuple[str, str, str]] | None = None,
        platform_rows: list[tuple[str, str]] | None = None,
        app_privileges: tuple[bool, ...] = (True, True, True, True, False, False, False, False),
        platform_privileges: tuple[bool, ...] = (
            True,
            True,
            False,
            False,
            False,
            False,
            False,
            False,
        ),
    ) -> None:
        self.app_rows = app_rows or list(probe.PILOT_READER_EXPECTED_APP_MIGRATIONS)
        self.platform_rows = platform_rows or [
            *probe.PILOT_READER_EXPECTED_PLATFORM_PRIOR,
            (PILOT_PLATFORM_VERSION, probe.PILOT_READER_EXPECTED_PLATFORM_0022_NAME),
        ]
        self.app_privileges = app_privileges
        self.platform_privileges = platform_privileges
        self.calls: list[str] = []

    def execute(self, query: str) -> Result:
        self.calls.append(query)
        if "FROM public.schema_migrations" in query:
            return Result(rows=self.app_rows)
        if "FROM supabase_migrations.schema_migrations" in query:
            return Result(rows=self.platform_rows)
        if "'public.schema_migrations'" in query:
            return Result(row=self.app_privileges)
        if "'supabase_migrations.schema_migrations'" in query:
            return Result(row=self.platform_privileges)
        raise AssertionError("unexpected PILOT-READER migration query")


PILOT_PLATFORM_VERSION = "20261010151500"


def test_pilot_reader_migration_head_requires_the_reviewed_platform_pin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(probe, "PILOT_READER_EXPECTED_PLATFORM_0022_VERSION", None)
    connection = PilotReaderMigrationConnection()

    with pytest.raises(probe.ProbeError):
        probe._pilot_reader_migration_head(connection)

    assert connection.calls == []


def test_pilot_reader_migration_head_accepts_only_exact_app_and_platform_ledgers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        probe, "PILOT_READER_EXPECTED_PLATFORM_0022_VERSION", PILOT_PLATFORM_VERSION
    )
    connection = PilotReaderMigrationConnection()

    assert probe._pilot_reader_migration_head(connection) == {
        "appMigrationHead": "0022",
        "appliedMigrations": 22,
    }
    assert len(connection.calls) == 4


@pytest.mark.parametrize(
    ("ledger", "mutation"),
    [
        ("app", "name"),
        ("app", "checksum"),
        ("app", "missing"),
        ("app", "extra"),
        ("platform", "missing"),
        ("platform", "name"),
        ("platform", "duplicate"),
        ("platform", "extra"),
    ],
)
def test_pilot_reader_migration_head_rejects_ledger_drift(
    monkeypatch: pytest.MonkeyPatch,
    ledger: str,
    mutation: str,
) -> None:
    monkeypatch.setattr(
        probe, "PILOT_READER_EXPECTED_PLATFORM_0022_VERSION", PILOT_PLATFORM_VERSION
    )
    app_rows = list(probe.PILOT_READER_EXPECTED_APP_MIGRATIONS)
    platform_rows = [
        *probe.PILOT_READER_EXPECTED_PLATFORM_PRIOR,
        (PILOT_PLATFORM_VERSION, probe.PILOT_READER_EXPECTED_PLATFORM_0022_NAME),
    ]
    if ledger == "app":
        index = 21
        if mutation == "name":
            app_rows[index] = (
                app_rows[index][0],
                "unknown_reader_history_name",
                app_rows[index][2],
            )
        elif mutation == "checksum":
            app_rows[index] = (app_rows[index][0], app_rows[index][1], "0" * 64)
        elif mutation == "missing":
            app_rows.pop()
        else:
            app_rows.append(app_rows[-1])
    elif mutation == "missing":
        platform_rows.pop()
    elif mutation == "name":
        platform_rows[-1] = (platform_rows[-1][0], "unknown_reader_history_name")
    elif mutation == "duplicate":
        platform_rows.append(platform_rows[-1])
    else:
        platform_rows.append(("20261010151501", "unexpected_platform_migration"))

    connection = PilotReaderMigrationConnection(app_rows=app_rows, platform_rows=platform_rows)
    with pytest.raises(probe.ProbeError):
        probe._pilot_reader_migration_head(connection)


@pytest.mark.parametrize(
    ("ledger", "privilege_index", "enabled"),
    [
        pytest.param("app", 0, False, id="app-missing-version"),
        pytest.param("app", 1, False, id="app-missing-name"),
        pytest.param("app", 2, False, id="app-missing-checksum"),
        pytest.param("app", 3, False, id="app-missing-table-select"),
        pytest.param("app", 4, True, id="app-insert"),
        pytest.param("app", 5, True, id="app-update"),
        pytest.param("app", 6, True, id="app-delete"),
        pytest.param("app", 7, True, id="app-truncate"),
        pytest.param("platform", 0, False, id="platform-missing-version"),
        pytest.param("platform", 1, False, id="platform-missing-name"),
        pytest.param("platform", 2, True, id="platform-table-select"),
        pytest.param("platform", 3, True, id="platform-statements-select"),
        pytest.param("platform", 4, True, id="platform-insert"),
        pytest.param("platform", 5, True, id="platform-update"),
        pytest.param("platform", 6, True, id="platform-delete"),
        pytest.param("platform", 7, True, id="platform-truncate"),
    ],
)
def test_pilot_reader_migration_head_rejects_unapproved_ledger_privilege_shape(
    monkeypatch: pytest.MonkeyPatch,
    ledger: str,
    privilege_index: int,
    enabled: bool,
) -> None:
    monkeypatch.setattr(
        probe, "PILOT_READER_EXPECTED_PLATFORM_0022_VERSION", PILOT_PLATFORM_VERSION
    )
    privileges = (
        [True, True, True, True, False, False, False, False]
        if ledger == "app"
        else [True, True, False, False, False, False, False, False]
    )
    privileges[privilege_index] = enabled
    connection = PilotReaderMigrationConnection(
        **{f"{ledger}_privileges": tuple(privileges)}
    )

    with pytest.raises(probe.ProbeError):
        probe._pilot_reader_migration_head(connection)


def test_frll_semantic_probe_is_fixed_select_only_and_redacts_identity_and_key() -> None:
    actor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    profile_id = UUID("550e8400-e29b-41d4-a716-446655440001")
    review_id = UUID("550e8400-e29b-41d4-a716-446655440002")
    raw_key = "550e8400-e29b-41d4-a716-446655440003"
    updated_at = "2026-10-08T00:00:00Z"
    memory_snapshot = {
        "state": "review", "dueAt": updated_at, "lastReviewAt": updated_at,
        "difficulty": "5.2", "stability": "2.1", "step": None,
        "stateVersion": 2, "paramsVersion": "fsrs-6.0.0",
    }
    competence_snapshot = {
        dimension: {
            "score": "0.5", "confidence": "0.25", "evidenceCount": 1,
            "updatedAt": updated_at,
        }
        for dimension in ("recognition", "listening", "production")
    }

    class FrllConnection:
        def __init__(
            self,
            exercise_mode: str = "self_recall",
            evidence_mode: str = "production",
            *,
            correct: Any = None,
            memory_row: tuple[Any, ...] | None = None,
            review_rows: list[tuple[Any, ...]] | None = None,
        ) -> None:
            self.exercise_mode = exercise_mode
            self.evidence_mode = evidence_mode
            self.correct = correct
            self.calls: list[tuple[str, Any]] = []
            self.memory_row = memory_row or (
                "review", 2, updated_at, updated_at, "5.2", "2.1", "fsrs-6.0.0", None,
            )
            self.review_rows = review_rows

        def execute(self, query: Any, params: Any = None) -> Result:
            statement = str(query)
            self.calls.append((statement, params))
            if "FROM public.users WHERE id = %s" in statement:
                return Result(row=(1, 1, 1, 1))
            if "FROM public.user_saved_concepts" in statement:
                return Result(row=(1, 1, 1, 1, 1))
            if "FROM public.user_concept_states" in statement:
                return Result(rows=[(
                    "active", "0.5", "0.25", 1, updated_at, 2, True, True,
                    "0.5", "0.25", 1, updated_at,
                    "0.5", "0.25", 1, updated_at,
                    "0.5", "0.25", 1, updated_at,
                )])
            if "FROM public.fsrs_states AS memory" in statement:
                return Result(rows=[self.memory_row])
            if "FROM public.review_events AS event" in statement:
                if self.review_rows is not None:
                    return Result(rows=self.review_rows)
                return Result(rows=[(
                    raw_key, "good", 1200, self.correct, self.exercise_mode, self.evidence_mode,
                    memory_snapshot, competence_snapshot, 1,
                )])
            if "FROM public.user_language_projection_heads" in statement:
                return Result(rows=[(2, "frll-v1", 1)])
            if "FROM public.user_skill_states" in statement:
                return Result(rows=[
                    (skill, "0.5", "0.25", 1, 1, updated_at, "frll-v1")
                    for skill in ("recognition", "listening", "production")
                ])
            raise AssertionError("unexpected FRLL probe query")

    connection = FrllConnection()
    digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    output = probe._frll_semantic_proof(connection, actor_id, profile_id, digest)

    assert output["identity"] == {
        "userRows": 1, "learnerProfileRows": 1, "languageProfileRows": 1,
        "profileBound": True,
    }
    assert output["review"]["idempotencyKeyMatched"] is True
    assert output["review"]["eventRows"] == 1
    assert output["review"]["exerciseMode"] == "self_recall"
    assert output["review"]["evidenceMode"] == "production"
    assert output["review"]["correct"] is None
    assert output["memory"]["stateVersion"] == 2
    assert output["memory"]["step"] is None
    assert any("memory.step" in statement for statement, _ in connection.calls)
    assert output["projection"]["skillRows"] == 3
    assert all(statement.lstrip().startswith("SELECT") for statement, _ in connection.calls)
    serialized = json.dumps(output, sort_keys=True)
    assert str(actor_id) not in serialized
    assert str(profile_id) not in serialized
    assert str(review_id) not in serialized
    assert raw_key not in serialized
    assert digest not in serialized

    mismatched_enum_connection = FrllConnection("production", "self_recall")
    with pytest.raises(probe.ProbeError):
        probe._frll_semantic_proof(mismatched_enum_connection, actor_id, profile_id, digest)

    compatibility_connection = FrllConnection(correct=True)
    compatibility = probe._frll_semantic_proof(
        compatibility_connection, actor_id, profile_id, digest,
    )
    assert compatibility["review"]["correct"] is True

    invalid_correct_connection = FrllConnection(
        review_rows=[(
            raw_key, "good", 1200, "true", "self_recall", "production",
            memory_snapshot, competence_snapshot, 1,
        )],
    )
    with pytest.raises(probe.ProbeError):
        probe._frll_semantic_proof(invalid_correct_connection, actor_id, profile_id, digest)

    mismatched_correct_connection = FrllConnection(
        exercise_mode="typing",
        review_rows=[(
            raw_key, "good", 1200, True, "typing", "production",
            memory_snapshot, competence_snapshot, 1,
        )],
    )
    with pytest.raises(probe.ProbeError):
        probe._frll_semantic_proof(mismatched_correct_connection, actor_id, profile_id, digest)

    fresh_connection = FrllConnection(
        memory_row=("new", 1, updated_at, None, None, None, "fsrs-6.0.0", None),
        review_rows=[],
    )
    fresh = probe._frll_semantic_proof(fresh_connection, actor_id, profile_id, None)
    assert fresh["memory"] == {
        "rowCount": 1, "state": "new", "stateVersion": 1, "dueAt": updated_at,
        "lastReviewedAt": None, "difficulty": None, "stability": None, "step": None,
        "paramsVersion": "fsrs-6.0.0",
    }
    assert fresh["review"]["eventRows"] == 0


@pytest.mark.parametrize(
    "memory_row",
    [
        ("new", 1, "2026-10-08T00:00:00Z", None, "5.2", None, "fsrs-6.0.0", None),
        (
            "learning",
            2,
            "2026-10-08T00:00:00Z",
            "2026-10-08T00:00:00Z",
            "5.2",
            "2.1",
            "fsrs-6.0.0",
            None,
        ),
        (
            "relearning",
            2,
            "2026-10-08T00:00:00Z",
            "2026-10-08T00:00:00Z",
            "5.2",
            "2.1",
            "fsrs-6.0.0",
            -1,
        ),
        (
            "review",
            2,
            "2026-10-08T00:00:00Z",
            "2026-10-08T00:00:00Z",
            "5.2",
            "2.1",
            "fsrs-6.0.0",
            0,
        ),
    ],
)
def test_frll_semantic_probe_rejects_fsrs_rows_that_break_state_shape(
    memory_row: tuple[Any, ...],
) -> None:
    actor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    profile_id = UUID("550e8400-e29b-41d4-a716-446655440001")

    class InvalidMemoryConnection:
        def execute(self, query: Any, params: Any = None) -> Result:
            statement = str(query)
            if "FROM public.users WHERE id = %s" in statement:
                return Result(row=(1, 1, 1, 1))
            if "FROM public.user_saved_concepts" in statement:
                return Result(row=(1, 1, 1, 1, 1))
            if "FROM public.user_concept_states" in statement:
                return Result()
            if "FROM public.fsrs_states AS memory" in statement:
                return Result(rows=[memory_row])
            raise AssertionError("invalid FSRS shape should fail before later proof queries")

    with pytest.raises(probe.ProbeError):
        probe._frll_semantic_proof(InvalidMemoryConnection(), actor_id, profile_id, None)


@pytest.mark.parametrize(
    ("state", "step"),
    [("learning", 0), ("relearning", 1), ("review", None)],
)
def test_frll_review_snapshot_uses_state_specific_step_shape(state: str, step: int | None) -> None:
    timestamp = "2026-10-08T00:00:00Z"
    snapshot = probe._frll_snapshot_memory({
        "state": state, "dueAt": timestamp, "lastReviewAt": timestamp,
        "difficulty": "5.2", "stability": "2.1", "step": step,
        "stateVersion": 2, "paramsVersion": "fsrs-6.0.0",
    })
    assert snapshot["state"] == state
    assert snapshot["step"] == step


@pytest.mark.parametrize(
    ("state", "step"),
    [("new", None), ("review", 0), ("learning", None)],
)
def test_frll_review_snapshot_rejects_invalid_state_step_shape(
    state: str, step: int | None
) -> None:
    timestamp = "2026-10-08T00:00:00Z"
    with pytest.raises(probe.ProbeError):
        probe._frll_snapshot_memory({
            "state": state, "dueAt": timestamp, "lastReviewAt": timestamp,
            "difficulty": "5.2", "stability": "2.1", "step": step,
            "stateVersion": 2, "paramsVersion": "fsrs-6.0.0",
        })


def test_frll_probe_rejects_raw_key_and_malformed_digest_before_database_access(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("K2_ACCEPTANCE_PROBE_ACTION", "frll_anchor_semantic_proof")
    monkeypatch.setenv("K2_ACCEPTANCE_ACTOR_ID", "550e8400-e29b-41d4-a716-446655440000")
    monkeypatch.setenv("K2_ACCEPTANCE_PROFILE_ID", "550e8400-e29b-41d4-a716-446655440001")
    monkeypatch.setenv("K2_ACCEPTANCE_IDEMPOTENCY_KEY", "do-not-accept")
    monkeypatch.setattr(probe, "_connection", lambda: pytest.fail("database must not be opened"))

    assert probe.main() == 2
    assert capsys.readouterr().err == "K2 hosted acceptance read-only probe failed closed.\n"

    monkeypatch.delenv("K2_ACCEPTANCE_IDEMPOTENCY_KEY")
    monkeypatch.setenv("K2_ACCEPTANCE_IDEMPOTENCY_KEY_SHA256", "not-a-digest")
    assert probe.main() == 2
    assert capsys.readouterr().err == "K2 hosted acceptance read-only probe failed closed.\n"


def test_migration_probe_requires_supabase_0019_before_the_reader_migration() -> None:
    class Missing0019Connection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "k2_09_hosted_fixture_control" if number == 21 else "older",
                        )
                        for number in range(1, 22)
                    ]
                )
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(
                    rows=[
                        ("20260927021246", "profile_replay_auth_erasure_0018"),
                        ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                        ("20261001000000", "today_remediation_reason_codes_0020"),
                        ("20261007000000", "k2_09_hosted_fixture_control_0021"),
                    ]
                )
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    with pytest.raises(probe.ProbeError):
        probe._migration_head(Missing0019Connection())


def test_migration_probe_rejects_platform_migrations_after_the_approved_0021_tail() -> None:
    class UnexpectedPlatformMigrationConnection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "k2_09_hosted_fixture_control" if number == 21 else "older",
                        )
                        for number in range(1, 22)
                    ]
                )
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(
                    rows=[
                        ("20260927034218", "concept_save_intent_auth_erasure_0019"),
                        ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                        ("20261001000000", "today_remediation_reason_codes_0020"),
                        ("20261007000000", "k2_09_hosted_fixture_control_0021"),
                        ("20261002000000", "unapproved_later_migration"),
                    ]
                )
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    with pytest.raises(probe.ProbeError):
        probe._migration_head(UnexpectedPlatformMigrationConnection())


def test_actor_ownership_graph_pins_exact_incoming_fk_closure_without_reading_rows() -> None:
    class OwnershipGraphConnection:
        statement = ""
        parameters = None

        def execute(self, query: Any, params: Any = None) -> Result:
            self.statement = str(query)
            self.parameters = params
            return Result(rows=list(probe.EXPECTED_INBOUND_OWNER_FK_CLOSURE))

    connection = OwnershipGraphConnection()
    assert probe._actor_ownership_graph(connection) == {
        "ownershipGraphValid": True,
        "ownedTableCount": 27,
        "ownershipEdgeCount": 27,
        "incomingConstraintCount": 51,
    }
    assert connection.parameters == (list(probe.EXPECTED_LEARNER_TABLES),)
    assert "pg_catalog.pg_constraint" in connection.statement
    assert "FROM auth.users" not in connection.statement
    assert "FROM public.users" not in connection.statement
    assert "SELECT *" not in connection.statement


@pytest.mark.parametrize(
    "drift",
    ["missing_owner", "unexpected_external", "changed_action", "unvalidated", "deferrable"],
)
def test_actor_ownership_graph_fails_closed_on_fk_drift(drift: str) -> None:
    rows = [list(edge) for edge in probe.EXPECTED_INBOUND_OWNER_FK_CLOSURE]
    if drift == "missing_owner":
        rows.pop(0)
    elif drift == "unexpected_external":
        external = rows[0].copy()
        external[0:3] = [
            "extensions",
            "unexpected_owner_reference",
            "unexpected_owner_reference_fkey",
        ]
        rows.append(external)
    else:
        index = next(
            index for index, row in enumerate(rows) if row[2] == "learning_events_causation_fkey"
        )
        if drift == "changed_action":
            rows[index][7] = "c"
        elif drift == "unvalidated":
            rows[index][10] = False
        else:
            rows[index][11] = True

    class DriftingOwnershipGraphConnection:
        def execute(self, query: Any, params: Any = None) -> Result:
            del query, params
            return Result(rows=[tuple(row) for row in rows])

    with pytest.raises(probe.ProbeError):
        probe._actor_ownership_graph(DriftingOwnershipGraphConnection())


def test_today_review_targets_probe_returns_only_a_bounded_ordered_actor_mapping() -> None:
    actor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    review_ids = [
        UUID("00000000-0000-4000-8000-000000000001"),
        UUID("00000000-0000-4000-8000-000000000002"),
    ]

    class ActorPlanConnection:
        statement = ""

        def execute(self, query: str, params: tuple[object, ...]) -> Result:
            self.statement = query
            assert params == (actor_id, actor_id, actor_id)
            return Result(row=("today-heuristic-v2", 1, 1, 2, review_ids))

    connection = ActorPlanConnection()
    result = probe._today_review_targets(connection, actor_id)

    assert result == {
        "engineVersion": "today-heuristic-v2",
        "activityCount": 1,
        "reviewActivityCount": 1,
        "targetCount": 2,
        "reviewItemIds": [str(value) for value in review_ids],
    }
    assert "WHERE user_id = %s" in connection.statement
    assert "LIMIT 182" in connection.statement
    assert str(actor_id) not in str(result)


@pytest.mark.parametrize(
    "row",
    [
        ("today-heuristic-v2", 1, 1, 2, [UUID("00000000-0000-4000-8000-000000000001")]),
        ("today-heuristic-v2", 21, 1, 1, [UUID("00000000-0000-4000-8000-000000000001")]),
    ],
)
def test_today_review_targets_probe_fails_closed_on_invalid_or_unbounded_plan_rows(
    row: tuple[object, ...],
) -> None:
    class InvalidPlanConnection:
        def execute(self, query: str, params: tuple[object, ...]) -> Result:
            return Result(row=row)

    with pytest.raises(probe.ProbeError):
        probe._today_review_targets(
            InvalidPlanConnection(), UUID("550e8400-e29b-41d4-a716-446655440000")
        )


class K208PrivilegeConnection(InventoryConnection):
    def __init__(self, drift: str | None = None):
        super().__init__()
        self.drift = drift

    def execute(self, query: Any, params: Any = None) -> Result:
        statement = str(query)
        if "SELECT rolname, rolsuper, rolcreatedb" in statement:
            flags = {
                "anon": (False, False, False, False, False, False, True),
                "authenticated": (False, False, False, False, False, False, True),
                probe.EXPECTED_READONLY_ROLE: (False, False, False, False, False, True, False),
                "service_role": (False, False, False, False, True, False, True),
            }
            if self.drift == "service_bypass":
                flags["service_role"] = (False, False, False, False, False, False, True)
            return Result(rows=[(name, *flags[name]) for name in sorted(flags)])
        if "CROSS JOIN pg_namespace AS schema" in statement:
            flags = {
                ("anon", "auth"): (True, False),
                ("anon", "public"): (False, False),
                ("authenticated", "auth"): (True, False),
                ("authenticated", "public"): (False, False),
                (probe.EXPECTED_READONLY_ROLE, "auth"): (False, False),
                (probe.EXPECTED_READONLY_ROLE, "public"): (True, False),
                ("service_role", "auth"): (True, False),
                ("service_role", "public"): (True, False),
            }
            return Result(
                rows=[(role, schema, *values) for (role, schema), values in sorted(flags.items())]
            )
        if "FROM aclexplode" in statement:
            rows = [("auth", False), ("public", False)]
            if self.drift == "public_auth_schema_grant":
                rows[0] = ("auth", True)
            return Result(rows=rows)
        if "WITH expected_relations(schema_name, relation_name, relation_kind" in statement:
            return Result(
                rows=[
                    (
                        "auth",
                        "users",
                        "r",
                        "supabase_auth_admin",
                        True,
                        False,
                        "r",
                        "supabase_auth_admin",
                        True,
                        False,
                        0,
                    ),
                    (
                        "public",
                        "user_concept_states",
                        "r",
                        "postgres",
                        True,
                        False,
                        "r",
                        "postgres",
                        True,
                        False,
                        2,
                    ),
                    (
                        "public",
                        "user_languages",
                        "r",
                        "postgres",
                        True,
                        False,
                        "r",
                        "postgres",
                        True,
                        False,
                        2,
                    ),
                    (
                        "public",
                        "users",
                        "r",
                        "postgres",
                        True,
                        False,
                        "r",
                        "postgres",
                        True,
                        False,
                        2,
                    ),
                    (
                        "public",
                        "v_learner_concept_retrievability",
                        "v",
                        "postgres",
                        False,
                        False,
                        "v",
                        "postgres",
                        False,
                        False,
                        0,
                    ),
                ]
            )
        if "policy.polname, policy.polcmd" in statement:
            rows = [
                (
                    "public",
                    "user_concept_states",
                    "k2_hosted_acceptance_reader_select_all",
                    "r",
                    True,
                    [probe.EXPECTED_READONLY_ROLE],
                    "true",
                    None,
                ),
                (
                    "public",
                    "user_concept_states",
                    "user_concept_states_select_own",
                    "r",
                    True,
                    ["authenticated"],
                    "(( SELECT auth.uid() AS uid) = user_id)",
                    None,
                ),
                (
                    "public",
                    "user_languages",
                    "k2_hosted_acceptance_reader_select_all",
                    "r",
                    True,
                    [probe.EXPECTED_READONLY_ROLE],
                    "true",
                    None,
                ),
                (
                    "public",
                    "user_languages",
                    "user_languages_select_own",
                    "r",
                    True,
                    ["authenticated"],
                    "(( SELECT auth.uid() AS uid) = user_id)",
                    None,
                ),
                (
                    "public",
                    "users",
                    "k2_hosted_acceptance_reader_select_all",
                    "r",
                    True,
                    [probe.EXPECTED_READONLY_ROLE],
                    "true",
                    None,
                ),
                (
                    "public",
                    "users",
                    "users_select_own",
                    "r",
                    True,
                    ["authenticated"],
                    "(( SELECT auth.uid() AS uid) = id)",
                    None,
                ),
            ]
            if self.drift == "policy_with_check":
                rows[-1] = (*rows[-1][:-1], "true")
            return Result(rows=rows)
        if "WITH expected_relations(schema_name, relation_name)" in statement:
            rows = []
            for schema_name, relation_name in [
                ("auth", "users"),
                ("public", "user_concept_states"),
                ("public", "user_languages"),
                ("public", "users"),
                ("public", "v_learner_concept_retrievability"),
            ]:
                for role_name in (
                    "anon",
                    "authenticated",
                    probe.EXPECTED_READONLY_ROLE,
                    "service_role",
                ):
                    if schema_name == "auth":
                        flags = (False, False, False, False, False)
                    elif relation_name == "v_learner_concept_retrievability":
                        flags = (role_name == "service_role", False, False, False, False)
                    elif role_name == "service_role":
                        flags = (True, True, True, True, True)
                    elif role_name == probe.EXPECTED_READONLY_ROLE:
                        flags = (True, False, False, False, False)
                    else:
                        flags = (False, False, False, False, False)
                    rows.append((schema_name, relation_name, role_name, *flags))
            if self.drift == "reader_auth_access":
                index = next(
                    index
                    for index, row in enumerate(rows)
                    if row[:3] == ("auth", "users", probe.EXPECTED_READONLY_ROLE)
                )
                rows[index] = (*rows[index][:3], True, False, False, False, False)
            if self.drift == "reader_view_access":
                index = next(
                    index
                    for index, row in enumerate(rows)
                    if row[:3]
                    == ("public", "v_learner_concept_retrievability", probe.EXPECTED_READONLY_ROLE)
                )
                rows[index] = (*rows[index][:3], True, False, False, False, False)
            return Result(rows=rows)
        return super().execute(query, params)


def test_k208_privilege_preflight_attests_the_fixed_metadata_baseline_only() -> None:
    connection = K208PrivilegeConnection()

    assert probe._k208_fixture_privilege_preflight(connection) == {
        "fixtureCapabilityReady": True,
        "authBoundaryUnchanged": True,
        "learnerOwnerRlsPolicyBaseline": True,
        "readerSelectOnly": True,
        "serviceFixtureAndViewAclBaseline": True,
    }
    assert all("FROM auth.users" not in query for query in connection.calls)
    assert all("FROM public.users" not in query for query in connection.calls)
    assert all("FROM public.user_concept_states" not in query for query in connection.calls)


@pytest.mark.parametrize(
    "drift",
    [
        "service_bypass",
        "public_auth_schema_grant",
        "policy_with_check",
        "reader_auth_access",
        "reader_view_access",
    ],
)
def test_k208_privilege_preflight_fails_closed_on_boundary_drift(drift: str) -> None:
    with pytest.raises(probe.ProbeError):
        probe._k208_fixture_privilege_preflight(K208PrivilegeConnection(drift))


def test_k208_due_membership_checks_only_the_fixed_due_set_against_eligible_catalog(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    profile_id = UUID("550e8400-e29b-41d4-a716-446655440001")
    due_ids = [UUID(f"550e8400-e29b-41d4-a716-44665544{index:04x}") for index in range(16, 36)]

    def resolve_profile(_store, _connection, *, actor, requested_id):
        assert actor.id == actor_id
        assert requested_id == profile_id
        return profile_id

    monkeypatch.setattr(probe.PostgresContentStore, "resolve_profile", resolve_profile)

    class CatalogMembershipConnection:
        statement = ""
        parameters = None

        def execute(self, query: Any, params: Any = None) -> Result:
            self.statement = str(query)
            self.parameters = params
            return Result(row=(0,))

    connection = CatalogMembershipConnection()
    assert probe._k208_due_candidate_overlap(connection, actor_id, profile_id, due_ids) == {
        "overlapCount": 0,
    }
    assert connection.parameters == (due_ids,)
    assert "unnest(%s::uuid[])" in connection.statement
    assert "reader_content_passes_publication_gate(item.id)" in connection.statement
    assert "item.publication_status = 'published'" in connection.statement
    assert "item.language_code = 'en'" in connection.statement
    assert "FROM public.user_concept_states" not in connection.statement
    assert "FROM auth.users" not in connection.statement
    assert "FROM public.users" not in connection.statement
    assert "SELECT *" not in connection.statement


def test_k208_due_membership_fails_on_overlap_or_an_unbounded_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    profile_id = UUID("550e8400-e29b-41d4-a716-446655440001")
    due_ids = [UUID(f"550e8400-e29b-41d4-a716-44665544{index:04x}") for index in range(16, 36)]
    monkeypatch.setattr(
        probe.PostgresContentStore,
        "resolve_profile",
        lambda _store, _connection, *, actor, requested_id: requested_id,
    )

    class OverlapConnection:
        def execute(self, _query: Any, _params: Any = None) -> Result:
            return Result(row=(1,))

    assert probe._k208_due_candidate_overlap(
        OverlapConnection(), actor_id, profile_id, due_ids
    ) == {"overlapCount": 1}
    with pytest.raises(probe.ProbeError):
        probe._k208_due_candidate_overlap(OverlapConnection(), actor_id, profile_id, due_ids[:-1])
    with pytest.raises(probe.ProbeError):
        probe._k208_due_candidate_overlap(
            OverlapConnection(), actor_id, profile_id, [*due_ids[:-1], due_ids[0]]
        )


def test_k208_candidate_base_rejects_a_truncated_competitor_universe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    profile_id = UUID("550e8400-e29b-41d4-a716-446655440001")
    requested_limits: list[int] = []
    monkeypatch.setattr(
        probe.PostgresContentStore,
        "resolve_profile",
        lambda _store, _connection, *, actor, requested_id: requested_id,
    )

    def summaries(_store: Any, *, limit: int, **_kwargs: Any) -> list[Any]:
        requested_limits.append(limit)
        return [SimpleNamespace(id=UUID(int=index + 1)) for index in range(21)]

    monkeypatch.setattr(probe.PostgresContentStore, "list_summaries", summaries)

    class UnexpectedRead:
        def execute(self, *_args: Any, **_kwargs: Any) -> Result:
            raise AssertionError("candidate row reads must stop after detecting overflow")

    with pytest.raises(probe.ProbeError):
        probe._k208_candidate_base(UnexpectedRead(), actor_id, profile_id)
    assert requested_limits == [21]


def test_pilot_reader_manifest_is_fixed_and_contains_all_ordered_pairs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manifest, candidate = probe._pilot_reader_manifest_files()
    assert manifest["scope"] == "staging_only"
    assert len(candidate["pairs"]) == 72
    assert [row[0] for row in candidate["pairs"]] == list(range(1, 73))
    assert (
        hashlib.sha256(candidate["body"].encode("utf-8")).hexdigest()
        == probe.PILOT_READER_BODY_SHA256
    )

    monkeypatch.setattr(probe, "PILOT_READER_PUBLICATION_MANIFEST_SHA256", "0" * 64)
    with pytest.raises(probe.ProbeError):
        probe._pilot_reader_manifest_files()


@pytest.mark.parametrize(
    "drift",
    [
        None,
        "duplicate_identity",
        "missing_translation",
        "foreign_provenance",
        "pinned_version",
        "metadata_entry_mismatch",
    ],
)
def test_pilot_reader_catalog_probe_pins_exact_published_72_pair_identity_without_rows(
    monkeypatch: pytest.MonkeyPatch,
    drift: str | None,
) -> None:
    manifest, candidate = probe._pilot_reader_manifest_files()
    content_id = UUID("550e8400-e29b-41d4-a716-446655440010")
    source_record_id = UUID("550e8400-e29b-41d4-a716-446655440020")
    content = manifest["content"]
    translation = manifest["translationSource"]
    identity = (
        content_id,
        content["title"],
        content["languageCode"],
        "published",
        "article",
        content["level"],
        1,
        probe.PILOT_READER_BODY_SHA256,
        True,
        "internal",
        content["sourceName"],
        f"{content['sourceVersion']}#content-{content_id}",
        content["attributionText"],
        probe.PILOT_READER_LICENSE_CODE,
        "allowed",
        "approved",
        Decimal("1.0000"),
        content["authorName"],
        content["sourceVersion"],
        content["rightsStatement"],
        1,
        Decimal("1.0000"),
        "admin-first-party-v1",
        content["sourceName"],
        candidate["body"],
        content["languageCode"],
        probe.PILOT_READER_LICENSE_CODE,
    )
    expected_translation_hash = probe._pilot_reader_translation_raw_hash(
        translation, candidate["pairs"]
    )
    expected_translation_entries = [
        {"ordinal": ordinal, "sourceText": english, "translationText": vietnamese}
        for ordinal, english, vietnamese in candidate["pairs"]
    ]
    sentence_rows = [
        (
            ordinal - 1,
            english,
            english,
            vietnamese,
            "approved",
            Decimal("1.0000"),
            translation["authorName"],
            translation["sourceVersion"],
            translation["rightsStatement"],
            "internal",
            translation["sourceName"],
            f"{translation['sourceVersion']}#content-{content_id}-translation-{expected_translation_hash[:12]}",
            translation["attributionText"],
            probe.PILOT_READER_LICENSE_CODE,
            "allowed",
            expected_translation_hash,
            "admin-translation-v1",
            str(content_id),
            "vi",
            probe.PILOT_READER_LICENSE_CODE,
            expected_translation_entries,
        )
        for ordinal, english, vietnamese in candidate["pairs"]
    ]
    identity_rows = [identity, identity] if drift == "duplicate_identity" else [identity]
    if drift == "missing_translation":
        sentence_rows[10] = (*sentence_rows[10][:3], None, *sentence_rows[10][4:])
    if drift == "foreign_provenance":
        sentence_rows[10] = (
            *sentence_rows[10][:10],
            "unreviewed external translation",
            *sentence_rows[10][11:],
        )
    if drift == "pinned_version":
        sentence_rows[10] = (
            *sentence_rows[10][:11],
            "declared-version-without-content-pin",
            *sentence_rows[10][12:],
        )
    if drift == "metadata_entry_mismatch":
        sentence_rows[10] = (*sentence_rows[10][:20], [], *sentence_rows[10][21:])

    class CatalogConnection:
        calls: ClassVar[list[str]] = []

        def execute(self, query: Any, params: Any = None) -> Result:
            statement = str(query)
            self.calls.append(statement)
            if "FROM public.content_versions AS version" in statement:
                assert params == (probe.PILOT_READER_BODY_SHA256,)
                return Result(rows=identity_rows)
            if "SELECT translation.source_record_id" in statement:
                assert params == (content_id,)
                return Result(rows=[(source_record_id,)] * 72)
            if (
                "FROM public.content_segments AS segment" in statement
                and "sentence_translations" in statement
            ):
                assert params == (content_id,)
                return Result(rows=sentence_rows)
            if "count(DISTINCT concept_id)" in statement:
                assert params == (content_id,)
                return Result(row=(3,))
            raise AssertionError("unexpected Reader catalog query")

    connection = CatalogConnection()
    monkeypatch.setattr(probe, "_table_inventory", lambda _connection: tuple())
    if drift is not None:
        with pytest.raises(probe.ProbeError):
            probe._pilot_reader_catalog_manifest(connection)
        return

    result = probe._pilot_reader_catalog_manifest(connection)
    assert result["contentId"] == str(content_id)
    assert result["contentCount"] == 1
    assert result["segmentCount"] == result["sentenceCount"] == result["translationCount"] == 72
    assert result["translationProvenance"]["sourceRecordCount"] == 1
    assert all(result["contentProvenance"].values())
    assert all(
        value is True
        for key, value in result["translationProvenance"].items()
        if key != "sourceRecordCount"
    )
    serialized = json.dumps(result, ensure_ascii=False)
    assert candidate["body"] not in serialized
    assert all(vietnamese not in serialized for _, _, vietnamese in candidate["pairs"])
    assert all("SELECT *" not in query.upper() for query in connection.calls)
    assert all(
        not any(token in query.upper() for token in ("INSERT ", "UPDATE ", "DELETE ", "TRUNCATE "))
        for query in connection.calls
    )


def _reader_completion_fixture(
    *, phase: str = "after", drift: str | None = None
) -> tuple[Any, dict[str, Any]]:
    actor_id = UUID("00000000-0000-4000-8000-000000000001")
    profile_id = UUID("00000000-0000-4000-8000-000000000002")
    content_id = UUID("00000000-0000-4000-8000-000000000003")
    segment_id = UUID("00000000-0000-4000-8000-000000000004")
    exposure_id = UUID("00000000-0000-4000-8000-000000000005")
    concept_ids = [
        UUID("00000000-0000-4000-8000-000000000006"),
        UUID("00000000-0000-4000-8000-000000000007"),
    ]
    key = "00000000-0000-4000-8000-000000000008"
    recorded_at = datetime(2026, 10, 10, 12, 30, tzinfo=UTC)
    parameter_set_id = UUID("00000000-0000-4000-8600-000000000010")
    exposure = (
        exposure_id, profile_id, "en", "read", content_id, segment_id, key,
        {
            "acceptedConceptCount": len(concept_ids), "contentId": str(content_id),
            "exposureId": str(exposure_id), "exposureType": "read",
            "occurredAt": recorded_at.isoformat(), "recordedAt": recorded_at.isoformat(),
            "segmentId": str(segment_id),
        },
        recorded_at,
        recorded_at,
    )
    links = [
        (actor_id, profile_id, "en", concept_id, f"concept:{concept_id}", recorded_at)
        for concept_id in concept_ids
    ]
    learning = [
        (actor_id, profile_id, "en", "learning.exposure.recorded.v1", concept_id,
         {"exposureType": "read"}, key, "exposure_event", exposure_id, f"concept:{concept_id}",
         sequence, recorded_at, "competence-beta-v1", parameter_set_id, "competence-beta-v1",
         recorded_at, recorded_at)
        for sequence, concept_id in enumerate(concept_ids, start=4)
    ]

    def state_row(concept_id: UUID) -> tuple[Any, ...]:
        row = (
            concept_id, "discovered", Decimal("0.5"), Decimal("0.5"), Decimal("0.5"), None,
            Decimal("0"), 1, False, False, None,
            Decimal("0"), Decimal("0"), Decimal("0"), 0, None,
            Decimal("0"), Decimal("0"), Decimal("0"), 0, None,
            Decimal("0"), Decimal("0"), Decimal("0"), 0, None,
            {"recognition": [], "listening": [], "production": []},
            "en", 2, recorded_at, "competence-beta-v1", parameter_set_id,
            "competence-beta-v1", recorded_at, recorded_at,
        )
        if drift == "active_state" and concept_id == concept_ids[0]:
            row = (*row[:13], Decimal("0.1"), 1, *row[15:])
        return row

    states = [state_row(concept_id) for concept_id in concept_ids]
    if drift == "foreign_link":
        foreign_id = UUID("00000000-0000-4000-8000-000000000009")
        links.append((actor_id, profile_id, "en", foreign_id, f"concept:{foreign_id}", recorded_at))
    if drift == "duplicate_learning":
        learning.append(learning[0])
    if drift == "foreign_learning":
        foreign_id = UUID("00000000-0000-4000-8000-000000000009")
        learning.append((actor_id, profile_id, "en", "learning.exposure.recorded.v1", foreign_id,
                         {"exposureType": "read"}, key, "exposure_event", exposure_id,
                         f"concept:{foreign_id}", 6, recorded_at, "competence-beta-v1",
                         parameter_set_id, "competence-beta-v1", recorded_at, recorded_at))
    exposure_rows = [] if phase == "before" else [exposure]
    if phase == "after" and drift == "duplicate_exposure":
        duplicate_id = UUID("00000000-0000-4000-8000-000000000011")
        exposure_rows.append((duplicate_id, *exposure[1:]))

    class CompletionConnection:
        def __init__(self) -> None:
            self.drift = drift
            self.stable_queries: list[str] = []

        class Cursor:
            def __init__(self, connection: Any) -> None:
                self.connection = connection
                self.rows: list[tuple[str]] = []
                self.offset = 0

            def __enter__(self) -> Any:
                return self

            def __exit__(self, *_args: Any) -> None:
                return None

            def execute(self, query: Any, _params: Any = None) -> None:
                statement = str(query)
                self.connection.stable_queries.append(statement)
                table_name = next(
                    table for table in probe.PILOT_READER_STABLE_TABLES
                    if table in statement
                )
                mutated_table = {
                    "prior_lookup_state": "user_concept_states",
                    "prior_lookup_event": "exposure_events",
                    "prior_lookup_link": "reader_exposure_concepts",
                    "prior_learning_event": "learning_events",
                }.get(self.connection.drift)
                stable_row = json.dumps(
                    {
                        "table": table_name,
                        "state": "mutated" if table_name == mutated_table else "stable",
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                )
                self.rows = [(stable_row,)]
                self.offset = 0

            def fetchmany(self, size: int) -> list[tuple[str]]:
                batch = self.rows[self.offset:self.offset + size]
                self.offset += len(batch)
                return batch

        def cursor(self, name: str | None = None) -> Any:
            assert name is not None
            return self.Cursor(self)

        def execute(self, query: Any, params: Any = None) -> Result:
            statement = str(query)
            if "FROM public.user_languages WHERE id" in statement:
                return Result(row=("en", "active"))
            if "reader_content_passes_publication_gate" in statement:
                return Result(row=("published", "en", True, 71, 72))
            if (
                "FROM public.content_segments AS target" in statement
                and "sentence_concepts" in statement
            ):
                return Result(rows=[(concept_id,) for concept_id in concept_ids])
            if "FROM public.exposure_events" in statement:
                return Result(rows=exposure_rows)
            if "FROM public.reader_exposure_concepts" in statement:
                return Result(rows=links)
            if "FROM public.learning_events" in statement:
                return Result(rows=learning)
            if "FROM public.user_concept_states" in statement:
                return Result(rows=[] if phase == "before" else states)
            if "FROM public.user_language_projection_heads" in statement:
                return Result(
                    rows=[
                        (
                            actor_id,
                            profile_id,
                            4 if phase == "before" else 6,
                            4 if phase == "before" else 6,
                            parameter_set_id,
                            "competence-beta-v1",
                            "competence-beta-v1",
                            recorded_at
                            if phase == "after"
                            else datetime(2026, 10, 10, 12, 0, tzinfo=UTC),
                            json.dumps(
                                {
                                    "created_at": datetime(
                                        2026, 10, 10, 11, 0, tzinfo=UTC
                                    ).isoformat(),
                                    "parameter_set_id": str(parameter_set_id),
                                    "parameter_version": "competence-beta-v1",
                                    "projection_method_version": "competence-beta-v1",
                                    "user_id": str(actor_id),
                                    "user_language_id": str(profile_id),
                                },
                                sort_keys=True,
                            ),
                        )
                    ]
                )
            if "FROM public.user_skill_states" in statement:
                skills = []
                for name in ("listening", "production", "recognition"):
                    skills.append((name, Decimal("0.5"), Decimal("0"), 0,
                                   Decimal("0"), Decimal("0"), None, 1,
                                   parameter_set_id,
                                   "competence-beta-v1"))
                return Result(rows=skills)
            raise AssertionError(f"unexpected Reader completion query: {statement}")

    binding = {"phase": phase, "contentId": str(content_id), "segmentId": str(segment_id)}
    key_sha256 = None
    if phase == "after":
        binding.update({
            "exposureId": str(exposure_id),
            "projectionHeadBefore": {"stateVersion": 4, "nextIngestionSequence": 4},
        })
        key_sha256 = hashlib.sha256(key.encode("ascii")).hexdigest()
    config = {
        "actor_id": actor_id,
        "profile_id": profile_id,
        "concept_ids": concept_ids,
        "binding": binding,
        "idempotency_key_sha256": key_sha256,
    }
    return CompletionConnection(), config


def test_reader_completion_probe_reconciles_every_passive_concept_and_neutral_skill_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(probe, "_table_inventory", lambda _connection: tuple())
    before_connection, before = _reader_completion_fixture(phase="before")
    before_proof = probe._pilot_reader_completion(before_connection, **before)
    assert before_proof["eligibleConceptIds"] == [str(value) for value in before["concept_ids"]]
    assert before_proof["skillNames"] == ["listening", "production", "recognition"]
    assert before_proof["skillStateCount"] == 3 and before_proof["skillStatesPassiveOnly"] is True

    after_connection, after = _reader_completion_fixture()
    after_proof = probe._pilot_reader_completion(after_connection, **after)
    assert after_proof["linkedConceptIds"] == [str(value) for value in after["concept_ids"]]
    assert after_proof["learningConceptIds"] == [str(value) for value in after["concept_ids"]]
    assert [state["conceptId"] for state in after_proof["conceptStates"]] == [
        str(value) for value in after["concept_ids"]
    ]
    assert set(before_proof["stableRows"]) == set(probe.PILOT_READER_STABLE_TABLES)
    assert before_proof["stableRows"] == after_proof["stableRows"]
    assert before_proof["projectionHead"]["updatedAtMatchesCompletion"] is None
    assert after_proof["projectionHead"]["updatedAtMatchesCompletion"] is True
    assert (
        before_proof["projectionHead"]["immutableSha256"]
        == after_proof["projectionHead"]["immutableSha256"]
    )
    assert len(after_connection.stable_queries) == len(probe.PILOT_READER_STABLE_TABLES)
    query_by_table = {
        table: query for table in probe.PILOT_READER_STABLE_TABLES
        for query in after_connection.stable_queries if table in query
    }
    assert len(query_by_table) == len(probe.PILOT_READER_STABLE_TABLES)
    assert all('COLLATE "C"' in query for query in query_by_table.values())
    assert "id <> %s" in query_by_table["exposure_events"]
    assert "exposure_event_id <> %s" in query_by_table["reader_exposure_concepts"]
    assert "source_event_id = %s" in query_by_table["learning_events"]
    assert "concept_id = ANY(%s)" in query_by_table["user_concept_states"]


@pytest.mark.parametrize(
    ("drift", "table_name"),
    [
        ("prior_lookup_event", "exposure_events"),
        ("prior_lookup_link", "reader_exposure_concepts"),
        ("prior_learning_event", "learning_events"),
        ("prior_lookup_state", "user_concept_states"),
    ],
)
def test_reader_completion_stable_summary_detects_retained_row_mutations(
    monkeypatch: pytest.MonkeyPatch, drift: str, table_name: str
) -> None:
    monkeypatch.setattr(probe, "_table_inventory", lambda _connection: tuple())
    before_connection, before = _reader_completion_fixture(phase="before")
    before_proof = probe._pilot_reader_completion(before_connection, **before)
    after_connection, after = _reader_completion_fixture(drift=drift)
    after_proof = probe._pilot_reader_completion(after_connection, **after)
    for stable_table in probe.PILOT_READER_STABLE_TABLES:
        before_row = before_proof["stableRows"][stable_table]
        after_row = after_proof["stableRows"][stable_table]
        if stable_table == table_name:
            assert before_row["rows"] == after_row["rows"]
            assert before_row["sha256"] != after_row["sha256"]
        else:
            assert before_row == after_row


@pytest.mark.parametrize(
    "drift",
    [
        "duplicate_exposure",
        "foreign_link",
        "duplicate_learning",
        "foreign_learning",
        "active_state",
    ],
)
def test_reader_completion_probe_rejects_duplicate_foreign_or_active_effects(
    monkeypatch: pytest.MonkeyPatch, drift: str
) -> None:
    monkeypatch.setattr(probe, "_table_inventory", lambda _connection: tuple())
    connection, arguments = _reader_completion_fixture(drift=drift)
    with pytest.raises(probe.ProbeError):
        probe._pilot_reader_completion(connection, **arguments)
