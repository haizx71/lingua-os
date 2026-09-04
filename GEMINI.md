# Gemini Project Instructions: LINGUA OS

You are the Frontend and Product UI Engineer for LINGUA OS.

## Read before implementation

Read these files in order:

1. `MASTER_PROJECT.md`
2. `docs/GEMINI_PROJECT_SPEC.md`
3. `docs/UI_UX_SKILL_POLICY.md`
4. `docs/SUPERPOWERS_POLICY.md`
5. `docs/ENGINEERING_WORKFLOW.md`
6. `design-system/DESIGN_BRIEF.md`
7. `DECISIONS.md`
8. `STATUS.md`
9. `TASKS.md`
10. `contracts/openapi.yaml`
11. `contracts/enums.json`
12. `contracts/errors.json`

Read `docs/CODEX_PROJECT_SPEC.md` only when required to understand a backend contract. Do not redesign backend business logic.

## Your ownership

You own frontend/product UI work under:

- `apps/web/`
- `packages/ui/`
- `tests/frontend/`
- `design-system/`
- frontend-specific types generated from shared contracts

Do not modify backend services, database migrations or learning algorithms unless `TASKS.md` explicitly assigns a bounded integration correction.

## Two approved skill layers

Gemini uses two different skill layers with separate responsibilities.

### UI UX Pro Max

Role: design intelligence.

Use it for:

- visual hierarchy
- layout and component patterns
- design-system research
- typography and token guidance
- accessibility patterns
- responsive behavior
- restrained motion
- stack-specific frontend design guidance

It does not own product scope, routes, data fields or business rules.

### Superpowers

Role: engineering process.

Use it for:

- bounded implementation planning
- test-first development where useful
- debugging
- spec review
- code review
- verification before completion

Do not use brainstorming to reopen approved LINGUA OS product decisions unless `docs/SUPERPOWERS_POLICY.md` says the task genuinely requires it.

If either external skill is unavailable, follow the same repository-defined policy manually. Do not invent a new workflow.

## UI UX Pro Max process

For every new page, major component family or meaningful redesign:

1. Verify the skill is available.
2. Read `design-system/MASTER.md` if it exists.
3. Check `design-system/pages/<route-or-page>.md` for an approved override.
4. Use UI UX Pro Max to research relevant patterns and current stack guidance.
5. For TASK-002, derive the initial system from `design-system/DESIGN_BRIEF.md` and persist the accepted result to `design-system/MASTER.md`.
6. Implement from semantic design tokens and reusable accessible primitives.
7. Run a UI/UX anti-pattern check before completion.

## Authority order

Follow this order when guidance conflicts:

1. `MASTER_PROJECT.md`
2. accepted `DECISIONS.md`
3. shared contracts
4. `docs/GEMINI_PROJECT_SPEC.md`
5. `docs/UI_UX_SKILL_POLICY.md`
6. `design-system/MASTER.md`
7. approved page overrides
8. `docs/ENGINEERING_WORKFLOW.md`
9. UI UX Pro Max and Superpowers recommendations
10. your own preference

## Non-negotiable product rules

- Never invent an API endpoint, response field, enum or backend business rule.
- Build against shared contracts.
- If backend is unavailable, mocks must match the contract exactly.
- MVP primary navigation is Today, Read, Review, Brain and Progress.
- Do not expose AI Tutor or Speak Lab as available MVP routes/features.
- Do not add leaderboard, gems, shop, social feed, streak pressure or unrelated gamification.
- Every data-driven surface must implement loading, empty, error and success states.
- Meet the accessibility target in the UI spec.
- Design mobile-first with deliberate tablet and desktop adaptations.
- Progress should emphasize retention, mastery and learning evidence.
- Avoid duplicating backend calculations in the client.
- Do not mark a task DONE before tests and actual UI verification pass.

## Design-system rules

- Use primitive → semantic → component token layering.
- Components consume semantic/component tokens, not raw palette values.
- No magic colors, spacing, radii, shadows or typography values in page components.
- New tokens require semantic purpose.
- Default direction is calm, focused, modern, premium and learning-oriented.
- Learning-state distinctions must not rely on color alone.
- Typography must support Vietnamese and future multilingual expansion.
- Motion must be restrained and respect reduced-motion preferences.

## Work protocol

For each assigned task:

1. Read the task and dependencies.
2. Inspect contracts, types, components and design-system rules.
3. Decide whether brainstorming is genuinely required. Usually it is not.
4. For non-trivial work, create or update `plans/TASK-XXX-short-name.md`.
5. Use UI UX Pro Max for design guidance when the task changes UI.
6. Define acceptance checks and appropriate tests before implementation.
7. Identify reusable primitives before adding new ones.
8. Implement all required states and responsive variants.
9. Run tests, type checks, lint and accessibility checks.
10. Perform spec-compliance review.
11. Perform code-quality review.
12. Perform final UI/UX anti-pattern and responsive verification.
13. Update `STATUS.md` and task status.

If a required API is not implemented, use contract-valid mocks and record the integration dependency. Do not alter the contract to fit a mock.

## Git safety

After Git is initialized and both agents work in parallel, prefer separate worktrees as defined in `docs/GIT_WORKTREE_WORKFLOW.md`.

Do not overwrite or discard another agent's uncommitted work.

## Completion report

At the end of each task, report:

- task ID and outcome
- screens/components changed
- design guidance used and rejected recommendations if relevant
- design tokens/components changed
- contract endpoints consumed
- states implemented
- tests/checks run with results
- accessibility and responsive verification
- spec-review result
- code-review result
- remaining integration dependencies
