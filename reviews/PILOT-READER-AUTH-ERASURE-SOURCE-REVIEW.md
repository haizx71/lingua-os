# PILOT-READER Auth Erasure Source Review

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).
**Current status:** Independent PASS for the exact final 24-path runtime source v2 and a separate static PASS for the exact migration-only wrapper v2; no open HIGH/BLOCKER source findings. The v1 wrapper HIGH is preserved historically and closed by v2. Hosted apply, actor cleanup, Auth absence, zero-27, and post-cleanup retained equality are not claimed by this source review. The platform 0022 version remains unset/fail-closed in the reviewed source.
**Current owner authorization:** The exact bounded function-only 0022 exception is owner-approved in the current plan; it does not authorize any widening beyond that scope.

## Current authoritative plan and preserved plan review

- Current plan/status checkpoint: plans/PILOT-READER-AUTH-ERASURE.md, SHA-256 d0b71189cd9f7acd4e1950353974d8ef9aba6b06b93eb1315754d61da4fab1d4. Its technical design body and owner authorization remain tied to the reviewed body SHA-256 2fda76146f80d8b20ed72af64f3839491e9fc7d59c394275b08c2406f6fbc04c; its 2026-10-11 checkpoint predates final helper v2, so the exact final-source verdict below supersedes that earlier HIGH-underway checkpoint note.
- Preserved plan-review record: `reviews/PILOT-READER-AUTH-ERASURE-PLAN-REVIEW.md`, SHA-256 `b200291503013806c7655f0d2fcf48bc3454a9d97db288e27dccd2ef6d7896a2`. Its PASS remains pinned to prior plan SHA `2fda76146f80d8b20ed72af64f3839491e9fc7d59c394275b08c2406f6fbc04c`; it is not represented as a review of the newly owner-authorized plan.
- Root-captured current migration ledger baseline: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-auth-erasure-migration-baseline.json`, SHA-256 `58318b5402d3105d868ef5e57161a05757910097b01c284c951345ffafb5b65c`: 21 application entries through 0021 and 14 platform entries through the 0021 platform record. This reviewer read the artifact; no hosted query was performed.
- Root-captured pre-0022 function/trigger metadata: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-auth-erasure-function-baseline.json`, SHA-256 `0e6c9f55ecff10b1a557ade9b6ecccca320376c849e98e9aa696fdc9461cb757`. The supplied metadata pins the existing `postgres` owner, exact function ACL, three Reader trigger bindings, and pre-state function configuration. No hosted query was performed by this reviewer.

## Historical partial SQL checkpoint v2 — MEDIUM found, later fixed

Implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-auth-erasure-sql-checkpoint-v2.md`, SHA-256 `ab99d430ec60b9a020fc14a4e607d9135d21f0bb185a5944494d686294939f8b`. Packet base: `799940b4824a453c545d6226743ec8bb0692fccc`.

Verified raw source hashes in the implementation worktree:

- `database/migrations/0022_reader_history_auth_erasure.up.sql` — `2973634737657845fdc4b7c04697e30611c3b868f73460990bbec6e9f41d140a`.
- `database/migrations/0022_reader_history_auth_erasure.down.sql` — `413e2043b4c11912640c75c88803dcb77b891d72c9cec957a07936d3795fc3cb`.
- `tests/backend/database/test_pilot_reader_auth_erasure.py` — `b0ccce3b1fa8bde4461f379c5e2992416ef58e65757681f6875fe6d2db66280a`.
- `tests/backend/database/test_k2_09_hosted_fixture_migration.py` — `599538e664cdfcf86a1cec19128a8e9cd1b63b3072337ce773f7687586ae1326`.
- `tests/backend/database/test_k210_database_verification.py` — `28f9c23328083975f20f82d6800d839134c13a99cf42760544026f405b990493`.
- Discovered application migration identity in the packet: `0022_reader_history_auth_erasure`, checksum `1924d92b88e9f20ed1264850830a4f8f4794dad21f07a79d0a9b284b482ac858`.

### SQL source assessment

For these exact v2 SQL hashes, the forward migration replaces only `public.enforce_reader_history_append_only()`. The function remains `SECURITY INVOKER`, uses a fixed `pg_catalog` search path, schema-qualifies `auth.users`, and allows a DELETE only when trigger depth is greater than one and the Auth parent is absent. The existing legacy exposure-event `NULL` fingerprint branch is retained. UPDATEs and direct DELETEs continue to raise the fixed append-only error with SQLSTATE `23514`.

The paired down migration restores the 0005 guard body. `CREATE OR REPLACE` does not change function ownership/ACL or trigger bindings; the local regression snapshots owner, ACL, security mode and trigger definitions/bindings across apply, checks restoration of the pre-0022 function definition after rollback, and checks that the current migration head remains 0021. The source contains no trigger, FK, table, RLS, role, grant, API or learning-rule change. The SQL-only assessment for these exact hashes is PASS.

The focused tests explicitly start at migration 0021, reproduce the existing cascade failure, apply the real 0022 pair, test direct UPDATE/DELETE and active-parent rejection, retain the legacy NULL-fingerprint branch, exercise the trusted Auth cascade and per-row trigger depth/parent absence across all three Reader fact types, verify Auth absence and zero actor rows, compare Actor B’s 27-table snapshot, test the insert/delete FK race, detect checksum mismatch, and check down/up/reapply. The K2-09 cases now pin their fixture at exact 0021; the K2-10 migration regression copies only migration 0021 into its prefix. These are local regression changes, not hosted K2 re-runs.

### Independent verification and finding

The packet reports `9 passed in 26.04s` on loopback disposable PostgreSQL, plus Ruff and diff checks. That worker-reported result is not an independent PASS.

This reviewer ran the packet’s exact focused command:

```text
python -m pytest -q tests/backend/database/test_pilot_reader_auth_erasure.py tests/backend/database/test_k2_09_hosted_fixture_migration.py tests/backend/database/test_k210_database_verification.py::test_0020_to_0021_preserves_reader_catalog_and_nonempty_learner_state
```

Independent result: `9 errors` during fixture setup because Docker could not start the loopback disposable PostgreSQL container. The runtime was unavailable; no retry was attempted. During this failure, pytest output still rendered the pilot fixture’s generated local database password inside the Docker command arguments, despite its `pytest.fail(..., pytrace=False)` handling.

**Historical MEDIUM — test failure output exposed a generated local database password.** The password was ephemeral and only intended for the loopback disposable test database, but the exception context reached pytest output and violated the fixed-safe diagnostic requirement. The observed value is intentionally omitted. This finding was resolved for the v3 frozen test pin below; it is not open against v3. It was not a production Auth credential or hosted-data exposure.

## Frozen partial SQL/test checkpoint v3 — PASS for this limited slice

Implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-auth-erasure-sql-checkpoint-v3.md`, SHA-256 `8177467bb004b82a9354e4131114b2d53f3634b3dfa96f08259866abb6e41f5b`.

The two SQL migration hashes and discovered 0022 checksum are unchanged from v2. The frozen test pins are:

- `tests/backend/database/test_pilot_reader_auth_erasure.py` — SHA-256 `be2e37aaec1faab08269fcd06f09c99a942f677e06ec322dbf837458b2f745b8`.
- `tests/backend/database/test_pilot_reader_retained_snapshot.py` — SHA-256 `5340e6fb0a4fcabcd550eef7a229381c7f0ed7d3b1a40d1421015d781b1ebce6`.
- `tests/backend/database/test_k2_09_hosted_fixture_migration.py` — SHA-256 `599538e664cdfcf86a1cec19128a8e9cd1b63b3072337ce773f7687586ae1326`.
- `tests/backend/database/test_k210_database_verification.py` — SHA-256 `28f9c23328083975f20f82d6800d839134c13a99cf42760544026f405b990493`.
- `tests/backend/database/test_profile_schema.py` — SHA-256 `7496d32ca79e04bcf88ec7059edafe80dc1c8f2c9bc845946a399e31ac8cc619`.
- `tests/backend/database/test_assessment_api.py` — SHA-256 `a01fdc1ca6213af4f36e49fb1efc53b551c18c9ea38d822e85820c5487f3ecf5`.

The v3 redaction helper catches Docker exceptions and returns only a fixed-safe failure path; the new sentinel regression passes and asserts the sentinel is absent from the returned value. The retained-snapshot fixture uses the same catch-and-discard pattern. Its probe test asserts exact-actor exclusion uses `IS DISTINCT FROM`, which preserves NULL-owner rows, and checks that snapshots do not serialize the target UUID. The real-database retained-snapshot test verifies exact table set, target-only exclusion, Auth-cascade cleanup, before/after equality, and detection of a later unrelated actor row. The helper exercised by these tests was pinned during this run as `tests/acceptance/support/k2_hosted_probe.py` SHA-256 `826cb723a44537f44f345bc89f17d36ece3e9c49ed65fe6c13276f41c7037b40` and `k2_hosted_probe_client.ts` SHA-256 `21149884f52552f7d5760e9664619d05289ae1bb3b8febfd2ea2a901ebf593f7`; both were identical before and after the test run. These support files are not part of this partial packet’s frozen source set and are not source-reviewed here.

