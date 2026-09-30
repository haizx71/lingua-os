# TASK-K2-08 — Today Remediation-First Policy v2

Status: SPEC REVIEW PASS FOR BOUNDED POLICY/CI IMPLEMENTATION; HOSTED FIXTURES BLOCKED
Source baseline: `2c3284a2deb4fac18683b660a751039e36b007f7`
Implementation worker: GPT-6 Luna / Max

## Objective

Add a deterministic, versioned Today policy that allocates authoritative due Review work and
eligible decayed weak/forgotten remediation ahead of new curriculum work. Preserve the persisted
daily budget, the accepted eight-minute content anti-starvation reserve, Today v1 plans, and all
learner-state authorities.

## Source precedence

- K2-08 scope comes from `plans/KNOWLEDGE-V2-REMAINING-EXECUTION-MAP.md`.
- Today authority and invariants come from ADR-017 and `docs/TODAY_ENGINE_HEURISTIC_V1.md` /
  `docs/TODAY_ENGINE_IMPLEMENTATION_V1.md`.
- Learner competence semantics come from ADR-015; explicit Save/Learn semantics remain ADR-022.
- Decay classification comes only from K2-05's private
  `public.v_learner_concept_retrievability.effective_status`; Today will not recalculate FSRS,
  competence, retrievability, or status.
- The older `docs/knowledge-v2/08-today-engine.md` proposal conflicts with accepted vocabulary and
  persistence/contracts; its `at_risk`, proposed new activity types, and schema examples are not
  implementation authority.

## Locked boundaries

- Keep `today-heuristic-v1` constants and behavior executable for regression tests. Generate a new
  plan with `today-heuristic-v2` only when no persisted plan exists for that actor/profile/local
  date. Repeated reads of an existing v1 plan return its saved engine version, activity identities,
  order, estimates, and reasons; accepted completion reconciliation and plan lifecycle behavior
  continue.
- Keep the existing `review`, `read`, and `listen` activity kinds, one ordered Review block, the
  current content eligibility/duration caps, stable identities/tie-breaks, and the existing eight-
  minute reserve. Do not add a standalone learn activity or another Review/FSRS lineage.
- Preserve actor/profile/language scoping, repeatable-read generation, unique same-day persistence,
  past/future retrieval-only behavior, 404 existence hiding, and the existing Today completion
  proof/idempotency contract.
- New plan generation may write only accepted Today plan, activity, review-target, and diagnostic
  rows. It must not write evidence, FSRS, competence, Library, Reader, or content state. No schema
  migration is expected.
- Do not modify `STATUS.md` or `TASKS.md` in this task; the K2-07 closeout update has a separate
  owner.
- No hosted state, actor, secret, deployment, or external credential changes are in scope.

## Versioned v2 policy

1. Capture one UTC `asOf` by reading PostgreSQL `transaction_timestamp()` after the repeatable-read
   transaction starts. Reuse it for learner-local date resolution, due Review selection, recent
   exposure, the K2-05 projection's `calculated_at`, diagnostics, and the persisted plan. This
   makes the view's transaction-scoped decay time and all Today candidate reads identical without
   duplicating the K2-05 formula.
2. Read active due Review rows in the existing authoritative `(due_at, review_item_id)` order. Keep
   one minute per selected Review target and never re-rank or mutate Review/FSRS state.
3. Enrich the existing bounded Content candidate set from the Content Engine and actor/profile-
   scoped K2-05 view. Use `effective_status` for weak/forgotten remediation. Exclude every active
   due concept from remediation, including due concepts beyond the bounded Review slice, with a
   candidate-scoped correlated `NOT EXISTS` against the authoritative active-due relation before
   candidates reach the pure policy. Do not materialize an unbounded Review backlog to perform
   this exclusion; the Review query remains budget-bounded and ordered.
4. Keep accepted unfinished-Reader and saved-not-started precedence. Within remediation, rank
   forgotten before weak, then by existing Content source rank and stable content ID. Rank
   remediation ahead of recommended-new curriculum; retain current novelty cap, new-item cap,
   recent window, listening rules, and stable tie-breaks.
