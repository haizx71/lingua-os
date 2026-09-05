# Implementation Plan: TASK-009 MINI — Live Concept Discovery + Save/Learn UI

## 1. Overview & Objective
Implement the smallest complete real frontend slice connecting an authenticated, product-ready learner to:
1. Real concept discovery/search via `GET /v1/dictionary/search`
2. Concept result inspection (viewing IPA, part of speech, CEFR level, definitions, examples via `GET /v1/concepts/{conceptId}`)
3. Explicit "Save to learn" / "Lưu để học" action
4. Authoritative Memory activation via `PUT /v1/library/concepts/{conceptId}`
5. Authoritative saved state reconciliation via `GET /v1/library/items?itemType=concept`
6. Actor lifecycle isolation and search query race-condition protection

## 2. Invariants & Guardrails
- **Zero backend/contract diff**: Absolutely no changes in `services/`, `database/`, or `contracts/`.
- **Bounded surface**: Strictly bounds to Concept Discovery & Save/Learn UI in Dictionary. Reader, Today, Review, Brain, Progress, full Library, and Starting Level remain unchanged.
- **Explicit learner intent only**: Under no circumstances may Save/Learn be invoked automatically on search, hover, mount, exposure, or inspection. Only on explicit button click.
- **Intent copy, not competence**: UI copy expresses intent to learn ("Lưu để học" / "Đã lưu vào kho học"), NOT competence or mastery ("Đã thành thạo" / "Mastered").
- **Server authority**: Client performs zero FSRS calculations, due date math, competence mass formulas, or mastery estimations.
- **Concurrency & Race Safety**: Out-of-order search responses are discarded via incremental sequence ID tracking. Stale actor responses are isolated via `isCurrentActor` and `LinguaActorAbortedError` checks.
- **Non-blocking duplicate prevention**: In-flight save operations disable the button and show pending state ("Đang lưu...") to prevent duplicate requests.

## 3. Architecture & Key Files

### A. Adapter & View Model Layer (`apps/web/src/features/dictionary/adapters.ts`)
- Maps `ConceptSummaryDto` and `ConceptDetailDto` to `ConceptSearchResultViewModel`.
- Formats `partOfSpeech` to localized Vietnamese terminology (`noun` -> `Danh từ`, `verb` -> `Động từ`, etc.).
- Preserves concept IDs, IPA, CEFR code, status, and isDue flags.

### B. Live Concept Discovery Hook (`apps/web/src/features/dictionary/useConceptDiscovery.ts`)
- Manages search input, debounced query dispatch, and sequence counter.
- Reconciles saved state across all cursor pages via multi-page `apiClient.listLibraryItems({ itemType: 'concept', cursor })`.
- Cycle loop protection: tracks `seenCursors` and terminates traversal with fail-closed error if server repeats a cursor.
- Full cursor exhaustion: commits authoritative `savedConceptIds` and sets `isSavedStateReady = true` only after traversal completes.
- In-flight checking state: while `!isSavedStateReady`, concept cards render disabled "Đang kiểm tra..." button, preventing false unsaved conclusions.
- Implements `saveConcept(conceptId)` calling `apiClient.saveConceptToLibrary(conceptId)`, disabled during in-flight reconciliation.
- Implements `inspectConcept(conceptId)` lazily calling `apiClient.getConcept(conceptId)`.
- Guards all async operations with `seq === reconcileSequenceRef.current`, `isCurrentActor(epoch, actorId)`, and catches `LinguaActorAbortedError`.

### C. Live Dictionary View Component (`apps/web/src/features/dictionary/DictionaryView.tsx`)
- Integrates `useConceptDiscovery`.
- Backwards compatible with `initialConcepts`, `forcedState`, and `forcedErrorCode`.
- Accessible search input (`aria-label`, clear button, search indicator).
- Result cards with pronunciation audio, status chips, expandable inspection details, and explicit Save/Learn button.
- Comprehensive states: loading, empty results, search error, inline save error, reconciliation error, checking state, and saved feedback.

### D. Automated Test Suite (`tests/frontend/task009-concept-discovery-save.test.tsx`)
19 rigorous invariant tests:
- `TEST-009-01`: authenticated ready learner searches and renders backend concepts.
- `TEST-009-02`: concept IDs preserved through adapter/view model.
- `TEST-009-03`: empty/no-result state handled cleanly.
- `TEST-009-04`: search error state handled with retry capability.
- `TEST-009-05`: stale search results do not overwrite newer query results (rapid typing "cat" -> "dog").
- `TEST-009-06`: stale Actor A search cannot modify Actor B UI.
- `TEST-009-07`: clicking Save/Learn invokes `saveConceptToLibrary` for exact concept ID.
- `TEST-009-08`: no save occurs automatically on mount, search, or view.
- `TEST-009-09`: pending state disables button and prevents duplicate save requests.
- `TEST-009-10`: successful save updates UI to saved state.
- `TEST-009-11`: save failure does not mark concept as saved and exposes actionable error.
- `TEST-009-12`: stale Actor A save result cannot mutate Actor B UI.
- `TEST-009-13`: re-entry / initial load reconciles with library saved concepts.
- `TEST-009-PAGE-01`: multi-page traversal discovers concepts on later pages without PUT.
- `TEST-009-PAGE-02`: second request passes exact opaque cursor and itemType=concept.
- `TEST-009-PAGE-03`: three-page traversal merges all saved IDs without overwriting.
- `TEST-009-PAGE-04`: stale Actor A page resolution cannot mutate Actor B saved state.
- `TEST-009-PAGE-05`: repeated server next cursor / loop anomaly terminates and fails closed.
- `TEST-009-PAGE-06`: concept not present after full cursor exhaustion is treated as unsaved.

## 4. Verification Plan
- `pnpm test` (400/400 frontend tests passing across 33 test files)
- `pnpm typecheck` (0 errors)
- `pnpm lint` (0 warnings/errors)
- `pnpm build-storybook`
- `pnpm build`
- `git diff dd22bb1 -- contracts services database` strictly empty

