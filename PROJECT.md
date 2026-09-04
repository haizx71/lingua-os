# Project: LINGUA OS — GSAP Motion System Integration

## Architecture
- **Monorepo Topology**:
  - `packages/types/`: Shared TypeScript domain types and interfaces.
  - `packages/ui/`: Reusable accessible UI component library, tokens, and Storybook catalog.
  - `apps/web/`: Next.js 15 App Router web application containing domain features (`review`, `brain`, `progress`, `today`, `read`, `onboarding`).
  - `design-system/`: Design specifications (`MOTION_DESIGN.md`, `MOTION_AUDIT.md`, `DESIGN_BRIEF.md`, `MASTER.md`).
  - `tests/frontend/`: Vitest + React Testing Library test suites (tokens, components, e2e tiers).
- **Motion Architecture & Boundaries**:
  - **Strict Ownership Boundary**: Frontend only (`apps/web/**`, `packages/ui/**`, `design-system/**`, `tests/frontend/**`). Backend (`services/**`, `database/**`, `contracts/**`) is completely untouched.
  - **Motion Invariant 1 (Timing & Non-blocking)**: Primary feedback ≤300ms (max 500ms for spatial/data viz). Space, 1-4 shortcuts and clicks never blocked.
  - **Motion Invariant 2 (GSAP vs CSS Boundary)**: Simple transitions (hover, active pill, meter width) use CSS. Multi-state coordinated timelines and spatial transforms use `@gsap/react` `useGSAP` with scoped refs.
  - **Motion Invariant 3 (Immediate Semantic Data)**: DOM text and ARIA attributes reflect accurate learning data immediately without fake numerical stepping.
  - **Accessibility Invariant**: 100% collapse to `duration: 0` / instant state change when `prefers-reduced-motion: reduce` is active.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Primitive Motion Tokens | DTCG raw durations (`0`, `75ms`, `150ms`, `200ms`, `300ms`, `400ms`, `600ms`), easings (`standard`, `enter`, `exit`), distances (`xs`-`lg`), scales (`press`, `feedback`) | M1 | `MOTION_DESIGN.md` §2.1 |
| 2 | Semantic Motion Tokens | Purpose-driven tokens (`--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`, `--motion-distance-reveal`, `--motion-scale-active`) | M1 | `MOTION_DESIGN.md` §2.2 |
| 3 | Component Motion Tokens & CSS Variables | Tokens exported in `primitive.ts`, `semantic.ts`, `component.ts`, and root CSS custom properties in `theme.css` with reduced-motion media query | M1 | `MOTION_DESIGN.md` §2.3 |
| 4 | Motion Utilities & Reduced Motion Hook | Shared helper utilities for reduced-motion detection and GSAP context / safe scoping | M1 | `MOTION_DESIGN.md` §4, §5 |
| 5 | ReviewCard Answer Reveal & Rating Feedback | 200–250ms flip/cross-fade reveal with `useGSAP` + 150ms rating button press feedback; zero input delay on Space/1-4 | M2 | `MOTION_DESIGN.md` §3, `MOTION_AUDIT.md` |
| 6 | ReviewSession Lateral Progression | 150ms lateral slide-out / slide-in between queue cards on rating submission with `contextSafe` event handlers | M2 | `MOTION_AUDIT.md` P0 |
| 7 | LanguageBrainCanvas Smooth Centering | Smooth GSAP pan & zoom camera transform centering to selected concept node coordinates without layout shift | M2 | `MOTION_DESIGN.md` §3, `MOTION_AUDIT.md` |
| 8 | ConceptNode Status Pulse & Selection | 200ms subtle scale pulse (1.0 -> 1.05 -> 1.0) and border illumination on status change or selection | M2 | `MOTION_DESIGN.md` §4.1, `MOTION_AUDIT.md` |
| 9 | ProgressAnalytics Staggered Entrance | Staggered 250ms bar entrance (`gsap.from` with 50ms stagger) on mount / time window change; DOM/ARIA data immediate | M2 | `MOTION_AUDIT.md` P1 |
| 10 | Reduced-Motion 100% Collapse Enforcement | Full collapse across all animated components to `duration: 0` / instant state change when reduced motion is preferred | M3 | `MOTION_DESIGN.md` §5 |
| 11 | WCAG 2.2 AA Non-Color & Vestibular Safety | Enforce non-color status indication (icons/borders), zero flashing, zero scroll hijacking, high contrast maintenance | M3 | `GEMINI_PROJECT_SPEC.md` §11 |
| 12 | Storybook Motion Catalog | Add animated, resting, reduced-motion, and dark mode stories for `ReviewCard`, `ConceptNode`, `ProgressAnalytics`, etc. | M4 | `MOTION_DESIGN.md` §6 |
| 13 | Frontend Motion & Lifecycle Unit Tests | Vitest suites asserting motion token values, reduced motion fallback, and GSAP lifecycle cleanup | M4 | `tests/frontend/` |
| 14 | Monorepo Verification Suite | 100% passing across `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build-storybook`, `pnpm build` | M4 | `package.json` |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Semantic Motion Token System & Core Utilities | `packages/ui/src/tokens/**`, `packages/ui/src/hooks/**`, token unit tests | none | DONE |
| M2 | P0/P1 GSAP Learning Loop Component Enhancements | `ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`, `ProgressAnalytics` | M1 | DONE |
| M3 | Accessibility & Prefers-Reduced-Motion Enforcement | All animated components in `packages/ui` & `apps/web` | M2 | DONE |
| M4 | Storybook Motion Catalog & Verification Suite Hardening | Storybook stories, Vitest motion tests, verification gates (`test`, `typecheck`, `lint`, `build-storybook`, `build`) | M3 | DONE |

