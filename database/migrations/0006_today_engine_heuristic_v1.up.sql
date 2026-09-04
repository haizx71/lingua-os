-- TASK-010: persisted deterministic Today plans and evidence-gated completion replay.

SET LOCAL search_path = public, pg_catalog;

ALTER TABLE today_plans
    ADD COLUMN as_of timestamptz,
    ADD COLUMN unused_minutes smallint,
    ADD COLUMN generation_diagnostics jsonb;

UPDATE today_plans
SET as_of = generated_at,
    unused_minutes = daily_minutes,
    generation_diagnostics = jsonb_build_object(
        'policyVersion', engine_version,
        'migrationBackfill', true
    );

ALTER TABLE today_plans
    ALTER COLUMN as_of SET NOT NULL,
    ALTER COLUMN unused_minutes SET NOT NULL,
    ALTER COLUMN generation_diagnostics SET NOT NULL,
    ADD CONSTRAINT today_plans_unused_minutes_check
        CHECK (unused_minutes BETWEEN 0 AND daily_minutes),
    ADD CONSTRAINT today_plans_generation_diagnostics_check
        CHECK (jsonb_typeof(generation_diagnostics) = 'object');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM today_plans
        GROUP BY user_id, user_language_id, plan_date
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot establish stable Today day identity: duplicate historical daily plans exist';
    END IF;
END
$$;

DROP INDEX uq_today_plans_active_day;
ALTER TABLE today_plans
    ADD CONSTRAINT today_plans_owned_profile_day_unique
        UNIQUE (user_id, user_language_id, plan_date);

ALTER TABLE today_plan_activities
    ADD COLUMN target_count integer,
    ADD COLUMN completed_count integer NOT NULL DEFAULT 0,
    ADD COLUMN title_snapshot text,
    ADD COLUMN description_snapshot text,
    ADD COLUMN reason_text_snapshot text,
    ADD COLUMN selection_diagnostics jsonb,
    ADD COLUMN duration_seconds integer,
    ADD COLUMN completion_request_fingerprint text,
    ADD COLUMN completion_result_snapshot jsonb;

UPDATE today_plan_activities
SET target_count = 1,
    title_snapshot = CASE activity_type
        WHEN 'review' THEN 'Ôn tập đến hạn'
        WHEN 'read' THEN 'Đọc nội dung'
        WHEN 'listen' THEN 'Luyện nghe'
        ELSE 'Hoạt động học'
    END,
    description_snapshot = 'Historical Today activity',
    reason_text_snapshot = 'Selected by the stored Today policy',
    selection_diagnostics = jsonb_build_object('migrationBackfill', true);

