"""Fail-closed tests for the K2 hosted read-only schema probe."""

from __future__ import annotations

from pathlib import Path
import hashlib
import json
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
