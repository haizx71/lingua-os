# TASK-017A — Language Profile child ETag transport correction

Status: DOING; user-approved narrow design, no brainstorming required.

## Objective and scope

Make the existing child PATCH usable after collection discovery by adding a required,
read-only opaque `etag` string to the shared LanguageProfile response schema. Preserve
TASK-006E concurrency, ownership, lifecycle identity, and historical create replay.
No endpoint, database migration, learning algorithm, auth redesign, UI redesign, or
Today integration is authorized.

## Files and sequence

1. Contract/regression tests first: required opaque field, consistent representations,
   real PostgreSQL stale/current tokens, archived reactivation, IDOR, parent/child
   isolation, malformed preconditions, historical replay; adapter/HTTP/UI tests for
   opaque forwarding, refresh, stale refetch without auto-retry, no duplicate create.
2. Amend only `contracts/openapi.yaml` LanguageProfile; regenerate
   `packages/types/src/generated/openapi.ts` with the approved generator.
3. Add the field in Profile DTO and the existing shared route mapper using
   `language_profile_etag`; no new hash, persistence, query, or revision rule.
4. Carry child token through onboarding view model and deterministic fixtures.
   Reactivate same archived ID via ApiClient; reconcile 412 by authoritative refetch
   and a new intentional action. Preserve existing TASK-017 work.
5. Review spec, contract drift, architecture, concurrency, security and boundaries.
6. Run all requested gates, record exact evidence, update TASKS/STATUS. Reevaluate
   TASK-017 separately; do not declare it DONE if another concrete blocker remains.

## Verification

- OpenAPI validator, Redocly (only existing Reader warning allowed), all contract
  tests including enum consistency, generated freshness.
- Ruff format/lint, strict mypy, focused Profile tests, non-DB tests, real PostgreSQL
  17.x tests, full backend (floor 446; contract floor 32).
- Workspace typecheck/lint, full Vitest (floor 330 tests / 30 files; no removals),
  Storybook, Next production build.
- No child ETag parsing/synthesis, raw revision leakage, direct feature fetch,
  wildcard/stale bypass, IDOR, replacement lifecycle row, or database diff.

## Preflight

All prerequisite backend tasks are DONE; TASK-017 remains partially implemented.
Revision is already present in current and persisted historical projections.
`git status`, `git diff`, and `git diff --stat` cannot run because this checkout has
no `.git`; preserve existing work and compare a pre-edit SHA-256 file inventory.
Superpowers is unavailable; repository workflow is followed manually with API,
test-first, security and quality-review skills.
