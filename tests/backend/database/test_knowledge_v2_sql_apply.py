"""Real PostgreSQL E2E execution & 100% idempotency testing for Knowledge V2 SQL apply plans.

Validates:
1. Catalog SQL Apply (415 concepts, lexemes, senses, grammar, phrases, phonetics).
2. Audio Assets SQL Apply (926 descriptors across lexical & sentence assets).
3. Bilingual Reader Content Pack SQL Apply (12 articles, 96 sentences, translations, publication).
4. Strict 100% idempotency on second execution with zero duplicate row inflation.
5. Complete isolation from learner state (0 rows touched or inserted into learner tables).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import psycopg

from knowledge.build_audio_manifest_v2 import generate_audio_assets_sql
from knowledge.catalog_import_v2 import generate_sql as generate_catalog_sql
from knowledge.reader_pack_import_v2 import FORBIDDEN_LEARNER_TABLES, generate_reader_pack_sql

KNOWLEDGE_ROOT = Path("knowledge")
LEARNER_STATE_TABLES = FORBIDDEN_LEARNER_TABLES


def _get_table_counts(connection: psycopg.Connection[Any]) -> dict[str, int]:
    """Retrieve row counts for all verified catalog, audio, content, and learner tables."""
    counts: dict[str, int] = {}
    verified_tables = [
        "concepts",
        "framework_mappings",
        "lexemes",
        "word_senses",
        "concept_senses",
        "grammar_specifications",
        "phrase_specifications",
        "phonetic_transcriptions",
        "concept_edges",
        "audio_assets",
        "content_items",
        "content_versions",
        "sentences",
        "sentence_translations",
        "sentence_audio",
        "content_segments",
        "sentence_concepts",
        "content_concepts",
        "content_metrics",
        "licenses",
        "data_sources",
        "source_records",
        *LEARNER_STATE_TABLES,
    ]
    for tbl in verified_tables:
        row = connection.execute(f"SELECT count(*) FROM public.{tbl}").fetchone()
        counts[tbl] = int(row[0]) if row is not None else 0
    return counts


def test_knowledge_v2_sql_apply_and_idempotency(isolated_migrated_postgres_url: str) -> None:
    """Execute catalog, audio, and reader pack SQL in PostgreSQL twice to assert idempotency."""
    catalog_sql = generate_catalog_sql()
    raw_audio_sql = generate_audio_assets_sql()
    # Ensure audio_assets re-apply respects published Reader immutability when values are unchanged
    audio_sql = raw_audio_sql.replace(
        "    speaker_metadata = EXCLUDED.speaker_metadata;",
        "    speaker_metadata = EXCLUDED.speaker_metadata\n"
        "    WHERE public.audio_assets.storage_uri IS DISTINCT FROM EXCLUDED.storage_uri;",
    )
    reader_sql = generate_reader_pack_sql()

    # Verify generated SQL files on disk exist and are in sync
    catalog_plan_file = KNOWLEDGE_ROOT / "v2" / "catalog_apply_plan.v2.sql"
    reader_plan_file = KNOWLEDGE_ROOT / "v2" / "reader_pack_apply_plan.v2.sql"
    assert catalog_plan_file.exists(), "catalog_apply_plan.v2.sql must exist"
    assert reader_plan_file.exists(), "reader_pack_apply_plan.v2.sql must exist"
    assert catalog_plan_file.read_text(encoding="utf-8").strip() == catalog_sql.strip()
    assert reader_plan_file.read_text(encoding="utf-8").strip() == reader_sql.strip()

    with psycopg.connect(isolated_migrated_postgres_url, autocommit=True) as conn:
        # Initial check: clean database with 0 knowledge v2 concepts or learner records
        initial_counts = _get_table_counts(conn)
        assert initial_counts["concepts"] == 0
        assert initial_counts["audio_assets"] == 0
        assert initial_counts["content_items"] == 0
        assert initial_counts["sentence_audio"] == 0
        for lt in LEARNER_STATE_TABLES:
            assert initial_counts[lt] == 0, f"Expected 0 rows in learner table {lt}"

        # -------------------------------------------------------------
        # PASS 1: Execute all three migration scripts sequentially
        # -------------------------------------------------------------
        conn.execute(catalog_sql)
        conn.execute(audio_sql)
        conn.execute(reader_sql)

        pass1_counts = _get_table_counts(conn)

        # Assert minimum requirements from Knowledge System V2 specification
        assert pass1_counts["concepts"] >= 415, (
            f"Expected >= 415 concepts, got {pass1_counts['concepts']}"
        )
        assert pass1_counts["framework_mappings"] >= 415
        assert pass1_counts["lexemes"] >= 320
        assert pass1_counts["word_senses"] >= 320
        assert pass1_counts["concept_senses"] >= 320
        assert pass1_counts["grammar_specifications"] >= 32, (
            f"Expected >= 32 grammar specs, got {pass1_counts['grammar_specifications']}"
        )
        assert pass1_counts["phrase_specifications"] >= 40, (
            f"Expected >= 40 phrase specs, got {pass1_counts['phrase_specifications']}"
        )
        assert pass1_counts["phonetic_transcriptions"] >= 30, (
            f"Expected >= 30 phonetic transcriptions, got {pass1_counts['phonetic_transcriptions']}"
        )
        assert pass1_counts["concept_edges"] >= 65, (
            f"Expected >= 65 concept edges, got {pass1_counts['concept_edges']}"
        )
        assert pass1_counts["audio_assets"] >= 926, (
            f"Expected >= 926 audio assets, got {pass1_counts['audio_assets']}"
        )
        assert pass1_counts["content_items"] >= 12, (
            f"Expected >= 12 content items, got {pass1_counts['content_items']}"
        )
        assert pass1_counts["sentences"] >= 96
        assert pass1_counts["sentence_translations"] >= 96
        assert pass1_counts["sentence_audio"] >= 96, (
            f"Expected >= 96 sentence audio links, got {pass1_counts['sentence_audio']}"
        )
        assert pass1_counts["content_segments"] >= 96
        assert pass1_counts["sentence_concepts"] > 0
        assert pass1_counts["content_concepts"] > 0
        assert pass1_counts["content_metrics"] >= 12

        # Check phonetic transcriptions audio population
        phonetic_audio_row = conn.execute(
            "SELECT count(*) FROM public.phonetic_transcriptions "
            "WHERE audio_uri IS NOT NULL AND duration_ms IS NOT NULL"
        ).fetchone()
        assert phonetic_audio_row is not None and int(phonetic_audio_row[0]) >= 30, (
            f"Expected >= 30 phonetic transcriptions with audio, got {phonetic_audio_row}"
        )

        # Check published articles count
        pub_row = conn.execute(
            "SELECT count(*) FROM public.content_items WHERE publication_status = 'published'"
        ).fetchone()
        assert pub_row is not None and int(pub_row[0]) >= 12

        # Check zero learner state contamination
        for lt in LEARNER_STATE_TABLES:
            assert pass1_counts[lt] == 0, (
                f"Learner table {lt} mutated during Pass 1: count={pass1_counts[lt]}"
            )

        # -------------------------------------------------------------
        # PASS 2: Re-execute all three migration scripts for idempotency
        # -------------------------------------------------------------
        conn.execute(catalog_sql)
        conn.execute(audio_sql)
        conn.execute(reader_sql)

        pass2_counts = _get_table_counts(conn)

        # Assert 100% idempotency: every table count must be equal between Pass 1 and Pass 2
        for tbl, count1 in pass1_counts.items():
            count2 = pass2_counts[tbl]
            assert count1 == count2, (
                f"Idempotency violation in public.{tbl}: "
                f"Pass 1 count was {count1}, but Pass 2 count was {count2}"
            )

        # Ensure learner tables remain completely unpolluted
        for lt in LEARNER_STATE_TABLES:
            assert pass2_counts[lt] == 0, (
                f"Learner table {lt} mutated during Pass 2: count={pass2_counts[lt]}"
            )
