-- TASK-006A rollback: remove the derived replay snapshot, preserving review events and FSRS state.

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE review_events
    DROP CONSTRAINT review_events_result_memory_snapshot_required,
    DROP CONSTRAINT review_events_result_memory_snapshot_check,
    DROP COLUMN result_memory_snapshot;
