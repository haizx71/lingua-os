# FRLL final takeover — 2026-09-12

Status: ACCEPTED / FROZEN.
Start HEAD a4f3498 on master.
User accepts P1 and the existing Review queue/answer concurrency patch.
Preserve all existing work. No push; independent final acceptance remains required.

## Scope

Complete real PostgreSQL and canonical browser/proxy verification, strengthen
R1 evidence where it currently permits false positives, revalidate F1 R2-R5,
execute two fresh complete runs, then run regression and update tracking.
Expected edits: tests/acceptance/r1_browser_loop.spec.ts, narrow acceptance
helpers/tests, this plan, evidence and tracking docs. Preserve the accepted
Review source/test diff. No contract, schema, generated-type or domain changes.

## Observed preflight

- Inherited DATABASE_URL is INVALID_PLACEHOLDER. Explicit authorized runtime
  environment passes the existing read-only postgres_probe.py with 35s outer,
  10s connection and 15s SQL deadlines. Values are never persisted.
- Started new FastAPI :8000, Next :3000 and canonical proxy :3005; all health
  checks pass and unauthenticated /api/v1/me returns 401.
- Initial R1 run fails at the 60s overall test deadline after successful real
  auth/profile/save/Today requests. Classification: TEST_HARNESS time budget;
  external latency contributes. No application assertion has failed yet.

## Required harness corrections

1. Use a bounded realistic overall live-test budget and per-I/O deadlines.
2. Observe committed PostgreSQL state inside the interceptor BEFORE dropping
   response; validate raw response, exact receipt, exact replay and full digest.
3. Reuse F1 persisted competence/Memory comparison, validate Brain raw DTOs,
   compare full passive learning state (Today coordination persistence allowed).
4. Replace placeholder late-Actor-A check with a real held response delivered
   after a real B login through the existing auth/client lifecycle.
5. Fail closed on cleanup in fixtures/finally, verify all returned counts and
   explicit catalog anchor ID. No swallowed cleanup success; no auth trace leaks.
6. Add adversarial unit tests for new assertion seams before integrating them.
7. R1 live -> F1/support -> two fresh complete runs -> adversarial regression ->
   typecheck/lint/freshness/Storybook/build/backend where available -> reviews.

Do not label skipped/historical evidence PASS or self-declare FRLL ACCEPTED.

## Final evidence

- Canonical runtime health: FastAPI 200, proxy 200, unauthenticated `/v1/me`
  401; authenticated `/v1/me` 200 was observed in every live setup.
- R1 browser checkpoint #1: 4/4 PASS with fresh actors and fail-closed cleanup.
- R1 browser checkpoint #2: 4/4 PASS with a second fresh actor set and
  fail-closed cleanup.
- F1 controller phases B/C/D/E: 4/4 PASS; support/adversarial tests 143/143.
- Frontend regression: 657/657; typecheck, lint, generated-contract freshness,
  Storybook and production build PASS.
- Backend last verified: 493/493 on Docker PostgreSQL 17. A final rerun was
  attempted after the live checkpoints but was blocked by the local Docker
  Linux engine being stopped; no backend source or contract diff exists.
- Final reviewer verdict: `FINAL FRLL ACCEPTED`. FRLL is frozen; reopen only
  for a real regression or newly proven acceptance defect.
