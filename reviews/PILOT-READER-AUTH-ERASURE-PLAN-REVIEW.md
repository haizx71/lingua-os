# PILOT-READER Auth Erasure Plan Review

**Date:** 2026-10-10 (Asia/Saigon)
**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable)
**Current verdict:** **PASS for the exact revised plan below; no open HIGH/BLOCKER.** This is a plan review only and does not authorize migration, cleanup retry, hosted activity, or a new actor.
**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).

The initial plan review found a HIGH gap. The revised frozen plan closes it by requiring a strictly reverified actor-only exclusion baseline before cleanup, an exact post-cleanup retained comparison, separate Auth absence and 27-table zero-residue proofs, and a new baseline for any later acceptance. See the historical finding and exact-pin re-review below.

## Frozen scope and source pins

Reviewed the local integration snapshot at merged source baseline `c76d72d7cfc67f5060d233f68df971fc338ab0ff`. The initial frozen plan and unchanged test copied into that worktree matched these hashes:

- `plans/PILOT-READER-AUTH-ERASURE.md` — SHA-256 `86d845f2b5b0c39a7aaf3955d44ef82fcd9d05d76b07111fd5999eaa696d8eff`.
- `tests/backend/database/test_pilot_reader_auth_erasure.py` — SHA-256 `bf5f161b573758a0a027ca1777f5346651826d56a4f6603cf94e4ac62d8d9ca4`.

Relevant accepted source reviewed:

- `database/migrations/0005_reader_content_service_v1.up.sql` — SHA-256 `4a4167b81a53636dd7881c6994fbd2760aee2bb3824f4bd8f72a868a13cc4f2d`.
- `database/migrations/0018_profile_replay_auth_erasure.up.sql` — SHA-256 `6c385087d1cc3645765a8e384c1235c4e2754d8aa5ad2872056e5127983e48ac`.
- `database/migrations/0019_concept_save_intent_auth_erasure.up.sql` — SHA-256 `eaf480c3ad6347f88972eca9b8fb46e5026794b6a5f58fa32a23e64486e78793`.
- `reviews/K2-06-profile-replay-erasure-design-review.md` — SHA-256 `af1051ee67cea24674908643aaf55ca5c35a1efc07e2f37ec2a2784b3ba95bfb`.
- `tests/acceptance/support/k2_hosted_probe.py` — SHA-256 `3b2154fdd4516ecf1cda9f866b63741ced2e341204bb56141a2d5b249f57337e`.
- `tests/acceptance/support/k2_hosted_actors.ts` — SHA-256 `147cbdfcbefc9f675f8d5b3fbeb9082a6fbbb0457392c35b362b6cf8fff50f65`.
- `tests/acceptance/support/test_k2_hosted_probe.py` — SHA-256 `505ec5ad30dc8cc4646652ecbb3c207dfaabc0abd469138cb1dcb491dcee9e00`.
- `database/migrate.py` — SHA-256 `ceb1ef221d9de9d41cd581034b69116dc920cd36c72670b5c825a49e546627e3`.
- `database/staging/20260928_k2_hosted_acceptance_reader.sql` — SHA-256 `b7d5727535d4d45dc1247c2376ea686cfabcd78a5ba07125d15e4c5601026218`.

The project status, task board, pilot findings, and hosted-harness failure addendum were also checked. They consistently report hosted run `38044569136` as failed, one same-run marked Auth identity still present, the primary flow result as unknown, and the 27-table zero-residue and post-cleanup retained comparison as unproven. The separate pre-acceptance publication comparison is correctly kept distinct.

## Local verification and predicate assessment

The module-local `postgres_url` fixture starts a uniquely named Docker PostgreSQL container published only on `127.0.0.1`, ignores `TEST_DATABASE_URL`, and removes its own container in `finally`. Its isolated migrated database is dropped after the test. The test installs its counterfactual function only in that disposable database and restores the exact `pg_get_functiondef` in `finally`.

Independent focused run:

```text
python -m pytest tests/backend/database/test_pilot_reader_auth_erasure.py -q
1 passed in 9.88s
```

