#!/usr/bin/env python3
"""Deterministic Knowledge System V2 Compiler & Validator for LINGUA OS.

Combines the locked V1 production starter (108 selected concepts from
first_party_starter_inventory.v1.json + first_party_content_support.v1.json
filtered by production_starter_manifest.v1.json) with the Knowledge System V2
Curriculum Expansion:
- Core Lexicon V2 (+200 A0-B1 lexical concepts)
- Polysemy & Sense Packs V2 (21 lexeme groups, 33 explicit sense-level concepts)
- Grammar Specifications V2 (32 structured grammar constructs across A0-B1 with structural slots)
- Phrase & Skill Specifications V2 (40 phrase templates with variable slots + 10 skills)
- Knowledge Graph Edges V2 (65 typed semantic/pedagogical edges, verified acyclic on DAG relations)
- Phonetic Transcriptions V2 (15 canonical phonetic profiles / 30 US+GB IPA transcriptions)
- Bilingual Content Pack V2 (12 graded EN-VI micro-articles / 96 aligned sentence pairs)
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
V2_DIR = ROOT / "v2"

FORBIDDEN_LEARNER_STATE_KEYS = {
    "userId",
    "learnerId",
    "masteryScore",
    "retentionScore",
    "nextReviewAt",
    "lastReviewedAt",
    "easeFactor",
    "repetitionCount",
    "intervalDays",
    "srsStage",
}

DAG_RELATIONS = {"prerequisite_of", "part_of", "derived_from"}


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical_json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def _assert_no_learner_state(obj: Any, path: str = "root") -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in FORBIDDEN_LEARNER_STATE_KEYS:
                raise ValueError(f"Forbidden learner-state field '{k}' found at {path}.{k}")
            _assert_no_learner_state(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            _assert_no_learner_state(item, f"{path}[{idx}]")


def _normalize_band(band: str) -> str:
    b = str(band).strip().upper()
    if b.startswith("LINGUA_"):
        return b
    return f"LINGUA_{b}"


def _verify_dag_acyclicity(
    edges: list[dict[str, Any]], valid_concept_keys: set[str]
) -> dict[str, Any]:
    adj: dict[str, list[str]] = defaultdict(list)
    nodes: set[str] = set()
    relation_counts: dict[str, int] = defaultdict(int)
    seen_triples: set[tuple[str, str, str]] = set()

    for edge in edges:
        src = edge.get("sourceCanonicalKey") or edge.get("sourceConceptKey")
        tgt = edge.get("targetCanonicalKey") or edge.get("targetConceptKey")
        rel = edge["relationType"]
        if not src or not tgt:
            raise ValueError(f"Edge missing source or target key: {edge}")
        if src == tgt:
            raise ValueError(f"Self-loop detected on {src} ({rel})")
        if src not in valid_concept_keys:
            raise ValueError(f"Edge source '{src}' not in canonical concept universe")
        if tgt not in valid_concept_keys:
            raise ValueError(f"Edge target '{tgt}' not in canonical concept universe")
        triple = (src, tgt, rel)
        if triple in seen_triples:
            raise ValueError(f"Duplicate edge triple detected: {triple}")
        seen_triples.add(triple)
        relation_counts[rel] += 1
        if rel in DAG_RELATIONS:
            adj[src].append(tgt)
            nodes.add(src)
            nodes.add(tgt)

    state: dict[str, int] = {n: 0 for n in nodes}  # 0=unvisited, 1=visiting, 2=visited

    def dfs(node: str) -> None:
        state[node] = 1
        for nxt in adj.get(node, []):
            if state.get(nxt, 0) == 1:
                raise ValueError(
                    f"Cycle detected in DAG relation subgraph involving '{node}' -> '{nxt}'"
                )
            if state.get(nxt, 0) == 0:
                dfs(nxt)
        state[node] = 2

    for n in sorted(nodes):
        if state[n] == 0:
            dfs(n)

    return {
        "totalEdges": len(edges),
        "dagNodesChecked": len(nodes),
        "isAcyclic": True,
        "relationCounts": dict(sorted(relation_counts.items())),
    }


def _load_v1_selected_concepts(base_dir: Path) -> list[dict[str, Any]]:
    inv_file = base_dir / "first_party_starter_inventory.v1.json"
    sup_file = base_dir / "first_party_content_support.v1.json"
    man_file = base_dir / "production_starter_manifest.v1.json"

    inv = json.loads(inv_file.read_text(encoding="utf-8"))
    sup = json.loads(sup_file.read_text(encoding="utf-8"))
    man = json.loads(man_file.read_text(encoding="utf-8"))
    quarantined = {q["canonicalKey"] for q in man.get("quarantine", [])}
    selected = []
    for item in inv["concepts"] + sup["concepts"]:
        if item["canonicalKey"] not in quarantined:
            selected.append(item)
    return selected


def compile_knowledge_v2(base_dir: Path = ROOT) -> dict[str, Any]:
    v1_selected = _load_v1_selected_concepts(base_dir)
    v2_lex_path = base_dir / "v2" / "core_lexicon_a0_b1.v2.json"
    v2_poly_path = base_dir / "v2" / "polysemy_sense_packs.v2.json"
    v2_gram_path = base_dir / "v2" / "grammar_specifications.v2.json"
    v2_phr_path = base_dir / "v2" / "phrase_and_skill_specifications.v2.json"
    v2_edge_path = base_dir / "v2" / "knowledge_graph_edges.v2.json"
    v2_phon_path = base_dir / "v2" / "phonetic_transcriptions.v2.json"
    v2_corp_path = (
        base_dir / "staging" / "pilot-reader-vi-pack-v1" / "bilingual_content_pack.v2.json"
    )

    v2_lexicon = json.loads(v2_lex_path.read_text(encoding="utf-8"))
    v2_polysemy = json.loads(v2_poly_path.read_text(encoding="utf-8"))
    v2_grammar = json.loads(v2_gram_path.read_text(encoding="utf-8"))
    v2_phrases = json.loads(v2_phr_path.read_text(encoding="utf-8"))
    v2_edges = json.loads(v2_edge_path.read_text(encoding="utf-8"))
    v2_phonetics = json.loads(v2_phon_path.read_text(encoding="utf-8"))
    v2_corpus = json.loads(v2_corp_path.read_text(encoding="utf-8"))

    for name, payload in [
        ("v2_lexicon", v2_lexicon),
        ("v2_polysemy", v2_polysemy),
        ("v2_grammar", v2_grammar),
        ("v2_phrases", v2_phrases),
        ("v2_edges", v2_edges),
        ("v2_phonetics", v2_phonetics),
        ("v2_corpus", v2_corpus),
    ]:
        _assert_no_learner_state(payload, name)

    concepts_by_key: dict[str, dict[str, Any]] = {}
    for c in v1_selected:
        ck = c["canonicalKey"]
        concepts_by_key[ck] = {
            **c,
            "canonicalKey": ck,
            "curriculumBand": _normalize_band(c.get("curriculumBand", "A1")),
        }

    for c in v2_lexicon["concepts"]:
        ck = c["canonicalKey"]
        if ck in concepts_by_key:
            raise ValueError(f"Duplicate V2 lexicon canonicalKey collided with V1: {ck}")
        concepts_by_key[ck] = {
            **c,
            "canonicalKey": ck,
            "curriculumBand": _normalize_band(c.get("curriculumBand", "A1")),
        }

    # Polysemy sense concepts
    sense_concepts: list[dict[str, Any]] = []
    for group in v2_polysemy["lexemeGroups"]:
        for sense in group["senses"]:
            sk = sense["conceptKey"]
            sense_concepts.append(sense)
            if sk not in concepts_by_key:
                concepts_by_key[sk] = {
                    "canonicalKey": sk,
                    "conceptType": "word",
                    "canonicalForm": group["lemma"],
                    "partOfSpeech": group["partOfSpeech"],
                    "curriculumBand": _normalize_band(sense.get("cefrLevel", "A2")),
                    "vietnameseGloss": sense["definitionVi"],
                    "vietnameseSupport": sense["definitionEn"],
                    "example": sense["example"],
                }

    # Grammar specifications V2 (32 specs: 8 upgraded V1 + 24 new V2)
    grammar_specs = v2_grammar["specifications"]
    for spec in grammar_specs:
        ck = spec["canonicalKey"]
        if ck not in concepts_by_key:
            concepts_by_key[ck] = {
                "canonicalKey": ck,
                "conceptType": "grammar",
                "canonicalForm": spec["patternFormula"],
                "curriculumBand": _normalize_band(spec.get("curriculumBand", "A1")),
                "vietnameseGloss": spec["vietnameseExplanation"],
                "vietnameseSupport": spec["pragmaticFunction"],
            }

    # Phrase & Skill specifications V2
    phrase_specs = v2_phrases["phrases"]
    for p in phrase_specs:
        ck = p["canonicalKey"]
        if ck not in concepts_by_key:
            concepts_by_key[ck] = {
                **p,
                "canonicalKey": ck,
                "curriculumBand": _normalize_band(p.get("curriculumBand", "A1")),
            }

    skill_specs = v2_phrases["skills"]
    for s in skill_specs:
        ck = s["canonicalKey"]
        if ck not in concepts_by_key:
            concepts_by_key[ck] = {
                **s,
                "canonicalKey": ck,
                "curriculumBand": _normalize_band(s.get("curriculumBand", "A1")),
            }

    # Validate DAG & endpoint closure on Knowledge Graph Edges V2
    dag_report = _verify_dag_acyclicity(v2_edges["edges"], set(concepts_by_key.keys()))

    # Validate Corpus V2 concept references
    articles = v2_corpus["articles"]
    total_sentences = 0
    for art in articles:
        sents = art["sentences"]
        total_sentences += len(sents)
        for sent in sents:
            for ck in sent.get("concepts", []):
                if ck not in concepts_by_key:
                    art_id = art["article_id"]
                    s_ord = sent["ordinal"]
                    raise ValueError(
                        f"Article '{art_id}' sentence {s_ord} references unknown concept '{ck}'"
                    )

    # Flatten phonetic rows
    phonetic_rows: list[dict[str, Any]] = []
    for entry in v2_phonetics["profiles"]:
        ck = entry["conceptCanonicalKey"]
        if ck not in concepts_by_key:
            raise ValueError(f"Phonetic entry '{ck}' not in canonical concept universe")
        for tr in entry["transcriptions"]:
            phonetic_rows.append(
                {
                    "conceptCanonicalKey": ck,
                    "lemma": entry["lemma"],
                    "accentVariant": tr["accentVariant"],
                    "ipa": tr["ipa"],
                    "primaryStressSyllable": entry["primaryStressSyllable"],
                    "vietnamesePhonologyTrap": entry["vietnamesePhonologyTrap"],
                    "vietnameseArticulationTip": entry["vietnameseArticulationTip"],
                }
            )

    # Counts by type and band
    type_counts: dict[str, int] = defaultdict(int)
    band_counts: dict[str, int] = defaultdict(int)
    for c in concepts_by_key.values():
        type_counts[c["conceptType"]] += 1
        band_counts[_normalize_band(c.get("curriculumBand", "A1"))] += 1

    compiled_v2 = {
        "schemaVersion": "2.0.0",
        "catalogReleaseId": "lingua-knowledge-catalog-a0-b1-v2.0.0",
        "compilerName": "lingua-knowledge-compiler-v2",
        "v1BaselineReleaseId": "lingua-starter-v1",
        "summary": {
            "totalCanonicalConcepts": len(concepts_by_key),
            "v1BaselineConcepts": len(v1_selected),
            "newV2LexicalConcepts": len(v2_lexicon["concepts"]),
            "polysemyLexemeGroups": len(v2_polysemy["lexemeGroups"]),
            "polysemySenseConcepts": len(sense_concepts),
            "grammarSpecifications": len(grammar_specs),
            "phraseSpecifications": len(phrase_specs),
            "skillSpecifications": len(skill_specs),
            "knowledgeGraphEdges": len(v2_edges["edges"]),
            "phoneticProfiles": len(v2_phonetics["profiles"]),
            "phoneticTranscriptions": len(phonetic_rows),
            "bilingualArticles": len(articles),
            "bilingualAlignedSentences": total_sentences,
            "countsByConceptType": dict(sorted(type_counts.items())),
            "countsByCefrBand": dict(sorted(band_counts.items())),
            "dagVerification": dag_report,
        },
        "concepts": [concepts_by_key[k] for k in sorted(concepts_by_key.keys())],
        "polysemyLexemeGroups": v2_polysemy["lexemeGroups"],
        "grammarSpecifications": grammar_specs,
        "phraseSpecifications": phrase_specs,
        "skillSpecifications": skill_specs,
        "knowledgeGraphEdges": v2_edges["edges"],
        "phoneticTranscriptions": phonetic_rows,
        "bilingualArticles": articles,
    }

    compiled_v2["artifactSha256"] = _sha256_bytes(_canonical_json_bytes(compiled_v2["summary"]))
    return compiled_v2


def main() -> None:
    compiled = compile_knowledge_v2(ROOT)
    out_path = V2_DIR / "compiled_catalog_candidate.v2.json"
    out_path.write_text(json.dumps(compiled, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    c_count = compiled["summary"]["totalCanonicalConcepts"]
    g_count = compiled["summary"]["grammarSpecifications"]
    p_count = compiled["summary"]["phraseSpecifications"]
    e_count = compiled["summary"]["knowledgeGraphEdges"]
    a_count = compiled["summary"]["bilingualArticles"]
    print(
        f"[build_knowledge_v2] Compiled {c_count} canonical concepts "
        f"({g_count} grammar specs, {p_count} phrase specs, "
        f"{e_count} KG edges, {a_count} articles) -> {out_path.name}"
    )


if __name__ == "__main__":
    main()
