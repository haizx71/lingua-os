# PILOT-READER-DICTIONARY Plan Review

Status: preliminary source/provenance review and exact design-plan review complete; implementation review pending.
Review date: 2026-10-11.
Review target: C:\Users\pc\.codex\worktrees\pilot-reader-dictionary\LINGUA_OS_PROJECT_STARTER at bb59cb171fd440b9cb097752a16e33dc800cac1b (detached HEAD, clean at review start).
External proposed plan: C:\Users\pc\.codex\artifacts\lingua-pilot\2026-10-11-reader-dictionary-integration-plan.md, SHA-256 a1c4d4c82523ea2bce40b15068e4142745b3b0723e18a0eb00e7077ed72dba5d.
Coverage preview: SHA-256 0a214737ca31b8fa8cc2255c501f7795e54d1d216b4dab38d238a79498e18733.
Raw source artifact: SHA-256 566a1b6b941d5ec792ce5f79f1830250076a5d9d517c1f3d1aa04dd4dc02482d.

## Scope and result

This is not the final design review and does not approve corpus activation or publication. It records the current repository boundary and independently checked source facts so the upcoming exact-hash plan review can build on them.

Corpus activation is BLOCKED until the specific records proposed for reuse have a reviewed source/license lineage and a compatible attribution and distribution plan. This is not a conclusion that Wiktionary data is uniformly unusable or that the whole corpus has one invalid license. Routine public-source research and local prototype work are authorized. A local prototype using synthetic or first-party fixture data is within scope; no additional owner approval is needed for that work. No hosted database or product state, provider resource, credential, billing, or learner state was changed.

## Repository and product gates

The repository remains at bb59cb171fd440b9cb097752a16e33dc800cac1b with a clean working tree at review start. ADR-016 classifies Wiktionary/Wiktextract as D/post-MVP and holds it pending explicit provenance/license approval. The Reader content specification requires complete provenance, approved source records, an allowed license, and representable attribution for every learner-visible dependency. It also says the extractor's software license does not license extracted corpus data.

The current GET /v1/dictionary/search is an authenticated search over published canonical concepts. It resolves the active learner profile, performs prefix matching, and returns canonical concept summaries with learner status and due-state overlays. It is not a plain-word lexical record lookup. Reader Analyze is a separate POST over supplied text and catalog concepts. The current annotated-token path in useReaderSession calls GET /v1/concepts/{conceptId} and records a lookup exposure; preserve that behavior unchanged.

Any new unannotated-token lookup should be a separate read-only path or artifact. It must not create or return a canonical concept identity, learner status, saved state, due state, or learner evidence. It should return only exact approved lexical records, preserve the tapped surface form, show all approved senses without silently selecting one, and expose required source attribution. If an endpoint is needed, make it additive in OpenAPI; do not broaden the existing concept-search operation. Use a fixed versioned artifact and key lookup, never a user-controlled file path or URL. Keep SQL parameterized, return bounded data with private/no-store behavior, avoid logging or analytics of clicked strings, and use no browser credential or provider fallback by default. The request lifecycle must cancel or ignore stale results across rapid taps, route changes, unmount, and actor changes. Tapping a plain word must not call the annotated-token exposure, save, progress, completion, Review, or FSRS paths.

## Exact source and provenance findings

The supplied artifact hashes match the hashes in the source audit. The coverage preview reports 133,447 English entries, 119,013 case-folded headwords and 190,805 raw senses. Its 16-form sample finds 15 forms and misses Mina. The preview marks itself READ_ONLY_LOCAL_RESEARCH_NOT_IMPORTED_OR_PUBLICATION_APPROVED; these counts are not whole-dictionary coverage, quality approval, or a record-level rights decision.

The current vi-Wiktionary visit page credits Hồ Ngọc Đức's Free Vietnamese Dictionary Project and carries a CC BY-SA footer with a notice that additional terms may apply. Its page revision is oldid 2403596 as observed during this review. The FVDP provenance page says its English→Vietnamese database has more than 109,000 entries, identifies about 5,000 technical terms as imported from VACETS, notes that some databases have specific licenses, describes GPL distribution, and records Ho Ngoc Duc's express no-objection to import under GFDL. The observed FVDP page revision is oldid 2033151. This is evidence for that described import permission, not blanket clearance for every current Wiktionary record or transformation. The linked VACETS provenance page describes project-participant intellectual property and asks that the original author and project team be acknowledged; it does not display a specific open-license grant. Applicable VACETS-origin records therefore need a documented rights path and their required acknowledgment, or quarantine.

