"""PostgreSQL integration coverage for K2-04 grammar catalog hydration."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

import psycopg
import pytest
from psycopg import sql

from scripts.verify_frll_database import LEARNER_DERIVED_TABLES

ROOT = Path(__file__).resolve().parents[3]


def _load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILDER = _load_module("k2_04_starter_builder", ROOT / "knowledge/build_production_starter.py")
IMPORTER = _load_module("k2_04_catalog_importer", ROOT / "knowledge/catalog_import.py")

K2_04_LEARNER_TABLES = (
    *LEARNER_DERIVED_TABLES,
    "user_content_progress",
    "reader_mutation_results",
    "reader_exposure_concepts",
    "assessment_attempt_items",
    "assessment_idempotency_log",
)


def _build_plans() -> tuple[dict[str, Any], dict[str, Any]]:
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
    return catalog_plan, IMPORTER.build_grammar_plan(grammar_manifest, catalog_plan)


def _learner_snapshots(database_url: str) -> dict[str, str]:
    with psycopg.connect(database_url) as connection:
        connection.execute("SET TRANSACTION READ ONLY")
        snapshots: dict[str, str] = {}
        for table in K2_04_LEARNER_TABLES:
            row = connection.execute(
                sql.SQL(
                    "SELECT COALESCE(jsonb_agg(to_jsonb(snapshot_row) "
                    "ORDER BY to_jsonb(snapshot_row)::text), '[]'::jsonb)::text "
                    "FROM {} AS snapshot_row"
                ).format(sql.Identifier(table))
            ).fetchone()
            assert row is not None
            snapshots[table] = str(row[0])
        return snapshots


def _grammar_rows(database_url: str) -> list[tuple[object, ...]]:
    with psycopg.connect(database_url) as connection:
        connection.execute("SET TRANSACTION READ ONLY")
        return connection.execute(
            """
            SELECT grammar.id::text, concept.canonical_key, grammar.concept_id::text,
                   grammar.pattern_formula, grammar.syntactic_category,
                   grammar.pragmatic_function, grammar.vietnamese_explanation,
                   grammar.vietnamese_common_traps, grammar.structural_slots,
                   grammar.created_at
            FROM grammar_specifications AS grammar
            JOIN concepts AS concept ON concept.id = grammar.concept_id
            WHERE concept.canonical_key = ANY(%s)
            ORDER BY concept.canonical_key
            """,
            (sorted(IMPORTER.GRAMMAR_SPEC_KEYS),),
        ).fetchall()


def test_grammar_catalog_apply_is_exact_idempotent_and_learner_state_free(
    isolated_migrated_postgres_url: str,
) -> None:
    catalog_plan, grammar_plan = _build_plans()
    before_learners = _learner_snapshots(isolated_migrated_postgres_url)

    IMPORTER.apply_plan(catalog_plan, isolated_migrated_postgres_url, grammar_plan)
    first_rows = _grammar_rows(isolated_migrated_postgres_url)
    IMPORTER.apply_plan(catalog_plan, isolated_migrated_postgres_url, grammar_plan)
    second_rows = _grammar_rows(isolated_migrated_postgres_url)

    assert len(first_rows) == 8
    assert second_rows == first_rows
    assert _learner_snapshots(isolated_migrated_postgres_url) == before_learners
    assert {str(row[1]) for row in first_rows} == IMPORTER.GRAMMAR_SPEC_KEYS
    assert all(str(row[3]).strip() and str(row[6]).strip() for row in first_rows)
    assert all(isinstance(row[8], list) and row[8] for row in first_rows)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            """
            SELECT NOT EXISTS (
                SELECT 1
                FROM information_schema.table_privileges
                WHERE table_schema = 'public'
                  AND table_name = 'grammar_specifications'
                  AND grantee = 'PUBLIC'
            )
            """
        ).fetchone() == (True,)
        for role in ("anon", "authenticated", "authenticator"):
            assert connection.execute(
                "SELECT has_table_privilege(%s, 'public.grammar_specifications', 'SELECT')",
                (role,),
            ).fetchone() == (False,)


def test_grammar_catalog_apply_rejects_existing_content_collision_atomically(
    isolated_migrated_postgres_url: str,
) -> None:
    catalog_plan, grammar_plan = _build_plans()
    IMPORTER.apply_plan(catalog_plan, isolated_migrated_postgres_url, grammar_plan)
    target = grammar_plan["rows"][0]

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE grammar_specifications SET pragmatic_function = 'collision' "
            "WHERE concept_id = %s",
            (target["conceptId"],),
        )

    before = _grammar_rows(isolated_migrated_postgres_url)
    with pytest.raises(IMPORTER.ImportError, match="identity/content collision"):
        IMPORTER.apply_plan(catalog_plan, isolated_migrated_postgres_url, grammar_plan)
    assert _grammar_rows(isolated_migrated_postgres_url) == before
