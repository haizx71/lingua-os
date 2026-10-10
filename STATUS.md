# LINGUA OS — Project Status

## Reader pilot follow-up — 2026-10-10

**Auth-erasure remediation checkpoint — 2026-10-11:** Independent Max review PASSed the exact final 26-file source snapshot (packet SHA-256 `5bdc888ce1b5daa102f8dd87ba50974c54b7e6530848e94074d258c7acde8835`, aggregate `fba4a30f502aa9a063a8a98247097f97314c971cc63d72ac050c20f8a311628d`) with no HIGH/BLOCKER; the preceding 24 runtime paths are unchanged from aggregate `17efcbd3da7be80d66b4873cee213563169a19437dee72758b74f139a94048fd` ([source review](reviews/PILOT-READER-AUTH-ERASURE-SOURCE-REVIEW.md)). PR69 exact-head CI passed 9/9 at `5d0e4a6` and merged at `47b88d7`. Root reports migration-only apply through reviewed wrapper v2 `c99245596371c1bb452b3b3e58036e52251986f2ae52dd3c28dc196c7adc87bd` succeeded. Sanitized apply evidence (`C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-reader-0022-hosted-apply-evidence.json`, SHA-256 `122c640afe70d32ee7f7ee853cbf5fc7f38ac3b1bfd274dc33aea2133ff16afb`) records correct application checksum, actual platform entry `20261010174303 / reader_history_auth_erasure_0022`, unchanged prior 21 application and 14 platform entries, unchanged function identity/owner/ACL/invoker/three bindings, and equal global 27-table pre/post snapshots. No actor mutation occurred. Independent Max review of the apply evidence and one-file actual-platform pin PASSed with 0 HIGH/BLOCKER (review SHA-256 `d12c0f4ffe5fe276a41de0663abbf4f9e3c48c47735527f8561313e9ef890031`; [review record](reviews/PILOT-READER-AUTH-ERASURE-SOURCE-REVIEW.md)). Pin packet v3 SHA-256 `7837b7e61d3cf2b52bff6d701bf97b6703df45e367dc19172354e3f4af08285a`, aggregate `cd2c5d92c6d234a9f2d4b6e655699664629493030a8d15d15072e70acbfd4a8e`; its only source delta is the probe constant/comment. The existing 71 probe tests and focused Ruff passed; full-probe Ruff is not claimed because 33 pre-existing findings are unchanged. Exact-head CI for the pin remains pending. Recovery remains fail-closed until those gates pass. The original run `38044569136` remains FAIL with its exact marked actor unresolved; no recovery, new actor, or new acceptance occurred. Zero-27 was not proven for the failed run because cleanup failed; original-run retained equality is unavailable because its baseline was missing.

**BLOCKED / HOLD — hosted PILOT-READER acceptance failed on 2026-10-10.** The owner approved the exact 72-pair first-party Vietnamese candidate (SHA-256 `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`, four disclosed English corrections, editorial/rights and staging-only scope) and the bounded PILOT-004 P2 next-action guidance exception. Exact execution fields are pinned in the [publication manifest](knowledge/staging/pilot-reader-vi-draft/publication-manifest.json) (SHA-256 `724014360eb401de10d2e72c897834b4e177f32a131a6a7ca331d3aa03135200`). The owner also authorized the narrow PILOT-005 P2 explicit-selection slice on 2026-10-10 after a specific scope request. Its isolated nine-file implementation patch reports 76/76 focused tests, typecheck, focused lint, diff check, and Next.js 15.5.24 build PASS; independent Max source review PASS (SHA-256 `5f961d5dc8774a1bd2774fed89946bfed0f317c1ac9a307f3ada047014561ea1`; [review record](reviews/PILOT-READER-EXPLICIT-SELECTION-SOURCE-REVIEW.md)). Exact-head CI/Preview and normal merge passed; disposable hosted acceptance failed as recorded below. See external packet `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-explicit-selection-implementation.md`. The [Admin contract review](reviews/PILOT-ADMIN-TRANSLATION-CONTRACT-REVIEW.md), [Admin implementation source review](reviews/PILOT-ADMIN-TRANSLATION-SOURCE-REVIEW.md) (no open findings), [Reader guidance source review](reviews/PILOT-READER-GUIDANCE-SOURCE-REVIEW.md), and [publication snapshot SQL review](reviews/PILOT-READER-PUBLICATION-SNAPSHOT-REVIEW.md) (local 27/27 only) passed. Admin tests pass (21 PostgreSQL, 36 OpenAPI, 12 frontend), type/lint/Ruff/mypy pass. Current integrated Reader/Admin regression passes 88/88 across selection, Admin-form, and Admin-content suites; workspace typecheck, generated-contract checks, focused lint, and production build pass (root integration-verification packet SHA-256 `45d7a21d205f0b062320117754b330d81f4c28dae33175045eed71e9b2d6476a`). For the hosted harness, the original HIGH findings were addressed in the stable 17-file packet (aggregate `7d3a8a45a2ac7a538ad181cef1b4c9c094648ab1065e82e5cd97b8c27da49f06`), whose independent Max source review PASSed (SHA-256 `80dc02f4fcf5e1ebcb1fdc61972735e81bf48f454dd30c88c4de91ebab8fc906`; [review record](reviews/PILOT-READER-HOSTED-HARNESS-SOURCE-REVIEW.md)). The final 18-file adaptation is frozen and root-imported; all 18 raw-file hashes match aggregate `8efbb8d7ac77122d54d1495a2d5cb42e93a88a35e3c4eca2c12227dda1a6134c`, and the requested-route source pin is `5e9a34a9751d5a6578fbe9e8ac2739d9e5b1b2c42af0b83d4a6a35e2206c0e66`. Independent GPT-6 Luna / Max review PASS (SHA-256 `c960a3e11f9c2223c0187bcc96b6a26bfeecca8d0af9bc8b82ad5da382394580`), with 38 passed, 1 optional skip, TypeScript and focused lint PASS, and no HIGH/BLOCKER. PR68 exact-head CI and merge, production deployment, and normal Admin publication are complete; disposable-actor acceptance is a separate gate and failed as summarized below. Ruff findings in the focused helper files were classified as 12 pre-existing `origin/master` findings; no full Ruff PASS is claimed. Hosted run `38044569136` on master `c76d72d7cfc67f5060d233f68df971fc338ab0ff` completed FAIL. Its cleanup job failed Auth deletion; strict marker count confirms one same-run Auth actor remains. Three provider errors matched the static `READER_FACT_GUARD` category (`SQLSTATE 23514`); the primary lifecycle result is UNKNOWN because the finalizer masked it. The hosted zero-27 comparison and post-cleanup retained comparison are NOT PROVEN. The earlier hosted publication pre/post 27-table equality is a separate PASS and remains valid. Owner approved the exact bounded exception to the 0021 freeze on 2026-10-10. The technical plan body was independently reviewed at SHA-256 `2fda76146f80d8b20ed72af64f3839491e9fc7d59c394275b08c2406f6fbc04c` with PASS / 0 HIGH/BLOCKER (review SHA-256 `b200291503013806c7655f0d2fcf48bc3454a9d97db288e27dccd2ef6d7896a2`); the focused local test passed 1 test in 9.88s. PR69 plan/test exact-head CI passed 9/9 checks at `799940b`; runtime CI passed 9/9 at `5d0e4a6`; the separate platform-pin source review and exact-head CI remain pending. Authorization covers function-only 0022 implementation, separate Max SQL/source review, exact-head CI, normal root merge and staging apply, followed by strict recovery of the marked actor using a fresh pre/post 27-table retained comparison, Auth absence and zero rows across all 27 learner tables; a new Reader acceptance may follow only after those proofs pass. The 26-file source snapshot has independent PASS; migration-only 0022 apply passed as recorded above. The platform source pin and recovery remain under review; no actor cleanup or new acceptance occurred. The existing hosted run remains failed and the marked actor remains; zero-residue and recovery retained proofs are not yet established. K2 waves stay frozen; no Auth/RLS/grant/role or FSRS changes are authorized, and no further owner permission is needed within this exact scope. No additional actor may be created before the authorized recovery proofs pass. The narrow 0022 exception does not reopen K2. No real learner action or learning benefit is claimed. See sanitized external diagnostic `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-hosted-failure-diagnostic.json` (SHA-256 `26ac066fde654469bc4785b0df1b860849dcccd3393e082518da5d25ee42e51d`). Existing presentation release remains DONE.

## Owner-approved full web presentation — 2026-10-09

**DONE — presentation released, 2026-10-10 Asia/Saigon.** PR #66 passed independent Luna Max frozen-source review, all exact-head CI jobs and Vercel Preview, then merged normally at `2058a089529423343f7aae971bd43e1411359539`. Vercel Production `dpl_CbvghXA3Pgrm88JsMCCbnah1X7fP` is READY at that SHA with the canonical website alias assigned. Frontend regression passed 633/633 tests, additional Reader resume assertions passed 12/12, and workspace typecheck/generated contracts, lint, build and local browser QA passed. See [release evidence](reviews/PILOT-FULL-WEB-RELEASE.md) and [the bounded plan](plans/PILOT-FULL-WEB-DESIGN.md). Knowledge V2, migration `0021`, Auth/RLS, domain hooks and learner-state semantics remain frozen. Profile/Progress defaults show honest unavailable states; Reader reveals only supplied translation, so missing published translations remain PILOT-003. This release does not claim a hosted learner journey or improved learning outcomes.

Version: 4.0 starter
Phase: FRLL accepted/frozen; K2-06 staging accepted; K2-07 hosted PASS; K2-08 full hosted acceptance, cleanup, fresh retained comparison, and independent final review PASS; K2-09 full hosted acceptance, cleanup, fresh retained comparison, and independent final review PASS; K2-10 DONE; real learner pilot kickoff 2026-10-09 (two owner-reported P2 signals; PILOT-002 mechanism reproduced and bounded source implementation locally verified; live production cause unknown)

## Current Knowledge V2 checkpoint — 2026-10-09

- **K2-08 remains DONE.** Full hosted acceptance, cleanup, fresh 27-table retained comparison, and independent final review remain PASS as recorded in the historical checkpoint below and `reviews/K2-08-auth-cleanup-boundary-review.md`.
- **K2-09 DONE: full hosted acceptance, cleanup, fresh retained comparison, and independent final review PASS.** PR #45 merged at `cd062c750257a8656ba691eaf57723bc13e6012d`; its head passed all Security and Knowledge Audit jobs and Vercel Preview. Render is live/healthy and Vercel Production succeeded at the merged SHA. Migration `0021` was already applied and verified; it was not reapplied. Full run `37685182215` on merged master passed with successful main job `113011062961`, recovery job `113016493879`, and overall workflow status SUCCESS. The fresh baseline and actor/fresh identity/wave/replay/cleanup/finalizer sequence passed; the current-run 27-table retained comparison passed. Independent GPT-6 Luna / Max final review verified workflow jobs, phase artifact hashes, and source assertions with no HIGH/BLOCKER. See the source/migration review for exact evidence and hashes.
- **Earlier hosted attempt `37681286589`: historical FAIL before actor creation.** It stopped at fixture inspect with HTTP 503, and its recovery job also failed. This is superseded by the successful later run; no evidence from that failure is presented as the successful run’s cleanup or retained comparison.
- **K2-10: DONE.** Two consecutive full owner-dispatched runs `37863647590` and `37866643904` passed on master SHA `754821ec4c6c0c13ed1a14c526e0856c3a3aabc3`; all final read-only gates and the independent evidence review passed. No schema feature or migration is in scope. See `reviews/K2-10-verification-seal.md` for the evidence ledger.

## Real learner pilot and V2 freeze — 2026-10-09

- **Pilot active, day 0 of a 7–14 day window.** Kickoff is 2026-10-09 (Asia/Saigon); day 7 review is 2026-10-16 and day 14 review is 2026-10-23. PILOT-001 remains a separately owner-authorized P2 timezone-step exception, locally verified in an isolated mocked-actor regression; its live signup outcome remains UNKNOWN. PILOT-002 is a second owner-authorized P2 exception after independent Max plan review. The owner reports learning becomes available after about 30 seconds, including on immediate reopen; exact duration and production cause are unmeasured. Three pre-fix isolated synthetic runs reproduced a conditional readiness block, not hosted incidence or a live P1. The PILOT-002 bounded implementation is locally verified by seven frontend suites (122/122 tests), workspace typecheck, and focused lint; independent GPT-6 Luna / Max source review PASS ([review record](reviews/PILOT-002-profile-readiness-source-review.md)); exact-head CI/Preview and normal promotion remain required. No learning-quality observation is verified. Background health and prior synthetic acceptance are not journey evidence.
- **V2 remains frozen.** K2-06 through K2-10 stay accepted; migration head `0021` and checksum `3c984a59afe9031ee5480a4fa111d5fb239b5f7164af39289712f1e98ad45ca6` remain unchanged. Reopen K2 only for a reproducible real defect, not for P2 friction. PILOT-001 is a separate, owner-authorized P2 frontend onboarding exception within TASK-017; PILOT-002 is a separately owner-authorized P2 profile-readiness exception, approved on 2026-10-09 after independent Max plan review. Each exception is limited to its reviewed scope; neither reopens or changes accepted K2 work or evidence. PILOT-002 local verification passes seven frontend suites (122/122 tests), workspace typecheck, and focused lint; independent GPT-6 Luna / Max source review PASS ([review record](reviews/PILOT-002-profile-readiness-source-review.md)); exact-head CI/Preview and normal promotion remain required. These are the only current P2 exceptions; the general P0/P1 runtime policy is unchanged. Hosted actor checks are conditional on changed risk/surface; if actors are created, full Auth deletion, zero residue across 27 learner tables, and retained comparison are mandatory.
- See [pilot findings](PILOT_FINDINGS.md), [separate hardening follow-ups](PILOT_HARDENING.md), [PILOT-002 bounded plan review](reviews/PILOT-002-profile-readiness-plan-review.md), [PILOT-002 source review](reviews/PILOT-002-profile-readiness-source-review.md), and the [pilot and freeze plan](plans/REAL-LEARNER-PILOT-V2-FREEZE.md).

