# KNOWLEDGE V2 REMAINING EXECUTION MAP

Status: ACTIVE EXECUTION MAP  
Date: 2026-09-27  
Authoritative source checkpoint: `d8658c83640df88af789c915f985f921d851bc7f`  
Hosted predecessor at discovery: application registry `0014`; `0015`, `0016`, and `0017` were subsequently applied and gated one at a time.

## Authority and compatibility rules

This map reconciles `MASTER_PROJECT.md`, `DECISIONS.md`, the executable contract and migration
history, `docs/knowledge-v2/MASTER-SPEC.md`, documents `00` through `14`, and the actual services,
tests, and accepted FRLL boundary at the source checkpoint above. When prose describes an older
candidate shape, accepted ADRs, the checked-in contract, migrations, and executable repository truth
win.

The remaining authoritative roadmap is K2-04 through K2-10. K2-01 through K2-03 are prerequisites,
not remaining implementation waves.

## Current execution checkpoint — 2026-10-08

- K2-08 remains DONE with full hosted acceptance, cleanup, fresh retained comparison, and independent final review PASS; see `STATUS.md` and `reviews/K2-08-auth-cleanup-boundary-review.md`.
- K2-09 product source, independent product review, exact-head CI, merge, and deployment remain PASS as recorded below. Backend base HEAD is `4d07a6d1ff6c62f27561eeb3f111f77f83ced261`. The separate 18-path Node/harness packet is committed and pushed on isolated branch `codex/k209-hosted-fixture-control` at `ea53d57f35fe0a3cd94a6dec5f038419a702d8e1`; raw aggregate SHA256 `7f00b0daea3230d4531b16a297db9ee78552a034c92ce2d725fce34abb8ef7ed` matches the Git-LF manifest. Source diff against base SHA256 `6ac04cc2e71cab807c7ff904aa93a699574d19a5794065c059bc52d86d321b7d`, 193,568 bytes. Independent GPT-6 Luna / Max review passed with no HIGH/BLOCKER, independently recomputed the manifest, and ran 22 focused tests. Writer-reported broader checks include 158 Vitest tests across five files plus tsc, ESLint, and diff check passing; Ruff and 31 probe pytest checks remain passing from the prior freeze. Exact-head CI remains pending.
- Migration `d4faf92` is isolated but has not been applied. The latest read-only hosted metadata check at 2026-10-07 18:48:19 UTC observed application registry count 20/head 0020 and private-schema absence; remote master and Render health/source SHA remained the existing product merge `7bc877b85bf643af21498da0ba44e2c157e0ae03`. Registry state and the fresh 44-FK metadata inventory are recorded in `reviews/K2-09-hosted-fixture-source-migration-gate-review.md`. The scoped recovery JSON is metadata-only and accepted solely for additive 0021 recovery comparison; it is not a full backup or a hosted-down waiver. Migration/security/registry checks, deployment attestation, and full hosted fixture acceptance/cleanup/retained comparison remain pending; no hosted writes have occurred.
- K2-10 remains BLOCKED until K2-09 full hosted acceptance and cleanup/retained comparison pass. Migration 0020 and accepted K2-06/K2-07 behavior remain unchanged.

## Historical execution checkpoint — 2026-10-02

- K2-08 is DONE: full hosted acceptance, cleanup, current-run retained comparison, and independent final review PASS. See the current K2-08 checkpoint in `STATUS.md` and `reviews/K2-08-auth-cleanup-boundary-review.md`.
- K2-09 product source is frozen at the 16-file diff SHA256 `e03a501398cd4c89495c576844afb3935c9e5aa43a7490372014aa5068f245e5`; independent GPT-6 Luna / Max source review PASS with no HIGH/BLOCKER. PR #43 merged at `7bc877b85bf643af21498da0ba44e2c157e0ae03`. Exact tested PR head `29da9f8b7f96a3d2ca8c8c3de4fd02b51d6dde65` passed Security Gate `37013641196` and all six Knowledge Audit jobs in `37013641469`; CI summaries are in `reviews/K2-09-dictionary-normalization-source-review.md`. Vercel Preview `6809598033` passed on the PR head. Render `dep-davr78rm8hqs73ccnee0` and Vercel Production deployment `6809699550` are healthy/successful against merged SHA `7bc877b85bf643af21498da0ba44e2c157e0ae03`. Implementation-worker local checks are separately recorded; independent reviewer did not rerun them. Query-plan performance remains unmeasured.
- K2-09 hosted fixture architecture has conditional design-only PASS after the 75-day terminal receipt policy and strict exact-run idempotency/reaper guards were recorded. This does not authorize fixture implementation or hosted writes. Exact private DTO/spec review, implementation, migration/security gate, and hosted acceptance remain pending. See `plans/TASK-K2-09-hosted-fixture-control.md` and `reviews/K2-09-hosted-fixture-architecture-review.md`.
- K2-10 remains blocked on K2-09 hosted acceptance. Migration `0020`, accepted K2-06/K2-07 behavior, and the importer’s existing one-candidate/one-sense format remain unchanged.

