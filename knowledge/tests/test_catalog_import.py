from __future__ import annotations

import copy
import importlib.util
import inspect
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "knowledge" / "catalog_import.py"
SPEC = importlib.util.spec_from_file_location("catalog_import", MODULE_PATH)
assert SPEC and SPEC.loader
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def candidate():
    concepts = []
    counts = {"word": 77, "phrase": 16, "grammar": 8, "skill": 7}
    bands = ["LINGUA_A0", "LINGUA_A1", "LINGUA_A2", "LINGUA_B1"]
    for ctype, count in counts.items():
        for i in range(count):
            form = f"{ctype} form {i}"
            concepts.append({
                "canonicalKey": f"{ctype}:test-{i}" if ctype != "word" else f"word:test-{i}:noun",
                "conceptType": ctype,
                "canonicalForm": form,
                "partOfSpeech": "noun" if ctype == "word" else None,
                "curriculumBand": bands[i % len(bands)],
                "topic": f"topic-{i % 5}",
                "vietnameseGloss": f"nghĩa {i}",
                "vietnameseSupport": f"giải thích {i}",
                "example": {
                    "en": f"Example {i} with {form}.",
                    "vi": f"Ví dụ {i}.",
                    "rights": "FIRST_PARTY",
                },
                "prerequisites": [],
            })
    value = {
        "schemaVersion": "knowledge-production-starter-candidate.v1",
        "status": "STAGING_CANDIDATE_REVIEW_REQUIRED",
        "counts": {"selectedConcepts": 108},
        "concepts": concepts,
    }
    value["candidateSha256"] = M.digest(value)
    return value


