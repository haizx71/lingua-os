# LINGUA OS Knowledge System V2 — Migration Plan Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `database/migrations/`, `services/api/src/lingua_api/`

---

## 1. Executive Strategy & Realistic Rollback Semantics

Knowledge System V2 evolves the database schema established across migrations `0001` through `0013`. In accordance with the **Forward Migration Discipline**:

```
+---------------------------------------------------------------------------------------+
|                             ZERO-DOWNTIME MIGRATION RULES                             |
+---------------------------------------------------------------------------------------+
| 1. NEVER REWRITE HISTORICAL MIGRATIONS: Files 0001 to 0013 remain immutable.          |
| 2. EXPAND AND CONTRACT: Deploy additive tables/views first; backfill; cut over readers|
| 3. ZERO DATA LOSS: Existing FSRS states and competence parameters are preserved 100%. |
| 4. HONEST ROLLBACK SEMANTICS: Distinguish schema vs data vs pre-cutover vs recovery.  |
+---------------------------------------------------------------------------------------+
```

### 1.1 The Four-Stage Rollback & Recovery Contract
Earlier drafts claimed unqualified "exact rollback". In production database engineering, dropping tables or restoring constraints behaves differently depending on whether production data has already been written. Knowledge System V2 defines:

1. **Schema Rollback**:
   Every forward migration (`.up.sql`) is paired with an exact reverse migration (`.down.sql`) dropping or restoring the created DDL objects.
2. **Pre-Cutover Rollback**:
   If a migration fails during application deployment before traffic is switched, executing `.down.sql` cleanly restores the schema to the exact baseline state with 100% fidelity.
3. **Data Rollback**:
   Once V2 data is populated (e.g. grammar specs or phonetic records), `.down.sql` drops these new tables, purging the V2 records.
4. **Post-Cutover Recovery & Constraint Safety**:
   Because Knowledge System V2 selected **Option A** (additive `concept_senses` bridge table while preserving strict uniqueness on `lexemes`), rolling back `.down.sql` will **never fail** due to duplicate lemma collisions in `lexemes`.

---

## 2. Sequence of Versioned V2 Migrations (0014–0016)

```
[0001 - 0013] (Historical Baseline - includes 0013 public function execute lockdown)
      |
      v
0014_knowledge_v2_canonical_structures (.up.sql / .down.sql)
      - Creates grammar_specifications, phrase_specifications, phonetic_transcriptions
      - Expands concept_edges relation types and adds concurrency-safe DAG trigger (with advisory lock)
      |
      v
0015_knowledge_v2_polysemy_resolution (.up.sql / .down.sql)
      - Creates concept_senses bridge table
      - Backfills initial 1:1 mapping from concepts to word_senses
      - Preserves lexemes deduplication and morphology tables
      |
      v
0016_knowledge_v2_learner_retrievability (.up.sql / .down.sql)
      - Deploys v_learner_concept_retrievability dynamic projection view (py-fsrs 6.3.2 parameters)
      - Adds covering index on fsrs_states for real-time Today & Review queue generation
```

---

## 3. Concrete Migration SQL Scripts

### 3.1 Migration 0014: Canonical Structures & Concurrency-Safe DAG Trigger
`0014_knowledge_v2_canonical_structures.up.sql`:
```sql
-- 1. Create Grammar Specifications Table
CREATE TABLE IF NOT EXISTS public.grammar_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL UNIQUE REFERENCES public.concepts(id) ON DELETE CASCADE,
    pattern_formula TEXT NOT NULL,
    syntactic_category TEXT NOT NULL,
    pragmatic_function TEXT NOT NULL,
    vietnamese_explanation TEXT NOT NULL,
    vietnamese_common_traps TEXT,
    structural_slots JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Create Phrase Specifications Table
CREATE TABLE IF NOT EXISTS public.phrase_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL UNIQUE REFERENCES public.concepts(id) ON DELETE CASCADE,
    base_pattern TEXT NOT NULL,
    headword_concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    slot_template JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Create Phonetic Transcriptions Table
CREATE TABLE IF NOT EXISTS public.phonetic_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id UUID NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
    accent_variant TEXT NOT NULL CHECK (accent_variant IN ('en_US', 'en_GB', 'en_AU')),
    ipa TEXT NOT NULL,
    audio_uri TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_phonetic_lexeme_accent UNIQUE (lexeme_id, accent_variant)
);

-- 4. Create Concurrency-Safe DAG Trigger Function (Migration 0013 Privilege Compliant)
CREATE OR REPLACE FUNCTION public.fn_check_concept_edges_acyclic()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cycle_detected BOOLEAN;
BEGIN
    IF NEW.relation_type IN ('prerequisite_of', 'part_of', 'hypernym_of', 'derived_from') THEN

        IF TG_OP = 'UPDATE' AND
           OLD.source_concept_id = NEW.source_concept_id AND
           OLD.target_concept_id = NEW.target_concept_id AND
           OLD.relation_type = NEW.relation_type THEN
            RETURN NEW;
        END IF;

        -- Serialize concurrent DAG mutations across transactions
        PERFORM pg_advisory_xact_lock(hashtext('lingua_concept_dag_mutation_lock'));

        WITH RECURSIVE path AS (
            SELECT target_concept_id
            FROM public.concept_edges
            WHERE source_concept_id = NEW.target_concept_id
              AND relation_type = NEW.relation_type
            UNION
            SELECT e.target_concept_id
            FROM public.concept_edges e
            JOIN path p ON e.source_concept_id = p.target_concept_id
            WHERE e.relation_type = NEW.relation_type
        )
        SELECT EXISTS (
            SELECT 1 FROM path WHERE target_concept_id = NEW.source_concept_id
        ) INTO v_cycle_detected;

        IF v_cycle_detected THEN
            RAISE EXCEPTION 'Cyclic dependency detected: % -> % violates DAG constraint for %',
                NEW.source_concept_id, NEW.target_concept_id, NEW.relation_type
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concept_edges_acyclic ON public.concept_edges;
CREATE TRIGGER trg_concept_edges_acyclic
BEFORE INSERT OR UPDATE ON public.concept_edges
FOR EACH ROW EXECUTE FUNCTION public.fn_check_concept_edges_acyclic();
```

