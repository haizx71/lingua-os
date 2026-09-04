# TASK-004 contract reconciliation

Status: authoritative backend contract ready for audit  
Compared sources: approved product/system specifications, PostgreSQL schema v1, starter shared
registries, and provisional `packages/types/**` frontend view models/fixtures.

The frontend package was treated as context, not authority. This report is the required handoff for
TASK-005; it does not modify frontend source.

## Architecture and ownership result

Selected architecture: **Browser → FastAPI → PostgreSQL/Supabase**.

- The browser obtains a Supabase Auth access token and sends it as a Bearer JWT to FastAPI.
- FastAPI validates the JWT subject, maps it to the shared `auth.users.id` / `public.users.id` UUID
  boundary, and performs every product read/write.
- Browser code must not query or mutate PostgreSQL/Supabase product tables directly.
- FastAPI must scope every user-owned query by the authenticated actor. Client-supplied ownership
  identifiers are not accepted.
- PostgreSQL RLS remains defence in depth. Service-role access can bypass RLS, so service code must
  not rely on RLS as its only authorization control.
- Supabase-specific behavior stops at authentication/infrastructure integration. Product DTOs,
  business errors, pagination, and PostgreSQL data semantics remain portable.

## Endpoint inventory

The contract contains 24 paths and 29 operations. Operational `GET /health` remains intentionally
outside the public product contract.

| Product surface | Operations |
|---|---|
| Profile/bootstrap | `GET/PATCH /v1/me` |
| Language profiles | `GET/POST /v1/me/languages`, `PATCH /v1/me/languages/{languageProfileId}` |
| Today | `GET /v1/today`, `POST /v1/today/{planId}/activities/{activityId}/complete` |
| Review | `GET /v1/review/queue`, `POST /v1/review/{reviewItemId}/answer` |
| Dictionary/concept | `GET /v1/dictionary/search`, `GET /v1/concepts/{conceptId}` |
| Reader/content | `POST /v1/reader/analyze`, `POST /v1/reader/save-sentence`, `GET /v1/content/recommended`, `GET /v1/content/{contentId}` |
| Library | `GET /v1/library/items`; idempotent save/remove for concept, content, and sentence resources |
| Starting Level Estimate | `POST /v1/assessments`, `GET /v1/assessments/{assessmentId}`, `POST /v1/assessments/{assessmentId}/responses` |
| Language Brain | `GET /v1/brain/summary`, `GET /v1/brain/concepts`, `GET /v1/brain/concepts/{conceptId}` |
| Progress | `GET /v1/progress/overview` |

## MATCH

These provisional ideas already match the approved domain and remain conceptually stable:

- The eight `ConceptStatus` values: `unseen`, `discovered`, `learning`, `familiar`, `active`,
  `mastered`, `weak`, `forgotten`.
- Today activity kinds: `review`, `read`, `listen`, `learn`.
- Review ratings: `again`, `hard`, `good`, `easy`.
- Review presentation modes remain variants on one queue/lineage, never modality-specific schedules.
- Today contains a bounded activity list, time budget, reason text, and stable reason codes.
- Reader content contains ordered segments, sentences, translations/audio when present, and concept
  character offsets.
- Brain and Progress expose recognition/listening/production separately from memory health.
- Starting Level Estimate exposes level, confidence, assessed skills, evidence count, method
  version, and estimate time.
- Library presents saved content, sentences, and concepts.

## RENAME

| Provisional frontend | Authoritative contract | Reason |
|---|---|---|
| `Page<T>` / `PaginationMeta.page` | opaque `cursor`, `limit`, `CursorResponseMeta` | Growing lists use stable cursor pagination. |
| `UserProfile.settings` | `MeProfile` plus `LanguageProfile` persisted fields | Separate server data from client-only presentation preferences. |
| `UserLanguageProfile.languageCode` | `targetLanguageCode` | Removes ambiguity with the Vietnamese support language. |
| `currentLevelEstimate` scalar | `startingLevelEstimate` evidence object | Prevents certification-like interpretation and preserves confidence/method metadata. |
| `TodayPlan.date` | `planDate` | Explicitly a learner-local plan date. |
| `TodayActivity.orderIndex` | `position` | Matches domain ordering vocabulary. |
| `reasonCode` | `reasonCodes` | Accepted schema permits multiple explainable reasons per activity. |
| `ContentItem.type` | `contentType` | Avoids a generic wire field and aligns content-domain language. |
| `knownRatio` | `knownConceptRatio` | States exactly what the ratio measures. |
| `durationMinutes` | `estimatedMinutes` | It is a planning estimate, not measured duration. |
| `BrainSummary.signals` | `competence` | Makes the multidimensional competence projection explicit. |
| `FSRSState` public view | `MemorySnapshot` | The product receives state/due information, not scheduler internals. |
| `AssessmentSession.id` | still `id`, but path name `assessmentId` | Stable UUID remains; path semantics become explicit. |

## CHANGE

