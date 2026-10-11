# PILOT Reader Dictionary Independent Source Review — Preliminary

Review date: 2026-10-11 (Asia/Saigon)
Reviewer assignment: GPT-6 Luna, Max reasoning. The task assigns this reviewer profile; runtime introspection does not expose an independent serving-model ID, so no separate engine attestation is claimed.
Target: `C:\Users\pc\.codex\worktrees\pilot-reader-dictionary\LINGUA_OS_PROJECT_STARTER`
Branch/base: `codex/pilot-reader-dictionary-runtime` / `bb59cb171fd440b9cb097752a16e33dc800cac1b`
Scope: independent review of the frozen implementation, contract, CI additions, and local verification. No source, Git, hosted, actor, deployment, credential, or corpus mutation was performed.

## Disposition

**Preliminary implementation review: local synthetic-only prototype is acceptable; public release is HOLD.** The frozen implementation has one HIGH public-release blocker and one MEDIUM source-integrity gate below. No external dictionary corpus is activated or approved by this review. Do not promote the current frozen source to a public deployment until the HIGH finding is repaired and re-reviewed.

## Frozen evidence identity

- Implementation packet: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-dictionary-implementation.md`, SHA-256 `45443d29610eeb21b38a2bd057cdbb04ea7ccc3a4bfe5bc6b9f33252bf9002fc`.
- Build supplement: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-dictionary-build-gate.md`, SHA-256 `8daa48cd846f28b7a30e9061565ccf9f07fbd1c4ea1e774a3ad79d24f57ed3b0`.
- Source manifest: `C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-dictionary-source-manifest.json`, SHA-256 `1218061b80b122a2a7c8f90e7aa5a2cc26f7198e18c4df45ac445f59b8cf8091`.
- I independently checked the 23 manifest file hashes before and after review/tests: 0 missing paths and 0 mismatches. The source manifest records 20 runtime files with aggregate SHA-256 `1fe9e9d562bdc6ce1d843f0a05f0013c6109db0eab1b75a12b781aed756cb7a9`; this review file is deliberately excluded from that source aggregate.
- The working tree remains at base HEAD with only the frozen implementation/plan/review/test files listed in the source packet; no commit or Git state mutation occurred.

## Findings

### HIGH — unbounded request body can be buffered/parsed before authentication on public release

`apps/web/src/app/api/[...path]/route.ts:97-112` forwards the request search string, strips `content-length` in its header helper, and reads every non-GET body fully with `await request.arrayBuffer()` before forwarding. It has no route-specific size check or streaming cap. The dictionary request DTO limits `surface` to 80 characters, but that constraint runs after JSON parsing and does not bound raw body bytes; extra fields are also rejected only after parse. OpenAPI currently has no 413 and `tests/backend/test_dictionary_lookup_api.py` explicitly asserts no 413 response.

The installed FastAPI 0.141.1 handler source reads `request.body()` and parses JSON before calling `solve_dependencies` (the authentication dependency is solved after this body-read path). Therefore a direct unauthenticated request to a public API deployment can consume memory before bearer authentication rejects it. The Next proxy also buffers before the upstream API sees the request. No upstream request-size bound was verified in this task.

This does not block the current unmerged, loopback-only synthetic prototype. It is a HIGH promotion blocker for an externally reachable deployment. Required repair: add a lookup-route-only raw-byte limit before FastAPI parsing/auth and a matching lookup-route-only streaming limit in the Next proxy before body buffering; enforce actual streamed bytes rather than trusting `Content-Length`; return the existing static `VALIDATION_ERROR` 422 without echoing or logging input. Tests should cover missing, false, duplicate/oversized length headers, chunked streams, cancellation, and that rejection occurs before auth/body parsing and before forwarding. Keep the guard scoped to this route; do not change global proxy behavior. The implementation worker is preparing a plan-only amendment; no runtime edit is authorized until that exact plan is independently reviewed.

### MEDIUM — artifact approval marker and record-manifest digest are self-asserted

`services/api/src/lingua_api/dictionary/lookup.py:180-189` checks the artifact's own `approval_status == "approved"` and verifies that `record_manifest_sha256` is 64 lowercase hex characters. It does not recompute that digest or compare it with a server-trusted expected digest. The provider tests use the constant `"a" * 64`, which passes. The read-only path and trusted environment variable prevent request-controlled paths, but the embedded flag/hash alone cannot prove that the served records are the reviewed records.

