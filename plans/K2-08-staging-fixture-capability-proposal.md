# K2-08 Staging Fixture Capability — Security Proposal

**Status:** PROPOSED — NOT AUTHORIZED, NOT IMPLEMENTED, NOT APPLIED
**Decision scope:** whether to add one staging-only database capability for a bounded synthetic Today fixture
**Source baseline:** `master` at `2c3284a2deb4fac18683b660a751039e36b007f7`
**Prepared by:** GPT-6 Luna / Medium
**Independent security review:** pending
**Operational gate:** root reports the K2-08 full hosted gate remains BLOCKED. The older readiness wording in this baseline's `STATUS.md` does not establish hosted acceptance for this proposed capability.

## Proposal

Evaluate a separate owner-provisioned, staging-only database executor principal and credential that can invoke exactly one fixed function in a non-exposed internal schema. The function would be a deliberately narrow fixture setup exception for a single disposable actor: exactly one new `weak` or `forgotten` projection row in the existing `user_concept_states` table, for already-existing Auth, user-language, and eligible English concept identities, only when all ownership and run-boundary checks pass. The target projection row must be absent; an existing row is never replaced or updated.

This proposal does not authorize provisioning the role or credential, creating or applying a migration, changing existing permissions or repository secrets, running a hosted actor cycle, or publishing candidate content. Human owner approval and independent security review are required before any implementation or staging change.

The ordinary actor-owned APIs remain the default and preferred fixture path. The exception exists only to make a synthetic Today fixture possible when natural weak/forgotten transitions or temporal decay cannot be established within the bounded hosted run without a clock/data injection or an already-approved policy override. A successful subcase would demonstrate Today handling of an explicitly synthetic input. It would not demonstrate natural learner progression, a real decay transition, or the complete K2-08 gate.

## Rejected capability shortcuts

- **Supabase `service_role` direct Data API writes:** NO-GO. This credential has broad authority and is not an acceptable hosted fixture writer.
- **Adding write or mutation grants to `k2_hosted_acceptance_reader`:** NO-GO. It is the accepted read-only role used for schema, actor-residue, and retained-state proofs. Its existing permission contract and repository secret must stay read-only and unchanged.
- **Generic SQL, table-name/value inputs, bulk rows, or arbitrary update/delete RPC:** NO-GO. These turn a fixture exception into a general database write interface.
- **Changing clocks, database time, competence policy, production data, catalog provenance, or natural status rules:** NO-GO for this proposal. No new rule, policy row, published content, or learning event may be fabricated to make the test pass.
- **Using an existing learner or preserving synthetic rows after cleanup:** NO-GO.

If the proposed single-function boundary cannot be achieved without broad privilege, RLS bypass, table ownership, extra learner-state side effects, or weakened cleanup proofs, stop and keep hosted K2-08 BLOCKED.

## Required privilege boundary

The exact privilege graph must be generated and tested on disposable PostgreSQL before any hosted approval:

1. An owner provisions a dedicated staging-only executor principal and its credential, proposed CI secret name `K2_STAGING_FIXTURE_EXECUTOR_DATABASE_URL`. The proposed workflow must use two distinct dependent jobs on the exact authorized SHA: (a) a secret-free preflight job attests the pinned expected staging project URL/ref, known Supabase shared-session-pooler host, and expected project-scoped username/destination against trusted configuration; (b) only after that job succeeds, a separate owner-gated fixture job may run, with the executor credential mapped only to its exact fixture step. The credential must not be exposed to the preflight job or any other step. Before opening a database connection, the fixture step parses the complete database URL in memory and matches its role, project, host, port, database, and TLS configuration against the pinned expected values. It must not print or persist the URL or its components. If preflight cannot attest the destination, or the parsed URL does not match exactly, fail closed without opening a connection and keep the gate BLOCKED. An Auth `projectRef` marker is only a consistency check; it does not prove the actual database identity. The function must also require the exact expected `session_user`. The executor receives only database connection permission, `USAGE` on the internal schema, and `EXECUTE` on the one fully qualified function. It receives no `public` table/view/sequence/function access, no inherited role privileges, and no role membership in `service_role`, `postgres`, Auth administration, or the function owner.
2. The function owner is a distinct `NOLOGIN`, non-superuser, `NOBYPASSRLS` role with no role inheritance or elevated-role membership. It is not the owner of public learner tables. It receives only the minimum fixed support reads on `public.users` and `public.user_languages` and one `INSERT` privilege on the target projection. Existing policies on the support tables that apply only `TO authenticated` do not authorize this direct `NOLOGIN` function-owner context without a JWT. If RLS is enabled and requires additional access, any policy must be narrowly scoped to this function-owner role and to the required `SELECT` operations on those exact support rows, plus a separate narrowly scoped `INSERT` policy for the permitted projection insert. Predicates must enforce the same actor, profile, concept, and run checks. No table ownership or `BYPASSRLS` is allowed. The actual deployed schema's RLS configuration, policies, grants, and function execution behavior must first be inspected read-only, then proved with positive and negative disposable-PostgreSQL tests before approval. Do not assume or invent privileges on managed/Auth schemas. If execution would require broad grants or a role capable of general table writes, the proposal is a no-go.
3. The function is fixed, schema-qualified, non-dynamic SQL with a pinned safe `search_path`; it is not exposed through the public Data API. It accepts only the closed fixture inputs needed for one actor/profile/concept/status tuple and a bounded run identity. No free-form SQL, relation name, column name, row count, JSON patch, or caller-selected operation is accepted.
4. The only write is exactly one `INSERT` creating a new `user_concept_states` projection row for existing Auth, user-language, and concept identities. A proposed versioned K2-08-only extension to server-owned Auth `app_metadata` must prebind exactly one actor/profile/concept/status tuple for this run; this extension is absent from the current harness and must not be represented as existing behavior. The function must compare the supplied tuple exactly with that owner-created metadata. The target state row must be absent before insertion. Allowed synthetic statuses are exactly `weak` or `forgotten`. A different tuple fails the metadata check; a repeated request for the same tuple fails because the target projection row created by the first request already exists. Tests must prove neither replay can create any additional row. The function must never replace or update any existing row, upsert, delete, truncate, loop over arrays, batch, or write review/learning events, FSRS, competence evidence, catalog/content, Today snapshots, or unrelated tables. Existing schema constraints and the K2-05 effective-status contract must be independently checked before implementing the insert shape.

This is a staging fixture write to learner projection state. It must be treated and reported as synthetic even though it uses a disposable actor.

## Mandatory function checks

Before the insert, the function must fail closed unless it can verify all of the following from trusted database state and the protected runner context:

