"""K2-10 PostgreSQL verification for migration and catalog preservation."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import psycopg
import pytest
from lingua_api.library.service import LibraryApplication
from lingua_api.memory.domain import (
    AuthenticatedActor,
    ReviewExerciseMode,
    ReviewRating,
    ReviewSubmission,
)
from lingua_api.review.service import ReviewApplication
from lingua_api.today.service import TodayApplication
from psycopg import sql

from database.migrate import migrate_up
from tests.acceptance.support import k2_hosted_probe
from tests.acceptance.support.k2_hosted_probe import EXPECTED_LEARNER_TABLES

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = ROOT / "database" / "migrations"
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
CONTENT_ONE = uuid.UUID("40000000-0000-4000-8000-000000000001")
CONCEPT_ONE = uuid.UUID("30000000-0000-4000-8000-000000000001")

# This is the K2-10 verification inventory. It intentionally covers the Reader,
# catalog-import, and immutable global FSRS catalog tables in addition to the
# smaller catalog set used by the hosted actor-cleanup probe.
K210_CATALOG_TABLES = (
    "languages",
    "proficiency_frameworks",
    "proficiency_levels",
    "licenses",
    "data_sources",
    "source_records",
    "concepts",
    "lexemes",
    "lexeme_forms",
    "word_senses",
    "concept_senses",
    "concept_relations",
    "framework_mappings",
    "topics",
    "concept_topics",
    "sentences",
    "sentence_translations",
    "sentence_concepts",
    "audio_assets",
    "sentence_audio",
    "content_items",
    "content_versions",
    "content_segments",
    "content_concepts",
    "content_metrics",
    "grammar_specifications",
    "phrase_specifications",
    "phonetic_transcriptions",
    "fsrs_parameter_sets",
)

IMPORTER_MUTATED_CATALOG_TABLES = frozenset(
    {
        "licenses",
        "data_sources",
        "source_records",
        "concepts",
        "topics",
        "concept_topics",
        "framework_mappings",
        "lexemes",
        "word_senses",
        "lexeme_forms",
        "sentences",
        "sentence_translations",
        "sentence_concepts",
        "concept_relations",
        "grammar_specifications",
    }
)


@dataclass(frozen=True)
class TableSnapshot:
    row_count: int
    digest: str
    row_digests: tuple[str, ...]


def _load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILDER = _load_module("k210_starter_builder", ROOT / "knowledge/build_production_starter.py")
IMPORTER = _load_module("k210_catalog_importer", ROOT / "knowledge/catalog_import.py")


def _build_import_plans() -> tuple[dict[str, Any], dict[str, Any]]:
    knowledge = ROOT / "knowledge"
    packs = [
        (path.name, BUILDER.load(path))
        for path in (
            knowledge / "first_party_starter_inventory.v1.json",
            knowledge / "first_party_content_support.v1.json",
        )
    ]
    candidate = BUILDER.build_candidate(
        packs,
        BUILDER.load(knowledge / "production_starter_manifest.v1.json"),
        BUILDER.load(knowledge / "level_audit_115.v3.json"),
        BUILDER.load(knowledge / "grammar_audit_8.v1.json"),
        BUILDER.load(knowledge / "phrase_audit_17.v1.json"),
        BUILDER.load(knowledge / "skill_audit_8.v1.json"),
    )
    catalog_plan = IMPORTER.build_plan(candidate)
    grammar_manifest = IMPORTER.load_grammar_manifest(knowledge / "grammar_specifications.v1.json")
    grammar_plan = IMPORTER.build_grammar_plan(grammar_manifest, catalog_plan)
    return catalog_plan, grammar_plan


def _seed_reader_and_learner(database_url: str) -> None:
    actor_id = uuid.uuid4()
    with psycopg.connect(database_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO public.learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        profile = connection.execute(
            """
            INSERT INTO public.user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert profile is not None
        profile_id = profile[0]
        connection.execute(
            """
            INSERT INTO public.user_saved_content
                (user_id, user_language_id, content_id, language_code)
            VALUES (%s, %s, %s, 'en')
            """,
            (actor_id, profile_id, CONTENT_ONE),
        )
        connection.execute(
            """
            INSERT INTO public.user_saved_concepts
                (user_id, user_language_id, concept_id, language_code)
            VALUES (%s, %s, %s, 'en')
            """,
            (actor_id, profile_id, CONCEPT_ONE),
        )


