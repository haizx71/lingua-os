# Learner Evidence and Competence Projection v1

Status: **APPROVED — IMPLEMENTATION AUTHORIZED**  
Task: `TASK-006D`  
Method version: `competence-beta-v1`  
Scope: English learning for Vietnamese learners in the MVP

## 1. Purpose and authority

This document defines the authoritative v1 policy that turns validated learning evidence into:

- recognition, listening, and production competence projections;
- confidence that is separate from competence score;
- learner-language skill aggregates;
- learner-concept mastery and ConceptStatus projections.

It does not implement the policy. The accepted project specifications, ADRs, OpenAPI contract,
and migration history retain their established precedence. This proposal becomes implementation
authority only after audit and explicit acceptance.

## 2. System responsibilities

### 2.1 Learner Evidence boundary

The Learner Evidence boundary validates actor ownership and language consistency, assigns canonical
event identity and ingestion order, appends immutable evidence, and invokes the projector in the
same PostgreSQL transaction.

It owns neither HTTP transport nor activity-specific presentation.

### 2.2 Competence Engine

The Competence Engine owns:

- interpretation of validated evidence;
- concept-level recognition/listening/production projections;
- language-profile-level recognition/listening/production projections;
- projection confidence and evidence counts;
- derived mastery and ConceptStatus;
- replay under an explicit method and parameter-set version.

### 2.3 Memory Engine

The Memory Engine remains the sole owner of FSRS difficulty, stability, due time, memory state,
review scheduling, and the one primary learner × concept memory lineage.

Competence may consume a completed review as evidence. It must never write FSRS state or create a
second schedule. Memory never reads competence or ConceptStatus to calculate an FSRS transition.

### 2.4 Later consumers

- TASK-012 Brain reads concept state, concept competence, skill aggregates, evidence summaries,
  and the separately joined MemorySnapshot.
- Progress reads immutable learning events and stable projections. It does not reconstruct policy
  in an HTTP handler.
- Today later consumes weakness, confidence, exposure recency, and FSRS urgency as separate inputs.
- Frontend code only renders server-owned projections.

## 3. Canonical terminology

| Term | Meaning |
| --- | --- |
| Source event | Activity-specific immutable fact, such as one Review answer or Reader encounter. |
| Learning event | Immutable, actor-owned canonical projector input caused by one source event. |
| Derivation key | Stable key distinguishing multiple learning events emitted by one source event. |
| Projectable evidence | Active evidence allowed to update a competence score. |
| Passive evidence | Encounter or intent evidence that updates history/exposure state but not score. |
| Outcome | Normalized value in `[0,1]` derived by the versioned projector from raw evidence. |
| Effective mass | Reliability-weighted evidence mass used by the competence model. |
| Competence score | Estimated ability for one dimension, distinct from confidence and memory. |
| Confidence | Amount of effective evidence supporting a score; never an alias for the score. |
| Mastery | Versioned aggregate derived from required concept dimensions, not a raw fact or level. |
| Ingestion sequence | Server-assigned order that is authoritative for v1 projection and replay. |

## 4. Evidence taxonomy

### 4.1 V1 event types

| Canonical event | Variant | Dimension effect | Polarity | Correct meaningful? | Response time in v1 | Repetition |
| --- | --- | --- | --- | --- | --- | --- |
| `learning.review.completed.v1` | `self_recall` | production | active, outcome-derived | optional/self-reported | stored, ignored | diminishing through accumulated mass |
| `learning.review.completed.v1` | `multiple_choice` | recognition | active, outcome-derived | yes when supplied | stored, ignored | diminishing through accumulated mass |
| `learning.review.completed.v1` | `typing` | production | active, outcome-derived | yes when supplied | stored, ignored | diminishing through accumulated mass |
| `learning.review.completed.v1` | `cloze` | recognition | active, outcome-derived | yes when supplied | stored, ignored | diminishing through accumulated mass |
| `learning.review.completed.v1` | `listening` | listening | active, outcome-derived | yes when supplied | stored, ignored | diminishing through accumulated mass |
| `learning.exposure.recorded.v1` | `read` | none | neutral/passive | no | optional, ignored | every distinct encounter is counted; score unchanged |
| `learning.exposure.recorded.v1` | `listen` | none | neutral/passive | no | optional, ignored | every distinct encounter is counted; score unchanged |
| `learning.exposure.recorded.v1` | `lookup` | none | neutral/passive | no | no | every distinct encounter is counted; score unchanged |
| `learning.concept.saved.v1` | save intent | none | neutral/intent | no | no | idempotent intent; score unchanged |
| `assessment.completed.v1` | future assessment evidence | later supplied dimension | active only after TASK-016 mapping | item correctness may be meaningful | retained, ignored by v1 | defined by the later accepted adapter |
| `today.activity.completed.v1` | completion metadata | none directly | neutral | no | duration may be retained | underlying learning activity emits its own evidence |

No speech, pronunciation, phoneme, AI-generated, Chinese, or Japanese evidence exists in v1.

### 4.2 Positive, negative, and neutral evidence

- Active evidence is positive when normalized outcome is above `0.5`, negative when below `0.5`,
  and neutral when exactly `0.5`.
- Passive evidence is always neutral for competence, even after many repetitions.
- A save expresses learning intent, not demonstrated ability.
- Today completion cannot stand in for the underlying answer or encounter.

