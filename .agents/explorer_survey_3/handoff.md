# Tooling & Test Infrastructure Survey Report: LINGUA OS Frontend & GSAP Motion

**Surveyor**: Tooling & Test Explorer (`explorer_survey_3`)  
**Working Directory**: `d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_survey_3`  
**Date / Timestamp**: 2026-08-22T03:59:30Z  
**Context**: GSAP Motion System Integration Survey (R1–R4)  

---

## 1. Observation

### 1.1 Package Manifests & Workspace Topology
- **Root Manifest** (`package.json:1-36`):
  - Declares workspace with `pnpm@11.22.0`.
  - Scripts:
    - `"dev"`: `"pnpm --filter @lingua/web dev"`
    - `"build"`: `"pnpm -r build"`
    - `"test"`: `"vitest run"`
    - `"typecheck"`: `"pnpm -r typecheck"`
    - `"lint"`: `"eslint . --max-warnings=0"`
    - `"storybook"`: `"pnpm --filter @lingua/ui storybook"`
    - `"build-storybook"`: `"pnpm --filter @lingua/ui build-storybook"`
  - DevDependencies include: `@testing-library/react@^16.2.0`, `@testing-library/jest-dom@^6.6.3`, `vitest@^3.0.5`, `vite@^6.1.0`, `eslint@^9.20.1`, `typescript@^5.7.3`, `tailwindcss@^3.4.17`, `react@^19.0.0`, `react-dom@^19.0.0`.
- **Apps Web Manifest** (`apps/web/package.json:1-33`):
  - Dependencies:
    - `"@gsap/react"`: `"^2.1.2"`
    - `"gsap"`: `"^3.15.0"`
    - `"@lingua/types"`: `"workspace:*"`
    - `"@lingua/ui"`: `"workspace:*"`
    - `"clsx"`: `"^2.1.1"`
    - `"lucide-react"`: `"^0.475.0"`
    - `"next"`: `"^15.1.7"`
    - `"react"`: `"^19.0.0"`
    - `"react-dom"`: `"^19.0.0"`
    - `"tailwind-merge"`: `"^3.0.1"`
  - Scripts: `"dev"`, `"build"`, `"start"`, `"lint"`, `"typecheck"`.
- **UI Package Manifest** (`packages/ui/package.json:1-41`):
  - Dependencies:
    - `"@gsap/react"`: `"^2.1.2"`
    - `"gsap"`: `"^3.15.0"`
    - `"clsx"`: `"^2.1.1"`
    - `"lucide-react"`: `"^0.475.0"`
    - `"tailwind-merge"`: `"^3.0.1"`
  - PeerDependencies: `"react": "^18.0.0 || ^19.0.0"`, `"react-dom": "^18.0.0 || ^19.0.0"`
  - DevDependencies: `storybook@^8.5.6`, `@storybook/react-vite@^8.5.6`, `@storybook/addon-essentials@^8.5.6`, `@storybook/addon-interactions@^8.5.6`, `@storybook/addon-a11y@^8.5.6`, `@chromatic-com/storybook@^3.2.4`, `react@^19.0.0`, `react-dom@^19.0.0`, `typescript@^5.7.3`.
  - Scripts: `"typecheck"`, `"lint"`, `"test"`, `"storybook"`, `"build-storybook"`.
- **Types Package Manifest** (`packages/types/package.json:1-13`):
  - Main & types: `./src/index.ts`.
  - Script: `"typecheck": "tsc --noEmit"`.

### 1.2 GSAP & @gsap/react Status
- Both `gsap` and `@gsap/react` are **already declared and installed** in `pnpm-lock.yaml`:
  - `gsap@3.15.0` (`pnpm-lock.yaml:85,140`)
  - `@gsap/react@2.1.2` (`pnpm-lock.yaml:73,134`)
- Both packages are present in `apps/web/node_modules` and `packages/ui/node_modules`.
- No additional package installation is required for GSAP or `@gsap/react`.

