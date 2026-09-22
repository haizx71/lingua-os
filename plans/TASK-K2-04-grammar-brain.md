# TASK-K2-04 — Grammar Specifications and Brain Integration

Status: IN PROGRESS  
Owner: CODEX single-writer lane  
Base source SHA: `d8658c83640df88af789c915f985f921d851bc7f`  
Branch: `agent/k2-04-grammar-brain`

## Objective

Complete the approved K2-04 slice by hydrating the eight accepted starter grammar concepts with
structured, first-party grammar specifications and exposing those specifications through the
authenticated, read-only Brain concept detail flow.

## Locked boundaries

- Reuse the `grammar_specifications` schema accepted in migration `0014`; no new migration.
- Preserve the accepted Brain v1 learner projection, actor isolation, synthetic-zero behavior, and
  read-only transaction boundary.
- Add an optional grammar envelope to the public concept detail contract. Lexical and skill concepts
  omit it; the backend never fabricates lexical definitions or part of speech for grammar concepts.
- Canonical grammar hydration is deterministic, provenance-preserving, collision-sensitive, and
  idempotent. It never touches learner, evidence, Review/FSRS, Today, or Library tables.
- Raw FSRS values remain private.

## Implementation slices

1. Add a versioned, hash-verifiable grammar-spec manifest for all eight accepted starter grammar
   keys and extend the existing guarded catalog importer to validate, preflight, apply, and verify
   those rows in the same catalog transaction.
2. Add backend projection/DTO/repository support for an optional grammar specification on Brain
   concept detail.
3. Update OpenAPI and regenerate TypeScript types through the official command.
4. Extend the Brain adapter/view model and detail panel to render formula, communicative function,
   Vietnamese explanation, common traps, and structural slots.
5. Add focused importer, PostgreSQL/API, contract, adapter, and UI tests before the production
   implementation is considered complete.

## Verification gate

- Grammar manifest schema/hash/content and importer idempotency/collision checks pass.
- All eight grammar concepts hydrate exactly once; rerun produces no duplicate or learner write.
- Brain grammar detail includes the complete grammar envelope; a lexical detail omits it.
- Hidden/non-owned profile behavior and GET-side zero-write invariants remain unchanged.
- OpenAPI validation, generated freshness, Ruff format/lint, mypy, affected backend tests,
  frontend Vitest/typecheck/lint/build, and Storybook pass.
- Production dependency audit reports zero Critical/High/Moderate.
- External review has no unresolved BLOCKER/HIGH before promotion.

## Hosted gate

Apply the reviewed catalog plan through the guarded importer-equivalent path, snapshot before and
after, verify eight specs and browser/backend privilege boundaries, confirm learner rows are
untouched, smoke one grammar and one lexical Brain detail, verify Render source/health, and remove
all temporary acceptance fixtures.

## Deterministic artifact hashes

- Catalog candidate SHA-256: `c44b11af72257accb177448199eb0e08ca3c52b9257594596a85aab43d97fde9`
- Catalog plan SHA-256: `855c9ae6a034990899e62ec3e158db25b45e8880125031d523debd73f2b587c9`
- Grammar manifest SHA-256: `5b19e8e2366e02f5e0a8cc3f6e7a03fa9208b3df7ebed919841169302fba287a`
- Grammar sub-plan SHA-256: `8651c1510a8653477421b0ee541ae4f3dd910e446aa5eea2ad2ee1238a26d810`
