# LINGUA OS — Architecture and Product Decisions

Accepted decisions are durable unless explicitly superseded.

## ADR-001 — PostgreSQL first
Status: ACCEPTED

Use PostgreSQL as the primary data store. Model concept relationships relationally before introducing a dedicated graph database.

## ADR-002 — Language Brain is core from v0.1
Status: ACCEPTED

The learner-state model exists from the first MVP even though only a subset of future dimensions is active.

## ADR-003 — One primary FSRS lineage per learner/concept in MVP
Status: ACCEPTED

Recognition, listening and production are separate evidence/confidence dimensions, but MVP does not run three independent review schedulers per concept.

## ADR-004 — AI is deferred and provider-based
Status: ACCEPTED

AI Tutor and generated lessons are post-MVP. Any AI integration must sit behind a provider boundary and must not become a core dependency.

## ADR-005 — Realtime pronunciation scoring is post-MVP
Status: ACCEPTED

Speech/pronunciation architecture may define interfaces, but realtime scoring/forced alignment does not block v0.1.

## ADR-006 — English for Vietnamese first
Status: ACCEPTED

MVP serves Vietnamese learners of English, roughly A0–B1. Architecture remains multilingual-aware, but Chinese/Japanese learning modes are deferred.

## ADR-007 — OpenAPI is the public API source of truth
Status: ACCEPTED

Frontend mocks/types and backend implementation must agree with the versioned API contract.

## ADR-008 — Content provenance is first-class data
Status: ACCEPTED

Imported/curated content must retain source, license/attribution metadata, quality status and review state where applicable.

## ADR-009 — Starting Level Estimate is not certification
Status: ACCEPTED

Initial placement is an estimate with confidence and is recalibrated by behavioral evidence. The product must not present it as an official CEFR certificate.


## ADR-010 — Superpowers is the approved engineering-process skill
Status: ACCEPTED

Backend and frontend workstreams may use Superpowers for planning, TDD, debugging, review and verification. Superpowers does not override project specifications, contracts or accepted decisions.

## ADR-011 — Approved specs are locked design by default
Status: ACCEPTED

Agents must not repeatedly reopen approved product or architecture decisions through brainstorming. Brainstorming is reserved for unresolved gaps, conflicts, materially new decisions or explicit human requests.

## ADR-012 — Separate worktrees for parallel agent implementation
Status: ACCEPTED

After Git initialization, prefer separate backend and frontend branches/worktrees for concurrent work. Integrate through verified commits so agents do not overwrite each other's uncommitted changes.

## ADR-013 — External skills are advisors, never authorities
Status: ACCEPTED

UI UX Pro Max and Superpowers are approved advisors. The authority order in `MASTER_PROJECT.md` always applies.

## ADR-014 — FSRS-6 backend implementation and parameter lineage
Status: ACCEPTED

Use the maintained MIT-licensed `py-fsrs` package, pinned at `6.3.2`, as the backend FSRS-6
implementation. The MVP starts with one immutable global parameter set,
`fsrs6-global-default-v1`, based on the upstream FSRS-6 defaults with deterministic fuzzing
disabled. Every memory state and review event references the exact parameter-set ID/version used.
Changing the default applies to new lineages only unless a later accepted migration explicitly
reschedules existing lineages. One learner/concept continues to have exactly one primary memory
lineage; presentation/evidence modes never create independent schedulers.

## ADR-015 — Replayable learner evidence and competence projection v1
Status: ACCEPTED

Use immutable, actor-owned learning events and an immutable parameter-set lineage to derive
recognition, listening and production through the deterministic reliability-weighted Beta model
defined in `docs/LEARNER_EVIDENCE_COMPETENCE_V1.md`. Confidence is derived independently from
effective evidence mass. Passive exposure records opportunity but does not change competence.
Server-assigned ingestion sequence is authoritative for projection and replay. Competence owns
ConceptStatus and mastery projections but never owns FSRS state, due dates, or scheduling; exactly
one learner/concept memory lineage remains intact.

The TASK-006D domain-policy audit and concept/profile authority reconciliation are approved.
`user_concept_states` is the sole learner × concept competence projection;
`user_skill_states` is a separately rebuildable language-profile aggregate and must never feed
concept competence.

## ADR-016 — Reader/content MVP contract boundaries
Status: ACCEPTED

Reader v1 uses authoritative published catalog identities and segment-level resume state. Sentence
saving is catalog-only and never accepts client-selected concept IDs. Progress and passive exposure
are separate idempotent commands: progress never creates competence evidence, while one eligible
Reader exposure source fact may derive one canonical passive learning event per distinct
server-resolved concept. Page open, viewport entry, rerender, refresh, reconnect, and scrolling
mechanics do not independently constitute evidence.

