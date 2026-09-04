# LINGUA OS — Motion Specification Extraction Report

## Executive Summary
This report provides the authoritative extraction and enumeration of all motion requirements, design tokens, GSAP learning loop enhancements, accessibility invariants, Storybook verification criteria, and architecture boundaries for LINGUA OS.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Invariant | **Motion Invariant 1: Timing Limits & Zero-Blocking** | Primary interaction feedback must complete within 300ms (max 500ms for non-blocking spatial transitions/data viz). User inputs and keyboard shortcuts (Space, 1-4) must never be blocked or locked by active animations. | User clicks, keyboard shortcuts, queue transitions | Immediate UI response, non-blocking tween | Queued actions bypass tween; no input lock | `MOTION_DESIGN.md` §1.3, `ORIGINAL_REQUEST.md` |
| 2 | Invariant | **Motion Invariant 2: GSAP vs CSS Boundary** | Simple transitions (hover, active pill, basic progress width, step slides) use CSS transitions. GSAP is reserved strictly for coordinated timelines, multi-state transforms, spatial centering, and lifecycle-managed motion. | Component state changes | CSS classes vs `useGSAP` tweens | Fallback to instant CSS or GSAP set | `MOTION_DESIGN.md` §1.4, `MOTION_AUDIT.md` §1 |
| 3 | Invariant | **Motion Invariant 3: Immediate Semantic Data Correctness** | DOM and ARIA trees must immediately contain true data (retention, mastery, counts). Animations must NEVER display misleading interpolated false scores or learning metrics. | Learning metrics, session data, score updates | Accurate DOM text/ARIA attributes immediately | Visuals lag visual-only, semantic values are never faked | `MOTION_DESIGN.md` §1.5 |
| 4 | Tokens (R1) | **Primitive Motion Tokens (Durations)** | Raw DTCG duration tokens: `--motion-duration-0` (0ms), `--motion-duration-75` (75ms), `--motion-duration-150` (150ms), `--motion-duration-200` (200ms), `--motion-duration-300` (300ms), `--motion-duration-400` (400ms), `--motion-duration-600` (600ms). | CSS variables / TypeScript constants | Raw duration strings | Fallback to 0ms | `MOTION_DESIGN.md` §2.1 |
| 5 | Tokens (R1) | **Primitive Motion Tokens (Easings & Scales)** | Curves: `standard` (`cubic-bezier(0.2, 0, 0, 1)` / power2.out), `enter` (`cubic-bezier(0, 0, 0.2, 1)` / power1.out), `exit` (`cubic-bezier(0.4, 0, 1, 1)` / power1.in), `emphasized`. Distances: `xs` (2px), `sm` (4px), `md` (8px), `lg` (16px). Scales: `press` (0.98), `feedback` (1.02). | CSS variables / TypeScript constants | Cubic-bezier strings, pixel offsets, scale floats | Standard linear fallback | `MOTION_DESIGN.md` §2.1 |
| 6 | Tokens (R1) | **Semantic Motion Tokens** | Semantic intent tokens: `--motion-instant` (0ms), `--motion-fast` (150ms), `--motion-normal` (250ms), `--motion-slow` (400ms), `--motion-feedback` (200ms), `--motion-distance-reveal` (8px), `--motion-scale-active` (0.98). | Semantic role requests | CSS vars & TS token objects | Instant resolution | `MOTION_DESIGN.md` §2.2 |
| 7 | P0 Motion (R2) | **ReviewCard Coordinated Answer Reveal** | 200–250ms 3D flip / cross-fade reveal of answer explanation & FSRS rating buttons using `useGSAP` timeline with transform & opacity composite properties. | `onReveal()`, Space key | Visual card flip + revealed explanation DOM | Immediate render under reduced motion | `MOTION_DESIGN.md` §3, `MOTION_AUDIT.md` §2-3 |
| 8 | P0 Motion (R2) | **ReviewCard Rating Button Feedback** | 150ms subtle press response (scale 0.98 -> 1.0) and border illumination on rating selection (Again, Hard, Good, Easy). | Rating button click / Keys 1-4 | Immediate rating callback + visual confirmation | Immediate static update | `MOTION_DESIGN.md` §3, `MOTION_AUDIT.md` §2-3 |
| 9 | P0 Motion (R2) | **ReviewSession Lateral Queue Progression** | Fast 150ms lateral slide-out (`x: -20 -> 0`, `opacity: 0 -> 1`) when advancing to next queue card via `useGSAP` `contextSafe` event handler. | Card rating submission | Smooth card replacement | Instant card replacement | `MOTION_AUDIT.md` §2-3 |
| 10 | P0 Motion (R2) | **LanguageBrainCanvas Pan & Zoom Centering** | Smooth camera / canvas transform pan & zoom centering (`gsap.to` transform) targeting selected concept node coordinates without layout shift. | Node selection event | Smooth coordinate pan/zoom | Instant coordinate snap | `MOTION_DESIGN.md` §3, `MOTION_AUDIT.md` §2-3 |
| 11 | P0 Motion (R2) | **ConceptNode Status Upgrade & Selection Pulse** | 200ms subtle scale pulse (1.0 -> 1.05 -> 1.0) and border illumination on node selection or mastery status change with scoped cleanup. | `isSelected`, `status` prop update | Visual highlight pulse | Static border highlight | `MOTION_DESIGN.md` §4.1, `MOTION_AUDIT.md` §2-3 |
| 12 | P1 Motion (R2) | **ProgressAnalytics Accessible Staggered Bar Entrance** | Staggered 250ms entrance (`gsap.from` with 50ms stagger, `power2.out`, transform `scaleY: 0 -> 1`) on initial chart mount while DOM/ARIA data is immediately populated. | Component mount | Visual bar growth choreography | Immediate full height display | `MOTION_AUDIT.md` §2-3 |
| 13 | P1 Motion (R2) | **SavedSentence Toast Notification** | 200ms slide-up notification with auto-dismiss fade (`InlineAlert.tsx`) when mining sentences in Reader. | Save sentence trigger | Floating toast notification | Static alert box | `MOTION_AUDIT.md` §2 |
| 14 | CSS-Only (R2) | **TodayDashboard Checkmark & Dimming** | 200ms checkmark reveal and row dimming on activity completion implemented strictly via CSS transitions (no GSAP). | Activity completion | CSS opacity & stroke transition | Instant toggle | `MOTION_AUDIT.md` §2 |
| 15 | CSS-Only (R2) | **TimeBudget Meter Progress Width** | 300ms CSS `transition: width` on progress fill bar (no GSAP). | Daily time elapsed | CSS width change | Instant width update | `MOTION_AUDIT.md` §2 |
| 16 | CSS-Only (R2) | **InteractiveReader Sentence Popover** | 150ms scale-up fade popover from anchor word position via CSS transition. | Word click/tap | Popover fade & scale | Instant popover appearance | `MOTION_AUDIT.md` §2 |
| 17 | CSS-Only (R2) | **Navigation Active Pill Indicator** | 150ms CSS active pill position transition in Sidebar & BottomNav. | Route change | CSS background/border transition | Instant active pill switch | `MOTION_AUDIT.md` §2 |
| 18 | CSS-Only (R2) | **Onboarding Diagnostic Step Slide** | 200ms CSS horizontal step slide between diagnostic assessment questions. | Next question button | CSS transform transition | Instant step swap | `MOTION_AUDIT.md` §2 |
| 19 | Accessibility (R3) | **`prefers-reduced-motion` 100% Collapse** | When `prefers-reduced-motion: reduce` is active, all motion durations collapse to `0ms` (or subtle 100ms opacity fade); translations, scales, rotations are disabled. | OS reduced-motion flag | Instant state updates, no motion | N/A (safe state) | `MOTION_DESIGN.md` §5, `GEMINI_PROJECT_SPEC.md` §11 |
| 20 | Accessibility (R3) | **WCAG 2.2 AA & Vestibular Safety** | Zero flashing (> 3 flashes/second), zero scroll hijacking, zero persistent looping animations, high contrast maintenance across all animation frames. | Visual renders | Accessible contrast & calm motion | Fallback to static display | `MOTION_DESIGN.md` §3, §5, `MASTER.md` §1 |
| 21 | Verification (R4) | **Storybook Animated State Matrix** | Stories for animated components must demonstrate: Default Resting State, Interactive/Active State, Reduced-Motion State, Light/Dark Theme contrast. | Storybook controls/globals | Interactive Storybook catalog | Story renders static fallback | `MOTION_DESIGN.md` §6, `GEMINI_PROJECT_SPEC.md` §30 |
| 22 | Verification (R4) | **Full Verification Test Suite** | Automated verification scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build-storybook`, `pnpm build`. | Monorepo source code | 100% passing tests & builds | Exit code > 0 on failure | `ORIGINAL_REQUEST.md`, `package.json` |

---

## Edge Cases

| # | Feature | Input | Observed / Specified Behavior |
|---|---------|-------|-------------------------------|
| 1 | `ReviewCard` Keyboard Shortcuts | Rapid pressing of Spacebar followed immediately by '1' (Again) in < 50ms | Invariant 1 dictates zero input locking. The rating callback must fire immediately and advance the queue without waiting for the 200ms reveal tween to complete. Tween is interrupted/reverted safely via `overwrite: 'auto'`. |
| 2 | `ReviewSession` Queue Depletion | Fast rating submissions until `currentIndex >= queue.length` | Lateral slide transition cleanly unmounts card and renders `EmptyState` ("Đã hoàn thành toàn bộ hàng đợi ôn tập!") with zero dangling GSAP tweens or memory leaks. |
| 3 | `LanguageBrainCanvas` Extreme Zoom / Rapid Centering | User clicks multiple concept nodes in rapid succession (< 100ms apart) while zoom is at 150% | GSAP tween uses `overwrite: 'auto'` to smoothly retarget camera/canvas coordinates without stuttering or compounding transform values; zoom clamping (50%–150%) is preserved. |
| 4 | `ProgressAnalytics` Initial Mount under Screen Reader | Screen reader navigates to retention metric while stagger animation is playing | Invariant 3 dictates that ARIA value (`aria-valuenow="87"`, text `87%`) is immediately present in the DOM. Screen reader reads true metric instantly without hearing animated numerical stepping. |
| 5 | `prefers-reduced-motion` System Preference Toggle | User has OS reduced motion enabled | `useGSAP` checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` (or GSAP matchMedia) and uses `gsap.set` / `duration: 0`, completely bypassing transforms and transitions. |
| 6 | Next.js Server-Side Rendering (SSR) | Component rendered on Next.js App Router server during build | All GSAP components include `'use client';` and guard browser APIs (`window.matchMedia`, DOM elements) to ensure zero SSR crashes. |
| 7 | Next.js 15 Build `_not-found` Route Artifact | Running `next build` without `apps/web/src/app/not-found.tsx` | Next.js 15 static trace generation requires a standard `not-found.tsx` page to cleanly compile static app routes during `next build`. |