Independent verification:

- Confirmed `TEST_DATABASE_URL` was unset and Docker Server `29.8.1` was local before the run.
- Ran the exact v3 focused command from the packet; result: `14 passed in 32.73s`.
- Independently ran Ruff check and format check for all six packet test files; both passed.
- The worker packet reports the same focused suite at `14 passed in 35.60s`; the independent local result above is separate.

For these exact v3 SQL hashes, the source-only function assessment from v2 remains valid: only the Reader append-only guard changes, the trusted Auth cascade is narrowly allowed after parent absence, direct UPDATE/DELETE remain guarded, and the legacy `NULL`-fingerprint exposure behavior stays intact. The migration regression passes owner/ACL and trigger-binding preservation, SQLSTATE, rollback, exact checksum, down restoration, reapply, and local race checks. K2-09, K2-10, profile and assessment tests retain their exact migration-prefix expectations; these are local compatibility regressions, not K2 hosted reruns.

**Partial v3 verdict:** PASS for the pinned SQL migration pair and focused database regression slice; 0 open HIGH/BLOCKER findings in this slice. The v2 MEDIUM failure-log finding is closed for v3. This does not constitute an overall source PASS.

## Scope still pending

The v3 PASS is only for the SQL/test slice. The recovery runner, final probe/client changes, exact target-run versus trusted-executor separation, strict Admin marker revalidation, NULL-preserving exact-actor 27-table exclusion across the complete final runner path, before/after retained equality, Auth absence/zero27, fail-closed finalization/crash behavior, workflow permissions, existing janitor ordering, and exact application/platform 0022 head sets have not been reviewed in a final frozen source packet. The later migration-only apply gate also needs the exact approved platform pin and fresh global 27-table pre/post comparison with no actor exclusion before any cleanup; it is separate from the later exact-actor recovery comparison. The platform 0022 registry version remains unavailable until the separately authorized migration-only apply/readback; no actor path may accept an unknown/unpinned value.

No implementation source, Git, hosted database, Auth actor, secret or learner row was changed by this reviewer. The independent test run used only loopback disposable PostgreSQL; hosted cleanup, Auth absence, zero27 and retained-state results remain unproven. Preserve the v2 error and finding as historical evidence; the v3 tests close the test-output issue only for their frozen paths.

## Historical frozen migration-only apply wrapper v1 — HIGH finding; superseded by v2

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).