5. For plans of at least 15 minutes, reserve up to eight minutes only when suitable unfinished,
   saved, or non-due remediation content can use the reserve. Due Review may consume an otherwise
   unused reserve. Do not spend the reserve on new curriculum while a due Review backlog remains.
   Thus 15 minutes with 20 due items and only new content allocates Review work without new
   curriculum; eligible familiar/remediation content may use the protected reserve.
6. Add the closed public reason codes `FORGOTTEN_REMEDIATION` and `WEAK_REMEDIATION`, followed by
   the existing `CONTENT_FIT` and any applicable existing dimension reason. Provide server-owned
   Vietnamese reason text/labels. Update the Pydantic enum, OpenAPI, `contracts/enums.json`, and
   generated TypeScript in the same change; no client-side ranking logic or DTO shape change.

## Implementation and verification slices

1. Add failing pure-policy tests for the 15-minute/20-due case, reserve behavior, remediation and
   forgotten-before-weak order, stable ties, no duplicate due-concept remediation, reason mapping,
   budget bounds, and v1 golden outputs.
2. Add bounded repository/database tests proving K2-05 effective status is consumed (not copied or
   recalculated), all active due concepts are excluded even beyond the Review prefix, and actor and
   profile isolation remain enforced.
3. Add disposable-PostgreSQL API regressions for v1-plan retention, v2 version persistence,
   same-state idempotency, same-day concurrency, actor/profile 404 isolation, and unchanged evidence,
   FSRS, competence, Reader, and Library snapshots. Update the Today fixture to use the same
   transaction timestamp semantics as production.
4. Keep Today Phase C passing, validate OpenAPI/enums/generated TypeScript freshness, and run scoped
   backend formatting/lint/type checks plus relevant database tests. The current worker environment
   has no Docker daemon, native PostgreSQL tools, or Podman and provides Python 3.13 while CI uses
   Python 3.12. Add a narrowly scoped, credential-free CI job with an ephemeral PostgreSQL service
   that runs `tests/backend/database/test_today_schema.py` and `test_today_api.py`; do not use hosted
   credentials or a shared/hosted database. Report local runtime blocks accurately and do not infer
   disposable-PostgreSQL proof from pure tests.
5. Keep offline Today Phase C support tests passing; do not run the full live Auth/write Phase C
   acceptance from this worker because it requires live credentials and writes. Request independent
   Max review of this plan before runtime source edits, then independent review
   of the implementation and exact tested HEAD before root integration. Hosted acceptance and merge
   remain root-owned later gates.

## Hosted K2-08 plugin and fixture boundary

- Extend only the existing K2 Hosted Acceptance workflow and reusable `K2HostedWavePlugin` runner.
  Add a `k2HostedWaveK208` plugin and an allowlisted wave dispatch. Preserve the current
  `workflow_dispatch`-only trigger, exact repository and `master` ref checks, owner/actor checks,
  minimal permissions, existing Production environment and OIDC audience, and validate the selected
  wave before exposing secrets. Do not create another workflow or alter trusted-source rules.
- The hosted plugin may use only the existing normal, authorized API flow for disposable,
  owner-controlled actors and the controlled catalog. It may seed a due backlog through normal
  Save/Learn operations and seed eligible familiar/saved content through accepted APIs. It must not
  use SQL, a write-capable database credential, a fixture-only write endpoint, forged timestamps,
  changed janitor TTL, real learner data, or manual actor/credential creation.
- Before the Today generation request, capture the actor-scoped baseline after all fixture seeding.
- Root must first obtain a read-only inventory of the live staging catalog through the existing
  hosted orchestration. The committed FRLL seed contains exactly one published English word
  concept and no aligned published sentence/audio fixture; the wider first-party manifests remain
  candidate/proposal data, and `task008_reader_mvp.sql` is a test-only seed. Do not infer live
  staging inventory from those files. If the live accepted catalog lacks the fixture set, report
  that exact gap rather than seed catalog/learner rows through SQL or broaden fixture privileges.
