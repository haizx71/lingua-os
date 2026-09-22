# LINGUA OS — Knowledge Repository Review Follow-up — 2026-09-16

Purpose: record additional implementation patterns found after the first repository review. This document is design intelligence only and authorizes no migration/runtime change.

## 1. `hieuhoang018/ai-agentic-english`

This 2026 project is especially relevant because it independently built a language-material pipeline from CEFR-J vocabulary, CEFR-J grammar, WordNet, pronunciation data and generated exercises.

### Useful pattern: primitive data before generated activities

Its content roadmap separates reference primitives from generated learner activities:

`open/reference data -> offline ETL -> reviewed seed artifact -> idempotent loader -> generated activities`

This matches LINGUA OS's preferred boundary better than runtime generation. We should adopt the principle that curriculum primitives are versioned/reviewed first, while exercises/content are derived later and remain auditable.

### Useful pattern: licence allow-list

The project explicitly keeps share-alike data behind an opt-in gate rather than silently mixing it into the default shipped set. LINGUA OS should keep an even stricter rule: `CANDIDATE_QUARANTINE` data never enters production until the exact attribution/redistribution/share-alike strategy is approved.

### Useful pattern: grammar ETL keeps abstract points without inventing examples

Their CEFR-J Grammar Profile processing found that many rows are instantiated sentence-pattern forms while others are abstract constructs without examples. The project keeps valid abstract constructs but does not fabricate source examples for them.

LINGUA OS should adopt that behavior. A grammar concept may exist without a fake lexical sense or fake externally sourced sentence. Learner-facing explanation/example content can be first-party and separately reviewed.

### Important anti-pattern for LINGUA: “first WordNet synset wins”

The inspected vocabulary ETL constrains WordNet by POS but then accepts the first returned synset for a headword. That is convenient for a seed, but not sufficiently safe for our learner-facing concept identity because:

- WordNet sense ordering is not our curriculum intent;
- the first synset may not match the CEFR-J teaching sense;
- CEFR-J vocabulary levels are lemma/POS evidence, not sense IDs;
- one wrong sense contaminates definition, examples and synonyms together.

**Decision:** in LINGUA OS, WordNet lookup may generate candidates, but final sense selection must be explicit/reviewed. `first_synset()`-style production behavior is rejected.

### Useful generation lesson

The same project reports that asking an LLM to invent entire module/lesson hierarchies in one pass produced incoherent combinations. It improved quality by grounding each generation unit to one source primitive and making grouping deterministic code.

If LINGUA later uses AI-assisted content authoring, adopt this:

- generate from a bounded concept/grammar/content primitive;
- persist source IDs in the draft artifact;
- let deterministic code decide grouping/identity;
- human-review before publication;
- never let generation create learner evidence.

## 2. `webpot-ru/luna` English Core 3000 work

The reviewed source plan uses a reproducible staged pipeline rather than a one-shot “download list and import” approach. Its artifacts include raw source snapshots, normalized files, source manifests, candidate pools, checks and row-level review artifacts.

### Pattern to adopt

Use small batches:

`source snapshot -> normalized candidates -> bounded selection -> row review -> final generation/import`

This is preferable to importing thousands of entries simply because a source is available. It also fits our 16-archetype strategy: the catalog should expand because real content exposes concrete gaps.

### Source manifest lesson

The project records exact source artifact names and validates snapshots. LINGUA OS now formalizes the same idea in `KNOWLEDGE_SOURCE_SNAPSHOT_POLICY_V1.md` with a stronger distinction between third-party observed checksums and independently LINGUA-verified checksums.

### Oxford/benchmark lesson

A commercially useful-looking list is not automatically a production data source. Benchmark/reference-only use should stay separate from importable data. This supports keeping protected resources such as English Profile/Oxford-style lists in `REFERENCE_ONLY` unless an explicit redistribution licence is established.

## 3. `Tachiguro/KnownFirst`

The 2026 structured-vocabulary/sense-learning design is useful because it explicitly separates surface form, canonical lemma, lexeme, POS, sense, translation and source entry; it also treats multiword expressions as indivisible learning units and requires import preview before persistence.

### Patterns to adopt now

- preserve raw source form alongside normalized identity;
- treat POS markers as metadata, not tokens to learn;
- preserve multiword expressions rather than blindly tokenizing them;
- preview structured imports before DB persistence;
- retain source edition/record/context metadata;
- keep CEFR/curriculum metadata separate from personal learning state;
- require low-confidence mappings to remain reviewable rather than silently accepted.

### Architecture not to copy now

KnownFirst's decided direction moves SRS learning cards toward **sense-level** identity. That is reasonable for its domain but conflicts with LINGUA OS's accepted MVP invariant of one learner × concept = one Memory/FSRS lineage and with the current lemma/POS-oriented concept limitations.

**Decision:** do not introduce sense-level FSRS or a second learner-status hierarchy in this Knowledge task. Keep word/phrase concepts as bounded pedagogical units with a small reviewed sense bundle. Record the limitation and revisit only through a separate domain decision after self-use proves the need.

### Why this matters

External lexical datasets naturally tempt us toward increasingly precise linguistic identity. Precision is useful only if it does not fracture the learner model into incompatible state systems. Catalog richness and learner-state granularity are different decisions.

## Consolidated importer design decisions

After reviewing these projects, Knowledge V1 should use this bounded shape:

1. **Snapshot external source** with URL/release/hash/rights evidence.
2. **Parse source-specific structure**; never use one generic parser for all sources.
3. **Normalize to candidate records** preserving raw evidence.
4. **Generate enrichment candidates** (WordNet/PanLex/etc.) without accepting them automatically.
5. **Require human review** for sense, Vietnamese support, level conflicts, relations and rights.
6. **Preview deterministic DB diff** before any write.
7. **Apply transactionally/idempotently** to catalog tables only.
8. **Run post-apply invariants** proving zero learner-state writes.

## Rejected shortcuts

The following shortcuts are now explicitly rejected for first production import:

- first dictionary/WordNet sense wins;
- repo licence = embedded data licence;
- CEFR label = official Council of Europe word certification;
- high frequency = learner mastery or automatic priority;
- split every string on `/` and treat fragments as separate words;
- tokenize every multiword expression into component learning concepts;
- generate examples and silently label them as source examples;
- bulk-import an entire lexical graph;
- import directly from source CSV/XLSX into product tables;
- allow catalog import to create Save/Learn, FSRS, competence, exposure or Today state.

These rejections are intentionally conservative because errors in catalog identity/provenance become durable once learner history starts attaching to a concept.
