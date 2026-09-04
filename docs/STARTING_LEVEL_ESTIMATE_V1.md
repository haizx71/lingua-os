# Starting Level Estimate v1

Status: **CONTRACT / POLICY / PERSISTENCE FROZEN — READY FOR MIGRATION-RUNTIME IMPLEMENTATION**

Task: `TASK-016`

Date: 2026-09-02

Authority: `MASTER_PROJECT.md`, `docs/CODEX_PROJECT_SPEC.md`, accepted ADRs, the current OpenAPI
contract, migrations `0001..0007`, and the implemented Profile, Competence, Content, Today, and
Brain boundaries.

## 1. Audit outcome

TASK-016 is the CODEX-owned, dependency-ready core task for an authenticated, actor-owned,
bounded heuristic/adaptive Starting Level Estimate for the activated Vietnamese-to-English MVP.
Its output is an initial content-selection aid with explicit uncertainty. It is not a formal CEFR
certificate, an IELTS prediction, a permanent proficiency fact, concept mastery, or a scheduler.

The repository currently contains:

- three authenticated Assessment operations in OpenAPI: start/resume, get/resume, and submit one
  response;
- six relational Assessment tables created by migration `0001`;
- a nullable Starting Level projection in Profile and Brain DTOs;
- no Assessment router, service, store, scoring policy, accepted item bank, runtime test suite, or
  production Assessment data;
- no migration after `0001` that completes Assessment attempt snapshots, exact mutation replay,
  current-attempt uniqueness, immutable-result enforcement, native-language authority, or the
  public confidence-band persistence model.

The six tables are therefore a provisional structural skeleton, not an authoritative scoring or
lifecycle policy. `difficulty_prior`, seeded level bounds, `adaptive_state`, and JSON schemas must
not be treated as an already-approved algorithm.

Several historical assumptions are stale or incomplete:

1. `docs/CORE_ROADMAP_AUDIT_AFTER_TASK_012.md` suggested emitting assessment evidence through
   TASK-006D. ADR-015 only permits that after a separate accepted assessment reliability/mapping
   policy. No such policy exists. V1 assessment evidence stays isolated.
2. The old event table and core-spec event map contain `assessment.completed.v1`, but an available
   event type is not authorization to mutate competence, FSRS, or Today.
3. The provisional frontend's three local questions, fixed A2 result, `minimumItemCount=3`, and
   direct “Today adjusted” copy are mock presentation assumptions, not backend policy.
4. `assessment_results.framework_mapping` is currently used by Profile SQL to carry
   `confidenceBand`. That JSON convention is not a proper persisted authority.
5. Profile currently exposes the latest completed result by `estimated_at, id`; Brain runtime
   deliberately returns null until TASK-016. Neither implementation defines scoring.

## 2. Public meaning and scale

The public meaning is:

> Given the evidence collected in this short initial assessment, which starting band is a useful
> hint for choosing initial learning content?

The activated output scale is exactly:

| Code | Public meaning in TASK-016 | Explicit non-claim |
| --- | --- | --- |
| `A0` | LINGUA project-specific pre-A1 foundation band | not an official CEFR level or certificate |
| `A1` | starting band referenced to beginner content | not proof of complete A1 ability |
| `A2` | starting band referenced to elementary content | not proof of complete A2 ability |
| `B1` | starting band referenced to intermediate content, capped at the MVP ceiling | not proof of B1 certification and not a B2 prediction |

The existing `proficiency_levels` rows and `ProficiencyLevel` DTO remain the identifiers and labels.
`frameworkCode=CEFR` is a reference mapping only. Contract wording must state that `A0` is LINGUA's
code for the pre-A1 foundation range and that every returned level is an estimate, not attainment.
No B2, C1, or C2 behavior is activated.

## 3. Domain boundaries

Starting Level owns only Assessment facts:

- question-bank eligibility;
- attempt state and selected-item snapshots;
- immutable responses;
- deterministic branching and scoring-policy version;
- immutable completed result and private diagnostics.

It does not write or calculate:

- `user_concept_states` or `user_skill_states`;
- `review_items`, `fsrs_states`, or `review_events`;
- Brain mastery, competence, ConceptStatus, or memory health;
- Today ranking, Review priority, Progress metrics, or formal CEFR attainment;
- speaking, pronunciation, speech scoring, AI, IRT, ML, or CJK behavior.

Assessment answer correctness remains Assessment-domain evidence. TASK-016 v1 emits no canonical
`learning_events` row, including no `assessment.completed.v1` row. A future projection requires a
separately reviewed parameter/reliability lineage, source mapping, deduplication policy, and ADR.
Review weights must never be silently reused.

## 4. Current OpenAPI audit

All three operations inherit global `supabaseBearer` security. There is no cursor or pagination
because one attempt is a bounded resource.

### 4.1 `POST /v1/assessments`

- Operation ID: `startStartingLevelAssessment`.
- Required header: `Idempotency-Key`, UUID.
- Body: `StartAssessmentRequest` with only required UUID `languageProfileId`; no `userId`.
- Current success: 201 `AssessmentSessionResponse`.
- Current errors: 401, 403, 404, 409, 422, 500, 503.
- Intended meaning: create a new attempt or return the already-current session.
- Gap: a resumed/existing resource needs a documented 200 response; 201 alone cannot honestly
  distinguish creation from resume. Exact key replay and different-key resume semantics are not
  documented.

### 4.2 `GET /v1/assessments/{assessmentId}`