### 1.3 Storybook Setup & Catalog Inventory
- **Location**: `packages/ui/.storybook/`
- **Main Configuration** (`packages/ui/.storybook/main.ts:1-17`):
  - Story pattern: `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)`
  - Framework: `@storybook/react-vite`
  - Addons: `@storybook/addon-essentials`, `@storybook/addon-interactions`, `@storybook/addon-a11y`
- **Preview Configuration** (`packages/ui/.storybook/preview.ts:1-28`):
  - Imports `../src/tokens/theme.css`.
  - Configures light/dark backgrounds (`#F8FAFC`, `#020617`).
  - Configures a11y color-contrast checking.
- **Existing Stories (23 component story files in `packages/ui/src/components/`)**:
  - `Audio/AudioPlayer.stories.tsx`
  - `Badge/Badge.stories.tsx`
  - `BrainSummary/BrainSummaryCard.stories.tsx`
  - `Button/Button.stories.tsx`
  - `Card/Card.stories.tsx`
  - `ConceptChip/ConceptChip.stories.tsx`
  - `ConceptNode/ConceptNode.stories.tsx`
  - `Input/Input.stories.tsx`
  - `Modal/Modal.stories.tsx`
  - `Progress/Progress.stories.tsx`
  - `ReaderSentence/ReaderSentence.stories.tsx`
  - `ReviewCard/ReviewCard.stories.tsx`
  - `Select/Select.stories.tsx`
  - `SkillMeter/SkillMeter.stories.tsx`
  - `Slider/Slider.stories.tsx`
  - `States/EmptyState.stories.tsx`
  - `States/ErrorState.stories.tsx`
  - `States/InlineAlert.stories.tsx`
  - `States/LoadingState.stories.tsx`
  - `States/Skeleton.stories.tsx`
  - `Tabs/Tabs.stories.tsx`
  - `Tooltip/Tooltip.stories.tsx`
  - `WordCard/WordCard.stories.tsx`

### 1.4 Test Infrastructure & Execution
- **Test Configuration** (`vitest.config.ts:1-19`):
  - Runner: Vitest 3.2.7 with `@vitejs/plugin-react`
  - Environment: `jsdom` (JSDOM 26.1.0)
  - Globals: `true`
  - Setup files: `['./tests/frontend/setup.ts']` (loads `@testing-library/jest-dom`)
  - Module aliases: `@lingua/types` -> `./packages/types/src`, `@lingua/ui` -> `./packages/ui/src`, `@` -> `./apps/web/src`.
- **Test Harness** (`tests/frontend/harness/`):
  - `types.ts`, `contract-fixtures.ts`, `mock-api-service.ts`, `a11y-helpers.ts`, `state-helpers.ts`, `test-render.tsx`, `index.ts`.
- **Current Test Results** (`npx pnpm test`):
  - **23 test files passed** (100% pass rate).
  - **258 tests passed**, 0 failed.
  - Duration: ~16.07s.

### 1.5 TypeScript, Tailwind, and Lint Configuration
- **TypeScript**:
  - `apps/web/tsconfig.json`: Target ES2022, module ESNext, moduleResolution `bundler`, strict `true`, path `@/*` -> `./src/*`.
  - `packages/ui/tsconfig.json`: Target ES2022, module ESNext, moduleResolution `bundler`, jsx `react-jsx`, strict `true`.
  - `packages/types/tsconfig.json`: Target ES2022, module ESNext, moduleResolution `bundler`, strict `true`.
  - Build script `npx pnpm typecheck` evaluates all 3 workspace packages with zero errors.
- **Tailwind**:
  - `apps/web/tailwind.config.js`: Scans `./src/**/*.{js,ts,jsx,tsx,mdx}` and `../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}`. Maps CSS variables (`--canvas`, `--surface`, `--action-primary`, `--radius-*`).
  - `apps/web/postcss.config.js`: Configured with `tailwindcss` and `autoprefixer`.
- **ESLint**:
  - `eslint.config.mjs`: ESLint 9 Flat Config using `@typescript-eslint/parser`, ignores node_modules, `.next`, `dist`, `storybook-static`.
  - Command `npx pnpm lint` executes `eslint . --max-warnings=0` with zero warnings/errors.

### 1.6 Verification Scripts Execution Matrix

