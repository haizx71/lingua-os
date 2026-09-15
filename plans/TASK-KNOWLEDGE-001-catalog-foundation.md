# TASK-KNOWLEDGE-001 — Curated Catalog Foundation

Status: RESEARCH / NOT APPROVED FOR MERGE  
Owner candidate: CODEX/Sol High for implementation; independent review required  
Branch for research: `chatgpt/knowledge-system-v1-2026-09-15`

## Objective

Create the first production-grade English-for-Vietnamese A0–B1 catalog slice using the existing LINGUA OS schema and learning invariants, without modifying learner-state behavior and without conflicting with ongoing Auth/UI/system-hardening work.

This task is deliberately split into evidence/research, dry-run import and production import. No cloud/database write is allowed until the first two phases are independently reviewed.

## Locked invariants

- Exposure is not Learn intent.
- Explicit `PUT /v1/library/concepts/{conceptId}` remains the sole memory activation boundary.
- One learner × concept = one primary FSRS lineage.
- FSRS memory is distinct from recognition/listening/production competence.
- Brain remains a projection/read surface.
- Catalog ingestion must never write learner state, review, FSRS, competence, Today plans or learning/exposure events.
- PostgreSQL remains source of truth.
- Existing published content/provenance gates are not weakened.
- No service-role key or secret may reach the browser.

## Phase 0 — research freeze

Artifacts:

- `docs/KNOWLEDGE_SYSTEM_V1.md`
- `docs/KNOWLEDGE_SOURCE_RESEARCH_20260916.md`
- `knowledge/source_registry.v1.json`

Acceptance:

- source rights/use decision recorded;
- schema/runtime gaps explicitly listed instead of hacked around;
- primary/research/quarantine/rejected sources separated;
- no runtime, contract, migration, cloud or shared-status file changed.

## Phase 1 — exact inventory and importer design

Read current master after other active sessions integrate. Rebase/cherry-pick research only if necessary; do not overwrite their work.

Inventory:

- exact current schema and migrations;
- exact catalog/Dictionary/Brain/Admin queries;
- content publication gate;
- current staging catalog counts;
- current concept IDs/anchors needed by acceptance tests;
- source privilege/RLS state after system-hardening work.

Design a deterministic importer with two modes:

1. `preview`: parse/normalize/validate and print a machine-readable diff; no DB writes.
2. `apply`: transactional idempotent insert/update only for explicitly approved catalog records.

Importer requirements:

- pinned source version/checksum;
- source licence + attribution registration;
- raw source record identity/hash;
- transform version;
- deterministic canonical key generation;
- strict duplicate/homograph detection;
- one primary proficiency mapping per concept;
- no destructive merge;
- fail closed on unknown/ambiguous source rights;
- fail closed on missing Vietnamese explanation for the reviewed starter pack;
- fail closed on invalid UTF-16 sentence spans;
- fail closed on prerequisite cycles;
- rollback whole pack on any write failure;
- repeat apply is a no-op/replay, not duplicate data.

## Phase 2 — Starter Catalog Pack

Do not start with a dictionary dump. Build a human-reviewable slice sufficient to author and publish the first real Reader content.

Target starter size is an implementation hypothesis, not a contract:

- roughly 250–400 high-value lexical/phrase concepts concentrated in A0/A1;
- a smaller reviewed A2/B1 bridge set required by the first content pack;
- approximately 25–50 grammar concepts;
- a small set of communicative/function skills only where they are used by real content;
- original example sentences with Vietnamese translations;
- useful irregular/lookup forms;
- sparse, defensible prerequisite edges.

The exact counts must be determined from the first 16 micro-articles and missing-concept report, not filled to hit a vanity number.

### Lexical selection

For each candidate lemma/POS:

1. CEFR-J 1.6 supplies level prior.
2. NGSL may supply usefulness/frequency evidence once exact list rights are captured.
3. Open English WordNet supplies candidate senses/definitions/relations.
4. PanLex supplies Vietnamese equivalence candidates.
5. Human review selects the pedagogical core sense bundle and authors/approves concise Vietnamese explanation.
6. Store exactly one primary level mapping for the current runtime.

### Phrase selection

Prioritize:

- basic functional expressions;
- phrasal verbs actually used in A1–B1 content;
- high-value verb–noun and adjective–noun collocations;
- short discourse frames.

