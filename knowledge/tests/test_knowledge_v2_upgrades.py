#!/usr/bin/env python3
"""Comprehensive unit test suite for Knowledge System V2 upgrades (Tasks #2, #3, #8, #10).

Verifies:
1. reader_pack_import_v2.py: 12 bilingual articles, 96 sentences, only real PostgreSQL tables.
2. build_audio_manifest_v2.py: 830 lexical + 96 sentence descriptors (926 total), media_assets SQL.
3. validate_b2_readiness.py: freeze_compliant == True, active_b2_leaks == 0, 4 B2 gates documented.
"""

from __future__ import annotations

import json
import re
import sys
import unittest
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_DIR = REPO_ROOT / "knowledge"

if str(KNOWLEDGE_DIR) not in sys.path:
    sys.path.insert(0, str(KNOWLEDGE_DIR))

from build_audio_manifest_v2 import (  # noqa: E402
    build_audio_manifest_v2,
    generate_audio_assets_sql,
    generate_media_assets_sql,
)
from reader_pack_import_v2 import (  # noqa: E402
    ALLOWED_READER_TABLES,
    FORBIDDEN_LEARNER_TABLES,
    PHANTOM_TABLES,
    generate_reader_pack_sql,
    validate_bilingual_pack_v2,
)
from validate_b2_readiness import evaluate_b2_readiness  # noqa: E402


class TestReaderPackImportV2(unittest.TestCase):
    """Test bilingual reader content pack importer and SQL generation."""

    def test_reader_pack_v2_validates_12_articles_and_96_sentences(self) -> None:
        summary = validate_bilingual_pack_v2()
        self.assertEqual(summary["pack_id"], "pilot-reader-vi-pack-a0-b1-v2")
        self.assertEqual(summary["article_count"], 12)
        self.assertEqual(summary["total_sentences"], 96)
        self.assertEqual(summary["levels_covered"], ["A0", "A1", "A2", "B1"])
        self.assertTrue(summary["concept_references_verified"])
        self.assertEqual(summary["total_concept_references"], 277)
        self.assertEqual(len(summary["pack_sha256"]), 64)

    def test_reader_pack_sql_targets_only_real_tables_and_zero_phantoms(
        self,
    ) -> None:
        sql = generate_reader_pack_sql()
        self.assertTrue(
            sql.startswith(
                "-- LINGUA OS Bilingual Reader Content Pack V2 Transactional Apply Script"
            )
        )
        self.assertIn("BEGIN;", sql)
        self.assertIn("COMMIT;", sql)

        # Real PostgreSQL tables from migrations 0001 and 0005
        for table in ALLOWED_READER_TABLES:
            self.assertIn(
                f"public.{table}",
                sql,
                f"Expected real table public.{table} missing from generated SQL",
            )

        # Zero phantom tables
        for phantom in PHANTOM_TABLES:
            self.assertNotIn(
                phantom,
                sql,
                f"Forbidden phantom table '{phantom}' detected in generated SQL",
            )

        # Zero learner state tables
        for learner_table in FORBIDDEN_LEARNER_TABLES:
            self.assertNotIn(
                learner_table,
                sql,
                f"Forbidden learner-state table '{learner_table}' detected in generated SQL",
            )

    def test_reader_pack_sql_file_is_present_and_reproducible(self) -> None:
        plan_file = KNOWLEDGE_DIR / "v2" / "reader_pack_apply_plan.v2.sql"
        self.assertTrue(
            plan_file.exists(),
            "Expected reader_pack_apply_plan.v2.sql to exist",
        )
        file_sql = plan_file.read_text(encoding="utf-8")
        generated_sql = generate_reader_pack_sql()
        self.assertEqual(file_sql.strip(), generated_sql.strip())


