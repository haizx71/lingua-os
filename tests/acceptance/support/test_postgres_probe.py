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
