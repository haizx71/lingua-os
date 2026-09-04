## 2026-08-21T21:38:12Z
Task Assignment:
Frontend Worker for Milestone 3 & Milestone 4: Core App Shell, Navigation, User Flows & Feature Pages (`apps/web`).

Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1

Exclusive Write Ownership:
- `apps/web/src/**` (all app routes, features, state machines, hooks, components)
- `tests/frontend/integration.test.tsx` or similar app integration tests

Scope & Tasks:
1. Navigation Shell (`apps/web/src/components/navigation/`):
   - Strict adherence to the 5 primary MVP routes (`/today`, `/read`, `/review`, `/brain`, `/progress`) in `MobileBottomNav`, `DesktopSidebar`, and `TabletRail`.
   - Secondary routes: `/library`, `/dictionary`, `/settings`, `/profile`, `/onboarding`.
   - Focus Mode: `AppShell` hides sidebar and bottom nav during active review / study sessions.
   - Guardrail: strictly ZERO links, dead routes, or placeholders for deferred AI Tutor or Speak Lab.
2. Complete Feature Pages & Interactive State Machines (`apps/web/src/features/` & `apps/web/src/app/`):
   - `/today` (Today Dashboard)
   - `/review` (Smart Review)
   - `/read` (Interactive Reader)
   - `/brain` (Language Brain)
   - `/progress` (Progress & Level Estimate)
   - `/library` (Library)
   - `/dictionary` (Dictionary)
   - `/settings` (Settings)
   - `/profile` (Profile)
   - `/onboarding` (Diagnostic Placement)
3. Mandatory 4-State UI Matrix (Loading, Empty, Error, Success) on every feature page.
4. Integrate with `api` (`@lingua/types` via `apps/web/src/lib/api/`).
5. Write unit & integration tests in `tests/frontend/`.
6. Verify with `pnpm --filter @lingua/web typecheck` and `pnpm test`.
7. Write completion report to `d:/LINGUA_OS_PROJECT_STARTER/.agents/worker_m3_m4_1/report.md` and deliver `handoff.md`.
