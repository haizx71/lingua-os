from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "knowledge" / "build_production_starter.py"
SPEC = importlib.util.spec_from_file_location("build_production_starter", MODULE_PATH)
assert SPEC and SPEC.loader
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def load_inputs():
    k = ROOT / "knowledge"
    packs = [
        ("first_party_starter_inventory.v1.json", M.load(k / "first_party_starter_inventory.v1.json")),
        ("first_party_content_support.v1.json", M.load(k / "first_party_content_support.v1.json")),
    ]
    return {
        "packs": packs,
        "manifest": M.load(k / "production_starter_manifest.v1.json"),
        "level": M.load(k / "level_audit_115.v3.json"),
        "grammar": M.load(k / "grammar_audit_8.v1.json"),
        "phrase": M.load(k / "phrase_audit_17.v1.json"),
        "skill": M.load(k / "skill_audit_8.v1.json"),
    }


def build(data):
    return M.build_candidate(
        data["packs"],
        data["manifest"],
        data["level"],
        data["grammar"],
        data["phrase"],
        data["skill"],
    )


class ProductionStarterTests(unittest.TestCase):
    def test_real_candidate_is_108_and_write_free(self):
        report = build(load_inputs())
        self.assertEqual(report["schemaVersion"], "knowledge-production-starter-candidate.v1")
        self.assertEqual(report["status"], "STAGING_CANDIDATE_REVIEW_REQUIRED")
        self.assertEqual(report["counts"]["sourceConcepts"], 115)
        self.assertEqual(report["counts"]["selectedConcepts"], 108)
        self.assertEqual(report["counts"]["quarantinedConcepts"], 7)
        self.assertEqual(
            report["counts"]["selectedByType"],
            {"grammar": 8, "phrase": 16, "skill": 7, "word": 77},
        )
        self.assertFalse(report["applySupported"])
        self.assertFalse(report["productionApproved"])
        self.assertEqual(len(report["candidateSha256"]), 64)

    def test_candidate_is_deterministic(self):
        data = load_inputs()
        first = build(data)
        second = build(load_inputs())
        self.assertEqual(first["candidateSha256"], second["candidateSha256"])
        self.assertEqual(first, second)

    def test_all_quarantine_keys_are_absent(self):
        data = load_inputs()
        report = build(data)
        selected = {c["canonicalKey"] for c in report["concepts"]}
        quarantined = {q["canonicalKey"] for q in data["manifest"]["quarantine"]}
        self.assertTrue(quarantined)
        self.assertTrue(selected.isdisjoint(quarantined))

    def test_every_selected_concept_has_closed_prerequisites(self):
        report = build(load_inputs())
        selected = {c["canonicalKey"] for c in report["concepts"]}
        for concept in report["concepts"]:
            self.assertTrue(set(concept.get("prerequisites", [])).issubset(selected))

    def test_unreviewed_level_disposition_fails_closed(self):
        data = load_inputs()
        mutated = copy.deepcopy(data)
        groups = mutated["level"]["groups"]
        target = "word:water:noun"
        for group in groups:
            if target in group["canonicalKeys"]:
                group["canonicalKeys"].remove(target)
                break
        groups.append({
            "disposition": "NEW_UNREVIEWED_DISPOSITION",
            "severity": "blocker",
            "canonicalKeys": [target],
        })
        with self.assertRaises(M.StarterBuildError):
            build(mutated)

    def test_unknown_quarantine_key_fails(self):
        data = load_inputs()
        mutated = copy.deepcopy(data)
        mutated["manifest"]["quarantine"].append({
            "canonicalKey": "word:not-real:noun",
            "reason": "synthetic",
        })
        with self.assertRaises(M.StarterBuildError):
            build(mutated)

    def test_source_count_drift_fails(self):
        data = load_inputs()
        mutated = copy.deepcopy(data)
        mutated["manifest"]["expectedSourceConcepts"] = 114
        with self.assertRaises(M.StarterBuildError):
            build(mutated)

    def test_selected_count_drift_fails(self):
        data = load_inputs()
        mutated = copy.deepcopy(data)
        mutated["manifest"]["expectedSelectedConcepts"] = 109
        with self.assertRaises(M.StarterBuildError):
            build(mutated)

    def test_forbidden_learner_state_field_fails(self):
        data = load_inputs()
        mutated = copy.deepcopy(data)
        mutated["packs"][0][1]["concepts"][0]["mastery"] = 1
        with self.assertRaises(M.StarterBuildError):
            build(mutated)

    def test_dependency_on_quarantined_concept_fails(self):
        data = load_inputs()
        mutated = copy.deepcopy(data)
        target = next(
            c for c in mutated["packs"][0][1]["concepts"]
            if c["canonicalKey"] == "word:water:noun"
        )
        target["prerequisites"] = ["word:need:verb"]
        with self.assertRaises(M.StarterBuildError):
            build(mutated)

    def test_cli_rejects_apply_flag(self):
        with self.assertRaises(SystemExit):
            M.parse_args(["--apply"])


if __name__ == "__main__":
    unittest.main()
