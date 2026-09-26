# K2-06 Tripartite Competence and Dynamic State Review

Date: 2026-09-23  
Baseline: `5f1ed5b6a3ba355e219208d8ef68497272dfa90f`  
Verdict: **APPROVE — no BLOCKER, HIGH, MEDIUM, or LOW findings**

## Scope reviewed

- Internal Beta posterior variance and convergence test.
- Brain summary/list/filter/detail/recent effective-status projection.
- Review queue effective-status projection.
- Actor/profile/concept join isolation and one-row cardinality.
- Stored competence status, append-only replay authority, and public FSRS privacy boundary.
- Focused pure/PostgreSQL tests and the K2-06 bounded plan.

## Independent findings

No actionable finding. The Brain and Review joins retain actor/profile/concept scope and the
accepted one-row learner-concept cardinality. Temporal status remains a read-only overlay;
`user_concept_states.status`, evidence masses, state version, and `learning_events` replay authority
are not rewritten. Raw retrievability, stability, difficulty, and parameter values remain private.

## Verification evidence available at review

- Focused pure checks: 38 passed.
- Backend non-database regression: 215 passed.
- Scoped Ruff and formatting: passed.
- Strict mypy: passed; independent review also checked the broader typed surface.
- PostgreSQL tests: 54 collected in the review environment; execution is the mandatory GitHub CI
  source-promotion gate because the local lane has no Docker daemon.
- Hosted read-only cardinality check: joined learner rows equal distinct learner states (`1 = 1`),
  with no duplicate projection row.

Source promotion is complete: PR #15 merged after all three CI jobs passed. Hosted acceptance remains pending.


## Post-promotion status — 2026-09-27

- PR #15 merged at `f0dd8bd67d5ef9aa2a75ef51d1226b8e69cf3ef0`; CI run
  `35874384258` passed `knowledge-audit`, `retrievability-postgres-integration`, and
  `grammar-postgres-integration`.
- Latest observed master: `d0cb203a82ba09fa50550c0a805a0a26caf29490`.
- Render is live on that commit and `GET /health` returned HTTP 200.
- Supabase staging remains healthy at migration 0017. Aggregate read-only checks confirm one-row
  join cardinality and no browser SELECT grants; no decayed fixture exists.
- The disposable authenticated actor proof is still pending. The attempted browser sign-in was
  denied before authentication, and no hosted data was mutated. This review approves the source
  change only and does not imply `K2-06 STAGING: PASS`.
