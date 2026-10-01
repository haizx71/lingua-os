# K2-08 Fixture Privilege Boundary Redesign

Status: DESIGN FOR INDEPENDENT REVIEW
Baseline: master at eed55ad02dd2776c1a42187017057cbedb54e7a0
Work provenance: GPT-6 Luna / Max
Scope: Architecture only. No application source, contract, migration, hosted actor, secret, or staging state is changed by this plan.

## Decision requested

Accept or reject the bounded fixture boundary below before implementation. The design uses only the existing hosted runner, existing Supabase server/Admin credential, existing read-only acceptance reader, existing disposable Auth actor lifecycle, and existing product APIs. It adds no database role, grant, policy, Auth access rule, key, endpoint, or hosted configuration.

The current K2-08 proposed function-based Auth/RLS path remains NO-GO. A non-owner function cannot read current Auth metadata. This plan keeps Auth identity operations in the existing trusted Auth Admin SDK path and confines one synthetic state insert to a runner-private helper bound to a newly created disposable actor.

## Current evidence and limits

A metadata-only Supabase privilege query was run on 2026-10-01. It read role, ACL, owner, RLS, and policy metadata only; no Auth or learner rows were queried.

| Existing role | Current staging capability on public.users, public.user_languages, public.user_concept_states | Auth schema |
| --- | --- | --- |
| service_role | public schema USAGE; SELECT, INSERT, UPDATE, DELETE, TRUNCATE; BYPASSRLS | No direct auth.users table privileges |
| k2_hosted_acceptance_reader | public schema USAGE; SELECT only; no table mutation; no BYPASSRLS | No schema/table access |
| authenticated | Current metadata reports no public schema USAGE and no SELECT/INSERT/UPDATE/DELETE/TRUNCATE on these relations, despite existing own-row policies | No auth.users SELECT/DML; no policies |

The three public relations have RLS enabled, not forced, with two existing policies each. auth.users is owned by supabase_auth_admin, RLS enabled, not forced, and has zero policies. The service credential is therefore not a narrow database capability: it can bypass RLS and mutate several public tables. The runner helper below is a code-enforced restriction over that existing broad credential. Compromise of the protected runner or its source remains a material residual risk.

The existing K2 product path signs each disposable actor in with the ordinary Supabase password flow and sends that actor’s bearer token to the normal LINGUA API. Staging currently does not permit direct authenticated PostgREST access to these public tables because authenticated lacks schema USAGE and table ACLs. Do not claim that a direct authenticated PostgREST table request exercised RLS. Acceptance asserts normal actor authentication, existing server-side actor/profile ownership, response isolation, and preserved RLS configuration. If a future acceptance contract requires a direct database transaction as authenticated, that requirement is blocked by the observed ACL and cannot be satisfied under this no-grant/no-policy-change design.

Current accepted lifecycle evidence and limitations:

- K2-07 hosted run 36780407824 passed the ordered two-actor assertions, replay, isolation, cleanup, zero actor residue, and retained 27-table digest equality. Preserve this behavior.
- K2-08 source/CI at PR #35 passed for the bounded Today policy source only. The PR is draft, unmerged, and now conflicts with documentation changes from PR #36.
- Migration 0020 is not applied. The design does not authorize its application.
- The PR #35 plugin context currently exposes all of K2HostedConfig, including secretKey, to wave code. This is the primary harness boundary to remove.
- Existing cleanup uses Auth Admin listUsers pagination for TTL and interrupted-run recovery. The Auth Admin API used here has no supported server-side prefix/run filter. That inherited recovery path can receive ordinary Auth identity objects in process. This plan does not invent a filter or add Auth SQL access. New fixture inspection must never enumerate Auth users to rediscover fixture bindings.
- Staging has zero published Reader-eligible content. The first-party English article candidate at commit 5bfb9362e2b534b526260d089a42c4edd44c36a4 is a mapping dry run only: about 1,263 tokens and an estimated eight minutes, with editorial, rights, level, and publication review still outstanding. It cannot be treated as approved or published.

