# Full web option 3 — design QA

## Current result

- Visual findings are resolved on the frozen source. Final frontend regression passed 633/633 tests across 48 files; workspace typecheck (including generated-contract freshness), lint, production build and diff check passed. The restored server-resume-location regression passed 12/12 after the full run. Independent GPT-6 Luna / Max frozen-source review PASS is recorded in `reviews/PILOT-FULL-WEB-DESIGN-REVIEW.md`.
- Baseline control: unchanged authoritative master `5d0aa9769a14af3be254982f9f252cf9db24d383` passed 633/633 frontend tests. Initial redesigned snapshot failed 85/633; none is being waived as inherited. Final results must supersede that failed snapshot.

## Source and matching-state comparison

- Source visual: `C:/Users/pc/.codex/generated_images/01a0e1e8-63f4-73a1-bb12-d2b9f32daf03/exec-accb172a-d808-4127-bfee-36d6a727bad0.png`, 853×1844 pixels, normalized to 393×852.
- Implementation: external local component harness at `http://127.0.0.1:4174/`, importing real isolated-worktree source, not a substitute frontend implementation or Auth bypass.
- Final open-lookup capture: `C:/Users/pc/.codex/artifacts/lingua-pilot/full-web-preview/qa-reader-open-mobile.jpg`; paired source/render opened together: `qa-reader-open-paired.jpg` in the same folder.
- CSS viewport 393×852, controlled synthetic A Quiet Cup of Tea content, word lookup open, scroll position zero. Capture transport is 378×819 pixels; both frames are normalized to 393×852 for density comparison. The external fixture banner and local-only sample notices add verification-only height; ordinary hosted HTTP routes do not show sample notices.
- Earlier `qa-reader-early*` captures are failure history, not final acceptance evidence. No real actor, credentials or learner data were used.

## Visual comparison

- **Typography:** real multilingual font configuration and cached fonts are used. Reader has continuous serif prose and a sans article heading; Vietnamese labels remain readable. The actual Next.js Auth page was also inspected at mobile and desktop sizes without credentials. Minor font/icon shape differences from generated reference are P3.
- **Layout and spacing:** Reader's redundant intro, separate article card and per-sentence card hierarchy were removed. The first English sentence is visible above the open meaning sheet at scroll zero. Title/art, slim progress and secondary save actions are compact. Lookup bottom is 760 CSS pixels; mobile nav starts at approximately 777, so the controls do not overlap.
- **Colors:** lavender/white surfaces and indigo actions match the approved direction. Light muted/semantic text tokens were darkened after concrete contrast failures; the Brain selected filter uses the contrast-safe primary pair. The token regression verifies text contrast. Dark Settings/Reader/reset rendering was inspected separately.
- **Images:** the accepted transparent tea/book and brand assets are reused with preserved aspect ratio. No CSS art, invented avatars or dashboard illustration replaces them.
- **Copy and content:** user-facing labels replace implementation jargon. Reader only reveals supplied Vietnamese meaning; unavailable meaning is covered by a regression. Profile/Progress defaults do not pretend that fixture metrics belong to the learner. Actual published translation coverage remains a separate content finding.
- **Icons and states:** existing Lucide controls remain consistent; status-only chips avoid duplicate terms. Review keeps the separate server-supplied due signal. Brain search and secondary metrics are ordered around the learner task.

## Responsive and interaction evidence

- All 13 preview page variants were checked at 320px and 393px: Today, Reader, Review, Brain, Library, Dictionary, Progress, Profile, Settings, Auth, reset, onboarding and Admin creation. No horizontal document overflow was observed.
- Desktop 1280×900 and tablet 768×1024 were inspected; full-frame captures use the documented CDP capture API because the tab screenshot transport retained its original physical crop after CSS viewport changes.
- A 640×450 CSS viewport at DPR 2 verifies the reflow equivalent of a 1280×900 desktop at 200% scaling; this is not a claim of a separate browser-menu zoom test. Reduced-motion emulation reports the motion token as `0ms`.
- Mobile Menu → Library navigates and closes the drawer. Reader lookup focuses Close; Escape closes and returns focus to the highlighted word. Concept learn, sentence save and article save succeed as distinct commands against the isolated mock client. Review reveal and Brain search were checked; browser fixture assertions do not substitute for domain regression tests.
- Fresh reload → Today → Brain produced zero new console errors. Earlier HMR errors and nonterminal mock cursor failures were confined to the external preview adapter and resolved there, without changing product transport or hooks.
- Evidence folder: `C:/Users/pc/.codex/artifacts/lingua-pilot/full-web-preview/` (`qa-*-mobile.jpg`, `qa-*-desktop.png`, `qa-brain-tablet.png`, `qa-reader-reflow.png`, paired Reader frame and baseline/final test reports in its parent folder).

## Resolved findings

| Finding | Resolution |
|---|---|
| P1 Reader composition/density | Unboxed compact title/progress and continuous prose; final open-lookup frame keeps English visible. |
| P2 duplicate term wrapping in Review | Status-only chip with due projection preserved; supplied-due regression. |
| P2 Brain task hidden below empty metrics | Search/concepts first; metrics follow; search explicitly labeled. |
| P1 small-text contrast | Darker muted/semantic tokens and accessible selected filter; contrast regression. |
| P2 security form label ambiguity | Distinct current-password labels; confirmation and deletion request regressions retained. |

No unresolved visual P0/P1/P2 remains in the inspected states. Runtime and independent review gates passed. Frozen runtime/test/asset/workflow aggregate: `59141142d9d4ec07d55e44bec120a4172fdbb174db32851026c69d6d44025ff0`. This record is local presentation evidence, not hosted learner acceptance. Exact-head CI/Preview and normal promotion remain separate release gates.

final result: pass
