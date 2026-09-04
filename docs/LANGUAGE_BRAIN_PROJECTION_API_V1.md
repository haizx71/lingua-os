# Language Brain Projection API v1

Status: **CONTRACT FROZEN / READY FOR RUNTIME IMPLEMENTATION**  
Task: `TASK-012`  
Scope: approved domain/read-model design and executable public-contract freeze; runtime not started

## 1. Audit result and dependency state

TASK-012 is dependency-unblocked in repository state:

| Dependency | Repository evidence | Result |
| --- | --- | --- |
| TASK-003 | schema v1 and migration `0001` are accepted | DONE |
| TASK-006 | FSRS-6 Memory Engine and migration `0002` are accepted | DONE |
| TASK-006D | `competence-beta-v1`, migration `0004`, and projections are accepted | DONE |
| TASK-008 | Reader/Content service and migration `0005` are accepted | DONE |

TASK-010 is not a declared TASK-012 dependency, but its accepted implementation was audited because
it consumes the same projections and proves their read-authority boundaries. It is DONE.

The task graph is correct. The public-contract decisions identified by the audit are accepted and
frozen in section 22. Runtime implementation remains a separately authorized phase. This contract
freeze creates no migration and changes no backend runtime or frontend application behavior.

## 2. Responsibility and non-responsibility

Language Brain is an authenticated, read-only composition surface. It answers:

- which concepts belong to the learner's current English learning scope;
- the authoritative ConceptStatus for each concept;
- recognition, listening, and production score/confidence/evidence-count projections;
- the language-profile aggregate for those three dimensions;
- independent Memory scheduling context when a primary memory lineage exists;
- bounded exposure/review history summaries;
- catalog identity and stored direct concept relations;
- a status-level, non-causal explanation suitable for presentation.

It does not:

- read `learning_events` to recompute request-time competence;
- evaluate Beta equations, mastery thresholds, status streaks, or policy parameters;
- calculate or mutate FSRS;
- create events, projections, Review items, Reader progress, Library state, or Today state;
- infer relation edges from co-occurrence, similarity, competence correlation, ML, or embeddings;
- expose private masses, lineage IDs, state versions, ingestion ordering, fingerprints, or
  idempotency records;
- become a second mastery, competence, memory, Dictionary, or content authority.

## 3. Authoritative source hierarchy

```text
source Review / Reader facts
            ↓
append-only learning_events
            ↓ TASK-006D projector (write transaction only)
user_concept_states
            ↓
Brain concept projection

all profile projectable evidence
            ↓ TASK-006D projector
user_skill_states
            ↓
Brain language-profile competence summary

concepts / lexemes / framework_mappings / concept_relations
            ↓
Brain catalog identity and stored structure

review_items / fsrs_states
            ↓
Brain MemorySnapshot and due count
```

`user_concept_states` is the sole learner × concept competence/status/mastery projection.
`user_skill_states` is a separate profile aggregation scope and must never supply per-concept
competence. Memory fields remain joined presentation context and do not transfer authority.

## 4. Existing OpenAPI audit

All three operations inherit the global Supabase bearer requirement. No request contains `userId`.

| Operation | Parameters and identity | Response | Bounds and errors |
| --- | --- | --- | --- |
| `GET /v1/brain/summary` (`getBrainSummary`) | optional `languageProfileId`; defaults to the owned active English profile | `BrainSummaryResponse` | bounded; 401, 404, 422, 500 |
| `GET /v1/brain/concepts` (`listBrainConcepts`) | optional owned `languageProfileId`, one `ConceptStatus`, `query`, opaque `cursor`, `limit` 1–100/default 20 | `BrainConceptListResponse` | cursor pagination; 401, 404, 422, 500 |
| `GET /v1/brain/concepts/{conceptId}` (`getBrainConcept`) | catalog UUID; active owned English profile is implicit | `BrainConceptResponse` | bounded detail; 401, 404, 422, 500 |

Current DTO semantics:

- ConceptStatus is exactly the accepted eight-value enum; `due` is not a status.
- `CompetenceSignals` always contains recognition/listening/production; every score has score,
  confidence, evidenceCount, and optional updatedAt.
