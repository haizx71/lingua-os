-- TASK-006A: preserve the exact accepted memory mutation result for delayed idempotent replay.

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE review_events
    ADD COLUMN result_memory_snapshot jsonb,
    ADD CONSTRAINT review_events_result_memory_snapshot_required
        CHECK (result_memory_snapshot IS NOT NULL) NOT VALID,
    ADD CONSTRAINT review_events_result_memory_snapshot_check CHECK (
        result_memory_snapshot IS NULL
        OR (
            jsonb_typeof(result_memory_snapshot) = 'object'
            AND result_memory_snapshot ?& ARRAY[
                'reviewItemId', 'difficulty', 'stability', 'dueAt', 'lastReviewAt',
                'state', 'step', 'parameterSetId', 'paramsVersion', 'stateVersion'
            ]
            AND result_memory_snapshot ->> 'state'
                IN ('new', 'learning', 'review', 'relearning')
            AND (result_memory_snapshot ->> 'stateVersion')::integer >= 2
        )
    );

COMMENT ON COLUMN review_events.result_memory_snapshot IS
    'Private immutable post-transition Memory Engine snapshot used only for exact idempotent replay.';
