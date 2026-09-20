# FRLL real integration verification — 2026-09-20

## Scope

This checkpoint verifies the promoted UI v2 against the real disposable Supabase Auth and
PostgreSQL development environment. It does not change product source, OpenAPI, migrations, or
learner-state rules.

## Evidence

- Current `master` and `origin/master`: `eb04318acdc8d9843d6036d3729187f50b7f1e1c`.
- Phase B: `pnpm test tests/acceptance/phase_b.test.ts` — 1/1 passed, including real Auth,
  vi→en profile, Save/Learn, one Memory lineage, idempotence, and cleanup isolation.
- Phase C: `pnpm test tests/acceptance/phase_c.test.ts` — 1/1 passed, including Today target
  selection, server timezone authority, plan idempotence, and cleanup isolation.
- Phase D: `pnpm test tests/acceptance/phase_d.test.ts` — 1/1 passed, including atomic FSRS,
  review/learning/competence events, replay, same-key conflict protection, and cleanup.
- Phase E: `pnpm test tests/acceptance/phase_e.test.ts` — 1/1 passed, including authoritative
  Brain projection equality and zero writes from Brain reads.
- Playwright R1: four browser scenarios passed after restoring a missing local `@gsap/react`
  package materialization; the canonical response-loss/reload/replay scenario was rerun alone
  and passed 1/1. Actor cleanup and post-cleanup isolation passed.
- Local API, Next, and same-origin proxy were stopped after verification; ports 8000, 3000, and
  3005 are not listening. Working tree is clean.

## Deployment boundary

Render deploy `dep-danvd1qjnfac7397dgr0` is live from the same commit at
`https://lingua-api-staging.onrender.com`. The hosted Supabase staging migration registry still
contains `0010`–`0012`; additive migration `0013` is not applied there. No hosted database
mutation was made during this checkpoint. Apply `0013` through the normal reviewed staging path
before treating the hosted function-default execute lockdown as complete.

## Review result

The real learning loop and promoted UI browser path are verified. No implementation blocker was
found. The only remaining staging hardening item is the reviewed hosted `0013` migration.
