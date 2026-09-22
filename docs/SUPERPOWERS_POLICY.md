# LINGUA OS — Engineering Skill Policy

Version: 2.0

Superpowers or similar engineering-process skills may be used to improve planning, test discipline, debugging, review and verification. They do not own product or architecture decisions.

## Authority order

When external skill guidance conflicts with project rules, follow:

1. `MASTER_PROJECT.md`
2. accepted `DECISIONS.md`
3. shared contracts and migration history
4. applicable detailed subsystem specification
5. `TASKS.md`
6. `docs/ENGINEERING_WORKFLOW.md`
7. external skill guidance
8. agent preference

## Locked decisions

Do not use brainstorming to reopen accepted product or architecture decisions merely because a skill suggests exploration.

Examples include:

- PostgreSQL first
- Language Brain in v0.1
- one primary FSRS lineage per learner/concept in MVP
- English for Vietnamese learners first
- AI Tutor post-MVP
- real-time pronunciation scoring post-MVP
- OpenAPI as public API source of truth
- Today, Read, Review, Brain and Progress as the primary MVP surfaces

Brainstorming is appropriate only when a real gap, conflict, new durable decision or meaningful implementation tradeoff exists.

## Required engineering sequence

For non-trivial work:

1. read task and authoritative project files
2. inspect current implementation and contracts
3. decide whether exploration is actually needed
4. write a bounded plan under `plans/` when useful
5. define acceptance checks/tests
6. implement the smallest complete slice
7. run real verification
8. review spec compliance
9. review code quality
10. record durable evidence only where useful

## TDD policy

Prefer test-first development for deterministic behavior such as:

- learner-state transitions
- FSRS scheduling
- Today priority rules
- authorization boundaries
- content filtering/provenance
- API validation
- data transformation
- interactive component behavior

Do not create meaningless tests simply to satisfy a process rule.

## Persistence

Durable reasoning belongs in:

- `plans/`
- `reviews/`
- `DECISIONS.md`
- `STATUS.md`
- `TASKS.md`

Temporary skill output, chat logs, handoff notes and agent journals should not be committed.
