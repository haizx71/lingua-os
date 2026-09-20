# LINGUA OS Knowledge System V2 — Architecture Principles

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/`, `database/migrations/`, `contracts/`

---

## 1. Executive Summary & Foundational Axioms

Knowledge System V2 serves as the core semantic, pedagogical, and cognitive engine of LINGUA OS. It governs how linguistic knowledge is structured, how learners acquire and retain it, how evidence is collected across interaction surfaces, and how daily learning trajectories are deterministically planned.

To ensure architectural integrity, maintainability, and cognitive validity, Knowledge System V2 is grounded in seven non-negotiable architectural axioms:

```
+---------------------------------------------------------------------------------------+
|                                7 CORE SYSTEM AXIOMS                                   |
+---------------------------------------------------------------------------------------+
| 1. Clear Separation of Concerns (Canonical vs. Learner vs. Evidence vs. Scheduling)  |
| 2. Exposure != Learn Intent (Reading != Memory Tracking Activation)                   |
| 3. Single Primary FSRS Memory Lineage per (Learner, Concept)                         |
| 4. Content Provenance, Licensing, and Attribution Integrity                          |
| 5. Deterministic-First Engine (Zero Non-Deterministic Critical-Path Dependencies)    |
| 6. Server-Side Authorization & Strict Multi-Tenant Learner Isolation                 |
| 7. Contract-First API & Non-Destructive Forward Migration Discipline                 |
+---------------------------------------------------------------------------------------+
```

---

## 2. Separation of Concerns (Six Distinct Tiers)

Knowledge System V2 strictly separates six distinct functional tiers. Crossing these boundaries without explicit mediated interfaces is prohibited.

```
+---------------------------------------------------------------------------------------+
| 1. CANONICAL KNOWLEDGE TIER                                                           |
|    - Immutable, universal linguistic truth (lemmas, senses, grammar patterns, phonemes)|
|    - Zero learner-specific state or user IDs                                          |
+---------------------------------------------------------------------------------------+
                                        | referenced by
                                        v
+---------------------------------------------------------------------------------------+
| 2. LEARNER KNOWLEDGE TIER                                                             |
|    - Per-learner cognitive state (Bayesian competence distributions, status markers)  |
|    - Strictly isolated by user_id; private to the authenticated learner               |
+---------------------------------------------------------------------------------------+
                                        ^
                                        | updates via projectors
+---------------------------------------------------------------------------------------+
| 3. EVIDENCE TIER (Event Ledger)                                                       |
|    - Append-only, immutable stream of learning & exposure interactions                |
|    - Multi-dimensional telemetry across all 9 learning surfaces                       |
+---------------------------------------------------------------------------------------+
                                        | feeds into
                                        v
+---------------------------------------------------------------------------------------+
| 4. SCHEDULING & MEMORY TIER (FSRS-6 Core)                                             |
|    - Interval calculation, retrievability decay curves, review queue generation       |
|    - Single primary lineage per concept; py-fsrs 6.3.2 algorithm authority           |
+---------------------------------------------------------------------------------------+
                                        | orchestrated by
                                        v
+---------------------------------------------------------------------------------------+
| 5. CURRICULUM & CONTENT TIER                                                          |
|    - CEFR frameworks, pedagogical texts, audio artifacts, reading corpora            |
|    - Linked to canonical items with licensing & provenance metadata                   |
+---------------------------------------------------------------------------------------+
                                        | presented via
                                        v
