# LINGUA OS — Comprehensive Frontend Codebase & Architecture Report

- **Date**: 2026-08-22
- **Agent**: survey_arch_1 (Frontend Codebase and Architecture Explorer)
- **Scope**: Monorepo layout, toolchains, package inventory, scripts, routing, state management, API client & mocking architecture.
- **Reference Documents**: `ORIGINAL_REQUEST.md`, `MASTER_PROJECT.md`, `docs/GEMINI_PROJECT_SPEC.md`, `docs/ENGINEERING_WORKFLOW.md`, `contracts/*`, `design-system/MASTER.md`, `TASKS.md`, `DECISIONS.md`.

---

## 1. Executive Summary

The LINGUA OS repository is configured as a `pnpm` monorepo using Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS 3.4 with PostCSS, Vitest 3.0, and Storybook 8.5. 

The initial foundation (`TASK-002`) has laid down:
- The persistent design system specification (`design-system/MASTER.md`).
- DTCG 2025.10-compliant 3-tier design tokens (`packages/ui/src/tokens/`).
- 10 accessible UI primitives and state feedback components with Storybook stories (`packages/ui/src/components/`).
- Responsive application shell with desktop sidebar, tablet rail, mobile bottom navigation, and focus mode (`apps/web/src/components/navigation/`).
- Wireframe page prototypes for the 9 primary and secondary routes (`/today`, `/read`, `/review`, `/brain`, `/progress`, `/library`, `/dictionary`, `/settings`, `/profile`).
- Baseline unit/component tests in `tests/frontend/`.

However, the architecture requires implementation of:
1. `packages/types/`: Full TypeScript types derived from `contracts/openapi.yaml`, `contracts/enums.json`, and `contracts/errors.json`.
2. `packages/mocks/` / Mock Data Layer: Contract-valid mock datasets and in-memory mock API handlers for offline development and testing.
3. Feature Domain Modules in `apps/web/src/features/` (Today, Smart Review, Reader, Language Brain, Progress, Library, Dictionary, Settings, Profile, Onboarding & Starting Level Estimate).
4. Additional Learning Presentation Components in `packages/ui/src/components/learning/` (e.g. `WordCard`, `ReviewCard`, `AudioPlayer`, `ReaderSentence`, `BrainSummary`, etc.).
5. Comprehensive test coverage for all feature workflows, API error handling, and automated accessibility (axe) checks.

---

## 2. Monorepo Structure & Package Inventory

### 2.1 Monorepo Configuration
- **Package Manager**: `pnpm@11.22.0` (defined in `package.json` and `pnpm-workspace.yaml`).
- **Workspace Config (`pnpm-workspace.yaml`)**:
  ```yaml
  packages:
    - 'packages/*'
    - 'apps/*'
  allowBuilds:
    esbuild: true
    sharp: true
  onlyBuiltDependencies:
    - esbuild
    - sharp
  ```
- **Lockfile**: Single `pnpm-lock.yaml` at workspace root.

### 2.2 Package Breakdown

| Package / App | Path | Status | Purpose & Role |
| :--- | :--- | :--- | :--- |
| **`@lingua/web`** | `apps/web/` | Foundation Implemented | Next.js 15 App Router web application; mobile-first adaptive UX. |
| **`@lingua/mobile`** | `apps/mobile/` | Placeholder (`.gitkeep`) | Mobile app placeholder. MVP primary UX is responsive web in `apps/web`. |
| **`@lingua/ui`** | `packages/ui/` | Foundation Implemented | Shared UI design system, DTCG tokens, accessible primitives, Storybook 8. |
| **`@lingua/types`** | `packages/types/` | Skeleton (`.gitkeep`) | Shared TypeScript types derived from OpenAPI & contract schemas. |
| **`@lingua/contracts`** | `packages/contracts/`| Skeleton (`.gitkeep`) | Shared contract definitions (root contracts currently in `/contracts/`). |
| **`@lingua/config`** | `packages/config/` | Skeleton (`.gitkeep`) | Shared tooling configurations (ESLint, TSConfig, Tailwind presets). |
| **`tests/frontend`** | `tests/frontend/` | Baseline Implemented | Vitest + React Testing Library unit & component tests. |

---

## 3. Toolchain & Configuration Analysis