## Proposed privilege and data flow

1. Protected owner-dispatched master workflow.
2. Runner-private validated config and clients:
   - Auth Admin SDK: create/get/delete exact fresh Auth identities.
   - Existing service-role SDK: one fixed insert-only synthetic-state helper.
   - Existing read-only probe: ACL preflight, exact fresh-actor summaries, cleanup proof, and retained 27-table count/hash digest.
   - Ordinary password sign-in: fresh actor sessions kept in runner memory.
   - Bound API clients: ordinary actor bearer to existing LINGUA API.
3. Wave plugin receives opaque primary/observer API handles, one fixed actor-bound fixture action, sanitized aggregate proofs, and an allowlisted checkpoint sink only.

Runner-only configuration retains the project endpoint, service/Admin key, read-only connection, workflow identity, owner attestation, OIDC material, and actor sessions. No raw config, Supabase client, service/Admin key, database URL, OIDC token, actor UUID, email, password, or bearer token is passed into the wave plugin.

Replace K2HostedWaveContext.config, raw primary/observer actors, raw sessions, arbitrary actorId snapshot functions, and unrestricted TestInfo annotation access with:

- Bound primary and observer product clients. Each closure keeps its actor bearer and language-profile binding privately and calls only the configured normal API origin. The plugin cannot supply a bearer, switch actors, or retrieve the bound UUID/token. It can use existing reviewed product routes needed by K2-07/K2-08.
- Bound primary and observer snapshot/lineage readers. Actor filters remain runner-private; results contain only the accepted counts, lineage measurements, and equality booleans required for assertions. No real learner rows or arbitrary actor selectors are returned.
- A runner-created remediation fixture capability bound to one fresh actor and its exact English profile. It exposes only the fixed K2-08 setup operation and returns a sanitized result such as fixture-created/status-counts. It does not accept user ID, profile ID, table, SQL, arbitrary columns, metadata, conflict mode, or query predicates from plugin code.
- A closed checkpoint/report sink that accepts enumerated phase/result labels. No plugin-supplied free-form annotation, assertion diff, API body, UUID, or provider error reaches logs or artifacts.
- The browser continues using the existing publishable key and normal actor sign-in only. The service/Admin key remains in the Node runner and is never sent to the browser, Vercel, Render API, or actor session. Protected-origin OIDC and GitHub tokens remain runner-private. Playwright trace, screenshot, and video stay off.

The current plugin’s K2-07 behavior must be ported to these handles without weakening its assertions. Keep the shared finalizer, read-only probe, 27-table digest, workflow guards, and K2-07 phase order. The plugin may request normal product API operations as its actor, but cannot access the trusted clients or their configuration.

## Fixed synthetic fixture operation

The only new privileged data path is one fixed INSERT statement containing exactly two rows in public.user_concept_states for a newly created actor, one weak and one forgotten, solely to make those candidates observable to Today. It is not a learner action and is never represented as learning evidence or natural elapsed-time decay.

Before the operation:

1. Pin the exact staging project reference, project URL origin, repository, master workflow ref, workflow name, owner dispatch, immutable tested SHA, application migration head, and approved Supabase platform migration tail. A mismatch stops before actor creation or mutation.
2. Run a read-only catalog/ACL probe through the existing reader connection. Assert the expected current role tuple: service_role has SELECT and INSERT on the target table and has its already-existing broad privileges; the acceptance reader has SELECT only; authenticated ACL/RLS metadata matches the reviewed baseline; service_role has no auth.users table privileges. Do not change any role or ACL.
3. Through the existing service SDK, make one zero-row, HEAD-style SELECT on the exact target table filtered by a newly generated non-real UUID and limited to one row. Return only status/count metadata. This verifies the pinned REST target and SELECT connectivity without returning rows. It is not claimed to prove INSERT; the metadata ACL probe verifies the existing INSERT grant. Both checks are read-only.
4. Check that the required content is already published and eligible through the existing catalog/read-only inventory before creating actors. If there is no eligible Reader content or mapped concept fixture, fail closed without creating an actor.
5. Create the exact two existing fresh actors using Auth Admin with server-owned app_metadata marks set atomically during create. Authenticate both by ordinary password sign-in; bootstrap profiles through the existing API with each actor bearer.
6. For the fixture pair, validate the profile through an exact actor/profile/language predicate using the read-only reader and return only an existence/count proof. Obtain the concept from the fixed set of published, eligible content-linked concepts, not from caller-supplied SQL or learner rows.

