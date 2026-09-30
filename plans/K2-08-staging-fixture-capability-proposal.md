# K2-08 Staging Fixture Capability — Security Proposal

**Status:** PROPOSED — NOT AUTHORIZED, NOT IMPLEMENTED, NOT APPLIED
**Decision scope:** whether to add one staging-only database capability for a bounded synthetic Today fixture
**Source baseline:** `master` at `2c3284a2deb4fac18683b660a751039e36b007f7`
**Prepared by:** GPT-6 Luna / Medium
**Independent security review:** pending
**Operational gate:** root reports the K2-08 full hosted gate remains BLOCKED. The older readiness wording in this baseline's `STATUS.md` does not establish hosted acceptance for this proposed capability.

## Proposal

Evaluate a separate staging-only database executor credential that can invoke exactly one fixed function in a non-exposed internal schema. The function would be a deliberately narrow fixture setup exception for a single disposable actor: one insert of one closed `weak` or `forgotten` value into that actor's existing English concept-state projection, only when all ownership and run-boundary checks pass.

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

1. A dedicated staging-only executor login is a new credential, proposed CI secret name `K2_STAGING_FIXTURE_EXECUTOR_DATABASE_URL`. It is mapped only to the exact manually dispatched, owner-gated fixture step that needs it. It receives only database connection permission, `USAGE` on the internal schema, and `EXECUTE` on the one fully qualified function. It receives no `public` table/view/sequence/function access and no role membership in `service_role`, `postgres`, Auth administration, or the function owner.
2. The function owner is a distinct `NOLOGIN`, non-superuser, `NOBYPASSRLS` role with no elevated-role membership. It is not the owner of public learner tables. It receives only the minimum fixed support reads and one `INSERT` privilege on the target projection, plus any narrowly scoped role-specific RLS policy required by the existing schema. If execution would require table ownership, `BYPASSRLS`, broad grants, or a role capable of general table writes, the proposal is a no-go.
3. The function is fixed, schema-qualified, non-dynamic SQL with a pinned safe `search_path`; it is not exposed through the public Data API. It accepts only the closed fixture inputs needed for one actor/profile/concept/status tuple and a bounded run identity. No free-form SQL, relation name, column name, row count, JSON patch, or caller-selected operation is accepted.
4. The only write is one insert into an already-existing actor-owned `user_concept_states` row. Allowed synthetic statuses are exactly `weak` or `forgotten`. The function must fail if any target state already exists; it must never upsert, update, delete, truncate, loop over arrays, batch, or write review/learning events, FSRS, competence evidence, catalog/content, Today snapshots, or unrelated tables. Existing schema constraints and the K2-05 effective-status contract must be independently checked before implementing the insert shape.

This is a staging fixture write to learner projection state. It must be treated and reported as synthetic even though it uses a disposable actor.

## Mandatory function checks

Before the insert, the function must fail closed unless it can verify all of the following from trusted database state and the protected runner context:

- The connected project is the exact configured staging project. Do not infer environment from a caller-supplied string or an unsettable-looking custom GUC.
- The target Auth identity exists, is confirmed as required by the established actor lifecycle, and carries the exact owner-created run marker for this repository, workflow/ref, run ID, attempt, staging project, creation time, expiry, and source SHA. The current shared marker binds workflow/ref/run/attempt/project/TTL but does not bind source SHA. Add a versioned K2-08-only marker path or another independently reviewed binding; do not silently change the accepted K2-07 lifecycle or its metadata contract.
- The supplied actor/profile/concept belong together: the owned English language profile belongs to that Auth actor; the concept is an eligible existing English word/phrase identity; and the actor is the disposable identity created by this exact run.
- The run source SHA is the protected workflow SHA checked against the live `master` tip before secret delivery and immediately before actor creation. The DB function must not trust a caller-provided SHA in isolation. Bind the verified SHA to K2-08-only, owner-created Auth metadata and check it from the database without returning Auth metadata to the runner. The exact marker version and trusted binding are an explicit design/review gate; if they cannot be proven without changing K2-07 or weakening its marker boundary, do not enable the function.
- The actor marker is unexpired under the existing strict TTL bound and belongs to the current attempt; malformed, stale, mismatched, or ambiguous identity metadata rejects the call.
- No matching target state exists before the insert. A conflict is an error; preserve the preexisting value and stop. Never treat an existing row as an invitation to replace learner state.

No diagnostic output may include Auth tokens, credentials, emails, private content, or actor/profile identifiers. Report only fixed outcome categories and the synthetic subcase label.

## Auth deletion, cascade, and retained-state proof

The function has no deletion capability. Existing Auth Admin cleanup remains the sole actor deletion path. The source schema already links `public.users.id` to `auth.users.id` with `ON DELETE CASCADE`, and `user_concept_states` links to both the user and owned language profile with cascading foreign keys (migrations `0001` and `0004`). Do not add direct executor deletes or new `UPDATE`/table-lock grants to make cleanup work.

Before hosted use, a disposable PostgreSQL concurrency test must race the one allowed insert against Auth-user deletion using the actual role/function/FK configuration. It must prove both serializations are safe: deletion wins and insertion fails, or insertion commits first and Auth deletion cascades the row. After Auth Admin cleanup, the existing harness must still prove Auth absence and zero actor-owned rows with the read-only actor probe. The separate current-run cleanup job remains mandatory.

The shared runner's retained baseline and after-snapshot must still compare the complete frozen 27-table learner inventory (counts and hashes) and pass unchanged. The proposed fixture row is expected to be removed by Auth deletion; retained production learner state must remain unchanged. A separate cleanup job PASS does not substitute for the main run's finalizer, Auth absence, actor-row absence, or retained comparison. No `finalizer_complete` or due-only subcase marker may be emitted as success unless its own required proof gates pass.

## Verification required before a decision

All of the following are prerequisites to requesting a human decision to authorize a staging implementation:

1. A separate security review of the exact SQL/function/grants, RLS behavior, database identity and SHA binding, Auth metadata reads, and failure modes.
2. Fresh disposable PostgreSQL tests using the same database migrations and role grants: privilege matrix; invalid actor/profile/concept/status/TTL/SHA; preexisting-row rejection; no update/delete/batch/dynamic SQL; insert side-effect inventory; Auth delete/insert race; FK cascade; and exact actor cleanup.
3. Prove the executor cannot select from learner/Auth/catalog tables or invoke any other function, and the function owner cannot login, bypass RLS, assume broad roles, or write outside the one permitted insert.
4. Re-run all existing actor lifecycle, metadata validation, Auth-only cleanup, probe, retained 27-table comparison, and workflow-security tests without changing K2-06 or the accepted K2-07 path.
5. Only after review and explicit approval: implement a staging-only migration and a separately guarded workflow step; store the new executor credential only as a GitHub Actions secret mapped to that one step. Do not modify the existing read-only role or its secret. Apply/provisioning, hosted dispatch, or role/secret creation require their own explicit authorization; this plan grants none.

If any requirement is not independently demonstrated, do not provision the credential or function. Continue credential-free implementation and PostgreSQL testing, and leave the full hosted K2-08 gate BLOCKED.

## Result labeling and content boundary

Any future authorized run must label this exact experiment `k2-08-due-only-synthetic-fixture`. It may report only whether Today consumed the single synthetic weak/forgotten fixture as expected, with the fixture cleaned and shared safety proofs complete. It must never be called natural weakness, forgetting, decay, or full K2-08 acceptance. It must not emit an overall K2-08 PASS. K2-06 Save/Learn semantics and the accepted K2-07 hosted record remain unchanged.

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