+---------------------------------------------------------------------------------------+
| 6. PRESENTATION & PROJECTION TIER                                                     |
|    - Transient or cached DTO projections for Today, Brain, Library, Review, Reader    |
|    - Strictly derived; zero independent business authority                            |
+---------------------------------------------------------------------------------------+
```

---

## 3. Seven Non-Negotiable Invariants

### Invariant 1: Exposure != Learn Intent
- **Rule**: Merely encountering a word or grammar structure in the Reader or Dictionary must **never** silently activate FSRS memory scheduling or pollute the review queue.
- **Mechanism**:
  - Encounters emit append-only `exposure_events` (or `learning_events` with `event_type = 'reading_exposure'`).
  - FSRS tracking (`review_items` + `fsrs_states`) is initiated **only** by explicit learner intent:
    1. Explicitly saving/bookmarking the concept via the Library (`concept_save_intents`).
    2. Explicitly opting to learn a concept from the Reader popover or Dictionary detail.
    3. Today engine curriculum assignment with user acceptance.
- **Failure Mode Prevented**: Premature queue saturation where a learner reads an advanced article and is overwhelmed by 200 low-frequency review items the next morning.

### Invariant 2: Single Primary FSRS Memory Lineage
- **Rule**: For any given pair of `(user_id, concept_id)`, there must exist at most **one** active primary FSRS memory record (`review_items` joined to `fsrs_states`).
- **Mechanism**:
  - Enforced by database unique constraint: `UNIQUE (user_id, concept_id) WHERE (lineage_type = 'primary')`.
  - Multi-modal prompts (e.g., cloze reading, listening recall, orthographic production) are scheduled as sub-evaluations under this unified concept memory node, rather than creating fragmented cards with independent review timelines.
- **Failure Mode Prevented**: Multiple disconnected reviews for the same lexical unit (e.g., flashcard review vs. listening review occurring on different days with divergent stability values).

### Invariant 3: Content Provenance and Licensing Preservation
- **Rule**: Every canonical concept, sense definition, example sentence, text passage, and audio recording must record its provenance, license type, and attribution metadata.
- **Mechanism**:
  - Foreign key references to `licenses` and `data_sources`.
  - Content items must specify `attribution_text`, `license_id`, `quality_tier`, and `curation_status`.
  - Automatic rejection of ingested content lacking verifiable permissive licensing (e.g., CC-BY-SA, CC0, or proprietary authorized).
- **Failure Mode Prevented**: Copyright infringement liabilities, contaminated educational datasets, and inability to track data lineage during model training.

### Invariant 4: Deterministic-First Core Architecture
- **Rule**: Core pedagogical decisions—scheduling, competence updating, daily budget packing, and prerequisite resolution—must be 100% deterministic, reproducible, and verifiable.
- **Mechanism**:
  - Pure relational mathematics: py-fsrs 6.3.2 differential stability curves, Bayesian beta-binomial distributions, and topological DAG sorting.
  - Zero LLM calls in the critical path of Today plan generation, review interval calculation, or mastery classification.
  - LLMs (e.g., AI Tutor) are restricted to post-MVP advisory explanations, conversational roleplay, and nuance elaboration, operating strictly downstream of deterministic context envelopes.
- **Failure Mode Prevented**: Flaky schedules, non-reproducible student progress, high API operational latency, and hallucinated curriculum progression.

### Invariant 5: Server-Side Authorization & Multi-Tenant Isolation
- **Rule**: The client is never trusted. All actor resolution is derived from cryptographically verified Supabase Auth JWT claims parsed on the FastAPI server.
- **Mechanism**:
  - Client-supplied `user_id` query params or payload fields are strictly forbidden or checked against `current_user.id`.
  - Database Row Level Security (RLS) is active on all learner tables as a defense-in-depth barrier.
  - Direct browser connections to PostgreSQL are revoked:
    - Tables: `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated` (Migrations `0010`–`0012`).
    - Schema: `REVOKE USAGE ON SCHEMA public FROM anon, authenticated` (Migration `0012`).
    - Functions: `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (Migration `0013`).
- **Failure Mode Prevented**: Insecure Direct Object References (IDOR), unauthorized cross-tenant data leakage, and forged learning progress.