- If live staging has at least 20 accessible published concepts and an eligible saved/unfinished
  content candidate whose supported estimate packs to eight minutes, the due/familiar subcase uses
  a 15-minute profile and 20 due targets. Its expected plan is the seven-item ordered Review prefix
  plus that eight-minute familiar activity, with no new curriculum. Otherwise this subcase remains
  blocked pending a separately reviewed and published controlled catalog fixture; the 15-minute /
  20-due pure-policy regression still proves allocation behavior locally.
- Source review establishes a bootstrap limit for a fresh hosted actor under the default
  per-concept competence policy: `services/api/src/lingua_api/review/modality.py` ranks only
  dimensions with existing evidence and otherwise selects `self_recall`; Save/Learn creates
  learning intent with zero competence evidence. The ordinary fresh-actor Save/Learn + Review flow
  therefore starts with production evidence only. `services/api/src/lingua_api/competence/projector.py`
  requires evidence mass in each required dimension for mastery, and weak/forgotten requires prior
  familiar/active/mastered achievement. More material alone cannot initialize unobserved dimensions
  through this selector. The immutable `concept_competence_policies` table allows a previously
  accepted production-only override to change which dimensions are required; root's read-only live
  inventory has identified possible eligible overrides. Do not create or change an override,
  fabricate mode responses, or bypass the server-selected prompt. A candidate override is only a
  hosted fixture path after its catalog/material eligibility and normal-API achievement-to-weak /
  forgotten sequence are demonstrated with its existing immutable policy.
  K2-05 uses elapsed whole days from PostgreSQL `transaction_timestamp()`. Passive decay therefore
  does not create aged hosted fixtures during one run.
- The hosted remediation-first criterion remains blocked until a root-owned read-only inventory
  confirms an eligible existing immutable override plus content material, and a deterministic
  normal-API sequence proves actor-scoped prior achievement followed by non-due weak/forgotten
  status. Otherwise report the exact bootstrap gap and seek a separately reviewed proposal before
  broadening any fixture surface. Do not claim overall K2-08 hosted acceptance or promote K2-08
  based on due/familiar evidence or CI alone.
- When fixtures are available and that criterion is unblocked, the hosted plugin must verify
  remediation ahead of new curriculum, exact replay identity/order, and actor/profile isolation.
  Capture learner-state snapshots after all setup and before generation: only accepted Today
  plan/activity/target/diagnostic rows may change during generation; evidence, FSRS, and competence
  state must remain unchanged. The shared runner's `finally` cleanup and retained comparison remain
  mandatory and must pass.
- Disposable PostgreSQL tests must separately prove effective weak/forgotten status and remediation
  ordering using actor-scoped synthetic aged state, while snapshotting learner-state tables around
  generation to prove no Today-generation deltas. That database proof does not substitute for the
  hosted remediation-first acceptance criterion. Report each evidence surface separately.
- If the existing authorized API flow cannot seed the hosted due backlog and familiar/saved
  candidates deterministically, stop at that exact fixture gap and propose a narrower safe fixture
  before expanding any mutation surface. Do not fabricate temporal decay or weaken the K2-08
  combined acceptance criteria.

## Risk/decision notes

- The Today reason registry is closed in the current Pydantic/OpenAPI/enums sources, so adding the
  two explicit remediation reasons is a required additive contract update, not an optional string
  extension.
- The current service captures application-clock `asOf` before opening the database transaction,
  while K2-05 computes `calculated_at` with `transaction_timestamp()`. V2 will capture the database
  transaction instant once and pass it through the whole generation request. Existing persisted
  v1 plans are returned without regeneration.
- Policy generation consumes K2-05's effective status as a projection only. It will not introduce
  an `at_risk` status, recompute decay in Today, activate memory, or create learning evidence.