### 3.1 Framework, Runtime & Bundling
- **React & Next.js**: React 19.0.0, React-DOM 19.0.0, Next.js 15.1.7 (`apps/web`).
- **Component Explorer**: Storybook 8.5.6 with `@storybook/react-vite` framework (`packages/ui`).
- **Test Runner**: Vitest 3.0.5 with `@vitejs/plugin-react` and `jsdom` environment (`vitest.config.ts`).
- **Icons**: `lucide-react@0.475.0`.
- **CSS Utility**: `clsx@2.1.1` and `tailwind-merge@3.0.1`.

### 3.2 TypeScript Configuration
- **Root**: TypeScript 5.7.3.
- **`apps/web/tsconfig.json`**:
  - Target: `ES2022`, Module: `esnext`, Module Resolution: `bundler`, JSX: `preserve` (Next.js).
  - Path Aliases: `"@/*": ["./src/*"]`.
- **`packages/ui/tsconfig.json`**:
  - Target: `ES2022`, Module: `ESNext`, Module Resolution: `bundler`, JSX: `react-jsx`.
  - Transpilation: Next.js transpiles `@lingua/ui` via `transpilePackages: ['@lingua/ui']` in `next.config.js`.
- **`vitest.config.ts`**:
  - Path Aliases:
    - `'@lingua/ui' -> './packages/ui/src'`
    - `'@' -> './apps/web/src'`

### 3.3 Styling & Token Architecture
- **Tailwind CSS 3.4.17** with **PostCSS 8.5.2** and **Autoprefixer 10.4.20**.
- **Token Layering (DTCG 2025.10)**:
  1. *Primitive Scale* (`packages/ui/src/tokens/primitive.ts`): Slate (50–950), Indigo (50–700), Emerald, Amber, Rose, Sky, 4px grid spacing, radii (`sm`, `md`, `lg`, `xl`, `full`), typography scale, motion durations (`150ms`, `250ms`, `400ms`).
  2. *Semantic Scale* (`packages/ui/src/tokens/semantic.ts` & `theme.css`): Light and dark theme CSS variables mapped to semantic roles (`--canvas`, `--surface`, `--surface-subtle`, `--surface-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-subtle`, `--border-default`, `--border-strong`, `--action-primary`, `--focus-ring`, `--status-success`, `--status-warning`, `--status-danger`, `--status-info`).
  3. *Concept Status Metadata*: 9 concept states (`unseen`, `discovered`, `learning`, `familiar`, `active`, `mastered`, `weak`, `forgotten`, `due`) mapped with distinct icons, Vietnamese labels, color roles, and border styles.
  4. *Tailwind Extension (`apps/web/tailwind.config.js`)*: Consumes CSS variables directly (`colors: { canvas: 'var(--canvas)', ... }`).

### 3.4 Linting & Formatting
- **ESLint 9.20.1** using flat config format (`eslint.config.mjs`).
- Parser: `@typescript-eslint/parser@8.24.1`.
- Max warnings policy: `--max-warnings=0` enforced in package scripts.

---

## 4. Script Matrix Across Packages

| Scope | Script Name | Exact Command | Description |
| :--- | :--- | :--- | :--- |
| **Root** | `pnpm dev` | `pnpm --filter @lingua/web dev` | Starts Next.js development server |
| **Root** | `pnpm build` | `pnpm -r build` | Recursive build across all workspace packages |
| **Root** | `pnpm test` | `vitest run` | Runs Vitest unit and integration test suite |
| **Root** | `pnpm typecheck` | `pnpm -r typecheck` | Recursive TypeScript typecheck (`tsc --noEmit`) |
| **Root** | `pnpm lint` | `eslint . --max-warnings=0` | Root-level linting across all `.ts, .tsx, .js` files |
| **Root** | `pnpm storybook` | `pnpm --filter @lingua/ui storybook` | Runs Storybook dev server on port 6006 |
| **Root** | `pnpm build-storybook`| `pnpm --filter @lingua/ui build-storybook` | Builds static Storybook catalog |
| **`apps/web`** | `pnpm --filter @lingua/web dev` | `next dev` | Local Next.js dev server |
| **`apps/web`** | `pnpm --filter @lingua/web build` | `next build` | Next.js production build |
| **`apps/web`** | `pnpm --filter @lingua/web start` | `next start` | Next.js production server |
| **`apps/web`** | `pnpm --filter @lingua/web lint` | `eslint "src/**/*.{ts,tsx}" --max-warnings=0` | Lint web app source files |
| **`apps/web`** | `pnpm --filter @lingua/web typecheck`| `tsc --noEmit` | Typecheck web app |
| **`packages/ui`**| `pnpm --filter @lingua/ui typecheck` | `tsc --noEmit` | Typecheck UI package |
| **`packages/ui`**| `pnpm --filter @lingua/ui lint` | `eslint "src/**/*.{ts,tsx}" --max-warnings=0` | Lint UI package source files |
| **`packages/ui`**| `pnpm --filter @lingua/ui test` | `vitest run` | Run Vitest tests |
| **`packages/ui`**| `pnpm --filter @lingua/ui storybook` | `storybook dev -p 6006` | Storybook UI catalog |
| **`packages/ui`**| `pnpm --filter @lingua/ui build-storybook`| `storybook build` | Build Storybook static assets |

