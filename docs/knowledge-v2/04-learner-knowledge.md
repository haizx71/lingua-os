# LINGUA OS Knowledge System V2 — Learner Knowledge Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/competence/`, `database/migrations/`, `contracts/`

---

## 1. Executive Summary & Core Philosophy

Learner Knowledge models an individual learner's cognitive state regarding canonical concepts. In Knowledge System V2, learner state is strictly personal, multi-tenant isolated, and decoupled into three orthogonal, mathematically sound dimensions:

```
+---------------------------------------------------------------------------------------+
|                                TRIPARTITE LEARNER STATE                               |
+---------------------------------------------------------------------------------------+
| 1. COMPETENCE: Multi-dimensional Bayesian beta-binomial belief distributions         |
|    - Recognition (reading/listening comprehension)                                    |
|    - Listening (phonological/acoustic decoding)                                       |
|    - Production (active generation in writing/speaking)                               |
+---------------------------------------------------------------------------------------+
| 2. RETRIEVABILITY: Time-dependent recall probability R(t) from py-fsrs 6.3.2          |
|    - Exact power-law decay aligned with Python engine parameters (w20 exponent)       |
+---------------------------------------------------------------------------------------+
| 3. CURRICULAR STATUS: Discrete pedagogical lifecycle state                            |
|    - unseen -> learning -> active -> at_risk -> mastered                             |
+---------------------------------------------------------------------------------------+
```

---

## 2. Multi-Dimensional Competence Modeling (Bayesian Beta-Binomial)

### 2.1 Theoretical Framework
Human language ability is not scalar. A learner may effortlessly recognize a word when reading (*receptive recognition*), yet fail to recognize it in fast spoken audio (*listening decoding*), or fail to recall it when speaking (*productive retrieval*).

For each learner $u$, concept $c$, and dimension $d \in \{\text{recognition}, \text{listening}, \text{production}\}$, the latent ability $\theta_{u,c,d} \in [0, 1]$ is modeled as a Beta distribution:

$$\theta_{u,c,d} \sim \text{Beta}(\alpha_{u,c,d}, \beta_{u,c,d})$$

- **Prior**: Neutral uninformative prior $\alpha_0 = 1.0, \beta_0 = 1.0$ (uniform distribution over $[0, 1]$).
- **Expected Competence**:
  $$\mathbb{E}[\theta] = \frac{\alpha}{\alpha + \beta}$$
- **Uncertainty (Variance)**:
  $$\text{Var}(\theta) = \frac{\alpha \beta}{(\alpha + \beta)^2 (\alpha + \beta + 1)}$$
  High uncertainty indicates few observations; low uncertainty indicates substantial evidence.

### 2.2 Updating Equations upon Evidence
When a learner encounters a learning event with performance score $s \in [0.0, 1.0]$ and evidence weight $w \in [0.1, 2.0]$:

$$\alpha_{\text{new}} = \alpha_{\text{prev}} + w \cdot s$$
$$\beta_{\text{new}} = \beta_{\text{prev}} + w \cdot (1 - s)$$

#### Modality Mapping from Interaction Surfaces
| Interaction Surface | Modality ($d$) | Evidence Weight ($w$) | Score ($s$) |
| :--- | :--- | :--- | :--- |
| **Review (Self-Recall)** | Recognition | 1.0 | Again: 0.0, Hard: 0.5, Good: 0.85, Easy: 1.0 |
| **Review (Cloze Sentence)** | Production | 1.2 | Correct: 1.0, Hint Used: 0.5, Failed: 0.0 |
| **Review (Audio Ear-Train)**| Listening | 1.2 | Correct: 1.0, Replay > 2: 0.6, Failed: 0.0 |
| **Reader (Sentence Tap Quiz)**| Recognition | 0.8 | Correct: 1.0, Incorrect: 0.0 |
| **Writing Production Task**| Production | 1.5 | Rubric Score $\in [0.0, 1.0]$ |
| **Assessment Diagnostic** | Mapped by item | 2.0 | Standardized Test Item Outcome |

### 2.3 Aggregate Competence Score
The combined concept competence score $C_{u,c} \in [0, 1]$ is a weighted composite:

$$C_{u,c} = 0.40 \cdot \mathbb{E}[\theta_{\text{rec}}] + 0.30 \cdot \mathbb{E}[\theta_{\text{lis}}] + 0.30 \cdot \mathbb{E}[\theta_{\text{prod}}]$$

---

## 3. Retrievability Curve (py-fsrs 6.3.2 Exact Math Alignment)

### 3.1 Mathematical Authority
> **Python `FsrsSchedulerAdapter` is the single authoritative implementation of FSRS in LINGUA OS.**
> Under no circumstances may a divergent or legacy mathematical formula be used.

### 3.2 The py-fsrs 6.3.2 Power-Law Forgetting Equation
In `py-fsrs 6.3.2`, retrievability $R \in [0, 1]$ is defined strictly by:

$$R(t, S) = \left(1 + \text{FACTOR} \cdot \frac{\text{elapsed\_days}}{S}\right)^{\text{DECAY}}$$

Where:
- $\text{elapsed\_days} = \max\left(0, (\text{current\_time} - \text{last\_review}).\text{days}\right)$ (integer days elapsed, exactly matching `Scheduler.get_card_retrievability`).
- $S$: Memory stability in days.
- $\text{DECAY} = -w_{20}$ (the 21st parameter in the FSRS-6 model weights, default $-0.1542$).
- $\text{FACTOR} = 0.9^{1/\text{DECAY}} - 1$ (derived analytically from target retention $0.90$; for default weights, $\text{FACTOR} \approx 0.9803464944134797$).

