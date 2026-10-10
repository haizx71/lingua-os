# PILOT-READER Auth Erasure Remediation Plan

**Status:** Local reproduction and counterfactual proof complete; migration and hosted cleanup are not authorized by this plan. The existing 0021 migration remains frozen. Any production migration requires a separate bounded owner exception and independent review.

**Authoring runtime:** GPT-6 Luna, Max reasoning.

## Finding

The merged PILOT-READER hosted acceptance reached its mandatory cleanup gate, but the local runner reported only a generic finalization failure. A read-only provider aggregate for run `38044569136` confirmed three Auth deletion errors with SQLSTATE `23514`, all classified from the static known-message set as the Reader append-only guard; there were no foreign-key, permission, timeout, or deadlock errors. A separate cleanup job returned the fixed Auth-deletion failure. One current-run marked Auth identity remains. No raw provider error, identity, email, or learner row was selected or recorded in this plan.

The source cause is the shared `public.enforce_reader_history_append_only()` trigger function from migration 0005. It rejects every update/delete on `reader_exposure_concepts` and `reader_mutation_results`, and rejects deletes of fingerprinted `exposure_events`. A normal completed Reader segment creates these immutable rows, so the FK cascade from Auth identity deletion reaches the guard and aborts the transaction. Migration 0019 already establishes the narrower pattern needed for Auth-owned erasure: permit only a DELETE at trigger depth greater than one after the parent row in `auth.users` is absent. The current legacy branch for `exposure_events.request_fingerprint IS NULL` permits its existing update/delete behavior and must remain unchanged.

