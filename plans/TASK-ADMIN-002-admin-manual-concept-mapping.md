# TASK-ADMIN-002 — Admin Manual Concept Mapping

## Boundary

Add an owner-only catalog search and exact sentence-occurrence mapping workflow to the
accepted first-party content authoring slice. Reuse `sentence_concepts` and
`content_concepts`; no migration, learner-state write, or learner API change is allowed.

## Contract

- `GET /v1/admin/concepts/search` searches accepted English catalog records without a
  learner profile dependency.
- `PUT /v1/admin/content/{contentId}/sentences/{sentenceId}/concepts/{conceptId}` adds one
  concept occurrence at an explicit UTF-16 `[startOffset, endOffset)` span. Repeating the
  same request is idempotent.
- `DELETE` on the same resource and offsets removes that exact occurrence idempotently.
- Admin content sentence DTOs expose ordered occurrence details and retain `conceptCount`.

## Invariants

- Server owner allowlist protects search and every mutation.
- Content must be an ADMIN-001 record; sentence must belong to that content; concept must
  be an allowed English catalog record.
- Published or retired content is immutable.
- Spans must be inside the sentence and may not overlap another occurrence.
- `content_concepts` is rebuilt transactionally after each mutation.
- Mapping never writes users, learner profiles, Library, Memory, Review, competence,
  Today, evidence, or learning events.

## Test-first slices

1. Backend contract/store tests: owner search, authorization, identity validation,
   span validation, duplicate safety, add/remove/reload, publication immutability,
   validation/publish readiness, and zero learner-state writes.
2. Frontend contract/client/adapter tests: search, selected UTF-16 span, add/remove,
   reload persistence representation, and readiness summary.
3. Implement OpenAPI, backend projections/store/service/routes, regenerate TypeScript,
   extend `ApiClient`, then implement the bounded admin editor.

## Verification

OpenAPI validation and generated freshness; Ruff format/lint; mypy; focused and full
backend tests on PostgreSQL; frontend focused/full tests; typecheck; ESLint; Storybook;
production build; `git diff --check`; forbidden learner-state/schema review.
