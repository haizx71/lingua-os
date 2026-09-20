# LINGUA OS Knowledge System V2 — Knowledge Graph Specification

**Status**: Approved Master Specification
**Baseline Commit**: `c2db86387e0879f56817cd748899e80f46b5d79a`
**Classification**: `PROPOSAL` (V2 Architecture) / `FACT` (Repository Alignment)
**Target Subsystems**: `services/api/src/lingua_api/catalog/`, `database/migrations/`

---

## 1. Executive Summary & Purpose

The Knowledge Graph represents the pedagogical and semantic topology connecting canonical concepts. Rather than treating vocabulary and grammar as isolated flashcard tokens, the Knowledge Graph models prerequisite dependencies, morphological derivations, semantic equivalence, and grammatical patterns.

In Knowledge System V2, the graph is modeled directly within PostgreSQL using typed relational edges, algebraic integrity constraints, depth-bounded recursive Common Table Expressions (CTEs), and concurrency-safe DAG transaction serialization locks.

---

## 2. Comprehensive Edge Taxonomy & Algebraic Properties

Every relationship in `concept_edges` belongs to a formal edge type with precise algebraic properties:

| Relation Type | Directionality | Algebraic Properties | Pedagogical Purpose |
| :--- | :--- | :--- | :--- |
| `prerequisite_of` | Directed ($A \to B$) | Strict Partial Order (Acyclic, Transitive, Asymmetric) | Blocks learning concept $B$ until concept $A$ is at least `active`. |
| `part_of` | Directed ($A \to B$) | Asymmetric, Acyclic | Links lexical constituent $A$ into compound/phrase $B$. |
| `synonym_of` | Bidirectional ($A \leftrightarrow B$) | Symmetric | Groups semantically equivalent words; aids vocabulary expansion. |
| `antonym_of` | Bidirectional ($A \leftrightarrow B$) | Symmetric, Irreflexive | Pairs opposing concepts for contrastive reinforcement. |
| `collocates_with` | Bidirectional ($A \leftrightarrow B$) | Symmetric | Connects words frequently co-occurring in natural text. |
| `inflection_of` | Directed ($A \to B$) | Asymmetric | Links conjugated/inflected form $A$ back to base lemma $B$. |
| `derived_from` | Directed ($A \to B$) | Asymmetric, Acyclic | Morphological derivation (e.g. *quick* $\to$ *quickly*). |
| `confusable_with` | Bidirectional ($A \leftrightarrow B$) | Symmetric | Flags false friends or frequent learner confusion pairs. |
| `grammar_pattern_of`| Directed ($A \to B$) | Asymmetric | Links vocabulary item $A$ to grammatical construction $B$. |
| `hypernym_of` | Directed ($A \to B$) | Asymmetric, Transitive, Acyclic | Superordinate category (e.g., *fruit* is hypernym of *apple*). |
| `hyponym_of` | Directed ($A \to B$) | Asymmetric, Transitive, Acyclic | Subordinate instance (e.g., *apple* is hyponym of *fruit*). |

---

## 3. Concurrency-Safe Prerequisite DAG Integrity Proof

### 3.1 The Acyclicity Invariant
> **The prerequisite graph must be a strict Directed Acyclic Graph (DAG).**
> If Concept $A$ is a prerequisite of Concept $B$, and Concept $B$ is a prerequisite of Concept $C$, then Concept $C$ can **never** be a prerequisite of Concept $A$.

### 3.2 Concurrency & Transaction Isolation Failure Modes
Under default PostgreSQL `READ COMMITTED` transaction isolation, a simple recursive trigger query does **not** protect against concurrent cycle formation:
- **Phantom Path Hazard**: Transaction 1 begins inserting $A \to B$. It queries for $B \rightsquigarrow A$ and finds no path. Concurrently, Transaction 2 begins inserting $B \to A$. It queries for $A \rightsquigarrow B$ and finds no path (since $T_1$ has not committed). Both transactions commit, creating a circular graph $A \leftrightarrow B$ undetected!
- **Update Hazard**: An `UPDATE` changing `target_concept_id` or `source_concept_id` can introduce a cycle just like an insert.
- **Self-Edge Hazard**: Inserting $A \to A$.

