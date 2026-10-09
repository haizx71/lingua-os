# Independent PILOT-001 Timezone Onboarding Review

**Verdict: PASS — no HIGH/BLOCKER issue or actionable security finding in the bounded review.** This is an independent source and documentation review, not an exact-head CI, Preview, deployment, or live learner-journey result.

**Reviewer:** configured GPT-6 Luna, Max reasoning effort
**Review date:** 2026-10-09 (Asia/Saigon)
**Review mode:** read-only; no source, tests, CI, Git, or hosted state was changed.

## Frozen scope

Runtime source worktree: `C:\Users\pc\.codex\worktrees\pilot-onboarding-timezone\LINGUA_OS_PROJECT_STARTER`
Branch: `codex/pilot-onboarding-timezone`
Base: `954235c57ebb786f09a6f8966c07392ae1e4a5c4`
Runtime manifest: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-09-frozen-timezone-runtime-manifest.json`
Manifest SHA256: `31fb77f401ad12328cdfffb5f6cc5cf381985c20b3ed3ed8396fa6c512bc7163`
Five-file aggregate SHA256: `728c8cf73438d35e40e188a505cc48a2ca776119d0a5dd0c8f21e5778ad04fa6`

All five manifest file hashes were rechecked and matched:

- `apps/web/src/features/onboarding/LiveOnboardingFlow.tsx` — `c0645ddc7d9c8fd220a6d467c5d1b29b3b58245d196846dc6c5911a30b07008a`
- `tests/frontend/task017-live-onboarding.test.tsx` — `8bf44e31730fdcf7bda6543860192c5f500199402cc5fdc50cce85e5d6780cec`
- `tests/frontend/pilot-onboarding-timezone.test.tsx` — `7f0d3b9c9120fd0fc767ed711cbada88ec6db15a44d3727ed90efada85a6100a`
- `.github/workflows/pilot-onboarding-regression.yml` — `71b744d1c5a7f42d8cc402071a2415949eeffc4e822f3064bed0234de43d05a2`
- `plans/PILOT-001-onboarding-timezone.md` — `3bc6ed9d048de8478a7782383adac69db7119e96f98a22ea349b4e57fbe0273e`

I also reviewed the frozen three-document evidence delta relative to documentation base `0de9d51f65a0e6a88e8dea76dd788cd8970ec4d0`. Its manifest is `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-09-frozen-pilot-docs-delta.json` (SHA256 `5386f61917a8ac1ed49e9bf2f1cfda57a3cf8c599a2eb3b33edf7ef34454fdbf`):

- `PILOT_FINDINGS.md` — `561e6356f8367c9cdb8dc25f534bd465c6fe4c9f7a293d286f4d167e09381d37`
- `TASKS.md` — `7b0642774e3d22d7bddfd9a911a20d1b01b018ec1c0d295c74600bd6fe5bdc30`
- `plans/REAL-LEARNER-PILOT-V2-FREEZE.md` — `f0974c9c9f1e472d67c8d3dac1b2c4e44fdf2bab86fe601ff26f5ab34cf41c09`

The separate modified `apps/web/tsconfig.tsbuildinfo` cache was outside the documentation manifest and review scope. `git diff --check` passed for the runtime and documentation changes; referenced local Markdown paths in the pilot docs exist.

## Review results

The flow uses a valid browser `Intl` timezone as a candidate and does not request GPS or location permission. A valid stored timezone is retained. When a timezone needs persistence, the ordinary setup CTA sends the timezone PATCH with the current strong `If-Match`, validates the server response, and only then allows language-profile creation. Failed persistence blocks that creation; a 412 causes refetch without an automatic mutation retry. Invalid or throwing browser detection falls back to manual selection.

The existing authenticated `GET /v1/me` bootstrap remains unchanged. It may create only `public.users` and `learner_profiles` for a new application identity. The corrected runtime plan now limits the no-write-before-CTA guarantee to **new timezone PATCH and language-profile POST**. This resolves the review’s sole documentation accuracy issue; the original immutable implementation packet is superseded on this point by the explicit correction.

Actor-generation guards prevent a late Actor A response from advancing Actor B or initiating a following write for A. The synchronous in-flight ref guard is present in both setup submit handlers. The existing actor-isolation regressions remain meaningful. The new HTTP UI regression uses React plus the real `HttpApiClient` with mocked HTTP and verifies the CTA ordering, ETag, response handling, fallback, and no automatic retry.

The pull-request workflow is limited to `pull_request`, grants `contents: read`, pins its actions, disables checkout credential persistence, and has no secret, deploy, or PR-target operation. The docs preserve K2-06–K2-10 as accepted/frozen, identify PILOT-001 as the sole owner-authorized P2 frontend exception, and keep live learner and learning-quality outcomes UNKNOWN. The 7–14 day observation window and one evidence-led V3 recommendation do not automatically authorize a major implementation.

No K2, Auth, RLS, schema, or backend change is in the five-file patch.

## Evidence boundaries

The implementation worker reported **99/99 focused frontend tests across six files**, plus TSC and lint. I did not independently rerun those checks. No hosted actors were created.

This review does not establish a hosted learner journey, the `/api` proxy path, or a real learner outcome. There is no direct rapid-double-click regression test; the synchronous guard is present in the source. Exact-head CI/Preview and actorless deployed-source checks remain separate promotion gates.

The Codex Security diff scan completed with zero findings and **partial** coverage. Its workbench inventory returned only the flow and workflow paths; I manually reviewed and hash-verified the other three manifest paths. The scan reported that the working tree changed while it ran: the corrected plan was independently rechecked at its final hash above, and no runtime source/test/workflow path changed in that correction. The result is a bounded five-file review, not a full repository or hosted security audit.

## Final assessment

PASS for the frozen PILOT-001 runtime patch and the three-document evidence delta, with the coverage limits above. No HIGH/BLOCKER findings. Promotion still requires the normal independently reviewed exact-head CI/Preview gate; this review does not claim that gate has passed.
