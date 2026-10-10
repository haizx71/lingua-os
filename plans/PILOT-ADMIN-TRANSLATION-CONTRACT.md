# PILOT-ADMIN translation authoring contract proposal

**Status:** contract proposal only — awaiting independent GPT-6 Luna / Max review before runtime work.
**Prepared by:** configured GPT-6 Luna, Max reasoning.
**Baseline:** worktree branch `codex/pilot-reader-guidance-followup`, HEAD `af813819729ac36e1df432c7af28465f8d1cdc36`.

## Goal and authorization

Provide the existing owner-only Admin flow with a normal, bounded way to attach the exact
owner-approved Vietnamese candidate to a newly authored Reader article. The approved source is
`knowledge/staging/pilot-reader-vi-draft/translation-draft.json`, SHA-256
`25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f`. Its four reviewed English
revisions remain part of the candidate. This approval covers the exact candidate and staging
first-party use; it does not authorize retiring or changing the existing published article.

Create a **new content identity** through the existing Admin form, then submit the complete
translation set through Admin. The UI may accept a pasted/imported JSON set and preview all pairs;
the runtime must not bundle this candidate, substitute a fixture, or invent missing translations.
This proposal does not change Reader runtime behavior, learner APIs/state, accepted K2/FRLL
behavior, Auth/RLS/grants, or the database schema.

## Existing boundaries verified

- ADR-024 fixes Admin authorization at the verified Supabase actor plus server-only
  `LINGUA_ADMIN_USER_IDS`; the current Admin implementation already enforces that boundary.
- `sentence_translations` already stores `sentence_id`, `target_language_code`, `text`, and a
  required `source_record_id`. The first-party `data_sources` / `source_records` chain can record
  translation provenance without a migration.
- Reader already returns the optional Vietnamese sentence translation from this table. Reader
  content and the publication trigger already check translation provenance and prevent edits to
  translations attached to published content.
- Admin content is segmented by the existing deterministic server splitter. The Admin request and
  response currently have no translation fields. The existing `PATCH` rebuilds sentence rows;
  because `sentence_translations.sentence_id` uses `ON DELETE RESTRICT`, translation rows must be
  handled explicitly before any draft sentence deletion.

## Proposed API contract

Add one complete-set operation:

```text
PUT /v1/admin/content/{contentId}/translations/vi
Authorization: Bearer <existing Supabase JWT>
```

The target language is fixed by the path. The body contains no sentence or source-record IDs.
For a non-empty set:

```json
{
  "entries": [
    {"ordinal": 1, "sourceText": "Exact server sentence", "translationText": "Bản dịch"}
  ],
  "source": {
    "authorName": "...",
    "sourceName": "...",
    "sourceVersion": "...",
    "attributionText": "...",
    "rightsStatement": "..."
  }
}
```

`ordinal` is one-based and maps to `AdminSentencePreview.order + 1`. The server splits the current
English body and accepts a non-empty set only when it contains exactly one entry for every current
sentence, in order, with `sourceText` byte-for-byte equal to the server sentence text. It rejects
missing, extra, duplicate, reordered, stale, or mismatched rows, and whitespace-only or oversized
Vietnamese text. It stores submitted Vietnamese text without normalization. The request shape is
bounded to 100 entries, with each source and translation string bounded to the existing 5,000
character sentence limit. Since the shared Pydantic base strips strings, the translation-entry DTO
must explicitly disable whitespace stripping for `sourceText` and `translationText`; validation
checks exact source text and nonblank VI while preserving submitted VI bytes/code points. The
approved candidate maps its `ordinal`, `english`, and `vietnamese`
values to these fields; its file hash is checked as an external input artifact, never baked into the
runtime.

An explicit clear is `{"entries": []}` with no `source`. Omission is not a valid request body and
does not mean clear. A supplied `source` is required for a non-empty set and is rejected for an
empty set. Repeating the same complete request is idempotent: return the current representation
without creating duplicate rows or provenance records.

Request bounds follow the existing Admin DTOs: `authorName` and `sourceName` are 1–200 characters,
`sourceVersion` 1–100, `attributionText` and `rightsStatement` 1–1,000; each `ordinal` is 1–100;
each `sourceText` and `translationText` is 1–5,000. The non-empty-set validator additionally
requires `entries.length == current sentence count` and exactly the ordinal sequence `1..N`; thus
there is no accepted partial or blank VI set.

Extend the Admin response only:

- Each `AdminSentencePreview` includes required nullable `translationVi`.
- `AdminContent` includes required nullable `translationSource`, containing the current
  translation set's target language (`vi`), author, source name/version, fixed license code,
  attribution, rights statement, generated source record key, and server-computed raw hash. It
  exposes no internal source-record UUID.
- `GET /v1/admin/content/{contentId}` and the mutation response show the full ordered English / VI
  preview so the Admin can inspect 72 pairs before validation.

The operation returns `200` with the normal `AdminContentResponse`. Existing error envelope shapes
remain in use: `401` unauthenticated, `403` non-owner, `404` content absent/not owned by the
Admin-authoring catalog, `409` immutable lifecycle or a conflicting restricted reference, `422`
invalid shape/alignment/provenance, and `500` sanitized internal error. No new error code or status
enum is needed.

## Provenance, draft edits, and lifecycle

