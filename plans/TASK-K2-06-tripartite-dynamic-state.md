# TASK-K2-06 — Tripartite Competence and Dynamic State Reconciliation

Status: SOURCE PROMOTED: PASS / STAGING ACCEPTANCE: PASS (2026-09-27)
Owner: CODEX single-writer lane  
Predecessor: K2-05 STAGING: PASS  
Migrations: `0018_profile_replay_auth_erasure` and `0019_concept_save_intent_auth_erasure` (applied in staging; cleanup-only; no competence-state change)

## Final hosted acceptance — 2026-09-27

**K2-06 STAGING: PASS.** The later disposable-actor run supersedes the pending
checkpoint below. GitHub/local `master`, Render staging, and the verified Vercel
Production deployment served source `9c39417`; Supabase staging migration head was
`20260927034218` (`0019`). The owner first signed out the real learner and registered
a new disposable actor. The browser JWT subject and authenticated `/api/v1/me`
identified that new actor, not the existing learner; `/api/health` returned 200.

The actor saved one existing published fixture and received one `self_recall` Review
answer. The answer changed production evidence once, leaving recognition and
listening evidence at zero. Replaying the same idempotency key/body returned the
same parsed JSON `data` with no second state, FSRS, event, or evidence change.
Brain and Review reads did not write learner state. For the temporal downgrade
check, a **synthetic disposable-actor-only diagnostic fixture** set a stored
`active` state with an old FSRS review timestamp; Brain and Review returned
effective `forgotten` while the stored status, evidence, version, and event
history stayed unchanged. This verifies the deployed read-time overlay, not
natural progression to `active` through the current public API.

After the actor signed out, narrowly guarded Auth deletion removed the actor.
One orphan Auth signup flow row was removed with a separate guarded deletion.
Final checks found zero disposable rows across 13 Auth ownership tables and
27 public learner tables. All 27 retained learner-table count/hash snapshots
matched the pre-run 55-row reference. No real-learner mutation, Vercel Share
link, or protection-setting change was made. Independent read-only final review
found no K2-06 blocker; it did not independently query staging. The Brain
“Cần củng cố” chip selects `weak`, while this fixture was `forgotten`; the
default “Tất cả” view still includes forgotten items. Track this as a
low-severity frontend discoverability follow-up, outside K2-06 acceptance.

This closes the K2-06 dependency gate for K2-07 promotion. Historical pending
notes below record earlier attempts and should not be read as the current gate.

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

The post-0018 deletion attempt exposed a second existing blocker: migration 0009's `concept_save_intents` trigger rejects DELETE even inside the Auth cascade. Proposed migration 0019 allows DELETE only when the trigger is nested and the matching `auth.users` row is already absent; UPDATE and deletion while the identity exists remain immutable. It changes no table, constraint, policy, or competence state.

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
`aa4c581cbd035b3ea447800a92a35068fbc2b0ca`; GitHub Actions run #48 passed
`knowledge-audit`, `grammar-postgres-integration`, and
`retrievability-postgres-integration`. The focused code and migration review found no open blocker
before the staging retry.

Staging project `lingua-os-staging` is `ACTIVE_HEALTHY`. Migration
`0018_profile_replay_auth_erasure` is applied at version `20260927021246`. No verified backup or
offsite export was available through the connected staging tools at apply time; the user explicitly
directed the retry. The migration changed schema only. It did not delete or alter learner rows.
No Render deployment was changed.

A read-only owner-count snapshot captured at **2026-09-27 01:20:04.452038 UTC** found two Auth users.
The active user authorized the later-created identity as the disposable K2-06 actor. SQL used that
identity only as an aggregate filter; no Auth UUID or email is recorded here. Before hosted
acceptance, the disposable actor owned one row each in `public.users`, `learner_profiles`,
`user_languages`, `user_concept_states`, `fsrs_states`, `review_items`,
`user_language_projection_heads`, `user_saved_concepts`, `concept_save_intents`, and
`profile_mutation_results`; three `user_skill_states`, five `learning_events`, four
`review_events`, and one `today_plans`. It had no assessment, exposure, Reader, or Today activity
rows.

Using the authenticated staging UI, Brain showed one effective `weak` concept in the
“Cần củng cố” filter while the stored row remained `active`. Opening Brain detail and reading
Review left `state_version`, evidence masses/counts, learning-event history, actor row counts, and
the other learner's aggregate row hashes unchanged. The stored status and `effective_status`
remained `active` and `weak` respectively through those read-only checks.

One `Good` Review answer used `self_recall` and changed only production competence:
`production_evidence_count` advanced from 4 to 5; recognition and listening evidence counts stayed
at 0. A second disposable-fixture review was queued by moving only that actor's FSRS timestamps into
the past. Its answer committed once; navigating away preserved the app's pending retry receipt.
The visible “Thử lại” recovery action replayed that same operation. Before and after the replay,
`review_events`, `learning_events`, `state_version`, and production evidence count were unchanged
at 6, 7, 8, and 6 respectively. The other learner's aggregate counts and row hashes remained
unchanged after both answers and the replay.

Deleting the disposable Auth identity after 0018 was attempted once. PostgreSQL rolled the
transaction back at the unconditional `concept_save_intents` immutability trigger; no Auth or
learner rows were deleted. Migration 0019 and focused rollback/cascade tests are proposed on branch
`fix/k2-06-save-intent-auth-erasure`. Keep hosted acceptance pending until CI and independent review
pass, 0019 is applied, Auth erasure removes every disposable-owned row, and a final aggregate check
confirms the other learner is unchanged.
## Explicit non-scope

- No status persistence rewrite from time decay.
- No changes to FSRS scheduling, weights, desired retention, or primary-lineage identity.
- No prompt-modality selection (K2-07) or Today remediation packing (K2-08).
- No new API field, enum, table, view, index, RLS policy, or catalog mutation.
