# K2-09 Hosted Fixture Control Plane — Bounded Design

**Status:** Conditional architecture design PASS after bounded run-ID anti-replay clarification. This is design-only: no implementation, migration, credential changes, or hosted fixture writes are authorized by this document.
**Purpose:** Specify the narrow trusted staging setup/inspect/cleanup receipt needed to prove K2-09 bridge-backed grouped Dictionary results where existing approved catalog data is insufficient.

## Fixed target and authorization

- Fixed Render target: service `srv-daip7vbm8hqs73dp00pg`, `lingua-api-staging`, project `bdmtdvvnbicgkfririjo`; runtime is disabled outside the exact service ID, name, project, and database ownership checks. Any mismatch fails closed.
- Keep the existing database credential on Render. No new GitHub Actions database secret, Render DB secret/environment write, Auth write, role, membership, privilege, grant, or RLS change is part of this design.
- A dedicated GitHub OIDC token is accepted only at fixed audience `https://lingua-api-staging.onrender.com/internal/k2-hosted-fixtures`, validated against GitHub’s fixed issuer/JWKS and RS256. Require exact immutable repository ID `1367261125`, owner ID `95479547`, repository `haizx71/lingua-os`, `master` ref, exact workflow ref `haizx71/lingua-os/.github/workflows/k2-hosted-acceptance.yml@refs/heads/master`, workflow name `K2 Hosted Acceptance`, event `workflow_dispatch`, and owner-actor ID `95479547`.
- Validate signed `sha`, `workflow_sha`, `run_id`, `run_attempt`, `jti`, `exp`, `nbf`, and `iat`; enforce time bounds and anti-replay. This is a direct workflow, not a reusable workflow: do not require `job_workflow_ref`. `triggering_actor`, mode, and wave are not authorization claims; retain existing GitHub-side guards for them.
- Setup, inspect, cleanup, and TTL reap accept no caller SQL, payload, actor IDs, or target run IDs. The server derives exact objects from the verified claims and stored receipt.
- Fixed private routes: `POST /internal/k2-hosted-fixtures/k2-09/setup`, `GET /internal/k2-hosted-fixtures/k2-09/inspect`, `POST /internal/k2-hosted-fixtures/k2-09/cleanup`, and `POST /internal/k2-hosted-fixtures/k2-09/reap-expired`. Requests carry no query/body caller row or target identifiers; use an empty body. These are internal control-plane routes, not learner API or public contract additions.
- Responses are limited to minimum counts/booleans, a static protocol version, and fixed catalog handles/IDs plus the unique lemma/inflection needed by the Node-only acceptance wave. Catalog IDs are not Auth IDs. No raw database, GitHub, learner, Auth, or fixture-content data is returned. Freeze the exact private DTO shape during implementation preparation and obtain Max spec review before writing fixture code; do not silently invent public fields or broaden the receipt schema.

## Fixture and atomic transaction boundary

- Insert only a fixed reviewed template of newly reserved, unique source-record, concept, lexeme, form, sense, and bridge rows. Reuse the approved first-party source/license identity; do not add global catalog, grammar, phrase, phonetic, or policy rows. Never overwrite or collide with ordinary `go`/`went` content.
- Use bounded transactions, timeouts, a transaction advisory lock, exact parent `FOR UPDATE` locks to serialize FK inserts, and exact source/content-hash/tree guards. Revalidate the exact IDs and content immediately before mutation. Any mismatch or unknown affected row aborts.
- The reviewed live catalog FK inventory is 44 validated non-deferrable references, with nine catalog CASCADE/SET NULL paths and two known triggers; drift from this reviewed inventory fails closed. Explicitly enumerate and inspect CASCADE, RESTRICT, and SET NULL dependents, including `phrase_specifications.headword_concept_id`.
- Do not SELECT or mutate Auth or learner tables through this control plane. At least eight known learner FKs to concepts are RESTRICT: `learning_events`, `review_items`, `today_plan_activities`, `user_concept_states`, `user_saved_concepts`, `concept_save_intents`, `exposure_events`, and `reader_exposure_concepts`. This list is not a substitute for the reviewed complete 44-FK inventory. A restrictive reference must roll back fixture children and receipt creation. Check all outside catalog CASCADE/SET NULL references before deletion and abort on any such reference or side effect.
- Fixture word concepts need no `concept_competence_policy` row: the accepted competence projector falls back to the existing default policy when no explicit row exists. Do not add policy rows. Local PostgreSQL proof must verify the existing fallback plus normal actor Save/Review behavior.
- Sanitize database errors to static error codes/messages. Never return SQL, row values, credentials, Auth identifiers, learner data, or fixture content.
- Required local disposable-PostgreSQL tests: full fixture create/inspect/cleanup; byte-identical rollback when a synthetic ordinary learner references a fixture concept; cleanup rollback and retained ACTIVE receipt on restrictive-FK rejection; concurrent FK insertion serialized by parent locks; exact guard mismatch; catalog tree drift; outside CASCADE/SET NULL reference; lost-response idempotency; terminal replay rejection; TTL behavior; and crash/recovery behavior.

