#!/usr/bin/env python3
"""Validate the 16 knowledge micro-content archetypes against the starter inventory."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

BAND_RANK = {"LINGUA_A0": 0, "LINGUA_A1": 1, "LINGUA_A2": 2, "LINGUA_B1": 3}
EXPECTED_PER_BAND = 4


class ValidationError(Exception):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def validate(inventory_path: Path, coverage_path: Path) -> dict[str, object]:
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    coverage = json.loads(coverage_path.read_text(encoding="utf-8"))

    if coverage.get("schemaVersion") != "knowledge-microcontent-coverage.v1":
        fail("unsupported coverage schemaVersion")
    if coverage.get("status") != "planning":
        fail("coverage map must remain planning-only")
    if coverage.get("inventory") != "first_party_starter_inventory.v1":
        fail("coverage map points at an unexpected inventory")

    concepts = inventory.get("concepts")
    if not isinstance(concepts, list):
        fail("inventory concepts missing")
    by_key = {
        concept["canonicalKey"]: concept
        for concept in concepts
        if isinstance(concept, dict) and isinstance(concept.get("canonicalKey"), str)
    }

    archetypes = coverage.get("archetypes")
    if not isinstance(archetypes, list) or len(archetypes) != 16:
        fail("coverage map must contain exactly 16 archetypes")

    ids: list[str] = []
    bands: Counter[str] = Counter()
    gaps = 0
    covered = 0
    total_required = 0
    total_hints = 0

    for index, archetype in enumerate(archetypes):
        where = f"archetypes[{index}]"
        if not isinstance(archetype, dict):
            fail(f"{where}: must be object")
        archetype_id = archetype.get("id")
        band = archetype.get("band")
        required = archetype.get("requiredConceptKeys")
        hints = archetype.get("missingConceptHints")
        status = archetype.get("coverageStatus")

        if not isinstance(archetype_id, str) or not archetype_id:
            fail(f"{where}: id required")
        if band not in BAND_RANK:
            fail(f"{where}: invalid band")
        if not isinstance(required, list) or len(required) < 4:
            fail(f"{where}: need at least four required concepts")
        if not isinstance(hints, list):
            fail(f"{where}: missingConceptHints must be list")
        if len(required) != len(set(required)):
            fail(f"{where}: duplicate required concept")
        if len(hints) != len(set(hints)):
            fail(f"{where}: duplicate missing hint")

        for key in required:
            concept = by_key.get(key)
            if concept is None:
                fail(f"{where}: required concept does not exist: {key}")
            concept_band = concept.get("curriculumBand")
            if concept_band not in BAND_RANK:
                fail(f"{where}: concept has invalid band: {key}")
            if BAND_RANK[concept_band] > BAND_RANK[band]:
                fail(f"{where}: requires future-band concept {key} ({concept_band})")

        for hint in hints:
            if hint in by_key:
                fail(f"{where}: missing hint is already present in inventory: {hint}")

        expected_status = "starter-covered" if not hints else "gaps"
        if status != expected_status:
            fail(f"{where}: coverageStatus must be {expected_status!r}")

        ids.append(archetype_id)
        bands[band] += 1
        total_required += len(required)
        total_hints += len(hints)
        if hints:
            gaps += 1
        else:
            covered += 1

    duplicate_ids = sorted(k for k, count in Counter(ids).items() if count > 1)
    if duplicate_ids:
        fail(f"duplicate archetype ids: {duplicate_ids}")
    expected = Counter({band: EXPECTED_PER_BAND for band in BAND_RANK})
    if bands != expected:
        fail(f"expected four archetypes per band, got {dict(bands)}")

    return {
        "archetypes": len(archetypes),
        "bands": dict(sorted(bands.items())),
        "starterCoveredArchetypes": covered,
        "gapArchetypes": gaps,
        "requiredConceptReferences": total_required,
        "missingConceptHints": total_hints,
        "result": "PASS",
    }


def main() -> int:
    inventory_path = Path(
        sys.argv[1] if len(sys.argv) > 1
        else "knowledge/first_party_starter_inventory.v1.json"
    )
    coverage_path = Path(
        sys.argv[2] if len(sys.argv) > 2
        else "knowledge/microcontent_coverage.v1.json"
    )
    try:
        summary = validate(inventory_path, coverage_path)
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        print(f"KNOWLEDGE COVERAGE VALIDATION: FAIL: {error}", file=sys.stderr)
        return 1
    print("KNOWLEDGE COVERAGE VALIDATION: PASS")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
