# UI v2 promotion checkpoint — 2026-09-20

Outcome: integration reconciled; ready for promotion and deployment review.

- Source branch `df2e09f` diverged from `master` (`70d642c`) by 46 and 74 commits respectively. Merge produced two conflicts.
- `layout.tsx`: retained current multilingual fonts and added UI v2's early theme initialization.
- `AccountSecurityCard.tsx`: retained current server-side password reauthentication for account deletion.
- Removed the incoming tracked `.env.production` from the integration result.
- No contracts, migrations, backend source, or learner-state logic changed.
- The original 71 frontend failures were compared with a current-`master` control run: 68
  were UI v2 regressions and 3 were pre-existing settings harness failures. The affected
  accepted flows were restored without changing the public contract.

Verification:

- `pnpm install --frozen-lockfile`: pass.
- `pnpm -r typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm build`: pass, 19 Next.js routes generated.
- `pnpm exec vitest run tests/frontend --reporter=dot --silent`: **pass**, 568 passed across 42 files.
- `pnpm contracts:check-generated`: pass after regenerating the checked-in file; generated OpenAPI content is unchanged (working-tree line-ending normalization only).
- `pnpm backend:check`: format check, Ruff lint and mypy pass. The pytest phase reports 221 passed,
  one pre-existing migration-registry failure, and 288 database setup errors because Docker
  PostgreSQL is unavailable in this environment. The same migration-registry failure is
  present on the current `master` control worktree.
- `git diff --check`: pass.

Spec review: the merge kept the current account deletion guard, actor/request protections,
explicit Save/Learn behavior and learner-state boundaries. No public contract, migration or
learner-state logic changed.

Code review: two merge conflicts resolved; changed components retain existing provider and
server-guard boundaries. The frontend regression suite and static checks now pass.

Deployment has not been triggered yet. Remote `master` update is the next step after this
checkpoint commit.
