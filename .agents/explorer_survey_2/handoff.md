# Frontend Codebase Survey & GSAP Motion Integration Report

**Survey Date**: 2026-08-22  
**Explorer Agent**: `explorer_survey_2`  
**Status**: INVESTIGATION COMPLETE & VERIFIED  
**Target Scope**: `apps/web/`, `packages/ui/`, `design-system/`, `tests/frontend/`

---

## 1. Observation

Direct code inspections, file paths, line numbers, and tool verification results across the LINGUA OS frontend suite:

### 1.1 Motion Specifications & Policy Contracts
- **`design-system/MOTION_DESIGN.md` (Lines 1–176)**:
  - Establishes the DTCG 3-tier motion token architecture: Primitive (`--motion-duration-*`, `--motion-ease-*`, `--motion-distance-*`, `--motion-scale-*`), Semantic (`--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`), and Component tokens.
  - Mandates React/Next.js `@gsap/react` integration guidelines: `useGSAP()` hook with scoped refs (`{ scope: containerRef }`), lifecycle auto-reversion, `contextSafe` event handlers, and `'use client';` directives.
  - Enforces Motion Invariants: Non-color reliance, zero blocking / immediate user feedback (<300ms interaction feedback), and 100% `prefers-reduced-motion: reduce` collapse to `duration: 0` or subtle opacity cross-fade.
- **`design-system/MOTION_AUDIT.md` (Lines 1–56)**:
  - Formally audits all screens and classifies motion into P0 (High Value GSAP: `ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`), P1 (Contextual GSAP: `ProgressAnalytics` staggered entrance, `InlineAlert` toast; CSS transitions for progress width and reader popovers), and P2 (CSS transitions for AppShell and Diagnostic).

### 1.2 Packages & Dependencies
- **`packages/ui/package.json` (Lines 14–20)**:
  - Already contains `@gsap/react: ^2.1.2`, `gsap: ^3.15.0`, `clsx: ^2.1.1`, `tailwind-merge: ^3.0.1`, `lucide-react: ^0.475.0`.
- **`apps/web/package.json` (Lines 12–23)**:
  - Contains `@gsap/react: ^2.1.2`, `gsap: ^3.15.0`, `@lingua/ui: workspace:*`, `@lingua/types: workspace:*`, `next: ^15.1.7`, `react: ^19.0.0`.

### 1.3 Review Domain Components
- **`packages/ui/src/components/ReviewCard/ReviewCard.tsx` (Lines 1–356)**:
  - **Current Implementation**: Supports 5 modes (`self_recall`, `multiple_choice`, `typing`, `cloze`, `listening`), controlled/uncontrolled reveal state (`isRevealed`), 4 FSRS rating buttons (`again`, `hard`, `good`, `easy`), options, audio pronunciation trigger (`onPlayAudio`), context sentence/translation, and `ConceptChip`.
  - **Motion Handling**: Root container uses `<Card className="... transition-all ...">` (Line 123). Multiple-choice option buttons use Tailwind `transition-all` (Line 208). Answer reveal section uses Tailwind `animate-in fade-in duration-200` (Line 238).
  - **Missing Motion**: No programmatic 3D card flip or cross-fade on prompt -> answer reveal; no animated rating press feedback; no `useGSAP()` or refs attached to the card.
- **`apps/web/src/features/review/ReviewSession.tsx` (Lines 1–324)**:
  - **Current Implementation**: Client component (`'use client';`) managing review queue, keyboard shortcuts (Space to reveal, 1/2/3/4 for ratings), audio state, focus mode, and 4-state UI matrix (loading, empty, error, success).
  - **Motion Handling**: Audio button has `isAudioPlaying ? 'animate-bounce' : ''` (Line 242). Answer container has `animate-fadeIn` (Line 275).
  - **Missing Motion**: Card advancing between queue items (`currentIndex -> currentIndex + 1`) is currently an instant DOM replacement without lateral slide transitions.

### 1.4 Language Brain & Graph Visualization Components
- **`packages/ui/src/components/ConceptNode/ConceptNode.tsx` (Lines 1–107)**:
  - **Current Implementation**: Props include `id`, `label`, `cefr`, `status` (8 contract statuses), `isDue`, `stability`, `difficulty`, `isSelected`, `isFaded`, `size` ('sm' | 'md' | 'lg'), `onClick`. Implements WCAG 2.2 AA non-color invariant using distinct Lucide icons, solid/dashed borders, and localized text.
  - **Motion Handling**: Uses `transition-all` and conditional class `isSelected && 'ring-2 ring-[var(--focus-ring)] shadow-md scale-105'` (Line 92).
  - **Missing Motion**: Lacks status upgrade pulse (scale 1.0 -> 1.05 -> 1.0 with glow) and smooth GSAP selection feedback.
