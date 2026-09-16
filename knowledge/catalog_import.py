#!/usr/bin/env python3
"""Guarded transactional importer for the reviewed LINGUA starter catalog.

Default behavior is preview-only. Apply requires the exact approved candidate hash,
the exact approved plan hash, and DATABASE_URL. The importer only touches
catalog/provenance tables and never creates learner intent, review/FSRS state,
competence, learner events, Today completion, saved items, learner status, or
learner progress.
"""
from __future__ import annotations

import argparse
import builtins
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
APPLY_REVIEW_STATUS = "approved"
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

REVIEWED_EXAMPLE_SURFACES = {
    "word:be:verb": "am",
    "word:choose:verb": "chose",
    "word:manage:verb": "managed",
    "word:realize:verb": "realized",
    "phrase:look-for": "looking for",
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


def example_span(concept_type: str, surface_form: str, text: str) -> dict[str, Any]:
    if not text.strip():
        raise ImportError("example text must be non-empty")
    end_all = utf16_length(text)
    if concept_type == "grammar":
        return {"startOffset": 0, "endOffset": end_all, "occurrenceRole": "grammar", "matchKind": "whole_sentence"}
    if concept_type == "skill":
        return {"startOffset": 0, "endOffset": end_all, "occurrenceRole": "context", "matchKind": "whole_sentence"}
    pattern = re.compile(rf"(?<!\w){re.escape(surface_form)}(?!\w)", re.IGNORECASE)
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


def _surface_for(key: str, concept_type: str, canonical_form: str) -> str:
    if concept_type not in {"word", "phrase"}:
        return canonical_form
    return REVIEWED_EXAMPLE_SURFACES.get(key, canonical_form)


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
        reviewed_surface = _surface_for(key, ctype, form)
        span = example_span(ctype, reviewed_surface, example_en)
        if not (0 <= span["startOffset"] < span["endOffset"] <= utf16_length(example_en)):
            raise ImportError(f"invalid UTF-16 example span: {key}")
        if ctype in {"word", "phrase"} and span["occurrenceRole"] != "target":
            raise ImportError(f"lexical example does not contain an approved target surface: {key}")
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
            "reviewedExampleSurface": reviewed_surface,
            "sentenceId": stable_id("sentence", key + ":" + example_hash),
            "sentenceTranslationId": stable_id("sentence-translation", key + ":vi:" + example_hash),
            "sentenceNormalizedText": normalize_sentence(example_en),
            "sentenceConcept": span,
            "sourceMetadata": {
                "rights": "FIRST_PARTY",
                "stagingCandidate": True,
                "catalogApprovalScope": "reviewed_staging_catalog",
                "concept": concept,
            },
        }
        if ctype in {"word", "phrase"}:
            row["lexemeId"] = stable_id("lexeme", key)
            row["senseId"] = stable_id("sense", key + ":1")
            if normalize_form(reviewed_surface) != normalize_form(form):
                row["lexemeForm"] = {
                    "id": stable_id("lexeme-form", key + ":" + normalize_form(reviewed_surface)),
                    "form": reviewed_surface,
                    "normalizedForm": normalize_form(reviewed_surface),
                    "formType": "reviewed_example_surface",
                }
                row["sourceMetadata"]["reviewedExampleSurface"] = reviewed_surface
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
        {"slug": topic, "topicId": owner["topicId"], "name": topic.replace("-", " ").title(), "sourceRecordId": owner["sourceRecordId"], "ownerCanonicalKey": owner["canonicalKey"]}
        for topic, owner in sorted(topic_owners.items())
    ]
    relations: list[dict[str, Any]] = []
    for row in rows:
        for target_key in row["prerequisites"]:
            target = rows_by_key[target_key]
            relations.append({
                "sourceCanonicalKey": row["canonicalKey"], "targetCanonicalKey": target_key,
                "sourceConceptId": row["conceptId"], "targetConceptId": target["conceptId"],
                "relationType": "prerequisite", "weight": 1.0, "sourceRecordId": row["sourceRecordId"],
            })
    relations.sort(key=lambda r: (r["sourceCanonicalKey"], r["targetCanonicalKey"]))
    plan: dict[str, Any] = {
        "schemaVersion": PLAN_SCHEMA,
        "candidateSha256": candidate["candidateSha256"],
        "source": {
            "licenseId": stable_id("license", LICENSE_CODE), "licenseCode": LICENSE_CODE,
            "sourceId": stable_id("source", SOURCE_NAME + ":" + SOURCE_VERSION),
            "sourceName": SOURCE_NAME, "sourceVersion": SOURCE_VERSION,
            "transformVersion": TRANSFORM_VERSION,
            "reviewStatus": STAGING_REVIEW_STATUS,
            "applyReviewStatus": APPLY_REVIEW_STATUS,
            "approvalBoundary": "exact_candidate_and_plan_hashes_required",
        },
        "counts": {
            "concepts": len(rows), "topics": len(topic_rows),
            "lexicalConcepts": counts["word"] + counts["phrase"],
            "lexemeForms": sum(1 for row in rows if "lexemeForm" in row),
            "prerequisiteRelations": len(relations), "sentences": len(rows),
            "sentenceTranslations": len(rows), "sentenceConcepts": len(rows),
            "byType": dict(sorted(counts.items())),
        },
        "topics": topic_rows, "relations": relations, "rows": rows,
    }
    plan["planSha256"] = digest(plan)
    return plan


