# TASK-K2-09 — Dictionary Normalization and Complete Lemma/Sense Groups

**Status:** PRODUCT PLAN READY FOR INDEPENDENT REVIEW; HOSTED FIXTURE ARCHITECTURE BLOCKED pending a separately reviewed atomic control-plane design. Planning only; no implementation or hosted fixture writes are authorized.
**Prepared by:** GPT-6 Luna / Medium, after K2-08 hosted acceptance PASS.
**Dependencies:** K2-02 lexeme/sense bridge and accepted K2-04–K2-08 runtime state. K2-08 full hosted acceptance and independent review are complete as recorded in `STATUS.md` and `reviews/K2-08-auth-cleanup-boundary-review.md`.

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

## Implementation sequence after plan approval

1. Freeze the reviewed additive API contract and cursor behavior. Inspect provenance gates and schema cardinalities. The current approved staging catalog has no qualifying fixture; any hosted fixture is blocked until its separate atomic trusted-control-plane design passes Max review.
2. Extend backend candidate resolution without bypassing source allowlists; retain matched lexeme/form identities through deduplication. Load complete groups and actor-specific concept badges in the same consistent read snapshot. Preserve backward-compatible flat response by default.
3. Update OpenAPI and generated client types, then Dictionary state/adapters/view to present one lemma group with ordered senses, deduplicating only on stable lexeme identity. Preserve independent Save/Learn per linked concept and existing Library/Reader callers.
4. Keep the current importer candidate format and apply semantics unchanged in K2-09. Run and preserve `knowledge/tests/test_catalog_import.py` checks for existing form deduplication, no-overwrite collision behavior, provenance fail-closed behavior, deterministic plan/hash, and idempotent reapply; compare/document the production-starter importer’s one concept-linked lexeme and one order-1-sense limitation. Do not add a candidate format or importer behavior for shared lemmas/multiple senses here. Any such format change requires a separate explicit future specification and review.
5. Add no migration unless measured query-plan evidence requires an index and the plan is reviewed. Keep browser access through the API; do not grant direct catalog table access.
6. Use a separate GPT-6 Luna / Max implementation worker and an independent GPT-6 Luna / Max security/final reviewer. Preserve a reviewable diff and wait for explicit root implementation authorization after this plan is accepted.

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
- HOSTED FIXTURE ARCHITECTURE IS BLOCKED / NOT AUTHORIZED. Before any hosted fixture write, separate GPT-6 Luna / Max review must approve a bounded transaction design using the existing trusted server-side database control plane. Setup/cleanup must lock exact parent identities to serialize FK inserts; apply source/hash/tree guards; enumerate CASCADE, RESTRICT, and SET NULL dependents (including `phrase_specifications.headword_concept_id`); prove all outside acceptance-actor, ordinary learner, and catalog references absent; and prove restrictive FK behavior where required. Abort on any outside or unknown affected row or mutation, including SET NULL side effects, and define crash recovery. Request-by-request Admin deletion is insufficient. Existing service-role capabilities suffice; do not add roles, grants, RLS changes, or SECURITY DEFINER helpers, or broaden the custom read-only role/table whitelist.
- If approved later, the fixture must use newly reserved unique query/lemma/form prefixes (never ordinary `go`/`went` rows), new exact row IDs, and exact source/content hash guards. Preflight collision and source/row identity before inserts. Existing `service_role` already has SELECT/INSERT/DELETE for `concepts`, `lexemes`, `lexeme_forms`, `word_senses`, `concept_senses`, `source_records`, `data_sources`, and `licenses`.
- Exercise searches and learner-owned badges only through normal authenticated actor HTTP requests and JWT/RLS. Unit/database tests separately cover exact `went` → `go` behavior. Hosted fixture data should include an inflected form, a shared lemma with ordered multiple senses, and multiple linked concepts, enabling complete grouped-page and independent badge assertions.
- A later approved setup/cleanup must use bounded transactions in the existing trusted server-side database control plane, not unguarded per-request Admin deletes. Lock exact parents, verify source/hash/tree identity, enumerate catalog cascade children and all actor/ordinary learner references, and fail closed on any unexpected or unknown affected row. Erase acceptance actors and learner-owned state through the approved scoped cleanup path, then remove exact fixture rows atomically and verify absence. Include crash-recovery behavior before use.
- Fixture setup is a proposal only; hosted writes remain unauthorized until separate Max architecture review approves the transaction/control-plane boundary, ownership, privilege split, guards, reference checks, cascade/FK behavior, crash recovery, cleanup order, and retained comparison. Preserve the 27-table retained snapshot, and make no role/grant/Auth/RLS/SECURITY DEFINER changes or manual credentials.

## Source surfaces to expect

- Backend: `services/api/src/lingua_api/dictionary/{routes,models,service,store,cursor,domain}.py`, shared actor/badge projection in `brain/` only as needed.
- Contract/client: `contracts/openapi.yaml`, generated artifacts and types under `packages/types/`.
- UI: `apps/web/src/features/dictionary/{useConceptDiscovery,adapters,DictionaryView}.ts*` and focused Dictionary tests.
- Import/provenance: `knowledge/catalog_import.py` and `knowledge/tests/test_catalog_import.py`; preserve current importer format and behavior, validate no-overwrite collisions/provenance/form deduplication/idempotence, and record its one-sense limitation. A multi-sense/shared-lemma import format is a separate future specification.
- Schema/query evidence: existing migrations and catalog model; no migration unless plan-approved measured need.
- Verification: focused backend/contract/frontend tests, relevant typecheck/lint, and a controlled hosted fixture run with independent final review.

## Explicitly unresolved for plan review

- Atomic trusted-database fixture setup/cleanup design and its independent Max review remain blocked before any hosted fixture write.
- Whether actual query plans justify any index. Do not answer this by inventing public fields, new normalization rules, or grants.
