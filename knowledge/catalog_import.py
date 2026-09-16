#!/usr/bin/env python3
"""Guarded transactional importer for an independently reviewed LINGUA catalog candidate.

Default behavior is preview-only. Apply requires the exact approved candidate hash and
plan hash plus DATABASE_URL. The importer only touches catalog/provenance tables.
It never references learner-state, review, FSRS, evidence, Today, Library or Reader
progress tables.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

CANDIDATE_SCHEMA = "knowledge-production-starter-candidate.v1"
PLAN_SCHEMA = "knowledge-catalog-apply-plan.v1"
SOURCE_NAME = "LINGUA First-Party Knowledge Starter"
SOURCE_VERSION = "2026-09-16.v1"
LICENSE_CODE = "LINGUA-FIRST-PARTY"
TRANSFORM_VERSION = "knowledge-catalog-import.v1"
NS = uuid.UUID("4b47b8d6-0d44-4dc7-91c2-3d97f56e6040")
LEVEL_IDS = {
    "LINGUA_A0": "00000000-0000-4000-8100-000000000000",
    "LINGUA_A1": "00000000-0000-4000-8100-000000000001",
    "LINGUA_A2": "00000000-0000-4000-8100-000000000002",
    "LINGUA_B1": "00000000-0000-4000-8100-000000000003",
}


class ImportError(Exception):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def stable_id(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f"{kind}:{key}"))


def normalize_form(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def load_candidate(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ImportError(f"cannot read candidate: {exc}") from exc
    if data.get("schemaVersion") != CANDIDATE_SCHEMA:
        raise ImportError("unsupported candidate schema")
    if data.get("status") != "STAGING_CANDIDATE_REVIEW_REQUIRED":
        raise ImportError("candidate status is not review-required staging candidate")
    if data.get("counts", {}).get("selectedConcepts") != 108:
        raise ImportError("candidate must contain exactly 108 selected concepts")
    concepts = data.get("concepts")
    if not isinstance(concepts, list) or len(concepts) != 108:
        raise ImportError("candidate concept list/count mismatch")
    expected = data.get("candidateSha256")
    unsigned = dict(data)
    unsigned.pop("candidateSha256", None)
    if not isinstance(expected, str) or digest(unsigned) != expected:
        raise ImportError("candidate hash verification failed")
    return data


def build_plan(candidate: dict[str, Any]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    topics: set[str] = set()
    counts = Counter()
    for concept in sorted(candidate["concepts"], key=lambda x: x["canonicalKey"]):
        key = concept.get("canonicalKey")
        ctype = concept.get("conceptType")
        form = concept.get("canonicalForm")
        topic = concept.get("topic")
        band = concept.get("curriculumBand")
        example = concept.get("example")
        if not all(isinstance(x, str) and x.strip() for x in (key, ctype, form, topic, band)):
            raise ImportError(f"malformed concept identity: {key!r}")
        if key in seen:
            raise ImportError(f"duplicate canonical key: {key}")
        if ctype not in {"word", "phrase", "grammar", "skill"} or not key.startswith(f"{ctype}:"):
            raise ImportError(f"concept type/key mismatch: {key}")
        if band not in LEVEL_IDS:
            raise ImportError(f"unsupported curriculum band: {key} -> {band}")
        if not isinstance(example, dict) or example.get("rights") != "FIRST_PARTY":
            raise ImportError(f"non-first-party example: {key}")
        vi_support = concept.get("vietnameseSupport")
        vi_gloss = concept.get("vietnameseGloss")
        if not isinstance(vi_support, str) or not vi_support.strip() or not isinstance(vi_gloss, str) or not vi_gloss.strip():
            raise ImportError(f"missing Vietnamese learner support: {key}")
        seen.add(key); topics.add(topic); counts[ctype] += 1
        raw_hash = digest(concept)
        row = {
            "canonicalKey": key,
            "conceptType": ctype,
            "conceptId": stable_id("concept", key),
            "sourceRecordId": stable_id("source-record", key + ":" + raw_hash),
            "rawHash": raw_hash,
            "canonicalForm": form,
            "partOfSpeech": concept.get("partOfSpeech"),
            "normalizedForm": normalize_form(form),
            "topic": topic,
            "topicId": stable_id("topic", topic),
            "levelId": LEVEL_IDS[band],
            "curriculumBand": band,
            "vietnameseGloss": vi_gloss,
            "vietnameseSupport": vi_support,
            "example": example,
        }
        if ctype in {"word", "phrase"}:
            row["lexemeId"] = stable_id("lexeme", key)
            row["senseId"] = stable_id("sense", key + ":1")
        rows.append(row)
    expected_types = {"word": 77, "phrase": 16, "grammar": 8, "skill": 7}
    if dict(counts) != expected_types:
        raise ImportError(f"type count drift: {dict(counts)}")
    plan: dict[str, Any] = {
        "schemaVersion": PLAN_SCHEMA,
        "candidateSha256": candidate["candidateSha256"],
        "source": {
            "licenseId": stable_id("license", LICENSE_CODE),
            "licenseCode": LICENSE_CODE,
            "sourceId": stable_id("source", SOURCE_NAME + ":" + SOURCE_VERSION),
            "sourceName": SOURCE_NAME,
            "sourceVersion": SOURCE_VERSION,
            "transformVersion": TRANSFORM_VERSION,
        },
        "counts": {"concepts": len(rows), "topics": len(topics), "lexicalConcepts": counts["word"] + counts["phrase"], "byType": dict(sorted(counts.items()))},
        "rows": rows,
    }
    plan["planSha256"] = digest(plan)
    return plan


def _existing_snapshot(cur: Any, keys: list[str]) -> dict[str, str]:
    cur.execute("select canonical_key, id::text from public.concepts where canonical_key = any(%s)", (keys,))
    return dict(cur.fetchall())


def apply_plan(plan: dict[str, Any], database_url: str) -> None:
    try:
        import psycopg  # type: ignore
    except ImportError as exc:
        raise ImportError("apply requires psycopg; install project backend dependencies") from exc
    source = plan["source"]
    rows = plan["rows"]
    with psycopg.connect(database_url) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                existing = _existing_snapshot(cur, [r["canonicalKey"] for r in rows])
                collisions = [r["canonicalKey"] for r in rows if r["canonicalKey"] in existing and existing[r["canonicalKey"]] != r["conceptId"]]
                if collisions:
                    raise ImportError("identity collision(s): " + ", ".join(collisions))
                cur.execute("insert into public.licenses(id,code,name,usage_policy,attribution_required) values (%s,%s,%s,'allowed',false) on conflict (code) do nothing", (source["licenseId"], LICENSE_CODE, "LINGUA first-party authored content"))
                cur.execute("insert into public.data_sources(id,name,source_type,source_version,license_id,attribution_text) values (%s,%s,'internal',%s,%s,%s) on conflict (name,source_version) do nothing", (source["sourceId"], SOURCE_NAME, SOURCE_VERSION, source["licenseId"], "LINGUA OS first-party authored knowledge starter"))
                for r in rows:
                    cur.execute("insert into public.source_records(id,source_id,source_record_key,raw_hash,transform_version,quality_score,review_status,reviewed_at,metadata) values (%s,%s,%s,%s,%s,1,'approved',now(),%s::jsonb) on conflict (source_id,source_record_key,raw_hash) do nothing", (r["sourceRecordId"], source["sourceId"], r["canonicalKey"], r["rawHash"], TRANSFORM_VERSION, json.dumps({"candidateSha256": plan["candidateSha256"], "planSha256": plan["planSha256"], "rights": "FIRST_PARTY"})))
                    cur.execute("insert into public.concepts(id,language_code,concept_type,canonical_key,source_record_id) values (%s,'en',%s,%s,%s) on conflict (language_code,concept_type,canonical_key) do nothing", (r["conceptId"], r["conceptType"], r["canonicalKey"], r["sourceRecordId"]))
                    cur.execute("insert into public.topics(id,slug,name,source_record_id) values (%s,%s,%s,%s) on conflict (slug) do nothing", (r["topicId"], r["topic"], r["topic"].replace('-', ' ').title(), r["sourceRecordId"]))
                    cur.execute("insert into public.concept_topics(concept_id,topic_id) values (%s,%s) on conflict do nothing", (r["conceptId"], r["topicId"]))
                    cur.execute("insert into public.framework_mappings(concept_id,level_id,confidence,source_record_id) values (%s,%s,1,%s) on conflict (concept_id,level_id) do nothing", (r["conceptId"], r["levelId"], r["sourceRecordId"]))
                    if "lexemeId" in r:
                        cur.execute("insert into public.lexemes(id,concept_id,language_code,lemma,normalized_form,part_of_speech,source_record_id) values (%s,%s,'en',%s,%s,%s,%s) on conflict (language_code,normalized_form,part_of_speech) do nothing", (r["lexemeId"], r["conceptId"], r["canonicalForm"], r["normalizedForm"], r["partOfSpeech"], r["sourceRecordId"]))
                        cur.execute("insert into public.word_senses(id,lexeme_id,sense_order,definition,definition_language_code,source_record_id) values (%s,%s,1,%s,'vi',%s) on conflict (lexeme_id,sense_order) do nothing", (r["senseId"], r["lexemeId"], r["vietnameseSupport"], r["sourceRecordId"]))
                after = _existing_snapshot(cur, [r["canonicalKey"] for r in rows])
                if len(after) != 108:
                    raise ImportError(f"post-apply concept verification failed: expected 108, got {len(after)}")
                wrong = [r["canonicalKey"] for r in rows if after.get(r["canonicalKey"]) != r["conceptId"]]
                if wrong:
                    raise ImportError("post-apply identity mismatch: " + ", ".join(wrong))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--candidate", required=True)
    p.add_argument("--output")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--approved-candidate-sha")
    p.add_argument("--approved-plan-sha")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        candidate = load_candidate(Path(args.candidate))
        plan = build_plan(candidate)
        if args.apply:
            if args.approved_candidate_sha != plan["candidateSha256"]:
                raise ImportError("approved candidate hash does not match")
            if args.approved_plan_sha != plan["planSha256"]:
                raise ImportError("approved plan hash does not match")
            database_url = os.environ.get("DATABASE_URL")
            if not database_url:
                raise ImportError("DATABASE_URL is required for apply")
            apply_plan(plan, database_url)
        rendered = json.dumps(plan, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        if args.output:
            Path(args.output).write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
        return 0
    except ImportError as exc:
        print(f"KNOWLEDGE CATALOG IMPORT: FAIL: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
