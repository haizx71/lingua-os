# FRLL live checkpoint evidence (sanitized)

All timestamps are local Asia/Ho_Chi_Minh time. Raw process output is retained
outside the repository at `D:\LINGUA_FRLL_RAW_20260912`; those files contain no
credentials, tokens or cookies. Actor identifiers below are truncated SHA-256
hashes of UUIDs, not raw identifiers.

Commit under test: `3f474fc804f80e2334cf0ca8fe33e7152d7ab794`

## Checkpoint 1 — `FRLL-20260912-C1`

- F1 command: `pnpm exec vitest run tests/acceptance/phase_b.test.ts tests/acceptance/phase_c.test.ts tests/acceptance/phase_d.test.ts tests/acceptance/phase_e.test.ts --reporter=dot`
- F1 timestamp: 2026-09-12 17:57:20–17:58:51
- F1 exit code: 0; 4 test files / 4 tests passed.
- R1 command: `pnpm exec playwright test tests/acceptance/r1_browser_loop.spec.ts --config tests/acceptance/playwright.frll.config.ts --reporter=line --workers=1`
- R1 timestamp: 2026-09-12 17:59:03–18:06:50
- R1 exit code: 0; 4/4 browser scenarios passed.
- Actor hashes (F1 + R1, deduplicated): `c9a6cf770093e6f3`, `ce4702e9800fe501`, `aca6d086d470d96a`, `5e7042ced19399c8`, `3c4f6d2811dad8bb`, `663149c70b64c71b`, `ef0528560808f883`, `715afa85735505dd`, `61aae944b69e65a4`.
- Cleanup: every disposable actor independently verified Auth deletion, zero learner-owned rows and preserved catalog anchor.
- Raw evidence: `D:\LINGUA_FRLL_RAW_20260912\checkpoint-1-f1.log`, `D:\LINGUA_FRLL_RAW_20260912\checkpoint-1-r1.log`.

## Checkpoint 2 — `FRLL-20260912-C2`

- F1 command: same phase B–E command as checkpoint 1.
- F1 timestamp: 2026-09-12 18:07:06–18:08:39
- F1 exit code: 0; 4 test files / 4 tests passed.
- R1 command: same Playwright command as checkpoint 1.
- R1 timestamp: 2026-09-12 18:08:52–18:16:27
- R1 exit code: 0; 4/4 browser scenarios passed.
- Actor hashes (F1 + R1, deduplicated): `121ee9a160d97b60`, `2beb45bc999e2a09`, `d5535766236e4c37`, `9ca9458e06b5e173`, `042519a2dc77d051`, `423d9cc934f2a119`, `9b68eb61a819e3bc`, `38224410b5c8752c`, `be7ba8a694ffd41b`.
- Cleanup: every disposable actor independently verified Auth deletion, zero learner-owned rows and preserved catalog anchor.
- Raw evidence: `D:\LINGUA_FRLL_RAW_20260912\checkpoint-2-f1.log`, `D:\LINGUA_FRLL_RAW_20260912\checkpoint-2-r1.log`.

## Cross-checks

- Actor-set intersection: empty; checkpoint 1 and checkpoint 2 used distinct
  disposable actors.
- Post-commit response loss: PASS; upstream HTTP 200 and PostgreSQL commit were
  observed before the browser response was aborted.
- Same-receipt replay: PASS; durable receipt fields and PostgreSQL digest were
  identical, with no duplicate events or transitions.
- Actor-B isolation: PASS; cross-owner answer returned canonical 404 and late
  Actor-A response did not contaminate Actor-B UI/state.
- Passive zero-write: PASS; Brain/Today reads changed no learner-derived rows.
- Catalog anchor: PASS after every cleanup.

This is execution evidence only. Final FRLL acceptance remains the independent
reviewer's decision.
