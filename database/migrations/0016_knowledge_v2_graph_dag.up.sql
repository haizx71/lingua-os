-- Migration 0016: Knowledge V2 Graph and Concurrency-Safe DAG Integrity
-- Creates the V2 concept_edges graph while retaining concept_relations as a V1
-- compatibility/source table. Only deterministic legacy relation mappings are backfilled.

CREATE TABLE IF NOT EXISTS public.concept_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_concept_id UUID NOT NULL
        REFERENCES public.concepts(id) ON DELETE CASCADE,
    target_concept_id UUID NOT NULL
        REFERENCES public.concepts(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL CHECK (relation_type IN (
        'prerequisite_of',
        'part_of',
        'synonym_of',
        'antonym_of',
        'collocates_with',
        'inflection_of',
        'derived_from',
        'confusable_with',
        'grammar_pattern_of',
        'hypernym_of',
        'hyponym_of'
    )),
    weight REAL NOT NULL DEFAULT 1.0
        CHECK (weight >= 0.0 AND weight <= 1.0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_concept_edges_directed
        UNIQUE (source_concept_id, target_concept_id, relation_type),
    CONSTRAINT chk_concept_edges_no_self_loop
        CHECK (source_concept_id <> target_concept_id)
);

CREATE INDEX IF NOT EXISTS ix_concept_edges_source
    ON public.concept_edges(source_concept_id, relation_type);

CREATE INDEX IF NOT EXISTS ix_concept_edges_target
    ON public.concept_edges(target_concept_id, relation_type);

CREATE INDEX IF NOT EXISTS ix_concept_edges_prereqs
    ON public.concept_edges(target_concept_id, source_concept_id)
    WHERE relation_type = 'prerequisite_of';

-- The V1 table is intentionally not renamed or dropped. Its relation vocabulary,
-- language/provenance columns, and RESTRICT delete behavior are part of the
-- accepted historical schema. V2 graph readers use concept_edges.
CREATE OR REPLACE FUNCTION public.fn_check_concept_edges_acyclic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cycle_detected BOOLEAN;
BEGIN
    IF NEW.relation_type IN (
        'prerequisite_of',
        'part_of',
        'hypernym_of',
        'derived_from'
    ) THEN
        IF TG_OP = 'UPDATE'
           AND OLD.source_concept_id = NEW.source_concept_id
           AND OLD.target_concept_id = NEW.target_concept_id
           AND OLD.relation_type = NEW.relation_type THEN
            RETURN NEW;
        END IF;

        PERFORM pg_advisory_xact_lock(hashtext('lingua_concept_dag_mutation_lock'));

        WITH RECURSIVE path AS (
            SELECT edge.target_concept_id
            FROM public.concept_edges AS edge
            WHERE edge.source_concept_id = NEW.target_concept_id
              AND edge.relation_type = NEW.relation_type
              AND (TG_OP <> 'UPDATE' OR edge.id <> NEW.id)

            UNION

            SELECT edge.target_concept_id
            FROM public.concept_edges AS edge
            JOIN path
              ON edge.source_concept_id = path.target_concept_id
            WHERE edge.relation_type = NEW.relation_type
              AND (TG_OP <> 'UPDATE' OR edge.id <> NEW.id)
        )
        SELECT EXISTS (
            SELECT 1
            FROM path
            WHERE target_concept_id = NEW.source_concept_id
        )
        INTO v_cycle_detected;

        IF v_cycle_detected THEN
            RAISE EXCEPTION
                'Cyclic dependency detected: % -> % violates DAG constraint for %',
                NEW.source_concept_id,
                NEW.target_concept_id,
                NEW.relation_type
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concept_edges_acyclic ON public.concept_edges;

CREATE TRIGGER trg_concept_edges_acyclic
BEFORE INSERT OR UPDATE ON public.concept_edges
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_concept_edges_acyclic();

-- Migration 0013 revoked default function execution for future functions. Keep
-- the object explicitly closed to browser roles and executable by the backend
-- service role used by the server-side catalog path.
REVOKE ALL PRIVILEGES ON TABLE public.concept_edges FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.fn_check_concept_edges_acyclic() FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.fn_check_concept_edges_acyclic()
    FROM anon, authenticated, authenticator;
GRANT EXECUTE ON FUNCTION public.fn_check_concept_edges_acyclic() TO service_role;

-- Backfill only legacy relation types with a one-to-one V2 meaning. The
-- source_record_id and language_code are retained in metadata so the V1
-- provenance is not discarded. Legacy family/related rows remain in the V1
-- table because no V2 relation type is specified for them.
INSERT INTO public.concept_edges (
    source_concept_id,
    target_concept_id,
    relation_type,
    weight,
    metadata
)
SELECT
    legacy.source_concept_id,
    legacy.target_concept_id,
    CASE legacy.relation_type
        WHEN 'prerequisite' THEN 'prerequisite_of'
        WHEN 'synonym' THEN 'synonym_of'
        WHEN 'antonym' THEN 'antonym_of'
    END,
    COALESCE(legacy.weight::real, 1.0),
    jsonb_build_object(
        'legacy_table', 'concept_relations',
        'legacy_relation_type', legacy.relation_type,
        'language_code', legacy.language_code,
        'source_record_id', legacy.source_record_id::text
    )
FROM public.concept_relations AS legacy
WHERE legacy.relation_type IN ('prerequisite', 'synonym', 'antonym')
ON CONFLICT (source_concept_id, target_concept_id, relation_type) DO NOTHING;
