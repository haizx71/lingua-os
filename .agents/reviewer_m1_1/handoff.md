# Review & Quality Assessment Report: Milestone 1

**Reviewer**: `reviewer_m1_1` (Reviewer 1, Archetype: Reviewer & Adversarial Critic)  
**Reviewed Worker**: `worker_m1_1`  
**Milestone**: Milestone 1 (Semantic Motion Token System & Core Infrastructure)  
**Date**: 2026-08-22  
**Verdict**: `REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Review Scope & Inspected Files
The following files were independently inspected line-by-line:
- `packages/ui/src/tokens/primitive.ts` (DTCG Tier 1 tokens, types)
- `packages/ui/src/tokens/semantic.ts` (DTCG Tier 2 tokens, duration converters)
- `packages/ui/src/tokens/component.ts` (DTCG Tier 3 tokens, component bindings)
- `packages/ui/src/tokens/theme.css` (CSS custom properties, reduced-motion media query)
- `packages/ui/src/tokens/index.ts` (Token exports)
- `packages/ui/src/hooks/usePrefersReducedMotion.ts` (SSR-safe React hook)
- `packages/ui/src/hooks/index.ts` & `packages/ui/src/index.ts` (Barrel re-exports)
- `tests/frontend/tokens.test.ts` (Unit test suite)
- `tests/frontend/challenger.motion-reduced.adversarial.test.tsx` (Adversarial test suite)

### 1.2 Verbatim Verification Outputs
1. **`npx pnpm test` (FAILED)**:
   ```
   FAIL tests/frontend/challenger.motion-reduced.adversarial.test.tsx > Adversarial Challenge 5: CSS Motion Token Invariants & prefers-reduced-motion Overrides > verifies motionSeconds and motionDurationToSeconds utility edge cases
   AssertionError: expected 0.0015 to be 1.5 // Object.is equality

   - Expected
   + Received

   - 1.5
   + 0.0015

    ❯ tests/frontend/challenger.motion-reduced.adversarial.test.tsx:416:45
       414|     expect(motionDurationToSeconds('150ms')).toBe(0.15);
       415|     expect(motionDurationToSeconds('250ms')).toBe(0.25);
       416|     expect(motionDurationToSeconds('1.5s')).toBe(1.5);
          |                                             ^
       417|     expect(motionDurationToSeconds('not-a-number')).toBe(0);
       418|     expect(motionDurationToSeconds('   300ms   ')).toBe(0.3);

   Test Files  1 failed | 23 passed (24)
   Tests       1 failed | 294 passed (295)
   ```

2. **`npx pnpm typecheck` (PASSED)**:
   ```
   $ pnpm -r typecheck
   Scope: 3 of 4 workspace projects
   packages/ui typecheck$ tsc --noEmit
   packages/types typecheck$ tsc --noEmit
   packages/types typecheck: Done
   packages/ui typecheck: Done
   apps/web typecheck$ tsc --noEmit
   apps/web typecheck: Done
   ```

3. **`npx pnpm lint` (PASSED)**:
   ```
   $ eslint . --max-warnings=0
   (Exit code 0, 0 warnings, 0 errors)
   ```

4. **`npx pnpm --filter @lingua/ui build-storybook` (PASSED)**:
   ```
   ✓ built in 22.70s
   info => Output directory: D:\LINGUA_OS_PROJECT_STARTER\packages\ui\storybook-static
   ```

---

## 2. Logic Chain

1. **Token Hierarchy & Specification Conformance**:
   - **Tier 1 (Primitive)**: `primitiveMotion` in `packages/ui/src/tokens/primitive.ts` correctly defines durations (`0`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`), easings (`linear`, `standard`, `enter`, `exit`, `emphasized`, `inOut`), distances (`xs`: 2px, `sm`: 4px, `md`: 8px, `lg`: 16px), and scale multipliers (`press`: 0.98, `feedback`: 1.02, `pulse`: 1.05). Conforms to `MOTION_DESIGN.md` §2.1.
   - **Tier 2 (Semantic)**: `semanticMotion` in `packages/ui/src/tokens/semantic.ts` maps purpose-driven values (`instant`: 0ms, `fast`: 150ms, `normal`: 250ms, `slow`: 400ms, `feedback`: 200ms, `reveal`: 8px, `slide`: 16px, `active`: 0.98, `highlight`: 1.05). Conforms to `MOTION_DESIGN.md` §2.2.
   - **Tier 3 (Component)**: `componentMotionTokens` in `packages/ui/src/tokens/component.ts` maps component motion slots (`reviewCard`, `reviewSession`, `conceptNode`, `brainCanvas`, `progressAnalytics`, etc.) directly to CSS custom properties (`var(--motion-*)`). Conforms to `MOTION_DESIGN.md` §2.3.
   - **CSS Variables & Reduced Motion**: `packages/ui/src/tokens/theme.css` properly exposes custom properties in `:root` and overrides all motion properties to `0ms`, `0px`, `1`, `0.01ms linear` within `@media (prefers-reduced-motion: reduce)`.
   - **React Hook**: `usePrefersReducedMotion.ts` utilizes `useSyncExternalStore` with proper SSR safeguards (`getServerSnapshot` returning `false`) and legacy `addListener`/`removeListener` compatibility.

