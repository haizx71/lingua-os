# Reader / Content Service MVP v1

Status: **DESIGN / CONTRACT FREEZE**  
Task: `TASK-008`  
The public contract and generated TypeScript contract artifacts are frozen in this turn. Runtime,
database migrations, frontend application changes, import pipelines, and dataset ingestion remain
intentionally absent.

## 1. Scope and invariants

Reader v1 serves a Vietnamese learner of English at curated A0-B1 difficulty. It supports a short,
mobile-first reading loop within a 20-30 minute daily learning habit:

1. discover a bounded, published content item;
2. open its ordered segments and sentences;
3. render server-authored concept occurrences with the learner's `ConceptStatus`;
4. fetch dictionary detail lazily when an occurrence is opened;
5. save concepts, sentences, or content through the existing Library authority;
6. persist a robust segment-level resume position;
7. record deliberate read, listen, or lookup encounters as passive TASK-006D evidence.

Reader v1 does not generate explanations, tutor chat, translations, pronunciations, speech scores,
or content at request time. It does not perform speech recognition, forced alignment, CJK behavior,
formal CEFR certification, frontend competence calculation, FSRS scheduling, or Today ranking.
`POST /v1/reader/analyze` may use only deterministic English sentence splitting and indexed
lexeme-form matching; no provider or complex NLP inference is required.

## 2. Current architecture

The current repository already separates shared language/content truth from learner-owned state:

```text
licenses -> data_sources -> source_records
                              |-> concepts -> lexemes -> word_senses
                              |-> sentences -> sentence_translations
                              |               -> sentence_concepts
                              |-> content_items -> content_versions
                                                -> content_segments
                                                -> content_concepts
                                                -> content_metrics

authenticated learner -> user_languages
                       -> user_concept_states
                       -> user_saved_{concepts,content,sentences}
                       -> exposure_events -> learning_events -> TASK-006D projections
```

PostgreSQL is the persisted authority. FastAPI is the only product read/write boundary. Published
content is shared system-owned data; saves, progress, exposure source facts, canonical learning
events, and learner projections are actor-owned. The frontend currently consumes deterministic
OpenAPI DTO mocks through adapters. Reader resume position is explicitly
`NOT_YET_PERSISTED`. The OpenAPI routes are now authoritative contract declarations only; no
Reader/content runtime route exists yet.

The schema is strong enough for provenance, lexical truth, saved state, content ordering, sentence
annotations, and passive projection. It is not yet sufficient for the complete Reader v1 write
model: there is no progress relation, `content_segments` has no stored `segment_type`, and the
existing concept-scoped `exposure_events` path cannot persist one Reader source action that derives
many concept learning events.

### Contract-freeze resolutions and remaining schema gaps

- OpenAPI requires `ContentSegment.segmentType`; the database does not store it.
- OpenAPI permits a segment to contain many sentences; the database permits zero or one. Reader v1
  deliberately uses one sentence per segment, so this is a bounded representation rule rather than
  a required join-table redesign.
- OpenAPI optionally emits `difficultyLabel`; the database has no explicit curated content level.
- The singular `Attribution` DTO cannot faithfully expose mixed-source/mixed-license content. MVP
  publication therefore forbids such composition unless one complete aggregate attribution is
  legally sufficient.
- The former "analyzed or catalog" save promise is corrected to catalog-only; transient analyzed
  text has no private learner-owned persistence entity in MVP.
- The former `SaveSentenceRequest.conceptIds` field is removed; the server resolves
  `sentence_concepts`.
- Public Reader exposure and progress mutations are now declared, but runtime and persistence do
  not exist yet.

## 3. Current OpenAPI audit

Global bearer authentication applies to every route below. UUIDs are stable identifiers and all
timestamps are RFC 3339 UTC.

