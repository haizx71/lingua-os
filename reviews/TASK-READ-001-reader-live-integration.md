# TASK-READ-001 — Reader Live Integration Review

## Outcome

PASS. No Critical or Required finding remains.

## Specification compliance

- Published learner-visible content is loaded through the existing recommended-content and content-detail operations.
- All segment and sentence identities and order come from the authoritative DTO; the UI does not rebuild or reorder content.
- Annotated token inspection uses its canonical concept ID. Lookup/read exposure remains non-activating and does not send a concept ID.
- Sentence and content save remain Library-only state. Only explicit concept Save/Learn invokes the canonical concept Library mutation.
- Reading progress and reload resume use the server projection. No browser storage becomes resume authority.
- No frontend FSRS, competence, Today, Review or Brain algorithm was introduced.

## Architecture and boundary review

- Boundary remains OpenAPI-generated DTO aliases → `ApiClient`/transport → adapter/view model → Reader hook → React.
- The HTTP client uses the exact frozen Reader paths and forwards required idempotency headers.
- Actor epoch/ID checks and independent load/inspection sequences reject Actor A/B and same-actor stale continuations.
- Per-action mutexes suppress duplicate clicks. One logical failed progress operation retains its idempotency key for retry.
- Errors map to localized UI state and do not expose backend/database details.
- `contracts/`, `services/`, `database/`, migrations and generated OpenAPI output have zero diff.

## Regression and code-quality review

- Legacy presentation tests now inject a Reader fixture explicitly instead of treating the product route fixture as live data.
- Audio controls render only when the content DTO supplies audio; no fake audio/POS/default concept authority was added.
- Save callbacks and success notices occur only after the transport confirms `isSaved=true`.
- `readerResumePosition` was removed from the persistence-gap registry because the already-frozen reading-progress contract is now connected.

## Verification evidence

- Focused live Reader: 12/12 PASS.
- Focused Reader/HTTP/contracts/regression: 105/105 PASS.
- Frontend and static acceptance excluding the four external live FRLL phase files: 690/690 PASS across 52 files.
- A voluntary live aggregate run completed Phase B/C/D/E domain assertions and cleanup; its pre-fix aggregate result was 693/694 solely because one legacy Reader presentation test still expected the removed route fixture. That test was corrected, and the complete non-live aggregate then passed 690/690.
- Backend: 510/510 PASS on PostgreSQL.
- Ruff format: 120 files formatted; Ruff lint PASS; strict mypy PASS across 120 source files.
- Generated OpenAPI TypeScript freshness, workspace TypeScript, ESLint and production build PASS.
- `git diff --check` PASS.
- Storybook not rerun because no shared UI primitive or story changed.

## Known limitations

- The MVP selects the first authoritative recommended content item; content browsing/selection is a separate product slice.
- Reader audio appears only when published content includes an audio URL.
- Saved-sentence notes remain outside the frozen contract.
