# K2-08 Hosted Fixture Readiness

**Historical readiness record:** the inspection below predates the accepted fixture redesign and PR #35 merge. Current source/CI PASS, migration 0020 rollout, and the remaining published-content blocker are recorded in `reviews/K2-08-fixture-boundary-design-review.md` and `STATUS.md`. Historical NO-GO/NOT APPLIED statements below describe that earlier checkpoint.

**Checkpoint date:** 2026-10-01
**Repository baseline:** `master` at `2c3284a2deb4fac18683b660a751039e36b007f7`
**Review scope:** bounded Today V2 specification and hosted-fixture prerequisites
**Documentation worker:** GPT-6 Luna / Medium
**Independent review evidence:** GPT-6 Luna / Max reported bounded specification PASS at immutable head `b4341582`. This is not an implementation, CI, or hosted acceptance PASS.

## Current gate

- **K2-07 hosted acceptance remains PASS, unchanged.** Its accepted exact-SHA workflow evidence remains run [36780407824](https://github.com/haizx71/lingua-os/actions/runs/36780407824) on master `c696ac935852c4ebcd9e1183521996e5b12ad273`; this K2-08 readiness checkpoint does not reopen it.
- **K2-08 is DOING for bounded Today policy/contract work and credential-free PostgreSQL CI. Its hosted full gate is BLOCKED.** The bounded specification review does not establish implementation correctness or passing CI.
- **K2-09 and K2-10 remain LOCKED** until K2-08's gates are satisfied.

## Read-only staging catalog and policy evidence

The read-only aggregate inventory used the accepted Dictionary source eligibility: English concepts of type `word` or `phrase`, with approved, quality-scored, allowed-license provenance for the concept and lexeme, plus attribution when required. It returned 78 words and 16 phrases; all 94 passed that Dictionary predicate. This is enough distinct catalog candidates to activate 20 Review items through the accepted actor-owned Save/Learn route. It does not assert that 20 due rows currently exist.

The Reader inventory applied the published English filter and `reader_content_passes_publication_gate`. It found zero eligible published content items, zero content-linked Dictionary-eligible word/phrase concepts, zero content items whose API duration is eight minutes, and therefore no content candidate for the Today eight-minute reserve. Review's published aligned-cloze selector found zero eligible concepts. Its preferred-lexeme audio selector found zero HTTPS audio concepts. No content identifiers, learner state, authentication tables, or raw content values were returned or recorded.

The same aggregate found zero rows in `concept_competence_policies`, including no production-only override matching the default parameter-set ID and version. The table has no approval/status column; policy rows are immutable by database trigger. There is no existing approved per-concept production-only exception to use as a hosted fixture.

For fresh word/phrase concepts, the default competence weights are recognition `0.4`, listening `0.3`, and production `0.3` (migration `0004`). Accepted self-recall and typing answers contribute production evidence only. The Review mode selector ranks dimensions with observed competence evidence; it does not bootstrap unseen recognition/listening evidence. With no published cloze/listening material and no applicable override, the ordinary Review API cannot supply the missing dimensions for a natural one-run status fixture. Max's bounded analysis found no-go for a privileged synthetic policy/learner-state fixture under the current K2-08 plan.

## First-party content candidate

An original article candidate was prepared separately from master at immutable commit [3623642ca3bc108d236ca20345bae769408ea195](https://github.com/haizx71/lingua-os/commit/3623642ca3bc108d236ca20345bae769408ea195), file `knowledge/k208-a2-market-article-candidate-2026-10-01.md` on its isolated branch. Its body SHA-256 is `6c39d16de0f6ecb27be2420c2f011a704663e036e77a86afb2c09b72930ba28c`; the repository segmenter/token metric measured 1,263 whitespace tokens, 72 segments, and 8 estimated minutes. An in-memory lexical simulation using approved lemma strings and synthetic IDs found 186 candidate spans across 66 distinct lemma strings and no unmapped sentences.

That simulation is a feasibility signal only. It did not read concept IDs or normalized forms and does not prove the Admin API's exact database matcher, UTF-16 offsets, publication dependency closure, or stored `content_concepts`. The candidate remains **NOT APPROVED**: human editorial/level and rights confirmation are pending, no quality score/review timestamp was assigned, and no source-record raw hash or publication state was created. It is not present in master and must not be used as published content before those gates and exact mapping checks pass.

A later read-only catalog mapping dry run is recorded at immutable candidate-branch commit [5bfb9362e2b534b526260d089a42c4edd44c36a4](https://github.com/haizx71/lingua-os/commit/5bfb9362e2b534b526260d089a42c4edd44c36a4), file `knowledge/k208-a2-market-dry-run-mapping-2026-10-01.md`. It mirrors the Admin eligible concept/lexeme/lexeme-form provenance predicate and canonical-form ordering against approved staging catalog objects, without returning or recording catalog UUIDs or reading Auth/private learner records. The selected normalized forms uniquely resolve at the catalog level to 66 concepts; the matcher simulation selects 186 UTF-16 half-open target spans across all 72 sentences, with no unmapped sentences or ambiguous selected forms. This improves on the earlier lemma-only simulation but remains read-only mapping feasibility: no Admin create/validate/publish call was made, no sentence/content identities or `sentence_concepts`/`content_concepts` persistence was verified, and no Reader publication gate was exercised. The article is still **NOT APPROVED** pending human editorial, level, authorship, and rights confirmation; no new catalog or content records were approved.

## Migration and hosted boundary

The bounded implementation proposal includes a source-only migration `0020` for a Today reason-code `CHECK` constraint. It is proposed and **NOT APPLIED**. The latest root-reported staging evidence distinguishes application `public.schema_migrations` at `0017` from the Supabase platform migration ledger at `0019` plus the dedicated read-only reader role; these are separate registries and should not be conflated. This documentation checkpoint performed no hosted actor cycle or hosted mutation. Root reported the cloud mutation lock free at handoff.

## Source references

- `services/api/src/lingua_api/dictionary/store.py` and `services/api/src/lingua_api/catalog/sql.py` — eligible Dictionary concept/lexeme provenance predicate.
- `services/api/src/lingua_api/content/store.py` and `database/migrations/0005_reader_content_service_v1.up.sql` — published Reader eligibility, duration, and complete dependency gate.
- `services/api/src/lingua_api/review/store.py`, `services/api/src/lingua_api/review/modality.py`, and `tests/acceptance/support/k2_hosted_probe.py::_anchor_material` — selected cloze/audio material and observed-dimension mode selection.
- `database/migrations/0004_learner_evidence_competence_v1.up.sql` and `services/api/src/lingua_api/competence/store.py` — immutable per-concept policy schema and default policy resolution.
- `services/api/src/lingua_api/admin/` and `tests/backend/database/test_admin_content_api.py` — owner-only first-party authoring path and disposable PostgreSQL publication test coverage.

No source, contract, migration, hosted configuration, or learner state was changed by this readiness review. No general source/CI/hosted K2-08 PASS is claimed.
