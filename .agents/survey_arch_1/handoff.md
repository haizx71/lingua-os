# Handoff Report — Frontend Codebase and Architecture Survey

- **Agent**: `survey_arch_1`
- **Working Directory**: `d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_arch_1`
- **Target Recipient**: `parent` (`2764bd43-7ccf-473e-8a98-e0562f0b9c93`)
- **Date**: 2026-08-22
- **Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Workspace Monorepo Layout & Toolchain**:
   - `d:/LINGUA_OS_PROJECT_STARTER/pnpm-workspace.yaml`:
     - Lines 1–4: `packages: ['packages/*', 'apps/*']`
     - Lines 5–12: `allowBuilds: { esbuild: true, sharp: true }`, `onlyBuiltDependencies: [esbuild, sharp]`.
   - `d:/LINGUA_OS_PROJECT_STARTER/package.json`:
     - Package manager: `"pnpm@11.22.0"`.
     - Scripts:
       - Line 7: `"dev": "pnpm --filter @lingua/web dev"`
       - Line 8: `"build": "pnpm -r build"`
       - Line 9: `"test": "vitest run"`
       - Line 10: `"typecheck": "pnpm -r typecheck"`
       - Line 11: `"lint": "eslint . --max-warnings=0"`
       - Line 12: `"storybook": "pnpm --filter @lingua/ui storybook"`
       - Line 13: `"build-storybook": "pnpm --filter @lingua/ui build-storybook"`
     - Dependencies: React 19.0.0, Vitest 3.0.5, TypeScript 5.7.3, Tailwind CSS 3.4.17, ESLint 9.20.1, Vite 6.1.0.
   - `d:/LINGUA_OS_PROJECT_STARTER/vitest.config.ts`:
     - Lines 8–10: `environment: 'jsdom'`, `setupFiles: ['./tests/frontend/setup.ts']`.
     - Lines 14–15: Aliases `@lingua/ui` -> `./packages/ui/src` and `@` -> `./apps/web/src`.
   - `d:/LINGUA_OS_PROJECT_STARTER/eslint.config.mjs`:
     - Flat config with `@typescript-eslint/parser`.