Relevant source: [0005 Reader history guard](../database/migrations/0005_reader_content_service_v1.up.sql#L533), [0019 Auth-erasure predicate](../database/migrations/0019_concept_save_intent_auth_erasure.up.sql#L6), and the accepted local cascade observation pattern in [test_profile_schema.py](../tests/backend/database/test_profile_schema.py#L255).

## Local evidence

The new regression is [test_pilot_reader_auth_erasure.py](../tests/backend/database/test_pilot_reader_auth_erasure.py). It forces loopback Docker PostgreSQL and overrides the shared database URL fixture, so it cannot connect to a hosted target.

It uses normal Owner Admin publication, Library Save, Reader exposure, and final-segment completion. On the current migration set it reproduces the `23514` Auth-delete failure and verifies transaction rollback. In a temporary candidate-function replacement inside the disposable test database, it proves:

- Direct UPDATE and DELETE of each of the three protected Reader row types still fail with the existing `23514` guard.
- Deleting `public.users` while the matching Auth identity remains is still rejected.
- The legacy NULL-fingerprint exposure row retains its current update/delete behavior.
- A local `supabase_auth_admin` Auth delete succeeds only through the cascade; observation triggers record depth greater than one and an absent Auth parent for all three affected Reader row types.
- The erased actor has no Auth identity and zero rows in all 27 inventoried learner tables, while a distinct Actor B has an identical full actor-scoped 27-table count/digest snapshot.
- A concurrent Reader-result insert waits behind Auth erasure and fails its FK check after the delete commits; it cannot leave an orphan.
- The already accepted Save-only Auth erasure under migration 0019 remains successful.

The candidate function is restored from `pg_get_functiondef` in a `finally` block. The test creates only ephemeral identities in its disposable local database; no hosted Auth actor, repository migration, hosted state, or production behavior was changed. Verification: `python -m pytest tests/backend/database/test_pilot_reader_auth_erasure.py -q` passed (1 test); `ruff check` and `ruff format --check` passed for the new test.

## Minimal migration proposal, pending owner exception

After the owner approves a specific exception to the 0021 freeze, add one versioned 0022 migration pair that replaces only `public.enforce_reader_history_append_only()` using the 0019 predicate. The reviewed forward function must:

1. Preserve the current NULL-fingerprint `exposure_events` branch byte-for-byte in behavior: legacy UPDATE returns `NEW`, legacy DELETE returns `OLD`.
2. Permit a DELETE only when `pg_catalog.pg_trigger_depth() > 1` and no matching row remains in `auth.users`.
3. Continue raising the same `23514` append-only error for every UPDATE and every other DELETE.
4. Use `SECURITY INVOKER`, a fixed `pg_catalog` search path, and a schema-qualified `auth.users` lookup.

The migration must not change trigger bindings, tables, constraints, RLS, grants, roles, cleanup predicates, or K2 wave code/constants. Its down migration must restore the exact migration-0005 guard body. Direct row mutation and deletion of the `public.users` parent while Auth still exists must remain rejected. No disable-trigger, soft-delete, skip-completion, or permission-broadening workaround is acceptable.

## Hosted runner and migration-head gate

The shared `_migration_head` currently requires application migrations 0001–0021 and the exact existing Supabase platform migration tail. Do not relax it to “at least 0021” or accept arbitrary later versions. Before any PILOT actor is created, a reviewed PILOT-specific head check must require the exact application version 0022, exact migration name and recorded checksum in `public.schema_migrations`, and the unchanged known 0001–0021 application chain. The existing read-only role can select the application checksum; this needs no new grant. It must also verify the complete approved Supabase platform registry prior chain plus the single expected new platform-registry version/name entry. The platform registry exposes version and name, not a checksum; do not claim or infer a platform checksum. Pin the expected application 0022 name/checksum and platform-registry entry from the reviewed migration/application record before promotion. Placeholders and runtime recapture are invalid.

Keep K2 wave 0014–0021 expectations unchanged. If generic janitor recovery needs to run against either the pre-fix or fixed head, give it an explicit finite accepted set: the current exact 0021 application metadata/platform registry, or the reviewed exact 0022 application metadata and approved platform registry. Do not teach the runtime to accept or learn an arbitrary head. Unknown versions, a changed application checksum/name, a missing/extra registry row, or platform-registry drift must fail closed. Add local probe tests for the exact 0022 application checksum and platform-registry prior-chain-plus-new-entry acceptance and for changed, missing, duplicate, or unknown head metadata; retain the existing K2 0021 guards and regression coverage.

## Recovery sequence after separate approval and promotion

1. Obtain the explicit owner exception for the function-only 0022 pair; complete independent SQL/security review and local PostgreSQL tests before merge or hosted apply.
2. Confirm exact-head CI, migration application, the 0022 application version/name/checksum, and the approved platform-registry prior chain plus new entry before invoking any cleanup worker. Do not run K2 waves or create another Auth actor.
3. Before reading or deleting learner rows, use the trusted Supabase Admin control plane to freshly enumerate the current run's candidate and re-fetch its exact Auth ID. Require exactly one unambiguous current-run actor whose server-owned `app_metadata` key `lingua_k2_hosted_acceptance` has the exact reviewed key set and matches repository, environment, workflow, workflow ref, project ref, run ID, run attempt, version, creation time, and expiry. Its Auth ID and reserved email must match each other and the exact reserved address format (`k2ha-<run>-<attempt>-<16 lowercase hex>@example.invalid`). Ignore user-editable `user_metadata`; a matching email prefix by itself is never ownership proof. A missing, changed, stale, malformed, duplicated, or mismatched mark/address/ID, any additional ambiguous marked actor, or any unmarked reserved address stops recovery without exclusion or deletion.
4. After that Admin verification, pass the verified Auth UUID only in memory to a bounded minimum custom read-only probe. Capture a fresh global retained snapshot over the complete 27-table inventory, excluding rows owned by exactly that verified actor and no other identity. Compute the same per-table row counts and full serialized-row digests used by the accepted retained-state proof. Do not persist the UUID, email, or raw rows, and do not use application Auth access or add database grants. An empty/malformed inventory or any broader exclusion fails closed. This requires a future bounded probe/client extension; it is not implemented here.
5. Run the existing guarded Auth cleanup for that verified actor only; do not add a prefix sweep or weaken janitor ownership checks. Then independently require (a) the exact Auth ID is absent through the Admin control plane, (b) the same actor has zero rows in all 27 learner tables, and (c) a second global 27-table snapshot excluding that same in-memory UUID has exactly the same per-table counts and digests as the pre-cleanup snapshot. All three proofs must pass before releasing the current-run lock or allowing any later actor creation. A mismatch, extra row, absent/malformed inventory, or changed mark/ID/address fails closed.
6. Add local probe/helper regressions proving that ordinary fake `user_metadata` or a reserved-looking email prefix cannot be excluded, changed ownership marks and mismatched IDs/addresses are rejected, and cleanup of the exact marked actor preserves every non-actor table digest. The expected future scope is limited to the pilot/cleanup path in `k2_hosted_actors.ts`, `pilot_reader_hosted_runner.ts`, `k2_hosted_probe.py`, `k2_hosted_probe_client.ts`, and focused unit/real-local-PostgreSQL tests. These future tests and probe support are not implemented by this plan.
7. The current failed run's original pre-actor retained baseline is unavailable. The recovery-time before/after comparison can prove that this cleanup preserved all other rows, but cannot retroactively establish the failed run's original retained-state equality or make that run a successful acceptance. After successful residue recovery, a new authorized acceptance must independently verify no reserved actors and capture a fresh baseline before creating actors. Do not fabricate equality or reset learner data.
8. Preserve sanitized, fixed-category failure reporting so an Auth-delete failure remains distinguishable from zero-residue and retained-state comparison failures, without exposing raw provider errors, identities, emails, SQL, or learner rows. Any diagnostic change needs separate review and must not alter cleanup behavior.

## Current boundary

This is a design and local-proof artifact only. No 0022 migration has been written or applied, no hosted deletion/retry was performed, and the remaining marked Auth identity is still under the root-owned cleanup lock. The next step is independent review of this plan and the two-file local regression, followed by the owner's precise 0021-freeze exception decision.
