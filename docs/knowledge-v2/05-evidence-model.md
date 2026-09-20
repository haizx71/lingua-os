# LINGUA OS Knowledge System V2 — Evidence Model Specification

**Status**: Approved Master Specification
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/competence/`, `database/migrations/`, `contracts/`

---

## 1. Executive Summary & Purpose

The Evidence Model defines the immutable, append-only telemetry stream capturing all learner interactions across LINGUA OS. Evidence is the bridge between raw user behavior and updated cognitive states (competence distributions and FSRS memory parameters).

### Core Architectural Axiom
> **Events are Immutable Facts.**
> Once recorded in `learning_events` or `exposure_events`, an event is never updated or deleted. Downstream projections (competence scores, skill levels, review queues) are deterministic mathematical folds over this event stream.

---

## 2. The 9 Learning Interaction Surfaces

Every interaction in LINGUA OS occurs within one of nine distinct learning surfaces:

```
+---------------------------------------------------------------------------------------+
|                              THE 9 LEARNING SURFACES                                  |
+---------------------------------------------------------------------------------------+
| 1. REVIEW             - Spaced repetition recall, cloze tests, audio discrimination   |
| 2. READER             - Comprehensible text reading, audio listening, word lookups    |
| 3. ASSESSMENT         - Standardized diagnostic placement and milestone verification  |
| 4. LIBRARY            - Deliberate concept saving, sentence bookmarking, mining       |
| 5. DICTIONARY         - Search lookups, phonetic examination, sense exploration       |
| 6. BRAIN              - Conceptual mastery visualization and self-directed navigation |
| 7. TODAY              - Execution of scheduled daily learning and reinforcement plans  |
| 8. WRITING/PRODUCTION - Active orthographic / grammatical composition exercises       |
| 9. LISTENING          - Pure acoustic decoding, phoneme discrimination, dictation     |
+---------------------------------------------------------------------------------------+
```

---

## 3. The Critical Invariant: Active Learning vs. Passive Exposure

```
+-----------------------------------------------------------------------------------+
| USER INTERACTION EVENT                                                            |
+-----------------------------------------------------------------------------------+
        |
        +---> PASSIVE EXPOSURE (Encountering word in Reader, looking up in Dict)
        |     - Emits: `exposure_events`
        |     - Updates: Exposure count, familiarity bias
        |     - GUARANTEE: Does NOT activate FSRS tracking (`review_items`)
        |     - GUARANTEE: Does NOT pollute review queue
        |
        +---> ACTIVE LEARNING (Submitting review rating, answering quiz, saving concept)
              - Emits: `learning_events`
              - Updates: Bayesian Competence (Beta distribution)
              - If Review: Triggers FSRS stability & due_at transition
              - If Save Intent: Creates single primary `review_items` lineage
```

---

## 4. Rigorous Schema Specifications

### 4.1 Active Cognitive Response Ledger: `learning_events`
```sql
CREATE TABLE public.learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    surface TEXT NOT NULL CHECK (surface IN (
        'review', 'reader', 'assessment', 'library',
        'dictionary', 'brain', 'today', 'writing', 'listening'
    )),
    modality TEXT NOT NULL CHECK (modality IN ('recognition', 'listening', 'production')),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'fsrs_review', 'cloze_response', 'dictation_response',
        'multiple_choice', 'free_production', 'diagnostic_item'
    )),
    score REAL NOT NULL CHECK (score >= 0.0 AND score <= 1.0),
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0.1 AND weight <= 5.0),
    response_time_ms INTEGER CHECK (response_time_ms >= 0),
    hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    context_sentence_id UUID REFERENCES public.sentences(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Compound index for fast timeline replay and projector execution
CREATE INDEX ix_learning_events_user_concept ON public.learning_events(user_id, concept_id, created_at ASC);
CREATE INDEX ix_learning_events_user_surface ON public.learning_events(user_id, surface, created_at DESC);
```

### 4.2 Passive Encounter Ledger: `exposure_events`
```sql
CREATE TABLE public.exposure_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    surface TEXT NOT NULL CHECK (surface IN ('reader', 'dictionary', 'brain', 'library')),
    context_sentence_id UUID REFERENCES public.sentences(id) ON DELETE SET NULL,
    context_content_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    duration_ms INTEGER CHECK (duration_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_exposure_events_user_concept ON public.exposure_events(user_id, concept_id);
```

---

## 5. Multi-Dimensional Telemetry Ingestion Pipeline

### 5.1 Event Normalization Contract
All frontend surfaces submit learning evidence via the unified endpoint:
`POST /v1/evidence/events`

Payload Contract:
```json
{
  "concept_id": "7a3e9c12-8812-4f10-9b41-e123456789ab",
  "surface": "review",
  "modality": "production",
  "event_type": "cloze_response",
  "score": 1.0,
  "response_time_ms": 2340,
  "hints_used": 0,
  "context_sentence_id": "3b2e1f44-7711-4b10-8a32-d11122233344",
  "payload": {
    "prompt_type": "sentence_cloze",
    "user_input": "completed",
    "expected": "completed"
  }
}
```

### 5.2 Server-Side Synchronous Projection Pipeline
When `POST /v1/evidence/events` is processed in FastAPI:
1. **Transaction Begin**.
2. **Append Event**: Insert into `learning_events`.
3. **Update Competence Projection (`user_concept_states`)**:
   - Query current $(\alpha, \beta)$ for the specific modality.
   - Apply update: $\alpha \leftarrow \alpha + w \cdot s$, $\beta \leftarrow \beta + w \cdot (1 - s)$.
   - Recalculate composite competence $C$.
   - Evaluate status transitions (e.g. `learning` $\to$ `active`).
4. **Update Aggregate Skill States (`user_skill_states`)**:
   - Increment aggregate practice counters and CEFR domain levels.
5. **Transaction Commit**.

### 5.3 Idempotency & Replay Guarantee
Every event submission accepts an optional `Idempotency-Key` header. If a client retries an event with the same key, the server returns the cached response without double-updating competence parameters.
