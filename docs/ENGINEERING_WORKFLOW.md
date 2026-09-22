# LINGUA OS Engineering Workflow

Version: 2.0

This workflow applies to any engineer or agent working on LINGUA OS. Work is divided by subsystem, not by model or vendor.

## Workstreams

### Backend/system

Typical scope:

- backend services
- data model and migrations
- public contracts
- learner/memory/content/Today engines
- authorization and security
- backend tests and observability

### Frontend/product UI

Typical scope:

- web frontend
- design system and components
- responsive behavior
- accessibility
- client integration
- frontend tests
- interaction and motion polish

External design or engineering skills are advisory only. They never override LINGUA OS specifications, contracts or accepted decisions.

## Per-task lifecycle

### 1. Select

Choose an unblocked task from `TASKS.md` or the explicitly assigned task.

### 2. Understand

Read the authoritative project files, relevant subsystem spec, contracts and current implementation before editing.

### 3. Plan

For non-trivial work, create or update:

`plans/TASK-XXX-short-name.md`

Keep the plan concise and executable:

- objective
- affected files
- contract/migration impact
- implementation steps
- tests and acceptance checks
- risks or blockers

### 4. Test and implement

Use test-first development for deterministic behavior when practical. Implement the smallest complete vertical slice.

### 5. Review

Run two review passes:

- specification compliance
- code quality

Independent review is preferred for high-risk changes. Self-review does not replace an explicitly required external review gate.

### 6. Verify

Run real checks. Do not claim completion from inspection alone.

Typical evidence:

- unit/integration/e2e tests
- type check
- lint
- migration validation
- OpenAPI/contract validation
- accessibility checks
- responsive/browser verification
- production build where applicable

### 7. Record

Update durable state only when meaningful:

- `TASKS.md`
- `STATUS.md`
- `DECISIONS.md` only for durable decisions
- `reviews/` for acceptance/review evidence worth retaining

Do not create per-agent briefing trees, chat handoff files or temporary journals inside the repository.

## Shared contract protocol

If a required contract is missing or unsuitable:

1. do not invent a local replacement
2. identify the exact contract gap
3. make a bounded contract change when authorized
4. update affected tests and generated types
5. verify consumers against the new contract

Mocks must remain contract-valid.

## Git and worktrees

Do not point multiple active writers at the same mutable worktree.

Use isolated branches/worktrees for parallel changes and integrate through reviewed commits. Never force-reset or discard another writer's uncommitted work.

See `GIT_WORKTREE_WORKFLOW.md`.

## Commit convention

Prefer task-scoped commits.

Examples:

```text
feat(core): implement concept state model
feat(ui): add Today learning surface
fix(api): align Today response contract
test(memory): cover due queue transitions
docs(project): consolidate repository guidance
```

## When to brainstorm

Approved specs are not brainstorming prompts.

Explore alternatives only when:

- a material specification gap exists
- authoritative sources conflict
- a new durable decision is required
- multiple implementation approaches have meaningful tradeoffs
- the human explicitly requests exploration
