# Challenger Report: A11y, Reduced-Motion & Semantic Frame-0 Invariant Stress (Milestone 2 & 3)

**Challenger ID**: `challenger_m2_2`  
**Target Milestone**: Milestone 2 & 3  
**Stress Vectors**: Dynamic `prefers-reduced-motion` switching, SSR hydration parity, Frame-0 DOM/ARIA inspection, Non-color WCAG compliance  
**Verdict**: `APPROVE` (All accessibility invariants verified)  

---

## 1. Observation & Stress Vectors

1. **Dynamic Reduced Motion Toggle**:
   - Toggled `window.matchMedia('(prefers-reduced-motion: reduce)')` dynamically between active and inactive states.
   - Result: Components immediately adapt to instant `gsap.set` switches (0ms duration) without lingering transform values or layout shift.
2. **Frame-0 Semantic Inspection (Invariant 3)**:
   - Queried `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and text labels before GSAP tweens reached completion.
   - Result: All data attributes and text nodes are present and accurate from initial React render.
3. **Non-Color Status Invariants**:
   - All 8 CEFR/FSRS status states in `ConceptNode` and `ConceptChip` preserve distinctive Lucide icons and border styling (e.g. dashed border for `unseen`) regardless of animation state.

---

## 2. Logic Chain

The separation of DOM state from visual GPU transforms guarantees that accessibility tools (screen readers, automated a11y checkers) receive deterministic, un-delayed semantic information.

---

## 3. Verification Method

- `npx vitest run tests/frontend/challenger.motion-reduced.adversarial.test.tsx`
- `npx vitest run tests/frontend/e2e/f03-storybook-a11y.test.tsx`
- `npx vitest run tests/frontend/motion.test.tsx`
- Verdict: **APPROVE**.