### 4.3 Required raw fields

Every learning event requires:

- `learningEventId`, `sourceType`, `sourceEventId`, `derivationKey`;
- `userId`, `userLanguageId`, `eventType`, `schemaVersion`;
- server-owned `ingestionSequence`, `ingestedAt`, and actor ownership;
- `occurredAt`, `idempotencyKey`, `requestFingerprint`;
- raw payload and source-event identity;
- `projectionMethodVersion` for the projector that accepted it.

Every concept-projectable event additionally requires `conceptId`. Review evidence requires
`reviewEventId`, `reviewItemId`, `exerciseMode`, `evidenceMode`, `rating`, and `responseTimeMs`.
`correct`, response text, and selected option remain optional according to the current Review
contract. Sensitive response content is not copied into the canonical learning event unless a
future policy explicitly needs it.

Exposure evidence requires `exposureType` and at least one owned source reference. A concept-level
exposure event targets at most one concept. A content encounter spanning several concepts is
expanded server-side into concept child events with stable child idempotency keys; clients never
choose arbitrary concept ownership.

## 5. Exercise mode and competence dimension

The accepted Memory Engine mapping remains unchanged:

| Exercise mode | Audit evidence mode | Competence dimension |
| --- | --- | --- |
| `self_recall` | `production` | production |
| `multiple_choice` | `recognition` | recognition |
| `typing` | `production` | production |
| `cloze` | `cloze` | recognition |
| `listening` | `listening` | listening |

### Cloze decision

V1 treats cloze as **recognition evidence**. The surrounding sentence and blank constrain the
answer strongly, so cloze does not demonstrate uncued production reliably enough to update the
production projection. It remains a distinct audit evidence mode so a future accepted method can
recalibrate it without rewriting history. It never creates a fourth competence dimension or
scheduler.

## 6. Correctness and rating semantics

Review rating continues to mean FSRS recall quality for Memory. The competence projector interprets
the same raw record independently and never duplicates FSRS equations.

### 6.1 Outcome precedence

1. When `correct` is present, correctness determines the competence outcome: `true → 1`,
   `false → 0`.
2. When `correct` is absent and rating is present, the projector uses the linear ordinal anchors:
   `again → 0`, `hard → 1/3`, `good → 2/3`, `easy → 1`.
3. When neither is present, the event is not projectable competence evidence. It may still be a
   valid passive event.
4. When correctness and rating disagree, both raw values remain in history, correctness wins for
   competence, and rating remains authoritative only for FSRS. The event is not rejected because
   difficulty/effort and correctness measure different things.

The ordinal anchors are not additive score deltas. They place the four ordered rating categories at
equal intervals in a bounded observation scale, which avoids unexplained `+0.1/-0.2` rules.

### 6.2 Evidence reliability

| Outcome source | Effective weight | Rationale |
| --- | ---: | --- |
| Objective correctness from multiple-choice, typing, cloze, or listening response | `1` | One directly observed answer. |
| Self-recall correctness | `1/2` | Learner-reported rather than independently scored. |
| Rating-derived fallback in any mode | `1/2` | Ordered self-report with less certainty than observed correctness. |
| Passive exposure or save intent | `0` | No demonstrated answer. |

These named weights live in the immutable `competence-beta-v1` parameter set. Response time has
weight zero in v1 because reading speed, accessibility needs, device conditions, and language level
confound it. It remains available for later audited methods.

## 7. Competence update model

### 7.1 Selected model

V1 uses a reliability-weighted Beta evidence model for every:

- learner × concept × competence dimension; and
- learner language profile × competence dimension.

The model is deterministic, additive, bounded, explainable, incrementally maintainable, and exactly
rebuildable from immutable events. It does not use ML or IRT.

### 7.2 Named parameters

| Parameter | V1 value | Purpose |
| --- | ---: | --- |
| `PRIOR_ALPHA` | `2` | Conservative symmetric positive prior support. |
| `PRIOR_BETA` | `2` | Symmetric negative prior; prevents one result from dominating. |
| `OBJECTIVE_EVIDENCE_WEIGHT` | `1` | One observed answer. |
| `SELF_REPORTED_EVIDENCE_WEIGHT` | `1/2` | Discount self-reported evidence. |
| `CONFIDENCE_HALF_SATURATION_MASS` | `4` | Confidence is `0.5` after four objective-equivalent observations. |
| `MIN_MASTERY_EFFECTIVE_MASS_PER_DIMENSION` | `2` | Two objective-equivalent observations before a required dimension enters mastery. |

### 7.3 Soft-Beta update equation

For every distinct projectable event, let normalized outcome `x ∈ [0,1]` and reliability weight
`w ≥ 0`. Under `competence-beta-v1`, the exact update is:

```text
positive_delta := w × x
negative_delta := w × (1 - x)

positive_mass := positive_mass + positive_delta
negative_mass := negative_mass + negative_delta

alpha := PRIOR_ALPHA + positive_mass
beta  := PRIOR_BETA + negative_mass

score := alpha / (alpha + beta)
effective_mass := positive_mass + negative_mass
```

The immutable `competence-beta-v1` parameter set defines `PRIOR_ALPHA = 2` and `PRIOR_BETA = 2`.
There is no other implicit prior. The prior contributes to the posterior score but never to
`evidence_count`, `effective_mass`, mastery eligibility, or confidence.

