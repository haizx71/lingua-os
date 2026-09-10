# FRLL R1 product gap P1 — Minimal live Brain

Status: READY_FOR_ASTRA_REVIEW — targeted corrections and current gates complete;
not accepted, not committed. Preserve all work for checkpoint review.
Starting HEAD: `41ccb14`.
Authorization: bounded Codex frontend integration under the P1 user request;
not full TASK-013 completion and not execution of R1.

## Scope and authority

Connect `/brain` through normal authenticated ApiClient/HttpApiClient,
generated Brain DTOs, local pure adapters/view models, and existing presentation.
Use frozen summary/list/detail GETs; cursor pagination stays server-owned.
Preserve nullable mastery/memoryHealth, per-dimension confidence/counts and all
eight statuses. No learner formulas, ownership decisions, mutations or fake fallback.

Expected files: `apps/web/src/app/brain/page.tsx`,
`apps/web/src/features/brain/**`, focused `tests/frontend/p1-brain*.test.*`,
this plan, evidence doc, TASKS.md and STATUS.md.
Protected: contracts, services, database, F1 acceptance machinery, Today/Review
semantics and `apps/web/tsconfig.tsbuildinfo`. No R1 or Supabase-user provisioning.

## Execution

1. Luna A/D maps frozen endpoints/types and adjudicates Reader scope read-only.
2. Luna B/C writes failing route/adapter regression tests, then implements the
   smallest live container and presentation integration; separate files from lead.
3. Verify honest loading/error/empty/auth states, actor/profile invalidation,
   same-actor races, cursor traversal, lazy detail and deterministic DTO mapping.
4. Fresh Luna reviewer challenges fixture fallback, stale ownership/lifecycle,
   fabricated projections and tests bypassing the production route.
5. Run focused/frontend/full Vitest, freshness, cache-preserving typecheck, lint,
   relevant presentation/browser and build checks, plus protected diff checks.
6. Record real results and Reader decision, commit bounded changes without push.

Worker concurrency is bounded by available runtime slots. No overlapping writers.
Implementation must stop if a frozen backend/contract defect requires changes.

## Frozen execution contract — resume

This section supersedes the multi-worker sequence above: ONE Luna Max owns all
tightly coupled implementation and tests, followed by one lead checkpoint review
and one fresh read-only Luna reviewer if runtime permits. No source write until
the implementation worker is confirmed active and receives this contract.

A. Objective: replace fixture authority on production `/brain` with existing
authenticated, read-only Brain API projections. No R1 execution.

B. Visible behavior: existing canvas/layout/motion remains; header metrics,
nodes and selected-concept detail reflect returned data. Loading contains no
previous learner values; failure shows a safe localized retry state, never
fixtures/raw server messages. Empty collection is genuinely empty. Nullable
mastery/memoryHealth display unavailable, not zero. Score/confidence/count remain
distinct. Existing design fixtures remain explicit test/Storybook inputs only.

C. Paths: GET `/v1/brain/summary?languageProfileId=...`, GET
`/v1/brain/concepts?languageProfileId=...` with opaque cursor/limit, and lazy GET
`/v1/brain/concepts/{conceptId}` on selection. Detail has no invented profile query.
Reuse normal auth/readiness and ApiClient; production requires HTTP transport.

D. Modules: Brain route; colocated Brain hook, pure adapter/view-model and canvas;
focused `tests/frontend/p1-brain*.test.*`; reconcile existing
`tests/frontend/e2e/f08-language-brain.test.tsx` so presentation checks explicitly
use presentation fixtures while new route tests cover production. Lead owns docs.

E. Forbidden: contracts, services, database, F1 machinery, shared auth foundation,
Today/Review/Reader behavior, design system, GSAP redesign, dependencies unless
justified and separately approved, generated contract output and tsbuildinfo.

F. Invariants: generated DTOs only, no handwritten transport aliases or silent
required-field defaults; reject malformed required values consumed by adapters.
No formulas, scheduling, ownership authority or writes. Preserve exact eight
statuses and nullable fields. Actor epoch/ID, active profile and request sequence
bind responses and errors; no stale actor/profile data on render or async settle.
Same-actor refresh remains valid. Match summary profile/detail concept identities.
Traverse only server cursors, reject cycles/duplicates; fetch details only on demand.
Presentation-only percent formatting/layout is not a new domain projection.