- Operation ID: `getStartingLevelAssessment`.
- Path identity: UUID `assessmentId`.
- Body/header mutation token: none.
- Success: 200 `AssessmentSessionResponse`.
- Errors: 401, 403, 404, 422, 500.
- Intended meaning: read/resume an owned attempt or read its completed result.
- It must remain read-only and must not bootstrap application/profile/attempt state.

### 4.3 `POST /v1/assessments/{assessmentId}/responses`

- Operation ID: `submitStartingLevelResponse`.
- Required header: `Idempotency-Key`, UUID.
- Body: item UUID, response time 0..3,600,000 ms, and either selected option UUID or deliberate
  item skip.
- Success: 200 `AssessmentSessionResponse`, containing the next item or completed result.
- Errors: 401, 403, 404, 409 invalid transition, 422, 500, 503.
- Completion is implicit in the accepted final response; there is no separate completion endpoint.
- Contract defect: the current `anyOf` does not enforce exclusive answer forms. A payload can carry
  both `selectedOptionId` and `skipped=true`. The amendment must make these alternatives mutually
  exclusive.

### 4.4 Current DTO shape

`AssessmentSession` contains id, language profile ID, public status, method version, bounded
progress, nullable current item, nullable result, started/updated times, and optional completed
time. `AssessmentItem` exposes only safe presentation data: id, competence dimension, prompt,
optional text/audio, option IDs/text, and allow-skip. It exposes no answer key, correctness,
difficulty prior, level threshold, or scoring diagnostics.

`StartingLevelEstimate` contains level, numeric confidence, confidence band, assessed dimensions,
evidence count, method version, and estimate time. The client cannot submit any of those result
fields. This is directionally correct.

## 5. Lifecycle and state machine

Public persisted statuses stay exactly `in_progress`, `completed`, and `abandoned`. No enum change
is proposed. `not_started` and `skipped` are derived product states, not persisted statuses.

```text
no attempt
  ├─ learner skips invitation ───────────────→ no attempt / no result
  └─ POST start ─────────────────────────────→ in_progress
                                                   ├─ close/leave → still in_progress
                                                   ├─ sufficient terminal evidence → completed
                                                   └─ max budget + insufficient evidence → abandoned

completed ── terminal in v1; subsequent POST start returns the completed session
abandoned ── POST start may create one replacement attempt
```

Rules:

- `POST /assessments` starts only for an existing, actor-owned, active vi→en Language Profile.
- If an in-progress attempt exists, start returns that same attempt; it never creates a second one.
- GET resumes by returning the persisted current item; it performs no writes.
- Each response is final and advances at most one current item.
- The response that satisfies the stop rule creates the result and marks the attempt completed in
  one transaction.
- `completed` and `abandoned` are terminal. A completed attempt is not reopened.
- V1 retake after a completed result is deferred because the contract has no explicit retake intent
  and repeated exposure to a small bank would weaken the estimate. Historical schema capacity for
  multiple attempts does not activate retakes.
- A terminal no-result `abandoned` attempt may be replaced so item skips or an unusable attempt do
  not permanently lock the learner out. Its history remains.
- Leaving an in-progress assessment is not abandonment and never blocks Today.

## 6. Optionality and skip semantics

Starting Level is not part of Profile readiness. A learner can reach Today with no attempt, an
in-progress attempt, an abandoned attempt, or no completed result.

- Skip before start: persist nothing.
- Leave after start: preserve the in-progress attempt for cross-device resume.
- Skip one question: persist one immutable response with no correctness evidence; it consumes an
  attempt slot but not `evidenceCount`.
- Too many item skips: when the maximum budget is exhausted with fewer than six scorable responses
  in the decisive eight-item window, mark the attempt `abandoned` and produce no estimate.
- Never convert skip or missing evidence to `A0`.

No skip endpoint or new public skip status is required. Today retains its accepted self-estimated
level/easiest-first fallback.

## 7. Question bank and eligible item policy

V1 does not generate authoritative questions with an LLM. A start operation selects one active,
versioned vi→en template whose method version is `starting-level-heuristic-v1`.

An eligible template and every selected item must satisfy all of the following:

1. target language `en`, native/support language `vi`;
2. template active; item belongs to that exact template/version;
3. source record review status `approved`, non-null quality score, allowed license, and complete
   attribution;
4. one of the activated A1, A2, or B1 gate bands; A0 is inferred only by failure to demonstrate
   the A1 gate;
5. exactly one approved private item type and a matching competence-dimension label;
6. exactly four UUID-keyed options and exactly one private correct option;
7. prompt, snippet, and optional audio resolve only from approved snapshot/provenance dependencies;
8. stable item version, nonblank method metadata, and no duplicate slot within the template;
9. enough concept diversity that one gate bundle is not four variants of the same concept;
10. no answer or scoring metadata in the public payload.

Activation must fail closed when any required dependency is missing. Once a template is active or
an item is referenced by an attempt, it is retired/versioned rather than mutated in place.

## 8. Minimum question types

The public contract supports option selection over prompt text, optional text context, and optional
audio. The smallest useful v1 bank uses four private item types:

| Item type | Public representation | Competence dimension honestly assessed |
| --- | --- | --- |
| lexical meaning recognition | prompt + four options | recognition |
| grammar in context | prompt/text snippet + four options | recognition |
| reading comprehension | text snippet + prompt + four options | recognition |
| listening comprehension | approved audio + prompt + four options | listening |