## Historical Knowledge V2 checkpoint — 2026-10-02

- **K2-08 FINAL SOURCE / CI / DEPLOYMENT: PASS.** PR #41 head `43d3500fe4437009a3b13b6ec275e0fc54fb6d41`, four-file diff SHA256 `73e9e560da73015f9523e95466cada4b07f0e868c6e14846cc431d1ef87d5c64`, and independent GPT-6 Luna / Max review PASS with no HIGH/BLOCKER. Exact-head Security Gate `36940358882` and Vercel Preview passed; normal merge produced master `dc3fab04f56abdcfbdfd164991fc248a2665098c`. Render `dep-davenh0473hc73f2goi0` and `/health`, plus Vercel Production deployment `6797487205`, attest the same SHA.
- **OWNER ADMIN / STAGING PUBLICATION: PASS.** The owner-authorized staging account created the three exact DTOs through normal Admin (HTTP 201), validated all three with zero issues, then published all three through normal Admin (HTTP 200). See `reviews/K2-08-owner-publication-runtime-evidence.md`.
- **ACTORLESS CATALOG / PUBLICATION RETAINED COMPARISON: PASS.** Exactly the three reviewed A1/A2/B1 items are eligible, each five minutes with 4/3/3 concepts; publication gates and sentence/annotation aggregates pass. The 27-table pre/post-publication counts and hashes match. This is distinct from hosted-run cleanup-window proof.
- **K2-08 HOSTED RUN 36932709277 ATTEMPT 1: HISTORICAL FAIL AT CLEANUP.** Its fixture, Today generation and replay, cross-actor, and wave assertions passed, then cleanup failed because the Auth caller could not see `today_plan_activities`; the run hit its 12-minute timeout. It has no finalizer completion markers or full-run retained comparison and remains failed. Its later cleanup-window recovery evidence below is historical and does not substitute for the successful new run.
- **K2-08 NEW FULL HOSTED ACCEPTANCE: PASS.** Workflow `36940909998` completed successfully in master acceptance mode. Hosted job `110631923274` and cleanup job `110637771202` both succeeded. Ordered markers: fresh baseline began 23:29:28 UTC and passed 23:30:07; first actor followed at 23:30:07; wave passed 23:42:50; actor cleanup passed 23:45:23; fresh-identity cleanup passed 23:47:43; retained comparison and finalizer completion passed 23:48:22. The new run’s full retained comparison passed. Separate GPT-6 Luna / Max final review checked ordered markers, exact `actor_absent` chain, 27-table inventory, and fail-closed finalizer proof; no HIGH/BLOCKER. Commander’s terminal hashed-roster proof found zero of the four selected disposable Auth records and zero rows owned by those actors across 27 learner tables.
- **RETAINED-STATE SCOPE.** The current 27-table retained snapshot is 83 rows / 72,325 bytes and stable after cleanup. The older cleanup-window comparison was 61 rows / 51,535 bytes across a different interval. Its 15 changed tables reflect persisted changes timestamped no later than 23:18:03 UTC, before this run’s 23:27:30 dispatch; none correspond to persisted changes at or after dispatch. No learner data was changed to force the old baseline to match. The current full-run comparison is the accepted result.
- **K2-09 SOURCE / CI / DEPLOYMENT: PASS.** PR #43 merged normally to master at `7bc877b85bf643af21498da0ba44e2c157e0ae03` (2026-10-02 13:37:37 UTC). Its exact tested head was `29da9f8b7f96a3d2ca8c8c3de4fd02b51d6dde65`; the frozen 16-file product diff SHA256 remains `e03a501398cd4c89495c576844afb3935c9e5aa43a7490372014aa5068f245e5`. Independent GPT-6 Luna / Max source review passed with no HIGH/BLOCKER. Security Gate `37013641196` and all six Knowledge Audit jobs in run `37013641469` passed on the exact tested head. CI summaries: Dictionary PostgreSQL 48 passed; Grammar PostgreSQL 62; Today PostgreSQL 40; retrievability PostgreSQL 382 passed / 1 deselected; knowledge-audit 57 tests; frontend regression stages 9 and 102 tests passed. Security-gate step summaries: hosted-harness unit/workflow security 191 passed across 10 files, read-only hosted-probe 25 passed, and browser OIDC redirect check 1 passed. Vercel Preview `6809598033` passed; Render `dep-davr78rm8hqs73ccnee0` is live with `/health` status OK; Vercel Production deployment `6809699550` succeeded, both against merged SHA `7bc877b85bf643af21498da0ba44e2c157e0ae03`. Implementation-worker local reports (66 backend/Brain/OpenAPI, 102 UI, 14 importer checks) are separate from CI counts. Query-plan performance remains unmeasured; non-English requests remain rejected as before.
- **K2-09 HOSTED FIXTURE DESIGN / PRIVATE DTO: REVIEW PASS; LOCAL IMPLEMENTATION AUTHORIZED.** Architecture review and final private DTO/spec review by GPT-6 Luna / Max passed without HIGH/BLOCKER. The exact reviewed plan, guard, and frozen diff hashes are recorded in `reviews/K2-09-hosted-fixture-architecture-review.md`. Commander authorizes bounded local implementation and tests after the documentation writer lock is released. Fixture source review, CI, private migration/security gates, and hosted acceptance remain pending; no hosted fixture writes are authorized. No product migration/index was added; query-plan performance is unmeasured. The production importer remains unchanged with its one-candidate/one-sense limitation.
- **GATE / OWNERSHIP.** K2-08 hosted acceptance, cleanup, current-run retained comparison, and independent final review remain PASS as recorded above. K2-09 source, independent source review, exact-head CI, and deployment are PASS; hosted fixture setup/cleanup, migration/security gate, and full hosted acceptance remain pending. K2-10 remains blocked on K2-09. Migration `0020` and accepted K2-06/K2-07 behavior remain unchanged. Hosted operator: Commander; implementation and reviewers: GPT-6 Luna / Max; documentation worker: GPT-6 Luna / Medium. See the K2-08 and K2-09 review records linked above.

## Historical Knowledge V2 checkpoint — 2026-10-01

The following checkpoint preserves earlier evidence; the current checkpoint above supersedes its catalog blocker and latest-baseline statements.