| Route | Request | Response | Paging / idempotency | Persistence | Existing schema fit |
|---|---|---|---|---|---|
| `GET /v1/concepts/{conceptId}` | path UUID | `ConceptResponse` | none | read-only | Yes for lexical concepts and learner overlay; attribution selection must be deterministic. |
| `GET /v1/dictionary/search` | query, optional language, cursor, limit | `DictionarySearchResponse` | opaque cursor | read-only | Yes via `lexemes(language_code, normalized_form)` and published/approved source filtering. |
| `POST /v1/reader/analyze` | bounded text, target language, translation language, optional title | transient `ReaderAnalyzeResponse` | no idempotency | no persistence | Yes for deterministic indexed matching; realtime translation is out of scope. |
| `POST /v1/reader/save-sentence` | authoritative catalog `sentenceId` only | `LibraryMutationResponse` | required `Idempotency-Key` | learner save | Catalog-only and server-resolved; transient analyzed sentences are invalid. |
| `POST /v1/reader/exposures` | discriminated `read` / `listen` / `lookup` command using catalog identities | `ReaderExposureResponse` | required `Idempotency-Key` | future learner exposure source fact | Contract frozen; runtime and fan-out persistence require migration/implementation. |
| `PUT /v1/reader/progress/{contentId}` | profile, current segment, completion flag | `ReadingProgressResponse` | required `Idempotency-Key` | future learner progress projection | Contract frozen; runtime and persistence require migration/implementation. |
| `GET /v1/content/recommended` | optional language profile, cursor, limit | `ContentRecommendationsResponse` | opaque cursor | read-only | Mostly. Needs curated level metadata and publication-gate enforcement. |
| `GET /v1/content/{contentId}` | path UUID | `ContentResponse` | none | read-only | Mostly. Segment type needs persistence; one sentence per segment is the MVP representation. |
| `GET /v1/library/items` | optional item type/query, cursor, limit | `LibraryItemsResponse` | opaque cursor | read-only learner library | Yes; progress is absent from content summaries. |
| `PUT/DELETE /v1/library/concepts/{conceptId}` | path UUID | `LibraryMutationResponse` | intrinsically idempotent | save/unsave | Yes. |
| `PUT/DELETE /v1/library/content/{contentId}` | path UUID | `LibraryMutationResponse` | intrinsically idempotent | save/unsave | Yes. |
| `PUT/DELETE /v1/library/sentences/{sentenceId}` | path UUID | `LibraryMutationResponse` | intrinsically idempotent | save/unsave | Yes for catalog sentences. |

Content detail is intentionally unpaged in v1. Publication caps an item at 100 segments and 20,000
words, keeping the existing response bounded. Lists continue to use the authoritative opaque cursor;
offset pagination is not introduced.

## 4. Frozen OpenAPI amendment

The approved smallest coherent amendment is now present in `contracts/openapi.yaml`:

1. add `POST /v1/reader/exposures`;
2. add `PUT /v1/reader/progress/{contentId}`;
3. add optional `readingProgress` to `ContentSummary`, which is already a learner-overlaid DTO;
4. constrain `ContentSegment.segmentType` to a shared enum: `sentence`, `paragraph`,
   `dialogue_turn`, `caption` (Reader v1 persists `sentence` for its one-sentence segments);
5. remove `conceptIds` from `SaveSentenceRequest` and change the operation summary to catalog
   sentences only. Persisting learner-provided analyzed sentences is deferred pending a privacy and
   ownership design.

No existing error code was added. The public `reader_exposure_type` enum contains exactly `read`,
`listen`, and `lookup`; `content_segment_type` contains `sentence`, `paragraph`, `dialogue_turn`, and
`caption`; and `reader_content_level` contains `A0`, `A1`, `A2`, and `B1`. All three registries are
frozen in `contracts/enums.json`.

## 5. Smallest Reader exposure contract

### Operation

```text
POST /v1/reader/exposures
Authorization: Bearer <Supabase JWT>
Idempotency-Key: <UUID>
```

The request is a discriminated union with `additionalProperties: false`.

```text
segment exposure (read or listen):
  languageProfileId: UUID
  contentId: UUID
  segmentId: UUID
  exposureType: read | listen
  occurredAt?: RFC3339 UTC

lookup exposure:
  languageProfileId: UUID
  contentId: UUID
  segmentId: UUID
  sentenceId: UUID
  startOffset: integer >= 0
  endOffset: integer > startOffset
  exposureType: lookup
  occurredAt?: RFC3339 UTC
```

All sentence occurrence offsets are zero-based UTF-16 code-unit indices and use a half-open range
`[startOffset, endOffset)`, with `endOffset > startOffset`. This matches the frozen TypeScript
presentation boundary and gives importers/runtime one reproducible slicing convention.

The client never sends `userId`, concept IDs, weights, scores, competence, mastery, FSRS state, or
status transitions. For lookup, sentence and offsets identify an exact authoritative
`sentence_concepts` occurrence; the server resolves its concept. For read/listen, the server resolves
all distinct concepts linked to the segment's sentence. Optional `occurredAt` is audit input only;
when absent the accepted server time is used. A supplied value must not precede content publication
or be more than five minutes in the future. TASK-006D projection order remains server ingestion
order.

The response uses the standard envelope:

```text
ReaderExposureResult:
  exposureId: UUID
  contentId: UUID
  segmentId: UUID
  exposureType: read | listen | lookup
  acceptedConceptCount: integer >= 1
  occurredAt: RFC3339 UTC
  recordedAt: RFC3339 UTC
```

It deliberately omits masses, scores, resulting mastery, and internal learning-event IDs.

### Validation, ownership, and errors