---

## 5-Component Handoff Report

### 1. Observation
1. **Authoritative Specification Sources**:
   - `design-system/MOTION_DESIGN.md` (Lines 9–176): Establishes Motion Principles 1–7, 3-tier DTCG Token architecture (`--motion-duration-*`, `--motion-ease-*`, `--motion-distance-*`, `--motion-scale-*`), allowed vs. prohibited motion patterns, React/Next.js `@gsap/react` `useGSAP` rules, `prefers-reduced-motion` invariants, and Storybook visual regression rules.
   - `design-system/MOTION_AUDIT.md` (Lines 11–56): Screen-by-screen audit table designating P0 targets (`ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`), P1 targets (`ProgressAnalytics`, `SavedSentence Toast`), and CSS-only skipped targets (`TodayDashboard`, `TimeBudget`, `InteractiveReader`, `Sidebar/BottomNav`, `OnboardingDiagnostic`).
   - `docs/GEMINI_PROJECT_SPEC.md` (Lines 35–41, 144–179, 251–273, 578–592, 670–695): Core frontend invariants, WCAG 2.2 AA accessibility, semantic token layering, 5 MVP primary navigation routes (Today, Read, Review, Brain, Progress), and Storybook state requirements.
   - `MASTER_PROJECT.md` (Lines 98–135): Strict ownership boundaries: Gemini owns `apps/web/`, `packages/ui/`, `design-system/`, `tests/frontend/`, frontend tokens; Codex owns `services/`, `database/`, `contracts/`.
   - `ORIGINAL_REQUEST.md` (Lines 17–25): Explicit assignment to enforce Motion Invariants 1, 2, 3, R1 Semantic Tokens, R2 P0 GSAP enhancements, R3 Accessibility, and R4 Storybook Verification Suite.
