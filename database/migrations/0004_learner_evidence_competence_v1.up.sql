-- TASK-006D: replayable learner evidence and competence-beta-v1 projections.

SET LOCAL search_path = public, pg_catalog;

CREATE TABLE competence_parameter_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text NOT NULL CHECK (btrim(version) <> ''),
    method_version text NOT NULL CHECK (btrim(method_version) <> ''),
    parameters jsonb NOT NULL CHECK (
        jsonb_typeof(parameters) = 'object'
        AND parameters ?& ARRAY[
            'prior_alpha', 'prior_beta', 'objective_evidence_weight',
            'self_reported_evidence_weight', 'confidence_half_saturation_mass',
            'min_mastery_effective_mass_per_dimension', 'rating_outcomes', 'mastery_policies',
            'status_thresholds'
        ]
    ),
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, version)
);

CREATE UNIQUE INDEX uq_competence_parameter_sets_single_default
    ON competence_parameter_sets ((is_default))
    WHERE is_default;

INSERT INTO competence_parameter_sets (id, version, method_version, parameters, is_default)
VALUES (
    '00000000-0000-4000-8600-000000000002',
    'competence-beta-v1',
    'competence-beta-v1',
    jsonb_build_object(
        'prior_alpha', 2,
        'prior_beta', 2,
        'objective_evidence_weight', 1,
        'self_reported_evidence_weight', 0.5,
        'confidence_half_saturation_mass', 4,
        'min_mastery_effective_mass_per_dimension', 2,
        'rating_outcomes', jsonb_build_object(
            'again', 0, 'hard', (1.0 / 3.0), 'good', (2.0 / 3.0), 'easy', 1
        ),
        'mastery_policies', jsonb_build_object(
            'word', jsonb_build_object('recognition', 0.4, 'listening', 0.3, 'production', 0.3),
            'phrase', jsonb_build_object('recognition', 0.4, 'listening', 0.3, 'production', 0.3),
            'grammar', jsonb_build_object('recognition', 0.5, 'listening', 0, 'production', 0.5)
        ),
        'status_thresholds', jsonb_build_object(
            'familiar_mastery_min', 0.60,
            'familiar_confidence_min', 0.40,
            'active_mastery_min', 0.75,
            'active_confidence_min', 0.60,
            'mastered_mastery_min', 0.85,
            'mastered_confidence_min', 0.75,
            'weak_outcome_max', 0.50,
            'weak_consecutive_count', 2,
            'forgotten_outcome', 0,
            'forgotten_consecutive_count', 3,
            'forgotten_mastery_max', 0.50,
            'forgotten_confidence_min', 0.50
        )
    ),
    true
);

CREATE FUNCTION enforce_competence_parameter_set_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Competence parameter-set history is immutable'
            USING ERRCODE = '23514';
    END IF;
    IF ROW(NEW.version, NEW.method_version, NEW.parameters, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.version, OLD.method_version, OLD.parameters, OLD.created_at) THEN
        RAISE EXCEPTION 'Competence parameter-set history is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER competence_parameter_sets_immutable_history
BEFORE UPDATE OR DELETE ON competence_parameter_sets
FOR EACH ROW EXECUTE FUNCTION enforce_competence_parameter_set_immutability();

