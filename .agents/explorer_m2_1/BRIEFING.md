# BRIEFING — 2026-08-22T04:21:15Z

## Mission
Analyze exact GSAP motion integration for ReviewCard.tsx and ReviewSession.tsx in Milestone 2, ensuring zero-latency keyboard shortcuts, accessible reduced motion, and clean GSAP/React integration.

## 🔒 My Identity
- Archetype: explorer
- Roles: Review Domain Motion Explorer
- Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1
- Original parent: cd8f684c-56a5-47f8-82fa-fd9f5c0d7047
- Milestone: Milestone 2 (Review Domain Motion)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in source tree
- Adhere strictly to Motion Invariants 1, 2, 3 and Accessibility Invariant
- Produce 5-component handoff.md report with concrete TypeScript implementation snippets and architectural guidelines

## Current Parent
- Conversation ID: cd8f684c-56a5-47f8-82fa-fd9f5c0d7047
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `packages/ui/src/components/ReviewCard/ReviewCard.tsx`
  - `packages/ui/src/components/ReviewCard/ReviewCard.stories.tsx`
  - `apps/web/src/features/review/ReviewSession.tsx`
  - `apps/web/src/app/review/page.tsx`
  - `apps/web/src/fixtures/reviewFixture.ts`
  - `packages/ui/src/tokens/primitive.ts`, `semantic.ts`, `component.ts`, `theme.css`
  - `packages/ui/src/hooks/usePrefersReducedMotion.ts`
  - `tests/frontend/e2e/f06-smart-review.test.tsx`, `components.test.tsx`, `challenger.motion-reduced.adversarial.test.tsx`
  - `design-system/MOTION_DESIGN.md`, `MOTION_AUDIT.md`, `PROJECT.md`
- **Key findings**:
  - `ReviewCard.tsx` in `@lingua/ui` needs `useGSAP` with scoped ref for coordinated 200–250ms answer reveal (`opacity: 0 -> 1, y: 8 -> 0`, `power2.out`), 150ms rating button press feedback (`scale: 0.98 -> 1.0`), and immediate `onRate` invocation.
  - `ReviewSession.tsx` in `@lingua/web` needs `useGSAP` watching `currentIndex` for 150ms lateral slide progression (`x: 20 -> 0`, `opacity: 0 -> 1`), while keeping Space / 1-4 shortcuts 100% non-blocking.
  - Both components must collapse instantly to `duration: 0` / `gsap.set` when `prefers-reduced-motion: reduce` is detected.
- **Unexplored areas**: None for Review domain.

## Key Decisions Made
- Use `useGSAP({ scope: containerRef })` with `gsap.registerPlugin(useGSAP)` at client module boundary.
- For rating button clicks, use `contextSafe` with `fromTo` (`scale: 0.98 -> 1.0`, 150ms) and dispatch `onRate` immediately on the same event tick.
- For queue progression, use `useGSAP` with `dependencies: [currentIndex]` and initial mount guard to play 150ms lateral entrance without delaying DOM/ARIA updates.
- Use `overwrite: 'auto'` to ensure rapid-fire keyboard input seamlessly interrupts prior tweens without stuck styles or animation queues.

## Artifact Index
- d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1/BRIEFING.md — Persistent working memory
- d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1/progress.md — Liveness heartbeat
- d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1/DISPATCH.md — Incoming dispatches
- d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_1/handoff.md — Final 5-component handoff report
