# Today Engine Heuristic v1

Status: **APPROVED / IMPLEMENTATION AUTHORITY**  
Task: `TASK-010`  
Proposed policy version: `today-heuristic-v1`  
Scope: English learning for Vietnamese learners in the MVP

## 1. Purpose and authority

Today answers one question:

> What should this learner do in today's learner-local learning session, within their configured
> time budget, and why?

It is a deterministic activity allocator. It is not a scheduler, competence projector, placement
engine, content publisher, dictionary, progress tracker, or presentation layer.

Authority remains:

| Concern | Authority consumed by Today |
| --- | --- |
| Due eligibility and order | Memory Engine and accepted Review queue semantics |
| Recognition/listening/production, mastery, confidence and ConceptStatus | Competence Engine `user_concept_states` projections |
| Published catalog, curated level and content-fit order | Content Engine |
| Resume/completion | Reader `user_content_progress` projection |
| Saved membership | Library saved-state tables |
| Starting estimate | Assessment result/profile projection when present |
| Learner day and target | `learner_profiles.time_zone` and `user_languages.daily_minutes` |

The same learner state, published catalog, policy version and `asOf` must produce the same plan.
No AI, ML, embedding, randomness, speech scoring, CJK behavior or provider call participates.

## 2. Dependency audit

`TASK-010` is dependency-unblocked:

- TASK-006 Memory Engine is DONE;
- TASK-008 Reader/Content is DONE.

TASK-006D is also DONE and supplies the competence projections Today needs, although TASKS.md does
not list it explicitly. This is a task-board clarity defect, not a runtime blocker. The future
the task board records TASK-006D as an explicit TASK-010 dependency.

TASK-016 Starting Level Estimate is not a dependency. The accepted Content Engine already orders
easiest published content first when no current/estimated level exists, and the core specification
forbids initial placement from becoming a recommendation single point of failure.

## 3. Responsibility boundary

Today owns:

- normalizing bounded candidates from authoritative domains;
- eligibility filters;
- deterministic priority tiers;
- deduplication;
- packing activities into `dailyMinutes`;
- persisting one stable learner-local daily plan;
- internal selection diagnostics and public reason mapping;
- evidence-gated Today completion metadata.

Today does not own:

- any FSRS formula, due transition or Review item mutation;
- Beta competence math, status mutation or raw evidence mass;
- content publication, provenance, difficulty or known-ratio calculation;
- Dictionary lexical truth;
- Reader resume/progress or exposure eligibility;
- Starting Level estimation;
- Brain/Progress aggregation;
- UI wording/layout beyond contract-required DTO text;
- direct learning evidence caused only by a Today card click.

## 4. Candidate architecture

```text
authoritative bounded sources
  Review queue | competence projections | Content candidates | Reader progress | Library
        ↓
typed candidate normalization
        ↓
eligibility and language/ownership filters
        ↓
priority tiers and stable tie-breaks
        ↓
deduplication and daily budget packing
        ↓
persisted Today plan + private diagnostics
```

Policy orchestration must not be embedded in one giant SQL query. Each source adapter returns a
bounded typed projection. The pure policy layer accepts those projections and has no PostgreSQL,
FastAPI, py-fsrs or wall-clock dependency.

## 5. Approved activity categories for runtime v1

### 5.1 Due Review block (`review`)

- **Why:** protect due memory work without creating a second scheduler.
- **Eligibility:** at least one active owned Review item has `dueAt <= asOf`.
- **Source:** accepted Review queue order `(dueAt, reviewItemId)` at one fixed `asOf`.
- **Cost:** one explainable minute per selected Review target in v1.
- **Allocation:** one aggregate activity per plan, with `targetCount` equal to the selected bounded
  count and the first due item as an optional navigation/diagnostic anchor.
- **Public reason:** `FSRS_DUE`.

The block opens the existing Review queue. Today chooses only how many minutes/items the daily plan
allocates; it never changes item order or state.

### 5.2 Reader block (`read`)

- **Why:** provide comprehensible input, continue an established Reader journey, or discover one
  suitable item.
