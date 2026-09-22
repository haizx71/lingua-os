# LINGUA OS — Unified Agent Guide

This repository no longer uses model-specific startup prompts. Any engineering agent working on LINGUA OS must use the repository itself as the durable source of truth.

## Read before changing anything

Read in this order:

1. `MASTER_PROJECT.md` — product definition, direction, scope and invariants.
2. `DECISIONS.md` — accepted durable decisions.
3. `STATUS.md` — current verified state and active blockers.
4. `TASKS.md` — current execution scope and dependencies.
5. `CONTEXT.md` — shared domain vocabulary.
6. `docs/README.md` — documentation map.
7. Relevant contracts, migrations, subsystem specs and implementation files for the task.

Do not treat chat history, an old handoff, a branch name or a historical review as more authoritative than the files above.

## Work by subsystem, not by model name

Backend/system work normally lives under:

- `services/`
- `database/`
- `contracts/`
- backend tests and backend-related shared packages

Frontend/product UI work normally lives under:

- `apps/web/`
- `packages/ui/`
- `tests/frontend/`
- `design-system/`

Shared project truth includes:

- `MASTER_PROJECT.md`
- `DECISIONS.md`
- `STATUS.md`
- `TASKS.md`
- `CONTEXT.md`
- `contracts/`

Crossing a subsystem boundary is allowed only when the task actually requires it and the impact is understood.

## Non-negotiable rules

- Inspect the current branch and latest repository state before editing.
- Do not silently invent API fields, endpoints, enums, migrations or learning rules.
- Public API changes must update the shared contract in the same task.
- Persistent schema changes require versioned migrations.
- Preserve learner state, authorization boundaries and accepted FRLL behavior.
- Keep one primary FSRS memory lineage per learner/concept unless an accepted decision changes it.
- Keep AI and external providers behind replaceable interfaces.
- Persist content provenance, license and quality metadata.
- Never expose secrets in source, logs, screenshots or completion reports.
- Do not mutate hosted Supabase, Render or Vercel state unless the task explicitly requires it.
- Do not mark work complete until real verification has passed.

## Execution workflow

For non-trivial work:

spec/task → inspect → bounded plan → tests/checks → implementation → spec review → code review → verification → status update

Use `plans/` for implementation plans that are useful beyond the current chat. Use `reviews/` for durable review evidence. Do not create temporary agent journals, handoff folders or per-agent briefing trees in the repository.

If parallel agents are active, use isolated branches/worktrees and integrate through reviewed commits. Never overwrite another agent's uncommitted work.

## Verification

Run the checks relevant to the changed surface. Typical gates include:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm backend:check`
- `pnpm build`
- `pnpm build-storybook`
- contract validation
- migration checks
- focused browser/integration acceptance

Documentation-only changes do not require the full runtime suite, but links, paths and source-of-truth references must still be checked.

## Completion report

Report only what matters:

- outcome
- files/systems changed
- contracts or migrations changed
- verification performed and result
- known blocker or risk
- next action, if any