- `BrainConceptSummary` composes `ConceptSummary`, competence, required nullable mastery, required
  aggregate concept confidence, optional MemorySnapshot, exposureCount, and optional lastSeenAt.
- `BrainConceptDetail` composes the already-contracted full `ConceptDetail`, duplicated top-level
  status/competence/mastery/aggregate-confidence/memory, and an evidence summary.
- relation edges exist only as the bounded `ConceptDetail.relations` array. There is no graph
  collection or recursive expansion endpoint.
- Brain summary requires status counts, due count, nullable memory health, profile competence, optional
  Starting Level Estimate, at most ten recent concepts, and calculatedAt.

The frozen contract carries dimension projections, nullable TASK-006D mastery, aggregate concept
confidence, exposure history, status, Memory context, language aggregates, and direct stored
relations. It represents the absence of an authoritative Memory Health projection as null. The
compatibility verdict is **A — CONTRACT FROZEN FOR IMPLEMENTATION**.

## 5. Learner Brain collection membership

The default collection is not the English catalog. It is the distinct union of actor/profile-owned
concept anchors:

1. a current-lineage `user_concept_states` row whose status/history indicates passive exposure,
   learning intent, or projectable evidence;
2. an owned `review_items` row, regardless of active/suspended/retired lifecycle, because it is a
   durable learner/concept memory anchor;
3. an owned `user_saved_concepts` row, because it is explicit learner scope membership.

Reader progress alone does not add every concept in an opened content item. Reader exposure already
creates the appropriate TASK-006D concept projection. Content co-occurrence, Today candidacy, and
catalog relations do not create learner membership.

Consequences:

- default list and status counts operate on this learner-scoped union only;
- catalog-only unseen concepts do not appear in the list;
- direct Dictionary search remains the catalog discovery surface;
- exact Brain detail may return one valid English catalog concept as a synthetic unseen projection,
  which permits a bounded relation drill-down without enumerating the catalog;
- direct relation targets are metadata only and do not join the learner collection automatically.

## 6. Zero-state and legacy behavior

No GET creates a learner row.

| Case | Brain behavior |
| --- | --- |
| New learner/profile | summary counts/due/recent are zero/empty; three profile dimensions are synthetic score `0.5`, confidence `0`, evidenceCount `0`; list is empty |
| Catalog concept with no learner anchor | excluded from list/counts; exact detail may return synthetic unseen after catalog/language visibility validation |
| Passive-only projection | status `discovered`; exposure fields populated; every dimension remains score `0.5`, confidence `0`, evidenceCount `0`; mastery is null if later exposed |
| Projectable evidence | read the current versioned `user_concept_states` fields exactly |
| Missing state but Review/saved anchor exists | include with synthetic unseen dimension projection; independent Memory/saved context may still exist |
| Pre-TASK-006D/no-lineage scalar row | never interpret legacy scalars as evidence; use synthetic zero unless a separate accepted anchor includes the concept; GET does not rewrite it |

Synthetic score `0.5` means the symmetric prior under zero evidence. It is not demonstrated 50%
ability. Confidence `0` and evidenceCount `0` are mandatory alongside it.

## 7. Concept-level field authority

| Public value | Authority | Rule |
| --- | --- | --- |
| id, canonical form, type | `concepts`, with lexeme display fallback where applicable | no learner inference |
| optional POS | selected `lexemes.part_of_speech` | absent/null for grammar or skill; no fake value |
| optional level | highest-confidence deterministic `framework_mappings` join | descriptive mapping, not certification |
| status | `user_concept_states.status` | no route-time status algorithm |
| recognition/listening/production | corresponding score/confidence/count/last-evidence columns | current-lineage rows only |
| mastery | `user_concept_states.mastery` | required wire field, nullable authoritative projection |
| aggregate concept confidence | `user_concept_states.confidence` | required bounded value, distinct from all dimension confidences |
| exposureCount/lastSeenAt | `user_concept_states` exposure projection | exposure never implies competence |
| memory/isDue/dueAt | `review_items` + `fsrs_states` | one optional primary lineage; no recomputation |
| reviewCount/lastReviewedAt | bounded aggregate over owned Review source rows / FSRS last review | detail only |
| relations | stored `concept_relations` plus target identity | catalog structure only |

