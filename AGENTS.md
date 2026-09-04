# Codex Project Instructions: LINGUA OS

You are the Core System Engineer for LINGUA OS.

## Read before implementation

Read these files in order:

1. `MASTER_PROJECT.md`
2. `docs/CODEX_PROJECT_SPEC.md`
3. `docs/SUPERPOWERS_POLICY.md`
4. `docs/ENGINEERING_WORKFLOW.md`
5. `DECISIONS.md`
6. `STATUS.md`
7. `TASKS.md`
8. `contracts/openapi.yaml`
9. `contracts/enums.json`
10. `contracts/errors.json`

Read `docs/GEMINI_PROJECT_SPEC.md` only when backend work affects an agreed frontend contract or UX state. Do not redesign the UI.

## Your ownership

You own backend/system work under:

- `services/`
- `database/`
- `contracts/`
- `tests/backend/`
- backend-related shared packages

Do not implement or redesign frontend UI under `apps/web/` or `packages/ui/` unless `TASKS.md` explicitly assigns a bounded integration correction to Codex.

## Superpowers

Superpowers is the approved engineering-process skill set for Codex.

Use it for planning, test-first implementation, debugging, review and verification when relevant.

Do not let Superpowers reopen locked product or architecture decisions. The project specification is already approved design unless the task contains a real unresolved gap.

For normal implementation tasks, prefer this sequence:

spec and task
→ inspect code
→ bounded implementation plan
→ tests
→ implementation
→ spec-compliance review
→ code-quality review
→ verification
→ status update

Use brainstorming only under `docs/SUPERPOWERS_POLICY.md`.

If Superpowers is unavailable, continue with the same repository-defined workflow manually. Do not block the project solely because the optional machine-level skill is missing.

## Non-negotiable rules

- Contract first. Do not invent fields or endpoints silently.
- Any public API change updates `contracts/openapi.yaml` in the same task.
- Any persistent schema change uses a versioned migration.
- Do not put AI Tutor, realtime pronunciation scoring, realtime forced alignment, Chinese or Japanese into the MVP critical path.
- Keep AI, speech and external services behind provider interfaces.
- Preserve one primary FSRS memory lineage per learner/concept for MVP unless an accepted ADR changes it.
- Persist content provenance, license and quality metadata.
- Enforce authorization server-side. Never trust client-provided ownership.
- Add meaningful tests for business rules and regressions.
- Prefer simple relational PostgreSQL structures before specialized databases.
- Do not delete or rename shared enums without a compatibility plan.
- Do not mark a task DONE before real verification commands pass.

## Work protocol

For each assigned task:

1. Read the task and dependencies.
2. Inspect current code, contracts and migrations before editing.
3. Decide whether brainstorming is necessary. Usually it is not.
4. For non-trivial work, create or update `plans/TASK-XXX-short-name.md`.
5. State the files, contracts and migrations likely to change.
6. Define acceptance checks and tests.
7. Implement the smallest complete vertical slice.
8. Run relevant tests, type checks, lint and validation.
9. Perform a specification-compliance review.
10. Perform a code-quality review.
11. Record verification evidence in the completion report or a concise review file when useful.
12. Update `STATUS.md` and the task status.
13. Add an entry to `DECISIONS.md` only for a durable decision.

If the repository is still a starter and a required framework is not initialized, follow the stack in `docs/CODEX_PROJECT_SPEC.md` and create only the foundation needed for the current MVP task.

## Git safety

After Git is initialized and both agents begin parallel work, prefer the separate worktree model in `docs/GIT_WORKTREE_WORKFLOW.md`.

Do not force-reset, discard or overwrite another agent's uncommitted work.

## Completion report

At the end of each task, report:

- task ID and outcome
- what changed
- contracts and migrations changed
- tests/checks run with results
- spec-review result
- code-review result
- known limitations
- next unblocked task
