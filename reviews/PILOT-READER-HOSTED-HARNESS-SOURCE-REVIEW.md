# PILOT-READER Hosted Harness Source Review

**Date:** 2026-10-10  
**Initial verdict (historical):** **FAIL / HOLD** — one HIGH acceptance-assurance finding remained. No hosted acceptance or promotion claim was supported.  
**Reviewer configuration:** GPT-6 Luna, Max reasoning effort (assigned configuration; runtime introspection unavailable).

## Reviewed snapshot and scope

Reviewed the fixed 17-path hosted-harness source snapshot against the accepted plan and its PASS plan review. The tree was at `af813819729ac36e1df432c7af28465f8d1cdc36`; the reviewed source paths were uncommitted working-tree content. The 17-path aggregate is `3a42f2e2b3520b947fcd743012a855a9758178f151a88549ceddc0663da43659`.

- Plan: `plans/PILOT-READER-HOSTED-ACCEPTANCE.md`, SHA-256 `401065df42407a51fe8a5baef0f3bb8211dd8ab5b35ee2f053b347af35aa93f4`.
- Plan review: `reviews/PILOT-READER-HOSTED-PLAN-REVIEW.md`, SHA-256 `cca7f8dc00642a6961fa8f40ef63b23dc1b03b1b04e3e9dc077d600211d00ece`.
- Implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-pilot-reader-hosted-harness-implementation.md`, SHA-256 `8c893c88e6545e458903302704353371215c40c5302c272604412b937dc4a5aa`.

The scope is only the 17 paths below. The publication manifest, root-owned Reader/Admin files, proposed P005 explicit-selection work (not present in this snapshot; separately owner-authorized), and other integration changes are outside this review. No source file was edited. No workflow was dispatched, no hosted actor was created, and no hosted state was accessed or changed by this review.

```text
81af1ad2da00d6650d4542a52a4438db4f099ec0410746f34134633b40668ee8  .github/workflows/k2-hosted-acceptance.yml
597ee240089b03c54acf96d0769ac350e2ff6cd22eb72885f93e3d2d27ee12a7  .github/workflows/k2-hosted-security-gate.yml
5a80f26a37427f13180ab714ed630f2098888b54d10a421b1d2d91e003b73f0a  playwright.k2-hosted.config.ts
98c8faed5386566cb4fd3d9b48273176e04b544a6a0dbcc08a09114573be4128  tests/acceptance/pilot_reader_hosted_acceptance.spec.ts
9ea047a7496f341f6ebfbae4fb87dbceb7aafe16e777df20bfafd4f3066bfb9e  tests/acceptance/support/k2_hosted_acceptance_helpers.test.ts
be8ad7709ec72da3238c6fdb8fb19a229f59366be4f5dcb71bb64c3a7a5b4bb2  tests/acceptance/support/k2_hosted_acceptance_helpers.ts
54d150f09b584afa3c84153a2ae21f803dbbeed21f740f34a7a267640e8b66ef  tests/acceptance/support/k2_hosted_actors.test.ts
147cbdfcbefc9f675f8d5b3fbeb9082a6fbbb0457392c35b362b6cf8fff50f65  tests/acceptance/support/k2_hosted_actors.ts
d9268257b50591054115bea33479a616c7fe9e0adf1136f55f68bd160a990491  tests/acceptance/support/k2_hosted_probe_client.test.ts
aaa926b9a8c5b8ed8c4418d149bad7e87421dc92e79b9fec69b020dd0a3d2797  tests/acceptance/support/k2_hosted_probe_client.ts
2a9cb4c129aebecde661ea0401aba85626a64f06626a859d44970292a03662ef  tests/acceptance/support/k2_hosted_probe.py
8faea31f161002bb6ac18652bd6cf715e927b5cd20ab7f759e87313d66b4d0bc  tests/acceptance/support/k2_hosted_workflow_security.test.ts
d15a73fa93dbfb0bcd786c2cc3707905ac0e2074d1ea2f076bc0ab87128fd5e6  tests/acceptance/support/pilot_reader_hosted_runner.test.ts
a9a7a53e9ade63813ccbfb49ed65c3da1184a1102364eda93be28b247c185157  tests/acceptance/support/pilot_reader_hosted_runner.ts
4f4020c67b2ad5ffa974af125190f647e1cfba4b5817bdc9ce628b6beee6bb45  tests/acceptance/support/test_k2_hosted_probe.py
66da75ce103277e6ed13322ff7a524a80e2d67094fdb83cc9984dd412e9720e8  tests/backend/database/test_pilot_reader_catalog_probe.py
6b1da4e6439d7d28cbf1546e115c4d4067a7321948d577bf8c45369d13ffd943  tsconfig.k2-harness.json
```

## Findings

### [HIGH] Completion does not prove the exact passive exposure effect set or cardinality

In `tests/acceptance/support/pilot_reader_hosted_runner.ts`:

- `validateReaderExposureBody` (lines 434–455) accepts every matching `read` exposure while `completionArmed`; it does not enforce one logical exposure request or bind a repeat to the first idempotency key/body. `forwardPilotReaderRequest` stores the latest request over prior values (lines 501–511).
- The response check accepts any `acceptedConceptCount >= 1` (lines 584–596), then stores only the latest count. It does not reconcile the count against the distinct eligible concept set in the server-returned final segment.
- Completion snapshots compare the eight tables in `COMPLETION_STABLE_TABLES` (lines 33–36, 412–419); `assertNoNewReviewOrCompetenceState` repeats that same subset (lines 646–659). The completion assertions (lines 921–932) do not assert expected deltas for `exposure_events`, `reader_exposure_concepts`, `learning_events`, or `user_concept_states`.
- Only `finalConceptIds[0]` is checked for passive concept semantics (lines 905–907, 938–941). The subsequent replay repeats only the last captured exposure key/body and progress key/body (lines 933–965), so it cannot prove that earlier distinct-key requests were absent or that every eligible concept had at most one canonical event.

This leaves a pass path where the browser submits repeated or distinct-key final-segment exposures and extra passive events or state changes occur for other final-segment concepts, while the single inspected concept remains within its allowed transition and the replay snapshot remains unchanged. That violates the plan's completion rule: at most one canonical passive event per distinct eligible concept, with no competence or other unapproved learner-state effects. This is a harness verification gap, not evidence that the deployed Reader currently creates duplicate events.

**Required evidence to clear:** fail closed on duplicate logical completion/exposure requests (or prove repeated requests reuse exactly the original key and body); compare actor-scoped before/after counts and hashes for the full completion effect set; reconcile the server's accepted count and persisted canonical event cardinality with the exact distinct eligible concepts in the final segment; check the permitted status/competence transition for every affected concept; and replay the same exact keys while proving the actor snapshot remains unchanged. Keep review/FSRS/saved/active-learning state stable as the current assertions intend.

## Security boundary review

No separate HIGH/BLOCKER authorization-boundary defect was found in this 17-path snapshot:

- The new fixed selector is under the existing manual-dispatch, exact repository/master/workflow-ref, and owner/triggering-actor checks. The SHA preflight occurs before staging acceptance secrets, permissions and concurrency remain bounded, and the pilot dispatch selects its dedicated spec rather than a K2 wave/plugin.
- The browser path binds ordinary Auth JWTs to the disposable actor and forwards only the allowlisted product requests. The Admin client and service key stay in the Node runner/cleanup boundary; no service/admin credential is sent to the page or browser request.
- The actorless catalog probe is pinned to the candidate and manifest, checks 72 translations and provenance, runs with a minimal child environment, verifies the pinned read-only TLS database role and transaction, and returns bounded proof fields rather than content rows. Probe exceptions are generic.
- Actor creation uses the existing exact run marker and normal Auth flow. Cleanup/recovery is bounded to marked or exact same-run identities with Auth absence, actor zero-residue and retained-state equality checks. Playwright trace, screenshot and video capture are disabled.
- The synthetic failed-Save case fulfills a local 503 before forwarding the first Save request, checks no state delta, then forwards the retry normally. It tests the UI retry path; it does not establish backend behavior under a real server-side Save failure.

The harness also correctly fails closed if ordinary Reader recommendation does not select the pinned content. The pending P005 product-selection decision is outside this source verdict; it remains a separate runtime hold. No selector forcing, recommendation reordering, or hosted proof is approved by this review.

## Verification

- Independently ran the exact 14-file Vitest list in `.github/workflows/k2-hosted-security-gate.yml`: **14 files passed; 288 tests passed, 1 skipped**. The skip is the opt-in FRLL database proof round-trip. This was local compatibility coverage only; no K2 hosted workflow or actors ran.
- Independently ran `python -m pytest -q tests/acceptance/support/test_k2_hosted_probe.py`: **50 passed**.
- The frozen implementation packet reports harness TypeScript check, focused ESLint, `git diff --check`, and the local disposable PostgreSQL catalog-probe test (**5 passed**). These packet results are attributed to the implementation worker, not rerun as part of this review.

## Initial gate (historical)

At the initial snapshot, do not treat the harness source review as PASS or dispatch hosted acceptance until the HIGH finding is corrected and a new exact-source review clears it. This review did not approve content publication or selection-runtime behavior.

## Independent HIGH-remediation re-review

**Date:** 2026-10-10  
**Reviewer configuration:** GPT-6 Luna, Max reasoning effort (assigned configuration; runtime introspection unavailable).  
**Current verdict:** **FAIL / HOLD** — the original HIGH finding is closed for the cases it described, but a separate HIGH false-PASS path remains for mutations to pre-existing actor rows in tables that also receive expected completion inserts. No hosted acceptance or promotion claim is supported.

### Exact source pin and scope

Re-reviewed the frozen 17-path remediation snapshot against the accepted plan and its PASS review. The remediation packet is `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-pilot-reader-hosted-harness-high-remediation.md`, SHA-256 `894fbcfebb0d0c746cf1a18ed47cdc8baca30732901f2bd89e8af51b6d2e14bf`. The accepted plan SHA-256 is `401065df42407a51fe8a5baef0f3bb8211dd8ab5b35ee2f053b347af35aa93f4`; its plan review SHA-256 is `cca7f8dc00642a6961fa8f40ef63b23dc1b03b1b04e3e9dc077d600211d00ece`.

Independently re-hashed all 17 current files. Their canonical LF aggregate is `ee41d798440e8329438b07f522bbbb0c95b9f082e0c9b0bd41f47d52a439bc1d`, matching the remediation packet.

```text
81af1ad2da00d6650d4542a52a4438db4f099ec0410746f34134633b40668ee8  .github/workflows/k2-hosted-acceptance.yml
597ee240089b03c54acf96d0769ac350e2ff6cd22eb72885f93e3d2d27ee12a7  .github/workflows/k2-hosted-security-gate.yml
5a80f26a37427f13180ab714ed630f2098888b54d10a421b1d2d91e003b73f0a  playwright.k2-hosted.config.ts
98c8faed5386566cb4fd3d9b48273176e04b544a6a0dbcc08a09114573be4128  tests/acceptance/pilot_reader_hosted_acceptance.spec.ts
9ea047a7496f341f6ebfbae4fb87dbceb7aafe16e777df20bfafd4f3066bfb9e  tests/acceptance/support/k2_hosted_acceptance_helpers.test.ts
be8ad7709ec72da3238c6fdb8fb19a229f59366be4f5dcb71bb64c3a7a5b4bb2  tests/acceptance/support/k2_hosted_acceptance_helpers.ts
54d150f09b584afa3c84153a2ae21f803dbbeed21f740f34a7a267640e8b66ef  tests/acceptance/support/k2_hosted_actors.test.ts
147cbdfcbefc9f675f8d5b3fbeb9082a6fbbb0457392c35b362b6cf8fff50f65  tests/acceptance/support/k2_hosted_actors.ts
83cba1384af5e16dddba7c9611a5a1699795d294850a033652a4da217a775cd9  tests/acceptance/support/k2_hosted_probe_client.test.ts
6abbed824b78d03e4b245e76fbd3074bdb451b799366d4968eaa2780bf4ad901  tests/acceptance/support/k2_hosted_probe_client.ts
ff36625720128a0e27e59286373cc0b290ccef93a1b279558d7167ba5817363a  tests/acceptance/support/k2_hosted_probe.py
8faea31f161002bb6ac18652bd6cf715e927b5cd20ab7f759e87313d66b4d0bc  tests/acceptance/support/k2_hosted_workflow_security.test.ts
94cda8dfee5dea643cfe3d4623e7c3558321eee7a50a89960c1ce941bfedb313  tests/acceptance/support/pilot_reader_hosted_runner.test.ts
4f142d56145e49eb70193807e5612539124d87a0c86f9305aa35e0293efb1cf4  tests/acceptance/support/pilot_reader_hosted_runner.ts
a78322d583152c0d7ac43a6b674cf18f01ca609975202b0c0c687ff7bf19a54e  tests/acceptance/support/test_k2_hosted_probe.py
8163bd6b469deb505789e97392dd4f0d0c47a298065024eb6699d76f3bb7cc67  tests/backend/database/test_pilot_reader_catalog_probe.py
6b1da4e6439d7d28cbf1546e115c4d4067a7321948d577bf8c45369d13ffd943  tsconfig.k2-harness.json
```

The re-review remains limited to those 17 paths. Root-owned Reader/Admin and publication-manifest files, proposed P005 route work, and other integration changes are excluded. No source was edited; no Git operation, hosted workflow, browser journey, hosted actor, or cloud state access/mutation was performed by this review. The only stateful verification was a local disposable PostgreSQL regression.

### Original HIGH closure

The initial finding, **“Completion does not prove the exact passive exposure effect set or cardinality,”** is closed in this exact snapshot for the cases it described:

- `pilot_reader_hosted_runner.ts:524-539, 661-677, 699-715` rejects a second logical read-exposure or completion-progress command, regardless of key/body, while the browser flow is armed. The same original key/body are replayed directly after completion.
- `pilot_reader_hosted_runner.ts:470-493, 554-579, 756-772, 1093-1138` requires accepted count to equal the exact distinct server-resolved final-segment concepts, exact expected completion cardinalities, the one exposure ID, exact canonical link/learning/state concept sets, passive-only concept transitions for every eligible concept, and neutral skill/projection checks.
- `k2_hosted_probe.py:1619-1708, 1726-1787` independently resolves the eligible segment concepts and reconciles the persisted exposure, exact link/event sets, and every eligible concept state. Skill rows must be exactly the three neutral skills and match the current projection parameter set/version.
- `pilot_reader_hosted_runner.ts:1140-1163` replays the exact original exposure/progress keys and bodies, checks the exposure result and completed progress, then requires the entire actor snapshot to remain unchanged.
- Completion and user-clicked Today are separate snapshot phases. Today is bounded by the returned plan shape and exact 27-table deltas (`pilot_reader_hosted_runner.ts:495-522, 1165-1180`).
- The disposable PostgreSQL negative checks reject an extra foreign concept link, an active competence mutation on an eligible final-segment concept, and a second distinct-key read (`test_pilot_reader_catalog_probe.py:581-629`). These are local regression controls only; they are not hosted evidence.

This closure does not show that deployed Reader behavior is correct; it shows that the earlier identified eligible-set duplication/cardinality gap is addressed in the reviewed harness source.

### [HIGH] Expected insertions mask mutations to pre-existing actor rows

`pilot_reader_hosted_runner.ts:443-468, 470-485` snapshots aggregate row counts and one digest per actor-owned table. For a table with a permitted positive row delta, it requires the expected count change and only that the whole-table digest changed. It cannot compare existing rows independently from newly inserted rows.

This matters for four completion tables with a permitted positive delta and pre-existing actor rows:

- `exposure_events`: expected `+1`; the prior lookup exposure remains in the table.
- `reader_exposure_concepts`: expected `+N`; the prior lookup concept link remains.
- `learning_events`: expected `+N`; prior lookup/save learning events remain.
- `user_concept_states`: expected `+N`; a prior concept state remains.

`reader_mutation_results` and `user_content_progress` also expect `+1`, but the exact post-completion total for each is `1`; together with the required `+1` delta this proves there was no pre-existing row in either table to mask an update.

The exact post-completion totals at `pilot_reader_hosted_runner.ts:1114-1130` combined with the required deltas establish those prior rows. The completion probe validates the newly expected exposure and its links/events (`k2_hosted_probe.py:1619-1682`) and validates state only for `eligible_ids` (`k2_hosted_probe.py:1684-1708`). It does not compare the pre-existing lookup/save event, link, or concept-state rows before and after. Therefore an unintended update to one of those rows can be hidden by the expected insertions: the aggregate table count remains correct and its digest changes as expected. In particular, an active/competence mutation to the earlier, non-eligible concept can escape while all final-segment concept checks pass.

The projection-head table is a separate allowed update (`pilot_reader_hosted_runner.ts:485-491`). Its probe checks the state/sequence increments and parameter version and that each skill references the current head (`k2_hosted_probe.py:1710-1754`), but the returned proof omits `parameter_set_id`; the runner only compares `parameterVersion` across phases and does not compare the complete pre-existing head row against an allowlisted field-level transition. This should be included in the same bounded stable-row reconciliation so unexpected head-field or parameter-set changes cannot be hidden by the allowed update.

This is an acceptance false-PASS path, not evidence that the current Reader changes any pre-existing row. It violates the plan’s requirement that completion cause only the specified passive effects and no other competence/learning-state changes. It is HIGH because the harness can report success despite an unapproved mutation to retained learner state in the same actor and command.

**Required evidence to clear:** retain an in-process, non-exported canonical digest/count for the stable pre-existing rows in the positive-delta tables, excluding only the exact independently validated new completion rows; compare those stable rows after completion and fail on any difference. For the projection head, prove the exact allowlisted state/sequence/lineage transition and stable remaining fields. Add a disposable-PostgreSQL negative case that mutates a pre-existing non-eligible concept state (and, as applicable, a prior event/link) alongside the allowed completion effects; the completion proof must reject it, and rollback the injected anomaly. Do not expose row payloads or learner identifiers in evidence.

The current local PostgreSQL negative test mutates `final_concept_ids[0]` only (`test_pilot_reader_catalog_probe.py:601-611`). It does not test a pre-existing non-eligible concept row. **A new actual disposable-PostgreSQL negative test is required to clear this finding.**

### Security and authorization boundary

No new HIGH/BLOCKER workflow authorization, secret-isolation, probe-role, Auth/RLS, production permission, or cleanup/recovery defect was found in the reviewed 17-path snapshot. The fixed workflow identity and selector checks, least-privilege workflow permissions, normal-JWT browser boundary, Node/probe-only Admin/service boundary, read-only probe child allowlist, exact marked-actor cleanup, unconditional current-run cleanup/recovery, zero-actor proofs, and retained-state comparison remain as described in the historical boundary review. Migration 0021, Auth, RLS, and production authorization are outside this change and unchanged.

The synthetic failed-Save path still fulfills a local 503 before forwarding the first Save request, checks the no-mutation snapshot, then forwards the retry; it does not prove behavior under a real hosted server-side Save failure. The normal recommendation guard still fails closed if the ordinary Reader recommendation does not select the pinned item. P005 explicit-selection work is proposed and owner-authorized separately, but is not present in this snapshot; any later route adaptation needs a narrow review. No selector forcing or recommendation reordering is approved here.

### Independent verification

- Recomputed all 17 raw hashes and the canonical LF aggregate; all match the remediation packet.
- Ran the exact 14-file local Vitest list in `.github/workflows/k2-hosted-security-gate.yml`: **14 files passed; 294 passed, 1 skipped**. The skip is the optional FRLL proof round-trip. This is local compatibility coverage; no K2 hosted workflow was run.
- Ran `python -m pytest -q tests/acceptance/support/test_k2_hosted_probe.py -k reader_completion`: **6 passed, 50 deselected**.
- Ran `DB_LOCALONLY=1 python -m pytest -q tests/backend/database/test_pilot_reader_catalog_probe.py::test_reader_completion_probe_reconciles_real_postgres_passive_effects`: **1 passed** against the disposable local PostgreSQL fixture.
- The remediation packet additionally reports its full local probe/PG tests (**62 passed**), harness typecheck, focused ESLint, Ruff, and diff-check. Those extra packet checks are attributed to the implementation worker; they are not independent reruns in this re-review.
- No hosted Auth actors, normal deployed browser flow, remote database, GitHub dispatch, publication, deployment, or hosted proof was exercised.

### Gate at the prior review snapshot (historical)

Keep this exact source at **FAIL / HOLD** until the HIGH stable-row reconciliation gap is fixed in a new frozen snapshot and independently re-reviewed. No hosted workflow dispatch, hosted actors, publication, promotion, or hosted PASS claim is authorized by this review. P005 implementation remains a separate pending runtime change and review.

## Stable-row HIGH remediation re-review — 2026-10-10

**Reviewer configuration:** GPT-6 Luna / Max (assigned reviewer configuration; runtime introspection unavailable).  
**Current verdict:** **PASS for this exact 17-path harness source snapshot; no HIGH or BLOCKER remains in the reviewed harness paths.** This is source and local-regression evidence only; it is not hosted acceptance, a workflow dispatch authorization, or promotion approval.

The historical FAIL sections above are preserved as evidence for their earlier snapshots. This review rechecked the frozen stable-row remediation against the accepted plan and PASS plan review:

- Plan: `plans/PILOT-READER-HOSTED-ACCEPTANCE.md`, SHA-256 `401065df42407a51fe8a5baef0f3bb8211dd8ab5b35ee2f053b347af35aa93f4`.
- Plan review: `reviews/PILOT-READER-HOSTED-PLAN-REVIEW.md`, SHA-256 `cca7f8dc00642a6961fa8f40ef63b23dc1b03b1b04e3e9dc077d600211d00ece`.
- Remediation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-pilot-reader-hosted-harness-high-stable-row-remediation.md`, SHA-256 `eead27b7bfd484d5184260dcf638baa92075aa6722df2d85a825d24c39205eb1`.
- Frozen 17-path aggregate, canonical printed-manifest order and UTF-8 LF: `7d3a8a45a2ac7a538ad181cef1b4c9c094648ab1065e82e5cd97b8c27da49f06`.

