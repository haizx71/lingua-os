-- Migration 0020 rollback: refuse to discard persisted Today remediation reasons.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM today_plan_activities
        WHERE reason_codes && ARRAY['FORGOTTEN_REMEDIATION', 'WEAK_REMEDIATION']::text[]
    ) THEN
        RAISE EXCEPTION
            'Refusing 0020 rollback while Today remediation reasons are persisted';
    END IF;
END
$$;

ALTER TABLE today_plan_activities
    DROP CONSTRAINT today_plan_activities_reason_codes_check,
    ADD CONSTRAINT today_plan_activities_reason_codes_check CHECK (
        cardinality(reason_codes) > 0 AND reason_codes <@ ARRAY[
            'FSRS_DUE', 'WEAK_RECOGNITION', 'WEAK_LISTENING',
            'LOW_PRODUCTION_EVIDENCE', 'CONTENT_FIT', 'RECENT_EXPOSURE',
            'NEW_CONCEPT_BUDGET'
        ]::text[]
    );
