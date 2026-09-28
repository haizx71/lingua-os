# K2 hosted acceptance staging reader

Status: staged for review; never apply to another Supabase project.
Target: `bdmtdvvnbicgkfririjo`, database `postgres`, application ledger `0017`, Supabase ledger `0019` before this operation.

## Boundary

The merged K2 probe reads all rows in 27 learner-owned tables to compare a retained
learner snapshot before and after an acceptance run. It also reads
`schema_migrations` and seven catalog tables directly. Its published-content
check calls `reader_content_passes_publication_gate(uuid)`, whose invoker-rights
body and two helper functions read another eleven catalog tables. The resulting
allowlist is 46 public tables and three invoker-rights functions. The probe also
reads only `version` and `name` from `supabase_migrations.schema_migrations` to
prove the separately applied Supabase migration head; the migration SQL bodies
remain unreadable. PostgreSQL
system catalogs used for ownership and inventory discovery need no explicit grant.

On the verified staging schema, 25 of the 27 learner tables have RLS with only
`authenticated` owner-read policies. A new database role sees no retained rows
through those policies. The staging operation grants a dedicated permissive
`SELECT USING (true)` policy to the acceptance role on each of those exact 25
tables. This proves the complete snapshot without `BYPASSRLS` and leaves every
application policy unchanged for its existing roles. The role receives no
application/admin membership, no table write or schema/database create grant,
and a null password until the secure provisioning step activates it.

Versioned staging-only Supabase migration, applied through the connected
Supabase `apply_migration` operation with exact name
`k2_hosted_acceptance_reader_staging`:
`database/staging/20260928_k2_hosted_acceptance_reader.sql`. It is intentionally
outside the application migration chain: applying it to other environments
would create an unnecessary global reader. It advances the Supabase migration
ledger but leaves the application's `public.schema_migrations` at `0017`.
Generate the role password in the
staging database, pass it only through process memory to the pooler proof, and
store only the complete session-pooler URL in GitHub Actions repository secret
`K2_STAGING_READONLY_DATABASE_URL` after proof. Never put either value in this
document, source control, logs, or reports.

After the role-only migration succeeds, a one-shot staging administrator SQL
operation must create 32 random bytes with `gen_random_bytes(32)`, hex-encode
them, and use `format('ALTER ROLE k2_hosted_acceptance_reader PASSWORD %L',
generated_value)` to activate **that same** password. Return the value only
to an in-memory caller that streams it to
`scripts/k2_configure_staging_reader.py` on stdin. That script verifies the
session-pooler role and privileges before writing the single GitHub secret via
the `gh` CLI's stdin path. A failed proof must leave the secret unset.

## Gates

1. Prove the exact 46-table/three-function allowlist, all 27 snapshot counts
   against the staging administrator, role flags, RLS policies, lack of inherited
   membership, and absence of effective public-table write grants.
2. Activate the role with a 256-bit random password and verify a TLS connection
   through the Shared **Session** Pooler as
   `k2_hosted_acceptance_reader.bdmtdvvnbicgkfririjo` on port `5432`.
3. Run the merged read-only probe and negative DML, permanent DDL, role-change,
   and grant attempts inside rolled-back transactions. Also reject temporary
   DDL in the normal read-only harness transaction. Treat any unexpected
   success as failure and do not store the secret.
4. Set exactly one GitHub repository secret through CLI stdin. A separate
   owner/master-gated GitHub Actions preflight proves the same connection from
   an Ubuntu runner without creating or deleting an Auth actor.
5. K2-07 hosted acceptance remains blocked until the other staging secrets,
   Vercel Trusted Source rule, deployed SHA, and actor cleanup gates pass.

The staging database currently grants `TEMP` to PostgreSQL's `PUBLIC` pseudo
role. The dedicated role gets no explicit `TEMP` grant, but PostgreSQL still
inherits that default. A session can override its default read-only setting;
the proof therefore tests permanent DDL and all application-table writes under
an explicit read-write transaction. Revoking `PUBLIC TEMP` would affect other
database users and is outside this operation.
