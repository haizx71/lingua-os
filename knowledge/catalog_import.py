#!/usr/bin/env python3
"""Guarded transactional importer for an independently reviewed LINGUA catalog candidate.

Default behavior is preview-only. Apply requires the exact approved candidate hash and
plan hash plus DATABASE_URL. The importer only touches catalog/provenance tables.
It never creates learner intent, review/FSRS state, competence, learner events,
Today completion, saved items, learner status, or learner progress.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

CANDIDATE_SCHEMA = "knowledge-production-starter-candidate.v1"
PLAN_SCHEMA = "knowledge-catalog-apply-plan.v2"
SOURCE_NAME = "LINGUA First-Party Knowledge Starter"
SOURCE_VERSION = "2026-09-16.v1"
LICENSE_CODE = "LINGUA-FIRST-PARTY"
LICENSE_NAME = "LINGUA first-party authored content"
SOURCE_ATTRIBUTION = "LINGUA OS first-party authored knowledge starter"
TRANSFORM_VERSION = "knowledge-catalog-import.v3"
STAGING_REVIEW_STATUS = "review_pending"
NS = uuid.UUID("4b47b8d6-0d44-4dc7-91c2-3d97f56e6040")
LEVEL_IDS = {
    "LINGUA_A0": "00000000-0000-4000-8100-000000000000",
    "LINGUA_A1": "00000000-0000-4000-8100-000000000001",
    "LINGUA_A2": "00000000-0000-4000-8100-000000000002",
    "LINGUA_B1": "00000000-0000-4000-8100-000000000003",
}
LEVEL_CODES = {
    "LINGUA_A0": "A0",
    "LINGUA_A1": "A1",
    "LINGUA_A2": "A2",
    "LINGUA_B1": "B1",
}


class ImportError(Exception):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def stable_id(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f"{kind}:{key}"))


def normalize_form(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def normalize_sentence(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def utf16_length(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def utf16_offset(value: str, codepoint_index: int) -> int:
    return len(value[:codepoint_index].encode("utf-16-le")) // 2


def example_span(concept_type: str, canonical_form: str, text: str) -> dict[str, Any]:
    """Return a deterministic UTF-16 annotation without inventing lexical matches.

    Grammar examples legitimately span the whole sentence. Skills use whole-sentence
    context. Words/phrases are marked as target only when the canonical form occurs at
    token boundaries; inflected/non-literal examples fall back to whole-sentence context.
    """
    if not text.strip():
        raise ImportError("example text must be non-empty")
    end_all = utf16_length(text)
    if concept_type == "grammar":
        return {"startOffset": 0, "endOffset": end_all, "occurrenceRole": "grammar", "matchKind": "whole_sentence"}
    if concept_type == "skill":
        return {"startOffset": 0, "endOffset": end_all, "occurrenceRole": "context", "matchKind": "whole_sentence"}
    pattern = re.compile(rf"(?<!\w){re.escape(canonical_form)}(?!\w)", re.IGNORECASE)
    match = pattern.search(text)
    if match is None:
        return {"startOffset": 0, "endOffset": end_all, "occurrenceRole": "context", "matchKind": "no_exact_surface_match"}
    return {
        "startOffset": utf16_offset(text, match.start()),
        "endOffset": utf16_offset(text, match.end()),
        "occurrenceRole": "target",
        "matchKind": "exact_surface_match",
    }


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


def _validate_prerequisites(rows_by_key: dict[str, dict[str, Any]]) -> None:
    graph: dict[str, list[str]] = defaultdict(list)
    for key, row in rows_by_key.items():
        prerequisites = row["prerequisites"]
        if len(prerequisites) != len(set(prerequisites)):
            raise ImportError(f"duplicate prerequisite: {key}")
        for target in prerequisites:
            if target not in rows_by_key:
                raise ImportError(f"missing selected prerequisite: {key} -> {target}")
            if target == key:
                raise ImportError(f"self prerequisite: {key}")
            graph[key].append(target)

    state = {key: 0 for key in rows_by_key}

    def visit(node: str, stack: list[str]) -> None:
        state[node] = 1
        stack.append(node)
        for target in graph.get(node, []):
            if state[target] == 1:
                raise ImportError("prerequisite cycle: " + " -> ".join(stack + [target]))
            if state[target] == 0:
                visit(target, stack)
        stack.pop()
        state[node] = 2

    for key in sorted(rows_by_key):
        if state[key] == 0:
            visit(key, [])


def build_plan(candidate: dict[str, Any]) -> dict[str, Any]:
    concepts = sorted(candidate["concepts"], key=lambda x: x["canonicalKey"])
    keys = [c.get("canonicalKey") for c in concepts]
    if any(not isinstance(key, str) or not key for key in keys) or len(set(keys)) != 108:
        raise ImportError("candidate canonical keys must be 108 unique non-empty strings")

    rows: list[dict[str, Any]] = []
    counts = Counter()
    for concept in concepts:
        key = concept["canonicalKey"]
        ctype = concept.get("conceptType")
        form = concept.get("canonicalForm")
        topic = concept.get("topic")
        band = concept.get("curriculumBand")
        example = concept.get("example")
        if not all(isinstance(x, str) and x.strip() for x in (ctype, form, topic, band)):
            raise ImportError(f"malformed concept identity: {key!r}")
        if ctype not in {"word", "phrase", "grammar", "skill"} or not key.startswith(f"{ctype}:"):
            raise ImportError(f"concept type/key mismatch: {key}")
        if band not in LEVEL_IDS:
            raise ImportError(f"unsupported curriculum band: {key} -> {band}")
        if not isinstance(example, dict) or example.get("rights") != "FIRST_PARTY":
            raise ImportError(f"non-first-party example: {key}")
        example_en = example.get("en")
        example_vi = example.get("vi")
        if not isinstance(example_en, str) or not example_en.strip() or not isinstance(example_vi, str) or not example_vi.strip():
            raise ImportError(f"example requires non-empty en/vi text: {key}")
        vi_support = concept.get("vietnameseSupport")
        vi_gloss = concept.get("vietnameseGloss")
        if not isinstance(vi_support, str) or not vi_support.strip() or not isinstance(vi_gloss, str) or not vi_gloss.strip():
            raise ImportError(f"missing Vietnamese learner support: {key}")
        prerequisites = concept.get("prerequisites", [])
        if not isinstance(prerequisites, list) or any(not isinstance(x, str) or not x for x in prerequisites):
            raise ImportError(f"prerequisites must be a string list: {key}")

        raw_hash = digest(concept)
        example_hash = digest(example)
        span = example_span(ctype, form, example_en)
        if not (0 <= span["startOffset"] < span["endOffset"] <= utf16_length(example_en)):
            raise ImportError(f"invalid UTF-16 example span: {key}")
        row: dict[str, Any] = {
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
            "prerequisites": list(prerequisites),
            "example": dict(example),
            "sentenceId": stable_id("sentence", key + ":" + example_hash),
            "sentenceTranslationId": stable_id("sentence-translation", key + ":vi:" + example_hash),
            "sentenceNormalizedText": normalize_sentence(example_en),
            "sentenceConcept": span,
            "sourceMetadata": {
                "rights": "FIRST_PARTY",
                "stagingCandidate": True,
                "concept": concept,
            },
        }
        if ctype in {"word", "phrase"}:
            row["lexemeId"] = stable_id("lexeme", key)
            row["senseId"] = stable_id("sense", key + ":1")
        rows.append(row)
        counts[ctype] += 1

    expected_types = {"word": 77, "phrase": 16, "grammar": 8, "skill": 7}
    if dict(counts) != expected_types:
        raise ImportError(f"type count drift: {dict(counts)}")

    rows_by_key = {row["canonicalKey"]: row for row in rows}
    _validate_prerequisites(rows_by_key)

    topic_owners: dict[str, dict[str, Any]] = {}
    for row in rows:
        topic_owners.setdefault(row["topic"], row)
    topic_rows = [
        {
            "slug": topic,
            "topicId": owner["topicId"],
            "name": topic.replace("-", " ").title(),
            "sourceRecordId": owner["sourceRecordId"],
            "ownerCanonicalKey": owner["canonicalKey"],
        }
        for topic, owner in sorted(topic_owners.items())
    ]

    relations: list[dict[str, Any]] = []
    for row in rows:
        for target_key in row["prerequisites"]:
            target = rows_by_key[target_key]
            relations.append({
                "sourceCanonicalKey": row["canonicalKey"],
                "targetCanonicalKey": target_key,
                "sourceConceptId": row["conceptId"],
                "targetConceptId": target["conceptId"],
                "relationType": "prerequisite",
                "weight": 1.0,
                "sourceRecordId": row["sourceRecordId"],
            })
    relations.sort(key=lambda r: (r["sourceCanonicalKey"], r["targetCanonicalKey"]))

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
            "reviewStatus": STAGING_REVIEW_STATUS,
        },
        "counts": {
            "concepts": len(rows),
            "topics": len(topic_rows),
            "lexicalConcepts": counts["word"] + counts["phrase"],
            "prerequisiteRelations": len(relations),
            "sentences": len(rows),
            "sentenceTranslations": len(rows),
            "sentenceConcepts": len(rows),
            "byType": dict(sorted(counts.items())),
        },
        "topics": topic_rows,
        "relations": relations,
        "rows": rows,
    }
    plan["planSha256"] = digest(plan)
    return plan


def _fetchone(cur: Any, sql: str, params: tuple[Any, ...]) -> tuple[Any, ...] | None:
    cur.execute(sql, params)
    return cur.fetchone()


def _assert_preflight(cur: Any, plan: dict[str, Any]) -> None:
    source = plan["source"]
    rows = plan["rows"]

    cur.execute("select code from public.languages where code in ('en','vi') order by code")
    if [str(row[0]) for row in cur.fetchall()] != ["en", "vi"]:
        raise ImportError("staging must contain both en and vi languages")

    cur.execute("select id::text, code from public.proficiency_levels where id = any(%s::uuid[])", (list(LEVEL_IDS.values()),))
    actual_levels = {str(code): str(level_id) for level_id, code in cur.fetchall()}
    expected_levels = {LEVEL_CODES[band]: level_id for band, level_id in LEVEL_IDS.items()}
    if actual_levels != expected_levels:
        raise ImportError(f"proficiency level identity drift: {actual_levels}")

    license_row = _fetchone(cur, "select id::text,name,usage_policy,attribution_required from public.licenses where code=%s", (LICENSE_CODE,))
    if license_row is not None and (str(license_row[0]) != source["licenseId"] or str(license_row[1]) != LICENSE_NAME or str(license_row[2]) != "allowed" or bool(license_row[3])):
        raise ImportError("license identity/policy collision")

    source_row = _fetchone(cur, "select id::text,license_id::text,source_type,attribution_text from public.data_sources where name=%s and source_version=%s", (SOURCE_NAME, SOURCE_VERSION))
    if source_row is not None and (str(source_row[0]) != source["sourceId"] or str(source_row[1]) != source["licenseId"] or str(source_row[2]) != "internal" or str(source_row[3]) != SOURCE_ATTRIBUTION):
        raise ImportError("data source identity/provenance collision")

    keys = [row["canonicalKey"] for row in rows]
    cur.execute("select canonical_key,id::text,source_record_id::text from public.concepts where language_code='en' and canonical_key = any(%s)", (keys,))
    existing_concepts = {str(key): (str(cid), str(srid)) for key, cid, srid in cur.fetchall()}
    for row in rows:
        existing = existing_concepts.get(row["canonicalKey"])
        if existing is not None and existing != (row["conceptId"], row["sourceRecordId"]):
            raise ImportError(f"concept identity/provenance collision: {row['canonicalKey']}")

    source_record_ids = [row["sourceRecordId"] for row in rows]
    cur.execute("select id::text,source_id::text,source_record_key,raw_hash from public.source_records where id = any(%s::uuid[])", (source_record_ids,))
    by_source_record_id = {str(rid): (str(sid), str(key), str(raw_hash)) for rid, sid, key, raw_hash in cur.fetchall()}
    for row in rows:
        existing = by_source_record_id.get(row["sourceRecordId"])
        expected = (source["sourceId"], row["canonicalKey"], row["rawHash"])
        if existing is not None and existing != expected:
            raise ImportError(f"source record id collision: {row['canonicalKey']}")

    if source_row is not None:
        cur.execute("select source_record_key,raw_hash,id::text from public.source_records where source_id=%s and source_record_key = any(%s)", (source["sourceId"], keys))
        history: dict[str, list[tuple[str, str]]] = defaultdict(list)
        for key, raw_hash, rid in cur.fetchall():
            history[str(key)].append((str(raw_hash), str(rid)))
        for row in rows:
            for raw_hash, rid in history.get(row["canonicalKey"], []):
                if raw_hash == row["rawHash"] and rid != row["sourceRecordId"]:
                    raise ImportError(f"source record unique-key collision: {row['canonicalKey']}")

    topic_slugs = [topic["slug"] for topic in plan["topics"]]
    cur.execute("select slug,id::text from public.topics where slug = any(%s)", (topic_slugs,))
    existing_topics = {str(slug): str(tid) for slug, tid in cur.fetchall()}
    for topic in plan["topics"]:
        existing = existing_topics.get(topic["slug"])
        if existing is not None and existing != topic["topicId"]:
            raise ImportError(f"topic identity collision: {topic['slug']}")

    lexical_rows = [row for row in rows if "lexemeId" in row]
    normalized_forms = sorted({row["normalizedForm"] for row in lexical_rows})
    cur.execute("select normalized_form,part_of_speech,id::text,concept_id::text,source_record_id::text from public.lexemes where language_code='en' and normalized_form = any(%s)", (normalized_forms,))
    existing_lexemes = {(str(form), None if pos is None else str(pos)): (str(lid), str(cid), str(srid)) for form, pos, lid, cid, srid in cur.fetchall()}
    for row in lexical_rows:
        identity = (row["normalizedForm"], row["partOfSpeech"])
        existing = existing_lexemes.get(identity)
        expected = (row["lexemeId"], row["conceptId"], row["sourceRecordId"])
        if existing is not None and existing != expected:
            raise ImportError(f"lexeme identity collision: {row['canonicalKey']}")

    sentence_ids = [row["sentenceId"] for row in rows]
    cur.execute("select id::text,text,normalized_text,source_record_id::text from public.sentences where id = any(%s::uuid[])", (sentence_ids,))
    existing_sentences = {str(sid): (str(text), str(normalized), str(srid)) for sid, text, normalized, srid in cur.fetchall()}
    for row in rows:
        expected = (row["example"]["en"], row["sentenceNormalizedText"], row["sourceRecordId"])
        existing = existing_sentences.get(row["sentenceId"])
        if existing is not None and existing != expected:
            raise ImportError(f"sentence identity collision: {row['canonicalKey']}")

    translation_ids = [row["sentenceTranslationId"] for row in rows]
    cur.execute("select id::text,sentence_id::text,target_language_code,text,source_record_id::text from public.sentence_translations where id = any(%s::uuid[])", (translation_ids,))
    existing_translations = {str(tid): (str(sid), str(lang), str(text), str(srid)) for tid, sid, lang, text, srid in cur.fetchall()}
    for row in rows:
        expected = (row["sentenceId"], "vi", row["example"]["vi"], row["sourceRecordId"])
        existing = existing_translations.get(row["sentenceTranslationId"])
        if existing is not None and existing != expected:
            raise ImportError(f"sentence translation identity collision: {row['canonicalKey']}")


def _insert_source_records(cur: Any, plan: dict[str, Any]) -> None:
    source = plan["source"]
    for row in plan["rows"]:
        metadata = dict(row["sourceMetadata"])
        metadata["candidateSha256"] = plan["candidateSha256"]
        metadata["planSha256"] = plan["planSha256"]
        cur.execute(
            "insert into public.source_records(id,source_id,source_record_key,raw_hash,transform_version,quality_score,review_status,reviewed_at,metadata) values (%s,%s,%s,%s,%s,1,%s,NULL,%s::jsonb) on conflict (source_id,source_record_key,raw_hash) do nothing",
            (row["sourceRecordId"], source["sourceId"], row["canonicalKey"], row["rawHash"], source["transformVersion"], source["reviewStatus"], json.dumps(metadata, ensure_ascii=False)),
        )


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
                _assert_preflight(cur, plan)
                cur.execute("insert into public.licenses(id,code,name,usage_policy,attribution_required) values (%s,%s,%s,'allowed',false) on conflict (code) do nothing", (source["licenseId"], LICENSE_CODE, LICENSE_NAME))
                cur.execute("insert into public.data_sources(id,name,source_type,source_version,license_id,attribution_text) values (%s,%s,'internal',%s,%s,%s) on conflict (name,source_version) do nothing", (source["sourceId"], SOURCE_NAME, SOURCE_VERSION, source["licenseId"], SOURCE_ATTRIBUTION))
                _insert_source_records(cur, plan)

                for row in rows:
                    cur.execute("insert into public.concepts(id,language_code,concept_type,canonical_key,source_record_id) values (%s,'en',%s,%s,%s) on conflict (language_code,concept_type,canonical_key) do nothing", (row["conceptId"], row["conceptType"], row["canonicalKey"], row["sourceRecordId"]))

                for topic in plan["topics"]:
                    cur.execute("insert into public.topics(id,slug,name,source_record_id) values (%s,%s,%s,%s) on conflict (slug) do nothing", (topic["topicId"], topic["slug"], topic["name"], topic["sourceRecordId"]))

                for row in rows:
                    cur.execute("insert into public.concept_topics(concept_id,topic_id) values (%s,%s) on conflict do nothing", (row["conceptId"], row["topicId"]))
                    cur.execute("insert into public.framework_mappings(concept_id,level_id,confidence,source_record_id) values (%s,%s,1,%s) on conflict (concept_id,level_id) do nothing", (row["conceptId"], row["levelId"], row["sourceRecordId"]))
                    if "lexemeId" in row:
                        cur.execute("insert into public.lexemes(id,concept_id,language_code,lemma,normalized_form,part_of_speech,source_record_id) values (%s,%s,'en',%s,%s,%s,%s) on conflict (language_code,normalized_form,part_of_speech) do nothing", (row["lexemeId"], row["conceptId"], row["canonicalForm"], row["normalizedForm"], row["partOfSpeech"], row["sourceRecordId"]))
                        cur.execute("insert into public.word_senses(id,lexeme_id,sense_order,definition,definition_language_code,source_record_id) values (%s,%s,1,%s,'vi',%s) on conflict (lexeme_id,sense_order) do nothing", (row["senseId"], row["lexemeId"], row["vietnameseSupport"], row["sourceRecordId"]))
                    cur.execute("insert into public.sentences(id,language_code,text,normalized_text,quality_score,source_record_id) values (%s,'en',%s,%s,1,%s) on conflict (id) do nothing", (row["sentenceId"], row["example"]["en"], row["sentenceNormalizedText"], row["sourceRecordId"]))
                    cur.execute("insert into public.sentence_translations(id,sentence_id,target_language_code,text,source_record_id) values (%s,%s,'vi',%s,%s) on conflict (id) do nothing", (row["sentenceTranslationId"], row["sentenceId"], row["example"]["vi"], row["sourceRecordId"]))
                    annotation = row["sentenceConcept"]
                    cur.execute("insert into public.sentence_concepts(sentence_id,concept_id,language_code,start_offset,end_offset,occurrence_role) values (%s,%s,'en',%s,%s,%s) on conflict do nothing", (row["sentenceId"], row["conceptId"], annotation["startOffset"], annotation["endOffset"], annotation["occurrenceRole"]))

                for relation in plan["relations"]:
                    cur.execute("insert into public.concept_relations(source_concept_id,target_concept_id,language_code,relation_type,weight,source_record_id) values (%s,%s,'en','prerequisite',%s,%s) on conflict (source_concept_id,target_concept_id,relation_type) do nothing", (relation["sourceConceptId"], relation["targetConceptId"], relation["weight"], relation["sourceRecordId"]))

                cur.execute("select canonical_key,id::text,source_record_id::text from public.concepts where language_code='en' and canonical_key = any(%s)", ([row["canonicalKey"] for row in rows],))
                after = {str(key): (str(cid), str(srid)) for key, cid, srid in cur.fetchall()}
                if len(after) != 108:
                    raise ImportError(f"post-apply concept verification failed: expected 108, got {len(after)}")
                wrong = [row["canonicalKey"] for row in rows if after.get(row["canonicalKey"]) != (row["conceptId"], row["sourceRecordId"])]
                if wrong:
                    raise ImportError("post-apply concept/provenance mismatch: " + ", ".join(wrong))

                cur.execute("select count(*) from public.sentences where id = any(%s::uuid[])", ([row["sentenceId"] for row in rows],))
                if int(cur.fetchone()[0]) != 108:
                    raise ImportError("post-apply sentence verification failed")
                cur.execute("select count(*) from public.sentence_translations where id = any(%s::uuid[])", ([row["sentenceTranslationId"] for row in rows],))
                if int(cur.fetchone()[0]) != 108:
                    raise ImportError("post-apply sentence translation verification failed")
                cur.execute("select count(*) from public.concept_relations where relation_type='prerequisite' and source_concept_id = any(%s::uuid[])", ([row["conceptId"] for row in rows],))
                if int(cur.fetchone()[0]) < plan["counts"]["prerequisiteRelations"]:
                    raise ImportError("post-apply prerequisite relation verification failed")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--output")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--approved-candidate-sha")
    parser.add_argument("--approved-plan-sha")
    return parser.parse_args(argv)


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
