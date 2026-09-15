# Open-Source Language-Learning Repository Review — 2026-09-16

Purpose: extract useful product/data-engineering patterns for LINGUA OS without copying incompatible domain semantics, licences or architecture. This is design intelligence only; none of these projects becomes a runtime dependency from this research branch.

## Review principles

LINGUA OS keeps its accepted boundaries:

- server-authoritative learner state;
- explicit Save/Learn activation;
- one FSRS lineage per learner/concept;
- competence distinct from memory;
- PostgreSQL source of truth;
- provenance/licence first-class;
- Reader exposure is passive unless an explicit learner action crosses a canonical write boundary.

A repository is therefore useful only where its idea improves authoring, context, validation or learning presentation without weakening those invariants.

## 1. Learning With Texts (LWT)

Repository family reviewed: original/current LWT and modern community forks.

Observed pattern:

- reading is the primary learning context;
- terms can be words or multi-word expressions;
- vocabulary is tied to the text where it was encountered;
- context is shown again during review;
- known/unknown term state helps estimate text difficulty and recommendations.

### Adopt the principle

LINGUA OS should preserve rich **source context** for concept encounters and use known/learning coverage as one input to Reader content fit. Phrase concepts should stay first-class rather than being decomposed into isolated words.

### Do not copy the semantics

Do not let a learner clicking “known” directly become competence/mastery authority. In LINGUA OS, an encounter is exposure, Save/Learn is explicit intent, FSRS is memory, and competence comes from evidence.

## 2. Lute v3

Repository: `LuteOrg/lute-v3` (MIT software).

Observed pattern:

- modern reading-oriented descendant of LWT;
- self-hosted reading and term management;
- keeps language acquisition close to authentic text rather than a detached flashcard-only workflow.

### LINGUA OS implication

No architectural adoption is needed. Its strongest lesson is the same as LWT: a review item is more pedagogically useful when the learner can reconnect it to meaningful source context. Our current Review/Reader contracts should remain authoritative; future UX can expose context already stored by the backend rather than inventing new client state.

## 3. LinguaCafe

Repository: `simjanos-dev/LinguaCafe`.

Observed pattern:

- vocabulary acquisition through reading;
- built-in lookup/review flow;
- supports multi-language tokenization/dictionaries;
- README keeps a conspicuous attribution list separating the licences of external tools and linguistic datasets.

### Adopt the principle

The **licence manifest** pattern is valuable. LINGUA OS should generate a catalog-source attribution report from `licenses` + `data_sources` + `source_records`, instead of relying on package.json or one project-wide licence statement.

### Do not copy the source mix blindly

LinguaCafe demonstrates why source-by-source rights matter: its dependencies include MIT/GPL/AGPL/CC BY-SA and dictionary-specific licences. LINGUA OS should not bundle all such data merely because another open-source reader does.

## 4. LibreLingo

Repository reviewed: archived `kantord/LibreLingo` / LibreLingo community lineage.

Observed pattern:

- structured course/content representation;
- content can be validated/exported before learner delivery;
- contributor-oriented authoring;
- spaced repetition and progress tracking integrated with exercises.

### Adopt the principle

The useful pattern is **content-as-validated-data before publication**. This aligns with our existing Admin → validate → publish gate. For bulk Knowledge V1, importer preview must produce an inspectable deterministic diff before any database write.

### Do not adopt as a dependency

The main repository is archived and its course model does not match the accepted Language Brain/domain model. Do not introduce a second course-runtime or SRS system.

## 5. Open Spaced Repetition / FSRS

Organization/repositories: `open-spaced-repetition/*`, including FSRS implementations and algorithm documentation.

Observed pattern:

- FSRS models memory with difficulty/stability/retrievability;
- multiple maintained implementations/benchmarks exist;
- scheduler logic is treated as a specialized memory subsystem.

### LINGUA OS implication

This is confirmation, not a new task. LINGUA OS already uses an accepted FSRS-6 path. Knowledge ingestion must not estimate due dates, create a second scheduler or propagate schedule state across related concepts.

## 6. Open English WordNet

Repository: `globalwordnet/english-wordnet`.