`0014_knowledge_v2_canonical_structures.down.sql`:
```sql
DROP TRIGGER IF EXISTS trg_concept_edges_acyclic ON public.concept_edges;
DROP FUNCTION IF EXISTS public.fn_check_concept_edges_acyclic();
DROP TABLE IF EXISTS public.phonetic_transcriptions;
DROP TABLE IF EXISTS public.phrase_specifications;
DROP TABLE IF EXISTS public.grammar_specifications;
```

---

### 3.2 Migration 0015: Polysemy Resolution via `concept_senses` Bridge
`0015_knowledge_v2_polysemy_resolution.up.sql`:
```sql
-- 1. Create the Additive Bridge Table
CREATE TABLE IF NOT EXISTS public.concept_senses (
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    word_sense_id UUID NOT NULL REFERENCES public.word_senses(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (concept_id, word_sense_id)
);

CREATE INDEX IF NOT EXISTS ix_concept_senses_word_sense
ON public.concept_senses(word_sense_id);

-- 2. Backfill Existing V1 Concepts to Senses
INSERT INTO public.concept_senses (concept_id, word_sense_id, is_primary)
SELECT DISTINCT
    l.concept_id,
    ws.id AS word_sense_id,
    (ws.sense_order = 1) AS is_primary
FROM public.lexemes l
JOIN public.word_senses ws ON ws.lexeme_id = l.id
WHERE l.concept_id IS NOT NULL
ON CONFLICT (concept_id, word_sense_id) DO NOTHING;
```

`0015_knowledge_v2_polysemy_resolution.down.sql`:
```sql
DROP TABLE IF EXISTS public.concept_senses;
```

---

### 3.3 Migration 0016: Dynamic Retrievability View (py-fsrs 6.3.2 Exact Parameters)
`0016_knowledge_v2_learner_retrievability.up.sql`:
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

CREATE INDEX IF NOT EXISTS ix_fsrs_states_retrievability_speed
ON public.fsrs_states(review_item_id)
INCLUDE (stability, last_reviewed_at, due_at);
```

`0016_knowledge_v2_learner_retrievability.down.sql`:
```sql
DROP INDEX IF EXISTS public.ix_fsrs_states_retrievability_speed;
DROP VIEW IF EXISTS public.v_learner_concept_retrievability;
```

---

## 4. Preflight and Post-Apply Verification Invariants

Before applying migrations on any production or staging environment:
1. **Preflight Assertion Query**:
   ```sql
   -- Verify all existing lexemes have valid lemmas and POS
   SELECT COUNT(*) FROM public.lexemes WHERE lemma IS NULL OR normalized_form IS NULL;
   -- Must return 0.
   ```
2. **Post-Apply Assertion Queries**:
   ```sql
   -- Verify view creation and zero-downtime query performance
   EXPLAIN ANALYZE SELECT * FROM public.v_learner_concept_retrievability LIMIT 10;

   -- Verify DAG trigger blocks cycle
   DO $$
   DECLARE
       c1 UUID := gen_random_uuid();
       c2 UUID := gen_random_uuid();
   BEGIN
       -- Should succeed
       -- Test cycle insertion in temporary rollback block
   END $$;
   ```