### Invariant 6: Contract-First API Design
- **Rule**: The OpenAPI specification (`contracts/openapi.yaml`), shared enums (`contracts/enums.json`), and error catalog (`contracts/errors.json`) represent the immutable source of truth.
- **Mechanism**:
  - No backend route or DTO may be deployed without prior or concurrent updates to the contract.
  - Frontend code generation consumes shared contracts directly.
  - Strict semantic HTTP status codes: `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `412 Precondition Failed`, `422 Unprocessable Entity`.
- **Failure Mode Prevented**: Frontend-backend drift, breaking changes, and untyped payload assumptions.

### Invariant 7: Non-Destructive Forward Migration Discipline & Realistic Rollback Semantics
- **Rule**: Production migrations must be strictly additive and forward-compatible. Never mutate or drop historical migrations `0001` through `0013`.
- **Mechanism**:
  - V2 migrations begin sequentially at `0014`.
  - New schema structures are deployed alongside existing tables.
  - Rollback semantics distinguish:
    1. **Schema Rollback**: DDL reverts cleanly via `.down.sql` if executed pre-cutover.
    2. **Pre-Cutover Rollback**: 100% reversible before production traffic writes V2-specific polymorphic records.
    3. **Post-Cutover Recovery / Data Rollback**: Once V2 data is populated, restoring legacy constraints requires explicit data reconciliation/archiving scripts rather than unvalidated raw DDL drops.
- **Failure Mode Prevented**: Service downtime, corrupt historical audit trails, and broken rollback paths.

---

## 4. Architectural Decision Records (ADR Register)

### ADR-K2-001: Polysemy Architecture — Shared Lexeme vs. Multiple Lexemes
- **ARCHITECTURAL EVALUATION**:
  In natural language, words frequently have multiple distinct meanings (polysemy):
  - *bank* (noun): Financial institution vs. sloping land beside a river.
  - *right* (adjective): Morally good / correct vs. opposite of left.

  Two primary architectures were comprehensively compared across seven system dimensions:

  | Dimension | Option A: Shared Lexeme $\to$ Multiple Word Senses $\to$ Learner-Addressable Concept/Sense | Option B: Multiple Concept-Specific Lexemes (with `sense_disambiguator`) |
  | :--- | :--- | :--- |
  | **1. Dictionary Search** | **Superior**: Querying "bank" returns 1 canonical lexeme, effortlessly displaying all senses grouped hierarchically under one lemma. | **Poor**: Querying "bank" hits multiple duplicate lexeme rows that must be re-grouped via SQL aggregation. |
  | **2. Review Scheduling** | **Optimal**: Learner reviews the specific pedagogical concept/sense (*bank* [finance] at A1; *bank* [river] at B1). | **Functional**, but couples review cards to artificial duplicate lexical rows. |
  | **3. Learner Knowledge & Mastery** | **Clean**: Mastery profile clearly shows: Sense 1 (finance) = `mastered`, Sense 2 (geography) = `unseen`. | **Functional**, but learner state anchors to separate lexemes rather than senses. |
  | **4. Canonical Deduplication** | **100% Normalized**: Exactly 1 lemma row per `(language_code, normalized_form, part_of_speech)`. | **Denormalized**: Duplicates lemma, pronunciation, and lexical root across multiple rows. |
  | **5. Morphology & Forms** | **Single Source of Truth**: Inflected forms (`banks`, `banking`, `banked` in `lexeme_forms`) attach once to the single `lexeme_id`. | **Severe Duplication**: Every sense-specific lexeme must duplicate identical inflection tables. |
  | **6. Provenance & Attribution** | **Precise**: Lemma etymology attaches to `lexemes`; specific sense definitions attach to `word_senses`. | Conflated across duplicated lexeme entities. |
  | **7. Ingestion & Catalog Imports** | **Standard Lexicography**: Matches Wiktionary, WordNet, and Oxford models: Lemma $\to$ [Senses]. | Non-standard: Importers must synthesize artificial disambiguator tags for every sense. |

- **DECISION**: Adopt **Option A: Shared Lexeme $\to$ Multiple Word Senses $\to$ Learner-Addressable Concept/Sense**.
  - `lexemes` retains strict uniqueness: `UNIQUE NULLS NOT DISTINCT (language_code, normalized_form, part_of_speech)`.
  - `word_senses` holds individual distinct definitions, CEFR levels, and bilingual explanations.
  - In V2, `concepts` anchors either:
    1. Lexical words at the sense level (each sense has its own `concept_id`), OR
    2. A clean relational bridge `concept_senses (concept_id, word_sense_id)` allowing a pedagogical concept to address a specific word sense.
  - For V1 compatibility, existing 1:1 mappings are preserved, and polysemous expansions are cleanly mapped without breaking existing concept UUIDs.
- **REASON**: Eliminates massive morphological duplication in `lexeme_forms`, matches standard linguistic models, and provides optimal Dictionary and Review user experiences.
- **TRADEOFFS**: Requires joining from `concepts` $\to$ `concept_senses` $\to$ `word_senses` $\to$ `lexemes` for sense-level concepts, handled efficiently via covering indexes.
- **MIGRATION IMPACT**: Additive table `concept_senses` in migration `0015`; zero mutation of the existing `lexemes` unique constraint.
- **ACCEPTANCE CRITERIA**:
  - Zero duplicate rows in `lexemes` or `lexeme_forms` for identical morphological words.
  - Senses for *bank* (finance) and *bank* (river) have independent learner competence and FSRS memory states.

---

### ADR-K2-002: First-Class Grammar Specifications
- **DECISION**: Create a dedicated `grammar_specifications` table with structured syntax pattern formulas, structural slots, pragmatic functions, and Vietnamese (L1) contrastive explanations.
- **REASON**: In V1, grammar concepts are mere rows in `concepts` with `concept_type = 'grammar'`. They have no rows in `lexemes` and no rows in `word_senses`. The Brain concept detail API (`/v1/brain/concepts/{id}`) joins on `lexemes` and returns null/empty definitions for grammar items.
- **ALTERNATIVES CONSIDERED**:
  1. *Force grammar concepts into `lexemes` with a dummy POS `grammar`*: Rejected as an unmaintainable hack violating linguistic typing.
  2. *Store grammar details in an unindexed JSONB metadata blob*: Rejected because grammar patterns require queryable structural relations (prerequisites, component verbs, aspect markers).
- **TRADEOFFS**: Requires maintenance of an additional canonical entity type and dedicated ingestion schemas.
- **MIGRATION IMPACT**: Additive table `grammar_specifications` in migration `0014`.
- **ACCEPTANCE CRITERIA**:
  - `GET /v1/brain/concepts/{grammar_id}` returns rich structural formulas, communicative intent, and contrastive notes.

---

### ADR-K2-003: Tripartite Learner State & py-fsrs 6.3.2 Retrievability Alignment
- **DECISION**: Explicitly decouple learner state into three orthogonal constructs:
  1. **Competence**: Bayesian beta-binomial distribution $\text{Beta}(\alpha, \beta)$ per modality (`recognition`, `listening`, `production`).
  2. **Retrievability**: Computed in exact accordance with **py-fsrs 6.3.2**:
     $$R(t, S) = \left(1 + \text{FACTOR} \cdot \frac{\text{elapsed\_days}}{S}\right)^{\text{DECAY}}$$
     Where:
     - $\text{elapsed\_days} = \max(0, (\text{now} - \text{last\_review}).\text{days})$ (integer days, matching py-fsrs).
     - $\text{DECAY} = -w_{20}$ (the 21st parameter in py-fsrs 6.3.2; default $-0.1542$).
     - $\text{FACTOR} = 0.9^{1/\text{DECAY}} - 1$ (default $\approx 0.980346$).
  3. **Curricular Status**: Discrete state machine (`unseen`, `learning`, `active`, `at_risk`, `mastered`) derived from competence thresholds and current retrievability.
- **REASON**: In V1, status transition was one-way without temporal decay. Mastered items remained "mastered" forever even if neglected for 6 months. Previous V2 drafts hardcoded outdated FSRS-4.5 constants ($19/81, -0.5$), creating dangerous mathematical drift against the backend's py-fsrs 6.3.2 engine.
- **AUTHORITATIVE IMPLEMENTATION**:
  - Python's `FsrsSchedulerAdapter` remains the **single authoritative source of truth** for all state transitions, interval calculations, and retrievability evaluations.
  - SQL views (`v_learner_concept_retrievability`) use the exact parameter-aligned formula to project dynamic `effective_status` for real-time Today planning without drift.
- **ACCEPTANCE CRITERIA**:
  - Mathematical equivalence test between Python py-fsrs 6.3.2 `get_card_retrievability` and SQL view output passes with relative error $< 10^{-6}$.
  - Mastered items whose retrievability decays below $R < 0.70$ automatically evaluate as `at_risk` in the Today plan.

---

### ADR-K2-004: Concurrency-Proven Relational DAG Prerequisite Integrity
- **DECISION**: Enforce Directed Acyclic Graph (DAG) integrity on `concept_edges` for hierarchical and prerequisite relations (`prerequisite_of`, `part_of`, `hypernym_of`, `derived_from`) using a PostgreSQL `BEFORE INSERT OR UPDATE` trigger backed by an explicit **transaction-level advisory serialization lock**.
- **CONCURRENCY & TRANSACTION ISOLATION ANALYSIS**:
  - *The Problem*: Under PostgreSQL default `READ COMMITTED` isolation, two concurrent transactions inserting opposing edges ($T_1: A \to B$ and $T_2: B \to A$) cannot see each other's uncommitted writes during recursive CTE execution. Both triggers would pass, creating an undetected circular dependency upon commit!
  - *The Solution*: The trigger acquires an exclusive transaction-scoped advisory lock on the prerequisite graph namespace:
    ```sql
    PERFORM pg_advisory_xact_lock(hashtext('lingua_concept_dag_mutation_lock'));
    ```
  - Since canonical edge modifications occur exclusively during administrative catalog imports or curriculum staging (infrequent writes), transaction serialization introduces negligible latency ($< 5\text{ms}$) while providing a **100% mathematical guarantee against concurrent cycle creation**.
  - The trigger explicitly handles:
    1. **INSERT**: Validates new edges against existing paths.
    2. **UPDATE**: Re-validates if `source_concept_id` or `target_concept_id` changes.
    3. **Self-edges**: Blocked by table check constraint `CHECK (source_concept_id <> target_concept_id)`.
    4. **Existing-path cycles**: Blocked by recursive path check.
    5. **Concurrent writes**: Serialized via advisory transaction lock.
- **FUNCTION PRIVILEGE INVARIANT (Migration 0013 Alignment)**:
  - In accordance with migration `0013_supabase_public_function_default_execute_lockdown_v1`, the trigger function is declared with `SECURITY INVOKER` and explicit `SET search_path = public, pg_temp`.
  - No execute permissions are granted to `PUBLIC`, `anon`, or `authenticated`. The trigger executes under the role of the authenticated database write session (migration or service role).
- **ACCEPTANCE CRITERIA**:
  - Concurrency test with 10 concurrent threads attempting to insert conflicting cycle edges results in successful serialization and rejection of all cycle-forming inserts.

---

### ADR-K2-005: Realistic Rollback Semantics
- **DECISION**: Formally replace all unqualified "exact rollback" claims with a strictly defined four-stage rollback and recovery contract:
  1. **Schema Rollback**: Every migration `.up.sql` has a corresponding `.down.sql` reversing DDL objects (dropping additive tables, functions, triggers, and views).
  2. **Pre-Cutover Rollback**: If a deployment fails before traffic is directed to V2 services and before V2-specific polymorphic data is written, executing `.down.sql` returns the schema to the exact baseline state with 100% fidelity.
  3. **Data Rollback**: If V2 data has already been written (e.g., new rows in `grammar_specifications` or `concept_senses`), running `.down.sql` drops these new tables cleanly.
  4. **Post-Cutover Recovery (Constraint Safety)**:
     - Because V2 maintains strict uniqueness on `lexemes` (Option A above) and stores polysemous mappings in additive tables (`concept_senses`), reverting `.down.sql` will **never fail** due to duplicate lemma collisions!
     - In contrast to the rejected Option B (which would have introduced duplicate lemmas), Option A guarantees that rolling back does not leave violating rows in base tables.
- **ACCEPTANCE CRITERIA**:
  - Running `.up.sql` followed immediately by `.down.sql` on a populated database restores the exact schema without errors.
