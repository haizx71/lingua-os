#!/usr/bin/env python3
"""Pure, preview-only knowledge import planner for LINGUA OS.

This tool never opens a database connection and intentionally has no apply mode.
It validates candidate packs plus independent audit artifacts and emits a
deterministic plan. Knowledge audit V3 requires lexical, grammar, phrase and
communicative-skill evidence to cover the exact candidate set.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "knowledge-import-preview.v1"
ALLOWED_TYPES = {"word", "phrase", "grammar", "skill"}
ALLOWED_BANDS = {"LINGUA_A0", "LINGUA_A1", "LINGUA_A2", "LINGUA_B1"}
ALLOWED_LEVEL_AUDIT_SCHEMAS = {
    "knowledge-level-audit-115.v1",
    "knowledge-level-audit-115.v2",
    "knowledge-level-audit-115.v3",
}
CURRENT_LEVEL_AUDIT_SCHEMA = "knowledge-level-audit-115.v3"
GRAMMAR_AUDIT_SCHEMA = "knowledge-grammar-audit-8.v1"
PHRASE_AUDIT_SCHEMA = "knowledge-phrase-audit-17.v1"
SKILL_AUDIT_SCHEMA = "knowledge-skill-audit-8.v1"

FORBIDDEN_LEARNER_FIELDS = {
    "mastery", "competence", "fsrs", "fsrsState", "dueAt", "reviewItemId",
    "saved", "known", "learningIntent", "hasLearningIntent", "statusEvidence",
    "exposureCount", "todayCompleted", "learnerStatus",
}
REVIEW_BLOCKING_LEVEL_DISPOSITIONS = {
    "A0_STRETCH_REVIEW",
    "LINGUA_EARLIER_THAN_V1_5_REFERENCE",
    "EARLY_PLACEMENT_CONFIRMED_BY_SECOND_SOURCE",
    "EARLY_PLACEMENT_UNRESOLVED",
    "SOURCE_DISAGREEMENT_HUMAN_REVIEW",
    "IDENTITY_MODEL_REVIEW_REQUIRED",
    "PHRASE_REQUIRES_SEPARATE_EVIDENCE",
    "SKILL_REQUIRES_CAN_DO_REVIEW",
}
REVIEW_WARNING_LEVEL_DISPOSITIONS = {
    "LINGUA_LATER_THAN_V1_5_REFERENCE",
    "SUPPORTED_BY_SECONDARY_LEVEL_SOURCE",
}


class PreviewError(Exception):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PreviewError(f"cannot read {path}: {exc}") from exc


def walk_forbidden(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_LEARNER_FIELDS:
                raise PreviewError(f"{path}: forbidden learner-state field {key!r}")
            walk_forbidden(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk_forbidden(child, f"{path}[{index}]")


def _nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def concept_signature(concept: dict[str, Any]) -> dict[str, Any]:
    return {
        "canonicalKey": concept.get("canonicalKey"),
        "conceptType": concept.get("conceptType"),
        "canonicalForm": concept.get("canonicalForm"),
        "partOfSpeech": concept.get("partOfSpeech"),
    }


def validate_pack(pack: dict[str, Any], label: str) -> list[dict[str, Any]]:
    if not isinstance(pack, dict):
        raise PreviewError(f"{label}: pack must be an object")
    if not _nonempty_string(pack.get("schemaVersion")):
        raise PreviewError(f"{label}: schemaVersion must be a non-empty string")
    if pack.get("status") != "candidate":
        raise PreviewError(f"{label}: only candidate packs are accepted by preview V1")
    if pack.get("sourceRegistryId") != "lingua-first-party":
        raise PreviewError(f"{label}: sourceRegistryId must be lingua-first-party")
    concepts = pack.get("concepts")
    if not isinstance(concepts, list) or not concepts:
        raise PreviewError(f"{label}: concepts must be a non-empty list")
    walk_forbidden(pack)

    for i, concept in enumerate(concepts):
        where = f"{label}.concepts[{i}]"
        if not isinstance(concept, dict):
            raise PreviewError(f"{where}: concept must be an object")
        key = concept.get("canonicalKey")
        ctype = concept.get("conceptType")
        if ctype not in ALLOWED_TYPES:
            raise PreviewError(f"{where}: unsupported conceptType {ctype!r}")
        if not isinstance(key, str) or not key.startswith(f"{ctype}:"):
            raise PreviewError(f"{where}: canonicalKey/type mismatch")
        if not _nonempty_string(concept.get("canonicalForm")):
            raise PreviewError(f"{where}: canonicalForm must be a non-empty string")

        pos = concept.get("partOfSpeech")
        if ctype == "word":
            if not _nonempty_string(pos):
                raise PreviewError(f"{where}: word concepts require a non-empty partOfSpeech")
        elif pos is not None:
            raise PreviewError(f"{where}: non-word concepts must use partOfSpeech=null")

        if concept.get("curriculumBand") not in ALLOWED_BANDS:
            raise PreviewError(f"{where}: unsupported curriculumBand {concept.get('curriculumBand')!r}")
        if concept.get("curriculumStatus") != "proposal":
            raise PreviewError(f"{where}: curriculumStatus must remain proposal")
        if concept.get("reviewState") != "candidate":
            raise PreviewError(f"{where}: reviewState must remain candidate")
        if concept.get("externalLevelCheckRequired") is not True:
            raise PreviewError(f"{where}: external level check must remain required")

        example = concept.get("example")
        if not isinstance(example, dict) or example.get("rights") != "FIRST_PARTY":
            raise PreviewError(f"{where}: example rights must be FIRST_PARTY")
        if not _nonempty_string(example.get("en")) or not _nonempty_string(example.get("vi")):
            raise PreviewError(f"{where}: example.en and example.vi must be non-empty strings")

        prereqs = concept.get("prerequisites", [])
        if not isinstance(prereqs, list) or any(not isinstance(x, str) for x in prereqs):
            raise PreviewError(f"{where}: prerequisites must be a string list")

    return concepts


def validate_graph(concepts: list[dict[str, Any]]) -> None:
    keys = [c["canonicalKey"] for c in concepts]
    duplicates = sorted(k for k, n in Counter(keys).items() if n > 1)
    if duplicates:
        raise PreviewError(f"duplicate canonicalKey across packs: {duplicates}")
    keyset = set(keys)
    edges: dict[str, list[str]] = defaultdict(list)
    for concept in concepts:
        key = concept["canonicalKey"]
        for target in concept.get("prerequisites", []):
            if target == key:
                raise PreviewError(f"self prerequisite: {key}")
            if target not in keyset:
                raise PreviewError(f"unknown prerequisite: {key} -> {target}")
            edges[key].append(target)

    color = {k: 0 for k in keys}

    def visit(node: str, stack: list[str]) -> None:
        color[node] = 1
        stack.append(node)
        for target in edges.get(node, []):
            if color[target] == 1:
                raise PreviewError("prerequisite cycle: " + " -> ".join(stack + [target]))
            if color[target] == 0:
                visit(target, stack)
        stack.pop()
        color[node] = 2

    for key in keys:
        if color[key] == 0:
            visit(key, [])


def index_audit(
    audit: dict[str, Any],
    expected_schemas: str | set[str],
) -> dict[str, dict[str, Any]]:
    allowed = {expected_schemas} if isinstance(expected_schemas, str) else expected_schemas
    if not isinstance(audit, dict) or audit.get("schemaVersion") not in allowed:
        raise PreviewError(f"audit schema must be one of {sorted(allowed)}")

    records = audit.get("records")
    if records is None and isinstance(audit.get("groups"), list):
        records = []
        reference_levels = audit.get("referenceLevelByKey", {})
        notes = audit.get("matchNotes", {})
        secondary = audit.get("secondaryEvidenceByKey", {})
        for group in audit["groups"]:
            disposition = group.get("disposition") if isinstance(group, dict) else None
            keys = group.get("canonicalKeys") if isinstance(group, dict) else None
            severity = group.get("severity") if isinstance(group, dict) else None
            if not isinstance(disposition, str) or not isinstance(keys, list):
                raise PreviewError("audit group must contain disposition + canonicalKeys")
            if severity is not None and severity not in {"blocker", "warning", "info", "delegated"}:
                raise PreviewError(f"audit group has unsupported severity {severity!r}")
            for key in keys:
                if not isinstance(key, str):
                    raise PreviewError("audit canonicalKeys entries must be strings")
                record: dict[str, Any] = {
                    "canonicalKey": key,
                    "disposition": disposition,
                }
                if severity is not None:
                    record["severity"] = severity
                if key in reference_levels:
                    record["referenceLevel"] = reference_levels[key]
                if key in notes:
                    record["note"] = notes[key]
                if key in secondary:
                    record["secondaryEvidence"] = secondary[key]
                records.append(record)

    if not isinstance(records, list):
        raise PreviewError("audit records/groups must be a list")

    index: dict[str, dict[str, Any]] = {}
    for record in records:
        key = record.get("canonicalKey") if isinstance(record, dict) else None
        if not isinstance(key, str) or key in index:
            raise PreviewError(f"invalid/duplicate audit key {key!r}")
        index[key] = record
    return index


def exact_type_audit(
    audit: dict[str, Any] | None,
    schema: str,
    type_name: str,
    concepts: list[dict[str, Any]],
    required: bool,
) -> dict[str, dict[str, Any]]:
    expected = {c["canonicalKey"] for c in concepts if c["conceptType"] == type_name}
    if audit is None:
        if required and expected:
            raise PreviewError(f"{type_name} audit is required for {CURRENT_LEVEL_AUDIT_SCHEMA}")
        return {}
    index = index_audit(audit, schema)
    if set(index) != expected:
        missing = sorted(expected - set(index))
        extra = sorted(set(index) - expected)
        raise PreviewError(
            f"{type_name} audit coverage mismatch missing={missing} extra={extra}"
        )
    return index


def load_catalog_snapshot(path: Path | None) -> dict[str, dict[str, Any]]:
    if path is None:
        return {}
    data = load_json(path)
    if not isinstance(data, dict) or data.get("schemaVersion") != "knowledge-catalog-snapshot.v1":
        raise PreviewError("catalog snapshot schema must be knowledge-catalog-snapshot.v1")
    concepts = data.get("concepts")
    if not isinstance(concepts, list):
        raise PreviewError("catalog snapshot concepts must be a list")

    out: dict[str, dict[str, Any]] = {}
    for item in concepts:
        if not isinstance(item, dict):
            raise PreviewError("catalog snapshot concept must be an object")
        key = item.get("canonicalKey")
        if not isinstance(key, str) or key in out:
            raise PreviewError(f"invalid/duplicate catalog key {key!r}")
        out[key] = item
    return out


def _level_severity(record: dict[str, Any]) -> str:
    explicit = record.get("severity")
    if explicit in {"blocker", "warning", "info", "delegated"}:
        return explicit
    disposition = record.get("disposition")
    if disposition in REVIEW_BLOCKING_LEVEL_DISPOSITIONS:
        return "blocker"
    if disposition in REVIEW_WARNING_LEVEL_DISPOSITIONS:
        return "warning"
    return "info"


def _review_issue(
    key: str,
    record: dict[str, Any],
    source: str,
) -> dict[str, Any]:
    disposition = record.get("disposition")
    code = str(disposition) if disposition is not None else f"{source.upper()}_NOT_PRODUCTION_APPROVED"
    return {"canonicalKey": key, "code": code, "source": source}


def build_preview(
    packs: list[tuple[str, dict[str, Any]]],
    level_audit: dict[str, Any],
    grammar_audit: dict[str, Any],
    phrase_audit: dict[str, Any] | None = None,
    skill_audit: dict[str, Any] | None = None,
    catalog: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    catalog = catalog or {}
    concepts: list[dict[str, Any]] = []
    pack_meta = []
    for label, pack in packs:
        pack_concepts = validate_pack(pack, label)
        concepts.extend(pack_concepts)
        pack_meta.append({
            "label": label,
            "schemaVersion": pack.get("schemaVersion"),
            "count": len(pack_concepts),
            "sha256": sha256_json(pack),
        })
    validate_graph(concepts)

    level_idx = index_audit(level_audit, ALLOWED_LEVEL_AUDIT_SCHEMAS)
    concept_keys = {c["canonicalKey"] for c in concepts}
    if set(level_idx) != concept_keys:
        missing = sorted(concept_keys - set(level_idx))
        extra = sorted(set(level_idx) - concept_keys)
        raise PreviewError(f"level audit coverage mismatch missing={missing} extra={extra}")

    current_v3 = level_audit.get("schemaVersion") == CURRENT_LEVEL_AUDIT_SCHEMA
    grammar_idx = exact_type_audit(
        grammar_audit, GRAMMAR_AUDIT_SCHEMA, "grammar", concepts, required=True
    )
    phrase_idx = exact_type_audit(
        phrase_audit, PHRASE_AUDIT_SCHEMA, "phrase", concepts, required=current_v3
    )
    skill_idx = exact_type_audit(
        skill_audit, SKILL_AUDIT_SCHEMA, "skill", concepts, required=current_v3
    )

    actions: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    disposition_counts: Counter[str] = Counter()

    for concept in sorted(concepts, key=lambda c: c["canonicalKey"]):
        key = concept["canonicalKey"]
        ctype = concept["conceptType"]
        audit_record = level_idx[key]
        disposition = str(audit_record.get("disposition"))
        disposition_counts[disposition] += 1

        severity = _level_severity(audit_record)
        issue = {"canonicalKey": key, "code": disposition, "source": "level-audit"}
        if severity == "blocker":
            blockers.append(issue)
        elif severity == "warning":
            warnings.append(issue)

        if ctype == "grammar":
            record = grammar_idx[key]
            if record.get("productionApproved") is not True:
                blockers.append(_review_issue(key, record, "grammar-audit"))
        elif ctype == "phrase" and phrase_idx:
            record = phrase_idx[key]
            if record.get("productionApproved") is not True:
                blockers.append(_review_issue(key, record, "phrase-audit"))
        elif ctype == "skill" and skill_idx:
            record = skill_idx[key]
            if record.get("productionApproved") is not True:
                blockers.append(_review_issue(key, record, "skill-audit"))

        existing = catalog.get(key)
        if existing is None:
            action = "WOULD_INSERT"
        elif concept_signature(existing) == concept_signature(concept):
            action = "WOULD_NOOP_EXISTING"
        else:
            action = "BLOCK_COLLISION"
            blockers.append({
                "canonicalKey": key,
                "code": "CATALOG_IDENTITY_COLLISION",
                "source": "catalog-snapshot",
            })
        actions.append({
            "canonicalKey": key,
            "action": action,
            "conceptType": ctype,
            "curriculumBand": concept.get("curriculumBand"),
        })

    authority = level_audit.get("productionAuthority") or {}
    if authority.get("status") != "LINGUA_VERIFIED":
        blockers.append({
            "canonicalKey": None,
            "code": "PRODUCTION_LEVEL_AUTHORITY_NOT_LINGUA_VERIFIED",
            "source": "level-audit",
        })

    sort_key = lambda item: (item["canonicalKey"] or "", item["code"], item["source"])
    blockers = sorted(blockers, key=sort_key)
    warnings = sorted(warnings, key=sort_key)
    actions = sorted(actions, key=lambda a: a["canonicalKey"])

    result = {
        "schemaVersion": SCHEMA_VERSION,
        "mode": "preview-only",
        "applySupported": False,
        "status": "BLOCKED_REVIEW" if blockers else "PREVIEW_READY",
        "productionCandidateEligible": not blockers,
        "levelAuditSchema": level_audit.get("schemaVersion"),
        "grammarAuditSchema": grammar_audit.get("schemaVersion"),
        "phraseAuditSchema": phrase_audit.get("schemaVersion") if phrase_audit else None,
        "skillAuditSchema": skill_audit.get("schemaVersion") if skill_audit else None,
        "packs": sorted(pack_meta, key=lambda p: p["label"]),
        "counts": {
            "concepts": len(concepts),
            "actions": dict(sorted(Counter(a["action"] for a in actions).items())),
            "levelDispositions": dict(sorted(disposition_counts.items())),
            "blockers": len(blockers),
            "warnings": len(warnings),
        },
        "actions": actions,
        "blockers": blockers,
        "warnings": warnings,
    }
    result["planSha256"] = sha256_json(result)
    return result


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LINGUA OS knowledge preview-only import planner")
    parser.add_argument("--pack", action="append", required=True, help="candidate pack JSON; repeatable")
    parser.add_argument("--level-audit", required=True)
    parser.add_argument("--grammar-audit", required=True)
    parser.add_argument("--phrase-audit")
    parser.add_argument("--skill-audit")
    parser.add_argument("--catalog-snapshot")
    parser.add_argument("--output")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        packs = [(Path(p).name, load_json(Path(p))) for p in args.pack]
        level = load_json(Path(args.level_audit))
        grammar = load_json(Path(args.grammar_audit))
        phrase = load_json(Path(args.phrase_audit)) if args.phrase_audit else None
        skill = load_json(Path(args.skill_audit)) if args.skill_audit else None
        catalog = load_catalog_snapshot(Path(args.catalog_snapshot) if args.catalog_snapshot else None)
        report = build_preview(packs, level, grammar, phrase, skill, catalog)
    except PreviewError as exc:
        print(f"KNOWLEDGE IMPORT PREVIEW: FAIL: {exc}", file=sys.stderr)
        return 1

    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