class CatalogImportTests(unittest.TestCase):
    def test_plan_is_deterministic_complete_and_catalog_only(self):
        p1 = M.build_plan(candidate())
        p2 = M.build_plan(candidate())
        self.assertEqual(p1, p2)
        self.assertEqual(p1["schemaVersion"], "knowledge-catalog-apply-plan.v2")
        self.assertEqual(p1["counts"]["concepts"], 108)
        self.assertEqual(p1["counts"]["lexicalConcepts"], 93)
        self.assertEqual(p1["counts"]["sentences"], 108)
        self.assertEqual(p1["counts"]["sentenceTranslations"], 108)
        self.assertEqual(p1["counts"]["sentenceConcepts"], 108)
        self.assertEqual(p1["counts"]["prerequisiteRelations"], 0)
        self.assertEqual(
            p1["counts"]["byType"],
            {"grammar": 8, "phrase": 16, "skill": 7, "word": 77},
        )
        self.assertEqual(p1["source"]["reviewStatus"], "review_pending")
        self.assertEqual(p1["source"]["transformVersion"], "knowledge-catalog-import.v3")
        self.assertEqual(len(p1["rows"]), 108)
        self.assertTrue(all(row["sourceMetadata"]["concept"] for row in p1["rows"]))

        apply_source = "\n".join(
            inspect.getsource(fn)
            for fn in (M._assert_preflight, M._insert_source_records, M.apply_plan, M._assert_post_apply)
        ).lower()
        for required in (
            "concept_relations",
            "sentences",
            "sentence_translations",
            "sentence_concepts",
            "framework_mappings",
            "word_senses",
        ):
            self.assertIn(required, apply_source)
        for forbidden in (
            "fsrs_states",
            "review_items",
            "learning_events",
            "user_concept_states",
            "today_plans",
            "user_saved_concepts",
        ):
            self.assertNotIn(forbidden, apply_source)

    def test_staging_apply_cannot_mark_source_records_approved(self):
        apply_source = "\n".join(
            inspect.getsource(fn)
            for fn in (M._insert_source_records, M.apply_plan, M._assert_post_apply)
        )
        self.assertIn('source["reviewStatus"]', apply_source)
        self.assertNotIn("'approved'", apply_source)
        self.assertNotIn('"approved"', apply_source)
        self.assertEqual(M.STAGING_REVIEW_STATUS, "review_pending")

    def test_prerequisite_direction_and_count_are_preserved(self):
        c = candidate()
        dependent = c["concepts"][0]
        prerequisite = c["concepts"][1]
        dependent["prerequisites"] = [prerequisite["canonicalKey"]]
        p = M.build_plan(c)
        self.assertEqual(p["counts"]["prerequisiteRelations"], 1)
        relation = p["relations"][0]
        self.assertEqual(relation["sourceCanonicalKey"], dependent["canonicalKey"])
        self.assertEqual(relation["targetCanonicalKey"], prerequisite["canonicalKey"])
        self.assertEqual(relation["relationType"], "prerequisite")
        self.assertEqual(relation["weight"], 1.0)

    def test_rejects_missing_and_cyclic_prerequisites(self):
        missing = candidate()
        missing["concepts"][0]["prerequisites"] = ["word:missing:noun"]
        with self.assertRaises(M.ImportError):
            M.build_plan(missing)

        cyclic = candidate()
        first = cyclic["concepts"][0]["canonicalKey"]
        second = cyclic["concepts"][1]["canonicalKey"]
        cyclic["concepts"][0]["prerequisites"] = [second]
        cyclic["concepts"][1]["prerequisites"] = [first]
        with self.assertRaises(M.ImportError):
            M.build_plan(cyclic)

    def test_utf16_offsets_and_nonliteral_fallback_are_honest(self):
        exact = M.example_span("word", "phone", "😀 phone works.")
        self.assertEqual(exact["startOffset"], 3)
        self.assertEqual(exact["endOffset"], 8)
        self.assertEqual(exact["occurrenceRole"], "target")
        self.assertEqual(exact["matchKind"], "exact_surface_match")

        inflected = M.example_span("word", "be", "I am tired.")
        self.assertEqual(inflected["startOffset"], 0)
        self.assertEqual(inflected["endOffset"], M.utf16_length("I am tired."))
        self.assertEqual(inflected["occurrenceRole"], "context")
        self.assertEqual(inflected["matchKind"], "no_exact_surface_match")

        grammar = M.example_span("grammar", "basic be statements", "We are at home.")
        self.assertEqual(grammar["occurrenceRole"], "grammar")
        self.assertEqual(grammar["endOffset"], M.utf16_length("We are at home."))

    def test_source_metadata_preserves_first_party_candidate_payload(self):
        c = candidate()
        p = M.build_plan(c)
        row = p["rows"][0]
        original = next(x for x in c["concepts"] if x["canonicalKey"] == row["canonicalKey"])
        self.assertEqual(row["sourceMetadata"]["concept"], original)
        self.assertEqual(row["sourceMetadata"]["rights"], "FIRST_PARTY")
        self.assertTrue(row["sourceMetadata"]["stagingCandidate"])

    def test_rejects_non_first_party_or_incomplete_example(self):
        c = candidate()
        c["concepts"][0]["example"]["rights"] = "UNKNOWN"
        with self.assertRaises(M.ImportError):
            M.build_plan(c)

        c = candidate()
        c["concepts"][0]["example"]["vi"] = ""
        with self.assertRaises(M.ImportError):
            M.build_plan(c)

    def test_rejects_type_count_drift(self):
        c = candidate()
        c["concepts"][0]["conceptType"] = "phrase"
        c["concepts"][0]["canonicalKey"] = "phrase:changed"
        with self.assertRaises(M.ImportError):
            M.build_plan(c)

    def test_plan_hash_changes_when_content_changes(self):
        c1 = candidate()
        c2 = copy.deepcopy(c1)
        c2["concepts"][0]["vietnameseSupport"] = "nội dung khác"
        c2.pop("candidateSha256")
        c2["candidateSha256"] = M.digest(c2)
        self.assertNotEqual(M.build_plan(c1)["planSha256"], M.build_plan(c2)["planSha256"])


if __name__ == "__main__":
    unittest.main()