All 17 current raw file hashes and the aggregate were independently recomputed from the integration worktree and matched the packet. The exact pins are:

```text
81af1ad2da00d6650d4542a52a4438db4f099ec0410746f34134633b40668ee8  .github/workflows/k2-hosted-acceptance.yml
597ee240089b03c54acf96d0769ac350e2ff6cd22eb72885f93e3d2d27ee12a7  .github/workflows/k2-hosted-security-gate.yml
5a80f26a37427f13180ab714ed630f2098888b54d10a421b1d2d91e003b73f0a  playwright.k2-hosted.config.ts
98c8faed5386566cb4fd3d9b48273176e04b544a6a0dbcc08a09114573be4128  tests/acceptance/pilot_reader_hosted_acceptance.spec.ts
9ea047a7496f341f6ebfbae4fb87dbceb7aafe16e777df20bfafd4f3066bfb9e  tests/acceptance/support/k2_hosted_acceptance_helpers.test.ts
be8ad7709ec72da3238c6fdb8fb19a229f59366be4f5dcb71bb64c3a7a5b4bb2  tests/acceptance/support/k2_hosted_acceptance_helpers.ts
54d150f09b584afa3c84153a2ae21f803dbbeed21f740f34a7a267640e8b66ef  tests/acceptance/support/k2_hosted_actors.test.ts
147cbdfcbefc9f675f8d5b3fbeb9082a6fbbb0457392c35b362b6cf8fff50f65  tests/acceptance/support/k2_hosted_actors.ts
d5bbf67244f1999c28a9e2e93418179f90f1250e9c333684aa2d29b88b4917de  tests/acceptance/support/k2_hosted_probe_client.test.ts
1db08c05c44b0974a6eca548fc46f7cc07a6ab24533b21ac196ae0dc117fb4a3  tests/acceptance/support/k2_hosted_probe_client.ts
41e29384508507f4b95b132cb17e9371709f3dc913dc3c0db5495ffcdd5e85dc  tests/acceptance/support/k2_hosted_probe.py
8faea31f161002bb6ac18652bd6cf715e927b5cd20ab7f759e87313d66b4d0bc  tests/acceptance/support/k2_hosted_workflow_security.test.ts
535441b14220b661c5dee1e49d44d3b7d5992693e540b91e594a8693d836be42  tests/acceptance/support/pilot_reader_hosted_runner.test.ts
799b04e091df048124271de337d1b6d245ac4fc71865d1452e116512b98a7147  tests/acceptance/support/pilot_reader_hosted_runner.ts
10a4592be752b423711b3e0aede37821489f2b54ddf43e9a335c63232437287c  tests/acceptance/support/test_k2_hosted_probe.py
a131a652029fcaa0b3445cc95e67d7cf83883ef7715a2060a62b34ae3e79fe85  tests/backend/database/test_pilot_reader_catalog_probe.py
6b1da4e6439d7d28cbf1546e115c4d4067a7321948d577bf8c45369d13ffd943  tsconfig.k2-harness.json
```