- The server creates a distinct first-party translation source record for each changed complete
  set. It uses the existing fixed `LINGUA-FIRST-PARTY` allowed license, `internal` data-source type,
  and `sentence_translations.source_record_id`. `data_sources` stores source name, a server-pinned
  source version, attribution text, and the fixed license. `source_records` stores a generated
  content-scoped key, transform version, review state, computed hash, and metadata containing
  author name, the submitted source version, rights statement, content ID, target language, the
  Admin translation authoring version, and the ordered source/translation snapshot. The
  `raw_hash` is server-computed from a deterministic UTF-8 canonicalization of the target language,
  source metadata, and exact ordered English/VI pairs; it is not accepted from the client. Retired
  translation source records remain as provenance history when their active translation rows are
  replaced or cleared.
- Saving a changed or cleared translation set returns the content and its current English source
  record to `normalized`, and stores a new non-empty translation source record as `normalized`.
  Existing `POST .../validate` checks the full
  translation/provenance set and marks its source record approved with quality/review timestamps
  alongside the content source record. Existing publication validation remains the final database
  authority; every active translation source record must satisfy
  `reader_source_record_is_allowed`. Missing translation remains allowed for other content under
  the frozen Reader contract; this candidate is submitted as one complete 72-pair set.
- The normal Admin flow is: create a new English article, inspect the server-generated ordered
  sentence preview, paste/import the candidate's 72-row JSON, show all source/VI pairs and any
  ordinal/text mismatches, then explicitly submit the complete set once. The UI does not silently
  pair a translation to a sentence or submit a partial set. There is no hardcoded article or
  translation in the UI, API, test fixture fallback, or Reader.
- Metadata-only `PATCH` updates preserve sentence IDs, annotations, and translations. If a PATCH
  supplies a body identical to the current body, it preserves the current sentence structure and
  translations. If the exact body changes, the server rebuilds the deterministic structure and
  first deletes only the current content's Admin-authored VI translation rows, identified by the
  server-owned authoring version and content ID in their provenance metadata. The delete occurs
  before restricted sentence deletion. It does not delete other languages, foreign-source
  translation rows, source records, or learner references. If any non-owned/restricted reference
  prevents the sentence replacement, the whole transaction rolls back and returns `409`; no
  cascade or partial body update is allowed. After a changed body, the author must submit a new
  complete VI set if translation is desired.
- Empty-set clearing deletes only that content's current Admin-authored VI translation rows and
  retains their source records. Before **any** non-empty replacement or clear, the transaction
  checks every affected sentence for existing Vietnamese rows: each row must belong to the current
  content's Admin-authored translation set. If any non-owned VI row exists, fail closed with `409`
  before deleting or inserting anything, preserve its row and provenance, and leave the response
  unchanged. This prevents ambiguity with Reader's existing `ORDER BY id LIMIT 1` selector; do not
  change that selector or delete foreign provenance.
- Translation save, body update, concept mapping, validate, publish, and retire acquire the same
  `content_items` row lock before inspecting lifecycle state. They commit as one PostgreSQL
  transaction; concurrent requests serialize, complete sets never interleave, and alignment is
  checked against the current locked sentence order/text. A published or retired item is rejected
  by the Admin service and remains protected by the existing database immutability trigger.
- The current published article and all of its learner references remain untouched. The new
  candidate gets a separate content ID; no retirement is part of this task.

## Focused verification required after review releases implementation

1. OpenAPI validation and generated TypeScript freshness cover the new operation, strict request
   variants (complete set versus explicit clear), errors, and Admin preview fields.
2. Real PostgreSQL Admin API tests cover owner/learner authorization; exact ordered mapping; the
   candidate's 72 rows; duplicate replay/no duplicate provenance; malformed, partial, stale, and
   mismatched sets with zero partial writes; a non-empty replacement and explicit clear both
   failing atomically on a pre-existing non-owned VI row while preserving it; validation of
   translation provenance;
   publication/Reader response; published and retired immutability; and zero changes across learner
   tables.
3. Draft edit tests prove metadata-only and identical-body patches preserve translations; changed
   body removes only owned VI rows before restricted sentence deletion; foreign references fail and
   roll back all content/provenance changes; other-language rows and historical source records stay
   intact.
4. Two-connection tests race translation replacement with body update and publish/validate. Assert
   serialized complete-set outcomes, no mixed rows, correct alignment against the locked current
   body, and no published mutation.
5. Admin form/detail tests prove an imported 72-pair set can be previewed, explicitly submitted once,
   and rendered from the server response; they also prove the app contains no candidate fallback.
   Run focused backend/frontend tests, generated contracts, workspace typecheck, lint, and build.
   Independent source review and exact-head CI/Preview are required before any staging catalog
   write. Do not modify accepted K2 hosted assertions; any needed actorless Admin acceptance is a
   separate reviewed runner extension.

## Gate

This file proposes the smallest authoring contract and its safety semantics. **No runtime, OpenAPI,
generated type, database, hosted catalog, or learner-state changes are authorized until independent
Max review approves this exact contract.** After review, implementation remains limited to Admin
backend/contract/generated types/tests and Admin UI/form tests; the Reader guidance exception is
owned by its separate worker. No migration is expected; if PostgreSQL tests show otherwise, stop
for a new schema review rather than expanding this task.