The public API must never return positive/negative mass, recent outcome arrays, projection method or
parameter IDs, high-water status, `state_version`, projection head, ingestion sequence, canonical
event IDs, request fingerprints, or replay snapshots.

## 8. Dimension presentation

Each dimension is represented by:

- `score` in `[0,1]`;
- independent `confidence` in `[0,1]`;
- integer `evidenceCount >= 0`;
- optional UTC `updatedAt`, sourced from that dimension's last projectable evidence.

Zero evidence is `{score: 0.5, confidence: 0, evidenceCount: 0}`. UI must not relabel that as
“50% learned.” Low score with high confidence and prior score with zero confidence are materially
different states.

All three projections remain observable for all four concept types. Mastery applicability is a
separate policy:

- word/phrase: recognition 0.4, listening 0.3, production 0.3;
- grammar: recognition 0.5 and production 0.5; listening remains a visible projection but is not a
  required mastery dimension in v1;
- skill: explicit immutable `concept_competence_policies` weights are mandatory for mastery;
  without one, mastery is null and status cannot exceed learning.

The read API does not expose or recreate these weights. It reads their already-derived result.

## 9. Mastery null semantics

At the domain level, `mastery = null` means the aggregate is not eligible or not defined. It occurs
when at least one required dimension lacks the minimum evidence mass, or a skill concept has no
accepted explicit policy. It never means `0`, `0.5`, failure, or an unknown numerical placeholder.

TASK-004 intentionally removed provisional `masteryScore` to prevent one magic number from becoming
the learner truth. TASK-006D subsequently established a nullable, versioned mastery projection.
Exposing it now is safe only if it remains contextual beside three dimensions, their confidence,
ConceptStatus, Memory, and evidence—not as a replacement for them.

The executable contract exposes required nullable `mastery` and required aggregate `confidence` on
Brain concept summary/detail only. Neither field expands shared `ConceptSummary`, and mastery never
replaces recognition/listening/production or their independent confidence values.

## 10. ConceptStatus and safe explanation

Only these values are legal:

`unseen`, `discovered`, `learning`, `familiar`, `active`, `mastered`, `weak`, `forgotten`.

Brain reads the status. It does not inspect streak arrays or thresholds. `isDue` and `dueAt` remain
independent Memory facts and can disagree with the apparent strength status without inconsistency.

V1 explanation is a static, non-causal status glossary, for example “recent evidence indicates this
concept needs reinforcement” for weak/forgotten. It must not claim the precise hidden threshold or
event that caused the state. The current contract has no per-concept reason field; none is proposed
for v1. A causal explanation field would require a separate versioned public policy.

## 11. Concept relations and graph boundary

The relational catalog supports exactly:

`synonym`, `antonym`, `prerequisite`, `family`, `related`.

Every stored row is represented as directed `source_concept_id → target_concept_id`. The selected
detail concept is the implicit source and `ConceptRelation.conceptId` is the target. V1 does not
invent the reverse row, even for semantically symmetric labels. `prerequisite` is directional by
meaning. Database weight and source-record identity remain private because the contract does not
expose them.

Only relations whose relation record and both endpoint concepts pass approved, allowed,
attribution-representable catalog provenance may be returned. Ordering is `(relation_type,
target canonical key, target concept id)`, maximum 100.

The full Knowledge Map and graph payload were explicitly removed by TASK-004 and remain post-MVP.
TASK-012 provides no graph layout coordinates, inferred edges, graph scores, or recursive graph
endpoint. The only v1 neighborhood is selected detail + its direct stored outgoing relations
(depth 1, max 100). The frontend owns pan, zoom, and layout state.

## 12. Language-profile summary

`BrainSummary.competence` reads the three `user_skill_states` rows for the owned profile. It is not
an average of concept responses and is not reconstructed from events. Missing rows for a genuinely
new profile are represented synthetically as the zero-evidence triple without writes.

