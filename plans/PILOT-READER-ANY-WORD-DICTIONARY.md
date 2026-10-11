# PILOT-READER-ANY-WORD-DICTIONARY — bounded exact lookup

Status: **APPROVED — independent plan review PASS, 0 HIGH/BLOCKER**
Prepared: 2026-10-11
Scope: local Reader prototype and a gated, reusable English-to-Vietnamese lexical lookup path

Privacy amendment: use an authenticated `POST /v1/dictionary/lookup` with a JSON body containing only `{ "surface": "..." }`. The earlier GET query design is withdrawn because Vercel Runtime Logs and log-drain `proxy.path` may retain search parameters. This remains a semantically read-only lookup and adds no learner-state write.

Security amendment: cap this operation at 1,024 raw request-body bytes. Enforce the cap on observed streamed bytes before FastAPI parses the body or evaluates authentication, and independently in the same-origin Next proxy before buffering or forwarding. A valid `Content-Length` may support early rejection, but never replaces counting streamed bytes. Malformed/duplicate lengths and oversized or malformed requests return the existing static `VALIDATION_ERROR` 422 envelope without body echo, body logging, length/details leakage, or forwarding. This applies only to the dictionary lookup route; other proxy and API routes retain current limits. A configured SQLite artifact must also be bound to a fixed server-trusted expected SHA-256 and remain read-only/immutable for the serving process lifetime.

## Goal

Make every lexical word in Reader text selectable. For a selected unannotated word, show every exact, reviewed Vietnamese meaning available in the approved local lookup artifact. If no eligible entry exists, show “Chưa có nghĩa tiếng Việt đã duyệt”. Never guess a meaning, choose a sense from sentence context, or imply coverage the source does not have.

A clickable word is a UI capability; a meaning is available only when an exact eligible record exists. Pilot coverage is reported as separate counts for source records found, quality reviewed, rights reviewed, and actually served.

## Verified starting point

- At plan start, the worktree was clean at commit bb59cb171fd440b9cb097752a16e33dc800cac1b.
- TASK-008A already provides authenticated GET /v1/dictionary/search and GET /v1/concepts/{conceptId}. Search is a normalized prefix search over approved catalog lexemes/forms and can include lemma groups. It is not a complete English dictionary and does not promise a Vietnamese translation for every exact form.
- Reader token adaptation creates buttons only for catalog annotations. Unannotated text is left in plain fragments without word offsets. The existing annotated-token inspectToken calls GET /v1/concepts/{conceptId} and POST /v1/reader/exposures with exposureType=lookup; that accepted behavior can create passive evidence and remains unchanged.
- OpenAPI already has SERVICE_UNAVAILABLE; the proposed additive operation needs no new error code. Existing DictionarySearchResponse contains learner concept state, so it is not the response shape for independent lexical-source records.
- Render runs the Python service from the repository with Uvicorn and has no dictionary artifact packaging or persistent disk configuration today. No Render, Supabase, Vercel, deployment, secret, or actor changes are part of this plan.
- K2-06–K2-10 and FRLL remain frozen. Migration 0022 is already applied; this work does not change or reapply it.

## Source decision and review gate

Preferred persistent-data candidate is the Vietnamese-edition Wiktionary/Kaikki extract, held as an independent lexical artifact and never imported into concepts, lexemes, word_senses, or the K2 learning catalog.

Pinned candidate evidence:

- URL: https://kaikki.org/dictionary/downloads/vi/vi-extract.jsonl.gz
- Exact raw SHA-256: 566a1b6b941d5ec792ce5f79f1830250076a5d9d517c1f3d1aa04dd4dc02482d
- Preview: 133,447 English entries, 119,013 case-folded headwords, 190,805 raw senses; 15 of the 16 checked surface forms were present and Mina was absent.
- The preview is coverage evidence only. It is not a completeness, quality, or licensing approval. The full 119k-headword extract stays held because its transformed records do not retain enough original references/license detail for publication.

Before a candidate record is served, its exact source page/dump revision, raw-source identity, original and additional credits (including FVDP/VACETS where applicable), applicable license chain, required attribution, modification notice, share-alike duties, and Vietnamese gloss quality must be verified and retained in its record manifest. CC BY-SA 4.0 and the FVDP GPL/GFDL relationship may permit the reviewed use; that is not blanket clearance of the extract or of transformed records. Quarantine only records whose exact provenance, rights, or quality cannot be established. Do not require a full-corpus review before demonstrating the prototype.