## Recorded contradictions and resolutions

1. **Migration number collision.** The design documents reserve `0016` for learner
   retrievability, but accepted repository history uses `0016_knowledge_v2_graph_dag` for K2-03.
   Historical migrations are immutable. K2-05 will therefore use the next free migration number,
   `0017`.
2. **K2-01/K2-03 allocation drift.** The migration plan places graph DDL in `0014`, while actual
   `0014` contains the three canonical subtype tables and actual `0016` owns `concept_edges` and the
   DAG trigger. The actual chain is authoritative.
3. **Learner status vocabulary drift.** Knowledge V2 prose uses five statuses including `at_risk`.
   Accepted ADR-015, persistence, OpenAPI, and runtime use eight statuses:
   `unseen`, `discovered`, `learning`, `familiar`, `active`, `mastered`, `weak`, `forgotten`.
   K2-05/K2-08 will express decayed/at-risk behavior through the accepted `weak`/`forgotten`
   vocabulary; they will not silently introduce a ninth public status.
4. **Learner-state column drift.** Design examples use `rec_alpha`, `rec_beta`, and related names.
   Actual replayable competence state stores evidence mass and projections under the accepted
   TASK-006D schema. K2-05/K2-06 must build on those real columns and parameter lineages.
5. **FSRS column and parameter drift.** Design SQL hard-codes defaults and names
   `last_reviewed_at`; actual history uses `last_review_at` plus immutable
   `fsrs_parameter_sets.parameters`. K2-05 must derive decay from each row's versioned 21 weights;
   pinned py-fsrs 6.3.2 fixes the retrievability factor at a `0.9` reference point, while desired
   retention affects future interval selection and does not enter current retrievability.
6. **Brain/FSRS public-boundary drift.** Older design text suggests exposing raw stability,
   difficulty, and retrievability. The accepted public contract explicitly keeps those private.
   Internal projections may use them; K2-04/K2-05 will not expose raw FSRS values.
7. **Graph taxonomy ambiguity.** The taxonomy calls `hyponym_of` acyclic, while the executable
   trigger contract names only `prerequisite_of`, `part_of`, `hypernym_of`, and `derived_from`.
   K2-03 followed the executable four-type contract. Reconciliation is documented; later waves
   must not silently alter the accepted trigger.
8. **Stale K2-02/K2-03 status prose.** `STATUS.md` and `TASKS.md` name tables/functions that are not
   in the accepted migrations. Final documentation must describe `concept_senses` and
   `fn_check_concept_edges_acyclic()` exactly as implemented.
9. **RLS posture conflict.** The design suite assumes RLS on all tables, but accepted hosted
   architecture currently relies on revoked schema/table/function privileges for many
   service-role-only tables. No unrelated blanket RLS change belongs in K2-04 through K2-09; this
   remains separately reviewable hardening unless a wave directly requires it.
10. **Stale absolute test totals.** K2-10 cites 512 backend and 711 frontend tests, while accepted
    master reports newer suite partitions/totals. K2-10 uses the tests discovered at execution time
    and reports exact executed counts rather than forcing obsolete totals.

Historical execution checkpoint — 2026-10-01: K2-04 through K2-06 are accepted predecessors;
K2-07 source, hosted acceptance, cleanup, and retained-state comparison are PASS at master
`c696ac935852c4ebcd9e1183521996e5b12ad273`. K2-08 is READY to begin; K2-09 and K2-10 remain
sequentially downstream. K2-07 staging exercised self-recall and typing; listening and cloze
remain untested because eligible published staging material is unavailable. See
`reviews/K2-07-hosted-acceptance-review.md` for bounded acceptance evidence.