These values are profile-wide evidence aggregates under `competence-beta-v1`. They are not formal
CEFR levels. `startingLevelEstimate`, when absent because TASK-016 has not produced one, remains
null and is independent context.

## 13. Status distribution

`ConceptStatusCounts` is computed over the learner collection membership in section 5, after
applying current-lineage/synthetic zero semantics. `total` equals the sum of the eight buckets.
`unseen` means a learner-anchored Review/saved concept with no accepted current projection; it does
not mean “all English concepts not learned.”

The aggregate uses `user_concept_states`, `review_items`, and `user_saved_concepts`; it never scans
`learning_events` and never computes `catalog size - learner rows`.

## 14. Memory context

- `memory` is null/omitted when no primary Review lineage exists.
- When present, state/dueAt/lastReviewedAt come from the single `fsrs_states` row.
- `isDue` is `due_at <= request asOf` for an active Review item; it is false when memory is absent
  or the item is not active.
- `dueCount` counts owned active Review items due at the same request asOf.
- No Brain query calls py-fsrs or reads difficulty, stability, parameters, lapses, retrievability,
  or raw scheduling internals.

`memoryHealth` has no accepted formula or stored authority. Returning `0`, `1`, or a due-ratio for a
new learner would invent meaning. The frozen `BrainSummary` contract therefore requires the field
but allows null until a separate bounded Memory/Progress policy defines an authoritative value.

## 15. Reader, content, and Dictionary boundaries

Brain may return `exposureCount` and `lastSeenAt` from the existing projection. It does not count
content joins as evidence, query Reader per node, or turn exposure frequency into competence.

The current `BrainConceptDetail` explicitly nests the contracted `ConceptDetail`, including
definitions, examples, relations, attribution, and its learner overlay. TASK-012 must reuse the
same catalog read model rather than create a second lexical store. This is an existing contracted
exception to the preferred lightweight Brain identity. List/summary stay lightweight; clients use
`/v1/concepts/{id}` and dictionary search for catalog discovery.

Duplicated learner fields inside `ConceptDetail.learner` and at `BrainConceptDetail` top level must
be constructed from one in-memory read projection and tested for equality. They are not separately
queried or authored.

## 16. Filtering, search, and ordering

The existing contract supports only:

- one exact ConceptStatus filter;
- one normalized, case-insensitive canonical/lemma prefix query;
- opaque cursor and limit.

There is no concept-type, mastery-range, confidence-range, level, relation, due, or arbitrary sort
filter in v1. Adding one requires contract review.

Default list ordering is stable catalog keyset order:

```text
(concepts.canonical_key ASC, concepts.id ASC)
```

This avoids volatile floating-point or learner-state ordering. Summary `recentConcepts` is a
separate bounded projection ordered by `(user_concept_states.updated_at DESC, concept_id ASC)` and
contains at most ten current-lineage learner concepts.

## 17. Pagination

List uses the existing limit 1–100/default 20 and fetches `limit + 1`. Cursor content is
server-controlled, versioned, authenticated, and binds:

- actor/profile identity;
- normalized status/query filters;
- last canonical key and concept UUID.

Clients never parse it. There is no offset. Changing profile or filters invalidates the cursor.
`pageSize` is the returned count, and `nextCursor` is null exactly when `hasMore=false`.

## 18. Consistency and request asOf

Every operation captures one UTC database transaction timestamp as request `asOf` and executes in
one read-only `REPEATABLE READ` transaction. All competence, Memory, counts, detail, and relation
reads in that response observe one PostgreSQL snapshot.

If a Review commits before the Brain snapshot begins, the response includes its Memory and TASK-006D
projection. If it commits after the snapshot begins, the response excludes all of that transaction.
The atomic Review design prevents a mixed FSRS/competence state.

`BrainSummary.calculatedAt` is the request asOf. List/detail do not currently expose asOf, but
`isDue` within each operation uses its single captured instant. Cursor pages are stable by catalog
key; they are current per request rather than historical event-sourced snapshots.

