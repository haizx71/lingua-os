# LINGUA OS Engineering Workflow

Version: 1.0

This workflow coordinates Codex and Gemini as two engineers working against one product contract.

## Roles

Codex: Core System Engineer

- backend
- data model
- migrations
- contracts
- learner/memory/content/Today engines
- backend security and tests

Gemini: Frontend and Product UI Engineer

- web frontend
- design system
- components
- responsive behavior
- accessibility
- client integration and frontend tests

UI UX Pro Max: design-intelligence advisor for Gemini.

Superpowers: engineering-process advisor for Codex and Gemini.

Neither external skill may override LINGUA OS product specifications.

## Per-task lifecycle

### 1. Select

Choose the first READY task for the current owner whose dependencies are DONE.

### 2. Understand

Read task-specific authoritative files and inspect the current code before editing.

### 3. Plan

For a non-trivial task, create:

`plans/TASK-XXX-short-name.md`

The plan should contain:

- objective
- affected files
- contracts/migrations involved
- implementation steps
- tests and acceptance checks
- risks or blockers

Keep it executable and concise.

### 4. Test and implement

Use test-first development for deterministic behavior. Implement only the slice needed for the task.

### 5. Review

Run two review passes:

- specification compliance
- code quality

When subagent capability exists, separate implementation and review contexts where practical. When it does not, perform explicit self-review against the same checklist.

### 6. Verify

Run real commands. Do not claim completion from inspection alone.

Typical evidence:

- unit/integration/e2e tests
- type check
- lint
- migration validation
- OpenAPI validation
- accessibility checks
- responsive visual checks
- production build where applicable

### 7. Record

Update:

- `TASKS.md`
- `STATUS.md`
- `DECISIONS.md` only when a durable decision changed

## Shared contract protocol

Codex owns public contract edits by default.

If Gemini discovers a missing or unsuitable contract:

1. do not invent a replacement locally
2. record the exact need in `STATUS.md`
3. request a bounded contract change
4. continue with contract-valid mocks only when possible

When Codex changes a shared contract:

1. update OpenAPI/enums/errors in the same task
2. update backend tests
3. commit the contract change clearly
4. Gemini syncs before implementing dependent integration

## Git and worktrees

Once Git is initialized, avoid running Codex and Gemini against the same mutable working tree at the same time.

Recommended long-lived development branches during MVP:

- `codex/core`
- `gemini/ui`

Recommended working directories:

- main checkout for integration
- separate Codex worktree
- separate Gemini worktree

Example after an initial commit:

```bash
git branch codex/core
git branch gemini/ui
git worktree add ../lingua-codex codex/core
git worktree add ../lingua-gemini gemini/ui
```

Open Codex in `../lingua-codex` and Gemini in `../lingua-gemini`.

Integrate through reviewed commits. Do not share uncommitted edits between agents.

## Commit convention

Use task-scoped commits where practical.

Examples:

```text
feat(core): implement concept state model
feat(ui): add Today application shell
fix(api): align Today response contract
 test(memory): cover due queue transitions
```

Include the task ID in commit body or PR description when useful.

## When to brainstorm

Approved specs are already product design. Do not repeatedly brainstorm them.

Brainstorm only for unresolved gaps, conflicts or genuinely new decisions. See `docs/SUPERPOWERS_POLICY.md`.