- Resolve the actor exclusively from JWT and verify the owned active `languageProfileId`.
- Require profile, content, segment, sentence, occurrence, and concepts to be English and mutually
  related. Never accept a client-selected learner or concept.
- Return `404 NOT_FOUND` for absent or non-published content to avoid disclosing private imports.
- Return `403 FORBIDDEN` for a language profile not owned by the actor.
- Return `422 VALIDATION_ERROR` for shape, language, hierarchy, offset, or action-eligibility errors.
- Return `409 IDEMPOTENCY_KEY_REUSED` when the same actor/key has a different fingerprint.
- Return `409 CONFLICT` while the same actor/key/fingerprint is still in flight.
- Preserve `401`, `429`, and `500`; raw database messages never cross the boundary.

The fingerprint covers the owned profile, content, segment, optional sentence/offsets, exposure type,
and normalized source occurrence time. Same actor/key/fingerprint returns the exact stored result
without another projection. A different key denotes a new declared learner action and is subject to
rate limits and action validation.

## 6. Exposure granularity and duplicate control

Reader records deliberate encounters, not page rendering:

| Interaction | Exposure? | Rule |
|---|---:|---|
| Content opened | No | Creates/updates Reader progress only. |
| Segment merely enters viewport | No | Prevents scroll and rerender noise. |
| Segment completed while reading | Yes, `read` | Emit once after the segment began in view and its end was crossed while the document was visible. No dwell score is inferred. |
| Sentence tapped without opening a concept | No | Not concept evidence. |
| Exact concept occurrence opens dictionary detail | Yes, `lookup` | One source event for that occurrence and deliberate open. |
| Segment audio played | Yes, `listen` | Emit after natural end or at least 90% playback with at least 80% of media traversed; seeking directly to the end is not eligible. |

For read/listen, one source `exposure_events` row snapshots all distinct authoritative concepts in
that segment and derives one canonical `learning_events` row per distinct concept. Repeated tokens of
the same concept in that segment create one child, not one event per word. Lookup derives exactly one
child. Derivation keys remain `concept:<concept_uuid>`:

```text
exposure_events.id (source_event_id)
  -> learning_events.learning_event_id [1..N]
```

The caller must allocate and retain one idempotency key per eligible logical action, reusing it
across rerenders, refresh, timeout, retry, and reconnect. Scrolling away and back does not emit
because viewport entry is not an action. Repeated framework events within the same logical
interaction reuse the same key and therefore return the same result rather than creating a second
source event. Backend fingerprint uniqueness, child derivation
uniqueness, action bounds, and actor rate limiting provide the server-side layers. A deliberate later
reread uses a new key and may be recorded as another passive encounter.

Every accepted child increments exposure history and may move `unseen -> discovered`. It never
changes competence mass, competence score, competence confidence, mastery, FSRS state, or any other
ConceptStatus by repetition alone.

## 7. Content domain authority

| Entity | MVP meaning | Authority / ownership |
|---|---|---|
| `licenses` | Normalized legal/use policy, canonical URL, attribution requirement | System reference data; never learner-editable. |
| `data_sources` | A pinned upstream/internal dataset or publisher snapshot and its attribution rule | System ingestion authority. |
| `source_records` | One upstream record snapshot identified by upstream key, SHA-256, transform version, QA/review state | Immutable import/audit authority in practice; implementation must prohibit silent replacement. |
| `content_items` | Stable Reader catalog identity and publication lifecycle | System-owned; only published English items are product-readable. |
| `content_versions` | Content hash and source snapshot audit | V1 permits one published structure per item. Published structure is immutable; correction retires it and publishes a new item ID. |
| `content_segments` | Ordered Reader unit; v1 stores exactly one sentence segment | System-owned normalized content. |
| `sentences` / `sentence_translations` | Reusable English sentence and optional reviewed Vietnamese translation | System-owned lexical/content truth. |
| `sentence_concepts` | Authoritative occurrence by sentence offsets and role | Server annotation authority. |
| `concepts` | Language-level semantic/skill identity | Language Brain authority. |
| `lexemes` / `lexeme_forms` / `word_senses` | Lexical spelling, morphology, POS, and dictionary senses | Dictionary authority; Reader does not copy it. |
| `content_concepts` | Precomputed per-content distinct concept counts | Content aggregation/index authority, checked against occurrences. |
| `content_metrics` | Precomputed token/sentence/difficulty support metrics and method version | Content QA/read-model input, not learner evidence. |
| saved tables | Owned Library membership | Learner-owned, Library authority. |
| future progress row | Furthest stable segment resume point and timestamps | Learner-owned, Reader authority. |
| `exposure_events` / `learning_events` | Reader action source fact / canonical replay children | Learner-owned audit and TASK-006D replay authority. |