## 19. Authorization and language isolation

- JWT subject supplies the actor; no client user identity is accepted.
- Explicit `languageProfileId` must be owned, active, target `en`, and use Vietnamese support for
  the MVP profile boundary.
- Omitted profile selects the actor's deterministic active English profile.
- Detail resolves the same active English profile and rejects non-English concepts.
- Learner overlays are always joined by actor + profile + language + concept.
- Catalog metadata is shared, but invisible/unapproved provenance and another learner's overlay are
  never returned.
- Existence-hiding 404 is used for detail/cross-owner resources. Summary and list return the same
  404 for an explicitly requested profile that is missing or not owned, rather than exposing
  ownership through 403/404 differences or overloading validation semantics.

## 20. Query and performance design

No query loads the whole catalog or scans `learning_events`.

Expected bounded plan:

- summary: one profile/skill query, one learner-scope status/due aggregate query, and one batched
  recent-concepts query (`<=10`);
- list: one learner-membership CTE with aggregate anchors, catalog/competence/Memory joins, stable
  keyset and `limit+1`; no per-row query;
- detail: one owned profile/catalog/projection/Memory query, plus bounded batched dictionary data,
  direct relations (`<=100`), and evidence aggregate queries;
- relation target metadata, framework mapping, lexeme, and Memory state are joined/batched.

Existing indexes support the proposed paths:

- `ix_user_concept_states_user_status` and unique `(user_id, concept_id)`;
- unique Review `(user_id, concept_id)` plus actor/due indexes;
- saved-concept primary key `(user_id, concept_id)`;
- `concept_relations` source primary key and target index;
- `ix_review_events_today_proof` for actor/review-item history;
- unique `user_skill_states(user_language_id, skill)`.

Verdict: **NO MIGRATION REQUIRED initially**. The list must be profiled with realistic learner
cardinality before adding an index. A read API must not create duplicate projection tables.
Target normal read p95 remains under 400 ms; page limit is at most 100 and direct relation limit is
100.

## 21. Cache and ETag

Recommendation for v1: no public/shared cache and no ETag.

Responses combine actor-private, frequently changing Memory and competence state. Send private
no-store cache headers through the existing auth boundary. Do not expose internal `state_version`.
An ETag could later be an opaque hash of safe projection/relation versions, but it adds no value
until conditional GET is contracted and benchmarked.

## 22. Frozen OpenAPI decisions

### 22.1 Public nullable mastery and aggregate confidence

The accepted executable amendment is:

- add `mastery: number | null` to `BrainConceptSummary` and `BrainConceptDetail`;
- add `confidence: number` to both as the aggregate concept confidence;
- document that mastery is contextual and never replaces the three competence dimensions;
- keep both fields private to Brain rather than expanding shared `ConceptSummary`.

### 22.2 Nullable memory health

No accepted formula or materialized projection currently defines Memory Health. The accepted
amendment:

- make `memoryHealth` required nullable in `BrainSummary`;
- define null as “insufficient/no authoritative memory-health projection”;
- leaves `ProgressOverview.memoryHealth` unchanged for later TASK-014 contract review.

No route should invent `1 - due/total`, return perfect health for an empty lineage, or calculate
FSRS retrievability merely to fill the field.

### 22.3 Contract clarifications

- add 404 to the Brain list response set for missing/non-owned explicit profile;
- document status-count scope, synthetic zero, list ordering, cursor filter binding, relation
  direction/bounds, and duplicated detail-overlay equality;
- keep relation type as the current string for compatibility but emit only the five database
  values; a future enum is additive hardening, not needed for runtime correctness.

These amendments are present in `contracts/openapi.yaml`, generated TypeScript is fresh, and the
contract-focused tests enforce the approved nullability, bounds, read-only, 404, enum, POS,
non-leakage, and cursor semantics.

## 23. Read-only and freshness guarantees

Every Brain route is side-effect free. GET must not insert/update/delete:

- `user_concept_states`, `user_skill_states`, or projection heads;
- `learning_events`, source Review events, or Reader exposure events;
- Review items or FSRS states;
- Reader progress, Library membership, Today plans, or activity completion.