G/H. Sequence and tests:
1. Write independent static DTO/route tests reproducing fixture authority (RED).
2. Add pure mappings: differing score/confidence/count/status/null values map
   directly; malformed required fields reject. No adapter-generated expected data.
3. Wire live loading/summary/list/detail; test real route through client seam,
   unauthenticated/unconfigured, pending, error/retry, empty and detail selection.
4. Test actor/profile switches, same-actor request/detail races, stale success/error,
   pagination and no fixture fallback. Keep all presentation/a11y/motion coverage.
5. Self-review integrated diff and report concise evidence; no worker commits.

I. Gates: focused Brain tests, all frontend and acceptance support/full Vitest,
`pnpm contracts:check-generated`, `pnpm typecheck --incremental false`, `pnpm lint`,
Storybook and production build, `git diff --check`, protected diff and cache check.
Browser presentation smoke where available is P1-only, never R1/auth/live proof.
Do not translate skipped or unavailable runtime tests into PASS.

J. Completion: implementation matches A-I, gates pass, lead checkpoint review has
no Required finding and independent reviewer result is reported honestly.
Only then bounded commit(s), no push. Never mark R1/FRLL DONE or ACCEPTED.

Reader decision: OPTION B, validated by frozen plan section 13 (dictionary/detail,
Today and Review reveal), FRLL-14, section 17 explicit Reader-not-required statement
and section 22 Reader-live exclusion. Do not edit Reader. Future R1 must prove
those existing live passive actions produce no active learning mutation; P1 does
not execute that proof. The newer P1 authorization specifically adds Brain live UI.

## Completion boundary

P1 may reach READY_FOR_INDEPENDENT_REVIEW only. TASK-013 broader completion,
R1 browser/recovery/isolation execution and overall FRLL acceptance are not claimed.

## Previous blocked checkpoint

Both requested GPT-5.6 Luna Max workers (`p1_contract_reader` and
`p1_implementation`) remained `pending_init` across repeated checks/waits and
were interrupted before execution. An additional test worker could not be
created because the tool reported `agent thread limit reached`.
The implementation worker's prewrite release was explicitly revoked.
No source/test edits or verification runs occurred; this plan is the only change.
The cause of runtime unavailability is unknown; do not infer a quota diagnosis.

Resume by starting the mandatory workers successfully, reconfirming current
worktree state and reauthorizing the scoped test-first work. Do not treat this
checkpoint as P1 implementation, independent review, or R1 proof.

Preliminary lead Reader interpretation (pending worker adjudication): frozen
FRLL plan sections 13/17/22 allow Dictionary details, Today navigation and
Review reveal as real passive paths and explicitly exclude Reader live
integration. Prefer option B; do not implement Reader in P1.

## Current runtime recovery

Reconfirmed HEAD `41ccb14` and only this untracked plan. Prior pending workers
were interrupted again, although the runtime listing continued to show
`pending_init` (no reap tool is exposed). A single new `p1_single_worker`
successfully responded ACTIVE before receiving the frozen execution contract.
That worker's subsequent implementation turn remained listed running but returned
no progress evidence or response to progress checks; it was interrupted without
source/test changes. One clean retry, `p1_clean_retry`, then explicitly reported
ACTIVE and execution started. No further startup retry is authorized. Lead will
review only the integrated checkpoint. Runtime causes remain undiagnosed.

## Final continuation point of this resume

The clean-retry worker completed reconnaissance and wrote
`tests/frontend/p1-brain-live.test.tsx`, then reported RED. It subsequently failed
with the explicit runtime error `You've hit your usage limit`. This diagnoses
the clean-retry failure only, not the earlier pending-init/unresponsive attempts.
No further startup retry was made and Astra did not substitute implementation.

Lead reran `pnpm test tests/frontend/p1-brain-live.test.tsx --reporter=dot --silent`:
8 failed / 1 passed, 1 failed file, exit 1 (10.67s). These are unfinished test-first
drafts against the unchanged fixture-backed route, not accepted regression proof
or a green checkpoint. Continue by inspecting the draft tests against A-J, then
implementing the local Brain adapter/hook/presentation and completing the gates.