2. **Current Implementation & Package State**:
   - `packages/ui/package.json`: Contains `@gsap/react` (`^2.1.2`), `gsap` (`^3.15.0`), `storybook` (`^8.5.6`), `@storybook/addon-a11y` (`^8.5.6`).
   - `apps/web/package.json`: Contains `@gsap/react` (`^2.1.2`), `gsap` (`^3.15.0`), `next` (`^15.1.7`), `react` (`^19.0.0`).
   - `packages/ui/src/tokens/primitive.ts`: Currently defines basic `primitiveMotion` (`duration: fast: 150ms, base: 250ms, slow: 400ms`; `easing: standard, inOut`). Needs extension to full DTCG scale specified in `MOTION_DESIGN.md` §2.1.
   - `packages/ui/src/tokens/semantic.ts`: Needs semantic motion token exports (`motionTokens`, `--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`, `--motion-distance-reveal`, `--motion-scale-active`).
   - `packages/ui/src/tokens/theme.css`: Defines root transitions and reduced motion media query. Needs CSS variable alignment with `--motion-*` tokens.
3. **Automated Baseline Tool Executions**:
   - `npx pnpm test`: Vitest passed all 23 test files and 258 test cases in 14.02s.
   - `npx pnpm typecheck`: TypeScript completed with 0 errors across `@lingua/types`, `@lingua/ui`, and `@lingua/web`.
   - `npx pnpm lint`: ESLint completed with 0 warnings/errors (`--max-warnings=0`).
   - `npx pnpm build-storybook`: Storybook build compiled and emitted static assets to `packages/ui/storybook-static` in 16.55s.