TASK-006D updates projections synchronously in the source transaction, so “current” means the
latest committed projection visible at the request snapshot. There is no async queue and no known
rebuild lag. Full rebuild is an administrative correctness operation, not a request path.

## 24. Future implementation test matrix

| ID | Required test |
| --- | --- |
| A | new learner returns empty collection/counts and zero-evidence profile signals without writes |
| B | passive-only concept is discovered with unchanged 0.5/0 projections |
| C | learning status is read unchanged |
| D | familiar status is read unchanged |
| E | active status is read unchanged |
| F | mastered status is read unchanged |
| G | weak status is read unchanged and not inferred from due |
| H | forgotten status is read unchanged and not inferred from due |
| I | nullable mastery remains null and is never converted to a number, if amendment approved |
| J | every dimension preserves score, confidence, evidence count, and optional evidence time |
| K | lexical POS is returned and absent POS remains absent/null |
| L | grammar has no fake POS; listening remains visible but is not recomputed into mastery |
| M | skill concept uses its persisted custom-policy result; no policy inference from name/type |
| N | language summary reads `user_skill_states`, including synthetic new-profile zero |
| O | counts cover learner scope only; total equals all eight buckets |
| P | only stored provenance-safe relation rows are returned in deterministic order |
| Q | direct relation expansion is depth 1 and capped at 100; no recursive/catalog graph load |
| R | opaque keyset cursor binds actor/profile/filter and rejects tampering/filter reuse |
| S | stable catalog-key ordering and identity tie-breaks hold across pages |
| T | cross-actor profile/detail access is existence-hiding and leaks no learner overlay |
| U | English profile/concept language isolation is enforced |
| V | GET appends zero `learning_events` |
| W | GET creates/updates zero learner projection, Review, Reader, Library, or Today rows |
| X | Memory fields and due count match persisted one-lineage state at request asOf |
| Y | complete TASK-006D incremental/rebuild/status regression suite remains unchanged |
| Z | frontend remains frozen at 308 meaningful tests / 27 files and generated types change only after approved contract work |

Additional tests:

- current/no-lineage legacy rows never leak scalar competence;
- exact detail for catalog-only unseen concept is synthetic and read-only;
- profile aggregates are not derived from concept averages;
- status distribution never subtracts from catalog totals;
- duplicated detail learner projections are byte-equivalent after serialization;
- Review commit racing a Brain GET yields either complete before-state or complete after-state;
- query-count assertions reject N+1 list/detail implementations;
- `EXPLAIN`/fixture cardinality demonstrates bounded list, relation, recent, and evidence paths;
- absent memory-health authority follows the approved null/alternative decision;
- raw masses, versions, streak machinery, ingestion data, SQL errors, and other-owner IDs never
  appear in responses.

## 25. Worked semantic examples

The snippets below are **non-executable read-model examples** of the frozen `mastery`, aggregate
`confidence`, and nullable `memoryHealth` semantics now represented by OpenAPI.

### 25.1 Completely new learner

```json
{
  "statusCounts": {"total": 0, "unseen": 0, "discovered": 0, "learning": 0,
    "familiar": 0, "active": 0, "mastered": 0, "weak": 0, "forgotten": 0},
  "dueCount": 0,
  "memoryHealth": null,
  "competence": {
    "recognition": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "listening": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "production": {"score": 0.5, "confidence": 0, "evidenceCount": 0}
  },
  "recentConcepts": []
}
```

### 25.2 Passive-only discovered word

```json
{
  "concept": {"canonicalForm": "appointment", "partOfSpeech": "noun",
    "status": "discovered", "isDue": false},
  "competence": {
    "recognition": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "listening": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "production": {"score": 0.5, "confidence": 0, "evidenceCount": 0}
  },
  "mastery": null, "confidence": 0, "exposureCount": 3, "memory": null
}
```

### 25.3 Strong recognition, insufficient listening/production

