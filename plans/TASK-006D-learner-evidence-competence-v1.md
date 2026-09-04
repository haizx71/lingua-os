# TASK-006D — Learner Evidence Ingestion & Competence Projection v1

## Objective

Implement the approved `competence-beta-v1` evidence stream, concept and language-profile
projections, deterministic mastery/ConceptStatus derivation, rebuild support, and atomic Review
integration without changing OpenAPI or frontend code.

## Authority and dependency check

- TASK-003, TASK-004, TASK-006, and TASK-006A are DONE.
- `docs/LEARNER_EVIDENCE_COMPETENCE_V1.md` and the approved preflight reconciliation are locked.
- `user_concept_states` is the sole learner × concept competence authority.
- `user_skill_states` is a language-profile aggregate derived directly from applicable canonical
  learning events; Review never reads it as concept competence.
- `learning_events` is the append-only replay authority.
- No public contract change, Reader endpoint, frontend source change, or second scheduler is in
  scope.

## Legacy/backfill policy

The repository has no configured production database or non-test projection seed. Existing
pre-006D rows and fixtures have scalar projections but no replayable sufficient statistics. The
migration preserves those values physically but leaves their competence parameter lineage null.
Runtime treats a lineage-less concept projection as zero evidence (score `0.5`, confidence `0`,
count/mass `0`; `discovered` only when exposure history supports it). The first canonical event
initializes the approved lineage and applies exactly one observation. No old numeric zero or score
is converted into positive/negative evidence.

## Expected changes

- `database/migrations/0004_learner_evidence_competence_v1.{up,down}.sql`
- `database/README.md`
- `services/api/src/lingua_api/competence/**`
- transaction-participating changes under `services/api/src/lingua_api/memory/**`
- Review application/read projection changes under `services/api/src/lingua_api/review/**`
- pure, Review, Memory, migration, replay, concurrency, ownership, and atomicity tests under
  `tests/backend/**`
- `docs/LEARNER_EVIDENCE_COMPETENCE_V1.md`, `DECISIONS.md`, `TASKS.md`, `STATUS.md`, and a final
  review record after verification

## Incremental implementation

1. Add failing pure golden tests for evidence canonicalization, Soft-Beta math, confidence,
   mastery, all status predicates, and incremental/replay equality; implement pure domain/projector.
2. Add failing migration tests; implement immutable parameter/config, source/canonical identities,
   ingestion head, sufficient statistics, Review result snapshots, constraints, indexes, RLS, and
   rollback.
3. Add failing PostgreSQL projection/rebuild/idempotency/concurrency tests; implement actor-scoped
   event and projection persistence using stable row-lock order.
4. Add failing Review regression tests for per-concept queue data, zero-evidence reads, first write,
   post-event answer, A→B→replay A, isolation, and rollback; refactor Memory to participate in the
   Review-owned transaction and integrate Competence.
5. Run spec, schema/migration, transaction/concurrency, security/boundary, and code-quality review;
   then run all required backend/database/OpenAPI/frontend gates.

## Acceptance checks

- Exact Beta(2,2), reliability weights, rating anchors, confidence formula, and cloze mapping.
- Passive exposure changes exposure/history only.
- Fixed lexical/grammar/explicit-skill mastery policies and no weight renormalization.
- All eight statuses and frozen precedence/recovery behavior are deterministic.
- Canonical identities and source derivation uniqueness prevent double projection.
- Incremental concept/profile projections equal full replay in ingestion order.
- Same-concept concurrency has no lost update; ownership/language isolation holds.
- Review FSRS, review event, canonical event, projections, due count, and historical snapshots commit
  once or roll back together.
- Queue uses one concept projection per item, performs no writes, and supports missing rows with the
  synthetic zero-evidence view.
- `user_skill_states` cannot contaminate Review concept competence.
- One FSRS lineage remains enforced; OpenAPI and frontend source have no diff.

## Risks and controls

| Risk | Control |
| --- | --- |
| Legacy scalar values mistaken for evidence | Nullable lineage marker plus zero-evidence initialization; never reverse-engineer mass. |
| Duplicate or concurrent projection | Source uniqueness, projection-head row lock, ordered row locks, and state-version checks. |
| Memory commits before competence | Review application owns one connection/transaction; engines expose transaction participants. |
| Historical replay reads current state | Persist exact concept competence, due count, and feedback with the source review event. |
| Profile aggregate becomes concept authority | Separate repository methods and regression tests proving Review ignores `user_skill_states`. |
| Status replay drifts from incremental | Persist/rebuild only explicit sufficient history and compare full projections in golden tests. |

