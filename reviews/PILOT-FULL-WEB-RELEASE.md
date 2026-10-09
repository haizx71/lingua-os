# Full web option 3 — release evidence

Recorded 2026-10-10 Asia/Saigon by the Commander. This is a release ledger, not a replacement for the independent source review.

## Outcome

**Presentation release: PASS.** The owner approved option 3 across the existing app. PR [#66](https://github.com/haizx71/lingua-os/pull/66) head `534b9b1ba5e80610c05c8c4ed595d6ed8a45454b` merged normally at `2058a089529423343f7aae971bd43e1411359539`, after all exact-head checks succeeded. Vercel Production for `lingua-os-web`, deployment `dpl_CbvghXA3Pgrm88JsMCCbnah1X7fP`, is READY at that merged SHA; the canonical alias `lingua-os-web-mocha.vercel.app` is assigned. Deployment metadata was read through the connected Vercel tool.

## Evidence

- [Independent source review](PILOT-FULL-WEB-DESIGN-REVIEW.md): PASS, no HIGH/BLOCKER or unresolved actionable visual P0/P1/P2. Frozen 51-file runtime/test/asset/workflow aggregate `59141142d9d4ec07d55e44bec120a4172fdbb174db32851026c69d6d44025ff0`.
- Local final frontend regression: 633/633 tests across 48 files, plus the restored server-resume-location Reader suite 12/12. Workspace generated-contract freshness/typecheck, lint, production build and diff check PASS.
- [Web Presentation Regression](https://github.com/haizx71/lingua-os/actions/runs/37964644178): PASS, including complete frontend tests and production build without hosted credentials.
- [Security Gate](https://github.com/haizx71/lingua-os/actions/runs/37964644115): PASS.
- [Pilot Onboarding Regression](https://github.com/haizx71/lingua-os/actions/runs/37964644060): PASS.
- [Knowledge Audit CI](https://github.com/haizx71/lingua-os/actions/runs/37964644079): PASS for knowledge-audit, Review frontend regression, grammar, dictionary, Today and retrievability PostgreSQL integration jobs.
- Vercel Preview `dpl_8AktRjKLTWFnSjYTrcpB54whJqKu`: READY at exact PR head `534b9b1ba5e80610c05c8c4ed595d6ed8a45454b`.
- [Local browser QA](../design-qa.md): matching Reader reference/state, 13 page variants at mobile sizes, desktop/tablet/reflow/reduced-motion, keyboard/focus and distinct explicit actions verified using isolated synthetic fixtures. Actual local Next Auth presentation inspected without credentials.
- Direct Preview page navigation follows the existing canonical-host redirect to the production hostname. That tab was closed; it is not evidence of a hosted Preview learner journey. The canonical-host/security policy was preserved.
- Unauthenticated HTTP requests to the canonical Auth page and brand asset redirect to Vercel login. Their final HTTP 200 responses are protection-page responses, not app runtime/asset success evidence. Deployment protection remains unchanged; no Share link or bypass was created.

Actual worker configurations: preparation/source audit GPT-6 Luna / Medium; implementation GPT-6 Luna / Max; independent frozen-source review GPT-6 Luna / Max. These are assigned model/reasoning settings; runtime introspection was unavailable.

Release documentation received a separate read-only GPT-6 Luna / Medium consistency review: PASS; relative links resolve and diff check passes. No runtime tests were repeated for this documentation-only follow-up.

## Preservation and limits

- Main local checkout fast-forwarded normally from `5d0aa9769a14af3be254982f9f252cf9db24d383` to the product merge. Existing attachments and isolated worktrees were preserved. The generated worktree `apps/web/tsconfig.tsbuildinfo` cache was excluded from commits and remains local.
- No domain hook, API contract, backend, schema, migration, RLS/grant, hosted secret/protection or content publication change. No real learner data or existing learner/Admin session was changed. No disposable hosted actor was created.
- Reader reveals only supplied reviewed translations. Missing published sentence translations remain PILOT-003; synthetic QA translations were not published.
- Profile/Progress normal routes show honest unavailable states because live data integration was absent. This release adds no analytics endpoint or invented learner metrics.
- Production READY/SHA/alias evidence proves deployment identity, not a full hosted authenticated journey or improved comprehension/retention. Continue the approved real learner pilot and its existing runtime-fix rules.
