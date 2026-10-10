# PILOT-READER Hosted Acceptance Plan

**Status:** Design proposal; implementation, workflow dispatch, actor creation, and hosted content operations require separate review and root authorization.

## Goal and boundary

Verify the approved Reader comprehension/guidance slice against the exact staging deployment using disposable synthetic learner actors and the normal browser Auth flow. The test covers published-content identity, Reader meaning reveal, explicit concept-save intent, Review navigation without a due-date promise, Today return, and actor isolation. It does not measure the real learner's outcome or claim a full-product journey.

Keep K2-06 through K2-10 accepted and frozen. Do not rerun a K2 wave, change migration 0021, alter Auth/RLS/grants, modify real learner data, introduce a public API/schema change for this acceptance harness, or use service credentials in the browser. Do not weaken existing GitHub, TrustedSource/OIDC, deployment-attestation, actor ownership, or cleanup protections.

## Reuse the protected workflow identity, not a K2 wave

Extend the existing `.github/workflows/k2-hosted-acceptance.yml` with one fixed `PILOT-READER` selector while preserving its current workflow identity checks: `workflow_dispatch` only, `haizx71/lingua-os`, `refs/heads/master`, exact workflow ref, and owner as actor and triggering actor. Keep existing permissions, concurrency serialization, exact-master-SHA verification before staging secrets, immutable successful Vercel Production deployment attestation, protected-origin verification, Render health/source-SHA check, and unconditional current-run cleanup. Update the fixed selector validation in both the workflow and `validateK2HostedEnvironment`; reject unknown selectors.

Give `PILOT-READER` a separate small runner/spec entry. Do not invoke `runK2HostedWave` or any `k2_hosted_wave_k2_07..10` plugin: that path is deliberately coupled to K2 migration/fixture gates and FRLL scenarios. Reuse only reviewed generic seams after verifying their behavior remains appropriate: `createK2HostedActor`, `authenticateK2HostedActor`, protected deployment helpers, `k2_playwright_network.ts` normal-JWT browser request binding, the safe probe client, `cleanupK2RunActors`, `verifyActorGone`, and retained snapshot comparison. If these helpers cannot be separated from K2-only requirements without changing accepted semantics, add a small pilot-specific wrapper with the same or stricter invariants; do not change K2 waves to accommodate it.

Keep `mode` and the new fixed selector under the existing owner/master/workflow guards. The pilot acceptance job may receive only the secrets already needed by the approved staging harness. Service-role and database credentials stay in the runner/probe boundary; never inject them into page context, browser storage, test output, or artifacts. The browser uses a disposable actor's ordinary Supabase Auth session and the existing normal JWT/proxy path. OIDC/TrustedSource claims, audiences, headers, and scope do not change.

## Precondition: publish and pin the approved content

The owner-approved first-party Vietnamese candidate is the immutable editorial artifact identified in the current Reader follow-up plan by SHA-256 `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`. Verify its bytes and its independent content/editorial review at implementation time. The candidate is not an Admin payload and its prior Reader-pack approval is not inherited.

Before publication, the authorized operator uses the normal Owner Admin create/validate/publish flow. Require exact 72 English-to-Vietnamese sentence pairs, reviewed provenance/rights and disclosed English corrections, normal matcher/segment validation, zero blocking validation issues, and successful normal Admin publication. Do not publish via SQL, harness fixtures, or direct application-store calls. Preserve the existing published item and all learner references; publish the reviewed correction as a new content identity.

Run a distinct publication-preservation gate: capture the supported retained learner-state snapshot immediately before Admin publication and compare it after publication across the same 27 learner tables. Require exact per-table row counts and hashes and zero delta. This gate applies to the publication operation, separately from the later disposable-actor acceptance snapshot. Historical publication evidence is not a substitute for a fresh comparison of this content operation.

After publication, resolve the intended new item using an actorless, read-only exact-content inspection. Pin the immutable content identity, body hash, 72 sentence ordinals/text pairs, and translation hash in the reviewed acceptance manifest. Keep internal IDs in memory only; if a sanitized evidence artifact needs a key, use a SHA-256 pseudonym. The runner must fail closed if the published item is absent, duplicated/ambiguous, changed, missing any Vietnamese translation, or differs from the reviewed manifest. Do not expose IDs, raw row payloads, credentials, or Auth identifiers in logs/artifacts.

## Hosted actor and browser scenario