Phrase records are first-class concepts; do not decompose them into unrelated word mastery.

### Grammar selection

Use CEFR-J Grammar Profile as a candidate prior and manually normalize to stable grammar codes. Grammar concept explanations are a known runtime gap; do not fabricate lexical senses to work around it.

### Vietnamese adaptation

Use population research only as a small authoring/ranking prior. Candidate high-attention areas: tense/aspect, articles, prepositions, plural/agreement, collocations, final consonants/clusters, /θ/–/ð/ and stress. No population prior creates learner weakness or competence evidence.

## Phase 3 — Validation suite

Required deterministic tests/checks before any database apply:

### Identity/integrity

- canonical key normalization deterministic;
- duplicate key rejected;
- duplicate lemma/POS mapping reviewed explicitly;
- unknown relation target rejected;
- self relation rejected;
- prerequisite cycle rejected;
- invalid/unsupported concept type rejected.

### Level evidence

- no concept has multiple equally authoritative primary mappings;
- every level assertion has source record and confidence/rationale;
- Council-of-Europe CEFR is never presented as a direct word-level certifier.

### Provenance/rights

- every imported row traces to an approved source record;
- licence usage policy is compatible with intended production use;
- required attribution is preserved;
- `REFERENCE_ONLY`, `CANDIDATE_QUARANTINE` and `REJECT_MVP` sources cannot enter apply mode.

### Content/examples

- exact UTF-16 offsets validated against sentence text;
- translations have explicit source/right status;
- target concept occurs at declared span;
- sentence language and concept language agree;
- example difficulty/level is reviewed, not inferred solely from one word.

### Learner isolation

Snapshot learner tables before/after catalog import and prove zero row/value change for:

- user concept/skill states;
- review items/events;
- FSRS states;
- learning/exposure events;
- saved concepts/content/sentences;
- Today plans/activities;
- reader progress/mutation results.

## Phase 4 — staging dry run

Only after independent review:

1. run preview against staging configuration with no writes;
2. inspect planned inserts/updates/conflicts;
3. prove no existing acceptance anchors would be modified/deleted;
4. run importer in a disposable PostgreSQL test database;
5. run backend full suite and content/Dictionary/Brain/Admin focused suites;
6. only then request approval to apply to staging.

No Vercel/Render deployment is required merely to import knowledge. Hosted smoke comes after a separately approved staging apply.

## Phase 5 — real-content proof

The first meaningful acceptance is not “N concepts inserted.” It is a real learning flow:

Admin create article → map reviewed concepts → validate/publish → Reader opens exact article → concept detail is useful → explicit Save/Learn activates exactly one lineage → Review works → Brain reflects evidence → Library persists → no hidden catalog write from browser.

Use the first 16 original micro-articles to expose missing catalog units. Expand the catalog from demonstrated gaps.

## Known blockers that require a new bounded task instead of a workaround

1. Grammar/skill learner-facing explanations need a first-class projection if self-use proves current examples are insufficient.
2. Pronunciation needs an approved schema/API contract before CMUdict/Common Voice data can become a product feature.
3. Sense-specific proficiency/mastery would require a deliberate concept/sense identity redesign; do not split the existing FSRS lineage silently.
4. If multiple framework mappings become necessary at runtime, the current `ORDER BY confidence, UUID` projection must be redesigned explicitly.

## Non-goals

- no UI redesign;
- no Auth work;
- no broad RLS/security work;
- no deployment config change;
- no PostHog tracking change;
- no AI Tutor;
- no realtime pronunciation scoring;
- no automatic LLM-generated knowledge accepted without human review;
- no `STATUS.md`, `TASKS.md`, `DECISIONS.md` edits from this research branch while parallel sessions are active.

## Independent review questions

Reviewer must answer:

1. Does any source in the apply set have unresolved commercial/redistribution obligations?
2. Can every final field be traced to a source or first-party review action?
3. Does the importer preserve all learner invariants and acceptance anchors?
4. Are concept boundaries pedagogically coherent under one FSRS lineage?
5. Does any metadata property accidentally become runtime authority without a schema decision?
6. Can repeated imports and source updates be reproduced and audited?
7. Does the first real-content flow become materially better than the current fixture/sparse catalog?
