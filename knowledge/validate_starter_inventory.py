#!/usr/bin/env python3
"""Fail-closed validator for LINGUA OS first-party starter knowledge inventory."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ALLOWED_TYPES = {"word", "phrase", "grammar", "skill"}
ALLOWED_BANDS = {"LINGUA_A0", "LINGUA_A1", "LINGUA_A2", "LINGUA_B1"}
ALLOWED_POS = {
    "noun", "verb", "adjective", "adverb", "pronoun", "determiner",
    "preposition", "conjunction", "interjection", "numeral", "modal", "particle",
}
ALLOWED_SOURCE_DECISIONS = {
    "FIRST_PARTY", "PRIMARY_CANDIDATE", "REFERENCE_ONLY",
    "CANDIDATE_QUARANTINE", "REJECT_MVP",
}
FORBIDDEN_LEARNER_FIELDS = {
    "mastery", "competence", "fsrs", "fsrsState", "dueAt", "reviewItemId",
    "saved", "known", "learningIntent", "hasLearningIntent", "statusEvidence",
    "exposureCount", "todayCompleted", "learnerStatus",
}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class ValidationError(Exception):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def walk_forbidden(value: object, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_LEARNER_FIELDS:
                fail(f"{path}: forbidden learner-state field {key!r}")
            walk_forbidden(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk_forbidden(child, f"{path}[{index}]")


def validate_registry(path: Path) -> dict[str, str]:
    registry = json.loads(path.read_text(encoding="utf-8"))
    if registry.get("schemaVersion") != "knowledge-source-registry.v1":
        fail("source registry has unsupported schemaVersion")
    policy = registry.get("decisionPolicy")
    if not isinstance(policy, dict) or set(policy) != ALLOWED_SOURCE_DECISIONS:
        fail("source registry decisionPolicy must enumerate the five V1 decisions")
    sources = registry.get("sources")
    if not isinstance(sources, list) or not sources:
        fail("source registry must contain sources")

    decisions: dict[str, str] = {}
    for index, source in enumerate(sources):
        where = f"sourceRegistry.sources[{index}]"
        if not isinstance(source, dict):
            fail(f"{where}: source must be an object")
        source_id = source.get("id")
        decision = source.get("decision")
        if not isinstance(source_id, str) or not source_id:
            fail(f"{where}: id is required")
        if source_id in decisions:
            fail(f"{where}: duplicate source id {source_id!r}")
        if decision not in ALLOWED_SOURCE_DECISIONS:
            fail(f"{where}: invalid decision {decision!r}")
        decisions[source_id] = decision

        evidence = source.get("evidence")
        if isinstance(evidence, dict):
            reported_sha = evidence.get("reportedSha256")
            if reported_sha is not None and (
                not isinstance(reported_sha, str) or SHA256_RE.fullmatch(reported_sha) is None
            ):
                fail(f"{where}: reportedSha256 must be a lowercase SHA-256")
            if evidence.get("checksumStatus") == "verified_lingua":
                fail(
                    f"{where}: no external source is independently LINGUA-verified in this branch yet"
                )

    if decisions.get("lingua-first-party") != "FIRST_PARTY":
        fail("source registry must define lingua-first-party as FIRST_PARTY")
    return decisions


def validate_inventory(path: Path, source_decisions: dict[str, str]) -> dict[str, object]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != "first-party-starter-inventory.v1":
        fail("unsupported schemaVersion")
    if data.get("status") != "candidate":
        fail("starter inventory must remain candidate until an explicit production gate")
    if data.get("languageCode") != "en" or data.get("interfaceLanguageCode") != "vi":
        fail("inventory is bounded to English-for-Vietnamese V1")
    registry_id = data.get("sourceRegistryId")
    if registry_id != "lingua-first-party" or source_decisions.get(str(registry_id)) != "FIRST_PARTY":
        fail("starter inventory must reference the FIRST_PARTY registry source")
    concepts = data.get("concepts")
    if not isinstance(concepts, list) or not concepts:
        fail("concepts must be a non-empty list")

    walk_forbidden(data)

    keys: list[str] = []
    examples: list[str] = []
    bands: Counter[str] = Counter()
    types: Counter[str] = Counter()
    edges: dict[str, list[str]] = defaultdict(list)

    for index, concept in enumerate(concepts):
        where = f"concepts[{index}]"
        if not isinstance(concept, dict):
            fail(f"{where}: concept must be an object")

        key = concept.get("canonicalKey")
        concept_type = concept.get("conceptType")
        form = concept.get("canonicalForm")
        band = concept.get("curriculumBand")
        review_state = concept.get("reviewState")
        topic = concept.get("topic")
        gloss = concept.get("vietnameseGloss")
        support = concept.get("vietnameseSupport")
        example = concept.get("example")
        prerequisites = concept.get("prerequisites")

        if concept_type not in ALLOWED_TYPES:
            fail(f"{where}: invalid conceptType {concept_type!r}")
        if not isinstance(key, str) or not key.startswith(f"{concept_type}:"):
            fail(f"{where}: canonicalKey must start with conceptType prefix")
        if not isinstance(form, str) or not form.strip():
            fail(f"{where}: canonicalForm is required")
        if band not in ALLOWED_BANDS:
            fail(f"{where}: invalid curriculumBand {band!r}")
        if concept.get("curriculumStatus") != "proposal":
            fail(f"{where}: curriculumStatus must remain proposal")
        if concept.get("externalLevelCheckRequired") is not True:
            fail(f"{where}: external level check must remain required")
        if review_state != "candidate":
            fail(f"{where}: reviewState must remain candidate")
        if not isinstance(topic, str) or not topic.strip():
            fail(f"{where}: topic is required")
        if not isinstance(gloss, str) or not gloss.strip():
            fail(f"{where}: vietnameseGloss is required")
        if not isinstance(support, str) or not support.strip():
            fail(f"{where}: vietnameseSupport is required")

        pos = concept.get("partOfSpeech")
        if concept_type == "word":
            if pos not in ALLOWED_POS:
                fail(f"{where}: word requires a normalized partOfSpeech")
        elif concept_type == "phrase":
            if pos is not None:
                fail(f"{where}: phrase POS is intentionally null in this starter inventory")
        elif pos is not None:
            fail(f"{where}: grammar/skill must not receive a fake lexical POS")

        if not isinstance(example, dict):
            fail(f"{where}: example is required")
        en = example.get("en")
        vi = example.get("vi")
        if not isinstance(en, str) or not en.strip() or not isinstance(vi, str) or not vi.strip():
            fail(f"{where}: bilingual example text is required")
        if example.get("rights") != "FIRST_PARTY":
            fail(f"{where}: example rights must be FIRST_PARTY")
        examples.append(en.strip())

        if not isinstance(prerequisites, list) or any(not isinstance(p, str) for p in prerequisites):
            fail(f"{where}: prerequisites must be a string list")

        keys.append(key)
        bands[band] += 1
        types[concept_type] += 1
        edges[key].extend(prerequisites)

    duplicate_keys = sorted(k for k, count in Counter(keys).items() if count > 1)
    if duplicate_keys:
        fail(f"duplicate canonical keys: {duplicate_keys}")
    duplicate_examples = sorted(e for e, count in Counter(examples).items() if count > 1)
    if duplicate_examples:
        fail(f"duplicate example sentences: {duplicate_examples}")

    key_set = set(keys)
    unknown_edges = sorted(
        (source, target)
        for source, targets in edges.items()
        for target in targets
        if target not in key_set
    )
    if unknown_edges:
        fail(f"unknown prerequisite target(s): {unknown_edges}")

    color: dict[str, int] = {key: 0 for key in keys}

    def visit(node: str, stack: list[str]) -> None:
        color[node] = 1
        stack.append(node)
        for target in edges.get(node, []):
            if color[target] == 1:
                fail(f"prerequisite cycle: {' -> '.join(stack + [target])}")
            if color[target] == 0:
                visit(target, stack)
        stack.pop()
        color[node] = 2

    for key in keys:
        if color[key] == 0:
            visit(key, [])

    expected_bands = Counter({
        "LINGUA_A0": 20,
        "LINGUA_A1": 20,
        "LINGUA_A2": 20,
        "LINGUA_B1": 20,
    })
    if bands != expected_bands:
        fail(f"unexpected band balance: {dict(bands)}")
    if types["phrase"] < 12 or types["grammar"] < 8 or types["skill"] < 8:
        fail(f"starter pack is too word-list-heavy: {dict(types)}")

    return {
        "concepts": len(concepts),
        "bands": dict(sorted(bands.items())),
        "types": dict(sorted(types.items())),
        "prerequisiteEdges": sum(len(v) for v in edges.values()),
        "uniqueExamples": len(set(examples)),
        "sourceRegistryId": registry_id,
        "result": "PASS",
    }


def main() -> int:
    inventory_path = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else "knowledge/first_party_starter_inventory.v1.json"
    )
    registry_path = Path(
        sys.argv[2]
        if len(sys.argv) > 2
        else "knowledge/source_registry.v1.json"
    )
    try:
        source_decisions = validate_registry(registry_path)
        summary = validate_inventory(inventory_path, source_decisions)
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        print(f"KNOWLEDGE STARTER VALIDATION: FAIL: {error}", file=sys.stderr)
        return 1
    print("KNOWLEDGE STARTER VALIDATION: PASS")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