Only reviewed English A0-B1 content whose complete visible dependency graph has approved
provenance, representable attribution, and `allowed` licenses may be published. Restricted,
unknown, prohibited, or incomplete dependency provenance cannot pass the gate. First-party content,
conditional Tatoeba text, and conditional pinned `ipa-dict` `en_US` are the MVP source candidates;
Wiktionary/Wiktextract, `wordfreq`, Tatoeba audio, and other `ipa-dict` locales remain held pending
explicit provenance/license approval. The exact policy and contract/database responsibility map are
frozen in `docs/READER_CONTENT_MVP_V1.md`.

## ADR-017 — Deterministic persisted Today orchestration v1
Status: ACCEPTED

Today uses immutable policy `today-heuristic-v1` and one persisted plan per learner × English
language profile × learner-local date. It consumes authoritative Review order, competence
projections, Content ordering, Reader progress/exposures, and Library membership without becoming
another authority for them. Generation captures one UTC `asOf`, runs in a PostgreSQL
repeatable-read transaction, uses stable identity tie-breaks, and relies on database uniqueness for
concurrent same-day correctness.

Goal relevance is neutral. The policy uses an 8-minute content anti-starvation reserve, a 4-unseen
cap for newly recommended content, and a 48-hour recent window scoped to novel selection. Runtime
emits only review/read/listen; standalone learn, Starting Level estimation, FSRS, competence, and
recommendation formulas are not implemented in Today. Completion is derived from accepted
Review/Reader facts and stored only as idempotent coordination metadata. Implementation and edge
semantics are recorded in `docs/TODAY_ENGINE_IMPLEMENTATION_V1.md`.

## ADR-018 — Language Brain read-only projection contract v1
Status: ACCEPTED

Language Brain is an authenticated, read-only relational composition surface over existing
learner, competence, Memory, catalog, and saved-concept authorities. Brain concept summary/detail
expose the authoritative TASK-006D `mastery` as a required nullable field and aggregate concept
`confidence` as a required bounded value, while recognition/listening/production retain separate
score, confidence, and evidence count. Null mastery is never converted to a numerical fallback.

`BrainSummary.memoryHealth` is required nullable until a separate authoritative versioned metric
is approved; Brain must not invent one. Synthetic zero-evidence state is score 0.5, confidence 0,
evidence count 0, mastery null, aggregate confidence 0, and unseen status unless passive exposure
has already established discovered status. Brain GET operations never persist that synthetic
state. Missing and non-owned explicit language profiles share existence-hiding 404 semantics.
Collection reads remain learner-anchored, use the exact eight ConceptStatus values, and paginate
with an opaque server-controlled keyset cursor. The complete frozen boundary is recorded in
`docs/LANGUAGE_BRAIN_PROJECTION_API_V1.md`.

## ADR-019 — Central application-identity bootstrap and derived onboarding readiness v1
Status: ACCEPTED (domain and contract/persistence semantics; migration/runtime separately gated)

Use verified Supabase JWT `sub` as the stable identity shared by `auth.users.id` and
`public.users.id`, while keeping credentials, sessions, providers and mutable authentication state
under Supabase Auth. `GET /v1/me` is the only operation allowed to atomically and idempotently
materialize the minimal LINGUA Application User plus Learner Profile; it never creates a Language
Profile, evidence, assessment, or Today state, and no other product GET performs bootstrap.

New learners must explicitly persist a valid IANA timezone before creating the one activated MVP
vi→en Language Profile with a required daily target. Onboarding readiness is derived from current
learner/profile state rather than a duplicated completion boolean, and Starting Level remains
optional. Profile edits use revision-backed strong ETags, language creation uses persisted
Idempotency-Key replay, and missing/non-owned explicit Language Profiles share 404 semantics. The
bootstrap response is `private, no-store`; downstream operations never bootstrap. Email is an
optional value from the currently verified JWT claim and is never an identity key or product-table
copy.

Historical evidence does not prove that `user_languages.interface_language_code` is identical to
native language, so the future migration must preserve it and add a distinct
`native_language_code` authority. A Language Profile is one lifetime row per actor/target and an
archived row is reactivated rather than recreated. Missing/malformed/stale `If-Match` uses the
existing 412 `PRECONDITION_FAILED`; learner and language resources own separate monotonic revisions,
with nested language mutations also advancing the composite `/me` revision. Exact language-create
replay persists the original data snapshot and ETag under actor-scoped idempotency. The complete
boundary and exact contract/future migration shape are recorded in
`docs/PROFILE_LANGUAGE_AUTH_BOOTSTRAP_V1.md`; migration and runtime still require separate approval.

## ADR-020 — Bounded isolated Starting Level Estimate v1
Status: ACCEPTED (contract, scoring policy, and persistence shape; migration/runtime separately gated)

