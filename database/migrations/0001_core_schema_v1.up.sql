-- LINGUA OS core PostgreSQL schema v1.
-- Target: Supabase PostgreSQL (auth.uid() and authenticated/anon roles are platform-provided).

SET LOCAL search_path = public, pg_catalog;

CREATE TABLE languages (
    code text PRIMARY KEY CHECK (code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
    name text NOT NULL CHECK (btrim(name) <> ''),
    native_name text NOT NULL CHECK (btrim(native_name) <> ''),
    is_mvp_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE proficiency_frameworks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_-]*$'),
    name text NOT NULL CHECK (btrim(name) <> ''),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE proficiency_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id uuid NOT NULL REFERENCES proficiency_frameworks(id) ON DELETE RESTRICT,
    code text NOT NULL CHECK (btrim(code) <> ''),
    label text NOT NULL CHECK (btrim(label) <> ''),
    rank_order smallint NOT NULL CHECK (rank_order >= 0),
    lower_bound numeric(5,4) CHECK (lower_bound BETWEEN 0 AND 1),
    upper_bound numeric(5,4) CHECK (upper_bound BETWEEN 0 AND 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (framework_id, code),
    UNIQUE (framework_id, rank_order),
    CHECK (lower_bound IS NULL OR upper_bound IS NULL OR lower_bound <= upper_bound)
);

CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE learner_profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name text CHECK (display_name IS NULL OR btrim(display_name) <> ''),
    interface_language_code text NOT NULL DEFAULT 'vi'
        REFERENCES languages(code) ON DELETE RESTRICT,
    time_zone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (btrim(time_zone) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_languages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    interface_language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    goal text NOT NULL CHECK (btrim(goal) <> ''),
    current_level_id uuid REFERENCES proficiency_levels(id) ON DELETE RESTRICT,
    target_level_id uuid REFERENCES proficiency_levels(id) ON DELETE RESTRICT,
    daily_minutes smallint NOT NULL CHECK (daily_minutes BETWEEN 5 AND 180),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, language_code),
    UNIQUE (user_id, id),
    UNIQUE (user_id, id, language_code)
);

CREATE TABLE licenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
    name text NOT NULL CHECK (btrim(name) <> ''),
    canonical_url text,
    usage_policy text NOT NULL CHECK (usage_policy IN ('allowed', 'restricted', 'prohibited', 'unknown')),
    attribution_required boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (canonical_url IS NULL OR canonical_url ~ '^https://')
);

CREATE TABLE data_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (btrim(name) <> ''),
    source_type text NOT NULL CHECK (source_type IN ('internal', 'dictionary', 'corpus', 'publisher', 'user')),
    source_version text NOT NULL CHECK (btrim(source_version) <> ''),
    source_url text,
    license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
    attribution_text text NOT NULL CHECK (btrim(attribution_text) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (name, source_version),
    CHECK (source_url IS NULL OR source_url ~ '^https://')
);

CREATE TABLE source_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    source_record_key text NOT NULL CHECK (btrim(source_record_key) <> ''),
    raw_hash text NOT NULL CHECK (raw_hash ~ '^[0-9a-f]{64}$'),
    transform_version text NOT NULL CHECK (btrim(transform_version) <> ''),
    quality_score numeric(5,4) CHECK (quality_score BETWEEN 0 AND 1),
    review_status text NOT NULL CHECK (
        review_status IN ('raw', 'normalized', 'review_pending', 'approved', 'rejected')
    ),
    imported_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    UNIQUE (source_id, source_record_key, raw_hash),
    CHECK (reviewed_at IS NULL OR reviewed_at >= imported_at),
    CHECK (review_status <> 'approved' OR quality_score IS NOT NULL)
);

CREATE TABLE concepts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    concept_type text NOT NULL CHECK (concept_type IN ('word', 'phrase', 'grammar', 'skill')),
    canonical_key text NOT NULL CHECK (btrim(canonical_key) <> ''),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (language_code, concept_type, canonical_key),
    UNIQUE (id, language_code)
);