Multiple-choice grammar is not production evidence. No v1 item claims the `production` dimension.
There is no speaking, pronunciation, free-form writing, or speech inference. `assessedSkills`
contains only dimensions actually represented by non-skipped scorable responses.

The current `skill` column is a competence dimension, not a question-type authority. The future
migration needs a separate private item-type/domain field instead of overloading `skill`.

## 9. Adaptive decision and exact policy

Frozen decision: **bounded branching/adaptive heuristic**, as already required by the core spec.
It is deterministic, versioned, and contains no IRT, information-gain model, ML, or route-time
randomness.

Policy ID: `starting-level-heuristic-v1`.

Each band gate has two parallel four-item bundles, `P(level)` and `V(level)`. Each bundle contains
one lexical, grammar, reading, and listening item in that stable order. A primary bundle is passed
with at least three correct answers out of four. A verified gate is passed with at least six
correct answers across its primary and verification bundles. Skips are unknown, never correct. A
skip increases `answeredCount` because the slot was presented and consumed, but does not increase
`evidenceCount`, `correctCount`, or a domain's scorable denominator.

### 9.1 Frozen slot template

Every bundle uses the same stable domain order. `P` means primary and `V` means verification.

| Slot | Band | Bundle | Public domain | Public skill | Presentation condition |
| ---: | --- | --- | --- | --- | --- |
| 1 | A1 | P | vocabulary_recognition | recognition | always |
| 2 | A1 | P | grammar_in_context | recognition | always |
| 3 | A1 | P | reading_comprehension | recognition | always |
| 4 | A1 | P | listening_comprehension | listening | always; approved audio required |
| 5 | A1 | V | vocabulary_recognition | recognition | `P(A1) <= 2` |
| 6 | A1 | V | grammar_in_context | recognition | `P(A1) <= 2` |
| 7 | A1 | V | reading_comprehension | recognition | `P(A1) <= 2` |
| 8 | A1 | V | listening_comprehension | listening | `P(A1) <= 2`; approved audio required |
| 5 | A2 | P | vocabulary_recognition | recognition | `P(A1) >= 3` |
| 6 | A2 | P | grammar_in_context | recognition | `P(A1) >= 3` |
| 7 | A2 | P | reading_comprehension | recognition | `P(A1) >= 3` |
| 8 | A2 | P | listening_comprehension | listening | `P(A1) >= 3`; approved audio required |
| 9 | A2 | V | vocabulary_recognition | recognition | `P(A2) <= 2` |
| 10 | A2 | V | grammar_in_context | recognition | `P(A2) <= 2` |
| 11 | A2 | V | reading_comprehension | recognition | `P(A2) <= 2` |
| 12 | A2 | V | listening_comprehension | listening | `P(A2) <= 2`; approved audio required |
| 9 | B1 | P | vocabulary_recognition | recognition | `P(A2) >= 3` |
| 10 | B1 | P | grammar_in_context | recognition | `P(A2) >= 3` |
| 11 | B1 | P | reading_comprehension | recognition | `P(A2) >= 3` |
| 12 | B1 | P | listening_comprehension | listening | `P(A2) >= 3`; approved audio required |
| 13 | B1 | V | vocabulary_recognition | recognition | after `P(B1)` |
| 14 | B1 | V | grammar_in_context | recognition | after `P(B1)` |
| 15 | B1 | V | reading_comprehension | recognition | after `P(B1)` |
| 16 | B1 | V | listening_comprehension | listening | after `P(B1)`; approved audio required |

For one slot, candidates must match the active template and exact policy version, vi→en pair,
band, bundle, domain, stable slot key, supported type, approved publication/review state, allowed
provenance/license state, four-option/one-correct-option authority, and listening audio when
applicable. Candidate choice is ascending stable template order and then UUID. The selected row and
public/private snapshots are persisted before it can be returned; refresh never selects again.

### 9.2 Frozen transition table

`P(L)` is correct answers in the four primary slots for band L. `T(L)` is correct answers across
the eight primary plus verification slots for L. `E(L)` is the number of non-skipped scorable
responses in that same decisive eight-slot window.

| Completed branch | Exact condition | Next/stop | Output |
| --- | --- | --- | --- |
| A1 primary | `P(A1) <= 2` (one below pass is exactly 2) | open A1 verification | pending |
| A1 verified | `T(A1) >= 6` and `E(A1) >= 6` (threshold exactly 6 passes) | stop after 8 | A1 |
| A1 verified | `T(A1) <= 5` and `E(A1) >= 6` (one below pass is exactly 5) | stop after 8 | A0 |
| A1 verified | `E(A1) < 6` after all eight slots | stop after 8 | abandoned, no result |
| A1 primary | `P(A1) >= 3` (threshold exactly 3 passes) | open A2 primary | pending |
| A2 primary | `P(A2) <= 2` (one below pass is exactly 2) | open A2 verification | pending |
| A2 verified | `T(A2) >= 6` and `E(A2) >= 6` | stop after 12 total | A2 |
| A2 verified | `T(A2) <= 5` and `E(A2) >= 6` | stop after 12 total | A1 |
| A2 verified | `E(A2) < 6` after its eight slots | stop after 12 total | abandoned, no result |
| A2 primary | `P(A2) >= 3` | open B1 primary, then B1 verification unconditionally | pending |
| B1 verified | `T(B1) >= 6` and `E(B1) >= 6` | stop after 16 total | B1 |
| B1 verified | `T(B1) <= 5` and `E(B1) >= 6` | stop after 16 total | A2 |
| B1 verified | `E(B1) < 6` after its eight slots | stop after 16 total | abandoned, no result |

