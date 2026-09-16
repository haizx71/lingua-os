from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "knowledge" / "crosscheck_cefrj.py"
SPEC = importlib.util.spec_from_file_location("crosscheck_cefrj", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CefrJCrosscheckTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = ROOT / "knowledge" / "tests" / "fixtures" / "cefrj-mini.csv"
        self.starter = ROOT / "knowledge" / "first_party_starter_inventory.v1.json"
        self.support = ROOT / "knowledge" / "first_party_content_support.v1.json"

    def _report(self):
        rows, source_format = MODULE.load_source(self.source)
        concepts = MODULE.load_pack(self.starter) + MODULE.load_pack(self.support)
        return MODULE.crosscheck(
            rows,
            concepts,
            source_path=self.source,
            source_version="synthetic-test",
            source_format=source_format,
        )

    def _by_key(self, report):
        return {record["canonicalKey"]: record for record in report["records"]}

    def test_csv_source_and_sha_are_reported(self) -> None:
        report = self._report()
        self.assertEqual(report["source"]["format"], "csv")
        self.assertEqual(report["source"]["version"], "synthetic-test")
        self.assertEqual(len(report["source"]["sha256"]), 64)
        self.assertEqual(report["source"]["usableRows"], 7)

    def test_a0_remains_internal_even_if_source_contains_word(self) -> None:
        water = self._by_key(self._report())["word:water:noun"]
        self.assertEqual(water["status"], "A0_INTERNAL")
        self.assertEqual(water["sourceMatches"], [])

    def test_exact_form_and_pos_can_agree(self) -> None:
        appointment = self._by_key(self._report())["word:appointment:noun"]
        self.assertEqual(appointment["status"], "AGREES")
        self.assertEqual(appointment["matchMode"], "form+pos")
        self.assertEqual(appointment["sourceMatches"][0]["level"], "A2")

    def test_source_lower_is_review_signal_not_auto_rewrite(self) -> None:
        advantage = self._by_key(self._report())["word:advantage:noun"]
        self.assertEqual(advantage["proposedLevel"], "B1")
        self.assertEqual(advantage["sourceMatches"][0]["level"], "A2")
        self.assertEqual(advantage["status"], "SOURCE_LOWER")

    def test_slash_variant_matches_without_losing_raw_headword(self) -> None:
        realize = self._by_key(self._report())["word:realize:verb"]
        self.assertEqual(realize["status"], "AGREES")
        self.assertEqual(realize["sourceMatches"][0]["headword"], "realize/realise")

    def test_part_of_speech_disambiguates_same_spelling(self) -> None:
        near = self._by_key(self._report())["word:near:preposition"]
        self.assertEqual(near["status"], "AGREES")
        self.assertEqual(len(near["sourceMatches"]), 1)
        self.assertEqual(near["sourceMatches"][0]["pos"], "preposition")

    def test_phrase_form_only_match_is_explicit(self) -> None:
        would_like = self._by_key(self._report())["phrase:would-like"]
        self.assertEqual(would_like["status"], "AGREES")
        self.assertEqual(would_like["matchMode"], "form-only")

    def test_cli_writes_evidence_report_without_mutating_packs(self) -> None:
        before_starter = self.starter.read_bytes()
        before_support = self.support.read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            rc = MODULE.main([
                "--source", str(self.source),
                "--source-version", "synthetic-test",
                "--pack", str(self.starter),
                "--pack", str(self.support),
                "--output", str(output),
            ])
            self.assertEqual(rc, 0)
            report = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(report["mode"], "evidence-only")
        self.assertEqual(self.starter.read_bytes(), before_starter)
        self.assertEqual(self.support.read_bytes(), before_support)


if __name__ == "__main__":
    unittest.main()