HEAD remains `41ccb14`. Only this plan and the new test file are untracked.
No production source, existing tests, backend, contracts or migrations changed.
No full suite, typecheck, lint, build or independent review was run this resume.
No commit or push. R1 and FRLL remain incomplete; do not delete these RED drafts
or weaken them merely to make the unfinished working tree green.

## Latest continuation checkpoint — 2026-09-10

The same Luna Max implementation worker completed the first implementation and
reported P1 11/11, F08 6/6, frontend 477/477, full Vitest 592 PASS / 4 SKIP,
generated freshness/typecheck/lint/Storybook/production build PASS. These results
precede the targeted correction below and do not verify the latest working tree.

The single Astra checkpoint review required narrowly scoped corrections:
- Bind rendered data and selected detail to actor epoch/ID, profile and request
  identity immediately, not only when a passive effect clears previous state.
- Invalidate detail success/error/finally across profile/reload/unmount; prove
  same-actor competing requests and stale outcomes through application tests.
- Validate consumed optional presentation fields and preserve absent level
  without manufacturing A0. Add focused malformed-data regression coverage.
- Complete the frozen real-route/client-seam and unauthenticated/unconfigured
  acceptance tests. Mocked transport tests are not real R1 browser evidence.

The same worker partially applied these corrections, then its task reported
`You've hit your usage limit`. On resume the collaboration runtime no longer
listed that worker. Attempting to continue its existing thread was rejected:
`direct app-server input is not allowed for multi-agent v2 sub-agents`.
No replacement implementation worker was spawned; Astra did not take over code.
The current P1 test file still contains 11 tests; the requested new correction
regressions have not been delivered. Independent review has not run.

Lead reran `pnpm test tests/frontend/p1-brain-live.test.tsx --reporter=dot --silent`
on the partial correction: 11/11 PASS, one file, exit 0 (50.64s). This confirms
only existing focused assertions; the missing correction tests and full gates
remain required. No new correction RED result is claimed.

HEAD remains `41ccb14`. Preserve the Brain route, new BrainPage/useBrain files,
Canvas, shared frontend Brain adapters/view models, F08 fixtures and P1 tests.
Contracts/services/database and tsbuildinfo have zero diff. Cache SHA-256 remains
`F20B5AFFFB790F515CD179ED8BF67BE1CAE33EF457BB0200B1D5B5F01399D3BE`.
No commit or push. Resume the same correction checkpoint with an available Luna
Max worker runtime, then rerun required gates and obtain fresh independent review.
Reader OPTION B is unchanged; R1 and FRLL are not DONE or ACCEPTED.

## Subsequent resume — 2026-09-10

Under the new explicit authorization to start one Luna Max worker, lead confirmed
HEAD `41ccb14` and the intact five modified/four untracked checkpoint. Exactly one
new implementation worker, `p1_finish_corrections`, received the existing plan and
targeted correction list. The old `p1_resume_execution` appeared as `pending_init`
and was interrupted to prevent overlapping writers.

The new worker remained listed `running` but returned no ACTIVE acknowledgement,
progress, output or explicit error after repeated bounded checks. Lead interrupted
it and explicitly revoked write authorization. No replacement worker was started.
This is runtime unavailability of unknown cause, not evidence of another quota
failure. No new implementation or verification result was delivered, no independent
review ran, and no commit/push was made. The old green gates are not acceptance
evidence for the unfinished correction. Preserve the existing files and resume
the outstanding correction/tests when the mandatory worker can respond.

## Implementation correction completed — 2026-09-10

The latest user instruction directly assigned the implementation-worker role;
no new sub-agent, redesign, replan, commit or push was used. Previous blocked
entries above are historical, not the current implementation status.

### Corrections and regression evidence

- Bind snapshots to actor epoch/ID, profile, reload, API instance, enabled state
  and auth state. First committed render cannot expose mismatched data/detail.
- Pass the context key to Canvas to isolate selected-concept presentation.
- Bind selection callbacks to their originating render. A stale callback cannot
  launch a request under a new profile or invalidate the current detail request.