- **Eligibility:** authenticated English content that still passes the TASK-008 publication gate.
- **Source:** Content Engine ordered candidates plus Reader progress and Library overlay.
- **Cost:** remaining item estimate clamped to a five-to-ten-minute activity block, then capped by
  remaining plan budget. A block smaller than five minutes is not packed.
- **Allocation:** at most two `read` activities, at most one of which may be not-yet-started.
- **Public reason:** `CONTENT_FIT`, plus applicable weakness, recency or novelty codes.

The block does not imply that a large content item is finished. It is a bounded Reader session.

### 5.3 Content-backed listening block (`listen`)

- **Why:** exercise approved listening exposure when listening is meaningfully weaker and a
  published catalog item has playable audio.
- **Eligibility:** the same Content gate as Reader, authoritative audio availability, and a stable
  weak-listening projection or forgotten/weak concept whose lowest applicable dimension is
  listening.
- **Source:** a Content Engine candidate enriched internally with `hasAudio`; Reader remains the
  interaction/evidence authority.
- **Cost:** five minutes, or remaining budget when at least five minutes remain.
- **Allocation:** at most one, and never for a content item already selected as `read` that day.
- **Public reason:** `WEAK_LISTENING` and `CONTENT_FIT`.

### 5.4 Standalone acquisition (`learn`)

The enum remains contract-valid, but `today-heuristic-v1` produces no standalone `learn` activity.
There is no executable concept-acquisition/Dictionary flow with authoritative completion semantics
in the current backend. New material enters through suitable Reader content. Creating a dead card
or treating a dictionary open as learning would fabricate product behavior.

This is not an OpenAPI removal. A later approved acquisition service may supply `learn` candidates
without changing the ranker interface.

## 6. FSRS boundary

Today chooses option **A**: it consumes the existing Review queue order directly.

- Eligibility is `isDue`/`dueAt` from Memory/Review.
- Order remains `(dueAt, reviewItemId)` at the queue's fixed `asOf`.
- Today may cap the number included in the daily block but cannot re-rank items by competence,
  status, goal, content or its own urgency formula.
- Oldest/most-overdue behavior follows naturally from the existing ascending due time.
- Generating or reading a Today plan never mutates FSRS state.

Weak/forgotten status never creates a duplicate Review item. If such a concept is already due, the
Review block owns its active-recall opportunity.

## 7. Competence boundary

Today may read only stable projections:

- ConceptStatus;
- per-dimension score, confidence and evidence count;
- aggregate mastery/confidence where already approved;
- exposure count and `lastSeenAt`.

Today never reads positive/negative mass, recent outcome arrays, thresholds or parameter payloads.
It never derives or writes competence/status. A missing concept row is `unseen`; a missing or
lineage-less competence projection is unknown, not a zero score.

For selecting a public weak reason, the lowest applicable projected dimension with non-zero
evidence is used only as an explanation category. It does not alter the Competence Engine's status.

## 8. Reader, Content and Library boundary

`GET /v1/content/recommended` and Today are complementary:

- Content Engine owns publication filtering, curated-level distance, known-concept ratio,
  difficulty, estimated duration and base content-fit ordering.
- Today requests a bounded top candidate pool from that same internal application/read model.
- Today adds cross-domain activity policy: continue precedence, weak/recent overlap, novelty gate,
  mode choice and daily budget.
- Today does not copy the Content SQL or publish a second general content recommendation endpoint.

Library membership affects precedence only. Saving content is intent, not competence, progress or
proof of completion.

## 9. Continue versus new content

Content precedence is deterministic:

1. unfinished suitable content, ordered by `lastOpenedAt DESC, contentId`;
2. saved but not-started suitable content, ordered by `savedAt DESC, contentId`;
3. recommended not-started content in authoritative Content Engine order;
4. completed content is ineligible for Today v1.

An unfinished item is always considered before a new item. A second content block may be packed
only after the first continue block and only if time remains. At most one not-started item is
introduced per plan.

## 10. Daily budget policy

### 10.1 Authority and units

- `targetMinutes = user_languages.daily_minutes`.
- Today has no hidden fallback target because the profile field is required. Onboarding currently
  offers 10/20/30/45 minutes; the common 20–30 minute case is the calibration target.
- One Review target costs one minute.
- Reader costs are five-to-ten-minute blocks derived from the server's existing estimated duration
  and remaining progress.