## Receipt, migration, and replay rules

- A future private, unexposed migration `0021` may create only a security-control receipt table owned by the existing Render database role, default-deny RLS, and no public/anon/authenticated/service-role ACL. No new role/grant and no changes to existing RLS. Receipt contains only repository/run/attempt/SHA/protocol version, source-record ID/hash, state, and timestamps; no Auth UUID, email, learner data, fixture content, or secret.
- Enforce unique `(repository_id, run_id)` and reject terminal run replay, including another attempt for the same run ID. Retain terminal receipts for 75 days after close, then purge only closed terminal receipts older than that period; down migration must refuse while any active or retained receipt exists. The 75-day value is a conservative inference combining GitHub’s 30-day rerun window and 35-day workflow duration limit with a buffer; it is not a GitHub guarantee. See [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits).
- Setup atomically creates exact fixture rows and ACTIVE receipt. Only the exact same ACTIVE repository/run/attempt/SHA/template/source-record ID+hash and full exact fixture tree may return verified existing state, without INSERT, UPDATE, reset, timestamp refresh, or UPSERT. On a unique-key race, reread and verify the committed receipt and entire tree. Partial/missing/drifted state, wrong claims, later attempts, or terminal receipts return a static conflict and fail closed; never repair or recreate. Cleanup binds only to the exact stored attempt and SHA; it cannot adopt a later attempt. Cleanup atomically removes only receipt-bound fixture rows and marks terminal. Lost responses must be idempotently inspectable; crash cleanup is mandatory before hosted use.
- Setup requires current master and deployed SHA equality. A run’s own cleanup is bound to the exact stored run/attempt/SHA. A janitor invocation requires current master and deployed current code, supports only the reviewed stored protocol, and fails closed on unknown versions.

## Dedicated janitor and GitHub-run proof

