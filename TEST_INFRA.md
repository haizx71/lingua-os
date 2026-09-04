# E2E Test Infra: LINGUA OS MVP Frontend Suite

## Test Philosophy
- Opaque-box, requirement-driven derived from `ORIGINAL_REQUEST.md`, `contracts/openapi.yaml`, and `docs/GEMINI_PROJECT_SPEC.md`.
- Zero coupling to internal component implementations.
- Testing Methodology: 4-tier systematic approach (Category-Partition, Boundary Value Analysis, Pairwise Combinatorial, Real-World Workload Testing).

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | Contract Types & Mock Layer | openapi.yaml, enums.json | 5 | 5 | ✓ | ✓ |
| 2 | UI Primitives & WCAG 2.2 AA | MASTER.md, UI_UX_SKILL_POLICY | 5 | 5 | ✓ | ✓ |
| 3 | Storybook Catalog Coverage | GEMINI_PROJECT_SPEC §10 | 5 | 5 | ✓ | ✓ |
| 4 | App Shell & Responsive Nav | GEMINI_PROJECT_SPEC §4/5 | 5 | 5 | ✓ | ✓ |
| 5 | Today Dashboard & Queue | GEMINI_PROJECT_SPEC §6.1 | 5 | 5 | ✓ | ✓ |
| 6 | Smart Review (FSRS Rating) | GEMINI_PROJECT_SPEC §6.2, ADR-003 | 5 | 5 | ✓ | ✓ |
| 7 | Interactive Reader & Inspector | GEMINI_PROJECT_SPEC §6.3 | 5 | 5 | ✓ | ✓ |
| 8 | Language Brain Graph & Canvas | GEMINI_PROJECT_SPEC §6.4 | 5 | 5 | ✓ | ✓ |
| 9 | Progress & Level Estimation | GEMINI_PROJECT_SPEC §6.5, ADR-009 | 5 | 5 | ✓ | ✓ |
| 10 | Library & Dictionary | GEMINI_PROJECT_SPEC §6.6/6.7 | 5 | 5 | ✓ | ✓ |
| 11 | Settings & Profile | GEMINI_PROJECT_SPEC §6.8 | 5 | 5 | ✓ | ✓ |
| 12 | 4-State UI (Loading/Empty/Error/Success) | MASTER.md, GEMINI_PROJECT_SPEC §8 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Vitest (`pnpm test` / `vitest run`)
- Test Locations: `tests/frontend/e2e/`, `tests/frontend/components/`, `tests/frontend/contracts/`
- Test Harness: In-memory mock server and contract fixtures validating requests/responses, state transitions, accessibility compliance, and DOM rendering.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Complete Daily Study Loop (Today -> Review -> Reader -> Brain -> Progress) | F4, F5, F6, F7, F8, F9 | High |
| 2 | Error Recovery & Network Retry Workflow (Simulated 500/401 -> ErrorState -> Retry Action) | F1, F2, F12 | Medium |
| 3 | Deep Concept Inspection from Reader to Dictionary to Brain | F7, F8, F10 | High |
| 4 | Onboarding Diagnostic Placement & Goal Setting | F1, F4, F9, F11 | Medium |
| 5 | Focus Mode Study Session with Keyboard Shortcuts (Space/1/2/3/4) | F4, F6, F12 | Medium |

## Coverage Thresholds
- Tier 1 (Feature Coverage): ≥60 tests (5 × 12 features)
- Tier 2 (Boundary & Corner Cases): ≥60 tests (5 × 12 features)
- Tier 3 (Cross-Feature Combinations): ≥12 tests
- Tier 4 (Real-World Application Scenarios): ≥5 realistic workload tests
- **Total Minimum Threshold**: ≥137 tests