1. Before creating actors, recover only expired or interrupted actors carrying the harness's exact server-owned run marker. Prove no marked actors remain, then capture a retained-state baseline across the pinned 27 learner tables. The probe streams bounded canonical row serialization and reports aggregate counts/hashes only; it must not export row content.
2. Create two fresh, run-marked disposable actors. Authenticate with normal Supabase Auth. Verify each identity independently in the same browser session before binding its normal JWT to requests. Capture actor-scoped 27-table zero snapshots before product bootstrap; after bootstrap, assert only the explicitly expected minimal identity/profile rows for each actor.
3. In the protected deployed UI, actor A opens only the pinned published Reader item. Verify server-returned sentence order and complete translations match the manifest. Reveal a reviewed sentence meaning through the existing sentence interaction. The reveal itself is local presentation only: assert it does not save a concept, submit a Reader exposure, create learning evidence, or imply FSRS activation.
4. Explicitly save one reviewed concept using the existing concept-save/Learn intent, distinct from article and sentence bookmarks. Verify the server-confirmed saved state and only the effects defined by the existing contract. If replay is tested, repeat the exact supported request/key and require its documented replay result without duplicate lineage/evidence. Reopen or reread the item and prove that a read/reveal alone does not add exposure or evidence. Offer Review as a user-clicked destination described as checking what is due; do not assert the newly saved concept is immediately due.
5. Separately exercise the final segment's existing explicit Reader completion control after the published response is inspected; do not automate a claimed full 72-sentence human reading journey. Require the server-confirmed `isCompleted` progress response before showing the Today link; that link is user-clicked and returns to the server-selected Today plan. Completion is two distinct commands: Reader progress and an eligible segment `read` exposure source fact. That exposure derives at most one canonical passive event per distinct server-resolved eligible concept in that segment. It may change an unseen concept to discovered. Assert no competence score/confidence/mastery, FSRS state, review scheduling, or active-learning evidence changes. Replay of the same logical completion must reuse its idempotency keys and not duplicate progress, exposure, or passive events. Do not mark completion on mount, infer it client-side, or reorder activities.
6. Sign out actor A and authenticate actor B in a clean isolated browser context. Verify A's saved state, revealed content state, and Today/Review responses do not leak to B. Verify B's initial actor snapshot remains free of A's rows and B receives only its own authoritative Reader/saved state. No cross-actor mutation or review answer is needed.

The scenario must capture only allowlisted phase names, statuses, counts, and hashes. Never retain access tokens, passwords, raw translations/rows, emails, Auth UUIDs, or browser storage. Any IDs needed to bind a request stay transient in process memory.

## Cleanup and success conditions

Use a `finally` finalizer and the workflow's unconditional current-run recovery job. Clear browser cookies/storage, sign out both clients, and delete only exact run-marked Auth actors after rechecking their server-owned marker and reserved identity. Confirm Auth absence independently and zero rows across all 27 learner tables for each deleted actor. Then take a fresh global retained-state snapshot and require exact equality with the pre-actor baseline. Any failed deletion, absent proof, unaccounted actor row or learner-state effect beyond the explicit completion/save assertions, cross-actor response, or retained mismatch fails the run; the TTL janitor may recover only strictly marked expired actors and must not absorb unmarked accounts.

Success requires all of the following: exact source/deployment attestation; the separate before/after-publication zero-delta gate; content manifest match; expected actor bootstrap only; normal-JWT browser Reader and Today flow; correct save/review semantics; actor isolation; Auth deletion and per-actor zero across all 27 tables; retained-state equality; and successful cleanup/recovery status. A deployment health check, catalog check, mocked test, or background automation alone is not hosted Reader acceptance or real learner evidence.

## Review and promotion gates

Before implementation, obtain independent GPT-6 Luna / Max security review of this plan and the workflow/runner authorization boundary. After implementation, require focused synthetic-actor regressions, type/lint and contract checks for the changed files, independent source review with no HIGH/BLOCKER findings, and exact-head required CI/Preview checks before root-controlled normal merge. Hosted acceptance runs only after the code and content publication are separately approved and deployed. No gate here authorizes production publication or changes to K2/V2 acceptance.

## Source references

- [Protected K2 workflow](../.github/workflows/k2-hosted-acceptance.yml)
- [K2 actor lifecycle and cleanup](../tests/acceptance/support/k2_hosted_actors.ts)
- [K2 retained-state and actor probe](../tests/acceptance/support/k2_hosted_probe.py)
- [K2 shared runner lifecycle](../tests/acceptance/support/k2_hosted_runner.ts)
- [Normal-JWT browser routing](../tests/acceptance/support/k2_playwright_network.ts)
- [Owner Admin publication evidence and limitations](../reviews/K2-08-owner-publication-runtime-evidence.md)
- [Approved Reader candidate and bounded guidance plan](PILOT-READER-COMPREHENSION-FOLLOWUP.md)
- [Reader save/evidence boundaries](../docs/READER_CONTENT_MVP_V1.md)