---

## 5. Detailed Component & State Inventory

### 5.1 Existing Primitives & States in `packages/ui`

| Component | Source Path | Storybook Story | Accessibility & Ergonomics Invariant |
| :--- | :--- | :--- | :--- |
| **`Button`** | `packages/ui/src/components/Button/Button.tsx` | `Button.stories.tsx` | Min touch target 44px (md/icon) and 48px (lg), `aria-busy` when loading, disabled styles, focus ring. |
| **`Card`** | `packages/ui/src/components/Card/Card.tsx` | `Card.stories.tsx` | Semantic surfaces: `default`, `subtle`, `elevated`, `interactive`, `accent`. |
| **`Badge`** | `packages/ui/src/components/Badge/Badge.tsx` | `Badge.stories.tsx` | Compact indicator for status/level/time. |
| **`ConceptChip`** | `packages/ui/src/components/ConceptChip/ConceptChip.tsx` | `ConceptChip.stories.tsx` | **Non-color invariant**: icon + labelVi + borderStyle (solid/dashed) + accessible `role="status"` + `aria-label`. |
| **`Progress`** | `packages/ui/src/components/Progress/Progress.tsx` | `Progress.stories.tsx` | Native `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, label, value text. |
| **`Skeleton`** | `packages/ui/src/components/States/Skeleton.tsx` | `Skeleton.stories.tsx` | CLS-prevention layout placeholders, pulse animation respects `prefers-reduced-motion`. |
| **`LoadingState`** | `packages/ui/src/components/States/LoadingState.tsx` | `LoadingState.stories.tsx` | Accessible loading container with message. |
| **`EmptyState`** | `packages/ui/src/components/States/EmptyState.tsx` | `EmptyState.stories.tsx` | `role="region"`, calm icon, explanation, clear actionable CTA. |
| **`ErrorState`** | `packages/ui/src/components/States/ErrorState.tsx` | `ErrorState.stories.tsx` | `role="alert"`, `aria-live="assertive"`, error code mapping (`UNAUTHENTICATED`, `NOT_FOUND`, etc.), retry button. |
| **`InlineAlert`** | `packages/ui/src/components/States/InlineAlert.tsx` | `InlineAlert.stories.tsx` | `role="alert"`, variants: info, warning, danger, success. |

### 5.2 Required Components to Implement for Complete MVP

1. **Learning Presentation Components (`packages/ui/src/components/learning/` or feature-specific)**:
   - `WordCard` (word, IPA, part of speech, status, quick save)
   - `ReviewCard` (prompt, think, reveal answer, rating selector)
   - `AnswerOption` (accessible option cards for multiple-choice / cloze)
   - `AudioPlayer` (accessible sentence / word audio controls with playback speeds)
   - `ReaderSentence` (sentence tokenized into interactive clickable words)
   - `TranslationReveal` (collapsible / revealed sentence translations)
   - `VocabularyPopover` (definition, CEFR level, example sentence, add to brain)
   - `ContentCard` (reading passage cards with fit percentage, difficulty badge, word count)
   - `BrainSummary` (mastered, learning, weak counts + memory health gauge)
   - `SkillMeter` (tri-dimensional progress bars: recognition, listening, production)
   - `TrendCard` & `MemoryHealth` (evidence metrics, weekly learning days)

2. **Form Controls & Overlays**:
   - `TextField`, `SearchField`, `Select`, `Slider`, `SegmentedControl`
   - `Modal`, `BottomSheet` / `Drawer`, `Tooltip`, `Popover`, `Dialog`

---

## 6. Information Architecture, Routing & Application Shell

### 6.1 Routing Map

```
/ (Root) ───[ Redirect 307 ]───> /today