class TestBuildAudioManifestV2(unittest.TestCase):
    """Test deterministic audio pronunciation asset manifest and SQL generation."""

    def test_build_audio_manifest_generates_830_lexical_and_96_sentence_descriptors(
        self,
    ) -> None:
        manifest = build_audio_manifest_v2()
        counts = manifest["counts"]

        self.assertEqual(counts["totalAudioAssets"], 926)
        self.assertEqual(counts["lexicalAudioAssets"], 830)
        self.assertEqual(counts["sentenceAudioAssets"], 96)
        self.assertEqual(counts["byAccent"]["en-US"], 511)
        self.assertEqual(counts["byAccent"]["en-GB"], 415)
        self.assertEqual(len(manifest["assets"]), 926)
        self.assertEqual(len(manifest["manifestSha256"]), 64)

    def test_deterministic_audio_asset_ids_and_paths(self) -> None:
        manifest = build_audio_manifest_v2()
        seen_ids: set[str] = set()
        seen_paths: set[str] = set()

        explicit_ipa_count = 0
        for asset in manifest["assets"]:
            aid = asset["audio_asset_id"]
            self.assertNotIn(aid, seen_ids, f"Duplicate audio_asset_id: {aid}")
            seen_ids.add(aid)

            # Validate valid UUID format
            parsed_uuid = uuid.UUID(aid)
            self.assertEqual(str(parsed_uuid), aid)

            path = asset["storage_path"]
            self.assertNotIn(path, seen_paths, f"Duplicate storage_path: {path}")
            seen_paths.add(path)

            self.assertEqual(asset["mime_type"], "audio/mpeg")
            self.assertTrue(asset["transcript"])
            self.assertGreater(asset["duration_ms"], 0)
            self.assertEqual(len(asset["content_sha256"]), 64)

            if asset["asset_type"] == "lexeme":
                self.assertIn(asset["accent"], ("en-US", "en-GB"))
                self.assertTrue(asset["concept_id"])
                self.assertTrue(
                    re.match(
                        r"^audio/v2/lexemes/[0-9a-f-]+/(en-US|en-GB)\.mp3$",
                        path,
                    )
                )
                if asset["ipa"] is not None:
                    explicit_ipa_count += 1
            elif asset["asset_type"] == "sentence":
                self.assertEqual(asset["accent"], "en-US")
                self.assertTrue(asset["sentence_id"])
                self.assertTrue(re.match(r"^audio/v2/sentences/[0-9a-f-]+\.mp3$", path))
                self.assertIsNone(asset["ipa"])

        # Exactly 30 explicit phonetic profiles (15 concepts x 2 accents)
        self.assertEqual(explicit_ipa_count, 30)

    def test_generate_media_assets_sql(self) -> None:
        media_sql = generate_media_assets_sql()
        self.assertTrue(media_sql.startswith("-- LINGUA OS Audio/Media Assets"))
        self.assertIn("BEGIN;", media_sql)
        self.assertIn("COMMIT;", media_sql)
        self.assertIn("INSERT INTO media_assets", media_sql)
        self.assertIn("ON CONFLICT (id) DO UPDATE SET", media_sql)
        self.assertIn("storage_uri = EXCLUDED.storage_uri", media_sql)

        # Also test generate_audio_assets_sql which targets public.audio_assets
        audio_sql = generate_audio_assets_sql()
        self.assertIn("INSERT INTO public.audio_assets", audio_sql)

    def test_audio_assets_manifest_file_is_present(self) -> None:
        manifest_file = KNOWLEDGE_DIR / "v2" / "audio_assets_manifest.v2.json"
        self.assertTrue(manifest_file.exists(), "Expected audio_assets_manifest.v2.json")
        data = json.loads(manifest_file.read_text(encoding="utf-8"))
        self.assertEqual(data["counts"]["totalAudioAssets"], 926)


class TestValidateB2Readiness(unittest.TestCase):
    """Test B2 readiness and CEFR freeze compliance audit."""

    def test_freeze_compliant_and_zero_b2_leaks(self) -> None:
        report = evaluate_b2_readiness()
        self.assertTrue(report["freeze_compliant"])
        self.assertEqual(report["active_b2_leaks"], 0)
        self.assertEqual(report["leaks"], [])
        self.assertEqual(report["frozen_levels_enforced"], ["A0", "A1", "A2", "B1"])

        audit = report["audit_findings"]
        self.assertEqual(audit["contracts_enums_json"]["status"], "freeze_compliant")
        self.assertEqual(audit["contracts_openapi_yaml"]["status"], "freeze_compliant")
        self.assertEqual(audit["database_migration_0001"]["status"], "freeze_compliant")
        self.assertEqual(audit["knowledge_v2_catalog"]["status"], "freeze_compliant")

    def test_post_pilot_b2_checklist_documents_four_gates(self) -> None:
        report = evaluate_b2_readiness()
        checklist = report["post_pilot_b2_checklist"]

        expected_gates = [
            "database_migration_proficiency_levels",
            "contracts_enums_json",
            "contracts_openapi_yaml",
            "knowledge_v2_curriculum_band",
        ]
        self.assertEqual(list(checklist.keys()), expected_gates)

        for gate in expected_gates:
            self.assertIn(gate, checklist)
            self.assertEqual(checklist[gate]["status"], "pending_post_pilot")
            self.assertTrue(checklist[gate]["description"])
            self.assertTrue(checklist[gate]["file"])
            self.assertTrue(checklist[gate]["action_required"])


if __name__ == "__main__":
    unittest.main()