---

## Interface Contracts

### Tokens (`packages/ui/src/tokens/`)
- `primitiveMotion`:
  - `duration`: `0: '0ms'`, `75: '75ms'`, `150: '150ms'`, `200: '200ms'`, `300: '300ms'`, `400: '400ms'`, `600: '600ms'`.
  - `easing`: `standard: 'cubic-bezier(0.2, 0, 0, 1)'`, `enter: 'cubic-bezier(0, 0, 0.2, 1)'`, `exit: 'cubic-bezier(0.4, 0, 1, 1)'`, `emphasized: 'cubic-bezier(0.2, 0, 0, 1)'`.
  - `distance`: `xs: '2px'`, `sm: '4px'`, `md: '8px'`, `lg: '16px'`.
  - `scale`: `press: 0.98`, `feedback: 1.02`, `pulse: 1.05`.
- `semanticMotion`:
  - `duration`: `instant: '0ms'`, `fast: '150ms'`, `normal: '250ms'`, `slow: '400ms'`, `feedback: '200ms'`.
  - `distance`: `reveal: '8px'`, `slide: '16px'`.
  - `scale`: `active: 0.98`, `highlight: 1.05`.
- CSS Custom Properties (`packages/ui/src/tokens/theme.css`):
  - `--motion-duration-0` through `--motion-duration-600`
  - `--motion-ease-standard`, `--motion-ease-enter`, `--motion-ease-exit`
  - `--motion-instant`, `--motion-fast`, `--motion-normal`, `--motion-slow`, `--motion-feedback`
  - Reduced motion override: `@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; --motion-normal: 0ms; ... } }`

### Component Contracts
- `ReviewCard`:
  - Scoped `useGSAP({ scope: containerRef })`.
  - Flipping/reveal uses `rotateY` or opacity/y cross-fade (200ms–250ms).
  - Rating button press (150ms scale 0.98).
  - Reduced motion: instant `gsap.set` / conditional render with 0 duration.
- `ReviewSession`:
  - Non-blocking keyboard handler (Space to reveal, 1-4 for ratings).
  - Lateral slide transition on card change (`x: -20 -> 0`, `opacity: 0 -> 1`, 150ms).
- `LanguageBrainCanvas`:
  - Pan & zoom centering using `gsap.to` targeting `{ transform: ... }` on selected node coordinates.
- `ConceptNode`:
  - Status upgrade or selection triggers subtle scale pulse (1.0 -> 1.05 -> 1.0, 200ms) with border illumination.
- `ProgressAnalytics`:
  - Staggered bar entrance on mount (`gsap.from(bars, { scaleX: 0, stagger: 0.05, duration: 0.25 })`).

---

## Code Layout
- `packages/ui/src/tokens/primitive.ts` — Raw DTCG motion tokens.
- `packages/ui/src/tokens/semantic.ts` — Purpose-driven semantic motion tokens.
- `packages/ui/src/tokens/component.ts` — Component-specific motion tokens.
- `packages/ui/src/tokens/theme.css` — CSS custom properties for motion & reduced motion.
- `packages/ui/src/tokens/index.ts` — Token bundle export.
- `packages/ui/src/components/ReviewCard/ReviewCard.tsx` — P0 Review card flip & rating animation.
- `packages/ui/src/components/ConceptNode/ConceptNode.tsx` — P0 Concept node status pulse & selection.
- `apps/web/src/features/review/ReviewSession.tsx` — P0 Review queue lateral slide transition.
- `apps/web/src/features/brain/LanguageBrainCanvas.tsx` — P0 Brain network camera centering.
- `apps/web/src/features/progress/ProgressAnalytics.tsx` — P1 Progress analytics staggered entrance.
- `packages/ui/src/components/ReviewCard/ReviewCard.stories.tsx` — Review card motion & reduced-motion stories.
- `packages/ui/src/components/ConceptNode/ConceptNode.stories.tsx` — Concept node pulse stories.
- `tests/frontend/tokens.test.ts` — Token scale assertions.
- `tests/frontend/motion.test.tsx` — GSAP lifecycle & reduced motion assertions.
