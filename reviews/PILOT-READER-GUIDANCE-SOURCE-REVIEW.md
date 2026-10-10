# PILOT Reader Guidance Source Review

**Verdict: PASS — no P0, P1, P2, HIGH, or BLOCKER findings in the reviewed source scope.**

## Review identity and frozen inputs

- Reviewer configuration: GPT-6 Luna, Max reasoning effort (configured for this independent review; runtime model introspection is unavailable).
- Review date: 2026-10-10.
- Worktree branch: `codex/pilot-reader-guidance-followup`.
- Review base: `af813819729ac36e1df432c7af28465f8d1cdc36`.
- Source file SHA-256: `apps/web/src/features/read/InteractiveReader.tsx` — `ae1bcc70ca6af68b29e0bc0a71a945c41b5fdc8df793f297fc1b5bd7e29676c3`.
- Test file SHA-256: `tests/frontend/task-read-001-reader-live.test.tsx` — `1aefff65d59d37d8e20b6f2828c2e99ab1960f20674ffe15be797365945509ac`.
- Approved translation-candidate reference: `knowledge/staging/pilot-reader-vi-draft/translation-draft.json`, SHA-256 `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`. This source review does not validate editorial, rights, CEFR, or publication approval for that candidate.

## Findings

No P0/P1/P2, HIGH, or BLOCKER findings were identified in the two reviewed files.

The guidance note distinguishes word lookup and explicit “Lưu vào ôn tập” from sentence/article bookmarks. The review link is rendered only after the existing concept-save handler reports success; the failure path retains its error and does not create a new success notice. The link uses the expected `/review` route, disables Next prefetch, and is activated only by the learner.

The Today link is conditional on `passage.progress?.isCompleted`, which the existing session hook sets from the progress response after the explicit completion action. It is also a normal user-controlled link with prefetch disabled. The new UI does not request Today or Review data on mount or when rendering either link.

Translation reveal remains a local disclosure of the translation already supplied on the sentence. Its handler only updates local revealed-sentence state. Sentence/content bookmarks continue using their separate existing save methods; they do not invoke concept activation, FSRS, or the new Review prompt.

The focused tests cover the success-only Review affordance, failed concept save, bookmark separation, absence of the Today link before completion, server-confirmed completion, and translation reveal without concept/exposure calls. The accessible names are explicit, the guidance uses a note role, and new links have visible focus styling and a 44px minimum target height.

## Verification

- Independently ran `pnpm exec vitest run tests/frontend/task-read-001-reader-live.test.tsx --reporter=dot`: **16/16 tests passed**.
- `git diff --check` for the two reviewed paths against the review base passed.
- The implementation packet reports live-subset, presentation, targeted typecheck, and targeted lint passes; those additional gates were not independently rerun during this review.

## Scope and limits

This verdict covers only `InteractiveReader.tsx` and `task-read-001-reader-live.test.tsx` at the hashes above. The separate Admin translation-authoring contract and hosted-acceptance plan are outside this review. No hosted calls, real-learner activity, translation publication, or backend changes were reviewed or performed. This is not a claim of measured learner benefit or publication readiness. Keep the separate editorial, rights, CEFR, exact-match, and publication gates intact.