- Listening costs five minutes.
- Sum of `estimatedMinutes` never exceeds `targetMinutes`.

These are coarse cost units, not predictions of human completion time.

### 10.2 Packing rules

1. Determine the highest-precedence eligible content candidate before packing.
2. For plans of at least 15 minutes with both due Review and suitable content, reserve up to eight
   minutes for one content modality. At least five minutes remain for Review.
3. Allocate Review targets in existing queue order into the non-reserved budget.
4. Pack the first content activity, then use remaining blocks for a second Reader or one distinct
   listening activity, respecting the novelty and duplicate caps.
5. If no suitable content exists, Review may consume the whole target.
6. If no Review is due, pack eligible content directly, up to three content activities.
7. If fewer valid activities exist than the budget can hold, return an underfilled plan. Never
   fabricate work or stretch estimates.

`CONTENT_RESERVE_MINUTES = 8` is frozen for `today-heuristic-v1`.

### 10.3 Overflow and truncation

- Due Review never makes the Today plan exceed its target.
- The selected Review block is bounded; the remaining due queue is deferred from the plan but
  remains available in Review.
- Review items are not truncated; the block target count is reduced.
- Content is represented as a time block rather than splitting server content or inventing a
  segment completion target.

## 11. Overdue policy

When due work exceeds available Review minutes:

1. keep the Review queue's existing oldest-due-first order;
2. include only the count fitting the Review allocation;
3. reserve one content modality for a 15+ minute plan when suitable content exists;
4. defer the remainder without changing `dueAt` or FSRS state.

This prevents an overdue backlog from starving Reader forever while preserving Memory authority.
No due item is marked skipped merely because it did not fit.

## 12. Weak and forgotten policy

- `forgotten` candidates precede `weak` candidates only inside content reinforcement matching.
- A due weak/forgotten concept is represented solely by the Review block for active recall.
- A non-due weak/forgotten concept may raise a suitable content candidate's Today tier when the
  content contains it.
- Today creates no special weak/forgotten activity type.
- If no due Review item and no published suitable content covers the concept, Today emits no fake
  action.

Internal diagnostics may use `FORGOTTEN_CONCEPT` and `WEAK_CONCEPT`. Public mapping uses the
existing dimension weakness codes and free `reasonText`; no private streak or score is exposed.

## 13. Novelty policy

New material comes only from one not-started Reader/content activity.

- Frozen cap: at most four distinct `unseen` concepts across a newly recommended not-started item.
- `discovered`, `learning`, `weak` and `forgotten` are not counted as new.
- A newly recommended content item over the cap is ineligible for new discovery that day; it may
  become eligible later as learner state changes. The cap does not block continuation of an
  already-started suitable Reader item.
- New content is considered after unfinished and saved-not-started content.
- No standalone `learn` card is generated.

The value four appears in the approved Today UX example and current deterministic mock, but the
backend product specification does not state it normatively. It therefore remains an explicit
approval gate before implementation.

## 14. Starting Level behavior

Today does not require TASK-016:

| Learner state | Behavior |
| --- | --- |
| No assessment estimate | Use profile/current level if present; otherwise Content Engine's approved easiest-first ordering. |
| Estimate with confidence | Consume only the accepted profile/content-fit projection; do not recalculate or certify it. |
| Sparse competence | Missing rows are unseen/unknown; no inferred skill score. |
| Returning after inactivity | Due Review naturally dominates its bounded allocation; continue suitable unfinished content next. |

A learner with no active English profile receives the existing contract-safe not-found/empty
profile behavior. Today never creates a profile or estimate.

## 15. Exact priority rules

The v1 policy uses ordered tiers, not a weighted sum.

### Review

One due block is placed before content. Its internal members retain Review queue order.

### Content candidates

After eligibility and deduplication, compare by:

1. unfinished progress;
2. saved but not started;
3. contains a non-due forgotten concept;
4. contains a non-due weak concept;
5. contains a concept passively exposed within the recent window;
6. not-started recommended content within novelty cap;
7. original Content Engine rank;
8. stable `contentId`.