The test reproduces the existing `23514` cascade rollback, then checks the bounded candidate against normal local Owner Admin, Library Save, Reader exposure, and final-segment completion paths. It checks direct UPDATE/DELETE rejection for the three guarded row types; deletion of `public.users` while Auth remains; preservation of legacy NULL-fingerprint exposure behavior; nested trigger depth and absent Auth parent for all three Reader row types; actor-row zero across the 27-table inventory; the distinct actor’s full 27-table snapshot; the existing 0019 Save-only control; and the insert/Auth-delete race ending in FK `23503`. The candidate test checks the existing Auth-owner privilege shape, including no `DELETE public.users` privilege. This is local regression evidence only; it is not hosted cleanup evidence or migration verification.

The proposed function change is narrow and consistent with the accepted 0018/0019 design: explicit `SECURITY INVOKER`, fixed `search_path = pg_catalog`, schema-qualified `auth.users`, and an allowance only for nested `DELETE` after the Auth parent is absent. UPDATE and other DELETE operations retain the same `23514` guard. The legacy `exposure_events.request_fingerprint IS NULL` branch remains unchanged in behavior. The proposal changes no trigger bindings, tables, constraints, RLS, grants, roles, cleanup predicates, or K2 semantics; the down migration is required to restore the exact 0005 guard. No 0022 migration exists in this reviewed snapshot.

## Historical HIGH in the initial plan — resolved in the frozen revision

**Initial plan SHA-256:** `86d845f2b5b0c39a7aaf3955d44ef82fcd9d05d76b07111fd5999eaa696d8eff`.

The plan correctly says the failed run’s original pre-actor retained baseline is unavailable, forbids fabricating an equality result or retroactively passing that run, and requires a fresh baseline before a later acceptance actor. However, the ordered recovery sequence permits deleting the remaining marked Auth actor before taking a replacement retained-state baseline. The later acceptance baseline cannot show whether the recovery cascade changed any other retained learner rows.

Before any recovery deletion, add a bounded comparison step:

1. Re-read and strictly revalidate the single current-run ownership mark and exact actor identity under the existing guarded cleanup rules. Stop on ambiguity, an unexpected marked/reserved actor, or an ownership mismatch.
2. Capture a fresh retained-state snapshot immediately before deletion. For the retained subset, exclude only rows belonging to that exact reverified actor; do not filter or exclude any other actor or learner. Keep IDs and row data private. This snapshot is a cleanup-window baseline, not a substitute for the unavailable original run baseline.
3. Use only the existing guarded Auth deletion path for that exact actor. Then independently prove Auth absence and zero rows across all 27 actor-owned tables, and compare the retained snapshot against the same post-cleanup projection.
4. Keep the run failed and the promotion hold in place. Any missing or unequal evidence keeps the mutation lock closed and forbids a new actor. Only a later separately authorized acceptance may take its own genuine pre-actor baseline.

The earlier publication-time snapshot could not replace this cleanup-window baseline. This gap mattered because Auth deletion is irreversible and the accepted learner-state-preservation invariant requires evidence that non-target retained state did not change during recovery. The revised plan now addresses this step as documented below.

## Migration-head and recovery gates

The current `_migration_head` is intentionally exact at application versions `0001`–`0021`; K2 acceptance expectations must remain there. The platform migration registry is a separate ledger. Current code reads its `(version, name)` fields, requires the exact existing four-entry tail ending in `k2_09_hosted_fixture_control_0021`, and rejects an unexpected tail. A normal Supabase migration apply may append a platform-ledger row for 0022, so the future PILOT/cleanup check must not assume the old tail stays at the end. It must require the exact previously approved platform prefix plus exactly one pinned 0022 `(version, name)` entry from the reviewed migration/apply artifact. If the apply path assigns the platform version only at apply time, pin and review the read-back pair and exact-head CI before any actor; the acceptance runtime must never learn an unknown head. The application ledger is independently checked through exact `0001`–`0021` version/name/checksum rows plus the approved 0022 version/name/checksum. The current role can read the application `public.schema_migrations` table and its checksum; platform-ledger access remains limited to approved version/name fields, with no new grant. K2 probe and K2 acceptance must continue requiring their exact `0021` application and platform metadata and must not run under the PILOT 0022 head. Current source rejects unknown application versions and unexpected platform-tail entries; no `>=0021`, arbitrary later version, or unknown-head fallback is acceptable.

