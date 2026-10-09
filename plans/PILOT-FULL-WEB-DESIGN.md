# Full web presentation — approved Reader option 3

## Authorization and baseline

The owner approved Reader option 3 and explicitly requested applying it to the entire existing LINGUA web app on 2026-10-09. This is a scoped presentation exception to the pilot's usual P0/P1-only fixes. It does not reopen Knowledge V2, introduce learning architecture, or authorize manual learner-data mutation.

Baseline: authoritative `origin/master` / local master `5d0aa9769a14af3be254982f9f252cf9db24d383`, fetched with zero divergence; only existing attachment files untracked. Implementation is isolated on `codex/pilot-full-web-design`; existing worktrees and the approved standalone Reader prototype are preserved.

## Design and product boundary

- Visual truth: the owner's third displayed Reader image, SHA-256 `262920e9f88ebdc62a34feb2d0061a7bfc0cc5b70c072f9aacb95d3a8a925748`, and its independently reviewed local prototype (source aggregate `ca4b12682be6c9948a4b4f323993294713f1af8b3384b5a235ef6fcbc5953e20`).
- Apply the pale lavender canvas, white reading surfaces, indigo primary action, readable sans hierarchy and serif English reading treatment to existing routes and shared UI.
- Keep compact persistent navigation and readable mobile safe areas; desktop uses an uncluttered sidebar and comfortable content width.
- Cover Today, Reader, Review, Brain, Progress, Library, Dictionary, Profile, Settings, Auth/reset, Onboarding and existing Admin presentation.
- Preserve every existing route, public component contract, domain hook, API request, authorization boundary and accepted learning behavior. Do not invent endpoint/field/status/metric, fake learner data, automatic evidence or scheduling rules.
- Reader word lookup, sentence/content save, explicit concept learning and segment completion retain their existing commands. Sentence meaning can reveal existing reviewed `translationVi`; absent translations are not fabricated or copied from the prototype.
- Remove repeated sentence-level vocabulary chips and duplicate word labels to address the owner's observed clutter. Highlighted words remain inspectable and accessible; the inspector retains the supplied concept status with its semantic description. This is a presentation change, not a concept-state change.
- Normal Profile/Progress routes must show an honest unavailable state rather than their historical hard-coded fixture summaries. Test/story fixtures may still be supplied explicitly; no new analytics or profile API integration is introduced here.
- Distinguish saved catalog membership, learn intent, passive exposure, competence and FSRS state. Brain remains projection-only; frontend remains a consumer of server authority.
- Preserve password reauthentication, actor lifecycle checks, theme preference, reduced motion and multilingual fonts.

## Execution and mutation ownership

Commander owns shared documentation, integration, commits, remote branches/PRs and any later promotion. One implementation worker owns frontend source in this isolated worktree. The preparation worker is read-only. A separate reviewer inspects the frozen diff after implementation; no self-review substitutes for that gate.

Actual worker configuration must be recorded in the review record: routine preparation GPT-6 Luna / Medium; implementation involving stateful presentation and final independent review GPT-6 Luna / Max.

## Gates

1. Source-driven route/component audit and bounded implementation.
2. Focused regression tests for changed UI interactions, plus existing frontend behavior suite, typecheck, lint, generated-contract freshness, production build and diff check.
3. Browser comparison of the approved Reader reference and real implemented presentation at matching mobile viewport/state; mobile and desktop journey/navigation coverage, focus, safe areas and console inspection. Synthetic local fixtures must remain visibly isolated and must never weaken hosted Auth to enable a preview.
4. Independent frozen-source review, no unresolved HIGH/BLOCKER or actionable design P0/P1/P2.
5. Reviewed commit and normal PR with exact-head CI/Preview; preserve master and accepted cloud state until gates pass. Any hosted test uses the existing harness and cleanup/retained comparison rules, never a real learner as test data.
6. Update durable status with verified outcome and remaining limits. Local fixture previews are not hosted acceptance evidence.

## Excluded changes

No backend, schema, migration, RLS/grant, Auth configuration, cloud secret/protection changes, content publication, manual actor login, catalog expansion, or new learning intelligence. The `0021` migration head and accepted K2-06 through K2-10 remain frozen.

## Current state

DONE: PR #66 normal merge `2058a089529423343f7aae971bd43e1411359539`, exact-head CI/Preview PASS, Vercel Production READY at the merged SHA with canonical alias assigned. Implementation is frozen at runtime/test/asset/workflow aggregate `59141142d9d4ec07d55e44bec120a4172fdbb174db32851026c69d6d44025ff0`. Final frontend regression passed 633/633 tests across 48 files; the additional server-resume-location assertion passed 12/12 in its focused Reader suite. Workspace generated-contract freshness/typecheck, lint, build and diff check passed. Local browser evidence is in `design-qa.md`; independent Luna Max final review PASS is in `reviews/PILOT-FULL-WEB-DESIGN-REVIEW.md`; release evidence and limits are in `reviews/PILOT-FULL-WEB-RELEASE.md`. No real learner outcome or hosted learner acceptance is claimed.