- A separate secret-free preflight job on the exact authorized SHA attests the pinned staging project URL/ref, known Supabase shared-session-pooler host, and expected project-scoped username/destination against trusted deployment configuration. Only its successful result may gate a dependent fixture job on the same SHA, with the executor secret mapped only to the exact fixture step. Before opening a database connection, that step parses the complete database URL in memory and matches role, project, host, port, database, and TLS configuration against those pinned values. It must not print or persist the URL or its components. If preflight attestation or URL matching fails, stop without opening a connection and keep the gate BLOCKED. The database function also checks the exact expected `session_user`. An Auth `projectRef` marker must match as a consistency check, but is not proof of the database's actual identity; do not infer identity from that marker, a caller-supplied string, or an unsettable-looking custom GUC.
- The target Auth identity exists, is confirmed as required by the established actor lifecycle, and carries the exact owner-created run marker for this repository, workflow/ref, run ID, attempt, staging project, creation time, expiry, and source SHA. A proposed versioned K2-08-only `app_metadata` extension must additionally prebind exactly one actor/profile/concept/status tuple for the fixture. This extension is absent from the current harness and must not change the accepted K2-07 lifecycle or metadata contract. The current shared marker binds workflow/ref/run/attempt/project/TTL but does not bind source SHA. Add the proposed K2-08-only marker path and independently reviewed binding; if either cannot be proven, do not enable the function.
- The supplied actor/profile/concept/status tuple exactly matches the one tuple prebound in the proposed K2-08-only owner-created metadata. Its actor/profile/concept identities already exist and belong together: the owned English language profile belongs to that Auth actor; the concept is an eligible existing English word/phrase identity; and the actor is the disposable identity created by this exact run. The target `user_concept_states` row itself is absent and will be newly inserted; no existing projection row may be replaced or updated. A different tuple is rejected; a repeated call for the same tuple is rejected once its row exists.
- The run source SHA is the protected workflow SHA checked against the live `master` tip before secret delivery and immediately before actor creation. The DB function must not trust a caller-provided SHA in isolation. Bind the verified SHA to K2-08-only, owner-created Auth metadata and check it from the database without returning Auth metadata to the runner. The exact marker version and trusted binding are an explicit design/review gate; if they cannot be proven without changing K2-07 or weakening its marker boundary, do not enable the function.
- The actor marker is unexpired under the existing strict TTL bound and belongs to the current attempt; malformed, stale, mismatched, or ambiguous identity metadata rejects the call.
- No matching target state exists before the insert. A conflict is an error; preserve the preexisting value and stop. Never treat an existing row as an invitation to replace learner state.

No diagnostic output may include Auth tokens, credentials, emails, private content, or actor/profile identifiers. Report only fixed outcome categories and the synthetic subcase label.

## Auth deletion, cascade, and retained-state proof

The function has no deletion capability. Existing Auth Admin cleanup remains the sole actor deletion path. The source schema already links `public.users.id` to `auth.users.id` with `ON DELETE CASCADE`, and `user_concept_states` links to both the user and owned language profile with cascading foreign keys (migrations `0001` and `0004`). Do not add direct executor deletes or new `UPDATE`/table-lock grants to make cleanup work.

Before hosted use, a disposable PostgreSQL concurrency test must race the one allowed insert against Auth-user deletion using the actual role/function/FK configuration. It must prove both serializations are safe: deletion wins and insertion fails, or insertion commits first and Auth deletion cascades the row. After Auth Admin cleanup, the existing harness must still prove Auth absence and zero actor-owned rows with the read-only actor probe. The separate current-run cleanup job remains mandatory.

The shared runner's retained baseline and after-snapshot must still compare the complete frozen 27-table learner inventory (counts and hashes) and pass unchanged. The proposed fixture row is expected to be removed by Auth deletion; retained production learner state must remain unchanged. A separate cleanup job PASS does not substitute for the main run's finalizer, Auth absence, actor-row absence, or retained comparison. No `finalizer_complete` or subcase marker may be emitted as success unless its own required proof gates pass.

## Verification required before a decision

All of the following are prerequisites to requesting a human decision to authorize a staging implementation:

1. A separate security review of the exact SQL/function/grants, RLS behavior, database identity and SHA binding, Auth metadata reads, and failure modes.
2. First inspect the actual staging Auth/support-table RLS configuration and grants read-only; do not infer managed-schema privileges. Then run fresh disposable PostgreSQL tests using the same database migrations and role grants: privilege matrix; positive and negative RLS behavior for required support reads and the one insert; invalid actor/profile/concept/status/TTL/SHA/tuple; preexisting-row rejection; same-tuple replay and different-tuple rejection without additional rows; no update/delete/batch/dynamic SQL; insert side-effect inventory; Auth delete/insert race; FK cascade; and exact actor cleanup.
3. Prove the executor cannot select from learner/Auth/catalog tables or invoke any other function, and the function owner cannot login, inherit or assume broad roles, bypass RLS, or write outside the one permitted insert.
4. Re-run all existing actor lifecycle, metadata validation, Auth-only cleanup, probe, retained 27-table comparison, and workflow-security tests without changing K2-06 or the accepted K2-07 path. Prove the staging-destination preflight is secret-free, the fixture job cannot start unless preflight succeeded on the same authorized SHA, and the executor secret is available only to the dependent fixture job; cover complete-URL mismatch rejection before connection without exposing URL components.
5. Only after review and explicit approval: implement a staging-only migration and two separate dependent workflow jobs on the same authorized SHA, with the executor credential mapped only to the exact fixture step in the second job. Do not modify the existing read-only role or its secret. Apply/provisioning, hosted dispatch, or role/secret creation require their own explicit authorization; this plan grants none.

