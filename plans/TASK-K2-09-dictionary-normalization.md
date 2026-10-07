# TASK-K2-09 — Dictionary Normalization and Complete Lemma/Sense Groups

**Status:** PRODUCT PLAN ACCEPTED; frozen source implementation passed independent review with no HIGH/BLOCKER, exact-head CI, and deployment gates. Hosted fixture architecture has conditional design-only PASS; exact private DTO review, fixture implementation/migration gates, and hosted execution remain pending, and no hosted fixture writes are authorized.
**Prepared by:** GPT-6 Luna / Medium, after K2-08 hosted acceptance PASS.
**Dependencies:** K2-02 lexeme/sense bridge and accepted K2-04–K2-08 runtime state. K2-08 full hosted acceptance and independent review are complete as recorded in `STATUS.md` and `reviews/K2-08-auth-cleanup-boundary-review.md`.

## Current implementation checkpoint — 2026-10-02

- Frozen implementation: 16 product files, diff SHA256 `e03a501398cd4c89495c576844afb3935c9e5aa43a7490372014aa5068f245e5`, 99,065 bytes, based on plan commit `15671dcdb0969947ff21a86e262adbfbaa3c7b1a` and project base `097c673`.
- Implementation worker and independent source reviewer: GPT-6 Luna / Max; Commander is the operator; this packet was prepared by GPT-6 Luna / Medium.
- Independent source review of the exact 16-file binary diff passed with no HIGH/BLOCKER. The reviewer verified fixes, legacy empty-group behavior, query invalidation, `went` coverage, and diff check, but did not rerun test suites.
- Exact tested head `29da9f8b7f96a3d2ca8c8c3de4fd02b51d6dde65` passed Security Gate run `37013641196` and all six Knowledge Audit jobs in run `37013641469`. CI summaries: Dictionary PostgreSQL 48 passed; Grammar 62; Today 40; retrievability 382 passed / 1 deselected; knowledge-audit 57 tests; frontend stages 9 and 102 tests passed. Security-gate step summaries: hosted-harness unit/workflow security 191 passed across 10 files, read-only hosted-probe tests 25 passed, and browser OIDC redirect check 1 passed.
- PR #43 merged normally to master at `7bc877b85bf643af21498da0ba44e2c157e0ae03` on 2026-10-02 13:37:37 UTC. Vercel Preview `6809598033` passed against the exact tested PR head. Render `dep-davr78rm8hqs73ccnee0` is live and `/health` is OK, and Vercel Production deployment `6809699550` succeeded, both against merged SHA `7bc877b85bf643af21498da0ba44e2c157e0ae03`. The worker’s separate local results remain 66 backend/Brain/OpenAPI, 102 UI, and 14 importer checks; the independent reviewer did not rerun those local suites.
- Implemented behavior includes default flat-response and cursor compatibility; grouped bridge-backed lemmas/senses; exact `went` → `go` matching and complete groups; actor-specific concept badges; zero GET-side writes; and legacy flat behavior for zero-sense concepts. Independent review verified the personalized-cache and cross-language bridge fixes. Non-English candidates remain rejected with 404 before grouped store access; this behavior is unchanged and does not broaden the API language contract.
- No product migration or index was added. Query-plan performance remains unmeasured. The current importer stays unchanged and retains its one-candidate/one-sense limitation.
- Hosted fixture design review is documented separately in `reviews/K2-09-hosted-fixture-architecture-review.md`; the bounded proposal is in `plans/TASK-K2-09-hosted-fixture-control.md`. The private DTO plan is under Max review; fixture source, migration/security gate, and hosted acceptance remain pending. Architecture review is design-only and conditional; no hosted setup or cleanup implementation has passed source review, and hosted writes remain unauthorized.

## Objective and invariants

Resolve a normalized lemma or inflected form to its stable lexeme identity and all approved linked senses/concepts. Each concept retains its own actor-scoped mastery, status, due, and saved state. Search and detail remain read-only; existing explicit Save/Learn actions remain the only activation boundary. Preserve provenance filtering, authenticated ownership, existence-safe behavior, deterministic pagination, and the existing Dictionary endpoint.