Goal relevance is intentionally absent from the ordering until an approved data authority exists.
The database currently has profile goals and concept topics, but no `content × goal` or
`topic × learning-goal` mapping. Inventing dialogue/travel/work mappings in code is prohibited.

Smallest proposed resolution: add curated binary content-goal tags with provenance in the future
Today migration, then insert `goal match` after continue/saved precedence and before weak/recent
tie-breaking. If that proposal is not approved, goal relevance must be explicitly neutral in v1
and TASKS.md wording should say so.

## 16. Policy constants and versioning

All values belong to one immutable policy object:

```text
policyVersion                 today-heuristic-v1
reviewMinutesPerItem          1
contentBlockMinMinutes        5
contentBlockMaxMinutes        10
contentReserveMinutes         8
listeningBlockMinutes         5
maxReadActivities             2
maxListenActivities           1
maxNotStartedContent          1
maxNewConcepts                4
recentExposureWindowHours     48
reviewCandidateLimit          min(targetMinutes + 1, 181)
competenceCandidateLimit      50
contentCandidateLimit         20
```

The candidate limits are query bounds, not ranking weights. Any change to semantic constants
requires a new policy version and golden calibration tests. Existing plans retain their version.

## 17. Explainability and diagnostics

Public output uses the existing `reasonCodes` and localized `reasonText`. Private diagnostics for
each selected activity contain:

- policy version and `asOf`;
- candidate source and stable source identity;
- source rank;
- eligibility result;
- priority tier;
- estimated cost and allocation decision;
- internal reason set;
- deduplication key;
- novelty count where applicable.

Useful internal exclusion reasons include `NOT_DUE`, `ALREADY_SELECTED`, `CONTENT_COMPLETED`,
`PUBLICATION_GATE_FAILED`, `NOVELTY_CAP_EXCEEDED`, `NO_AUDIO`, `INSUFFICIENT_BUDGET`,
`DUE_CONCEPT_DEDUPED`, and `NO_GOAL_AUTHORITY`.

Private diagnostics never expose raw FSRS parameters, competence masses, database messages or
another learner's state. Bounded counts and selected diagnostics are logged; the full learner
history and entire catalog are not.

## 18. Determinism

- Capture one timezone-aware UTC `asOf` at request entry and pass it through every source.
- Never call wall-clock time inside the policy layer.
- Use a PostgreSQL repeatable-read snapshot for plan generation.
- Use explicit ordered tuples and UUID final tie-breakers.
- Use no randomness.
- Persist the selected plan and policy version.
- A concurrent generator losing the active-day unique constraint reads the winning plan.

## 19. Plan persistence strategy

Today v1 chooses **B: one persisted daily plan** because both the authoritative OpenAPI and
migration history already model plan/activity identities and completion.

### Same-day behavior

- First current-day GET generates and persists one active plan.
- Repeated GET returns the same IDs, order, targets, estimates and reasons.
- Review or Reader state changes do not re-rank or replace the plan mid-day.
- New Review items becoming due mid-day remain available in Review but enter the next generated
  plan unless they are naturally consumed within the existing aggregate Review block.
- Completion counts/status may reconcile from authoritative actions without changing plan order.

### Day change and invalidation

- At the next learner-local day, the prior active plan expires and a new plan is generated.
- A timezone change causes the next Today request to expire an active plan whose stored timezone
  no longer matches profile authority; generation then uses the new local date.
- V1 generates only the current learner-local date. A supplied past/future `date` may retrieve an
  existing owned plan but does not generate one; otherwise it returns not found.

## 20. Timezone and day boundary

`learner_profiles.time_zone` is the authority and must be validated as an IANA timezone. Server
local timezone is irrelevant.

```text
asOfUtc   := injected request instant
localNow  := asOfUtc converted with learner IANA timezone
planDate  := localNow.date
```

UTC remains stored for `generatedAt`, activity creation and completion. DST is handled by IANA
zone rules. One captured `asOf` prevents a single request from crossing midnight internally.

## 21. Completion semantics

Today completion is metadata derived from or gated by authoritative domain work:

| Activity | Required proof before Today marks complete |
| --- | --- |
| Review | One owned Review event after plan generation for every Review item snapshotted into the activity's ordered target set. |
| Read | At least one eligible owned `read` exposure for the selected content after plan generation, or authoritative content completion after generation. |
| Listen | At least one eligible owned `listen` exposure for the selected content after plan generation. |
| Learn | Not generated in v1. |

