# LINGUA OS

LINGUA OS is an adaptive language-learning system for Vietnamese learners of English. Its core is the **Language Brain**: a persistent learner model that combines learning evidence, memory scheduling and curriculum knowledge to decide what the learner should do next.

The current MVP loop is:

**Today → Read → Language Brain → Smart Review → Progress → next Today plan**

## Repository map

- `apps/web/` — Next.js web application
- `packages/ui/` — shared UI components and tokens
- `services/` — backend services
- `database/` — PostgreSQL migrations and database tooling
- `contracts/` — public API/enums/error contracts
- `knowledge/` — knowledge/catalog assets
- `design-system/` — visual and interaction source of truth
- `tests/` — frontend/backend/integration verification
- `plans/` — durable implementation plans
- `reviews/` — durable review and acceptance evidence
- `docs/` — subsystem specifications and operational documentation

## Canonical project documents

Read these first:

1. `MASTER_PROJECT.md` — what LINGUA OS is, where it is going and what is non-negotiable.
2. `DECISIONS.md` — accepted durable decisions.
3. `STATUS.md` — current verified state and blockers.
4. `TASKS.md` — active execution scope.
5. `CONTEXT.md` — shared domain vocabulary.
6. `docs/README.md` — documentation index.
7. `AGENTS.md` — unified rules for any engineering agent.

Model-specific startup prompts are intentionally not part of the current workflow.

## Development

Requirements:

- Node.js compatible with the current lockfile
- pnpm 11
- Python 3.12+
- PostgreSQL/Supabase configuration where backend/database integration is required

Install JavaScript dependencies:

```bash
pnpm install
```

Common commands:

```bash
pnpm dev
pnpm backend:dev
pnpm typecheck
pnpm lint
pnpm test
pnpm backend:check
pnpm build
pnpm build-storybook
```

Database commands:

```bash
pnpm db:migrate
pnpm db:rollback
```

Use `.env.example` as the environment-variable template. Never commit real secrets.

## Agent workflow

Any agent should start by reading `AGENTS.md` and the canonical project documents above, then inspect the current repository state before editing.

Temporary agent journals, briefing folders and handoff scratchpads should stay outside Git or in ignored local paths. Durable knowledge belongs in `MASTER_PROJECT.md`, `DECISIONS.md`, `STATUS.md`, `TASKS.md`, `plans/`, `reviews/` or the relevant subsystem documentation.