For each privileged fixture insert, readback, or deletion, re-fetch only the current process-created actor by Auth Admin getUserById using the in-memory identity binding. Project only the fields needed for the guard: exact Auth UUID match, reserved synthetic address match, server-owned app_metadata marker, and lifecycle timestamps. Require exact marker version, staging project, repository, workflow/ref, run and attempt, creation time, and unexpired bounded TTL. Ignore user_metadata completely. Re-check the exact actor/profile/language association through the read-only reader before fixture setup/readback. A mismatch, missing actor, expired mark, changed metadata, profile mismatch, API error, or probe error stops the wave and triggers cleanup; raw values/errors are suppressed.

The helper performs that single insert-only statement with exactly two rows and a closed assignment of one weak and one forgotten status, exact actor/profile/language/concept bindings, state_version 1, null evidence dimensions/mastery, zero confidence/exposure defaults, and no fabricated last_seen_at. Use only existing schema defaults and constraints. Do not write learning_events, review_events, FSRS, exposure, Reader, Library, Today, profile, or catalog tables from the helper. Do not call upsert, UPDATE, DELETE, TRUNCATE, or arbitrary PostgREST filters. The composite foreign keys and unique actor/concept constraint remain active. Existing SQL status vocabulary already includes weak and forgotten; this plan adds no enum/schema change.

Choose deterministic, distinct content-linked concepts for the closed forgotten/weak pair only after the content gate confirms enough eligible material for the full assertion. The operation itself owns selection and assignment; the wave plugin cannot submit IDs or choose fields. It returns no Auth identity, row, concept, or profile UUID. After an ambiguous insert response, the helper may perform one exact actor/profile/concept-pair readback only while that same in-memory helper invocation is active. If both expected rows are not proven, fail and clean up; never overwrite. A later process does not rediscover or adopt a fixture row.

The service credential’s broad existing DML authority means a source defect or compromised runner can still mutate other public tables. That risk is not removed by the helper interface. Protected workflow execution, exact source attestation, a small reviewed helper, static type/runtime guards, no plugin credential flow, and tests below are required compensating controls. No capability may be described as DB-enforced least privilege.

## Threats and controls