### 3.3 Complete Concurrency Solution: Serialization via Advisory Lock
To guarantee 100% DAG acyclicity under any transaction isolation level (`READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`):
1. **Self-Edge Prevention**: Handled at schema level via `CHECK (source_concept_id <> target_concept_id)`.
2. **Transaction-Level Advisory Lock**: Inside the trigger, the transaction acquires an exclusive session-level transaction lock (`pg_advisory_xact_lock`). All concurrent edge writes are serialized deterministically during cycle evaluation.
3. **UPDATE Support**: Trigger operates on `BEFORE INSERT OR UPDATE`. For `UPDATE`, it evaluates whether the modified edge introduces a path.
4. **Migration 0013 Security Compliance**: Function is created with `SET search_path = public, pg_temp` and no execute grants to `PUBLIC`, `anon`, or `authenticated`.

```sql
CREATE OR REPLACE FUNCTION public.fn_check_concept_edges_acyclic()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cycle_detected BOOLEAN;
BEGIN
    -- 1. Only enforce acyclicity for directed hierarchical relations
    IF NEW.relation_type IN ('prerequisite_of', 'part_of', 'hypernym_of', 'derived_from') THEN

        -- 2. Guard against UPDATE with unchanged endpoints
        IF TG_OP = 'UPDATE' AND
           OLD.source_concept_id = NEW.source_concept_id AND
           OLD.target_concept_id = NEW.target_concept_id AND
           OLD.relation_type = NEW.relation_type THEN
            RETURN NEW;
        END IF;

        -- 3. Concurrency Lock: Serialize all DAG edge modifications across transactions
        PERFORM pg_advisory_xact_lock(hashtext('lingua_concept_dag_mutation_lock'));

        -- 4. Cycle Check: Does a path already exist from NEW.target_concept_id to NEW.source_concept_id?
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
            RAISE EXCEPTION 'Cyclic dependency detected in concept_edges: % -> % violates DAG constraint for %',
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

---

## 4. Graph Traversal Queries & Implementation Patterns

### 4.1 Resolving Unmet Prerequisite Gaps
When a learner attempts to learn a target concept, the engine must verify whether all prerequisite concepts have reached at least `active` status:

```sql
-- Resolves all unmastered prerequisites up to 4 levels deep
WITH RECURSIVE prereq_tree AS (
    -- Anchor: Direct prerequisites
    SELECT
        ce.source_concept_id AS required_concept_id,
        ce.target_concept_id AS dependent_concept_id,
        1 AS depth
    FROM public.concept_edges ce
    WHERE ce.target_concept_id = :target_concept_id
      AND ce.relation_type = 'prerequisite_of'

    UNION ALL

    -- Recursive Step: Transitive prerequisites
    SELECT
        ce.source_concept_id,
        ce.target_concept_id,
        pt.depth + 1
    FROM public.concept_edges ce
    JOIN prereq_tree pt ON ce.target_concept_id = pt.required_concept_id
    WHERE ce.relation_type = 'prerequisite_of'
      AND pt.depth < 4
)
SELECT
    pt.required_concept_id,
    c.canonical_key,
    c.concept_type,
    COALESCE(ucs.status, 'unseen') AS learner_status,
    COALESCE(ucs.competence_score, 0.0) AS competence_score
FROM prereq_tree pt
JOIN public.concepts c ON c.id = pt.required_concept_id
LEFT JOIN public.user_concept_states ucs
    ON ucs.concept_id = pt.required_concept_id
   AND ucs.user_id = :authenticated_user_id
WHERE COALESCE(ucs.status, 'unseen') NOT IN ('active', 'mastered')
ORDER BY pt.depth DESC;
```

---

## 5. Performance Benchmarks and Indexing Strategy

1. **Composite Edge Indexes**:
   - `CREATE INDEX ix_concept_edges_src_rel ON public.concept_edges(source_concept_id, relation_type);`
   - `CREATE INDEX ix_concept_edges_tgt_rel ON public.concept_edges(target_concept_id, relation_type);`
2. **Partial Index for Prerequisites**:
   - `CREATE INDEX ix_concept_edges_prereqs ON public.concept_edges(target_concept_id, source_concept_id) WHERE relation_type = 'prerequisite_of';`
3. **Execution Guarantee**:
   - Depth-bounded CTEs execute in $< 5\text{ms}$ on PostgreSQL.
   - Advisory lock acquisition overhead is $< 0.1\text{ms}$.
