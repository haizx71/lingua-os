# PILOT-005 — Explicit Reader Content Selection: Independent Plan Review

Date: 2026-10-10
Reviewer configuration: GPT-6 Luna / Max (configured reviewer model; runtime introspection unavailable)

## Verdict

**PASS for the bounded plan.** No open HIGH or BLOCKER finding. The source-confirmed mismatch is reproduced in an isolated pre-fix regression, so a bounded implementation is justified for root consideration. P1 remains a candidate severity for an explicit content-selection action; this review does not claim a reported real-learner impact. Runtime implementation remains gated on explicit root authorization.

## Frozen evidence

- Plan reviewed: `plans/PILOT-READER-EXPLICIT-SELECTION.md`, SHA-256 `3ce963ed46292bc563e06e7f01dbc8181c0bbddbb7078ee23cf749a6f4601164`.
- Pre-fix reproduction packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-explicit-selection-prefx.md`, SHA-256 `50855763b04b62c59a7596c9cd32bdcdd3afa558a14a1ce4185c74f148a24a9d`.
- The reproduction ran the real `/read` page component with a synthetic authenticated actor and `MockApiClient`. With `?contentId=<second article>`, the page rendered “First recommendation” and fetched its ID instead of the requested second article. The focused test failed 1/1 as expected before the fix. It made no hosted request or learner write.
- The reproduction packet's historical plan hash predates the route-interface and stale-action wording refinements recorded below; its code/source observations and red result are unchanged.

## Plan and safety review

The current Reader route ignores the query, and the hook chooses recommendation zero before calling `getContent`. The per-item Library link has no ID; Today already exposes an optional `contentId` but currently routes read/listen to `/read`. These observations match the plan. The existing authenticated `GET /v1/content/{contentId}` path is sufficient: the backend detail query requires the actor's active English profile and both `publication_status = 'published'` and `reader_content_passes_publication_gate`. No new API, backend, schema, Auth, RLS, grants or recommendation ranking change is warranted.

The plan now defines the ephemeral `requestedContentId?: string | null` interface precisely: `undefined` means absent and retains recommendation mode; a single supplied string is validated exactly, including blank/whitespace values; `null` marks a duplicate selector and fails closed. The existing Next.js 15 page `searchParams` promise supplies it. A bounded UUID check and returned identity comparison prevent malformed or mismatched selection; valid case normalization is allowed only where needed for server UUID equality. An explicit failure never falls back to a recommendation.

The plan also requires route/content identity, actor epoch/identity, active profile and operation sequence guards across load and every asynchronous lookup, save, exposure and progress action. Requests use the passage/profile captured when the action began. An already-dispatched A mutation may finish against A, but its late success, error, inspector, progress, saved-state or `finally` update cannot alter B or clear B's busy state. It must not be canceled or reissued in a way that changes existing persistence or idempotency behavior. Regression gate 3 now explicitly covers lookup, sentence/content save, and progress/exposure across A→B, alongside retry, profile, actor and logout changes.

The selected-item route is limited to existing Library/Today actions that already possess a content ID. Generic `/read` remains recommendation-first. Published-content selection does not imply publication of the separate Vietnamese candidate. No learner activity, persistence semantics, default recommendation behavior, or UI control is added.

## Severity and limits

The red regression confirms the expected-versus-actual mismatch for an explicit selection. Because silently opening another article can defeat a core read/resume action, **P1 candidate** is a proportionate implementation priority once root authorizes it. The evidence is synthetic and local; no live journey, production impact, learner report, or learning outcome is established. This review accepts the bounded remedy design and does not authorize hosted requests or a runtime edit.

## Later scope disposition — 2026-10-10

A subsequent Max scope decision classifies PILOT-005 as a **P2 product gap in the explicit-selection slice**, not an authorized P1. This narrows the earlier review's P1-candidate severity language; it does not invalidate the isolated pre-fix reproduction or the bounded plan review. The accepted Reader review says content browsing/selection is a separate product slice ([TASK-READ-001](TASK-READ-001-reader-live-integration.md#L46)); the accepted Library review records that no content-ID deep-link contract was frozen ([TASK-LIBRARY-001](TASK-LIBRARY-001-library-live-integration.md#L46)). No accepted READ-002 scope is cited. A specific owner-approved P2 exception is pending, so this disposition does not authorize implementation, hosted activity, or claim a learner outcome.
