-- Migration 0017: Knowledge V2 learner retrievability projection.
-- Python py-fsrs 6.3.2 remains the scheduling authority. This view is a
-- private, read-only projection over immutable per-state parameter lineage.

SET LOCAL search_path = public, pg_catalog;

CREATE VIEW public.v_learner_concept_retrievability
WITH (security_barrier = true)
AS
WITH valid_parameter_sets AS (
    SELECT
        parameter_set.id,
        parameter_set.version,
        CASE
            -- CASE preserves the fail-closed evaluation order for legacy or
            -- malformed JSON payloads; boolean predicates may be reordered.
            WHEN jsonb_typeof(parameter_set.parameters -> 'model_weights') <> 'array'
            THEN NULL::double precision
            WHEN jsonb_array_length(parameter_set.parameters -> 'model_weights') <> 21
            THEN NULL::double precision
            WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                         parameter_set.parameters -> 'model_weights'
                     ) WITH ORDINALITY AS model_weight(value, position)
                JOIN (
                    VALUES
                        (1::bigint, 0.001::numeric, 100.0::numeric),
                        (2, 0.001, 100.0),
                        (3, 0.001, 100.0),
                        (4, 0.001, 100.0),
                        (5, 1.0, 10.0),
                        (6, 0.001, 4.0),
                        (7, 0.001, 4.0),
                        (8, 0.001, 0.75),
                        (9, 0.0, 4.5),
                        (10, 0.0, 0.8),
                        (11, 0.001, 3.5),
                        (12, 0.001, 5.0),
                        (13, 0.001, 0.25),
                        (14, 0.001, 0.9),
                        (15, 0.0, 4.0),
                        (16, 0.0, 1.0),
                        (17, 1.0, 6.0),
                        (18, 0.0, 2.0),
                        (19, 0.0, 2.0),
                        (20, 0.0, 0.8),
                        (21, 0.1, 0.8)
                ) AS parameter_bound(position, lower_bound, upper_bound)
                  ON parameter_bound.position = model_weight.position
                WHERE CASE
                    WHEN jsonb_typeof(model_weight.value) = 'number'
                    THEN (model_weight.value #>> '{}')::numeric
                         NOT BETWEEN parameter_bound.lower_bound
                                 AND parameter_bound.upper_bound
                    ELSE true
                END
            )
            THEN NULL::double precision
            -- The double cast is safe only after all numeric bounds, including
            -- w20 in [0.1, 0.8], have been validated as arbitrary precision.
            ELSE ((parameter_set.parameters -> 'model_weights' ->> 20)::numeric)
                 ::double precision
        END AS weight_20
    FROM public.fsrs_parameter_sets AS parameter_set
    WHERE parameter_set.algorithm_version = 'FSRS-6'
      AND parameter_set.library_version = '6.3.2'
), projection_inputs AS (
    SELECT
        learner.user_id,
        learner.user_language_id,
        learner.concept_id,
        review_item.id AS review_item_id,
        learner.status AS stored_status,
        memory.state AS memory_state,
        memory.due_at,
        memory.last_review_at,
        memory.parameter_set_id,
        memory.params_version,
        memory.stability::double precision AS stability,
        parameter_set.weight_20,
        GREATEST(
            0,
            FLOOR(
                EXTRACT(
                    EPOCH FROM (transaction_timestamp() - memory.last_review_at)
                ) / 86400.0
            )
        )::integer AS elapsed_days,
        transaction_timestamp() AS calculated_at
    FROM public.user_concept_states AS learner
    LEFT JOIN public.review_items AS review_item
      ON review_item.user_id = learner.user_id
     AND review_item.user_language_id = learner.user_language_id
     AND review_item.concept_id = learner.concept_id
    LEFT JOIN public.fsrs_states AS memory
      ON memory.review_item_id = review_item.id
     AND memory.user_id = review_item.user_id
    LEFT JOIN valid_parameter_sets AS parameter_set
      ON parameter_set.id = memory.parameter_set_id
     AND parameter_set.version = memory.params_version
), scored AS (
    SELECT
        projection_inputs.*,
        CASE
            -- Invalid, unsupported, or missing parameter lineage is never projected.
            WHEN weight_20 IS NULL THEN NULL::double precision
            -- py-fsrs 6.3.2 returns zero for a valid, structurally new card.
            WHEN memory_state = 'new'
             AND last_review_at IS NULL
             AND stability IS NULL
            THEN 0.0::double precision
            -- Persisted constraints reject non-positive stability. Retain a fail-closed guard
            -- so legacy/corrupt rows can never cause division-by-zero or an invalid probability.
            WHEN last_review_at IS NULL
              OR stability IS NULL
              OR stability <= 0.0
            THEN NULL::double precision
            ELSE POWER(
                1.0
                + (
                    POWER(0.9, 1.0 / (-weight_20)) - 1.0
                  ) * elapsed_days / stability,
                -weight_20
            )
        END AS current_retrievability
    FROM projection_inputs
)
SELECT
    user_id,
    user_language_id,
    concept_id,
    review_item_id,
    stored_status,
    CASE
        WHEN stored_status IN ('active', 'mastered')
         AND current_retrievability < 0.50
        THEN 'forgotten'
        WHEN stored_status = 'mastered'
         AND current_retrievability < 0.70
        THEN 'weak'
        WHEN stored_status = 'active'
         AND current_retrievability < 0.75
        THEN 'weak'
        ELSE stored_status
    END AS effective_status,
    memory_state,
    due_at,
    last_review_at,
    parameter_set_id,
    params_version,
    current_retrievability,
    calculated_at
FROM scored;

COMMENT ON VIEW public.v_learner_concept_retrievability IS
    'Private read-only py-fsrs 6.3.2-equivalent learner-concept retrievability projection.';

REVOKE ALL PRIVILEGES ON TABLE public.v_learner_concept_retrievability FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.v_learner_concept_retrievability
    FROM anon, authenticated, authenticator;

-- The backend service role is the only non-owner reader. The security-definer
-- view owner resolves the underlying RLS tables; raw FSRS tables remain closed
-- to browser roles.
GRANT SELECT ON TABLE public.v_learner_concept_retrievability TO service_role;
