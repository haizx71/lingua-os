"""Fail-closed tests for the K2 hosted read-only schema probe."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any
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
                            "today_remediation_reason_codes" if number == 20 else "older",
                        )
                        for number in range(1, 21)
                    ]
                )
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(
                    rows=[
                        ("20260927034218", "concept_save_intent_auth_erasure_0019"),
                        ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                        ("20261001000000", "today_remediation_reason_codes_0020"),
                    ]
                )
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    assert probe._migration_head(MigrationConnection()) == {
        "appMigrationHead": "0020",
        "appliedMigrations": 20,
    }


def test_migration_probe_fails_if_supabase_ledger_is_not_at_reader_migration() -> None:
    class OlderMigrationConnection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "today_remediation_reason_codes" if number == 20 else "older",
                        )
                        for number in range(1, 21)
                    ]
                )
            return Result(rows=[("20260927034218", "concept_save_intent_auth_erasure_0019")])

    with pytest.raises(probe.ProbeError):
        probe._migration_head(OlderMigrationConnection())


def test_migration_probe_requires_supabase_0019_before_the_reader_migration() -> None:
    class Missing0019Connection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "today_remediation_reason_codes" if number == 20 else "older",
                        )
                        for number in range(1, 21)
                    ]
                )
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(
                    rows=[
                        ("20260927021246", "profile_replay_auth_erasure_0018"),
                        ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                        ("20261001000000", "today_remediation_reason_codes_0020"),
                    ]
                )
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    with pytest.raises(probe.ProbeError):
        probe._migration_head(Missing0019Connection())


def test_migration_probe_rejects_platform_migrations_after_the_approved_0020_tail() -> None:
    class UnexpectedPlatformMigrationConnection:
        def execute(self, query: str) -> Result:
            if "FROM public.schema_migrations" in query:
                return Result(
                    rows=[
                        (
                            f"{number:04d}",
                            "today_remediation_reason_codes" if number == 20 else "older",
                        )
                        for number in range(1, 21)
                    ]
                )
            if "FROM supabase_migrations.schema_migrations" in query:
                return Result(
                    rows=[
                        ("20260927034218", "concept_save_intent_auth_erasure_0019"),
                        ("20260928000000", "k2_hosted_acceptance_reader_staging"),
                        ("20261001000000", "today_remediation_reason_codes_0020"),
                        ("20261002000000", "unapproved_later_migration"),
                    ]
                )
            if "has_column_privilege" in query:
                return Result(row=(True, True, False, False, False, False, False, False))
            raise AssertionError("unexpected migration query")

    with pytest.raises(probe.ProbeError):
        probe._migration_head(UnexpectedPlatformMigrationConnection())


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
            return Result(rows=[(role, schema, *values) for (role, schema), values in sorted(flags.items())])
        if "FROM aclexplode" in statement:
            rows = [("auth", False), ("public", False)]
            if self.drift == "public_auth_schema_grant":
                rows[0] = ("auth", True)
            return Result(rows=rows)
        if "WITH expected_relations(schema_name, relation_name, relation_kind" in statement:
            return Result(rows=[
                ("auth", "users", "r", "supabase_auth_admin", True, False,
                 "r", "supabase_auth_admin", True, False, 0),
                ("public", "user_concept_states", "r", "postgres", True, False,
                 "r", "postgres", True, False, 2),
                ("public", "user_languages", "r", "postgres", True, False,
                 "r", "postgres", True, False, 2),
                ("public", "users", "r", "postgres", True, False,
                 "r", "postgres", True, False, 2),
                ("public", "v_learner_concept_retrievability", "v", "postgres", False, False,
                 "v", "postgres", False, False, 0),
            ])
        if "policy.polname, policy.polcmd" in statement:
            rows = [
                ("public", "user_concept_states", "k2_hosted_acceptance_reader_select_all", "r", True,
                 [probe.EXPECTED_READONLY_ROLE], "true", None),
                ("public", "user_concept_states", "user_concept_states_select_own", "r", True,
                 ["authenticated"], "(( SELECT auth.uid() AS uid) = user_id)", None),
                ("public", "user_languages", "k2_hosted_acceptance_reader_select_all", "r", True,
                 [probe.EXPECTED_READONLY_ROLE], "true", None),
                ("public", "user_languages", "user_languages_select_own", "r", True,
                 ["authenticated"], "(( SELECT auth.uid() AS uid) = user_id)", None),
                ("public", "users", "k2_hosted_acceptance_reader_select_all", "r", True,
                 [probe.EXPECTED_READONLY_ROLE], "true", None),
                ("public", "users", "users_select_own", "r", True,
                 ["authenticated"], "(( SELECT auth.uid() AS uid) = id)", None),
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
                for role_name in ("anon", "authenticated", probe.EXPECTED_READONLY_ROLE, "service_role"):
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
                    index for index, row in enumerate(rows)
                    if row[:3] == ("auth", "users", probe.EXPECTED_READONLY_ROLE)
                )
                rows[index] = (*rows[index][:3], True, False, False, False, False)
            if self.drift == "reader_view_access":
                index = next(
                    index for index, row in enumerate(rows)
                    if row[:3] == ("public", "v_learner_concept_retrievability", probe.EXPECTED_READONLY_ROLE)
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