| Threat | Required control | Residual/stop condition |
| --- | --- | --- |
| Plugin or browser obtains service/Admin key | Do not pass raw config/client/key into plugin or browser; use bound actor API closures and one fixture closure; keep Playwright trace/screenshot/video disabled | Runner compromise remains high impact because existing credential is broad |
| Fixture targets a real, stale, foreign, or wrong-profile actor | Only in-memory createUser identities; exact project/run/ref/attempt/TTL marker via Auth Admin getUserById before each helper operation; exact public profile binding via reader; never accept arbitrary IDs | Any mismatch aborts before insert/read/delete |
| Learner-editable metadata is used as authority | Trust only server-owned Auth app_metadata marker and fixed server-side workflow context; ignore user_metadata | Any key set or ownership marker mismatch fails closed |
| Helper becomes a generic SQL/PostgREST write path | Fixed table, fixed columns, fixed weak/forgotten enum, actor/profile bound closure, insert only, no upsert or caller predicates; runtime rejects forged handles | Static/runtime tests must prove no alternate table or DML path |
| Auth identities or learner rows leak through assertions | No Auth list in new fixture helpers; no row-returning fixture proof; fixed errors and allowlisted result sink; only aggregate actor counts and 27-table digest equality | Existing shared listUsers recovery still has the inherited in-process exposure described below |
| Unexpected staging privileges or wrong project receive a write | Project/ref/URL pinning; zero-row read-only API probe plus read-only exact ACL metadata check before actor mutation; no secret values logged | A zero-row read cannot prove INSERT success by itself; unexpected ACL/API result blocks |
| Synthetic status is presented as natural learner decay | Explicitly label the two states synthetic in private run assertions; do not set timestamps or evidence; acceptance report says synthetic fixture input | Natural decay remains separately unproven by this fixture |
| Response loss duplicates or broadens a seed | Unique actor/concept constraint, insert-only request, same-invocation exact readback, no overwrite; uncertain state causes failure and actor cleanup | Cannot resume or adopt a fixture after process death |
| Actor/profile cross-contamination | Each API, snapshot, and fixture handle is bound to one actor/profile; test foreign requests with the other actor; exact snapshots before/after | Any foreign write/read success blocks |
| Crash leaves synthetic actor or row | Existing finally cleanup; separate current-run cleanup job; existing marker TTL janitor; Auth hard deletion cascades actor rows; zero-residue proof | A crash loses the in-memory retained baseline, so that run can never pass retained equality or overall acceptance |

## Cleanup and crash contract

Normal return, assertion failure, timeout, API failure, and fixture failure all enter the existing unconditional runner finalizer. It attempts ordinary actor sign-out, revalidates each exact Auth marker, deletes only current-run actors through Auth Admin, proves canonical Auth absence, proves zero actor-owned rows across the existing actor-owned table inventory, compares the post-cleanup 27-table retained digest with the pre-run baseline, and marks completion only if every cleanup and digest check passes. Cleanup failures override wave success with a fixed sanitized failure.

On process termination after Auth create or fixture insert, the same-run current-run cleanup job remains responsible for the exact marked run identities and zero actor-row proof. The existing daily TTL janitor remains the fallback for marked actors that survive workflow-level cleanup. Auth deletion cascades the synthetic state row and the actor’s ordinary learner rows. A retry performs existing cleanup before its new retained baseline and new actor creation; it does not query Auth for lost fixture bindings or adopt an old row.

The existing current-run job proves Auth/actor-row cleanup; it does not possess the lost process’s in-memory retained baseline. Therefore a hard-crashed run is failed and cannot claim retained snapshot equality or K2-08 PASS even if later cleanup proves zero residue. A later complete run must capture a fresh baseline and pass the full lifecycle. Do not persist learner snapshots, actor IDs, or fixture rows as workflow artifacts to make a crashed run appear complete.

The current Auth recovery implementation paginates listUsers for marked TTL cleanup and same-run unmarked partial-create recovery. The API supplies no supported server-side prefix/run filter, and no filter option or Auth SQL access is added here. Keep that existing audited lifecycle separate from fixture inspection. New fixture helpers never call listUsers or inspect Auth users outside their in-memory fresh actor bindings. For the inherited cleanup adapter, retain only the minimum fields needed for exact matching/deletion from each page, do not retain complete page arrays beyond the loop, never inspect user_metadata, never log identity objects, and continue failing closed on incomplete pagination or ambiguous recovery. If a supported Auth API later provides a verified exact server-side filter, it requires separate doc-backed review before adoption. This plan does not treat the inherited enumeration as zero exposure; it records it as a bounded residual of current recovery.

## Adversarial verification before any hosted run

The implementation gate must add credential-free tests for:

1. Plugin context omits the complete config, secretKey, database URL, OIDC values, raw Admin/reader clients, actor UUIDs, actor credentials, and raw access tokens. A sentinel secret in each fake input never appears in logs, annotations, errors, snapshots, or serialized artifacts.
2. Primary and observer bound API clients attach only their own normal session bearer to the fixed API origin. They accept no caller-supplied bearer. Admin/service credentials never appear on API, browser, Vercel, or actor Auth sign-in requests.
3. Fixture closure cannot be called with a forged actor, observer/foreign actor, arbitrary profile, arbitrary concept, table, SQL, field, status, metadata, conflict mode, or filter. Type-level and runtime/cast adversarial cases fail closed.
4. Auth Admin revalidation is getUserById for the exact current in-memory fresh identity only. Changed UUID/email/project/ref/run/attempt/marker/TTL, user_metadata decoy, missing Auth identity, or changed profile association causes no insert/readback/delete.
5. Fixture path never invokes listUsers. Existing janitor/recovery tests remain intact and cover incomplete pages, ordinary learner identity decoys, same-run exact recovery, TTL boundary, ambiguous actors, and no log disclosure.
6. Read-only ACL preflight detects absent INSERT/SELECT, reader mutation privilege, changed authenticated ACL/RLS metadata, unexpected Auth table access, and wrong project URL/ref before actor creation. Zero-row probe never returns rows and cannot change any table. It must not be called an INSERT proof.
7. Insert succeeds only once for the expected weak/forgotten row; duplicate, unknown status, foreign profile, missing eligible content, constraint error, and ambiguous response all fail closed without update/upsert. Readback returns only a bounded proof.
8. K2-07’s accepted Save/Learn, self-recall/typing, exact replay, actor isolation, cleanup, and retained digest tests pass unchanged in meaning through the new bound context.
9. A forced error after create, after fixture insert, during readback, during actor cleanup, and during retained comparison always fails acceptance and attempts cleanup. Simulated process death leaves only the existing marked-actor recovery path; the run has no success marker and no retained-equality claim.
10. Sanitized results contain only allowlisted phase names, booleans/counts, and synthetic-input labels. No UUID-bearing diffs, learner rows, raw request/response bodies, trace, or provider error reaches workflow output.

## Full K2-08 hosted acceptance map

The full hosted run is not a due-only run. It is also not satisfied by a synthetic row read alone.

| Gate | Required hosted assertion | Scope and proof |
| --- | --- | --- |
| Deployment and schema preflight | Exact owner-dispatched master SHA, workflow/repository/ref guards, protected deployment/API health, exact staging project, application migration 0020 only after its separate accepted rollout, and approved platform migration tail | No actor or fixture mutation if any mismatch |
| Published-content readiness | Human-reviewed, licensed/provenance-complete, level-appropriate content passes existing publication gate; staging inventory confirms eligible published Reader item(s), duration, and linked concepts required for remediation | Candidate article is not approval; zero eligible staging content blocks full run before actor creation |
| Fresh actors and profiles | Exactly two new marked actors, ordinary password sessions, profile/timezone setup only through the actor’s existing API, no real learner selected | Runner keeps raw IDs and credentials privately |
| Controlled due case | Primary actor at 15 minutes has 20 distinct API-created due/overdue concepts; Today returns the exact ordered 15-item Review prefix, no budget overflow, no new curriculum while the due backlog consumes the budget | Compare against authoritative Review queue order; actor-scoped snapshots |
| Remediation priority and reserve | Observer actor’s closed synthetic fixture establishes distinct weak and forgotten candidate states linked to already eligible published content; Today orders forgotten before weak, both before eligible new curriculum, uses the eight-minute content reserve according to ADR-017/v2 rules when suitable content exists, and remains within the 15-minute daily budget | Explicitly synthetic status input; does not claim natural elapsed-time decay. Missing content or candidate coverage blocks this gate |
| Exact replay | Repeated same actor/profile/local-date Today read returns the persisted plan’s exact identity, engine version, order, estimates, reason codes, and response data; no duplicate persisted plan/activity/target rows or non-Today writes | Snapshot before/after replay |
| Actor isolation | Each actor cannot read or mutate the other actor’s Today plan, Review items, or synthetic states; foreign operation returns existing 403/404 semantics and neither actor snapshot changes | Normal actor bearer through existing API; no service credential on the request |
| Today-only delta | Snapshot both actors after all setup and before Today generation; generation changes only accepted Today plan/activity/target/diagnostic rows. Evidence, FSRS, competence, profile, Reader, Library, and content snapshots stay equal | Fixture setup is intentionally outside this delta window |
| Cleanup and retained state | Auth deletion/absence, zero actor-owned rows, and post-run equality of the existing retained 27-table read-only digest are all required | Finalizer completion marker only after every proof passes |
| Overall result | All rows above pass on one exact reviewed/deployed source revision, including independent source/CI review, required migration rollout, content approval/publication, and full hosted execution | Due-only source/CI or synthetic-only proof cannot produce K2-08 PASS; K2-09/10 stay locked |