A skip in a primary bundle therefore behaves as unknown, not incorrect: it cannot help reach 3/4,
but it consumes the slot. Every branch finishes its selected four-item bundle before evaluating the
transition. A primary pass opens the next higher band; failure opens verification of the current
band. B1 is never inferred from A1/A2 ease alone: all eight B1 slots are required. A verified
overturn stops at that band and never cascades upward.

```text
P(A1) < 3 correct
  → V(A1)
  → A1 if A1 total >= 6/8 and decisive evidence >= 6; otherwise A0

P(A1) >= 3
  → P(A2)
  → if P(A2) < 3: V(A2)
       → A2 if A2 total >= 6/8 and decisive evidence >= 6; otherwise A1
  → if P(A2) >= 3: P(B1) + V(B1)
       → B1 if B1 total >= 6/8 and decisive evidence >= 6; otherwise A2
```

When a primary failure is overturned by verification, the result stops conservatively at that
band; it does not immediately probe the next band. This bounds lucky or unstable escalation.

The assessment uses 8, 12, or 16 presented items:

- 8 for the A0/A1 boundary;
- 12 for the A1/A2 boundary;
- 16 for the A2/B1 boundary.

`minimumItemCount=8`, `maximumItemCount=16`. A result requires at least six non-skipped scorable
responses in its decisive eight-item window and a computed confidence of at least 0.40. If the
maximum applicable branch is exhausted without enough evidence, the attempt is abandoned without
a result.

The private `estimated_score` column stores a deterministic band anchor, not a public percent:
A0=0.1000, A1=0.3000, A2=0.5250, B1=0.7250. The gate outcomes, not these anchors, select the band.
They align with the existing project ranges and are never shown as psychometric precision.

## 10. Confidence semantics

Confidence measures how sufficient, separated, and internally consistent the decisive evidence is
for choosing a starting band. It is not percent correct, mastery, retention, or probability that a
learner “is CEFR X.”

For the decisive eight-item window:

- `C = nonSkippedCount / 8` (coverage);
- if `correctCount >= 6`, `M = (correctCount - 5.5) / 2.5`; otherwise
  `M = (5.5 - correctCount) / 5.5` (distance from the 6/8 decision boundary);
- `A` is the fraction of the four domain pairs whose two non-skipped outcomes agree; a pair with a
  skip contributes zero;
- for each domain, let its rate be correct/scorable; `B = 1 - (maxRate - minRate)` when all four
  domains have evidence, otherwise zero;
- `K = (A + B) / 2` (consistency);
- `confidence = round_half_up(min(0.85, 0.50*C + 0.30*M + 0.20*K), 2)`.

The 0.85 cap communicates the ceiling of a short heuristic assessment. Public bands are versioned
with the policy: low `[0,0.60)`, medium `[0.60,0.80)`, high `[0.80,0.85]`. Decimal arithmetic and
round-half-up at the public boundary avoid implementation-language rounding differences and fake
precision. `evidenceCount` is the total number of non-skipped scorable responses across the
attempt, not the number correct. Incomplete and abandoned attempts have no result and therefore no
public confidence. A completed estimate requires `E >= 6`; under this formula its confidence is at
least 0.40 after rounding.

Private diagnostics retain coverage, correct counts, gate decisions, margin, pair agreement,
cross-domain balance, and the final confidence factors. Public DTOs retain only confidence,
confidenceBand, assessedSkills, evidenceCount, methodVersion, and level.

## 11. Deterministic selection and attempt snapshot

V1 uses no randomization. Within each policy slot, eligible items are selected by the template's
stable slot/order metadata and UUID tie-break. Future randomization would require a persisted seed
and a new policy version.

Selection is incremental:

1. start snapshots the four A1 primary items and exposes position one;
2. responses advance within the persisted bundle;
3. at a branch boundary, the service appends the exact next four selected item snapshots;
4. refresh/resume reads the already-persisted current position and never reselects it.

Each attempt-item snapshot must retain position, original catalog item/version/source identity,
band, private item type, public presentation payload, private answer key/scoring payload,
difficulty prior, and selection time. The scoring policy/method version is frozen on the attempt.
No catalog update may rewrite a started attempt or a completed result.

The private answer snapshot table must not receive authenticated browser SELECT permission. Routes
construct `AssessmentItem` from an explicit public allowlist and never serialize raw JSON rows.

## 12. Answer, idempotency, and concurrency semantics

### Answers

- One POST submits exactly the currently exposed item.
- The answer is immutable once accepted; no edit/back navigation mutation exists.
- Exactly one of `selectedOptionId` or `skipped=true` is accepted.
- The selected option must belong to the current item's private snapshot.
- `responseTimeMs` is bounded client telemetry only and does not affect v1 scoring.
- The server derives correctness. The client never submits trusted correctness, score, level, or
  confidence.

### Idempotency

- Start and response POSTs retain the currently required `Idempotency-Key`.
- No token is required for GET.
- Fingerprints include actor-scoped operation/version and the normalized logical body. Response
  fingerprints include attempt, current item, selected-option/skip discriminator, and response
  time.
- Same actor/key/fingerprint replays the original HTTP status, public `data` snapshot, and method
  version; only the envelope request ID is new.
