-- TASK-010 rollback for disposable databases without generated Today plans.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM today_activity_review_items)
       OR EXISTS (SELECT 1 FROM today_plans WHERE engine_version = 'today-heuristic-v1')
       OR EXISTS (
            SELECT 1 FROM today_plan_activities
            WHERE completion_result_snapshot IS NOT NULL
       )
    THEN
        RAISE EXCEPTION 'Refusing lossy TASK-010 rollback after Today learner activity';
    END IF;
END
$$;

DROP TRIGGER today_review_item_target_count ON today_activity_review_items;
DROP TRIGGER today_activity_review_target_count ON today_plan_activities;
DROP FUNCTION enforce_today_review_target_set();

DROP POLICY today_activity_review_items_select_own ON today_activity_review_items;
REVOKE ALL ON today_activity_review_items FROM authenticated, anon;
DROP INDEX ix_exposure_events_today_proof;
DROP INDEX ix_review_events_today_proof;
DROP INDEX ix_today_activity_review_items_proof;
DROP TABLE today_activity_review_items;

ALTER TABLE today_plan_activities
    DROP CONSTRAINT today_plan_activities_target_shape_check,
    DROP CONSTRAINT today_plan_activities_completion_result_all_or_none,
    DROP CONSTRAINT today_plan_activities_completion_snapshot_check,
    DROP CONSTRAINT today_plan_activities_completion_fingerprint_check,
    DROP CONSTRAINT today_plan_activities_duration_seconds_check,
    DROP CONSTRAINT today_plan_activities_selection_diagnostics_check,
    DROP CONSTRAINT today_plan_activities_reason_text_snapshot_check,
    DROP CONSTRAINT today_plan_activities_description_snapshot_check,
    DROP CONSTRAINT today_plan_activities_title_snapshot_check,
    DROP CONSTRAINT today_plan_activities_completed_count_check,
    DROP CONSTRAINT today_plan_activities_target_count_check,
    DROP CONSTRAINT today_plan_activities_identity_unique,
    DROP COLUMN completion_result_snapshot,
    DROP COLUMN completion_request_fingerprint,
    DROP COLUMN duration_seconds,
    DROP COLUMN selection_diagnostics,
    DROP COLUMN reason_text_snapshot,
    DROP COLUMN description_snapshot,
    DROP COLUMN title_snapshot,
    DROP COLUMN completed_count,
    DROP COLUMN target_count;

ALTER TABLE today_plans
    DROP CONSTRAINT today_plans_owned_profile_day_unique;
CREATE UNIQUE INDEX uq_today_plans_active_day
    ON today_plans (user_id, user_language_id, plan_date)
    WHERE status = 'active';

ALTER TABLE today_plans
    DROP CONSTRAINT today_plans_generation_diagnostics_check,
    DROP CONSTRAINT today_plans_unused_minutes_check,
    DROP COLUMN generation_diagnostics,
    DROP COLUMN unused_minutes,
    DROP COLUMN as_of;

