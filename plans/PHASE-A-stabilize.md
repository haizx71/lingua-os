# Phase A — Backend and migration stabilization

## Scope

- Run the backend suite against real PostgreSQL 17.11 through Docker Desktop.
- Align migration registry and database tests with the applied Supabase boundary
  migrations `0010`, `0011`, and `0012`.
- Preserve the browser lockdown posture and add the smallest versioned correction
  for PostgreSQL's global default `PUBLIC EXECUTE` grant on future functions.

## Acceptance checks

- `pnpm backend:check` passes format, lint, strict mypy, and the complete backend suite.
- Migration apply, no-op reapply, rollback, and replay tests cover `0010`–`0013`.
- Browser roles cannot use the public schema or execute public functions directly.
- No OpenAPI, frontend, or learner-state contract is changed.
- `git diff --check` is clean.

## Deployment note

The hosted staging project already records `0010`–`0012`. Migration `0013` is
additive and must be applied through the normal reviewed staging migration path;
existing migration files must not be rewritten to repair their checksums.
