# PILOT-READER Hosted Acceptance Plan — Independent Review

**Verdict:** PASS for the bounded plan; no HIGH or BLOCKER findings remain.

**Reviewer configuration:** GPT-6 Luna, Max reasoning effort (configured worker packet; runtime introspection unavailable).

**Reviewed artifact:** `plans/PILOT-READER-HOSTED-ACCEPTANCE.md`, SHA-256 `401065df42407a51fe8a5baef0f3bb8211dd8ab5b35ee2f053b347af35aa93f4`.

## Review scope and evidence

This is an independent security and acceptance-design review of the frozen plan. I reviewed the fixed workflow/selector and authorization boundary, the content publication and preservation gates, the two-actor scenario, cleanup/recovery conditions, and the Reader progress/exposure distinction against ADR-015/ADR-016, the Reader service and competence policy, existing Reader API tests, and the existing protected hosted workflow and actor helpers.

The plan keeps accepted K2-06 through K2-10 frozen. It adds one fixed `PILOT-READER` selector under the existing manual-dispatch, repository, master-ref, exact workflow-ref, and owner/triggering-actor checks. It keeps credentials at the runner/probe boundary, uses ordinary Auth JWTs in the browser, forbids K2-wave/plugin execution, and requires a separate pilot runner if shared helpers cannot be reused without weakening accepted behavior. It retains serialized execution, exact-source/deployment attestation, bounded allowlisted artifacts, unconditional current-run cleanup, and recovery verification.

The publication gate uses the independently reviewed 72-pair candidate as a new content identity through the normal Owner Admin create/validate/publish flow. It requires a fresh before/after comparison of the same 27 learner-state tables and an actorless exact-content manifest check. It preserves the existing published item and learner references, and forbids SQL or harness publication shortcuts.

The actor scenario separates actions and their permitted effects:

- Meaning reveal is local presentation only; it must produce no save, Reader exposure, or learning evidence.
- An explicit concept save follows the existing save/Learn contract. Assertions must allow its documented save intent, passive/competence facts, and memory-lineage effects; exact replay must not duplicate them. A Review link is not a promise that the item is due.
- Final-segment completion requires the server-confirmed `isCompleted` response before the user can click Today. Progress and eligible segment exposure are distinct commands. Exposure may derive at most one canonical passive event per distinct server-resolved eligible concept and may move unseen to discovered. It must not change competence score/confidence/mastery, FSRS state, review scheduling, or active-learning evidence. Replay must not duplicate progress, exposure, or passive events. The plan does not claim that a synthetic run represents a human reading all 72 sentences.
- Actor B is isolated from A's saved state and responses. Cleanup requires Auth absence, per-actor zero rows in all 27 learner tables, and fresh retained-state equality with the pre-actor baseline.

These boundaries match the existing domain rules: progress is not competence evidence; an eligible explicit Reader exposure can record passive discovery; a concept save has its separate existing learning-intent and lineage behavior. The tests cited during review distinguish progress-only completion from exposure-derived events and assert replay and unchanged competence mass.

## Findings and limits

No HIGH or BLOCKER issue remains in this plan revision. The final scenario now states the completion/exposure behavior precisely and does not require the invalid assertion that all learner events or all concept rows remain zero after completion.

This verdict approves the plan for isolated implementation and subsequent source review. It does not authorize workflow dispatch, actor creation, hosted content publication, or learner-data access. Implementation still requires focused synthetic-actor tests, type/lint and contract checks, an independent source review, exact-head CI/Preview, and root-controlled normal merge. Hosted acceptance and content publication remain separately gated. No hosted run or write was performed for this review, and this is not evidence of a real learner outcome.

## Reviewed source references

- `DECISIONS.md` — ADR-015 and ADR-016.
- `services/api/src/lingua_api/reader/service.py` — server-resolved exposure processing.
- `services/api/src/lingua_api/competence/service.py` — passive exposure versus explicit concept-save effects.
- `tests/backend/database/test_reader_api.py` — progress-only behavior, exposure fan-out/replay, and competence invariants.
- `.github/workflows/k2-hosted-acceptance.yml` and `tests/acceptance/support/k2_hosted_actors.ts` — protected workflow and actor lifecycle constraints.
