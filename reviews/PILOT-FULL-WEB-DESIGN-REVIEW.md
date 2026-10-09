# Full web presentation — independent frozen-source review

## Verdict

**PASS for the frozen source patch. No HIGH/BLOCKER finding and no unresolved actionable P0/P1/P2 finding.** This verdict covers the local source, regression evidence, and presentation review. It is not hosted learner acceptance, exact-head CI, Preview, or production promotion.

## Reviewer and evidence identity

- Reviewer assignment: GPT-6 Luna, reasoning effort Max, as configured for this independent review. Runtime introspection is unavailable.
- Worktree: `codex/pilot-full-web-design`, based at `5d0aa9769a14af3be254982f9f252cf9db24d383`.
- Frozen manifest: `C:\Users\pc\.codex\artifacts\lingua-pilot\full-web-frozen-manifest.json`, SHA-256 `f282817c98982a86a0ee171518a93a934cdcdf942dd31cfeb0c2b6a040094a99`; its 51-file aggregate is `59141142d9d4ec07d55e44bec120a4172fdbb174db32851026c69d6d44025ff0`. Every listed raw file hash matched the manifest. The manifested scope contains the web presentation, tests, local image assets, and regression workflow. No backend, schema, migration, RLS, API contract, or shared behavior-hook file is changed.
- `apps/web/tsconfig.tsbuildinfo` is a generated workspace cache outside the frozen manifest; it was not treated as source evidence or included in the review.
- Final frontend report: `C:\Users\pc\.codex\artifacts\lingua-pilot\full-web-design-final-results.json`, SHA-256 `f83027697d23bb33e932440a11bed381315eda7ea8d97f32272c51f864e34999`. Its summary reports 172/172 suites and 633/633 tests passed. The baseline also passed 633/633; the earlier redesigned run with 85 failures was superseded by this final report, with no failures waived. READ-LIVE-08's restored current-segment assertion passed in a separate 12/12 focused run.
- Workspace typecheck (including generated-contract freshness), lint, production build, and diff check were reported PASS by the implementation/root gate and are recorded in `design-qa.md`; I did not rerun those commands.
- Browser evidence was collected by root in an isolated local harness using synthetic content and mocked transport. I directly reviewed the Reader source/render pair (SHA-256 `110ba8231f25ca67cf8510503020cd8b8162b17d62cd5854f30b8ce84d5b8612`), mobile-page composite (`56905f4c7992a9a713f4fd7078d4d9391d565fc23ac6781a42addfd7d19394be`), Reader reflow capture (`1269230a680f4f6e868a0c9795e4a7bcab6888819cf1212dc42a42e7c4570d07`), and actual Next Auth mobile capture (`832a051db4576ceb1efc9aa6bdf1671ffd28d9e2c73d41656e4dab4cbed2fcd2`). The approved source image is `C:\Users\pc\.codex\generated_images\01a0e1e8-63f4-73a1-bb12-d2b9f32daf03\exec-accb172a-d808-4127-bfee-36d6a727bad0.png`, SHA-256 `262920e9f88ebdc62a34feb2d0061a7bfc0cc5b70c072f9aacb95d3a8a925748`.

## Source and regression review

- Reader interactions remain distinct: opening a highlighted word is lookup, sentence/content saves remain explicit saves, and concept learning remains an explicit action. The translation control appears only when the supplied sentence DTO has nonempty `translationVi`; it reveals that supplied text and creates no progress/evidence. `useReaderSession` is unchanged. READ-LIVE-08 now asserts the server-restored 50% progress and `Đoạn 2 / 2` both before and after remount, with no local-storage persistence.
- Review still presents the server-provided concept status and separate due projection (`isDue`). No FSRS calculation or rating command changed. Today still maps the server plan and keeps activity navigation separate from the explicit completion command. No passive page-open or scroll action was added.
- Brain remains a server projection; missing summary values stay unavailable instead of becoming zero. Profile and Progress routes no longer render their hard-coded fixture summaries as a learner's metrics; explicitly supplied fixture data is covered by component tests. Their live data integration remains unavailable because this task adds no endpoint or backend work.
- Auth, account deletion, password reauthentication, onboarding, actor lifecycle, and transport hooks are outside the changed behavior paths. The security form still requires confirmation email and current password and sends both through the existing delete request; focused regression coverage checks that boundary. Settings copy distinguishes device-persisted theme from session-only controls.
- Local mock routes receive a visible preview notice. The regression checks that the notice appears with the mock client and is suppressed for hosted runtime. New assets are local. The PR workflow is least-privilege (`contents: read`), uses pinned actions, disables checkout credential persistence and install lifecycle scripts, and runs typecheck, lint, the full frontend suite, and a credential-free web build; it has no deployment or hosted-write step.
- Updated tests retain server-authority, actor isolation, idempotency, save-vs-learn, due state, and failure-path assertions. The new Reader resume-position assertion closes the only review finding raised during this pass.

## Presentation evidence and limits

Root's local browser record covers 13 page variants at 320px and 393px, plus desktop, tablet, reflow, reduced-motion and dark-theme checks. It reports no horizontal overflow, verifies the Reader lookup/Escape focus return and the separate save actions, and inspected the actual Next Auth page without credentials. My visual review found the Reader hierarchy and open-lookup panel legible at the matched viewport, the first English sentence visible above the panel, and primary navigation/actions unobstructed in the inspected views.

This remains local presentation evidence, not a hosted learner journey. No real actor, learner row, credential, hosted mutation, or production acceptance was used. The preview labels synthetic data. The published Reader content's missing Vietnamese sentence translations remain a separate content limitation; this UI only reveals supplied reviewed translations and does not invent them. Minor font/icon differences and the duplicate sample captions in the explicitly mocked Reader preview are P3 presentation notes, not release blockers.

Exact-head CI/Preview and root-controlled normal promotion are separate later gates. No deployment, live learner outcome, or overall product completion is claimed by this source-review verdict.
