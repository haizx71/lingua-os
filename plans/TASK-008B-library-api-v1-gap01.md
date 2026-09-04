# Implementation Plan: TASK-008B Library API v1 + GAP-01 Memory Activation

## 1. Objectives & Context

- **Task**: TASK-008B — Library API v1.
- **Architectural Gap**: GAP-01 — Concept save/learn does not currently activate FSRS Memory Engine.
- **Authority**: `docs/GEMINI_BACKEND_WORKFLOW.md`, `MASTER_PROJECT.md`, `contracts/openapi.yaml`, `contracts/enums.json`, `contracts/errors.json`.
- **Core Invariant**: Library Save / Learn is the approved active-learning intent boundary for concept activation. Passive Reader exposure, Reader progress, sentence saves, content saves, assessments, and Dictionary lookups MUST NOT activate Memory.
- **MEM-001 Invariant**: Exactly ONE FSRS scheduling lineage exists per learner × concept (`UNIQUE (user_id, concept_id)` on `review_items`). Memory owns FSRS state. Repeated Save/Learn must NOT reset existing lineage.
- **Forward Migration**: Forward migration `0009_library_concept_save_intent_v1.up.sql` and `0009_library_concept_save_intent_v1.down.sql`. Never mutate historical migrations `0001..0008`.

---

## 2. Architecture & Transaction Sequence

### Concept Save / Learn Transaction Sequence (`PUT /v1/library/concepts/{conceptId}`)
```text
[FastAPI Route Handler]
  │
  ▼
[LibraryApplication.save_concept(actor, concept_id)]
  │
  ├── 1. Resolve & lock active English profile for actor (FOR SHARE)
  ├── 2. Verify concept exists in active language (FOR SHARE)
  │
  ├── BEGIN TRANSACTION (Single Coordinator)
  │    │
  │    ├── 3. Insert membership into `user_saved_concepts`
  │    │      (ON CONFLICT DO NOTHING)
  │    │
  │    ├── 4. Record immutable first-save intent into `concept_save_intents`
  │    │      (ON CONFLICT DO NOTHING RETURNING id)
  │    │
  │    ├── 5. If first save (new intent ID returned):
  │    │      ├── Ingest canonical `learning.concept.saved.v1` into `learning_events`
  │    │      └── Update `user_concept_states` (has_learning_intent=True, status='learning', zero mass change)
  │    │
  │    ├── 6. Memory Engine ensures scheduling lineage exists:
  │    │      ├── Insert `review_items` (status='active', created_from='learner_saved')
  │    │      │   ON CONFLICT (user_id, concept_id) DO NOTHING
  │    │      └── If new review item: insert `fsrs_states` (state='new', due_at=now, difficulty=NULL, stability=NULL)
  │    │          If existing: leave review_items and fsrs_states completely untouched
  │    │
  │    └── COMMIT / ROLLBACK (Atomic)
  │
  ▼
Return LibraryMutationResponse(id=concept_id, itemType="concept", isSaved=true, savedAt=...)
```

### Concept Unsave (`DELETE /v1/library/concepts/{conceptId}`)
- Deletes row from `user_saved_concepts`.
- Leaves `concept_save_intents`, `learning_events`, `review_items`, and `fsrs_states` completely intact.
- Returns `LibraryMutationResponse(id=concept_id, itemType="concept", isSaved=false, savedAt=None)`.

### Concept Resave (`PUT /v1/library/concepts/{conceptId}` after DELETE)
- Restores membership in `user_saved_concepts` with new `saved_at`.
- Intent already exists -> does not duplicate intent or learning event.
- Lineage already exists -> does not reset or duplicate FSRS card.

---

## 3. Schema & Database Evolution (`0009`)

### Up Migration: `database/migrations/0009_library_concept_save_intent_v1.up.sql`
1. Create `concept_save_intents` table:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `user_language_id uuid NOT NULL`
   - `concept_id uuid NOT NULL`
   - `language_code text NOT NULL DEFAULT 'en'`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `UNIQUE (user_id, concept_id)`
   - Foreign keys to `user_languages` and `concepts`.
2. Create trigger `enforce_concept_save_intent_immutability()` to prevent updates or deletes.
3. Update `learning_events_source_type_check` to include `'concept_save_intent'`.
4. Create index `ix_saved_concepts_user_saved_at` on `user_saved_concepts (user_id, saved_at DESC)`.
5. Enable RLS on `concept_save_intents` with owner select policy.
6. Grant appropriate permissions to `authenticated` role and revoke from `anon`.

### Down Migration: `database/migrations/0009_library_concept_save_intent_v1.down.sql`
- Drop `concept_save_intents` table and trigger function.
- Drop index `ix_saved_concepts_user_saved_at`.
- Revert `learning_events_source_type_check` to original set of source types.

---

## 4. Module Implementation Plan