| Area | Authoritative behavior |
|---|---|
| Success shape | Every product success is `{ data, meta }`; meta always includes UUID `requestId` and API version. |
| Error shape | Every error is `{ error: { code, message, requestId, details?, retryAfterSeconds? } }`; clients branch on code, never message text. |
| IDs/times | Provisional prefixed fixture IDs are replaced by UUIDs; instants are RFC 3339 UTC and local plan days use `date`. |
| Ownership | All provisional `userId` fields are removed from requests and product DTOs; actor ownership comes only from the validated JWT. |
| Profile edits | Persisted profile/language edits use ETag/`If-Match`; UI-only theme/motion state is not sent. |
| Review memory | Public `MemorySnapshot` includes memory state, due instant, last-reviewed instant, and `isDue`; FSRS parameters, difficulty, stability, repetitions, lapses, scheduled days, and retrievability are private implementation state. |
| Competence | Recognition/listening/production use separate scores, confidence, and evidence counts; they do not create additional due dates. |
| Review answer | `correct` and Again/Hard/Good/Easy remain distinct signals. The server already knows the queue item's presentation mode. |
| Today status/reasons | Values follow the approved PostgreSQL/domain codes (`draft/active/completed/expired`, and `FSRS_DUE`, `WEAK_RECOGNITION`, etc.), with `reasonText` for people. |
| Content visibility | Only published content that passed provenance/license/quality gates can be returned. Internal workflow quality statuses are not learner DTO fields. |
| Attribution | Structured `Attribution` is optional at the content/concept level and included only when source/license policy requires it. |
| Content difficulty | Contract exposes the stored normalized `difficultyScore` and an optional server-owned display label instead of claiming an unsupported CEFR mapping. |
| Assessment skills | Skills align with accepted evidence dimensions: recognition, listening, production. Result wording remains an estimate, never certification or IRT output. |
| Brain | MVP uses summary/list/detail relational projections; provisional graph nodes/edges and 3D graph payloads are not API surfaces. |

## REMOVE

The following provisional fields/behaviors are not part of API v1:

- All public/request `userId` fields.
- Raw `qualityStatus` and other ingestion/review workflow states from learner content DTOs.
  The legacy `content_quality_status` list remains in `enums.json` for internal/shared compatibility
  but has no `x-enum-registry` binding in OpenAPI and is not a learner-facing field.
- Raw FSRS `difficulty`, `stability`, `reps`, `lapses`, `scheduledDays`, `retrievability`, and
  parameter payloads.
- `due` as a concept status. Due remains the independent `isDue`/`dueAt` scheduling condition.
- Parallel recognition/listening/production due dates or queues.
- `masteryScore` as a single public truth; Brain keeps status, competence, memory, confidence, and
  evidence legible separately.
- Frontend-computed Today recommendations, Today formula inputs, or reorder semantics.
- Provisional graph endpoints/payloads; Knowledge Map/graph visualization is post-MVP.
- Large source/provenance database records, checksums, QA workflow fields, and raw license rows.
- Saved-sentence `userNotes`, because PostgreSQL v1 has no persisted notes field.
- Client-only `theme`, `reducedMotion`, `audioAutoplay`, and `playbackSpeed` from server profile
  payloads. They may remain local UI preferences until a persistent schema is approved.
- Reminder settings, data-export/delete-account mutations, reading-position/resume fields, and
  configurable per-profile new-concept budget: these are not backed by the accepted v1 schema or a
  locked service contract and must not be mocked as successful server persistence.
- AI Tutor, speech/pronunciation/forced-alignment, full graph, Chinese, and Japanese endpoints.

## ADD

These contract elements were required by the approved specifications but absent or incomplete in
the provisional frontend types:

- Bearer JWT security scheme and explicit Browser → FastAPI → PostgreSQL/Supabase ownership model.
- Globally unique stable `operationId` on all 29 operations.
- Reusable success/error envelopes and stable error codes for invalid state transition,
  precondition failure, idempotency-key reuse, rate limiting, and service availability.
- Required `Idempotency-Key` on critical POST mutations; PUT/DELETE library actions are
  intrinsically idempotent.
- ETag/`If-Match` behavior for concurrent profile/language-profile edits.
- Opaque cursor pagination for Review queue, dictionary search, content recommendations, Library,
  and Brain concept list.
- Product-safe structured attribution.
- Assessment resume endpoint and deliberate skip contract.
- Brain summary and cursor-paginated list in addition to concept detail.
- Contract validation coverage for enum/error synchronization, local references, auth, UUID/time
  formats, ownership, publication boundary, and one-memory-lineage invariants.

## Pagination decision

Cursor pagination is mandatory for Review queue, dictionary results, recommended content, Library
items, and Brain concepts. Profile/language bootstrap, Today, content/concept detail, assessment
state, Brain summary/detail, and Progress are bounded resources and intentionally have no cursor.

## Items requiring product/schema follow-up (not blockers for this v1 contract)

The accepted database cannot persist the following frontend specification wishes today:

1. Reader position/resume progress.
2. Server-synchronized audio/accessibility/notification preferences.
3. Saved-sentence notes.
4. A configurable learner-level new-concept budget (the database stores it on generated Today
   plans, not on `user_languages`).
5. Data-export and account-deletion workflow state.

TASK-005 must not generate successful server mocks for these items. Adding any of them requires a
bounded product decision and, where persistence is needed, a future versioned migration plus
contract update. This does not block SDK generation or implementation of the 29 operations in API
v1.
