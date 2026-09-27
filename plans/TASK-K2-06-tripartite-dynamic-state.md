# TASK-K2-06 — Tripartite Competence and Dynamic State Reconciliation

Status: SOURCE PROMOTED: PASS / HOSTED ACCEPTANCE PENDING  
Owner: CODEX single-writer lane  
Predecessor: K2-05 STAGING: PASS  
Migration: `0018_profile_replay_auth_erasure` (cleanup-only exception; no competence-state change)

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

The hosted gate remains pending until PostgreSQL tests prove active-identity rejection, the exact
Auth-chain cascade and trigger context, actor isolation, concurrent replay/deletion behavior,
rollback/reapply, and a real disposable Auth deletion in staging.

## Expected changes

- Add internal Beta posterior variance to the pure dimension projection for explicit uncertainty
  verification.
- Join the private retrievability projection in Brain summary/list/detail/recent reads and Review
  queue reads, actor/profile/concept scoped.
- Use effective status for filtering and response projection while keeping all competence scores,
  confidence, evidence history, FSRS scheduling fields, and persistence unchanged.
- Add pure and PostgreSQL acceptance tests. No contract, frontend, importer, or competence-state schema change; the cleanup-only migration `0018_profile_replay_auth_erasure` is the explicit exception described above.

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

Source PR #15 merged at `f0dd8bd67d5ef9aa2a75ef51d1226b8e69cf3ef0`. GitHub Actions run
`35874384258` passed all three jobs: `knowledge-audit`,
`retrievability-postgres-integration`, and `grammar-postgres-integration`. The latest observed
master is `d0cb203a82ba09fa50550c0a805a0a26caf29490`.

Hosted Supabase staging was last confirmed `ACTIVE_HEALTHY` on migration `0017` (version
`20260923081253`). Migration 0018 is in PR #17 source and has not been applied to staging. The
latest Render deployment metadata was not re-verified during this recovery, so this note does not
assert a current Render SHA or health result.

A read-only owner-count snapshot on 2026-09-27 found two Auth users. The authorized disposable
actor (the later-created identity) owns one row each in `public.users`, `learner_profiles`,
`user_languages`, `user_concept_states`, `fsrs_states`, `review_items`,
`user_language_projection_heads`, `user_saved_concepts`, `concept_save_intents`, and
`profile_mutation_results`; three `user_skill_states`, five `learning_events`, four
`review_events`, and one `today_plans`. It has no assessment, exposure, Reader, or Today activity
rows. Keep this actor until migration 0018 is applied and the final acceptance and cleanup complete.
No Auth identifiers or email values are recorded here.

The PR #17 hosted-attempt record says the behavioral assertions passed before actor deletion failed
under migration 0007's unconditional replay DELETE trigger and `ON DELETE RESTRICT` foreign key.
The durable record still lacks the full before/after snapshot, exact replay, temporal effective-status
no-write, and post-migration cleanup proof. Keep K2-06 hosted acceptance pending until those checks
are revalidated and the separate learner snapshot is unchanged after the disposable actor and its
fixtures are deleted.

## Explicit non-scope

- No status persistence rewrite from time decay.
- No changes to FSRS scheduling, weights, desired retention, or primary-lineage identity.
- No prompt-modality selection (K2-07) or Today remediation packing (K2-08).
- No new API field, enum, table, view, index, RLS policy, or catalog mutation.
