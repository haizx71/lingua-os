## 2026-08-21T21:30:33Z
You are the E2E Test Suite Orchestrator & Test Writer for LINGUA OS Frontend Suite.

Your working directory is: d:/LINGUA_OS_PROJECT_STARTER/.agents/test_track_1

Must read first:
- d:/LINGUA_OS_PROJECT_STARTER/ORIGINAL_REQUEST.md
- d:/LINGUA_OS_PROJECT_STARTER/PROJECT.md
- d:/LINGUA_OS_PROJECT_STARTER/TEST_INFRA.md
- d:/LINGUA_OS_PROJECT_STARTER/docs/GEMINI_PROJECT_SPEC.md
- d:/LINGUA_OS_PROJECT_STARTER/design-system/MASTER.md
- d:/LINGUA_OS_PROJECT_STARTER/contracts/openapi.yaml
- d:/LINGUA_OS_PROJECT_STARTER/contracts/enums.json
- d:/LINGUA_OS_PROJECT_STARTER/contracts/errors.json

Your Exclusive Write Ownership:
- `tests/frontend/e2e/**`
- `tests/frontend/harness/**`
- `TEST_READY.md` at project root (publish when test suite is complete).

Scope & Tasks:
1. Build E2E Test Infrastructure & Test Harness:
   - Create test harness in `tests/frontend/harness/` with test renderers, mock provider wrappers, and helper assertion utilities for WCAG 2.2 a11y, ARIA roles, and state checking.
2. Build 4-Tier Test Suite in `tests/frontend/e2e/`:
   - **Tier 1 - Feature Coverage (>=5 tests per feature)**:
     - Coverage across all 12 key frontend features: Contracts & Enums, UI Primitives, Storybook a11y, Navigation Shell, Today Dashboard, Smart Review (FSRS rating), Interactive Reader & Inspector, Language Brain Graph, Progress & Level Estimate, Library & Dictionary, Settings & Profile, 4-State UI Matrix.
   - **Tier 2 - Boundary & Corner Cases (>=5 tests per feature)**:
     - Extreme inputs, empty queues, max text length, diacritics/Vietnamese text, dark/light theme tokens, reduced motion styles, error status codes (401, 403, 404, 422, 500) and retry recovery.
   - **Tier 3 - Cross-Feature Combinations (>=12 pairwise tests)**:
     - Today -> Review rating -> Progress update.
     - Reader word click -> Save concept -> Dictionary entry -> Brain graph node highlight.
     - Onboarding diagnostic -> Starting level estimate -> Today plan generation.
   - **Tier 4 - Real-World Application Scenarios (>=5 tests)**:
     - Full daily study routine simulation.
     - Interrupted session recovery and focus mode keyboard navigation.
3. Validate tests with `vitest run` on the test suite.
4. Publish `TEST_READY.md` at project root with complete summary of test runners, commands, tiers, and checklist.
5. Write your completion report to `d:/LINGUA_OS_PROJECT_STARTER/.agents/test_track_1/report.md` and deliver `handoff.md`.
Send a message back when done.
