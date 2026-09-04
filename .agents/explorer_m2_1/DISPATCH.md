## 2026-08-22T04:19:02Z
You are the Review Domain Motion Explorer for Milestone 2.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1

Scope & Context:
- Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md
- Read d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- Read d:/LINGUA_OS_PROJECT_STARTER/design-system/MOTION_DESIGN.md
- Read d:/LINGUA_OS_PROJECT_STARTER/design-system/MOTION_AUDIT.md
- Inspect `packages/ui/src/components/ReviewCard/ReviewCard.tsx`
- Inspect `apps/web/src/features/review/ReviewSession.tsx`

Your task:
1. Analyze the exact GSAP motion integration for:
   - `ReviewCard.tsx`: Coordinated 200–250ms answer reveal (smooth flip / cross-fade using `useGSAP` with scoped ref and `power2.out`), 150ms rating button press feedback (scale 0.98 -> 1.0), maintaining immediate keyboard input responsiveness (Space / 1-4 shortcuts) without locking or delaying state.
   - `ReviewSession.tsx`: 150ms lateral slide-out and slide-in queue progression (`x: -20 -> 0`, `opacity: 0 -> 1`) when advancing to next queue card via `contextSafe` event handler or `useGSAP` watching `currentIndex`.
2. Ensure strict adherence to:
   - Motion Invariant 1: Primary feedback <= 300ms, zero-blocking inputs / shortcuts.
   - Motion Invariant 2: GSAP vs CSS boundary.
   - Motion Invariant 3: Immediate semantic DOM/ARIA data correctness.
   - Accessibility Invariant: Instant `gsap.set` / `duration: 0` when `prefers-reduced-motion: reduce`.
3. Provide concrete TypeScript implementation snippets and architectural guidelines.
4. Write your findings and strategy in d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1/handoff.md following the Handoff Protocol.
5. Send a message to parent when finished.