CREATE TABLE lexemes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id uuid NOT NULL,
    language_code text NOT NULL,
    lemma text NOT NULL CHECK (btrim(lemma) <> ''),
    normalized_form text NOT NULL CHECK (btrim(normalized_form) <> ''),
    part_of_speech text CHECK (part_of_speech IS NULL OR btrim(part_of_speech) <> ''),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT,
    UNIQUE NULLS NOT DISTINCT (language_code, normalized_form, part_of_speech),
    UNIQUE (id, language_code)
);

CREATE TABLE lexeme_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id uuid NOT NULL REFERENCES lexemes(id) ON DELETE RESTRICT,
    form text NOT NULL CHECK (btrim(form) <> ''),
    normalized_form text NOT NULL CHECK (btrim(normalized_form) <> ''),
    form_type text NOT NULL CHECK (btrim(form_type) <> ''),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lexeme_id, normalized_form, form_type)
);

CREATE TABLE word_senses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id uuid NOT NULL REFERENCES lexemes(id) ON DELETE RESTRICT,
    sense_order smallint NOT NULL CHECK (sense_order >= 1),
    definition text NOT NULL CHECK (btrim(definition) <> ''),
    definition_language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    translated_definition text,
    translation_language_code text REFERENCES languages(code) ON DELETE RESTRICT,
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lexeme_id, sense_order),
    CHECK ((translated_definition IS NULL) = (translation_language_code IS NULL)),
    CHECK (translated_definition IS NULL OR btrim(translated_definition) <> '')
);

CREATE TABLE concept_relations (
    source_concept_id uuid NOT NULL,
    target_concept_id uuid NOT NULL,
    language_code text NOT NULL,
    relation_type text NOT NULL CHECK (
        relation_type IN ('synonym', 'antonym', 'prerequisite', 'family', 'related')
    ),
    weight numeric(5,4) CHECK (weight BETWEEN 0 AND 1),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_concept_id, target_concept_id, relation_type),
    FOREIGN KEY (source_concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (target_concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT,
    CHECK (source_concept_id <> target_concept_id)
);

CREATE TABLE framework_mappings (
    concept_id uuid NOT NULL REFERENCES concepts(id) ON DELETE RESTRICT,
    level_id uuid NOT NULL REFERENCES proficiency_levels(id) ON DELETE RESTRICT,
    confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (concept_id, level_id)
);

CREATE TABLE topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name text NOT NULL CHECK (btrim(name) <> ''),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE concept_topics (
    concept_id uuid NOT NULL REFERENCES concepts(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    PRIMARY KEY (concept_id, topic_id)
);

CREATE TABLE sentences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    text text NOT NULL CHECK (btrim(text) <> ''),
    normalized_text text NOT NULL CHECK (btrim(normalized_text) <> ''),
    difficulty numeric(5,4) CHECK (difficulty BETWEEN 0 AND 1),
    quality_score numeric(5,4) CHECK (quality_score BETWEEN 0 AND 1),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, language_code)
);

CREATE TABLE sentence_translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sentence_id uuid NOT NULL REFERENCES sentences(id) ON DELETE RESTRICT,
    target_language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    text text NOT NULL CHECK (btrim(text) <> ''),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (sentence_id, target_language_code, source_record_id)
);

CREATE TABLE sentence_concepts (
    sentence_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL,
    start_offset integer NOT NULL CHECK (start_offset >= 0),
    end_offset integer NOT NULL CHECK (end_offset > start_offset),
    occurrence_role text NOT NULL DEFAULT 'target'
        CHECK (occurrence_role IN ('target', 'context', 'grammar')),
    PRIMARY KEY (sentence_id, concept_id, start_offset, end_offset),
    FOREIGN KEY (sentence_id, language_code)
        REFERENCES sentences(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE audio_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    storage_uri text NOT NULL CHECK (storage_uri ~ '^(https|s3|supabase)://'),
    duration_ms integer NOT NULL CHECK (duration_ms > 0),
    speaker_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(speaker_metadata) = 'object'),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, language_code)
);

