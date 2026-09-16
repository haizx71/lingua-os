import copy
import unittest

from catalog_import import ImportError, build_plan, digest


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
                "example": {"en": f"Example {i}.", "vi": f"Ví dụ {i}.", "rights": "FIRST_PARTY"},
            })
    value = {
        "schemaVersion": "knowledge-production-starter-candidate.v1",
        "status": "STAGING_CANDIDATE_REVIEW_REQUIRED",
        "counts": {"selectedConcepts": 108},
        "concepts": concepts,
    }
    value["candidateSha256"] = digest(value)
    return value


class CatalogImportTests(unittest.TestCase):
    def test_plan_is_deterministic_and_catalog_only(self):
        p1 = build_plan(candidate())
        p2 = build_plan(candidate())
        self.assertEqual(p1, p2)
        self.assertEqual(p1["counts"]["concepts"], 108)
        self.assertEqual(p1["counts"]["lexicalConcepts"], 93)
        self.assertEqual(p1["counts"]["byType"], {"grammar": 8, "phrase": 16, "skill": 7, "word": 77})
        rendered = str(p1).lower()
        for forbidden in ("fsrs", "review_items", "learning_events", "user_concept", "today_plan", "saved_concept"):
            self.assertNotIn(forbidden, rendered)

    def test_rejects_non_first_party_example(self):
        c = candidate()
        c["concepts"][0]["example"]["rights"] = "UNKNOWN"
        with self.assertRaises(ImportError):
            build_plan(c)

    def test_rejects_type_count_drift(self):
        c = candidate()
        c["concepts"][0]["conceptType"] = "phrase"
        c["concepts"][0]["canonicalKey"] = "phrase:changed"
        with self.assertRaises(ImportError):
            build_plan(c)

    def test_plan_hash_changes_when_content_changes(self):
        c1 = candidate()
        c2 = copy.deepcopy(c1)
        c2["concepts"][0]["vietnameseSupport"] = "nội dung khác"
        c2.pop("candidateSha256")
        c2["candidateSha256"] = digest(c2)
        self.assertNotEqual(build_plan(c1)["planSha256"], build_plan(c2)["planSha256"])


if __name__ == "__main__":
    unittest.main()