Do not change unrelated UI, accepted Library/Reader behavior, learner memory lineage, authorization/RLS/grants, migration `0020`, or search-side writes. Do not infer public names or gloss fields from the older V2 prose spec.

## Current contract and data model

- Public operation is `GET /v1/dictionary/search` with `query` (not the older spec’s `q`), optional `languageCode`, `cursor`, and `limit`; source: `services/api/src/lingua_api/dictionary/routes.py`, `contracts/openapi.yaml`, generated types under `packages/types/src/`.
- Default response is `{data: ConceptSummary[], meta: CursorResponseMeta}`; source: `services/api/src/lingua_api/dictionary/models.py`. Preserve this default shape and its cursor context so strict v1 clients receive no extra fields.
- Normalization is Unicode NFKC, casefold, whitespace collapse, and trim in `services/api/src/lingua_api/dictionary/service.py`. Do not add punctuation stripping or another normalization rule without a separately accepted decision.
- `services/api/src/lingua_api/dictionary/store.py` currently searches direct `lexemes` and `lexeme_forms`, collapses candidates by concept, picks the minimum matching normalized form, and orders/cursors by `(matched_normalized_form, concept.id)`. Its canonical lexeme lateral query chooses one matching-approved lexeme deterministically. This currently loses matched lexeme identity where a concept has multiple lexemes.
- Required search/canonical/detail resolution: preserve the matched lexeme’s approved `concept_senses` bridge links, with legacy direct `lexemes.concept_id` fallback only when the concept has no `concept_senses` rows. Prefer an approved direct lexeme for the requested concept; secondary concept fallback may use only that concept’s own approved sense bridge, in deterministic order. Detail definitions come only from the requested concept’s own bridge links, with legacy direct fallback only when that concept has no bridge rows; never include sibling-concept senses. Preserve existing Brain status/mastery/competence projection semantics.
- Existing schema bridge is `lexemes`, `lexeme_forms`, `word_senses`, and `concept_senses` (`database/migrations/0001_core_schema_v1.up.sql`, `database/migrations/0015_knowledge_v2_polysemy_resolution.up.sql`). `concept_senses` is many-to-many; a concept can link multiple senses and a sense may link multiple concepts. Persisted gloss fields are `word_senses.definition`, `definition_language_code`, `translated_definition`, `translation_language_code`, and `sense_order`.
- UI currently maps each flat concept summary independently (`apps/web/src/features/dictionary/useConceptDiscovery.ts`, `apps/web/src/features/dictionary/adapters.ts`, `apps/web/src/features/dictionary/DictionaryView.tsx`). Save/Learn remains the explicit Library action.
- The older `docs/knowledge-v2/09-brain-library-dictionary.md` is partly proposal text and contains contract mismatches (`q`, punctuation stripping, `definition_en`, `definition_vi`, `ipa_us`, and `user_saved_concepts`). Those names are not accepted contracts.

## Bounded compatibility design for review