CREATE TABLE sentence_audio (
    sentence_id uuid NOT NULL,
    audio_id uuid NOT NULL,
    language_code text NOT NULL,
    start_ms integer NOT NULL DEFAULT 0 CHECK (start_ms >= 0),
    end_ms integer NOT NULL CHECK (end_ms > start_ms),
    PRIMARY KEY (sentence_id, audio_id, start_ms, end_ms),
    FOREIGN KEY (sentence_id, language_code)
        REFERENCES sentences(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (audio_id, language_code)
        REFERENCES audio_assets(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE content_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    content_type text NOT NULL CHECK (
        content_type IN ('story', 'article', 'dialogue', 'lesson', 'transcript')
    ),
    title text NOT NULL CHECK (btrim(title) <> ''),
    summary text,
    difficulty numeric(5,4) CHECK (difficulty BETWEEN 0 AND 1),
    quality_score numeric(5,4) CHECK (quality_score BETWEEN 0 AND 1),
    publication_status text NOT NULL CHECK (
        publication_status IN (
            'raw', 'normalized', 'enriched', 'reviewed', 'published', 'quarantined', 'retired'
        )
    ),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, language_code),
    CHECK (summary IS NULL OR btrim(summary) <> ''),
    CHECK (publication_status <> 'published' OR quality_score IS NOT NULL),
    CHECK (publication_status <> 'published' OR published_at IS NOT NULL)
);

CREATE FUNCTION enforce_content_publication_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    source_review_status text;
    source_usage_policy text;
BEGIN
    IF NEW.publication_status <> 'published' THEN
        RETURN NEW;
    END IF;

    SELECT source_records.review_status, licenses.usage_policy
      INTO source_review_status, source_usage_policy
      FROM source_records
      JOIN data_sources ON data_sources.id = source_records.source_id
      JOIN licenses ON licenses.id = data_sources.license_id
     WHERE source_records.id = NEW.source_record_id;

    IF source_review_status <> 'approved'
       OR source_usage_policy IN ('prohibited', 'unknown') THEN
        RAISE EXCEPTION 'published content requires approved, usable provenance'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER content_publication_gate
BEFORE INSERT OR UPDATE OF publication_status, source_record_id ON content_items
FOR EACH ROW EXECUTE FUNCTION enforce_content_publication_gate();

CREATE TABLE content_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
    version integer NOT NULL CHECK (version >= 1),
    content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (content_id, version),
    UNIQUE (content_id, content_hash)
);