Exact rating-derived updates use `w = 1/2`:

| Rating | `x` | `positive_delta` | `negative_delta` |
| --- | ---: | ---: | ---: |
| Again | `0` | `0` | `1/2` |
| Hard | `1/3` | `1/6` | `1/3` |
| Good | `2/3` | `1/3` | `1/6` |
| Easy | `1` | `1/2` | `0` |

Objective correctness uses `w = 1`: correct evidence adds `(1, 0)` and incorrect evidence adds
`(0, 1)` to `(positive_mass, negative_mass)`. Self-recall correctness uses `w = 1/2`, so it adds
`(1/2, 0)` or `(0, 1/2)`. Fractional outcomes are therefore explicit soft observations, not score
deltas.

`evidence_count` increments once per distinct projectable event regardless of its reliability
weight. Passive evidence does not increment competence evidence count.

Zero evidence produces score `0.5`, confidence `0`, and evidence count `0`: the score is explicitly
unknown, not proof of medium competence. Accumulating evidence makes each additional observation
naturally less dominant. No recency decay exists in v1; memory decay remains FSRS-owned.

### 7.4 Alternatives rejected

- Fixed score deltas are easy to code but depend heavily on event order and arbitrary clamps.
- Exponential moving averages discard sufficient history and make replay sensitive to late-event
  order and an opaque smoothing constant.
- IRT/ML requires calibrated items and empirical data not available for MVP.
- Separate modality schedulers violate the one-memory-lineage invariant.

## 8. Confidence model

Confidence is independently derived from effective evidence mass:

```text
confidence := effective_mass /
              (effective_mass + CONFIDENCE_HALF_SATURATION_MASS)
```

Properties:

- zero evidence gives confidence `0`;
- confidence grows monotonically with effective evidence, including conflicting evidence;
- confidence approaches but never reaches `1` for finite evidence;
- confidence does not fall merely because score falls;
- confidence does not equal score;
- v1 applies no recency decay or diversity multiplier.

Evidence diversity is intentionally visible in event history but not included in v1 confidence.
Adding a diversity or recency factor later requires a new method version and replay. This keeps v1
auditable and avoids inventing source-quality constants without data.

## 9. User skill states

`user_skill_states` represents language-profile-wide recognition, listening, or production ability,
not a scheduler and not an average of UI percentages.

For each of the three dimensions it stores or derives:

- score from all projectable events in that profile/dimension;
- independent confidence;
- raw projectable `evidence_count`;
- positive and negative effective mass;
- `last_evidence_at` based on the last ingested projectable event;
- projection state version and exact parameter-set/method version.

All three dimension rows are initialized server-side with score `0.5`, confidence `0`, and zero
mass/count when the first learner evidence for a language profile is ingested. Missing rows are not
interpreted by frontend code.

## 10. User concept states and mastery

### 10.1 Projection source-of-truth hierarchy

The hierarchy is fixed as follows:

```text
immutable source events
        ↓ source_type + source_event_id
append-only learning_events                     ← authoritative replay input
        ↓ competence-beta-v1 + parameter set
user_concept_states / user_skill_states          ← rebuildable materialized projections
        ↓ fixed mastery policy
mastery + aggregate confidence + ConceptStatus   ← fields in user_concept_states
```

There is no independently mutable competence state. Source events establish activity facts;
`learning_events` is the sole ordered input for competence replay; all learner-state rows are
derived caches that may be dropped and rebuilt.

### 10.2 Table ownership

| Relation | Key/uniqueness | Authority and contents | Replay/version behavior | Why it exists |
| --- | --- | --- | --- | --- |
| Source rows such as `review_events` and `exposure_events` | Existing source PK; actor-scoped idempotency uniqueness | Canonical activity fact and exact source mutation result where required | Append-only; not a competence projection | Activity-specific audit fields do not belong in a generic event envelope. |
| `learning_events` | `learning_event_id` PK; unique source derivation tuple | Sole canonical competence replay stream: raw normalized evidence envelope, source link, order, fingerprint | Append-only; event schema versioned | A stable cross-activity input is required for deterministic replay. |
| `user_concept_states` | Existing UUID PK plus `UNIQUE(user_id, concept_id)` | **Only concept projection row.** Owns all three dimensions' masses, counts, scores, confidences and last-evidence times, plus exposure summary, mastery, aggregate confidence, status and high-water achievement | Fully rebuildable; records method, parameter-set and state versions | Existing table already owns the three fixed MVP dimensions and aggregate concept state. Extending it is smaller and safer than adding a second concept-state table. |
| `user_skill_states` | Existing UUID PK plus `UNIQUE(user_language_id, skill)` | Language-profile aggregate for one dimension, derived directly from all applicable learning events | Fully rebuildable; records method, parameter-set and state versions | Profile-level evidence, including future evidence without a concept, cannot be represented by one concept row. It is a different aggregation scope, not a second concept truth. |
| `user_language_projection_heads` | `user_language_id` PK | Operational ingestion sequence head and active projection lineage; no competence score | Recreated as `max(sequence)+1` during rebuild | Serializes per-profile event order without process locks. |
| `competence_parameter_sets` | Immutable ID/version | Canonical priors, reliability weights, confidence constant, mastery defaults and status thresholds | Never rebuilt from learner events | Historical projection interpretation requires immutable configuration. |
| `concept_competence_policies` | `(concept_id, parameter_set_id, parameter_version)` plus dimension entries | Canonical dimension applicability/weights only for skill concepts and approved overrides | Versioned reference data, not learner state | Skill modality cannot be inferred safely from concept name/type alone. |

