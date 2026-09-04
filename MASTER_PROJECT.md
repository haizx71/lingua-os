# LINGUA OS — Master Project Contract

Version: 4.0
Status: MVP Foundation
Primary market: Vietnamese learners studying English from approximately A0 to B1
Primary learning window: 20–30 minutes per day
Primary UX: mobile-first responsive web

## 1. Product definition

LINGUA OS is an adaptive language-learning system centered on a persistent learner model called the Language Brain. The system records evidence from reading, review, listening and production, then uses that evidence to decide what the learner should do next.

The product must optimize real learning progress, not XP accumulation.

## 2. MVP product loop

The v0.1 learning loop is:

1. Today selects the highest-value activities for the learner.
2. Reader exposes the learner to level-appropriate content.
3. Unknown or weak concepts enter the Language Brain.
4. Smart Review schedules memory work with FSRS.
5. Progress makes learning evidence visible.
6. New evidence updates the Language Brain and the next Today plan.

## 3. MVP surfaces

MUST ship:

- Today
- Reader
- Smart Review
- Language Brain
- Progress
- Authentication and onboarding
- Starting Level Estimate
- Dictionary/concept detail needed by Reader and Review
- Content ingestion sufficient for production content

MUST NOT enter the v0.1 critical path:

- Free-form AI Tutor
- Real-time pronunciation scoring
- Real-time forced alignment
- Chinese or Japanese learning modes
- Exam certification
- Social/community features
- Marketplace/shared deck ecosystem

Post-MVP systems may have interfaces or feature flags, but must not create production dependencies for v0.1.

## 4. Core product invariants

- Language Brain is the central learner-state model.
- A learner's recognition, listening and production evidence are distinct dimensions.
- MVP uses one primary FSRS memory lineage per learner/concept, not one scheduler per skill dimension.
- Starting Level Estimate is an estimate, not a CEFR certificate.
- PostgreSQL is the primary system of record.
- Graph behavior is modeled logically with relational tables before considering a separate graph database.
- AI is an optional provider behind interfaces, not a core dependency.
- Speech providers are replaceable. No business rule may depend directly on one vendor/model.
- Content must carry source, license/provenance and quality state.
- Public API is contract-first.
- Frontend does not invent backend business rules.
- Backend does not redesign product UX.

## 4A. UI/UX design intelligence policy

Gemini may use approved external UI/UX skills as design intelligence. For the current project, UI UX Pro Max is the approved primary UI/UX skill.

Rules:

- Product requirements, MVP scope, API contracts and accepted decisions always outrank external skill recommendations.
- The skill advises visual hierarchy, design-system choices, interaction patterns, responsive behavior, accessibility and implementation quality.
- The skill must not add product features, routes, gamification systems, data fields or business rules that are absent from the project specification.
- Persisted design-system output belongs under `design-system/` and becomes a frontend source of truth only after it is checked against `docs/GEMINI_PROJECT_SPEC.md` and `docs/UI_UX_SKILL_POLICY.md`.
- Gemini must use the project design system before page-specific styling. Page overrides may only contain intentional deviations.
- External skill installation is a human setup action. Agents must not silently install or update software on the user's machine.


## 4B. Engineering process policy

Superpowers is the approved engineering-process skill set for Codex and Gemini. It assists with planning, test discipline, debugging, review and verification. It does not own product or architecture decisions.

Rules:

- Approved specifications and accepted ADRs are treated as locked design unless a real gap, conflict or new decision requires exploration.
- Do not repeatedly brainstorm settled requirements.
- Non-trivial tasks should use a bounded implementation plan under `plans/`.
- Deterministic business behavior should use meaningful test-first development where practical.
- Completion requires specification-compliance review, code-quality review and real verification.
- Durable execution state belongs in repository files, not only agent chat.
- When Codex and Gemini work in parallel after Git initialization, separate branches/worktrees are preferred to avoid shared uncommitted edits.
- External skills never outrank this master contract, accepted decisions or shared contracts.

## 5. Ownership

### Codex owns

- services/
- database/
- contracts/
- backend tests
- migrations and seeds
- API and business logic
- Learner Engine
- Memory Engine
- Today Engine
- Content pipeline
- authentication/authorization integration
- observability and backend security

### Gemini owns

- apps/web/
- packages/ui/
- frontend tests
- design tokens
- component system
- responsive behavior
- accessibility implementation
- animation and interaction polish
- client state and API consumption

### Shared

- MASTER_PROJECT.md
- STATUS.md
- TASKS.md
- DECISIONS.md
- contracts/openapi.yaml
- contracts/enums.json
- contracts/errors.json

A shared file must not be changed casually. Contract changes require updating all affected documentation/tests in the same task.

## 6. Source-of-truth precedence

When information conflicts, resolve in this order:

1. MASTER_PROJECT.md
2. Accepted decisions in DECISIONS.md
3. contracts/openapi.yaml, contracts/enums.json, database migration history for implemented public contracts
4. docs/CODEX_PROJECT_SPEC.md for backend/system behavior
5. docs/GEMINI_PROJECT_SPEC.md for frontend/UI behavior
6. TASKS.md for current execution scope
7. Existing implementation

If a conflict cannot be resolved safely, do not invent a new rule. Record the conflict in STATUS.md and propose a bounded decision.

## 7. Definition of done

A task is done only when:

- implementation matches the applicable spec and contract
- tests for the changed behavior pass
- lint/type checks pass where configured
- no unrelated ownership boundary is crossed
- API/schema changes include migrations/contracts as needed
- loading, empty, error and success states exist for user-facing work
- STATUS.md and TASKS.md reflect the completed work
- non-trivial work has an implementation plan when appropriate
- specification-compliance review completed
- code-quality review completed
- real verification commands/checks passed
- meaningful architecture changes are captured in DECISIONS.md

## 8. Working principle

Build a large-enough architecture for LINGUA OS, but activate a small MVP. Do not build speculative complexity simply because the future roadmap contains it.
