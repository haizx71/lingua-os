# Today Engine heuristic v1 — implementation

Status: **IMPLEMENTED**  
Task: `TASK-010`  
Policy: `today-heuristic-v1`

## Architecture

```text
Review / Competence / Content / Reader / Library authorities
                         ↓
bounded adapters in one repeatable-read snapshot
                         ↓
pure deterministic Today policy
                         ↓
daily persistence and completion reconciliation
                         ↓
frozen OpenAPI transport adapter
```

The policy has no FastAPI, PostgreSQL, wall-clock, FSRS, competence-formula, placement, or provider
dependency. `TodayApplication` captures one UTC `asOf`; the repository reads all candidates and
persists the winner inside one repeatable-read transaction.

## Candidate sources and bounds

- Review: active owned rows due at `asOf`, ordered only by `(due_at, review_item_id)`, limited to
  `min(dailyMinutes + 1, 181)`.
- Competence: existing `user_concept_states` status and dimension projections only. Raw masses,
  thresholds, parameters, and event replay are not read.
- Content: the canonical Content Engine read model supplies the top 20 publication-gated,
  level-fit candidates. Today batch-enriches those IDs with progress, saved time, audio,
  unseen count, weak overlap, and 48-hour recent exposure.
- Reader/Library: `user_content_progress`, `user_saved_content`, and accepted Reader exposure
  identities remain authoritative; Today stores references and bounded snapshots only.

Goal relevance is neutral. Starting Level is not calculated; Content Engine current-level or
easiest-first ordering remains the fallback.

## Frozen allocation

One immutable `TodayPolicy` owns all constants: 1 minute per Review target; Reader blocks clamped
to 5–10 minutes; listening blocks of 5 minutes; an 8-minute content anti-starvation reserve for
budgets of at least 15 minutes; at most 2 reads, 1 listen, 1 newly recommended content item, and 3
content activities total; a 4-unseen cap for newly recommended content; and a 48-hour recent window
restricted to novel selection. Runtime emits exactly `review`, `read`, and `listen`.

Review is the first block and is never re-ranked. A large backlog uses only the count fitting the
non-reserved budget. If no content qualifies, Review may consume the reserve. The allocator may
underfill and never pads or exceeds `dailyMinutes`.

Content precedence is unfinished Reader continuity, saved not-started, forgotten/weak
reinforcement, recent repetition, then canonical recommended-new order. One content identity cannot
appear in both read and listen. Weakness already represented by due Review is not duplicated.

## Persisted daily model

Migration `0006_today_engine_heuristic_v1` extends the existing Today tables:

- `today_plans`: one all-lifecycle row per actor × language profile × local date, IANA timezone,
  UTC `as_of`, budget, unused minutes, policy version, and private diagnostics;
- `today_plan_activities`: ordered references, target/completed counts, stable public text
  snapshots, private selection diagnostics, and completion fingerprint/result snapshot;
- `today_activity_review_items`: the exact ordered Review queue slice for an aggregate block.

The Review mapping is constrained to the same actor/language as the activity and Review target. A
deferred constraint verifies its cardinality equals `target_count`. RLS exposes only owned rows.
Presentation text is explicitly a replay snapshot; diagnostics and completion metadata are not
FSRS, competence, content, Reader, or Library truth.

## Local date and reconciliation

`learner_profiles.time_zone` is validated with IANA `zoneinfo`; invalid values fail closed and the
server timezone is never used. Current-day requests reuse persisted IDs, ordering, estimates, and
reasons. Past/future dates are retrieval-only. Timezone changes expire the other active local-day
plan; returning to an already persisted date reactivates its stable row instead of duplicating it.

GET reconciliation updates only derived `completed_count` from Review/Reader facts. It never
changes target order or creates evidence. Content that no longer passes publication returns safe
`SERVICE_UNAVAILABLE` without exposing the target.

## Completion and idempotency

Completion requires: every snapshotted Review item to have a post-plan Review event; read to have
a qualifying read exposure or authoritative content completion; and listen to have a qualifying
listen exposure. Pending activities on expired plans cannot complete.

The command emits no learning event and mutates no FSRS, competence, Reader progress, or Library
state. Same UUID key plus canonical fingerprint replays the exact stored domain result; changed
fingerprint returns `IDEMPOTENCY_KEY_REUSED`. Row locks and unique constraints are authoritative.

## Concurrency and indexes

The all-lifecycle `(user_id, user_language_id, plan_date)` uniqueness constraint selects one daily
winner. A concurrent loser rolls back and reloads the winner in a new snapshot; there is no Python
lock. Migration `0006` adds only concrete proof indexes:

- `ix_today_activity_review_items_proof` for allocated Review identities;
- `ix_review_events_today_proof` for post-plan Review proof;
- `ix_exposure_events_today_proof` for post-plan read/listen proof.

Existing Content, progress, competence, Review due, and daily-plan indexes serve generation. No
full learner-history or catalog scan is used.

## Golden calibration outputs

At 25 minutes and `2026-09-01T01:00:00Z`:

1. New learner: `[read A0 10m]`, 15 minutes unused.
2. Five due: `[review ×5 5m, continue read 10m, saved read 8m]`, 2 unused.
3. Fifty overdue: `[review ×17 17m, continue read 8m]`, 0 unused.
4. Weak + unfinished: `[read 9m, listen 5m]`, 11 unused.
5. No due + suitable new: `[saved read 7m, new read 10m]`, 8 unused.
6. Everything complete: empty persisted `completed` plan, 25 unused.

These are executable golden tests. Semantic constant changes require a new policy version.

