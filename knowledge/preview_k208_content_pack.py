#!/usr/bin/env python3
"""Dry-run a K2-08 content pack through the production Admin/Reader matcher.

This tool is intentionally local and read-only: it reads the authored packet and
the approved public catalog snapshot, then writes a deterministic preview report.
It does not connect to a database, create Admin records, validate/publish content,
or change learner/Auth state.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any
from uuid import UUID


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
API_SOURCE = REPOSITORY_ROOT / "services" / "api" / "src"
if str(API_SOURCE) not in sys.path:
    sys.path.insert(0, str(API_SOURCE))

from lingua_api.admin.domain import AdminValidationError, segment_english_text  # noqa: E402
from lingua_api.admin.models import CreateAdminContentRequestDto  # noqa: E402
from lingua_api.reader.analyze_policy import (  # noqa: E402
    CatalogMatchCandidate,
    POLICY_VERSION,
    analyze_transient_text,
)


DEFAULT_PACK = REPOSITORY_ROOT / "knowledge" / "staging" / "k208-minimal-content-pack" / "content-pack.json"
DEFAULT_SNAPSHOT = (
    REPOSITORY_ROOT
    / "knowledge"
    / "staging"
    / "k208-minimal-content-pack"
    / "catalog-match-snapshot.json"
)
DEFAULT_EDITORIAL = (
    REPOSITORY_ROOT
    / "knowledge"
    / "staging"
    / "k208-minimal-content-pack"
    / "editorial-preview.md"
)
DEFAULT_OUTPUT = (
    REPOSITORY_ROOT
    / "knowledge"
    / "staging"
    / "k208-minimal-content-pack"
    / "preview-result.json"
)

ITEM_ORDER = ("N", "W", "F")
ROLE_BY_ITEM = {
    "N": "novel_control",
    "W": "weak_remediation",
    "F": "forgotten_remediation",
}
LEVEL_BY_ITEM = {"N": "A1", "W": "A2", "F": "B1"}
TARGET_BY_ITEM = {
    "N": "word:tea:noun",
    "W": "word:coffee:noun",
    "F": "word:water:noun",
}
TARGET_IDS = frozenset(TARGET_BY_ITEM)
MAX_SENTENCES = 100
MAX_CONCEPTS_PER_SENTENCE = 4
MAX_CONCEPTS_PER_ITEM = 4
REQUIRED_MINUTES = 5
TOKENS_PER_MINUTE = 180


def _load_json(path: Path, label: str, violations: list[str]) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        violations.append(f"{label} could not be read as JSON: {type(error).__name__}")
        return {}
    if not isinstance(value, dict):
        violations.append(f"{label} root must be an object")
        return {}
    return value


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _approved_candidates(
    snapshot: dict[str, Any], violations: list[str]
) -> tuple[tuple[CatalogMatchCandidate, ...], dict[str, dict[str, str]], dict[str, str]]:
    rows = snapshot.get("rows")
    if not isinstance(rows, list):
        violations.append("approved catalog snapshot rows must be an array")
        return (), {}, {}

    candidates: list[CatalogMatchCandidate] = []
    concept_by_id: dict[str, dict[str, str]] = {}
    concept_id_by_key: dict[str, str] = {}
    seen_forms: set[tuple[str, str]] = set()
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            violations.append(f"approved snapshot row {index} must be an object")
            continue
        try:
            concept_id = str(UUID(str(row["concept_id"])))
            canonical_key = str(row["canonical_key"])
            lemma = str(row["lemma"])
            normalized_form = str(row["normalized_form"])
        except (KeyError, TypeError, ValueError, AttributeError):
            violations.append(f"approved snapshot row {index} has an invalid identity/form")
            continue
        if not canonical_key or not lemma or not normalized_form:
            violations.append(f"approved snapshot row {index} has an empty identity/form")
            continue

        existing_concept = concept_by_id.get(concept_id)
        descriptor = {"concept_id": concept_id, "canonical_key": canonical_key, "lemma": lemma}
        if existing_concept is not None and existing_concept != descriptor:
            violations.append(f"approved snapshot concept {concept_id} has conflicting metadata")
            continue
        existing_id = concept_id_by_key.get(canonical_key)
        if existing_id is not None and existing_id != concept_id:
            violations.append(f"approved snapshot canonical key {canonical_key} is ambiguous")
            continue
        concept_by_id[concept_id] = descriptor
        concept_id_by_key[canonical_key] = concept_id

        key = (concept_id, normalized_form)
        if key not in seen_forms:
            seen_forms.add(key)
            candidates.append(
                CatalogMatchCandidate(
                    concept_id=UUID(concept_id),
                    canonical_form=lemma,
                    normalized_form=normalized_form,
                )
            )

    if not candidates:
        violations.append("approved catalog snapshot contains no usable match candidates")
    scope = snapshot.get("scope")
    if not isinstance(scope, str) or "approved English" not in scope or "no learner or Auth data" not in scope:
        violations.append("approved snapshot scope does not attest to approved English catalog-only data")
    if not isinstance(snapshot.get("sourceSha"), str) or not re.fullmatch(
        r"[0-9a-f]{40}", str(snapshot.get("sourceSha"))
    ):
        violations.append("approved catalog snapshot must identify its source commit SHA")
    return tuple(candidates), concept_by_id, concept_id_by_key


def _utf16_units(value: str) -> int:
    return len(value.encode("utf-16-le", errors="strict")) // 2


def _preview_item(
    item: dict[str, Any],
    *,
    candidates: tuple[CatalogMatchCandidate, ...],
    concept_by_id: dict[str, dict[str, str]],
    concept_id_by_key: dict[str, str],
    violations: list[str],
) -> dict[str, Any]:
    item_id = str(item.get("item_id", "?"))
    item_violations: list[str] = []
    def fail(message: str) -> None:
        item_violations.append(message)
        violations.append(f"{item_id}: {message}")

    expected_role = ROLE_BY_ITEM.get(item_id)
    expected_level = LEVEL_BY_ITEM.get(item_id)
    expected_target = TARGET_BY_ITEM.get(item_id)
    if expected_role is None or expected_level is None or expected_target is None:
        fail("item_id must be exactly N, W, or F")
    if item.get("role") != expected_role:
        fail(f"role must be {expected_role}")
    if item.get("private_target_key") != expected_target:
        fail(f"private_target_key must be {expected_target}")
    if item.get("expected_minutes") != REQUIRED_MINUTES:
        fail("expected_minutes must be exactly 5 for every K2-08 fresh-actor candidate")

    dto_input = item.get("admin_create_dto")
    if not isinstance(dto_input, dict):
        fail("admin_create_dto must be an object")
        dto_input = {}
    dto = None
    try:
        dto = CreateAdminContentRequestDto.model_validate(dto_input)
    except Exception as error:
        fail(f"Admin create DTO validation failed ({type(error).__name__})")

    title = ""
    level = ""
    body = ""
    if dto is not None:
        title = dto.title
        level = dto.level.value
        body = dto.body
        if dto.language_code != "en":
            fail("language_code must be English")
        if level != expected_level:
            fail(f"curated level must be {expected_level}")

    try:
        admin_sentences = segment_english_text(body)
        analyzed_segments = analyze_transient_text(body, candidates)
        analyzed_sentences = tuple(
            sentence
            for segment in analyzed_segments
            for sentence in segment.sentences
        )
    except (AdminValidationError, UnicodeError) as error:
        fail(f"production Admin sentence analysis failed ({type(error).__name__})")
        admin_sentences = ()
        analyzed_sentences = ()

    if tuple(sentence.text for sentence in analyzed_sentences) != admin_sentences:
        fail("production Admin segmentation and production Reader matcher segmentation differ")
    if not 1 <= len(admin_sentences) <= MAX_SENTENCES:
        fail("sentence_count must be between 1 and 100")

    total_tokens = sum(
        len(re.split(r"\s+", sentence.strip()))
        for sentence in admin_sentences
        if sentence.strip()
    )
    estimated_minutes = (total_tokens + TOKENS_PER_MINUTE - 1) // TOKENS_PER_MINUTE
    if estimated_minutes != REQUIRED_MINUTES:
        fail(
            f"Admin/ContentStore estimated_minutes is {estimated_minutes}; expected exactly 5 "
            f"(token_count must be 721–900, got {total_tokens})"
        )

    per_sentence: list[dict[str, Any]] = []
    item_counts: Counter[str] = Counter()
    target_id = concept_id_by_key.get(expected_target or "")
    if target_id is None:
        fail(f"private target {expected_target} is absent from the approved snapshot")
    target_occurrences = 0
    for order, sentence in enumerate(analyzed_sentences):
        sentence_concepts: set[str] = set()
        annotations: list[dict[str, Any]] = []
        previous_end_offset_utf16 = 0
        try:
            _utf16_units(sentence.text)
        except UnicodeError:
            fail(f"sentence {order + 1} contains text that is not valid UTF-16")
        for annotation in sentence.annotations:
            concept_id = str(annotation.concept_id)
            descriptor = concept_by_id.get(concept_id)
            if descriptor is None:
                fail(f"sentence {order + 1} matched a concept outside the approved snapshot")
                continue
            try:
                expected_start = _utf16_units(sentence.text[: annotation.start_index])
                expected_end = _utf16_units(sentence.text[: annotation.end_index])
                source_text = sentence.text[annotation.start_index : annotation.end_index]
                if (
                    annotation.start_offset_utf16 != expected_start
                    or annotation.end_offset_utf16 != expected_end
                    or annotation.start_index < 0
                    or annotation.end_index <= annotation.start_index
                    or not source_text
                    or _utf16_units(source_text)
                    != annotation.end_offset_utf16 - annotation.start_offset_utf16
                    or annotation.start_offset_utf16 < previous_end_offset_utf16
                ):
                    fail(
                        f"sentence {order + 1} has an invalid or overlapping UTF-16 annotation span"
                    )
            except (UnicodeError, IndexError):
                source_text = ""
                fail(
                    f"sentence {order + 1} has an invalid or overlapping UTF-16 annotation span"
                )
            previous_end_offset_utf16 = max(
                previous_end_offset_utf16, annotation.end_offset_utf16
            )
            if concept_id == target_id:
                target_occurrences += 1
            sentence_concepts.add(concept_id)
            item_counts[concept_id] += 1
            annotations.append(
                {
                    "canonical_key": descriptor["canonical_key"],
                    "concept_id": concept_id,
                    "start_offset_utf16": annotation.start_offset_utf16,
                    "end_offset_utf16": annotation.end_offset_utf16,
                    "surface_text": source_text,
                }
            )
        concept_keys = sorted(
            concept_by_id[concept_id]["canonical_key"] for concept_id in sentence_concepts
        )
        if not sentence_concepts:
            fail(f"sentence {order + 1} has no approved catalog match")
        if len(sentence_concepts) > MAX_CONCEPTS_PER_SENTENCE:
            fail(
                f"sentence {order + 1} maps to {len(sentence_concepts)} concepts; maximum is 4"
            )
        if len(annotations) > 100:
            fail(f"sentence {order + 1} has more than 100 annotation occurrences")
        per_sentence.append(
            {
                "order": order,
                "text": sentence.text,
                "distinct_concept_count": len(sentence_concepts),
                "concept_keys": concept_keys,
                "annotation_count": len(annotations),
                "annotations": annotations,
            }
        )

    if target_id is not None and target_occurrences == 0:
        fail(f"private target {expected_target} has no actual production matcher occurrence")
    distinct_keys = sorted(
        concept_by_id[concept_id]["canonical_key"] for concept_id in item_counts
    )
    if not item_counts:
        fail("item has no approved catalog concepts")
    if len(item_counts) > MAX_CONCEPTS_PER_ITEM:
        fail(
            f"item maps to {len(item_counts)} distinct concepts; K2-08 catalog eligibility "
            "requires 1–4 per item"
        )

    expected_concepts = item.get("expected_concepts")
    if not isinstance(expected_concepts, list) or any(not isinstance(value, str) for value in expected_concepts):
        fail("expected_concepts must be an array of canonical keys")
        expected_concepts = []
    if sorted(set(expected_concepts)) != distinct_keys:
        fail("expected_concepts does not exactly match the production matcher's distinct concept set")

    return {
        "item_id": item_id,
        "role": item.get("role"),
        "private_target_key": expected_target,
        "private_target_concept_id": target_id,
        "private_target_occurrences": target_occurrences,
        "title": title,
        "curated_level": level,
        "sentence_count": len(admin_sentences),
        "admin_token_count": total_tokens,
        "estimated_minutes": estimated_minutes,
        "distinct_concept_count": len(item_counts),
        "distinct_concepts": [
            {
                **concept_by_id[concept_id],
                "occurrence_count": item_counts[concept_id],
            }
            for concept_id in sorted(item_counts)
        ],
        "sentences": per_sentence,
        "violations": item_violations,
    }


def build_preview(pack: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    violations: list[str] = []
    candidates, concept_by_id, concept_id_by_key = _approved_candidates(snapshot, violations)

    raw_items = pack.get("items")
    if not isinstance(raw_items, list):
        violations.append("content pack items must be an array")
        raw_items = []
    items_by_id: dict[str, dict[str, Any]] = {}
    for item in raw_items:
        if not isinstance(item, dict):
            violations.append("each content pack item must be an object")
            continue
        item_id = str(item.get("item_id", "?"))
        if item_id in items_by_id:
            violations.append(f"duplicate item_id {item_id}")
        else:
            items_by_id[item_id] = item
    if set(items_by_id) != set(ITEM_ORDER):
        violations.append("content pack must contain exactly the N, W, and F items")

    approval = pack.get("approval")
    if not isinstance(approval, dict):
        violations.append("content pack approval metadata must be an object")
        approval = {}
    if approval.get("publication_authorized") is not False:
        violations.append("publication_authorized must remain false during preview")

    staging_owner_approved = (
        approval.get("approval_reference") == "PR #38"
        and approval.get("approved_on") == "2026-10-01"
        and approval.get("scope") == "staging_hosted_acceptance_only"
        and approval.get("editorial_review") == "approved_by_owner_2026-10-01_staging_only"
        and approval.get("rights_review") == "approved_by_owner_2026-10-01_staging_only"
    )

    preview_items = [
        _preview_item(
            items_by_id[item_id],
            candidates=candidates,
            concept_by_id=concept_by_id,
            concept_id_by_key=concept_id_by_key,
            violations=violations,
        )
        for item_id in ITEM_ORDER
        if item_id in items_by_id
    ]
    by_item_id = {item["item_id"]: item for item in preview_items}
    for item_id in ("W", "F"):
        target_id = by_item_id.get(item_id, {}).get("private_target_concept_id")
        if not target_id:
            continue
        mapped_elsewhere = [
            other_id
            for other_id, other_item in by_item_id.items()
            if other_id != item_id
            and any(concept["concept_id"] == target_id for concept in other_item["distinct_concepts"])
        ]
        if mapped_elsewhere:
            violations.append(
                f"{item_id} private target is cross-mapped in candidate item(s): "
                + ", ".join(mapped_elsewhere)
            )

    return {
        "schema_version": 1,
        "pack_id": pack.get("pack_id"),
        "candidate_status": pack.get("candidate_status"),
        "preview_only": True,
        "publication_authorized": False,
        "owner_approval_scope": (
            "staging_hosted_acceptance_only" if staging_owner_approved else "unverified_or_pending"
        ),
        "publication_status": (
            "blocked_pending_exact_hash_independent_review_and_authorized_admin_execution"
            if staging_owner_approved
            else "blocked_pending_human_editorial_and_rights_approval"
        ),
        "dry_run_scope": "production_Admin_DTO_and_Reader_matcher_only; no_database_catalog_or_actor_probe",
        "matcher_policy": POLICY_VERSION,
        "approved_catalog_snapshot": {
            "project": snapshot.get("project"),
            "source_sha": snapshot.get("sourceSha"),
            "scope": snapshot.get("scope"),
            "form_count": len(snapshot.get("rows", [])) if isinstance(snapshot.get("rows"), list) else 0,
            "concept_count": len(concept_by_id),
        },
        "catalog_fit_order_hypothesis": ["N", "W", "F"],
        "fresh_actor_baseline": {
            "proven": False,
            "status": "requires_live_catalog_preflight_then_normal_fresh_actor_probe",
        },
        "items": preview_items,
        "dry_run_pass": not violations,
        "violations": violations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", type=Path, default=DEFAULT_PACK)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--editorial", type=Path, default=DEFAULT_EDITORIAL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    load_violations: list[str] = []
    pack = _load_json(args.pack, "content pack", load_violations)
    snapshot = _load_json(args.snapshot, "approved catalog snapshot", load_violations)
    result = build_preview(pack, snapshot)
    if load_violations:
        result["dry_run_pass"] = False
        result["violations"] = load_violations + result["violations"]
    try:
        result["input_hashes"] = {
            "content_pack_sha256": _sha256(args.pack),
            "approved_catalog_snapshot_sha256": _sha256(args.snapshot),
            "editorial_preview_sha256": _sha256(args.editorial),
        }
    except OSError as error:
        result["dry_run_pass"] = False
        result["violations"].append(f"input file hash could not be computed: {type(error).__name__}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(
        json.dumps(
            {
                "output": str(args.output),
                "dry_run_pass": result["dry_run_pass"],
                "item_count": len(result["items"]),
                "violation_count": len(result["violations"]),
                "publication_authorized": False,
            },
            sort_keys=True,
        )
    )
    return 0 if result["dry_run_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
