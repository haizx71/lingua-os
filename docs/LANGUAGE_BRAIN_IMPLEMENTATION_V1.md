# Language Brain Projection API v1 — runtime implementation

Status: **DONE / POSTGRESQL VERIFIED**  
Task: `TASK-012`  
Contract authority: `contracts/openapi.yaml` and `docs/LANGUAGE_BRAIN_PROJECTION_API_V1.md`

## Runtime surface

The implementation adds exactly the three frozen authenticated read operations:

- `GET /v1/brain/summary` (`getBrainSummary`)
- `GET /v1/brain/concepts` (`listBrainConcepts`)
- `GET /v1/brain/concepts/{conceptId}` (`getBrainConcept`)

The route layer authenticates the Supabase actor, the application service owns cursor and response
mapping, and the PostgreSQL store composes accepted persisted projections. No endpoint writes or
recomputes learner state.

## Read model and source authority

- Learner collection membership is the deduplicated union of current-lineage
  `user_concept_states`, active `review_items`, and `user_saved_concepts`.
- `user_concept_states` supplies concept status, mastery, competence, confidence, evidence counts,
  and exposure history. Legacy non-current rows are not learner-state authority.
- `user_skill_states` supplies only the profile-level recognition/listening/production aggregate.
- `review_items` and `fsrs_states` supply persisted Memory context and due state. Brain contains no
  FSRS scheduling or retrievability calculation.
- `concepts`, lexical/catalog tables, definitions, reviewed sentences, and `concept_relations`
  supply catalog identity and depth-one direct stored relations.
- Starting Level Estimate remains `null`: the current persistence model does not contain the
  frozen public confidence-band semantics, and TASK-012 does not invent a placement derivation.

## Snapshot and zero-state rules

Each request opens one PostgreSQL `REPEATABLE READ, READ ONLY` transaction and captures one database
`transaction_timestamp()` as the response `asOf`/`calculatedAt` reference. Every read in the
request uses that snapshot.

Synthetic zero evidence is returned as:

- score `0.5`, confidence `0`, evidence count `0` for every competence dimension;
- mastery `null`, aggregate confidence `0`, Memory `null`;
- status `unseen`, except a persisted passive-only discovery may retain `discovered` while its
  competence remains zero evidence.

Brain GETs never insert synthetic rows or mutate projection, Review, Reader, Library, Today, or
placement state.

## Security, publication, and pagination

- Explicit missing and non-owned language profiles share the same 404 response; only active
  English-for-Vietnamese profiles are eligible.
- Catalog reads fail closed on publication/review/quality/license/provenance requirements.
- Attribution is returned only from approved source metadata and no database/internal messages,
  lineage IDs, policy parameters, or private projection fields are exposed.
- List pagination is signed opaque keyset pagination over `(canonical_key, concept_id)` and binds
  actor, language profile, status, and normalized query. Limit is bounded at 100; no offset path
  exists.
- Status filtering uses exactly the eight shared `ConceptStatus` values and never introduces
  `due`; due remains independent Memory/presentation state.

## Database and contract impact

- Migration: none. Existing accepted tables and indexes cover the frozen read paths.
- OpenAPI: unchanged from the accepted TASK-012 contract freeze.
- Generated TypeScript: unchanged and fresh.
- Frontend application/UI/GSAP/design system: unchanged; frozen baseline remains 308 tests across
  27 files.

## Query bounds

The store uses no per-concept loop query. Including the snapshot timestamp and profile resolution,
the current fixed upper bounds are:

- summary: 6 SQL statements (timestamp, profile, status aggregate, due aggregate, skill aggregate,
  recent concepts capped at 10);
- one concept page: 3 SQL statements (timestamp, profile, one bounded joined page query capped at
  requested limit plus one);
- concept detail: 6 SQL statements (timestamp, profile, one learner/catalog/Memory row, definitions
  capped at 100, examples capped at 50, direct relations capped at 100).

List metadata, learner projection, and Memory context are joined in one bounded statement. Detail
uses fixed batched subreads independent of the number of returned definitions/examples/relations.

## Verification state

Passed on the final runtime tree:

- Ruff format check: 67 files formatted.
- Ruff lint: clean.
- strict mypy: 67 source files, no issues.
- non-PostgreSQL backend regression: 100/100 passed.
- focused Brain PostgreSQL suite: 15/15 passed on PostgreSQL 17.11.
- complete database suite: 150/150 passed on a fresh migrated database.
- full backend suite: 250/250 passed (100 non-database plus 150 database cases).
- focused migration verification: 3/3 passed, covering empty `0001..0006`, reproducible no-op
  reapply, `0006` down/up, checksum rejection, and protected `0005`/`0006` rollback behavior.
- measured PostgreSQL data-statement counts remain within the documented fixed bounds: summary 6,
  concept page 3, and concept detail 6. Each request adds one transaction setup statement; no
  per-concept query or N+1 path was observed.
- contract freeze gates: OpenAPI validator, 22/22 focused contract tests, TypeScript freshness,
  and Redocly exit 0 with one unchanged Reader discriminator warning.
- frozen frontend gates: typecheck/lint, 308/308 tests across 27 files, Storybook, and production
  build (completed during the accepted compatibility freeze; frontend state has not changed).

The real-database gates used an isolated portable PostgreSQL 17.11 cluster bound to loopback with
UTC server timezone and a fresh database per phase. Docker, user databases, Docker images, volumes,
and persisted project data were not touched.

## PostgreSQL failure classification and resolution

1. **B — test fixture defect:** the Brain fixture supplied non-null difficulty/stability for an
   FSRS `new` row, violating the accepted schema shape check. The fixture now inserts a valid new
   state without those values.
2. **A — implementation defect:** Brain returned the database session offset instead of the
   contract-required UTC rendering. The shared Brain timestamp boundary now rejects naive values
   and normalizes aware PostgreSQL timestamps to UTC. No query, algorithm, contract, or schema was
   changed.
3. **B — test fixture isolation defect:** Brain canonical keys collided with Review fixture keys
   when the complete database suite ran in one database. Brain fixtures now use task-scoped keys.
4. **D — environment defect:** the disposable server initially inherited the host timezone. The
   server was restarted with UTC, matching the repository's accepted PostgreSQL test environment;
   Memory/Today code was not changed.

The focused suite also proves repeatable-read snapshot behavior, read-only/no-mutation behavior,
existence-hiding ownership, zero-state non-persistence, and bounded query behavior on PostgreSQL.
No blocker remains for TASK-012.
