# Real Learner Pilot — Findings

- **Kickoff:** 2026-10-09 (Asia/Saigon)
- **Day 7 review:** 2026-10-16
- **Day 14 review:** 2026-10-23
- **Evidence state:** PILOT-001 is verified in an isolated React + HttpApiClient mocked-actor regression (99/99 tests across six files). This is local/source verification only; no live learner journey or learning-quality outcome is verified. Automated harness acceptance and background health checks are not learner-journey evidence.

Record only short, de-identified observations from learner-authorized feedback, an explicitly authorized read-only UI observation, or existing telemetry that is safe to inspect. Do not record credentials, direct identifiers, raw learner rows, or raw provider payloads. Do not convert missing evidence into a defect or a pass.

| ID | Date | Evidence type | Surface / reported friction | Severity and frequency | Status | Proposed bounded action | Evidence reference |
|---|---|---|---|---|---|---|---|
| PILOT-001 | 2026-10-09 (Asia/Saigon) | Owner-reported feedback; source-corroborated; isolated mocked-actor regression reproduced | Fresh signup showed a required timezone text field (pre-filled when detection succeeds) and a separate “Xác nhận múi giờ” submission. The owner reports the selection step is unnecessary. The isolated source regression removes the separate card when browser detection is valid; it does not establish a live learner outcome. | P2 onboarding friction with the extra confirmation as a workaround; one report, prevalence unknown. Not P1. | SOURCE FIX VERIFIED in isolated React + HttpApiClient mocked-actor regression: 99/99 tests across six files. Promotion requires a normal, independently reviewed, exact-head CI-gated merge; live learner outcome remains UNKNOWN. | Use a valid browser `Intl.DateTimeFormat().resolvedOptions().timeZone` value without a timezone-only confirmation, preserve any stored timezone, send the timezone PATCH with strong ETag before language-profile POST only after the explicit setup CTA, and retain fallback when detection is unavailable or invalid. No GPS permission. Preserve existing authenticated `/v1/me` bootstrap behavior, which may create only `public.users` and `learner_profiles` for a new identity. | Owner feedback (2026-10-09); original source snapshot [`LiveOnboardingFlow.tsx` at 954235c](https://github.com/haizx71/lingua-os/blob/954235c57ebb786f09a6f8966c07392ae1e4a5c4/apps/web/src/features/onboarding/LiveOnboardingFlow.tsx#L575); isolated mocked-actor regression (99/99 across six files). |

PILOT-001 records source and isolated mocked-actor regression verification, not a live learner outcome or a passed signup journey. Overall journey status remains **UNKNOWN** until actual learner evidence is available. Background `/health` or deployment status alone does not establish that a learner completed a journey. Retain only de-identified evidence references; do not embed personal data.

See the [pilot and V2 freeze plan](plans/REAL-LEARNER-PILOT-V2-FREEZE.md), [separate hardening follow-ups](PILOT_HARDENING.md), [project status](STATUS.md), and [active tasks](TASKS.md).
