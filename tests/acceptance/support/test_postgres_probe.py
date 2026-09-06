"""Unit tests for FRLL observational PostgreSQL probe."""

from __future__ import annotations

import os
import uuid
from dataclasses import asdict

import psycopg
import pytest

from tests.acceptance.support.postgres_probe import LearnerStateDigest, PostgresLearnerProbe


def test_learner_state_digest_structure() -> None:
    digest = LearnerStateDigest(
        user_id=str(uuid.uuid4()),
        concept_id=str(uuid.uuid4()),
        user_exists=False,
        profile_time_zone=None,
        language_profile_ids=[],
        is_concept_saved=False,
        save_intent_count=0,
        save_intent_ids=[],
        review_item_count=0,
        review_item_ids=[],
        fsrs_state_count=0,
        fsrs_states=[],
        learning_event_count=0,
        learning_events=[],
        review_event_count=0,
        review_events=[],
        concept_state=None,
        skill_states=[],
        today_plan_count=0,
        today_plan_ids=[],
        today_activity_review_item_ids=[],
    )
    raw = asdict(digest)
    assert raw["user_exists"] is False
    assert raw["save_intent_count"] == 0
    assert raw["review_event_count"] == 0


def test_probe_enforces_read_only_transaction() -> None:
    db_url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        pytest.skip("PostgreSQL environment not configured")

    probe = PostgresLearnerProbe(db_url)
    with (
        pytest.raises(psycopg.errors.ReadOnlySqlTransaction),
        probe._open_read_only_connection() as conn,
    ):
        # Attempting a write in read-only transaction must fail closed
        conn.execute(
            "INSERT INTO users (id) VALUES (%s)",
            (uuid.uuid4(),),
        )


def test_probe_cli_fails_closed_when_arguments_missing() -> None:
    import subprocess
    import sys
    from pathlib import Path

    script = Path(__file__).resolve().parent / "postgres_probe.py"
    proc = subprocess.run([sys.executable, str(script)], capture_output=True, text=True)
    assert proc.returncode == 1
    assert "Usage: python -m postgres_probe" in proc.stderr


def test_probe_sql_queries_strictly_match_canonical_columns() -> None:
    """Proactively verify every SQL query in postgres_probe.py against canonical columns.

    Guarantees no stale or generic column assumptions (e.g. 'id', 'scheduled_days',
    'skill_type', 'local_date', '*_score') ever re-enter the observational probe.
    """
    import inspect

    from tests.acceptance.support import postgres_probe

    source = inspect.getsource(postgres_probe.PostgresLearnerProbe.capture_digest)

    # 1. learning_events identifier must be learning_event_id (renamed in migration 0004)
    assert "learning_event_id" in source
    # Must NOT have unaliased 'SELECT id,' for learning_events
    assert "SELECT id, event_type" not in source

    # 2. fsrs_states must not query phantom/stale columns: scheduled_days, reps, lapses
    assert "scheduled_days" not in source
    assert "reps" not in source
    assert "lapses" not in source

    # 3. user_concept_states must query canonical columns (mastery, recognition, etc.)
    assert "mastery," in source or "mastery AS" in source
    assert "recognition," in source or "recognition AS" in source
    assert "listening," in source or "listening AS" in source
    assert "production," in source or "production AS" in source
    # Must NOT query unaliased mastery_score as a table column
    stale_concept_query = (
        "SELECT status, state_version, has_learning_intent, has_projectable_evidence,\n"
        "                       mastery_score"
    )
    assert stale_concept_query not in source

    # 4. user_skill_states must query canonical column 'skill' (not unaliased 'skill_type')
    assert "SELECT skill," in source or "SELECT skill " in source or "skill AS skill_type" in source
    assert "SELECT skill_type," not in source

    # 5. today_plans must query canonical column 'plan_date' (not unaliased 'local_date')
    assert "plan_date" in source
    assert "SELECT id, local_date," not in source

    # 6. Observational read-only invariant: no mutating DML
    forbidden_mutations = [
        "INSERT INTO",
        "UPDATE ",
        "DELETE FROM",
        "DROP TABLE",
        "ALTER TABLE",
        "TRUNCATE ",
    ]
    for mutation in forbidden_mutations:
        assert mutation not in source, f"Observational probe must not contain: {mutation}"


