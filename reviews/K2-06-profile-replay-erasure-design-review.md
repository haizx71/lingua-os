# K2-06 Disposable Actor Cleanup Design Review

Date: 2026-09-26
Baseline: `002de28e465a3d2011a0924c4b879b7a660cd8c6`
Scope: minimal persistence exception required to complete disposable K2-06 Auth actor cleanup
Review mode: independent, read-only PostgreSQL/security review before DDL

## Decision

**APPROVE DESIGN — no source-level BLOCKER.**

The current migration-0007 append-only DELETE trigger and replay-result composite
`ON DELETE RESTRICT` foreign key jointly prevent authorized Auth identity deletion. That is
incompatible with the explicit K2-06 cleanup gate. The proposed migration changes only the replay
foreign key to `ON DELETE CASCADE` and permits the corresponding DELETE trigger to return OLD
only when both conditions hold:

1. `pg_trigger_depth() > 1`, identifying a nested foreign-key cascade; and
2. the matching `auth.users` identity is already absent.

UPDATE remains rejected unconditionally. Direct replay DELETE, deletion of a user-language row,
and deletion of `public.users` while Auth still exists continue to raise SQLSTATE 23514.
The trigger remains invoker-security with a pinned search path and schema-qualified Auth lookup.
No grants, RLS policies, API contracts, learner projections, events, or FSRS rows change.

## Independent review findings

No design blocker was found. The review confirmed that the observed staging Auth principal has
`USAGE` on `auth`, `SELECT` and `DELETE` on `auth.users`, while it has no public-schema usage
or DELETE privileges on application tables. The migration requires no privilege expansion.

**HIGH — verification required before hosted acceptance:** repository PostgreSQL tests must exercise
the exact `auth.users → public.users → user_languages → profile_mutation_results` cascade, observe
nested trigger depth and absent Auth identity inside the child DELETE trigger, prove active-identity
deletion paths fail without loss, and cover the concurrent replay/delete race. The actual staging
Auth deletion must then succeed using the disposable actor. This HIGH is a test gate, not approval
to bypass Auth or constraints.

Rollback restores the original RESTRICT foreign key and unconditional append-only trigger without
changing surviving rows. Data already erased with an Auth identity is not recoverable; rollback
does not reconstruct deleted actors or replay results.

## Changed-surface boundary

- Migration 0018 is limited to Auth erasure cleanup for the TASK-006E replay table.
- Existing profile snapshots remain immutable for every live Auth identity.
- Existing authenticated/browser grants and all learner-state behavior remain unchanged.
- Product-level account deletion/export and profile reset remain outside this migration.
