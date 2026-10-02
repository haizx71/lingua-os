# K2-08 Auth Cleanup Boundary Evidence

Updated: 2026-10-02

The source/deployment, recovery, and gate sections before **Final closure** are a historical checkpoint from before PR #41 merged. Their pending-review and LOCKED statements are superseded by the final closure; the original failed run remains failed as recorded.

## Scope and disposition

This document records the cleanup failure and bounded recovery evidence for hosted K2-08 run `36932709277` on master `58a3b738b145dd18bdb40869bab1662e6fae4840`. Runtime facts were supplied by the root operator; this author did not independently access hosted services or the database. No actor identifiers, credentials, raw learner rows, or Auth records are included.

The original hosted run remains **FAIL**. Its K2-08 fixture, Today generation and replay, cross-actor isolation, and wave assertions passed; finalizer cleanup failed and the run reached its 12-minute timeout. The finalizer completion markers and the full-run retained-state comparison are absent. A separate cleanup-window check passed, but it cannot certify the original run’s missing finalizer or retained comparison.

## Source and deployment checkpoint

PR #40 merged normally at `58a3b738b145dd18bdb40869bab1662e6fae4840`. Exact-head Security Gate `36932042260` and Vercel Preview passed. Render deployment `dep-davdg6mq1p3s73d67790` and `/health`, and Vercel Production deployment `6796216842`, attest the same SHA.

The current cleanup-boundary source fix is frozen as a four-file diff SHA256 `73e9e560da73015f9523e95466cada4b07f0e868c6e14846cc431d1ef87d5c64`. It clears only scoped Today parent rows and proves those parents absent before rechecking identity and Auth deletion at all four cleanup sites. It uses fixed redacted error messages. It changes no schema, RLS policy, grant, or workflow; the 25-minute timeout applies only to the full K2-08 TEST (hosted job remains 35 minutes; cleanup job remains 20 minutes). Implementation GPT-6 Luna / Max reports 191/191 harness tests across ten files, 120 focused actor/runner tests (84 and 36), harness typecheck, four-file ESLint, and diff-check passed.

Independent source review by GPT-6 Luna / Max returned PASS with no HIGH/BLOCKER for the exact four-file diff above. Actor/runner tests passed 120/120; four-file ESLint and diff-check passed. Review confirmed that all four cleanup paths verify the exact actor before deleting Today parents, stop before Auth deletion on errors or remaining parent rows, recheck ownership, and preserve retained-absence/residue callbacks. Exact-head CI, merge, and full hosted rerun remain pending.

## Failure and bounded SQL cleanup

The first finalizer failed because its Auth caller could not see `today_plan_activities` during the ownership cascade. The initial separate cleanup job `110610190035` also failed.

An independent Max review passed the exact one-off cleanup SQL SHA256 `C868F2D2188991A1F434B176E27FA58992BB3CF375A2C4F698E85E2E9622CFB7`. Root applied exact metadata, project, run, attempt, address, time, and count guards and deleted only two owned Today parent rows with three activities and 25 targets. No Auth DML/DDL or permission changes were made. This was a bounded, reviewed recovery action; it is not evidence that the ordinary Auth cleanup path succeeded in the original run.

## Cleanup-only verification

Only the cleanup job was rerun; no new actors were created. Cleanup attempt 2, job `110619465288`, succeeded. Independent Max checks confirmed the two selected disposable Auth records absent and the actor-absent cleanup chain.

The Commander’s fresh retained-state snapshot excluded exactly the two disposable actor owners. Before and after the cleanup window, 27 table snapshots matched exactly: 61 rows and 51,535 bytes. The final hashed-owner proof reported zero of the two selected disposable Auth records and zero rows owned by those actors across the 27 learner tables. These results attest only the cleanup window and do **not** supply the absent full-run retained comparison.

## Gate status

- Run `36932709277` remains **FAIL** despite all hosted K2-08 assertions passing before cleanup.
- Cleanup-only attempt 2 and its bounded retained-state comparison passed.
- The cleanup-boundary source change still needs independent review, exact-head CI, normal merge/deployment attestation, and a new full hosted K2-08 run with finalizer completion and a full-run retained comparison.
- K2-09 and K2-10 remain **LOCKED** until full K2-08 hosted acceptance and independent review pass.

Evidence packet prepared by **GPT-6 Luna / Medium**; implementation by **GPT-6 Luna / Max**; independent source reviewer: **GPT-6 Luna / Max**; independent one-off SQL reviewer: **GPT-6 Luna / Max**; hosted operator: **Commander**.

## Final closure — 2026-10-02

The source change was PR #41, head `43d3500fe4437009a3b13b6ec275e0fc54fb6d41`, four-file diff SHA256 `73e9e560da73015f9523e95466cada4b07f0e868c6e14846cc431d1ef87d5c64`. Independent source review by GPT-6 Luna / Max returned PASS with no HIGH/BLOCKER. Exact-head Security Gate `36940358882` and Vercel Preview succeeded; normal merge produced master `dc3fab04f56abdcfbdfd164991fc248a2665098c`. Render deployment `dep-davenh0473hc73f2goi0`, its health check, and Vercel Production deployment `6797487205` attest that SHA.

The new full hosted acceptance run was workflow `36940909998` in master acceptance mode. Hosted job `110631923274` succeeded (one test, 19.6 minutes), and cleanup job `110637771202` succeeded. Ordered UTC evidence: fresh retained baseline began 23:29:28 and passed 23:30:07; the first actor was created after baseline at 23:30:07; the wave passed at 23:42:50; actor cleanup passed at 23:45:23; fresh-identity cleanup passed at 23:47:43; retained comparison and finalizer completion passed at 23:48:22. This run’s full retained-state comparison passed.

Separate final review by GPT-6 Luna / Max checked ordered markers, the exact `actor_absent` chain, the 27-table inventory, and fail-closed finalizer proof; no HIGH/BLOCKER was reported. Commander’s terminal hashed-roster proof showed zero of the four selected disposable Auth records and zero rows owned by those actors across the 27 learner tables. The current 27-table retained snapshot is 83 rows / 72,325 bytes and stable after cleanup.

The earlier 61-row / 51,535-byte cleanup-window baseline spans another interval and is not presented as the new run’s baseline. Its 15 changed tables reflect persisted changes timestamped no later than 23:18:03 UTC, before the new run’s 23:27:30 dispatch; none correspond to persisted changes at or after dispatch. No learner data was modified to force the earlier snapshot to match. The earlier run `36932709277` remains **FAIL**; its missing full-run comparison is not retroactively supplied by this new run.

**Final gate:** K2-08 hosted acceptance, cleanup, fresh full-run retained comparison, and independent final review are PASS. K2-09 is READY; K2-10 is blocked on K2-09. K2-06/K2-07 accepted behavior and migration `0020` are unchanged. Hosted operator: Commander; implementation and independent reviews: GPT-6 Luna / Max; documentation worker: GPT-6 Luna / Medium.