`user_concept_competence_states` is therefore **removed from the proposed design**. With exactly
three locked MVP dimensions, it would duplicate the authority already present in
`user_concept_states` and create a drift/reconciliation path without adding domain capability.

Memory fields and due information are never copied into concept state. TASK-012 joins
MemorySnapshot separately. A missing `user_concept_states` row means `unseen`; the first accepted
event creates the one concept projection row transactionally.

### 10.3 Mastery policy and formula

Let `D(c)` be the dimensions whose configured mastery weight `q(c,d)` is greater than zero for
concept `c`. All weights are immutable within the parameter lineage, non-negative, and satisfy:

```text
Σ q(c,d) for d in D(c) = 1
```

V1 policy is:

| Concept type/policy | Recognition | Listening | Production | Rule |
| --- | ---: | ---: | ---: | --- |
| `word` | `0.40` | `0.30` | `0.30` | Locked lexical default from the accepted specification. |
| `phrase` | `0.40` | `0.30` | `0.30` | Same lexical default. |
| `grammar` | `0.50` | `0` | `0.50` | Context recognition and active use participate; listening remains visible but is not required for grammar mastery v1. |
| `skill` | no type default | no type default | no type default | An explicit `concept_competence_policies` vector is mandatory for each skill concept. |

A skill policy may intentionally be single-dimension (for example listening weight `1`) or
multi-dimension, but the exact vector is curated data, never inferred from `canonical_key`. A skill
without an accepted policy has mastery `null`, aggregate confidence `0`, and status capped at
`learning`.

For each required dimension `d`, eligibility requires evidence-only effective mass:

```text
effective_mass(c,d) >= MIN_MASTERY_EFFECTIVE_MASS_PER_DIMENSION = 2
```

Prior mass does **not** satisfy eligibility. If any required dimension is ineligible, mastery is
`null`; weights are never renormalized around missing evidence. Thus one strong dimension cannot
master a lexical or grammar concept. A single dimension can master a skill only when its explicit
policy intentionally assigns that dimension weight `1`.

Once every required dimension is eligible, the posterior dimension scores—including their
conservative `Beta(2,2)` priors—participate using fixed policy weights:

```text
mastery(c) := Σ [q(c,d) × score(c,d)] for d in D(c)
```

Dimension confidence does not change or renormalize mastery weights. Aggregate concept confidence
is always:

```text
concept_confidence(c) := Σ [q(c,d) × confidence(c,d)] for d in D(c)
```

For a configured concept with an under-evidenced required dimension, its actual low dimension
confidence participates in aggregate confidence while mastery remains `null`. Both aggregates are
bounded in `[0,1]`, deterministic, replayable, and tied to the same parameter lineage.

## 11. ConceptStatus policy

### 11.1 Ownership and boundary

The Competence Engine owns the authoritative ConceptStatus projection. It may use evidence history,
save intent, and passive encounters represented in `learning_events`, but it never uses live
Memory state or `dueAt` as a status input. Memory Engine does not read status, so there is no
circular dependency and full evidence replay is sufficient to reproduce status.

`isDue` and `dueAt` remain separate scheduling information in every API.

### 11.2 Versioned thresholds

| Named threshold | V1 value |
| --- | ---: |
| `FAMILIAR_MASTERY_MIN` | `0.60` |
| `FAMILIAR_CONFIDENCE_MIN` | `0.40` |
| `ACTIVE_MASTERY_MIN` | `0.75` |
| `ACTIVE_CONFIDENCE_MIN` | `0.60` |
| `MASTERED_MASTERY_MIN` | `0.85` |
| `MASTERED_CONFIDENCE_MIN` | `0.75` |
| `WEAK_OUTCOME_MAX` | `< 0.50` |
| `WEAK_CONSECUTIVE_COUNT` | `2` |
| `FORGOTTEN_OUTCOME` | `0` |
| `FORGOTTEN_CONSECUTIVE_COUNT` | `3` |
| `FORGOTTEN_MASTERY_MAX` | `< 0.50` |
| `FORGOTTEN_CONFIDENCE_MIN` | `0.50` |

These are product policy bands, not certified level boundaries. They are immutable within
`competence-beta-v1`; changing them requires a new parameter set and replay.

### 11.3 Derived history inputs

Before selecting a status, replay maintains these deterministic values for each concept:

- `has_passive_exposure`: at least one passive exposure learning event;
- `has_learning_intent`: at least one save-intent learning event;
- `has_projectable_evidence`: at least one competence-projectable learning event;
- `highest_achievement_status`: the highest previously selected value among `familiar`, `active`,
  and `mastered` under the same parameter lineage;
- current mastery and aggregate confidence;
- per required dimension, the ordered projectable outcome history in ingestion order.

`highest_achievement_status` is a rebuildable projection field, not an irreversible raw fact. A
parameter-version rebuild recomputes it from the beginning.

### 11.4 Deterministic precedence algorithm

For every event and full replay step, evaluate exactly once in this order and choose the first
matching status:

1. `forgotten`
2. `weak`
3. `mastered`
4. `active`
5. `familiar`
6. `learning`
7. `discovered`
8. `unseen`

Predicates are:

```text
previously_established := highest_achievement_status is familiar, active, or mastered

forgotten := previously_established
             AND one required dimension's latest 3 projectable outcomes are exactly [0,0,0]
             AND mastery is not null AND mastery < 0.50
             AND concept_confidence >= 0.50

weak := previously_established
        AND (
          one required dimension's latest 2 projectable outcomes are each < 0.50
          OR (mastery is not null AND mastery < 0.60
              AND concept_confidence >= 0.40)
        )

mastered := mastery >= 0.85 AND concept_confidence >= 0.75
active   := mastery >= 0.75 AND concept_confidence >= 0.60
familiar := mastery >= 0.60 AND concept_confidence >= 0.40

learning := has_learning_intent OR has_projectable_evidence
discovered := has_passive_exposure
unseen := true
```

Comparisons with `mastery = null` are false. For skill concepts without an accepted mastery policy,
achievement/degradation predicates are false and the maximum possible status is `learning`.
`dueAt`, `isDue`, FSRS state, and current review-item status are absent from every predicate.

### 11.5 Complete eight-state machine

| Status | Entry condition | Exit and recovery condition | Required history |
| --- | --- | --- | --- |
| `unseen` | No passive exposure, learning intent, or projectable evidence exists. This is also the query result when no concept projection row exists. | Any passive exposure exits to `discovered`; save intent or projectable evidence exits to `learning`. Immutable history means it never returns from another state within one lineage. | None. |
| `discovered` | Passive exposure exists, but no save intent or projectable evidence exists. Repeated passive exposure leaves it here. | First save intent or projectable evidence exits to `learning`. It cannot return to `unseen`. | At least one passive exposure only. |
| `learning` | Save intent or projectable evidence exists and no degradation or achievement predicate matches. | Enters `familiar`/`active`/`mastered` when their thresholds first match. A recovered weak/forgotten concept returns here when degradation predicates clear but achievement thresholds do not match. | Learning intent or at least one projectable event. |
| `familiar` | Mastery ≥ `0.60` and aggregate confidence ≥ `0.40`, with no weak/forgotten predicate. | Advances to active/mastered at higher thresholds; exits to weak/forgotten when those higher-precedence predicates match. Recovery from weak/forgotten can select familiar again after degradation clears. | Full mastery-dimension eligibility plus threshold evidence. |
| `active` | Mastery ≥ `0.75` and aggregate confidence ≥ `0.60`, with no weak/forgotten predicate. | Advances to mastered; falls to familiar if only familiar thresholds remain; exits to weak/forgotten on degradation. Recovery re-evaluates all thresholds. | Full mastery-dimension eligibility plus threshold evidence. |
| `mastered` | Mastery ≥ `0.85` and aggregate confidence ≥ `0.75`, with no weak/forgotten predicate. | One failure alone does not invoke weak/forgotten; the posterior may keep mastered or select active/familiar. Two recent weak outcomes invoke weak; the exact forgotten predicate invokes forgotten. Recovery re-evaluates current thresholds. | Full mastery-dimension eligibility plus threshold evidence. |
| `weak` | Concept was previously established and its latest two outcomes in one required dimension are each `<0.50`, or mastery is below `0.60` with confidence ≥ `0.40`; forgotten predicate does not match. | If forgotten predicate later matches, enter forgotten. Otherwise weak exits only when both weak clauses become false; then current thresholds choose mastered/active/familiar, or learning if none match. A success breaks the two-outcome streak but may not recover status until mastery is also ≥ `0.60`. | High-water achievement plus recent/aggregate degradation evidence. |
| `forgotten` | Concept was previously established; one required dimension ends in exactly three zero outcomes; mastery `<0.50`; confidence ≥ `0.50`. | Any non-zero projectable outcome breaks the three-zero predicate. The next evaluation normally selects weak while weak conditions remain, then an achievement or learning state after sufficient recovery. | High-water achievement, three exact failures in one required dimension, and aggregate degradation. |

### 11.6 Required scenario outcomes

- `mastered + one failure`: no automatic weak label. Recompute posterior; select mastered, active,
  or familiar according to thresholds unless another older failure completes a two-event weak streak.
- `active + two weak outcomes in one required dimension`: select weak before any achievement state.
- `weak + successful evidence`: if both weak clauses clear, recompute to mastered/active/familiar or
  learning; otherwise remain weak.
- `forgotten + successful evidence`: the exact three-zero predicate clears; select weak if its
  predicate remains, otherwise an achievement or learning state.
- `discovered + recognition success`: projectable evidence makes the state at least learning;
  mastery remains null until every required dimension is eligible.
- zero competence evidence plus any number of passive exposures: discovered, never familiar or
  higher.

## 12. Passive exposure semantics

A Reader encounter proves opportunity, not knowledge.

Each distinct, idempotently recorded passive concept exposure:

- increments `exposure_count`;
- updates `last_seen_at` using ingestion order while retaining source `occurredAt` for audit;
- can move `unseen → discovered`;
- does not change positive/negative mass, competence score, competence confidence, mastery, or
  competence evidence count;
- cannot by repetition alone move a concept to familiar, active, mastered, weak, or forgotten.