CREATE TABLE content_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid NOT NULL,
    language_code text NOT NULL,
    order_index integer NOT NULL CHECK (order_index >= 0),
    sentence_id uuid,
    text text NOT NULL CHECK (btrim(text) <> ''),
    audio_id uuid,
    audio_start_ms integer,
    audio_end_ms integer,
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (content_id, order_index),
    UNIQUE (id, language_code),
    FOREIGN KEY (content_id, language_code)
        REFERENCES content_items(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (sentence_id, language_code)
        REFERENCES sentences(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (audio_id, language_code)
        REFERENCES audio_assets(id, language_code) ON DELETE RESTRICT,
    CHECK (
        (audio_id IS NULL AND audio_start_ms IS NULL AND audio_end_ms IS NULL)
        OR
        (audio_id IS NOT NULL AND audio_start_ms IS NOT NULL AND audio_end_ms IS NOT NULL)
    ),
    CHECK (audio_start_ms IS NULL OR (audio_start_ms >= 0 AND audio_end_ms > audio_start_ms))
);

CREATE TABLE content_concepts (
    content_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL,
    occurrence_count integer NOT NULL CHECK (occurrence_count > 0),
    PRIMARY KEY (content_id, concept_id),
    FOREIGN KEY (content_id, language_code)
        REFERENCES content_items(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE content_metrics (
    content_id uuid PRIMARY KEY REFERENCES content_items(id) ON DELETE RESTRICT,
    token_count integer NOT NULL CHECK (token_count >= 0),
    sentence_count integer NOT NULL CHECK (sentence_count >= 0),
    lexical_diversity numeric(5,4) CHECK (lexical_diversity BETWEEN 0 AND 1),
    knownness_prior numeric(5,4) CHECK (knownness_prior BETWEEN 0 AND 1),
    metrics_version text NOT NULL CHECK (btrim(metrics_version) <> ''),
    calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_skill_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    skill text NOT NULL CHECK (skill IN ('recognition', 'listening', 'production')),
    score numeric(5,4) NOT NULL CHECK (score BETWEEN 0 AND 1),
    confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    evidence_count integer NOT NULL CHECK (evidence_count >= 0),
    assessed_at timestamptz NOT NULL DEFAULT now(),
    method_version text NOT NULL CHECK (btrim(method_version) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_language_id, skill),
    FOREIGN KEY (user_id, user_language_id)
        REFERENCES user_languages(user_id, id) ON DELETE CASCADE
);

CREATE TABLE user_concept_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    status text NOT NULL CHECK (
        status IN ('unseen', 'discovered', 'learning', 'familiar', 'active', 'mastered', 'weak', 'forgotten')
    ),
    recognition numeric(5,4) CHECK (recognition BETWEEN 0 AND 1),
    listening numeric(5,4) CHECK (listening BETWEEN 0 AND 1),
    production numeric(5,4) CHECK (production BETWEEN 0 AND 1),
    mastery numeric(5,4) CHECK (mastery BETWEEN 0 AND 1),
    confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
    exposure_count integer NOT NULL DEFAULT 0 CHECK (exposure_count >= 0),
    last_seen_at timestamptz,
    state_version integer NOT NULL CHECK (state_version >= 1),
    projection_method_version text NOT NULL DEFAULT 'uninitialized'
        CHECK (btrim(projection_method_version) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, concept_id),
    UNIQUE (user_id, id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE learning_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    event_type text NOT NULL CHECK (
        event_type IN (
            'learning.review.completed.v1',
            'learning.exposure.recorded.v1',
            'learning.concept.saved.v1',
            'assessment.completed.v1',
            'today.activity.completed.v1'
        )
    ),
    concept_id uuid,
    content_id uuid,
    activity_id uuid,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
    schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    idempotency_key text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (content_id, language_code)
        REFERENCES content_items(id, language_code) ON DELETE RESTRICT,
    CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '')
);

CREATE TABLE exposure_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    exposure_type text NOT NULL CHECK (exposure_type IN ('read', 'listen', 'lookup', 'save')),
    concept_id uuid,
    content_id uuid,
    sentence_id uuid,
    content_segment_id uuid,
    duration_ms integer CHECK (duration_ms >= 0),
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
    idempotency_key text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (content_id, language_code)
        REFERENCES content_items(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (sentence_id, language_code)
        REFERENCES sentences(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (content_segment_id, language_code)
        REFERENCES content_segments(id, language_code) ON DELETE RESTRICT,
    CHECK (
        concept_id IS NOT NULL OR content_id IS NOT NULL OR sentence_id IS NOT NULL
        OR content_segment_id IS NOT NULL
    ),
    CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '')
);

CREATE TABLE fsrs_parameter_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope text NOT NULL CHECK (scope IN ('global', 'language')),
    language_code text REFERENCES languages(code) ON DELETE RESTRICT,
    version text NOT NULL CHECK (btrim(version) <> ''),
    parameters jsonb NOT NULL CHECK (jsonb_typeof(parameters) = 'object'),
    trained_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (scope, language_code, version),
    UNIQUE (id, version),
    CHECK ((scope = 'global' AND language_code IS NULL) OR (scope = 'language' AND language_code IS NOT NULL))
);

CREATE TABLE review_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    status text NOT NULL CHECK (status IN ('active', 'suspended', 'retired')),
    created_from text NOT NULL CHECK (created_from IN ('learner_saved', 'evidence_threshold', 'placement')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, concept_id),
    UNIQUE (id, user_id),
    UNIQUE (id, user_id, language_code),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE fsrs_states (
    review_item_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    difficulty numeric(7,4) NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
    stability numeric(12,4) NOT NULL CHECK (stability > 0),
    due_at timestamptz NOT NULL,
    last_review_at timestamptz,
    state text NOT NULL CHECK (state IN ('new', 'learning', 'review', 'relearning')),
    parameter_set_id uuid NOT NULL,
    params_version text NOT NULL CHECK (btrim(params_version) <> ''),
    state_version integer NOT NULL DEFAULT 1 CHECK (state_version >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (review_item_id, user_id)
        REFERENCES review_items(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_set_id, params_version)
        REFERENCES fsrs_parameter_sets(id, version) ON DELETE RESTRICT,
    CHECK (last_review_at IS NULL OR due_at >= last_review_at)
);

CREATE TABLE review_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_item_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_mode text NOT NULL CHECK (
        exercise_mode IN ('recognition', 'listening', 'cloze', 'production')
    ),
    rating text NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    response_time_ms integer CHECK (response_time_ms >= 0),
    correct boolean NOT NULL,
    evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence_json) = 'object'),
    idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    FOREIGN KEY (review_item_id, user_id)
        REFERENCES review_items(id, user_id) ON DELETE CASCADE
);

