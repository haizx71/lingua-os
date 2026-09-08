# FRLL F1 — Acceptance hardening

Status: READY_FOR_INDEPENDENT_REVIEW. Starting HEAD: `1878406`.

## Scope

Implement R2/R3/R4/R5 in the acceptance harness only. Preserve accepted
B/C/D/E flows. Do not begin R1, change product behavior, or mark FRLL accepted.
Protected: contracts, services, database migrations, apps/web/src and
apps/web/tsconfig.tsbuildinfo.

## Sequence

1. Reproduce Auth cleanup fail-open; require canonical Auth not-found and
   reject ambiguous/error responses without exposing their contents.
2. Extend PostgreSQL observations and cleanup verification using actual
   persisted competence/projection fields, without calculating competence.
3. Validate raw B/C/D/E responses against frozen OpenAPI before adaptation;
   reconcile fixtures and use generated DTO types.
4. Compare complete replay responses, persisted snapshots and unchanged
   digests; reject failed reconciliation and noncanonical conflict errors.
5. Compare all Brain-exposed competence fields to fresh PostgreSQL authority.
6. Run the eight adversarial attacks, acceptance support/full tests, relevant
   backend/probe tests, Ruff, mypy, contract freshness, typecheck and lint.
7. Review specification/boundaries/code, record actual evidence and create
   bounded commits only after the applicable checks pass.

## Expected files

`tests/acceptance/support/`: Auth helper/tests, PostgreSQL probe/client/tests,
Phase B/C/D/E runners/tests and shared contract validator/fixtures.
Test-tool dependencies if required; this plan and final tracking/evidence.
No contract or migration changes.

## Acceptance

All eight supplied false-positive attacks must fail closed. Replay/conflict
must not mutate persisted learner state. Counts/IDs/versions are exact;
only persisted numeric(10,8) projection values use justified tolerance.
External integration results must distinguish executed checks from missing
environment prerequisites; mocked unit tests are not live proof.

Remaining after successful F1: R1 — real browser/reload/lost-response/Actor-B/isolation proof.

## Verification

All seven implementation steps completed. Evidence, exact file inventory,
adversarial matrix and limitations: `docs/FRLL_F1_HARDENING_REVIEW.md`.
115 support tests pass; full Vitest: 581 pass / 4 environment-conditional skips.
Relevant real-PostgreSQL/backend selection: 100 pass. No product-area changes.
This checkpoint is not independent acceptance of F1 or completion of FRLL.
