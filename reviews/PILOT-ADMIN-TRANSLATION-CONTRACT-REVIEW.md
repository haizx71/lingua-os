# PILOT Admin Translation Authoring Contract Review

**Verdict: PASS on the corrected proposal. No unresolved HIGH or BLOCKER finding.** The initial review found an ambiguity around foreign Vietnamese translation rows; the frozen proposal now covers both non-empty replacement and explicit clear before any mutation.

## Review identity and artifact

- Reviewer configuration: GPT-6 Luna, Max reasoning effort (configured for this independent review; runtime model introspection is unavailable).
- Review date: 2026-10-10.
- Baseline: `af813819729ac36e1df432c7af28465f8d1cdc36`.
- Reviewed proposal: `plans/PILOT-ADMIN-TRANSLATION-CONTRACT.md`.
- Frozen SHA-256: `5e829ccab9e801a77942bd8da6573a7923b8252341c08eed25676eb6a1ee0115`.
- Approved-input reference: exact 72-pair translation candidate SHA-256 `25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`.

## Review evidence

The proposal keeps the change in the owner-only Admin authoring boundary. It adds a fixed Vietnamese complete-set operation, uses server-generated sentence order and exact English text for alignment, rejects partial or stale mappings, and requires an explicit empty list to clear translations. The contract does not accept sentence or source-record IDs from the client, does not add learner APIs or schema, and retains the existing Admin actor guard and published-content immutability boundary.

It accounts for the shared Pydantic whitespace-stripping configuration by requiring the translation DTO to preserve exact `sourceText` and Vietnamese text while validating blank Vietnamese separately. It also correctly requires metadata-only and identical-body PATCH requests to preserve sentence identity, annotations, and translations, and requires changed-body replacement to remove only server-owned translation rows before sentence deletion within one transaction.

The key selector ambiguity is now closed in the frozen proposal: before any non-empty replacement or clear, the transaction checks every affected sentence and returns `409` if any Vietnamese row is not part of the current Admin-authored set, preserving the foreign row and all state. This is necessary because the existing schema permits multiple rows for one sentence/language when their `source_record_id` differs (`database/migrations/0001_core_schema_v1.up.sql`), while the current Reader selects `ORDER BY id LIMIT 1` (`services/api/src/lingua_api/content/store.py`). The proposal explicitly forbids changing that selector or deleting foreign provenance and adds atomic PostgreSQL regression coverage for both non-empty replacement and clear.

The remaining gates are appropriately explicit: owner/learner authorization; exact 72-row mapping; duplicate replay without duplicate provenance; invalid and stale inputs with no partial writes; metadata-only/identical-body preservation; foreign-reference rollback; two-connection races against edit/validate/publish; generated contract freshness; Admin form regression; independent implementation review and exact-head CI/Preview before a staging catalog write.

## Finding resolution

The first frozen draft only required a foreign-row conflict check for clear. Because Reader’s selector could then serve an older allowed translation after a non-empty save, I reported a release-blocking contract gap. The corrected frozen proposal applies the same fail-closed preflight to all replacement and clear operations, preserves foreign provenance, and requires the focused regression. I verified the corrected wording and hash above; no blocker remains in the proposal.

## Scope and limits

This is a design-contract review only. No runtime, OpenAPI, database, hosted catalog, or learner state was changed or tested. The PASS allows the bounded implementation worker to proceed under the stated tests and later independent source review; it does not approve publication, a hosted write, or any change to accepted K2/V2 gates.