Form handling is exact and conservative. Use only explicit, source-structured form relationships after review. A separate source audit found structured form_of senses for forms including visiting, going, and gone; visits, visited, and went do not carry that structured relation in the examined records. forms[] on visit/go is incomplete, and the goes tag is unreliable. A directly matched headword may show its own reviewed source gloss, but no lemma link or derived form may be invented from spelling, prose, a POS tag, or a morphology rule. The user chooses among all exact POS/sense options.

Microsoft Translator Dictionary Lookup is the best documented live technical alternative for EN→VI, but it needs an owner-provisioned secured resource and key, is metered, and reviewed documentation does not establish persistent output reuse rights. Do not create an account/resource, use billing, or add a credential. Free Dictionary API is English-only; Google/DeepL provide translation rather than lexical senses and their durable reuse terms are unresolved; Lingea requires a written EN–VI availability/rights quote. The first product path is therefore local and read-only. Provider research is recorded at C:/Users/pc/.codex/artifacts/lingua-pilot/2026-10-11-english-vietnamese-dictionary-provider-research.md.

## Proposed implementation boundary

### Lookup source

Add a small DictionaryLookupProvider boundary under the existing dictionary subsystem. Its serving implementation reads an immutable, prebuilt SQLite artifact with an indexed normalized surface key. SQLite is in Python's standard library; no new package or Postgres migration is assumed. The route does an indexed exact-key query against a read-only connection and never parses the compressed dump or loads all entries into process memory at startup/request time. When the artifact path is configured, a separate root-trusted `LINGUA_DICTIONARY_LOOKUP_ARTIFACT_SHA256` value is mandatory. At startup, stream the artifact through SHA-256 and compare the result before exposing the provider; never accept the expected digest from the artifact's own manifest or the request. Require filesystem permissions/mount behavior that prevents the serving process from changing or replacing the artifact. Capture the resolved path and file identity at startup and cheaply recheck device/inode/size/mtime/ctime before opening it for lookup; any missing digest, mismatch, or identity change leaves lookup unavailable. Do not hash the full artifact per request.

The artifact build step is offline and deterministic: input hash + transform version → exact selected records + artifact hash and manifest. Preserve source-record grouping and attribution rather than collapsing multi-source records. Store only entries approved for the target EN→VI display and required notices. Explicit reviewed form edges may map an exact surface to a source headword; no general lemmatizer is added. The artifact lives outside the repository until the exact-source review passes. A local first-party/synthetic fixture can exercise the provider and UI before candidate rights are approved.

Do not add artifact records to PostgreSQL learning tables. Do not change the existing Dictionary catalog search, Brain overlay, or its prefix semantics.

### Additive read API

Propose authenticated POST /v1/dictionary/lookup with a strict JSON body containing exactly one bounded `surface` string. Normalize with NFKC/case-fold and require exact equality only. The request body sends only the tapped word to LINGUA; it never sends the sentence or passage. The word is absent from the URL, query string, and route path so platform URL logging cannot retain it as a search parameter. The body is not logged by application or Uvicorn access logging.

The response is a new typed DTO, separate from ConceptSummary and learner state. It returns:

- the original surface and exact-match status;
- all exact source entries in deterministic source/POS order;
- optional POS and only explicit reviewed formOf references;
- all approved Vietnamese glosses in source sense order, without automatic sense selection;
- per-entry attribution/source URL, license code/link, and any required change/share-alike notice.

It has no concept ID, status, due date, saved flag, progress, exposure, or FSRS field. A genuine no-match or no-approved-Vietnamese-sense is an empty/explicitly unavailable result; a missing, invalid, or unapproved artifact fails closed as SERVICE_UNAVAILABLE, not as a false “word missing”. The contract must set response bounds and reject or page an oversized exact key rather than silently truncating senses. The response uses Cache-Control: private, no-store. The request schema rejects extra fields. The raw body limit is 1,024 bytes, in addition to the existing per-surface character/token bound. Malformed JSON, missing/extra body fields, over-limit bodies, and invalid lexical surfaces return the existing generic static `VALIDATION_ERROR` 422; neither response details nor application logs echo the body, rejected byte count, or validation input. The limit is enforced before FastAPI body parsing and authentication, not merely by a Pydantic field bound.