- The fixture janitor must be a separate owner-guarded `workflow_dispatch` job in the existing `K2 Hosted Acceptance` workflow file `.github/workflows/k2-hosted-acceptance.yml`, with only that job’s `contents: read`, `actions: read`, and `id-token: write` permissions, under the same global concurrency lock. Do not add another workflow file or broaden the fixed OIDC workflow-ref allowlist. The scheduled actor janitor remains unchanged.
- An ephemeral GitHub token exists only in the runner and is sent only to the fixed trusted Render route; it must never be exposed to a browser, logs, storage, or output. Render derives run and attempt from its receipt and calls both `GET api.github.com/repos/haizx71/lingua-os/actions/runs/{stored_run}/attempts/{stored_attempt}` and `GET api.github.com/repos/haizx71/lingua-os/actions/runs/{stored_run}`. Require TTL expiry and completed status plus exact repository, workflow path, event, master ref, SHA, and attempt for the stored-attempt endpoint; require the latest-attempt endpoint to report a completed latest attempt matching repository/ref/workflow/SHA. Any active or unknown mismatch blocks writes. Network errors, redirects, 404, malformed responses, or claim mismatch fail closed.
- TTL expiry alone is not proof that a job ended; workflow timeout/concurrency markers do not replace the exact GitHub run-attempt check. If a real learner or catalog reference appears, preserve it and fail the acceptance gate; never promise unconditional cleanup if a staging user interacts with fixture content.
- Primary references: [GitHub Actions OIDC](https://docs.github.com/en/actions/reference/security/oidc), [Get a workflow run attempt](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2026-03-10#get-a-workflow-run-attempt), and [Re-run workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

## Acceptance boundary and authorization sequence

- Search and learner badge assertions use ordinary authenticated actor HTTP requests with normal API authorization and RLS. Existing Auth/learner cleanup remains on its separately approved scoped path. Retained state uses the existing read-only 27-table snapshot.
- PASS requires exact fixture and disposable Auth cleanup, zero actor-owned rows across the 27 learner tables, and unchanged retained-state comparison. A terminal receipt proves control-plane anti-replay only; it does not prove fixture absence or learner-residue absence.
- Before any hosted write: implement the design, pass local disposable-PostgreSQL tests, obtain independent Max source/security review and exact-head CI, pass migration review/gates, then receive explicit Commander authorization. Architecture approval alone does not authorize implementation or hosted operations.

## Exact private DTO and migration proposal — review required

**Status:** Exact-spec proposal only; not implementation approval or hosted-write authorization. Prepared by GPT-6 Luna / Max on 2026-10-02. This appendix narrows the existing conditional design. Do not change the accepted K2-09 product source, public API contract, or importer to implement it.

### Private route contract

The only accepted paths and methods are:

| Method and path | Purpose |
| --- | --- |
| POST /internal/k2-hosted-fixtures/k2-09/setup | Create or verify this exact run's ACTIVE fixture. |
| GET /internal/k2-hosted-fixtures/k2-09/inspect | Read-only preflight or verify this exact run's receipt and full fixture tree/absence. |
| POST /internal/k2-hosted-fixtures/k2-09/cleanup | Remove this exact run's fixture and close its receipt. |
| POST /internal/k2-hosted-fixtures/k2-09/reap-expired | Reap only expired receipts/fixtures whose exact GitHub run evidence is complete. |

Every request has no query string and an empty body. The only caller-derived authorization is a freshly minted GitHub OIDC bearer token in Authorization. Setup requires an ephemeral repository GITHUB_TOKEN in X-GitHub-Read-Token with contents:read so the server itself can fetch the fixed GitHub master ref and compare it with the signed SHA and deployed Render SHA. Inspect requires that header with contents:read when resolving the ABSENT preflight state; ACTIVE/CLOSED receipt inspection needs no GitHub token. Reaping requires the header with contents:read and actions:read to verify both the stored attempt and latest run, as well as the janitor run's current master. Send that token only to the fixed Render route over TLS; never log, persist, return, or attach it to an artifact. Same-run cleanup needs no GitHub token. Cleanup checks only the exact stored repository/run/attempt/SHA and supported protocol; it does not require current master equality, so a later deployment cannot strand its own receipt. All routes reject redirects and use bounded network and database timeouts.

The verifier checks the dedicated audience, GitHub issuer/JWKS and RS256 signature, nonempty jti, exp/nbf/iat bounds, immutable repository and owner IDs, repository name, master ref, exact workflow ref/name, workflow_dispatch event, and owner actor ID. Durable replay control is the unique repository/run receipt plus its exact attempt/SHA and state; there is no jti receipt column. Before setup, verify the current GitHub master commit equals the signed run SHA, the deployed Render source SHA equals it, and the service ID/name/project and database runtime guards match the fixed target. An expired or mismatched token, unavailable identity source, stale code, or unknown service/database state fails closed.

The exact success DTOs use only fixed property names. UUID strings below are catalog concept/lexeme IDs derived server-side from the signed repository/run/attempt/SHA and the fixed protocol namespace; they are not accepted as request fields. The controller and wave may hold them in memory, but logs and workflow artifacts must project them to the fixed handles.

Setup response:

    {
      "protocolVersion": "k2-09-bridge-fixture.v1",
      "receiptState": "ACTIVE",
      "disposition": "created",
      "fixturePresent": true,
      "fixture": {
        "handles": {
          "ownerConcept": "k2-09-owner",
          "secondaryConcept": "k2-09-secondary",
          "lexeme": "k2-09-lexeme"
        },
        "ids": {
          "ownerConceptId": "<uuid>",
          "secondaryConceptId": "<uuid>",
          "lexemeId": "<uuid>"
        },
        "lemma": "<unique lowercase ASCII letters>",
        "inflectedForm": "<unique lowercase ASCII letters>"
      },
      "counts": {
        "sourceRecords": 1,
        "concepts": 2,
        "lexemes": 1,
        "forms": 1,
        "senses": 2,
        "bridges": 3
      }
    }

Disposition is exactly created or verified_existing. The latter is returned only for the identical ACTIVE repository/run/attempt/SHA/protocol/source-record ID+hash and full exact tree, with no INSERT, UPDATE, timestamp refresh, UPSERT, or repair. Inspect has one exact response shape:

    {
      "protocolVersion": "k2-09-bridge-fixture.v1",
      "receiptState": "ABSENT",
      "fixturePresent": false,
      "fixture": null,
      "counts": {
        "sourceRecords": 0,
        "concepts": 0,
        "lexemes": 0,
        "forms": 0,
        "senses": 0,
        "bridges": 0
      }
    }

receiptState is exactly ABSENT, ACTIVE, or CLOSED. ABSENT is a read-only, non-persistent preflight result allowed only after token/service/migration/source/schema/collision checks; it requires no receipt, no deterministic fixture IDs/keys/forms, and zero observed counts across the six mutation tables. ACTIVE returns the fixture descriptor and the exact created row counts only after the complete tree and receipt match. CLOSED returns fixture null, fixturePresent false, and all-zero counts only after verifying exact absence. Any partial/orphaned rows, mismatch, collision, or closed receipt with rows returns CONFLICT; never adopt or repair them. An ABSENT result must not insert a receipt, reserve a name, or otherwise persist preflight state. Setup can create only from ABSENT or return verified_existing for the exact same ACTIVE receipt. Cleanup returns protocolVersion, receiptState CLOSED, fixturePresent false, and the exact removed-row counts. A repeated cleanup for the same exact attempt is a no-write already-closed response only after verifying the complete fixture is absent. Setup after a terminal receipt, or any later attempt for the same run ID, conflicts. Reaping returns only protocolVersion plus bounded processedCount, closedFixtureCount, and purgedReceiptCount; it never returns run IDs, receipt rows, or fixture IDs.

Private error responses have this exact shape and no request echo:

    {"error":{"code":"K2_FIXTURE_UNAUTHENTICATED","message":"K2-09 fixture authorization failed."}}
    {"error":{"code":"K2_FIXTURE_FORBIDDEN","message":"K2-09 fixture request is not permitted."}}
    {"error":{"code":"K2_FIXTURE_CONFLICT","message":"K2-09 fixture state conflicts with this request."}}
    {"error":{"code":"K2_FIXTURE_UNAVAILABLE","message":"K2-09 fixture control plane is temporarily unavailable."}}
    {"error":{"code":"K2_FIXTURE_INTERNAL","message":"K2-09 fixture request failed."}}

Map them respectively to HTTP 401, 403, 409, 503, and 500. Invalid signature, audience, expiry, or jti is UNAUTHENTICATED; wrong signed identity, service/project/database ownership, or current-master/deployment proof is FORBIDDEN; absent/terminal/wrong-attempt receipts, collision, source/tree/FK/trigger drift, or unexpected references are CONFLICT; dependency timeouts, redirects, malformed GitHub responses, and database unavailability are UNAVAILABLE. Unexpected errors are INTERNAL. Never return SQLSTATE, provider text, table/row values, Auth identifiers, learner rows, or stack traces.

### Fixed fixture template

One protocol version and one immutable template are used: k2-09-bridge-fixture.v1. The fixture consists of exactly ten catalog rows: one source_record, two English word concepts, one English lexeme owned by the first concept, one lexeme_form, two ordered word_senses, and three concept_senses bridges. It writes no data_sources or licenses row and no framework mapping, topic, relation, edge, policy, phrase, grammar, phonetic, Reader, Auth, or learner row.

- Resolve exactly one pre-existing approved internal first-party knowledge source using the importer-pinned identity: data-source name LINGUA First-Party Knowledge Starter, version 2026-09-16.v1, attribution LINGUA OS first-party authored knowledge starter, and license code LINGUA-FIRST-PARTY with usage_policy allowed. Verify its full source/license identity and approved provenance before each mutating transaction. Do not create, update, or substitute a source or license; zero, duplicate, or drifted identity is a conflict.
- Derive every fixture UUID with UUIDv5 under the fixed namespace 2d1129db-93ec-4db0-b134-09e4cf4e8e72 from the ASCII name k2-09-bridge-fixture.v1|1367261125|<run_id>|<run_attempt>|<sha>|<row_slot>. Row slots are exactly source_record, owner_concept, secondary_concept, lexeme, form, sense_1, and sense_2. Derive the unique form suffix from SHA-256 of the same run tuple without row_slot, map each hexadecimal nibble to a lowercase letter a through p, and use the full 64-letter result. The lemma is kfixture followed by that suffix; the single inflected form and normalized form are that lemma followed by s. These lowercase ASCII-only values remain within the accepted dictionary query bound. Preflight exact normalized-form, lemma, canonical-key, source-record-key, and deterministic-ID collisions. Rely on existing uniqueness constraints too; never overwrite or use conflict-ignore/upsert behavior.
- The source_record key is k2-09-fixture: followed by the full derived suffix. Its raw_hash is SHA-256 over canonical JSON for the pinned source/license identity, generated IDs, and all fixed fixture row payloads, excluding the raw_hash field itself, receipt values, and transaction timestamps. Use transform_version k2-09-bridge-fixture.v1, review_status approved, quality_score 1.0, reviewed_at set in the creating transaction, and exactly the metadata object {"fixtureProtocol":"k2-09-bridge-fixture.v1"}. The receipt copies the source_record ID and raw_hash as plain values. It has no FK to source_records because cleanup removes that catalog row while the terminal receipt remains for 75 days.
- The concept keys are exactly word:k2-09-owner:<suffix> and word:k2-09-secondary:<suffix>, one owner and one secondary, both language en and concept_type word, both pointing to this source_record.
- The single lexeme belongs to the owner concept, language en, has the derived lemma/normalized form and fixed POS noun, and points to this source_record. The one lexeme_form is the derived lemma+s, normalized identically, with form_type inflection and the same source_record.
- The two word_senses use sense_order 1 and 2, definition_language_code en, no translated definition, exact definitions K2-09 fixture sense one. and K2-09 fixture sense two., and the same source_record. Both belong to the one lexeme.
- The three bridges are sense 1 to owner (is_primary true), sense 1 to secondary (false), and sense 2 to owner (false). This produces one shared sense linked to two concepts and two ordered senses for the owner; the secondary concept has only its own exact bridged sense in detail.

Schema safety is pinned to [database/fixtures/k2_09_schema_guard.v1.json](../database/fixtures/k2_09_schema_guard.v1.json), SHA-256 650b0c693b3ae6c1f623b7bbc757fa7f011c3e005dd7c7068133df69b5320b27. This immutable artifact was captured from the previously reviewed live 44-FK/two-trigger metadata; never regenerate it, replace it with a fresh live baseline, or accept a mismatch as a new baseline. It records schemaVersion k2-09-schema-guard.v1 and applicationMigrationHead 0020, the pre-0021 public-catalog baseline. Its exact mutationTables are concept_senses, concepts, lexeme_forms, lexemes, source_records, and word_senses. Its foreignKeyTargetTables are concept_senses, concepts, data_sources, lexeme_forms, lexemes, licenses, source_records, and word_senses. Its triggerTableScope is concept_competence_policies, concept_edges, concept_senses, concepts, data_sources, grammar_specifications, lexeme_forms, lexemes, licenses, phonetic_transcriptions, phrase_specifications, source_records, and word_senses. The artifact pins all 44 individual foreign-key objects, including schema/table/target/name, delete action, deferrability, initially-deferred and validated state, and full constraint definition, plus both complete trigger/function fingerprints.

Before the read-only ABSENT inspect and every setup, cleanup, or reap mutation, acquire the fixed transaction advisory lock and deterministic sorted SHARE locks on all 13 triggerTableScope relations, then compute and compare the live manifest in the same bounded transaction. Require the installed application migration head to be exactly 0021; treat 0020 in the artifact only as its immutable capture marker. Migration 0021 may add only the private receipt schema/table and must leave the public catalog guard exactly equal to the pinned artifact. Compare the three scope arrays, all 44 FK objects and both trigger objects exactly, including order after canonical sorting; reject any missing, added, changed, unvalidated, deferrable, initially-deferred, newly enabled/disabled, or replacement definition before writing. Any lock timeout, unknown table, manifest parse/hash mismatch, or catalog drift returns a static failure and performs no fixture/receipt mutation. The controller must not recapture or silently update the artifact.

Setup and cleanup use one bounded transaction, fixed transaction-local timeouts, and exact row-count/hash/tree assertions. Cleanup also locks the exact source, concept, lexeme, sense, and form parents before checking dependents and deleting children-to-parents in order: bridges, form, senses, lexeme, concepts, then source_record; it marks the receipt CLOSED in that same transaction. If an ordinary learner's RESTRICT FK references any target, the database delete must abort and roll back the whole transaction; the controller does not SELECT or mutate learner/Auth tables. Check catalog CASCADE/SET NULL dependents and abort on any outside row or changed effect. The pinned nine CASCADE/SET NULL definitions are concept_competence_policies.concept_id CASCADE; concept_edges.source_concept_id and target_concept_id CASCADE; concept_senses.concept_id and word_sense_id CASCADE; grammar_specifications.concept_id CASCADE; phrase_specifications.concept_id CASCADE and headword_concept_id SET NULL; phonetic_transcriptions.lexeme_id CASCADE. No migration or runtime path may alter these definitions.

### K2-09 harness lifecycle and assertions

Preserve this exact user-authorized lifecycle; setup is not part of preflight:

1. Read-only preflight verifies signed claims, the current GitHub master/signed SHA/deployed Render SHA equality, exact Render service/project, migration head 0021, current database role/table-owner guard, approved source/license identity, the full pinned FK/trigger manifest, and zero deterministic ID/key/form collisions. After those checks, GET inspect with the fixed contents:read header must return ephemeral ABSENT with fixture null and all six row counts zero. This is read-only and creates no receipt, actor, fixture, or reservation.
2. Capture the existing retained learner-state baseline.
3. Create and authenticate the existing disposable actors through the current approved actor path.
4. After actor authentication, call fixed setup with the run's fresh OIDC token plus the ephemeral contents:read token in the private header, inspect the receipt/tree without that header, and retain the DTO in memory. Setup rechecks the artifact and source/license before writing and verifies current GitHub master equals the signed run SHA and deployed Render SHA. No caller supplies an actor or catalog identifier.
5. Run the new fixed K2-09 wave only through normal actor HTTP. Assert the unchanged default flat response shape; exact unique inflected-form match; one complete lemma group with both ordered senses, all three bridge links, exact matched form and two linked concepts; and concept detail limited to each requested concept's own bridge. Actor A explicitly saves the owner concept and actor B explicitly saves the secondary concept. Use the existing ordinary Review queue/answer path for actor A's owner concept and the established identical-answer replay helper with the same Idempotency-Key and body; require replay response equality and unchanged post-answer learner snapshot. Do not seed review or learner tables through the fixture controller. Compare each grouped concept's status, due/memory, mastery, and competence with that same actor's authoritative GET /v1/brain/concepts/{conceptId}, for both actors and both fixture concepts. Require the owner review to produce nontrivial actor-A evidence/state divergence while the other actor/concept values match Brain exactly, including nullable mastery and competence; never replace a null/missing projection with zero. Repeat grouped search to prove badges remain actor- and concept-specific. Bracket repeated Dictionary search, concept detail, and Brain GETs with the existing read-only actor-state probe and require identical snapshots, proving GETs write no learner state.
6. In both the in-process `finally` path and current-run recovery path, clean each actor's owned learner rows and delete its Auth identity through the already-approved Auth path. Require Auth absence and zero actor-owned rows across all 27 tables for every expected actor before calling exact-receipt fixture cleanup. The controller itself does not query Auth or learner tables; the harness supplies the existing scoped cleanup proof. A current-run cleanup retry reconstructs repository/run/attempt/SHA from its own verified OIDC claims and the receipt, never caller IDs. If any actor cleanup proof fails, leave the receipt ACTIVE, preserve the fixture for safe recovery, and fail the gate; never delete fixture rows first or report partial cleanup as success.
7. After fixture cleanup, independently require actor Auth absence, zero actor-owned rows across the existing 27-table proof, exact fixture/catalog absence via inspect and read-only catalog checks, and the unchanged retained learner-state comparison. Never count terminal receipt state as proof of fixture or learner absence.

The K2-09 selector is added as a distinct choice to the existing protected acceptance workflow and dispatch guard; K2-07, K2-08-DUE-ONLY, K2-08, their ordering, actor behavior, and scheduled actor janitor remain unchanged. The fixture wave is never inferred from unsigned token claims. Setup uses the existing hosted-acceptance job's contents:read permission and passes its ephemeral GITHUB_TOKEN only in the private header. Add id-token:write only to the existing owner-guarded current-run-cleanup job so, after its existing actor/Auth cleanup succeeds, its K2-09 branch can mint a fresh OIDC token and retry cleanup from the exact receipt claims. This recovery route does not require current master equality. The fixture reaper is a separate owner-guarded workflow_dispatch job in that same workflow, with only contents:read, actions:read, and id-token:write, under the existing global concurrency group; it is not a new workflow or a learner/Auth cleanup substitute.

An ACTIVE fixture expires after the existing two-hour actor TTL. Reap only after TTL and only when both the exact stored GitHub run attempt and the run's latest attempt are completed and agree on immutable repository, workflow path, workflow_dispatch event, master ref, SHA, and attempt. Query the fixed GitHub REST endpoints without redirects and fail closed on unavailable, malformed, mismatched, or unknown status. The reaper may delete an exact expired fixture using the same guards or purge a CLOSED receipt only after 75 days; it cannot select a caller-supplied run, recreate a fixture, repair drift, or bypass a restrictive FK. Terminal receipts remain until this TTL and are never removed by the setup/cleanup paths.

### Migration 0021 proposal

Create only `private.k2_hosted_fixture_receipts`, owned by the existing Render runtime role `postgres`. The currently observed staging state has no `private` schema; migration 0021 must fail closed if that schema unexpectedly exists rather than adopt it or alter its ACLs. Create the new schema owned by `postgres`, then explicitly revoke all privileges on that new schema from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Create the receipt table and explicitly revoke all privileges on that new table from those same principals. Apply these revokes only to the two new objects; do not change any existing object ACL, default privilege, role, grant, or RLS definition. The table has ENABLE and FORCE ROW LEVEL SECURITY and no policy.

Do not claim that the private schema is absent from PostgREST's exposed-schema list based on SQL role settings: the available read-only evidence did not expose that configuration. Before hosted use, prove the private route is not reachable through an existing in-process anonymous/configuration check using a fixed table path and no response body or sensitive logging, or provide an independently reviewed effective schema/table ACL plus RLS denial proof. Do not change PostgREST settings or environment variables to make the route inaccessible. Runtime verifies `current_user` is exactly `postgres`, verifies `rolbypassrls` is true, verifies `postgres` owns the receipt and exactly the six catalog mutation tables, and verifies the fixed Render service/project before any write. These checks authorize only the specifically reviewed receipt and catalog CRUD paths; do not use any other `postgres` capability.

The receipt contains exactly these fields and no foreign keys:

| Field | Type and invariant |
| --- | --- |
| repository_id | bigint NOT NULL; CHECK equals 1367261125. |
| run_id | bigint NOT NULL; CHECK greater than zero. |
| run_attempt | integer NOT NULL; CHECK greater than zero. |
| sha | text NOT NULL; exactly 40 lowercase hexadecimal characters. |
| protocol_version | text NOT NULL; exactly k2-09-bridge-fixture.v1. |
| source_record_id | uuid NOT NULL; plain metadata, intentionally no FK. |
| source_record_hash | text NOT NULL; exactly 64 lowercase hexadecimal characters. |
| state | text NOT NULL; only ACTIVE or CLOSED. |
| created_at | timestamptz NOT NULL, set once on insert. |
| closed_at | timestamptz NULL for ACTIVE and NOT NULL for CLOSED. |

Primary key is (repository_id, run_id), which rejects any later attempt for that run ID. The state/timestamp CHECK enforces ACTIVE with null closed_at or CLOSED with non-null closed_at. No actor, Auth, email, learner, secret, jti, fixture-content, baseline, or GitHub API response field is stored. Do not FK source_record_id because the exact source_record is deleted at cleanup. The unchanged public catalog FK fingerprint remains 44; the private receipt introduces no FK.

The down migration refuses unless the receipt table is empty, then drops only that table. It does not drop the private schema or alter ownership/ACLs. Migration tests verify schema/table owner, exact columns and constraints, no FK, ENABLE+FORCE RLS, no policies, explicit deny ACLs on the new objects, unchanged 44-FK/trigger fingerprint, migration ledger head, and down-migration refusal for both ACTIVE and retained CLOSED rows. Do not treat SQL role-setting inspection as proof of PostgREST schema exposure; the separate route/configuration denial proof above remains a pre-hosted gate.

### Required focused implementation test packet

- Disposable PostgreSQL migration tests for 0021 ownership/RLS/ACL/columns/constraints, no FK, same-run uniqueness, active/closed timestamps, current role and six table owners, and down-migration behavior with ACTIVE, retained CLOSED, and empty receipts.
- Transaction tests for exact ten-row insert/inspect/delete, exact source/license and collision guards, every expected affected-row count, exact ACTIVE no-write retry, same-attempt closed cleanup no-op, terminal/later-attempt rejection, source/tree/schema/trigger/FK drift, unique-key race, rollback with a synthetic ordinary learner RESTRICT reference, outside CASCADE/SET NULL row rejection, concurrent FK insertion and parent-lock serialization, and no learner/Auth SQL from the controller.
- Private route/OIDC tests for every signed claim and fixed service/project guard, empty-body/no-query enforcement, exact response allowlists, all five static error/status mappings, redirect/timeout/malformed GitHub handling, no raw ID/provider/error logging, and fixed-only X-GitHub-Read-Token destination. Verify the private endpoint is denied through the existing in-process anonymous/configuration check or reviewed effective ACL/RLS proof; do not alter PostgREST configuration.
- Reaper tests for 2-hour ACTIVE TTL, in-progress/unknown/mismatched stored or latest run no-write, exact completed pair cleanup, 75-day CLOSED receipt retention and purge, run-ID anti-replay, bounded batches, and recovery after a lost setup/cleanup response.
- Harness/workflow tests for the exact lifecycle ordering above, K2-09-only selection, unchanged K2-07/K2-08 selectors and scheduled actor janitor, fixed OIDC audience/workflow ref, setup/current-run-cleanup/reaper job permissions, no new hosted database secret, ABSENT/ACTIVE/CLOSED inspect DTOs and zero-write preflight, grouped inflected-form/sense/bridge/detail assertions, two-actor Save badges, normal Review answer/replay, grouped-versus-Brain equality for both actors/concepts with nontrivial reviewed-state divergence, GET-side state-snapshot equality, cleanup recovery from receipt claims after Auth cleanup, catalog absence, and retained 27-table equality.

The exact private spec must receive independent Max review before implementation. Implementation additionally requires disposable-PostgreSQL proof, migration/security gates, exact-head CI and a separate independent source review. Only then can Commander authorize the hosted K2-09 run; this appendix does not authorize any hosted write.
