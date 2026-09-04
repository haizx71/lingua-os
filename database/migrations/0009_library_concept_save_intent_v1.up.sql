-- TASK-008B: Library API v1 + GAP-01 Memory Activation.
-- Minimal forward migration for immutable first-save intent and canonical Save/Learn source type.
-- Authority: docs/GEMINI_BACKEND_WORKFLOW.md, MASTER_PROJECT.md, TASK-008B.

SET LOCAL search_path = public, pg_catalog;

-- 1. Immutable concept save intents table
CREATE TABLE concept_save_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, concept_id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

-- 2. Immutability trigger for concept_save_intents
CREATE FUNCTION enforce_concept_save_intent_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'Concept save intent history is immutable'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER concept_save_intents_immutable_history
BEFORE UPDATE OR DELETE ON concept_save_intents
FOR EACH ROW EXECUTE FUNCTION enforce_concept_save_intent_immutability();

-- 3. Update learning_events source_type check to permit concept_save_intent
ALTER TABLE learning_events
    DROP CONSTRAINT IF EXISTS learning_events_source_type_check;

ALTER TABLE learning_events
    ADD CONSTRAINT learning_events_source_type_check CHECK (
        source_type IS NULL
        OR source_type IN ('review_event', 'exposure_event', 'assessment_result', 'concept_save_intent')
    );

-- 4. Index on user_saved_concepts for keyset library pagination
CREATE INDEX IF NOT EXISTS ix_saved_concepts_user_saved_at
    ON user_saved_concepts (user_id, saved_at DESC);

-- 5. Row Level Security & permissions
ALTER TABLE concept_save_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY concept_save_intents_select_own ON concept_save_intents
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON concept_save_intents TO authenticated;
REVOKE ALL ON concept_save_intents FROM anon;