CREATE TABLE user_saved_concepts (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, concept_id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE user_saved_content (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    content_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, content_id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (content_id, language_code)
        REFERENCES content_items(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE user_saved_sentences (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    sentence_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, sentence_id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (sentence_id, language_code)
        REFERENCES sentences(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE today_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    plan_date date NOT NULL,
    time_zone text NOT NULL CHECK (btrim(time_zone) <> ''),
    daily_minutes smallint NOT NULL CHECK (daily_minutes BETWEEN 5 AND 180),
    new_concept_budget smallint NOT NULL CHECK (new_concept_budget >= 0),
    engine_version text NOT NULL CHECK (btrim(engine_version) <> ''),
    status text NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'expired')),
    generated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    UNIQUE (id, user_id, language_code),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_today_plans_active_day
    ON today_plans (user_id, user_language_id, plan_date)
    WHERE status = 'active';

CREATE TABLE today_plan_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language_code text NOT NULL DEFAULT 'en',
    activity_type text NOT NULL CHECK (activity_type IN ('review', 'read', 'listen', 'learn')),
    position smallint NOT NULL CHECK (position >= 0),
    estimated_minutes smallint NOT NULL CHECK (estimated_minutes > 0),
    reason_codes text[] NOT NULL CHECK (
        cardinality(reason_codes) > 0 AND reason_codes <@ ARRAY[
            'FSRS_DUE', 'WEAK_RECOGNITION', 'WEAK_LISTENING',
            'LOW_PRODUCTION_EVIDENCE', 'CONTENT_FIT', 'RECENT_EXPOSURE',
            'NEW_CONCEPT_BUDGET'
        ]::text[]
    ),
    concept_id uuid,
    content_id uuid,
    review_item_id uuid,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    idempotency_key text,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plan_id, position),
    UNIQUE (user_id, idempotency_key),
    FOREIGN KEY (plan_id, user_id, language_code)
        REFERENCES today_plans(id, user_id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (review_item_id, user_id, language_code)
        REFERENCES review_items(id, user_id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (content_id, language_code)
        REFERENCES content_items(id, language_code) ON DELETE RESTRICT,
    CHECK (concept_id IS NOT NULL OR content_id IS NOT NULL OR review_item_id IS NOT NULL),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
    CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '')
);

CREATE TABLE assessment_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT,
    name text NOT NULL CHECK (btrim(name) <> ''),
    method_version text NOT NULL CHECK (btrim(method_version) <> ''),
    status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (language_code, name, method_version),
    UNIQUE (id, language_code)
);

CREATE TABLE assessment_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    skill text NOT NULL CHECK (skill IN ('recognition', 'listening', 'production')),
    difficulty_prior numeric(5,4) NOT NULL CHECK (difficulty_prior BETWEEN 0 AND 1),
    prompt_schema jsonb NOT NULL CHECK (jsonb_typeof(prompt_schema) = 'object'),
    answer_schema jsonb NOT NULL CHECK (jsonb_typeof(answer_schema) = 'object'),
    source_record_id uuid NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
    item_version integer NOT NULL DEFAULT 1 CHECK (item_version >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, template_id),
    UNIQUE (id, language_code),
    FOREIGN KEY (template_id, language_code)
        REFERENCES assessment_templates(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE assessment_item_concepts (
    item_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    PRIMARY KEY (item_id, concept_id),
    FOREIGN KEY (item_id, language_code)
        REFERENCES assessment_items(id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE TABLE assessment_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    template_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    method_version text NOT NULL CHECK (btrim(method_version) <> ''),
    adaptive_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(adaptive_state) = 'object'),
    idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id, template_id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (template_id, language_code)
        REFERENCES assessment_templates(id, language_code) ON DELETE RESTRICT,
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE TABLE assessment_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id uuid NOT NULL,
    item_id uuid NOT NULL,
    response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
    correct boolean,
    response_time_ms integer CHECK (response_time_ms >= 0),
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
    idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
    responded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (attempt_id, item_id),
    FOREIGN KEY (attempt_id, user_id, template_id)
        REFERENCES assessment_attempts(id, user_id, template_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id, template_id)
        REFERENCES assessment_items(id, template_id) ON DELETE RESTRICT
);

CREATE TABLE assessment_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id uuid NOT NULL,
    estimated_score numeric(5,4) NOT NULL CHECK (estimated_score BETWEEN 0 AND 1),
    estimated_level_id uuid REFERENCES proficiency_levels(id) ON DELETE RESTRICT,
    confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    evidence_count integer NOT NULL CHECK (evidence_count >= 0),
    assessed_skills text[] NOT NULL CHECK (
        cardinality(assessed_skills) > 0 AND assessed_skills <@
        ARRAY['recognition', 'listening', 'production']::text[]
    ),
    method_version text NOT NULL CHECK (btrim(method_version) <> ''),
    framework_mapping jsonb CHECK (
        framework_mapping IS NULL OR jsonb_typeof(framework_mapping) = 'object'
    ),
    estimated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (attempt_id),
    FOREIGN KEY (attempt_id, user_id, template_id)
        REFERENCES assessment_attempts(id, user_id, template_id) ON DELETE CASCADE
);

CREATE INDEX ix_lexemes_lookup ON lexemes (language_code, normalized_form);
CREATE INDEX ix_concept_relations_target ON concept_relations (target_concept_id, relation_type);
CREATE INDEX ix_framework_mappings_level ON framework_mappings (level_id, concept_id);
CREATE INDEX ix_sentence_concepts_concept ON sentence_concepts (concept_id, sentence_id);
CREATE INDEX ix_content_segments_content_order ON content_segments (content_id, order_index);
CREATE INDEX ix_content_concepts_concept ON content_concepts (concept_id, content_id);
CREATE INDEX ix_content_items_recommendation
    ON content_items (language_code, publication_status, difficulty)
    WHERE publication_status = 'published';
CREATE INDEX ix_user_skill_states_user ON user_skill_states (user_id, user_language_id);
CREATE INDEX ix_user_concept_states_user_status
    ON user_concept_states (user_id, user_language_id, status);
CREATE INDEX ix_learning_events_user_occurred_at
    ON learning_events (user_id, occurred_at DESC);
CREATE INDEX ix_learning_events_concept_occurred_at
    ON learning_events (concept_id, occurred_at DESC) WHERE concept_id IS NOT NULL;
CREATE INDEX ix_exposure_events_user_occurred_at
    ON exposure_events (user_id, occurred_at DESC);
CREATE INDEX ix_review_items_user_status ON review_items (user_id, status);
CREATE INDEX ix_fsrs_states_due_at ON fsrs_states (due_at, review_item_id);
CREATE INDEX ix_fsrs_states_user_id ON fsrs_states (user_id);
CREATE INDEX ix_review_events_user_reviewed_at ON review_events (user_id, reviewed_at DESC);
CREATE INDEX ix_saved_content_user_saved_at ON user_saved_content (user_id, saved_at DESC);
CREATE INDEX ix_saved_sentences_user_saved_at ON user_saved_sentences (user_id, saved_at DESC);
CREATE INDEX ix_today_plans_user_plan_date ON today_plans (user_id, plan_date DESC);
CREATE INDEX ix_today_plan_activities_plan_position
    ON today_plan_activities (plan_id, position);
CREATE INDEX ix_assessment_attempts_user_started_at
    ON assessment_attempts (user_id, started_at DESC);
CREATE INDEX ix_assessment_results_user_estimated_at
    ON assessment_results (user_id, estimated_at DESC);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skill_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_concept_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exposure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsrs_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE today_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE today_plan_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);