- Same actor/key with another operation or payload returns 409 `IDEMPOTENCY_KEY_REUSED`.
- A completion is part of the final answer transaction; there is no separate completion key.

### Concurrency

- Start locks the owned Language Profile and relies on a partial unique active-attempt constraint.
- Same-key concurrent starts converge on exact replay. Different-key double starts return one new
  attempt and one resume of that same attempt; never two active attempts.
- Response locks the owned attempt row. `UNIQUE(attempt_id,item_id)` and the mutation key prevent
  duplicate answer rows.
- Simultaneous final submissions produce one immutable result. The winner commits; exact-key retry
  replays; another stale logical command receives 409 without a second result.
- An item that is not the persisted current item fails with the same invalid-state response whether
  it is old, future, arbitrary, or from another attempt; option mismatch is 422. No membership or
  answer-key oracle is exposed.
- Cross-device resume sees only committed progress. PostgreSQL constraints/transactions, never
  Python process locks, are authoritative.

## 13. Result and current-estimate authority

Completion atomically writes one `assessment_results` row and marks the attempt completed. The
result, response facts, attempt-item snapshots, method version, band mapping, and private diagnostics
are append-only historical authority. A future policy version never recomputes old results.

Current Starting Level Estimate means the newest completed, owned result ordered by
`estimated_at DESC, id DESC`. An in-progress or abandoned attempt never hides a previous completed
result. In TASK-016 v1 there is no completed retake, so this ordering is forward-compatible rather
than an invitation to create duplicates.

The result is exposed through its Assessment session and the existing Profile projection. It is
not copied into `user_languages.current_level_id`, because that column currently contains an
optional learner self-estimate and copying would destroy source meaning. No explicit current-result
pointer is needed in v1.

## 14. Today, Content, Brain, and Progress boundaries

### Today and Content

No result is required for Today. Due Review remains authoritative and cannot be displaced. With no
result, the existing self-estimated-level/easiest-first behavior stays unchanged.

The initial estimate may be consumed only as a read-time Content level hint, never as a persisted
Today fact or a replacement for `current_level_id`. The smallest future integration is for Content
candidate ordering to resolve:

1. latest completed Starting Level result, when present;
2. otherwise the existing learner self-estimate;
3. otherwise existing easiest-first ordering.

Today then consumes the already-ordered Content candidates exactly as it does now. It does not
read answers, confidence factors, or scoring diagnostics and does not recalculate placement.
Review allocation remains first-class. Because behavioral recalibration of this hint has no
accepted policy yet, the initial TASK-016 runtime should freeze the Assessment API first; the
Content/Today read-model amendment requires explicit approval rather than being hidden in scoring
code.

### Brain and Progress

Brain may show Starting Level only as the separately labeled nullable estimate already present in
its summary contract. It must never convert the estimate into concept state, mastery, confidence,
status, or memory health. Brain GET remains read-only.

Progress may later display the immutable estimate as historical Assessment information, but
TASK-016 defines no Progress metric, trend, streak, or retention behavior and does not implement
TASK-014.

## 15. Profile ownership and archive behavior

- Actor identity comes only from the verified Supabase JWT; no Assessment body accepts `userId`.
- Start validates an existing application identity plus an owned, active vi→en Language Profile.
- Missing and foreign explicit profiles/attempts use the same 404 `NOT_FOUND` behavior.
- Paused or archived owned profiles reject start and answer mutations with 409
  `INVALID_STATE_TRANSITION`.
- GET may read owned historical attempts/results for an archived profile but performs no resume
  mutation. Current item remains historical state; answer submission is disabled server-side.
- Reactivation preserves and may resume the same in-progress attempt. It never copies or resets
  history.

## 16. Database audit

### `assessment_templates`

Purpose: versioned Assessment form/method container. Primary key UUID; unique target-language name
and method version; target language and source-record FKs use RESTRICT. It has draft/active/retired
status and timestamps. It is shared catalog data, not browser-readable learner state.

Gaps: no native-language pair, no active-template uniqueness, no activation provenance/license
gate across all items, and no immutable-after-activation rule.

### `assessment_items`

Purpose: catalog question/scoring definition. Primary UUID; composite template/language FK;
recognition/listening/production dimension, 0..1 difficulty prior, public/private JSON candidates,
source provenance, and item version.

Gaps: no private item type/domain, no band-level FK, no deterministic slot/order, no audio FK,
no JSON semantic constraint for four UUID options/one correct key, and no immutable-used-item rule.
`skill=production` is structurally possible although the current public answer shape cannot honestly
measure production.

### `assessment_item_concepts`

Purpose: relational item-to-concept tags. Composite primary key and cross-language item/concept
FKs use RESTRICT. It correctly prevents a linked English item from referencing another language.

Gaps: it does not require any link, enforce bundle diversity, or snapshot links for a started
attempt. V1 does not project these links into competence.

### `assessment_attempts`

Purpose: actor/profile/template session state. It has UUID PK, composite owner/profile/language and
template/language FKs, public status, method version, mutable adaptive JSON, start key, timestamps,
and user/key uniqueness. RLS is enabled with own-row SELECT; anonymous access is revoked.

Gaps: no one-active-attempt-per-profile constraint, no persisted selected item/order, no revision,
no exact start replay/fingerprint, no method-version FK to template, and no completed-result
cross-table invariant. `adaptive_state` alone is neither relational selection authority nor a
safe historical question snapshot.

Existing index `(user_id, started_at DESC)` supports actor history but not active profile lookup.

