"""Post-bootstrap observational verification for First Real Learning Loop (FRLL).

Strictly verifies that:
1. PostgreSQL connection is operational.
2. All canonical migrations (0001..0020) are applied and valid in public.schema_migrations.
3. Core application schema tables exist in the public schema.
4. Deterministic FRLL catalog anchor concept exists exactly once.
5. Zero rows exist across all learner-derived tables (strict learner isolation).

Enforces strictly read-only transactions. Never outputs credentials or connection secrets.
"""

from __future__ import annotations

import os
import re
import sys
import uuid
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database.migrate import discover_migrations  # noqa: E402

MIGRATIONS_DIR = ROOT / "database" / "migrations"
CONCEPT_ID = uuid.UUID("7f110000-0000-4000-8000-000000000004")
EXPECTED_LEMMA = "frll-anchor"

EXPECTED_MIGRATIONS = (
    "0001_core_schema_v1",
    "0002_memory_engine_fsrs_v1",
    "0003_review_idempotency_result_v1",
    "0004_learner_evidence_competence_v1",
    "0005_reader_content_service_v1",
    "0006_today_engine_heuristic_v1",
    "0007_profile_language_auth_bootstrap_v1",
    "0008_starting_level_estimate_v1",
    "0009_library_concept_save_intent_v1",
    "0010_supabase_public_data_api_lockdown_v1",
    "0011_supabase_public_function_execute_lockdown_v1",
    "0012_supabase_public_schema_browser_lockdown_v1",
    "0013_supabase_public_function_default_execute_lockdown_v1",
    "0014_knowledge_v2_canonical_structures",
    "0015_knowledge_v2_polysemy_resolution",
    "0016_knowledge_v2_graph_dag",
    "0017_knowledge_v2_learner_retrievability",
    "0018_profile_replay_auth_erasure",
    "0019_concept_save_intent_auth_erasure",
    "0020_today_remediation_reason_codes",
)


def discover_expected_tables(migrations_dir: Path = MIGRATIONS_DIR) -> tuple[str, ...]:
    """Discover all expected base table names from canonical migrations and migrate.py.

    Matches top-level 'CREATE TABLE [IF NOT EXISTS] [public.]<table_name>' statements
    across all *.up.sql migration files, and includes 'schema_migrations' managed by
    database/migrate.py.
    """
    pattern = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)",
        re.IGNORECASE,
    )
    tables: set[str] = {"schema_migrations"}
    for path in sorted(migrations_dir.glob("*.up.sql")):
        content = path.read_text(encoding="utf-8")
        for match in pattern.finditer(content):
            tables.add(match.group(1).lower())
    return tuple(sorted(tables))


EXPECTED_APPLICATION_TABLES: tuple[str, ...] = discover_expected_tables(MIGRATIONS_DIR)

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


def verify_database(database_url: str) -> None:
    with psycopg.connect(database_url, autocommit=False) as conn:
        conn.execute("SET TRANSACTION READ ONLY")

        # 1. Verify migrations
        print("Checking applied schema migrations...")
        migration_rows = conn.execute(
            "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version"
        ).fetchall()
        expected_rows = [
            (migration.version, migration.name, migration.checksum)
            for migration in discover_migrations(MIGRATIONS_DIR)
        ]
        actual_rows = [tuple(str(value) for value in row) for row in migration_rows]
        if actual_rows != expected_rows:
            raise RuntimeError(
                "public.schema_migrations does not exactly match the ordered source registry "
                "(version, name, checksum)"
            )
        print(
            f"  [OK] Migrations verified: {len(migration_rows)}/{len(EXPECTED_MIGRATIONS)} "
            f"applied in canonical order."
        )

        # 2. Verify application tables exist
        print("Checking application tables in public schema...")
        table_rows = conn.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """
        ).fetchall()
        existing_tables = {row[0] for row in table_rows}
        missing_tables = [t for t in EXPECTED_APPLICATION_TABLES if t not in existing_tables]
        if missing_tables:
            raise RuntimeError(f"Missing expected application tables: {', '.join(missing_tables)}")
        print(
            f"  [OK] Schema tables verified: {len(EXPECTED_APPLICATION_TABLES)} "
            f"required application tables present."
        )

        # 3. Verify FRLL catalog fixture anchor concept
        print("Checking deterministic FRLL catalog fixture...")
        concept_row = conn.execute(
            "SELECT id, language_code, canonical_key, concept_type FROM concepts WHERE id = %s",
            (CONCEPT_ID,),
        ).fetchone()
        if not concept_row:
            raise RuntimeError(
                f"FRLL anchor concept {CONCEPT_ID} not found in database. Run seed first."
            )
        if concept_row[2] != EXPECTED_LEMMA:
            msg = (
                f"FRLL anchor concept canonical_key mismatch: "
                f"expected '{EXPECTED_LEMMA}', got '{concept_row[2]}'"
            )
            raise RuntimeError(msg)

        lexeme_row = conn.execute(
            "SELECT lemma, part_of_speech FROM lexemes WHERE concept_id = %s",
            (CONCEPT_ID,),
        ).fetchone()
        if not lexeme_row or lexeme_row[0] != EXPECTED_LEMMA or lexeme_row[1] != "noun":
            raise RuntimeError(f"FRLL anchor lexeme mismatch for concept {CONCEPT_ID}")
        print(
            f"  [OK] FRLL anchor concept verified: '{CONCEPT_ID}' ({EXPECTED_LEMMA}, en word/noun)."
        )

        # 4. Verify learner-derived state isolation (FRLL-03: zero rows)
        print("Checking learner-derived state isolation (FRLL-03)...")
        non_empty_learner_tables: list[tuple[str, int]] = []
        for table in LEARNER_DERIVED_TABLES:
            row = conn.execute(f"SELECT count(*) FROM {table}").fetchone()
            count = row[0] if row else 0
            if count > 0:
                non_empty_learner_tables.append((table, count))

        if non_empty_learner_tables:
            details = ", ".join(f"{t}: {c} rows" for t, c in non_empty_learner_tables)
            msg = (
                f"FRLL-03 isolation violated! "
                f"Found non-empty learner tables before loop run: {details}"
            )
            raise RuntimeError(msg)
        print(
            f"  [OK] Learner isolation verified: exactly 0 rows across all "
            f"{len(LEARNER_DERIVED_TABLES)} learner-derived tables."
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
        verify_database(db_url.strip())
        print("")
        print("========================================================")
        print("STATUS: FRLL REAL DATABASE BOOTSTRAP VERIFICATION: PASS")
        print("========================================================")
        return 0
    except Exception as exc:
        print(f"[FAIL] Database bootstrap verification failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
