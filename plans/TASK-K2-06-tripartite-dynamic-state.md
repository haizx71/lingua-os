# TASK-K2-06 — Tripartite Competence and Dynamic State Reconciliation

Status: SOURCE PROMOTED: PASS / HOSTED ACCEPTANCE: PASS  
Owner: CODEX single-writer lane  
Predecessor: K2-05 STAGING: PASS  
Migrations: `0018_profile_replay_auth_erasure` and `0019_concept_save_intent_auth_erasure` (cleanup-only; no competence-state change)

## Objective

Complete the Knowledge V2 recognition/listening/production Beta behavior and make the accepted
K2-05 temporal status projection authoritative at Brain and Review read boundaries, without
rewriting the replayable `competence-beta-v1` projection or adding a ninth public status.

## Authority reconciliation

- `learning_events` remains the append-only replay authority.
- `user_concept_states.status` remains the deterministic stored competence/evidence status owned by
  TASK-006D; FSRS state is not added to the projector or replay inputs.
- `v_learner_concept_retrievability.effective_status` is a read-time overlay only. It may downgrade
  stored `active`/`mastered` to accepted `weak`/`forgotten` values and never writes the stored row.
- Brain and Review already expose the eight-value status enum. Returning the effective value is a
  behavior reconciliation, not a public schema change.
- Today remediation policy remains K2-08 scope; K2-06 does not alter Today packing.

## Revised persistence checkpoint — 2026-09-26

Hosted acceptance exposed a cleanup invariant that cannot be met under migration 0007:
`profile_mutation_results` blocks Auth deletion through both its unconditional DELETE trigger and
its composite `ON DELETE RESTRICT` foreign key. This prevented deleting the authorized disposable
K2-06 actor even though the behavioral assertions passed. The independent PostgreSQL/security
review approved a narrow migration design before DDL: UPDATE and active-identity DELETE remain
append-only; DELETE is permitted only during a nested FK cascade when the matching
`auth.users` row is absent. The FK becomes `ON DELETE CASCADE`. No browser ACL, API, competence
projection, evidence, or learner migration changes. The hosted Auth principal's necessary grants
were verified read-only.

The hosted acceptance gate is now complete. Migration 0019 allows deletion from `concept_save_intents`
only during a nested Auth cascade after the matching `auth.users` identity is absent; active-identity
DELETE and UPDATE remain immutable. It changes no table, constraint, policy, or competence state.
PostgreSQL tests cover active-identity rejection, the exact cascade and trigger context, actor
isolation, rollback/reapply, and the hosted disposable-actor cleanup.

## Expected changes

- Add internal Beta posterior variance to the pure dimension projection for explicit uncertainty
  verification.
- Join the private retrievability projection in Brain summary/list/detail/recent reads and Review
  queue reads, actor/profile/concept scoped.
- Use effective status for filtering and response projection while keeping all competence scores,
  confidence, evidence history, FSRS scheduling fields, and persistence unchanged.
- Add pure and PostgreSQL acceptance tests. No contract, frontend, importer, or competence-state schema change; the cleanup-only migrations `0018_profile_replay_auth_erasure` and `0019_concept_save_intent_auth_erasure` are the explicit exceptions described above.

## Acceptance checks

- Scores remain in `[0, 1]`, repeated consistent evidence converges toward its outcome, and Beta
  posterior variance decreases monotonically for the frozen `Beta(2,2)` lineage.
- Exercise modes update exactly one of recognition/listening/production; incremental state equals
  full replay and existing idempotency/concurrency/actor-isolation tests remain green.
- Brain summary, list filtering, detail, and recent projections use temporal effective status.
- Review queue uses temporal effective status while retaining one FSRS lineage and zero-write reads.
- A decay downgrade leaves stored status, state version, evidence mass, and learning-event history
  unchanged.
- No OpenAPI/generated/frontend diff or competence-feature schema migration; cleanup-only migration 0018 is the explicit exception needed to delete the disposable staging actor.

## Verification gates

1. Focused pure competence tests.
2. Focused Brain and Review PostgreSQL tests including actor isolation and zero-write assertions.
3. Complete backend PostgreSQL suite, scoped Ruff/format, strict mypy, contract freshness.
4. Independent read-only spec/code review with no unresolved blocker/high/medium finding.
5. Source PR CI green before merge.
6. Disposable hosted actor proof: one-dimension update, exact replay, dynamic decay without stored
   rewrite, isolation, unchanged non-fixture learner snapshot, and complete cleanup.

## Current hosted gate status — 2026-09-27

Source PR #15 is merged. Cleanup PR #17 is merged to master at
`aa4c581cbd035b3ea447800a92a35068fbc2b0ca`. PR #18, containing migration 0019 and its tests,
merged at `9c39417f29309d5dc2714082d7a28375712a79a6`; GitHub Actions run #54 passed
`knowledge-audit`, `grammar-postgres-integration`, and
`retrievability-postgres-integration`, and the Vercel check succeeded.

Staging project `lingua-os-staging` is `ACTIVE_HEALTHY`. Migration
`0018_profile_replay_auth_erasure` is applied at version `20260927021246`; migration
`0019_concept_save_intent_auth_erasure` is applied at version `20260927034218`. Migration 0019's
trigger function was verified as `SECURITY INVOKER` with a fixed `search_path=pg_catalog`.
No verified backup or offsite export was available at apply time; the user explicitly directed the
retry. Both migrations changed schema only and did not delete or alter learner rows. No Render
deployment was changed.

The pre-delete aggregate found two Auth users. The later-created disposable K2-06 actor was
authorized for deletion. Its aggregate ownership was checked across 27 tracked tables; after
deletion, counts and row hashes across all 27 tables exactly matched the pre-delete snapshot for the
remaining learner. No actor-owned residue remained and Auth contained one identity. No Auth UUID or
email is recorded here.

Using the authenticated staging UI, Brain showed one effective `weak` concept in the
“Cần củng cố” filter while the stored row remained `active`. Opening Brain detail and reading
Review left `state_version`, evidence masses/counts, learning-event history, actor row counts, and
the other learner's aggregate row hashes unchanged. The stored status and `effective_status`
remained `active` and `weak` respectively through those read-only checks.

One `Good` Review answer used `self_recall` and changed only production competence:
`production_evidence_count` advanced from 4 to 5; recognition and listening evidence counts stayed
at 0. A second disposable-fixture review was queued by moving only that actor's FSRS timestamps into
the past. Its answer committed once; navigating away preserved the app's pending retry receipt.
The visible “Thử lại” recovery action replayed that same operation. Before and after replay,
`review_events`, `learning_events`, `state_version`, and production evidence count were unchanged
at 6, 7, 8, and 6 respectively. The other learner's aggregate counts and row hashes remained
unchanged after both answers and replay.

The first Auth deletion attempt after 0018 rolled back at the pre-existing `concept_save_intents`
immutability trigger; no Auth or learner rows were deleted. After 0019 was applied, the same
authorized disposable identity was deleted successfully. The final aggregate verification confirmed
complete fixture cleanup and unchanged retained-learner counts and hashes. Hosted acceptance is
**PASS**.

## Explicit non-scope

- No status persistence rewrite from time decay.
- No changes to FSRS scheduling, weights, desired retention, or primary-lineage identity.
- No prompt-modality selection (K2-07) or Today remediation packing (K2-08).
- No new API field, enum, table, view, index, RLS policy, or catalog mutation.