- Guard success/error/finally using context and request generations; invalidate
  on unmount. Same-actor refresh preserves a valid in-flight read.
- Update the async identity ref on React commit, not during speculative render.
  A suspended profile transition no longer discards a valid committed response.
- Validate consumed required fields and optional POS/IPA/level/definition text.
  Empty optional IPA remains valid; proficiency codes follow the frozen string
  contract, not the provisional CEFR union. Missing POS/level remain absent;
  no A0 or fake POS is fabricated. No backend formulas or writes were introduced.

Test-first evidence this correction: after fixing the test helper's default
summary/profile mismatch, five new cases failed (first-render API/disable leakage,
valid empty IPA/free-string level rejected, missing definition text accepted).
They passed after correction. A stale-selection callback case then failed before
its fix; a suspended speculative-render case also failed before its fix. Other
new race cases passed against already-present checkpoint guards; no RED is claimed
for those. Existing assertions were preserved. The new definition-error assertion
uses NETWORK_ERROR, matching the existing shared unknown-error mapping, rather
than the test author's initially assumed INTERNAL_ERROR.

P1 tests grew from 11 to 36 (+25). Coverage includes first-commit observation via
layout effects, actor A/B late detail success/error, same-actor list reload and
detail races/finally, stale selection callbacks, unmount, same-actor refresh,
malformed/missing consumed fields, optional fields without fabricated values,
real route plus HttpApiClient at the fetch seam, and unauthenticated/unconfigured
fail-closed states. Deterministic fetch stubs are not live browser/Supabase proof.

### Current-diff verification (all exit 0)

- `pnpm test tests/frontend/p1-brain-live.test.tsx tests/frontend/e2e/f08-language-brain.test.tsx --reporter=dot --silent`: 42 PASS (36 P1 + 6 F08).
- `pnpm test tests/frontend --reporter=dot --silent`: 502 PASS / 36 files.
- `pnpm test --reporter=dot --silent`: 617 PASS / 4 SKIP; 46 passed files, 4 skipped.
- `pnpm typecheck --incremental false`: PASS, including `pnpm contracts:check-generated` and all three workspace typechecks.
- `pnpm lint`: PASS.
- `pnpm build-storybook`: PASS. Existing sourcemap/use-client/eval/chunk-size warnings remain.
- `pnpm build`: PASS; 15 static pages, Brain 9.66 kB / 239 kB first load. Existing Next ESLint-plugin warning remains.
- `git diff --check`: PASS. Protected contracts/services/database/generated/F1 paths: zero diff.
- tsbuildinfo SHA-256 unchanged: `F20B5AFFFB790F515CD179ED8BF67BE1CAE33EF457BB0200B1D5B5F01399D3BE`.

Four skipped tests are the existing environment-conditional acceptance B/C/D/E
tests; none were added or disabled here. Browser DevTools MCP is unavailable;
no manual/browser visual smoke or R1 live proof is claimed. Build output remains
ignored, with no new tracked/untracked cache or runtime artifacts.

### Self-review and handoff

Self-review checked render/commit identity separation, closure dependencies,
request invalidation, late success/error/finally, fail-closed mappings, preserved
Reader OPTION B, and protected paths. No unresolved correction was identified
in that review. This is implementation self-review, not Astra/independent approval.

Changed/untracked P1 files relative to HEAD `41ccb14`:
- `apps/web/src/app/brain/page.tsx`
- `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
- `apps/web/src/features/brain/BrainPage.tsx`
- `apps/web/src/features/brain/useBrain.ts`
- `packages/types/src/adapters/index.ts`
- `packages/types/src/view-models.ts`
- `tests/frontend/e2e/f08-language-brain.test.tsx`
- `tests/frontend/p1-brain-live.test.tsx`
- `plans/FRLL-R1-P1-live-brain.md`

Final working state: five modified and four untracked files. HEAD remains
`41ccb14`; no commit/push. Astra checkpoint review remains required. P1 is not
accepted; TASK-013, R1 and FRLL completion/acceptance are not claimed. R1 real
browser/reload/lost-response/Actor-B proof remains separate and was not started.