No Neo4j or duplicate Reader dictionary entity is introduced.

## 8. Provenance chain

The minimum production chain is:

```text
licenses(code, canonical_url, usage_policy, attribution_required)
  <- data_sources(name, source_type, source_version, source_url, attribution_text)
     <- source_records(source_record_key, raw_hash, transform_version,
                       imported_at, quality_score, review_status, metadata)
        <- normalized content / sentence / lexical entity
```

`source_version` is a pinned dump/release/snapshot identifier, not `latest`. `source_record_key` is
the upstream stable ID. `raw_hash` hashes the exact imported record. `transform_version` identifies
the importer plus normalization rules. `metadata` may carry upstream author IDs, per-record URLs,
parser version, and change notices, but must not replace normalized required columns. Imported and
reviewed timestamps, quality, and review state are retained. Product `Attribution` is derived from
this chain whenever required; internal hashes and QA fields remain private.

No normalized entity is published if its own source record, or a Reader-visible dependency's source
record, is missing or unapproved. Production data must never inherit the extraction tool's software
license as its data license.

## 9. Data-source classification

The following classification is approved contract/design policy. It is not permission to ingest.

| Source | Class | MVP role and exact allowed subset | Decision / requirement |
|---|---|---|---|
| First-party LINGUA curated records | **A — production candidate** | Small reviewed A0-B1 Reader texts, English senses, Vietnamese translations, annotations, and seed audio owned/licensed by the project | Preferred MVP baseline. Store an internal allowed license, author/version, hashes, and reviewer state exactly like external data. |
| Tatoeba | **A — production candidate, conditional** | Selected English sentences and direct Vietnamese translations for dictionary examples or single-sentence Reader segments | Text defaults to CC BY 2.0 FR and requires author/source attribution; preserve sentence IDs, author list, per-record license, snapshot, and modification notice. Do not assume audio shares the text license. Deduplicate normalized text and reject indirect/unreviewed translations. |
| `ipa-dict` English US | **A — production candidate, conditional** | IPA lookup enrichment only, never definitions or content | Pin the exact release/commit and `en_US` file, preserve MIT notice and upstream credits, normalize spelling and IPA variants, and review homographs. Other locale files have distinct upstream terms and are not automatically approved. |
| Wiktextract / English Wiktionary | **D — post-MVP** | Potential lexeme, form, POS, pronunciation, and sense enrichment | **REQUIRES LICENSE / SOURCE VERIFICATION.** The extractor is MIT, while Wiktionary text is CC BY-SA/GFDL and may contain separately licensed material. A share-alike publication/attribution plan and record-level exclusions are required before production use. |
| `wordfreq` | **C — reference / algorithm input only** | Optional offline frequency signal for later content QA, not learner-visible text or a formal level | **REQUIRES LICENSE / SOURCE VERIFICATION.** Code is Apache-2.0 but bundled data has CC BY-SA and source-specific attribution. Pin version and NOTICE before any use; do not copy corpus text. |
| ECDICT | **E — reject for MVP production data** | None | Although the repository advertises MIT, its README describes material assembled/crawled from many dictionaries, exam lists, BNC, WordNet, and other sources without record-level provenance adequate for this project. It is English-to-Chinese rather than English-to-Vietnamese. It may be inspected only as a schema/reference example. |

Official audit references:

- [Wiktextract license](https://github.com/tatuylonen/wiktextract/blob/master/LICENSE) and
  [Wiktionary data terms](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)
- [Tatoeba reuse terms](https://en.wiki.tatoeba.org/articles/show/terms-of-use-v1) and
  [download licensing notes](https://tatoeba.org/en/downloads)
- [`ipa-dict` license](https://github.com/open-dict-data/ipa-dict/blob/master/LICENSE) and
  [per-language upstream credits](https://github.com/open-dict-data/ipa-dict)
- [`wordfreq` code/data notice](https://github.com/rspeer/wordfreq/blob/master/NOTICE.md)
- [ECDICT source description](https://github.com/skywind3000/ECDICT)

No external source is downloaded or ingested by this design.

### Future Tatoeba text record requirements

Each future Tatoeba text import must preserve the Tatoeba sentence ID as the stable
`source_record_key`; contributor username/ID or an accepted stable attribution listing; the exact
sentence URL or equivalent stable source reference; the per-record license identifier and version;
the import timestamp; pinned export/snapshot version and checksum; importer version; normalization
version; and whether the imported text was modified. Direct Vietnamese translation relationships
must retain both endpoint IDs and the upstream relationship snapshot. Tatoeba audio is held and
must use its own source, contributor, license, and review chain if separately approved later; text
and audio never inherit one another's license.

### Future `ipa-dict` `en_US` record requirements

Each future `ipa-dict` import must preserve a pinned repository commit or release, the exact
`en_US` dataset path and checksum, the `ipa-dict` repository/source URL, upstream dataset and credit
chain (including CMUdict-derived credits where applicable), the applicable root and upstream
license identifiers/texts, import timestamp, importer version, and normalization version. The
record must trace reproducibly from `ipa-dict` version to `en_US` file to upstream source and
license; `source = ipa-dict` plus `license = MIT` alone is insufficient.

## 10. Reader / Dictionary boundary

`ContentResponse` embeds only what uninterrupted rendering needs: segment/sentence IDs and order,
text, optional reviewed translation/audio reference, concept ID, surface/canonical form, exact
offsets, and `ConceptStatus`. It does not embed complete senses, examples, relations, competence
statistics, memory data, or provenance internals.

Opening an annotated token lazily calls `GET /v1/concepts/{conceptId}`. Dictionary detail resolves
lexeme, POS, IPA, senses, examples, relations, learner projection, and required attribution.
`GET /v1/dictionary/search` remains the manual text-search path. The backend performs normalization
and form-to-lexeme resolution; the frontend slices only by server offsets and never invents lexical
normalization.

## 11. Level and fit policy

V1 makes no automatic or certified CEFR claim. Every published item has a curator-selected A0, A1,
A2, or B1 `proficiency_levels` reference and a normalized `difficulty` value within that level's
existing configured range. Reviewers may use precomputed concept frequency/coverage, average and
maximum sentence length, lexical diversity, source metadata, and concept links as QA signals, but
none independently certifies a level.

For an owned profile, `knownConceptRatio` is computed from distinct linked concepts. `familiar`,
`active`, and `mastered` count as known; `unseen`, `discovered`, `learning`, `weak`, and `forgotten`
do not. A missing state is `unseen`. The recommended list is a deterministic content-discovery read
model ordered by curated-level distance, descending known-concept ratio, normalized difficulty, and
stable content ID. These are fit hints, not Today recommendation logic. Without an estimated level,
published A0-B1 content is ordered easiest first. `fitReason` describes only those explicit signals.

## 12. Exact publication gate

An item is learner-visible only when one publication transaction proves all of the following:

1. target language is enabled English; content type, title, curated A0-B1 level, difficulty,
   non-null quality score, and `published_at` are valid;
2. item source, content-version source, every segment source, every exposed sentence/translation
   source, every linked concept/lexeme/sense source, and every audio source have complete provenance;
3. all used source records are `approved` with a quality score;
4. every used license is `allowed`; `restricted`, `unknown`, and `prohibited` are not public until a
   reviewed license record explicitly becomes allowed for this use;
5. required attribution is complete and representable by the public DTO; mixed incompatible
   licenses/sources are rejected from MVP content composition;
6. there is exactly one immutable published content structure, 1-100 contiguous ordered segments,
   at most 20,000 total words, and every Reader v1 segment has one same-language sentence;
7. sentence order/text, translation language, audio bounds, and annotation offsets are valid;
   linked concepts share English; occurrences are non-overlapping unless an approved role policy
   explicitly permits nesting;
8. `content_concepts` counts equal the occurrence aggregate and `content_metrics` match the
   structure under a recorded method version;
9. the item passed the explicit `reviewed` workflow state before publication.

Application validation and the PostgreSQL publication trigger enforce the same policy. Current
trigger logic is insufficient because it permits `restricted` licenses and checks only the item
source. TASK-008 implementation must strengthen it. Reads always filter `publication_status =
'published'`; other states return 404 to product callers.

## 13. Reading progress

Progress is an owned mutable projection, separate from learning evidence. The canonical v1 position
is the furthest content segment reached; pixel, scroll, and intra-segment offsets are deliberately
not persisted because they are device/layout dependent.

Proposed `ReadingProgress`:

```text
contentId: UUID
currentSegmentId: UUID
furthestSegmentId: UUID
progressPercent: integer 0..100       # server-derived from ordered segments
isCompleted: boolean
startedAt: RFC3339 UTC
lastOpenedAt: RFC3339 UTC
completedAt?: RFC3339 UTC
```

`PUT /v1/reader/progress/{contentId}` requires `Idempotency-Key` and a body containing
`languageProfileId`, `currentSegmentId`, and `isCompleted`. The server validates ownership,
publication, English, and segment membership. `isCompleted=true` is valid only for the final segment.
The first accepted command sets `startedAt`; each new logical command sets `lastOpenedAt`; the first
completion sets immutable `completedAt`. An earlier-segment retry or a second device may update
`currentSegmentId` and `lastOpenedAt` but never regresses `furthestSegmentId` or clears completion.
Reopening completed content preserves `isCompleted=true`, the original `completedAt`, and the
furthest segment. An unknown segment or a segment outside the content is invalid. Same key/body
replays the exact stored result; changed payload returns `IDEMPOTENCY_KEY_REUSED`; a matching
in-flight command returns `CONFLICT`.

The server derives `progressPercent`: it is 100 only when completed; otherwise it is
`floor(100 * furthest zero-based segment order / segment count)`. Fetch is through the optional
`ContentSummary.readingProgress` overlay returned by content recommendation/detail and Library
reads; v1 does not add a separate progress GET endpoint.

Opening content is still a read-only GET. After a successful render the client sends the progress
command for its current segment. Optional `ContentSummary.readingProgress` supplies list/detail and
Library resume state without duplicating Library membership. Completion alone never changes
competence and never substitutes for passive concept exposure or Today activity completion.

## 14. Library semantics

Existing Library tables and routes remain the sole membership authority:

- content save/unsave controls “Saved articles” and does not create progress or exposure;
- sentence save resolves server-owned sentence-concept links and does not accept client concept IDs;
- concept save uses the existing concept route and its approved TASK-006D learning-intent semantics;
- unsaving never deletes progress, exposure history, canonical events, or concept state;
- a saved content `ContentSummary` may carry `readingProgress`, enabling Continue reading and
  Completed views without a second saved-state column.

Saved-sentence notes remain `NOT_YET_PERSISTED`. Transient analyzed-sentence persistence is deferred.

## 15. Query and performance model

### Recommended list

One query filters published English items through the publication gate, joins content metrics and
curated level, left joins owned save/progress, and computes the linked-concept status aggregate in a
grouped subquery. Keyset pagination uses an opaque cursor containing the last normalized sort tuple
and request/profile filter fingerprint. Recommended supporting indexes are the current partial
publication index plus a profile/content progress index and existing content-concept indexes.

### Content detail

Use a bounded fixed query set, not per-sentence/per-concept calls:

1. content item, metrics, source/license, owned save, and owned progress;
2. all ordered segments and their one sentence, reviewed translation, and audio;
3. all sentence occurrences joined to concepts/lexemes plus a single batched owned
   `user_concept_states` overlay.

The service groups flat rows in memory. It does not load senses/examples for every token; those are
lazy Dictionary reads. Empty learner state is represented as `unseen`, not inserted during GET.

### Analyze

Normalize bounded input, split English deterministically, batch-match normalized forms through the
lexeme index, batch-load learner states, and return transient annotations. It creates no content,
source, progress, or exposure row.

## 16. Learner overlay

Allowed overlays are `ConceptStatus`, `isDue` only on dictionary detail where already contracted,
saved state, known-concept ratio, fit reason, and reading progress. Reader annotations use exactly
the authoritative eight `ConceptStatus` values. Presentation may group them, but `due` never becomes
a status.

Reader/content responses never expose positive/negative mass, competence parameter sets, evidence
weights, projector lineage, raw FSRS fields, internal source metadata, unpublished records, or QA
workflow state. The content GET remains write-free.

## 17. TASK-006D integration and transactions

### Exposure transaction

FastAPI owns one PostgreSQL transaction:

```text
authenticate actor
-> validate owned profile + published content hierarchy/language
-> resolve and lock authoritative concept occurrences
-> claim actor-scoped idempotency fingerprint
-> append one Reader exposure source fact and its concept-target snapshot
-> append 1..N canonical learning events using stable derivation keys
-> call CompetenceEngine passive-exposure projection for every child in UUID order
-> store exact ReaderExposureResult
-> commit once
```

Failure anywhere rolls back source fact, children, projections, and result. Route code never edits
`user_concept_states` directly. The TASK-006D non-Review lock order remains profile projection head,
ordered skill rows when applicable (none for passive exposure), then concept rows ordered by UUID.
Canonical ingestion sequence, replay, and append-only rules remain authoritative.

### Progress transaction

Progress is a separate command and transaction: authenticate, validate, claim progress idempotency,
lock/upsert the owned progress row, apply monotonic resume/completion rules, store exact result, and
commit. It does not invoke Competence Engine.

Keeping commands separate prevents frequent resume writes from fabricating concept evidence,
allows progress to succeed independently of action eligibility, and makes exposure retry semantics
unambiguous. The frontend may issue both after a real segment completion, but they are not an atomic
cross-command unit.

## 18. Security and authorization

- Browser calls FastAPI with Supabase JWT; FastAPI uses its PostgreSQL role/transaction boundary.
- No browser direct write to product tables and no client `userId`.
- Published catalog access is authenticated and language-filtered. Unpublished/private imports,
  source records, hashes, and reviewer metadata are never returned.
- Progress, Library, exposure source events, and projections are always scoped through the actor's
  owned `user_languages` row. Future tables enable RLS and expose select-own only where required;
  service writes use server-side authorization.
- Content, segment, sentence, occurrence, and profile relationships are validated server-side,
  including same-language composite ownership constraints.
- Input text and queries retain OpenAPI bounds; exposure/progress mutations are rate-limited and
  raw database errors map to `errors.json` codes.

## 19. Deterministic seed strategy

The implementation seed is intentionally small:

- 5 content items: 3 published at A0, A1, and A2/B1; 1 reviewed but unpublished; 1 quarantined;
- about 12 one-sentence segments and 12-16 English sentences, with reviewed Vietnamese
  translations;
- about 25-35 concepts, including repeated lexical concepts, at least one grammar concept without
  POS, and enough unseen/learning/familiar/active/mastered/weak/forgotten overlays for tests;
- about 35-50 occurrence annotations, including one repeated concept in a segment;
- 1-2 internally licensed audio segments for listening exposure;
- one deterministic internal license/data source/source record chain per fixture group, stable UUIDs,
  hashes, transform versions, quality/review states, and attribution;
- test-created learners: one with mixed state/save/progress and one with zero learner state.

This proves discovery, details, offsets, lazy dictionary lookup, overlays, passive exposure,
progress, Library, provenance, and publication filtering. It is not a production corpus and no
external dataset is required for acceptance.

## 20. Future implementation test plan

| Required area | Future proof |
|---|---|
| A. content list/detail | Published bounded DTOs, stable ordering, exact attribution. |
| B. cursor pagination | No duplicates/skips over stable data; malformed/profile-mismatched cursors rejected; no offsets. |
| C. ownership/language | Foreign profile rejected; English/segment/sentence hierarchy enforced. |
| D. unpublished visibility | Raw/reviewed/quarantined/retired IDs return 404 and never list. |
| E. provenance gate | Missing/unapproved/restricted/unknown/prohibited dependency cannot publish. |
| F. segment ordering | Contiguous unique order and deterministic response. |
| G. annotations | Valid non-overlapping offsets slice the exact surface and map to same-language concepts. |
| H. dictionary linkage | Lazy concept detail matches annotation; Reader payload excludes full dictionary graph. |
| I. zero state | No writes on GET; absent concept rows serialize as `unseen`. |
| J. overlay | All eight statuses conform; `due` absent; known ratio policy is exact. |
| K. progress | start/resume/reopen/complete, monotonic concurrent devices, exact retry, no completion-derived competence. |
| L. Library | Save/unsave idempotency, resume retained after unsave, server-resolved sentence concepts. |
| M. exposure idempotency | Same key/body exact replay; changed body conflicts; no double projection. |
| N. noisy UI actions | Open/viewport/scroll/rerender produce no event; stable retry/reconnect key produces one. |
| O. fan-out | One source Reader event creates one canonical child per distinct concept. |
| P. passive invariant | Exposure/history/last seen change; every competence mass/score/confidence and mastery remain byte-for-byte equivalent. |
| Q. discovery | First passive child moves `unseen -> discovered`. |
| R. no promotion | Existing discovered/learning/familiar/active/mastered/weak/forgotten is not promoted by passive repetition. |
| S. rollback | Failure on any child rolls back source, all canonical events, all projections, and result. |
| T. concurrency | Duplicate races select one key winner; different events preserve UUID lock order and no lost updates. |
| U. contract freshness | OpenAPI/Redocly valid; generated TypeScript types fresh; mock DTOs conform. |
| V. frontend freeze | Existing 307 tests / 27 files plus typecheck, lint, Storybook, and production build remain green. |

Additional database tests cover migration from empty, down/up/reapply, RLS ownership, progress FK
integrity, segment type/level checks, source-target uniqueness, append-only exposure/canonical history,
and the strengthened publication trigger.

## 21. Contract / database responsibility map

| Public field or behavior | Domain authority | Current PostgreSQL support | Migration needed? |
|---|---|---|---:|
| `ReaderExposureResult.exposureId` and request catalog identities | Reader source-event authority; server resolves actor/profile/content hierarchy | `exposure_events.id`, profile/content/segment/sentence/concept relations exist, but the source row is concept-scoped | **Yes** — evolve the existing source fact rather than create a duplicate exposure authority. |
| Exposure exact replay result and fingerprint | Reader command/idempotency authority | Existing TASK-006D idempotency does not store the complete Reader request fingerprint/result snapshot | **Yes** — durable actor/key/fingerprint/result storage. |
| `acceptedConceptCount` and one source to many distinct concept children | Reader occurrence resolution feeding TASK-006D canonical evidence | `exposure_events.concept_id` represents one concept per source; `learning_events` can hold canonical children | **Yes** — add an `exposure_event_concepts` snapshot/fan-out relation and reuse `learning_events`. |
| `ReadingProgress.*` | Learner-owned Reader progress projection | No progress relation exists | **Yes** — add `user_content_progress` and exact-replay support. |
| `ContentSummary.difficultyLabel` (`A0`-`B1`) | Curated content-level authority | `proficiency_levels` exists; `content_items` has no curated-level FK | **Yes** — link published content to the existing level authority. |
| `ContentSegment.segmentType` | Content structure authority | `content_segments` exists without a segment-type column | **Yes** — add constrained `segment_type`; Reader v1 uses `sentence`. |
| Content `publicationStatus` visibility rule | Content publication authority | `content_items.publication_status` and a publication trigger exist | **Yes** — strengthen the existing trigger for all dependencies and `allowed` licenses only; no second status field. |
| `SaveSentenceRequest.sentenceId` | Published catalog sentence identity; Library owns membership | `sentences`, `content_segments`, and `user_saved_sentences` already supply identity/membership | **No** for identity/save membership; server validation must enforce catalog publication and language. |
| Exposure `occurredAt` / response `recordedAt` | Reader audit authority | Existing exposure event timestamps can represent the audit times | **No** for timestamp concepts; the evolved source/result shape must expose them consistently. |
| `ContentSummary.readingProgress` | Reader progress projection over a content summary | No persisted projection exists | **Yes**, via the progress row above; no duplicate summary table. |

## 22. Expected migration (future, not created here)

The inspected sequence ends at `0004`; the expected next pair is
`0005_reader_content_service_v1.up.sql` and `0005_reader_content_service_v1.down.sql`. It will:

1. add optional then backfilled/required `content_segments.segment_type` with the approved check;
2. add `content_items.curated_level_id` and constrain published Reader items to A0-B1;
3. add actor-owned `user_content_progress` with composite profile/language/content/segment FKs,
   timestamps, completion checks, RLS, and list/resume indexes;
4. add an append-only progress idempotency/result relation or equivalent durable exact-replay store;
5. evolve `exposure_events` with request fingerprint and exact result snapshot and add
   `exposure_event_concepts` to persist the server-resolved fan-out set;
6. add append-only/source integrity constraints and indexes for Reader exposure replay;
7. strengthen the existing publication trigger to validate the complete dependency/provenance gate
   and require `allowed` licenses.

The existing content, lexical, sentence, annotation, aggregate, saved-state, and TASK-006D tables
are reused. No migration file is created during contract freeze.

## 23. Frozen decisions and implementation blockers

| Decision | Design answer |
|---|---|
| A. OpenAPI amendment? | **Yes**, exposure + progress + progress overlay + segment enum + catalog-only save-sentence correction. |
| B. Smallest exposure contract? | Authenticated, idempotent `POST /v1/reader/exposures` with server-resolved segment or exact sentence occurrence and a compact accepted-result envelope. |
| C. Approved MVP source candidates? | First-party curated records; conditional Tatoeba text rows; conditional `ipa-dict` `en_US` IPA. |
| D. Sources requiring verification? | Wiktextract/Wiktionary, `wordfreq`, every non-`en_US` ipa-dict subset, and any Tatoeba audio or external-source row. ECDICT is rejected for MVP. |
| E. Publication gate? | Complete approved provenance for every visible dependency, `allowed` licenses only, attribution representable, English/A0-B1, valid bounded structure/annotations/metrics, reviewed before publish. |
| F. Exposure granularity? | Completed segment (`read`), eligible completed segment audio (`listen`), or opened exact concept occurrence (`lookup`); never open/viewport/per-word noise. |
| G. Transaction ownership? | FastAPI owns separate PostgreSQL transactions for exposure and progress; exposure atomically calls TASK-006D. |
| H. DB migration? | **Yes, during implementation**, for segment type/curated level, progress, Reader fan-out/idempotency, and full publication gate. |
| I. Remaining implementation gaps? | Missing segment type/level/progress persistence, concept-scoped exposure source shape, exact replay storage, and incomplete publication trigger. The transient-save, client concept-ID, and missing public-route contract defects are resolved. |

All listed product decisions are accepted and the public contract is frozen. Runtime and migration
implementation still require a separate explicit authorization. Before production ingestion,
Tatoeba text and `ipa-dict` `en_US` each require a concrete pinned source/license review record;
Wiktionary/Wiktextract, `wordfreq`, Tatoeba audio, and other `ipa-dict` locales remain held.

`TASK-008` remains **DESIGN / CONTRACT FREEZE**. No Reader runtime, database migration, frontend
application change, import adapter execution, or external ingestion has started. `TASK-007` remains
blocked.