No real source artifact is configured in the current local runtime, and all external corpus records remain held; this is not a blocker to the synthetic-only prototype. Before source activation, require a mandatory server-trusted expected artifact SHA-256, stream-verify it without loading all lexical rows, and ensure the verified artifact remains immutable/read-only for the process lifetime (or detect replacement before it can be reopened). A matching metadata string alone must not authorize content. Add tests for missing/mismatched expected digest and matching approved digest. This can be ordinary trusted configuration; no API key, signature service, or secret is needed.

## Source and licensing boundary

Repository policy is authoritative: ADR-016 and `docs/READER_CONTENT_MVP_V1.md` classify Wiktionary/Wiktextract as held pending exact provenance/license verification. The reviewed exact-form audit (`reviews/PILOT-READER-DICTIONARY-SOURCE-CANDIDATE-REVIEW.md`) records 15 English-section pages out of 16 requested forms, with Mina absent. `visits` is only a conditional morphology-relation candidate; it does not clear its meanings or other pages. The other English records remain held pending record-level source lineage, license, attribution/share-alike, and quality evidence. The 119,013 case-folded headwords / 190,805 raw-sense extract is not approved coverage.

The repository contains no activated Kaikki/Wiktionary meanings in the new implementation. The local preview/test data is first-party synthetic, clearly labeled, and outside the repository for the preview. The provider is unavailable by default if no artifact path is configured. No licensing conclusion or publication permission is given here.

## Verified implementation properties

- The additive contract is authenticated `POST /v1/dictionary/lookup` with strict `{surface}` body; OpenAPI and generated TypeScript agree, and the typed client uses a fixed path with no query parameters. The normal Reader flow sends only the selected token surface in the body.
- The route discards the authenticated actor and does not call profile, exposure, save, progress, Review, Memory, Competence, or Today operations. Unannotated tokens have no Save action. The existing annotated-token concept detail and exposure path remains unchanged and has a regression test.
- Normalization is NFKC plus case-fold, accepts the stated Unicode letter/mark and internal joiner forms, and requires exact indexed-key equality. SQL values use bound parameters; the artifact path comes from trusted server configuration and is not request-derived. SQLite opens with read-only/immutable flags. Exact results are all-or-error within entry, sense, record, and response caps; overflow fails closed instead of truncating.
- Validation, unavailable-provider, and generic errors use static messages without reflecting the surface/body. Application error logging records request ID and error type only. A real local Uvicorn access-log capture covers canonical, redirect, percent-encoded, and invalid-path variants; it shows fixed-path query redaction and no body/query sentinel.
- Reader request cancellation, timeout, token-to-token stale-result rejection, passage/request identity checks, actor epoch/identity guards, close/unmount cleanup, Unicode token boundaries, punctuation preservation, and UTF-16 offsets are implemented. The dictionary-specific tests cover token race and timeout; general Reader Actor A/B tests cover stale content loads, while there is no separate dictionary-lookup Actor A-to-B race test.
- The CI change is limited to adding the new API/provider/access-log test files and lookup modules to the existing Dictionary audit job's explicit pytest/Ruff lists. No workflow permissions, secrets, hosted jobs, or deployment configuration changed.
- No database migration, K2 change, learner-state write, source-corpus publication, provider resource, billing, or hosted mutation occurred.

## Verification

Independently rerun in the target worktree:

- `python -m pytest tests/backend/test_dictionary_lookup_api.py tests/backend/test_dictionary_lookup_provider.py tests/backend/test_dictionary_lookup_access_log.py tests/backend/contracts/test_openapi_v1.py -q` — **50 passed**.
- `pnpm exec vitest run tests/frontend/contracts.test.ts tests/frontend/http-client.test.ts tests/frontend/dictionary-lookup-client.test.ts tests/frontend/task-read-001-reader-live.test.tsx` — **83 passed**.
- `pnpm contracts:check-generated` — **passed**.
- `git diff --check` — passed; only existing CRLF normalization warnings.

The implementation packet additionally records touched-source mypy, Ruff, lint, package typechecks, and workspace checks passing. The separate production build supplement records `pnpm --filter @lingua/web build` exit 0 on Next.js 15.5.24 (19 static pages). Full `pnpm backend:typecheck` is not claimed: the packet documents a duplicate-conftest module mapping failure reproduced on untouched base `bb59cb1`; touched-source mypy passed.

## Promotion privacy limit

The normal client now keeps the selected surface out of path/query and sends only the bounded field in the POST body. The Next proxy still copies any caller-supplied query string generically, but the typed lookup client supplies none; the API access-log test redacts query strings on the lookup route. Vercel's Runtime Logs and Log Drains documentation exposes request search parameters/path metadata; moving the surface to the POST body addresses that identified URL path for the normal client. This local review did not deploy the code or inspect any configured production log drains/body logging. Before deployment, verify the actual platform configuration continues to exclude request bodies and that the fixed lookup URL has no query.