```json
{
  "status": "learning", "isDue": true,
  "competence": {
    "recognition": {"score": 0.8, "confidence": 0.6, "evidenceCount": 6},
    "listening": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "production": {"score": 0.5, "confidence": 0, "evidenceCount": 0}
  },
  "mastery": null,
  "memory": {"state": "review", "dueAt": "2026-08-31T01:00:00Z", "isDue": true}
}
```

The status is not `due`; due is independent Memory context.

### 25.4 Mastered lexical concept

```json
{
  "concept": {"canonicalForm": "available", "partOfSpeech": "adjective",
    "status": "mastered", "isDue": false},
  "competence": {
    "recognition": {"score": 0.89, "confidence": 0.78, "evidenceCount": 14},
    "listening": {"score": 0.86, "confidence": 0.76, "evidenceCount": 13},
    "production": {"score": 0.85, "confidence": 0.75, "evidenceCount": 12}
  },
  "mastery": 0.869, "confidence": 0.765, "memory": null
}
```

### 25.5 Weak/forgotten concept independent of due

```json
{
  "concept": {"canonicalForm": "hesitate", "status": "forgotten", "isDue": false},
  "competence": {
    "recognition": {"score": 0.46, "confidence": 0.68, "evidenceCount": 9},
    "listening": {"score": 0.42, "confidence": 0.61, "evidenceCount": 7},
    "production": {"score": 0.39, "confidence": 0.58, "evidenceCount": 6}
  },
  "mastery": 0.427, "confidence": 0.63,
  "memory": {"state": "review", "dueAt": "2026-09-02T01:00:00Z", "isDue": false}
}
```

Brain reads `forgotten`; it does not derive it from these numbers.

### 25.6 Grammar concept

```json
{
  "concept": {"canonicalForm": "present-perfect", "status": "familiar", "isDue": false},
  "competence": {
    "recognition": {"score": 0.72, "confidence": 0.45, "evidenceCount": 4},
    "listening": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "production": {"score": 0.68, "confidence": 0.43, "evidenceCount": 4}
  },
  "mastery": 0.70, "confidence": 0.44
}
```

`partOfSpeech` is omitted. Listening is unknown, not fabricated and not required by the accepted
grammar mastery policy.

### 25.7 Skill concept with explicit custom policy

```json
{
  "concept": {"canonicalForm": "gist-listening", "status": "active", "isDue": false},
  "competence": {
    "recognition": {"score": 0.5, "confidence": 0, "evidenceCount": 0},
    "listening": {"score": 0.8, "confidence": 0.6, "evidenceCount": 6},
    "production": {"score": 0.5, "confidence": 0, "evidenceCount": 0}
  },
  "mastery": 0.8, "confidence": 0.6
}
```

The stored versioned policy assigns listening weight 1. Brain does not infer that from
`gist-listening` and does not expose a fake POS.

### 25.8 Bounded direct relation neighborhood

```json
{
  "concept": {"id": "11111111-1111-4111-8111-111111111111",
    "canonicalForm": "schedule", "status": "learning", "isDue": false},
  "relations": [
    {"conceptId": "22222222-2222-4222-8222-222222222222",
      "relationType": "family", "canonicalForm": "scheduled"},
    {"conceptId": "33333333-3333-4333-8333-333333333333",
      "relationType": "related", "canonicalForm": "appointment"}
  ]
}
```

This is depth 1 only. Relation targets do not become learner nodes and no layout coordinates are
domain data.

## 26. Runtime readiness and deferred decisions

No public-contract blocker remains before TASK-012 runtime implementation. Runtime itself still
requires explicit authorization and must conform to this frozen contract.

Not blocking and deliberately deferred:

- full graph/Knowledge Map payloads, reverse-edge inference, recursive traversal, or graph DB;
- concept-type/mastery/confidence range filters;
- causal status reason codes;
- public projection versions or ETags;
- request-time event replay, asynchronous projection queues, or duplicated read tables;
- Starting Level, Progress, frontend Brain integration, AI Tutor, speech/pronunciation, and CJK.

No schema migration is justified by the design or contract freeze. The durable public semantics
are recorded in ADR-018.
