#!/usr/bin/env python3
"""Comprehensive test suite for LINGUA OS Knowledge System V2 Curriculum Expansion."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1]
if str(KNOWLEDGE_DIR) not in sys.path:
    sys.path.insert(0, str(KNOWLEDGE_DIR))

from build_knowledge_v2 import _verify_dag_acyclicity, compile_knowledge_v2  # noqa: E402
from catalog_import_v2 import (  # noqa: E402
    ALLOWED_CATALOG_TABLES,
    PHANTOM_TABLES,
    build_v2_apply_plan,
    generate_sql,
)


class TestKnowledgeV2Expansion(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.compiled = compile_knowledge_v2(KNOWLEDGE_DIR)
        cls.apply_plan = build_v2_apply_plan(KNOWLEDGE_DIR)
        cls.sql = generate_sql(KNOWLEDGE_DIR)

    def test_total_canonical_concepts_and_clean_a0_b1_expansion(self) -> None:
        summary = self.compiled["summary"]
        self.assertEqual(summary["v1BaselineConcepts"], 108)
        self.assertEqual(summary["newV2LexicalConcepts"], 200)
        self.assertEqual(summary["polysemyLexemeGroups"], 21)
        self.assertEqual(summary["polysemySenseConcepts"], 33)
        self.assertEqual(summary["grammarSpecifications"], 32)
        self.assertEqual(summary["phraseSpecifications"], 40)
        self.assertEqual(summary["skillSpecifications"], 10)
        self.assertEqual(summary["totalCanonicalConcepts"], 415)
        self.assertEqual(len(self.compiled["concepts"]), 415)

    def test_all_four_cefr_bands_balanced_and_zero_b2(self) -> None:
        band_counts = self.compiled["summary"]["countsByCefrBand"]
        expected_bands = {
            "LINGUA_A0": 99,
            "LINGUA_A1": 105,
            "LINGUA_A2": 106,
            "LINGUA_B1": 105,
        }
        self.assertEqual(band_counts, expected_bands)

        # Defect K1 Guard: Zero B2 or LINGUA_B2 concepts permitted
        self.assertNotIn("LINGUA_B2", band_counts)
        self.assertNotIn("B2", band_counts)
        for concept in self.compiled["concepts"]:
            band = concept.get("curriculumBand", "")
            self.assertIn(
                band,
                expected_bands,
                f"Concept {concept['canonicalKey']} has invalid band {band}",
            )
            self.assertFalse("B2" in band or "b2" in band)

    def test_grammar_specifications_have_structural_slots_and_vi_traps(self) -> None:
        self.assertEqual(len(self.compiled["grammarSpecifications"]), 32)
        for spec in self.compiled["grammarSpecifications"]:
            self.assertTrue(spec.get("patternFormula"))
            self.assertTrue(spec.get("vietnameseExplanation"))
            self.assertGreaterEqual(len(spec.get("vietnameseCommonTraps", [])), 1)
            self.assertGreaterEqual(len(spec.get("structuralSlots", [])), 2)

    def test_phrase_specifications_have_slot_templates(self) -> None:
        self.assertEqual(len(self.compiled["phraseSpecifications"]), 40)
        for phrase in self.compiled["phraseSpecifications"]:
            self.assertTrue(phrase.get("basePattern"))
            self.assertGreaterEqual(len(phrase.get("slotTemplate", [])), 1)

    def test_skill_specifications_present(self) -> None:
        self.assertEqual(len(self.compiled["skillSpecifications"]), 10)
        for skill in self.compiled["skillSpecifications"]:
            self.assertEqual(skill.get("conceptType"), "skill")
            self.assertTrue(skill.get("canonicalKey"))

    def test_knowledge_graph_dag_is_strictly_acyclic(self) -> None:
        dag_info = self.compiled["summary"]["dagVerification"]
        self.assertTrue(dag_info["isAcyclic"])
        self.assertEqual(dag_info["totalEdges"], 65)
        valid_keys = {c["canonicalKey"] for c in self.compiled["concepts"]}
        edges = self.compiled["knowledgeGraphEdges"]
        prereq_edges = [e for e in edges if e["relationType"] == "prerequisite_of"]
        self.assertGreater(len(prereq_edges), 0)
        first = prereq_edges[0]
        edges_with_cycle = [
            *edges,
            {
                "sourceCanonicalKey": first["targetCanonicalKey"],
                "targetCanonicalKey": first["sourceCanonicalKey"],
                "relationType": "prerequisite_of",
                "pedagogicalNoteVi": "Artificial reverse edge to verify cycle detection",
            },
        ]
        with self.assertRaises(ValueError):
            _verify_dag_acyclicity(edges_with_cycle, valid_keys)

    def test_phonetic_transcriptions_cover_us_and_gb_accents(self) -> None:
        rows = self.compiled["phoneticTranscriptions"]
        self.assertEqual(len(rows), 30)
        accents = {r["accentVariant"] for r in rows}
        self.assertEqual(accents, {"en_US", "en_GB"})

    def test_bilingual_reader_corpus_covers_12_articles_and_96_sentences(self) -> None:
        articles = self.compiled["bilingualArticles"]
        self.assertEqual(len(articles), 12)
        self.assertEqual(self.compiled["summary"]["bilingualAlignedSentences"], 96)
        by_band: dict[str, int] = {}
        for art in articles:
            level = art["level"]
            by_band[level] = by_band.get(level, 0) + 1
            self.assertEqual(len(art["sentences"]), 8)
            self.assertNotEqual(level, "B2", "Bilingual reader pack must not contain B2 articles")
        self.assertEqual(by_band, {"A0": 3, "A1": 3, "A2": 3, "B1": 3})

    def test_transactional_apply_plan_is_deterministic_and_isolated(self) -> None:
        self.assertTrue(self.apply_plan["transactional"])
        self.assertTrue(self.apply_plan["isolatedFromLearnerState"])
        self.assertEqual(self.apply_plan["forbiddenTablesTouched"], [])

        # Check table operations
        plan_tables = [op["tableName"] for op in self.apply_plan["tableOperations"]]
        for t_name in plan_tables:
            self.assertIn(t_name, ALLOWED_CATALOG_TABLES)
            self.assertNotIn(t_name, PHANTOM_TABLES)

        for phantom in PHANTOM_TABLES:
            self.assertNotIn(phantom, plan_tables)

        second_plan = build_v2_apply_plan(KNOWLEDGE_DIR)
        self.assertEqual(self.apply_plan["planDigestSha256"], second_plan["planDigestSha256"])

    def test_generate_sql_references_only_real_tables_and_zero_phantom_tables(self) -> None:
        # SQL structure
        header_prefix = "-- LINGUA OS Knowledge System V2 Transactional Apply Script"
        self.assertTrue(self.sql.startswith(header_prefix))
        self.assertIn("BEGIN;", self.sql)
        self.assertIn("COMMIT;", self.sql)

        # Real PostgreSQL tables from migrations 0001, 0014, 0015, 0016
        expected_real_tables = [
            "public.concepts",
            "public.framework_mappings",
            "public.lexemes",
            "public.word_senses",
            "public.concept_senses",
            "public.grammar_specifications",
            "public.phrase_specifications",
            "public.phonetic_transcriptions",
            "public.concept_edges",
        ]
        for tbl in expected_real_tables:
            self.assertIn(f"INSERT INTO {tbl}", self.sql, f"Missing expected real table: {tbl}")

        # Zero phantom tables (Defect K2 Guard)
        for phantom in PHANTOM_TABLES:
            self.assertNotIn(
                phantom,
                self.sql,
                f"Phantom table '{phantom}' detected in generated SQL!",
            )


if __name__ == "__main__":
    unittest.main()