Starting Level is a confidence-qualified initial content-starting estimate, not formal CEFR
certification, IELTS prediction, permanent proficiency, Brain mastery, FSRS state, or psychometric
IRT. Immutable policy `starting-level-heuristic-v1` uses deterministic A1/A2/B1 primary and
verification gates to return only A0/A1/A2/B1; A0 is LINGUA's project-defined pre-A1 starting
band. Exact slot order, 3/4 primary pass, 6/8 verified pass, 8/12/16-item branching, and the
two-decimal confidence formula capped at 0.85 are frozen in
`docs/STARTING_LEVEL_ESTIMATE_V1.md`.

Assessment is optional. Pre-start skip creates no result, completed attempts cannot be retaken in
v1, and latest immutable completed result is current without overwriting a self-estimated profile
level. Attempts snapshot their selected questions, answer authority, order, and policy version;
responses and results are append-only historical facts with PostgreSQL-enforced single-active
attempt and exact start/answer replay. Objective listening comprehension is required in every
bundle; it does not infer speaking, pronunciation, or production, and an unavailable valid audio
slot fails closed rather than changing the published template.

Assessment evidence remains isolated: TASK-016 writes no learning events, competence projections,
ConceptStatus, mastery, Review, or FSRS state and reuses no TASK-006D weight. It produces no Today
or Content ranking change. Migration `0008` and runtime require a separate approval after this
contract/policy/persistence freeze.
# TASK-008A — Dictionary and Reader Analyze v1

Reader Analyze uses the approved `reader-analyze-leftmost-longest-exact-v1` policy. Matching is
left-to-right, earliest-start and longest-span first, with normalized-form then concept-ID tie
breaking. Matches are exact catalog lexemes/forms, sentence-local, Unicode-boundary aware, and
side-effect free; source offsets remain UTF-16. No fuzzy or semantic inference is permitted.

## ADR-021 — Discoverable Language Profile child ETag (TASK-017A)
Status: ACCEPTED (user-approved post-freeze contract correction)

TASK-017 exposed a genuine TASK-006E usability defect: collection discovery returned
archived Language Profiles without the child ETag required by their existing PATCH.
The approved correction adds required read-only `etag: string` to LanguageProfile,
including collection, nested `/me`, create and update representations. It is an opaque
strong token for that child resource, passed unchanged as child `If-Match`; it is not
the parent `/me` token or a collection response validator. No revision/hash internals
are public. The existing `language_profile_etag` remains the sole algorithm.

Creation replay projects the original child token from the existing historical
snapshot, not mutable current state; no replay row or migration is needed. Ownership
before comparison, strong-only 412 preconditions, no-op stability, independent child
and parent revision rules, and same-ID archive/reactivate lifecycle are unchanged.
Frontend preserves the token through its adapter/view model; stale writes refetch
authoritative profiles and require another intentional action, never a guessed token,
automatic write retry, or duplicate-create fallback. This entry corrects the original
contract and does not erase the recorded TASK-017 blocker history.

## ADR-022 — Explicit Concept Save/Learn Activates Memory (TASK-008B / GAP-01)
Status: ACCEPTED

### Context
GAP-01 identified an architectural disconnection in the system: while the FSRS Memory Engine and scheduler initialization were implemented and tested, they lacked a production caller or trigger boundary. Catalog concepts remained passive or synthetic unless explicitly activated.

### Decision
The sole MVP active-learning activation boundary is `PUT /v1/library/concepts/{conceptId}`, explicitly invoked by the learner as Save/Learn.

### Transaction Coordination
An application-level PostgreSQL transaction (`LibraryApplication.save_concept`) coordinates the transition atomically:
1. Actor and active language profile validation with fail-closed authorization.
2. Library membership recording in `user_saved_concepts` with `ON CONFLICT (user_id, concept_id) DO NOTHING`.
3. First-save intent recorded in `concept_save_intents` with `ON CONFLICT (user_id, concept_id) DO NOTHING`.
4. If this is the concept's first save, ingestion of a canonical `learning.concept.saved.v1` event (`source_type = 'concept_save_intent'`) and incremental projection update setting `has_learning_intent = true`.
5. Memory lineage initialization via `PostgresMemoryEngine.ensure_lineage_in_transaction`.

### Memory Authority
The Memory Engine is the sole authority for FSRS card initialization and scheduling. Exactly one primary review scheduler lineage exists per learner × concept (`review_items` with `UNIQUE (user_id, concept_id)` and corresponding `fsrs_states`). Repeated or concurrent saves/learns never reset existing review items, FSRS stability, difficulty, review count, or due dates (MEM-001 invariant).

### First-Save Intent
`concept_save_intents` is a dedicated, immutable table:
- Durable and historical.
- Enforced immutable at the database layer via `enforce_concept_save_intent_immutability` trigger on UPDATE/DELETE.
- Unique per learner × concept (`UNIQUE (user_id, concept_id)`).
- Preserved across Library unsave and resave cycles.