### Closure of the retained-row false-PASS path

The preceding HIGH finding is closed for the four actor-wide positive-delta tables that can contain retained rows:

- `exposure_events` (`+1`),
- `reader_exposure_concepts` (`+N`),
- `learning_events` (`+N`), and
- `user_concept_states` (`+N`).

The probe now streams complete canonical row JSON for each of these tables, scoped by actor across profiles, orders it under `C` collation, and returns only a bounded row count and SHA-256 digest per stable subset. Per-row, per-table, total-row, and total-byte limits fail closed. No retained row payload is included in this stable-row proof. After completion the stable subsets exclude only the exact independently validated new completion effects: the returned exposure ID; links tied to that exposure; learning events tied to that exposure as their source; and final-segment eligible concept states in the target profile. Before completion, the probe rejects any existing state for those target-profile eligible concepts. The runner requires exact before/after stable table sets, counts, and digests to match.

The other positive-delta tables, `reader_mutation_results` and `user_content_progress`, require exact `+1` actor-wide deltas and exact post-phase totals of one; those constraints show they had no retained pre-existing row that an allowed insert could mask. The existing 27-table actor-wide snapshot still requires the precise phase delta for every other table.

The projection head is independently bound to the selected actor/profile and exactly one row. The probe hashes the canonical complete head row after removing only `state_version`, `next_ingestion_sequence`, and `updated_at`; therefore parameter-set ID, method lineage, profile/actor binding, creation time, and all other head fields remain in the immutable digest. It requires both counters to increase by exactly the eligible concept count and the head's `updated_at` to equal the server-recorded completion time. The runner compares immutable digests and counter deltas. All three skill rows remain exactly neutral and bound to the head's current parameter set/version. The explicit projection-parameter-set negative in the local regression changes the immutable digest.