The new endpoint uses the existing bearer-auth dependency but does not resolve a learner profile or query learner-state tables. No URL component contains the tapped word, and access logs contain only the method and fixed path. No application log may include request bodies. No external provider or browser key is introduced. Update contracts/openapi.yaml and generated TypeScript in the same implementation if this additive operation is approved.

### Bounded request transport and artifact identity

Before implementation, add a route-specific raw-body guard at the ASGI boundary for the canonical `POST /v1/dictionary/lookup` path. It counts received body bytes, retaining at most 1,024 bytes before handing the complete request to FastAPI. It must reject an over-limit body before JSON parsing and before auth dependencies run, use the existing generic 422 error envelope, and never log or reflect the input, byte count, parser details, or body metadata. Parse and reject malformed or duplicate `Content-Length`; use it only for a safe early rejection, then still enforce the streaming byte count. The observed stream is authoritative when the length is absent or under-reported. Cover chunked/no-length input, mismatched or duplicate length handling, disconnect/cancellation while reading, and ensure only this exact route is affected. Other endpoints and their request limits must not change.

The Next same-origin API proxy must special-case only `POST /api/v1/dictionary/lookup`: check its declared length where valid, then read the incoming `ReadableStream` incrementally and stop once the 1,024-byte cap is exceeded. Do not call `request.arrayBuffer()` on this route before enforcing the cap. Cancel/close the reader on rejection or client cancellation. Forward only a complete under-limit body. Return the existing static `VALIDATION_ERROR` 422 without contacting the upstream for over-limit or malformed input. Preserve current proxy behavior and limits for every other route. This does not rely on Vercel configuration changes.

Artifact activation requires both a configured immutable SQLite file and a separate trusted digest. Use a non-secret server-side setting named `LINGUA_DICTIONARY_LOOKUP_ARTIFACT_SHA256`; it must be supplied by root-owned configuration and cannot be sourced from the artifact's self-declared `record_manifest_sha256`. Stream-hash the file once during provider construction/startup, compare with the fixed expected SHA-256, and fail closed if the expected value is missing/malformed or the digest differs. Keep the serving file read-only and non-replaceable for the process lifetime. Record resolved path plus device, inode, size, modification time, and change time at startup; cheaply recheck file identity before each SQLite open and fail closed on replacement/change. Use read-only SQLite mode. Never rehash the full artifact per request or use the digest as a secret.

Tests must prove: exactly 1,024 streamed bytes can reach normal validation; 1,025 bytes fail before parser/auth; the cap works with absent length and chunked input; false/duplicate/malformed lengths do not bypass it; cancellation stops further reads/forwarding; an unauthenticated oversized request gets the static 422 before authentication; malformed JSON and all size errors do not echo content, request bytes, or parsing details; other proxy routes retain existing forwarding behavior; and the real loopback Next proxy streams/limits the request before reading it wholesale. Artifact tests must prove a matching trusted digest serves, missing/wrong expected digests fail closed, metadata alone cannot approve an artifact, replacement or changed file identity fails closed, and no full-file hash is computed per lookup.

### Reader integration

- Extend the sentence token adapter to split only unannotated gaps into Unicode-aware lexical spans while preserving the original text, punctuation, whitespace, and UTF-16 [startOffset, endOffset) positions. Keep contractions and internally hyphenated words as a single token when the tokenizer recognizes them. Do not make punctuation, whitespace, or numbers lookup buttons.
- Render all lexical spans as keyboard-accessible buttons. Annotated spans continue to call the existing inspectToken path unchanged. Unannotated spans call a separate lookupWord path with the exact surface only.
- Reuse the current Reader detail panel where practical, but render every exact POS/sense option and its source/attribution. Omit the “Lưu vào ôn tập” action for an unannotated lookup. Show clear loading, no-match, no-approved-gloss, unavailable, error, retry, and success states.
- Add request cancellation and stale-result guards using the existing AbortSignal client support plus lookup sequence, actor epoch, passage/request identity, and close-panel invalidation. A tap on word B, passage switch, actor transition, close, or unmount must prevent word A's late result from replacing current UI. Use a bounded client timeout.
- This POST is semantically read-only and never calls recordReaderExposure, saveConceptToLibrary, Reader progress, Review, Memory, Competence, or Today operations. Existing annotated-token lookup continues its accepted exposure behavior.
- Use one typed client/provider operation that a future standalone Dictionary page can call. The first implementation may leave apps/web/src/features/dictionary/DictionaryView.tsx unchanged; the Reader request does not require a second discovery UI or a redesign.

## First-stage usable prototype

