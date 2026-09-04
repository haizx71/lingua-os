-- TASK-006: deterministic FSRS-6 parameter lineage and auditable review persistence.

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE fsrs_parameter_sets
    ADD COLUMN algorithm_version text,
    ADD COLUMN library_version text,
    ADD COLUMN is_default boolean NOT NULL DEFAULT false;

UPDATE fsrs_parameter_sets
SET algorithm_version = 'legacy-unversioned',
    library_version = 'legacy-unversioned'
WHERE algorithm_version IS NULL OR library_version IS NULL;

ALTER TABLE fsrs_parameter_sets
    ALTER COLUMN algorithm_version SET NOT NULL,
    ALTER COLUMN library_version SET NOT NULL,
    ADD CONSTRAINT fsrs_parameter_sets_algorithm_version_check
        CHECK (btrim(algorithm_version) <> ''),
    ADD CONSTRAINT fsrs_parameter_sets_library_version_check
        CHECK (btrim(library_version) <> ''),
    ADD CONSTRAINT fsrs_parameter_sets_payload_check
        CHECK (
            parameters ?& ARRAY[
                'model_weights', 'desired_retention', 'learning_steps_seconds',
                'relearning_steps_seconds', 'maximum_interval_days', 'enable_fuzzing'
            ]
            AND jsonb_typeof(parameters -> 'model_weights') = 'array'
            AND jsonb_array_length(parameters -> 'model_weights') = 21
            AND jsonb_typeof(parameters -> 'learning_steps_seconds') = 'array'
            AND jsonb_typeof(parameters -> 'relearning_steps_seconds') = 'array'
            AND jsonb_typeof(parameters -> 'enable_fuzzing') = 'boolean'
        );

ALTER TABLE fsrs_parameter_sets
    ALTER COLUMN algorithm_version DROP DEFAULT,
    ALTER COLUMN library_version DROP DEFAULT;

CREATE UNIQUE INDEX uq_fsrs_parameter_sets_single_default
    ON fsrs_parameter_sets ((is_default))
    WHERE is_default;

INSERT INTO fsrs_parameter_sets (
    id, scope, language_code, version, algorithm_version, library_version,
    parameters, is_default
)
VALUES (
    '00000000-0000-4000-8600-000000000001',
    'global',
    NULL,
    'fsrs6-global-default-v1',
    'FSRS-6',
    '6.3.2',
    jsonb_build_object(
        'model_weights', jsonb_build_array(
            0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
            0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
            1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
        ),
        'desired_retention', 0.9,
        'learning_steps_seconds', jsonb_build_array(60, 600),
        'relearning_steps_seconds', jsonb_build_array(600),
        'maximum_interval_days', 36500,
        'enable_fuzzing', false
    ),
    true
);

CREATE FUNCTION enforce_fsrs_parameter_set_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'FSRS parameter-set history is immutable'
            USING ERRCODE = '23514';
    END IF;
    IF ROW(
        NEW.scope, NEW.language_code, NEW.version, NEW.algorithm_version,
        NEW.library_version, NEW.parameters, NEW.trained_at, NEW.created_at
    ) IS DISTINCT FROM ROW(
        OLD.scope, OLD.language_code, OLD.version, OLD.algorithm_version,
        OLD.library_version, OLD.parameters, OLD.trained_at, OLD.created_at
    ) THEN
        RAISE EXCEPTION 'FSRS parameter-set history is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER fsrs_parameter_sets_immutable_history
BEFORE UPDATE OR DELETE ON fsrs_parameter_sets
FOR EACH ROW EXECUTE FUNCTION enforce_fsrs_parameter_set_immutability();

ALTER TABLE fsrs_states
    ALTER COLUMN difficulty DROP NOT NULL,
    ALTER COLUMN stability DROP NOT NULL,
    ADD COLUMN step smallint CHECK (step >= 0),
    ADD CONSTRAINT fsrs_states_shape_check CHECK (
        (
            state = 'new'
            AND difficulty IS NULL
            AND stability IS NULL
            AND last_review_at IS NULL
            AND step IS NULL
        )
        OR
        (
            state IN ('learning', 'relearning')
            AND difficulty IS NOT NULL
            AND stability IS NOT NULL
            AND last_review_at IS NOT NULL
            AND step IS NOT NULL
        )
        OR
        (
            state = 'review'
            AND difficulty IS NOT NULL
            AND stability IS NOT NULL
            AND last_review_at IS NOT NULL
            AND step IS NULL
        )
    );

CREATE INDEX ix_fsrs_states_user_due_at
    ON fsrs_states (user_id, due_at, review_item_id);

ALTER TABLE review_events
    DROP CONSTRAINT review_events_exercise_mode_check;

ALTER TABLE review_events
    RENAME COLUMN exercise_mode TO evidence_mode;

ALTER TABLE review_events
    ADD COLUMN exercise_mode text,
    ADD COLUMN parameter_set_id uuid,
    ADD COLUMN params_version text,
    ADD COLUMN request_fingerprint text;

UPDATE review_events
SET exercise_mode = CASE evidence_mode
        WHEN 'recognition' THEN 'multiple_choice'
        WHEN 'listening' THEN 'listening'
        WHEN 'cloze' THEN 'cloze'
        WHEN 'production' THEN 'self_recall'
    END;

UPDATE review_events AS review_event
SET parameter_set_id = COALESCE(fsrs_state.parameter_set_id,
                                '00000000-0000-4000-8600-000000000001'::uuid),
    params_version = COALESCE(fsrs_state.params_version, 'fsrs6-global-default-v1'),
    request_fingerprint = repeat('0', 64)
FROM review_items AS review_item
LEFT JOIN fsrs_states AS fsrs_state
    ON fsrs_state.review_item_id = review_item.id
WHERE review_event.review_item_id = review_item.id;

ALTER TABLE review_events
    ALTER COLUMN correct DROP NOT NULL,
    ALTER COLUMN exercise_mode SET NOT NULL,
    ALTER COLUMN parameter_set_id SET NOT NULL,
    ALTER COLUMN params_version SET NOT NULL,
    ALTER COLUMN request_fingerprint SET NOT NULL,
    ADD CONSTRAINT review_events_exercise_mode_check CHECK (
        exercise_mode IN ('self_recall', 'multiple_choice', 'typing', 'cloze', 'listening')
    ),
    ADD CONSTRAINT review_events_evidence_mode_check CHECK (
        evidence_mode IN ('recognition', 'listening', 'cloze', 'production')
    ),
    ADD CONSTRAINT review_events_params_version_check CHECK (btrim(params_version) <> ''),
    ADD CONSTRAINT review_events_request_fingerprint_check CHECK (
        request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    ADD CONSTRAINT review_events_parameter_set_fkey
        FOREIGN KEY (parameter_set_id, params_version)
        REFERENCES fsrs_parameter_sets(id, version) ON DELETE RESTRICT;
