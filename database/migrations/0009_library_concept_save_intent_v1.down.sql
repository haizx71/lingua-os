-- TASK-008B rollback: Library API v1 + GAP-01 Memory Activation.

SET LOCAL search_path = public, pg_catalog;

DROP TABLE IF EXISTS concept_save_intents CASCADE;
DROP FUNCTION IF EXISTS enforce_concept_save_intent_immutability() CASCADE;
DROP INDEX IF EXISTS ix_saved_concepts_user_saved_at;

ALTER TABLE learning_events
    DROP CONSTRAINT IF EXISTS learning_events_source_type_check;

ALTER TABLE learning_events
    ADD CONSTRAINT learning_events_source_type_check CHECK (
        source_type IS NULL
        OR source_type IN ('review_event', 'exposure_event', 'assessment_result')
    );