Primary Navigation (Strict MVP Invariant):
├── /today         Today Dashboard (daily time budget, 4 adaptive activities, brain snapshot)
├── /read          Reader / Immersion (reading passage, word tap popover, sentence mining)
├── /review        Smart Review (FSRS due queue, flashcard player, 4-tier rating)
├── /brain         Language Brain (concept matrix, tri-dimensional evidence, concept detail)
└── /progress      Progress Dashboard (learning evidence trends, weekly learning days, memory health)

Secondary Navigation:
├── /library       Library (saved content, mined sentences, vocabulary, history)
├── /dictionary    Dictionary & Search (lexical lookup, senses, audio, concept status)
├── /settings      Settings (learning goals, daily minutes, language, accessibility, privacy)
└── /profile       Learner Profile (starting level estimate, confidence, history)

Onboarding & Assessment Flow:
├── /onboarding    Multi-step onboarding wizard (goal, daily time, self-estimate)
└── /estimate      Starting Level Estimate (adaptive assessment & result with confidence)

Post-MVP Feature Gates (Strictly Deferred — No MVP Dead Routes):
├── AI Tutor       (Deferred — Post-MVP)
└── Speak Lab      (Deferred — Post-MVP)
```

### 6.2 Responsive Shell Architecture (`apps/web/src/components/navigation/`)
- **Desktop (`≥ 1200px`)**: Fixed 260px Left Sidebar (`DesktopSidebar.tsx`) with Brand Logo, 5 Primary Nav Items, 4 Secondary Nav Items, User Profile snippet, and main content max-width 1080px (reading passages constrained to 720px).
- **Tablet (`768px – 1199px`)**: Collapsible Left Rail (`TabletRail.tsx`) with icons and accessible tooltips.
- **Mobile (`< 768px`)**: Fixed Bottom Navigation Bar (`MobileBottomNav.tsx`) strictly showing the 5 primary routes with `h-16`, touch targets `≥ 44px`, and safe-area padding (`pb-safe`).
- **Focus Mode**: In `AppShell.tsx`, `focusMode={true}` strips all sidebars and bottom navigation to provide distraction-free immersion for `/review`, active reading, or level estimation.

---

## 7. State Management, API Client & Mocking Architecture

### 7.1 State Management Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                       Client State Layer                     │
├─────────────────────────┬───────────────────────────────────┤
│ Server State            │ Typed API Client + React Query    │
│ (Remote data / cache)   │ - /today, /review, /brain, etc.   │
├─────────────────────────┼───────────────────────────────────┤
│ Ephemeral Session State │ React Context / Local State       │
│ (Active workflow)       │ - Review queue index, flip state  │
│                         │ - Reader selected word / audio pos│
├─────────────────────────┼───────────────────────────────────┤
│ Form / Input State      │ Controlled inputs / Form handlers │
│                         │ - Settings form, search query     │
├─────────────────────────┼───────────────────────────────────┤
│ User Preferences        │ LocalStorage / Cookie             │
│ (Client settings)       │ - Dark/Light mode, Reduced Motion │
│                         │ - Audio playback speed default    │
└─────────────────────────┴───────────────────────────────────┘
```

**Non-negotiable Invariant**: The client MUST NOT duplicate or calculate server domain heuristics (e.g. FSRS intervals, concept stability scores, Today scheduling priorities). All learning decisions originate from the server or contract mocks.

### 7.2 API Client & Error Handling Architecture
- **Contract Source of Truth**: `contracts/openapi.yaml`, `contracts/enums.json`, `contracts/errors.json`.
- **API Client Implementation**: Typed fetch client wrapping standard HTTP methods with automatic header injection (auth token, `Accept: application/json`).
- **Error Normalization**:
  - Intercepts non-2xx responses.
  - Maps `code` field against `contracts/errors.json`:
    - `UNAUTHENTICATED` (401) → Preserves destination and redirects to auth.
    - `FORBIDDEN` (403) → Renders permission denied alert.
    - `NOT_FOUND` (404) → Renders not found state with safe return route.
    - `VALIDATION_ERROR` (422) → Renders form / input feedback.
    - `INTERNAL_ERROR` (500) → Renders recoverable error with retry CTA.

