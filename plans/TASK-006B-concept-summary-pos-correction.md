# TASK-006B — ConceptSummary partOfSpeech contract correction

## Objective

Align the public concept transport model with the approved domain: lexical concepts may expose a
part of speech, while grammar and skill concepts may omit it or return `null`. Preserve all
existing Review ownership, validation, scheduling, frontend UX, and motion behavior.

## Affected files

- `contracts/openapi.yaml`
- `packages/types/src/generated/openapi.ts` (generated only)
- `packages/types/src/api/mock-fixtures.ts`
- `packages/types/src/view-models.ts`
- `packages/types/src/adapters/index.ts`
- POS-presentational consumers under `apps/web/src/features/{review,dictionary,read,brain}/`
- `services/api/src/lingua_api/review/{models,domain,store}.py`
- focused backend contract/Review and frontend contract/component tests
- `TASKS.md`, `STATUS.md`, and a concise task review record

## Contract and migration impact

- Remove `partOfSpeech` from the required fields of `ConceptSummary` and `ConceptDetail`.
- Permit the property to be either the existing `PartOfSpeech` string or `null`; omission is also
  valid. Schemas using these models inherit the rule through `$ref`.
- No enum, error-registry, endpoint, persistent-schema, or migration change.

## Implementation slices

1. Add failing contract, Review integration, generated-type, adapter, fixture, and presentation
   regression tests for lexical, grammar, and skill concepts.
2. Correct OpenAPI and regenerate the checked-in immutable TypeScript surface.
3. Make Review DTO/projection serialization accept missing POS without weakening ownership or
   other projection validation.
4. Propagate optional/null POS through frontend view models and pure adapters; conditionally render
   metadata without fake labels or dangling separators.
5. Run focused tests, then every requested backend/database/frontend quality gate.

## Acceptance checks

- Lexical `ConceptSummary` with POS validates.
- Grammar and skill `ConceptSummary` values without POS validate.
- `ConceptDetail` follows the same rule; Review/Dictionary/Library/Brain references remain
  consistent, while Reader/Today schemas are unchanged.
- Review queue serializes a due non-lexical concept and omits `partOfSpeech` rather than failing or
  inventing a fallback.
- Generated TypeScript exposes `partOfSpeech?: PartOfSpeech | null` and freshness passes.
- Frontend adapters/view models/components preserve absent POS without `unknown`, `other`, `n/a`,
  empty parentheses, or dangling separators.
- Deterministic mocks cover one lexical concept with POS and non-lexical concepts without POS.
- Frontend tests remain at or above 282 meaningful tests.

## Risks and controls

- OpenAPI duplication drift: audit all POS occurrences and every `$ref` consumer.
- Accidental validation weakening: retain canonical form, status, prompt, ownership, and all current
  Review checks; relax POS only.
- Visual regression: use conditional text fragments only; do not change layout, tokens, or motion.

