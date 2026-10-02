# TASK-K2-09 — Dictionary Normalization and Complete Lemma/Sense Groups

**Status:** READY FOR PLAN REVIEW; planning only. No implementation is authorized by this document.
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
- Existing schema bridge is `lexemes`, `lexeme_forms`, `word_senses`, and `concept_senses` (`database/migrations/0001_core_schema_v1.up.sql`, `database/migrations/0015_knowledge_v2_polysemy_resolution.up.sql`). `concept_senses` is many-to-many; a concept can link multiple senses and a sense may link multiple concepts. Persisted gloss fields are `word_senses.definition`, `definition_language_code`, `translated_definition`, `translation_language_code`, and `sense_order`.
- UI currently maps each flat concept summary independently (`apps/web/src/features/dictionary/useConceptDiscovery.ts`, `apps/web/src/features/dictionary/adapters.ts`, `apps/web/src/features/dictionary/DictionaryView.tsx`). Save/Learn remains the explicit Library action.
- The older `docs/knowledge-v2/09-brain-library-dictionary.md` is partly proposal text and contains contract mismatches (`q`, punctuation stripping, `definition_en`, `definition_vi`, `ipa_us`, and `user_saved_concepts`). Those names are not accepted contracts.

## Bounded compatibility design for review

1. Keep the existing endpoint, query parameters, flat `data` and cursor metadata as the default. Candidate matching expands through the approved `concept_senses` bridge. Preserve existing flat sorting and cursor payload/context; grouped projection adds no cursor mode/version because it decorates selected concept pages with complete groups. Report a concrete semantic counterexample before proposing cursor changes.
2. Use the root-approved additive names: query parameter `includeLemmaGroups` (boolean, default `false`) and optional response property `lemmaGroups`, omitted for default strict clients. These are concrete bounded contract choices ready for independent review, not implemented source. Each page’s groups cover all distinct matching `lexeme.id` values associated with selected concept candidates and include each lexeme group’s complete approved senses and linked concepts.
3. Proposed group fields: `lexemeId`, `lemma` (persisted lexeme lemma), nullable `partOfSpeech` (persisted lexeme POS), `matchedForms` (distinct sorted normalized matching strings), and `senses` ordered by persisted `sense_order`, then sense ID. Proposed sense fields: `senseId`, `senseOrder`, `definition`, `definitionLanguageCode`, and optional `translatedDefinition` with `translationLanguageCode`; omit both translation fields together when persisted values are null. Do not derive glosses from the older prose spec.
4. Each linked concept wrapper should reuse the existing `BrainConceptSummaryDto` projection: its nested `ConceptSummaryDto` carries status and due state; the wrapper carries the persisted mastery (nullable where the real projection has no value), competence, confidence, memory, exposure count, and last-seen time. Add only `isSaved`, projected from the authenticated actor’s actual `user_saved_concepts` membership. Do not use a fabricated zero or change mastery semantics. This is the smallest existing accepted projection that provides actual mastery/status; independently review whether its full competence/memory fields are acceptable for Dictionary, or define a narrower wrapper reusing the same existing calculations and types.
5. A group is complete within each page: never split its senses or concepts. A lexeme may repeat on later pages when its concepts are reached by different selected concept candidates; clients deduplicate only by stable `lexemeId`, and repeated groups must be complete/equal (never partial fragments unioned to conceal incomplete server groups). Preserve every matching lexeme identity through concept deduplication; where several lexemes share a concept, include that concept under each matching lexeme with its independent badge.
6. Preserve cursor tokens bound to actor, active language profile, language, normalized query, and existing version/context. Advancement uses unchanged flat ordering/context; no cursor contract change is proposed. Group inner ordering is deterministic by stable lexeme identity, matched form, then sense order and sense ID.
7. Do not migrate by default. Inspect representative `EXPLAIN (ANALYZE, BUFFERS)` plans on the controlled staging fixture and realistic read-only catalog query first. A new index requires measured evidence, migration review, normal RLS/grant review, and migration gates.

## Implementation sequence after plan approval

1. Freeze the reviewed additive API contract and cursor behavior. Inspect/import provenance gates and schema cardinalities; select an existing approved controlled staging fixture if it proves a shared lemma, an inflected form, multiple ordered senses, and multiple linked concepts.
2. Extend backend candidate resolution without bypassing source allowlists; retain matched lexeme/form identities through deduplication. Load complete groups and actor-specific concept badges in the same consistent read snapshot. Preserve backward-compatible flat response by default.
3. Update OpenAPI and generated client types, then Dictionary state/adapters/view to present one lemma group with ordered senses, deduplicating only on stable lexeme identity. Preserve independent Save/Learn per linked concept and existing Library/Reader callers.
4. Extend deterministic importer validation in `knowledge/catalog_import.py`, with tests in `knowledge/tests/test_catalog_import.py`, for shared lemmas, multiple senses, form deduplication, concept-sense bridge identity, source collisions, provenance, and idempotent reapply. Do not create an importer or catalog expansion side effect as part of query handling.
5. Add no migration unless measured query-plan evidence requires an index and the plan is reviewed. Keep browser access through the API; do not grant direct catalog table access.
6. Use a separate GPT-6 Luna / Max implementation worker and an independent GPT-6 Luna / Max security/final reviewer. Preserve a reviewable diff and wait for explicit root implementation authorization after this plan is accepted.

