# Reviewer Report: GSAP Lifecycle, Timings & Non-Blocking Evaluation (Milestone 2 & 3)

**Reviewer ID**: `reviewer_m2_1`  
**Target Milestone**: Milestone 2 & 3 (P0/P1 GSAP Learning Loop & A11y)  
**Target Components**: `ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`, `ProgressAnalytics`  
**Verdict**: `APPROVE`  

---

## 1. Observation

1. **ReviewCard (`packages/ui/src/components/ReviewCard/ReviewCard.tsx`)**:
   - `useGSAP` hook cleanly scoped to `containerRef`.
   - `answerRef` receives `opacity: 0 -> 1, y: 8 -> 0` in 0.25s (`power2.out`), clearing transforms on completion.
   - `handleRatingPress` wrapped in `contextSafe`; `onRate?.(rating)` called synchronously without delay.
   - Reduced-motion branch immediately applies `opacity: 1, y: 0` with 0s duration.

2. **ReviewSession (`apps/web/src/features/review/ReviewSession.tsx`)**:
   - `sessionCardRef` wrapped in `useGSAP` with `[currentIndex]` dependency.
   - Initial mount suppressed via `isInitialMount.current`.
   - Space and 1–4 keystrokes advance React state and dispatch `onRatingSubmit` synchronously on frame 0.
   - Rapid keystrokes protected by `overwrite: 'auto'`.

3. **LanguageBrainCanvas (`apps/web/src/features/brain/LanguageBrainCanvas.tsx`)**:
   - `animateCamera` wrapped in `contextSafe`.
   - Pan duration 400ms (`motionSeconds.slow`), zoom clamped strictly between 50% and 150%.
   - Soft coordinate boundary clamping prevents canvas over-scrolling.

4. **ConceptNode (`packages/ui/src/components/ConceptNode/ConceptNode.tsx`)**:
   - 200ms scale pulse (`1.0 -> 1.05 -> 1.0`) on status upgrade or selection change.
   - `prevStatusRef` and `prevSelectedRef` prevent unprompted mount animations.
   - `clearProps: 'transform'` removes leftover scale values.

5. **ProgressAnalytics (`apps/web/src/features/progress/ProgressAnalytics.tsx`)**:
   - Staggered entrance for `.analytics-bar-fill` (0.25s duration, 0.05s stagger).
   - Invariant 3 verified: `aria-valuenow`, `aria-valuemin/max`, and text labels present on frame 0.

---

## 2. Logic Chain

All implementation choices adhere directly to `MOTION_DESIGN.md` §4, `MOTION_AUDIT.md`, and Invariants 1, 2, and 3. Lifecycle cleanup ensures zero memory leaks or dangling tweens upon unmount.

---

## 3. Verification Method & Result

- Executed `npx vitest run tests/frontend/motion.test.tsx`: 15/15 passed.
- Executed `npx vitest run`: 26 test files / 324 tests passed.
- Executed `npx pnpm typecheck`: 0 errors.
- Executed `npx pnpm lint`: 0 warnings.
- Verdict: **APPROVE**.
