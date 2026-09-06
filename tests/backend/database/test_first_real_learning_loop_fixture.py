"""Tests for First Real Learning Loop (FRLL) deterministic catalog fixture.

Validates FRLL-03 (no learner-derived state seeded) and FRLL-04 (deterministic,
published, idempotent concept fixture).
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

import psycopg
import pytest
from lingua_api.catalog.sql import allowed_record_sql

ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = ROOT / "database" / "seeds" / "first_real_learning_loop.sql"
CONCEPT_ID = uuid.UUID("7f110000-0000-4000-8000-000000000004")
SOURCE_RECORD_ID = uuid.UUID("21000000-0000-4000-8000-000000000004")
LEMMA = "frll-anchor"

LEARNER_DERIVED_TABLES = (
    "users",
    "learner_profiles",
    "user_languages",
    "user_saved_concepts",
    "user_saved_content",
    "user_saved_sentences",
    "concept_save_intents",
    "user_concept_states",
    "user_skill_states",
    "user_language_projection_heads",
    "learning_events",
    "exposure_events",
    "review_items",
    "fsrs_states",
    "review_events",
    "today_plans",
    "today_plan_activities",
    "today_activity_review_items",
    "profile_mutation_results",
    "assessment_attempts",
    "assessment_responses",
    "assessment_results",
)

ALLOWED_CATALOG_TABLES = {
    "licenses",
    "data_sources",
    "source_records",
    "concepts",
    "lexemes",
    "lexeme_forms",
    "word_senses",
}


def test_frll_fixture_sql_static_invariants() -> None:
    """Validate FRLL-03 & FRLL-04 structural invariants from SQL source alone."""
    assert FIXTURE_PATH.exists(), f"Missing fixture file at {FIXTURE_PATH}"
    sql_text = FIXTURE_PATH.read_text(encoding="utf-8")

    # 1. Concept ID and lemma must be explicitly present
    assert str(CONCEPT_ID) in sql_text
    assert LEMMA in sql_text

    # 2. Check all INSERT target tables
    insert_targets = re.findall(r"INSERT\s+INTO\s+([a-zA-Z0-9_]+)", sql_text, re.IGNORECASE)
    assert len(insert_targets) > 0, "Fixture must contain INSERT statements"
    for target in insert_targets:
        assert target in ALLOWED_CATALOG_TABLES, (
            f"Unexpected insert target '{target}' outside allowed catalog tables"
        )

    # 3. FRLL-03: Strictly NO inserts into learner-derived tables
    for table in LEARNER_DERIVED_TABLES:
        pattern = rf"INSERT\s+INTO\s+{table}\b"
        assert not re.search(pattern, sql_text, re.IGNORECASE), (
            f"FRLL-03 violation: fixture attempts to insert into learner table '{table}'"
        )

    # 4. Idempotency: Every INSERT statement must have ON CONFLICT DO NOTHING
    insert_blocks = re.split(r"INSERT\s+INTO\s+", sql_text, flags=re.IGNORECASE)[1:]
    for block in insert_blocks:
        assert re.search(
            r"ON\s+CONFLICT\s*(\([a-zA-Z0-9_,\s]+\))?\s*DO\s+NOTHING",
            block,
            re.IGNORECASE,
        ), f"Insert block missing ON CONFLICT DO NOTHING: {block[:80]}..."

    # 5. Publication and licensing completeness
    assert "approved" in sql_text, "Source record must have approved review_status"
    assert "allowed" in sql_text, "License must have allowed usage_policy"


def test_frll_fixture_database_execution(
    migrated_postgres_url: str | None = None,
) -> None:
    """Verify fixture idempotence, completeness, and zero learner state on real Postgres."""
    # Read external test database URL if available
    import os

    db_url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        pytest.skip(
            "PostgreSQL environment not configured (set TEST_DATABASE_URL or run with Docker)"
        )

    sql_text = FIXTURE_PATH.read_text(encoding="utf-8")

    with psycopg.connect(db_url) as conn:
        # Run seed once
        conn.execute(sql_text)
        conn.commit()

        # Check concept exists
        concept_row = conn.execute(
            "SELECT id, language_code, canonical_key FROM concepts WHERE id = %s",
            (CONCEPT_ID,),
        ).fetchone()
        assert concept_row is not None
        assert str(concept_row[0]) == str(CONCEPT_ID)
        assert concept_row[1] == "en"
        assert concept_row[2] == LEMMA

        # Check lexeme exists
        lexeme_row = conn.execute(
            "SELECT lemma, normalized_form, part_of_speech FROM lexemes WHERE concept_id = %s",
            (CONCEPT_ID,),
        ).fetchone()
        assert lexeme_row is not None
        assert lexeme_row[0] == LEMMA
        assert lexeme_row[1] == LEMMA
        assert lexeme_row[2] == "noun"

        # Check provenance gate passes
        gate_query = f"SELECT {allowed_record_sql('%s')}"
        gate_passed = conn.execute(gate_query, (SOURCE_RECORD_ID,)).fetchone()
        assert gate_passed is not None and gate_passed[0] is True, "Provenance gate must pass"

        # Check FRLL-03: Zero learner rows
        for table in LEARNER_DERIVED_TABLES:
            count = conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            assert count == 0, f"FRLL-03 violation: table '{table}' has {count} rows"

        # Run seed second time to verify idempotence
        conn.execute(sql_text)
        conn.commit()

        concept_count = conn.execute(
            "SELECT count(*) FROM concepts WHERE id = %s", (CONCEPT_ID,)
        ).fetchone()[0]
        assert concept_count == 1, "Concept count must remain exactly 1 after second seed run"