def test_canonical_migrations_prove_schema_evolution() -> None:
    """Assert canonical migration DDL documents the exact schema evolution."""
    from pathlib import Path

    repo_root = Path(__file__).resolve().parents[3]
    migrations_dir = repo_root / "database" / "migrations"

    # Migration 0004 renamed learning_events.id to learning_event_id
    mig_0004_path = migrations_dir / "0004_learner_evidence_competence_v1.up.sql"
    mig_0004 = mig_0004_path.read_text(encoding="utf-8")
    assert "ALTER TABLE learning_events RENAME COLUMN id TO learning_event_id;" in mig_0004

    # Migration 0001 defined today_plans with plan_date, user_skill_states with skill
    mig_0001_path = migrations_dir / "0001_core_schema_v1.up.sql"
    mig_0001 = mig_0001_path.read_text(encoding="utf-8")
    assert "plan_date date NOT NULL," in mig_0001
    assert "skill text NOT NULL" in mig_0001
    assert "mastery numeric" in mig_0001


def test_digest_json_serialization_preserves_canonical_types() -> None:
    """Assert serialization handles Decimal, UUID, datetime, date, and null deterministically."""
    import json
    from datetime import UTC, date, datetime
    from decimal import Decimal
    from uuid import UUID

    from tests.acceptance.support.postgres_probe import (
        LearnerStateDigest,
        normalize_scalar_for_json,
        serialize_digest_to_json,
    )

    test_user_id = UUID("550e8400-e29b-41d4-a716-446655440000")
    test_concept_id = UUID("7f110000-0000-4000-8000-000000000004")
    test_review_item_id = UUID("11111111-1111-4000-8000-000000000001")
    test_event_id = UUID("22222222-2222-4000-8000-000000000002")

    digest = LearnerStateDigest(
        user_id=str(test_user_id),
        concept_id=str(test_concept_id),
        user_exists=True,
        profile_time_zone="Asia/Ho_Chi_Minh",
        language_profile_ids=["33333333-3333-4000-8000-000000000003"],
        is_concept_saved=True,
        save_intent_count=1,
        save_intent_ids=["44444444-4444-4000-8000-000000000004"],
        review_item_count=1,
        review_item_ids=[str(test_review_item_id)],
        fsrs_state_count=1,
        fsrs_states=[
            {
                "review_item_id": test_review_item_id,
                "state": "learning",
                "state_version": 2,
                "last_review_at": datetime(2026, 9, 6, 10, 0, 0, tzinfo=UTC),
                "due_at": datetime(2026, 9, 6, 14, 30, 0, tzinfo=UTC),
                "stability": Decimal("4.12345678"),
                "difficulty": Decimal("2.5000"),
                "step": 1,
            }
        ],
        learning_event_count=1,
        learning_events=[
            {
                "learning_event_id": test_event_id,
                "id": str(test_event_id),
                "event_type": "learning.concept.saved.v1",
                "source_type": "concept_save_intent",
                "source_event_id": test_event_id,
                "ingestion_sequence": 1,
                "created_at": datetime(2026, 9, 6, 9, 0, 0, tzinfo=UTC),
            }
        ],
        review_event_count=0,
        review_events=[],
        concept_state={
            "status": "learning",
            "state_version": 2,
            "has_learning_intent": True,
            "has_projectable_evidence": False,
            "mastery": Decimal("0.50000000"),
            "mastery_score": Decimal("0.50000000"),
            "confidence": Decimal("0.7500"),
            "recognition": Decimal("0.50000000"),
            "recognition_score": Decimal("0.50000000"),
            "listening": Decimal("0.50000000"),
            "listening_score": Decimal("0.50000000"),
            "production": Decimal("0.50000000"),
            "production_score": Decimal("0.50000000"),
            "recognition_evidence_count": 0,
            "listening_evidence_count": 0,
            "production_evidence_count": 0,
        },
        skill_states=[
            {
                "skill": "recognition",
                "skill_type": "recognition",
                "score": Decimal("0.6500"),
                "confidence": Decimal("0.8000"),
                "evidence_count": 5,
            }
        ],
        today_plan_count=1,
        today_plan_ids=["66666666-6666-4000-8000-000000000006"],
        today_activity_review_item_ids=[str(test_review_item_id)],
    )

    # 1. JSON serialization succeeds without TypeError
    json_str = serialize_digest_to_json(digest)
    assert isinstance(json_str, str)

    # 2. Parsed JSON preserves exact Decimal string precision without floating-point drift
    data = json.loads(json_str)
    fsrs = data["fsrs_states"][0]
    assert fsrs["difficulty"] == "2.5000"
    assert fsrs["stability"] == "4.12345678"

    # 3. Timestamps are ISO-8601 formatted strings
    assert fsrs["due_at"] == "2026-09-06T14:30:00+00:00"
    assert fsrs["last_review_at"] == "2026-09-06T10:00:00+00:00"

    # 4. UUIDs are canonical lowercase strings
    assert fsrs["review_item_id"] == "11111111-1111-4000-8000-000000000001"
    assert data["user_id"] == "550e8400-e29b-41d4-a716-446655440000"

    # 5. Concept state precision preserved
    cs = data["concept_state"]
    assert cs["mastery"] == "0.50000000"
    assert cs["confidence"] == "0.7500"

    # 6. Dates are ISO-8601 formatted
    normalized_date = normalize_scalar_for_json(date(2026, 9, 6))
    assert normalized_date == "2026-09-06"

    # 7. No credentials leaked in output
    for sensitive in ["password", "secret", "token", "postgres://", "postgresql://"]:
        assert sensitive not in json_str.lower()


