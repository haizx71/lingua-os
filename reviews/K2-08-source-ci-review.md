# K2-08 Source and CI Review — ecb8304

**Historical exact-head record:** this evidence describes the original ECB source checkpoint. PR #35 subsequently merged the independently reviewed fixture redesign and passing revised CI at `1ac2060`. See `reviews/K2-08-fixture-boundary-design-review.md` for current integration, migration and hosted gates; the original evidence below is preserved.

**Evidence status:** Source review PASS and exact-head CI PASS for the bounded source change only. This is not K2-08 hosted acceptance or promotion authorization.

**Reviewed source:** `ecb830418e81cc60e573fe91acf7382563ac0568`

**Base:** `2c3284a2deb4fac18683b660a751039e36b007f7`

**Pull request:** [#35](https://github.com/haizx71/lingua-os/pull/35), draft and held open; not merged.

**Independent review:** GPT-6 Luna / Max — PASS, no HIGH or BLOCKER findings.

**Implementation:** GPT-6 Luna / Max. **Documentation/preparation:** GPT-6 Luna / Medium.

## Exact-head verification

Both successful runs identify the reviewed source SHA above:

- [Knowledge Audit CI run 36795488328](https://github.com/haizx71/lingua-os/actions/runs/36795488328) — PASS. All jobs passed: Today PostgreSQL (39 tests), broader retrievability PostgreSQL (378 passed, 1 deselected), grammar PostgreSQL, Review frontend regression, and knowledge audit.
- [K2 Hosted Harness Security Gate run 36795488330](https://github.com/haizx71/lingua-os/actions/runs/36795488330) — PASS.

The Today PostgreSQL job runs `tests/backend/today/test_policy.py`, `tests/backend/database/test_today_schema.py`, and `tests/backend/database/test_today_api.py`. The pure policy file contains 20 tests, all included in the 39-test passing job. The successful knowledge-audit job validated and previewed the 115-concept audit and built the conservative 108-concept candidate. These counts describe the CI scope at this SHA; they do not establish a live catalog import or hosted learner-state result.

## Review and regression history

An earlier review at `b3cc0769be24f71587233961d5b9fecd435f9140` identified a novelty-cap mismatch. Earlier PostgreSQL CI also exposed invalid/incomplete test fixtures, including a row rejected by the `fsrs_states_shape_check` and a remediation test whose expected actor-owned competence row was absent. The current test fixture inserts and verifies the missing disposable actor-scoped row. At the reviewed head, the bounded independent review and exact-head PostgreSQL CI pass; the fixes did not weaken database constraints or relax the test assertions.

This evidence is limited to source review and credential-free CI. Migration `0020` has **not** been applied to staging. No hosted actor cycle or full live Phase C was performed by these checks. K2-08 full hosted acceptance remains **BLOCKED**; K2-09 and later work remain subject to their existing gates. This review does not authorize merge, deployment, migration, role or secret changes, hosted dispatch, or promotion, and it does not establish an overall K2-08 PASS.

## Separate preparation artifacts

- [English article candidate `5bfb9362e2b534b526260d089a42c4edd44c36a4`](https://github.com/haizx71/lingua-os/commit/5bfb9362e2b534b526260d089a42c4edd44c36a4) — candidate only; pending editorial, rights, level, and publication review.
- [Staging fixture capability proposal `60b01e2a637b50117a5df2cd5b316654b310661b`](https://github.com/haizx71/lingua-os/commit/60b01e2a637b50117a5df2cd5b316654b310661b) — separate proposal only; **NOT AUTHORIZED, NOT IMPLEMENTED, NOT APPLIED**. It does not grant permission to create a role/secret or run a hosted synthetic fixture.