### `assessment_responses`

Purpose: one immutable-intended answer per attempt/item with actor/template integrity, response
JSON, server correctness, optional latency, evidence JSON, and mutation key. Unique constraints on
actor/key and attempt/item prevent basic duplicates. RLS is own-row SELECT.

Gaps: there is no append-only enforcement, request fingerprint, exact response replay snapshot,
answer discriminator constraint, current/snapshotted-item FK, or proof that the option belonged to
the question. Correctness can be null without being tied to a skip.

### `assessment_results`

Purpose: one result per attempt with normalized private score, optional level FK, confidence,
evidence count, dimensions, method version, framework JSON, and timestamps. Unique attempt and
owner/template FK exist. RLS is own-row SELECT. `(user_id, estimated_at DESC)` supports current
history lookup.

Gaps: estimated level is nullable even though the public completed result requires it; confidence
band is not a column; method versions can disagree; framework JSON is incorrectly carrying a
public confidence band; results are not append-only; and the database does not require the parent
attempt to be completed or prevent result mutation.

### Cross-migration audit

Migrations `0002` and `0003` affect only Memory/Review. `0004` adds the dormant
`assessment_result` learning-event source type but no mapping policy. `0005` adds the Content
publication model, which Assessment should mirror rather than bypass. `0006` preserves Today's
placement-independent fallback. `0007` adds authoritative native language/profile lifecycle and
causes Assessment mutations to require an active pair. None modifies the six Assessment tables.

## 17. Smallest required future migration

Decision: **B — migration required**, proposed as
`0008_starting_level_estimate_v1`. No SQL is created in this phase.

The bounded shape should:

1. add template native-language authority, one active vi→en template constraint, and a fail-closed
   activation/provenance/license gate;
2. add item band, private item type, stable slot/order, optional approved audio identity, and
   immutable-after-use/version rules;
3. add private `assessment_attempt_items` snapshots with position, item/version/source, band/domain,
   safe public payload, private answer/scoring payload, and no browser SELECT access;
4. constrain one in-progress attempt per learner/language profile and bind attempt method version to
   its template;
5. add Assessment-scoped exact mutation replay storage keyed by actor/idempotency key with operation,
   request fingerprint, attempt/response identity, original HTTP status, public data snapshot, and
   append-only/RLS rules;
6. enforce immutable responses and add an explicit selected/skip discriminator consistent with
   server-derived correctness;
7. add dedicated bounded `confidence_band`, make completed estimated level non-null, retain private
   diagnostics separately from framework mapping, and enforce immutable one-result history;
8. add only the active-profile lookup, deterministic item-slot selection, attempt-position, and
   current-result indexes justified by these queries;
9. add migration preflight, empty apply/reapply, protected down/up, checksum, RLS, concurrency, and
   historical-data safety tests.

Do not create a second Assessment subsystem or a generic cross-domain mutation table. Existing six
tables remain the backbone.

### 17.1 Frozen table/constraint delta for `0008`

This is a persistence contract, not migration SQL:

- `assessment_templates`: add required `native_language_code`, keep `target_language_code`, and
  constrain the activated pair to vi→en for v1. A partial unique index permits exactly one `active`
  template for the pair. Activation validation checks every required slot and dependency before
  status becomes active. Once active or referenced, the template/policy identity is immutable.
- `assessment_items`: add required private `item_type`, `target_level_id`, `bundle_kind` (`primary`
  or `verification`), and `slot_index` (1..4), plus nullable approved audio identity. Unique
  `(template_id, target_level_id, bundle_kind, slot_index)` freezes the 24 policy slots. Checks bind
  slot 1..4 to vocabulary/grammar/reading/listening respectively, exactly four options to one
  private correct option, and listening to valid audio. Published/referenced items are immutable.
- new private `assessment_attempt_items`: UUID primary key plus attempt/actor/profile ownership,
  absolute `position` 1..16, original item/template/version/source identities, band, bundle/domain,
  public question snapshot, private answer/scoring snapshot, and `selected_at`. Unique
  `(attempt_id, position)` and `(attempt_id, item_id)` prevent reselection/duplication. Composite
  foreign keys bind it to its owned attempt. Authenticated browser roles receive no direct SELECT.
- `assessment_attempts`: add/freeze policy/template version and current snapshot position. A
  PostgreSQL partial unique index on `(user_id, user_language_id) WHERE status='in_progress'`
  enforces one current attempt. Status transitions are only in_progress→completed/abandoned;
  completed/abandoned rows and method/template identity are immutable.
- new private Assessment replay table: actor UUID, UUID idempotency key, operation discriminator
  (`start` or `answer`), normalized request fingerprint, attempt/response identity, original HTTP
  status, exact public `data` snapshot, policy version, and timestamps. Unique `(user_id,
  idempotency_key)` makes reuse across Assessment operations detectable. Rows are append-only,
  actor-scoped for service queries, and not browser-readable.
- `assessment_responses`: add an explicit answer discriminator and selected snapshot-option
  identity. A check enforces exactly selected-option or skip; skipped has null correctness and
  selected answers have server-derived non-null correctness. Composite foreign keys require the
  current snapshotted item. Existing `(attempt_id,item_id)` uniqueness remains. UPDATE/DELETE is
  rejected after insert.
- `assessment_results`: require a level for every result, constrain it to A0/A1/A2/B1, constrain
  confidence to 0..0.85 at two-decimal precision, add the bounded confidence band and private
  versioned diagnostics, and bind result policy version to the attempt. One result per attempt
  remains. INSERT is permitted only while atomically completing its parent; UPDATE/DELETE and
  recomputation are rejected.