## K2-04 — Grammar Specifications and Brain Integration

- **Exact objective:** hydrate first-class grammar formulas, syntactic categories, communicative
  functions, structural slots, Vietnamese explanations, and common traps; include them in Brain
  concept detail without weakening the existing read-only learner projection.
- **Schema impact:** no new schema is expected; `0014` already owns
  `grammar_specifications`. Data hydration is canonical catalog data, not learner data.
- **Domain/service impact:** add a typed grammar-detail projection and a bounded Brain repository
  query keyed by visible grammar concept; preserve synthetic learner state and read-only snapshots.
- **Importer impact:** extend the hash-gated catalog plan/apply path or add an equivalently
  deterministic, provenance-preserving grammar-spec manifest. Reapply must be idempotent and
  collision-sensitive.
- **API impact:** intentional additive OpenAPI change to Brain concept detail with an optional
  grammar details envelope; regenerate shared types and verify freshness.
- **Frontend impact:** Brain detail must render grammar formula, pragmatic function, Vietnamese
  explanation, traps, and slots only when supplied. No fabricated lexical definition/POS.
- **Migration required:** **NO** for schema; canonical data import required and versioned in source.
- **Security impact:** browser roles retain no direct table access; grammar data is read only via
  authenticated backend actor context. No learner identifier enters canonical records.
- **Learner-state impact:** none. Brain GET and grammar import must leave every learner/private table
  unchanged.
- **Dependencies:** K2-03 staging PASS; accepted `0014` schema; Brain v1 and OpenAPI contract.
- **Required tests:** importer identity/idempotency/collision/provenance; repository and route tests
  for grammar/non-grammar/hidden concept; OpenAPI generation/freshness; frontend adapter/render and
  malformed-envelope fail-closed tests; full affected backend/frontend regression.
- **Hosted acceptance:** all eight accepted starter grammar concepts have complete specs; a staged
  grammar Brain request returns non-empty formula and Vietnamese explanation; a lexical concept has
  no grammar envelope; browser privileges and learner snapshot are unchanged; Render health and
  authenticated Brain smoke pass.

## K2-05 — Dynamic Retrievability Projection

- **Exact objective:** add an internal learner-concept retrievability projection mathematically
  equivalent to py-fsrs 6.3.2 and provide decay-aware effective status using accepted status names.
- **Schema impact:** create `v_learner_concept_retrievability` and only the covering index(es) proven
  necessary by `EXPLAIN`; use real `fsrs_states`, `review_items`, `user_concept_states`, and
  immutable parameter-set lineage.
- **Domain/service impact:** add typed internal repository access for Today/Brain consumers; Python
  FSRS remains the scheduling authority and the view remains a projection.
- **Importer impact:** none.
- **API impact:** none by default. Raw stability, difficulty, parameters, and retrievability remain
  private under the frozen contract.
- **Frontend impact:** none.
- **Migration required:** **YES — `0017`**, with `.up.sql` and `.down.sql`, registry checksum,
  privilege closure, clean apply, predecessor apply, rollback/reapply, and learner-delta proof.
- **Security impact:** revoke view access from `PUBLIC`, `anon`, `authenticated`, and
  `authenticator`; grant only the backend service role required by the repository. Inspect owner,
  schema usage, view/table grants, and any function execution.
- **Learner-state impact:** read-only projection only; no learner row mutation or status rewrite.
- **Dependencies:** K2-04 reviewed/staged; immutable FSRS parameter lineage from migration `0002`.
- **Required tests:** property/equivalence tests across parameter sets, integer elapsed-day
  behavior, new/unreviewed cards, zero/invalid stability guards, decay thresholds mapped to
  `weak`/`forgotten`, view ownership/privileges, latency plan, migration rollback/reapply, and
  learner isolation.
- **Hosted acceptance:** exact `0017` checksum; Python/SQL relative error below `1e-6` for hosted
  fixtures; deterministic threshold cases; acceptable query plan/latency; browser denial/backend
  access; unchanged learner row versions and counts.

## K2-06 — Tripartite Competence and Dynamic State Reconciliation

