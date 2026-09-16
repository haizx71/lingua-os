from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "preview_import.py"
SPEC = importlib.util.spec_from_file_location("preview_import", MODULE_PATH)
assert SPEC and SPEC.loader
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def concept(key="word:water:noun", ctype="word", prereqs=None):
    return {
        "canonicalKey": key,
        "conceptType": ctype,
        "canonicalForm": "water" if ctype == "word" else "x",
        "partOfSpeech": "noun" if ctype == "word" else None,
        "curriculumBand": "LINGUA_A1",
        "curriculumStatus": "proposal",
        "externalLevelCheckRequired": True,
        "reviewState": "candidate",
        "example": {"en": "I drink water.", "vi": "Tôi uống nước.", "rights": "FIRST_PARTY"},
        "prerequisites": prereqs or [],
    }


def pack(items):
    return {
        "schemaVersion": "test.v1",
        "status": "candidate",
        "sourceRegistryId": "lingua-first-party",
        "concepts": items,
    }


def level(items, status="OBSERVED_EXTERNAL_ONLY", schema="knowledge-level-audit-115.v1"):
    return {
        "schemaVersion": schema,
        "productionAuthority": {"status": status},
        "records": [
            {"canonicalKey": c["canonicalKey"], "disposition": "AGREES_WITH_V1_5_REFERENCE"}
            for c in items
        ],
    }


def grammar(items, approved=True):
    gs = [c for c in items if c["conceptType"] == "grammar"]
    return {
        "schemaVersion": "knowledge-grammar-audit-8.v1",
        "records": [
            {
                "canonicalKey": c["canonicalKey"],
                "disposition": "SUPPORTED_AT_PROPOSED_BAND",
                "productionApproved": approved,
            }
            for c in gs
        ],
    }


def phrase(items, approved=True):
    ps = [c for c in items if c["conceptType"] == "phrase"]
    return {
        "schemaVersion": "knowledge-phrase-audit-17.v1",
        "records": [
            {
                "canonicalKey": c["canonicalKey"],
                "disposition": "SUPPORTED_AT_PROPOSED_BAND",
                "productionApproved": approved,
            }
            for c in ps
        ],
    }


def skill(items, approved=True):
    ss = [c for c in items if c["conceptType"] == "skill"]
    return {
        "schemaVersion": "knowledge-skill-audit-8.v1",
        "records": [
            {
                "canonicalKey": c["canonicalKey"],
                "disposition": "SUPPORTED_AT_PROPOSED_BAND",
                "productionApproved": approved,
            }
            for c in ss
        ],
    }


def v3_level(items, status="LINGUA_VERIFIED"):
    records = []
    for c in items:
        disposition = {
            "grammar": "GRAMMAR_AUDIT_REQUIRED",
            "phrase": "PHRASE_AUDIT_REQUIRED",
            "skill": "SKILL_AUDIT_REQUIRED",
        }.get(c["conceptType"], "AGREES_WITH_V1_5_REFERENCE")
        records.append({
            "canonicalKey": c["canonicalKey"],
            "disposition": disposition,
            "severity": "delegated" if c["conceptType"] != "word" else "info",
        })
    return {
        "schemaVersion": "knowledge-level-audit-115.v3",
        "productionAuthority": {"status": status},
        "records": records,
    }


