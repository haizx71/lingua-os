# Implementation Plan — TASK-002: Frontend and Design System Foundation (Approved)

## 1. Overview
Establish the web frontend and design-system foundation for LINGUA OS according to `docs/GEMINI_PROJECT_SPEC.md`, `docs/UI_UX_SKILL_POLICY.md`, and `design-system/DESIGN_BRIEF.md`.

## 2. External Skills Status
- **UI UX Pro Max**: Activated and verified via `scripts/setup-gemini-ui-skill.ps1` (installed under `.gemini/skills/`). Serves as design intelligence for tokens, hierarchy, accessibility, and Storybook stories.
- **Superpowers**: Activated and verified via `scripts/setup-superpowers-gemini.ps1` (installed via `gemini extensions`). Enforces engineering workflow, TDD, reviews, and real verification.

## 3. Package Manager Decision
- **Locked to `pnpm`**: Configured via root `pnpm-workspace.yaml`.
- Single `pnpm-lock.yaml` at root. No secondary package managers or mixed lockfiles.

## 4. Selected Task & Unblocked Rationale
- **Task**: `TASK-002 — Frontend/design-system foundation`
- **Owner**: GEMINI
- **Status**: READY (0 dependencies)
- **Rationale**: Foundation task unblocked to initialize frontend workspaces, global tokens, Storybook catalog, accessible primitives, and the primary MVP application shell with all MVP routes + Profile.

## 5. Affected Files & Artifacts
- `design-system/MASTER.md` [NEW] — Persistent global design system definition
- `plans/TASK-002-frontend-design-foundation.md` [NEW] — This plan
- `pnpm-workspace.yaml` [NEW] — Monorepo workspace configuration
- `package.json` [NEW] — Root package configuration with `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm storybook`
- `packages/ui/package.json`, `packages/ui/tsconfig.json` [NEW]
- `packages/ui/src/tokens/*` [NEW] — Primitive, semantic tokens, theme CSS, concept metadata
- `packages/ui/src/components/*` [NEW] — Accessible primitives (`Button`, `Card`, `Badge`, `ConceptChip`, `Progress`) and state feedback (`Skeleton`, `EmptyState`, `ErrorState`, `InlineAlert`, `LoadingState`)
- `packages/ui/.storybook/*` & `*.stories.tsx` [NEW] — Storybook configuration and stories for all components covering states, variants, light/dark themes, and a11y checks
- `apps/web/package.json`, `apps/web/src/*` [NEW] — Next.js application shell, navigation (Today, Read, Review, Brain, Progress), responsive layouts, route shells (`/today`, `/read`, `/review`, `/brain`, `/progress`, `/library`, `/dictionary`, `/settings`, `/profile`)
- `tests/frontend/*` [NEW] — Unit and a11y tests for design tokens, navigation, and core primitives

## 6. Consumed Contracts
- `contracts/enums.json`: `concept_status`, `learning_activity_type`, `review_rating`, `content_quality_status`
- `contracts/errors.json`: Standard error codes (`UNAUTHENTICATED`, `NOT_FOUND`, `VALIDATION_ERROR`, etc.) for error state mapping
- `contracts/openapi.yaml`: Server endpoint baseline

## 7. Verification Sequence
```bash
npx pnpm install
npx pnpm typecheck
npx pnpm lint
npx pnpm test
npx pnpm --filter @lingua/ui build-storybook
```
