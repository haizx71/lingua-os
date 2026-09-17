#!/usr/bin/env python3
"""Build a deterministic, write-free LINGUA knowledge staging candidate.

The builder selects only concepts permitted by an explicit reviewed manifest and
current audit artifacts. It never connects to PostgreSQL/Supabase and has no
apply mode. The output is still a candidate that requires staging preview and an
independent review before a separate transactional importer may be designed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

OUTPUT_SCHEMA = "knowledge-production-starter-candidate.v1"
MANIFEST_SCHEMA = "knowledge-production-starter-manifest.v1"
LEVEL_SCHEMA = "knowledge-level-audit-115.v3"
TYPE_SCHEMAS = {
    "grammar": "knowledge-grammar-audit-8.v1",
    "phrase": "knowledge-phrase-audit-17.v1",
    "skill": "knowledge-skill-audit-8.v1",
}
EXPECTED_SOURCE_TYPE_COUNTS = {"word": 82, "phrase": 17, "grammar": 8, "skill": 8}
FORBIDDEN_LEARNER_FIELDS = {
    "mastery", "competence", "fsrs", "fsrsState", "dueAt", "reviewItemId",
    "saved", "known", "learningIntent", "hasLearningIntent", "statusEvidence",
    "exposureCount", "todayCompleted", "learnerStatus",
}


class StarterBuildError(Exception):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StarterBuildError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise StarterBuildError(f"{path}: root must be an object")
    return value


def walk_forbidden(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_LEARNER_FIELDS:
                raise StarterBuildError(f"{path}: forbidden learner-state field {key!r}")
            walk_forbidden(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk_forbidden(child, f"{path}[{index}]")


def index_packs(packs: list[tuple[str, dict[str, Any]]]) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    concepts: dict[str, dict[str, Any]] = {}
    metadata: list[dict[str, Any]] = []
    for label, pack in packs:
        if pack.get("status") != "candidate":
            raise StarterBuildError(f"{label}: source pack must remain candidate")
        if pack.get("sourceRegistryId") != "lingua-first-party":
            raise StarterBuildError(f"{label}: sourceRegistryId must be lingua-first-party")
        walk_forbidden(pack, f"pack:{label}")
        items = pack.get("concepts")
        if not isinstance(items, list) or not items:
            raise StarterBuildError(f"{label}: concepts must be a non-empty list")
        for i, concept in enumerate(items):
            if not isinstance(concept, dict):
                raise StarterBuildError(f"{label}.concepts[{i}]: concept must be an object")
            key = concept.get("canonicalKey")
            ctype = concept.get("conceptType")
            if not isinstance(key, str) or not isinstance(ctype, str):
                raise StarterBuildError(f"{label}.concepts[{i}]: missing identity")
            if key in concepts:
                raise StarterBuildError(f"duplicate source canonicalKey {key}")
            if not key.startswith(f"{ctype}:"):
                raise StarterBuildError(f"source key/type mismatch {key} vs {ctype}")
            example = concept.get("example")
            if not isinstance(example, dict) or example.get("rights") != "FIRST_PARTY":
                raise StarterBuildError(f"{key}: only FIRST_PARTY examples are allowed")
            concepts[key] = concept
        metadata.append({
            "label": label,
            "schemaVersion": pack.get("schemaVersion"),
            "conceptCount": len(items),
            "sha256": sha256_json(pack),
        })
    return concepts, sorted(metadata, key=lambda x: x["label"])


def index_audit(audit: dict[str, Any], schema: str) -> dict[str, dict[str, Any]]:
    if audit.get("schemaVersion") != schema:
        raise StarterBuildError(f"expected {schema}, got {audit.get('schemaVersion')!r}")
    records = audit.get("records")
    if records is None:
        groups = audit.get("groups")
        if not isinstance(groups, list):
            raise StarterBuildError(f"{schema}: records/groups missing")
        records = []
        for group in groups:
            if not isinstance(group, dict):
                raise StarterBuildError(f"{schema}: group must be an object")
            disposition = group.get("disposition")
            keys = group.get("canonicalKeys")
            if not isinstance(disposition, str) or not isinstance(keys, list):
                raise StarterBuildError(f"{schema}: malformed group")
            for key in keys:
                records.append({"canonicalKey": key, "disposition": disposition})
    if not isinstance(records, list):
        raise StarterBuildError(f"{schema}: records must be a list")
    out: dict[str, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict):
            raise StarterBuildError(f"{schema}: record must be an object")
        key = record.get("canonicalKey")
        if not isinstance(key, str) or key in out:
            raise StarterBuildError(f"{schema}: invalid/duplicate key {key!r}")
        out[key] = record
    return out


def ensure_source_shape(concepts: dict[str, dict[str, Any]], manifest: dict[str, Any]) -> None:
    expected_total = manifest.get("expectedSourceConcepts")
    if len(concepts) != expected_total:
        raise StarterBuildError(
            f"source concept count drift: expected {expected_total}, got {len(concepts)}"
        )
    counts = Counter(str(c.get("conceptType")) for c in concepts.values())
    if dict(counts) != EXPECTED_SOURCE_TYPE_COUNTS:
        raise StarterBuildError(
            f"source type count drift: expected={EXPECTED_SOURCE_TYPE_COUNTS} actual={dict(counts)}"
        )


def validate_audit_coverage(
    concepts: dict[str, dict[str, Any]],
    level: dict[str, dict[str, Any]],
    typed: dict[str, dict[str, dict[str, Any]]],
) -> None:
    if set(level) != set(concepts):
        raise StarterBuildError(
            "level audit coverage mismatch: "
            f"missing={sorted(set(concepts)-set(level))} extra={sorted(set(level)-set(concepts))}"
        )
    for ctype, records in typed.items():
        expected = {k for k, c in concepts.items() if c.get("conceptType") == ctype}
        if set(records) != expected:
            raise StarterBuildError(
                f"{ctype} audit coverage mismatch: "
                f"missing={sorted(expected-set(records))} extra={sorted(set(records)-expected)}"
            )


def validate_manifest(manifest: dict[str, Any], concepts: dict[str, dict[str, Any]]) -> dict[str, str]:
    if manifest.get("schemaVersion") != MANIFEST_SCHEMA:
        raise StarterBuildError(f"manifest schema must be {MANIFEST_SCHEMA}")
    if manifest.get("status") != "CANDIDATE_SELECTION_POLICY":
        raise StarterBuildError("manifest must remain CANDIDATE_SELECTION_POLICY")
    quarantined: dict[str, str] = {}
    rows = manifest.get("quarantine")
    if not isinstance(rows, list):
        raise StarterBuildError("manifest quarantine must be a list")
    for row in rows:
        if not isinstance(row, dict):
            raise StarterBuildError("manifest quarantine row must be an object")
        key = row.get("canonicalKey")
        reason = row.get("reason")
        if not isinstance(key, str) or not isinstance(reason, str) or not reason.strip():
            raise StarterBuildError("manifest quarantine rows require canonicalKey + reason")
        if key in quarantined:
            raise StarterBuildError(f"duplicate quarantine key {key}")
        if key not in concepts:
            raise StarterBuildError(f"quarantine key does not exist in source packs: {key}")
        quarantined[key] = reason
    return quarantined


def validate_dependency_closure(selected: dict[str, dict[str, Any]]) -> None:
    keys = set(selected)
    edges: dict[str, list[str]] = defaultdict(list)
    for key, concept in selected.items():
        prereqs = concept.get("prerequisites", [])
        if not isinstance(prereqs, list) or any(not isinstance(x, str) for x in prereqs):
            raise StarterBuildError(f"{key}: prerequisites must be a string list")
        for target in prereqs:
            if target not in keys:
                raise StarterBuildError(
                    f"selected concept depends on excluded/missing prerequisite: {key} -> {target}"
                )
            if target == key:
                raise StarterBuildError(f"self prerequisite: {key}")
            edges[key].append(target)

    color = {k: 0 for k in keys}

    def visit(node: str, stack: list[str]) -> None:
        color[node] = 1
        stack.append(node)
        for target in edges.get(node, []):
            if color[target] == 1:
                raise StarterBuildError("selected prerequisite cycle: " + " -> ".join(stack + [target]))
            if color[target] == 0:
                visit(target, stack)
        stack.pop()
        color[node] = 2

    for key in sorted(keys):
        if color[key] == 0:
            visit(key, [])


def build_candidate(
    packs: list[tuple[str, dict[str, Any]]],
    manifest: dict[str, Any],
    level_audit: dict[str, Any],
    grammar_audit: dict[str, Any],
    phrase_audit: dict[str, Any],
    skill_audit: dict[str, Any],
) -> dict[str, Any]:
    concepts, pack_meta = index_packs(packs)
    ensure_source_shape(concepts, manifest)
    quarantine = validate_manifest(manifest, concepts)

    level = index_audit(level_audit, LEVEL_SCHEMA)
    typed = {
        "grammar": index_audit(grammar_audit, TYPE_SCHEMAS["grammar"]),
        "phrase": index_audit(phrase_audit, TYPE_SCHEMAS["phrase"]),
        "skill": index_audit(skill_audit, TYPE_SCHEMAS["skill"]),
    }
    validate_audit_coverage(concepts, level, typed)

    allowed_level = set(manifest.get("allowedLevelDispositions", []))
    allowed_typed_raw = manifest.get("allowedTypeAuditDispositions")
    if not allowed_level or not isinstance(allowed_typed_raw, dict):
        raise StarterBuildError("manifest allowed disposition policy is missing")
    allowed_typed = {
        ctype: set(allowed_typed_raw.get(ctype, []))
        for ctype in TYPE_SCHEMAS
    }

    selected: dict[str, dict[str, Any]] = {}
    selection_evidence: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    for key in sorted(concepts):
        concept = concepts[key]
        ctype = str(concept.get("conceptType"))
        if key in quarantine:
            excluded.append({"canonicalKey": key, "reason": quarantine[key]})
            continue

        level_disposition = level[key].get("disposition")
        if level_disposition not in allowed_level:
            raise StarterBuildError(
                f"{key}: level disposition {level_disposition!r} is not selected by manifest and is not quarantined"
            )

        typed_disposition = None
        if ctype in typed:
            typed_disposition = typed[ctype][key].get("disposition")
            if typed_disposition not in allowed_typed[ctype]:
                raise StarterBuildError(
                    f"{key}: {ctype} disposition {typed_disposition!r} is not selected by manifest and is not quarantined"
                )

        selected[key] = concept
        selection_evidence.append({
            "canonicalKey": key,
            "conceptType": ctype,
            "levelDisposition": level_disposition,
            "typeAuditDisposition": typed_disposition,
        })

    expected_selected = manifest.get("expectedSelectedConcepts")
    if len(selected) != expected_selected:
        raise StarterBuildError(
            f"selected count drift: expected {expected_selected}, got {len(selected)}"
        )
    actual_types = Counter(str(c.get("conceptType")) for c in selected.values())
    expected_types = manifest.get("expectedTypeCounts")
    if not isinstance(expected_types, dict) or dict(actual_types) != expected_types:
        raise StarterBuildError(
            f"selected type count drift: expected={expected_types} actual={dict(actual_types)}"
        )

    validate_dependency_closure(selected)

    result: dict[str, Any] = {
        "schemaVersion": OUTPUT_SCHEMA,
        "status": "STAGING_CANDIDATE_REVIEW_REQUIRED",
        "mode": "build-only",
        "applySupported": False,
        "productionApproved": False,
        "sourcePacks": pack_meta,
        "manifestSha256": sha256_json(manifest),
        "auditSchemas": {
            "level": LEVEL_SCHEMA,
            **TYPE_SCHEMAS,
        },
        "counts": {
            "sourceConcepts": len(concepts),
            "selectedConcepts": len(selected),
            "quarantinedConcepts": len(excluded),
            "selectedByType": dict(sorted(actual_types.items())),
        },
        "quarantine": excluded,
        "selectionEvidence": selection_evidence,
        "concepts": [selected[key] for key in sorted(selected)],
        "reviewRequirementsBeforeApply": manifest.get("reviewRequirementsBeforeApply", []),
    }
    result["candidateSha256"] = sha256_json(result)
    return result


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build LINGUA write-free staging knowledge candidate")
    parser.add_argument("--pack", action="append", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--level-audit", required=True)
    parser.add_argument("--grammar-audit", required=True)
    parser.add_argument("--phrase-audit", required=True)
    parser.add_argument("--skill-audit", required=True)
    parser.add_argument("--output")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        packs = [(Path(p).name, load(Path(p))) for p in args.pack]
        result = build_candidate(
            packs,
            load(Path(args.manifest)),
            load(Path(args.level_audit)),
            load(Path(args.grammar_audit)),
            load(Path(args.phrase_audit)),
            load(Path(args.skill_audit)),
        )
    except StarterBuildError as exc:
        print(f"KNOWLEDGE STARTER BUILD: FAIL: {exc}", file=sys.stderr)
        return 1

    rendered = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
