# LINGUA OS Knowledge System V2 — Today Engine Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/today/`, `database/migrations/`, `contracts/`

---

## 1. Executive Summary & Purpose

The Today Engine is the daily learning orchestrator of LINGUA OS. It synthesizes the learner's time budget, overdue review backlog, decaying memory items (`at_risk`), prerequisite gaps, and curriculum goals into a deterministic, high-efficiency daily learning plan.

### Core Architectural Axiom
> **No Guesswork, No Fluff, No Hallucinations.**
> Today plan generation is 100% deterministic mathematics and relational logic. Given the exact same database state, learner budget, and timestamp, the Today engine will output the exact same prioritized plan every time.

---

## 2. Deterministic Daily Budget Allocation Algorithm

### 2.1 Learner Inputs & Constraints
- **Daily Time Budget ($T_{\text{budget}}$)**: Typically 15, 30, or 45 minutes ($900\text{s}$, $1800\text{s}$, or $2700\text{s}$).
- **Target New Concepts Limit ($N_{\text{max}}$)**: Hard ceiling (default 5 to 10 concepts/day) to prevent cognitive overload.
- **Learner Timezone**: Required for precise local calendar day rollover calculations.

### 2.2 Strict Priority Packing Hierarchy
The Today Engine packs activities into the budget using four non-negotiable priority tiers:

```
+---------------------------------------------------------------------------------------+
|                              TODAY BUDGET PACKING TIERS                               |
+---------------------------------------------------------------------------------------+
| PRIORITY 1: OVERDUE REVIEWS (FSRS Retention Defense)                                  |
| - Target: Due review items where due_at <= now()                                      |
| - Allocation: Up to 50% of daily time budget                                          |
| - Est. Time: ~30 seconds per review item                                              |
+---------------------------------------------------------------------------------------+
| PRIORITY 2: CRITICAL REMEDIATION (At-Risk & Decayed Items)                             |
| - Target: Mastered/Active items with decaying retrievability R < 0.70                 |
| - Allocation: Up to 25% of daily time budget                                          |
| - Est. Time: ~45 seconds per remediation challenge                                    |
+---------------------------------------------------------------------------------------+
| PRIORITY 3: PREREQUISITE UNBLOCKING & NEW CONCEPTS                                    |
| - Target: Unseen concepts matching current CEFR band whose prerequisites are satisfied|
| - Allocation: Up to 20% of daily time budget (bounded by N_max)                       |
| - Est. Time: ~90 seconds per introductory learning card                               |
+---------------------------------------------------------------------------------------+
| PRIORITY 4: COMPREHENSIBLE READING / LISTENING APPLICATION                            |
| - Target: Curated content item where 95-98% of tokens are known/active (i + 1)        |
| - Allocation: Remaining budget (minimum 5 minutes)                                    |
| - Est. Time: ~300-600 seconds per reading passage                                     |
+---------------------------------------------------------------------------------------+
```

---

## 3. Detailed Algorithmic Step-by-Step

```
Algorithm: GenerateTodayPlan(user_id, as_of_date, timezone, budget_seconds, new_limit)
-----------------------------------------------------------------------------------------
1. Check Existing Plan:
   SELECT * FROM today_plans WHERE user_id = :user_id AND plan_date = :as_of_date;
   If exists, return existing plan snapshot (Idempotency Guarantee).

2. Calculate Overdue Reviews:
   Find all review_items where is_active=TRUE AND due_at <= :as_of_date.
   Count = N_due.
   Time_reviews = MIN(N_due * 30s, 0.50 * budget_seconds).
   Items_to_pack = FLOOR(Time_reviews / 30s).

3. Identify At-Risk Remediation Items:
   Query v_learner_concept_retrievability WHERE effective_status = 'at_risk'.
   Count = N_at_risk.
   Time_remed = MIN(N_at_risk * 45s, 0.25 * budget_seconds).

4. Select New Curriculum Concepts (Topological DAG Sort):
   Query candidate concepts from user's current CEFR level:
   - Exclude any concept already in user_concept_states with status != 'unseen'.
   - Filter out concepts that have ANY unmet prerequisite (prereq status NOT IN ('active', 'mastered')).
   - Rank by frequency_rank ASC, communicative_importance DESC.
   - Limit to MIN(new_limit, FLOOR((budget_seconds - Time_reviews - Time_remed) / 90s)).

5. Select Comprehensible Reading Passage:
   If remaining_budget >= 300s:
     Find published content_item where i+1 comprehension score is between 90% and 98%.
     Assign as reading activity.

6. Materialize Plan Snapshot:
   INSERT INTO today_plans (user_id, plan_date, target_duration_seconds) ...
   INSERT INTO today_plan_activities (plan_id, activity_type, concept_ids, ...) ...
   Return hydrated plan DTO.
```

---

## 4. Activity Card Specifications & Pedagogical Reason Codes

Each generated activity card delivers an explicit, human-understandable reason code to the learner:

| Activity Type | Reason Code | User-Facing Explanation (VI / EN) |
| :--- | :--- | :--- |
| `review` | `due_spaced_repetition` | "Củng cố trí nhớ định kỳ / Due for optimal memory retention" |
| `remediation` | `memory_decay_at_risk` | "Cần cứu nguy: từ vựng đang có nguy cơ bị quên / At risk of forgetting" |
| `prerequisite` | `unblock_dependent_grammar` | "Nền tảng quan trọng trước khi học ngữ pháp mới / Key prerequisite" |
| `new_concept` | `cefr_curriculum_next` | "Từ mới tiếp theo theo lộ trình CEFR B1 / Next in CEFR curriculum" |
| `reader` | `comprehensible_input_i_plus_1`| "Đọc hiểu áp dụng thực tế (độ khó lý tưởng 95% từ đã biết) / i+1 Reading" |

---

## 5. Schema & Idempotency Storage

```sql
CREATE TABLE public.today_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    target_duration_seconds INTEGER NOT NULL,
    completed_duration_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_today_plans_user_date UNIQUE (user_id, plan_date)
);

CREATE TABLE public.today_plan_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.today_plans(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('review', 'remediation', 'new_concept', 'reader', 'listening')),
    priority_rank INTEGER NOT NULL,
    estimated_duration_seconds INTEGER NOT NULL,
    reason_code TEXT NOT NULL,
    concept_ids JSONB NOT NULL DEFAULT '[]',
    content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_today_activities_plan_rank UNIQUE (plan_id, priority_rank)
);

CREATE INDEX ix_today_plans_user_date ON public.today_plans(user_id, plan_date);
```

---

## 6. Timezone Handling & Midnight Rollover

1. **User Timezone Authority**: The user's timezone (e.g. `'Asia/Ho_Chi_Minh'`) is loaded from `user_profiles.timezone` (defaulting to `'UTC'` if unset).
2. **Local Day Resolution**:
   $$\text{Local Date} = (\text{Current UTC Timestamp} \text{ AT TIME ZONE } \text{User Timezone})::\text{DATE}$$
3. **Plan Rollover**: When the local date advances past `plan_date`, any unfinished plan automatically transitions to `'expired'`. The next request to `GET /v1/today` deterministically materializes the new day's plan.
