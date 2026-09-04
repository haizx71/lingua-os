-- TASK-016: Starting Level Estimate v1 persistence — schema delta, immutability,
-- evidence isolation, and proof-path indexes.
-- Authority: ADR-020, docs/STARTING_LEVEL_ESTIMATE_V1.md §17.

SET LOCAL search_path = public, pg_catalog;

-- ============================================================
-- PREFLIGHT — refuse to apply on data that would become unsafe
-- ============================================================
DO $$
BEGIN
    -- 0008 must not already be applied (idempotency guard at migration-runner level,
    -- but we double-check the sentinel column).
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'assessment_templates'
          AND column_name  = 'native_language_code'
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: 0008 already applied (native_language_code exists)';
    END IF;

    -- All existing attempts must reference a valid template.
    IF EXISTS (
        SELECT 1
        FROM assessment_attempts a
        LEFT JOIN assessment_templates t ON t.id = a.template_id
        WHERE t.id IS NULL
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: orphaned assessment_attempt rows found';
    END IF;

    -- Existing templates/items predate the v1 native-language and policy-slot
    -- authority. Their semantics cannot be inferred safely, so require an
    -- explicit operator migration instead of fabricating values.
    IF EXISTS (SELECT 1 FROM assessment_templates) THEN
        RAISE EXCEPTION
            'TASK-016 preflight: existing assessment_templates require explicit native-language backfill';
    END IF;
    IF EXISTS (SELECT 1 FROM assessment_items) THEN
        RAISE EXCEPTION
            'TASK-016 preflight: existing assessment_items require explicit policy metadata backfill';
    END IF;

    -- No attempt may already be in_progress more than once per profile
    -- (partial-unique index we are about to add must not be violated).
    IF EXISTS (
        SELECT user_id, user_language_id
        FROM assessment_attempts
        WHERE status = 'in_progress'
        GROUP BY user_id, user_language_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: multiple in_progress attempts per profile found';
    END IF;

    -- assessment_results confidence must already fit 0..1 (new constraint is 0..0.85).
    IF EXISTS (
        SELECT 1 FROM assessment_results WHERE confidence > 0.85
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: existing result confidence > 0.85 cannot be preserved';
    END IF;

    IF EXISTS (
        SELECT 1 FROM assessment_results
        WHERE confidence <> round(confidence, 2)
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: existing result confidence is not two-decimal precision';
    END IF;

    IF EXISTS (
        SELECT 1 FROM assessment_results WHERE evidence_count < 6
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: existing result has fewer than six evidence items';
    END IF;

    -- estimated_level_id must be non-null for any completed attempt result
    -- (new constraint makes it NOT NULL).
    IF EXISTS (
        SELECT 1
        FROM assessment_results r
        JOIN assessment_attempts a ON a.id = r.attempt_id
        WHERE a.status = 'completed' AND r.estimated_level_id IS NULL
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: completed result with null estimated_level_id found';
    END IF;

    -- All existing level references must be A0/A1/A2/B1 CEFR codes.
    IF EXISTS (
        SELECT 1
        FROM assessment_results r
        JOIN proficiency_levels l ON l.id = r.estimated_level_id
        WHERE l.code NOT IN ('A0', 'A1', 'A2', 'B1')
    ) THEN
        RAISE EXCEPTION 'TASK-016 preflight: result references a level outside A0/A1/A2/B1';
    END IF;
END
$$;

-- ============================================================
-- 1. assessment_templates: add native-language authority +
--    one-active-vi-en-template constraint
-- ============================================================

ALTER TABLE assessment_templates
    ADD COLUMN native_language_code text;

ALTER TABLE assessment_templates
    ALTER COLUMN native_language_code SET NOT NULL,
    ADD CONSTRAINT assessment_templates_native_language_code_fkey
        FOREIGN KEY (native_language_code) REFERENCES languages(code) ON DELETE RESTRICT;

-- One active template per native→target pair.
CREATE UNIQUE INDEX ix_assessment_templates_one_active_pair
    ON assessment_templates (native_language_code, language_code)
    WHERE status = 'active';

COMMENT ON COLUMN assessment_templates.native_language_code IS
    'Authoritative native/support language for this assessment form; only vi→en is activated in v1.';

-- ============================================================
-- 2. assessment_items: band, type, slot, audio, immutability
-- ============================================================

ALTER TABLE assessment_items
    ADD COLUMN item_type    text,
    ADD COLUMN bundle_kind  text,
    ADD COLUMN slot_index   smallint,
    ADD COLUMN target_level_id uuid,
    ADD COLUMN audio_asset_id  uuid;

ALTER TABLE assessment_items
    ALTER COLUMN item_type SET NOT NULL,
    ADD CONSTRAINT assessment_items_item_type_check
        CHECK (item_type IN (
            'vocabulary_recognition',
            'grammar_in_context',
            'reading_comprehension',
            'listening_comprehension'
        ));

-- bundle_kind and slot_index are required for items belonging to v1 policy templates.
-- Existing legacy items (if any) may leave these null; new items must supply them.
ALTER TABLE assessment_items
    ADD CONSTRAINT assessment_items_bundle_kind_check
        CHECK (bundle_kind IS NULL OR bundle_kind IN ('primary', 'verification')),
    ADD CONSTRAINT assessment_items_slot_index_check
        CHECK (slot_index IS NULL OR (slot_index BETWEEN 1 AND 4));

-- Unique slot within template×level×bundle prevents slot collisions.
CREATE UNIQUE INDEX ix_assessment_items_policy_slot
    ON assessment_items (template_id, target_level_id, bundle_kind, slot_index)
    WHERE target_level_id IS NOT NULL
      AND bundle_kind      IS NOT NULL
      AND slot_index       IS NOT NULL;

-- Listening slot must map to listening_comprehension; slot 4 = listening domain.
ALTER TABLE assessment_items
    ADD CONSTRAINT assessment_items_slot4_listening_check
        CHECK (
            slot_index IS NULL
            OR slot_index <> 4
            OR item_type = 'listening_comprehension'
        );

-- Listening items that specify slot 4 require an audio asset FK.
-- We store the audio_asset_id reference; the FK is advisory (the asset table
-- may be in a different schema). We enforce the non-null rule in application
-- logic; the DB enforces non-null only for listening slots.
ALTER TABLE assessment_items
    ADD CONSTRAINT assessment_items_listening_audio_check
        CHECK (
            item_type <> 'listening_comprehension'
            OR audio_asset_id IS NOT NULL
        );

COMMENT ON COLUMN assessment_items.item_type IS
    'Private item type; determines presentation and the competence dimension honestly assessed.';
COMMENT ON COLUMN assessment_items.bundle_kind IS
    'primary = first four slots; verification = overturn-gate four slots.';
COMMENT ON COLUMN assessment_items.slot_index IS
    '1-based position within the four-slot bundle: 1=vocab 2=grammar 3=reading 4=listening.';

-- ============================================================
-- 3. NEW: assessment_attempt_items — per-attempt question snapshots
--    No browser SELECT grant (service role only).
-- ============================================================

CREATE TABLE assessment_attempt_items (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      uuid    NOT NULL,
    user_id         uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id     uuid    NOT NULL,
    item_id         uuid    NOT NULL,
    position        smallint NOT NULL CHECK (position BETWEEN 1 AND 16),
    target_level_id uuid    NOT NULL REFERENCES proficiency_levels(id) ON DELETE RESTRICT,
    bundle_kind     text    NOT NULL CHECK (bundle_kind IN ('primary', 'verification')),
    domain          text    NOT NULL CHECK (domain IN (
                                'vocabulary_recognition',
                                'grammar_in_context',
                                'reading_comprehension',
                                'listening_comprehension'
                            )),
    -- Public question payload: snapshot of the safe presentation data at selection time.
    public_snapshot  jsonb  NOT NULL CHECK (jsonb_typeof(public_snapshot)  = 'object'),
    -- Private answer/scoring payload: correct option id, scoring metadata.
    private_snapshot jsonb  NOT NULL CHECK (jsonb_typeof(private_snapshot) = 'object'),
    selected_at     timestamptz NOT NULL DEFAULT now(),

    UNIQUE (attempt_id, position),
    UNIQUE (attempt_id, item_id),

    FOREIGN KEY (attempt_id, user_id, template_id)
        REFERENCES assessment_attempts(id, user_id, template_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id, template_id)
        REFERENCES assessment_items(id, template_id) ON DELETE RESTRICT
);

-- No authenticated-browser read access; service role only.
REVOKE ALL ON assessment_attempt_items FROM authenticated, anon;

CREATE FUNCTION enforce_assessment_attempt_item_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Assessment attempt item snapshots are immutable'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER assessment_attempt_items_append_only
BEFORE UPDATE OR DELETE ON assessment_attempt_items
FOR EACH ROW EXECUTE FUNCTION enforce_assessment_attempt_item_append_only();

COMMENT ON TABLE assessment_attempt_items IS
    'Immutable per-attempt snapshots of selected questions. No browser SELECT grant.';

-- ============================================================
-- 4. assessment_attempts: current_position, one-active uniqueness,
--    method-version→template binding, status immutability
-- ============================================================

ALTER TABLE assessment_attempts
    ADD COLUMN current_position smallint NOT NULL DEFAULT 0
        CHECK (current_position BETWEEN 0 AND 16);

CREATE FUNCTION enforce_assessment_attempt_policy_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE template_method text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.user_id <> OLD.user_id
           OR NEW.user_language_id <> OLD.user_language_id
           OR NEW.template_id <> OLD.template_id
           OR NEW.language_code <> OLD.language_code
           OR NEW.method_version <> OLD.method_version THEN
            RAISE EXCEPTION 'Assessment attempt identity and policy are immutable'
                USING ERRCODE = '23514';
        END IF;
        IF OLD.status <> 'in_progress' AND NEW.status <> OLD.status THEN
            RAISE EXCEPTION 'Assessment attempt terminal status is immutable'
                USING ERRCODE = '23514';
        END IF;
        IF OLD.status = 'in_progress'
           AND NEW.status NOT IN ('in_progress', 'completed', 'abandoned') THEN
            RAISE EXCEPTION 'Assessment attempt status transition is invalid'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    SELECT method_version INTO template_method
    FROM assessment_templates
    WHERE id = NEW.template_id AND language_code = NEW.language_code;
    IF template_method IS NULL OR template_method <> NEW.method_version THEN
        RAISE EXCEPTION 'Assessment attempt policy does not match its template'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER assessment_attempt_policy_binding
BEFORE INSERT OR UPDATE ON assessment_attempts
FOR EACH ROW EXECUTE FUNCTION enforce_assessment_attempt_policy_binding();

-- Partial unique: at most one in_progress attempt per learner × language profile.
CREATE UNIQUE INDEX ix_assessment_attempts_one_active_per_profile
    ON assessment_attempts (user_id, user_language_id)
    WHERE status = 'in_progress';

-- Proof-path: fast lookup of active attempt for a learner.
CREATE INDEX ix_assessment_attempts_profile_status
    ON assessment_attempts (user_id, user_language_id, status);

-- ============================================================
-- 5. NEW: assessment_idempotency_log — actor-scoped replay store
--    No browser SELECT grant.
-- ============================================================

CREATE TABLE assessment_idempotency_log (
    user_id             uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key     uuid    NOT NULL,
    operation           text    NOT NULL CHECK (operation IN ('start', 'answer')),
    schema_version      smallint NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    request_fingerprint text    NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    attempt_id          uuid,
    response_id         uuid,
    http_status         smallint NOT NULL CHECK (http_status IN (200, 201)),
    data_snapshot       jsonb   NOT NULL CHECK (jsonb_typeof(data_snapshot) = 'object'),
    policy_version      text    NOT NULL CHECK (btrim(policy_version) <> ''),
    created_at          timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, idempotency_key),
    CHECK (created_at IS NOT NULL)
);

-- Append-only enforcement.
CREATE FUNCTION enforce_assessment_idempotency_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Assessment idempotency log entries are append-only'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER assessment_idempotency_log_append_only
BEFORE UPDATE OR DELETE ON assessment_idempotency_log
FOR EACH ROW EXECUTE FUNCTION enforce_assessment_idempotency_log_append_only();

-- No browser access; service role only.
REVOKE ALL ON assessment_idempotency_log FROM authenticated, anon;

COMMENT ON TABLE assessment_idempotency_log IS
    'Actor-scoped exact replay store for Assessment start and answer. No browser SELECT grant.';

-- ============================================================
-- 6. assessment_responses: answer discriminator, append-only
-- ============================================================

ALTER TABLE assessment_responses
    ADD COLUMN answer_discriminator text
        CHECK (answer_discriminator IN ('selected', 'skipped'));

-- Backfill: rows where correct IS NOT NULL were selected; correct IS NULL were skipped.
UPDATE assessment_responses
SET answer_discriminator = CASE
    WHEN correct IS NOT NULL THEN 'selected'
    ELSE 'skipped'
END
WHERE answer_discriminator IS NULL;

ALTER TABLE assessment_responses
    ALTER COLUMN answer_discriminator SET NOT NULL;

-- Enforce XOR: selected has non-null correctness; skipped has null correctness.
ALTER TABLE assessment_responses
    DROP CONSTRAINT IF EXISTS assessment_responses_correct_check,
    ADD CONSTRAINT assessment_responses_discriminator_check
        CHECK (
            (answer_discriminator = 'selected' AND correct IS NOT NULL)
            OR
            (answer_discriminator = 'skipped'  AND correct IS NULL)
        ),
    ADD CONSTRAINT assessment_responses_response_shape_check
        CHECK (
            (answer_discriminator = 'selected'
             AND response ? 'selectedOptionId'
             AND NOT (response ? 'skipped'))
            OR
            (answer_discriminator = 'skipped'
             AND response ? 'skipped'
             AND response->>'skipped' = 'true'
             AND NOT (response ? 'selectedOptionId'))
        );

-- Append-only: responses are immutable once recorded.
CREATE FUNCTION enforce_assessment_response_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Assessment responses are immutable'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER assessment_responses_append_only
BEFORE UPDATE OR DELETE ON assessment_responses
FOR EACH ROW EXECUTE FUNCTION enforce_assessment_response_append_only();

-- ============================================================
-- 7. assessment_results: non-null level, band constraint,
--    confidence_band, private_diagnostics, immutability
-- ============================================================

-- Add new columns before making estimated_level_id NOT NULL.
ALTER TABLE assessment_results
    ADD COLUMN confidence_band     text,
    ADD COLUMN private_diagnostics jsonb;

-- Backfill confidence_band from existing framework_mapping JSON (if any).
UPDATE assessment_results
SET confidence_band = CASE
    WHEN confidence < 0.60 THEN 'low'
    WHEN confidence < 0.80 THEN 'medium'
    ELSE 'high'
END
WHERE confidence_band IS NULL;

ALTER TABLE assessment_results
    ALTER COLUMN confidence_band SET NOT NULL,
    ADD CONSTRAINT assessment_results_confidence_band_check
        CHECK (confidence_band IN ('low', 'medium', 'high'));

-- Tighten confidence: 0..0.85 at two-decimal precision.
ALTER TABLE assessment_results
    DROP CONSTRAINT IF EXISTS assessment_results_confidence_check,
    ADD CONSTRAINT assessment_results_confidence_check
        CHECK (confidence BETWEEN 0 AND 0.85 AND confidence = round(confidence, 2));

-- Require non-null level.
ALTER TABLE assessment_results
    ALTER COLUMN estimated_level_id SET NOT NULL;

-- Level must be A0/A1/A2/B1 only (join-enforced via FK; application enforces code).
-- Confidence bounds are numeric (the two-decimal precision check lives here):
ALTER TABLE assessment_results
    ADD CONSTRAINT assessment_results_evidence_count_min
        CHECK (evidence_count >= 6);

-- Append-only: results are historical facts.
CREATE FUNCTION enforce_assessment_result_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Assessment results are immutable'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER assessment_results_append_only
BEFORE UPDATE OR DELETE ON assessment_results
FOR EACH ROW EXECUTE FUNCTION enforce_assessment_result_append_only();

-- ============================================================
-- 8. Proof-path indexes (only the four justified by policy queries)
-- ============================================================

-- Active attempt lookup for a learner + profile (already covered by partial-unique above,
-- but an explicit covering index aids fast reads without the partial-unique scan).
-- ix_assessment_attempts_one_active_per_profile already created above.

-- Current attempt-position lookup (advance/resume operations).
CREATE INDEX ix_assessment_attempt_items_attempt_position
    ON assessment_attempt_items (attempt_id, position);

-- Current completed result: latest per learner + language profile.
CREATE INDEX ix_assessment_results_current
    ON assessment_results (user_id, estimated_at DESC, id DESC);

-- Eligible slot lookup: find items for a given template × level × bundle × slot.
CREATE INDEX ix_assessment_items_slot_lookup
    ON assessment_items (template_id, target_level_id, bundle_kind, slot_index)
    WHERE target_level_id IS NOT NULL
      AND bundle_kind      IS NOT NULL
      AND slot_index       IS NOT NULL;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE assessment_attempt_items IS
    'Immutable per-attempt question snapshots frozen at selection time. Private: no browser grant.';
COMMENT ON TABLE assessment_idempotency_log IS
    'Exact append-only replay authority for Assessment start and answer operations.';
COMMENT ON COLUMN assessment_results.confidence_band IS
    'Bounded public confidence label: low [0,0.60), medium [0.60,0.80), high [0.80,0.85].';
COMMENT ON COLUMN assessment_results.private_diagnostics IS
    'Internal scoring factors (C/M/A/B/K and gate counts). Not exposed in public DTOs.';
COMMENT ON COLUMN assessment_attempts.current_position IS
    'Zero-based count of snapshots already appended; the next position = current_position + 1.';