CREATE TABLE concept_competence_policies (
    concept_id uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    parameter_set_id uuid NOT NULL,
    parameter_version text NOT NULL,
    recognition_weight numeric(5,4) NOT NULL CHECK (recognition_weight BETWEEN 0 AND 1),
    listening_weight numeric(5,4) NOT NULL CHECK (listening_weight BETWEEN 0 AND 1),
    production_weight numeric(5,4) NOT NULL CHECK (production_weight BETWEEN 0 AND 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (concept_id, parameter_set_id, parameter_version),
    FOREIGN KEY (parameter_set_id, parameter_version)
        REFERENCES competence_parameter_sets(id, version) ON DELETE RESTRICT,
    CHECK (recognition_weight + listening_weight + production_weight = 1)
);

CREATE FUNCTION enforce_concept_competence_policy_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'Concept competence policy history is immutable'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER concept_competence_policies_immutable_history
BEFORE UPDATE OR DELETE ON concept_competence_policies
FOR EACH ROW EXECUTE FUNCTION enforce_concept_competence_policy_immutability();

CREATE TABLE user_language_projection_heads (
    user_language_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    next_ingestion_sequence bigint NOT NULL DEFAULT 1 CHECK (next_ingestion_sequence >= 1),
    projection_method_version text NOT NULL DEFAULT 'competence-beta-v1'
        CHECK (btrim(projection_method_version) <> ''),
    parameter_set_id uuid NOT NULL,
    parameter_version text NOT NULL,
    state_version integer NOT NULL DEFAULT 1 CHECK (state_version >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, user_language_id),
    FOREIGN KEY (user_id, user_language_id)
        REFERENCES user_languages(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_set_id, parameter_version)
        REFERENCES competence_parameter_sets(id, version) ON DELETE RESTRICT
);

ALTER TABLE user_concept_states
    ALTER COLUMN recognition TYPE numeric(10,8),
    ALTER COLUMN listening TYPE numeric(10,8),
    ALTER COLUMN production TYPE numeric(10,8),
    ALTER COLUMN mastery TYPE numeric(10,8),
    ALTER COLUMN confidence TYPE numeric(10,8),
    ALTER COLUMN recognition SET DEFAULT 0.5,
    ALTER COLUMN listening SET DEFAULT 0.5,
    ALTER COLUMN production SET DEFAULT 0.5,
    ADD COLUMN recognition_positive_mass numeric(24,18) NOT NULL DEFAULT 0
        CHECK (recognition_positive_mass >= 0),
    ADD COLUMN recognition_negative_mass numeric(24,18) NOT NULL DEFAULT 0
        CHECK (recognition_negative_mass >= 0),
    ADD COLUMN recognition_confidence numeric(10,8) NOT NULL DEFAULT 0
        CHECK (recognition_confidence BETWEEN 0 AND 1),
    ADD COLUMN recognition_evidence_count integer NOT NULL DEFAULT 0
        CHECK (recognition_evidence_count >= 0),
    ADD COLUMN recognition_last_evidence_at timestamptz,
    ADD COLUMN listening_positive_mass numeric(24,18) NOT NULL DEFAULT 0
        CHECK (listening_positive_mass >= 0),
    ADD COLUMN listening_negative_mass numeric(24,18) NOT NULL DEFAULT 0
        CHECK (listening_negative_mass >= 0),
    ADD COLUMN listening_confidence numeric(10,8) NOT NULL DEFAULT 0
        CHECK (listening_confidence BETWEEN 0 AND 1),
    ADD COLUMN listening_evidence_count integer NOT NULL DEFAULT 0
        CHECK (listening_evidence_count >= 0),
    ADD COLUMN listening_last_evidence_at timestamptz,
    ADD COLUMN production_positive_mass numeric(24,18) NOT NULL DEFAULT 0
        CHECK (production_positive_mass >= 0),
    ADD COLUMN production_negative_mass numeric(24,18) NOT NULL DEFAULT 0
        CHECK (production_negative_mass >= 0),
    ADD COLUMN production_confidence numeric(10,8) NOT NULL DEFAULT 0
        CHECK (production_confidence BETWEEN 0 AND 1),
    ADD COLUMN production_evidence_count integer NOT NULL DEFAULT 0
        CHECK (production_evidence_count >= 0),
    ADD COLUMN production_last_evidence_at timestamptz,
    ADD COLUMN recent_competence_outcomes jsonb NOT NULL DEFAULT
        '{"recognition":[],"listening":[],"production":[]}'::jsonb
        CHECK (
            jsonb_typeof(recent_competence_outcomes) = 'object'
            AND jsonb_typeof(recent_competence_outcomes -> 'recognition') = 'array'
            AND jsonb_typeof(recent_competence_outcomes -> 'listening') = 'array'
            AND jsonb_typeof(recent_competence_outcomes -> 'production') = 'array'
            AND jsonb_array_length(recent_competence_outcomes -> 'recognition') <= 3
            AND jsonb_array_length(recent_competence_outcomes -> 'listening') <= 3
            AND jsonb_array_length(recent_competence_outcomes -> 'production') <= 3
        ),
    ADD COLUMN has_learning_intent boolean NOT NULL DEFAULT false,
    ADD COLUMN has_projectable_evidence boolean NOT NULL DEFAULT false,
    ADD COLUMN highest_achievement_status text CHECK (
        highest_achievement_status IS NULL
        OR highest_achievement_status IN ('familiar', 'active', 'mastered')
    ),
    ADD COLUMN competence_parameter_set_id uuid,
    ADD COLUMN competence_parameter_version text,
    ADD CONSTRAINT user_concept_states_competence_lineage_all_or_none CHECK (
        (competence_parameter_set_id IS NULL AND competence_parameter_version IS NULL)
        OR (competence_parameter_set_id IS NOT NULL AND competence_parameter_version IS NOT NULL)
    ),
    ADD CONSTRAINT user_concept_states_competence_parameter_fkey
        FOREIGN KEY (competence_parameter_set_id, competence_parameter_version)
        REFERENCES competence_parameter_sets(id, version) ON DELETE RESTRICT;

COMMENT ON COLUMN user_concept_states.competence_parameter_set_id IS
    'NULL identifies a pre-TASK-006D scalar projection that must not be interpreted as evidence.';

ALTER TABLE user_skill_states
    ALTER COLUMN score TYPE numeric(10,8),
    ALTER COLUMN confidence TYPE numeric(10,8),
    ADD COLUMN positive_mass numeric(24,18) NOT NULL DEFAULT 0 CHECK (positive_mass >= 0),
    ADD COLUMN negative_mass numeric(24,18) NOT NULL DEFAULT 0 CHECK (negative_mass >= 0),
    ADD COLUMN last_evidence_at timestamptz,
    ADD COLUMN state_version integer NOT NULL DEFAULT 1 CHECK (state_version >= 1),
    ADD COLUMN competence_parameter_set_id uuid,
    ADD COLUMN competence_parameter_version text,
    ADD CONSTRAINT user_skill_states_competence_lineage_all_or_none CHECK (
        (competence_parameter_set_id IS NULL AND competence_parameter_version IS NULL)
        OR (competence_parameter_set_id IS NOT NULL AND competence_parameter_version IS NOT NULL)
    ),
    ADD CONSTRAINT user_skill_states_competence_parameter_fkey
        FOREIGN KEY (competence_parameter_set_id, competence_parameter_version)
        REFERENCES competence_parameter_sets(id, version) ON DELETE RESTRICT;

ALTER TABLE learning_events RENAME COLUMN id TO learning_event_id;

ALTER TABLE learning_events
    DROP CONSTRAINT learning_events_user_id_idempotency_key_key,
    ADD COLUMN source_type text CHECK (
        source_type IS NULL
        OR source_type IN ('review_event', 'exposure_event', 'assessment_result')
    ),
    ADD COLUMN source_event_id uuid,
    ADD COLUMN derivation_key text CHECK (derivation_key IS NULL OR btrim(derivation_key) <> ''),
    ADD COLUMN causation_learning_event_id uuid,
    ADD COLUMN request_fingerprint text CHECK (
        request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    ADD COLUMN ingestion_sequence bigint CHECK (ingestion_sequence IS NULL OR ingestion_sequence >= 1),
    ADD COLUMN ingested_at timestamptz,
    ADD COLUMN projection_method_version text CHECK (
        projection_method_version IS NULL OR btrim(projection_method_version) <> ''
    ),
    ADD COLUMN competence_parameter_set_id uuid,
    ADD COLUMN competence_parameter_version text,
    ADD CONSTRAINT learning_events_causation_fkey
        FOREIGN KEY (causation_learning_event_id)
        REFERENCES learning_events(learning_event_id) ON DELETE RESTRICT,
    ADD CONSTRAINT learning_events_competence_parameter_fkey
        FOREIGN KEY (competence_parameter_set_id, competence_parameter_version)
        REFERENCES competence_parameter_sets(id, version) ON DELETE RESTRICT,
    ADD CONSTRAINT learning_events_canonical_identity_all_or_none CHECK (
        (source_type IS NULL AND source_event_id IS NULL AND derivation_key IS NULL
         AND request_fingerprint IS NULL AND ingestion_sequence IS NULL AND ingested_at IS NULL
         AND projection_method_version IS NULL AND competence_parameter_set_id IS NULL
         AND competence_parameter_version IS NULL)
        OR
        (source_type IS NOT NULL AND source_event_id IS NOT NULL AND derivation_key IS NOT NULL
         AND request_fingerprint IS NOT NULL AND ingestion_sequence IS NOT NULL
         AND ingested_at IS NOT NULL AND projection_method_version IS NOT NULL
         AND competence_parameter_set_id IS NOT NULL AND competence_parameter_version IS NOT NULL)
    );

CREATE UNIQUE INDEX uq_learning_events_source_derivation
    ON learning_events (user_id, source_type, source_event_id, derivation_key)
    WHERE source_type IS NOT NULL;

CREATE UNIQUE INDEX uq_learning_events_profile_ingestion_sequence
    ON learning_events (user_language_id, ingestion_sequence)
    WHERE ingestion_sequence IS NOT NULL;

CREATE INDEX ix_learning_events_profile_replay
    ON learning_events (user_id, user_language_id, ingestion_sequence, learning_event_id)
    WHERE ingestion_sequence IS NOT NULL;

CREATE FUNCTION enforce_learning_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF pg_trigger_depth() = 1 THEN
        RAISE EXCEPTION 'Canonical learning events are append-only'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END
$$;

CREATE TRIGGER learning_events_append_only
BEFORE UPDATE OR DELETE ON learning_events
FOR EACH ROW EXECUTE FUNCTION enforce_learning_event_append_only();

ALTER TABLE review_events
    ADD COLUMN result_competence_snapshot jsonb CHECK (
        result_competence_snapshot IS NULL
        OR (
            jsonb_typeof(result_competence_snapshot) = 'object'
            AND result_competence_snapshot ?& ARRAY['recognition', 'listening', 'production']
            AND jsonb_typeof(result_competence_snapshot -> 'recognition') = 'object'
            AND jsonb_typeof(result_competence_snapshot -> 'listening') = 'object'
            AND jsonb_typeof(result_competence_snapshot -> 'production') = 'object'
            AND result_competence_snapshot -> 'recognition'
                ?& ARRAY['score', 'confidence', 'evidenceCount', 'updatedAt']
            AND result_competence_snapshot -> 'listening'
                ?& ARRAY['score', 'confidence', 'evidenceCount', 'updatedAt']
            AND result_competence_snapshot -> 'production'
                ?& ARRAY['score', 'confidence', 'evidenceCount', 'updatedAt']
        )
    ),
    ADD COLUMN result_remaining_due_count integer CHECK (result_remaining_due_count >= 0),
    ADD COLUMN result_feedback text CHECK (
        result_feedback IS NULL OR char_length(result_feedback) <= 500
    ),
    ADD CONSTRAINT review_events_competence_result_all_or_none CHECK (
        (result_competence_snapshot IS NULL AND result_remaining_due_count IS NULL)
        OR (result_competence_snapshot IS NOT NULL AND result_remaining_due_count IS NOT NULL)
    );

ALTER TABLE user_language_projection_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_language_projection_heads_select_own
    ON user_language_projection_heads FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON user_language_projection_heads TO authenticated;
REVOKE ALL ON user_language_projection_heads FROM anon;