Partial Review progress updates `completedCount` but not activity status. `completedMinutes` sums
completed activity estimates; it does not claim stopwatch precision. `durationSeconds` is optional
completion metadata and never learning evidence.

`POST .../complete` is an idempotent reconciliation/acknowledgement command. It fails with the
contract's invalid-state response when proof is absent. Only after proof exists may it record
Today completion metadata and the neutral `today.activity.completed.v1` event. That event never
replaces the underlying Review/Reader event.

## 22. Deduplication and starvation safeguards

Deduplication keys:

```text
review block       review:<languageProfileId>:<planDate>
read content       read:<contentId>
listen content     listen:<contentId>
concept purpose    concept:<conceptId>:<active-purpose>
```

Rules:

- one Review block per plan;
- one content item appears at most once across read/listen;
- due concept work is not duplicated by weak/forgotten reinforcement;
- at most one not-started content item and four unseen concepts;
- at most three content activities total;
- due Review cannot consume the content reserve in a 15+ minute plan when suitable content exists;
- content is never packed before the due Review block;
- completed activities are never regenerated within the same persisted plan.

## 23. Empty and edge states

| State | Result |
| --- | --- |
| Completely new learner with active profile | No Review; choose easiest eligible published content within novelty cap. |
| No due Review | Pack eligible continue/saved/new content; underfill safely if scarce. |
| No suitable published content | Pack bounded due Review only; otherwise return an empty completed plan. |
| All Reader content completed | Do not fabricate rereading; use due Review or empty plan. |
| Huge overdue backlog | Bounded oldest-due Review plus one suitable content modality when target is at least 15 minutes. |
| Only passive/discovered concepts | No competence assumption; they may count as recent or non-new content fit only. |
| No competence rows | Treat projections as unknown/unseen; no weak reason. |
| No Library items | Continue/recommended sources still work. |
| Weak/forgotten without schedulable Review | Reinforce only through suitable published content; otherwise omit. |
| Optional content pool empty | Review can still produce a plan. |
| Required profile/Review query failure | Fail the generation safely; do not persist a partial plan. |

## 24. OpenAPI audit

### Current contract

- `GET /v1/today?languageProfileId&date` returns an existing or generated `TodayPlanResponse`.
- `POST /v1/today/{planId}/activities/{activityId}/complete` requires `Idempotency-Key` and an
  optional `durationSeconds`, returning `TodayCompletionResponse`.
- Plans expose ID, language profile, local date/timezone, target/completed minutes, status,
  `engineVersion`, activities and timestamps.
- Activities expose type, text, estimated minutes, reason codes/text, status, target/completed
  counts and optional content/concept/review targets.
- There is no pagination because a plan is capped at 20 activities.

### Compatibility result

The heuristic fits the current public DTOs. No first-part OpenAPI amendment is required:

- persisted plan IDs and statuses already match strategy B;
- `engineVersion` carries `today-heuristic-v1`;
- existing public reasons plus `reasonText` can explain all v1 selections;
- content-backed read/listen use `contentId`; Review uses target count and optional first-item
  anchor;
- private priority tiers, `asOf` and exclusion reasons need not be public.

Contract limitations, not blockers:

- `skipped` is an enum value with no public mutation; v1 does not emit it;
- current generic activity shape does not require the target appropriate for each type; server
  invariants and contract tests must enforce runtime output;
- `date` generation semantics need operation-description clarification during implementation, but
  no field change is necessary.

## 25. Database audit and smallest future migration

### Existing authority

`today_plans` already persists owner/profile/language, local date, timezone, daily minutes,
new-concept budget, engine version, lifecycle and timestamps. Its partial unique index prevents two
active plans for one learner/profile/date.

`today_plan_activities` already persists order, type, estimate, public reason codes, optional
concept/content/review identity, lifecycle and completion timestamp with ownership/language FKs.

### Gaps

1. `targetCount` is required by batch Review semantics but is not persisted.
2. The ordered Review target set is not persisted, so completion cannot prove that the selected
   targets—not merely arbitrary same-profile reviews—were completed.