def test_normalize_scalar_for_json_fails_closed_on_unsupported_types() -> None:
    """Assert normalize_scalar_for_json fails closed on unknown or arbitrary object types."""
    import pytest

    from tests.acceptance.support.postgres_probe import normalize_scalar_for_json

    class ArbitraryObject:
        pass

    with pytest.raises(TypeError, match="Unsupported type for canonical JSON serialization"):
        normalize_scalar_for_json(ArbitraryObject())

    with pytest.raises(TypeError, match="Unsupported type for canonical JSON serialization"):
        normalize_scalar_for_json({1, 2, 3})


def test_teardown_and_verify_cleanup_fail_closed_on_invalid_uuid() -> None:
    """Ensure teardown, orphan recovery, and verify_cleanup reject non-UUID identifiers."""
    probe = PostgresLearnerProbe("postgresql://localhost:5432/fake")

    with pytest.raises(ValueError, match="Invalid user_id for teardown"):
        probe.teardown_disposable_user("not-a-uuid")  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Invalid user_id for orphan recovery"):
        probe.recover_orphaned_learner_state("not-a-uuid")  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Invalid user_id for verification"):
        probe.verify_cleanup("not-a-uuid")  # type: ignore[arg-type]


def test_probe_cli_flags_fail_closed() -> None:
    """Ensure CLI fails closed when teardown, recovery, or verify args are missing."""
    import subprocess
    import sys
    from pathlib import Path

    script = Path(__file__).resolve().parent / "postgres_probe.py"

    # 1. --teardown without user_id
    proc_td = subprocess.run(
        [sys.executable, str(script), "--teardown"],
        capture_output=True,
        text=True,
    )
    assert proc_td.returncode == 1
    assert "Usage: python -m postgres_probe" in proc_td.stderr

    # 2. --recover-orphan without user_id
    proc_ro = subprocess.run(
        [sys.executable, str(script), "--recover-orphan"],
        capture_output=True,
        text=True,
    )
    assert proc_ro.returncode == 1
    assert "Usage: python -m postgres_probe" in proc_ro.stderr

    # 3. --verify-cleanup without user_id
    proc_vc = subprocess.run(
        [sys.executable, str(script), "--verify-cleanup"],
        capture_output=True,
        text=True,
    )
    assert proc_vc.returncode == 1
    assert "Usage: python -m postgres_probe" in proc_vc.stderr


