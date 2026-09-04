# Test suite regression audit before TASK-006

## Objective

Explain the verified test-count change from 324 tests / 26 files before TASK-005 to 270 tests /
26 files after TASK-005, identify any meaningful lost coverage, restore only contract-valid coverage,
and rerun the complete frontend quality gate without implementing TASK-006.

## Baseline evidence

- The workspace is not a Git repository, so there is no commit/ref diff.
- Archived Gemini/Codex transcripts contain the complete pre-TASK-005 test sources and the Vitest
  run showing per-file counts.
- Exactly two files changed test count:
  - `tests/frontend/contracts.test.ts`: 47 -> 22
  - `tests/frontend/challenger.adversarial.test.ts`: 35 -> 6
- The remaining 24 files retained their per-file counts.
- Arithmetic: `47 + 35 = 82`, `22 + 6 = 28`, and `82 - 28 = 54`.

## Audit method

1. Extract all baseline test titles from the archived 826-line and 690-line sources.
2. Compare them with current titles and assertions, not names alone.
3. Classify every baseline test as renamed, merged, intentionally obsolete, or accidentally lost.
4. Preserve motion, reduced motion, tokens, accessibility and component suites by verifying their
   file/test counts and relevant assertions remain unchanged.
5. Restore meaningful transport, enum/error, ownership, algorithm-boundary, mock-conformance and
   persistence coverage against generated DTOs and current view models.
6. Do not restore stateful frontend mocks that calculate FSRS, placement, Today recommendations,
   validation, authorization, or backend entity state.

## Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build-storybook`
- `pnpm build`

No backend, database, contract, UI design, motion implementation or TASK-006 change is in scope.
