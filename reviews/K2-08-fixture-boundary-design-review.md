# K2-08 Fixture Boundary Design Review

**Design decision:** PASS on the immutable plan amendment `b0ed865ddc570b5647efb31e479c10b73c9e41a8`; independent review reported no HIGH or BLOCKER findings.
**Design worker:** GPT-6 Luna, reasoning effort Max (configured by the task dispatcher; no deeper runtime introspection claimed).
**Independent reviewer:** GPT-6 Luna, reasoning effort Max (configured review assignment).
**Source decision:** PASS on immutable source `64bbd4df71ce9483290b5d86562ef5722d3ceddd`; independent configured GPT-6 Luna / Max review found no remaining HIGH/BLOCKER.
**Scope:** records approved architecture, implementation checks and independent source review. CI results, migration rollout, content publication and hosted acceptance remain separate gates.

## Review history

- Plan commit `66e85560d14f5529bc35fb52072779af293f473c` was NO-GO.
- The first revised design at `2a00743eb3dbe978ec9f212ad8d46cbb61141a8f` closed the initial privilege-split findings. A later rank-feasibility review found that the hosted scenario must not claim a fabricated adverse production `source_rank`.
- The immutable amendment at `19a11b2b4a1b4cce676dd4746bf1c7dfb29dc266` separates baseline catalog fit order from actual Today V2 order and was independently approved with no HIGH/BLOCKER findings.
- The further immutable amendment at `b0ed865ddc570b5647efb31e479c10b73c9e41a8` was independently approved with no HIGH/BLOCKER findings. It narrows hosted evidence to the reader-proven baseline and bounded actor state, exact filtered K2-05 status reads, and actual persisted `/v1/today` output. It requires exact-state/time source differential coverage in credential-free PostgreSQL CI, a complete finite candidate bound, A/B's 20 due concepts disjoint from the eligible catalog, and normal-session cross-actor completion denial.
- The approved rollout order is normal reviewed source merge to master, root-owned migration/checksum/ledger reconciliation and separately authorized `0020`, then protected master-only hosted acceptance after content approval. A hosted pre-merge gate is not part of the design.

## Accepted architecture

The protected runner retains the existing Auth Admin and service-role credentials. It gives wave code sanitized actor handles and fixed, actor-bound normal API closures. Only the runner may create the two reviewed synthetic state fixtures or inspect the exact fresh actor's projected effective status. The read-only probe remains the catalog/base-candidate and retained-snapshot reader. No new roles, grants, policies, secrets, Auth SQL access, production API changes, or RLS changes are part of the design.

The four fresh actors separately cover the 20-due control, forgotten over weak with the daily reserve, weak over novel, and novel-only control. Hosted code does not claim that a local baseline sort is the live Today V2 order and does not call a live unprivileged Today candidate-list endpoint. The credential-free PostgreSQL differential proves the production candidate set, rank, eligibility, classification, and exact policy outcome for the same bounded synthetic A/B/C/D states and transaction time. Hosted assertions then check actor-bound inputs and the API's persisted winner, reason codes, budget, and replay. Adversarial source-rank precedence remains covered by pure policy tests. Content eligibility and human publication approval remain prerequisites.

## Current implementation checkpoint

The isolated implementation branch includes the normal merge of PR #35 source commit `ecb830418e81cc60e573fe91acf7382563ac0568` (merge `ef1a79e8d012cad9a049e33bd1ed3972e800ee31`), the accepted design, and the amendments through `b0ed865ddc570b5647efb31e479c10b73c9e41a8`. The shared privacy foundation was checkpointed at `8613cd6985f66a315223d47d1bb2cd02b0f47c5e`. Its independent review reported no HIGH/BLOCKER but required follow-up on route DTO allowlists and reader-only ambiguous base-state readback; the request-metadata replay concern was later retracted. The completed bounded implementation is committed at `3f08a3b7406b90593749b898c9130e5b02b28400` (`feat(acceptance): split K2-08 fixtures from learner sessions`); it adds route-specific DTO projections, fixed actor-bound setup/readback and cleanup, the four-actor wave, complete baseline/post-fixture candidate eligibility checks, credential-free PostgreSQL source differential coverage, and CI selectors/type coverage.

Local source checks for `3f08a3b7406b90593749b898c9130e5b02b28400`: the hosted security selector passed 10 files / 170 tests; the runner suite passed 32 tests; the read-only probe suite passed 25 tests; the focused harness TypeScript project and workspace `pnpm typecheck` passed; changed-runner ESLint, Python byte-compile, the new PostgreSQL test's Ruff checks, and `git diff --check` passed. The credential-free PostgreSQL differential test is included in the existing `knowledge-audit-ci.yml` Today PostgreSQL job, but could not be run locally because PostgreSQL/Docker are unavailable; its CI result remains pending. This is not a hosted acceptance PASS.

Independent source review at `2e03543430ff5cb85d32dff505fd0ce46d547af1` found one HIGH: Today DTO projection dropped the required response profile without validating the actor binding. Fix `64bbd4df71ce9483290b5d86562ef5722d3ceddd` privately binds the wrapper to the actor's validated profile, checks Today GET and nested completion plan ownership before projecting any IDs, and confirms completion plan/activity IDs match the route. Wrong, missing, malformed and unbound profiles fail with fixed redacted errors. Unexpected cross-profile HTTP 200 fails before parsing its body. No profile UUID is exposed to the wave.

The implementation worker's four focused suites passed 54 tests, focused harness TypeScript and runner ESLint. The separate reviewer independently ran the focused runner suite (35/35), checked the immutable diff, and combined the fix review with the preceding whole-source review: PASS, no remaining HIGH/BLOCKER at `64bbd4df71ce9483290b5d86562ef5722d3ceddd`. Both workers were configured GPT-6 Luna / Max. Root records this evidence and owns PR/cloud integration; no hosted PASS is inferred.

The latest read-only staging aggregate reports zero eligible published English Reader items and application migration head `0017`; the platform migration tail and 0018/0019 ledger reconciliation remain separately root-owned rollout gates. The prepared A2 article is not editorially or rights approved and is not published. No candidate may be described as eligible, no migration `0020` may be applied, and no hosted full K2-08 PASS may be claimed until their separate gates complete. The accepted K2-07 result is unchanged.

## Review limits

The design approval applies to immutable plan `b0ed865ddc570b5647efb31e479c10b73c9e41a8`; the separate source approval applies to `64bbd4df71ce9483290b5d86562ef5722d3ceddd`. Neither closes credential-free PostgreSQL execution, exact-head CI, content publication, migration rollout or hosted acceptance. Root retains PR and cloud gates. K2-06 and K2-07 accepted hosted evidence remains unchanged.
