# Handoff Report: Milestone 1 Adversarial Challenge (Reduced Motion & Motion Infrastructure)

**Agent ID**: `challenger_m1_2`  
**Role**: Empirical Challenger (critic, specialist)  
**Milestone**: Milestone 1 (Semantic Motion Token System & Core Infrastructure)  
**Date**: 2026-08-22  

---

## 1. Observation

### 1.1 Inspected Files and Contracts
1. **`packages/ui/src/hooks/usePrefersReducedMotion.ts`** (Lines 1–46):
   - Implements `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`.
   - `getServerSnapshot()` returns `false` statically on lines 33–35.
   - `getSnapshot()` guards `typeof window === 'undefined' || typeof window.matchMedia !== 'function'` and queries `window.matchMedia('(prefers-reduced-motion: reduce)').matches` on lines 26–31.
   - `subscribe(callback)` on lines 5–24 binds `addEventListener('change', callback)` with fallback to `mediaQueryList.addListener(callback)`. Returns cleanup function removing the listener via `removeEventListener` or `removeListener`.
2. **`packages/ui/src/tokens/theme.css`** (Lines 55–99, 144–182):
   - Defines DTCG Tier 1 primitive duration/ease/distance/scale custom properties and Tier 2 semantic properties (`--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`).
   - Lines 147–182 define `@media (prefers-reduced-motion: reduce)` overriding `:root` motion custom properties (`--motion-duration-*` to `0ms`, `--motion-fast/normal/slow/feedback` to `0ms`, `--motion-distance-*` to `0px`, `--motion-scale-*` to `1`, `--transition-fast/base` to `0.01ms linear`) and universal overrides (`*, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }`).
3. **`packages/ui/src/tokens/semantic.ts`** (Lines 185–246):
   - `semanticMotion.duration`: `instant: '0ms'`, `fast: '150ms'`, `normal: '250ms'`, `slow: '400ms'`, `feedback: '200ms'`.
   - `motionDurationToSeconds` parses millisecond strings into seconds (e.g. `'250ms'` -> `0.25`).
   - `motionSeconds`: `instant: 0`, `fast: 0.15`, `feedback: 0.2`, `normal: 0.25`, `slow: 0.4`, `maxSpatial: 0.5`, `staggerStep: 0.05`.

### 1.2 Adversarial Test Suite Execution
Created empirical test suite in `tests/frontend/challenger.motion-reduced.adversarial.test.tsx` containing 19 adversarial tests across 5 challenge vectors:
- **Vector 1: SSR & Headless Node Execution Invariants**:
  - `renderToString(<MotionIndicator />)` executes without `ReferenceError` and renders fallback `'full'`.
  - Simulating `globalThis.window = undefined` returns `false` without throwing.
  - Simulating `window.matchMedia = undefined` and `window.matchMedia = null / {}` safely falls back to `false` and returns no-op unsubscribe without throwing.
- **Vector 2: Dynamic Media Query Listener Lifecycle & Memory Leak Prevention**:
  - Validated subscription to query `(prefers-reduced-motion: reduce)`.
  - Toggling preference triggers reactive state transitions (`false` -> `true` -> `false`).
  - Unmounting component detaches exact listener from `MediaQueryList`, leaving 0 active listeners.
- **Vector 3: Legacy Browser Fallback Handling**:
  - Simulating legacy WebKit / Safari <= 13 (where `addEventListener` is undefined) successfully falls back to `addListener`.
  - Unmount cleans up via `removeListener`.
  - Handled broken legacy environments where `removeListener` or both methods are missing without throwing.
- **Vector 4: Concurrency & Mass Subscriber Stress Test**:
  - 100 simultaneous component instances mounted and synchronized concurrently on media query toggle.
  - Unmounting all 100 instances completely drained the listener set to 0.
  - Rapid 50-cycle oscillation between `reduce` and `no-preference` executed with zero desynchronization or race conditions.
- **Vector 5: CSS Motion Token Invariants & prefers-reduced-motion Overrides**:
  - Verified Motion Invariant 1 (all feedback durations ≤ 300ms, max spatial ≤ 500ms).
  - Verified 100% collapse of custom properties to `0ms`, `0px`, and `1` in `theme.css`.
  - Verified universal `animation-duration: 0.01ms !important` and `transition-duration: 0.01ms !important`.

### 1.3 Verbatim Test Results
- **Empirical Adversarial Test Execution**:
  ```
  npx pnpm test tests/frontend/challenger.motion-reduced.adversarial.test.tsx
  Test Files  1 passed (1)
  Tests       19 passed (19)
  Duration    2.28s
  ```
- **Full Monorepo Test Suite Execution**:
  ```
  npx pnpm test
  Test Files  25 passed (25)
  Tests       309 passed (309)
  Duration    4.89s
  ```
- **TypeScript Typecheck**:
  ```
  npx pnpm typecheck
  Scope: 3 of 4 workspace projects
  packages/types typecheck: Done
  packages/ui typecheck: Done
  apps/web typecheck: Done
  ```