### 3.3 Elimination of FSRS-4.5 Legacy Drift
Older legacy formulas (e.g. FSRS-4.5 with $\text{FACTOR} = 19/81 \approx 0.2345$ and $\text{DECAY} = -0.5$) are **strictly banned**. Any SQL projection view must load or match the active parameter set's exact $w_{20}$ and derived factor.

---

## 4. Curricular Status State Machine & Stagnation Resolution

### 4.1 The "Mastered Item Stagnation" Problem
In V1, status transitions in `user_concept_states` were monotonic upward based on evidence counts. An item reaching `mastered` remained `mastered` forever, even if the learner stopped reviewing it for 9 months.

### 4.2 Dynamic State Machine

```
              [No Interaction]
                     |
                     v
                +----------+
                |  UNSEEN  |
                +----+-----+
                     | Explicit Save / First Learning Event
                     v
                +----------+
          +---->| LEARNING |<----+
          |     +----+-----+     |
          |          | S >= 3.0 days AND C >= 0.40
          |          v
          |     +----------+
          |     |  ACTIVE  |
          |     +----+-----+
          |          | S >= 21.0 days AND C >= 0.75 AND R >= 0.85
          |          v
          |     +----------+
          |     | MASTERED |----+
          |     +----+-----+    |
R < 0.70  |          |          | R < 0.70 (Temporal Decay)
or Fail   |          |          v
          |     +----+-----+
          +-----| AT_RISK  |<---+ (Active item decaying R < 0.75)
                +----------+
```

### 4.3 Rigorous State Transition Matrix

| Current State | Target State | Trigger Condition | Rationale |
| :--- | :--- | :--- | :--- |
| `unseen` | `learning` | Concept saved to Library, or first review/practice completed. | Concept entered learner's active cognitive horizon. |
| `learning` | `active` | Stability $S \ge 3.0\text{ days}$ AND Competence $C \ge 0.40$. | Initial acquisition stable; moving out of short-term cramming. |
| `active` | `mastered` | Stability $S \ge 21.0\text{ days}$ AND Competence $C \ge 0.75$ AND Retrievability $R \ge 0.85$. | High long-term stability and demonstrated multi-modal competence. |
| `mastered` | `at_risk` | **Temporal Retrievability Decay**: $R(t, S) < 0.70$, OR review rating `'Again'`. | **Stagnation Solver**: Lapsed review time degraded recall probability below safety threshold. |
| `active` | `at_risk` | Retrievability $R(t, S) < 0.75$, OR review rating `'Again'`. | Item approaching critical forgetting curve. |
| `at_risk` | `active` | Review rating `'Good'` or `'Easy'` restoring $R \ge 0.90$. | Successful retrieval and memory reinforcement. |
| `at_risk` | `learning` | Severe failure: review rating `'Again'` with lapse count $> 3$. | Re-learning required from foundational steps. |

---

## 5. Storage vs. Projection Strategy

1. **Storage Table (`user_concept_states`)**:
   - Stores durable parameters: `rec_alpha`, `rec_beta`, `lis_alpha`, `lis_beta`, `prod_alpha`, `prod_beta`, `competence_score`, `status`, `last_evaluated_at`.
   - Updated synchronously in the transaction processing a `learning_event`.

2. **Temporal Retrievability Projection View (`v_learner_concept_retrievability`)**:
   - Aligned mathematically with py-fsrs 6.3.2:
   ```sql
   CREATE OR REPLACE VIEW public.v_learner_concept_retrievability AS
   SELECT
       ucs.user_id,
       ucs.concept_id,
       ucs.status AS stored_status,
       ucs.competence_score,
       ucs.rec_alpha, ucs.rec_beta,
       ucs.lis_alpha, ucs.lis_beta,
       ucs.prod_alpha, ucs.prod_beta,
       fs.stability,
       fs.due_at,
       fs.last_reviewed_at,
       CASE
           WHEN fs.last_reviewed_at IS NULL THEN 1.0
           ELSE POWER(
               1.0 + 0.9803464944134797 * GREATEST(0, EXTRACT(DAY FROM (clock_timestamp() - fs.last_reviewed_at))) / GREATEST(fs.stability, 0.1),
               -0.1542
           )
       END AS current_retrievability,
       CASE
           -- Dynamic downgrade if retrievability has decayed
           WHEN ucs.status = 'mastered' AND (
               fs.last_reviewed_at IS NOT NULL AND
               POWER(1.0 + 0.9803464944134797 * GREATEST(0, EXTRACT(DAY FROM (clock_timestamp() - fs.last_reviewed_at))) / GREATEST(fs.stability, 0.1), -0.1542) < 0.70
           ) THEN 'at_risk'
           WHEN ucs.status = 'active' AND (
               fs.last_reviewed_at IS NOT NULL AND
               POWER(1.0 + 0.9803464944134797 * GREATEST(0, EXTRACT(DAY FROM (clock_timestamp() - fs.last_reviewed_at))) / GREATEST(fs.stability, 0.1), -0.1542) < 0.75
           ) THEN 'at_risk'
           ELSE ucs.status
       END AS effective_status
   FROM public.user_concept_states ucs
   LEFT JOIN public.review_items ri ON ri.user_id = ucs.user_id AND ri.concept_id = ucs.concept_id AND ri.lineage_type = 'primary'
   LEFT JOIN public.fsrs_states fs ON fs.review_item_id = ri.id;
   ```