def _table_snapshots(database_url: str, tables: tuple[str, ...]) -> dict[str, TableSnapshot]:
    snapshots: dict[str, TableSnapshot] = {}
    with psycopg.connect(database_url) as connection:
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        for table in tables:
            rows = connection.execute(
                sql.SQL(
                    "SELECT to_jsonb(snapshot_row)::text "
                    "FROM public.{} AS snapshot_row "
                    "ORDER BY to_jsonb(snapshot_row)::text"
                ).format(sql.Identifier(table))
            ).fetchall()
            row_digests = tuple(
                sorted(hashlib.sha256(str(row[0]).encode("utf-8")).hexdigest() for row in rows)
            )
            digest = hashlib.sha256()
            for row_digest in row_digests:
                digest.update(bytes.fromhex(row_digest))
                digest.update(b"\n")
            snapshots[table] = TableSnapshot(len(rows), digest.hexdigest(), row_digests)
    return snapshots


def _assert_existing_catalog_rows_retained(
    before: dict[str, TableSnapshot], after: dict[str, TableSnapshot]
) -> None:
    for table, prior in before.items():
        current = after[table]
        assert current.row_count >= prior.row_count, table
        assert Counter(prior.row_digests) <= Counter(current.row_digests), table


def _assert_reader_fixture_and_nonempty_learner(
    database_url: str, learner_snapshot: dict[str, TableSnapshot]
) -> None:
    with psycopg.connect(database_url) as connection:
        assert connection.execute(
            "SELECT EXISTS (SELECT 1 FROM public.content_items WHERE id = %s)",
            (CONTENT_ONE,),
        ).fetchone() == (True,)
    assert learner_snapshot["users"].row_count == 1
    assert learner_snapshot["learner_profiles"].row_count == 1
    assert learner_snapshot["user_languages"].row_count == 1
    assert learner_snapshot["user_saved_content"].row_count == 1
    assert learner_snapshot["user_saved_concepts"].row_count == 1
    assert sum(table.row_count for table in learner_snapshot.values()) >= 5


def _migration_ledger(database_url: str) -> list[tuple[str, str, str]]:
    with psycopg.connect(database_url) as connection:
        rows = connection.execute(
            "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version"
        ).fetchall()
    return [(str(version), str(name), str(checksum)) for version, name, checksum in rows]


@pytest.mark.parametrize("isolated_postgres_at_migration", ["0020"], indirect=True)
def test_0020_to_0021_preserves_reader_catalog_and_nonempty_learner_state(
    isolated_postgres_at_migration: tuple[str, Path],
) -> None:
    database_url, prefix_migrations_dir = isolated_postgres_at_migration
    ledger_before = _migration_ledger(database_url)
    assert ledger_before and ledger_before[-1][0] == "0020"
    with psycopg.connect(database_url) as connection:
        assert connection.execute("SELECT to_regnamespace('private') IS NULL").fetchone() == (True,)

    _seed_reader_and_learner(database_url)
    catalog_before = _table_snapshots(database_url, K210_CATALOG_TABLES)
    learner_before = _table_snapshots(database_url, EXPECTED_LEARNER_TABLES)
    _assert_reader_fixture_and_nonempty_learner(database_url, learner_before)

    for migration_path in MIGRATIONS_DIR.glob("0021_*.sql"):
        shutil.copyfile(migration_path, prefix_migrations_dir / migration_path.name)
    assert migrate_up(database_url, prefix_migrations_dir) == ["0021"]

    ledger_after = _migration_ledger(database_url)
    assert ledger_after[:-1] == ledger_before
    assert ledger_after[-1][0:2] == ("0021", "k2_09_hosted_fixture_control")
    with psycopg.connect(database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM private.k2_hosted_fixture_receipts"
        ).fetchone() == (0,)
    assert _table_snapshots(database_url, K210_CATALOG_TABLES) == catalog_before
    assert _table_snapshots(database_url, EXPECTED_LEARNER_TABLES) == learner_before