The CC BY-SA 4.0 deed permits commercial reuse when its conditions are met: appropriate credit, license link, change notice, share-alike for adaptations, and no additional restrictions. Wikimedia Terms of Use explain that imported material may have source-specific attribution and may be CC BY-SA-only rather than GFDL; the applicable license should be established from the page footer, history, and discussion, and visible external-source notices should be preserved. If GFDL is the relied-on path, the transparent-copy and attribution requirements also need an explicit delivery path.

The raw Kaikki/Wiktextract object for visit does not contain source/reference or license fields, although the rendered source page contains FVDP attribution. The raw object alone cannot establish a selected record's source chain. The Wiktextract MIT notice covers the extractor software and must not be copied into a corpus license field. The current download URL is a moving raw-data path; the supplied compressed-file hash pins the local artifact bytes, but publication provenance still needs the upstream Wiktionary edition/dump date and source page revision IDs for each selected entry.

Before marking any record allowed for learner display, the reviewed subset needs a deterministic manifest mapping each served headword/POS/sense and visible example to its stable Wiktionary page/revision, raw source record hash, original and imported-source attribution (including FVDP/VACETS where applicable), exact license and version, source link/license text, transformation version, normalized hash, and modification notice. The delivery surface must provide attribution and required share-alike/transparent-copy material without additional restrictions. If a visible source element has an unclear or incompatible license, exclude/quarantine that element or record; do not assign one blanket license to all 119,013 headwords.

## Data-quality caveat

The checked raw sample has some explicit form_of senses, including visiting, going, and gone, but common entries visits, visited, and went do not carry explicit form_of relationships; their glosses describe forms in prose. The go noun's forms list includes goes tagged plural, which is not reliable evidence of verb conjugation. Do not derive lemma links from prose or the go noun form. Exact surface matches may return a reviewed surface entry; uncertain morphology must be quarantined or reported as unavailable.

## Evidence sources

