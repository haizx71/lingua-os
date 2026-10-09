# PILOT-002 profile-readiness plan — independent review

## Verdict

**PASS for the bounded design; no HIGH or BLOCKER findings.** This is a plan review only. It does not authorize implementation, a hosted test, or a change to the pilot's P0/P1 gate.

## Reviewer and frozen artifact

- Reviewer assignment: GPT-6 Luna, reasoning effort Max (configured independent reviewer; runtime introspection unavailable).
- Reviewed: `plans/PILOT-002-profile-readiness.md`, SHA-256 `928d7e9f8268686e996519481cdb67936c9ed5178419a6101f09ba2124826552`, 7,942 bytes, frozen in the documentation worktree on base `a64e6ff602e0d71cd7285b8f8cd3f98f1ed93d37`.
- Scope: the frozen plan and bounded read-only source/reproduction facts supplied for this review. No repository files, Git state, hosted service, learner account, or hosted actor were changed. No runtime implementation or test suite was run for this plan review.

## Evidence and severity boundary

The owner reports that learning access is possible and usually takes about 30 seconds, including after an immediate reopen. This supports a **provisional P2 latency report**; exact duration and whether access eventually fails remain unknown. The local reproduction demonstrates a conditional mechanism only: with a complete valid `/v1/me` DTO, a deliberately pending redundant `/v1/me/languages` read kept the protected child hidden after five seconds; a separate never-resolving `/v1/me` remained on the spinner at 60 seconds. Those controlled mocked-transport results do not establish the owner's request path, production incidence, cause, or P1 core-learning blockage. The plan represents this distinction accurately and preserves the pilot's P0/P1-only rule.

Any implementation therefore remains contingent on a narrowly scoped, owner-authorized P2 exception, or independently confirmed P0/P1 impact under the pilot definitions. This review is not that authorization.

## Design review

- Reuse the required, actor-owned, bounded `MeProfile.languageProfiles` snapshot for the readiness boundary and remove its redundant collection read. Keep the existing six-point readiness predicate intact and fail closed on missing or malformed data. The plan does not change the API wire contract, backend, schema, K2 state, or readiness defaults.
- Bound one readiness operation at 45 seconds from start through token acquisition, fetch, and response-body read. Given the owner's usual reported wait of about 30 seconds, this is a recovery limit rather than a promised latency improvement. Timeout keeps the route protected, presents the existing recoverable error/retry state, and waits for explicit retry; it adds no automatic retry or readiness cache.
- Limit cancellation to an optional internal `getMe` read signal. The plan accounts for token acquisition that cannot itself be canceled: stop waiting at the deadline and check the signal before starting fetch if token acquisition later resolves. Fetch/body work is aborted where supported; writes and unrelated API methods receive no new cancellation policy.
- Use operation generations and cancellation on retry, actor change, logout, disabled readiness, and unmount. Stale results must not update UI state. The explicit same-actor ETag requirement is necessary because the current client only guards ETag writes by actor generation: implementation and regression coverage must check cancellation/staleness after body parsing and before storing the `me` ETag, including the case where an older response arrives after a newer same-actor retry.
- The regression plan is appropriately red-capable and covers the complete DTO/no-collection-read path, every readiness dimension, delayed token/fetch/body, timeout and manual retry, same-actor ETag ordering, actor changes/logout, disabled readiness, and unmount. CI must include the touched hook/client files and new test.
- The bounded scope leaves the separate onboarding bootstrap/list request and other profile-loading paths unchanged. Consequently, this design may remove one readiness-boundary wait but does not prove or promise that the full onboarding journey or the owner's reported delay will improve. The plan states that limitation and keeps Render cold-start explanations unproven.
- No hosted actor or real learner page is needed to review this frontend-only plan. The no-hosted-mutation boundary and full cleanup obligations if a later separately authorized test creates actors are stated.

## Remaining gates

1. Obtain and record the specific owner authorization for the P2 exception before any implementation; do not infer it from this plan review.
2. If authorized, keep implementation bounded, obtain a separate GPT-6 Luna / Max review of the exact patch, resolve HIGH/BLOCKER findings, and pass exact-head CI plus the stated frontend checks before root promotion.
3. Keep owner latency cause, production request path, and any performance improvement marked unknown until measured with safe, authorized evidence.