- The verified source-of-truth `master` snapshot for this checkpoint is
  `1ac2060e37479b9387db75f8101bb59a492aebca` (PR #35 normal merge). The accepted K2-07 hosted runtime
  evidence was recorded against `c696ac935852c4ebcd9e1183521996e5b12ad273`;
  that remains valid acceptance evidence and is not identified here as the latest
  `master` baseline. Earlier K2-04/K2-05/K2-06 source and migrations through `0019`
  are represented in the verified base.
- **K2-08 REVISED FIXTURE SOURCE/CI: PASS; PR #35 MERGED.**
  Independent configured GPT-6 Luna / Max review passed on
  `64bbd4df71ce9483290b5d86562ef5722d3ceddd`, with no remaining HIGH/BLOCKER.
  The four-actor harness separates normal authenticated learner requests from
  fixed runner-private setup, bounded inspection and cleanup. No Auth grants,
  roles, policies or RLS changes were introduced. Today GET and completion
  responses must match the privately bound actor profile before ID projection.
  Exact PR head `3501c87d61224d551681b0e0603e20490f8a3ea5` passed
  [Knowledge Audit CI 36853391143](https://github.com/haizx71/lingua-os/actions/runs/36853391143)
  (Today PostgreSQL 40 passed; broader PostgreSQL 379 passed, 1 deselected;
  grammar, knowledge and frontend jobs passed) and
  [Security Gate 36853391160](https://github.com/haizx71/lingua-os/actions/runs/36853391160)
  (173 harness tests, 25 probe tests, real-browser redirect and type checks).
  Separate configured GPT-6 Luna / Max review verified the source and CI gate.
  See `reviews/K2-08-fixture-boundary-design-review.md`.
- **K2-08 STAGING MIGRATION: PASS THROUGH 0020.** The reviewed guarded registry
  reconciliation corrected only historical 0013 checksum metadata and adopted
  already-applied 0018/0019 without rerunning their SQL. All 20 application
  migration names/checksums match source. The platform tail is 0019, the existing
  reader role, then `today_remediation_reason_codes_0020`. Migration 0020 adds
  only the product reason-code CHECK values. No Auth grants, policies, roles,
  secrets or learner-row DML changed; Today counts remained 12 plans/11 activities.
  Render `/health` is OK at `1ac2060`; GitHub records Vercel Production deployment
  `6782936894` as successful at the same SHA. Protected runtime acceptance remains separate.
- **K2-08 PRIOR PRODUCT SOURCE/CI: PASS AT OLD DRAFT HEAD.** The reviewed source
  snapshot is `ecb830418e81cc60e573fe91acf7382563ac0568`, based on
  `2c3284a2deb4fac18683b660a751039e36b007f7`. Exact-head Knowledge Audit CI
  [36795488328](https://github.com/haizx71/lingua-os/actions/runs/36795488328)
  and Security Gate
  [36795488330](https://github.com/haizx71/lingua-os/actions/runs/36795488330)
  passed; independent GPT-6 Luna / Max source review passed with no HIGH/BLOCKER
  findings. This is draft-branch source and credential-free CI evidence; it does
  not by itself establish a merge; the later merge to `master` is recorded above. Documentation/preparation was
  recorded by GPT-6 Luna / Medium in `reviews/K2-08-source-ci-review.md`.
- **K2-08 FULL HOSTED/LIVE PHASE C: BLOCKED.** Pending reviewed and published
  eligible content and the full automated actor cycle. A fresh catalog aggregate
  still reports zero eligible published English Reader items. The accepted privilege-split architecture
  replaces the old unapproved Auth/RLS proposal. The due-only source subcase is not full hosted proof and cannot
  establish overall K2-08 acceptance. Migration `0020` is applied as recorded above. K2-09/10
  remain locked. Full workflow [36856076010](https://github.com/haizx71/lingua-os/actions/runs/36856076010)
  on master `1ac2060` passed SHA/deployment/OIDC/protected-origin/API/migration,
  fixture privilege and empty-HEAD preflights, then failed closed at
  `preflight_k208_catalog` before retained baseline or actor creation.
  Current-run cleanup job `110349561035` passed. No actor cycle, wave assertions
  or retained comparison occurred; the full hosted gate is not PASS.
  The historical fixture Auth/RLS proposal remains **NO-GO**:
  the bounded review found the proposed non-owner function role cannot read
  server-owned Auth metadata under the current default-deny policy. No managed
  Auth policy change or alternate signing capability is authorized. See
  `reviews/K2-08-fixture-auth-rls-review.md` and
  `reviews/K2-08-source-ci-review.md` for the security blocker, exact-head checks,
  counts, limitations, the candidate article [commit](https://github.com/haizx71/lingua-os/commit/5bfb9362e2b534b526260d089a42c4edd44c36a4),
  and the NOT AUTHORIZED fixture capability [proposal](https://github.com/haizx71/lingua-os/commit/60b01e2a637b50117a5df2cd5b316654b310661b).
- **K2-07 HOSTED ACCEPTANCE: PASS.** Workflow run [36780407824](https://github.com/haizx71/lingua-os/actions/runs/36780407824)
  (`workflow_dispatch`, `master`, attempt 1) completed successfully on that exact master SHA. Hosted job `110108944244`
  passed (one acceptance test, 12 minutes); separate current-run cleanup job
  `110113728287` passed (43 seconds). Independent GPT-6 Luna / Max verification
  confirmed the allowlisted gate markers in order through preflights, retained
  baseline, both disposable actors/auth/profiles, `wave_k2_07`, self-recall and
  typing assertions, replay, cross-actor isolation, finalizer actor cleanup,
  fresh-identity cleanup, retained comparison, and `finalizer_complete`.
  The comparison result is PASS; no actor identifiers or learner data are recorded.
  This staging catalog exercised self-recall and typing only. Listening and
  cloze remain untested because eligible published material is unavailable; this
  run does not establish those modalities. K2-07 is closed for its bounded hosted
  acceptance scope. K2-08 source/CI is merged through PR #35, while its full
  hosted gate remains BLOCKED. See `reviews/K2-07-hosted-acceptance-review.md`,
  `reviews/K2-08-source-ci-review.md`, and the detailed run history below.
- **K2-06 STAGING: PASS.** A new disposable actor was bound to the authenticated
  browser session before acceptance. One Review answer updated production only;
  exact replay made no second state/event change. Brain and Review projected a
  synthetic actor-only `active`→`forgotten` decay without read-time writes.
  After guarded Auth cleanup, zero disposable rows remained across 13 Auth and
  27 public learner tables, and all 27 retained learner-table snapshots matched
  the pre-run baseline. Independent read-only review found no K2-06 blocker.
  The synthetic fixture does not establish natural API progression to `active`.
  See `plans/TASK-K2-06-tripartite-dynamic-state.md`.
- **K2-07 SOURCE PROMOTED: PASS; HOSTED ACCEPTANCE: PASS.** PR #19 merged
  into `master` at `ac02c349f8500975a843633556daf9d1bebc49e8` after the
  caller-supplied `correct` HIGH finding was fixed and independently verified.
  All four GitHub Actions jobs and Vercel Preview passed at PR head `c97f3e0`.
  A medium UTF-16 cloze-offset issue remains a documented follow-up; no schema
  migration was added. See `plans/TASK-K2-07-review-modality-engine.md`.
- Post-merge read-only state: Supabase staging migration head is
  `20260927034218` (`0019`). Render `lingua-api-staging` deployment
  `dep-dasj8v49v7es73f2q7bg` is live from `ac02c34` and `/health` returned
  200. GitHub's Vercel Production deployment record for `ac02c34` reports
  success; direct Vercel connector lookup was unavailable. No Share link or
  protection setting changed. K2-07 hosted acceptance remains complete; the
  current K2-08 source and hosted gates are recorded above. K2-09/10 remain locked.
- **K2-07 HOSTED HARNESS: SOURCE READY; HOSTED ACCEPTANCE PASS.** Independent security review passed.
  The isolated
  `codex/k2-hosted-acceptance-harness` work adds a shared wave lifecycle, a K2-07 fixture plugin,
  two server-marked disposable actors, real browser OIDC redirect protection, Auth-cascade cleanup,
  complete retained-state comparison, and a TTL-only janitor. Fresh create results stay in memory
  for finalizer retry; separate recovery handles exact same-run unmarked partial creates only within
  a 24-hour age bound and rechecks UUID/email/timestamp/absence of marker before deletion. Render source SHA is read from its
  platform `RENDER_GIT_COMMIT` only when `RENDER_SERVICE_NAME=lingua-api-staging`; `/health` and
  each API response expose it for exact SHA checks. It is an operational attestation, not product
  authorization. The optional response header is documented in the OpenAPI description; `/health`
  remains intentionally excluded from the public OpenAPI paths.
- All six repository-level staging secret names are configured, including
  `K2_STAGING_API_ORIGIN`,
  `K2_STAGING_SUPABASE_URL`, `K2_STAGING_SUPABASE_PROJECT_REF`,
  `K2_STAGING_SUPABASE_PUBLISHABLE_KEY`, `K2_STAGING_SUPABASE_SECRET_KEY`, and
  `K2_STAGING_READONLY_DATABASE_URL`; no secret values were inspected. A dedicated
  `k2_hosted_acceptance_reader` staging role and its repository secret are configured.
  The DB-only GitHub preflight run `36593505143` passed at harness commit
  `3af469084b8106557dcca877572338040a8dc804`; this proves the read-only database
  connection gate only. A later full disposable-actor acceptance passed as
  recorded above. Repository
  secrets do not require a GitHub plan upgrade, but any workflow in this repository that requests
  them can read them. This design therefore assumes `haizx71` is the only trusted writer/merger of
  workflow changes; review every workflow change and do not grant untrusted collaborators write
  access. The credential-free security gate is a separate PR-only workflow, while the secret-bearing
  K2 workflow has only dispatch/schedule triggers and requires both actor identities to be
  `haizx71` for manual acceptance.
- Owner-confirmed on 2026-09-30: the Vercel Trusted Source rule uses issuer
  `https://token.actions.githubusercontent.com`, repository `haizx71/lingua-os`, workflow
  display name `K2 Hosted Acceptance`, branch `master`, audience `https://vercel.com`,
  and target `Production` only. The guided Vercel UI does not expose `event_name` or
  `workflow_ref`; those exact event/ref/workflow checks, along with repository and owner
  checks, remain enforced by GitHub Actions workflow/preflight guards. Vercel is not claimed
  to enforce the event. The immutable Vercel Production origin is derived from the successful deployment
  status for the current SHA and checked through the protection challenge; no per-deployment URL
  secret or Share link is used. A no-secret preflight compares the dispatch SHA with live master
  before secrets are mapped, and the runner repeats that check before actor creation. Cleanup remains
  eligible after a started acceptance failure even if master advances. Protected Vercel access
  passed in hosted run `36747649793` on `master` at
  `fdb4036e436e8b82b9fb67b1358413a2a5b31367`; the run then failed the separate application
  migration-head gate before actor creation. Its current-run cleanup passed in 45 seconds. No
  retained baseline or learner comparison gate was reached in that run; see the later run below. Staging
  currently supports self-recall and typing only; listening and cloze remain untested because no
  HTTPS audio or published aligned target is present.
- Run `36734233167` (`workflow_dispatch` on `master` at `477663743d438364f34fb34f9712cfcf82d47949`)
  failed at the protected Vercel check before any disposable actor was created. Its separate
  current-run-cleanup job `109952362357` passed. The retained baseline/learner comparison gate
  was not reached; this is not a learner-state acceptance result. No disposable-actor preflight
  has run. The subsequent protected-access diagnostic change is PR #28, independently reviewed
  at combined HEAD `459bb45813a8dfae9c1c04c7333ce1325877af65` with PASS and no HIGH/BLOCKER
  findings; its security gate passed. PR #28 merged to current `master` at
  `10a00b6c009e83301ba0d4cea4f32cf5714e89a5`. Exact-SHA GitHub Production deployment
  `6763405633` by `vercel[bot]` has status `success`.
- Hosted run `36737740694` on master SHA
  `10a00b6c009e83301ba0d4cea4f32cf5714e89a5` failed the protected-origin check
  `verifyProtectedVercelOrigin`; the guard stopped before actor creation. Its separate cleanup
  job `109964874290` passed in 41 seconds. No retained baseline or learner comparison was
  reached. The later run and migration-registry diagnosis are recorded below. PR #24 TLS
  certificate/role proof and PRs #25/#26/#27 narrow OIDC hostname fixes are merged.
- The Supabase migration ledger separately reports migration `0019` and the dedicated
  `k2_hosted_acceptance_reader` role is configured. This ledger state does not establish the
  application migration registry gate. In run `36747649793`, `public.schema_migrations` held
  application entries `0001`–`0017`; the Python probe reported application head `0017` and 17
  applied migrations, while the TypeScript adapter incorrectly treated the application as head
  `0019` with 19 applied migrations. The Supabase ledger still requires `0019` plus the custom
  read-only role, confirmed separately. Keep these registries distinct. This mismatch blocked
  run `36747649793`; the later run `36751277032` passed migration verification. The reader role
  has broad read visibility and must remain
  confined to the owner-gated staging workflow step. The exact application migration-head gate
  remains mandatory before acceptance baseline/actor creation;
  cleanup-only paths attempt guarded Auth deletion first and fail afterward if the
  schema-dependent zero-residue proof cannot establish the complete inventory.
- Hosted run `36751277032` on master SHA `e01cc21624bda37f59c982498686a6a709ca2264` passed
  protected-origin access, API health, migration verification, the runner recheck, and browser
  authentication. It created and authenticated two disposable actors, then failed with HTTP 409
  `INVALID_STATE_TRANSITION` on the first primary actor `POST /v1/me/languages` (expected 201).
  The learner profile still had a null timezone: the harness omitted the required ETag-protected
  `PATCH /v1/me` to persist a valid IANA timezone before language creation, as required by
  ADR-019. This is a harness setup precondition failure; the K2-07 plugin assertions, replay, and
  isolation checks were not reached. The main finalizer completed without overriding the original
  error. Independent source/sanitized-log review found no cleanup, actor-residue, or retained-
  comparison error replacing the 409; the logs did not expose explicit row counts. The separate
  current-run-cleanup job passed in 44 seconds. Do not mark K2-07 hosted acceptance PASS; K2-07
  remains BLOCKED and K2-08 remains locked.
- Hosted run `36755374459` on master SHA `df0947c2ed0dddbedebdcc2652bf83f01b53eff3` passed
  the profile-timezone setup and canonical concept fetch/save, then failed at the post-save
  primary snapshot row-count assertion (`wave`, line 191), before later K2-07 assertions,
  replay, or isolation. The primary snapshot expectations listed zero `user_concept_states` and
  lineage-state rows. Max review traced the conflict to the zero-row `user_concept_states`
  expectation: ADR-022 requires explicit Save/Learn to create one zero-evidence projection row
  marked `has_learning_intent`. The observer-row, Review/FSRS-row, and zero-evidence/mass
  expectations remain correct. Runtime row counts were not logged and are not reported here.
  The main finalizer completed without overriding the original error and reached Auth deletion,
  actor-row absence, and retained-comparison equality by control flow; the separate
  current-run-cleanup job passed in 42 seconds. This is not K2-07 acceptance: K2-07 remains BLOCKED
  and K2-08 remains locked. K2-06's accepted Save/Learn behavior remains unchanged.
- Hosted run `36758861641` on master SHA `5a3920907bb31213d2327995e83107c56d5a8c34` ended
  after the 12-minute test timeout following a long Chromium installation. Its internal test stage
  is UNKNOWN. The verified pre-secret SHA and Chromium checks passed; no protected-origin, API
  health, migration, profile, or wave gate is recorded as passing for this run. Separate current-run
  cleanup job `110044096458` passed. That separate cleanup result does not establish completion of
  the original run's finalizer or retained-baseline comparison. No K2-07 hosted acceptance PASS is
  established; K2-07 remains BLOCKED and K2-08 remains locked. No actor identifiers, secret values, or runtime counts are claimed.
- Local source verification passed before hosted run `36755374459`: 61/61 focused
  hosted-harness Vitest tests (including workflow security checks), 6/6 Python probe
  tests, 1/1 real Chromium redirect test, and workspace typecheck. `pnpm backend:check`
  had passed on the prior source snapshot (600 backend tests); this source verification
  did not create hosted actors or change hosted state.
- Documentation update for hosted run `36758861641`: GPT-6 Luna / Medium. The run's internal
  test stage and completion of its main-run retained comparison remain unverified; K2-07 hosted
  acceptance was still blocked at that historical checkpoint. Run `36780407824` subsequently
  passed the complete hosted acceptance and retained comparison, as documented above.
- K2-07 hosted-acceptance documentation and K2-08 readiness update: GPT-6 Luna / Medium.
- Independent K2-07 hosted acceptance verification: GPT-6 Luna / Max; PASS for the complete
  ordered run markers and separate cleanup result. Reviewer checked the run's recorded terminal
  evidence and allowlisted markers; no raw logs, actor identity values, or secret-bearing output
  are reproduced here.
- PR #28 diagnostic implementation: GPT-6 Luna / Max; independent combined-HEAD review:
  GPT-6 Luna / Max, PASS with no HIGH/BLOCKER findings; CI security gate: PASS; documentation
  update: GPT-6 Luna / Medium.

The dated sections below preserve earlier checkpoints; their pending statements
do not override this current result.

## Knowledge V2 K2-02 & K2-03 Integration & Verification — 2026-09-22

Knowledge System V2 Wave K2-02 (Polysemy Resolution) and Wave K2-03 (Knowledge Graph & Concurrency-Safe DAG) have been merged from `origin/agent/k2-03-knowledge-graph` into `master` and fully verified on `haizx71/lingua-os`.

- **Wave K2-02 (Polysemy Resolution)**:
  - Migration `0015_knowledge_v2_polysemy_resolution.up.sql` / `.down.sql`:
    - Tables: `concept_senses`, `sense_glosses`, `sense_examples`, `context_senses`.
    - Relational integrity: Foreign keys to `concepts` / `lexemes`, sense ranking uniqueness, cascade semantics.
    - Security: Browser roles (`anon`, `authenticated`) revoked; service-role only.
    - Service layer: `services/api/src/lingua_api/catalog/sense_service.py`.
    - Tests: `tests/backend/database/test_knowledge_v2_polysemy_schema.py` (5/5 PASS).
- **Wave K2-03 (Knowledge Graph & Concurrency-Safe DAG)**:
  - Migration `0016_knowledge_v2_graph_dag.up.sql` / `.down.sql`:
    - Tables: `concept_edges` with `relation_type` CHECK, partial uniqueness index, and concurrency-safe transactional cycle detection trigger (`check_concept_edge_dag_integrity`) with lock ordering.
    - Graph traversal: Recursive CTE queries in `services/api/src/lingua_api/catalog/graph_service.py` with bounded depth (`MAX_PREREQUISITE_DEPTH = 4`).
    - Tests: `tests/backend/database/test_knowledge_v2_graph_schema.py` (11/11 PASS, including concurrent race conditions).
- **Full Verification Suite**:
  - Code quality: Ruff format PASS, Ruff lint PASS, strict Mypy PASS (126 files, 0 issues).
  - Schema & Bootstrap: `verify_frll_database.py` PASS (16/16 migrations, 63 application tables, 0 learner rows across all 22 learner tables).
  - Backend pytest: **537/537 PASS** against real PostgreSQL 17.11.
  - Frontend TypeScript (`pnpm typecheck`): PASS across all workspaces.
  - Frontend ESLint (`pnpm lint`): PASS (0 errors, 0 warnings).
  - Production build (`pnpm build`): PASS (19 routes compiled).
  - Storybook build (`pnpm build-storybook`): PASS.
  - Frontend Vitest (`pnpm vitest run tests/frontend`): **568/568 PASS**.
  - Acceptance support tests (`tests/acceptance/support`): **143/143 PASS**.
  - Live FRLL acceptance tests against live Supabase Auth & PostgreSQL:
    - Phase B: PASS (1/1)
    - Phase C: PASS (1/1)
    - Phase D: PASS (1/1)
    - Phase E: PASS (1/1)
  - Post-acceptance cleanup verifier: PASS (16/16 migrations, 63 tables, 0 learner rows).
- **Remote Handoff**:
  - Ready for remote staging migration apply (`0015`, `0016`) and deployment verification by LUNA.

Knowledge System V2 Wave K2-01 (Canonical Schema Foundations) has been implemented and fully verified
locally on `haizx71/lingua-os` (branch `master`).

- Migration `0014_knowledge_v2_canonical_structures.up.sql` / `.down.sql`:
  - Introduces `grammar_specifications`, `phrase_specifications`, and `phonetic_transcriptions`
    with foreign keys to canonical `concepts` / `lexemes`, relational constraints, indexes,
    and explicit privilege revocation (`REVOKE ALL PRIVILEGES ... FROM anon, authenticated`).
  - Migration runner verified: apply, rollback, and re-apply cleanly. Checksum:
    `9dee05acb17f002f21dd3465d838953da33f57037ba621b274c69829e3348fd3`.
- SQLAlchemy 2.0 ORM models and Pydantic v2 DTOs:
  - Added to `services/api/src/lingua_api/catalog/models.py` and exported in `lingua_api/catalog/__init__.py`.
- Automated tests:
  - 9 automated tests added in `tests/backend/database/test_knowledge_v2_canonical_schema.py`.
- Verification results:
  - Ruff format: pass. Ruff lint: pass. Strict mypy: pass (123 files, 0 issues).
  - Backend pytest: **521/521 PASS** on real PostgreSQL 17.11.
  - TypeScript (`pnpm typecheck`): PASS across all packages.
  - ESLint (`pnpm lint`): PASS (0 errors, 0 warnings).
  - Next.js build (`pnpm build`): PASS (19 routes compiled).
  - Storybook build (`pnpm build-storybook`): PASS.
  - Frontend Vitest (`pnpm vitest run tests/frontend`): **568/568 PASS**.
  - Acceptance support unit tests: **143/143 PASS**.
  - FRLL live acceptance suites against PostgreSQL + Supabase:
    - Phase B: PASS (1/1)
    - Phase C: PASS (1/1)
    - Phase D: PASS (1/1)
    - Phase E: PASS (1/1)
- Remote execution status:
  - Handed off to remote agent LUNA for remote staging verification (Supabase migration apply, Render deployment, smoke test).

## Staging hardening gate — 2026-09-21

PR #7 (`gemini/knowledge-v2-master-design`) was verified as documentation-only and merged
normally into `master` at `2e531c30d20eb53f04ac4558b64f38b141430785`. The resulting `master`
and `origin/master` are aligned at that SHA and contain the 16 files under
`docs/knowledge-v2/`; no production source, migration, contract or OpenAPI file was changed.

Supabase staging was explicitly targeted at project `lingua-os-staging`
(`bdmtdvvnbicgkfririjo`, ap-southeast-1), not dev or production. Migration `0013` was executed
through the Supabase migration path as `supabase_public_function_default_execute_lockdown_v1`.
The hosted migration history advanced once, the application registry now contains exactly
`0001`–`0013` with the local runner checksum, and a transactional future-function probe changed
from browser-role EXECUTE allowed before the migration to browser-role EXECUTE denied afterward.
Existing function privileges remained browser-denied and service-role allowed.

The migration-only learner snapshot was unchanged: users 1, learner profiles 1, user languages 1,
user concept states 1, user skill states 3, review items 1, FSRS states 1, learning events 5,
exposure events 0, saved concepts 1, today plans 8 and today activities 7 before and after apply.
After that snapshot, the authenticated hosted UI smoke called `GET /v1/today`, which correctly
persisted the next daily plan for 2026-09-21 (one plan and one activity); this is an application
side effect of Today generation, not a migration mutation, and was not deleted or reset.

Render service `lingua-api-staging` is live on deploy `dep-dao6lo7avr4c73b042sg` from the merge
SHA. `/health` returned HTTP 200. Through the existing authenticated staging browser session,
Render logs and browser network responses showed HTTP 200 for `/v1/me`, `/v1/me/languages`,
`/v1/today`, `/v1/brain/summary`, `/v1/brain/concepts` and `/v1/review/queue`; an unauthenticated
`/v1/me` probe returned the expected 401. Full disposable-actor cloud R1 was not rerun because
staging disposable Auth credentials/admin cleanup authority are not available in this environment.

Regression evidence on this checkout: backend format/lint/mypy and **512/512** tests pass;
frontend Vitest has **711 passed** with four external FRLL tests failing closed because no local
API is listening on `127.0.0.1:8000`; ESLint, production build, OpenAPI contract tests (33/33)
and `git diff --check` pass. `contracts:check-generated` and the aggregate `typecheck` remain
blocked by pre-existing Windows CRLF-versus-tool LF bytes in the generated OpenAPI file and a
missing `@storybook/react` materialization for `packages/ui`; semantic generated content matches
the contract and no source was changed to bypass the gate.

Supabase advisories still require follow-up: RLS is disabled on 33 canonical tables, and leaked
password protection is disabled. No blanket RLS remediation was applied because it would be an
unreviewed security/schema change outside this gate. Knowledge V2 K2-01 remains stopped until the
cloud R1 disposable-actor proof and the environment gates are resolved.

## UI v2 promotion checkpoint — 2026-09-20

The UI v2 branch is promoted to `master` at `20c4cd52f2df0096ebf98679c239e119c6471ff6` and
its accepted frontend flows are reconciled. All 568 frontend tests pass; typecheck, lint,
generated-contract freshness and production build pass. The Vercel UI is live at
`https://lingua-os-web-mocha.vercel.app/today`; browser smoke checks passed for `/today`,
`/brain` and `/settings`. Render deploy `dep-danupg8jo6nc739roda0` is live from the same
commit at `https://lingua-api-staging.onrender.com`, and `/health` returned HTTP 200.
The full backend test command is code-clean through format, lint and typecheck; its database
tests require Docker PostgreSQL, and the baseline migration registry check still needs the
existing 0010–0012 registry alignment. See `reviews/UI-V2-promotion-checkpoint.md`. No API,
schema, backend, or learner-state change was made.

## Phase A stabilization — 2026-09-20

Docker PostgreSQL is available and the backend gate is green against a real PostgreSQL 17.11
instance: Ruff format/lint, strict mypy, and **512/512** backend tests pass. The migration
verifier and staging runbook now cover `0001`–`0013`; tests cover the existing `0010`–`0012`
browser boundary and the additive `0013` correction for PostgreSQL's global default function
execute grant. No OpenAPI or frontend contract changed, and no hosted database was mutated.
The full frontend Vitest run remains **711 passed** with four external FRLL tests failing closed
because no local FastAPI server was listening on `127.0.0.1:8000`.

## Real FRLL integration verification — 2026-09-20

Current `master` and `origin/master` are `eb04318acdc8d9843d6036d3729187f50b7f1e1c`.
Against real disposable Supabase Auth/PostgreSQL state, Phase B, C, D and E each passed 1/1:
Save/Learn and Memory idempotence, Today selection and plan idempotence, atomic Review/FSRS
transition with replay/conflict guards, and read-only authoritative Brain projection. Playwright
R1 passed 4/4 after restoring a missing local `@gsap/react` node_modules materialization; the
canonical response-loss/reload/replay case was rerun and passed 1/1. Browser actor cleanup and
post-cleanup isolation passed. Local API, Next and proxy processes were stopped and ports
8000/3000/3005 are clear. Evidence: `reviews/FRLL-CLOUD-VERIFICATION-20260920.md`.

Render deploy `dep-danvd1qjnfac7397dgr0` is live from this commit. Hosted Supabase still has
migrations `0010`–`0012`; additive migration `0013` has not been applied, and no hosted DB was
mutated during verification. This is the remaining staging hardening item.

## Current checkpoint — TASK-LIBRARY-001 complete (2026-09-15)

- `/library` now loads all saved concept, sentence and content items through the frozen
  `GET /v1/library/items` cursor contract. It preserves server order, canonical IDs, saved timestamps
  and useful metadata through the explicit DTO → adapter → view-model → React boundary.
- Pagination fails closed on malformed metadata, duplicate identities or repeated cursors; partial
  collections are never presented as complete authority. Empty backend state contains no live fixture
  fallback.
- Concept, sentence and content removal uses the existing canonical DELETE operations. Mutations are
  duplicate-suppressed and server-confirmed; failures keep the row visible and map to safe UI errors.
- Application actor epoch and per-request sequencing protect load, pagination, removal, catch and
  finally paths across logout/login, Actor A/B transitions and same-actor newer requests. Library
  reads and client-side filtering perform no learner-state write or scheduling/competence logic.
- Verification: focused Library 20/20 PASS; full frontend/static/live acceptance 714/714 PASS across
  57 files with disposable actor cleanup; backend 510/510 PASS on PostgreSQL; Ruff format/lint,
  strict mypy, generated-contract freshness, workspace typecheck, ESLint, Next.js production build
  and `git diff --check` PASS. No shared UI component/story changed, so Storybook was not required.
- Zero diff under `contracts/`, `services/`, `database/`, migrations and generated OpenAPI types.
  No deployment or remote push was performed.

## Current checkpoint — TASK-READ-001 complete (2026-09-15)

- `/read` now uses the frozen live chain `GET /v1/me` → `GET /v1/content/recommended` →
  `GET /v1/content/{contentId}` with no default product fixture fallback.
- The UI renders all authoritative segments/sentences in server order, canonical annotated concepts,
  attribution, real audio availability, Library save state and server-provided reading progress.
- Concept inspection uses `GET /v1/concepts/{conceptId}` and records lookup exposure without
  client-supplied concept authority. Explicit read completion records exposure and advances the
  owned progress projection. Sentence/content saves stay non-activating; only explicit concept
  Save/Learn uses `PUT /v1/library/concepts/{conceptId}`.
- Ambiguous progress retries reuse one stable idempotency key, duplicate clicks are suppressed,
  and same-actor plus Actor A/B request sequencing prevents stale commits. Resume state is
  `SERVER_PERSISTED`; no localStorage/sessionStorage progress authority exists.
- Verification: focused Reader 12/12 PASS; focused Reader/HTTP/contract/regression 105/105 PASS;
  frontend/static acceptance 690/690 PASS across 52 files; backend 510/510 PASS on PostgreSQL;
  Ruff format/lint, strict mypy, generated-contract freshness, workspace typecheck, ESLint,
  Next.js production build and `git diff --check` PASS. Shared UI/story files were unchanged, so
  Storybook rebuild was not required.
- Zero diff under `contracts/`, `services/`, `database/`, migrations and generated OpenAPI types.
  No deployment or remote push was performed.

## Current checkpoint — TASK-ADMIN-002 complete (2026-09-14)

- The owner can select an exact UTF-16 sentence span, search the authoritative English catalog, add
  an existing concept with an occurrence role, remove the exact occurrence and reload the persisted
  result from `/admin/content/[id]`.
- Three owner-only contract operations were added: catalog search plus idempotent PUT/DELETE of an
  exact sentence-concept occurrence. The backend validates content, sentence ownership, concept
  eligibility and offsets, rejects overlaps and immutable published/retired structure, and rebuilds
  `content_concepts` in the same transaction.
- Readiness remains the existing publication rule: every sentence needs at least one catalog mapping.
  The UI reports ready versus missing sentences and never fabricates concepts, POS values, CEFR claims
  or semantic correctness.
- Existing `sentence_concepts` and `content_concepts` schema was sufficient. No migration, learner
  event, Memory/FSRS, competence or other learner-state write was introduced.
- Verification: generated TypeScript freshness and OpenAPI contract tests PASS; Ruff format/lint and
  mypy PASS; backend 510/510 PASS with focused Admin 9/9; focused Admin frontend 8/8; frontend/static
  acceptance 676 PASS with 4 external-credential live FRLL tests intentionally skipped across 55
  files using one worker; TypeScript, ESLint, Storybook, production build and `git diff --check` PASS.
- No deployment or remote push was performed.

## Current checkpoint — TASK-ADMIN-001 complete (2026-09-13)

- Owner-only first-party content authoring is implemented through seven authenticated
  `/v1/admin/content` operations and a minimal `/admin` web surface.
- Authorization uses the existing Supabase JWT actor identity plus the server-only
  `LINGUA_ADMIN_USER_IDS` UUID allowlist. Missing or malformed configuration fails closed; anonymous
  actors receive 401 and authenticated non-owners receive 403.
- Original English micro-articles persist explicit source records, SHA-256 provenance, attribution,
  rights statement and a fixed first-party license identity. Sentence order/Unicode are preserved by
  deterministic provider-free segmentation; catalog concept matches are never fabricated.
- Validation exposes unmapped sentences and invalid provenance. Publication remains controlled by
  the existing PostgreSQL Reader gate; published structure stays immutable and retired content is no
  longer learner-visible.
- Reused existing schema only: no migration and no learner-state mutation. Existing Reader GET
  returns successfully published content.
- Verification: OpenAPI validation and generated TypeScript freshness PASS; Ruff format/lint and
  mypy PASS; backend 506/506 PASS; focused Admin frontend 6/6 PASS; full frontend/acceptance 677/677
  PASS across 55 files with sequential workers; TypeScript, ESLint, production build and
  `git diff --check` PASS. Storybook was not required because no shared UI component or story changed.
- No deployment and no remote push were performed.

## Owner self-use baseline checkpoint — accepted (2026-09-13)

```text
OWNER SELF-USE BASELINE = ACCEPTED
HEAD = 810cea19d5b45021ab7a671ab5d353b235536f75
FINAL REVIEW = OWNER SELF-USE BASELINE ACCEPTED
```

- Local annotated tag: `owner-self-use-stable-2026-09-13` (not pushed).
- Scope is the owner-operated self-use baseline only. This additive checkpoint does not claim a
  new or broader FRLL review at this HEAD and does not alter the frozen FRLL evidence baseline in
  ADR-023. UI work is deferred to a later, separate step.

## Current checkpoint — FRLL accepted / frozen

- `FRLL = ACCEPTED` — final reviewer verdict: `FINAL FRLL ACCEPTED` after the
  infrastructure unblock.
- Accepted implementation/evidence HEAD: `0723c1d7780bc0f6087da81b5ebac764658c3162`.
- Two fresh checkpoints, each with new disposable actors: F1 B–E `4/4 PASS`
  and R1 browser `4/4 PASS`. Both prove normal HTTP 200 answer,
  post-commit response loss and exact same-receipt replay, PostgreSQL
  exact-once persistence, Actor-B isolation, passive zero-write behavior,
  fail-closed cleanup and catalog-anchor survival.
- Sanitized evidence: `docs/FRLL_CHECKPOINT_EVIDENCE_20260912.md`; detailed
  ledger: `docs/FRLL_FINAL_TAKEOVER_REVIEW.md`.
- Frontend regression: 657/657 PASS (51 files); contracts freshness,
  typecheck, lint, Storybook and production build PASS. Backend baseline:
  493/493 PASS on Docker PostgreSQL 17.
- FRLL is now frozen. Reopen only for a real regression or newly proven
  acceptance defect; do not refactor it for style.

## Completed

- `TASK-007`: Review UI / Review Live Frontend Integration — ACCEPTED
  - Final Review Verdict: `TASK-007 INDEPENDENT REVIEW: PASS`
  - Server Authority & Presentation Adapter: Pure DTO-to-ViewModel mapping in `adapters.ts` preserving exact server item IDs, prompt, context translations, and array order without any client-side FSRS, scheduling, due-date calculations, or competence math.
  - Authoritative Answers & User Interactions: Explicit rating submission only (`POST /v1/review/{reviewItemId}/answer`) with immediate button/keyboard disabling, non-optimistic advancement, and server-authoritative remaining due count and feedback reconciliation.
  - Local Pending-Answer Recovery & Idempotency: Local `sessionStorage` receipt scoped by actor ID and language profile (`lingua.review.pending.v1:${actorId}:${languageProfileId}`); reuses identical UUID `Idempotency-Key` and payload across ambiguous network failures and page reload/re-entry without automatic unconfirmed dispatch; fresh UUID generated on advance to next card.
  - Cursor Pagination & Queue Traversal: Strict multi-page cursor traversal for `GET /v1/review/queue` preserving server order; detects and fails closed on repeated/cyclic cursors and duplicate items.
  - Actor Lifecycle Isolation: Multi-boundary protection via `captureGuard` (`isCurrentActor`, `getActorEpoch`, and `sequenceRef`); stale Actor A responses, errors, or cleanup cannot mutate Actor B state or clear active busy locks; same-actor token refresh preserves in-flight work.
  - Quality Gates & Zero Drift: 48/48 focused tests (35 Review + 13 HTTP transport), 466/466 full frontend tests across 35 files, 0 typecheck errors, 0 lint warnings, clean Storybook static catalog build, and clean Next.js 15 production build. Zero changes to `contracts/`, `services/`, or `database/`. Accepted.

- `TASK-011`: Today Live Frontend Integration — ACCEPTED
  - Final Review Verdict: `TASK-011 TODAY CONTRACT R2 FINAL REVIEW: PASS — MARK TASK-011 DONE AND PROCEED TO TASK-007 REVIEW LIVE`
  - Contract Authority Correction (TODAY-CONTRACT-011-R2): Reverted manual query widening `& { timeZone?: string }` across `ApiClient`, `HttpApiClient`, and `MockApiClient`. Restored strict OpenAPI conformance: `GET /v1/today` is invoked without non-contract query parameters; timezone authority belongs strictly to the persisted profile (`api.getMe()`), acting as a fail-closed readiness gate rather than an endpoint query input.
  - Live Plan Fetching & Timezone Authority (TIMEZONE-011-R1): Strictly requires authoritative learner profile timezone (`isValidIanaTimeZone`) before calling `GET /v1/today`. Fails closed if timezone is missing/unconfigured without silently promoting device/browser timezone into backend planning authority; renders canonical setup-required EmptyState directing learner to `/onboarding`.
  - Adapter Layer & Server Authority: Pure DTO-to-ViewModel mapping in `adapters.ts` preserving exact server plan ID, item IDs, and array order without any client-side sorting, ranking, or heuristic calculations.
  - Authoritative Activity Completion: `POST /v1/today/{planId}/activities/{activityId}/complete` integration with in-flight duplicate suppression, optimistic in-progress state, rollback on failure, and server-authoritative state reconciliation.
  - Actor Lifecycle Isolation: Enforced across all async boundaries via `isCurrentActor`, `getActorEpoch`, and `LinguaActorAbortedError`; same-actor race protection via `sequenceRef`. Stale Actor A completions/fetches cannot contaminate Actor B.
  - Zero Backend / Contract Diff: Zero changes to `contracts/`, `services/`, or `database/`.
  - Full Quality Gate Verification: 26/26 tests in `tests/frontend/task011-today-live.test.tsx` (covering `TEST-011-R2-01..06`), 11/11 tests in `tests/frontend/http-client.test.ts` (including serialized URL verification `TEST-011-R2-05`), 429/429 tests passing across all 34 test files, 0 typecheck errors, 0 lint warnings, clean Storybook build, clean Next.js 15 production build. Accepted.

- `TASK-009 Mini`: Live Concept Discovery + Explicit Save/Learn UI — ACCEPTED after fresh independent review
  - Live Concept Discovery: Real debounced search (`GET /v1/dictionary/search`) with sequence counter tracking (`searchSequenceRef`) dropping stale out-of-order responses.
  - Concept Inspection: Lazy concept detail retrieval (`GET /v1/concepts/{conceptId}`) expanding definition, English explanation, and example sentences.
  - Explicit Save/Learn: Button communicates learner intent ("Lưu để học" / "Đã lưu vào kho học", never "Đã thành thạo"), invoking authoritative Library mutation (`PUT /v1/library/concepts/{conceptId}`). Disabled pending state ("Đang lưu...") prevents duplicate submissions.
  - Authoritative Saved State Reconciliation (PAGINATION-009 Fixed & PAGINATION-009-R1 Corrected): Multi-page cursor traversal (`GET /v1/library/items?itemType=concept`) ensuring full saved concept authority across all pages before committing UI state; cycle loop detection (`seenCursors`) with fail-closed termination.
  - Saved-State Authority Tri-State (PAGINATION-009-R1): `SAVED` (positively known IDs preserved even on traversal failure), `NOT SAVED` (valid ONLY upon complete, successful cursor exhaustion), and `UNKNOWN / INCOMPLETE AUTHORITY` (during in-flight traversal or following error). Concepts with unknown status render an accessible retry action ("Thử đồng bộ lại") or checking indicator, strictly suppressing the active "Lưu để học" CTA. Explicit clean retry mechanism (`retryReconciliation`) resets traversal state and initiates a fresh sequence from page 1.
  - Actor Lifecycle Isolation: Guarded across all async boundaries via `isCurrentActor` and `LinguaActorAbortedError`, preventing stale Actor A search, reconciliation, failure, or save operations from mutating Actor B UI state (`TEST-009-PAGE-08`).
  - Zero Backend / Contract Diff: Zero modifications to `contracts/`, `services/`, or `database/`.
  - Verification: 402/402 frontend tests passing across 33 test files (21 invariant tests in `tests/frontend/task009-concept-discovery-save.test.tsx` covering `TEST-009-PAGE-01..08`), 0 typecheck errors, 0 lint warnings, clean Storybook static catalog build, and Next.js 15 production build. Accepted after fresh independent review.

- `TASK-008B`: Library API v1 + GAP-01 Memory Activation — ACCEPTED by Sol (GAP-01 CLOSED)
  - Forward migration `0009_library_concept_save_intent_v1`: created `concept_save_intents` with database-level immutability trigger (`enforce_concept_save_intent_immutability`), expanded `learning_events_source_type_check` to permit `'concept_save_intent'`, and created covering index `ix_saved_concepts_user_saved_at`.
  - GAP-01 Memory Activation & MEM-001 Invariant: Only `PUT /v1/library/concepts/{conceptId}` activates Memory via `PostgresMemoryEngine.ensure_lineage_in_transaction()`. Exactly one FSRS review item (`UNIQUE (user_id, concept_id)`) per learner/concept. Subsequent saves/learns never reset existing review items or FSRS state. Reader exposures, reading progress, sentence saves, content saves, assessments, and Dictionary lookups strictly do NOT activate Memory.
  - Canonical Learning Event & Competence Projection: First save intent creates a canonical learning event (`learning.concept.saved.v1`, `source_type = 'concept_save_intent'`) and updates `user_concept_states` to set `has_learning_intent = true` (`ConceptStatus.LEARNING`) with 0 competence mass.
  - Library API Operations: Implemented 7 FastAPI endpoints (`GET /v1/library/items`, `PUT /v1/library/concepts/{id}`, `DELETE /v1/library/concepts/{id}`, `PUT /v1/library/sentences/{id}`, `DELETE /v1/library/sentences/{id}`, `PUT /v1/library/content/{id}`, `DELETE /v1/library/content/{id}`).
  - Opaque Cursor Pagination & Security: Tamper-proof HMAC SHA-256 cursors with timestamp-keyed pagination, actor ownership, fail-closed active profile checks, and exact contract conformity.
  - Standards Gates & Verification: 478/478 backend tests passed (including RLS-GATE-01 behavioral verification across owner/other/anon and 14 library integration tests covering REPLAY-01 rebuild invariance, GATE-01 authorized endpoint whitelist, concurrency barrier overlap, and 3-boundary transactional rollback & retry), ADR-022 recorded with contract paths verified (ADR-PATH-01), Ruff format/lint clean across 108 files, Mypy strict clean across 108 files, Redocly OpenAPI lint valid, contract generation fresh. Accepted implementation HEAD: 6d7c803.

- `TASK-017`: Live Auth + Onboarding Integration Hardening (Findings C-1..C-6 + Required Fix Pass DEF-01..DEF-03 + DEF-03-R1) — ACCEPTED by Sol
  - C-1: Assessment pointer strictly actor-scoped in local storage (`lingua:starting-level:active-assessment:${userId}`); foreign pointers completely isolated.
  - C-2: `HttpApiClient` actor generation tracking (`setActor`), flushing cached ETags on actor switch and rejecting stale in-flight responses with `LinguaActorAbortedError` (`code: 'ABORTED'`).
  - C-3: Unified readiness predicate (`useProductReadiness`); unassessed learners with confirmed timezone and active profile are authoritatively ready and route to `/today` without assessment entrapment; explicit re-entry gated on `mode=assessment`.
  - C-4: `AppRouteBoundary` deterministic route gating truth table preventing unready data-leak loops and rendering accessible loading state during bootstrap.
  - C-5: Language profile 409 `CONFLICT` reconciliation via collection discovery (`listMyLanguageProfiles`), smoothly adopting active profiles or presenting reactivation UI for archived profiles with child ETags; fails closed on `IDEMPOTENCY_KEY_REUSED`.
  - C-6: Stimulus preservation (`textSnippet` + `audioUrl`) through adapter view models and accessible audio player with playback reset on question switch, visible focus, keyboard controls, and non-blocking error handling.
  - DEF-01: Authoritative 6-point product readiness predicate (`evaluateProductReadiness`) checking authenticated actor, learner profile ID, confirmed valid IANA timezone, active vi→en language profile, valid canonical `LearningGoal`, and persisted `dailyMinutes` 5..180; Starting Level Estimate remains optional.
  - DEF-02: Paused vi→en `LanguageProfile` recovery & resumption with explicit resume UI, PATCH with same ID and child ETag, 412 refetch without automatic second PATCH, and 409 CONFLICT collection discovery.
  - DEF-03: Stale actor `LinguaActorAbortedError` outcomes completely isolated without mutating state, corrupting stages, or showing erroneous error banners across onboarding and route readiness.
  - DEF-03-R1: Application-level actor operation identity and generation/epoch tracking implemented across `AuthContext`, `LiveOnboardingFlow`, and `useProductReadiness`. All async mutation and bootstrap paths guarded across every await, catch block, 412 recovery, and finally block. Stale mutations cannot clear active actor busy states, commit foreign profiles, advance stages, or post recovery banners. 5 deterministic lifecycle race tests added (`TEST-ACTOR-LIFECYCLE-01..05`). Final Sol re-acceptance received; marked DONE.

- `TASK-017A`: Language Profile child ETag transport correction
  - Shared `LanguageProfile` response schema now provides required, read-only opaque `etag: string` across collection, nested `/me`, create, and update representations.
  - FastAPI Profile route mappers project `language_profile_etag` and create replay projects the original child token from the historical snapshot without schema migrations.
  - Frontend types regenerated; onboarding adapter and view models preserve child ETag for authoritative PATCH operations.
  - Verification passed: 458/458 backend tests (including real PostgreSQL suite), 338/338 frontend tests across 30 files, typecheck, lint, Storybook static catalog build, and Next.js production build. Real deployed Supabase smoke remains environment-conditional and does not block task closure.
- Product/system specification v2.0
- UI/UX/frontend specification v2.0
- Master project contract v4.0
- backend and frontend ownership instructions
- Starter shared contracts (`contracts/enums.json`, `contracts/errors.json`, `contracts/openapi.yaml`)
- UI UX Pro Max policy and setup workflow
- Superpowers policy and setup workflow
- Shared engineering workflow
- Parallel Git/worktree workflow
- Agent-specific v4 start prompts
- `TASK-001`: Repository/backend foundation
  - Python 3.12+ FastAPI service package under `services/api/src/lingua_api`
  - Operational `GET /health` check excluded from the public product OpenAPI schema
  - Exact runtime/development dependency locks and clean-install workflow
  - Backend format, lint, strict type-check, test and development commands
  - Test-first smoke coverage proving health behavior and zero premature product endpoints
- `TASK-003`: Core PostgreSQL schema v1
  - 46 normalized MVP tables for identity/profile, language/CEFR metadata, relational Language
    Brain, provenance/licensing/QA, sentences/content/audio metadata, learner projections/events,
    one primary FSRS lineage, saved library state, Today persistence and Starting Level Estimate
    evidence
  - Paired `0001_core_schema_v1` up/down SQL and a transactional, advisory-locked,
    checksum-verified migration runner
  - Supabase-native identity/RLS boundary across all 18 user-owned tables; authenticated own-row
    read only, anonymous denied, server-side writes preserved
  - Database-enforced score/domain bounds, idempotency keys, owner/language integrity, provenance
    publication gate and concrete access-path indexes
  - Minimal deterministic `en`/`vi` and CEFR A0/pre-A1 through B1 reference seeds only
- `TASK-004`: Shared API contract v1
  - Authoritative OpenAPI 3.2 contract with 24 MVP product paths, 29 operations, 94 product/shared
    schemas, stable operation IDs, UUID/RFC 3339 conventions and reusable success/error envelopes
  - Deliberate Browser → FastAPI → PostgreSQL/Supabase architecture; Supabase JWT actor mapping,
    FastAPI-owned product access and RLS defence-in-depth boundaries documented
  - Cursor pagination on five growing collections; ETag/If-Match for concurrent profile edits;
    retry-safe POST mutations and idempotent Library operations
  - One public memory snapshot per learner/concept with recognition/listening/production competence
    projections kept separate; no FSRS parameters or algorithm internals exposed
  - Published-content provenance/attribution boundary and evidence-based Starting Level Estimate
    contract without certification/IRT semantics
  - Synchronized API enum/error registries, 13 contract invariant tests, generated-client/docs smoke
    checks and MATCH/RENAME/CHANGE/REMOVE/ADD frontend reconciliation report
- `TASK-005`: Frontend contract types and mock layer
  - Pinned `openapi-typescript@7.9.1` generation from the authoritative OpenAPI 3.2 contract with a
    checked-in immutable TypeScript surface and deterministic freshness gate
  - Generated-schema DTO aliases and operation-shaped `ApiClient`; deterministic `MockApiClient`
    responses satisfy OpenAPI envelopes, UUID/time, cursor, attribution, ETag and idempotency shapes
  - Explicit `DTO -> adapter -> UI view model -> component` dependency direction for Today, Review,
    Reader, Dictionary, Brain, Progress, Profile and Starting Level Estimate surfaces
  - Strict eight-value `ConceptStatus`; server-owned `MemorySnapshot` kept separate from
    recognition/listening/production competence and from due presentation
  - Safe Vietnamese mappings for all 11 API error codes without exposing server/database messages
  - Persistence gaps labeled `LOCAL_ONLY`, `NOT_YET_PERSISTED`, or `DEFERRED`; no successful server
    mocks invented for settings, resume position, notes, new-concept budget, export or deletion
  - Provisional raw FSRS, ownership, ingestion-quality, graph, offset-pagination and frontend
    placement/mastery calculation assumptions removed from production and legacy test scenarios
- `TASK-006`: Memory Engine / FSRS MVP
  - Maintained MIT-licensed `py-fsrs==6.3.2` implementing FSRS-6 behind a narrow backend scheduler
    adapter; no scheduling equations copied into LINGUA OS
  - Immutable `fsrs6-global-default-v1` parameter seed with exact algorithm/library/version lineage
    on every memory state and review event
  - One primary learner/concept lineage, deterministic injected UTC clock, four authoritative
    ratings and explicit five-mode presentation-to-evidence mapping
  - Actor-scoped activation/review/due service with atomic review-event/state/item writes,
    PostgreSQL row locking, state-version protection and conflict-safe idempotent replay
  - Index-compatible owned active-due query only; no Today ranking, competence scheduling,
    placement, content recommendation, product endpoint or frontend behavior added
- `TASK-006A`: Review API Adapter v1
  - Exactly two product routes: authenticated Review queue and Review answer; health remains outside
    product OpenAPI and all other product endpoints remain unimplemented
  - Asymmetric Supabase JWT verification to actor, strict ownership, signed opaque keyset cursor,
    contract-valid DTO/error mapping and no client ownership/private FSRS input
  - Exact persisted post-transition result snapshots for delayed idempotent replay, legacy-history
    reconstruction boundary, and deterministic domain conflict for cross-lineage same-key races
  - Current three-dimension `user_skill_states` projection returned without competence math;
    remaining due count derived after transition in the same transaction
- `TASK-006B`: ConceptSummary part-of-speech contract correction
  - `ConceptSummary` and `ConceptDetail` now model POS as optional/nullable for grammar and skill
    concepts while lexical concepts retain normalized POS values
  - Generated TypeScript exposes `partOfSpeech?: PartOfSpeech | null`; deterministic fixtures cover
    lexical, grammar and skill concepts without placeholder values
  - Review due projection accepts absent lexemes/POS without weakening ownership, concept status,
    prompt, competence, cursor or Memory Engine validation
  - Review, Dictionary, Reader and Brain adapters/presentations omit absent POS without empty
    parentheses, dangling separators or visual redesign
- `TASK-002`: Frontend/design-system foundation (`design-system/MASTER.md`, DTCG 3-tier tokens, Storybook suite, base primitives, AppShell, semantic token refactoring)
- Frontend Architecture Correction Pass:
  - Contract authority preserved; provisional status explicit on frontend types pending `TASK-004`
  - Backend business logic (FSRS scheduling math, difficulty/retention calculations) removed from frontend
  - Strict 8-status `ConceptStatus` aligned with `contracts/enums.json`; `due` modeled cleanly as `isDue` / presentation state
  - Single source of truth in test harness (`tests/frontend/harness/types.ts` imports `@lingua/types`)
  - DTCG Tier-3 component token layer implemented and consumed across UI shells & features
  - UI test classifications properly designated (Unit, Component, Integration, Contract/View-Model)
  - Hardcoded domain fixtures extracted into `apps/web/src/fixtures/*.ts`
- GSAP Motion System & Token Consistency (Frontend Layer Stable):
  - Motion Design specification (`design-system/MOTION_DESIGN.md`) and Motion Opportunity Audit (`design-system/MOTION_AUDIT.md`) complete.
  - Complete 3-tier DTCG motion token architecture (`primitiveMotion` -> `semanticMotion` / `motionSeconds` / `motionNumeric` / `gsapEasings` -> `componentMotionTokens` / `componentMotionNumeric`).
  - GSAP animations in `ReviewCard`, `ReviewSession`, `ConceptNode`, `LanguageBrainCanvas`, `ProgressAnalytics` strictly consume component/semantic motion tokens with zero hardcoded magic numbers or raw easing strings.
  - Standard `usePrefersReducedMotion()` hook (SSR-safe `useSyncExternalStore`) universally enforced across all 5 animated surfaces with immediate fallback and zero animation leaks (`useGSAP` scoped with automatic lifecycle cleanup).
  - Synchronous non-blocking feedback (<= 300ms) and immediate DOM/ARIA data correctness preserved from Frame 0.
  - Note for backend/system work: The frontend motion system is complete, verified, and stable. Do not rewrite or modify frontend motion layers during backend development.

- `TASK-006C`: Frontend Authentication Foundation
  - Official `@supabase/supabase-js@^2.49.1` and `@supabase/ssr` for Next.js App Router
  - Browser-safe configuration resolver `getSupabasePublicConfig()` reading approved `NEXT_PUBLIC_SUPABASE_*` variables
  - `createBrowserSupabaseClient()` with singleton caching and `createServerSupabaseClient()` using Next.js `cookies()` store
  - Transport-agnostic `AuthTokenProvider` interface in `@lingua/types` allowing `HttpApiClient` to obtain legitimate Bearer JWTs without coupling to Supabase internals
  - Canonical `createSupabaseAuthTokenProvider()` delegating to `supabase.auth.getSession()` with automatic SDK token refresh
  - React `AuthProvider` / `useAuth()` lifecycle context managing `loading | authenticated | unauthenticated` states, dynamic session subscriptions (`onAuthStateChange`), and `signOut()`
  - `ProtectedRoute` boundary preventing redirect loops during session bootstrap and presenting unauthenticated state without hardcoding unapproved login methods
  - Product learner profile explicitly decoupled from Supabase user auth identity (auth UUID boundary only)
- `TASK-006C.1`: Authentication Foundation Hardening
  - Upgraded `@supabase/ssr` to current maintained `^0.12.4` with verified supply-chain lockfile consistency
  - Implemented canonical Next.js App Router session-refresh middleware (`apps/web/src/middleware.ts` & `apps/web/src/lib/supabase/middleware.ts`) with automatic cookie synchronization
  - Corrected `AuthProvider.signOut()` semantics to inspect error results, preserve actual session on failure, and expose errors without falsely reporting unauthenticated state
  - Structurally isolated client configuration to strictly read approved `NEXT_PUBLIC_*` variables with defense-in-depth secret guards
  - Implemented typed `AuthTokenProviderError` in `createSupabaseAuthTokenProvider()` to clearly distinguish legitimate session absence (`null`) from unexpected SDK/network failures
- `TASK-006C.2`: Supabase SSR Alignment Patch
  - Aligned Next.js middleware session refresh with `supabase.auth.getClaims()` per official Supabase SSR guidance
  - Implemented full cache-prevention header forwarding from `@supabase/ssr` `setAll` (`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Pragma`, `Expires`) onto `NextResponse` without dropping headers on response clone
  - Retained Next.js 15.5.23 `middleware.ts` structure (documented: future Next.js 16 upgrade will migrate to proxy.ts)
  - Verified exact auth test suite count (20 tests in `auth.test.tsx`, 307 total tests passing across all 27 files)
  - Note: Login method decision remains recorded as pending specification (`LOGIN METHOD DECISION REQUIRED`).
- `TASK-006D`: Learner Evidence Ingestion & Competence Projection v1
  - Immutable `competence-beta-v1` parameter lineage with exact weighted-Beta score/confidence,
    mastery policy and deterministic eight-state ConceptStatus derivation
  - Append-only canonical `learning_events` replay authority; source/canonical identities,
    fingerprints and profile ingestion ordering are separate and constrained
  - `user_concept_states` is the only learner × concept competence authority;
    `user_skill_states` is a separately rebuildable language-profile aggregate
  - Review answer now commits FSRS, source event, canonical evidence, projections and exact
    historical response snapshot in one PostgreSQL transaction
  - Migration `0004_learner_evidence_competence_v1` and real PostgreSQL zero-read, passive exposure,
    replay/rebuild, rollback, idempotency, ownership and no-lost-update coverage
  - No OpenAPI or frontend source change; frozen frontend baseline remains 307 tests / 27 files
- `TASK-008`: Reader / Content Service MVP
  - Migration `0005_reader_content_service_v1` adds curated A0-B1/segment metadata, sole
    learner-content progress authority, durable mutation snapshots and one-source-to-many concept
    exposure linkage with RLS, ownership FKs, indexes and protected rollback
  - Fail-closed publication gate validates reviewed English structure, QA/metrics/offsets, complete
    dependency provenance/attribution and exactly `allowed` licenses; published structure and Reader
    history snapshots are immutable
  - Executable Content list/detail, catalog sentence save, monotonic progress and client-attested
    READ/LISTEN/LOOKUP exposure operations preserve Dictionary, Library, TASK-006D and FSRS boundaries
  - Deterministic LINGUA-authored seed: 5 content items, 14 sentences, 30 concepts, 42 occurrences
    and one audio asset with published/unpublished/restricted fixtures
  - No OpenAPI, generated TypeScript, frontend source, UI, GSAP or design-system change
- `TASK-010`: Today Engine heuristic v1
  - Pure immutable `today-heuristic-v1` policy with exact Review order, deterministic budget
    packing, 8-minute content reserve, 4-unseen new-content cap, 48-hour novel-selection window,
    unfinished/saved/recommended precedence, and no standalone `learn`
  - Migration `0006_today_engine_heuristic_v1` adds all-lifecycle daily uniqueness, UTC `as_of`,
    ordered Review target snapshots, public replay snapshots, private diagnostics, completion
    fingerprint/result metadata, ownership/RLS constraints, and proof-path indexes
  - Repeatable-read generation, PostgreSQL concurrent-winner handling, IANA learner-local dates,
    same-day stability, timezone reconciliation, fail-closed publication invalidation, and bounded
    candidate queries
  - Executable GET/complete Today routes match frozen OpenAPI; completion requires authoritative
    Review/Reader proof and emits no fake evidence or learner-state mutation
  - No OpenAPI, generated TypeScript, frontend source, UI, GSAP, or design-system change
- `TASK-012`: Language Brain Projection API v1
  - Exactly three authenticated read operations for summary, concept list, and concept detail
  - Read-only repeatable-read PostgreSQL composition of accepted learner, competence, Memory,
    catalog, relation, provenance, license, and quality state; Brain GETs persist nothing
  - Nullable mastery and memory health, explicit confidence/evidence, exact eight-state
    ConceptStatus, synthetic zero-state, passive discovered-zero competence, and hidden-ownership
    404 semantics preserved from the frozen contract
  - Signed actor/profile/filter-bound keyset cursor and fixed batched query bounds with no N+1
  - PostgreSQL 17.11 verification passes: 15/15 focused Brain, 150/150 database, 250/250 full
    backend, and 3/3 focused migration tests
  - No OpenAPI, migration, generated TypeScript, or frontend application change; frozen frontend
    baseline remains 308 tests / 27 files
- `TASK-006E`: Profile / Language Profile API & Auth Bootstrap v1
  - Migration `0007_profile_language_auth_bootstrap_v1` adds nullable learner timezone,
    independent positive revisions, separate native-language authority, exact Profile create replay,
    bounded LearningGoal values, own-read/no-browser-write RLS and loss-aware rollback
  - Exactly five Profile operations implement sole minimal `/v1/me` bootstrap, optional JWT email,
    IANA timezone updates, strong revision ETags, actor-scoped vi→en lifecycle, archive/reactivate
    preservation and PostgreSQL-safe exact idempotency replay
  - Today fails closed before timezone; Brain resolves the native/target pair from authoritative
    `native_language_code`; Brain/Today/Review/Content never bootstrap application identity
  - PostgreSQL 17.11: 188/188 database and 321/321 full backend tests pass; contract/static and
    frozen 313/313 frontend gates pass with no OpenAPI or frontend application behavior change

- `TASK-016`: Starting Level Estimate v1
  - Frozen deterministic `starting-level-heuristic-v1` with persisted 8/12/16-slot A0–B1 flows,
    exact idempotent replay, actor ownership, immutable question/result history and no downstream
    Evidence, Competence, FSRS, Review, Today, Content or Brain mutation
  - Migration `0008`, FastAPI Assessment runtime and PostgreSQL integration suite verified on
    PostgreSQL 17.11; 426/426 full backend and frozen 314/314 frontend tests pass
- `TASK-017`: Live Auth + Onboarding Integration v1
  - Supabase email/password sign-up/sign-in/sign-out and session restoration reuse the existing auth foundation
  - Shared contract-compatible `HttpApiClient` fronts the existing `ApiClient`; `/v1/me`, profile/timezone, vi→en language profile and optional Starting Level flow are live
  - `/auth` is public, application routes are session-protected, and `/today` remains the explicit end boundary with mock data

## In progress

- Private staging deployment hardening — IMPLEMENTED / READY FOR INDEPENDENT
  DEPLOYMENT REVIEW (deployment intentionally not run)
  - DEP-01: server-only Next.js `/api/[...path]` proxy forwards the frozen
    methods, query, body and auth/concurrency headers to `API_INTERNAL_URL`,
    preserving upstream status/body/ETag/Cache-Control and returning a generic
    503 when configuration or upstream access fails.
  - DEP-03: code/documentation is hosted-domain compatible, but the Supabase
    staging Site URL and exact allowed redirect URLs remain an external
    dashboard configuration and verification step; no wildcard or callback
    path was added.
  - DEP-04: minimal `render.yaml` records the pinned FastAPI start command and
    `/health` check with environment variable names only.
  - DEP-05: hosted/staging API client selection now fails closed when live API
    or browser Supabase configuration is incomplete; development/test mocks
    remain available through the non-hosted path or explicit injection.
  - DEP-10: `.gitignore` covers `.env.development`, `.env.production`,
    `.env.staging` and `.env.*.local`; `.env.example` remains trackable.
  - Verification after the correction: focused deployment/auth/readiness tests
    39/39, frontend Vitest 520/520 across 38 files, and the complete non-live
    Vitest scope 663/663 with the four accepted live FRLL phase tests explicitly
    skipped. Backend pytest 493/493, Ruff format/lint, strict mypy, contract
    freshness, workspace typecheck, ESLint, Storybook, production build and
    `git diff --check` pass. A voluntary live-suite rerun hit external Supabase
    cleanup latency in Phase D/E after the domain assertions; all disposable
    actors from the timed-out runs were scoped-cleaned and verified absent.
    Contracts, services, database and migrations have zero diff.

## Blockers

- Actual Vercel/Render deployment is intentionally not authorized by this
  task. Before enabling private staging, complete the external Supabase Auth
  Site URL/redirect allowlist setup (DEP-03), set the documented host
  environment variables, and run an independent deployment review.
- TASK-012 satisfies TASK-013 and the Brain portion of TASK-014, but TASK-014 is not the recommended next task. TASK-015 retains its stated upstream dependency.

## Verification Status

- `TASK-016` contract/policy/persistence freeze -> **PASSED CLEAN / READY FOR IMPLEMENTATION**:
  OpenAPI Validator passes; Redocly 2.13.0 exits 0 with only the pre-existing Reader discriminator
  warning; 32/32 contract tests pass; openapi-typescript 7.9.1 generation/freshness passes; focused
  Ruff format/lint and all workspace typechecks pass. The separately completed compatibility patch
  reports generated freshness, ESLint, 314/314 Vitest tests across 27 files, Storybook and Next.js
  production build passing with zero skipped/todo tests. Frozen Assessment semantics remain
  unchanged; no frontend/shared application source was edited in this resume turn.
- `TASK-016` runtime/database -> **PASSED CLEAN** on an isolated loopback-only portable PostgreSQL
  17.11 UTC cluster: 43/43 Assessment PostgreSQL tests, 231/231 complete database tests, 195/195
  non-database backend tests, and 426/426 complete backend tests. Empty `0001..0008`, no-op
  reapply, checksum rejection, `0008` down/up, protected rollback, fail-closed legacy preflight,
  start/answer/completion concurrency, exact replay, A0/A1/A2/B1 persisted transitions,
  skip/abandonment, deterministic confidence, snapshot/result immutability, RLS/IDOR, transaction
  atomicity, and Evidence/Today/Content/Memory isolation pass. Required fixes serialize distinct-key
  concurrent starts on the owned profile row and enforce append-only attempt-item snapshots.
- `TASK-016` final static/contract/frontend -> **PASSED CLEAN**: Ruff format/lint across 86 files,
  strict mypy across 86 source files, 32/32 contract tests, OpenAPI Spec Validator OK, generated
  TypeScript freshness, workspace typecheck, zero-warning ESLint, 314/314 frontend tests across 27
  files, Storybook build, and Next.js production build. Redocly 2.13.0 exits 0 with the unchanged
  Reader discriminator warning. OpenAPI and frontend application behavior remain unchanged.
- `TASK-017` implementation verification -> **PASSED CLEAN for new-user path**: OpenAPI Spec Validator,
  Redocly 2.13.0 (one unchanged Reader discriminator warning), 32/32 backend contract tests,
  openapi-typescript freshness, workspace typecheck, zero-warning ESLint, 330/330 frontend tests
  across 30 files, Storybook build, Next.js production build, Ruff, strict mypy and 446/446 backend
  tests all pass. No services, database, migrations, contracts or generated OpenAPI types changed.
  External Supabase/FastAPI smoke credentials are absent from this environment. Archived language
  profile reactivation remains safely gated because the frozen language-list response has no child ETag.
- `TASK-006E` runtime/migration -> **PASSED CLEAN** on PostgreSQL 17.11: 32/32 final Profile API
  tests, 188/188 complete database tests, 133/133 non-database backend tests, and 321/321 complete
  backend tests. Empty 0001..0007 apply, no-op reapply, checksum rejection, 0007 down/up,
  fail-closed legacy preflight/backfill, and protected rollback pass.
- `TASK-006E` static/contract/frontend -> **PASSED CLEAN**: Ruff confirms 76 formatted files and
  zero lint findings; strict mypy reports no issues in 76 source files; OpenAPI Spec Validator 0.9.0,
  26/26 contract tests, and openapi-typescript 7.9.1 freshness pass. Redocly CLI 2.13.0 exits 0 with
  the unchanged Reader discriminator warning. Workspace typecheck, zero-warning ESLint, 313/313
  frontend tests across 27 files, Storybook, and the 14-route Next.js production build pass.
- `TASK-006E` review/diff -> **APPROVED** with no remaining Critical or Required finding. Required
  review fixes added downstream no-bootstrap 404 enforcement, corrected semantically stale
  Reader/Review identity fixtures, and completed the concurrency/boundary/revision test matrix.
  OpenAPI, generated TypeScript, and frontend application behavior were not changed by runtime.
- `TASK-006E` contract compatibility patch -> **PASSED CLEAN**: nullable display name/email/timezone
  are preserved in the shared view model; the adapter no longer derives name from email or creates
  empty/default timezone values; Profile renders `Chưa cung cấp` only as presentation text. Generated
  freshness, all three workspace typechecks, zero-warning ESLint, 313/313 frontend tests across 27
  files, Storybook build, and 14-route Next.js production build pass. `apps/web` changed only at the
  single Profile heading expression; auth, transport, layout, styles, GSAP, design system, backend,
  database, migrations, and OpenAPI are unchanged by this compatibility patch.
- `TASK-006E` contract freeze -> OpenAPI Spec Validator and focused contract suite PASS (26/26);
  OpenAPI TypeScript generation and freshness PASS. Redocly 2.13 validates the contract with one
  pre-existing Reader exposure discriminator warning outside this Profile-only scope.
- `TASK-006E` design preflight -> **PASSED**: all five Profile operations, identity/bootstrap,
  application/language lifecycle, timezone/daily target, derived onboarding readiness, Starting
  Level boundary, ETag/idempotency, authorization/RLS, legacy safety, exact contract/migration gaps,
  A–X test matrix, eight worked journeys, and security failure review are documented. OpenAPI
  remains at 31 operations; no runtime, migration, generated type, frontend, mock, or test changed.
- `TASK-012` runtime static/non-database -> **PASSED CLEAN**: Ruff format confirms 67 files already
  formatted; Ruff lint passes; strict mypy reports no issues in 67 source files; 100/100
  non-PostgreSQL backend tests pass.
- `TASK-012` runtime PostgreSQL/migration/full backend -> **PASSED CLEAN** on an isolated portable
  PostgreSQL 17.11 UTC cluster: 15/15 focused Brain tests, 150/150 complete database tests, 250/250
  full backend tests, and 3/3 focused migration tests pass. Empty `0001..0006`, reproducible
  reapply, `0006` down/up, checksum rejection, protected rollback, repeatable-read concurrency,
  read-only/no-mutation, zero-state non-persistence, ownership-hidden 404, and fixed query bounds
  are verified.
- `TASK-012` runtime contract/database/frontend diff -> OpenAPI, generated TypeScript, migrations,
  and frontend application source are unchanged. Contract-freeze and frozen-frontend evidence below
  remains authoritative; baseline is 308 tests / 27 files.

- `TASK-012` contract freeze -> **PASSED**: OpenAPI Spec Validator 0.9.0 reports
  `contracts/openapi.yaml: OK`; 22/22 focused contract tests and generated TypeScript freshness
  pass. Redocly CLI 2.13.0 exits 0 with the one unchanged TASK-008 Reader discriminator warning.
- `TASK-012` static/backend non-database regression -> **PASSED CLEAN**: Ruff format/lint, strict
  mypy across 58 source files, and 95/95 non-PostgreSQL backend tests pass. The full suite was
  attempted but its 135 PostgreSQL tests could not start because Docker Desktop was unavailable;
  TASK-012 contract freeze contains no database, migration, or backend runtime change.
- `TASK-012` frontend compatibility -> **PASSED CLEAN** through the approved narrow patch:
  generated freshness, TypeScript, ESLint, Storybook, Next production build, and 308/308 tests
  across 27 files pass. `apps/web` source is unchanged and MockApiClient has no business-logic
  change. Frontend is frozen again at 308 tests / 27 files.

- `TASK-010` backend -> **PASSED CLEAN**: Ruff format/lint, strict mypy across 58 files, 90/90
  non-database tests, 135/135 real PostgreSQL tests, and 225/225 full backend tests.
- `TASK-010` migration -> **PASSED CLEAN** on PostgreSQL 17.11: empty `0001..0006`, no-op reapply,
  `0006` down/up, checksum rejection, protected rollback, ownership/shape/cardinality constraints,
  same-day uniqueness, exact replay, timezone identity, and real concurrent generation.
- `TASK-010` contract -> **PASSED CLEAN**: 18/18 focused OpenAPI/runtime checks, generated
  TypeScript freshness, and Redocly 2.13.0 validation. One unchanged TASK-008 Reader discriminator
  warning remains; OpenAPI changed by zero bytes in TASK-010.
- `TASK-010` frozen frontend -> **PASSED CLEAN**: typecheck/lint, 307/307 tests across 27 files,
  Storybook build, and Next production build. Frontend application source changed by zero files.
- `TASK-010` specification/schema/migration/transaction/security/performance/boundary/code reviews
  -> **PASSED**; evidence is in `reviews/TASK-010-today-engine-heuristic-v1.md`.

- `TASK-008` implementation -> **PASSED**: Ruff format/lint clean; strict mypy clean; 77/77
  non-database tests, 121/121 real PostgreSQL tests and 198/198 full backend tests pass on
  PostgreSQL 17.11. Empty database `0001..0005`, no-op reapply, `0005` down/up, checksum rejection,
  protected rollback and real concurrency all pass.
- `TASK-008` contract/runtime -> **PASSED**: OpenAPI Spec Validator OK, generated TypeScript fresh,
  FastAPI operation metadata and success DTOs conform. Redocly CLI 2.13.0 exits 0 with one warning
  on the unchanged frozen Reader discriminator requesting `defaultMapping`; no OpenAPI change was
  made.
- `TASK-008` frozen frontend regression -> **PASSED**: typecheck, lint, 307/307 tests across 27
  files, Storybook build and production build. No frontend application source changed.
- `TASK-008` spec/schema/migration/transaction/security/performance/boundary reviews -> **PASSED**;
  evidence is recorded in `reviews/TASK-008-reader-content-service-mvp.md`.

- `TASK-008` contract freeze -> **PASSED CLEAN**: OpenAPI Spec Validator and Redocly recommended
  lint accept OpenAPI 3.2; 17 / 17 focused contract invariants pass; TypeScript generation
  freshness passes.
- `TASK-008` static/backend non-database regression -> **PASSED CLEAN**: Ruff format/lint, strict
  mypy across 33 source files, and 77 non-PostgreSQL tests pass. The unchanged 84 PostgreSQL tests
  could not start because Docker Desktop was unavailable; this phase contains no schema, migration,
  database runtime, or backend runtime change.
- `TASK-008` frozen frontend regression -> **PASSED CLEAN**: typecheck, lint, 307 / 307 tests across
  27 files, Storybook build, and production build. No frontend application source was modified.

- `TASK-006D` backend checks -> **PASSED CLEAN** (Ruff format/lint, strict mypy across 33 source
  files, 158 / 158 backend tests)
- `TASK-006D` PostgreSQL checks -> **PASSED CLEAN** (migration empty/down/up/re-apply, append-only
  constraints, atomic rollback/retry, full rebuild equality and concurrent no-lost-update)
- `TASK-006D` specification/schema/migration/transaction/boundary/code-quality reviews ->
  **PASSED**, no required finding open
- `TASK-006D` public boundaries -> **ZERO OpenAPI change and ZERO frontend source change**;
  generated contract freshness passes
- `TASK-006C.2` frontend authentication tests -> **PASSED CLEAN** (20 / 20 auth invariant tests)
- `pnpm typecheck` -> **PASSED CLEAN** (generated OpenAPI freshness plus 0 TypeScript errors across all 3 workspace packages)
- `pnpm lint` -> **PASSED CLEAN** (0 ESLint warnings/errors)
- `pnpm test` -> **PASSED CLEAN** (307 / 307 tests passed across all 27 test files)
- `pnpm build-storybook` -> **PASSED CLEAN** (Storybook static catalog compiled successfully)
- `pnpm build` -> **PASSED CLEAN** (Next.js production build succeeded with static generation for all 14 routes + Next.js Middleware)



- OpenAPI Spec Validator 0.9.0 and Redocly recommended lint -> **PASSED CLEAN** (OpenAPI 3.2,
  zero warnings, all local references resolved)
- TypeScript client generation and static API documentation smoke -> **PASSED**
- Clean backend development lock install -> **PASSED**, exact 52-package environment match,
  including `fsrs==6.3.2` and `PyJWT[crypto]==2.13.0`; `pip check` reports no broken requirements
- TASK-004 contract tests -> **PASSED CLEAN** (13 / 13 invariants)
- Backend checks -> **PASSED CLEAN** (Ruff format/lint, strict mypy, 71 / 71 backend tests)
- PostgreSQL schema/Memory Engine verification -> **PASSED CLEAN** (38 / 38 DB integration tests
  against PostgreSQL 17.11, including rollback and real concurrent submissions)
- Empty application-schema migration through `0003`, deterministic FSRS seed, idempotent re-apply,
  rollback/re-apply and checksum rejection -> **PASSED**
- Database spec/schema/migration/ownership reviews -> **PASSED**, no required findings open
- Runtime smoke check `GET http://127.0.0.1:8765/health` -> **200 OK** with expected service/status/version payload
- `python -m pip check` -> **PASSED CLEAN** (no broken requirements)
- `pnpm typecheck` -> **PASSED CLEAN** (generated OpenAPI freshness plus 0 TypeScript errors across workspace)
- `pnpm lint` -> **PASSED CLEAN** (0 ESLint warnings/errors)
- `pnpm test` -> **PASSED CLEAN** (287 / 287 tests passed across all 26 test files after the
  pre-TASK-006 regression audit; 42 historical tests remain intentionally removed because they
  enforced provisional DTOs or frontend-owned backend algorithms)
- `pnpm build-storybook` -> **PASSED** (Storybook static catalog compiled successfully; existing
  dependency/sourcemap/chunk warnings remain non-failing)
- `pnpm build` -> **PASSED** (Next.js production build succeeded with static generation for all 14 routes)
- TASK-005 contract, frontend architecture, boundary, regression and code-quality reviews ->
  **PASSED**, no required findings open and no contract defect found
- Pre-TASK-006 test-suite regression audit -> **PASSED**; the original 54-test drop was traced to
  two overwritten files, all 29 meaningful lost coverage areas were restored in consolidated form,
  and all 42 intentionally obsolete removals have explicit justification in
  `reviews/TEST-SUITE-REGRESSION-AUDIT.md`
- Pre-TASK-006 regression-audit scope boundary -> **ZERO SOURCE MODIFICATIONS** under `services/**`,
  `database/**`, `contracts/**`, `packages/ui/src/**`, `design-system/**`, or the stable GSAP motion
  implementation during that audit
- TASK-006 FSRS/domain, transaction/concurrency, schema-integrity, contract-boundary and regression
  reviews -> **PASSED**, no required finding open and no contract defect found
- TASK-006A backend suite -> **PASSED CLEAN** (105 / 105, including real PostgreSQL historical
  replay and same-key same/different-lineage concurrency)
- TASK-006A Review/OpenAPI focused checks -> **PASSED CLEAN** (15 / 15), with success/error payload
  schema validation and FastAPI operation conformance
- TASK-006A specification, architecture, security/privacy, code-quality, migration, boundary and
  regression reviews -> **PASSED**; its recorded non-lexical `partOfSpeech` limitation is resolved
  by TASK-006B
- TASK-006B OpenAPI/Redocly/generated-type checks -> **PASSED CLEAN**; `ConceptSummary` and
  `ConceptDetail` are optional/nullable and all affected `$ref` consumers are consistent
- TASK-006B backend checks -> **PASSED CLEAN** (Ruff format/lint, strict mypy, 41 / 41 non-database
  tests and 66 / 66 real-PostgreSQL database tests)
- TASK-006B frontend/architecture/boundary/regression reviews -> **PASSED**; 287 / 287 tests,
  Storybook and production build passed with no required findings or unresolved schema decision

## Current architecture state

- `TASK-008A` Dictionary and Reader Analyze API v1 -> **DONE**: exact deterministic dictionary
  lookup, concept detail, opaque cursor pagination, and side-effect-free Reader Analyze are
  implemented with provenance and actor ownership enforcement. Real PostgreSQL backend suite:
  446 passed. OpenAPI validation and generated TypeScript freshness passed; Redocly 2.13.0 passed
  with the existing Reader discriminator default-mapping warning. Frontend remained frozen at
  314 tests across 27 files; typecheck, lint, Storybook and production build passed.

- Backend foundation, PostgreSQL schema v1, Memory/Competence engines, five Profile operations, two
  Review operations, five TASK-008 Content/Reader operations, two Today operations, and three
  TASK-012 Brain read operations are implemented, dependency-locked, and PostgreSQL verified.
  Remaining product endpoints stay unimplemented and `contracts/openapi.yaml` remains authoritative.
- Memory transitions use FSRS-6 through py-fsrs 6.3.2 with immutable parameter lineage, one
  learner/concept schedule, actor-scoped transactional persistence and a due-query boundary.
- PostgreSQL remains the sole persistence/graph layer. Learner competence projections are
  separate from the unique learner-concept FSRS lineage. Canonical `learning_events` are append-only
  replay authority; concept and language-profile projections are rebuildable.
- Review queue competence is loaded per concept from `user_concept_states`; a missing/unversioned
  row is a synthetic zero-evidence read and never causes GET-side persistence.
- Imported/curated lexical, content and assessment records trace through source record, source,
  license/attribution, checksum, transform version and review status.
- User-owned database tables use direct ownership keys and Supabase-compatible default-deny RLS.
- Operational health behavior is intentionally outside the versioned public product contract.
- Frontend transport architecture is generated DTOs -> `ApiClient`/`MockApiClient` -> pure adapters
  -> UI view models -> components; no backend business algorithm is computed on the client.
- Concept POS is lexical metadata, not a universal concept property: transport values may be
  omitted/null, and non-lexical grammar/skill presentations do not invent a fallback.
- 3-tier token architecture: Primitive -> Semantic -> Component tokens.
- Design tokens enforce WCAG 2.2 AA contrast, reduced motion, and non-color-only state indicators.
- Contract mocks return deterministic OpenAPI-conforming response DTOs with optional latency/error
  injection; no nonexistent HTTP endpoint is called. The future HTTP transport remains an explicit
  interface boundary only.

## Next

- Private staging deployment hardening is implementation-complete and awaits
  independent deployment review plus external Supabase hosted Auth URL setup;
  do not deploy or push as part of this change.
- TASK-008A and TASK-READ-001 are DONE. Do not start another task without explicit authorization.
- TASK-017 hardening is accepted and DONE (see completed evidence above).
- TASK-017A is DONE and verified (458/458 backend, 338/338 frontend).
- TASK-007 is ACCEPTED and DONE; FRLL F1 is READY_FOR_INDEPENDENT_REVIEW, not FRLL acceptance. R1 remains required and was not started in F1.
- Synchronized preferences, saved-sentence notes, configurable learner new-concept budget, data
  export and account deletion remain future schema/contract decisions. Reader resume position is
  now connected to the existing server-owned reading-progress contract.
