# TASK-K2-02 — Polysemy & Concept Senses Bridge

Status: IN PROGRESS — isolated implementation branch
Owner: parallel MCP engineering lane
Base: d7d00ecbbbb0e001cf1dfaba12d050196a9d6c62
Branch: agent/k2-02-polysemy

## Objective

Implement the approved Knowledge V2 Wave K2-02 bridge from a deduplicated lexical lemma to
learner-addressable concept senses without changing the frozen FRLL learner-state semantics.

## Authoritative scope

- Additive migration 0015 creating public.concept_senses.
- Backfill the existing V1 one-lexeme/one-sense mappings.
- Preserve the strict lexemes uniqueness and existing lexeme_forms identity.
- Add the backend ORM/DTO representation needed to query the canonical bridge.
- Add PostgreSQL, rollback/reapply, constraint, privilege, ORM and polysemy tests.
- Extend the read-only FRLL migration/table verifier registry for 0015.

## Locked semantics

- One lemma/POS remains one lexemes row.
- A word_senses row remains the semantic definition identity and keeps its existing
  (lexeme_id, sense_order) uniqueness.
- A pedagogical concept_id can link to one or more specific word_sense_id values.
- Multiple concepts may point at senses of one shared lexeme; learner state remains anchored to
  the distinct concept IDs.
- is_primary is a property of the concept-to-sense bridge. The backfill marks
  sense_order = 1 as primary and preserves later sense order in word_senses.
- Provenance remains first-class on the existing concepts and word_senses rows; the bridge is
  structural and does not invent a second provenance record.
- Canonical tables remain backend-owned. Browser roles retain zero table/schema access.

## Out of scope

- K2-03 graph taxonomy, DAG trigger, recursive graph queries, advisory locks or graph concurrency.
- K2-04 grammar detail API/Brain integration.
- K2-05 learner retrievability view or FSRS SQL math.
- Any learner table, evidence, review, FSRS, Today or Library mutation.
- OpenAPI, generated clients, frontend behavior or Vercel/Render deployment.
- A new polysemous candidate/import format. The existing importer remains one-sense-per-current
  candidate; a future import-spec task must define how multiple homonymous concepts are staged and
  idempotently reconciled before changing that pipeline.

## Acceptance checks

1. concept_senses has the specified composite primary key, cascading FKs, timestamp and
   word-sense lookup index.
2. Migration 0015 backfills every existing lexeme/sense mapping exactly once and is reapply-safe.
3. Two concepts can resolve two senses through one shared lexeme without a duplicate lexeme or
   morphology row.
4. Existing canonical UUIDs and provenance survive; learner tables remain unchanged.
5. Browser roles have no table privileges; no RLS/API exposure is added.
6. No contract or frontend changes are required.

## Promotion gate

Do not apply 0015 to hosted staging until K2-01 staging acceptance is explicitly recorded as PASS.
After that gate, apply 0015 through the normal migration runner, verify the 0015 checksum, run the
K2-02 hosted smoke/preflight, then promote only this branch's reviewed commit.