### Competence Projection
Save/Learn expresses learning intent only. It sets `has_learning_intent = true` (`ConceptStatus.LEARNING` when unevidenced). It contributes zero recognition competence mass, zero listening competence mass, zero production competence mass, and zero correctness evidence. Saving an already-familiar or active concept never downgrades its established status.

### Non-Activation Boundaries
Memory is strictly NOT activated by:
- Passive Reader exposure (`POST /v1/reader/exposures`)
- Reader reading progress (`PUT /v1/reader/progress/{contentId}`)
- Saved sentences (`PUT /v1/library/sentences/{sentenceId}`)
- Saved content (`PUT /v1/library/content/{contentId}`)
- Starting Level Assessments (`POST /v1/assessments`)
- Today planning/orchestration (`GET /v1/today`)
- Dictionary lexical lookup (`GET /v1/dictionary/search`)
- Mere concept discovery or catalog browsing

### Unsave and Resave Semantics
Unsaving a concept (`DELETE /v1/library/concepts/{conceptId}`) removes Library membership (`user_saved_concepts`) only. It does not erase the immutable first-save intent (`concept_save_intents`), the canonical learning event (`learning_events`), the Memory lineage (`review_items`/`fsrs_states`), review history (`review_events`), or competence history. Resaving a previously unsaved concept restores Library membership without creating a duplicate lineage or a duplicate first-save intent.

### Consequences
- Active spaced-repetition scheduling begins only after explicit learner intent, preventing review queues from flooding with passively exposed concepts.
- Historical learning progress survives Library collection curation; removing a concept from the Library does not destroy memory stability or review history.
- Memory remains an isolated scheduling authority, decoupled from Library presentation state.
- Cross-module save requires an atomic PostgreSQL transaction across Library, Competence, and Memory stores.
- Canonical competence replay must reproduce `has_learning_intent` identically from historical `learning.concept.saved.v1` events.

References: TASK-008B, GAP-01, MEM-001, EVID-001.

## ADR-023 — First Real Learning Loop acceptance baseline
Status: ACCEPTED (final independent re-review after infrastructure unblock)

The First Real Learning Loop (FRLL) is accepted as the frozen MVP evidence
baseline. The accepted implementation/evidence HEAD is
`0723c1d7780bc0f6087da81b5ebac764658c3162`. Two fresh, independent checkpoints
were executed after the canonical stack was restarted with the required public
Supabase browser configuration. Each checkpoint passed F1 phases B–E (4/4) and
R1 browser scenarios (4/4), including committed response-loss and exact
same-receipt replay, PostgreSQL exact-once assertions, Actor-B isolation,
passive zero-write behavior, fail-closed cleanup and catalog-anchor survival.

Sanitized evidence is recorded in
`docs/FRLL_CHECKPOINT_EVIDENCE_20260912.md`; raw logs remain outside the
repository under `D:\LINGUA_FRLL_RAW_20260912`. Actor sets are represented only
by truncated SHA-256 hashes. This decision freezes FRLL as a regression
baseline: do not change it for style or refactoring. Reopen only on a real
regression or a newly discovered acceptance defect.

## ADR-024 — Bounded owner content authoring over the existing Reader schema
Status: ACCEPTED

TASK-ADMIN-001 uses the existing Supabase JWT subject plus a server-only, comma-separated UUID
allowlist (`LINGUA_ADMIN_USER_IDS`) as its bounded owner authorization boundary. Missing, empty or
malformed configuration fails closed. This is intentionally not a general RBAC system, and the
allowlist never enters browser configuration or API payloads.

Owner-authored English micro-articles reuse the existing relational Reader/provenance model:
`licenses`, `data_sources`, `source_records`, `content_items`, `content_versions`, `sentences`,
`content_segments`, `sentence_concepts`, `content_concepts`, `content_metrics` and curated CEFR
levels. The fixed `LINGUA-FIRST-PARTY` license is server-created only with allowed usage; explicit
attribution and a rights statement are still mandatory and stored. No schema migration is needed.

Sentence segmentation is deterministic and provider-free. Concept occurrences are derived only
from accepted exact catalog matching already used by Reader Analyze. An unmapped sentence is a
visible validation failure; the system never invents a concept, translation, confidence or CEFR
claim. Validation advances eligible content to `reviewed`, but PostgreSQL's existing Reader
publication trigger remains the final authority for `published`. Published and retired records are
not editable; corrections require a new content identity. Retirement preserves the audit record but
removes it from learner Reader discovery.

The `/admin` route requires authentication but deliberately does not bootstrap learner readiness or
create learner state. All Admin persistence is catalog/content provenance, and tests verify that
learning events, review events and learner concept state remain unchanged.
