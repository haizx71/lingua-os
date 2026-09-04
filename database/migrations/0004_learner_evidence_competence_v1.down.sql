-- TASK-006D rollback for disposable databases without accepted competence evidence.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM learning_events WHERE source_type IS NOT NULL)
       OR EXISTS (SELECT 1 FROM review_events WHERE result_competence_snapshot IS NOT NULL)
       OR EXISTS (SELECT 1 FROM user_language_projection_heads)
       OR EXISTS (
            SELECT 1 FROM user_concept_states WHERE competence_parameter_set_id IS NOT NULL
       )
       OR EXISTS (SELECT 1 FROM user_skill_states WHERE competence_parameter_set_id IS NOT NULL)
    THEN
        RAISE EXCEPTION 'Refusing lossy TASK-006D rollback after competence activity';
    END IF;
END
$$;

DROP POLICY user_language_projection_heads_select_own ON user_language_projection_heads;
REVOKE ALL ON user_language_projection_heads FROM authenticated, anon;

ALTER TABLE review_events
    DROP CONSTRAINT review_events_competence_result_all_or_none,
    DROP COLUMN result_feedback,
    DROP COLUMN result_remaining_due_count,
    DROP COLUMN result_competence_snapshot;

DROP TRIGGER learning_events_append_only ON learning_events;
DROP FUNCTION enforce_learning_event_append_only();
DROP INDEX ix_learning_events_profile_replay;
DROP INDEX uq_learning_events_profile_ingestion_sequence;
DROP INDEX uq_learning_events_source_derivation;

ALTER TABLE learning_events
    DROP CONSTRAINT learning_events_canonical_identity_all_or_none,
    DROP CONSTRAINT learning_events_competence_parameter_fkey,
    DROP CONSTRAINT learning_events_causation_fkey,
    DROP COLUMN competence_parameter_version,
    DROP COLUMN competence_parameter_set_id,
    DROP COLUMN projection_method_version,
    DROP COLUMN ingested_at,
    DROP COLUMN ingestion_sequence,
    DROP COLUMN request_fingerprint,
    DROP COLUMN causation_learning_event_id,
    DROP COLUMN derivation_key,
    DROP COLUMN source_event_id,
    DROP COLUMN source_type,
    ADD CONSTRAINT learning_events_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);

ALTER TABLE learning_events RENAME COLUMN learning_event_id TO id;

ALTER TABLE user_skill_states
    DROP CONSTRAINT user_skill_states_competence_parameter_fkey,
    DROP CONSTRAINT user_skill_states_competence_lineage_all_or_none,
    DROP COLUMN competence_parameter_version,
    DROP COLUMN competence_parameter_set_id,
    DROP COLUMN state_version,
    DROP COLUMN last_evidence_at,
    DROP COLUMN negative_mass,
    DROP COLUMN positive_mass,
    ALTER COLUMN confidence TYPE numeric(5,4),
    ALTER COLUMN score TYPE numeric(5,4);

ALTER TABLE user_concept_states
    DROP CONSTRAINT user_concept_states_competence_parameter_fkey,
    DROP CONSTRAINT user_concept_states_competence_lineage_all_or_none,
    DROP COLUMN competence_parameter_version,
    DROP COLUMN competence_parameter_set_id,
    DROP COLUMN highest_achievement_status,
    DROP COLUMN has_projectable_evidence,
    DROP COLUMN has_learning_intent,
    DROP COLUMN recent_competence_outcomes,
    DROP COLUMN production_last_evidence_at,
    DROP COLUMN production_evidence_count,
    DROP COLUMN production_confidence,
    DROP COLUMN production_negative_mass,
    DROP COLUMN production_positive_mass,
    DROP COLUMN listening_last_evidence_at,
    DROP COLUMN listening_evidence_count,
    DROP COLUMN listening_confidence,
    DROP COLUMN listening_negative_mass,
    DROP COLUMN listening_positive_mass,
    DROP COLUMN recognition_last_evidence_at,
    DROP COLUMN recognition_evidence_count,
    DROP COLUMN recognition_confidence,
    DROP COLUMN recognition_negative_mass,
    DROP COLUMN recognition_positive_mass,
    ALTER COLUMN production DROP DEFAULT,
    ALTER COLUMN listening DROP DEFAULT,
    ALTER COLUMN recognition DROP DEFAULT,
    ALTER COLUMN confidence TYPE numeric(5,4),
    ALTER COLUMN mastery TYPE numeric(5,4),
    ALTER COLUMN production TYPE numeric(5,4),
    ALTER COLUMN listening TYPE numeric(5,4),
    ALTER COLUMN recognition TYPE numeric(5,4);

DROP TABLE user_language_projection_heads;
DROP TRIGGER concept_competence_policies_immutable_history ON concept_competence_policies;
DROP FUNCTION enforce_concept_competence_policy_immutability();
DROP TABLE concept_competence_policies;
DROP TRIGGER competence_parameter_sets_immutable_history ON competence_parameter_sets;
DROP FUNCTION enforce_competence_parameter_set_immutability();
DROP TABLE competence_parameter_sets;
