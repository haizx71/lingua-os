"""Apply deterministic static catalog seed for First Real Learning Loop (FRLL).

Strictly applies database/seeds/first_real_learning_loop.sql to the database.
Never mutates or inserts rows into learner-derived tables.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "database" / "seeds" / "first_real_learning_loop.sql"
CONCEPT_ID = uuid.UUID("7f110000-0000-4000-8000-000000000004")
EXPECTED_LEMMA = "frll-anchor"

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


def apply_seed(database_url: str) -> None:
    if not SEED_PATH.exists():
        raise FileNotFoundError(f"FRLL seed file missing at {SEED_PATH}")

    sql_text = SEED_PATH.read_text(encoding="utf-8")

    with psycopg.connect(database_url) as conn:
        # Acquire advisory lock to serialize with any concurrent migration runner
        conn.execute("SELECT pg_advisory_lock(hashtextextended('lingua_os_schema_migrations', 0))")
        try:
            with conn.transaction():
                conn.execute(sql_text)

            # Verification assertions within same session
            concept_row = conn.execute(
                "SELECT id, canonical_key FROM concepts WHERE id = %s", (CONCEPT_ID,)
            ).fetchone()
            if not concept_row:
                raise RuntimeError(
                    f"FRLL seed execution failed: anchor concept {CONCEPT_ID} not found"
                )
            if concept_row[1] != EXPECTED_LEMMA:
                msg = (
                    f"FRLL seed canonical_key mismatch: "
                    f"expected '{EXPECTED_LEMMA}', got '{concept_row[1]}'"
                )
                raise RuntimeError(msg)

            for table in LEARNER_DERIVED_TABLES:
                row = conn.execute(f"SELECT count(*) FROM {table}").fetchone()
                if row and row[0] > 0:
                    msg = (
                        f"FRLL-03 violation: learner table '{table}' contains "
                        f"{row[0]} rows after seed"
                    )
                    raise RuntimeError(msg)
        finally:
            conn.execute(
                "SELECT pg_advisory_unlock(hashtextextended('lingua_os_schema_migrations', 0))"
            )


def main() -> int:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url or not db_url.strip():
        print(
            "[FAIL] DATABASE_URL is missing or empty in environment. Halting.",
            file=sys.stderr,
        )
        return 1

    try:
        apply_seed(db_url.strip())
        print(
            f"[OK] FRLL catalog seed applied successfully: "
            f"anchor concept '{CONCEPT_ID}' ({EXPECTED_LEMMA})."
        )
        return 0
    except Exception as exc:
        print(f"[FAIL] Error applying FRLL catalog seed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
