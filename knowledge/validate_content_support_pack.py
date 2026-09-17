#!/usr/bin/env python3
"""Validate that the content-support pack is exactly the set of coverage-map gaps."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

BAND_RANK = {"LINGUA_A0": 0, "LINGUA_A1": 1, "LINGUA_A2": 2, "LINGUA_B1": 3}
ALLOWED_TYPES = {"word", "phrase", "grammar", "skill"}


class ValidationError(Exception):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def validate(starter_path: Path, coverage_path: Path, support_path: Path) -> dict[str, object]:
    starter = json.loads(starter_path.read_text(encoding="utf-8"))
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))
    support = json.loads(support_path.read_text(encoding="utf-8"))

    if support.get("schemaVersion") != "first-party-content-support.v1":
        fail("unsupported support schemaVersion")
    if support.get("status") != "candidate":
        fail("support pack must remain candidate")
    if support.get("sourceRegistryId") != "lingua-first-party":
        fail("support pack must remain first-party")
    if support.get("derivedFromCoverage") != "knowledge-microcontent-coverage.v1":
        fail("support pack lost coverage provenance")

    starter_concepts = starter.get("concepts")
    support_concepts = support.get("concepts")
    archetypes = coverage.get("archetypes")
    if not isinstance(starter_concepts, list) or not isinstance(support_concepts, list):
        fail("concept lists missing")
    if not isinstance(archetypes, list):
        fail("coverage archetypes missing")

    starter_keys = {
        c.get("canonicalKey") for c in starter_concepts
        if isinstance(c, dict) and isinstance(c.get("canonicalKey"), str)
    }
    expected_hints: dict[str, str] = {}
    for archetype in archetypes:
        if not isinstance(archetype, dict):
            fail("coverage archetype is malformed")
        band = archetype.get("band")
        if band not in BAND_RANK:
            fail("coverage archetype has invalid band")
        for hint in archetype.get("missingConceptHints", []):
            if hint in expected_hints and expected_hints[hint] != band:
                if BAND_RANK[band] < BAND_RANK[expected_hints[hint]]:
                    expected_hints[hint] = band
            else:
                expected_hints[hint] = band

    support_keys: list[str] = []
    examples: list[str] = []
    bands: Counter[str] = Counter()

    for index, concept in enumerate(support_concepts):
        where = f"support.concepts[{index}]"
        if not isinstance(concept, dict):
            fail(f"{where}: must be object")
        key = concept.get("canonicalKey")
        concept_type = concept.get("conceptType")
        band = concept.get("curriculumBand")
        if concept_type not in ALLOWED_TYPES:
            fail(f"{where}: invalid conceptType")
        if not isinstance(key, str) or not key.startswith(f"{concept_type}:"):
            fail(f"{where}: invalid canonicalKey")
        if key in starter_keys:
            fail(f"{where}: duplicates starter concept {key}")
        if key not in expected_hints:
            fail(f"{where}: concept was not demanded by the coverage gap report: {key}")
        if band not in BAND_RANK:
            fail(f"{where}: invalid curriculumBand")
        if BAND_RANK[band] > BAND_RANK[expected_hints[key]]:
            fail(f"{where}: support concept is placed above the first band that needs it")
        if concept.get("curriculumStatus") != "proposal":
            fail(f"{where}: curriculumStatus must remain proposal")
        if concept.get("externalLevelCheckRequired") is not True:
            fail(f"{where}: external level check must remain required")
        if concept.get("reviewState") != "candidate":
            fail(f"{where}: reviewState must remain candidate")
        if concept.get("demandSource") != "microcontent-gap-v1":
            fail(f"{where}: demandSource must retain coverage provenance")
        example = concept.get("example")
        if not isinstance(example, dict) or example.get("rights") != "FIRST_PARTY":
            fail(f"{where}: example must be first-party")
        en = example.get("en")
        vi = example.get("vi")
        if not isinstance(en, str) or not en.strip() or not isinstance(vi, str) or not vi.strip():
            fail(f"{where}: bilingual example required")
        if not isinstance(concept.get("vietnameseSupport"), str) or not concept["vietnameseSupport"].strip():
            fail(f"{where}: Vietnamese support required")
        support_keys.append(key)
        examples.append(en.strip())
        bands[band] += 1

    duplicate_keys = sorted(k for k, count in Counter(support_keys).items() if count > 1)
    if duplicate_keys:
        fail(f"duplicate support keys: {duplicate_keys}")
    duplicate_examples = sorted(e for e, count in Counter(examples).items() if count > 1)
    if duplicate_examples:
        fail(f"duplicate support examples: {duplicate_examples}")

    if set(support_keys) != set(expected_hints):
        fail(
            "support pack must resolve exactly the coverage hints; "
            f"missing={sorted(set(expected_hints)-set(support_keys))}, "
            f"extra={sorted(set(support_keys)-set(expected_hints))}"
        )

    return {
        "supportConcepts": len(support_keys),
        "resolvedGapHints": len(expected_hints),
        "bands": dict(sorted(bands.items())),
        "uniqueExamples": len(set(examples)),
        "result": "PASS",
    }


def main() -> int:
    starter_path = Path(
        sys.argv[1] if len(sys.argv) > 1 else "knowledge/first_party_starter_inventory.v1.json"
    )
    coverage_path = Path(
        sys.argv[2] if len(sys.argv) > 2 else "knowledge/microcontent_coverage.v1.json"
    )
    support_path = Path(
        sys.argv[3] if len(sys.argv) > 3 else "knowledge/first_party_content_support.v1.json"
    )
    try:
        summary = validate(starter_path, coverage_path, support_path)
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        print(f"KNOWLEDGE SUPPORT VALIDATION: FAIL: {error}", file=sys.stderr)
        return 1
    print("KNOWLEDGE SUPPORT VALIDATION: PASS")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