def test_starter_and_grammar_import_replay_and_word_sense_collision_preserve_state(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    _seed_reader_and_learner(database_url)
    catalog_plan, grammar_plan = _build_import_plans()
    assert catalog_plan["counts"]["concepts"] == 108
    assert len(catalog_plan["rows"]) == 108
    assert len(grammar_plan["rows"]) == 8

    catalog_before = _table_snapshots(database_url, K210_CATALOG_TABLES)
    learner_before = _table_snapshots(database_url, EXPECTED_LEARNER_TABLES)
    _assert_reader_fixture_and_nonempty_learner(database_url, learner_before)

    IMPORTER.apply_plan(catalog_plan, database_url, grammar_plan)
    catalog_after_first_apply = _table_snapshots(database_url, K210_CATALOG_TABLES)
    learner_after_first_apply = _table_snapshots(database_url, EXPECTED_LEARNER_TABLES)
    _assert_existing_catalog_rows_retained(catalog_before, catalog_after_first_apply)
    for table in set(K210_CATALOG_TABLES) - IMPORTER_MUTATED_CATALOG_TABLES:
        assert catalog_after_first_apply[table] == catalog_before[table], table
    assert (
        catalog_after_first_apply["concepts"].row_count
        == catalog_before["concepts"].row_count + 108
    )
    assert (
        catalog_after_first_apply["grammar_specifications"].row_count
        == catalog_before["grammar_specifications"].row_count + 8
    )
    assert learner_after_first_apply == learner_before

    IMPORTER.apply_plan(catalog_plan, database_url, grammar_plan)
    catalog_after_replay = _table_snapshots(database_url, K210_CATALOG_TABLES)
    assert catalog_after_replay == catalog_after_first_apply
    assert _table_snapshots(database_url, EXPECTED_LEARNER_TABLES) == learner_before

    lexical_row = next(row for row in catalog_plan["rows"] if "senseId" in row)
    with psycopg.connect(database_url) as connection:
        updated = connection.execute(
            "UPDATE public.word_senses SET definition = %s WHERE id = %s",
            ("Intentional K2-10 collision fixture", lexical_row["senseId"]),
        )
        assert updated.rowcount == 1

    catalog_before_collision_attempt = _table_snapshots(database_url, K210_CATALOG_TABLES)
    learner_before_collision_attempt = _table_snapshots(database_url, EXPECTED_LEARNER_TABLES)
    with pytest.raises(IMPORTER.ImportError, match="word sense content collision"):
        IMPORTER.apply_plan(catalog_plan, database_url, grammar_plan)
    assert _table_snapshots(database_url, K210_CATALOG_TABLES) == catalog_before_collision_attempt
    assert (
        _table_snapshots(database_url, EXPECTED_LEARNER_TABLES)
        == learner_before_collision_attempt
        == learner_before
    )


def test_k210_first_today_read_must_follow_save_to_select_the_review_target(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    seed_path = ROOT / "database" / "seeds" / "first_real_learning_loop.sql"
    concept_id = uuid.UUID("7f110000-0000-4000-8000-000000000004")
    actor_ids = (uuid.uuid4(), uuid.uuid4())
    profile_ids: list[uuid.UUID] = []
    with psycopg.connect(database_url) as connection:
        connection.execute(seed_path.read_text(encoding="utf-8"))
        for actor_id in actor_ids:
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
            connection.execute("INSERT INTO public.users (id) VALUES (%s)", (actor_id,))
            connection.execute(
                """
                INSERT INTO public.learner_profiles (user_id, time_zone)
                VALUES (%s, 'Asia/Ho_Chi_Minh')
                """,
                (actor_id,),
            )
            profile = connection.execute(
                """
                INSERT INTO public.user_languages
                    (user_id, language_code, interface_language_code, native_language_code,
                     goal, daily_minutes)
                VALUES (%s, 'en', 'vi', 'vi', 'communication', 15)
                RETURNING id
                """,
                (actor_id,),
            ).fetchone()
            assert profile is not None
            profile_ids.append(uuid.UUID(str(profile[0])))
        database_now = connection.execute("SELECT clock_timestamp()").fetchone()
        assert database_now is not None and isinstance(database_now[0], datetime)
        connection.commit()

    class FixedClock:
        def __init__(self, now: datetime) -> None:
            self._now = now

        def now(self) -> datetime:
            return self._now

    # Make both real FSRS lineages due before Today reads them; do not edit
    # scheduler state directly in SQL.
    save_clock = FixedClock(database_now[0].astimezone(UTC) - timedelta(days=1))
    library = LibraryApplication(
        database_url,
        cursor_secret=b"k210-first-today-ordering-test-cursor-secret",
        clock=save_clock,
    )
    today = TodayApplication(database_url)
    early_actor = AuthenticatedActor(actor_ids[0])
    save_first_actor = AuthenticatedActor(actor_ids[1])

    early_plan = today.get_plan(
        actor=early_actor, language_profile_id=profile_ids[0], requested_date=None
    )
    assert not any(activity.activity_type == "review" for activity in early_plan.activities)
    library.save_concept(actor=early_actor, concept_id=concept_id)
    saved_review = _review_item_for(database_url, actor_ids[0], concept_id)
    assert saved_review is not None

    replayed_early_plan = today.get_plan(
        actor=early_actor, language_profile_id=profile_ids[0], requested_date=None
    )
    assert replayed_early_plan.id == early_plan.id
    assert not any(
        activity.activity_type == "review" for activity in replayed_early_plan.activities
    )
    with psycopg.connect(database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM today_activity_review_items WHERE user_id = %s",
            (actor_ids[0],),
        ).fetchone() == (0,)

    library.save_concept(actor=save_first_actor, concept_id=concept_id)
    saved_first_review = _review_item_for(database_url, actor_ids[1], concept_id)
    assert saved_first_review is not None
    first_today_plan = today.get_plan(
        actor=save_first_actor, language_profile_id=profile_ids[1], requested_date=None
    )
    review_activities = [
        activity for activity in first_today_plan.activities if activity.activity_type == "review"
    ]
    assert len(review_activities) == 1
    review_activity = review_activities[0]
    assert review_activity.target_count == 1
    assert "FSRS_DUE" in review_activity.reason_codes
    assert review_activity.review_item_id == saved_first_review
    with psycopg.connect(database_url) as connection:
        mappings = connection.execute(
            """
            SELECT mapping.activity_id, mapping.review_item_id
            FROM public.today_activity_review_items AS mapping
            JOIN public.today_plan_activities AS activity
              ON activity.id = mapping.activity_id AND activity.user_id = mapping.user_id
            WHERE activity.plan_id = %s AND mapping.user_id = %s
            ORDER BY mapping.position
            """,
            (first_today_plan.id, actor_ids[1]),
        ).fetchall()
        plan_count = connection.execute(
            """
            SELECT count(*) FROM public.today_plans
            WHERE user_id = %s AND user_language_id = %s AND plan_date = %s
            """,
            (actor_ids[1], profile_ids[1], first_today_plan.plan_date),
        ).fetchone()
    assert mappings == [(review_activity.id, saved_first_review)]
    assert plan_count == (1,)

    replayed_save_first_plan = today.get_plan(
        actor=save_first_actor, language_profile_id=profile_ids[1], requested_date=None
    )
    assert replayed_save_first_plan.id == first_today_plan.id
    assert replayed_save_first_plan.activities == first_today_plan.activities


def _review_item_for(
    database_url: str, actor_id: uuid.UUID, concept_id: uuid.UUID
) -> uuid.UUID | None:
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            "SELECT id FROM public.review_items WHERE user_id = %s AND concept_id = %s",
            (actor_id, concept_id),
        ).fetchone()
    return None if row is None else uuid.UUID(str(row[0]))


def test_frll_probe_accepts_real_saved_and_reviewed_fsrs_shapes(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    actor_id = uuid.uuid4()
    fixed_at = datetime(2026, 10, 8, 0, 0, tzinfo=UTC)

    class FixedClock:
        def now(self) -> datetime:
            return fixed_at

    with psycopg.connect(database_url) as connection:
        seed_path = ROOT / "database" / "seeds" / "first_real_learning_loop.sql"
        connection.execute(seed_path.read_text(encoding="utf-8"))
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO public.learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        profile = connection.execute(
            """
            INSERT INTO public.user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 15)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert profile is not None
        profile_id = uuid.UUID(str(profile[0]))

    actor = AuthenticatedActor(actor_id)
    clock = FixedClock()
    LibraryApplication(
        database_url,
        cursor_secret=b"k210-frll-probe-test-cursor-secret",
        clock=clock,
    ).save_concept(actor=actor, concept_id=uuid.UUID("7f110000-0000-4000-8000-000000000004"))

    def read_proof(idempotency_key_sha256: str | None = None) -> dict[str, Any]:
        with psycopg.connect(database_url) as connection, connection.transaction():
            connection.execute("SET TRANSACTION READ ONLY")
            return k2_hosted_probe._frll_semantic_proof(
                connection,
                actor_id,
                profile_id,
                idempotency_key_sha256,
            )

    saved = read_proof()
    assert saved["save"]["reviewItemRows"] == 1
    assert saved["save"]["fsrsStateRows"] == 1
    assert saved["concept"]["mastery"] is None
    assert saved["concept"]["exposureCount"] == 0
    assert saved["concept"]["lastSeenAt"] is None
    assert saved["memory"] == {
        "rowCount": 1,
        "state": "new",
        "stateVersion": 1,
        "dueAt": "2026-10-08T00:00:00+00:00",
        "lastReviewedAt": None,
        "difficulty": None,
        "stability": None,
        "step": None,
        "paramsVersion": saved["memory"]["paramsVersion"],
    }

    with psycopg.connect(database_url) as connection:
        review_item = connection.execute(
            "SELECT id FROM public.review_items WHERE user_id = %s AND concept_id = %s",
            (actor_id, uuid.UUID("7f110000-0000-4000-8000-000000000004")),
        ).fetchone()
        assert review_item is not None
        review_item_id = uuid.UUID(str(review_item[0]))

    idempotency_key = uuid.uuid4()
    ReviewApplication(
        database_url,
        cursor_secret=b"k210-frll-review-test-cursor-secret",
        clock=clock,
    ).answer(
        actor=actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        submission=ReviewSubmission(
            idempotency_key=idempotency_key,
            rating=ReviewRating.GOOD,
            response_time_ms=820,
            correct=None,
            response_text=None,
            selected_option_id=None,
        ),
    )

    reviewed = read_proof(hashlib.sha256(str(idempotency_key).encode("utf-8")).hexdigest())
    assert reviewed["review"]["eventRows"] == 1
    assert reviewed["review"]["exerciseMode"] == "self_recall"
    assert reviewed["review"]["evidenceMode"] == "production"
    assert reviewed["review"]["idempotencyKeyMatched"] is True
    result_memory = reviewed["review"]["resultMemory"]
    assert result_memory is not None
    assert result_memory["state"] == "learning"
    assert result_memory["step"] == 1
    assert reviewed["memory"]["state"] == result_memory["state"]
    assert reviewed["memory"]["step"] == result_memory["step"]
    if result_memory["state"] == "review":
        assert result_memory["step"] is None
    else:
        assert type(result_memory["step"]) is int and result_memory["step"] >= 0

    node_executable = shutil.which("node")
    vitest_cli = ROOT / "node_modules" / "vitest" / "vitest.mjs"
    assert node_executable is not None and vitest_cli.is_file(), (
        "Node 22 and locked Vitest are required for the FRLL proof gate"
    )
    child_environment = {
        name: os.environ[name]
        for name in ("PATH", "SystemRoot", "WINDIR", "PATHEXT", "TEMP", "TMP")
        if name in os.environ
    }
    child_environment["K2_FRLL_PG_PROOF_ROUNDTRIP"] = "1"
    proof_payload = json.dumps(
        {"saved": saved, "reviewed": reviewed}, separators=(",", ":"), allow_nan=False
    )
    try:
        typescript_check = subprocess.run(
            [
                node_executable,
                str(vitest_cli),
                "run",
                "tests/acceptance/support/k2_hosted_probe_client.test.ts",
                "--pool=threads",
                "--maxWorkers=1",
                "--minWorkers=1",
                "--testNamePattern=round-trips actual DB FRLL proof through parser and wave checks",
            ],
            cwd=ROOT,
            env=child_environment,
            input=proof_payload,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            check=False,
            timeout=45,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise AssertionError(
            "The TypeScript PostgreSQL FRLL proof roundtrip did not complete."
        ) from None
    saved_status_match = re.search(
        r"K2_FRLL_ROUNDTRIP_PASS savedStatus="
        r"(unseen|discovered|learning|familiar|active|mastered|weak|forgotten)",
        typescript_check.stdout,
    )
    if typescript_check.returncode != 0 or saved_status_match is None:
        output = f"{typescript_check.stdout}\n{typescript_check.stderr}"
        safe_diagnostics = (
            "PostgreSQL FRLL proof roundtrip input was invalid.",
            "K2 hosted acceptance FRLL semantic proof was invalid.",
            "K2 hosted acceptance FRLL Save did not create exactly one intent "
            "and primary Memory lineage.",
            "FRLL fresh Save concept confidence: differs from persisted numeric(10,8) authority.",
            "K2 hosted acceptance FRLL Review did not persist one atomic Memory "
            "and competence transition.",
            "FRLL Review memory receipt was missing.",
            "FRLL Review competence receipt was missing.",
            "FRLL persisted memory difficulty: differs from persisted numeric(7,4) authority.",
            "FRLL persisted memory stability: differs from persisted numeric(12,4) authority.",
            "FRLL persisted memory version: differs from persisted authority.",
            "FRLL persisted memory dueAt: differs from persisted authority.",
            "FRLL persisted memory lastReviewedAt: differs from persisted authority.",
            "FRLL persisted memory step: differs from persisted authority.",
            "FRLL persisted memory parameters: differs from persisted authority.",
            "FRLL persisted production score: differs from persisted numeric(10,8) authority.",
            "FRLL persisted production confidence: differs from persisted numeric(10,8) authority.",
            "FRLL persisted production evidenceCount: differs from persisted authority.",
            "FRLL persisted production timestamp: differs from persisted authority.",
        )
        diagnostic = next((message for message in safe_diagnostics if message in output), None)
        if diagnostic is None:
            diagnostic = (
                "bridge test did not start"
                if "round-trips actual DB FRLL proof" not in output
                else "bridge test ran without its fixed pass marker"
            )
        raise AssertionError(f"The TypeScript hosted FRLL parser/wave proof failed: {diagnostic}")
    print(f"Sanitized PostgreSQL Save status: {saved_status_match.group(1)}")