## Verification plan

### Backend and contract

- Exact lemma and inflected-form resolution (roadmap example `went` → `go`), query casefold/NFKC/whitespace behavior, and punctuation behavior unchanged.
- One shared lemma with multiple ordered senses and concepts; one sense linked to multiple concepts; multiple matching lexemes sharing a concept; deterministic tie and form attribution.
- Complete grouped results across page boundaries, repeated-page stability, no split group, deterministic cursor ordering, invalid/wrong-query/wrong-actor cursor rejection, and default response exact-shape compatibility.
- Correct locale/gloss columns and all-approved provenance gates; no unapproved source data in either flat or grouped path.
- Actor-owned concept status/due/save badges are independent; two actors receive isolated badges; repeated search has zero writes.
- API contract checks, generated OpenAPI/client freshness, focused backend tests, backend check, typecheck/lint, and relevant full suites after meaningful focused coverage.

### Importer and frontend

- Shared lemma/multi-sense import validation, form normalization/dedupe, bridge identity, collision reporting, deterministic plan/hash, and idempotent reapply with no unexpected catalog or learner-state mutation.
- Group UI ordering, repeated complete-group deduplication by `lexeme.id`, preservation of matched lexeme/form identity, independent concept badges, explicit Save/Learn activation only, and loading/error/empty behavior.
- Regression coverage for existing flat-response Dictionary consumers, Library and Reader integration, actor switching/cache isolation, accessibility, and generated DTO consumers.

### Hosted acceptance and privilege boundaries

- Live read-only staging feasibility check found 94 eligible approved English lexemes, none with both at least two approved senses and at least two approved linked concepts; there are zero approved `went` forms. Existing approved catalog data cannot prove the complete K2-09 hosted criteria.
- Therefore propose a reviewed, minimal test-only catalog fixture through the existing Admin control plane before hosted writes. Use newly reserved, unique query/lemma/form prefixes (do not use or alter ordinary `go`/`went` rows), new exact row IDs, and exact source/content hash guards. Preflight collisions and source/row identities before any insert. Existing `service_role` already has SELECT/INSERT/DELETE for `concepts`, `lexemes`, `lexeme_forms`, `word_senses`, `concept_senses`, `source_records`, `data_sources`, and `licenses`; no new grants are proposed. Do not expand the custom read-only role/table whitelist for test convenience.
- Exercise searches and learner-owned badges only through normal authenticated actor HTTP requests and JWT/RLS. Unit/database tests separately cover exact `went` → `go` behavior. Hosted fixture data should include an inflected form, a shared lemma with ordered multiple senses, and multiple linked concepts, enabling complete grouped-page and independent badge assertions.
- Cleanup only the exact inserted fixture rows under source, ID, and content-hash guards. Before catalog deletion, prove no outside acceptance actor references those fixture concepts; fail closed and preserve any ordinary learner state if references exist. Erase test actors and learner-owned state under the approved scoped cleanup path, then delete the fixture in `try/finally` and verify exact fixture-row absence. Extend the guarded current-run recovery/janitor only if the reviewed implementation shows the fixture source needs a marker for reliable cleanup.
- This fixture setup is a design proposal only: no hosted fixture writes are authorized until a separate GPT-6 Luna / Max architecture/security review approves source ownership, privilege split, collision guards, actor-reference checks, cleanup order, and retained comparison. Keep test actor ownership and Auth cleanup fail-closed, preserve the existing 27-table retained snapshot infrastructure, and use no new manual credentials, Auth/RLS/grant broadening, or uncontrolled catalog writes.

## Source surfaces to expect

- Backend: `services/api/src/lingua_api/dictionary/{routes,models,service,store,cursor,domain}.py`, shared actor/badge projection in `brain/` only as needed.
- Contract/client: `contracts/openapi.yaml`, generated artifacts and types under `packages/types/`.
- UI: `apps/web/src/features/dictionary/{useConceptDiscovery,adapters,DictionaryView}.ts*` and focused Dictionary tests.
- Import/provenance: `knowledge/catalog_import.py` and `knowledge/tests/test_catalog_import.py`; preserve current provenance/collision/idempotence behavior while extending its plan validation.
- Schema/query evidence: existing migrations and catalog model; no migration unless plan-approved measured need.
- Verification: focused backend/contract/frontend tests, relevant typecheck/lint, and a controlled hosted fixture run with independent final review.

## Explicitly unresolved for plan review

- Whether current approved staging catalog has sufficient controlled shared-lemma/multi-sense/inflection examples, or a narrowly scoped fixture must be approved.
- Whether actual query plans justify any index. Do not answer these by inventing public fields, new normalization rules, or grants.
