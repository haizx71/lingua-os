# FRLL final takeover — verification ledger

Date: 2026-09-12. Starting HEAD: `a4f349847772fc1f99398dc0ec29ed01228c856b`.
Status: evidence complete; **ready for independent final FRLL acceptance**.

## Scope and authority

The owner accepts P1 Brain and the existing uncommitted Review concurrency patch.
The patch is preserved: queue sequencing is independent of answer sequencing;
an answer releases only its own submission token. No frontend domain algorithm,
endpoint, OpenAPI schema, generated DTO or database migration is changed.

## Confirmed root causes and corrections

| Classification | Evidence | Correction |
| --- | --- | --- |
| INFRASTRUCTURE | Inherited configuration was not valid proof of database access; prior process handles were stale. | Explicit process-local runtime configuration; existing read-only probe passes with 10s connect, 15s SQL and 35s outer deadlines. No secrets written to files. |
| INFRASTRUCTURE | Docker Linux engine unavailable; backend startup log identified an inaccessible internal socket. | Restarted failed local Desktop processes; engine 29.7.2 recovered. No factory reset or volume deletion. |
| TEST_HARNESS | Defaulted pytest fixture argument was never injected; the FRLL seed test read runtime DATABASE_URL and failed against unrelated learner rows. | Require the existing isolated migrated test-database fixture; no skip or external runtime fallback. Focused 2/2 PASS. |
| TEST_HARNESS | Ready login can redirect through onboarding to Today before load; pre-created profile could persist an empty Today plan before Save. | Validate real Auth response user ID; accept the two documented redirect destinations; log in before configuring the primary/loss profile, and Save before first Today. |
| TEST_HARNESS | Brain summary default-profile request has no profile query parameter. | Match the actual frozen endpoint and validate B's profile ID in the raw response. |
| TEST_HARNESS | Authenticated A's same-context tab redirects away from /auth, so B's login form is intentionally unavailable. | Test-only same-origin controller bundles the installed SSR SDK in memory and performs a real B password sign-in. Real cookies and SDK BroadcastChannel drive the original AuthProvider; no forged session/event or product endpoint. |
| TEST_HARNESS | Controller suites inherited jsdom AbortSignal, incompatible with Node's real fetch after bounded Auth transport was added. | Run the four non-DOM live controller suites in Node; preserve all assertions. |
| TEST_HARNESS | Frozen plan section 6 requires a normal browser HTTP 200 answer separately from response-loss recovery. | Add a distinct fresh primary actor and normal UI answer proof; retain the entire separate loss/reload/replay test. |

## Evidence boundaries

- Loss is induced only after a real upstream 200, frozen DTO validation and
  committed PostgreSQL observations inside the interceptor. Then the response
  is aborted. A pre-commit failure cannot meet these conditions.
- Durable sessionStorage receipt survives reload verbatim; retry uses the same
  review-item ID, key, rating and response time. Complete replay response and
  PostgreSQL digest equality reject duplicated events, FSRS or competence writes.
- The read-only repeatable-read probe now captures every public base table with
  `user_id`, plus `users.id`, across all concepts. A PostgreSQL regression proves
  non-anchor coverage, same-count mutation detection and other-actor exclusion.
- Passive Brain compares complete rows; Today may persist only the approved
  coordination tables (`today_plans`, `today_plan_activities`,
  `today_activity_review_items`). Completion receipts are not exempted.
- Completed browser product responses are validated against their actual frozen
  operation before adapter defaults can hide defects; non-2xx fails closed.
- B has real independent credentials and zero-state projections. Its attempt to
  answer A's item returns the canonical 404 and changes neither actor's digest.
  A's held 200 is released only after B's real transition and empty Brain state;
  the browser receives the body and crosses a paint barrier before UI assertions.
- Cleanup uses the existing disposable-learner teardown transaction, Auth Admin
  deletion, independent Auth absence check, SQL counts, complete empty owned-row
  digest and explicit catalog-anchor verification. This is not a claim that Auth
  deletion alone removes append-only application history.
- Auth traces/screenshots are disabled for credential-bearing R1 flows. Runtime
  keys, passwords, tokens and cookies are neither recorded nor committed.

## Current checks

- Frontend: **657/657**, 51 files.
- Backend: **493/493**, real Docker PostgreSQL 17 (last verified before the
  final local Docker daemon outage); includes migration, RLS, concurrency,
  rollback and contract suites. The final rerun was attempted but blocked by
  the stopped Docker Linux engine, not by a test assertion.
- Acceptance support: **143/143**, 11 files, including adversarial wrong-score,
  remainingDueCount, 500, duplicate/mutated persistence, malformed DTO, changed
  receipt, residual rows, false cleanup and passive-completion attacks.
- Ruff format/lint, mypy (111 files), generated freshness, workspace/direct R1
  TypeScript, ESLint, OpenAPI validator and Storybook: PASS. Redocly CLI is
  not installed in this workspace; the unchanged contract's last recorded
  Redocly run was PASS (with the known Reader discriminator warning).
- Production build: PASS; Storybook build: PASS; OpenAPI validator: PASS;
  generated freshness, typecheck and lint: PASS.
- Final live checkpoint #1: **4/4 PASS** with fresh disposable actors
  (primary HTTP 200, committed response-loss/replay, passive zero-write,
  Actor-B isolation/late response), all cleanup proofs PASS.
- Final live checkpoint #2: **4/4 PASS** with a second fresh actor set and the
  same independent cleanup proofs.
- Actual supplied credential scan of tracked/candidate files: PASS (no matches).

## Fresh checkpoints

Each final checkpoint used new disposable actors and verified Auth deletion,
complete learner-row emptiness and catalog-anchor survival. The controller
phases B/C/D/E were rerun at **4/4 PASS** between the two browser checkpoints.
No skipped, interrupted or pre-hardening run is counted as final evidence.

## Review and remaining authority

Internal read-only adversarial review found the missing normal browser proof;
that omission was corrected. This ledger records implementation evidence only;
it does not replace the owner's requested fresh final independent review. No
final ACCEPTED verdict is issued.

Pre-existing untracked handover/audit documents and the generated tsbuildinfo
overlay are outside the intended commits and are preserved, not silently reset.
