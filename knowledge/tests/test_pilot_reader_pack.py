"""Tests for the first-party bilingual English-Vietnamese Reader pack v1."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Bootstrap sys.path to include workspace root
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from knowledge.validate_pilot_reader_pack import validate_bilingual_pack


class PilotReaderPackTests(unittest.TestCase):
    def test_pilot_reader_pack_v1_passes_strict_validation(self) -> None:
        summary = validate_bilingual_pack()
        self.assertEqual(summary["pack_id"], "pilot-reader-vi-pack-a1-b1-v1")
        self.assertEqual(summary["article_count"], 3)
        self.assertEqual(summary["total_sentences"], 22)
        self.assertEqual(summary["levels_covered"], ["A1", "A2", "B1"])
        self.assertEqual(len(summary["pack_sha256"]), 64)

    def test_bilingual_reader_pack_passes_all_provenance_and_alignment_gates(self) -> None:
        self.test_pilot_reader_pack_v1_passes_strict_validation()


if __name__ == "__main__":
    unittest.main()