Therefore repeated exposure needs no arbitrary diminishing score factor in v1: its competence
influence is always zero. Exposure frequency remains available to Today and Progress later.

## 13. Idempotency and event identity

### 13.1 Separate identities

Source and canonical identities are deliberately different:

- `source_event_id`: UUID primary identity of the activity-specific fact, such as
  `review_events.id` or `exposure_events.id`.
- `source_type`: constrained internal discriminator such as `review_event`, `exposure_event`, or
  later `assessment_result`.
- `learning_event_id`: independent UUID primary identity of one canonical projector input.
- `derivation_key`: stable server-owned key distinguishing canonical events emitted by the same
  source, for example `concept:<concept_uuid>`.
- `causation_learning_event_id`: optional FK to another canonical learning event only when a
  canonical event directly causes another canonical event. It never replaces source linkage.

One Review source normally emits one concept learning event. A future content exposure source may
emit several concept learning events, each with a different derivation key. Sharing primary UUIDs
would make that valid one-to-many relationship impossible and is prohibited.

### 13.2 Uniqueness and linkage

The eventual schema must enforce:

```text
PRIMARY KEY (learning_event_id)
UNIQUE (user_id, source_type, source_event_id, derivation_key)
FOREIGN KEY (causation_learning_event_id) REFERENCES learning_events(learning_event_id)
```

The source record owns its `source_event_id`; the canonical event stores `source_type` and
`source_event_id`. Because PostgreSQL cannot safely enforce a polymorphic FK, the application
transaction validates and locks the typed source row before append, and source/canonical append is
atomic. A later schema may use typed nullable FKs instead, but must preserve this semantic model.

### 13.3 Idempotency identity and conflicts

The initiating source mutation owns `idempotencyKey`, scoped by authenticated `user_id`, and a
source request fingerprint. It is claimed atomically on the source table, following the accepted
Review pattern. Canonical child events do not independently claim the same public key; their unique
source derivation tuple prevents duplicate projection.

The canonical `requestFingerprint` is SHA-256 over event type/schema version, owned profile and
resource IDs, `source_type`, `source_event_id`, `derivation_key`, raw evidence fields, and source
`occurredAt`. It excludes `learning_event_id`, server ingestion time/sequence, projection output,
and retry-attempt metadata.

- Same source idempotency key + same source fingerprint replays the stored source result.
- Same source key + different source fingerprint raises the existing idempotency conflict.
- Same source derivation tuple + same canonical fingerprint returns the existing learning event and
  causes no mass/count/status/version change.
- Same source derivation tuple + different canonical fingerprint is a deterministic integrity
  conflict and rolls back the source transaction.
- Reuse of a `learning_event_id` for a different derivation is an integrity conflict.
- No check-then-insert race is permitted.

Source idempotency and canonical source-derivation records are retained for the immutable history
lifetime.

## 14. Event ordering and replay

### 14.1 Authoritative v1 ordering

V1 uses server-assigned `ingestionSequence`, not client/source timestamps, as authoritative order.
Within a learner language profile, events are projected and replayed by:

```text
(ingestionSequence, learningEventId)
```

`occurredAt` remains immutable source time for audit and progress bucketing. A delayed event is
appended when received and affects projections after already-ingested events. This explicit rule
avoids silent historical rewrites and keeps incremental processing equivalent to full replay.

### 14.2 Duplicated, delayed, and out-of-order events

- Duplicate retry: replay/no-op through idempotency.
- Delayed event: accepted with a later ingestion sequence.
- Source timestamp older than current projection: accepted if otherwise valid; no rewind.
- Future timestamp beyond the accepted clock-skew bound: rejected at ingestion.
- Full rebuild: reset derived rows and consume all immutable events in ingestion order under the
  selected method/parameter version.

The Beta score is commutative, but status uses recent streaks; therefore every projector and rebuild
must still use the authoritative ingestion order.

## 15. Projection versioning

Three versions remain distinct:

- event `schemaVersion`: shape of immutable raw payload;
- `projectionMethodVersion`: algorithm family, initially `competence-beta-v1`;
- immutable parameter-set ID/version: priors, reliability weights, mastery profiles, confidence
  constant, and status thresholds.

Every derived row records method and parameter-set lineage. Existing rows are not silently
reinterpreted when a new default is published. A later migration/reprojection job must explicitly
select the target version, rebuild, verify, and atomically switch the readable projection lineage.

## 16. Transaction boundary

For one logical evidence intent, the eventual implementation performs in one PostgreSQL
transaction:

1. authenticate actor and validate owned language/concept/source resources;
2. lock projection rows in the documented order;
3. claim idempotency and assign the ingestion sequence;
4. append the source record and one or more separately identified canonical learning events;
5. update affected dimensions' sufficient statistics in the single concept projection row;
6. update affected language skill state;
7. derive mastery, confidence, status, and aggregate concept state;
8. persist any exact mutation-result snapshot required for idempotent API replay;
9. commit.

Any validation, append, projection, snapshot, or persistence failure rolls back every step. There is
no successful event without projections and no projection without its immutable event.

## 17. Concurrency strategy

Correctness is PostgreSQL-backed; Python process locks are prohibited.

Lock order is source-aware but never circular:

- Review transaction: owned review item/FSRS state first, then learner-language projection head,
  affected `user_skill_states` rows ordered by dimension, then `user_concept_states` rows ordered
  by concept UUID.