### A. Memory Engine Integration
- Add `ensure_lineage_in_transaction` to `PostgresMemoryEngine` and `PostgresMemoryStore`.
- Use `INSERT INTO review_items ... ON CONFLICT (user_id, concept_id) DO NOTHING` to guarantee concurrency safety and avoid lineage overwrite.
- Never reset existing FSRS card stability or difficulty.

### B. Competence Engine Integration
- Add `apply_concept_save` to `CompetenceEngine` and `update_concept_save_intent` to `CompetenceStore`.
- Records canonical `learning.concept.saved.v1` event with `source_type = 'concept_save_intent'`.
- Sets `has_learning_intent = True`, updating status to `ConceptStatus.LEARNING` without altering skill scores or confidence mass.

### C. Library Module (`services/api/src/lingua_api/library/`)
- `domain.py`: Domain dataclasses, errors (`LibraryNotFound`, `LibraryValidationError`, `InvalidLibraryCursor`), item models.
- `cursor.py`: HMAC-SHA256 signed cursor codec encoding keyset boundary `(saved_at, item_id)` with filter guards.
- `models.py`: OpenAPI-compliant DTOs (`LibraryMutationResponseDto`, `LibraryItemsResponseDto`, `SavedConceptItemDto`, `SavedContentItemDto`, `SavedSentenceItemDto`).
- `store.py`: Postgres read/write operations for `user_saved_concepts`, `user_saved_content`, `user_saved_sentences`, `concept_save_intents`, and paginated list with `UNION ALL` across collections.
- `service.py`: `LibraryApplication` transaction coordinator.
- `routes.py`: FastAPI routes for:
  - `GET /v1/library/items`
  - `PUT /v1/library/concepts/{conceptId}`
  - `DELETE /v1/library/concepts/{conceptId}`
  - `PUT /v1/library/content/{contentId}`
  - `DELETE /v1/library/content/{contentId}`
  - `PUT /v1/library/sentences/{sentenceId}`
  - `DELETE /v1/library/sentences/{sentenceId}`

### D. Application Wiring (`services/api/src/lingua_api/main.py`)
- Initialize `LibraryApplication` and store on `application.state.library_application`.
- Include `library_router`.
- Register library exceptions in `_register_error_handlers`.

---

## 5. Test & Verification Plan

### Database & Schema Tests (`tests/backend/database/test_library_schema.py`)
- Test migration 0009 applies cleanly and creates expected tables, columns, constraints, and indexes.
- Test immutability trigger rejects `UPDATE` and `DELETE` on `concept_save_intents`.
- Test `learning_events` constraint accepts `'concept_save_intent'`.
- Test migration 0009 rollback (`migrate_down`) and re-application (`migrate_up`).

### API & Invariant Tests (`tests/backend/database/test_library_api.py`)
- **TEST-008B-01**: First Save/Learn creates membership, immutable intent, learning event, and FSRS review item in state 'new'.
- **TEST-008B-02**: Repeated `PUT /v1/library/concepts/{conceptId}` is idempotent; does not duplicate membership, intent, or review item.
- **TEST-008B-03**: Concurrent `PUT` requests (2+ threads) safely converge to exactly 1 membership, 1 intent, 1 learning event, and 1 review item.
- **TEST-008B-04**: Concept unsave (`DELETE`) removes membership, leaves intent and FSRS lineage intact.
- **TEST-008B-05**: Concept resave (`PUT` after `DELETE`) restores membership with new timestamp, does NOT re-create intent or reset FSRS card.
- **TEST-008B-06**: Passive Reader exposure does NOT activate Memory (regression test).
- **TEST-008B-07**: Reader sentence save does NOT activate Memory (regression test).
- **TEST-008B-08**: Content save does NOT activate Memory (regression test).
- **TEST-008B-09**: Starting Level assessment does NOT activate Memory (regression test).
- **TEST-008B-10**: Mid-transaction failure (fault injection) rolls back all mutations atomically (zero partial writes).
- **TEST-008B-11**: Security: IDOR rejection when attempting to save/delete across distinct user actors.
- **TEST-008B-12**: Missing / unowned language profile returns 404 NOT_FOUND.
- **TEST-008B-13**: Non-existent concept / content / sentence returns 404 NOT_FOUND.
- **TEST-008B-14**: List library items returns unified saved concepts, content, and sentences with deterministic ordering.
- **TEST-008B-15**: List library items filters by `itemType` correctly.
- **TEST-008B-16**: List library items filters by `query` text correctly across types.
- **TEST-008B-17**: List library items cursor pagination traverses pages cleanly; tampered or expired cursor returns 422/400.
- **TEST-008B-18**: Full OpenAPI contract response schema validation for all library operations.

---

## 6. Verification Gates
1. `pnpm backend:format:check`
2. `pnpm backend:lint`
3. `pnpm backend:typecheck`
4. `python -m pytest` on real PostgreSQL (all existing + new tests passing).
5. `pnpm contracts:check-generated`
6. `pnpm typecheck` & `pnpm test` (frontend sanity, zero regressions).