After root design review passes, build a local prototype with a tiny first-party/synthetic fixture and the additive exact lookup path. It must demonstrate:

1. tapping an annotated token preserves existing concept-detail and exposure behavior;
2. tapping unannotated ordinary, function, proper-name, and Unicode/diacritic words opens the same Reader panel;
3. exact multi-sense choices are visible; a prefix-only candidate is not returned;
4. a structured form relation can be displayed, while visits/visited/went do not gain guessed lemma links;
5. missing gloss, unknown form, Mina, unavailable artifact, timeout, and API error are clear states;
6. only an exact surface string is sent and the request emits no learner mutation.

Keep the fixture test-only or external to the repository; do not place unreviewed Wiktionary text in source or generated artifacts. After exact-record review, a small approved subset from the 16-form coverage audit can replace/add to the local fixture. Track the served exact forms in a reviewed manifest; the remaining unreviewed records stay withheld without blocking approved ones.

## Verification and release gates

1. **Design review:** root and an independent reviewer review this plan amendment, the 1,024-byte streamed-body boundary in ASGI and Next, generic errors/logging, separation from learner concepts, exact form behavior, trusted artifact digest/identity checks, data artifact strategy, privacy properties, and proposed changed-file list before implementation changes.
2. **Local source/sample gate:** review a small exact subset record by record. Record source page/revision, applicable licenses/credits, changes/notices, translation quality, and exact covered surface forms. If no candidate records pass yet, the first prototype remains usable with local first-party/synthetic fixture data.
3. **Contract and implementation:** add the API contract and generated typed client, route-specific pre-parse body guard, streaming Next proxy bound, trusted artifact digest/identity check, offline indexed artifact reader, and Reader span/lookup flow. Add no migration unless later evidence proves a relational product-store change is necessary.
4. **Independent implementation review:** after design approval, freeze the exact changed-source manifest and obtain separate GPT-6 Luna Max implementation/security review. Resolve required findings and re-review exact hashes.
5. **Privacy and transport proof:** test a canonical POST body and confirm the typed-client URL contains no surface or query string. Exercise raw unauthenticated ASGI/HTTP requests at the exact 1,024-byte boundary and above it before body parsing/auth; include absent, chunked, false, malformed, and duplicate Content-Length, malformed JSON, and cancellation cases. Capture actual Uvicorn access-log output for canonical, redirect, percent-encoded, and invalid path variants and confirm neither the surface nor body appears. Exercise the built Next proxy over loopback against a local recording upstream, proving the lookup body is counted incrementally before any whole-body read and rejected bodies are never forwarded. Confirm 422 responses have only the existing static `VALIDATION_ERROR` envelope and no body, byte-count, or parser-detail echo.
6. **Local verification:** focused backend and frontend tests, OpenAPI validation and generated freshness, typecheck/lint/build for changed surfaces, and git diff --check. Tests must prove no learner-state row/count/hash change around lookup POST, plus annotated behavior regression. Provider tests must cover a valid independently configured expected artifact digest, missing/wrong expected digest, self-asserted metadata, and artifact replacement/change after startup.
7. **Promotion:** root owns exact-head CI, artifact packaging decision, and any rollout. This plan authorizes no hosted writes, actor creation, migration, provider resource, billing, secret, deployment, Git, or release action.

Minimum expected source files after approval: contracts/openapi.yaml, generated packages/types/src/generated/openapi.ts and DTO alias if needed, packages/types/src/client.ts, new read-only dictionary provider/route/model and route-specific ASGI body guard under services/api/src/lingua_api/dictionary/, services/api/src/lingua_api/main.py, packages/types/src/view-models.ts and packages/types/src/adapters/index.ts, apps/web/src/features/read/useReaderSession.ts, apps/web/src/features/read/InteractiveReader.tsx, apps/web/src/app/api/[...path]/route.ts, tests/frontend/staging-api-proxy.test.ts, and focused backend body/provider/access-log tests. A source build script and data manifest may be added after exact rights review. No change is planned to database/migrations/**, knowledge-v2/**, K2, existing searchDictionary, existing annotated-token exposure semantics, or hosted configuration in the initial implementation.

## Known limits

The 15/16 sample is not a promise of general English coverage and is not the number of approved forms. Every word remains tappable; unavailable/unreviewed entries remain explicitly unavailable. No context-based sense ranking, automatic morphology, sentence translation, AI translation, learner history, or learning benefit is claimed.
