# Gemini UI v2 reconciliation archive

This branch preserves the local-only UI v2 source state as text snapshots under an isolated archive directory. Snapshots are taken from the local branch tip and contain only the explicit credential redactions listed below.

## Reconciliation base

- Local source branch: gemini/ui-redesign-v2
- Source tip: dae6841a32a488a725543fb5d74991284eb10cd8
- Merge base recorded in the source branch: 70d642c2a0d290ea8f4ab252d2ca142bb88ea5c8
- GitHub master verified at archive creation: 9c39417f29309d5dc2714082d7a28375712a79a6
- Archive branch: codex/reconcile/gemini-ui-v2-archive-2026-09-27

## Local-only commit history

| Commit | Parent(s) | Subject |
|---|---|---|
| 8fe073331858892abdf8a9618dcbfa4760a00761 | 926a9a78d539d20d780b3129940d134feb50f76b | feat(ui): international-grade UI/UX redesign with calm cognitive workspace |
| f90468bce6d9de07c3c84c22359f4de4e733e6ad | 8fe073331858892abdf8a9618dcbfa4760a00761 | feat(auth): enable 1-click demo test learner account for local dev |
| 8c2262eff55b62ee7ef1fa5d544d01094708d1bc | f90468bce6d9de07c3c84c22359f4de4e733e6ad | feat(auth): add auto-fill helper and test credentials banner to signin card |
| dae6841a32a488a725543fb5d74991284eb10cd8 | 8c2262eff55b62ee7ef1fa5d544d01094708d1bc, 70d642c2a0d290ea8f4ab252d2ca142bb88ea5c8 | Merge branch master into gemini/ui-redesign-v2 |

## Source snapshot inventory

Each snapshot preserves its source blob except for the credential redactions below. Source blob IDs and byte sizes identify the exact branch-tip inputs.