The earlier exact passive-effect/cardinality controls remain present: duplicate logical completion exposure/progress commands fail closed; the server's accepted concept count must equal the distinct final-segment set; persisted exposure, links, learning events, and concept-state rows must reconcile exactly; the passive transition is checked for every eligible concept; and exact-key replay must preserve the full actor snapshot. Completion and user-clicked Today are still separate bounded phases. The harness continues to fail closed if ordinary recommendation does not select the pinned content; this source snapshot does not include a P005 explicit-route adaptation.

### Actual disposable-PostgreSQL negative evidence

The single local integration regression creates and publishes through the normal local Admin fixture, performs the normal synthetic Reader lookup and final-segment exposure, then mutates the prior non-final lookup concept state inside a transaction. The before/after stable-row comparator rejects that retained-row change, and the test rolls the transaction back. In the same test, it verifies the projection-parameter-set tamper changes the immutable head digest; append-only triggers reject mutation of prior exposure, learning-event, and exposure-link rows; an extra foreign completion link and an active eligible-concept state fail probe validation; and a second distinct-key completion exposure fails the exact cardinality check. These controls were exercised only against the disposable local PostgreSQL fixture.

### Independent local verification

- `pnpm exec vitest run tests/acceptance/support/k2_hosted_probe_client.test.ts tests/acceptance/support/pilot_reader_hosted_runner.test.ts --maxWorkers=1` — **2 files passed; 29 passed, 1 skipped**. The skip is the opt-in FRLL PostgreSQL proof round-trip.
- `python -m pytest -q tests/acceptance/support/test_k2_hosted_probe.py` — **60 passed**.
- `DB_LOCALONLY=1 python -m pytest -q tests/backend/database/test_pilot_reader_catalog_probe.py::test_reader_completion_probe_reconciles_real_postgres_passive_effects` — **1 passed** against the disposable local PostgreSQL fixture.
- The implementation packet reports harness TypeScript check, focused ESLint, Ruff and diff checks passed; those were not independently rerun in this remediation re-review.