1. Keep the existing endpoint, query parameters, flat `data` and cursor metadata as the default. Candidate matching expands through the approved `concept_senses` bridge. Preserve existing flat sorting and cursor payload/context; grouped projection adds no cursor mode/version because it decorates selected concept pages with complete groups. Report a concrete semantic counterexample before proposing cursor changes.
2. Use the root-approved additive names: query parameter `includeLemmaGroups` (boolean, default `false`) and optional response property `lemmaGroups`, omitted for default strict clients. These are concrete bounded contract choices ready for independent review, not implemented source. Each page’s groups cover all distinct matching `lexeme.id` values associated with selected concept candidates, preserving bridge links plus legacy direct fallback only when a concept has no bridge rows; each group includes its complete approved senses and linked concepts.
3. Proposed group fields: `lexemeId`, `lemma` (persisted lexeme lemma), nullable `partOfSpeech` (persisted lexeme POS), `matchedForms` (distinct sorted normalized matching strings), and ordered `senses`. Proposed sense fields: `senseId`, `senseOrder`, `definition`, `definitionLanguageCode`, optional `translatedDefinition` with `translationLanguageCode` (omit both translation fields together when persisted values are null), and `concepts`.
4. Each sense’s `concepts` is an array of objects with the existing `BrainConceptSummaryDto` fields plus actor-owned `isSaved` directly on each object (no additional invented nested summary wrapper). The nested existing `ConceptSummaryDto` carries status/due; Brain fields carry persisted mastery (nullable where the real projection has no value), competence, confidence, memory, exposure count, and last-seen time. Do not use a fabricated zero or change Brain mastery semantics; do not invent a narrower projection format or gloss fields from the older prose spec.
5. A group is complete within each page: never split its senses or concepts. A lexeme may repeat on later pages when its concepts are reached by different selected concept candidates; clients deduplicate only by stable `lexemeId`, and repeated groups must be complete/equal (never partial fragments unioned to conceal incomplete server groups). Preserve every matching lexeme identity through concept deduplication; where several lexemes share a concept, include that concept under each matching lexeme with its independent badge.
6. Preserve cursor tokens bound to actor, active language profile, language, normalized query, and existing version/context. Advancement uses unchanged flat ordering/context; no cursor contract change is proposed. Group inner ordering is deterministic by stable lexeme identity, matched form, then sense order and sense ID.
7. Do not migrate by default. Inspect representative `EXPLAIN (ANALYZE, BUFFERS)` plans on the controlled staging fixture and realistic read-only catalog query first. A new index requires measured evidence, migration review, normal RLS/grant review, and migration gates.

## Frozen implementation scope and remaining gates

1. Product contract and source implementation are frozen. Independent GPT-6 Luna / Max source review passed with no HIGH/BLOCKER; exact-head CI and same-SHA deployment gates passed. The current approved staging catalog has no qualifying fixture, and hosted execution remains blocked by fixture-source/private-DTO/migration gates.
2. Backend bridge candidate resolution, matched lexeme/form retention, complete grouped projection, and actor-specific concept badges are implemented in the frozen diff. Preserve source allowlists and the backward-compatible flat response.
3. OpenAPI/generated types and Dictionary UI presentation are implemented in the frozen diff, including ordered senses, stable lexeme identity, independent per-concept Save/Learn, and existing Library/Reader behavior.
4. The current importer candidate format and apply semantics remain unchanged. Worker-reported `knowledge/tests/test_catalog_import.py` checks cover current form deduplication, no-overwrite collision behavior, provenance failure, deterministic plan/hash, and idempotent reapply. The production-starter importer remains limited to one concept-linked lexeme and one order-1 sense; shared-lemma/multi-sense import requires a separate future specification.
5. No product migration or index was added. Query-plan performance is unmeasured; a migration remains contingent on measured evidence and separate review. Browser access stays through the API.
6. Do not alter frozen product source. Hosted fixture source or writes must wait for exact private DTO/spec review, implementation/source review, migration/security gates, and explicit Commander authorization after the conditional architecture design PASS.

## Verification plan

### Backend and contract

- Exact lemma and inflected-form resolution (roadmap example `went` → `go`), query casefold/NFKC/whitespace behavior, and punctuation behavior unchanged.
- One shared lemma with multiple ordered senses and concepts; one sense linked to multiple concepts; multiple matching lexemes sharing a concept; deterministic tie and form attribution.
- Complete grouped results across page boundaries, repeated-page stability, no split group, deterministic cursor ordering, invalid/wrong-query/wrong-actor cursor rejection, and default response exact-shape compatibility.
- Correct locale/gloss columns and all-approved provenance gates; no unapproved source data in either flat or grouped path.
- Actor-owned concept status/due/save badges are independent; two actors receive isolated badges; repeated search has zero writes.
- API contract checks, generated OpenAPI/client freshness, focused backend tests, backend check, typecheck/lint, and relevant full suites after meaningful focused coverage. Update CI path selectors/triggers and the disposable-PostgreSQL integration command so Dictionary source and focused Dictionary API tests are actually covered.

### Importer and frontend