- **`apps/web/src/features/brain/LanguageBrainCanvas.tsx` (Lines 1–392)**:
  - **Current Implementation**: Renders 4 metric summary cards, tri-dimensional evidence progress bars, zoom controls (50%–150%), CEFR filter, status filter, search input, concept node network canvas, and concept detail modal/drawer.
  - **Motion Handling**: Canvas zoom uses CSS inline style `style={{ transform: `scale(${zoomLevel / 100})` }}` with `transition-transform origin-top-left` (Lines 289–291). Drawer uses `animate-fadeIn` (Line 322).
  - **Missing Motion**: No smooth GSAP camera pan/zoom centering to target node coordinates when a concept is clicked.

### 1.5 Progress & Analytics Components
- **`apps/web/src/features/progress/ProgressAnalytics.tsx` (Lines 1–247)**:
  - **Current Implementation**: Displays Learning Evidence & Trends, 7d/30d time window switcher, Weekly Highlights grid, ADR-009 Starting Level Estimate stepper (A1–C2), and activity study time breakdown using `<Progress>` components.
  - **Motion Handling**: Basic CSS `transition-colors` on time window buttons and `transition-all` on stepper cells.
  - **Missing Motion**: No staggered bar entrance animation (`gsap.from` with stagger: 0.05) on initial load or time window switch.
