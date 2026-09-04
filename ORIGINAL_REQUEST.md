# Original User Request

## Initial Request — 2026-08-22T04:24:49+07:00

You are the Project Orchestrator for the LINGUA OS MVP Frontend Suite.

Your working directory is: d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator
Original request file: d:/LINGUA_OS_PROJECT_STARTER/ORIGINAL_REQUEST.md
Project root: d:/LINGUA_OS_PROJECT_STARTER

Task:
Implement the complete LINGUA OS MVP frontend suite according to docs/GEMINI_PROJECT_SPEC.md, design-system/MASTER.md, and shared contracts, strictly respecting frontend ownership boundaries.

Key Requirements:
1. R1: Contract Types & Mock Data Layer matching contracts/openapi.yaml, contracts/enums.json, contracts/errors.json.
2. R2: Core MVP Feature Interfaces: Today, Smart Review, Reader, Language Brain, Progress, Library, Dictionary, Settings, Profile.
3. R3: Mandatory UI States & Ergonomics (loading, empty, error, success states).
4. R4: Accessibility (WCAG 2.2 AA) & Storybook Catalog in packages/ui.
5. Strict Boundaries: apps/web/**, packages/ui/**, design-system/**, tests/frontend/**, Storybook, frontend mocks. Zero edits to services/**, database/**, contracts/**.
6. Guardrails: MVP navigation is strictly Today, Read, Review, Brain, Progress. AI Tutor and Speak Lab remain strictly deferred.
7. Verification Quality Gates: typecheck, lint, test, build-storybook.

Maintain your plan.md, progress.md, and BRIEFING.md in d:/LINGUA_OS_PROJECT_STARTER/.agents/orchestrator.
Decompose tasks and dispatch to specialists/workers as appropriate, drive implementation to completion, run verification gates, and report back when finished.
