# TASK-READ-001 — Reader Live Integration

## Scope

Replace the default fixture/local-state behavior of `/read` with the frozen live Content, Reader,
Concept, and Library API boundaries. Preserve the existing Reader presentation and all accepted
learner-domain invariants.

## Locked boundaries

- OpenAPI remains authoritative; no endpoint or field is added.
- Published content is loaded through `GET /v1/content/recommended` then `GET /v1/content/{contentId}`.
- Concept inspection uses the canonical concept ID from the content annotation and
  `GET /v1/concepts/{conceptId}`.
- Deliberate lookup/read interactions use `POST /v1/reader/exposures`; exposure never saves a
  concept or creates learning intent.
- Sentence/content saving uses the existing Reader/Library mutations. Concept Save/Learn uses only
  `PUT /v1/library/concepts/{conceptId}`.
- Resume state uses only `PUT /v1/reader/progress/{contentId}` plus the authoritative
  `readingProgress` returned with content. No local persistence authority is introduced.
- Existing actor epoch plus same-actor request sequencing must prevent stale state commits.
- No contract, backend, database, migration, FSRS, competence, Today, Review, Brain, or Admin change.

## Implementation slices

1. Add generated-schema aliases and `ApiClient` methods for Reader exposure/progress; cover exact
   HTTP paths, methods, bodies, and idempotency headers.
2. Expand the Reader adapter/view model so content segment/sentence identity, authoritative order,
   progress, save state, audio, and attribution survive the DTO boundary.
3. Add an actor-safe Reader hook for catalog/detail loading, retry, concept inspection, explicit
   exposure, saves, and progress updates. Reuse stable idempotency keys for retries of one logical
   mutation and suppress duplicate clicks.
4. Reconnect `InteractiveReader` to live state while keeping explicit fixture injection available
   only for presentation tests/Storybook. Render all authoritative segments/sentences and the
   existing loading/empty/error presentation without a live fixture fallback.
5. Add focused tests for live loading, empty/error/not-found behavior, ordering and identity,
   canonical lookup, passive exposure, explicit save boundaries, progress/reload restoration,
   stable mutation retries, duplicate suppression, and actor/same-actor stale-response isolation.
6. Run contract freshness, frontend and backend quality gates; perform spec, architecture,
   boundary, regression, and code-quality review. Update `TASKS.md`/`STATUS.md` only after all gates
   pass, then create one bounded local commit.

## Verification

- Focused Reader and HTTP transport tests.
- `git diff --check` and zero diff under `contracts/`, `services/`, `database/`, migrations, and
  generated OpenAPI types.
- `pnpm backend:format:check`, `pnpm backend:lint`, `pnpm backend:typecheck`, `pnpm backend:test`.
- `pnpm contracts:check-generated`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- `pnpm build-storybook` only if shared UI components/stories change.
