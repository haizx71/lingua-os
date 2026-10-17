#!/usr/bin/env python3
"""Transactional Catalog Import & Dry-Run Apply Plan Builder for Knowledge System V2.

Builds a deterministic, transactional apply plan and generates idempotent SQL covering
only real PostgreSQL tables from migrations 0001, 0014, 0015, and 0016.
Zero phantom tables or learner-state mutations are emitted.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any

try:
    from knowledge.build_knowledge_v2 import ROOT, V2_DIR, compile_knowledge_v2
except ModuleNotFoundError:
    from build_knowledge_v2 import (  # type: ignore[import-not-found,no-redef]
        ROOT,
        V2_DIR,
        compile_knowledge_v2,
    )

__all__ = [
    "ALLOWED_CATALOG_TABLES",
    "PHANTOM_TABLES",
    "ROOT",
    "build_v2_apply_plan",
    "generate_sql",
    "stable_id",
]

NS = uuid.UUID("4b47b8d6-0d44-4dc7-91c2-3d97f56e6040")

LEVEL_IDS = {
    "LINGUA_A0": "00000000-0000-4000-8100-000000000000",
    "LINGUA_A1": "00000000-0000-4000-8100-000000000001",
    "LINGUA_A2": "00000000-0000-4000-8100-000000000002",
    "LINGUA_B1": "00000000-0000-4000-8100-000000000003",
}

# Only real tables present in PostgreSQL migrations 0001, 0014, 0015, 0016
ALLOWED_CATALOG_TABLES = (
    "licenses",
    "data_sources",
    "source_records",
    "concepts",
    "lexemes",
    "lexeme_forms",
    "word_senses",
    "concept_senses",
    "framework_mappings",
    "grammar_specifications",
    "phrase_specifications",
    "phonetic_transcriptions",
    "concept_edges",
)

# Phantom tables that must NEVER be referenced or emitted in SQL
PHANTOM_TABLES = (
    "grammar_structural_slots",
    "phrase_variable_slots",
    "skill_specifications",
    "reader_articles",
    "reader_article_sentences",
    "catalog_import_runs",
)

# Mapping from archive / external relation types to valid Migration 0016 concept_edges.relation_type
RELATION_TYPE_MAP = {
    "PREREQUISITE": "prerequisite_of",
    "prerequisite": "prerequisite_of",
    "prerequisite_of": "prerequisite_of",
    "CONFUSABLE_WITH": "confusable_with",
    "confusable_with": "confusable_with",
    "confusable": "confusable_with",
    "CONTRASTS_WITH": "antonym_of",
    "contrasts_with": "antonym_of",
    "antonym": "antonym_of",
    "antonym_of": "antonym_of",
    "NEAR_SYNONYM": "synonym_of",
    "synonym": "synonym_of",
    "synonym_of": "synonym_of",
    "BELONGS_TO_SKILL": "part_of",
    "part_of": "part_of",
    "SUPPORTS_GRAMMAR": "grammar_pattern_of",
    "grammar_pattern_of": "grammar_pattern_of",
    "COMMONLY_COLLOCATES": "collocates_with",
    "collocates_with": "collocates_with",
    "PHRASE_CONTAINS": "part_of",
    "TOPICALLY_RELATED": "collocates_with",
    "VARIANT_OF": "derived_from",
    "derived_from": "derived_from",
    "inflection_of": "inflection_of",
    "hypernym_of": "hypernym_of",
    "hyponym_of": "hyponym_of",
    "related": "collocates_with",
    "next_recommended": "prerequisite_of",
}


def stable_id(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f"{kind}:{key}"))


def sql_quote(val: Any) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).replace("'", "''")
    return f"'{s}'"


def normalize_relation_type(raw_rel: str) -> str:
    mapped = RELATION_TYPE_MAP.get(raw_rel)
    if not mapped:
        mapped = RELATION_TYPE_MAP.get(raw_rel.upper(), "prerequisite_of")
    return mapped


def build_v2_apply_plan(base_dir: Path = ROOT) -> dict[str, Any]:
    compiled = compile_knowledge_v2(base_dir)

    words = [c for c in compiled["concepts"] if c["conceptType"] in ("word", "phrase")]
    total_word_senses = len(words)

    table_operations = [
        {
            "stepOrder": 1,
            "tableName": "concepts",
            "strategy": "upsert_by_canonical_key",
            "conflictTarget": ["language_code", "concept_type", "canonical_key"],
            "rowCount": len(compiled["concepts"]),
        },
        {
            "stepOrder": 2,
            "tableName": "framework_mappings",
            "strategy": "upsert_by_concept_and_level",
            "conflictTarget": ["concept_id", "level_id"],
            "rowCount": len(compiled["concepts"]),
        },
        {
            "stepOrder": 3,
            "tableName": "lexemes",
            "strategy": "upsert_by_lemma_pos",
            "conflictTarget": ["language_code", "normalized_form", "part_of_speech"],
            "rowCount": len(words),
        },
        {
            "stepOrder": 4,
            "tableName": "word_senses",
            "strategy": "upsert_by_lexeme_and_sense_order",
            "conflictTarget": ["lexeme_id", "sense_order"],
            "rowCount": total_word_senses,
        },
        {
            "stepOrder": 5,
            "tableName": "concept_senses",
            "strategy": "upsert_by_concept_and_word_sense",
            "conflictTarget": ["concept_id", "word_sense_id"],
            "rowCount": total_word_senses,
        },
        {
            "stepOrder": 6,
            "tableName": "grammar_specifications",
            "strategy": "upsert_by_concept_id",
            "conflictTarget": ["concept_id"],
            "rowCount": len(compiled["grammarSpecifications"]),
        },
        {
            "stepOrder": 7,
            "tableName": "phrase_specifications",
            "strategy": "upsert_by_concept_id",
            "conflictTarget": ["concept_id"],
            "rowCount": len(compiled["phraseSpecifications"]),
        },
        {
            "stepOrder": 8,
            "tableName": "phonetic_transcriptions",
            "strategy": "upsert_by_lexeme_and_accent",
            "conflictTarget": ["lexeme_id", "accent_variant"],
            "rowCount": len(compiled["phoneticTranscriptions"]),
        },
        {
            "stepOrder": 9,
            "tableName": "concept_edges",
            "strategy": "upsert_by_directed_edge_triple",
            "conflictTarget": ["source_concept_id", "target_concept_id", "relation_type"],
            "rowCount": len(compiled["knowledgeGraphEdges"]),
        },
    ]

    # Verify strictly allowed tables and zero phantom tables
    for op in table_operations:
        t_name = op["tableName"]
        if t_name not in ALLOWED_CATALOG_TABLES:
            raise ValueError(f"Table '{t_name}' is not in ALLOWED_CATALOG_TABLES")
        if t_name in PHANTOM_TABLES:
            raise ValueError(f"Phantom table '{t_name}' found in apply plan")

    total_rows = sum(int(str(op["rowCount"])) for op in table_operations)
    plan_payload = {
        "schemaVersion": "2.0.0",
        "catalogReleaseId": compiled["catalogReleaseId"],
        "artifactSha256": compiled["artifactSha256"],
        "transactional": True,
        "isolatedFromLearnerState": True,
        "forbiddenTablesTouched": [],
        "totalUpsertRows": total_rows,
        "tableOperations": table_operations,
    }
    plan_bytes = json.dumps(plan_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    plan_payload["planDigestSha256"] = hashlib.sha256(plan_bytes).hexdigest()
    return plan_payload


def generate_sql(base_dir: Path = ROOT) -> str:
    """Generate transactional, idempotent SQL referencing ONLY real migration tables."""
    compiled = compile_knowledge_v2(base_dir)

    lines: list[str] = [
        "-- LINGUA OS Knowledge System V2 Transactional Apply Script",
        f"-- Catalog Release: {compiled['catalogReleaseId']}",
        f"-- Total Canonical Concepts: {len(compiled['concepts'])} (Strictly A0-B1)",
        "-- Target Migrations: 0001_core_schema_v1, 0014_canonical_structures, "
        "0015_polysemy, 0016_graph_dag",
        "",
        "BEGIN;",
        "SET LOCAL client_min_messages = warning;",
        "",
    ]

    # 0. Provenance: Licenses, Data Sources, Source Records
    fixed_ts = "2026-10-15T00:00:00Z"
    lic_id = "10000000-0000-4000-8000-000000000001"
    src_id = stable_id("data_source", "lingua:catalog:v2")
    lines.append("-- 0. Provenance (public.licenses, public.data_sources, public.source_records)")
    lines.extend(
        [
            (
                "INSERT INTO public.licenses "
                "(id, code, name, usage_policy, attribution_required, created_at)"
            ),
            (
                f"VALUES ('{lic_id}', 'LINGUA-FIRST-PARTY', "
                f"'LINGUA OS First-Party Content', 'allowed', false, '{fixed_ts}')"
            ),
            "ON CONFLICT (id) DO NOTHING;",
            "",
            (
                "INSERT INTO public.data_sources "
                "(id, name, source_type, source_version, source_url, "
                "license_id, attribution_text, created_at)"
            ),
            (
                f"VALUES ('{src_id}', 'LINGUA Knowledge System V2 (A0-B1)', "
                f"'internal', 'v2.0.0', 'https://lingua-os.internal/sources/catalog-v2', "
                f"'{lic_id}', 'LINGUA OS First-Party Catalog V2.', '{fixed_ts}')"
            ),
            "ON CONFLICT (id) DO NOTHING;",
            "",
        ]
    )
    for c in compiled["concepts"]:
        ck = c["canonicalKey"]
        srid = stable_id("source_record", ck)
        raw_hash = hashlib.sha256(ck.encode("utf-8")).hexdigest()
        meta = json.dumps({"canonical_key": ck})
        lines.append(
            f"INSERT INTO public.source_records "
            f"(id, source_id, source_record_key, raw_hash, transform_version, "
            f"quality_score, review_status, imported_at, reviewed_at, metadata) "
            f"VALUES ('{srid}', '{src_id}', {sql_quote(ck)}, '{raw_hash}', "
            f"'catalog-v2', 1.0, 'approved', '{fixed_ts}', '{fixed_ts}', "
            f"{sql_quote(meta)}::jsonb) "
            f"ON CONFLICT (id) DO NOTHING;"
        )
    lines.append("")

    # 1. concepts
    lines.append("-- 1. Concepts (public.concepts)")
    for c in compiled["concepts"]:
        ck = c["canonicalKey"]
        cid = stable_id("concept", ck)
        srid = stable_id("source_record", ck)
        ctype = c["conceptType"]
        lines.append(
            f"INSERT INTO public.concepts "
            f"(id, language_code, concept_type, canonical_key, source_record_id) "
            f"VALUES ('{cid}', 'en', {sql_quote(ctype)}, {sql_quote(ck)}, '{srid}') "
            f"ON CONFLICT (language_code, concept_type, canonical_key) DO UPDATE "
            f"SET updated_at = clock_timestamp();"
        )
    lines.append("")

    # 2. framework_mappings
    lines.append("-- 2. Framework Mappings (public.framework_mappings)")
    for c in compiled["concepts"]:
        ck = c["canonicalKey"]
        srid = stable_id("source_record", ck)
        band = c.get("curriculumBand", "LINGUA_A1")
        level_id = LEVEL_IDS.get(band, LEVEL_IDS["LINGUA_A1"])
        lines.append(
            f"INSERT INTO public.framework_mappings "
            f"(concept_id, level_id, confidence, source_record_id) "
            f"SELECT c.id, '{level_id}', 1.0, '{srid}' "
            f"FROM public.concepts c "
            f"WHERE c.language_code = 'en' AND c.canonical_key = {sql_quote(ck)} "
            f"ON CONFLICT (concept_id, level_id) DO NOTHING;"
        )
    lines.append("")

    # 3. lexemes
    lines.append("-- 3. Lexemes (public.lexemes)")
    for c in sorted(
        compiled["concepts"],
        key=lambda x: 0 if x.get("canonicalKey") == "word:issue:noun:problem" else 1,
    ):
        if c["conceptType"] not in ("word", "phrase"):
            continue
        ck = c["canonicalKey"]
        lid = stable_id("lexeme", ck)
        srid = stable_id("source_record", ck)
        lemma = c["canonicalForm"]
        norm = " ".join(lemma.casefold().strip().split())
        pos = c.get("partOfSpeech") or "phrase"
        lines.append(
            f"INSERT INTO public.lexemes "
            f"(id, concept_id, language_code, lemma, normalized_form, part_of_speech, "
            f"source_record_id) "
            f"SELECT '{lid}', c.id, 'en', {sql_quote(lemma)}, {sql_quote(norm)}, "
            f"{sql_quote(pos)}, '{srid}' "
            f"FROM public.concepts c "
            f"WHERE c.language_code = 'en' AND c.canonical_key = {sql_quote(ck)} "
            f"ON CONFLICT (language_code, normalized_form, part_of_speech) DO NOTHING;"
        )
    lines.append("")

    # 4. word_senses & 5. concept_senses
    lines.append("-- 4. Word Senses & Concept Senses (public.word_senses, public.concept_senses)")
    polysemy_senses = {
        sense["conceptKey"]: sense
        for grp in compiled["polysemyLexemeGroups"]
        for sense in grp.get("senses", [])
    }

    for c in compiled["concepts"]:
        if c["conceptType"] not in ("word", "phrase"):
            continue
        ck = c["canonicalKey"]
        wsid = stable_id("sense", ck)
        srid = stable_id("source_record", ck)
        lemma = c["canonicalForm"]
        norm = " ".join(lemma.casefold().strip().split())
        pos = c.get("partOfSpeech") or "phrase"

        if ck in polysemy_senses:
            p_sense = polysemy_senses[ck]
            defn = p_sense.get("definitionEn", "")
            vi = p_sense.get("definitionVi", "")
            s_order = p_sense.get("senseOrder", 1)
            is_prim = s_order == 1
        else:
            defn = c.get("vietnameseGloss") or c.get("vietnameseSupport") or c["canonicalForm"]
            vi = c.get("vietnameseGloss") or defn
            s_order = 1
            is_prim = True

        lines.append(
            f"INSERT INTO public.word_senses "
            f"(id, lexeme_id, sense_order, definition, definition_language_code, "
            f"translated_definition, translation_language_code, source_record_id) "
            f"SELECT '{wsid}', l.id, {s_order}, {sql_quote(defn)}, 'vi', "
            f"{sql_quote(vi)}, 'vi', '{srid}' "
            f"FROM public.lexemes l "
            f"WHERE l.language_code = 'en' AND l.normalized_form = {sql_quote(norm)} "
            f"AND l.part_of_speech = {sql_quote(pos)} "
            f"ON CONFLICT (lexeme_id, sense_order) DO UPDATE SET "
            f"definition = EXCLUDED.definition, "
            f"translated_definition = EXCLUDED.translated_definition;"
        )
        lines.append(
            f"INSERT INTO public.concept_senses (concept_id, word_sense_id, is_primary) "
            f"SELECT c.id, ws.id, {sql_quote(is_prim)} "
            f"FROM public.concepts c "
            f"JOIN public.lexemes l ON l.language_code = 'en' "
            f"AND l.normalized_form = {sql_quote(norm)} "
            f"AND l.part_of_speech = {sql_quote(pos)} "
            f"JOIN public.word_senses ws ON ws.lexeme_id = l.id AND ws.sense_order = {s_order} "
            f"WHERE c.language_code = 'en' AND c.canonical_key = {sql_quote(ck)} "
            f"ON CONFLICT (concept_id, word_sense_id) "
            f"DO UPDATE SET is_primary = EXCLUDED.is_primary;"
        )
    lines.append("")

    # 6. grammar_specifications (0014)
    lines.append("-- 6. Grammar Specifications (public.grammar_specifications)")
    for spec in compiled["grammarSpecifications"]:
        ck = spec["canonicalKey"]
        gid = stable_id("grammar_spec", ck)
        formula = spec["patternFormula"]
        cat = spec.get("syntacticCategory", "syntax")
        func = spec["pragmaticFunction"]
        exp_vi = spec["vietnameseExplanation"]
        traps_raw = spec.get("vietnameseCommonTraps")
        if isinstance(traps_raw, list):
            traps_vi = "; ".join(str(x) for x in traps_raw)
        elif traps_raw is not None:
            traps_vi = str(traps_raw)
        else:
            traps_vi = None
        slots = json.dumps(spec.get("structuralSlots", []), ensure_ascii=False)
        lines.append(
            f"INSERT INTO public.grammar_specifications "
            f"(id, concept_id, pattern_formula, syntactic_category, pragmatic_function, "
            f"vietnamese_explanation, vietnamese_common_traps, structural_slots) "
            f"SELECT '{gid}', c.id, {sql_quote(formula)}, {sql_quote(cat)}, "
            f"{sql_quote(func)}, {sql_quote(exp_vi)}, {sql_quote(traps_vi)}, "
            f"{sql_quote(slots)}::jsonb "
            f"FROM public.concepts c "
            f"WHERE c.language_code = 'en' AND c.canonical_key = {sql_quote(ck)} "
            f"ON CONFLICT (concept_id) DO UPDATE SET "
            f"pattern_formula = EXCLUDED.pattern_formula, "
            f"syntactic_category = EXCLUDED.syntactic_category, "
            f"pragmatic_function = EXCLUDED.pragmatic_function, "
            f"vietnamese_explanation = EXCLUDED.vietnamese_explanation, "
            f"vietnamese_common_traps = EXCLUDED.vietnamese_common_traps, "
            f"structural_slots = EXCLUDED.structural_slots;"
        )
    lines.append("")

    # 7. phrase_specifications (0014)
    lines.append("-- 7. Phrase Specifications (public.phrase_specifications)")
    for p in compiled["phraseSpecifications"]:
        ck = p["canonicalKey"]
        pid = stable_id("phrase_spec", ck)
        pattern = p["basePattern"]
        head_key = p.get("headwordCanonicalKey") or p.get("headwordConceptKey")
        head_id_expr = (
            f"(SELECT id FROM public.concepts "
            f"WHERE language_code = 'en' AND canonical_key = {sql_quote(head_key)})"
            if head_key
            else "NULL"
        )
        slots = json.dumps(p.get("slotTemplate", []), ensure_ascii=False)
        lines.append(
            f"INSERT INTO public.phrase_specifications "
            f"(id, concept_id, base_pattern, headword_concept_id, slot_template) "
            f"SELECT '{pid}', c.id, {sql_quote(pattern)}, {head_id_expr}, "
            f"{sql_quote(slots)}::jsonb "
            f"FROM public.concepts c "
            f"WHERE c.language_code = 'en' AND c.canonical_key = {sql_quote(ck)} "
            f"ON CONFLICT (concept_id) DO UPDATE SET "
            f"base_pattern = EXCLUDED.base_pattern, "
            f"headword_concept_id = EXCLUDED.headword_concept_id, "
            f"slot_template = EXCLUDED.slot_template;"
        )
    lines.append("")

    # 8. phonetic_transcriptions (0014)
    lines.append("-- 8. Phonetic Transcriptions (public.phonetic_transcriptions)")
    for tr in compiled["phoneticTranscriptions"]:
        ck = tr["conceptCanonicalKey"]
        accent = tr["accentVariant"].replace("-", "_")
        accent_dash = tr["accentVariant"].replace("_", "-")
        concept_id = stable_id("concept", ck)
        ptid = stable_id("phonetic", f"{ck}:{accent}")
        ipa = tr["ipa"]
        audio_uri = (
            tr.get("audioUri")
            or f"https://audio.lingua-os.internal/audio/v2/lexemes/{concept_id}/{accent_dash}.mp3"
        )
        duration_ms = int(tr.get("durationMs") or 1200)
        lines.append(
            f"INSERT INTO public.phonetic_transcriptions "
            f"(id, lexeme_id, accent_variant, ipa, audio_uri, duration_ms, audio_source) "
            f"SELECT '{ptid}', l.id, {sql_quote(accent)}, {sql_quote(ipa)}, "
            f"{sql_quote(audio_uri)}, {duration_ms}, 'high_quality_neural_tts' "
            f"FROM public.lexemes l "
            f"JOIN public.concepts c ON c.id = l.concept_id "
            f"WHERE c.language_code = 'en' AND c.canonical_key = {sql_quote(ck)} "
            f"ON CONFLICT (lexeme_id, accent_variant) DO UPDATE SET "
            f"ipa = EXCLUDED.ipa, audio_uri = EXCLUDED.audio_uri, "
            f"duration_ms = EXCLUDED.duration_ms;"
        )
    lines.append("")

    # 9. concept_edges (0016)
    lines.append("-- 9. Concept Edges (public.concept_edges)")
    for edge in compiled["knowledgeGraphEdges"]:
        src_k = edge.get("sourceCanonicalKey") or edge.get("sourceConceptKey")
        tgt_k = edge.get("targetCanonicalKey") or edge.get("targetConceptKey")
        rel = normalize_relation_type(edge["relationType"])
        weight = float(edge.get("weight", 1.0))
        eid = stable_id("edge", f"{src_k}:{tgt_k}:{rel}")
        meta = json.dumps(edge.get("metadata", {}), ensure_ascii=False)
        lines.append(
            f"INSERT INTO public.concept_edges "
            f"(id, source_concept_id, target_concept_id, relation_type, weight, metadata) "
            f"SELECT '{eid}', src.id, tgt.id, {sql_quote(rel)}, {weight}, "
            f"{sql_quote(meta)}::jsonb "
            f"FROM public.concepts src, public.concepts tgt "
            f"WHERE src.language_code = 'en' AND src.canonical_key = {sql_quote(src_k)} "
            f"  AND tgt.language_code = 'en' AND tgt.canonical_key = {sql_quote(tgt_k)} "
            f"ON CONFLICT (source_concept_id, target_concept_id, relation_type) "
            f"DO UPDATE SET weight = EXCLUDED.weight, metadata = EXCLUDED.metadata;"
        )
    lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    plan = build_v2_apply_plan(ROOT)
    out_path = V2_DIR / "catalog_apply_plan.v2.json"
    out_path.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    ops_len = len(plan["tableOperations"])
    print(
        f"[catalog_import_v2] Generated transactional V2 apply plan with "
        f"{plan['totalUpsertRows']} total upsert rows across {ops_len} tables -> {out_path.name}"
    )

    sql = generate_sql(ROOT)
    sql_path = V2_DIR / "catalog_apply_plan.v2.sql"
    sql_path.write_text(sql, encoding="utf-8")
    lines_len = len(sql.splitlines())
    print(f"[catalog_import_v2] Emitted {lines_len} lines of idempotent SQL -> {sql_path.name}")


if __name__ == "__main__":
    main()
