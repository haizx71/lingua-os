# LINGUA OS Knowledge System V2 — Current State Audit

**Status**: Verified Repository Audit
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a` (advancing from previous baseline `72828daeac0f3c4e8a2dafc44d168b2862228e8b`)
**Classification**: `FACT` (verified against production code, migrations, contracts, and test evidence)

---

## 1. Executive Summary & Audit Baseline

This document establishes the empirical reality of the LINGUA OS codebase at authoritative commit `c2db86387e0879f56817cd748899e80f46b5d79a`. It audits the live database schema (migrations `0001` through `0013`), backend services (`services/api/src/lingua_api/`), API contracts (`contracts/openapi.yaml`, `contracts/enums.json`, `contracts/errors.json`), test suites, and frontend consumers (`apps/web/`).

### 1.1 Repository Verification Evidence (`FACT`)
- **Backend Quality Gate**: Docker PostgreSQL 17.11 passes Ruff format/lint, strict mypy, and **512/512** backend tests (`pytest tests/backend/`).
- **Frontend Quality Gate**: Full frontend Vitest suite passes **711/711** tests.
- **Real Learning Loop & Integration Verification**: Phase B, C, D, and E pass 1/1 against real disposable Supabase Auth / PostgreSQL state. Playwright R1 browser suite passes 4/4.
- **API Contracts**: OpenAPI specification (`contracts/openapi.yaml`) remains unchanged and authoritative.

### 1.2 Repository vs. Hosted Deployment Distinction (`FACT`)
- **Repository FACT**: Migration `0013_supabase_public_function_default_execute_lockdown_v1.up.sql` is present in `database/migrations/`, validated by local CI and `tests/backend/database/test_public_api_lockdown.py`.
- **Deployment FACT**: As documented in `STATUS.md` and `reviews/FRLL-CLOUD-VERIFICATION-20260920.md`, hosted Supabase staging currently has applied migrations up to `0012`. Migration `0013` has **not** yet been applied to the hosted database. No hosted database mutation occurred during verification.

### 1.3 Foundational System & Privilege Invariant
> **The database and backend services are strictly decoupled from browser direct access.**
> Browser clients authenticate via Supabase Auth JWT and communicate exclusively through the FastAPI application gateway. Direct browser access to PostgreSQL is revoked:
> 1. `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` (Migrations `0010`–`0012`).
> 2. `REVOKE USAGE ON SCHEMA public FROM anon, authenticated;` (Migration `0012`).
> 3. `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;` (Migration `0013`).
> Any new PostgreSQL function or trigger created in V2 automatically has `EXECUTE` revoked from `PUBLIC`, preventing any unintended browser RPC execution.

---

## 2. Exhaustive Schema & Persistence Reality (Migrations 0001–0013)

The database layer consists of 13 sequential forward migrations:
- `0001_core_schema_v1.up.sql`: Core entities, languages, CEFR frameworks, users, profiles, concepts, lexemes, word senses, sentences, audio, content, skill states, concept states, learning events, exposure events, review items, FSRS states, review events, saved items, today plans, assessment items/attempts/results.
- `0002_memory_engine_fsrs_v1.up.sql`: FSRS-6 parameter sets, immutability triggers, parameter versioning, card step tracking.
- `0003_review_idempotency_result_v1.up.sql`: Exact post-transition memory snapshot for idempotent replay.
- `0004_learner_evidence_competence_v1.up.sql`: `competence-beta-v1` parameter sets, concept competence policies, user language projection heads, beta-binomial mass accumulation on dimensions (`recognition`, `listening`, `production`), append-only triggers on `learning_events`.
- `0005_reader_content_service_v1.up.sql`: Fail-closed content publication gate trigger, published reader immutability trigger, `user_content_progress`, `reader_mutation_results`, `reader_exposure_concepts`.
- `0006_today_engine_heuristic_v1.up.sql`: `today-heuristic-v1` deterministic daily planning, unique profile day constraint, `today_activity_review_items`.
- `0007_profile_language_auth_bootstrap_v1.up.sql`: Native language authority (`native_language_code`), profile revisions, `profile_mutation_results`.
- `0008_starting_level_estimate_v1.up.sql`: Assessment template/item bundle slots, `assessment_attempt_items` (private snapshots), `assessment_idempotency_log`.
- `0009_library_concept_save_intent_v1.up.sql`: Immutable `concept_save_intents` table, GAP-01 memory activation hook.
- `0010_supabase_public_data_api_lockdown_v1.up.sql`: Revocation of PostgREST table permissions from `anon` and `authenticated`.
- `0011_supabase_public_function_execute_lockdown_v1.up.sql`: Revocation of execute privileges on existing public functions.
- `0012_supabase_public_schema_browser_lockdown_v1.up.sql`: Revocation of `USAGE` on schema `public` from `anon` and `authenticated`.
- `0013_supabase_public_function_default_execute_lockdown_v1.up.sql`: Revocation of default execute grant on future functions from `PUBLIC`.

### Reality Map: Source of Truth vs. Derived Projections

| Subsystem | Source of Truth (Persistence) | Derived Projection | Calculated At | Persistence Status |
| :--- | :--- | :--- | :--- | :--- |
| **Canonical Concepts** | `public.concepts` (`id`, `canonical_key`, `concept_type`) | N/A | Ingestion / Import | Persisted |
| **Lexical Units** | `public.lexemes` & `public.lexeme_forms` | Normalized lemma lookup | Ingestion / Import | Persisted |
| **Senses** | `public.word_senses` (tied to `lexeme_id`) | Bilingual definition list | Ingestion / Import | Persisted |
| **Knowledge Graph** | `public.concept_relations` | Prerequisite chains | Ingestion / Import | Persisted |
| **Curriculum Fit** | `public.framework_mappings` (`concept_id`, `level_id`) | Primary level resolution | Query time (ordered by confidence) | Persisted |
| **FSRS Scheduling** | `public.fsrs_states` (`stability`, `difficulty`, `due_at`) | Due review queue | Transactional on review answer | Persisted |
| **Competence State** | `public.learning_events` (canonical event stream) | `public.user_concept_states` | Projector on event ingestion | Materialized Projection |
| **Skill Aggregates** | `public.learning_events` | `public.user_skill_states` | Projector on event ingestion | Materialized Projection |
| **Language Brain** | None (pure projection) | `GET /v1/brain/summary`, `/concepts` | Query time via `_ANCHOR_SQL` | Transient Projection |
| **Today Schedule** | `public.today_plans`, `today_plan_activities` | Daily activity list | Deterministic generation at `as_of` | Persisted Snapshot |
| **Library** | `public.user_saved_concepts`, `content`, `sentences` | Saved items feed | Query time | Persisted User Bookmark |
| **Dictionary** | `public.lexemes`, `word_senses`, `source_records` | Search result envelope | Query time with `allowed_record_sql` | Transient Query |

---

## 3. Systematic Assessment of the 18 Architectural Areas

### 3.1 Knowledge Item Model
- **CURRENT (`FACT`)**: Defined in table `concepts` (`id uuid`, `language_code text`, `concept_type text`, `canonical_key text`, `source_record_id uuid`). Types restricted by `CHECK (concept_type IN ('word', 'phrase', 'grammar', 'skill'))`. Key uniqueness enforced by `UNIQUE (language_code, concept_type, canonical_key)`.
- **KEEP (`FACT`)**: UUID primary keys, language scoping, and deterministic `canonical_key` formatting (`word:apple:noun`, `grammar:present-perfect-simple`).
- **PROBLEM (`FACT`)**: Conflates lexical headwords with grammatical rules and abstract skills without typed sub-specifications.
- **V2 PROPOSAL**: Subtyped canonical specifications (`grammar_specifications`, `phrase_specifications`) anchored cleanly by `concept_id`.
- **MIGRATION IMPACT**: Additive tables starting at migration `0014`. Zero breaking changes to existing concept UUIDs.

### 3.2 Vocabulary & Polysemy Model
- **CURRENT (`FACT`)**: Modeled as `lexemes` (`id`, `concept_id`, `lemma`, `normalized_form`, `part_of_speech`). Uniqueness constraint: `UNIQUE NULLS NOT DISTINCT (language_code, normalized_form, part_of_speech)`. `word_senses` points to `lexeme_id`. `concept_id` is stored on `lexemes`.
- **KEEP (`FACT`)**: Normalized form indexing (`ix_lexemes_lookup`), separate morphological forms (`lexeme_forms`).
- **PROBLEM (`FACT`)**: Because `lexemes.concept_id` is 1:1 with `concepts` and `lexemes` enforces uniqueness on `(language_code, normalized_form, part_of_speech)`, polysemous words (e.g., *bank* [finance] vs. *bank* [geography]) are forced to share a single concept. Learner competence and FSRS memory cannot be tracked per distinct word sense.
- **V2 PROPOSAL**: Decouple concept identity from lemma/POS uniqueness by establishing **Shared Lexeme $\to$ Multiple Word Senses $\to$ Learner-Addressable Concept/Sense** architecture.
- **MIGRATION IMPACT**: Additive migration `0015` adjusting relational mapping; preserves all existing 108 starter vocabulary rows.

### 3.3 Phrase Model
- **CURRENT (`FACT`)**: Phrases use `concept_type = 'phrase'` in `concepts`, pointing to a `lexemes` row where `part_of_speech` is NULL.
- **KEEP (`FACT`)**: Phrases treated as first-class concepts rather than decomposing into unlinked words.
- **PROBLEM (`FACT`)**: Variable slot patterns (e.g., *make up one's mind*) cannot be represented or validated against constituents.
- **V2 PROPOSAL**: Add `phrase_specifications` capturing base templates and structural slot constraints.
- **MIGRATION IMPACT**: Additive table `phrase_specifications` in migration `0014`.

### 3.4 Grammar Model
- **CURRENT (`FACT`)**: Grammar items are rows in `concepts` with `concept_type = 'grammar'`. They have no entry in `lexemes` and no entry in `word_senses`.
- **KEEP (`FACT`)**: Stable grammar code format (`grammar:present-perfect-simple`).
- **PROBLEM (`FACT`)**: Grammar has no structured explanation entity in the DB. The Brain detail projection (`/v1/brain/concepts/{id}`) joins on `lexemes` and `word_senses`, causing grammar concepts to return empty definition arrays.
- **V2 PROPOSAL**: First-class `grammar_specifications` entity capturing pattern formulas, slot constraints, communicative functions, and contrastive Vietnamese L1 explanations.
- **MIGRATION IMPACT**: Additive table `grammar_specifications` in migration `0014`.

### 3.5 Concept Model (Abstract / Semantic)
- **CURRENT (`FACT`)**: `concept_id` acts as the universal anchor for learner state (`user_concept_states`, `review_items`).
- **KEEP (`FACT`)**: Unified `concept_id` foreign key for all learner-facing operations.
- **PROBLEM (`FACT`)**: Conflates lexical units with semantic concepts and communicative skills.
- **V2 PROPOSAL**: Distinguish Lexical Unit vs. Semantic Concept vs. Communicative Function via typed ontology edges.
- **MIGRATION IMPACT**: Pure relational expansion in `concept_edges`.

### 3.6 Knowledge Relationships
- **CURRENT (`FACT`)**: Modeled in `concept_relations` (`source_concept_id`, `target_concept_id`, `relation_type`, `weight`). Restricted to `('synonym', 'antonym', 'prerequisite', 'family', 'related')`.
- **KEEP (`FACT`)**: Relational edge model, numeric weights, directional integrity.
- **PROBLEM (`FACT`)**: Lacks essential linguistics relationships (`collocates_with`, `inflection_of`, `derived_from`, `confusable_with`, `grammar_pattern_of`, `hypernym_of`, `hyponym_of`) and lacks transactional cycle prevention under concurrency.
- **V2 PROPOSAL**: Expand relation types and introduce concurrency-safe DAG integrity triggers with transaction serialization locks.
- **MIGRATION IMPACT**: Additive enum values and trigger deployment in migration `0014`.

### 3.7 Catalog & Ingestion Pipeline
- **CURRENT (`FACT`)**: Sourced via Knowledge V1 (`knowledge/catalog_import.py`). Curates 108 vetted starter concepts (77 word, 16 phrase, 8 grammar, 7 skill). Hash-gated apply requires exact candidate SHA256 and plan SHA256.
- **KEEP (`FACT`)**: Strict hash gating, zero unapproved writes, preflight collision checks, append-only provenance tracking.
- **PROBLEM (`FACT`)**: Manual script-driven imports; lacks versioned changeset manifests and automated delta ingestion.
- **V2 PROPOSAL**: Structured catalog staging tables with versioned changeset manifests.
- **MIGRATION IMPACT**: Post-MVP catalog tooling.

### 3.8 Multi-Accent Phonetics & Audio
- **CURRENT (`FACT`)**: `sentences` links to `audio_assets`. Words lack dedicated multi-accent phonetic records (`ipa_us`, `ipa_uk`, `en_AU`).
- **KEEP (`FACT`)**: Sentence-level audio asset linking.
- **PROBLEM (`FACT`)**: Brain and Review UI cannot display standardized IPA or play isolated pronunciation audio for lemmas.
- **V2 PROPOSAL**: Dedicated `phonetic_transcriptions` entity storing verified IPA and normalized audio assets per accent.
- **MIGRATION IMPACT**: Additive table in migration `0014`.

### 3.9 Memory & Scheduling (py-fsrs 6.3.2)
- **CURRENT (`FACT`)**: Managed by `FsrsSchedulerAdapter` in `services/api/src/lingua_api/memory/scheduler.py` using `py-fsrs 6.3.2` with 21 model weights.
- **KEEP (`FACT`)**: py-fsrs 6.3.2 as the single authoritative algorithm. Single primary FSRS memory lineage per `(user_id, concept_id)`.
- **PROBLEM (`FACT`)**: Proposed SQL views in earlier drafts attempted to duplicate FSRS math with hardcoded FSRS-4.5 constants ($19/81, -0.5$), creating mathematical drift against py-fsrs 6.3.2 ($w_{20}$ decay, $0.9803$ factor).
- **V2 PROPOSAL**: Retain Python py-fsrs 6.3.2 as the sole authoritative calculation engine. Database views project dynamic retrievability using exact py-fsrs 6.3.2 parameters ($w_{20}$ decay exponent, integer elapsed days).
- **MIGRATION IMPACT**: Verified mathematical alignment in migration `0016`.

### 3.10 Competence & Evidence Ledger
- **CURRENT (`FACT`)**: `learning_events` stores active interactions; `user_concept_states` stores Bayesian Beta distributions on `recognition`, `listening`, `production`.
- **KEEP (`FACT`)**: Append-only event ledger and Beta-binomial mass accumulation.
- **PROBLEM (`FACT`)**: Mastered items stagnate indefinitely without temporal retrievability decay into `at_risk`.
- **V2 PROPOSAL**: Dynamic `effective_status` projection combining Bayesian competence with decaying retrievability.
- **MIGRATION IMPACT**: Additive projection view in migration `0016`.
