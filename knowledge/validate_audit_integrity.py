#!/usr/bin/env python3
"""Validate exact identity/type coverage across LINGUA knowledge packs and audits.

This validator is read-only and stdlib-only. It exists to catch drift such as an
audit key that no longer exists in the candidate packs, missing type-specific
audit records, duplicate canonical keys, or stale summary counts.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

EXPECTED_LEVEL_SCHEMA = "knowledge-level-audit-115.v3"
TYPE_AUDITS = {
    "grammar": "knowledge-grammar-audit-8.v1",
    "phrase": "knowledge-phrase-audit-17.v1",
    "skill": "knowledge-skill-audit-8.v1",
}


class AuditIntegrityError(Exception):
    pass


def load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AuditIntegrityError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise AuditIntegrityError(f"{path}: root must be an object")
    return value


def index_pack_concepts(packs: list[tuple[str, dict[str, Any]]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for label, pack in packs:
        concepts = pack.get("concepts")
        if not isinstance(concepts, list):
            raise AuditIntegrityError(f"{label}: concepts must be a list")
        for i, concept in enumerate(concepts):
            if not isinstance(concept, dict):
                raise AuditIntegrityError(f"{label}.concepts[{i}]: must be an object")
            key = concept.get("canonicalKey")
            ctype = concept.get("conceptType")
            if not isinstance(key, str) or not isinstance(ctype, str):
                raise AuditIntegrityError(f"{label}.concepts[{i}]: missing canonicalKey/conceptType")
            if key in out:
                raise AuditIntegrityError(f"duplicate candidate canonicalKey: {key}")
            if not key.startswith(f"{ctype}:"):
                raise AuditIntegrityError(f"candidate key/type mismatch: {key} vs {ctype}")
            out[key] = concept
    return out


def audit_records(audit: dict[str, Any], expected_schema: str) -> dict[str, dict[str, Any]]:
    if audit.get("schemaVersion") != expected_schema:
        raise AuditIntegrityError(
            f"expected audit schema {expected_schema!r}, got {audit.get('schemaVersion')!r}"
        )
    records = audit.get("records")
    if records is None:
        groups = audit.get("groups")
        if not isinstance(groups, list):
            raise AuditIntegrityError(f"{expected_schema}: records/groups missing")
        records = []
        for group in groups:
            if not isinstance(group, dict):
                raise AuditIntegrityError(f"{expected_schema}: group must be an object")
            disposition = group.get("disposition")
            keys = group.get("canonicalKeys")
            if not isinstance(disposition, str) or not isinstance(keys, list):
                raise AuditIntegrityError(
                    f"{expected_schema}: group needs disposition + canonicalKeys"
                )
            for key in keys:
                records.append({"canonicalKey": key, "disposition": disposition})
    if not isinstance(records, list):
        raise AuditIntegrityError(f"{expected_schema}: records must be a list")

    out: dict[str, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict):
            raise AuditIntegrityError(f"{expected_schema}: record must be an object")
        key = record.get("canonicalKey")
        if not isinstance(key, str) or key in out:
            raise AuditIntegrityError(f"{expected_schema}: invalid/duplicate key {key!r}")
        out[key] = record
    return out


def disposition_counts(audit: dict[str, Any]) -> Counter[str]:
    records = audit.get("records")
    if isinstance(records, list):
        return Counter(
            str(r.get("disposition"))
            for r in records
            if isinstance(r, dict) and r.get("disposition") is not None
        )
    groups = audit.get("groups")
    counts: Counter[str] = Counter()
    if isinstance(groups, list):
        for group in groups:
            if isinstance(group, dict) and isinstance(group.get("canonicalKeys"), list):
                counts[str(group.get("disposition"))] += len(group["canonicalKeys"])
    return counts


def validate_summary_counts(audit: dict[str, Any], schema: str) -> None:
    summary = audit.get("summary")
    if not isinstance(summary, dict):
        return
    declared = summary.get("dispositions")
    if not isinstance(declared, dict):
        return
    actual = disposition_counts(audit)
    normalized = {str(k): int(v) for k, v in declared.items()}
    if dict(sorted(actual.items())) != dict(sorted(normalized.items())):
        raise AuditIntegrityError(
            f"{schema}: summary disposition counts stale: declared={normalized} actual={dict(actual)}"
        )


def validate(
    packs: list[tuple[str, dict[str, Any]]],
    level: dict[str, Any],
    grammar: dict[str, Any],
    phrase: dict[str, Any],
    skill: dict[str, Any],
) -> dict[str, Any]:
    concepts = index_pack_concepts(packs)
    if len(concepts) != 115:
        raise AuditIntegrityError(f"candidate concept count must be 115, got {len(concepts)}")

    type_counts = Counter(str(c["conceptType"]) for c in concepts.values())
    expected_counts = {"word": 82, "phrase": 17, "grammar": 8, "skill": 8}
    if dict(type_counts) != expected_counts:
        raise AuditIntegrityError(
            f"candidate type counts mismatch: expected={expected_counts} actual={dict(type_counts)}"
        )

    level_idx = audit_records(level, EXPECTED_LEVEL_SCHEMA)
    if set(level_idx) != set(concepts):
        raise AuditIntegrityError(
            "level audit coverage mismatch: "
            f"missing={sorted(set(concepts)-set(level_idx))} "
            f"extra={sorted(set(level_idx)-set(concepts))}"
        )
    validate_summary_counts(level, EXPECTED_LEVEL_SCHEMA)

    typed = {
        "grammar": audit_records(grammar, TYPE_AUDITS["grammar"]),
        "phrase": audit_records(phrase, TYPE_AUDITS["phrase"]),
        "skill": audit_records(skill, TYPE_AUDITS["skill"]),
    }
    for ctype, index in typed.items():
        expected = {k for k, c in concepts.items() if c["conceptType"] == ctype}
        if set(index) != expected:
            raise AuditIntegrityError(
                f"{ctype} audit coverage mismatch: "
                f"missing={sorted(expected-set(index))} extra={sorted(set(index)-expected)}"
            )
        validate_summary_counts(
            {**{"summary": {"dispositions": dict(disposition_counts({"records": list(index.values())}))}}, "records": list(index.values())},
            TYPE_AUDITS[ctype],
        )

    # V3 must delegate every non-word concept to the correct type audit.
    expected_delegated = {
        "grammar": "GRAMMAR_AUDIT_REQUIRED",
        "phrase": "PHRASE_AUDIT_REQUIRED",
        "skill": "SKILL_AUDIT_REQUIRED",
    }
    for key, concept in concepts.items():
        ctype = concept["conceptType"]
        if ctype == "word":
            continue
        actual = level_idx[key].get("disposition")
        if actual != expected_delegated[ctype]:
            raise AuditIntegrityError(
                f"{key}: level audit must delegate to {ctype} audit via "
                f"{expected_delegated[ctype]}, got {actual!r}"
            )

    # Type audits must preserve the candidate curriculum band when they state one.
    for ctype, index in typed.items():
        for key, record in index.items():
            if "curriculumBand" in record and record["curriculumBand"] != concepts[key].get("curriculumBand"):
                raise AuditIntegrityError(
                    f"{key}: {ctype} audit curriculumBand {record.get('curriculumBand')!r} "
                    f"!= pack {concepts[key].get('curriculumBand')!r}"
                )

    return {
        "status": "PASS",
        "concepts": len(concepts),
        "typeCounts": expected_counts,
        "levelAuditSchema": EXPECTED_LEVEL_SCHEMA,
        "typeAuditSchemas": TYPE_AUDITS,
        "levelDispositionCounts": dict(sorted(disposition_counts(level).items())),
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate LINGUA knowledge audit identity coverage")
    parser.add_argument("--pack", action="append", required=True)
    parser.add_argument("--level-audit", required=True)
    parser.add_argument("--grammar-audit", required=True)
    parser.add_argument("--phrase-audit", required=True)
    parser.add_argument("--skill-audit", required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        packs = [(Path(p).name, load(Path(p))) for p in args.pack]
        result = validate(
            packs,
            load(Path(args.level_audit)),
            load(Path(args.grammar_audit)),
            load(Path(args.phrase_audit)),
            load(Path(args.skill_audit)),
        )
    except AuditIntegrityError as exc:
        print(f"KNOWLEDGE AUDIT INTEGRITY: FAIL: {exc}", file=sys.stderr)
        return 1
    print("KNOWLEDGE AUDIT INTEGRITY: PASS")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
