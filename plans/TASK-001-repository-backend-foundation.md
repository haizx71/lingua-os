# TASK-001 — Repository/backend foundation

## Objective

Create the smallest reproducible Python/FastAPI backend foundation needed for the LINGUA OS MVP, without adding business endpoints, persistent schema, or post-MVP provider scaffolding.

## Scope and affected files

- Root Python project and locked backend development dependencies.
- `services/api/`: importable FastAPI application and minimal operational health check.
- `tests/backend/`: smoke tests for application metadata and health behavior.
- Root workspace commands, environment template, and README backend setup instructions.
- `TASKS.md` and `STATUS.md` only after all verification gates pass.

## Contract and migration impact

- No public learning API contract changes.
- No changes to `contracts/openapi.yaml`, `contracts/enums.json`, or `contracts/errors.json`.
- No database migrations or domain schema changes; those belong to `TASK-003`.

## Implementation slices

1. Add a failing backend smoke test that specifies the application and health response.
2. Add the minimal FastAPI package and configuration needed to make the test pass.
3. Add reproducible install, lint, type-check, test, and development commands; validate them from a clean virtual environment.
4. Run spec-compliance and code-quality reviews, fix required findings, then update project status.

## Acceptance checks

- A documented clean install creates an isolated environment and installs locked dependencies.
- The backend test command passes and verifies the health endpoint without external services.
- Ruff and mypy pass for backend source and tests.
- The FastAPI application starts locally and exposes no MVP business endpoints prematurely.
- Existing frontend lint, type-check, tests, and build remain green.
- No frontend ownership boundary, shared API contract, or persistent schema is changed.

## Risks and mitigations

- Python 3.13 compatibility: pin versions verified on the local Python 3.13 runtime and document Python 3.12+.
- Root tooling coexistence: add backend-specific commands without changing existing frontend command behavior.
- Accidental contract expansion: keep the health route operational-only and outside the versioned `/v1` product API.
- Git save points are unavailable because the supplied workspace is not a Git repository; keep changes small and verify each slice independently.

## Completion evidence

- TDD: smoke test failed first because `lingua_api` did not exist, then passed after the minimal application was added; the OpenAPI-boundary test also failed before the health route was excluded from the product schema.
- Clean install: `requirements/backend-dev.lock` installed in a fresh Python 3.13 environment and matched `pip freeze` exactly.
- Backend checks: Ruff format/lint, strict mypy, and 2/2 pytest tests passed through `pnpm backend:check`.
- Runtime: Uvicorn served `GET /health` with HTTP 200 and the expected service/status/version payload.
- Workspace regression: frontend lint and type-check passed, 324/324 Vitest tests passed, and the Next.js production build succeeded.
- Spec review: passed with no contract, migration, frontend-source, or post-MVP scope changes.
- Code-quality review: passed with no required findings; dependency consistency and secret scan passed.
