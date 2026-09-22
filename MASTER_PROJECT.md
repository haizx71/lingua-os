# LINGUA OS — Master Project Contract

Version: 4.1  
Status: Active product and engineering source of truth  
Primary market: Vietnamese learners studying English from approximately A0 to B1  
Primary learning window: 20–30 minutes per day  
Primary UX: mobile-first responsive web

## 1. Product definition

LINGUA OS is an adaptive language-learning system centered on a persistent learner model called the **Language Brain**.

The system records learning evidence from reading, review, listening and production, then uses that evidence to decide what the learner should do next.

The product optimizes for real learning progress, retention and usable language competence rather than XP accumulation or game mechanics.

## 2. Product direction

The long-term direction is a learning operating system in which all major learning surfaces contribute evidence to one coherent learner model.

The system should progressively become better at answering three questions:

1. What does this learner know?
2. What is weak, forgotten or missing?
3. What is the highest-value activity for the learner to do next?

New capabilities should strengthen this loop instead of becoming isolated feature silos.

## 3. MVP learning loop

The v0.1 loop is:

1. **Today** selects the highest-value activities for the learner.
2. **Reader** exposes the learner to level-appropriate language in context.
3. Unknown, weak or newly observed concepts update the **Language Brain**.
4. **Smart Review** schedules memory work with FSRS.
5. **Progress** exposes useful evidence about retention and mastery.
6. New evidence updates the Language Brain and the next Today plan.

## 4. MVP surfaces

Must ship:

- Today
- Reader
- Smart Review
- Language Brain
- Progress
- Authentication and onboarding
- Starting Level Estimate
- Dictionary/concept detail required by Reader and Review
- Content ingestion sufficient for production content

Not in the v0.1 critical path:

- free-form AI Tutor
- real-time pronunciation scoring
- real-time forced alignment
- Chinese or Japanese learning modes
- exam certification
- social/community features
- marketplace/shared deck ecosystem

Post-MVP capabilities may have interfaces or feature flags, but must not become production dependencies for v0.1.

## 5. Core invariants

- Language Brain is the central learner-state model.
- Recognition, listening and production evidence are distinct dimensions.
- MVP uses one primary FSRS memory lineage per learner/concept.
- Starting Level Estimate is an estimate, not a CEFR certificate.
- PostgreSQL is the primary system of record.
- Graph behavior is modeled relationally before introducing a separate graph database.
- AI is optional infrastructure behind provider interfaces, not a core dependency.
- Speech providers are replaceable.
- Content carries source, license/provenance and quality state.
- Public APIs are contract-first.
- Frontend must not invent backend business rules.
- Backend must not redesign product UX.
- Security and authorization are enforced server-side.
- Learner-state preservation and FRLL regression protection take priority over delivery speed.

## 6. Product and UI principles

LINGUA OS should feel like an intelligent personal learning workspace: calm, focused, modern, premium and clear.

Learning evidence and the current learning action take priority over decoration.

The interface should reduce the learner's need to decide what to study next. Learning-state distinctions must never rely on color alone. Vietnamese text and diacritics must render cleanly, while the foundation remains compatible with future multilingual expansion.

The detailed visual source of truth lives under `design-system/`.

## 7. Engineering ownership

Ownership is defined by subsystem rather than by a particular AI model.

### Backend/system

- `services/`
- `database/`
- `contracts/`
- backend tests
- migrations and seeds
- API and business logic
- Learner Engine
- Memory Engine
- Today Engine
- content pipeline
- authentication/authorization integration
- observability and backend security

### Frontend/product UI

- `apps/web/`
- `packages/ui/`
- frontend tests
- design tokens and component system
- responsive behavior
- accessibility
- animation and interaction polish
- client state and API consumption

### Shared

- `MASTER_PROJECT.md`
- `DECISIONS.md`
- `STATUS.md`
- `TASKS.md`
- `CONTEXT.md`
- `contracts/`

Shared files must not be changed casually.

## 8. Source-of-truth precedence

When information conflicts, resolve in this order:

1. `MASTER_PROJECT.md`
2. accepted decisions in `DECISIONS.md`
3. public contracts and database migration history
4. applicable detailed subsystem specification under `docs/`
5. `TASKS.md` for current execution scope
6. verified implementation
7. historical review/handoff material

If a conflict cannot be resolved safely, record it in `STATUS.md` and propose a bounded decision instead of inventing a rule.

## 9. Engineering process

External design or engineering skills may be used as advisory tools. They never outrank the product contract, accepted decisions, contracts or verified repository state.

For non-trivial work:

spec → inspect → bounded plan → tests → implementation → spec review → code review → verification → status update

Durable project reasoning belongs in repository source-of-truth files, plans and reviews—not in temporary per-agent folders.

## 10. Definition of done

A task is done only when:

- implementation matches the applicable specification and contract
- relevant tests/checks pass
- lint/type checks pass where configured
- no unrelated ownership boundary is crossed
- API/schema changes include contracts/migrations as required
- user-facing work includes loading, empty, error and success states where applicable
- accessibility and responsive behavior are verified for frontend work
- `STATUS.md` and `TASKS.md` reflect meaningful execution changes
- durable architecture decisions are captured in `DECISIONS.md`
- real verification evidence exists

## 11. Working principle

Build an architecture large enough for LINGUA OS to grow, but activate only the product surface needed now.

Do not add speculative complexity simply because a future roadmap might use it.