Wrapper packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-0022-apply-wrapper-packet.md`, SHA-256 `a26881fc98d6c14ae1c1d947c07ca37e38405ff163c9d0c525a21ea708306399`.

Frozen wrapper: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-0022-supabase-apply-wrapper.sql`, SHA-256 `4489c6c16e9984029d1b299327e728e24d6d087763154f3fd8ce9837ae0996d6`. Local proof: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-0022-apply-wrapper-proof.json`, SHA-256 `714cf12e69883f6f28931c1620b91bf400785ed1d457c81ea8e3e6997a672c9f`.

### Bounded wrapper assessment

The wrapper opens one transaction, uses the same advisory-lock key as `database/migrate.py`, applies bounded lock and statement timeouts, and rejects a non-exact 21-row application or 14-row platform pre-state. It also pins the pre-function definition, owner, ACL, invoker mode, language, return type and search path, plus the three trigger definitions/bindings. It copies the exact frozen up SQL, inserts one application registry row, and checks the function identity/body/metadata, trigger bindings, 22-row application ledger and unchanged 14-row platform ledger before commit. No Auth, learner-data, platform-ledger, role, grant, RLS, FK or trigger write appears in the wrapper. The packet’s nine local cases report transaction rollback on injected registry failure and unchanged Auth/Reader fixture digests; that worker-reported proof does not override the production identity mismatch below.

The wrapper deliberately does not guess or create a provider-owned platform 0022 row. Its exact 14-row platform guard fails closed if a provider inserts a row before wrapper execution. The packet identifies that ordering and the final provider-assigned version as unverified, and requires a separate readback/pin before recovery. No hosted apply or provider transaction behavior is claimed in this review.

### HIGH — application migration ledger records the wrong migration name

The frozen wrapper inserts application ledger name `0022_reader_history_auth_erasure` and uses the same prefixed name in its exact post-state JSON. The production migration loader parses the four-digit version separately from the filename suffix: `database/migrate.py` defines `(?P<version>\d{4})_(?P<name>...)`, then constructs `Migration.name` from the suffix capture. For `database/migrations/0022_reader_history_auth_erasure.up.sql`, the required application ledger name is therefore `reader_history_auth_erasure`.

Independent reproduction from the implementation worktree ran `python -c "from database.migrate import discover_migrations; print([(m.version, m.name, m.checksum) for m in discover_migrations() if m.version == '0022'])"` against the actual migration pair and returned version `0022`, name `reader_history_auth_erasure`, and checksum `1924d92b88e9f20ed1264850830a4f8f4794dad21f07a79d0a9b284b482ac858`. The frozen Reader probe’s exact expected application tuple at `tests/acceptance/support/k2_hosted_probe.py:424` and the migration regression’s discovered-name/recorded-row assertion at `tests/backend/database/test_pilot_reader_auth_erasure.py:334–344` independently expect that same unprefixed name.

If this wrapper committed, `database.migrate.migrate_up()` would compare the stored `(name, checksum)` to the discovered migration at lines 134–140 and raise `MigrationChecksumError` because the ledger name differs. The Reader probe’s exact migration-head comparison would also reject the post-state. The wrapper proof script hardcodes the same prefixed name into its insert and generated expected post-ledger, so its nine local cases do not detect the mismatch with production discovery. The packet reports those nine cases PASS; this reviewer did not rerun the wrapper PostgreSQL proof because the independent production-loader comparison already disproves the wrapper’s expected post-state. This is a persistent application-ledger divergence and blocks this wrapper from being applied.

**Required closure:** use the discovered suffix name `reader_history_auth_erasure` consistently in the wrapper insert and expected post-ledger; make the wrapper regression derive/assert the expected name against `discover_migrations()` or an equally direct production-source assertion; rerun the bounded local wrapper proof and issue new immutable wrapper/proof hashes. Do not apply SHA `4489c6…`.

This finding is limited to the frozen local apply wrapper and its local proof harness. It does not establish that 0022 was applied: no hosted operation was performed by this reviewer. The v3 SQL/test PASS remains valid for its exact scope; the overall erasure source review and the separate hosted recovery proof remain pending.

## Final runtime source v2 — independent PASS for exact frozen 24-path set

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).

Final implementation packet: C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-auth-erasure-runtime-final-packet-v2.md, SHA-256 4fdb63325ddbdeb394af37015bdd4308b26a560c4537635d467738094760700e. Its raw manifest aggregate is 17efcbd3da7be80d66b4873cee213563169a19437dee72758b74f139a94048fd. I independently recomputed every path hash against C:\Users\pc\.codex\worktrees\pilot-reader-auth-erasure\LINGUA_OS_PROJECT_STARTER: all 24 matched, and the ordinal-path/UTF-8-LF aggregate matched the packet. This verification was repeated after focused tests.

The final packet reports 161 focused Vitest passes with one optional skip, TypeScript, focused ESLint, probe pytest, Ruff, formatting and diff checks. Independent verification on this exact freeze:

- Ran the five focused TypeScript suites from the packet; result: 5 files passed, 161 passed, 1 skipped.
- Ran pnpm exec tsc --noEmit -p tsconfig.k2-harness.json; passed.
- The actor-only suite independently passed 114/114, including the new two-target cleanup failure matrix.
- Read-only production migration discovery returned exactly 0022 / reader_history_auth_erasure / 1924d92b88e9f20ed1264850830a4f8f4794dad21f07a79d0a9b284b482ac858; the frozen up SQL bytes are present unchanged inside wrapper v2.
- The independently run v3 disposable-PostgreSQL regression slice remains the separate exact-pin result recorded above: 14 passed. No hosted database was used.

### Historical HIGH closure: crash fallback now attempts every safely processable target

The earlier independent HIGH finding was real against the prior mutable/frozen bytes: recoverCurrentPilotReaderRunActors stopped at the first actor’s re-fetch, retained-baseline, deletion, or post-proof error, so a second already-validated disposable actor could be skipped. The exact v2 helper pin is tests/acceptance/support/k2_hosted_actors.ts SHA-256 ebab0e57d3987a6394854a3d33d16b92372a0d8e155c34cd890a41a354e288c8; its test pin is tests/acceptance/support/k2_hosted_actors.test.ts SHA-256 f55386326ad3f2c8ea186e68472d3dc3e2581d266a98b1dcec0226fd40d2ee77.

For these bytes, recovery enumerates and validates the complete bounded same-run candidate set before mutation, then accumulates only fixed stage labels. A target is not deleted unless its fresh Auth refetch matches exact ID, address, timestamps, server app_metadata mark and executor ownership and its target-excluding retained baseline succeeds. Once deletion is attempted, finally independently attempts Auth absence, 27-table actor-zero, retained after-snapshot and retained equality. A failure for actor A does not bypass actor B; the helper throws an aggregate failure after safe attempts, so there is no success/release on partial proof. It does not include IDs, provider errors or raw rows in its error.

The new two-target regression matrix injects actor A failures at exact Auth refetch, retained baseline, guarded deletion and actor-zero proof. It asserts actor B is cleaned and receives all three post-proofs, the overall operation fails, and diagnostic text contains neither actor ID. This closes the prior HIGH for the final v2 pins; the prior failing implementation remains historical evidence above.

### Target/executor separation, actor boundary and proof output

The special recovery job targets only server-marked run 38044569136, attempt 1, while requiring a distinct trusted owner-triggered executor on the fixed repository, master, exact workflow/workflow ref and staging project. The helper rejects use of the failed run itself as executor, scans the bounded Auth list for ambiguous/foreign marked or reserved identities, requires exactly one target, re-fetches and validates it, then captures its exact-actor-excluding baseline before guarded Today/Auth deletion. Tests cover the separate executor, exact target attempt, duplicate/mismatched/foreign candidate stops, and the all-post-proof finalizer. The separate automatic fallback uses the actual current executor run ID and accepts only its own marked attempts at or below the executor attempt, with no fixed failed-run substitution.

Server-owned ownership is accepted only from exact-key app_metadata; client user_metadata markers and malformed, future, mismatched, duplicate or unmarked reserved identities fail closed. The Admin client is used for actor lifecycle and Today-plan cleanup. Browser and API lifecycle assertions use each actor’s ordinary signed-in session. The probe client invokes Python with execFile and only the fixed script path in argv; actor UUIDs are passed through the child environment, not command arguments. The child environment is allowlisted, raw provider/child-process errors are suppressed, and snapshots return bounded per-table counts and digests rather than row contents or IDs.

The retained-state probe validates the complete 27-table inventory and read-only access before counting. It uses exact id/user_id ownership filters; recovery exclusion is IS DISTINCT FROM the one freshly revalidated target ID, preserving NULL-owner rows and all other learners. The result is counts plus SHA-256 digests only; parsing rejects incomplete tables or malformed counts/digests. Actor-zero probes require all 27 table counts and total rows to be zero. Recovery compares the target-excluding digest/count snapshot immediately before and after deletion. Normal acceptance separately captures a global baseline before actors and compares it after cleanup without exclusions.

### Exact 0022 gate, legacy K2 boundary and workflow

The PILOT migration probe requires the full exact 22-entry application ledger (including the discovered 0022 name/checksum) and exact 14 prior platform version/name pairs plus the one exact pinned 0022 platform name/version. PILOT_READER_EXPECTED_PLATFORM_0022_VERSION is deliberately None in this packet; the probe rejects unset, malformed, prefix-only or unexpected platform state before Auth/Admin cleanup. No runtime learns or accepts an unknown head. The existing K2 cleanup/janitor probe remains separately exact-0021 and its prior guards were not widened.

The dedicated reader-recovery workflow job is owner-only for workflow_dispatch on the exact repository/workflow ref and master; it verifies dispatch SHA against current master before staging secrets and has only contents: read (no OIDC id-token permission). It supplies only the already-authorized staging Admin, read-only DB and GitHub-token inputs needed for that bounded recovery. The existing unconditional current-run cleanup remains a separate acceptance finalizer; the PILOT branch performs the exact-0022 gate before constructing the Admin client. Current and fixed recovery both require Auth absence, actor-zero and retained equality before returning success. The old K2 scheduled janitor remains on exact 0021 and therefore fails closed after a 0022 head; no K2 permissions, workflow scope or cleanup semantics were broadened.

**Runtime source verdict:** PASS for exactly the final packet v2 24-path aggregate, with 0 open HIGH/BLOCKER findings. The earlier two-target crash-cleanup HIGH is closed for the hashes above. This is a source and local-test verdict only: the packet explicitly says no hosted migration apply or Auth deletion occurred. Because the 0022 platform version is unset, the reviewed source intentionally cannot perform PILOT cleanup yet. No Auth absence, 27-table zero-residue, hosted retained comparison, migration-window global comparison or learner UI result is claimed here.

## Separate migration-only wrapper v2 — independent static PASS; hosted behavior unverified

The v1 HIGH above concerned the wrapper’s ledger name. Wrapper v2 packet: C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-10-reader-0022-apply-wrapper-packet-v2.md, SHA-256 e499a178799e0375e44f958d6e34abe8498f2db60b241acdbe198477a9e92cc7. Exact SQL wrapper SHA-256: c99245596371c1bb452b3b3e58036e52251986f2ae52dd3c28dc196c7adc87bd; proof script SHA-256 a97e837e2170b1fe121e0fdb288187dbc50c303d09a28b2fc9f9361fa22084d4; machine-readable proof SHA-256 6ec1d5e51298a85d069544d73bb2ec6f368d4d23e803c385d792a1b6d561db7b.

Independent static checks confirmed the v2 insert and exact post-ledger use the discovered unprefixed reader_history_auth_erasure migration name; the frozen 0022 up SQL is embedded byte-for-byte. The wrapper takes the same advisory key as database/migrate.py, requires exact application 0021 and exact prior 14 platform pairs, pins the pre-function definition/owner/ACL/invoker/search path and three bindings, then replaces only the function and records one app row. It checks exact post-function metadata/body/bindings and unchanged platform ledger; the transaction contains no Auth, learner-row, role, grant, RLS, trigger, FK or platform-ledger write. The v1 ledger-name mismatch is therefore closed for this exact v2 wrapper.

The v2 packet/proof reports nine passing local loopback PostgreSQL cases, including name/checksum/extra-row fail-closed cases, rollback after injected registry failure and retry behavior. I reviewed the test source and proof pins; I did not rerun the artifact-generating proof script, so its nine-case result is worker-reported, not an independent rerun. No hosted operation was made by this reviewer. Whether the Supabase MCP execution path preserves this multi-statement transaction and how the provider orders its platform-ledger insert remain explicitly unverified. The exact 14-row wrapper precondition fails closed if the provider has already appended the platform row. Root’s migration-only global 27-table pre/post read-only comparison and provider readback/pinning are separate required evidence before any actor path; no platform version is inferred here.

## Final review boundary

This review changed only this review record. No implementation source, Git state, hosted database, Supabase Auth identity, secret, actor, or learner row was changed or queried by this reviewer. Local verification used focused tests and read-only migration discovery only. Preserve the earlier hosted run as FAIL; no cleanup or recovery PASS may be inferred from these source results.

## Staged-byte attestation — exact 24-path runtime set

On 2026-10-11, I independently compared the integration worktree's staged path set and Git blob bytes with the raw manifest in final runtime packet v2 (`2026-10-10-reader-auth-erasure-runtime-final-packet-v2.md`, SHA-256 `4fdb63325ddbdeb394af37015bdd4308b26a560c4537635d467738094760700e`). The staged set contains exactly the 24 manifest paths. Each staged blob SHA-256 matches its packet raw-file SHA-256; there are zero mismatches. All staged blobs are LF-only, and recomputing the ordinal-path/UTF-8-LF manifest aggregate yields `17efcbd3da7be80d66b4873cee213563169a19437dee72758b74f139a94048fd`.

Therefore the staged runtime bytes are identical to the reviewed raw source pins, including both 0022 migration files; no line-ending normalization or semantic source delta is present in the staged 24-path set. This is a local staged-byte attestation only and adds no hosted migration, Auth cleanup, learner-state, or acceptance evidence. The reviewer inspected staged blobs read-only and did not stage or commit files.


## CI gate fixture correction — independent PASS for exact 26-file snapshot

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).

Implementation packet: `2026-10-11-reader-auth-erasure-ci-gate-fix-packet-v1.md`, SHA-256 `5bdc888ce1b5daa102f8dd87ba50974c54b7e6530848e94074d258c7acde8835`. The frozen implementation tree is `C:\Users\pc\.codex\worktrees\pilot-reader-auth-erasure\LINGUA_OS_PROJECT_STARTER`. I independently verified all 26 raw file hashes and recomputed aggregate `fba4a30f502aa9a063a8a98247097f97314c971cc63d72ac050c20f8a311628d`; the preceding 24 runtime pins are byte-for-byte unchanged from aggregate `17efcbd3da7be80d66b4873cee213563169a19437dee72758b74f139a94048fd`.

The two delta pins are `scripts/verify_frll_database.py` SHA-256 `e2e4c1c41a44103d8588948bc33fcb923d1a999612ab849f44733e0f7c623839` and `tests/backend/database/test_k2_09_hosted_fixture_store.py` SHA-256 `ec70e713253ebe03ba2fe50871d047c8e31b9a9a6df970bffbde0f4261deab44`.

The FRLL verifier change only extends the canonical migration-name tuple and its documented range through `0022_reader_history_auth_erasure`. It retains `SET TRANSACTION READ ONLY`, ordered full `(version, name, checksum)` equality against `discover_migrations()`, required schema-table checks, the deterministic FRLL anchor checks, and the existing exact-zero learner-derived-table assertion. The bootstrap tooling test still requires `EXPECTED_MIGRATIONS` to equal every discovered migration name, so the 0022 entry cannot mask a missing or additional migration. The learner-table list and verification logic are unchanged.

The K2-09 fixture-store test change pins all 13 previously database-backed test functions to the existing `isolated_postgres_at_migration("0021")` fixture. Comparing the base and frozen test ASTs shows the same 20 test functions; all 13 prior latest-schema database tests map to the same 13 test names with an explicit 0021 boundary, with no deleted tests or skip markers. The fixture copies only migrations through the requested four-digit version and asserts the applied prefix ends there. The production K2 fixture-store file is unchanged from the packet base and continues to reject any application migration head other than exact `0021`; no production guard was weakened.

Independent verification on the frozen implementation bytes:

- `python -m pytest tests/backend/database/test_bootstrap_tooling.py -q` — 7 passed.
- `python -m pytest tests/backend/database/test_k2_09_hosted_fixture_store.py -q` — 44 passed in 37.12s. `TEST_DATABASE_URL` was unset; the existing test fixture used its loopback-only disposable PostgreSQL container, which was removed after the run.
- `python -m ruff check scripts/verify_frll_database.py tests/backend/database/test_k2_09_hosted_fixture_store.py` — passed.
- `git diff --check` for the two changed files — passed.

**Delta verdict:** PASS for the exact 26-file packet; no HIGH/BLOCKER finding in this two-file correction. This is a source and local-test result only. The exact-head CI gate and any hosted operation remain separate and are not claimed as passed here. No hosted database, K2 hosted wave, Supabase Auth actor, secret, or learner row was accessed or changed by this reviewer.


## Hosted 0022 readback and runtime platform pin - independent PASS

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable).

I reviewed the corrected pin packet `2026-10-11-reader-0022-hosted-apply-runtime-pin-packet-v3.md` (SHA-256 `7837b7e61d3cf2b52bff6d701bf97b6703df45e367dc19172354e3f4af08285a`) and its referenced sanitized apply evidence JSON (SHA-256 `122c640afe70d32ee7f7ee853cbf5fc7f38ac3b1bfd274dc33aea2133ff16afb`). V3 corrects the earlier packet's 17:30 UTC capture timestamp to 17:46:45 UTC, after the 17:43:03 UTC apply, and says its source pins and evidence values are unchanged. The JSON itself has no capture-time field; I use the corrected v3 packet for capture chronology and the JSON for the readback values.

I independently recomputed the v3 26-file raw manifest aggregate `cd2c5d92c6d234a9f2d4b6e655699664629493030a8d15d15072e70acbfd4a8e`; every listed raw hash matches the frozen implementation tree. Compared with the preceding 26-file aggregate `fba4a30f502aa9a063a8a98247097f97314c971cc63d72ac050c20f8a311628d`, the only changed path is `tests/acceptance/support/k2_hosted_probe.py`, from `826cb723a44537f44f345bc89f17d36ece3e9c49ed65fe6c13276f41c7037b40` to `351c04f34cca2d871b33732f778b146b034293efc0dd0740095bdde5a5b5a33d`. The diff is only the adjacent comment and `PILOT_READER_EXPECTED_PLATFORM_0022_VERSION` changing from `None` to the read-back version `20261010174303`. The PILOT guard still requires the exact complete application and platform ledgers. The legacy K2 application guard remains exact `0021`.

The evidence's pre-apply application 21-row and platform 14-row ledgers exactly match the frozen migration baseline JSON (SHA-256 `58318b5402d3105d868ef5e57161a05757910097b01c284c951345ffafb5b65c`). Post-apply rows are exactly app `0022 / reader_history_auth_erasure / 1924d92b88e9f20ed1264850830a4f8f4794dad21f07a79d0a9b284b482ac858` and platform `20261010174303 / reader_history_auth_erasure_0022`. I verified the pre-apply function definition, owner, ACL, config and invoker flag against the frozen function baseline JSON (SHA-256 `0e6c9f55ecff10b1a557ade9b6ecccca320376c849e98e9aa696fdc9461cb757`); the function OID, owner, ACL, invoker mode and all three enabled trigger bindings remain unchanged after apply. The search path changes to `pg_catalog`, matching the reviewed 0022 up migration, and the post-apply function body matches that migration after whitespace normalization. No grant, RLS, role, trigger binding or other function change is evidenced.

The pre/post snapshots each contain the exact 27-table inventory; all per-table row-count/digest entries and aggregate row/byte totals match. This supports migration-window global learner-state equality only; it is not a zero-residue or Auth-erasure result. The evidence reports provider apply success and no actor mutation. It does not establish Auth absence, actor cleanup or the failed run's missing retained comparison.

Independent local verification on the frozen source, with database URL variables removed from the pytest child process: `python -m pytest -q tests/acceptance/support/test_k2_hosted_probe.py` passed 71/71; Ruff on that test file passed; `git diff --check` passed. I did not run the whole helper Ruff check; the packet reports the same 33 pre-existing diagnostics on pre-pin and pinned bytes, so no full-probe Ruff PASS is claimed. No hosted request, database connection, actor operation or source edit was performed by this reviewer.

**Bounded verdict:** PASS for the exact one-file platform-version pin and the supplied migration-only metadata evidence, with 0 open HIGH/BLOCKER findings for this scope. The earlier hosted acceptance run remains FAIL. This result adds no Auth deletion, zero-27, retained-state cleanup, new-actor or learner-acceptance proof; those gates remain separate.

## App migration-ledger privilege guard correction — independent PASS

**Reviewer configuration:** GPT-6 Luna / Max (assigned configuration; runtime introspection unavailable). The frozen source author is GPT-6 Luna / Max; the v3 packet metadata-only correction was prepared by GPT-6 Luna / Medium.

The bounded v3 packet is `2026-10-11-reader-0022-readonly-ledger-privilege-guard-packet-v3.md`, SHA-256 `0a808c2a1a66781801f6702a3a41baccb3771cba5dd913e9c43dfa653c9a2683`. Its exact 26-file aggregate is `655d0046ceca7603046f0a633304ea354f7e7f098a30455dc425557e435bf7b3`; I independently parsed the manifest, recomputed all 26 raw file hashes against the frozen implementation worktree, and rebuilt the ordinal-sorted UTF-8/LF aggregate. All hashes and the aggregate match. Compared with the prior 26-file platform-pin packet (SHA-256 `7837b7e61d3cf2b52bff6d701bf97b6703df45e367dc19172354e3f4af08285a`, aggregate `cd2c5d92c6d234a9f2d4b6e655699664629493030a8d15d15072e70acbfd4a8e`), the only changed paths are `tests/acceptance/support/k2_hosted_probe.py` and `tests/acceptance/support/test_k2_hosted_probe.py`. Their current hashes are `85d99a959bacc97ef3b6cfa6798355210408ba511dc25867c88225b869f05fd0` and `97f8c0259968f0689c819b71568505713c959f47c424b4e3c3b1fb9db5e6bd06`.

The packet's v1 and v2 aggregate field (`24d42968554103063e985a6d0256df5f3fb001ec2f35c9334befff5b6ccf9538`) did not match the canonical raw manifest. I raised that pin discrepancy; v3 corrects the aggregate field and records the metadata correction. No source pin or test result changed during that correction. The corrected aggregate now verifies exactly.

The only production-code delta in this correction changes the PILOT app-ledger privilege tuple to require version/name/checksum SELECT, full-table SELECT, and no INSERT/UPDATE/DELETE/TRUNCATE. `database/migrate.py` defines `public.schema_migrations` with only version, name, checksum, and applied_at metadata and reads migration identity from version/name/checksum. The sanitized diagnostic JSON (SHA-256 `d895b22bf20731a10834357f2a63a9344c822cbf5656bb64c94dde974ab967f4`) confirms the existing approved role already has those app-ledger SELECT privileges, all app writes false, and no actor mutation or grant change in the failed recovery attempt. The platform-ledger guard remains stricter: version/name SELECT only, with table SELECT, statements SELECT, and all writes false. Exact application 0001–0022 and platform prior-14-plus-pinned-0022 checks remain unchanged. The legacy K2 migration guard remains exact application 0021.

Tests now reject each missing app or platform metadata SELECT, each app-ledger write privilege, app table-SELECT loss, platform table/statements SELECT, and every platform write privilege. The role shape expected by the test fixture matches the guard.

Independent local verification on the frozen source, with database URL variables removed from the pytest process:

- `python -m pytest -q tests/acceptance/support/test_k2_hosted_probe.py` — 86 passed.
- `python -m ruff check tests/acceptance/support/test_k2_hosted_probe.py` — passed.
- `git diff --check -- tests/acceptance/support/k2_hosted_probe.py tests/acceptance/support/test_k2_hosted_probe.py` — passed.
- Whole-file Ruff on `k2_hosted_probe.py` was not rerun; the packet reports the prior 33 diagnostics. No whole-file Ruff PASS is claimed.

**Bounded verdict:** PASS for this exact 26-file source packet; no open HIGH/BLOCKER finding in the privilege-guard correction. This is local source/test evidence only. Recovery run `38074226540` remains failed and stopped before actor inventory or deletion; no new hosted recovery, migration, grant, Auth actor, or learner-state operation was performed or is implied by this review.
