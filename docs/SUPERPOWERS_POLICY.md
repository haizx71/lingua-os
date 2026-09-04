# Superpowers Policy for LINGUA OS

Version: 1.0

Superpowers is an approved engineering-process skill set for both Codex and Gemini. It improves planning, test discipline, review and verification. It does not own product decisions.

## Authority order

When Superpowers guidance conflicts with project rules, follow this order:

1. `MASTER_PROJECT.md`
2. accepted entries in `DECISIONS.md`
3. shared contracts and migration history
4. the applicable Codex or Gemini project specification
5. `TASKS.md`
6. `docs/ENGINEERING_WORKFLOW.md`
7. Superpowers guidance
8. agent preference

## Locked decisions

Do not use brainstorming to reopen accepted product or architecture decisions simply because a skill suggests exploration.

Examples of locked decisions:

- PostgreSQL first
- Language Brain in v0.1
- one primary FSRS lineage per learner/concept in MVP
- English for Vietnamese first
- AI Tutor post-MVP
- realtime pronunciation scoring post-MVP
- OpenAPI as public API source of truth
- Today, Read, Review, Brain and Progress as MVP primary surfaces

Brainstorming is appropriate only when:

- a task has a material gap in the specification
- two authoritative documents conflict
- a new durable architecture decision is required
- there are multiple valid implementation approaches with meaningful tradeoffs
- the human explicitly asks for product or architecture exploration

For ordinary implementation tasks, move from approved spec to implementation plan, tests, code, review and verification.

## Required engineering sequence

For non-trivial implementation tasks:

1. Read the task and authoritative project files.
2. Inspect existing implementation and contracts.
3. Decide whether brainstorming is necessary under the rules above.
4. Write or update a bounded implementation plan under `plans/` when the task spans multiple files or steps.
5. Define acceptance checks and tests before or alongside implementation.
6. Implement the smallest complete slice.
7. Run tests, type checks, lint and task-specific verification.
8. Perform specification-compliance review.
9. Perform code-quality review.
10. Record verification evidence.
11. Update `TASKS.md` and `STATUS.md`.

## TDD policy

Use test-first development where the behavior is deterministic and testable, especially:

- learner-state transitions
- FSRS scheduling integration
- Today priority rules
- authorization and RLS boundaries
- content filtering/provenance rules
- API validation
- data transformation
- component behavior and interaction states

Do not create meaningless tests merely to satisfy a rule. Visual-only polish may use snapshot or end-to-end coverage when unit tests provide little value.

## Review policy

Review in this order:

1. Spec compliance: does the implementation match the approved requirement and contract?
2. Code quality: is the implementation maintainable, secure, typed, testable and minimal?
3. Verification: do the actual commands and user flows prove it works?

A passing test suite is not sufficient if the implementation violates the project specification.

## Skill output persistence

Durable project reasoning belongs in repository files, not only chat.

- implementation plans: `plans/`
- review notes when useful: `reviews/`
- durable decisions: `DECISIONS.md`
- execution state: `STATUS.md` and `TASKS.md`

Do not paste large skill-generated essays into source files. Persist only concise decisions and executable plans.