If any requirement is not independently demonstrated, do not provision the credential or function. Continue credential-free implementation and PostgreSQL testing, and leave the full hosted K2-08 gate BLOCKED.

## Result labeling and content boundary

Keep the experiments and their evidence distinct:

- `k2-08-due-only` is the separate natural API-derived due-backlog subcase. It uses no synthetic fixture writer and can establish only the natural due-backlog behavior actually reached by its API evidence.
- `k2-08-synthetic-remediation` labels this proposed one-row weak/forgotten fixture. It can report only whether Today consumed that explicitly synthetic state as expected, after cleanup and shared safety proofs complete.

Neither subcase establishes temporal decay or general natural learner progression. Do not combine synthetic fixture evidence with natural or temporal evidence, and do not report either subcase as full K2-08 acceptance or emit an overall K2-08 PASS from this proposal. K2-06 Save/Learn semantics and the accepted K2-07 hosted record remain unchanged.

The original article candidate and read-only lexical mapping are separate preparation evidence at immutable commit [5bfb9362e2b534b526260d089a42c4edd44c36a4](https://github.com/haizx71/lingua-os/commit/5bfb9362e2b534b526260d089a42c4edd44c36a4). The candidate remains pending review and rights/level approval; it is not published content and is not an authorization to write catalog or content data.

## Content-review policy interpretation

- `plans/TASK-KNOWLEDGE-001-catalog-foundation.md:205` explicitly says: “no automatic LLM-generated knowledge accepted without human review.” This applies before accepting LLM-generated material as project knowledge.
- `DECISIONS.md:108-110` permits publication only for reviewed English A0-B1 content with approved dependency provenance, representable attribution, and allowed licenses. `DECISIONS.md:312-313` makes first-party attribution and a rights statement mandatory and stored.
- `docs/READER_CONTENT_MVP_V1.md:281` describes first-party records as reviewed A0-B1 texts and requires author/version/hash/reviewer state. Lines 336-340 require curator-selected level and explicitly reject a formal CEFR certification claim.
- These sources require human review for automatic LLM-generated knowledge, truthful and approved rights/provenance, and a reviewed/curator-selected level before publication. They do not name a separate role called “human rights owner.” Requiring an identifiable rights holder to confirm the candidate's ownership is a conservative evidence step because the model cannot establish rights; the required durable outcome is a truthful rights statement, representable attribution, approved provenance, and a reviewer state.

## Current references

- `plans/TASK-K2-07-hosted-acceptance-harness.md` — shared actor lifecycle, owner/ref/SHA guard, cleanup, TTL and frozen 27-table proof.
- `tests/acceptance/support/k2_hosted_actors.ts` — run-bound Auth metadata and strict Auth-only actor cleanup.
- `tests/acceptance/support/k2_hosted_probe.py` — fixed read-only table inventory and actor-residue checks; retain its grants unchanged.
- `database/migrations/0001_core_schema_v1.up.sql` — Auth-to-user and learner-state cascade foreign keys, existing status constraint and RLS.
- `database/migrations/0004_learner_evidence_competence_v1.up.sql` — competence projection fields/lineage; verify the exact allowed fixture insert against this schema.
- `plans/KNOWLEDGE-V2-REMAINING-EXECUTION-MAP.md` — K2-08 objective, invariants and full local/hosted test scope.
- `reviews/K2-08-hosted-fixture-readiness.md` — catalog and candidate readiness evidence; candidate mapping at commit `5bfb9362e2b534b526260d089a42c4edd44c36a4`.