- Repository: DECISIONS.md ADR-016; docs/READER_CONTENT_MVP_V1.md sections 8–10; contracts/openapi.yaml /v1/dictionary/search; services/api/src/lingua_api/dictionary/{routes,service,store}.py; apps/web/src/features/read/useReaderSession.ts.
- [Wiktionary visit entry](https://vi.wiktionary.org/wiki/visit)
- [FVDP source and GFDL permission record](https://vi.wiktionary.org/wiki/Wiktionary:Ngu%E1%BB%93n_g%E1%BB%91c/FVDP)
- [VACETS source and attribution notice](https://vi.wiktionary.org/wiki/Wiktionary:Ngu%E1%BB%93n_g%E1%BB%91c/VACETS)
- [CC BY-SA 4.0 deed](https://creativecommons.org/licenses/by-sa/4.0/)
- [Wikimedia Terms of Use](https://foundation.wikimedia.org/wiki/Terms_of_Use/en)
- [Kaikki raw data page](https://kaikki.org/dictionary/rawdata.html)
- [Wiktionary copyright guidance](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- [Wiktextract software license](https://github.com/tatuylonen/wiktextract/blob/master/LICENSE)

## Exact design-plan review

Reviewed plan: `plans/PILOT-READER-ANY-WORD-DICTIONARY.md`, SHA-256 `A839EC26AE68309BAA62CB8BE14CAD29E7FF62D7E5F35572B393E8268F2F91E8` (verified from the review worktree at `bb59cb171fd440b9cb097752a16e33dc800cac1b`, branch `codex/pilot-reader-dictionary-runtime`).

**Disposition: PASS for bounded local implementation; no HIGH or BLOCKER design finding.** This is not approval to activate Wiktionary/Kaikki records or publish corpus-derived data. The exact-record source/license/attribution/quality gate remains required before any such record is served. The first-party/synthetic local fixture path is within the already authorized prototype scope.

The design keeps the lexical artifact outside the canonical concept/catalog and learning-state model; adds an authenticated, GET-only exact lookup; preserves the existing annotated-token concept-detail/exposure path; returns all approved exact senses without context ranking; excludes learner fields and writes; pins the provider behind a read-only local SQLite boundary; and explicitly requires OpenAPI/generated types, bounded responses, private/no-store behavior, Unicode NFKC/casefold matching, cancellation/stale-result guards, actor isolation, and source attribution. No migration, hosted state change, external provider, credential, or billing is in scope. These constraints satisfy the independent boundary review for proceeding with local implementation.

Implementation review gates to carry forward (not plan blockers):

1. Keep the artifact location server-owned and fixed by trusted configuration or provider injection. Never derive a database path, table/column identifier, URL, or SQL fragment from `surface`; bind the normalized key as a SQL parameter and open only the expected artifact read-only. Missing/invalid artifact must fail closed as the plan says.
2. Choose concrete input/result limits in the OpenAPI schema and implementation. Reject invalid or oversized one-token input, and return every sense for an exact key within the documented bounded contract; page or return an explicit bounded-result error rather than silently dropping senses. Keep build and serving normalization versions aligned and record the normalization/Unicode version in the artifact manifest.
3. Enforce the plan's query-log prohibition at the actual transport boundary. Current `render.yaml` starts Uvicorn without `--no-access-log`; the installed Uvicorn access formatter logs `get_path_with_query_string(scope)`, so this GET's `surface` value would be emitted in the default access line. The Next API proxy also forwards the original query string (`apps/web/src/app/api/[...path]/route.ts:99`). Disable or safely redact access logging for this value before route exposure and verify captured logs contain no tapped surface. This is a MEDIUM privacy implementation finding, not a reason to change the GET contract in the local prototype plan.
4. Current FastAPI `RequestValidationError` handling discards the error object and returns the generic `The request is invalid.` envelope (`services/api/src/lingua_api/main.py:505-508`), so it does not echo the invalid surface today. Keep the new route on that sanitized handler and do not return validation context, normalized input, or query values in custom errors.

No design-plan edits were made. This review does not certify implementation, tests, exact-head CI, artifact packaging/promotion, deployment, or publication. The next independent gate is review of the frozen implementation manifest and focused regression evidence.



## Privacy amendment review — PASS

Review date: 2026-10-11. Exact reviewed file: plans/PILOT-READER-ANY-WORD-DICTIONARY.md, SHA-256 3EF93F4252BF4BE6232326EC15D34A9E08FB06F74E2AC9203EFDEF4746403A1A.

**Disposition: PASS for the bounded POST-body design amendment; no HIGH or BLOCKER design finding remains.** This authorizes implementation changes under this exact plan only. It does not approve source-corpus activation, publication, deployment, or hosted configuration changes.

The original GET query design was a confirmed HIGH privacy blocker for Vercel promotion. The catch-all Next proxy copies request.url.search at apps/web/src/app/api/[...path]/route.ts:99. Vercel Runtime Logs expose a Search Params field in request details, while Vercel Log Drains define proxy.path as including query parameters. Disabling Uvicorn access logs would not have removed the word from those platform URL observability fields.

The revised plan uses authenticated POST /v1/dictionary/lookup with a bounded JSON body containing only surface. It keeps the operation read-only, returns no learner state, and forbids application/body logging and error reflection. It requires proving that typed-client URLs and captured transport/access logs contain neither the tapped surface nor the body, including canonical, redirect, percent-encoded, and invalid-path cases. This addresses the identified URL-logging path without a hosted or global configuration change. Vercel’s cited logging docs describe request path/search-param metadata and do not document automatic request-body logging; the implementation must still honor the plan's explicit no-body-log rule.

Implementation may proceed under this plan. Before accepting code, independently verify the exact method/body contract, fixed URL/query behavior through Next proxy, sanitized errors, auth and actor isolation, no learner mutations, and focused tests. No surface word may appear in path, query, client URL, redirect location, or application/access-log output. Preserve the existing annotated-token GET/exposure behavior.

A documentation note: the plan's clean-at-bb59 statement describes the verified baseline at the start of the work; the shared worktree is now dirty from ongoing implementation. Clarify the baseline phrasing in a later doc-only update if the plan is edited again.

Evidence:

- [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime)
- [Vercel Log Drains log schema](https://vercel.com/docs/drains/reference/logs)
- Source proxy: apps/web/src/app/api/[...path]/route.ts:99