No hosted workflow, browser journey, Auth actor, hosted database, publication, deployment, Git operation, or remote state was used or changed. This PASS does not claim hosted acceptance or promotion. P005 is now separately source-reviewed, but this 17-path aggregate still uses the ordinary recommendation route guard; the requested-route/CI harness adaptation is a later source delta and requires its own narrow exact-source review. Until that later review and the already-required owner/Commander gates are satisfied, keep hosted dispatch and promotion held.

## Requested-route and CI adaptation final re-review — 2026-10-10

**Reviewer configuration:** GPT-6 Luna / Max (assigned reviewer configuration; runtime introspection unavailable).
**Verdict:** **PASS for this exact 18-path harness source snapshot; no HIGH or BLOCKER remains in the reviewed harness scope.** This is source and local-test evidence only. It is not hosted acceptance, a hosted-dispatch authorization, or promotion approval.

This final review supersedes the prior 17-path section's note that requested-route adaptation still needed review. Earlier historical FAIL findings remain preserved above, including their closure evidence and their exact snapshot boundaries.

### Frozen source and review basis

- Accepted hosted-acceptance plan: `plans/PILOT-READER-HOSTED-ACCEPTANCE.md`, SHA-256 `401065df42407a51fe8a5baef0f3bb8211dd8ab5b35ee2f053b347af35aa93f4`.
- Independent PASS plan review: `reviews/PILOT-READER-HOSTED-PLAN-REVIEW.md`, SHA-256 `cca7f8dc00642a6961fa8f40ef63b23dc1b03b1b04e3e9dc077d600211d00ece`.
- Requested-route implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-pilot-reader-hosted-harness-requested-route.md`, SHA-256 `5e9a34a9751d5a6578fbe9e8ac2739d9e5b1b2c42af0b83d4a6a35e2206c0e66`.
- Separate P005 source review: nine-file aggregate `d5121d717aa91ebb5899c33aa2e057f398c9c488211b89d8c778348ff1414303`; review record SHA-256 `5f961d5dc8774a1bd2774fed89946bfed0f317c1ac9a307f3ada047014561ea1`.
- Frozen final 18-path aggregate, in the packet's canonical printed manifest order with UTF-8 LF: `8efbb8d7ac77122d54d1495a2d5cb42e93a88a35e3c4eca2c12227dda1a6134c`.

I independently recomputed the packet SHA-256, all 18 raw file hashes, and the aggregate from the integration worktree. All matched exactly; the manifest contains 18 unique paths:

```text
81af1ad2da00d6650d4542a52a4438db4f099ec0410746f34134633b40668ee8  .github/workflows/k2-hosted-acceptance.yml
597ee240089b03c54acf96d0769ac350e2ff6cd22eb72885f93e3d2d27ee12a7  .github/workflows/k2-hosted-security-gate.yml
88c8e7b55a873f05e38f4cf9d8efb27a8653f8c0e0bfaa95b6af44908ac87603  .github/workflows/knowledge-audit-ci.yml
5a80f26a37427f13180ab714ed630f2098888b54d10a421b1d2d91e003b73f0a  playwright.k2-hosted.config.ts
98c8faed5386566cb4fd3d9b48273176e04b544a6a0dbcc08a09114573be4128  tests/acceptance/pilot_reader_hosted_acceptance.spec.ts
9ea047a7496f341f6ebfbae4fb87dbceb7aafe16e777df20bfafd4f3066bfb9e  tests/acceptance/support/k2_hosted_acceptance_helpers.test.ts
be8ad7709ec72da3238c6fdb8fb19a229f59366be4f5dcb71bb64c3a7a5b4bb2  tests/acceptance/support/k2_hosted_acceptance_helpers.ts
54d150f09b584afa3c84153a2ae21f803dbbeed21f740f34a7a267640e8b66ef  tests/acceptance/support/k2_hosted_actors.test.ts
147cbdfcbefc9f675f8d5b3fbeb9082a6fbbb0457392c35b362b6cf8fff50f65  tests/acceptance/support/k2_hosted_actors.ts
d5bbf67244f1999c28a9e2e93418179f90f1250e9c333684aa2d29b88b4917de  tests/acceptance/support/k2_hosted_probe_client.test.ts
1db08c05c44b0974a6eca548fc46f7cc07a6ab24533b21ac196ae0dc117fb4a3  tests/acceptance/support/k2_hosted_probe_client.ts
3b2154fdd4516ecf1cda9f866b63741ced2e341204bb56141a2d5b249f57337e  tests/acceptance/support/k2_hosted_probe.py
8faea31f161002bb6ac18652bd6cf715e927b5cd20ab7f759e87313d66b4d0bc  tests/acceptance/support/k2_hosted_workflow_security.test.ts
4e5cb59a99d898d12a9aca22874e5d40792b8c7878a329321ae63a4b0df4d324  tests/acceptance/support/pilot_reader_hosted_runner.test.ts
f15eafc5654e76ae24b749ee294e87e64d0d0ed889eabd5689131800ac3b6f00  tests/acceptance/support/pilot_reader_hosted_runner.ts
505ec5ad30dc8cc4646652ecbb3c207dfaabc0abd469138cb1dcb491dcee9e00  tests/acceptance/support/test_k2_hosted_probe.py
a131a652029fcaa0b3445cc95e67d7cf83883ef7715a2060a62b34ae3e79fe85  tests/backend/database/test_pilot_reader_catalog_probe.py
6b1da4e6439d7d28cbf1546e115c4d4067a7321948d577bf8c45369d13ffd943  tsconfig.k2-harness.json
```

### Requested-route guard and acceptance behavior

The reviewed delta is confined to the Reader harness runner/test and the existing non-secret `knowledge-audit-ci.yml` workflow; the other exact-pinned paths preserve the previously reviewed K2 selector, actor lifecycle, probe, cleanup, and workflow-security boundary.

- The actorless full-catalog proof must identify exactly one published item matching the pinned first-party candidate, 72 sentence/translation pairs, provenance flags, and body/translation/pair hashes. The runner accepts only a UUID from that proof (`pilot_reader_hosted_runner.ts:228-245`).
- `pilotReaderSelectionUrl` constructs `/read?contentId=<pinned-id>` only after UUID validation. `openRequestedReader` arms one direct request, navigates to that route, and rejects a changed origin/path, fragments, repeated or missing `contentId`, extra query keys, or a changed ID. It then requires one confirmed content response and an exact one-request count (`:248-277`).
- The network classifier permits only the exact `/v1/content/<pinned-id>` GET with no query while the one-shot request is armed. Recommendation, foreign IDs/origins, query-bearing, unarmed, duplicate, and post-confirmation content requests classify as rejected (`:119-168`). Any rejected browser request sets the run failure flag and aborts it.
- The browser forwarder requires the protected origin and the current actor's ordinary bearer JWT, forwards through the existing authenticated API path, and validates the actual content response against the pinned manifest before marking the route confirmed (`:669-852`). It does not mock or force the content response. A, A's return after Review, and B each require exactly one GET for the same pinned content identity (`:1003-1023`, `:1110-1113`, `:1235-1256`).
- The route test explicitly rejects recommendation fallback, foreign or different IDs, query parameters, and unarmed/repeated direct fetches (`pilot_reader_hosted_runner.test.ts:223-251`). The existing normal-JWT actor binding, profile binding, exact passive completion effects, stable prior-row digests, 27-table snapshots, cleanup, and retained-state comparison remain in force.
- `knowledge-audit-ci.yml` adds the Reader route/source, related regression files, and pilot harness to the existing PR path filter. Its existing Review frontend job now runs the Admin-content, explicit-selection, Reader, and Today regressions with the existing Review tests. The workflow still uses its existing event and `contents: read` permissions; this adaptation adds no job with hosted credentials, secret, environment, deployment behavior, or workflow event. No OIDC claim, permission, secret path, K2 selector, Auth/RLS, migration, or production-authorization change is present.

The synthetic first-Save 503 remains a local harness failure injection: only the retry is forwarded to the API. This source review does not treat it as proof of a real hosted server-side Save failure.

### Independent verification and limits

- `pnpm exec vitest run tests/acceptance/support/k2_hosted_probe_client.test.ts tests/acceptance/support/pilot_reader_hosted_runner.test.ts tests/acceptance/support/k2_hosted_workflow_security.test.ts --maxWorkers=1` — **3 files passed; 38 passed, 1 skipped**. The skip is the opt-in FRLL proof.
- `pnpm exec tsc --project tsconfig.k2-harness.json --noEmit` — passed.
- Focused ESLint on `pilot_reader_hosted_runner.ts` and its test — passed.
- The earlier exact stable-row snapshot review in this record independently ran the local 14-file K2 hosted-security compatibility list (**294 passed, 1 skipped**), plus the 60-test Python probe and one disposable-PostgreSQL retained-row negative regression. This final delta does not modify those shared helpers; the focused rerun above includes the probe-client and workflow-security suites. No hosted K2 workflow was rerun.
- No hosted actors, hosted workflow dispatch, authenticated deployed Reader UI, remote database, publication, deployment, Git push, or live learner session was used in this re-review. The synthetic local route/auth-gate evidence in the separate P005 source review is not authenticated Reader acceptance. No hosted PASS or learner-outcome claim is made.

No HIGH/BLOCKER source finding remains for this exact 18-path source snapshot. Required exact-head CI, owner/Commander gates, and any separately approved hosted-acceptance procedure remain outside this verdict. No source, Git, or cloud state was changed by this review; this review record is the only file edited.
## Staged-byte line-ending attestation — 2026-10-10

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable). **Source verdict remains unchanged: PASS for the exact reviewed snapshot; this attestation does not add hosted evidence.**

Independently checked the staged `tests/acceptance/support/pilot_reader_hosted_runner.ts` bytes against the reviewed raw file. The raw file SHA-256 is `f15eafc5654e76ae24b749ee294e87e64d0d0ed889eabd5689131800ac3b6f00` and is 64,906 bytes. It contains exactly one CRLF pair and no lone CR. The repository has `.gitattributes` rule `* text=auto eol=lf` and effective `core.autocrlf=true`. Replacing that sole CRLF with LF yields 64,905 bytes exactly equal, byte for byte, to the blob read from the Git index. The normalized staged-blob content SHA-256 is `db15115942aa862ca9a0e698ba57b00c339ccc0e9b5a3dec9c4ea5e0869fe936`.

The checkout reports Git object format `sha1`; consequently the index entry's Git blob object ID is `d19825d75a8e7c843376158223e9f0176027a05b`. That 40-hex Git object ID is distinct from the 64-hex SHA-256 content digest above. The byte equality proves the line-ending normalization is the only difference from the previously reviewed raw source. No implementation source, Git index, cloud state, or actor was changed; no tests were run. This review record is the only file edited in this follow-up.