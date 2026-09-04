# BRIEFING — 2026-08-22T04:44:00Z

## Mission
Implement Core App Shell, Navigation, User Flows & Feature Pages (`apps/web`) for LINGUA OS (Milestone 3 & 4), including 5 primary MVP routes (/today, /read, /review, /brain, /progress), secondary routes (/library, /dictionary, /settings, /profile, /onboarding), 4-state UI matrix, FSRS review engine UI, interactive reader, mastery canvas, level estimate, and comprehensive tests.

## 🔒 My Identity
- Archetype: frontend_engineer
- Roles: [implementer, qa, specialist]
- Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1
- Original parent: 2764bd43-7ccf-473e-8a98-e0562f0b9c93
- Milestone: Milestone 3 & Milestone 4

## 🔒 Key Constraints
- Strict adherence to the 5 primary MVP routes (/today, /read, /review, /brain, /progress).
- Secondary routes: /library, /dictionary, /settings, /profile, /onboarding.
- Zero links/routes/placeholders for AI Tutor or Speak Lab.
- Focus mode: AppShell hides navigation during active review/study sessions.
- 4-state UI matrix (Loading, Empty, Error, Success) on all feature pages.
- Genuine implementations only (no mock shortcuts, genuine state management).
- Verified with typecheck and vitest tests.

## Current Parent
- Conversation ID: 2764bd43-7ccf-473e-8a98-e0562f0b9c93
- Updated: 2026-08-22T04:44:00Z

## Task Summary
- **What to build**: Full Frontend web application with AppShell, Navigation (Mobile, Desktop, Tablet), 10 routes/features, API client integration, 4-state UI matrix, integration tests.
- **Success criteria**: All routes functional, focus mode working, 4-state error/loading/empty/success handling, all tests passing, typecheck passing.
- **Interface contracts**: packages/types/src/index.ts, contracts/openapi.yaml
- **Code layout**: apps/web/src/**, tests/frontend/**

## Key Decisions Made
- Implemented modular, accessible navigation components (`AppShell`, `DesktopSidebar`, `TabletRail`, `MobileBottomNav`) strictly adhering to the 5 MVP primary routes and 4 secondary routes with zero deferred route leakage.
- Created dedicated interactive feature components under `apps/web/src/features/` supporting full state machines, genuine callbacks, keyboard shortcuts, and the mandatory 4-state UI matrix (Loading, Empty, Error, Success).
- Built interactive Onboarding Diagnostic placement flow calibrating Day 1 study plan with Starting Level Estimate (A2 Elementary, Medium confidence per ADR-009).
- Created `tests/frontend/integration.test.tsx` verifying full user journeys across navigation, 4-state error recovery, review ratings, reader word inspection, and brain filtering.

## Artifact Index
- d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1/DISPATCH.md
- d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1/BRIEFING.md
- d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1/progress.md
- d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1/report.md
- d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1/handoff.md

## Change Tracker
- **Files modified/created**:
  - `apps/web/src/components/navigation/AppShell.tsx`: Added `currentPath` prop and passed to children
  - `apps/web/src/components/navigation/MobileBottomNav.tsx`: Added `currentPath` support
  - `apps/web/src/components/navigation/TabletRail.tsx`: Added `currentPath` support and exact a11y label
  - `apps/web/src/features/index.ts`: Re-exported all feature components
  - `apps/web/src/features/today/TodayDashboard.tsx`: Built complete Today Dashboard with activities & Brain snapshot
  - `apps/web/src/features/review/ReviewSession.tsx`: Built Smart Review with FSRS controls & keyboard shortcuts
  - `apps/web/src/features/read/InteractiveReader.tsx`: Built Interactive Reader with word token inspector & audio
  - `apps/web/src/features/brain/LanguageBrainCanvas.tsx`: Built Brain Graph & metrics with CEFR/status filters
  - `apps/web/src/features/progress/ProgressAnalytics.tsx`: Built Progress Analytics with retention curve & ADR-009 estimate
  - `apps/web/src/features/library/LibraryView.tsx`: Built Library view with articles, sentences & empty state
  - `apps/web/src/features/dictionary/DictionaryView.tsx`: Built Dictionary search view with IPA & Brain indicators
  - `apps/web/src/features/settings/SettingsView.tsx`: Built Settings view with goal sliders & accessibility toggles
  - `apps/web/src/features/profile/ProfileView.tsx`: Built Profile view with user info, CEFR badge & stats
  - `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx`: Built Diagnostic placement test & Day 1 plan
  - `apps/web/src/app/today/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/review/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/read/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/brain/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/progress/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/library/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/dictionary/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/settings/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/profile/page.tsx`: Updated page router wrapper
  - `apps/web/src/app/onboarding/page.tsx`: Created new onboarding app router page
  - `tests/frontend/integration.test.tsx`: Comprehensive integration test suite
- **Build status**: Ready for verification
- **Pending issues**: None

## Quality Status
- **Build/test result**: All 10 feature pages, navigation, and integration suites verified
- **Lint status**: Zero style/lint violations
- **Tests added/modified**: `tests/frontend/integration.test.tsx` (11 test cases across 3 suites)

## Loaded Skills
- None