**Wave status: SOURCE PROMOTED: PASS / HOSTED ACCEPTANCE: PASS (2026-09-27).**

- **Exact objective:** complete the specification-defined recognition/listening/production Beta
  update and dynamic curricular-state behavior while preserving accepted TASK-006D replay
  authority and eight-status contract.
- **Schema impact:** two bounded cleanup-only persistence fixes were required after staging proved
  that TASK-006E's append-only guards and `ON DELETE RESTRICT` prevented disposable Auth actor
  cleanup. Migration `0018_profile_replay_auth_erasure` permits replay cleanup only inside a nested
  Auth deletion cascade after the Auth identity is absent; migration
  `0019_concept_save_intent_auth_erasure` applies the same narrow rule to
  `concept_save_intents`. Active identity mutations remain immutable. No competence, event-ledger,
  or retrievability schema changes.
- **Domain/service impact:** reconcile retrievability-aware derivation at read/planning boundaries;
  do not replace the existing projector or mutate historical evidence.
- **Importer impact:** none.
- **API impact:** none.
- **Frontend impact:** none.
- **Migration required:** **YES — `0018_profile_replay_auth_erasure` and
  `0019_concept_save_intent_auth_erasure`**, limited to the proven Auth-cleanup invariant; no
  competence persistence or learner evidence changes.
- **Security impact:** preserve actor-scoped projection reads/writes, anti-IDOR, replay ownership,
  and append-only event authority.
- **Learner-state impact:** runtime review/evidence flows intentionally update owned learner state;
  migrations perform no catalog-driven learner changes.
- **Dependencies:** K2-05 projection and accepted ADR-015/TASK-006D competence implementation.
- **Required tests:** Beta bounds and convergence, monotonic uncertainty reduction, dimension
  routing, replay equality, accepted eight-status transitions, temporal weak/forgotten projection,
  actor isolation, idempotency, concurrent no-lost-update, migration rollback/reapply, and FRLL
  Review/Brain regressions.
- **Hosted acceptance:** PASS. CI run #54 passed all three required jobs and Vercel succeeded.
  Migration 0019 was applied after 0018. The authorized disposable Auth actor was removed; aggregate
  counts and row hashes across 27 tracked tables exactly matched the retained learner's pre-delete
  snapshot. No actor-owned residue remained. No Auth UUID or email is recorded in this map.

## K2-07 — Multi-Modal Review Modality Engine

**Wave status: ACTIVE (2026-09-27; branch `feat/k2-07-modality-engine`).**

- **Exact objective:** choose cloze, listening, spelling/typing, or self-recall prompts from the
  weakest eligible competence dimension while retaining exactly one primary FSRS lineage.
- **Schema impact:** none expected; prompt modality is a request/response and evidence attribute,
  not a second scheduler identity.
- **Domain/service impact:** add a deterministic prompt selector and canonical prompt material
  resolver; submit the selected exercise mode through the existing atomic Memory + competence
  transaction.
- **Importer impact:** canonical examples/audio availability must be consumed, not fabricated; no
  importer change unless coverage validation is needed.
- **API impact:** use the existing `GET /v1/review/queue` modality and bounded prompt envelope
  (the old roadmap calls it `/v1/review/items`); add optional `exerciseMode` to the answer request
  so selected modality participates in the idempotency fingerprint and exact retry.
- **Frontend impact:** render and answer each supported modality, preserve pending-answer
  idempotency and actor-epoch protections, and never calculate FSRS/client competence.
- **Migration required:** **NO**.
- **Security impact:** all material is resolved server-side from the owned review item; clients
  cannot select another concept/user or create a second lineage. The answer mode is fingerprinted
  for exact replay; older clients omit it and retain the `self_recall` default.
- **Learner-state impact:** answers intentionally update one FSRS state and the matching competence
  dimension atomically; queue reads remain side-effect free.
- **Dependencies:** K2-06 and existing Review/Memory FRLL boundary.
- **Required tests:** deterministic modality choice/ties/fallbacks; missing audio/example fallback;
  one-lineage constraints; atomic rollback; replay/conflict; concurrent answer locking; contract
  generation; frontend rendering/keyboard/pending-receipt/actor isolation; FRLL Phase D/R1.
