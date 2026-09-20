# LINGUA OS Knowledge System V2 — Test Strategy Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `tests/backend/`, `services/api/`

---

## 1. Executive Summary & Testing Pyramid

Quality engineering in Knowledge System V2 follows a rigorous multi-tier test pyramid. Spaced repetition scheduling, Bayesian competence accumulation, and multi-tenant data isolation are critical systems where silent errors cause severe pedagogical degradation.

```
                  / \
                 /   \
                / E2E \       <-- Minimal, high-value scenario runs (Smoke)
               /-------\
              / Concurr \     <-- Concurrency, race condition, & row-lock verification
             /-----------\
            / Integration \   <-- Real PostgreSQL test database with transaction rollback
           /---------------\
          /  Property-Based \ <-- Hypothesis tests for mathematical bounds & DAG invariants
         /-------------------\
        /      Unit Tests     \ <-- Deterministic algorithms, py-fsrs 6.3.2 math, state transitions
       +-----------------------+
```

---

## 2. Test Suites & Verification Scope

### 2.1 Unit Test Suite (`pytest tests/backend/unit/`)
- **Scope**: Fast, in-memory tests verifying pure mathematical logic and state machines without database connections.
- **Key Test Cases**:
  - `test_pyfsrs_mathematical_equivalence`: Asserts that `v_learner_concept_retrievability` SQL formula matches `Scheduler.get_card_retrievability()` output across 1,000 generated (stability, elapsed_days) data points with relative error $< 10^{-6}$.
  - `test_fsrs_state_transitions`: Verifies `stability`, `difficulty`, and `due_at` calculations for ratings 1-4 against py-fsrs 6.3.2 reference outputs.
  - `test_bayesian_competence_update`: Asserts that updating $\text{Beta}(\alpha, \beta)$ preserves $\alpha, \beta \ge 1.0$ and competence score converges monotonically toward evidence scores.
  - `test_status_transition_matrix`: Verifies all transitions (`unseen` $\to$ `learning` $\to$ `active` $\to$ `mastered` $\to$ `at_risk`).

### 2.2 Property-Based Test Suite (`tests/backend/property/` using `hypothesis`)
- **Scope**: Invariant fuzzing over large generative input spaces.
- **Key Properties Tested**:
  - **Retrievability Bounds**: For all stability $S \in (0, 10000]$ and elapsed days $t \in [0, 10000]$, $0.0 \le R(t, S) \le 1.0$.
  - **Competence Score Bounds**: For all arbitrary sequences of scores $s_i \in [0.0, 1.0]$ and weights $w_i \in [0.1, 5.0]$, composite competence $C \in [0.0, 1.0]$.
  - **Graph Acyclicity Invariant**: For any randomly generated DAG of prerequisites, topological sort never encounters a cycle.

### 2.3 Real PostgreSQL Integration Suite (`tests/backend/integration/`)
- **Scope**: Executed against a real PostgreSQL instance inside Docker, using isolated transaction rollbacks (`pytest-asyncio` with rollback fixtures).
- **Key Test Cases**:
  - `test_gap01_library_save_activation`: Asserts saving a concept atomically creates `concept_save_intents`, `review_items` (primary), and `fsrs_states`.
  - `test_single_primary_lineage_constraint`: Asserts that attempting to insert a second primary `review_items` record for the same `(user_id, concept_id)` raises a unique constraint violation.
  - `test_polysemy_concept_senses_resolution`: Verifies *bank* (finance) and *bank* (river) link to the single *bank* lexeme row while having independent concept IDs.
  - `test_v_learner_concept_retrievability_decay`: Seeds an item with `status = 'mastered'` and reviews 60 days in the past; asserts `effective_status` in the view evaluates to `'at_risk'`.

### 2.4 Concurrency & Race Condition Suite (`tests/backend/concurrency/`)
- **Scope**: Multi-worker concurrent execution testing transaction isolation levels and advisory locks.
- **Key Scenarios**:
  - **Concurrent Prerequisite DAG Cycle Race**:
    - Thread 1 attempts: $A \to B \to C \to D$.
    - Thread 2 attempts: $D \to A$.
    - *Expected Outcome*: Due to `pg_advisory_xact_lock(hashtext('lingua_concept_dag_mutation_lock'))`, both transactions are serialized; Thread 2 is rejected with `check_violation`. Zero cycles created.
  - **Concurrent Review Answer Submissions**:
    - Two simultaneous requests submit ratings for the same `review_item_id`.
    - *Expected Outcome*: Row-locking (`FOR UPDATE`) prevents lost updates; state transitions serialize cleanly.
  - **Concurrent Today Plan Generation**:
    - Two requests trigger `GET /v1/today` at the exact same millisecond.
    - *Expected Outcome*: `uq_today_plans_user_date` prevents duplicate daily plans; both return identical plan ID.

### 2.5 Security & Multi-Tenant Adversarial Suite (`tests/backend/security/`)
- **Scope**: Verification of RLS policies and anti-IDOR boundaries.
- **Key Scenarios**:
  - **Cross-Tenant State Tampering**: User $A$ submits an answer to a review item belonging to User $B$. Returns HTTP 404 or 403.
  - **Public Function Privilege Audit**: Asserts that `fn_check_concept_edges_acyclic` has `EXECUTE` revoked from `anon` and `authenticated`.
  - **Account Deletion Cascade Audit**: Deletes user; asserts 0 learner rows remaining and 100% canonical concepts intact.

---

## 3. Test Fixtures and Rollback Scaffold

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

@pytest_asyncio.fixture
async def db_session():
    """Provides a transactional database session rolled back after every test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    connection = await engine.connect()
    transaction = await connection.begin()

    SessionLocal = sessionmaker(
        bind=connection,
        class_=AsyncSession,
        expire_on_commit=False
    )
    session = SessionLocal()

    yield session

    await session.close()
    await transaction.rollback()
    await connection.close()
```

---

## 4. Automated CI Gate Requirements

Before any commit or pull request touching Knowledge System V2 may merge:
1. `pytest tests/backend/unit/` must pass with 100% success rate.
2. `pytest tests/backend/property/` must pass with minimum 100 iterations per test.
3. `pytest tests/backend/integration/` must pass against real PostgreSQL.
4. `git diff --check` must confirm zero whitespace or lint errors.
5. Code coverage across `lingua_api/competence/`, `memory/`, `review/`, and `today/` must exceed **90%**.
