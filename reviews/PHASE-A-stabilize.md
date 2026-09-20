# Phase A stabilization review — 2026-09-20

## Specification compliance

- The FastAPI/OpenAPI boundary is unchanged.
- Domain data remains behind FastAPI; `anon` and `authenticated` retain no
  public schema or function execution path.
- The correction is an additive migration. It does not rewrite the already
  applied `0010`–`0012` history or mutate learner rows.
- `scripts/verify_frll_database.py` now requires the complete `0001`–`0013`
  registry and the staging runbook names the same baseline.

## Verification

- Targeted lockdown and migration regression suite: **12 passed**.
- `pnpm backend:check`: Ruff format **121 files**, Ruff lint clean, mypy clean,
  and **512/512** backend tests passed on real PostgreSQL.
- `git diff --check`: clean.
- `pnpm test`: **711 passed**; four hosted FRLL tests failed closed because no
  local FastAPI server was listening on `127.0.0.1:8000`.

## Known limitation

Staging still needs the reviewed `0013` migration applied. No hosted database
was mutated in this stabilization pass.