2. **Root Cause of Test Failure (Defect Finding)**:
   - In `packages/ui/src/tokens/semantic.ts` (lines 217–220):
     ```ts
     export function motionDurationToSeconds(durationToken: string): number {
       const parsed = parseFloat(durationToken);
       return Number.isNaN(parsed) ? 0 : parsed / 1000;
     }
     ```
   - When a duration string using seconds is supplied (e.g. `'1.5s'`), `parseFloat('1.5s')` yields `1.5`, which is then incorrectly divided by `1000` to yield `0.0015` instead of `1.5`.
   - The function lacks unit discrimination (`ms` vs `s`) and fails the adversarial test suite `tests/frontend/challenger.motion-reduced.adversarial.test.tsx`.

---

## 3. Findings

### [Major] Finding 1: `motionDurationToSeconds` incorrectly divides seconds-formatted duration strings by 1000

- **What**: `motionDurationToSeconds('1.5s')` returns `0.0015` instead of `1.5`.
- **Where**: `packages/ui/src/tokens/semantic.ts`, line 217–220.
- **Why**: The function assumes all input duration strings are in milliseconds and unconditionally divides the parsed float by 1000. When durations in seconds (e.g. `'1.5s'` or `'0.25s'`) are supplied, this produces an incorrect value by 3 orders of magnitude, which can break downstream GSAP animation timelines.
- **Suggestion**:
  Update `motionDurationToSeconds` in `packages/ui/src/tokens/semantic.ts` to inspect units:
  ```ts
  export function motionDurationToSeconds(durationToken: string): number {
    if (typeof durationToken !== 'string') return 0;
    const trimmed = durationToken.trim();
    if (!trimmed) return 0;
    if (trimmed.endsWith('ms')) {
      const parsed = parseFloat(trimmed);
      return Number.isNaN(parsed) ? 0 : parsed / 1000;
    }
    if (trimmed.endsWith('s')) {
      const parsed = parseFloat(trimmed);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    const parsed = parseFloat(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed / 1000;
  }
  ```

---

## 4. Verified Claims & Stress Test Results

| Feature / Invariant | Verification Method | Status |
|---|---|---|
| Primitive tokens match `MOTION_DESIGN.md` §2.1 | `tests/frontend/tokens.test.ts` | **PASS** |
| Semantic tokens match `MOTION_DESIGN.md` §2.2 | `tests/frontend/tokens.test.ts` | **PASS** |
| Component tokens match `MOTION_DESIGN.md` §2.3 | `tests/frontend/tokens.test.ts` | **PASS** |
| Reduced-motion CSS collapse in `theme.css` | Stylesheet regex inspection in tests | **PASS** |
| `usePrefersReducedMotion` SSR & unmount safety | JSDOM & React SSR `renderToString` | **PASS** |
| TypeScript compile-time type safety (`tsc`) | `npx pnpm typecheck` | **PASS** |
| ESLint zero warnings | `npx pnpm lint` | **PASS** |
| Storybook component bundle | `npx pnpm --filter @lingua/ui build-storybook` | **PASS** |
| `motionDurationToSeconds('1.5s')` unit handling | `tests/frontend/challenger.motion-reduced.adversarial.test.tsx` | **FAIL** |

---

## 5. Integrity & Adversarial Review

- **Integrity Violation Check**: **CLEAN**. No hardcoded mocks, no facade shortcuts, no fabricated test results.
- **Vestibular & A11y Safety**: `@media (prefers-reduced-motion: reduce)` in `theme.css` and `usePrefersReducedMotion` hook meet WCAG 2.2 AA non-blocking and reduced motion requirements.
- **Adversarial Failure Modes**: Handled 100 concurrent subscribers, SSR execution with missing `window`, legacy browser fallback (`addListener`), and rapid toggling cleanly.

---

## 6. Caveats

- **Scope Boundary**: As Reviewer, no direct edits were applied to implementation files in accordance with the Reviewer constraint.
- **Web App Build**: `next build` on Windows encountered an existing Next.js export rename issue (`500.html`) unrelated to the motion tokens package.

---

## 7. Conclusion & Verdict

**Verdict**: `REQUEST_CHANGES`

Milestone 1 code is 98% complete and follows the DTCG 3-tier architecture with excellent type safety and CSS custom property integration. However, because `npx pnpm test` failed on `motionDurationToSeconds` in `packages/ui/src/tokens/semantic.ts`, the implementation must be updated to correctly handle duration units before Milestone 1 can be formally approved.

---

## 8. Verification Method for Rework

After resolving Finding 1, execute:
```powershell
npx pnpm test
npx pnpm typecheck
npx pnpm lint
```
Expected: All 24 test suites pass, 295 tests pass, zero typecheck errors, zero lint warnings.
