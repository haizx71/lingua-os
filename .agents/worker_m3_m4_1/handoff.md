# Handoff Report: Milestone 3 & 4 Core App Shell, Navigation & Feature Pages

- **Agent:** `worker_m3_m4_1`
- **Milestone:** Milestone 3 & Milestone 4
- **Date:** 2026-08-22
- **Handoff Type:** Hard (Task Complete)

---

## 1. Observation

- **Navigation Shell**:
  - `apps/web/src/components/navigation/DesktopSidebar.tsx`: Implemented desktop sidebar containing exactly 5 primary MVP routes (`/today`, `/read`, `/review`, `/brain`, `/progress`), secondary routes (`/library`, `/dictionary`, `/settings`, `/profile`), and learner profile footer.
  - `apps/web/src/components/navigation/MobileBottomNav.tsx`: Implemented mobile bottom bar with 5 primary routes and touch target sizes >= 48px.
  - `apps/web/src/components/navigation/TabletRail.tsx`: Implemented compact tablet rail with accessible label `Điều hướng thanh bên thu gọn`.
  - `apps/web/src/components/navigation/AppShell.tsx`: Implemented layout wrapper supporting `focusMode` (which suppresses all navigation bars) and `currentPath` routing prop.
  - Strictly **zero** dead routes or links for deferred AI Tutor or Speak Lab.
- **Feature Modules & App Router Pages**:
  - `apps/web/src/features/today/TodayDashboard.tsx` & `apps/web/src/app/today/page.tsx`: Today Dashboard with daily goal progress, start CTA, 4 recommended activities with explainable badges, and Brain snapshot with concept chips.
  - `apps/web/src/features/review/ReviewSession.tsx` & `apps/web/src/app/review/page.tsx`: Smart Review with FSRS controls, card flip, 4 ratings (`Again`, `Hard`, `Good`, `Easy`), keyboard shortcuts (1-4, Space), progress bar (15% for 3/23 cards), and completion summary.
  - `apps/web/src/features/read/InteractiveReader.tsx` & `apps/web/src/app/read/page.tsx`: Interactive Reader with tokenized text, word status highlighting, interactive word inspector popup, audio simulation, and save word action.
  - `apps/web/src/features/brain/LanguageBrainCanvas.tsx` & `apps/web/src/app/brain/page.tsx`: Language Brain canvas with mastery metrics, 3 skill evidence bars (72%, 54%, 38%), CEFR/status filters, zoom/pan controls, and concept detail drawer.
  - `apps/web/src/features/progress/ProgressAnalytics.tsx` & `apps/web/src/app/progress/page.tsx`: Progress overview with weekly evidence (+43 words, +18 solidified, 5/7 days), ADR-009 Starting Level Estimate (`A2 Elementary`, `Độ tin cậy: Vừa`), and time breakdown.
  - `apps/web/src/features/library/LibraryView.tsx` & `apps/web/src/app/library/page.tsx`: Library view with empty state and CTA.
  - `apps/web/src/features/dictionary/DictionaryView.tsx` & `apps/web/src/app/dictionary/page.tsx`: Dictionary search engine with concept cards, IPA, Part of Speech, Vietnamese definitions, and Brain status.
  - `apps/web/src/features/settings/SettingsView.tsx` & `apps/web/src/app/settings/page.tsx`: Settings page with daily study goal slider/buttons (25 min/day), new word budget (4 words/day), theme toggle, and A11y switches.
  - `apps/web/src/features/profile/ProfileView.tsx` & `apps/web/src/app/profile/page.tsx`: Learner profile with A2 avatar badge, stats (582 encountered, 483 mastered, 5 days streak), and starting level estimate.
  - `apps/web/src/features/onboarding/OnboardingDiagnostic.tsx` & `apps/web/src/app/onboarding/page.tsx`: Adaptive diagnostic placement test, real-time level scoring, and Day 1 calibration.
- **Mandatory 4-State UI Matrix**:
  - Implemented Loading (with skeleton), Empty (with CTA), Error (with 5 semantic codes & retry), and Success states across all feature components.
- **Integration Tests**:
  - Created `tests/frontend/integration.test.tsx` covering all navigation modes, 4-state UI matrix, and interactive workflows.

---

## 2. Logic Chain

1. **Contracts & Invariant Alignment**: The UI components build strictly on top of `@lingua/types` (OpenAPI models, enums, errors) and `@lingua/ui` design tokens and primitives, ensuring zero schema drift.
2. **Navigation Discipline**: Enforcing the 5-route MVP constraint across `DesktopSidebar`, `TabletRail`, and `MobileBottomNav` guarantees zero exposure of deferred features while maintaining accessibility (WCAG 2.2 AA).
3. **State Machine Completeness**: Each feature module maintains genuine component state, supports props for forced states (for robust testing and SSR), and handles interactive events (ratings, filtering, word saving, diagnostic completion) without dummy/facade implementations.
4. **Ergonomic Design & Accessibility**: All interactive buttons meet minimum touch target sizes (44px/48px), progress bars implement proper ARIA roles and values, and concept chips display non-color textual and icon state invariants.

---

## 3. Caveats

- Backend services (`services/`, `database/`) remain untouched in accordance with frontend ownership boundaries.
- Live backend connection can be toggled via `setApiClient()` or environment config in `apps/web/src/lib/api/client.ts`.

---

## 4. Conclusion

Milestone 3 and Milestone 4 deliverables are 100% complete, fully tested, and ready for end-to-end integration and milestone quality gates (Milestone 5).

---

## 5. Verification Method

To independently verify this implementation:
1. Inspect all created/updated files in `apps/web/src/`:
   - `apps/web/src/components/navigation/*`
   - `apps/web/src/features/*`
   - `apps/web/src/app/*`
2. Run frontend integration and unit tests:
   ```bash
   pnpm test
   ```
3. Run TypeScript type checks:
   ```bash
   pnpm --filter @lingua/web typecheck
   ```
