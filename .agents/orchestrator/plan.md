# Orchestration Plan: GSAP Motion System Integration for LINGUA OS

## Overview
Implement the GSAP motion system integration across the LINGUA OS frontend ecosystem (`apps/web/**`, `packages/ui/**`, `design-system/**`, `tests/frontend/**`, Storybook) strictly respecting all motion invariants, semantic tokens, high-value P0 components, accessibility compliance (reduced-motion), and verification gates.

## Phases
1. **Phase 0: Comprehensive Survey & Specification Mining**
   - Explorer 1 (Spec Miner): Mine requirements from `design-system/MOTION_DESIGN.md`, `design-system/MOTION_AUDIT.md`, `docs/GEMINI_PROJECT_SPEC.md`, `GEMINI.md`, `MASTER_PROJECT.md`.
   - Explorer 2 (Codebase & Component Inspector): Inspect `apps/web/**`, `packages/ui/**`, `design-system/**` (ReviewCard, ReviewSession, LanguageBrainCanvas, ConceptNode, ProgressAnalytics, existing hooks/tokens/styles).
   - Explorer 3 (Tooling & Test Infra Inspector): Inspect package dependencies, GSAP version/packages, Tailwind/CSS setup, test runners (Vitest/Jest), Storybook configuration, typecheck/lint commands.
2. **Phase 1: Architecture, PROJECT.md & Dual Track Setup**
   - Synthesize survey findings into `PROJECT.md` with Feature Inventory and Interface Contracts.
   - Decompose into Milestones:
     - M1: Semantic Motion Token System & Core GSAP Hooks / Utilities (tokens in design-system/packages/ui, useGSAP / reduced-motion utilities).
     - M2: High-Value P0 Learning Loop Component Enhancements (ReviewCard flip/advance, LanguageBrainCanvas/ConceptNode centering/pulse, ProgressAnalytics staggered bars).
     - M3: Accessibility, prefers-reduced-motion enforcement & edge cases (100% collapse to instant/duration: 0).
     - M4: Storybook Motion Catalog, Visual / Unit Tests & Verification.
3. **Phase 2: Milestone Iteration & Execution Loop**
   - For each milestone: Dispatch Explorer → Worker → Reviewer (x2) → Challenger (x2) → Forensic Auditor.
   - Gate verification: build, typecheck, lint, test, audit pass.
4. **Phase 3: Final Verification & Dual Track Sign-Off**
   - Full suite execution: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build-storybook`, `pnpm build`.
   - Final audit and completion report.
