# Real Learner Pilot — Findings

- **Kickoff:** 2026-10-09 (Asia/Saigon)
- **Day 7 review:** 2026-10-16
- **Day 14 review:** 2026-10-23
- **Evidence state:** One owner-reported signup-friction signal is corroborated by source inspection. It has not been reproduced with a disposable actor or browser walkthrough; no learning-quality observation is recorded. Automated harness acceptance and background health checks are not learner-journey evidence.

Record only short, de-identified observations from learner-authorized feedback, an explicitly authorized read-only UI observation, or existing telemetry that is safe to inspect. Do not record credentials, direct identifiers, raw learner rows, or raw provider payloads. Do not convert missing evidence into a defect or a pass.

| ID | Date | Evidence type | Surface / reported friction | Severity and frequency | Status | Proposed bounded action | Evidence reference |
|---|---|---|---|---|---|---|---|
| PILOT-001 | 2026-10-09 (Asia/Saigon) | Owner-reported feedback, corroborated by source; not disposable-actor/browser reproduced | Fresh signup shows a required timezone text field, pre-filled when browser detection succeeds, and a separate “Xác nhận múi giờ” submission. The owner reports the selection step is unnecessary and asks to detect the timezone or otherwise remove the extra step. | P2 onboarding friction with the extra confirmation as a workaround; one report, prevalence unknown. Not P1. | OPEN — source-confirmed, runtime behavior not reproduced, not fixed. | When browser `Intl.DateTimeFormat().resolvedOptions().timeZone` is a valid IANA value, persist it through the existing profile update flow without a dedicated timezone-only confirmation step; retain a fallback if detection is unavailable or invalid. Do not request geolocation permission. Preserve the backend profile as timezone persistence authority. | Owner feedback (2026-10-09); [`LiveOnboardingFlow.tsx`](apps/web/src/features/onboarding/LiveOnboardingFlow.tsx#L178), lines 220–225, 304–318, and 575. |

PILOT-001 records a verified owner report and source corroboration, not a reproduced runtime failure or a passed signup journey. Overall journey status remains **UNKNOWN** until actual walkthrough evidence is recorded. Background `/health` or deployment status alone does not establish that a learner completed a journey. Retain only de-identified evidence references; do not embed personal data.

See the [pilot and V2 freeze plan](plans/REAL-LEARNER-PILOT-V2-FREEZE.md), [separate hardening follow-ups](PILOT_HARDENING.md), [project status](STATUS.md), and [active tasks](TASKS.md).