### 7.3 Mocking Layer Architecture (TASK-005)
- **Deterministic Mock Generator**: Generates realistic learner datasets:
  - User: A2 Elementary, English learner, 25 min/day goal.
  - Today Plan: 4 activities (Review 8m / 23 due; Read 10m / 95% fit; Listen 4m; Learn 3m).
  - Review Queue: 23 due items (with terms, sentences, audio, definitions, IPA).
  - Language Brain: 483 Mastered, 71 Learning, 28 Weak, 87% Memory Health, Recognition 72%, Listening 54%, Production 38%.
  - Reading Passages: Level A2 passages with inline concept tags, translations, and audio sources.
- **Mock Toggle**: Controlled via `NEXT_PUBLIC_USE_MOCKS=true` or mock provider adapter.
- **State Matrix Simulation**: Mocks must provide switches to test:
  1. *Loading State*: Simulated network latency (e.g. 500ms).
  2. *Empty State*: Simulated 0 due reviews, empty library, zero search results.
  3. *Error State*: Simulated 401, 404, 500 server errors to verify retry ergonomics.
  4. *Success State*: Valid payload rendering full UI.

---

## 8. Gap Analysis & Roadmap for Gemini / Implementation

| Domain | Existing Foundation | Missing / Next Steps | Priority |
| :--- | :--- | :--- | :--- |
| **`packages/types`** | Empty directory (`.gitkeep`) | Create `package.json`, `tsconfig.json`, export full TypeScript interfaces for all contract entities & enums. | **P0 (TASK-005)** |
| **Mock Layer** | None | Implement `packages/mocks/` or `apps/web/src/mocks/` with realistic datasets and mock API fetcher. | **P0 (TASK-005)** |
| **Learning UI Primitives** | 10 base primitives & states | Implement `WordCard`, `ReviewCard`, `AudioPlayer`, `ReaderSentence`, `SkillMeter`, `BrainSummary` + Storybook stories. | **P1 (TASK-007/009/013)** |
| **Today Feature** | Wireframe UI | Connect to Today API / mock, implement activity launch, timer progress, session completion summary. | **P1 (TASK-011)** |
| **Smart Review Feature** | Wireframe UI | Implement interactive FSRS review session, rating trigger (Again/Hard/Good/Easy), keyboard shortcuts, queue completion. | **P1 (TASK-007)** |
| **Reader Feature** | Wireframe UI | Implement interactive passage parsing, word popover, sentence mining save action, audio playback. | **P1 (TASK-009)** |
| **Language Brain Feature**| Wireframe UI | Implement status filter tabs, concept drill-down drawer, tri-dimensional evidence breakdown. | **P1 (TASK-013)** |
| **Progress Feature** | Wireframe UI | Implement weekly learning day indicators, memory health trend visualizations, evidence summaries. | **P1 (TASK-015)** |
| **Onboarding & Estimate** | None | Implement onboarding step wizard (`/onboarding`) and adaptive Starting Level Estimate test (`/estimate`). | **P1 (TASK-017)** |
| **Testing & QA** | 3 test suites in `tests/frontend` | Add feature workflow tests, axe automated accessibility tests, and mock API tests. | **P1 (All Tasks)** |

---

## 9. Conclusion

The LINGUA OS frontend architecture has a clean foundation:
- Monorepo tooling (`pnpm`, Next.js 15, TypeScript 5.7, Vitest 3.0, Storybook 8.5) is configured.
- DTCG design tokens and accessible primitives strictly honor the non-color accessibility invariant and master design system.
- The application shell enforces mobile-first responsiveness and strict MVP navigation boundaries (no dead AI/Speak routes).

The critical immediate next milestone is **TASK-005**: generating/defining shared TypeScript types in `packages/types/` and implementing the contract-valid mock data layer, enabling parallel development of the learning feature suite (`Today`, `Review`, `Reader`, `Brain`, `Progress`).