- **Hosted acceptance:** one disposable actor receives multiple eligible modality envelopes over
  controlled fixtures without duplicate lineage; each answer updates the matching competence
  dimension and one FSRS lineage; replay and cleanup pass.

## K2-08 — Today Engine Heuristic V2, Remediation First

**Readiness: READY (2026-10-01).** K2-07 hosted and retained-state comparison gates passed at
the current master checkpoint. Start with the existing Today v1 authority and compatibility
rules in `docs/TODAY_ENGINE_HEURISTIC_V1.md`, its implementation record in
`docs/TODAY_ENGINE_IMPLEMENTATION_V1.md`, and accepted K2-08 objective below. Keep the first
implementation bounded to policy/candidate ranking and allocation plus focused tests. Verify
the actual repository contracts, persistence, and existing tests before deciding whether any
contract change or migration is needed; none is assumed by this plan. Preserve Today v1 behavior,
actor/profile scoping, repeatable-read generation, deterministic same-input output, daily budget
and content anti-starvation, and zero writes to learner evidence, FSRS, or competence. Required
verification includes disposable PostgreSQL coverage for persistence/concurrency and the Today
Phase C regression; hosted acceptance remains a later gate, not part of readiness.

- **Exact objective:** deterministically pack due review and decayed weak/forgotten remediation
  ahead of new curriculum work, within the learner's persisted daily budget and existing content
  anti-starvation policy.
- **Schema impact:** none expected; reuse persisted Today snapshot/activities and diagnostics.
- **Domain/service impact:** version a new Today policy and candidate ranking/allocation logic;
  consume K2-05 effective status without making Today an FSRS or competence authority.
- **Importer impact:** none.
- **API impact:** existing reason-code arrays can carry new versioned remediation codes; update
  enums/contracts only if currently closed rather than free strings.
- **Frontend impact:** render authoritative reason text/codes already returned by the server; no
  client packing logic.
- **Migration required:** **NO** unless an immutable database policy seed is required by current
  persistence conventions.
- **Security impact:** preserve actor/profile scoping, repeatable-read generation, and 404
  existence hiding.
- **Learner-state impact:** plan generation may create the accepted owned Today snapshot only; it
  must not create learning evidence, activate memory, or rewrite competence.
- **Dependencies:** K2-05 through K2-07; accepted ADR-017 Today v1 invariants.
- **Required tests:** 15-minute/20-overdue case yields no new work; weak/forgotten ordering; stable
  ties; budget caps; content reserve behavior; same-state idempotency; concurrent same-day
  generation; reason mappings; actor isolation; Today Phase C regression.
- **Hosted acceptance:** disposable controlled backlog produces the expected review/remediation-first
  plan and identical replay; only expected Today rows are created; evidence/FSRS/competence remain
  unchanged; cleanup succeeds.

## K2-09 — Dictionary Normalization and Single-Lemma Sense Search

- **Exact objective:** resolve normalized lemmas and inflected forms to one lemma identity and all
  linked senses/concepts, with independent learner mastery/status/save badges.
- **Schema impact:** none expected; use `lexemes`, `lexeme_forms`, `word_senses`, and
  `concept_senses`. Add an index only through a reviewed migration if query-plan evidence requires
  it.
- **Domain/service impact:** preserve matched lexeme identities and approved `concept_senses`
  bridges, with legacy direct `lexemes.concept_id` fallback only when a concept has no bridge rows.
  Canonical/detail lookup prefers the approved direct lexeme; secondary fallback uses only that
  concept’s own approved bridge in deterministic order. Detail definitions come only from that
  concept’s bridge, with legacy direct fallback only when it has no bridge rows; never return
  sibling-concept senses. Preserve accepted Brain learner projection semantics.
- **Importer impact:** K2-09 keeps the current importer candidate format and apply semantics
  unchanged. Run its existing form-deduplication, no-overwrite collision, provenance, deterministic
  plan/hash, and idempotent-reapply checks; document the production-starter importer’s one
  concept-linked lexeme / one order-1-sense limitation. Do not add a shared-lemma or multi-sense
  candidate/import format here; any such change needs a separate explicit future specification
  and review.
- **API impact:** likely additive grouped lemma/sense response. Preserve existing endpoint path and
  authenticated actor-scoped learner enrichment; perform normal OpenAPI generation/freshness.