| Verification Command | Underlying Tooling | Execution Invocation | Result | Output Summary |
| :--- | :--- | :--- | :---: | :--- |
| **`pnpm test`** | Vitest 3.2.7 + JSDOM | `npx pnpm test` | **PASS** | 23 test files passed, 258 tests passed (0 failures) |
| **`pnpm typecheck`** | TypeScript 5.9.3 `tsc --noEmit` | `npx pnpm typecheck` | **PASS** | 3/3 workspace packages checked with 0 errors |
| **`pnpm lint`** | ESLint 9.39.5 Flat Config | `npx pnpm lint` | **PASS** | 0 errors, 0 warnings across all files |
| **`pnpm build-storybook`** | Storybook 8.6.18 + Vite 6.4.3 | `npx pnpm build-storybook` | **PASS** | Output generated to `packages/ui/storybook-static` |
| **`pnpm build`** | Next.js 15.5.23 production | `npx pnpm build` | **PASS** | 14/14 static routes prerendered cleanly |

### 1.7 Existing Frontend Motion & Reduced-Motion Coverage
- **Existing Motion Token Test** (`tests/frontend/tokens.test.ts:40-43`):
  - Asserts `primitiveMotion.duration.fast === '150ms'` and `primitiveMotion.duration.base === '250ms'`.
- **Existing Reduced-Motion Test** (`tests/frontend/e2e/tier2-boundary-states.test.tsx:84-93`):
  - Tests `renderWithProviders` with `{ reducedMotion: true }` asserting `style.transitionDuration === '0s'` and `style.animationDuration === '0s'` on the root wrapper.
- **Identified Coverage Gaps for Motion**:
  1. No unit tests asserting `semanticMotion` token export values in `packages/ui/src/tokens/semantic.ts` (instant: 0, fast: 150ms, normal: 250ms, slow: 400ms, feedback: 200ms, distanceReveal: 8px, scaleActive: 0.98).
  2. No integration tests asserting GSAP `useGSAP` animation lifecycle cleanup on unmount.
  3. No component-level tests verifying `window.matchMedia('(prefers-reduced-motion: reduce)')` instant fallback for `ReviewCard`, `ConceptNode`, and `ProgressAnalytics`.

---

## 2. Logic Chain

1. **Dependency Analysis**:
   - `apps/web/package.json` line 17 and `packages/ui/package.json` line 17 list `"gsap": "^3.15.0"`.
   - `apps/web/package.json` line 13 and `packages/ui/package.json` line 15 list `"@gsap/react": "^2.1.2"`.
   - `pnpm-lock.yaml` lines 73, 85, 134, 140 confirm both packages are resolved and present in `node_modules`.
   - *Inference*: GSAP tooling is ready for immediate component integration; no network installs or package additions are needed.

2. **Environment & Command Invocation**:
   - Direct execution of `pnpm test` failed with `CommandNotFoundException` because `pnpm` is not in the system environment PATH.
   - Execution of `npx pnpm --version` returned `11.22.0` (code 0).
   - *Inference*: All verification scripts in this workspace must be executed via `npx pnpm <command>` or via the direct package binaries (`npx vitest`, `npx eslint`, `npx tsc`, `npx storybook build`, `npx next build`).

3. **Storybook Infrastructure**:
   - `packages/ui/.storybook/main.ts` uses `@storybook/react-vite` and looks for `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)`.
   - `packages/ui/.storybook/preview.ts` correctly imports `theme.css`.
   - Running `npx pnpm build-storybook` successfully builds 23 story modules into `packages/ui/storybook-static/`.
   - *Inference*: Storybook is completely configured and working. Motion stories for animated components (e.g. `ReviewCard`, `ConceptNode`, `ProgressAnalytics`) can be added directly alongside existing stories with reduced-motion and theme knobs.

4. **Test Suite State**:
   - Running `npx pnpm test` runs Vitest 3.2.7 with JSDOM and successfully passes all 23 suites / 258 tests.
   - All tests use opaque-box contracts and testing-library queries.
   - *Inference*: The existing test harness (`tests/frontend/harness/test-render.tsx`) provides an established foundation where GSAP matchMedia mocks and reduced-motion assertions can be seamlessly added without breaking existing suites.