- Non-Review evidence transaction: learner-language projection head, skill rows, then concept rows.
- No transaction may acquire a Memory row after acquiring a competence projection row.

Unique idempotency constraints select the winner for duplicate intent. Projection rows use
`state_version` compare-and-update as defence after row locking. A row-count mismatch is a
concurrency failure and rolls back; it is never retried inside an unknown transaction outcome.

## 18. Review integration

The Review application command layer—not `PostgresMemoryEngine` and not an HTTP handler—owns the
single database connection and transaction. Memory and Competence expose transaction-participating
domain/store operations that accept this connection; neither engine may commit independently.
Review processing is:

```text
authenticated Review submission
→ Review application opens one PostgreSQL transaction
→ Memory operation locks owned review item / FSRS state
→ Memory operation calculates accepted FSRS transition without committing
→ append review_event and update FSRS state
→ append separately identified canonical learning.review.completed.v1 event linked to review_event
→ update competence projections
→ calculate remainingDueCount in the same transaction
→ persist exact Review domain-result snapshot
→ Review application commits once
```

Scheduler math remains inside the accepted Memory adapter. The Competence Engine receives only the
immutable completed-review evidence. The exact stored Review domain result contains A's historical
`MemorySnapshot`, competence snapshot, `remainingDueCount`, and any other deterministic
`ReviewAnswerResult` data. Per-request response metadata such as a new request ID is not part of the
stored domain result.

Failure in either engine rolls back review event, FSRS state, learning event, projections, due
count result, and snapshot. For delayed replay `A → B → replay A`, the application returns A's
stored MemorySnapshot, competence snapshot, and remainingDueCount even though current state is B.
It must not rerun either transition, read B's current projection as A's result, or recompute A's due
count. This requires a private exact Review result snapshot analogous to the accepted memory result
snapshot. V1 retains `result_memory_snapshot` and freezes the additional private fields as
`result_competence_snapshot`, `result_remaining_due_count`, and optional `result_feedback` on the
same review event; they are not public algorithm payloads.

## 19. Reader exposure contract finding

**NO CONTRACT CHANGE REQUIRED FOR TASK-006D.**

TASK-006D implementation can provide an internal actor-scoped evidence service and projector, and
Review already has an authoritative mutation from which evidence can be emitted.

Separately, **a contract amendment is required before TASK-008 may record ordinary browser Reader
exposure**. The current OpenAPI has analyze, save-sentence, content, library, and Today-completion
operations, but no normal Reader encounter mutation. GET content must not gain a hidden write side
effect, and Today completion covers only Today-owned activity.

Smallest future proposal, subject to a separate contract review:

```text
POST /v1/reader/exposures
Idempotency-Key: UUID

body: languageProfileId, contentId, optional sentenceId,
      exposureType(read|listen), optional durationMs, occurredAt
```

The server validates content/profile ownership and derives concept occurrences; the client does not
supply competence outcomes or arbitrary concept ownership. The response should return the accepted
event ID and recorded timestamp in the standard envelope. This proposal is not added to OpenAPI in
the design turn.

## 20. Starting Level Estimate boundary

TASK-016 remains the owner of assessment selection and estimate logic. Later integration emits
`assessment.completed.v1` evidence through the same internal service:

- profile-level dimension evidence can update `user_skill_states`;
- concept-level evidence is allowed only when the assessment item has authoritative concept links;
- CEFR/framework result does not directly become concept mastery;
- assessment adapter supplies raw correctness/dimension metadata and a versioned source method;
- no IRT or placement algorithm is introduced by TASK-006D.

Assessment evidence mapping and reliability require their own accepted parameter-set version or an
additive revision before TASK-016 integration.

## 21. Brain and Progress boundary

TASK-006D creates the source projections later consumed as follows:

| Consumer | Reads |
| --- | --- |
| Brain summary | status counts, language skill projections, recent concept states, exposure summaries |
| Brain concept list/detail | aggregate concept state, three concept-dimension projections, evidence summary |
| Brain memory display | separately joined MemorySnapshot from Memory Engine |
| Progress | immutable events for time windows plus stable skill/concept projections |
| Today | later reads FSRS urgency, competence weakness, exposure recency, and content fit separately |

TASK-012, TASK-014, and TASK-010 must not duplicate projection formulas in query handlers.

## 22. Proposed schema changes for implementation

No migration is created in this design phase. The future implementation should propose one
versioned migration containing only reviewed changes such as:

1. `competence_parameter_sets`: immutable method/parameter lineage containing named priors,
   reliability weights, confidence constant, mastery profiles, and status thresholds.
2. `concept_competence_policies`: explicit per-concept dimension weights for skill concepts and
   approved overrides; weights are constrained to `[0,1]` and sum to `1` per lineage.
3. `user_language_projection_heads`: one actor/profile-owned sequence and projection head used to
   allocate monotonically increasing per-profile ingestion sequence under a row lock.
4. `user_concept_states`: remain the single concept projection. Retain recognition/listening/
   production, aggregate status/mastery/confidence/exposure fields, and add per-dimension
   positive/negative mass, confidence, evidence count and last-evidence time plus
   `highest_achievement_status`, exact parameter-set lineage, and state version. No
   `user_concept_competence_states` table is created.
