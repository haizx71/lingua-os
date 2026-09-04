-- Disposable/test rollback for TASK-006. Refuse lossy reversal once memory activity exists.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM review_events) OR EXISTS (SELECT 1 FROM fsrs_states) THEN
        RAISE EXCEPTION 'cannot roll back TASK-006 after memory activity exists; use a forward migration';
    END IF;
END
$$;

ALTER TABLE review_events
    DROP CONSTRAINT review_events_parameter_set_fkey,
    DROP CONSTRAINT review_events_request_fingerprint_check,
    DROP CONSTRAINT review_events_params_version_check,
    DROP CONSTRAINT review_events_evidence_mode_check,
    DROP CONSTRAINT review_events_exercise_mode_check,
    DROP COLUMN request_fingerprint,
    DROP COLUMN params_version,
    DROP COLUMN parameter_set_id,
    DROP COLUMN exercise_mode;

ALTER TABLE review_events
    RENAME COLUMN evidence_mode TO exercise_mode;

ALTER TABLE review_events
    ALTER COLUMN correct SET NOT NULL,
    ADD CONSTRAINT review_events_exercise_mode_check CHECK (
        exercise_mode IN ('recognition', 'listening', 'cloze', 'production')
    );

DROP INDEX ix_fsrs_states_user_due_at;

ALTER TABLE fsrs_states
    DROP CONSTRAINT fsrs_states_shape_check,
    DROP COLUMN step,
    ALTER COLUMN difficulty SET NOT NULL,
    ALTER COLUMN stability SET NOT NULL;

DROP TRIGGER fsrs_parameter_sets_immutable_history ON fsrs_parameter_sets;
DROP FUNCTION enforce_fsrs_parameter_set_immutability();

DELETE FROM fsrs_parameter_sets
WHERE id = '00000000-0000-4000-8600-000000000001';

DROP INDEX uq_fsrs_parameter_sets_single_default;

ALTER TABLE fsrs_parameter_sets
    DROP CONSTRAINT fsrs_parameter_sets_payload_check,
    DROP CONSTRAINT fsrs_parameter_sets_library_version_check,
    DROP CONSTRAINT fsrs_parameter_sets_algorithm_version_check,
    DROP COLUMN is_default,
    DROP COLUMN library_version,
    DROP COLUMN algorithm_version;