3. The partial unique index covers active plans only, while the chosen strategy requires one
   stable plan of any lifecycle state per learner/profile/local date.
4. Stable private selection diagnostics are absent.
5. Completion has one idempotency key but no request fingerprint/exact historical response.
6. Goal relevance has no content-goal data authority.
7. The task-board omits TASK-006D as an explicit dependency.

### Proposed minimal migration after approval

- add constrained `target_count` to `today_plan_activities`;
- add an ordered, actor/profile/language-consistent `today_activity_review_items` mapping for the
  exact Review queue slice selected at `asOf`;
- replace the active-only day uniqueness rule with one plan per actor/profile/local date, after a
  reviewed compatibility/backfill check;
- add constrained private `selection_diagnostics jsonb` containing policy/asOf/source/tier/cost,
  not raw learner-model internals;
- add completion request fingerprint and exact result snapshot, or one small actor-scoped Today
  mutation result table, following accepted Review/Reader idempotency patterns;
- add explicit same-plan deduplication constraints where nullable targets permit them;
- only if goal relevance is approved, add a provenance-backed curated content-goal mapping.

No migration is created in this design phase.

## 26. PostgreSQL performance strategy

- Review pool: indexed active due scan, bounded to capacity plus one; do not count/load the entire
  backlog.
- Weak/recent concept pool: at most 50 rows ordered by status tier, recency and concept UUID.
- Content pool: at most 20 from the existing Content Engine ordering with batched progress/save,
  weak/recent overlap, novelty count and audio eligibility.
- Prior plan lookup: one owner/profile/date indexed lookup.
- Completion proof: bounded indexed Review or Reader source-event query from `generatedAt`.
- No scan of all `learning_events`, no competence replay, no N+1 concept/content lookups and no
  full catalog load.

## 27. Concurrency and consistency

Generation uses one PostgreSQL transaction with repeatable-read semantics:

1. capture `asOf` and resolve actor/profile/timezone;
2. read existing current-day active plan;
3. if absent, read bounded candidates in one snapshot;
4. run the pure heuristic;
5. insert plan/activities;
6. let the unique active-day constraint select the winner;
7. on a concurrent winner, discard the losing transaction and read the winner.

A Review answer committing after the generation snapshot belongs to later state and does not
retroactively alter selection. No distributed lock or cross-service network transaction is needed.

## 28. Observability

Internal structured signals include:

- generation latency and candidate-query latency by source;
- selected activity counts/minutes by type;
- underfilled minutes;
- due overflow count bounded as `capacity exceeded`, not full-history scan;
- exclusion counts by safe reason;
- completion proof failures;
- policy version, `asOf`, plan ID and hashed actor/profile identifiers.

Logs omit JWTs, response text, raw competence values where unnecessary, SQL, database messages and
unpublished content metadata.

## 29. Future ranker boundary

```text
TodayCandidateSources -> tuple[TodayCandidate]
TodayPolicy.rank_and_pack(candidates, context) -> TodayDecision
TodayPlanRepository.persist(decision)
```

A future heuristic or ML ranker may implement the policy interface, but candidate generation and
domain authorities remain unchanged. No speculative feature vector or training telemetry is added
in v1.

## 30. Future test matrix

| ID | Required test |
| --- | --- |
| A | Same state/catalog/policy/asOf returns the same plan and diagnostics. |
| B | Every tie ends with the documented stable UUID/source-order tie-break. |
| C | IANA timezone, DST, local midnight and timezone-change behavior. |
| D | No due Review still produces eligible content only. |
| E | Large due backlog is bounded and retains a content reserve. |
| F | Review members follow exact queue `(dueAt, reviewItemId)` order. |
| G | Weak/forgotten content reinforcement and due deduplication. |
| H | No duplicate Review block, content/mode or concept purpose. |
| I | Unfinished Reader precedence over saved/new. |
| J | One new content item, four-unseen cap, no standalone learn. |
| K | Budget exactly filled without exceeding target. |
| L | Safe underfilled plan when candidates are insufficient. |
| M | Review overflow defers work without changing FSRS. |
| N | No suitable published content and fail-closed gate. |
| O | New learner with no estimate/competence uses easiest-first fallback. |
| P | Sparse/lineage-less competence is unknown and never recalculated. |
| Q | Underlying Review/Reader proof gates completion; card click alone fails. |
| R | Same-day GET returns stable identities/order/reasons. |
| S | State change between GETs reconciles completion but does not re-rank. |
| T | Policy version persists and constants cannot mix versions. |
| U | Actor/profile/language isolation and inactive profile rejection. |
| V | Query-count/candidate-limit assertions and index-backed PostgreSQL plans. |
| W | Both Today operations and success/error DTOs validate against OpenAPI. |
| X | TASK-006D masses/formulas/status remain unchanged. |
| Y | TASK-008 publication/progress/exposure behavior remains unchanged. |
| Z | Frozen frontend typecheck/lint, 307/27 tests, Storybook and build pass. |

