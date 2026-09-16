# LINGUA OS — Progress Projection v1

Status: FROZEN FOR TASK-014 IMPLEMENTATION
Date: 2026-09-15

## Purpose

`GET /v1/progress/overview` is a read-only evidence projection. It must never create learner state, award XP, mutate Memory/Competence, or reinterpret the accepted FRLL rules.

## Scope

The existing OpenAPI contract is authoritative. `window=week` is the trailing 7 learner-local calendar dates ending today. `window=month` is the trailing 30 learner-local calendar dates ending today. Calendar boundaries use the persisted learner timezone; a learner without a valid product-ready profile has no Progress resource yet.

## Authoritative definitions

### Daily minutes

Actual study minutes are derived only from authoritative completed Today activities. For a local date, sum persisted `today_plan_activities.duration_seconds` for completed activities, then round the aggregate up to whole minutes. Planned/estimated minutes are never reported as actual time.

### Activities completed

Count persisted Today activities whose status is `completed` for the owned plan/date.

### Goal met

A local date is goal-met when actual completed-activity seconds are at least the persisted `today_plans.daily_minutes * 60` for that date. No plan or no completion means false.

### Successful learning day

A successful learning day is a Progress day with `goalMet=true`.

### Target learning days

Every learner-local calendar date from the later of the requested window start and the owned Language Profile creation date through the window end is a target day. LINGUA v0.1 has no separate weekday schedule preference.

### Concepts exposed

Daily `conceptsExposed` is the number of distinct catalog concepts represented by canonical `exposure_events` for the actor/profile on that local date. The window aggregate counts distinct concepts across the whole window, so repeated exposure does not inflate breadth.

### Concepts strengthened

A concept is strengthened on a local date when an owned `review_event` for its review item has `correct=true`. Daily counts are distinct concepts per date; the window aggregate is distinct concepts across the whole window.

### Retention

For each local date, `reviewedCount` is the number of owned review events and `successfulReviewRatio` is `correct=true / reviewedCount`. Dates without reviews return ratio `0` and count `0`; absence of evidence is not represented as success.

### Memory Health

Memory Health is a current snapshot, not a retention trend. Among active owned review items with FSRS state, it is the fraction whose `due_at` is later than the snapshot timestamp. If the learner has no active memory items, Memory Health is `0`; this means no established memory evidence, not failure.

### Competence

Recognition/listening/production are the current authoritative `user_skill_states` projection already used by Language Brain. Progress does not recompute competence.

### Starting Level

Use the latest completed owned Starting Level assessment result for the Language Profile. It is contextual evidence only and is not a certificate or current-level override.

## Consistency and privacy

- One PostgreSQL repeatable-read, read-only snapshot per response.
- Actor/profile ownership checked server-side.
- No direct browser Data API access.
- No raw event IDs, private diagnostics, recommendation scores or FSRS parameters in the response.
- No write is allowed from this endpoint.

## Non-goals

- streak gamification
- XP, leagues, coins or leaderboard metrics
- inferred minutes from planned duration
- changing Today/Review/Memory/Competence authorities
- certification claims
