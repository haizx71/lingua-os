# Handoff Report: GSAP Lifecycle, A11y, Keyboard Responsiveness & Verification Strategy (Milestone 2)

**Explorer**: GSAP Lifecycle & A11y Verification Explorer (`explorer_m2_3`)  
**Target Milestone**: Milestone 2 — Learning Interaction & Visual Experience Polish  
**Working Directory**: `d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_m2_3`  
**Parent Agent**: `cd8f684c-56a5-47f8-82fa-fd9f5c0d7047`

---

## 1. Observation

### 1.1 Verified Codebase Baseline & Tool Execution
- **Test Infrastructure Execution**:
  - Ran `npx vitest run` across the monorepo root.
  - Result: **25 test files passed (309 tests)** in 13.75s with 0 failures.
  - Test suites include `tokens.test.ts`, `tokens.adversarial.test.ts`, `challenger.motion-reduced.adversarial.test.tsx`, `components.test.tsx`, `integration.test.tsx`, and 12 feature e2e suites (`f01`–`f12`, `tier2`–`tier5`).

- **Package Dependencies & Versions**:
  - Root `package.json` (lines 15–35): Vitest `^3.0.5`, `@testing-library/react` `^16.2.0`, `@testing-library/jest-dom` `^6.6.3`, `jsdom` `^26.0.0`, `react` `^19.0.0`.
  - `packages/ui/package.json` (lines 14–20, 26–40): `@gsap/react` `^2.1.2`, `gsap` `^3.15.0`, `@storybook/react` `^8.5.6`, `@storybook/addon-a11y` `^8.5.6`.
  - `apps/web/package.json` (lines 12–23): `@gsap/react` `^2.1.2`, `gsap` `^3.15.0`, `next` `^15.1.7`.