### 2. Logic Chain
1. **Spec Alignment**: From `MOTION_DESIGN.md` and `MOTION_AUDIT.md`, motion in LINGUA OS is an ergonomic learning aid with strict performance and timing limits. 
2. **Token Layering (R1)**: To eliminate magic animation values across the codebase, primitive motion tokens must live in `primitive.ts`, semantic purpose-driven motion tokens in `semantic.ts`, and CSS variables in `theme.css`.
3. **P0 GSAP Enhancements (R2)**:
   - `ReviewCard` requires smooth 200–250ms answer reveal and 150ms rating button feedback via `useGSAP` with `scope: containerRef` and `contextSafe` event wrappers.
   - `ReviewSession` requires 150ms lateral slide-out and slide-in of queue items.
   - `LanguageBrainCanvas` requires smooth `gsap.to` transform pan & zoom centering to selected concept coordinates.
   - `ConceptNode` requires 200ms scale pulse (1.0 -> 1.05 -> 1.0) and border illumination on status upgrade.
   - `ProgressAnalytics` requires staggered chart bar entrance (50ms stagger, 250ms duration) using `useGSAP`.
4. **Invariant 1, 2, 3 Adherence**:
   - Invariant 1 (Timing limits & zero blocking) is maintained because all primary feedback is ≤ 300ms, and user clicks / keyboard shortcuts are never gated behind animation completion.
   - Invariant 2 (GSAP vs CSS boundary) is strictly respected because Today checkmarks, TimeBudget progress width, Reader popovers, and AppShell active pills remain pure CSS transitions.
   - Invariant 3 (Immediate semantic data correctness) is maintained because DOM text and ARIA attributes reflect true values immediately on render, preventing false learning metric stepping.
5. **Accessibility Invariant (R3)**: When `prefers-reduced-motion: reduce` is enabled, all GSAP tweens collapse to `duration: 0` or instant static state switches (`gsap.set`), and translations/rotations/scales are bypassed.
6. **Storybook & Verification (R4)**: All animated components must feature Storybook stories demonstrating default, active, reduced motion, and dark mode states, and must pass the full verification suite (`typecheck`, `lint`, `test`, `build-storybook`).

### 3. Caveats
- **Read-Only Mining Boundary**: As the Specification Miner, no code changes or implementations were performed. All specifications are cataloged for the orchestrator and implementer agents.
- **Backend Boundary**: `services/**`, `database/**`, and `contracts/**` are strictly out of scope and must not be touched during motion implementation.
- **Next.js 15 Build Note**: `next build` trace collection expects `apps/web/src/app/not-found.tsx` to exist for static page output. Adding `not-found.tsx` in `apps/web` will allow `next build` to complete cleanly.

### 4. Conclusion
The motion specification for LINGUA OS is fully defined, prioritized, and mathematically bound by DTCG tokens, GSAP lifecycle rules, and accessibility standards. The implementation roadmap is unambiguous:
1. **R1**: Extend token scales in `primitive.ts`, `semantic.ts`, and `theme.css`.
2. **R2**: Implement P0/P1 GSAP animations in `ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`, and `ProgressAnalytics` using `@gsap/react` `useGSAP`.
3. **R3**: Enforce `prefers-reduced-motion` instant fallback across all animated components.
4. **R4**: Deliver Storybook motion stories and ensure 100% pass rate on `test`, `typecheck`, `lint`, and `build-storybook`.

### 5. Verification Method
To independently verify the specification compliance during implementation:
1. **Run Unit & E2E Tests**:
   ```powershell
   npx pnpm test
   ```
2. **Run TypeScript Check**:
   ```powershell
   npx pnpm typecheck
   ```
3. **Run ESLint Linter**:
   ```powershell
   npx pnpm lint
   ```
4. **Build Storybook Catalog**:
   ```powershell
   npx pnpm build-storybook
   ```
5. **Inspect Token Exports & CSS Variables**:
   Verify `packages/ui/src/tokens/primitive.ts`, `semantic.ts`, `theme.css`, and `index.ts`.
6. **Inspect Component Lifecycle Scoping**:
   Verify that every animated component uses `useGSAP` with `{ scope: containerRef }` and checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