- add only four proof-path indexes: owned active attempt lookup, deterministic eligible slot lookup,
  current attempt-position lookup, and current completed result `(user_id,user_language_id,
  estimated_at DESC,id DESC)`. No speculative analytics index is included.

Concurrent start locks the owned profile, attempts insert/resume in one transaction, and treats the
partial-unique winner as authority. Same-key callers replay the persisted response; different-key
callers converge on the same active attempt with 200. No SELECT-then-INSERT assumption or Python
lock is sufficient. Append-only triggers protect responses, snapshots, replays, and results; the
future down migration must refuse lossy rollback while any `0008`-dependent data exists.

## 18. OpenAPI compatibility decision

Decision: **B — a narrow contract amendment is frozen before runtime**. The Assessment-only
amendment is now applied to `contracts/openapi.yaml`; generated declarations are refreshed from
that authority. No Profile, Review, Reader, Today, Brain, runtime, or migration behavior changes.

Required amendments:

1. make selected-option versus skipped response forms mutually exclusive;
2. add/document 200 for an existing/resumed/completed session while retaining 201 for a newly
   created attempt;
3. require `completedAt` as a nullable property, consistent with the repository's explicit-null
   DTO convention, and document status/currentItem/result combinations;
4. state 8/16 progress bounds and automatic completion semantics without exposing scoring rules;
5. document exact idempotency replay/reuse, one-active-attempt, archived/paused profile, and
   missing/foreign 404 behavior, including the relevant 409 machine codes;
6. clarify A0/pre-A1 and the estimate/non-certification meaning;
7. constrain `assessedSkills` to actually assessed recognition/listening dimensions and exclude production;
8. preserve no pagination, no user ID, no trusted score/level/confidence input, and no answer key.

No new skip, complete, result, retake, or pagination endpoint is justified. If generated TypeScript
changes break the frozen frontend, the approved stop-and-bounded-compatibility process must run in
a separate turn.

## 19. Frozen golden calibration cases

Within each four-slot bundle the outcome vector is ordered vocabulary, grammar, reading,
listening; `1` is correct, `0` is incorrect, and `S` is skipped. Confidence factors refer only to
the decisive eight slots for the returned boundary. Values shown below are exact inputs to the
two-decimal round-half-up rule.

| Case | Presented slots and outcomes | Gate decision and result | `C / M / A / B / K` | Confidence |
| --- | --- | --- | --- | --- |
| Near-zero beginner | A1-P `0000`; A1-V `0000` | P=0 opens V; T=0 -> A0 | `1 / 1 / 1 / 1 / 1` | `0.85`, high |
| Clear A1 | A1-P `1111`; A2-P `1000`; A2-V `1000` | A1 P=4 opens A2; A2 P=1 opens V; T=2 -> A1 | `1 / 0.636363… / 1 / 0 / 0.5` | `0.79`, medium |
| Clear A2 | A1-P `1111`; A2-P `1111`; B1-P `1000`; B1-V `1000` | lower gates pass; B1 T=2 -> A2 | `1 / 0.636363… / 1 / 0 / 0.5` | `0.79`, medium |
| Clear B1 | A1-P `1111`; A2-P `1111`; B1-P `1111`; B1-V `1111` | lower gates pass; B1 T=8 -> B1 | `1 / 1 / 1 / 1 / 1` | `0.85`, high |
| Inconsistent learner | A1-P `1110`; A2-P `1100`; A2-V `0011` | A1 P=3 opens A2; A2 P=2 opens V; T=4 -> A1 | `1 / 0.272727… / 0 / 1 / 0.5` | `0.68`, medium |
| Strong vocabulary, weak grammar/reading | A1-P `1000`; A1-V `1000` | A1 P=1 opens V; T=2 -> A0 | `1 / 0.636363… / 1 / 0 / 0.5` | `0.79`, medium |
| Incomplete | A1-P plus only three A1-V slots submitted | no terminal bundle evaluation; in_progress | not computed | absent |
| Skipped before start | no slots; no POST start | no attempt and no result | not computed | absent |

The inconsistent case has identical aggregate correctness in every domain but opposing paired
outcomes, so `A=0` reduces confidence. The vocabulary-skewed case has stable pairs (`A=1`) but the
domain-rate spread forces `B=0`; it supports only the conservative A0 start and never implies broad
ability. If all eight terminal slots have been consumed but fewer than six are scorable, the
attempt is abandoned with no result or confidence, regardless of the observed correct count.

These examples are golden policy fixtures, not claims of empirical psychometric calibration.
External pilot data may motivate a later policy version without rewriting historical attempts.

## 20. Security and integrity review

| Threat | Required control |
| --- | --- |
| IDOR/foreign profile or attempt | actor-scoped SQL; missing and foreign explicit IDs both 404 |
| client user/level/score/confidence forgery | no such trusted request fields; server calculates result |
| answer-key leakage | private catalog/snapshot tables have no browser grant; explicit DTO allowlist only |
| answer tampering | accept only current snapshot item and one of its snapshotted option IDs |
| arbitrary/nonselected question | current-position check under attempt row lock |
| duplicate answer/final result | unique constraints, idempotency fingerprints, row locks, one result/attempt |
| stale device submission | 409 invalid transition without revealing next/private item state |
| cross-profile replay | actor/key scope plus profile/attempt in request fingerprint and composite FKs |
| completed-result mutation | append-only trigger and terminal attempt enforcement |
| source/license bypass | active-template gate over every item and audio dependency |
| raw database error leakage | stable error code/envelope; generic client-safe message |
| timing/response-time manipulation | response time is ignored by scoring |
| service-role bypass | every query still binds verified actor; RLS and direct-browser denial tested |