## Review artifacts

- Plan review: `reviews/PILOT-READER-DICTIONARY-PLAN-REVIEW.md` (the amended POST plan was reviewed before this implementation).
- Source candidate review: `reviews/PILOT-READER-DICTIONARY-SOURCE-CANDIDATE-REVIEW.md`.
- This preliminary report is outside the frozen 23-file implementation manifest. The bounded request/integrity plan amendment was independently reviewed and passed at SHA-256 `e2c960180a1c39af849a0e952ef0c3393d9184ce799a56ab37db303e6ebee5d1` before runtime edits. Root release remains required; after the amended runtime is frozen, this report should be updated with the final exact-source verdict and manifest.

## Amended plan review (pre-runtime release)

Review date: 2026-10-11. Reviewer assignment: GPT-6 Luna, Max reasoning (as assigned by the task; no separate runtime engine attestation is available). Exact plan: `plans/PILOT-READER-ANY-WORD-DICTIONARY.md`, SHA-256 `e2c960180a1c39af849a0e952ef0c3393d9184ce799a56ab37db303e6ebee5d1`.

Disposition: **PASS for the bounded design amendment; no HIGH/BLOCKER found.** The plan requires an observed 1,024-byte request-body limit at the route-specific ASGI boundary before FastAPI parsing/authentication and independently at the Next proxy before whole-body buffering or upstream forwarding. It rejects malformed/duplicate length declarations, counts streamed bytes even when length is absent or false, cancels on overflow/client disconnect, and uses the existing static non-echo `VALIDATION_ERROR` 422. It keeps the cap scoped to the dictionary lookup operation and calls for boundary, chunked, cancellation, unauthenticated, no-forwarding, and actual loopback proxy tests.

Artifact trust is also bounded: a separate root-trusted expected SHA-256 is mandatory and compared by a streaming startup hash; self-asserted artifact metadata cannot authorize records; the SQLite file must remain read-only/non-replaceable; a captured path/file identity is rechecked before opens and mismatches fail closed. Tests cover matching/missing/wrong digest, metadata-only rejection, replacement/change, and absence of per-request full-file hashing. This design is suitable for the local synthetic prototype and gated implementation. It does not approve any Wiktionary/Kaikki corpus record or authorize publication/deployment. Runtime changes remain subject to root release and a new exact-manifest final review.


## Final frozen-source review

Review date: 2026-10-11. Reviewer assignment: GPT-6 Luna / Max reasoning, as routed by the parent task. Runtime introspection does not provide a separate engine attestation.

Exact evidence identity:

- Worktree: C:\Users\pc\.codex\worktrees\pilot-reader-dictionary\LINGUA_OS_PROJECT_STARTER, branch codex/pilot-reader-dictionary-runtime, base/HEAD bb59cb171fd440b9cb097752a16e33dc800cac1b.
- Current plan-status file plans/PILOT-READER-ANY-WORD-DICTIONARY.md: SHA-256 0e0ff93fcdc71414e96723bd1a458fb427c614715d75492afac70600894fb7e8. The approved technical amendment was reviewed at SHA-256 e2c960180a1c39af849a0e952ef0c3393d9184ce799a56ab37db303e6ebee5d1; the later plan edit only corrected stale status wording and did not change its reviewed requirements.
- Corrected implementation packet: C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-dictionary-security-final.md, SHA-256 ff13ce7e22d8af58a5e2db7a3ff13cd9ef99065fbe38003cc543458e5f27ff63.
- Runtime source manifest: C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-dictionary-runtime-source-manifest.json, SHA-256 ff336594e2f610702b65e03e00f37d7d195881a12e6eaa16efa357f4094c69f7.
- I rechecked all 24 manifest entries against the worktree: 24/24 raw SHA-256 values and normalized Git blob IDs matched; 0 missing paths and 0 mismatches. The plan-status wording correction changed no runtime-manifest entry. No source, Git, hosted, actor, deployment, credential, or corpus mutation was performed.

### Final disposition

**PASS for the local synthetic/first-party prototype source; no HIGH or BLOCKER remains in the reviewed frozen runtime. Public corpus activation, deployment, and publication remain HOLD.** The earlier preliminary HIGH and MEDIUM findings below are retained as historical findings and are resolved for this bounded prototype by the reviewed changes described here.

### Historical finding resolution