def _fetchone(cur: Any, sql: str, params: tuple[Any, ...]) -> tuple[Any, ...] | None:
    cur.execute(sql, params)
    return cur.fetchone()


def _metadata_for(plan: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(row["sourceMetadata"])
    metadata["candidateSha256"] = plan["candidateSha256"]
    metadata["planSha256"] = plan["planSha256"]
    return metadata


def _assert_preflight(cur: Any, plan: dict[str, Any]) -> None:
    source = plan["source"]
    rows = plan["rows"]
    concept_ids = [row["conceptId"] for row in rows]
    cur.execute("select code from public.languages where code in ('en','vi') order by code")
    if [str(row[0]) for row in cur.fetchall()] != ["en", "vi"]:
        raise ImportError("staging must contain both en and vi languages")
    cur.execute("select id::text,code from public.proficiency_levels where id = any(%s::uuid[])", (list(LEVEL_IDS.values()),))
    actual_levels = {str(code): str(level_id) for level_id, code in cur.fetchall()}
    if actual_levels != {LEVEL_CODES[band]: level_id for band, level_id in LEVEL_IDS.items()}:
        raise ImportError(f"proficiency level identity drift: {actual_levels}")
    license_row = _fetchone(cur, "select id::text,code,name,usage_policy,attribution_required from public.licenses where code=%s or id=%s", (LICENSE_CODE, source["licenseId"]))
    if license_row is not None and (str(license_row[0]), str(license_row[1]), str(license_row[2]), str(license_row[3]), bool(license_row[4])) != (source["licenseId"], LICENSE_CODE, LICENSE_NAME, "allowed", False):
        raise ImportError("license identity/policy collision")
    source_row = _fetchone(cur, "select id::text,name,source_version,license_id::text,source_type,attribution_text from public.data_sources where (name=%s and source_version=%s) or id=%s", (SOURCE_NAME, SOURCE_VERSION, source["sourceId"]))
    expected_source = (source["sourceId"], SOURCE_NAME, SOURCE_VERSION, source["licenseId"], "internal", SOURCE_ATTRIBUTION)
    if source_row is not None and tuple(map(str, source_row)) != expected_source:
        raise ImportError("data source identity/provenance collision")
    keys = [row["canonicalKey"] for row in rows]
    cur.execute("select canonical_key,concept_type,id::text,source_record_id::text from public.concepts where language_code='en' and (canonical_key = any(%s) or id = any(%s::uuid[]))", (keys, concept_ids))
    found_concepts: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for key, ctype, cid, srid in cur.fetchall():
        found_concepts[str(key)].append((str(ctype), str(cid), str(srid)))
    for row in rows:
        found = found_concepts.get(row["canonicalKey"], [])
        expected = (row["conceptType"], row["conceptId"], row["sourceRecordId"])
        if found and found != [expected]:
            raise ImportError(f"concept identity/provenance collision: {row['canonicalKey']}")
    expected_keys = set(keys)
    for key, values in found_concepts.items():
        if key not in expected_keys and any(v[1] in set(concept_ids) for v in values):
            raise ImportError(f"concept UUID collision with unrelated key: {key}")
    source_record_ids = [row["sourceRecordId"] for row in rows]
    cur.execute("select id::text,source_id::text,source_record_key,raw_hash,transform_version,quality_score,review_status,reviewed_at,metadata from public.source_records where id = any(%s::uuid[])", (source_record_ids,))
    existing_records = {str(record[0]): record[1:] for record in cur.fetchall()}
    for row in rows:
        existing = existing_records.get(row["sourceRecordId"])
        if existing is None:
            continue
        sid, key, raw_hash, transform, quality, status, reviewed_at, metadata = existing
        if str(sid) != source["sourceId"] or str(key) != row["canonicalKey"] or str(raw_hash) != row["rawHash"] or str(transform) != source["transformVersion"] or float(quality) != 1.0 or str(status) != APPLY_REVIEW_STATUS or reviewed_at is None or metadata != _metadata_for(plan, row):
            raise ImportError(f"source record content collision: {row['canonicalKey']}")
    if source_row is not None:
        cur.execute("select source_record_key,raw_hash,id::text from public.source_records where source_id=%s and source_record_key = any(%s)", (source["sourceId"], keys))
        rows_by_key = {row["canonicalKey"]: row for row in rows}
        for key, raw_hash, record_id in cur.fetchall():
            row = rows_by_key[str(key)]
            if str(raw_hash) == row["rawHash"] and str(record_id) != row["sourceRecordId"]:
                raise ImportError(f"source record unique-key collision: {key}")
    topic_ids = [topic["topicId"] for topic in plan["topics"]]
    topic_slugs = [topic["slug"] for topic in plan["topics"]]
    cur.execute("select id::text,slug,name,source_record_id::text from public.topics where slug = any(%s) or id = any(%s::uuid[])", (topic_slugs, topic_ids))
    existing_topics = {str(slug): (str(tid), str(name), str(srid)) for tid, slug, name, srid in cur.fetchall()}
    for topic in plan["topics"]:
        existing = existing_topics.get(topic["slug"])
        expected = (topic["topicId"], topic["name"], topic["sourceRecordId"])
        if existing is not None and existing != expected:
            raise ImportError(f"topic identity/provenance collision: {topic['slug']}")
    for slug, value in existing_topics.items():
        if slug not in set(topic_slugs) and value[0] in set(topic_ids):
            raise ImportError(f"topic UUID collision with unrelated slug: {slug}")
    lexical_rows = [row for row in rows if "lexemeId" in row]
    lexeme_ids = [row["lexemeId"] for row in lexical_rows]
    normalized_forms = sorted({row["normalizedForm"] for row in lexical_rows})
    cur.execute("select normalized_form,part_of_speech,id::text,concept_id::text,source_record_id::text from public.lexemes where language_code='en' and (normalized_form = any(%s) or id = any(%s::uuid[]))", (normalized_forms, lexeme_ids))
    existing_lexemes = {(str(form), None if pos is None else str(pos)): (str(lid), str(cid), str(srid)) for form, pos, lid, cid, srid in cur.fetchall()}
    expected_lexeme_identity = {(row["normalizedForm"], row["partOfSpeech"]): row for row in lexical_rows}
    for identity, row in expected_lexeme_identity.items():
        existing = existing_lexemes.get(identity)
        if existing is not None and existing != (row["lexemeId"], row["conceptId"], row["sourceRecordId"]):
            raise ImportError(f"lexeme identity collision: {row['canonicalKey']}")
    for identity, value in existing_lexemes.items():
        if identity not in expected_lexeme_identity and value[0] in set(lexeme_ids):
            raise ImportError(f"lexeme UUID collision with unrelated identity: {identity}")
    form_rows = [row for row in lexical_rows if "lexemeForm" in row]
    if form_rows:
        form_ids = [row["lexemeForm"]["id"] for row in form_rows]
        form_lexeme_ids = [row["lexemeId"] for row in form_rows]
        cur.execute("select id::text,lexeme_id::text,form,normalized_form,form_type,source_record_id::text from public.lexeme_forms where id = any(%s::uuid[]) or (lexeme_id = any(%s::uuid[]) and form_type='reviewed_example_surface')", (form_ids, form_lexeme_ids))
        existing_forms = list(cur.fetchall())
        expected_by_lexeme = {row["lexemeId"]: (row["lexemeForm"]["id"], row["lexemeId"], row["lexemeForm"]["form"], row["lexemeForm"]["normalizedForm"], row["lexemeForm"]["formType"], row["sourceRecordId"]) for row in form_rows}
        seen = {str(item[1]): tuple(str(v) for v in item) for item in existing_forms}
        for lexeme_id, expected in expected_by_lexeme.items():
            if lexeme_id in seen and seen[lexeme_id] != expected:
                raise ImportError(f"lexeme form collision: {lexeme_id}")
        expected_ids = {row["lexemeForm"]["id"] for row in form_rows}
        for item in existing_forms:
            if str(item[0]) in expected_ids and str(item[1]) not in expected_by_lexeme:
                raise ImportError("lexeme form UUID collision")
    sense_ids = [row["senseId"] for row in lexical_rows]
    cur.execute("select id::text,lexeme_id::text,sense_order,definition,definition_language_code,translated_definition,translation_language_code,source_record_id::text from public.word_senses where id = any(%s::uuid[]) or (lexeme_id = any(%s::uuid[]) and sense_order=1)", (sense_ids, lexeme_ids))
    senses = list(cur.fetchall())
    by_lexeme: dict[str, list[tuple[Any, ...]]] = defaultdict(list)
    for item in senses:
        by_lexeme[str(item[1])].append(item)
    for row in lexical_rows:
        found = by_lexeme.get(row["lexemeId"], [])
        if not found:
            continue
        if len(found) != 1:
            raise ImportError(f"word sense collision: {row['canonicalKey']}")
        sid, lexeme_id, sense_order, definition, def_lang, translated, trans_lang, srid = found[0]
        expected = (row["senseId"], row["lexemeId"], 1, row["vietnameseSupport"], "vi", None, None, row["sourceRecordId"])
        actual = (str(sid), str(lexeme_id), int(sense_order), str(definition), str(def_lang), translated, trans_lang, str(srid))
        if actual != expected:
            raise ImportError(f"word sense content collision: {row['canonicalKey']}")
    expected_sense_ids = set(sense_ids)
    for item in senses:
        if str(item[0]) in expected_sense_ids and str(item[1]) not in set(lexeme_ids):
            raise ImportError("word sense UUID collision")
    cur.execute("select concept_id::text,level_id::text,confidence,source_record_id::text from public.framework_mappings where concept_id = any(%s::uuid[])", (concept_ids,))
    mappings_by_concept: dict[str, list[tuple[str, float, str]]] = defaultdict(list)
    for cid, level_id, confidence, srid in cur.fetchall():
        mappings_by_concept[str(cid)].append((str(level_id), float(confidence), str(srid)))
    for row in rows:
        found = mappings_by_concept.get(row["conceptId"], [])
        if found and found != [(row["levelId"], 1.0, row["sourceRecordId"])]:
            raise ImportError(f"framework mapping collision: {row['canonicalKey']}")
    sentence_ids = [row["sentenceId"] for row in rows]
    cur.execute("select id::text,text,normalized_text,quality_score,source_record_id::text from public.sentences where id = any(%s::uuid[])", (sentence_ids,))
    existing_sentences = {str(sid): (str(text), str(normalized), float(quality), str(srid)) for sid, text, normalized, quality, srid in cur.fetchall()}
    for row in rows:
        expected = (row["example"]["en"], row["sentenceNormalizedText"], 1.0, row["sourceRecordId"])
        if row["sentenceId"] in existing_sentences and existing_sentences[row["sentenceId"]] != expected:
            raise ImportError(f"sentence identity/content collision: {row['canonicalKey']}")
    translation_ids = [row["sentenceTranslationId"] for row in rows]
    cur.execute("select id::text,sentence_id::text,target_language_code,text,source_record_id::text from public.sentence_translations where id = any(%s::uuid[]) or sentence_id = any(%s::uuid[])", (translation_ids, sentence_ids))
    translations_by_sentence: dict[str, list[tuple[str, str, str, str]]] = defaultdict(list)
    for tid, sid, lang, text, srid in cur.fetchall():
        translations_by_sentence[str(sid)].append((str(tid), str(lang), str(text), str(srid)))
    for row in rows:
        found = translations_by_sentence.get(row["sentenceId"], [])
        expected = (row["sentenceTranslationId"], "vi", row["example"]["vi"], row["sourceRecordId"])
        if found and found != [expected]:
            raise ImportError(f"sentence translation collision: {row['canonicalKey']}")
    cur.execute("select sentence_id::text,concept_id::text,start_offset,end_offset,occurrence_role from public.sentence_concepts where sentence_id = any(%s::uuid[])", (sentence_ids,))
    annotations_by_sentence: dict[str, list[tuple[str, int, int, str]]] = defaultdict(list)
    for sid, cid, start, end, role in cur.fetchall():
        annotations_by_sentence[str(sid)].append((str(cid), int(start), int(end), str(role)))
    for row in rows:
        annotation = row["sentenceConcept"]
        expected = (row["conceptId"], annotation["startOffset"], annotation["endOffset"], annotation["occurrenceRole"])
        found = annotations_by_sentence.get(row["sentenceId"], [])
        if found and found != [expected]:
            raise ImportError(f"sentence concept annotation collision: {row['canonicalKey']}")
    cur.execute("select source_concept_id::text,target_concept_id::text,weight,source_record_id::text from public.concept_relations where relation_type='prerequisite' and source_concept_id = any(%s::uuid[])", (concept_ids,))
    existing_relations = {(str(source_id), str(target_id)): (None if weight is None else float(weight), str(srid)) for source_id, target_id, weight, srid in cur.fetchall()}
    expected_relations = {(r["sourceConceptId"], r["targetConceptId"]): (float(r["weight"]), r["sourceRecordId"]) for r in plan["relations"]}
    for identity, value in existing_relations.items():
        if identity not in expected_relations or value != expected_relations[identity]:
            raise ImportError(f"prerequisite relation collision: {identity[0]} -> {identity[1]}")


def _insert_source_records(cur: Any, plan: dict[str, Any]) -> None:
    source = plan["source"]
    for row in plan["rows"]:
        cur.execute("insert into public.source_records(id,source_id,source_record_key,raw_hash,transform_version,quality_score,review_status,reviewed_at,metadata) values (%s,%s,%s,%s,%s,1,%s,transaction_timestamp(),%s::jsonb) on conflict (source_id,source_record_key,raw_hash) do nothing", (row["sourceRecordId"], source["sourceId"], row["canonicalKey"], row["rawHash"], source["transformVersion"], source["applyReviewStatus"], json.dumps(_metadata_for(plan, row), ensure_ascii=False)))


def _assert_post_apply(cur: Any, plan: dict[str, Any]) -> None:
    rows = plan["rows"]
    concept_ids = [row["conceptId"] for row in rows]
    sentence_ids = [row["sentenceId"] for row in rows]
    cur.execute("select canonical_key,id::text,source_record_id::text from public.concepts where language_code='en' and id = any(%s::uuid[])", (concept_ids,))
    actual_concepts = {str(key): (str(cid), str(srid)) for key, cid, srid in cur.fetchall()}
    expected_concepts = {row["canonicalKey"]: (row["conceptId"], row["sourceRecordId"]) for row in rows}
    if actual_concepts != expected_concepts:
        raise ImportError("post-apply concept/provenance verification failed")
    cur.execute("select id::text,review_status,transform_version,reviewed_at from public.source_records where id = any(%s::uuid[])", ([row["sourceRecordId"] for row in rows],))
    source_records = list(cur.fetchall())
    if len(source_records) != 108 or any(str(status) != APPLY_REVIEW_STATUS or str(transform) != TRANSFORM_VERSION or reviewed_at is None for _, status, transform, reviewed_at in source_records):
        raise ImportError("post-apply approved catalog provenance verification failed")
    cur.execute("select concept_id::text,level_id::text,confidence,source_record_id::text from public.framework_mappings where concept_id = any(%s::uuid[])", (concept_ids,))
    actual_mappings = {(str(cid), str(level)): (float(confidence), str(srid)) for cid, level, confidence, srid in cur.fetchall()}
    expected_mappings = {(row["conceptId"], row["levelId"]): (1.0, row["sourceRecordId"]) for row in rows}
    if actual_mappings != expected_mappings:
        raise ImportError("post-apply framework mapping verification failed")
    lexical_rows = [row for row in rows if "lexemeId" in row]
    cur.execute("select id::text,lexeme_id::text,sense_order,definition,definition_language_code,source_record_id::text from public.word_senses where lexeme_id = any(%s::uuid[])", ([row["lexemeId"] for row in lexical_rows],))
    actual_senses = {str(lexeme_id): (str(sense_id), int(order), str(definition), str(language), str(srid)) for sense_id, lexeme_id, order, definition, language, srid in cur.fetchall()}
    expected_senses = {row["lexemeId"]: (row["senseId"], 1, row["vietnameseSupport"], "vi", row["sourceRecordId"]) for row in lexical_rows}
    if actual_senses != expected_senses:
        raise ImportError("post-apply lexical sense verification failed")
    form_rows = [row for row in lexical_rows if "lexemeForm" in row]
    if form_rows:
        cur.execute("select id::text,lexeme_id::text,form,normalized_form,form_type,source_record_id::text from public.lexeme_forms where id = any(%s::uuid[])", ([row["lexemeForm"]["id"] for row in form_rows],))
        actual_forms = {str(lexeme_id): (str(form_id), str(form), str(normalized), str(form_type), str(srid)) for form_id, lexeme_id, form, normalized, form_type, srid in cur.fetchall()}
        expected_forms = {row["lexemeId"]: (row["lexemeForm"]["id"], row["lexemeForm"]["form"], row["lexemeForm"]["normalizedForm"], row["lexemeForm"]["formType"], row["sourceRecordId"]) for row in form_rows}
        if actual_forms != expected_forms:
            raise ImportError("post-apply lexeme form verification failed")
    cur.execute("select id::text,text,normalized_text,source_record_id::text from public.sentences where id = any(%s::uuid[])", (sentence_ids,))
    actual_sentences = {str(sid): (str(text), str(normalized), str(srid)) for sid, text, normalized, srid in cur.fetchall()}
    expected_sentences = {row["sentenceId"]: (row["example"]["en"], row["sentenceNormalizedText"], row["sourceRecordId"]) for row in rows}
    if actual_sentences != expected_sentences:
        raise ImportError("post-apply sentence verification failed")
    cur.execute("select id::text,sentence_id::text,target_language_code,text,source_record_id::text from public.sentence_translations where sentence_id = any(%s::uuid[])", (sentence_ids,))
    actual_translations = {str(sid): (str(tid), str(lang), str(text), str(srid)) for tid, sid, lang, text, srid in cur.fetchall()}
    expected_translations = {row["sentenceId"]: (row["sentenceTranslationId"], "vi", row["example"]["vi"], row["sourceRecordId"]) for row in rows}
    if actual_translations != expected_translations:
        raise ImportError("post-apply sentence translation verification failed")
    cur.execute("select sentence_id::text,concept_id::text,start_offset,end_offset,occurrence_role from public.sentence_concepts where sentence_id = any(%s::uuid[])", (sentence_ids,))
    actual_annotations = {str(sid): (str(cid), int(start), int(end), str(role)) for sid, cid, start, end, role in cur.fetchall()}
    expected_annotations = {row["sentenceId"]: (row["conceptId"], row["sentenceConcept"]["startOffset"], row["sentenceConcept"]["endOffset"], row["sentenceConcept"]["occurrenceRole"]) for row in rows}
    if actual_annotations != expected_annotations:
        raise ImportError("post-apply sentence concept annotation verification failed")
    cur.execute("select source_concept_id::text,target_concept_id::text,weight,source_record_id::text from public.concept_relations where relation_type='prerequisite' and source_concept_id = any(%s::uuid[])", (concept_ids,))
    actual_relations = {(str(source_id), str(target_id)): (float(weight), str(srid)) for source_id, target_id, weight, srid in cur.fetchall()}
    expected_relations = {(relation["sourceConceptId"], relation["targetConceptId"]): (float(relation["weight"]), relation["sourceRecordId"]) for relation in plan["relations"]}
    if actual_relations != expected_relations:
        raise ImportError("post-apply prerequisite relation verification failed")


def apply_plan(plan: dict[str, Any], database_url: str) -> None:
    try:
        import psycopg  # type: ignore
    except builtins.ImportError as exc:
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
                        if "lexemeForm" in row:
                            form = row["lexemeForm"]
                            cur.execute("insert into public.lexeme_forms(id,lexeme_id,form,normalized_form,form_type,source_record_id) values (%s,%s,%s,%s,%s,%s) on conflict (lexeme_id,normalized_form,form_type) do nothing", (form["id"], row["lexemeId"], form["form"], form["normalizedForm"], form["formType"], row["sourceRecordId"]))
                    cur.execute("insert into public.sentences(id,language_code,text,normalized_text,quality_score,source_record_id) values (%s,'en',%s,%s,1,%s) on conflict (id) do nothing", (row["sentenceId"], row["example"]["en"], row["sentenceNormalizedText"], row["sourceRecordId"]))
                    cur.execute("insert into public.sentence_translations(id,sentence_id,target_language_code,text,source_record_id) values (%s,%s,'vi',%s,%s) on conflict (id) do nothing", (row["sentenceTranslationId"], row["sentenceId"], row["example"]["vi"], row["sourceRecordId"]))
                    annotation = row["sentenceConcept"]
                    cur.execute("insert into public.sentence_concepts(sentence_id,concept_id,language_code,start_offset,end_offset,occurrence_role) values (%s,%s,'en',%s,%s,%s) on conflict do nothing", (row["sentenceId"], row["conceptId"], annotation["startOffset"], annotation["endOffset"], annotation["occurrenceRole"]))
                for relation in plan["relations"]:
                    cur.execute("insert into public.concept_relations(source_concept_id,target_concept_id,language_code,relation_type,weight,source_record_id) values (%s,%s,'en','prerequisite',%s,%s) on conflict (source_concept_id,target_concept_id,relation_type) do nothing", (relation["sourceConceptId"], relation["targetConceptId"], relation["weight"], relation["sourceRecordId"]))
                _assert_post_apply(cur, plan)


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
