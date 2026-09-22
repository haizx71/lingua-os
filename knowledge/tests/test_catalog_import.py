from __future__ import annotations

import copy
import importlib.util
import inspect
import json
import tempfile
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
            concepts.append(
                {
                    "canonicalKey": f"{ctype}:test-{i}"
                    if ctype != "word"
                    else f"word:test-{i}:noun",
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
                }
            )
    value = {
        "schemaVersion": "knowledge-production-starter-candidate.v1",
        "status": "STAGING_CANDIDATE_REVIEW_REQUIRED",
        "counts": {"selectedConcepts": 108},
        "concepts": concepts,
    }
    value["candidateSha256"] = M.digest(value)
    return value


def grammar_candidate():
    value = candidate()
    grammar_rows = [row for row in value["concepts"] if row["conceptType"] == "grammar"]
    for row, key in zip(grammar_rows, sorted(M.GRAMMAR_SPEC_KEYS), strict=True):
        row["canonicalKey"] = key
    value.pop("candidateSha256")
    value["candidateSha256"] = M.digest(value)
    return value


class CatalogImportTests(unittest.TestCase):
    def test_approved_grammar_manifest_builds_deterministic_separate_plan(self):
        manifest = M.load_grammar_manifest(ROOT / "knowledge" / "grammar_specifications.v1.json")
        catalog_plan = M.build_plan(grammar_candidate())
        first = M.build_grammar_plan(manifest, catalog_plan)
        second = M.build_grammar_plan(manifest, catalog_plan)
        self.assertEqual(first, second)
        self.assertEqual(first["schemaVersion"], "knowledge-grammar-specification-apply-plan.v1")
        self.assertEqual(first["manifestSha256"], manifest["manifestSha256"])
        self.assertEqual(first["catalogPlanSha256"], catalog_plan["planSha256"])
        self.assertEqual(first["counts"], {"grammarSpecifications": 8})
        self.assertEqual(len(first["rows"]), 8)
        self.assertEqual({row["canonicalKey"] for row in first["rows"]}, M.GRAMMAR_SPEC_KEYS)
        self.assertTrue(all(len(row["structuralSlots"]) >= 2 for row in first["rows"]))
        self.assertEqual(
            first["planSha256"], M.digest({k: v for k, v in first.items() if k != "planSha256"})
        )

    def test_grammar_manifest_tampering_and_catalog_identity_drift_fail_closed(self):
        source = ROOT / "knowledge" / "grammar_specifications.v1.json"
        tampered = json.loads(source.read_text(encoding="utf-8"))
        tampered["specifications"][0]["patternFormula"] = "tampered"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tampered.json"
            path.write_text(json.dumps(tampered), encoding="utf-8")
            with self.assertRaisesRegex(M.ImportError, "hash verification failed"):
                M.load_grammar_manifest(path)
        manifest = M.load_grammar_manifest(source)
        with self.assertRaisesRegex(M.ImportError, "catalog plan grammar keys"):
            M.build_grammar_plan(manifest, M.build_plan(candidate()))

    def test_grammar_manifest_enforces_api_text_bounds(self):
        source = ROOT / "knowledge" / "grammar_specifications.v1.json"
        manifest = json.loads(source.read_text(encoding="utf-8"))
        manifest["specifications"][0]["patternFormula"] = "x" * 1001
        manifest["manifestSha256"] = M.digest(
            {key: value for key, value in manifest.items() if key != "manifestSha256"}
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "oversized.json"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(M.ImportError, "exceeds 1000 characters"):
                M.load_grammar_manifest(path)

    def test_grammar_apply_path_is_catalog_only_and_collision_sensitive(self):
        apply_source = "\n".join(
            inspect.getsource(fn)
            for fn in (
                M._assert_grammar_preflight,
                M._insert_grammar_specifications,
                M._assert_grammar_post_apply,
                M.apply_plan,
            )
        ).lower()
        self.assertIn("grammar_specifications", apply_source)
        self.assertIn("on conflict (concept_id) do nothing", apply_source)
        self.assertIn("identity/content collision", apply_source)
        for forbidden in (
            "fsrs_states",
            "review_items",
            "learning_events",
            "user_concept_states",
            "today_plans",
            "user_saved_concepts",
        ):
            self.assertNotIn(forbidden, apply_source)

    def test_plan_is_deterministic_complete_and_catalog_only(self):
        p1 = M.build_plan(candidate())
        p2 = M.build_plan(candidate())
        self.assertEqual(p1, p2)
        self.assertEqual(p1["schemaVersion"], "knowledge-catalog-apply-plan.v2")
        self.assertEqual(p1["counts"]["concepts"], 108)
        self.assertEqual(p1["counts"]["lexicalConcepts"], 93)
        self.assertEqual(p1["counts"]["lexemeForms"], 0)
        self.assertEqual(p1["counts"]["sentences"], 108)
        self.assertEqual(p1["counts"]["sentenceTranslations"], 108)
        self.assertEqual(p1["counts"]["sentenceConcepts"], 108)
        self.assertEqual(p1["counts"]["prerequisiteRelations"], 0)
        self.assertEqual(
            p1["counts"]["byType"], {"grammar": 8, "phrase": 16, "skill": 7, "word": 77}
        )
        self.assertEqual(p1["source"]["reviewStatus"], "review_pending")
        self.assertEqual(p1["source"]["applyReviewStatus"], "approved")
        self.assertEqual(
            p1["source"]["approvalBoundary"], "exact_candidate_and_plan_hashes_required"
        )
        self.assertEqual(p1["source"]["transformVersion"], "knowledge-catalog-import.v3")
        self.assertEqual(len(p1["rows"]), 108)
        self.assertTrue(all(row["sourceMetadata"]["concept"] for row in p1["rows"]))

        apply_source = "\n".join(
            inspect.getsource(fn)
            for fn in (
                M._assert_preflight,
                M._insert_source_records,
                M.apply_plan,
                M._assert_post_apply,
            )
        ).lower()
        for required in (
            "concept_relations",
            "sentences",
            "sentence_translations",
            "sentence_concepts",
            "framework_mappings",
            "word_senses",
            "lexeme_forms",
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

    def test_apply_approval_is_hash_gated_and_runtime_visible(self):
        self.assertEqual(M.STAGING_REVIEW_STATUS, "review_pending")
        self.assertEqual(M.APPLY_REVIEW_STATUS, "approved")
        plan = M.build_plan(candidate())
        self.assertEqual(plan["source"]["reviewStatus"], "review_pending")
        self.assertEqual(plan["source"]["applyReviewStatus"], "approved")
        main_source = inspect.getsource(M.main)
        self.assertIn("approved_candidate_sha", main_source)
        self.assertIn("approved_plan_sha", main_source)
        self.assertIn('plan["candidateSha256"]', main_source)
        self.assertIn('plan["planSha256"]', main_source)
        insert_source = inspect.getsource(M._insert_source_records)
        self.assertIn("transaction_timestamp()", insert_source)
        self.assertIn('source["applyReviewStatus"]', insert_source)

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

    def test_utf16_offsets_are_honest_and_lexical_plan_fails_closed_without_surface(self):
        exact = M.example_span("word", "phone", "😀 phone works.")
        self.assertEqual(exact["startOffset"], 3)
        self.assertEqual(exact["endOffset"], 8)
        self.assertEqual(exact["occurrenceRole"], "target")
        self.assertEqual(exact["matchKind"], "exact_surface_match")
        missing = M.example_span("word", "be", "I am tired.")
        self.assertEqual(missing["occurrenceRole"], "context")
        self.assertEqual(missing["matchKind"], "no_exact_surface_match")
        grammar = M.example_span("grammar", "basic be statements", "We are at home.")
        self.assertEqual(grammar["occurrenceRole"], "grammar")
        self.assertEqual(grammar["endOffset"], M.utf16_length("We are at home."))
        c = candidate()
        c["concepts"][0]["example"]["en"] = "This sentence omits the lexical target."
        with self.assertRaises(M.ImportError):
            M.build_plan(c)

    def test_reviewed_inflected_surfaces_become_lexeme_forms_and_target_spans(self):
        cases = {
            "word:be:verb": ("be", "am", "I am tired."),
            "word:choose:verb": ("choose", "chose", "I chose the cheaper ticket."),
            "word:manage:verb": ("manage", "managed", "I managed to finish on time."),
            "word:realize:verb": ("realize", "realized", "I realized that I needed a better plan."),
            "phrase:look-for": ("look for", "looking for", "I am looking for the ticket office."),
        }
        for key, (canonical, surface, sentence) in cases.items():
            c = candidate()
            target = next(
                row
                for row in c["concepts"]
                if row["conceptType"] == ("phrase" if key.startswith("phrase:") else "word")
            )
            target["canonicalKey"] = key
            target["canonicalForm"] = canonical
            target["partOfSpeech"] = None if key.startswith("phrase:") else "verb"
            target["example"]["en"] = sentence
            p = M.build_plan(c)
            planned = next(row for row in p["rows"] if row["canonicalKey"] == key)
            self.assertEqual(planned["reviewedExampleSurface"], surface)
            self.assertEqual(planned["sentenceConcept"]["occurrenceRole"], "target")
            self.assertEqual(planned["sentenceConcept"]["matchKind"], "exact_surface_match")
            self.assertEqual(planned["lexemeForm"]["form"], surface)
            self.assertGreater(
                planned["sentenceConcept"]["endOffset"], planned["sentenceConcept"]["startOffset"]
            )

    def test_source_metadata_preserves_first_party_candidate_payload(self):
        c = candidate()
        p = M.build_plan(c)
        row = p["rows"][0]
        original = next(x for x in c["concepts"] if x["canonicalKey"] == row["canonicalKey"])
        self.assertEqual(row["sourceMetadata"]["concept"], original)
        self.assertEqual(row["sourceMetadata"]["rights"], "FIRST_PARTY")
        self.assertTrue(row["sourceMetadata"]["stagingCandidate"])
        self.assertEqual(row["sourceMetadata"]["catalogApprovalScope"], "reviewed_staging_catalog")

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