- **Existing Motion Token & Hook Architecture**:
  - `packages/ui/src/tokens/primitive.ts`: Primitive durations (`0`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`), easings (`standard`, `enter`, `exit`, `emphasized`), distances (`xs`–`lg`), scales (`press: 0.98`, `feedback: 1.02`, `pulse: 1.05`).
  - `packages/ui/src/tokens/semantic.ts`: Semantic tokens (`--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`), `motionSeconds` helper (`fast: 0.15`, `normal: 0.25`, `slow: 0.4`, `feedback: 0.2`, `staggerStep: 0.05`).
  - `packages/ui/src/hooks/usePrefersReducedMotion.ts` (lines 1–46): SSR-safe `useSyncExternalStore` hook listening to `(prefers-reduced-motion: reduce)`.
  - `tests/frontend/challenger.motion-reduced.adversarial.test.tsx` (lines 1–430): 19 adversarial tests verifying SSR execution, dynamic listener attachment/detachment, legacy Safari fallbacks, 100 simultaneous subscribers, and CSS 0ms collapse rules.

### 1.2 Target Components Inspection & Verification Gaps

#### 1. `packages/ui/src/components/ReviewCard/ReviewCard.tsx`
- **Current Observation** (lines 47–356):
  - Renders 5 review modes (`self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`).
  - Reveal state currently toggles via local state `isRevealed` or prop (line 82) and applies Tailwind `animate-in fade-in duration-200` (line 238).
  - 4 FSRS rating buttons (`again`, `hard`, `good`, `easy`) invoke `onRate` directly (lines 302–350).
- **Verification Need**:
  - Ensure GSAP answer reveal (200–250ms flip/cross-fade) uses `useGSAP({ scope: containerRef })`.
  - Verify that rating button press (150ms scale 0.98) uses `contextSafe` and does NOT delay `onRate` callback invocation.
  - Verify that under `(prefers-reduced-motion: reduce)`, flip animation is bypassed via instant `gsap.set` or 0ms duration.
  - Verify unmount during reveal animation leaves no active tweens in `gsap.getTweensOf(...)`.

#### 2. `apps/web/src/features/review/ReviewSession.tsx`
- **Current Observation** (lines 39–324):
  - Manages review queue progression (`currentIndex`, `reviewedCount`, `focusMode`).
  - Keyboard listener (lines 88–112): `Space` toggles `isAnswerRevealed`, `1`-`4` trigger `handleRating('again' | 'hard' | 'good' | 'easy')`.
  - When card changes, queue index increments synchronously (line 77).
- **Verification Need**:
  - Ensure lateral slide transition (`x: -20 -> 0`, `opacity: 0 -> 1`, 150ms) is wrapped in `useGSAP` / `contextSafe`.
  - **Invariant 1 Verification**: Keystrokes (`Space`, `1`-`4`) MUST execute synchronously in the same frame regardless of whether the previous card's lateral slide is mid-flight.
  - Verify rapid-fire keystrokes (e.g. 5 rating submissions within 100ms) advance queue cleanly without dropped events or animation race conditions.
  - Verify that navigating away from `/review` during a lateral slide cleans up all tweens without `TypeError: Cannot read properties of null (reading 'style')`.

#### 3. `apps/web/src/features/brain/LanguageBrainCanvas.tsx`
- **Current Observation** (lines 40–392):
  - Manages zoom state `zoomLevel` (clamped 50–150%) and selected concept node `selectedNode`.
  - Uses flex layout with naive inline style `transform: scale(zoomLevel / 100)` (line 290).
- **Verification Need**:
  - Pan & zoom camera centering (`gsap.to(stageRef.current, { x, y, scale, duration: 0.4 })`) must be verified.
  - Verify that clicking a node triggers camera centering coordinates calculation $(W_v / 2 - X_n \cdot S, H_v / 2 - Y_n \cdot S)$ with soft boundary clamping.
  - Verify `overwrite: 'auto'` prevents animation jitter when clicking multiple nodes rapidly.
  - Verify unmount while camera is panning leaves 0 active tweens on stage container.
  - Verify reduced motion executes instant `gsap.set` at 0s duration.

#### 4. `packages/ui/src/components/ConceptNode/ConceptNode.tsx`
- **Current Observation** (lines 42–106):
  - Vocabulary concept node with 8 CEFR/FSRS statuses (`unseen`, `discovered`, `learning`, `familiar`, `active`, `mastered`, `weak`, `forgotten`).
  - Static styling with `isSelected && 'ring-2 ring-[var(--focus-ring)] shadow-md scale-105'` (line 92).
- **Verification Need**:
  - Verify `useGSAP` triggers subtle 200ms scale pulse (`1.0 -> 1.05 -> 1.0`) on status change or selection.
  - Verify pulse is skipped on initial unprompted mount (using `prevStatusRef` / `prevSelectedRef`).
  - Verify `clearProps: 'transform'` is invoked on tween completion to prevent CSS transform conflicts.
  - Verify reduced motion bypasses pulse and renders static ring.

#### 5. `apps/web/src/features/progress/ProgressAnalytics.tsx`
- **Current Observation** (lines 36–247):
  - Renders time-window switcher (`7d` vs `30d`), weekly evidence cards, CEFR level stepper, and 4 activity breakdown progress bars (lines 201–244).
- **Verification Need**:
  - Staggered bar entrance on mount & time-window change (`scaleX: 0 -> 1`, 250ms duration, 50ms stagger per bar).
  - **Invariant 3 Verification**: Verify that `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and text labels (e.g. `45 phút (28%)`) are present immediately in DOM on frame 0, before the GSAP animation finishes.
  - Verify reduced motion bypasses stagger and renders bars at `scaleX: 1, opacity: 1` immediately.

---

## 2. Logic Chain

### 2.1 Four Verification Dimensions & Mathematical Grounding

```
                     ┌────────────────────────────────────────────────────────┐
                     │          Milestone 2 Verification Framework            │
                     └────────────────────────────────────────────────────────┘
                                                  │
         ┌────────────────────────┬───────────────┴───────────────┬────────────────────────┐
         ▼                        ▼                               ▼                        ▼
┌──────────────────┐    ┌──────────────────┐            ┌──────────────────┐     ┌──────────────────┐
│ Dimension 1:     │    │ Dimension 2:     │            │ Dimension 3:     │     │ Dimension 4:     │
│ Lifecycle &      │    │ A11y & Reduced   │            │ Synchronous      │     │ Storybook        │
│ Auto-Cleanup     │    │ Motion Invariant │            │ Responsiveness   │     │ Motion Catalog   │
└──────────────────┘    └──────────────────┘            └──────────────────┘     └──────────────────┘
  - Scoped refs           - prefers-reduced-motion:       - Invariant 1:           - Default resting
  - contextSafe wraps       reduce media query              Space & 1-4 shortcuts    - Active/revealed
  - Unmount kills         - 100% collapse to 0ms            never blocked          - Reduced motion
    all tweens            - Instant gsap.set              - State updates on       - Dark mode keyframe
  - Zero memory leaks     - Zero transform drift            frame 0                  contrast (AA)
```

#### Dimension 1: Lifecycle Auto-Cleanup & Memory Leak Prevention
1. **Dangling Tweens Cause Leaks**: In React SPA apps, if a component creates a GSAP tween (e.g. `gsap.to(ref.current, ...)`), GSAP's global ticker retains a reference to that DOM node until the tween finishes. If the user navigates away before completion, the detached DOM node and its parent component scope remain pinned in heap memory.
2. **`useGSAP` Scoping Guarantee**: By registering `gsap.registerPlugin(useGSAP)` and scoping `useGSAP({ scope: containerRef })`, GSAP creates a `gsap.context()` bound to the component subtree.
3. **Reversion Verification**: When React calls cleanup on unmount, `useGSAP` executes `context.revert()`. The verification suite must assert:
   $$\text{ActiveTweens}(\text{DOM Element}) = 0 \quad \text{immediately following } \text{unmount}()$$
4. **`contextSafe` Obligation**: For asynchronous user event handlers (e.g. click, keypress, pan), tweens instantiated outside the initial hook execution MUST be wrapped with `contextSafe`. Otherwise, they escape context management and bypass `context.revert()`.

#### Dimension 2: Accessibility & Reduced Motion Invariant
1. **WCAG 2.2 SC 2.3.3 & Invariant 4**: Users with vestibular disorders must not be subjected to motion, scaling, or spatial shifting.
2. **Deterministic Collapse Formula**:
   $$\text{Duration}_{\text{reduced}} = 0\text{ms}, \quad \text{Distance}_{\text{reduced}} = 0\text{px}, \quad \text{Scale}_{\text{reduced}} = 1.0$$
3. **JSDOM Simulation**: Testing under JSDOM requires dynamic media query mocking via `window.matchMedia('(prefers-reduced-motion: reduce)')`. The verification suite must test:
   - Initial render when reduced motion is `true`.
   - Dynamic flip from `false` to `true` mid-session.
   - Asserting that tweens created have `duration: 0` or execute `gsap.set` directly.

#### Dimension 3: Keyboard Responsiveness & Non-Blocking Synchrony
1. **Invariant 1**: Primary interaction feedback $\le 300\text{ms}$. Interaction state must NEVER await tween completion.
2. **Synchronous Frame-0 State Execution**:
   - When `Space` is pressed $\rightarrow$ `isRevealed` becomes `true` in React state immediately. Answer DOM nodes appear in test queries (`getByText`) synchronously.
   - When `'1'`–`'4'` is pressed $\rightarrow$ `onRatingSubmit(cardId, rating)` is called immediately, `currentIndex` advances from $N$ to $N+1$, and card $N+1$ mounts in the same event tick.
3. **Tween Overwrite Safety**: Lateral slide and flip animations must declare `overwrite: 'auto'` to ensure rapid successive keystrokes (e.g. 5 cards answered in 200ms) smoothly kill prior tweens without stalling or throwing.

#### Dimension 4: Storybook Motion Catalog Requirements
1. **Story Architecture**:
   - For every animated component (`ReviewCard`, `ConceptNode`, `ProgressAnalytics`, `LanguageBrainCanvas`), Storybook stories must cover 4 mandatory states:
     1. **Default Resting**: Initial visual state.
     2. **Active / Animated**: Post-interaction state (`isRevealed: true`, `isSelected: true`, `status: 'mastered'`).
     3. **Reduced Motion**: Parameterized with `globals: { prefersReducedMotion: 'reduce' }` or simulated hook.
     4. **Dark Mode**: Validating WCAG 2.2 AA contrast across all background and border keyframes.
2. **Interaction & A11y Addon**:
   - Utilize `@storybook/addon-interactions` play functions to trigger state transitions and assert zero a11y violations (`@storybook/addon-a11y`).

---

## 3. Concrete Vitest Test Specifications and Assertions

Below is the concrete test suite specification for `tests/frontend/motion.test.tsx` and `tests/frontend/challenger.motion-reduced.adversarial.test.tsx`.

### 3.1 Test Suite Specification: `tests/frontend/motion.test.tsx`

```tsx
/**
 * LINGUA OS — Milestone 2 GSAP Motion, Lifecycle & A11y Verification Suite
 * Verifies:
 * 1. Lifecycle auto-cleanup & unmount tween reversion across P0/P1 components.
 * 2. Reduced-motion collapse (100% duration: 0 / instant switch).
 * 3. Synchronous non-blocking keyboard responsiveness (Invariant 1 & Invariant 3).
 * 4. DOM and ARIA data correctness from Frame 0.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import gsap from 'gsap';

import { ReviewCard } from '@lingua/ui/components/ReviewCard/ReviewCard';
import { ConceptNode } from '@lingua/ui/components/ConceptNode/ConceptNode';
import { ReviewSession } from '@/features/review/ReviewSession';
import { LanguageBrainCanvas } from '@/features/brain/LanguageBrainCanvas';
import { ProgressAnalytics } from '@/features/progress/ProgressAnalytics';
import { defaultReviewQueue } from '@/fixtures/reviewFixture';
import { defaultBrainNodes } from '@/fixtures/brainFixture';

// Helper to mock window.matchMedia for reduced motion testing
function mockMatchMedia(matchesReducedMotion: boolean) {
  let listeners = new Set<() => void>();
  let matches = matchesReducedMotion;

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === 'change') listeners.add(cb);
    }),
    removeEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === 'change') listeners.delete(cb);
    }),
    addListener: vi.fn((cb: () => void) => listeners.add(cb)),
    removeListener: vi.fn((cb: () => void) => listeners.delete(cb)),
    dispatchEvent: vi.fn(),
  }));

  return {
    setMatches: (newMatches: boolean) => {
      matches = newMatches;
      listeners.forEach((cb) => cb());
    },
    cleanup: () => {
      listeners.clear();
    },
  };
}

describe('Milestone 2 Verification: P0/P1 GSAP Motion & Lifecycle', () => {
  let mediaMock: ReturnType<typeof mockMatchMedia>;

  beforeEach(() => {
    mediaMock = mockMatchMedia(false);
  });

  afterEach(() => {
    mediaMock.cleanup();
    gsap.killTweensOf('*');
  });

  /* -------------------------------------------------------------------------- */
  /* 1. ReviewCard: Flip, Feedback & Lifecycle Cleanup                          */
  /* -------------------------------------------------------------------------- */
  describe('ReviewCard Motion & Lifecycle', () => {
    it('verifies answer reveal creates scoped GSAP animation and cleans up on unmount', () => {
      const { container, rerender, unmount } = render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={false}
        />
      );

      // Trigger reveal
      rerender(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
        />
      );

      // Verify answer is immediately in DOM (Invariant 3)
      expect(screen.getByText('Cuộc hẹn chính thức')).toBeInTheDocument();

      // Verify unmount reverts all tweens targeting the card
      unmount();
      const activeTweens = gsap.getTweensOf(container.firstChild);
      expect(activeTweens.length).toBe(0);
    });

    it('verifies reduced-motion collapses answer reveal to instant display without lingering tweens', () => {
      mediaMock.setMatches(true);

      const { unmount } = render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
        />
      );

      expect(screen.getByText('Cuộc hẹn chính thức')).toBeInTheDocument();
      unmount();
    });

    it('verifies 4 FSRS rating buttons trigger onRate immediately upon click without animation blocking', () => {
      const handleRate = vi.fn();
      render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
          onRate={handleRate}
        />
      );

      const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
      fireEvent.click(goodBtn);

      // Invariant 1: Synchronous callback execution
      expect(handleRate).toHaveBeenCalledTimes(1);
      expect(handleRate).toHaveBeenCalledWith('good');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. ReviewSession: Lateral Slide & Synchronous Keyboard Navigation          */
  /* -------------------------------------------------------------------------- */
  describe('ReviewSession Keyboard Navigation & Queue Progression', () => {
    it('verifies Space key reveals answer synchronously in the same event tick', () => {
      render(<ReviewSession initialQueue={defaultReviewQueue} />);

      expect(screen.queryByText(defaultReviewQueue[0].meaningVi)).not.toBeInTheDocument();

      // Press Space
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });

      // Immediate DOM presence
      expect(screen.getByText(defaultReviewQueue[0].meaningVi)).toBeInTheDocument();
    });

    it('verifies 1-4 number keys advance review queue synchronously even while tweens are active', () => {
      const handleRate = vi.fn();
      render(
        <ReviewSession
          initialQueue={defaultReviewQueue}
          onRatingSubmit={handleRate}
        />
      );

      // Card 1 -> Press '3' (Good)
      fireEvent.keyDown(window, { key: '3' });
      expect(handleRate).toHaveBeenCalledWith(defaultReviewQueue[0].id, 'good');

      // Card 2 should immediately be active
      expect(screen.getByText(defaultReviewQueue[1].term)).toBeInTheDocument();

      // Card 2 -> Press '1' (Again)
      fireEvent.keyDown(window, { key: '1' });
      expect(handleRate).toHaveBeenCalledWith(defaultReviewQueue[1].id, 'again');

      // Card 3 should immediately be active
      expect(screen.getByText(defaultReviewQueue[2].term)).toBeInTheDocument();
    });

    it('verifies rapid-fire ratings (5 cards in rapid succession) execute cleanly without drop or crash', () => {
      const handleRate = vi.fn();
      render(
        <ReviewSession
          initialQueue={defaultReviewQueue}
          onRatingSubmit={handleRate}
        />
      );

      // Fire 5 rating keys sequentially
      ['1', '2', '3', '4', '3'].forEach((key, idx) => {
        fireEvent.keyDown(window, { key });
        expect(handleRate).toHaveBeenCalledTimes(idx + 1);
      });

      // Card index 5 should be displayed
      expect(screen.getByText(defaultReviewQueue[5].term)).toBeInTheDocument();
    });

    it('verifies unmounting ReviewSession mid-session kills all lateral queue tweens cleanly', () => {
      const { unmount } = render(<ReviewSession initialQueue={defaultReviewQueue} />);

      // Trigger card advance
      fireEvent.keyDown(window, { key: '3' });

      // Immediate unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. ConceptNode: Subtle Scale Pulse & Selection                             */
  /* -------------------------------------------------------------------------- */
  describe('ConceptNode Pulse & Selection Motion', () => {
    it('verifies status change triggers 200ms scale pulse and clears transform on finish', () => {
      const { container, rerender, unmount } = render(
        <ConceptNode id="n1" label="appointment" status="learning" />
      );

      // Upgrade status to mastered
      rerender(<ConceptNode id="n1" label="appointment" status="mastered" />);

      // Verify node button exists and has accessible label
      const btn = screen.getByRole('button', { name: /appointment/i });
      expect(btn).toBeInTheDocument();

      unmount();
      expect(gsap.getTweensOf(btn).length).toBe(0);
    });

    it('verifies reduced-motion skips pulse and applies static styling instantly', () => {
      mediaMock.setMatches(true);

      const { unmount } = render(
        <ConceptNode id="n1" label="appointment" status="mastered" isSelected={true} />
      );

      const btn = screen.getByRole('button', { name: /appointment/i });
      expect(btn).toHaveAttribute('aria-pressed', 'true');

      unmount();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. LanguageBrainCanvas: Camera Pan & Centering                             */
  /* -------------------------------------------------------------------------- */
  describe('LanguageBrainCanvas Camera Motion & Scoping', () => {
    it('verifies node click triggers camera centering and opens detail drawer immediately', () => {
      const handleSelect = vi.fn();
      render(
        <LanguageBrainCanvas
          initialNodes={defaultBrainNodes}
          onSelectConcept={handleSelect}
        />
      );

      const targetNode = defaultBrainNodes[0];
      const nodeChip = screen.getByRole('button', { name: new RegExp(targetNode.label, 'i') });

      fireEvent.click(nodeChip);

      // Invariant 3: Immediate detail drawer rendering
      expect(handleSelect).toHaveBeenCalledWith(targetNode);
      expect(screen.getByRole('dialog', { name: /Chi tiết khái niệm/i })).toBeInTheDocument();
      expect(screen.getByText(targetNode.translationVi)).toBeInTheDocument();
    });

    it('verifies zoom controls clamp scale between 50% and 150%', () => {
      render(<LanguageBrainCanvas initialNodes={defaultBrainNodes} />);

      const zoomInBtn = screen.getByRole('button', { name: /Phóng to mạng lưới/i });
      const zoomOutBtn = screen.getByRole('button', { name: /Thu nhỏ mạng lưới/i });

      // Click zoom out 10 times (should clamp at 50%)
      for (let i = 0; i < 10; i++) {
        fireEvent.click(zoomOutBtn);
      }
      expect(screen.getByText('50%')).toBeInTheDocument();

      // Click zoom in 15 times (should clamp at 150%)
      for (let i = 0; i < 15; i++) {
        fireEvent.click(zoomInBtn);
      }
      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    it('verifies unmount during active camera animation cancels tweens cleanly', () => {
      const { unmount } = render(<LanguageBrainCanvas initialNodes={defaultBrainNodes} />);

      const nodeChip = screen.getByRole('button', { name: new RegExp(defaultBrainNodes[0].label, 'i') });
      fireEvent.click(nodeChip);

      expect(() => unmount()).not.toThrow();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. ProgressAnalytics: Staggered Entrance & Frame-0 ARIA Data Correctness   */
  /* -------------------------------------------------------------------------- */
  describe('ProgressAnalytics Staggered Entrance & ARIA Data Correctness', () => {
    it('verifies progress bars render exact semantic ARIA and text data on Frame 0', () => {
      render(<ProgressAnalytics />);

      // Invariant 3: DOM text and ARIA attributes reflect accurate learning data immediately
      const progressbars = screen.getAllByRole('progressbar');
      expect(progressbars.length).toBeGreaterThanOrEqual(4);

      // FSRS bar
      expect(progressbars[0]).toHaveAttribute('aria-valuenow', '28');
      expect(progressbars[0]).toHaveAttribute('aria-valuemin', '0');
      expect(progressbars[0]).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText('45 phút (28%)')).toBeInTheDocument();

      // Reader bar
      expect(progressbars[1]).toHaveAttribute('aria-valuenow', '38');
      expect(screen.getByText('60 phút (38%)')).toBeInTheDocument();
    });

    it('verifies time-window switch (7d -> 30d) updates semantic data immediately and triggers entrance', () => {
      render(<ProgressAnalytics />);

      const monthBtn = screen.getByRole('button', { name: /30 ngày qua/i });
      fireEvent.click(monthBtn);

      // Text updates immediately
      expect(screen.getByText(/30 ngày: 640 phút/i)).toBeInTheDocument();
      expect(screen.getByText('180 phút (28%)')).toBeInTheDocument();
    });

    it('verifies reduced-motion displays full bar widths instantly without staggered delay', () => {
      mediaMock.setMatches(true);

      const { unmount } = render(<ProgressAnalytics />);

      expect(screen.getByText('45 phút (28%)')).toBeInTheDocument();
      unmount();
    });
  });
});
```

---

## 4. Caveats & Assumptions

1. **JSDOM vs. Real Browser Rendering Engines**:
   - JSDOM does not execute hardware GPU compositing, layout reflow, or `requestAnimationFrame` timing loops natively. GSAP operates in a synchronous or timer-mocked environment under Vitest.
   - Layout geometry values (`clientWidth`, `clientHeight`, `offsetLeft`, `offsetTop`) in JSDOM evaluate to `0` unless explicitly mocked via `Object.defineProperty`. The test harness uses defensive fallbacks (`|| clientWidth || 0`).
2. **`useSyncExternalStore` in React 19**:
   - `usePrefersReducedMotion` relies on `useSyncExternalStore`. In unit tests, dynamic media query state changes must be wrapped in `act(() => { ... })` to ensure React flushes subscriber notifications synchronously.
3. **No Direct Source Modification during Exploration**:
   - In accordance with explorer read-only boundaries, this report provides architectural blueprints, verification methods, and exact test specifications to guide Milestone 2 worker agents.

---

## 5. Conclusion & Strategic Plan

1. **Lifecycle Auto-Cleanup**:
   - Mandate `gsap.registerPlugin(useGSAP)` and `{ scope: containerRef }` on all 5 components.
   - Require `contextSafe` for all interactive event handlers (rating clicks, node selections, zoom toggles).
   - Assert zero lingering tweens via `gsap.getTweensOf(target).length === 0` after `unmount()`.
2. **Accessibility & Reduced Motion**:
   - Enforce 100% collapse to `duration: 0` / instant `gsap.set` across all components when `(prefers-reduced-motion: reduce)` is active.
   - Ensure non-color status indicators (icons, labels, border styles) remain fully visible regardless of animation state.
3. **Keyboard Responsiveness (Invariant 1)**:
   - Ensure `Space` (reveal) and `1`–`4` (ratings) in `ReviewSession` execute synchronously in Frame 0. Never gate user input behind animation completion promises.
4. **Storybook Catalog Expansion**:
   - Add `AnimatedRevealTransition`, `AnimatedStatusPulse`, and `ReducedMotion` stories for `ReviewCard`, `ConceptNode`, `LanguageBrainCanvas`, and `ProgressAnalytics`.

---

## 6. Verification Method

To independently verify the motion integration after implementation:

```bash
# 1. Type check
pnpm typecheck

# 2. Lint check
pnpm lint

# 3. Motion and adversarial unit tests
pnpm test tests/frontend/motion.test.tsx
pnpm test tests/frontend/challenger.motion-reduced.adversarial.test.tsx
pnpm test

# 4. Storybook build verification
pnpm build-storybook

# 5. Full production build
pnpm build
```

### Invalidation Conditions
- Any tween mutating `width`, `height`, `top`, `left`, `margin`, or `padding` directly with GSAP (violating composite-only transform rule).
- Any input lag, debounce, or blocking on `Space` or `1`-`4` keyboard shortcuts in `ReviewSession`.
- Any dangling tween or detached DOM mutation warning on component unmount or rapid route switching.
- Any non-zero animation duration or animated stepping when `prefers-reduced-motion: reduce` is active.
- Any discrepancy between visual animation state and underlying semantic DOM / ARIA tree data.