| Source path | Source blob | Bytes | Snapshot path |
|---|---|---:|---|
| apps/web/next.config.js | ee1d6e98c4847b0d5950cdf170d557d5d33c686f | 953 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/next.config.js.snapshot.txt |
| apps/web/src/app/globals.css | 1b0b5561c0b8ef171be484a4fb38342f0559a5be | 1872 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/app/globals.css.snapshot.txt |
| apps/web/src/app/layout.tsx | 91fb6e467f3538da0302daf8ad8524006f93e631 | 652 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/app/layout.tsx.snapshot.txt |
| apps/web/src/components/navigation/AppShell.tsx | db3a7816681ac4cf3f847741122c4a71c9d088e9 | 1278 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/components/navigation/AppShell.tsx.snapshot.txt |
| apps/web/src/components/navigation/DesktopSidebar.tsx | d0cc3c1164c560c20446d1a6fbfed345b488543f | 7600 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/components/navigation/DesktopSidebar.tsx.snapshot.txt |
| apps/web/src/components/navigation/MobileBottomNav.tsx | 2d9a46e5c143e644ef1a4c0484f9fc9ce52c4216 | 2379 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/components/navigation/MobileBottomNav.tsx.snapshot.txt |
| apps/web/src/components/navigation/TabletRail.tsx | 2570bae06b7d2dfc35d5e858af7b7f46c59c0ef6 | 4179 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/components/navigation/TabletRail.tsx.snapshot.txt |
| apps/web/src/features/auth/AuthContext.tsx | 21866e2860bd23308e5e431bc43109a0bba980a9 | 13513 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/auth/AuthContext.tsx.snapshot.txt |
| apps/web/src/features/auth/AuthEntry.tsx | b06b8201deb74c9b2aed70370d75d944e1bbcecc | 14804 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/auth/AuthEntry.tsx.snapshot.txt |
| apps/web/src/features/brain/LanguageBrainCanvas.tsx | e425767576ab3e064c0fee53435b37ebf682d299 | 24396 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/brain/LanguageBrainCanvas.tsx.snapshot.txt |
| apps/web/src/features/progress/ProgressAnalytics.tsx | f15846784bd5bf14089e6749a479b16dc2d31465 | 14108 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/progress/ProgressAnalytics.tsx.snapshot.txt |
| apps/web/src/features/read/InteractiveReader.tsx | 4d9c57ad39f935e598fb71e0e605782f521378e6 | 16699 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/read/InteractiveReader.tsx.snapshot.txt |
| apps/web/src/features/review/ReviewSession.tsx | 08095b1f5bec69c594807b32608dc4b146826f25 | 17291 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/review/ReviewSession.tsx.snapshot.txt |
| apps/web/src/features/settings/AccountSecurityCard.tsx | 36c89f55c038ef1cff7b34b3fcde7a202bceda6a | 10994 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/settings/AccountSecurityCard.tsx.snapshot.txt |
| apps/web/src/features/today/TodayDashboard.tsx | 79356e415b5f30b9eef4e3dd3732f87b31aa538e | 17664 | reconciliation-archive\gemini-ui-redesign-v2\apps/web/src/features/today/TodayDashboard.tsx.snapshot.txt |
| packages/ui/src/components/Button/Button.tsx | d42a1daff55a31acdd26fd3904755dd0e452bc4f | 2746 | reconciliation-archive\gemini-ui-redesign-v2\packages/ui/src/components/Button/Button.tsx.snapshot.txt |
| packages/ui/src/components/Card/Card.tsx | bc803a367074fac0b14bc8de25119b1c87b8855a | 1636 | reconciliation-archive\gemini-ui-redesign-v2\packages/ui/src/components/Card/Card.tsx.snapshot.txt |
| packages/ui/src/components/Input/Input.tsx | 866b3522e8752a8b710e93dbe16762a03c49fd00 | 5635 | reconciliation-archive\gemini-ui-redesign-v2\packages/ui/src/components/Input/Input.tsx.snapshot.txt |
| packages/ui/src/tokens/theme.css | 25147c9f7740b1a8cc122d1634902820994db985 | 6684 | reconciliation-archive\gemini-ui-redesign-v2\packages/ui/src/tokens/theme.css.snapshot.txt |

## Omitted generated file

- apps/web/tsconfig.tsbuildinfo was intentionally omitted as generated TypeScript build cache. Source blob:
d3d134e35363dee77be70a5fab984eb87bdb45bf
; bytes:
233223
.

## Credential redactions

Counts are per occurrence in the source snapshots. Values are replaced with labeled markers and are not recorded here.

| Source file | Redaction | Occurrences | Rationale |
|---|---|---:|---|
| apps/web/src/features/auth/AuthContext.tsx | Demo email |
1
 | Prevents disclosure of the static demo login identifier. |
| apps/web/src/features/auth/AuthContext.tsx | Demo user UUID |
1
 | Prevents reuse of the demo fixture identity. |
| apps/web/src/features/auth/AuthContext.tsx | Demo access token |
1
 | Prevents reuse of the static demo session token. |
| apps/web/src/features/auth/AuthContext.tsx | Demo refresh token |
1
 | Prevents reuse of the static demo session token. |
| apps/web/src/features/auth/AuthEntry.tsx | Demo email |
8
 | Removes demo login identifiers shown or prefilled by the local auth UI. |
| apps/web/src/features/auth/AuthEntry.tsx | Demo password |
6
 | Removes every static demo password occurrence shown or prefilled by the local auth UI. |

## Validation

- 19 of 19 changed source/config paths are represented as snapshots.
- The generated cache path, source blob ID, and byte size are recorded above.
- Credential scanner found no remaining email, UUID, demo-password, JWT, common API-key, bearer-token, or credential-bearing URL literals in the snapshots.
- No runtime source, package, or deployment configuration is changed by this archive.
- The apps/web/src/features/progress/ProgressAnalytics.tsx snapshot preserves its source final blank line; git diff --check reports this inherited note.