5. `user_skill_states`: add positive/negative mass, `last_evidence_at`, state version, and exact
   parameter-set lineage. Existing `method_version` remains; `assessed_at` is clarified as projection
   update time or superseded by an accurately named field.
6. `learning_events`: use an independent `learning_event_id`, plus constrained `source_type`,
   `source_event_id`, stable `derivation_key`, optional `causation_learning_event_id`, canonical
   fingerprint, server ingestion timestamp/sequence, and projection method/parameter lineage.
   Enforce unique source derivation; existing actor/profile/concept FKs remain.
7. Review replay persistence: retain existing `review_events.result_memory_snapshot` and add
   private immutable `result_competence_snapshot`, `result_remaining_due_count`, and optional
   `result_feedback` fields on the same review event. Their constrained values form the exact
   historical Review domain result without duplicating the memory snapshot.

RLS, actor ownership, language-consistent composite FKs, UTC timestamps, append-only protection,
explicit delete behavior, and concrete replay/access indexes are mandatory. No event payload is a
substitute for structured ownership relations.

## 23. Implementation acceptance criteria

TASK-006D implementation is acceptable only when:

- the accepted raw evidence taxonomy and validation rules are implemented without new public
  endpoints;
- every active evidence mode maps to exactly one accepted competence dimension;
- formulas and constants come from immutable `competence-beta-v1` parameter lineage;
- zero, positive, negative, conflicting, repeated, and passive evidence follow this document;
- score/confidence remain in `[0,1]`, confidence remains independent, and passive exposure never
  changes competence;
- concept and language-skill incremental projections exactly equal full replay in ingestion order;
- status follows the eight-value policy, never contains `due`, and frontend performs no inference;
- same source key/payload retry reuses the source result and every existing canonical derivation;
  conflicting source or canonical fingerprint reuse fails safely;
- evidence append, concept projection, skill projection, status, and replay result are atomic;
- concurrent same-concept events are serialized by PostgreSQL without lost updates;
- ownership and language boundaries reject cross-user/cross-language evidence;
- Review atomically updates Memory and Competence while preserving FSRS-6 behavior and one memory
  lineage;
- migrations apply from empty, no-op reapply, rollback safely in disposable DBs, and preserve
  accepted existing data;
- TASK-007 and frontend remain frozen with the 307 tests / 27 files regression baseline;
- TASK-008, Today, Starting Level, Brain, and Progress are not implemented.

## 24. Future implementation test plan

No tests are implemented in the design phase. The implementation suite must cover:

### Domain and property tests

- deterministic projection for identical event history/configuration;
- every approved review/exposure mode and cloze-to-recognition mapping;
- score/confidence bounds under generated histories;
- zero evidence, one objective success/failure, and one self-reported rating;
- repeated positive, repeated negative, and conflicting evidence;
- confidence growth independent of score direction;
- passive exposure changes only exposure state;
- mastery coverage and word/phrase/grammar/skill profiles;
- all ConceptStatus entry, degradation, recovery, and precedence rules;
- projection method/parameter lineage rejection on mismatch.

### Idempotency, ordering, and replay tests

- same key/fingerprint produces one event and one projection shift;
- conflicting key/fingerprint raises deterministic conflict;
- duplicate source retry and duplicate canonical source-derivation replay;
- delayed/out-of-source-order event receives later ingestion sequence;
- incremental processing equals full rebuild from canonical history;
- status recent-streak behavior is identical after rebuild;
- new method version does not silently reinterpret old rows.

### PostgreSQL and security tests

- transaction rollback at every append/projection boundary;
- same-concept and cross-concept concurrent events without lost updates or deadlock;
- unique identity and state-version constraints;
- cross-user, cross-profile, cross-language, and mismatched-concept rejection;
- RLS/default-deny and server-owned write boundaries;
- empty migration, idempotent reapply, rollback/reapply, checksum, FK/CHECK/index evidence.

### Review and regression tests

- each Review mode emits the exact accepted evidence metadata;
- correctness precedence and rating fallback;
- atomic review event + FSRS transition + learning event + projections;
- idempotent Review replay returns original mutation result;
- Competence failure rolls back Memory and vice versa;
- no FSRS parameter/state is accepted as competence input;
- one learner × concept review item and one FSRS state remain enforced;
- existing Memory scheduler golden/invariant tests remain unchanged;
- full backend/database suite and frozen frontend 307/27 regression pass.

## 25. Resolved and deferred decisions

Resolved for v1:

- Beta-style weighted evidence model;
- independent mass-based confidence;
- correctness precedence with rating fallback;
- cloze projects recognition;
- passive exposure never changes competence;
- ingestion sequence is replay order;
- source-event identity and canonical learning-event identity are separate;
- `user_concept_states` is the single concept competence/aggregate projection;
- all eight ConceptStatus predicates and precedence/recovery rules are frozen;
- PostgreSQL transaction/locking is authoritative;
- Review application owns one transaction and delayed replay returns its stored historical result;
- Competence owns status, while Memory remains independent;
- no public contract change is needed to implement the internal TASK-006D core.

Deliberately deferred, without blocking the Review-led TASK-006D implementation:

- public Reader exposure mutation, which must be approved before TASK-008 records encounters;
- assessment reliability/mapping policy owned by later TASK-016 integration;
- empirical recalibration, diversity/recency confidence, ML/IRT, speech/pronunciation, and additional
  language behavior.
