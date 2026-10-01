# K2-08 Fixture Auth and RLS Review — 2026-10-01

**Finding:** The proposed staging fixture capability at proposal commit `60b01e2a637b50117a5df2cd5b316654b310661b` is **NO-GO AS WRITTEN**. No revised Auth trust path or privilege change is approved by this review.

**Evidence source:** Root-owned, read-only staging catalog metadata review on 2026-10-01. Only relation ownership, RLS flags, and policy metadata were inspected; no user rows, Auth metadata, IDs, or learner data were read.

**Assessment:** GPT-6 Luna / Max. **Documentation:** GPT-6 Luna / Medium.

## Aggregate staging RLS findings

- `auth.users` is owned by the managed Auth administration role. Row security is enabled, `FORCE ROW LEVEL SECURITY` is disabled, and there are zero policies.
- `public.users`, `public.user_languages`, and `public.user_concept_states` have row security enabled. Their current policies provide own-row `SELECT` to `authenticated`; the existing custom read-only acceptance role has `SELECT`-all policies. `public.concepts` has row security disabled.
- PostgreSQL 17 uses default-deny behavior for a table with RLS enabled and no applicable policy. A SQL `SELECT` grant does not bypass that row policy. Table ownership or `BYPASSRLS` could bypass row security, but the proposed boundary expressly excludes both. See the [PostgreSQL 17 Row Security Policies documentation](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), especially the default-deny and role-specific policy rules.

## Security consequence

The proposal's distinct `NOLOGIN`, non-owner, `NOBYPASSRLS` function owner cannot read the server-owned Auth `app_metadata` needed to verify the proposed one-shot actor/profile/concept/status binding under the current `auth.users` default-deny policy. A table-level `SELECT` grant alone does not make those rows visible. Existing `TO authenticated` policies on the public support relations also do not automatically apply to that separate function-owner role. Therefore the proposed SQL/function boundary cannot satisfy its stated Auth metadata checks as written.

This finding does not authorize adding or altering policies on managed Auth tables, granting table ownership or `BYPASSRLS`, adding role inheritance, using `service_role` or the read-only acceptance role as a writer, or introducing a new metadata-signing capability. Any alternative trust path needs a bounded design, independent security review, and explicit authorization before any privilege, secret, migration, hosted-run, or role change. Until that work is approved and verified, the proposed capability remains not authorized/not implemented/not applied and full hosted K2-08 remains BLOCKED.

The K2-08 source review and exact-head CI PASS on draft PR #35 remain separate evidence; they do not close this fixture authorization gap or establish hosted acceptance. K2-07's accepted evidence is unchanged. No migration `0020`, role, policy, secret, actor, or hosted state was changed for this review.