- **Historical HIGH: request bodies could be buffered or parsed before authentication. RESOLVED in the frozen source.** The exact lookup operation now has a 1,024-byte observed-stream limit in the ASGI middleware before FastAPI parses JSON or evaluates auth, plus a separate route-scoped streaming limit in the Next proxy before whole-body buffering or upstream forwarding. The implementation rejects duplicate/malformed/conflicting length framing and length mismatches, counts actual bytes with or without Content-Length, cancels on overflow/disconnect, and returns a static private/no-store VALIDATION_ERROR 422 without echoing body or length. Focused actual-Uvicorn tests cover the inclusive 1,024-byte boundary and oversized/chunked unauthenticated rejection before auth/provider handling. Next tests cover bounded forwarding, rejection, cancellation, and no upstream call on rejected bodies.
- **Historical MEDIUM: artifact approval metadata and record-manifest hash were self-asserted. RESOLVED for the synthetic prototype trust boundary.** The provider now requires a separate trusted expected whole-artifact SHA-256, streams and compares it at startup, captures file identity, and checks path identity before SQLite opens. It opens SQLite read-only/immutable and fails closed on absent or mismatched artifacts and invalid lookup-time manifest/records. The embedded record_manifest_sha256 is still a format check; trust in this prototype is the separately configured expected digest pinning the complete artifact bytes, plus the offline approval process. For any real artifact, deployment must provide a reviewed expected digest and prove the file is externally non-writable/non-replaceable for the serving lifetime; no real lexical artifact is configured here.
- The 1,024-byte body limit also resolves the unauthenticated pre-parse memory exposure that blocked public promotion in the preliminary review. No new HIGH/BLOCKER was found in the frozen runtime/contract/CI changes.

### Reviewed behavior and boundaries

The route is authenticated, additive, read-only, and uses only {surface} in a bounded JSON body. The typed client calls the fixed /v1/dictionary/lookup URL without a query. The API discards the actor and does not write exposure, save, progress, Review, FSRS, or other learner state. Exact normalized lookup uses a bound SQL value and fixed trusted artifact path; SQLite is read-only/immutable; provider and response failures are bounded and static. Existing annotated-token detail/exposure behavior remains covered by regression tests. Unicode token selection retains punctuation and UTF-16 offsets, and stale/aborted responses are guarded by request, passage, and actor context. The Uvicorn access-log capture covers canonical, redirect, percent-encoded, and invalid-path variants with query redaction and no request-body logging.

The final packet records a successful built-Next loopback run with a local synthetic upstream: a 1,024-byte chunked request was forwarded once with matching byte count/hash; a 1,028-byte request was rejected with static 422, its sentinel was not echoed, and it was not forwarded. I inspected the proof script and packet, but did not independently rerun that loopback: my attempt to relaunch the hidden local Next/upstream processes was rejected by the execution tool's policy gate. The tool returned no more specific reason, no process started, and I did not retry.

### Verification

Independently run against the frozen source:

- python -m pytest -q tests/backend/test_dictionary_lookup_api.py tests/backend/test_dictionary_lookup_provider.py tests/backend/test_dictionary_lookup_access_log.py tests/backend/test_dictionary_lookup_request_limit.py tests/backend/contracts/test_openapi_v1.py — **57 passed**.
- pnpm exec vitest run tests/frontend/staging-api-proxy.test.ts tests/frontend/task-read-001-reader-live.test.tsx tests/frontend/dictionary-lookup-client.test.ts — **31 passed**.
- pnpm contracts:check-generated — **passed**.

The implementation packet separately records the full test suite, typecheck, lint, touched-source mypy, Ruff, and production web build as passing. The loopback result above is worker-recorded evidence, not an independently rerun reviewer check. The prior duplicate-conftest full backend typecheck failure remains a known base-repository issue reproduced at untouched bb59cb1; touched-source mypy passed.

### Remaining release gates

- Exact Wiktionary/Kaikki record activation remains unapproved. The 119,013-headword / 190,805-sense extract remains held. The exact-form review has 15 of 16 English pages resolved and Mina absent; visits remains only a conditional morphology/source candidate, and the other records require record-level lineage, applicable license, attribution/share-alike, quality, and distribution review. This is a precise source gate, not a blanket conclusion that all records are unusable.
- No artifact is configured by default, so the provider remains unavailable rather than returning a false no-match. Before activating any reviewed subset, freeze its exact approved records and packaging, configure the root-trusted artifact digest, and establish an externally read-only/non-replaceable file boundary.
- No production deployment or Vercel configuration was inspected or changed. Before deployment, verify the actual Runtime Logs/Log Drain settings do not capture request bodies and that the normal lookup client continues using the fixed query-free URL. The generic proxy can forward caller-supplied query parameters; the typed lookup client does not send the surface in a URL.

This final disposition supersedes the preliminary implementation review status at the beginning of this file. It does not approve corpus publication or production rollout.