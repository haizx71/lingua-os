-- Migration 0020: permit remediation reasons in persisted Today activities.

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE today_plan_activities
    DROP CONSTRAINT today_plan_activities_reason_codes_check,
    ADD CONSTRAINT today_plan_activities_reason_codes_check CHECK (
        cardinality(reason_codes) > 0 AND reason_codes <@ ARRAY[
            'FSRS_DUE', 'FORGOTTEN_REMEDIATION', 'WEAK_REMEDIATION',
            'WEAK_RECOGNITION', 'WEAK_LISTENING', 'LOW_PRODUCTION_EVIDENCE',
            'CONTENT_FIT', 'RECENT_EXPOSURE', 'NEW_CONCEPT_BUDGET'
        ]::text[]
    );
