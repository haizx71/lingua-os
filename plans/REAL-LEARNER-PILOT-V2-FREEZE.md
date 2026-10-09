# Real Learner Pilot and V2 Freeze

- **Kickoff:** 2026-10-09 (Asia/Saigon)
- **Day 7 review:** 2026-10-16
- **Day 14 review:** 2026-10-23
- **Duration:** 7–14 days; the daily observation cadence is intended to remain bounded and read-only through 2026-10-23.
- **Owner:** Commander, with documentation/evidence support.
- **State at kickoff:** One owner-reported feedback signal (PILOT-001); no disposable-actor/browser journey reproduction or learning-quality observation yet.

## Purpose and boundaries

Observe whether a real learner can use the frozen MVP in their normal authorized session, identify evidence-backed friction or learning impact, and decide what to investigate next. This is an observation phase, not a claim that the learner journey or all deployment hardening has passed.

K2-06 through K2-10 remain frozen and accepted. Reopen them only for a reproducible real defect. The current migration head remains `0021`, with checksum `3c984a59afe9031ee5480a4fa111d5fb239b5f7164af39289712f1e98ad45ca6`. Preserve accepted Auth/RLS and ownership boundaries, learner data, the primary FSRS lineage, passive projection behavior, hosted-fixture cleanup guarantees, contracts, and the FRLL baseline. Do not add a migration, alter grants or Auth configuration, or manually modify real learner data during the pilot.

Use actual learner feedback, explicitly authorized passive read-only UI observation, and existing telemetry only where access is already authorized and the inspection is safe. Do not navigate to or refresh a real learner page if that could trigger a mutation-capable request; Today and `/me` requests can write state. If passive read-only observation cannot be guaranteed, rely on owner feedback or approved safe existing telemetry instead. Never automate a real learner account or store credentials, PII, raw learner rows, or raw provider payloads. Background health checks, deployment status, synthetic actors, and prior harness runs are not real-learner journey evidence.

The [findings log](../PILOT_FINDINGS.md) records PILOT-001: one owner-reported P2 timezone-step friction, corroborated by source but not reproduced in a disposable-actor/browser walkthrough. No learning-quality outcome is verified; keep overall journey status UNKNOWN until evidence supports it. Track the four separate, nonblocking hardening follow-ups in [PILOT_HARDENING.md](../PILOT_HARDENING.md); their existence is not a pilot defect or proof of completion.

## Severity and response

| Priority | Definition | Pilot response |
|---|---|---|
| P0 | Security or isolation failure, data loss, or service outage. | Stop the affected activity and escalate immediately. Preserve only safe, de-identified evidence. A runtime change requires a reproducible isolated regression and the full gated fix path below. |
| P1 | Core learner loop is blocked, or learning material is incorrect in a way that harms learning, with no reasonable workaround. | Record frequency and impact; prioritize a reproducible isolated regression and the full gated fix path. |
| P2 | Friction or content-quality issue with a reasonable workaround. | Record the observation and workaround; do not make a pilot-time runtime change. Consider it in the final product direction review. |

### Runtime-fix gate for P0/P1 only

A runtime fix is eligible only when a P0/P1 issue is reproducible and supported by evidence:

1. Reproduce it with an isolated synthetic/local actor (a mocked HTTP actor is acceptable for a focused frontend change); do not use real learner data for reproduction or mutation.
2. Have a bounded GPT-6 Luna / Max implementation and a separate GPT-6 Luna / Max review with no HIGH/BLOCKER.
3. Pass exact-head CI and the required source/security checks.
4. Let the root operator promote it serially; no pilot worker deploys or writes to hosted state. Use exact-head CI/Preview and actorless deployed-source health checks for a focused frontend fix when that evidence matches the changed risk and surface; do not label these as full hosted learner-journey proof.
5. Use hosted disposable-actor verification only when the changed risk or surface requires it and the root authorizes it after review. If any hosted actor is created, complete Auth deletion, zero-residue checks across all 27 learner tables, and the retained snapshot comparison before closing the fix. Do not rerun the full K2 hosted acceptance solely because a focused frontend pilot fix was made.

P2 items normally remain observations during the pilot. The sole current exception is PILOT-001, an explicitly owner-authorized, bounded P2 frontend onboarding change within TASK-017, requested on 2026-10-09. It is separate from K2-06–K2-10 and does not reopen or change accepted K2 work or evidence; K2 reopening requires a reproducible real defect, not P2 friction. This does not create a general P2 runtime-fix policy. Any eligible fix must preserve the K2/V2 freeze invariants and receive its own evidence; the pilot does not authorize broad redesign.

### Explicit owner-authorized P2 exception — PILOT-001

The owner specifically requests removing the timezone selection/confirmation step from fresh signup. Source review confirms the browser `Intl` timezone is suggested and pre-fills the required text field when detection succeeds, but the user must still submit the separate confirmation. A bounded frontend change may use a valid browser `Intl.DateTimeFormat().resolvedOptions().timeZone` value automatically, without a geolocation permission prompt, and preserve the backend profile as persistence authority. Keep the finding OPEN until reproduced with an isolated local UI/mock-actor regression and independently verified; no runtime fix is claimed here. This authorization is limited to PILOT-001 and does not authorize other P2 fixes.

The normal runtime gate still applies: isolated regression, bounded GPT-6 Luna / Max implementation, separate GPT-6 Luna / Max review with no HIGH/BLOCKER, exact-head CI/Preview, and root-serialized promotion. Hosted actor verification is required only when the changed risk or surface requires it and is explicitly authorized after review. If hosted actors are created, full Auth deletion, zero residue across all 27 learner tables, and retained-state comparison are mandatory. Actorless health/source checks do not prove the full hosted learner journey. Do not automate the real learner account or write to real learner data.

## Cadence and decision points

- **Daily, 2026-10-09 through 2026-10-23:** bounded read-only evidence review. Record only verified, de-identified observations and references in `PILOT_FINDINGS.md`. Do not call an empty day a pass.
- **Day 7, 2026-10-16:** review evidence quality, frequency, severity, workarounds, and any safety concern. Continue only within the existing 7–14 day window; do not expand scope or start a major system.
- **Day 14, 2026-10-23:** close the observation window and make one product-direction recommendation, or explicitly hold it if the evidence is insufficient.

At day 14, choose exactly one direction only when the observed impact supports it:

- **CONTENT V3** — observed content accuracy, level fit, provenance, or coverage is the dominant issue.
- **UX V3** — observed interaction or navigation friction is dominant while learning behavior remains sound.
- **LEARNING INTELLIGENCE V3** — observed Today/Brain/Review prioritization or learning-signal behavior is the dominant issue.

If observations are insufficient, record **UNKNOWN — hold recommendation for review**. Day 14 is recommendation-only: any subsequent major implementation requires a reviewed pilot report and separate owner authorization. The review does not automatically authorize or start that work. Do not force a choice or begin a major system from absent evidence.

## Deliverables and references

- [Findings log](../PILOT_FINDINGS.md): short, evidence-led, de-identified pilot observations; currently none verified.
- [Separate hardening follow-ups](../PILOT_HARDENING.md): four nonblocking items with the current K2-10 evidence limits.
- [Current status](../STATUS.md) and [task board](../TASKS.md): kickoff and review dates.
- [K2-10 verification seal](../reviews/K2-10-verification-seal.md): frozen acceptance evidence and hardening caveats.

The former MVP Pilot Readiness planning milestone in `TASKS.md` is superseded by this bounded observation plan. Its historical hardening checklist is not retroactively marked PASS.