def test_teardown_source_enforces_safety_invariants() -> None:
    """Verify teardown_disposable_user enforces scoped deletes and table safety."""
    import inspect

    from tests.acceptance.support.postgres_probe import PostgresLearnerProbe

    teardown_source = inspect.getsource(PostgresLearnerProbe.teardown_disposable_user)
    verify_source = inspect.getsource(PostgresLearnerProbe.verify_cleanup)

    # 1. Teardown must be strictly scoped to user_id parameter
    assert "WHERE user_id = %s" in teardown_source
    assert "WHERE id = %s" in teardown_source
    # Must never delete from catalog concepts or static lexemes
    assert "DELETE FROM concepts" not in teardown_source
    assert "DELETE FROM lexemes" not in teardown_source
    assert "TRUNCATE" not in teardown_source

    # 2. Teardown must handle append-only triggers and RESTRICT FKs
    assert "profile_mutation_results" in teardown_source
    assert "concept_save_intents" in teardown_source
    assert "learning_events" in teardown_source
    assert "ENABLE TRIGGER" in teardown_source

    # 3. Verification must inspect all learner-associated tables
    for tbl in [
        "users",
        "learner_profiles",
        "user_languages",
        "review_items",
        "fsrs_states",
        "learning_events",
        "concept_save_intents",
        "profile_mutation_results",
        "user_concept_states",
        "user_saved_concepts",
    ]:
        assert f"FROM {tbl} WHERE" in verify_source

    # 4. Verification must check catalog anchor concept intact
    assert "FROM concepts WHERE id = %s" in verify_source


def test_teardown_preserves_fk_cascades_and_bans_blanket_trigger_suppression() -> None:
    """Verify teardown and orphan recovery preserve FK cascades and ban blanket suppression."""
    import inspect
    import re
    from pathlib import Path

    from tests.acceptance.support import postgres_probe

    probe_source = Path(postgres_probe.__file__).read_text(encoding="utf-8")

    # 1. HARD RULE: No session_replication_role in postgres_probe.py
    assert "session_replication_role" not in probe_source

    # 2. HARD RULE: No DISABLE TRIGGER ALL or ENABLE TRIGGER ALL
    assert "DISABLE TRIGGER ALL" not in probe_source
    assert "ENABLE TRIGGER ALL" not in probe_source

    # 3. Only explicit named triggers are allowed to be disabled
    # In teardown: profile_mutation_results_append_only, concept_save_intents_immutable_history
    # In orphan recovery: plus learning_events_append_only (since pg_trigger_depth() is 1)
    allowed_disabled_triggers = {
        "profile_mutation_results_append_only",
        "concept_save_intents_immutable_history",
        "learning_events_append_only",
    }
    assert "DISABLE TRIGGER {trigger}" in probe_source
    named_trigger_literals = set(re.findall(r'\("[a-z_]+",\s*"([a-z_]+)"\)', probe_source))
    assert named_trigger_literals == allowed_disabled_triggers

    # 4. In teardown_disposable_user, triggers MUST be re-enabled BEFORE DELETE FROM users
    teardown_src = inspect.getsource(postgres_probe.PostgresLearnerProbe.teardown_disposable_user)
    enable_pos = teardown_src.find("ENABLE TRIGGER")
    delete_users_pos = teardown_src.find("DELETE FROM users WHERE id = %s")
    assert enable_pos != -1, "ENABLE TRIGGER must exist in teardown"
    assert delete_users_pos != -1, "DELETE FROM users must exist in teardown"
    assert enable_pos < delete_users_pos, (
        "Triggers must be re-enabled BEFORE deleting users so FK cascades are active"
    )

    # 5. finally: block must guarantee triggers are re-enabled even on failure
    assert "finally:" in teardown_src
    finally_src = teardown_src.split("finally:")[1]
    assert "ENABLE TRIGGER" in finally_src

    orphan_src = inspect.getsource(
        postgres_probe.PostgresLearnerProbe.recover_orphaned_learner_state
    )
    assert "finally:" in orphan_src
    orphan_finally = orphan_src.split("finally:")[1]
    assert "ENABLE TRIGGER" in orphan_finally
