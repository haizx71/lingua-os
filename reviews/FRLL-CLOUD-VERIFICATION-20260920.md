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

## Staging hardening addendum — 2026-09-21

This addendum supersedes the earlier deployment-boundary note for the hosted staging gate.

### Git integration

- PR #7 was verified live against `haizx71/lingua-os`: base `master`, head
  `gemini/knowledge-v2-master-design`, expected head
  `790359ed4b7162abdf82e92c060a10121824f60f`, 16 added files, all under
  `docs/knowledge-v2/**`, and no source/schema/API/deployment changes.
- It was merged with merge commit
  `2e531c30d20eb53f04ac4558b64f38b141430785`; local `master` and `origin/master` now point to
  that commit.

### Supabase staging migration

- Target: `lingua-os-staging`, project/ref `bdmtdvvnbicgkfririjo`, ap-southeast-1. Production was
  not accessed.
- Before apply, the hosted migration history contained the four existing Supabase-managed
  security/catalog entries and the application registry contained exactly `0001`–`0012`.
- Migration `0013_supabase_public_function_default_execute_lockdown_v1` was executed once through
  the Supabase migration path. Hosted history advanced once to
  `supabase_public_function_default_execute_lockdown_v1`; no later migration exists.
- After exact SQL execution and privilege verification, the application registry was synchronized
  with version `0013` and checksum
  `c750d91681018cfdb8cde5c8c03789f2e3d313a18a2e69ca5add666c9726d4bc`.
- A transactional future-function probe changed from `anon=true, authenticated=true` before
  apply to `anon=false, authenticated=false, service_role=true, postgres=true` after apply.
  Existing public functions remained at browser EXECUTE count 0 and service-role EXECUTE count 18.

### Data safety and runtime

The migration-only pre/post learner snapshot was identical: users 1; learner profiles 1; user
languages 1; user concept states 1; user skill states 3; review items 1; FSRS states 1; learning
events 5; exposure events 0; saved concepts 1; today plans 8; today activities 7. The later
authenticated smoke of `GET /v1/today` generated the expected next daily plan (2026-09-21) and
one activity for the existing staging learner. That application-side persistence is recorded and
was not removed or reset.

Render deploy `dep-dao6lo7avr4c73b042sg` is live from the merge SHA. `/health` returned 200. The
authenticated staging browser session produced 200 responses for `/v1/me`, `/v1/me/languages`,
`/v1/today`, `/v1/brain/summary`, `/v1/brain/concepts`, and `/v1/review/queue`; unauthenticated
`/v1/me` returned 401. Render logs for the post-merge deploy show startup complete and no database,
permission, function-execute or 500 errors in the inspected window.

### Regression and blockers

- Backend: **512/512 PASS** with Ruff format/lint and strict mypy.
- Frontend: **711 PASS**; four external FRLL tests fail closed because no local API is listening on
  `127.0.0.1:8000` (environment condition, not a product regression).
- ESLint, production build, `git diff --check`, and OpenAPI contract tests (**33/33**) pass.
- `contracts:check-generated` reports only CRLF/LF byte differences between the checked-in
  generated OpenAPI file and openapi-typescript output; normalized content is identical. Aggregate
  workspace typecheck also remains blocked by the missing `@storybook/react` materialization in
  the local `packages/ui` dependency tree.
- Full cloud R1 4/4 with disposable actor setup, actor isolation, mutation replay and cleanup was
  not rerun: staging Auth/admin credentials for disposable-user lifecycle are unavailable here.

Supabase tooling also reports two follow-up security warnings: RLS is disabled on 33 canonical
tables, and leaked password protection is disabled. No blanket RLS or Auth setting change was
made in this gate. Staging hardening therefore remains **FAIL/BLOCKED** for release readiness;
K2-01 is explicitly not started.