- **`packages/ui/src/components/Progress/Progress.tsx` (Lines 1–71)**:
  - **Current Implementation**: Accessible progressbar (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`).
  - **Motion Handling**: Inner bar has `transition-all duration-300 ease-out` with inline `width: ${percentage}%`. Fully compliant with `MOTION_AUDIT.md` P1 CSS recommendation.

### 1.6 Design Tokens & Theme Configuration
- **`packages/ui/src/tokens/primitive.ts` (Lines 109–119)**:
  - Current `primitiveMotion` contains only `duration: { fast: '150ms', base: '250ms', slow: '400ms' }` and `easing: { standard, inOut }`.
  - Does not yet export the full DTCG scale specified in `MOTION_DESIGN.md` (e.g. `duration-0`, `duration-75`, `duration-150`, `duration-200`, `duration-300`, `duration-400`, `duration-600`, distances `xs` to `lg`, scale tokens).
- **`packages/ui/src/tokens/semantic.ts` (Lines 1–178)**:
  - Contains semantic colors and concept state metadata, but semantic motion token objects are not yet exported.
- **`packages/ui/src/tokens/component.ts` (Lines 1–67)**:
  - Defines component tokens for button, card, chip, badge, navigation, progress, skeleton without explicit component motion tokens.
- **`packages/ui/src/tokens/theme.css` (Lines 55–58, 103–110)**:
  - Defines `--transition-fast: 150ms cubic-bezier(0.2, 0, 0, 1)`, `--transition-base: 250ms ...`.
  - Includes `@media (prefers-reduced-motion: reduce)` collapsing CSS transitions/animations.
- **`apps/web/tailwind.config.js` (Lines 1–37)**:
  - Extends semantic colors and border radii, ready to map motion timing tokens.

### 1.7 Current Test Suite & Build Verification
All tests and build commands pass cleanly:
- **`vitest run`**: 23 test files passed, 258 tests passed (0 failed).
- **`tsc --noEmit`**: 0 TypeScript compilation errors in `packages/ui` and `apps/web`.
- **`eslint . --max-warnings=0`**: 0 lint warnings or errors.
- **`storybook build`**: Storybook 8.6.18 production static build succeeds cleanly in `packages/ui/storybook-static/`.
- **`next build`**: Next.js 15 production build succeeds cleanly, generating all 14 static routes.

---

## 2. Logic Chain

1. **Token Architecture Continuity**:
   - `MOTION_DESIGN.md` defines DTCG 3-tier motion tokens (Primitive → Semantic → Component).
   - In the codebase, `primitive.ts` and `semantic.ts` already exist for colors, typography, and spacing. Adding motion tokens directly into these files and exposing CSS custom variables in `theme.css` will seamlessly fulfill R1 without breaking existing imports or tokens.

2. **P0 GSAP Integration in Learning Loop (`ReviewCard` & `ReviewSession`)**:
   - In `ReviewCard.tsx`, the card flip transition from prompt to answer currently uses conditional rendering `{isRevealed && ...}` with basic Tailwind fade-in.
   - Integrating `@gsap/react` via `useGSAP()` scoped to `cardRef = useRef<HTMLDivElement>(null)` allows smooth 200–250ms flip/cross-fade transforms (`transform: rotateY` or opacity/scale cross-fade) without altering DOM accessibility tree or delaying inputs.
   - In `ReviewSession.tsx`, lateral slide transitions on card completion (`currentIndex` change) can be orchestrated with a `contextSafe` transition or `useGSAP` hook watching `currentIndex`. Keyboard shortcuts (1/2/3/4/Space) must remain zero-blocking (executing state update immediately and allowing GSAP animations to overwrite or complete concurrently).

3. **P0 GSAP Integration in Language Brain (`LanguageBrainCanvas` & `ConceptNode`)**:
   - In `LanguageBrainCanvas.tsx`, selecting a node updates `selectedNode` and renders a drawer. Adding a GSAP smooth camera pan/zoom centering tween (`gsap.to` on the SVG/network container) guides the learner's visual focus to the selected coordinates.
   - In `ConceptNode.tsx`, status updates (e.g. `unseen` → `discovered` → `mastered`) or active selection can trigger a scoped 200ms scale pulse (1.0 → 1.05 → 1.0) using `useGSAP()`.

4. **P1 GSAP Integration in Progress Analytics (`ProgressAnalytics`)**:
   - In `ProgressAnalytics.tsx`, the weekly highlights and activity progress meters are currently statically rendered on mount.
   - Adding a `useGSAP()` timeline on mount / time window change with `gsap.from(bars, { scaleX: 0, stagger: 0.05, duration: 0.25, transformOrigin: 'left' })` will create an elegant staggered entrance while preserving immediately correct semantic ARIA attributes (`aria-valuenow`).

5. **A11y Invariant & `prefers-reduced-motion`**:
   - Every `useGSAP()` animation must check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` (or use `gsap.matchMedia()`) and collapse all durations to `0ms` (instant state switch), ensuring strict compliance with Motion Invariant 3.

---

## 3. Caveats

- **No Backend Impact**: The backend services (`services/`, `database/`, `contracts/`) were not touched and do not require modification for motion features.
- **Client-Side Boundaries**: All GSAP animations must reside within `'use client';` files and run inside `useGSAP()` or client lifecycle hooks to prevent SSR hydration mismatches.
- **Node.js Execution Environment**: On Windows development shell, `npx vitest run`, `npx eslint`, `npx storybook build`, and `node node_modules/next/dist/bin/next build` are the functional equivalents of the `pnpm` scripts.

---

## 4. Conclusion

The frontend codebase is well-structured, modular, and ready for GSAP motion integration:
1. **Dependencies**: `gsap` and `@gsap/react` are already installed in both `packages/ui` and `apps/web`.
2. **Tokens**: DTCG tokens need extension in `primitive.ts`, `semantic.ts`, `component.ts`, and `theme.css` to add the full motion token scale.
3. **P0 Targets**:
   - `ReviewCard.tsx`: Scoped card flip & rating button feedback.
   - `ReviewSession.tsx`: Non-blocking lateral slide advance between queue cards.
   - `LanguageBrainCanvas.tsx`: Smooth centering pan/zoom transform to selected concept coordinates.
   - `ConceptNode.tsx`: Scoped status upgrade pulse & selection micro-interactions.
4. **P1 Targets**:
   - `ProgressAnalytics.tsx`: Staggered progress bar entrance animation.
   - `InlineAlert.tsx`: Toast entrance/exit transitions.
5. **Storybook Catalog**: 23 existing story files build cleanly; new motion stories should be added for `ReviewCard` (flip & reduced motion), `ConceptNode` (pulse), and `ProgressAnalytics` (stagger).

---

## 5. Verification Method

To independently verify the frontend state and all motion-related suites:

1. **Run Unit & Integration Test Suite**:
   ```bash
   npx vitest run
   ```
   *Expected*: 23 test files pass, 258+ tests pass.

2. **Run TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit -p packages/ui/tsconfig.json
   npx tsc --noEmit -p apps/web/tsconfig.json
   ```
   *Expected*: Exits with code 0 (no errors).

3. **Run ESLint**:
   ```bash
   npx eslint . --max-warnings=0
   ```
   *Expected*: Exits with code 0 (0 warnings, 0 errors).

4. **Build Storybook Catalog**:
   ```bash
   cd packages/ui && npx storybook build
   ```
   *Expected*: Storybook static build succeeds in `packages/ui/storybook-static/`.

5. **Build Next.js Web App**:
   ```bash
   cd apps/web && node node_modules/next/dist/bin/next build
   ```
   *Expected*: All 14 routes compile and build statically without error.
