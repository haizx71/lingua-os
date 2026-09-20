# UI v2 promotion checkpoint — 2026-09-20

Outcome: integration prepared; promotion blocked by frontend regression gate.

- Source branch `df2e09f` diverged from `master` (`70d642c`) by 46 and 74 commits respectively. Merge produced two conflicts.
- `layout.tsx`: retained current multilingual fonts and added UI v2's early theme initialization.
- `AccountSecurityCard.tsx`: retained current server-side password reauthentication for account deletion.
- Removed the incoming tracked `.env.production` from the integration result.
- No contracts, migrations, backend source, or learner-state logic changed.

Verification:

- `pnpm install --frozen-lockfile`: pass.
- `pnpm -r typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm build`: pass, 19 Next.js routes generated.
- `pnpm exec vitest run tests/frontend --reporter=dot --silent`: **fail**, 497 passed / 71 failed across 42 files. Failures include older selectors/copy and business-flow assertions in Dictionary Save/Learn, Today, Reader, Brain, and Settings. Do not waive these without verifying the corresponding behavior.
- `pnpm contracts:check-generated`: reports stale generated types, while a fresh generated temporary file compared byte-for-byte equal to the checked-in file. Treat the command result as unresolved tooling behavior.
- `git diff --check`: pass.

Spec review: the merge kept the current account deletion guard and did not alter public contracts. Full UI spec acceptance remains unproven while tests fail.

Code review: two merge conflicts resolved; broader changed-component review remains pending after test reconciliation.

Deployment was not triggered. No remote branch or `master` update was made at this checkpoint.