- **ESLint**:
  ```
  npx pnpm lint
  $ eslint . --max-warnings=0 (Exit code 0)
  ```
- **Storybook Build**:
  ```
  npx pnpm --filter @lingua/ui build-storybook
  info => Output directory: D:\LINGUA_OS_PROJECT_STARTER\packages\ui\storybook-static
  packages/ui build-storybook: Done
  ```
- **Next.js Web App Production Build**:
  ```
  npx pnpm --filter @lingua/web build
  ✓ Compiled successfully
  ✓ Generating static pages (14/14)
  Finalizing page optimization ...
  ```

---

## 2. Logic Chain

1. **Hydration & SSR Safety**:
   - `useSyncExternalStore` is React's official standard for external subscriptions, avoiding tearing and hydration mismatch errors.
   - Because `getServerSnapshot` returns a constant `false`, server-rendered HTML is guaranteed deterministic.
   - When hydrated on a client where `matchMedia('(prefers-reduced-motion: reduce)').matches` is `true`, `useSyncExternalStore` detects client store disparity and synchronizes state safely without crashing or throwing `window is not defined`.
2. **Leak-Free Event Listener Attachment**:
   - `subscribe` returns a closure containing `mediaQueryList.removeEventListener('change', callback)`.
   - In our empirical tests with 100 mounted components, `listeners.size` reached 100 on mount and dropped precisely to 0 on unmount. No hanging event listeners or detached DOM references persist.
3. **Multi-Tier Reduced-Motion Collapse**:
   - Layer 1 (CSS): `@media (prefers-reduced-motion: reduce)` in `theme.css` collapses CSS variables at `:root` (`--motion-fast: 0ms; --motion-normal: 0ms; --motion-distance-reveal: 0px; --motion-scale-active: 1`).
   - Layer 2 (Universal CSS): `*, ::before, ::after` duration forced to `0.01ms !important`.
   - Layer 3 (React / GSAP): `usePrefersReducedMotion` provides a boolean signal to React components (`ReviewCard`, `ReviewSession`, `ConceptNode`, `ProgressAnalytics`) allowing GSAP tweens to collapse to `duration: 0` or conditional instant renders.
4. **Resilience to Incomplete / Corrupted Browser APIs**:
   - The implementation defensively validates `typeof window.matchMedia === 'function'` before invoking it, and checks `typeof mediaQueryList.addEventListener === 'function'` and `typeof mediaQueryList.addListener === 'function'`.
   - When tested against corrupted environments (`matchMedia = null`, `matchMedia = {}`, missing `removeListener`), zero uncaught exceptions occurred.

---

## 3. Caveats

- **`motionDurationToSeconds` Input Contract**:
  - `motionDurationToSeconds(token)` parses using `parseFloat(token) / 1000`. It is specifically designed for millisecond token strings (`'250ms'` -> `0.25`). Passing second-denominated strings (`'1.5s'`) would evaluate to `0.0015` seconds (1.5ms). All tokens in `@lingua/ui` use millisecond units, and `motionSeconds` provides numeric constants directly.
- **Micro-duration CSS Transitions (0.01ms)**:
  - Setting universal transition duration to `0.01ms` (rather than `0s`) is a standard accessibility best-practice that allows JavaScript frameworks relying on `transitionend` events to fire without perceived animation delay.

---

## 4. Conclusion

The Milestone 1 motion token system, `usePrefersReducedMotion` hook, and `theme.css` reduced-motion cascade overrides have been rigorously stress-tested across SSR, headless, legacy browser, concurrency, and dynamic event lifecycle vectors.

All 19 adversarial challenge tests and all 309 monorepo tests pass with 0 errors, 0 type errors, 0 lint warnings, and successful production builds across `@lingua/ui` (Storybook) and `@lingua/web` (Next.js). The infrastructure is fully robust and ready for downstream Milestone 2 integration.

---

## 5. Verification Method

### 5.1 Run Milestone 1 Adversarial Challenge Test Suite
```powershell
npx pnpm test tests/frontend/challenger.motion-reduced.adversarial.test.tsx
```
*Expected*: 1 test file passed, 19 tests passed (0 failures).

### 5.2 Run Complete Workspace Test Suite
```powershell
npx pnpm test
```
*Expected*: 25 test files passed, 309 tests passed (0 failures).

### 5.3 Run Typecheck, Lint, and Builds
```powershell
npx pnpm typecheck
npx pnpm lint
npx pnpm --filter @lingua/ui build-storybook
npx pnpm --filter @lingua/web build
```
*Expected*: All commands exit with status code 0.

### 5.4 Invalidation Conditions
- Any `ReferenceError: window is not defined` during SSR execution.
- Any unmount that fails to remove listeners from `MediaQueryList`.
- Any duration token in `@media (prefers-reduced-motion: reduce)` not collapsing to `0ms`.