Additional tests cover current/past/future `date`, concurrent GET winner, completion exact replay,
same-key changed-payload conflict, no partial plan on source failure, empty completed plan, public
reason mapping and no private diagnostic leakage.

## 31. Calibration examples

All examples use `targetMinutes = 25`, `asOf = 2026-09-01T01:00:00Z`, timezone
`Asia/Ho_Chi_Minh`, and policy `today-heuristic-v1`.

### 31.1 New learner

```text
pool        Review 0; A0 story (4 unseen, 10m); A1 story (8 unseen, 10m)
eligible    A0 yes; A1 rejected by novelty cap
priority    recommended-new -> Content Engine rank
packing     read A0 10m; 15m safely underfilled
plan        [read A0 / CONTENT_FIT + NEW_CONCEPT_BUDGET]
```

No estimate or competence is invented.

### 31.2 Learner with five due Reviews

```text
pool        five due in queue order; unfinished A1 story 10m; saved A1 dialogue 8m
eligible    all
priority    Review block first; unfinished before saved
packing     review 5m + continue read 10m + saved-not-started read 8m = 23m
plan        [review x5, continue story, saved dialogue]
```

The remaining two minutes are not padded.

### 31.3 Learner with 50 overdue Reviews

```text
pool        first bounded Review candidates in due order; unfinished suitable Reader item 8m
eligible    both sources
priority    Review first, content anti-starvation reserve
packing     review x17 = 17m + continue read = 8m
plan        [review x17 / FSRS_DUE, continue read / CONTENT_FIT]
```

Thirty-three due items remain in Review; Today changes no due date.

### 31.4 Weak concept plus unfinished Reader

```text
pool        no due Review; concept C is weak; unfinished story contains C (9m);
            distinct audio dialogue also contains C (5m)
eligible    both; C is not due
priority    unfinished weak reinforcement, then weak-listening audio if listening is lowest
packing     read story 9m + listen dialogue 5m = 14m
plan        [read / CONTENT_FIT + dimension weakness, listen / WEAK_LISTENING]
```

If C becomes due, the weakness purpose is deduplicated into Review and content loses that boost.

### 31.5 No due work plus suitable new content

```text
pool        recommended story (3 unseen, 10m), article (7 unseen, 10m), saved dialogue (0 unseen, 7m)
eligible    story yes; article no; saved dialogue yes
priority    saved-not-started before recommended-new
packing     saved dialogue 7m + new story 10m = 17m
plan        [read saved / CONTENT_FIT, read new / CONTENT_FIT + NEW_CONCEPT_BUDGET]
```

Only one not-started discovery item is introduced.

### 31.6 Everything complete

```text
pool        no due Review; all published content completed; no eligible audio/new content
eligible    none
priority    none
packing     zero
plan        persisted empty completed plan, completedMinutes 0
```

The API supplies the Today empty state and fabricates no activity or evidence.

## 32. Approved implementation decisions

1. Goal relevance is neutral in `today-heuristic-v1`; no goal mapping is added.
2. The eight-minute content reserve, four-unseen novelty cap, and 48-hour recent-exposure window
   are frozen constants.
3. The minimal target/diagnostic/completion-idempotency migration is authorized.
4. Standalone `learn` is excluded until an executable acquisition domain exists.

Runtime and migration work are authorized for TASK-010 only. OpenAPI and frontend remain frozen.