- **Frontend impact:** Dictionary renders one lemma group with ordered senses and independent
  mastery/save state; existing explicit Save/Learn remains the only activation boundary.
- **Migration required:** **NO** by default; **YES, next free number**, only if measured index needs
  cannot be met by existing indexes.
- **Security impact:** dictionary remains backend-only, provenance-filtered, authenticated, and
  existence-safe; browser gets only contract DTOs.
- **Learner-state impact:** search/detail are side-effect free; explicit Save/Learn semantics remain
  ADR-022 and are not broadened.
- **Dependencies:** K2-02 bridge plus K2-04 through K2-08 contract/runtime state.
- **Required tests:** exact lemma, case/whitespace normalization, inflection (`went` to `go`), one
  shared lemma with multiple ordered senses/concepts, independent Brain-derived status/mastery/
  competence and actor-owned saved badges, cursor stability, existing importer collision/form
  deduplication/provenance/idempotency regressions (no new import semantics), no search-side writes,
  actor isolation, contract/frontend grouping, Dictionary/Brain canonical-detail regression, and
  Library/Reader regressions. Extend CI path selectors/triggers and disposable-PostgreSQL
  integration commands to execute the Dictionary source and its focused database API tests.
- **Hosted acceptance:** live catalog feasibility found 94 eligible approved English lexemes, none
  with at least two approved senses and at least two approved linked concepts, and zero approved
  `went` forms. A controlled fixture is required. Fixture architecture and exact private DTO/spec
  review have passed design gates. Bounded local setup/inspect/cleanup source is frozen and independently
  reviewed PASS; migration/security gate, exact-head CI, deployment, and hosted acceptance remain pending.
  No hosted fixture writes are authorized.
  Implementation must retain atomic exact-tree guards, parent locks, all-reference checks across the
  44-FK inventory, strict same-run idempotency, and cleanup after authoritative GitHub run-attempt
  checks. Actor behavior remains normal HTTP/JWT/RLS; search writes nothing, explicit save activates
  only the chosen concept, and the existing 27-table retained comparison remains required. No roles,
  grants, Auth, RLS, or SECURITY DEFINER changes.

## K2-10 — End-to-End Verification and Documentation Seal

- **Exact objective:** prove the full Knowledge V2 system and historical FRLL boundary, reconcile
  project truth, and produce the final acceptance record.
- **Schema impact:** none; verification only.
- **Domain/service impact:** none beyond fixes required by discovered defects.
- **Importer impact:** execute clean deterministic import and reapply/collision checks.
- **API impact:** validate final OpenAPI/runtime conformance and generated freshness.
- **Frontend impact:** run complete applicable frontend, production build, and Storybook gates.
- **Migration required:** **NO new feature migration**; apply the entire existing chain from `0001`
  to final on clean PostgreSQL and the supported upgrade path from the staging predecessor.
- **Security impact:** final owner/schema/table/view/function/trigger privilege audit; document RLS
  and leaked-password posture without unrelated privilege expansion.
- **Learner-state impact:** prove no unintended migration/import mutation and run disposable actor
  acceptance with fail-closed cleanup.
- **Dependencies:** locally reviewed and hosted PASS for K2-01 through K2-09.
- **Required tests:** full backend, migration, property/concurrency, Ruff, format, mypy, OpenAPI,
  generated freshness, frontend Vitest/typecheck/lint/build/Storybook, support tests, live FRLL
  phases, actor isolation, production dependency audit, and clean checkout checks.
- **Hosted acceptance:** GitHub master, Supabase migration head, Render SHA, and Vercel SHA when
  frontend changed all identify the same accepted source; health/API/Brain/Review/Today/Dictionary
  smoke pass; canonical counts/import hashes and learner deltas are recorded; fixtures are absent;
  `STATUS.md`, `TASKS.md`, plans, and final acceptance evidence agree.

## Sequential promotion rule

Each wave follows: bounded plan → tests first → implementation → local verification → external
read-only review pack → fix/reverify → `K2-XX LOCAL REVIEWED: PASS` → source promotion → one hosted
change at a time → security/learner/smoke/cleanup gate → `K2-XX STAGING: PASS`. A failed gate stops
all dependent waves.