The application migration runner records `(version, name, checksum)` in `public.schema_migrations`; the staging read-only role has table-level SELECT on that application table, so the checksum is available without broadening Auth access. The Supabase platform ledger is separately restricted to its approved version/name fields. Future local probe tests must cover exact 0022 acceptance, changed name/checksum rejection, extra/unknown application heads, exact 0022 platform-entry acceptance, missing/changed/extra platform entries, and continued K2 0021 behavior. Generic recovery may accept only the finite exact 0021 or reviewed 0022 metadata sets. Verify those checks run before any actor creation and that cleanup recovery remains bound to the exact marked run identity, followed by Auth absence and 27-table zero-residue proof before a new actor can exist.

## Limits and disposition

No hosted actor, learner session, remote database, cloud state, secret, migration, or runtime source was changed. No hosted proof is claimed. The single local focused regression is the only test independently run for this review; shared-helper compatibility tests and migration up/down checks remain future implementation gates.

The local candidate predicate is suitable for a separately authorized, independently reviewed 0022 implementation, subject to exact migration/probe implementation review. The initial plan was not ready for cleanup or owner-exception approval; the exact revised plan receives the PASS below. Migration `0021` remains frozen. This review does not authorize writing or applying `0022`, retrying cleanup, changing Auth privileges, or creating actors.

## Exact-pin re-review — PASS

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).
**Revised plan SHA-256:** `2fda76146f80d8b20ed72af64f3839491e9fc7d59c394275b08c2406f6fbc04c`.
**Unchanged local test SHA-256:** `bf5f161b573758a0a027ca1777f5346651826d56a4f6603cf94e4ac62d8d9ca4`.
**Verdict:** **PASS for this exact plan revision; 0 open HIGH/BLOCKER.** The previous HIGH is resolved. No migration, cleanup, or hosted run is authorized by this result.

The revised recovery sequence now places strict Supabase Admin re-enumeration and exact Auth-ID re-fetch before any learner-row read. It requires the server-owned marker’s exact key set and target metadata, exact reserved address/ID consistency, and fail-closed handling for malformed, changed, duplicate, unmarked-reserved, or otherwise ambiguous candidates. Only the verified Auth UUID may be held in memory for the bounded read-only probe. The cleanup-window baseline covers the full 27-table inventory and excludes only rows owned by that exact reverified actor; no learner or other actor may be excluded. After the existing guarded Auth deletion, the plan independently requires Auth absence, zero target rows over all 27 tables, and exact equality of the same global retained counts and full serialized-row digests before releasing the lock or allowing another actor. A new separately authorized acceptance takes its own fresh baseline before actor creation. The failed run remains failed; the recovery comparison cannot retroactively establish its unavailable original baseline.

The new-step exclusion tests cover attempts to forge user-editable metadata or rely on a reserved-address prefix, mismatched ownership IDs/addresses, stale or changed marks, and broader exclusions. The planned equal-before/after proof is separate from the 27-table zero-row proof. The test remains explicitly local and ephemeral; because its frozen hash is unchanged, the prior independent run (`1 passed in 9.88s`) remains applicable and was not repeated.

The revised migration-head language also closes the platform-ledger ambiguity. It distinguishes the application ledger (`0001`–`0022` exact name/checksum) from the Supabase platform ledger (approved prior chain plus exactly one pinned 0022 `(version, name)` entry; no platform checksum claim). K2 remains on its exact 0021 head, and generic cleanup accepts only finite exact 0021 or reviewed 0022 metadata. If the platform assigns the new version only during apply, the safe sequence is a migration-only apply/readback, pin and review that exact pair in source, then exact-head CI and all head checks before any actor. The acceptance runtime must never learn an unknown head. This does not require new Auth/database grants.

**Bounded retry compatibility test for implementation:** preserve the existing cleanup rule for the original marked attempt under a retry of the same immutable workflow run. The original run’s attempt 1 marker may be cleaned by retry attempt 2 only when the exact same run ID and every other ownership field are reverified, its marker attempt matches its reserved address, and `marked attempt <= executor attempt`. A different run ID, future attempt, mismatched marker/address/ID, extra candidate, or unmarked reserved address must stop before exclusion or deletion. This preserves exact actor targeting without a prefix sweep or wider recovery. It is an implementation test requirement, not an open plan blocker.

The local predicate review remains bounded to the supplied test and accepted 0005/0018/0019 source. The actual 0022 SQL pair, its down/up behavior, new probe/helper implementation, exact-head tests, and any later hosted recovery require their own review and verification. The project status and prior failure addendum remain accurate: one marked Auth identity is still present, hosted Auth absence failed, and 27-table zero-residue/retained equality are unproven. No hosted PASS or learner-outcome claim is added here.