The current question DTO itself does not leak correct answers. The implementation becomes unsafe if
it serializes `prompt_schema`, `answer_schema`, attempt private snapshots, difficulty, raw
correctness, or diagnostics wholesale.

## 21. Future test matrix

| ID | Required proof |
| --- | --- |
| A | brand-new bootstrapped learner with active vi→en profile can start |
| B | own profile succeeds; missing/foreign profile and attempt share 404 |
| C | unsupported pair and inactive profile fail with no Assessment writes |
| D | start creates one method-versioned attempt and four A1 snapshots |
| E | GET resumes the exact current item without mutation |
| F | item IDs/public payload/order survive refresh and catalog updates |
| G | identical bank/state always produces identical order and branches |
| H | valid selected option persists server-derived correctness |
| I | item not current/in attempt is rejected without membership leakage |
| J | same-key duplicate replays exactly; different key cannot duplicate an answer |
| K | option not in the private snapshot and dual answer/skip payloads fail |
| L | partial attempt stays in progress with no estimate |
| M | terminal answer atomically completes attempt and writes one result |
| N | golden paths always return the same level, score anchor, diagnostics, and method version |
| O | confidence formula, cap, bands, evidence count, and skip coverage are exact |
| P | A0 boundary fixtures pass, including no false certification wording |
| Q | A1 boundary and verification-overturn fixtures pass |
| R | A2 boundary and conservative stop fixtures pass |
| S | B1 boundary/cap fixtures pass with no B2 behavior |
| T | pre-start skip persists nothing; excessive item skips create no result |
| U | current estimate is latest completed only; in-progress/abandoned never replaces it |
| V | completed responses/snapshots/results reject update/delete/recompute |
| W | same/different-key concurrent starts converge to one active attempt |
| X | concurrent final answers produce one immutable result and exact replay |
| Y | paused/archived mutation rejected; history survives and reactivation preserves it |
| Z | completion creates no learning event, competence, ConceptStatus, mastery, Review, or FSRS mutation |

Future migration/runtime gates: empty `0001..0008`, no-op reapply, checksum rejection, protected down/up,
preflight failure, RLS/direct-browser denial, OpenAPI validation, Redocly, contract tests, generated
TypeScript freshness, Ruff, mypy, backend tests, real PostgreSQL races, and the frozen frontend
baseline of at least 314 tests / 27 files.

## 22. Data dependency classification

The engine and production bank are separate deliverables.

- Implementation/test fixture: exactly 24 deterministic LINGUA-authored items—three gates × four
  item types × primary/verification—with first-party source, allowed license, approved review,
  stable UUIDs, answer keys, concept links, and test audio. They are test/dev data and do not become
  production merely because tests pass.
- Demo requirement: a human-reviewed 24-item LINGUA-authored bank may support a controlled demo if
  Vietnamese prompts, English answers, audio, accessibility, provenance, and answer correctness are
  explicitly signed off.
- External testing requirement: a larger parallel bank, expert language review, distractor QA,
  device/audio accessibility checks, bias review, and observed item-performance monitoring are
  required before using the estimate with external learners.
- Production/data-pipeline responsibility: scalable ingestion, editorial workflow, additional
  parallel forms, source licensing, calibration statistics, and retirement/version operations
  belong to a separately approved data task (potentially a future TASK-008C). TASK-016 must not
  silently create that task or import external dictionaries/corpora.

## 23. Accepted ADR

ID: `ADR-020 — Bounded isolated Starting Level Estimate v1`.

Accepted decision:

- use deterministic `starting-level-heuristic-v1` A1/A2/B1 boundary gates to return only A0/A1/A2/B1;
- treat A0 as LINGUA pre-A1 and every result as a confidence-qualified starting-content hint;
- snapshot selected items/order and keep responses/results immutable;
- allow one active attempt, no completed retake in v1, and latest completed result as current;
- keep Assessment evidence isolated from Competence, FSRS, Brain mastery, Progress, and Today facts;
- cap public confidence at 0.85 and round it to two useful decimals;
- assess objective listening comprehension only, never speech/pronunciation/production;
- require the frozen narrow OpenAPI amendment and migration `0008` before runtime;
- keep Today and Content integration outside TASK-016.

The accepted decision is recorded in `DECISIONS.md`.

## 24. Remaining migration/runtime gates and blockers

The contract, scoring policy, and persistence delta are frozen. The separately completed narrow
shared/frontend compatibility patch now conforms to the authoritative Assessment DTO without
changing the frozen semantics: generated freshness and all workspace typechecks pass, and the
frontend baseline is 314 tests across 27 files with zero skipped/todo tests. Runtime must still
receive explicit implementation approval before `0008` or service code is created. Migration
verification, transaction/concurrency behavior, fail-closed bank activation, and runtime security
remain implementation gates. Production/demo question-bank ownership and human review are still
unassigned; the deterministic 24-item test fixture is not production data. Today/Content
consumption is explicitly separate work, not a TASK-016 runtime blocker. There is no remaining
contract/policy/persistence-freeze blocker.