Observed pattern:

- stable lexical network of synsets/relations;
- downloadable versioned releases;
- CC BY 4.0;
- project documentation explicitly says automatically generated changes must be manually validated before acceptance.

### Adopt the principle

Pin a released dataset version and stable upstream IDs. Use automatic matching only to produce **candidates**; learner-facing meanings/relations must cross human review. Never import the entire WordNet graph just because it is available.

## 7. Open Language Profiles / CEFR-J

Repository: `openlanguageprofiles/olp-en-cefrj`.

Observed pattern:

- separate vocabulary and grammar profiles;
- explicit level and POS fields;
- clear citation/commercial-use statement;
- repository mirror may lag the authoritative CEFR-J release.

### Adopt the principle

Treat curriculum evidence as versioned upstream data with source version and confidence. Always prefer the authoritative current CEFR-J artifact over an old mirror for production import, while retaining the mirror as a reproducible inspection source.

## 8. wordfreq

Repository: `rspeer/wordfreq`.

Observed pattern:

- combines many domains to estimate robust frequency;
- documents precision vs accuracy carefully;
- current data snapshot is effectively frozen around 2021;
- code and data provenance/licensing differ.

### Adopt the methodological lesson, not the dataset

Frequency should be treated as noisy evidence, ideally aggregated across domains, not as a pedagogical truth. For V1, do not copy wordfreq data into our catalog because of source/attribution/share-alike complexity and data staleness.

## 9. WithEnglishWeCan generated phrasal-verbs repository

Repository reviewed: `WithEnglishWeCan/generated-english-phrasal-verbs`.

Observed pattern:

- README exposes thousands of phrasal verbs and declares MIT;
- root repository review shows generated output but does not provide a sufficiently explicit upstream content source chain.

### Decision

Quarantine. A repository-level MIT label is not enough for generated linguistic content when provenance is unclear. This becomes a concrete test case for our importer rule: no upstream source chain → no production ingestion.

## 10. LanguageTool

Repository/project: LanguageTool.

Observed pattern:

- mature grammar/style checking engine;
- software licence and language rules are separate from our curriculum authority.

### Possible future use

Optional **Admin authoring QA** only: flag likely grammar/spelling issues before human publication review. It must not automatically decide CEFR level, semantic correctness or publication readiness. No integration is warranted in this branch.

## Cross-project design upgrades for LINGUA OS

### A. Context should be a durable learning asset

For a concept, retain multiple examples from different content contexts. Reader encounters should be queryable for future review/context display, while remaining passive evidence unless a canonical learner event says otherwise.

### B. Multi-word expressions are first-class

LWT-style “terms” and modern formulaic-sequence research reinforce the existing `phrase` concept type. A phrasal verb or collocation should have its own pedagogical identity when its meaning/use cannot be reconstructed reliably from isolated components.

### C. Validation before publish/import

Course/content repositories repeatedly benefit from structured pre-publication validation. Knowledge import must follow:

`source artifact → parse → normalize → candidate matching → rights gate → linguistic review → preview diff → transactional apply`.

### D. Provenance is part of product quality

A good catalog record is not just `word + definition`. It needs:

- stable canonical identity;
- source/release/hash;
- level evidence;
- definition/translation provenance;
- review status;
- relation provenance;
- attribution obligation;
- transform version.

### E. Never transfer mastery through the graph

Word-family, synonym, prerequisite and related edges help recommendations/explanations. They do not mean the learner knows the neighbor. Graph edges may affect candidate selection only after a future accepted heuristic; they never clone FSRS, competence or Save/Learn state.

### F. Prefer quality and coverage over catalog size

Open dictionaries make it easy to ingest 100k+ entries, but that creates noisy senses and weak learner utility. The first catalog should be driven by the 16 real micro-articles plus high-value A0/A1 curriculum gaps, then expand from actual learner lookup/reading demand.

## What this review does NOT authorize

- no dependency installation;
- no code copied from reviewed apps;
- no catalog dataset import;
- no migration/API/UI change;
- no Supabase write;
- no Render/Vercel deployment;
- no modification of master or other agents' branches.
