# TASK-K2-06 — Tripartite Competence and Dynamic State Reconciliation

Status: LOCAL REVIEWED: PASS / SOURCE CI PENDING  
Owner: CODEX single-writer lane  
Predecessor: K2-05 STAGING: PASS  
Migration: none

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

## Expected changes

- Add internal Beta posterior variance to the pure dimension projection for explicit uncertainty
  verification.
- Join the private retrievability projection in Brain summary/list/detail/recent reads and Review
  queue reads, actor/profile/concept scoped.
- Use effective status for filtering and response projection while keeping all competence scores,
  confidence, evidence history, FSRS scheduling fields, and persistence unchanged.
- Add pure and PostgreSQL acceptance tests. No contract, frontend, importer, or migration change.

## Acceptance checks

- Scores remain in `[0, 1]`, repeated consistent evidence converges toward its outcome, and Beta
  posterior variance decreases monotonically for the frozen `Beta(2,2)` lineage.
- Exercise modes update exactly one of recognition/listening/production; incremental state equals
  full replay and existing idempotency/concurrency/actor-isolation tests remain green.
- Brain summary, list filtering, detail, and recent projections use temporal effective status.
- Review queue uses temporal effective status while retaining one FSRS lineage and zero-write reads.
- A decay downgrade leaves stored status, state version, evidence mass, and learning-event history
  unchanged.
- No OpenAPI/generated/frontend diff and no schema migration.

## Verification gates

1. Focused pure competence tests.
2. Focused Brain and Review PostgreSQL tests including actor isolation and zero-write assertions.
3. Complete backend PostgreSQL suite, scoped Ruff/format, strict mypy, contract freshness.
4. Independent read-only spec/code review with no unresolved blocker/high/medium finding.
5. Source PR CI green before merge.
6. Disposable hosted actor proof: one-dimension update, exact replay, dynamic decay without stored
   rewrite, isolation, unchanged non-fixture learner snapshot, and complete cleanup.

## Explicit non-scope

- No status persistence rewrite from time decay.
- No changes to FSRS scheduling, weights, desired retention, or primary-lineage identity.
- No prompt-modality selection (K2-07) or Today remediation packing (K2-08).
- No new API field, enum, table, view, index, RLS policy, or catalog mutation.