CREATE POLICY learner_profiles_select_own ON learner_profiles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_languages_select_own ON user_languages FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_skill_states_select_own ON user_skill_states FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_concept_states_select_own ON user_concept_states FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY learning_events_select_own ON learning_events FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY exposure_events_select_own ON exposure_events FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY review_items_select_own ON review_items FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY fsrs_states_select_own ON fsrs_states FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY review_events_select_own ON review_events FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_saved_concepts_select_own ON user_saved_concepts FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_saved_content_select_own ON user_saved_content FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_saved_sentences_select_own ON user_saved_sentences FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY today_plans_select_own ON today_plans FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY today_plan_activities_select_own ON today_plan_activities FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY assessment_attempts_select_own ON assessment_attempts FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY assessment_responses_select_own ON assessment_responses FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY assessment_results_select_own ON assessment_results FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON users, learner_profiles, user_languages, user_skill_states,
    user_concept_states, learning_events, exposure_events, review_items, fsrs_states,
    review_events, user_saved_concepts, user_saved_content, user_saved_sentences,
    today_plans, today_plan_activities, assessment_attempts, assessment_responses,
    assessment_results TO authenticated;

REVOKE ALL ON users, learner_profiles, user_languages, user_skill_states,
    user_concept_states, learning_events, exposure_events, review_items, fsrs_states,
    review_events, user_saved_concepts, user_saved_content, user_saved_sentences,
    today_plans, today_plan_activities, assessment_attempts, assessment_responses,
    assessment_results FROM anon;

INSERT INTO languages (code, name, native_name, is_mvp_enabled)
VALUES
    ('en', 'English', 'English', true),
    ('vi', 'Vietnamese', 'Tiếng Việt', true);

INSERT INTO proficiency_frameworks (id, code, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'CEFR', 'Common European Framework of Reference');

INSERT INTO proficiency_levels
    (id, framework_id, code, label, rank_order, lower_bound, upper_bound)
VALUES
    ('00000000-0000-4000-8100-000000000000', '00000000-0000-4000-8000-000000000001',
     'A0', 'Pre-A1 foundation', 0, 0.0000, 0.1999),
    ('00000000-0000-4000-8100-000000000001', '00000000-0000-4000-8000-000000000001',
     'A1', 'Beginner', 1, 0.2000, 0.3999),
    ('00000000-0000-4000-8100-000000000002', '00000000-0000-4000-8000-000000000001',
     'A2', 'Elementary', 2, 0.4000, 0.6499),
    ('00000000-0000-4000-8100-000000000003', '00000000-0000-4000-8000-000000000001',
     'B1', 'Intermediate', 3, 0.6500, 0.7999);
