-- TASK-016: Protected rollback for 0008_starting_level_estimate_v1.
-- Refuses rollback if any 0008-dependent data exists.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM assessment_attempt_items) THEN
        RAISE EXCEPTION 'Refusing 0008 rollback: assessment_attempt_items rows exist';
    END IF;
    IF EXISTS (SELECT 1 FROM assessment_idempotency_log) THEN
        RAISE EXCEPTION 'Refusing 0008 rollback: assessment_idempotency_log rows exist';
    END IF;
    IF EXISTS (SELECT 1 FROM assessment_results WHERE confidence_band IS NOT NULL) THEN
        RAISE EXCEPTION 'Refusing 0008 rollback: assessment_results with confidence_band exist';
    END IF;
    IF EXISTS (SELECT 1 FROM assessment_responses WHERE answer_discriminator IS NOT NULL) THEN
        RAISE EXCEPTION 'Refusing 0008 rollback: assessment_responses with discriminator exist';
    END IF;
END
$$;

-- Reverse indexes
DROP INDEX IF EXISTS ix_assessment_results_current;
DROP INDEX IF EXISTS ix_assessment_attempt_items_attempt_position;
DROP INDEX IF EXISTS ix_assessment_items_slot_lookup;
DROP INDEX IF EXISTS ix_assessment_attempts_profile_status;
DROP INDEX IF EXISTS ix_assessment_attempts_one_active_per_profile;
DROP INDEX IF EXISTS ix_assessment_items_policy_slot;
DROP INDEX IF EXISTS ix_assessment_templates_one_active_pair;

-- Reverse assessment_results changes
DROP TRIGGER  assessment_results_append_only ON assessment_results;
DROP FUNCTION enforce_assessment_result_append_only();
ALTER TABLE assessment_results
    DROP CONSTRAINT IF EXISTS assessment_results_evidence_count_min,
    DROP CONSTRAINT IF EXISTS assessment_results_confidence_check,
    ADD CONSTRAINT assessment_results_confidence_check CHECK (confidence BETWEEN 0 AND 1),
    ALTER COLUMN estimated_level_id DROP NOT NULL,
    DROP COLUMN IF EXISTS confidence_band,
    DROP COLUMN IF EXISTS private_diagnostics;

-- Reverse assessment_responses changes
DROP TRIGGER  assessment_responses_append_only ON assessment_responses;
DROP FUNCTION enforce_assessment_response_append_only();
ALTER TABLE assessment_responses
    DROP CONSTRAINT IF EXISTS assessment_responses_discriminator_check,
    DROP CONSTRAINT IF EXISTS assessment_responses_response_shape_check,
    DROP COLUMN IF EXISTS answer_discriminator;

-- Reverse idempotency log
DROP TRIGGER  assessment_idempotency_log_append_only ON assessment_idempotency_log;
DROP FUNCTION enforce_assessment_idempotency_log_append_only();
DROP TABLE assessment_idempotency_log;

-- Reverse attempt_items
DROP TRIGGER assessment_attempt_items_append_only ON assessment_attempt_items;
DROP FUNCTION enforce_assessment_attempt_item_append_only();
DROP TABLE assessment_attempt_items;

-- Reverse assessment_attempts changes
DROP TRIGGER IF EXISTS assessment_attempt_policy_binding ON assessment_attempts;
DROP FUNCTION IF EXISTS enforce_assessment_attempt_policy_binding();
ALTER TABLE assessment_attempts
    DROP COLUMN IF EXISTS current_position;

-- Reverse assessment_items changes
ALTER TABLE assessment_items
    DROP CONSTRAINT IF EXISTS assessment_items_listening_audio_check,
    DROP CONSTRAINT IF EXISTS assessment_items_slot4_listening_check,
    DROP CONSTRAINT IF EXISTS assessment_items_slot_index_check,
    DROP CONSTRAINT IF EXISTS assessment_items_bundle_kind_check,
    DROP CONSTRAINT IF EXISTS assessment_items_item_type_check,
    DROP COLUMN IF EXISTS audio_asset_id,
    DROP COLUMN IF EXISTS target_level_id,
    DROP COLUMN IF EXISTS slot_index,
    DROP COLUMN IF EXISTS bundle_kind,
    DROP COLUMN IF EXISTS item_type;

-- Reverse assessment_templates changes
ALTER TABLE assessment_templates
    DROP CONSTRAINT IF EXISTS assessment_templates_native_language_code_fkey,
    DROP COLUMN IF EXISTS native_language_code;
