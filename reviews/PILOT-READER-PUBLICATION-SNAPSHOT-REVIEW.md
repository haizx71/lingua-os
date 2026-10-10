# PILOT-READER Publication Snapshot SQL — Independent Review

**Current verdict:** PASS for the corrected SQL. No HIGH or BLOCKER findings remain.

**Reviewer configuration:** GPT-6 Luna, Max reasoning effort (configured worker packet; runtime introspection unavailable).

## Reviewed artifact

`C:\Users\pc\.codex\artifacts\lingua-pilot\reader-publication-retained-snapshot.sql`

- Initial reviewed version: SHA-256 `9ffc0aa9642b2118377b81e6a9d9d76f7fbfd1861b7e27584abf46da26a58523` — FAIL, retained below as historical evidence.
- Corrected reviewed version: SHA-256 `ddf98a2cd85945c3c87fde0266c47c51eb5ac14e19e16720babe7ca60b2d4fe3` — PASS.

## Corrected-version verification

I compared the corrected SQL with `tests/acceptance/support/k2_hosted_probe.py::_table_inventory` and `_snapshot`, then executed it only against a fresh local disposable PostgreSQL 17.11 container with synthetic schema and data.

The local database had the expected 27 learner tables and 19 catalog tables, a SELECT-only reader role, the expected RLS layout, a recursive `users` ownership edge, Unicode/JSONB rows, and empty tables. The SQL returned matching row counts and SHA-256 values for all 27 tables, and its total row count matched `_snapshot`. The empty-table digest matched SHA-256 of the empty byte string. A synthetic 20 KB row returned `snapshot_bounds_exceeded` with no table hashes.

The earlier local planning check also confirmed that a false count-gate parameter gives a one-time filter and skips the byte-scan relation. No hosted query, actor operation, publication, or learner-data read was performed by this reviewer.

## Original findings and resolution

1. **Original BLOCKER — `name[]` versus `text[]` inventory comparison.** The initial query failed on PostgreSQL 17.11 at line 83 before returning a snapshot. The corrected query casts both inventory aggregates to `text[]`; the corrected local execution passed.
2. **Original HIGH — row-text materialization before bounds.** The initial query could materialize the reusable full row-text CTE before checking limits. The corrected query now caps per-table count preflight at 100,001 rows, checks aggregate count, gates a streaming UTF-8 byte preflight on the verified count/role/inventory/policy conditions, and only then materializes `row_data` for the digest pass. It preserves the 30-second statement timeout and fails closed without hashes when the byte limit is exceeded.
3. **Original P2 — collation mismatch risk.** The initial digest used explicit `COLLATE "C"`, unlike the helper’s database-default ordering. The corrected digest orders `rows.row_text` with the same default collation as `_snapshot`; the local Unicode/multi-row comparison matched exactly.

## Security and scope review

The corrected SQL begins a `REPEATABLE READ, READ ONLY` transaction and sets a 30-second statement timeout. It checks the exact 27-table inventory, required owner columns, supported current role, SELECT visibility, absence of write privileges for the reader role, and expected RLS/policy posture. Count and byte checks precede digest materialization. Output contains only fixed status/error codes, table names, row counts, byte count, and SHA-256 digests; it does not return row contents. Static inspection found no DDL, DML, `SET ROLE`, grant changes, temporary tables, or raw-row output.

The local test is synthetic verification, not hosted acceptance. This verdict clears the corrected SQL for root-controlled, read-only use as the publication before/after comparison query. It does not authorize publication or any hosted writes. The root remains the hosted SQL executor.