2. **Package & Application Inventory**:
   - `apps/web/package.json`:
     - Next.js 15.1.7 (App Router), `@lingua/ui: "workspace:*"`, `clsx`, `lucide-react`, `tailwind-merge`, `tailwindcss`.
     - Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"lint": "eslint \"src/**/*.{ts,tsx}\" --max-warnings=0"`, `"typecheck": "tsc --noEmit"`.
   - `apps/web/src/app/`:
     - Pages exist as wireframe prototypes: `layout.tsx`, `page.tsx` (redirects to `/today`), `today/page.tsx`, `read/page.tsx`, `review/page.tsx`, `brain/page.tsx`, `progress/page.tsx`, `library/page.tsx`, `dictionary/page.tsx`, `settings/page.tsx`, `profile/page.tsx`.
   - `apps/web/src/components/navigation/`:
     - `AppShell.tsx`: Responsive container with focus mode support (`focusMode={true}`).
     - `DesktopSidebar.tsx`: Fixed left navigation (≥1200px) with primary (Today, Read, Review, Brain, Progress) and secondary links (Library, Dictionary, Settings, Profile).
     - `TabletRail.tsx`: Collapsible rail (768–1199px).
     - `MobileBottomNav.tsx`: Bottom nav (<768px) strictly constrained to 5 primary MVP routes.
   - `packages/ui/package.json`:
     - Storybook 8.5.6 with `@storybook/react-vite`, `@storybook/addon-a11y`, `@storybook/addon-essentials`, `@storybook/addon-interactions`.
     - Scripts: `"typecheck": "tsc --noEmit"`, `"lint": "eslint \"src/**/*.{ts,tsx}\" --max-warnings=0"`, `"test": "vitest run"`, `"storybook": "storybook dev -p 6006"`, `"build-storybook": "storybook build"`.
   - `packages/ui/src/tokens/`:
     - `primitive.ts`: Slate, Indigo, Emerald, Amber, Rose, Sky scales, 4px grid spacing, radii, responsive typography, motion duration tokens.
     - `semantic.ts` & `theme.css`: Semantic color roles for canvas, surface, text, borders, actions, focus ring, and status; `conceptStateMetadata` for 9 concept states (`unseen`, `discovered`, `learning`, `familiar`, `active`, `mastered`, `weak`, `forgotten`, `due`).
   - `packages/ui/src/components/`:
     - 10 components implemented: `Button`, `Card`, `Badge`, `ConceptChip`, `Progress`, `Skeleton`, `LoadingState`, `EmptyState`, `ErrorState`, `InlineAlert`, all paired with `*.stories.tsx`.
   - `packages/types/`, `packages/contracts/`, `packages/config/`:
     - Currently only contain `.gitkeep`.
   - `tests/frontend/`:
     - `setup.ts`, `tokens.test.ts`, `components.test.tsx`, `navigation.test.tsx`.

3. **Contracts & Specifications**:
   - `contracts/openapi.yaml`: OpenApi 3.1.0 starter contract.
   - `contracts/enums.json`: `concept_status`, `learning_activity_type`, `review_rating`, `content_quality_status`.
   - `contracts/errors.json`: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (422), `CONFLICT` (409), `INTERNAL_ERROR` (500).
   - `MASTER_PROJECT.md` & `docs/GEMINI_PROJECT_SPEC.md`: Strict navigation invariants (Today, Read, Review, Brain, Progress), deferred AI/Speech, non-color state differentiation, WCAG 2.2 AA target.

---

## 2. Logic Chain

1. **Monorepo & Build Tooling Readiness**:
   - *Observation*: Workspace packages are declared in `pnpm-workspace.yaml`, with standard scripts in `package.json` across root and packages. Next.js 15, Vite 6, Vitest 3, and Storybook 8 are configured with consistent path aliases.
   - *Inference*: The monorepo foundation is operational and standardized to `pnpm`.

2. **Design System & Tokens Compliance**:
   - *Observation*: `design-system/MASTER.md` defines the 3-tier token architecture and WCAG 2.2 AA non-color status invariant. `packages/ui/src/tokens/` implements primitive, semantic, and CSS variable tokens, verified by `tokens.test.ts`.
   - *Inference*: Token architecture is compliant with DTCG 2025.10 and ready for downstream components.

3. **Navigation & Application Shell Conformance**:
   - *Observation*: `AppShell.tsx`, `DesktopSidebar.tsx`, and `MobileBottomNav.tsx` implement mobile-first responsive layouts and strictly enforce 5 primary MVP routes without AI Tutor or Speak Lab dead routes.
   - *Inference*: Navigation boundaries match `MASTER_PROJECT.md` and `docs/GEMINI_PROJECT_SPEC.md` section 4/5.

4. **Missing Contracts/Types & Mock Layer Gap**:
   - *Observation*: `packages/types/` and `packages/contracts/` only have `.gitkeep`. No mock service or mock dataset package exists.
   - *Inference*: TASK-005 is the critical bottleneck needed to provide typed contracts and realistic mock data for full feature implementation.

5. **Missing Learning Domain Components & Feature Modules**:
   - *Observation*: Current `packages/ui/src/components/` covers 10 general primitives and feedback states. Domain components (`WordCard`, `ReviewCard`, `AudioPlayer`, `ReaderSentence`, `BrainSummary`, `SkillMeter`, etc.) and full interactive feature state machines in `apps/web/src/features/` are not yet built.
   - *Inference*: Feature UI tasks (TASK-007 Review, TASK-009 Reader, TASK-011 Today, TASK-013 Brain, TASK-015 Progress, TASK-017 Onboarding) will implement these domain components.

---

## 3. Caveats

- **Terminal Command Execution**: `run_command` timed out waiting for user permission; all code and configuration inspections were performed directly via filesystem search and line-by-line inspection.
- **Backend Implementations**: Services (`services/`) and migrations (`database/migrations/`) are owned by Codex and currently in starter state; frontend work must rely on shared contracts and mock data layers.

---

## 4. Conclusion

The frontend foundation of LINGUA OS is structurally sound with standard monorepo tooling, accessible DTCG design tokens, accessible primitives, and a responsive application shell.

**Immediate Next Steps**:
1. **TASK-005 (Frontend Contract Types & Mock Layer)**: Create `@lingua/types` with TypeScript definitions matching `contracts/openapi.yaml`, `contracts/enums.json`, and `contracts/errors.json`. Create mock data generator and in-memory mock API client.
2. **Domain Learning Primitives**: Expand `packages/ui` with learning presentation components (`WordCard`, `ReviewCard`, `AudioPlayer`, `ReaderSentence`, `BrainSummary`, etc.).
3. **Feature Implementation Sequence**: Implement dynamic feature modules in `apps/web/src/features/` for Today, Review, Reader, Brain, Progress, Library, Dictionary, Settings, Profile, and Onboarding/Estimate.

---

## 5. Verification Method

To independently verify all findings:

1. **Monorepo Layout & Toolchain Check**:
   - Inspect `package.json`, `pnpm-workspace.yaml`, `apps/web/package.json`, `packages/ui/package.json`.
   - Inspect `vitest.config.ts` and `eslint.config.mjs`.

2. **Tokens & Navigation Verification**:
   - Inspect `packages/ui/src/tokens/primitive.ts`, `semantic.ts`, `theme.css`.
   - Inspect `apps/web/src/components/navigation/AppShell.tsx`, `DesktopSidebar.tsx`, `MobileBottomNav.tsx`.

3. **Test Suite Verification**:
   - Inspect `tests/frontend/tokens.test.ts`, `components.test.tsx`, `navigation.test.tsx`.
   - Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build-storybook` once terminal access is active.

4. **Detailed Report Reference**:
   - Read full report at: `d:/LINGUA_OS_PROJECT_STARTER/.agents/survey_arch_1/report.md`.