The due and remediation cases use separate fresh actor/profile plans so one persisted plan per actor/profile/local date remains authoritative. The observer’s empty/baseline state is measured before its own fixture and after the primary due scenario to keep cross-actor proof independent. Any required content selection or duration not present in current staging is a blocker, not a reason to lower coverage.

## Ordered implementation and promotion gates after design acceptance

1. Independent Max review of this immutable plan finds no HIGH/BLOCKER architecture issue. Resolve any review finding in a new reviewed plan commit before source work.
2. Implement the small server-runner boundary and closed insert-only helper on an isolated source branch from current master. Preserve PR #35 worker state; integrate documentation conflicts with PR #36 through normal reviewed history only.
3. Add adversarial unit/security tests listed above, preserve K2-07 tests, then run the exact source/CI/security gates. Independent source review must inspect the immutable tested head.
4. Keep the plan’s zero-row preflight and code-closed fixture helper; do not add roles, grants, policies, SQL functions, Auth SQL access, new secrets, API endpoints, or weaker production authorization.
5. Separately obtain human content, provenance/license, level, and publication review. Publish through the accepted catalog pipeline only after those existing gates pass; verify staging inventory without reading learner rows.
6. Root reviews and authorizes the normal application migration 0020 rollout after design and source gates; this plan does not apply it. Verify source checksums, migration registry, platform tail, and rollback conditions before any deployment.
7. Run the protected full K2-08 workflow from the exact authorized master revision. Require every hosted assertion in the table above, mandatory cleanup and retained equality, and an independent Max review of sanitized exact-head evidence.
8. Only after source review, migration gate, eligible content, and full hosted PASS may root consider normal merge/promotion. K2-09/10 remain locked until their separate gates.

## References

- AGENTS.md; MASTER_PROJECT.md; DECISIONS.md, especially ADR-015–017; STATUS.md; TASKS.md; CONTEXT.md; docs/README.md.
- plans/TASK-K2-07-hosted-acceptance-harness.md and reviews/K2-07-hosted-acceptance-review.md.
- reviews/K2-08-source-ci-review.md and reviews/K2-08-fixture-auth-rls-review.md.
- PR #35 source plan TASK-K2-08-today-remediation-v2.md, read from its worktree at design time; its exact source remains draft and unmerged.
- Existing harness: tests/acceptance/support/k2_hosted_runner.ts, k2_hosted_actors.ts, k2_hosted_probe_client.ts, k2_hosted_wave_k2_07.ts, tests/acceptance/k2_hosted_acceptance.spec.ts, and .github/workflows/k2-hosted-acceptance.yml.
- Existing schema and policy: database/migrations/0001_core_schema_v1.up.sql, applicable later migration history through 0019, docs/TODAY_ENGINE_IMPLEMENTATION_V1.md, docs/LEARNER_EVIDENCE_COMPETENCE_V1.md, and docs/READER_CONTENT_MVP_V1.md.