5. **Build & Typecheck State**:
   - `npx pnpm typecheck` successfully passes TypeScript verification across all packages.
   - `npx pnpm lint` passes with 0 warnings.
   - `npx pnpm build` passes Next.js 15 production build with 14 static pages.
   - *Inference*: The entire repository is in a pristine, green state ready for GSAP motion implementation.

---

## 3. Caveats

1. **CLI PATH Constraint**: `pnpm` is not globally aliased in PowerShell PATH; `npx pnpm` must be used for running scripts.
2. **Backend Out of Scope**: Backend services (`services/**`, `database/**`, `contracts/**`) were not executed or altered per strict user instructions.
3. **JSDOM Animation Emulation**: Vitest runs in JSDOM where `requestAnimationFrame` and CSS transitions are not natively rendered at 60fps; GSAP animations in tests should verify either `duration: 0` reduced-motion states, immediate DOM/style attributes, or mock GSAP calls/timelines using Vitest spies (`vi.spyOn(gsap, 'to')` or `gsap.ticker`).
4. **No caveats** regarding build, test, or Storybook breakages—all baseline infrastructure is 100% operational.

---

## 4. Conclusion

The build, tooling, and test infrastructure for LINGUA OS is fully established, verified, and healthy:
1. **GSAP Stack**: `gsap@^3.15.0` and `@gsap/react@^2.1.2` are installed and ready in both `@lingua/ui` and `@lingua/web`.
2. **Storybook**: Storybook 8.6.18 with `@storybook/react-vite` is functioning with 23 component stories and builds cleanly to `storybook-static`.
3. **Test Infrastructure**: Vitest 3.2.7 with JSDOM, React Testing Library, and `@testing-library/jest-dom` is in place, passing 258 tests across 23 test suites.
4. **Validation Scripts**: All 5 mandatory verification scripts (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build-storybook`, `pnpm build`) pass with 0 errors via `npx pnpm`.
5. **Action Plan for GSAP Implementation**:
   - **R1**: Add semantic motion tokens in `packages/ui/src/tokens/semantic.ts` and `theme.css` matching `MOTION_DESIGN.md`. Add token unit tests in `tests/frontend/tokens.test.ts`.
   - **R2**: Integrate `useGSAP` in `ReviewCard`, `ReviewSession`, `LanguageBrainCanvas`, `ConceptNode`, and `ProgressAnalytics` with scoped selectors and contextSafe callbacks.
   - **R3**: Enforce `prefers-reduced-motion` instantaneous fallback (`duration: 0`) across all animated components.
   - **R4**: Enhance Storybook stories with Motion/Reduced-Motion states and add Vitest test coverage for motion lifecycles.

---

## 5. Verification Method

To independently verify all observations and test results, execute the following commands in the project root (`d:/LINGUA_OS_PROJECT_STARTER`):

```powershell
# 1. Verify all 258 Vitest tests pass
npx pnpm test

# 2. Verify TypeScript across all 3 workspace packages
npx pnpm typecheck

# 3. Verify ESLint rules with 0 max warnings
npx pnpm lint

# 4. Verify Storybook production build
npx pnpm build-storybook

# 5. Verify Next.js application production build
npx pnpm build
```

### Key Files to Inspect
- `package.json`, `apps/web/package.json`, `packages/ui/package.json` (dependencies & scripts)
- `packages/ui/.storybook/main.ts`, `packages/ui/.storybook/preview.ts` (Storybook configuration)
- `vitest.config.ts`, `tests/frontend/setup.ts`, `tests/frontend/harness/test-render.tsx` (Test setup)
- `design-system/MOTION_DESIGN.md`, `design-system/MOTION_AUDIT.md` (Motion specifications)

### Invalidation Conditions
- Any failure in `npx pnpm test`, `npx pnpm typecheck`, `npx pnpm lint`, `npx pnpm build-storybook`, or `npx pnpm build`.
- Missing `@gsap/react` or `gsap` dependencies in package manifests.
- Missing `.storybook` configuration files in `packages/ui`.
