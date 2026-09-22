# FRLL F1 — Implementation evidence

Status: READY_FOR_INDEPENDENT_REVIEW. Starting HEAD: `1878406`.
Scope: R2/R3/R4/R5 only. No FRLL acceptance and no R1 execution.

## Corrections

- R2: Validate raw Review DTOs, then compare the complete replay data to the
  first response, including competence, remaining count, feedback and memory.
  Verify first response against committed result snapshots and canonical state.
  Re-capture the complete learner digest after replay, conflict and final queue
  reconciliation; require exact equality. Queue HTTP 500 fails. Changed-payload
  replay requires HTTP 409 and `IDEMPOTENCY_KEY_REUSED`, with a valid ErrorResponse.
- R3: Read complete persisted rows (including masses, versions, parameters,
  methods, projection heads and review/save lineage) in a read-only REPEATABLE
  READ transaction. Verify first-review evidence/version increments exactly once,
  untouched dimensions unchanged, and skill/concept lineage consistent. Replay
  and conflict cannot change these observations. Brain detail, nested learner,
  summary skills, recent concepts and list entries use fresh database authority,
  including each score, confidence, count and last-evidence timestamp. No
  scheduling or competence formula is duplicated in the harness.
- R4: Only a real Auth API 404 `user_not_found` with `user:null` proves deletion.
  401/403/500, ambiguous 404, malformed responses and network failures reject.
  Errors do not include raw credentials or response contents. Cleanup also
  verifies skill state and language projection heads, with real-PG cascade tests.
- R5: Generated OpenAPI types replace provisional parser interfaces. AJV validates
  raw responses using local frozen schemas before adaptation; no coercion,
  default insertion or property removal. All B/C/D/E response paths are covered.
  Legacy dictionary aliases and `retained` cannot substitute for required fields.
  New pinned test dependencies: ajv 8.18.0, ajv-formats 3.0.1, yaml 2.8.3.

Only score/confidence/mastery comparisons against numeric(10,8) use 1e-8 tolerance.
Replay JSON, persisted masses, IDs, enums, counts and versions remain exact.
UTC timestamp normalization preserves sub-millisecond differences. Decimal zero
serialization such as `0E-8` is accepted without admitting missing/blank values.

## Required before/after attack matrix

The before column records reproduced pre-fix harness weaknesses, not product defects.
Each after result is a negative regression test: injected corruption is rejected.

| Attack | Before | After |
| --- | --- | --- |
| Replay production score 0.85 -> 0.01 | False positive | Reject |
| Replay remainingDueCount -> 123 | False positive | Reject |
| Final queue HTTP 500 | False positive | Reject |
| Brain production confidence 0.99 vs DB 0.6 | Unchecked mismatch | Reject |
| Auth 401 + user:null | False deletion proof | Reject |
| Auth 500 + user:null | False deletion proof | Reject |
| Missing required Brain summary field | Forgiving parser | Reject |
| retained instead of familiar | Stale parser | Reject |

Additional coverage rejects corrupt first committed snapshots, replay feedback/
memory/recognition drift, same-count persisted mass mutations, wrong conflict
code, nested learner status drift, production skill score/confidence/time drift,
cleanup residue and malformed Today/Review responses. No test is skipped or
removed to suppress a failure; obsolete DTO fixtures were reconciled explicitly.

## Verification

| Command / selection | Actual result |
| --- | --- |
| `pnpm test tests/acceptance/support --reporter=dot --silent` | 115 PASS / 10 files |
| `pnpm test tests/acceptance --reporter=dot --silent` | 115 PASS, 4 SKIP / 14 files |
| `pnpm test --reporter=dot --silent` | 581 PASS, 4 SKIP / 45 passed + 4 skipped files |
| `python -m pytest tests/acceptance/support/test_postgres_probe.py -q` | 12 PASS, 1 SKIP |
| Relevant backend/database selection below | 100 PASS, real PostgreSQL 17 |
| `python -m ruff check scripts tests/backend tests/acceptance/support` | PASS |
| `python -m ruff format --check scripts tests/backend tests/acceptance/support` | PASS, 36 files |
| `python -m mypy` | PASS, 111 source files |
| `pnpm contracts:check-generated` (also invoked by typecheck) | PASS |
| `pnpm typecheck --incremental false` | PASS; preserves protected tsbuildinfo |
| `pnpm lint` | PASS |
| Additional strict no-emit TypeScript check of B/C/D/E runners | PASS |
| `git diff --check` | PASS |

Backend selection command:

```text
python -m pytest tests/backend/database/test_frll_probe.py tests/backend/database/test_review_api.py tests/backend/database/test_brain_api.py tests/backend/database/test_competence_schema.py tests/backend/competence tests/backend/test_brain_domain.py -q --tb=short --maxfail=1
```

The last backend run passed 100 tests in 29.53s after restarting the stopped Docker
daemon; the earlier setup failure did not execute business assertions. The new
real-PG probe test confirms transaction read-only enforcement and REPEATABLE READ.
The standalone probe's older environment-conditional read-only test remains skipped.
Four live Supabase acceptance tests remain environment-conditional skips; this
checkpoint does not claim a new deployed Supabase run or browser proof. Full
Vitest preserves all 466 frontend tests and adds/runs 115 acceptance support tests.
Storybook and production build were not rerun: neither is an F1-required gate,
and no frontend application source changed.

## Exact changed-file inventory

Test dependency manifests:

- `package.json`
- `pnpm-lock.yaml`

Acceptance harness and tests (all under `tests/acceptance/support/`):

- `supabase_users.ts`, `supabase_users.test.ts`
- `postgres_probe.py`, `postgres_probe_client.ts`, `test_postgres_probe.py`
- `contract_validation.ts`, `contract_validation.test.ts`
- `persisted_assertions.ts`, `persisted_assertions.test.ts`
- `projection-fixtures.ts`, `review_persistence.ts`
- `phase_b_runner.ts`, `phase_b_runner.test.ts`
- `phase_c_runner.ts`, `phase_c_runner.test.ts`
- `phase_d_runner.ts`, `phase_d_runner.test.ts`
- `phase_e_runner.ts`, `phase_e_runner.test.ts`

Database test and tracking:

- `tests/backend/database/test_frll_probe.py`
- `plans/FRLL-F1-acceptance-hardening.md`
- `docs/FRLL_F1_HARDENING_REVIEW.md`
- `STATUS.md`
- `TASKS.md`

## Reviews and boundaries

Specification review: R2/R3/R4/R5 implemented; all eight negative attacks reject.
Code review found an omitted nested learner status comparison; corrected with a
regression test before final verification. Additional production-skill authority
checks also have red/green regression evidence. No known Required product gap.
Independent milestone acceptance is still pending.

Protected diff against `1878406` is ZERO for `contracts/**`, `services/**`,
`database/migrations/**`, `apps/web/src/**`, and `apps/web/tsconfig.tsbuildinfo`.
No OpenAPI generation, migration, product endpoint, frontend authority change or
push. Lockfile peer resolutions changed for the pinned YAML test dependency;
the complete Vitest suite and typecheck/lint were rerun afterward.

Remaining REQUIRED work:
R1 — real browser/reload/lost-response/Actor-B/isolation proof.

R1 was not started. FRLL must not be marked DONE or ACCEPTED by this checkpoint.
