# TASK-010 — Today Engine heuristic v1 review

Verdict: **APPROVED — no Critical or Required finding remains open**

## Scope and specification

- Implements only TASK-010 and `today-heuristic-v1`.
- Matches neutral goals, 8-minute reserve, 4-unseen new-content cap, 48-hour recent window, and no
  standalone `learn`.
- Keeps TASK-007/TASK-009/TASK-011 and frontend behavior frozen.
- Makes no OpenAPI or generated TypeScript change.

## Correctness

- Six calibration cases are executable golden tests.
- Review preserves `(dueAt, reviewItemId)` and persists selected identities.
- Daily total cannot exceed the profile budget; scarcity safely underfills.
- Same-day identity, timezone changes, retrieval-only dates, invalidation, partial proof, exact
  replay, and concurrent generation are covered.
- Completion requires Review/Reader proof; Today emits no evidence and does not mutate Memory,
  competence, Reader progress, or Library state.

## Architecture and readability

- Pure policy, application orchestration, PostgreSQL adapter, DTOs, and routes are separate.
- Content Engine's canonical read model is reused in the generation transaction.
- Constants are centralized/versioned; private diagnostics do not leak.
- The 700-line store remains one focused persistence adapter below the project review threshold;
  candidate, generation, reconciliation, and replay sections remain explicit.

## Schema and migration

- Sequence advances to paired migration `0006`.
- Owned profile/day uniqueness, target shape, completion all-or-none state, composite ownership FKs,
  RLS, and deferred Review cardinality are database-enforced.
- Rollback refuses learner activity. Empty apply, no-op reapply, latest down/up, checksum rejection,
  and protected rollback pass on PostgreSQL 17.11.
- New indexes serve only concrete Review/read/listen proof paths.

## Security and boundaries

- Authentication uses the established actor boundary; every query scopes actor/profile.
- SQL parameters are bound; no client ownership, raw score, diagnostic, or database message leaks.
- Invalid IANA timezone and unpublished content fail closed.
- No dependency, provider, Neo4j, AI, speech scoring, CJK, or frontend change is added.

## Performance and concurrency

- Review and content pools are bounded; content enrichment is one batched query.
- Ordered Review targets use bounded cursor batching; no per-item candidate read exists.
- Repeatable read plus unique day identity selects one winner; no Python lock is used.

## Findings resolved

1. **Required:** pending completion on an expired plan was possible. It now rejects non-active
   plans while preserving exact replay for completed activities.
2. **Performance:** Review target writes now use cursor batching instead of connection calls per ID.
3. **Correctness:** returning to a stored date after timezone changes now expires the other active
   day and reactivates the stable persisted plan.

## Verification evidence

- Ruff format/lint and strict mypy: clean.
- Backend final: 225/225 passed (90 non-database + 135 real PostgreSQL).
- Migration empty/up/reapply/down/checksum/protected rollback and real concurrency passed on
  PostgreSQL 17.11.
- OpenAPI/runtime: 18 passed; generated TypeScript fresh.
- Redocly 2.13.0: valid with one unchanged TASK-008 Reader discriminator warning.
- Frozen frontend: typecheck/lint clean; 307/307 tests across 27 files; Storybook and Next build pass.
