# K2-05 Dynamic Retrievability — Independent Review

Date: 2026-09-23  
Scope: migration `0017`, private typed repository, tests, CI, and reconciled execution plan  
Verdict: **APPROVE FOR SOURCE PROMOTION**

## Findings

- BLOCKER: none
- HIGH: none
- MEDIUM: none
- LOW: none
- Unresolved contradictions or false acceptance claims: none

## Verified boundaries

- The SQL projection follows pinned py-fsrs 6.3.2 decay math and validates all 21 model weights
  against the pinned bounds before using `w20`.
- Arbitrary JSON numeric magnitudes are compared as PostgreSQL `numeric`; only a validated `w20`
  is cast to double precision. Invalid, missing, malformed, or unsupported lineage fails closed.
- New-card zero retrievability is available only with valid parameter lineage and the persisted new
  card shape.
- The view is private to `service_role`; browser roles have no view access and raw FSRS values remain
  outside the public API.
- The typed read is actor, language-profile, and concept scoped.
- Rollback restores the pre-migration schema ACL state, and complete learner-table snapshots prove
  migration, rollback/reapply, and projection reads do not mutate learner data.
- Threshold tests cover both sides of `0.50`, `0.70`, and `0.75`; the plan test proves existing
  indexes can bound actor/profile access without a speculative index.
- CI covers migration infrastructure, affected backend tests, dependency locks, scoped Ruff gates,
  strict mypy, and PostgreSQL 17.11 integration.

The PostgreSQL integration workflow remains the authoritative source-promotion merge gate.
