# PILOT Admin Vietnamese Translation — Independent Source Review

Date: 2026-10-10
Reviewer configuration: GPT-6 Luna / Max (configured reviewer model; runtime introspection unavailable)

## Verdict

**PASS — no open P0, P1, P2, HIGH, or BLOCKER findings in the reviewed source scope.** The two bounded P2 findings from the prior review are resolved. This is a source review; it does not establish CI promotion, deployment, hosted authoring, publication, or a learner journey.

## Frozen scope

- Base: `af813819729ac36e1df432c7af28465f8d1cdc36`
- Contract: `plans/PILOT-ADMIN-TRANSLATION-CONTRACT.md`, SHA-256 `5e829ccab9e801a77942bd8da6573a7923b8252341c08eed25676eb6a1ee0115`
- Implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-admin-translation-implementation.md`, SHA-256 `59614cff0f37c411b1e710d5404ce25f8995aa55668aeb39dec06dd06005717b`
- Source manifest: 18 implementation files plus the contract plan; every raw hash was recomputed and matched. Canonical aggregate: `cf87bcd9f749a8bc47f6b5f4e5c4f5b204feb0ca365c4d4bcc2211e978c2ffe2`.
- Final bounded delta reviewed:
  - `apps/web/src/features/admin/AdminContentDetail.tsx` — `a2ed43f4d570c758c657ec9e9dcb015ac843e7e011715b4a339662997a2a47e7`
  - `tests/backend/database/test_admin_content_api.py` — `f07a0f463daa6915bd2e3f37e3c31dc39b36db9f62c11ec01d94b86335806b7e`
  - `tests/frontend/admin-content.test.tsx` — `dfa06ab01085f15cb9c8624958ba0cbf25889095b48e3b36d7e4337f37b4104e`

## Findings resolved

1. **Validation timestamp ordering under lock contention (P2, resolved).** Validation now sets `reviewed_at` to the maximum of request time, the original source `imported_at`, and the active translation source `imported_at`, applying that timestamp consistently to the approved records and content. The new PostgreSQL regression holds the real content-row lock, queues translation before validation, confirms both requests are blocked on PostgreSQL locks, then releases them. Its controlled clock makes validation time earlier than translation import time; assertions require both source records and the content review timestamp to be no earlier than their imported timestamps. The implementation packet reports the full database module at 21/21 and the deterministic regression independently at 1/1.

2. **Stale successful-validation notice after translation mutation (P2, resolved).** `AdminContentDetail` clears its prior validation result only after a replacement or explicit clear succeeds, and displays the returned normalized status as “Đã chuẩn hóa.” The two new UI regressions exercise both replacement and clear. Since invalidation occurs only after the awaited write succeeds, the failure path retains the prior validation result.

## Security and contract review

The existing owner-only authenticated route and complete ordered English/Vietnamese set contract remain intact. The backend keeps exact VI text, rejects stale/partial alignment and foreign VI rows before mutation, and uses the existing content lock and transaction rollback behavior. Successful idempotent replay does not create additional provenance. The translation operation does not modify learner state; the implementation packet's database test measures the relevant learner tables around the candidate import. No schema, migration, Auth, RLS, grant, or Reader selector change is in this delta.

The separate candidate remains pinned to SHA-256 `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f` and staging-only in the publication manifest. Its editorial/rights provenance does not inherit the earlier PR38 approval. No live publication or hosted content write is claimed here.

## Verification and boundary

The frozen implementation packet reports: PostgreSQL database tests 21/21, isolated timestamp regression 1/1, OpenAPI contract tests 36/36, focused Admin frontend tests 12/12, workspace typecheck/lint, targeted Ruff, mypy, and diff checks passed. I independently verified the frozen file hashes and reviewed the changed timestamp/UI behavior; I did not rerun those suites in this bounded pass.

No exact-head CI, deployment, Preview/production probe, hosted Admin authoring, publication, or real learner interaction is established by this source review. Those remain separate gates.