class PreviewTests(unittest.TestCase):
    def test_preview_has_no_apply_mode_and_blocks_unverified_authority(self):
        items = [concept()]
        report = M.build_preview([("p", pack(items))], level(items), grammar(items))
        self.assertFalse(report["applySupported"])
        self.assertEqual(report["status"], "BLOCKED_REVIEW")
        self.assertEqual(report["counts"]["actions"]["WOULD_INSERT"], 1)

    def test_verified_clean_legacy_preview_can_be_candidate_ready_but_cannot_apply(self):
        items = [concept()]
        report = M.build_preview(
            [("p", pack(items))],
            level(items, "LINGUA_VERIFIED"),
            grammar(items),
        )
        self.assertEqual(report["status"], "PREVIEW_READY")
        self.assertTrue(report["productionCandidateEligible"])
        self.assertFalse(report["applySupported"])

    def test_v3_clean_preview_requires_and_records_type_audits(self):
        items = [
            concept(),
            concept("grammar:test", "grammar"),
            concept("phrase:test", "phrase"),
            concept("skill:test", "skill"),
        ]
        report = M.build_preview(
            [("p", pack(items))],
            v3_level(items),
            grammar(items),
            phrase(items),
            skill(items),
        )
        self.assertEqual(report["status"], "PREVIEW_READY")
        self.assertEqual(report["levelAuditSchema"], "knowledge-level-audit-115.v3")
        self.assertEqual(report["phraseAuditSchema"], "knowledge-phrase-audit-17.v1")
        self.assertEqual(report["skillAuditSchema"], "knowledge-skill-audit-8.v1")
        self.assertFalse(report["applySupported"])

    def test_v3_phrase_audit_is_required_when_phrases_exist(self):
        items = [concept("phrase:test", "phrase")]
        with self.assertRaises(M.PreviewError):
            M.build_preview(
                [("p", pack(items))],
                v3_level(items),
                grammar(items),
                None,
                skill(items),
            )

    def test_v3_skill_audit_is_required_when_skills_exist(self):
        items = [concept("skill:test", "skill")]
        with self.assertRaises(M.PreviewError):
            M.build_preview(
                [("p", pack(items))],
                v3_level(items),
                grammar(items),
                phrase(items),
                None,
            )

    def test_v3_phrase_audit_must_exactly_cover_phrase_concepts(self):
        items = [concept("phrase:test", "phrase")]
        wrong = {
            "schemaVersion": "knowledge-phrase-audit-17.v1",
            "records": [{
                "canonicalKey": "phrase:other",
                "disposition": "SUPPORTED_AT_PROPOSED_BAND",
                "productionApproved": True,
            }],
        }
        with self.assertRaises(M.PreviewError):
            M.build_preview(
                [("p", pack(items))],
                v3_level(items),
                grammar(items),
                wrong,
                skill(items),
            )

    def test_v3_phrase_not_approved_blocks(self):
        items = [concept("phrase:test", "phrase")]
        report = M.build_preview(
            [("p", pack(items))],
            v3_level(items),
            grammar(items),
            phrase(items, approved=False),
            skill(items),
        )
        self.assertEqual(report["status"], "BLOCKED_REVIEW")
        self.assertEqual(report["blockers"][0]["source"], "phrase-audit")

    def test_v3_skill_not_approved_blocks(self):
        items = [concept("skill:test", "skill")]
        report = M.build_preview(
            [("p", pack(items))],
            v3_level(items),
            grammar(items),
            phrase(items),
            skill(items, approved=False),
        )
        self.assertEqual(report["status"], "BLOCKED_REVIEW")
        self.assertEqual(report["blockers"][0]["source"], "skill-audit")

    def test_duplicate_key_across_packs_fails(self):
        c = concept()
        with self.assertRaises(M.PreviewError):
            M.build_preview(
                [("a", pack([c])), ("b", pack([c]))],
                level([c]),
                grammar([c]),
            )

    def test_unknown_prerequisite_fails(self):
        c = concept(prereqs=["word:missing:noun"])
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_learner_state_field_fails(self):
        c = concept()
        c["mastery"] = 1
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_identity_collision_blocks(self):
        c = concept()
        existing = {c["canonicalKey"]: {**M.concept_signature(c), "canonicalForm": "different"}}
        report = M.build_preview(
            [("p", pack([c]))],
            level([c], "LINGUA_VERIFIED"),
            grammar([c]),
            catalog=existing,
        )
        self.assertEqual(report["actions"][0]["action"], "BLOCK_COLLISION")
        self.assertEqual(report["status"], "BLOCKED_REVIEW")

    def test_same_existing_identity_is_noop(self):
        c = concept()
        existing = {c["canonicalKey"]: M.concept_signature(c)}
        report = M.build_preview(
            [("p", pack([c]))],
            level([c], "LINGUA_VERIFIED"),
            grammar([c]),
            catalog=existing,
        )
        self.assertEqual(report["actions"][0]["action"], "WOULD_NOOP_EXISTING")

    def test_blocking_level_disposition_blocks(self):
        c = concept()
        aud = level([c], "LINGUA_VERIFIED")
        aud["records"][0]["disposition"] = "EARLY_PLACEMENT_CONFIRMED_BY_SECOND_SOURCE"
        report = M.build_preview([("p", pack([c]))], aud, grammar([c]))
        self.assertEqual(report["status"], "BLOCKED_REVIEW")

    def test_later_than_reference_is_warning_not_blocker(self):
        c = concept()
        aud = level([c], "LINGUA_VERIFIED")
        aud["records"][0]["disposition"] = "LINGUA_LATER_THAN_V1_5_REFERENCE"
        report = M.build_preview([("p", pack([c]))], aud, grammar([c]))
        self.assertEqual(report["status"], "PREVIEW_READY")
        self.assertEqual(report["counts"]["warnings"], 1)
        self.assertEqual(report["warnings"][0]["code"], "LINGUA_LATER_THAN_V1_5_REFERENCE")

    def test_explicit_v2_severity_is_respected(self):
        c = concept()
        aud = {
            "schemaVersion": "knowledge-level-audit-115.v2",
            "productionAuthority": {"status": "LINGUA_VERIFIED"},
            "groups": [{
                "disposition": "SUPPORTED_BY_SECONDARY_LEVEL_SOURCE",
                "severity": "blocker",
                "canonicalKeys": [c["canonicalKey"]],
            }],
        }
        report = M.build_preview([("p", pack([c]))], aud, grammar([c]))
        self.assertEqual(report["status"], "BLOCKED_REVIEW")

    def test_grouped_level_audit_v2_is_supported(self):
        c = concept()
        aud = {
            "schemaVersion": "knowledge-level-audit-115.v2",
            "productionAuthority": {"status": "LINGUA_VERIFIED"},
            "groups": [{
                "disposition": "SUPPORTED_BY_SECONDARY_LEVEL_SOURCE",
                "severity": "warning",
                "canonicalKeys": [c["canonicalKey"]],
            }],
            "secondaryEvidenceByKey": {
                c["canonicalKey"]: {"source": "test", "observedLevel": "A1"}
            },
        }
        report = M.build_preview([("p", pack([c]))], aud, grammar([c]))
        self.assertEqual(report["status"], "PREVIEW_READY")
        self.assertEqual(report["levelAuditSchema"], "knowledge-level-audit-115.v2")
        self.assertEqual(report["counts"]["warnings"], 1)

    def test_empty_canonical_form_fails(self):
        c = concept()
        c["canonicalForm"] = "   "
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_invalid_curriculum_band_fails(self):
        c = concept()
        c["curriculumBand"] = "B2"
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_word_requires_pos(self):
        c = concept()
        c["partOfSpeech"] = None
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_nonword_must_not_have_pos(self):
        c = concept(key="phrase:test", ctype="phrase")
        c["partOfSpeech"] = "noun"
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_empty_bilingual_example_fails(self):
        c = concept()
        c["example"]["vi"] = ""
        with self.assertRaises(M.PreviewError):
            M.build_preview([("p", pack([c]))], level([c]), grammar([c]))

    def test_grammar_requires_production_approval(self):
        c = concept(key="grammar:test", ctype="grammar")
        aud = level([c], "LINGUA_VERIFIED")
        report = M.build_preview(
            [("p", pack([c]))],
            aud,
            grammar([c], approved=False),
        )
        self.assertEqual(report["status"], "BLOCKED_REVIEW")

    def test_cli_rejects_apply_flag(self):
        with self.assertRaises(SystemExit):
            M.parse_args(["--apply"])


if __name__ == "__main__":
    unittest.main()