- Existing importer regression coverage: form normalization/dedupe, bridge/collision behavior where present, provenance failure, deterministic plan/hash, and idempotent reapply with no overwrite or unexpected learner-state mutation. Do not add multi-sense/shared-lemma importer semantics in K2-09.
- Group UI ordering, repeated complete-group deduplication by `lexeme.id`, preservation of matched lexeme/form identity, independent concept badges, explicit Save/Learn activation only, and loading/error/empty behavior.
- Regression coverage for existing flat-response Dictionary consumers, Library and Reader integration, actor switching/cache isolation, accessibility, and generated DTO consumers.

### Hosted acceptance and privilege boundaries

- Live read-only staging feasibility check found 94 eligible approved English lexemes, none with both at least two approved senses and at least two approved linked concepts; there are zero approved `went` forms. Existing approved catalog data cannot prove the complete K2-09 hosted criteria.
- HOSTED FIXTURE ARCHITECTURE: conditional design-review PASS only; details and limits are in `reviews/K2-09-hosted-fixture-architecture-review.md`. No setup/cleanup source is implemented or authorized for hosted use. Any implementation must use an atomic transaction in the existing trusted staging control plane, lock exact parent identities to serialize FK inserts, apply exact source/hash/tree guards, enumerate CASCADE/RESTRICT/SET NULL dependents (including `phrase_specifications.headword_concept_id`), prove outside acceptance-actor, ordinary learner, and catalog references absent, and abort on unknown/outside effects. Request-by-request Admin deletion is insufficient. No new roles, grants, RLS changes, SECURITY DEFINER helpers, or expansion of the custom read-only whitelist.
- If approved later, the fixture must use newly reserved unique query/lemma/form prefixes (never ordinary `go`/`went` rows), new exact row IDs, and exact source/content hash guards. Preflight collision and source/row identity before inserts. Existing `service_role` already has SELECT/INSERT/DELETE for `concepts`, `lexemes`, `lexeme_forms`, `word_senses`, `concept_senses`, `source_records`, `data_sources`, and `licenses`.
- Exercise searches and learner-owned badges only through normal authenticated actor HTTP requests and JWT/RLS. Unit/database tests separately cover exact `went` → `go` behavior. Hosted fixture data should include an inflected form, a shared lemma with ordered multiple senses, and multiple linked concepts, enabling complete grouped-page and independent badge assertions.
- A later approved setup/cleanup must use bounded transactions in the existing trusted server-side database control plane, not unguarded per-request Admin deletes. Lock exact parents, verify source/hash/tree identity, enumerate catalog cascade children and all actor/ordinary learner references, and fail closed on any unexpected or unknown affected row. Erase acceptance actors and learner-owned state through the approved scoped cleanup path, then remove exact fixture rows atomically and verify absence. Include crash-recovery behavior before use.
- The complete bounded control-plane proposal and conditional review scope are recorded in `plans/TASK-K2-09-hosted-fixture-control.md`; implementation, migration/security review, and hosted run are still pending. Preserve the existing 27-table retained snapshot and current Auth/RLS/grant boundaries; do not use manual credentials.

## Source surfaces to expect

- Backend: `services/api/src/lingua_api/dictionary/{routes,models,service,store,cursor,domain}.py`, shared actor/badge projection in `brain/` only as needed.
- Contract/client: `contracts/openapi.yaml`, generated artifacts and types under `packages/types/`.
- UI: `apps/web/src/features/dictionary/{useConceptDiscovery,adapters,DictionaryView}.ts*` and focused Dictionary tests.
- Import/provenance: `knowledge/catalog_import.py` and `knowledge/tests/test_catalog_import.py`; preserve current importer format and behavior, validate no-overwrite collisions/provenance/form deduplication/idempotence, and record its one-sense limitation. A multi-sense/shared-lemma import format is a separate future specification.
- Schema/query evidence: existing migrations and catalog model; no migration unless plan-approved measured need.
- Verification: focused backend/contract/frontend tests, relevant typecheck/lint, and a controlled hosted fixture run with independent final review.

## Remaining release gates

- Exact-head CI and deployment for frozen product source passed; independent source review passed with no HIGH/BLOCKER.
- Control-plane fixture architecture has conditional design-only approval. Its implementation, migration/security gate, and full hosted acceptance remain pending; hosted writes are not authorized.
- Whether actual query plans justify any index. Do not answer this by inventing public fields, new normalization rules, or grants.