ALTER TABLE today_plan_activities
    ALTER COLUMN target_count SET NOT NULL,
    ALTER COLUMN title_snapshot SET NOT NULL,
    ALTER COLUMN description_snapshot SET NOT NULL,
    ALTER COLUMN reason_text_snapshot SET NOT NULL,
    ALTER COLUMN selection_diagnostics SET NOT NULL,
    ADD CONSTRAINT today_plan_activities_identity_unique
        UNIQUE (id, user_id, language_code),
    ADD CONSTRAINT today_plan_activities_target_count_check CHECK (target_count >= 1),
    ADD CONSTRAINT today_plan_activities_completed_count_check CHECK (
        completed_count BETWEEN 0 AND target_count
    ),
    ADD CONSTRAINT today_plan_activities_title_snapshot_check
        CHECK (btrim(title_snapshot) <> '' AND char_length(title_snapshot) <= 160),
    ADD CONSTRAINT today_plan_activities_description_snapshot_check
        CHECK (btrim(description_snapshot) <> '' AND char_length(description_snapshot) <= 500),
    ADD CONSTRAINT today_plan_activities_reason_text_snapshot_check
        CHECK (btrim(reason_text_snapshot) <> '' AND char_length(reason_text_snapshot) <= 300),
    ADD CONSTRAINT today_plan_activities_selection_diagnostics_check
        CHECK (jsonb_typeof(selection_diagnostics) = 'object'),
    ADD CONSTRAINT today_plan_activities_duration_seconds_check
        CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400),
    ADD CONSTRAINT today_plan_activities_completion_fingerprint_check CHECK (
        completion_request_fingerprint IS NULL
        OR completion_request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    ADD CONSTRAINT today_plan_activities_completion_snapshot_check CHECK (
        completion_result_snapshot IS NULL
        OR jsonb_typeof(completion_result_snapshot) = 'object'
    ),
    ADD CONSTRAINT today_plan_activities_completion_result_all_or_none CHECK (
        (status = 'completed'
         AND idempotency_key IS NOT NULL
         AND completion_request_fingerprint IS NOT NULL
         AND completion_result_snapshot IS NOT NULL)
        OR
        (status <> 'completed'
         AND idempotency_key IS NULL
         AND completion_request_fingerprint IS NULL
         AND completion_result_snapshot IS NULL
         AND duration_seconds IS NULL)
    ),
    ADD CONSTRAINT today_plan_activities_target_shape_check CHECK (
        (activity_type = 'review' AND review_item_id IS NOT NULL AND content_id IS NULL)
        OR
        (activity_type IN ('read', 'listen') AND content_id IS NOT NULL
         AND review_item_id IS NULL AND target_count = 1)
        OR
        (activity_type = 'learn' AND concept_id IS NOT NULL
         AND content_id IS NULL AND review_item_id IS NULL AND target_count = 1)
    );

CREATE TABLE today_activity_review_items (
    activity_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language_code text NOT NULL DEFAULT 'en',
    review_item_id uuid NOT NULL,
    position smallint NOT NULL CHECK (position >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, position),
    UNIQUE (activity_id, review_item_id),
    FOREIGN KEY (activity_id, user_id, language_code)
        REFERENCES today_plan_activities(id, user_id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (review_item_id, user_id, language_code)
        REFERENCES review_items(id, user_id, language_code) ON DELETE RESTRICT
);

CREATE FUNCTION enforce_today_review_target_set()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    candidate_activity_id uuid;
    candidate_type text;
    expected_count integer;
    actual_count integer;
BEGIN
    IF TG_TABLE_NAME = 'today_plan_activities' THEN
        candidate_activity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    ELSE
        candidate_activity_id := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.activity_id ELSE NEW.activity_id
        END;
    END IF;

    SELECT activity_type, target_count
      INTO candidate_type, expected_count
      FROM today_plan_activities
     WHERE id = candidate_activity_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO actual_count
      FROM today_activity_review_items
     WHERE activity_id = candidate_activity_id;

    IF candidate_type = 'review' AND actual_count <> expected_count THEN
        RAISE EXCEPTION 'Today Review activity target set must match target_count'
            USING ERRCODE = '23514';
    ELSIF candidate_type <> 'review' AND actual_count <> 0 THEN
        RAISE EXCEPTION 'Only Today Review activities may own Review targets'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER today_activity_review_target_count
AFTER INSERT OR UPDATE OF activity_type, target_count ON today_plan_activities
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_today_review_target_set();

CREATE CONSTRAINT TRIGGER today_review_item_target_count
AFTER INSERT OR UPDATE OR DELETE ON today_activity_review_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_today_review_target_set();

CREATE INDEX ix_today_activity_review_items_proof
    ON today_activity_review_items (user_id, review_item_id, activity_id);
CREATE INDEX ix_review_events_today_proof
    ON review_events (user_id, review_item_id, reviewed_at, id);
CREATE INDEX ix_exposure_events_today_proof
    ON exposure_events (user_id, content_id, exposure_type, occurred_at, id)
    WHERE content_id IS NOT NULL;

ALTER TABLE today_activity_review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY today_activity_review_items_select_own
    ON today_activity_review_items FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON today_activity_review_items TO authenticated;
REVOKE ALL ON today_activity_review_items FROM anon;

COMMENT ON COLUMN today_plans.as_of IS
    'Single authoritative UTC instant captured for deterministic generation and source reads.';
COMMENT ON COLUMN today_plans.generation_diagnostics IS
    'Private bounded policy/allocation diagnostics; rebuildable from source state only at the stored asOf.';
COMMENT ON COLUMN today_plan_activities.title_snapshot IS
    'Public presentation snapshot required for stable same-day and idempotent API replay.';
COMMENT ON COLUMN today_plan_activities.selection_diagnostics IS
    'Private selection explanation; never a competence, FSRS, content, or Reader authority.';
COMMENT ON TABLE today_activity_review_items IS
    'Ordered snapshot of authoritative Review queue identities allocated to one aggregate Today block.';
COMMENT ON COLUMN today_plan_activities.completion_result_snapshot IS
    'Exact public completion response snapshot; derived coordination metadata, not learning evidence.';
