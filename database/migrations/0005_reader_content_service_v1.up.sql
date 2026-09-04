-- TASK-008: Reader/content publication, progress, idempotency and exposure fan-out authority.

SET LOCAL search_path = public, pg_catalog;

DROP TRIGGER content_publication_gate ON content_items;
DROP FUNCTION enforce_content_publication_gate();

ALTER TABLE content_items
    ADD COLUMN curated_level_id uuid REFERENCES proficiency_levels(id) ON DELETE RESTRICT,
    ADD COLUMN reviewed_at timestamptz,
    ADD CONSTRAINT content_items_review_timeline_check CHECK (
        reviewed_at IS NULL OR reviewed_at >= created_at
    ),
    ADD CONSTRAINT content_items_publish_review_check CHECK (
        publication_status <> 'published'
        OR (reviewed_at IS NOT NULL AND reviewed_at <= published_at)
    );

ALTER TABLE content_segments
    ADD COLUMN segment_type text NOT NULL DEFAULT 'sentence'
        CHECK (segment_type IN ('sentence', 'paragraph', 'dialogue_turn', 'caption')),
    ADD CONSTRAINT content_segments_identity_unique UNIQUE (id, content_id, language_code);

CREATE FUNCTION utf16_code_unit_length(value text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT COALESCE(sum(CASE WHEN ascii(substr(value, position, 1)) > 65535 THEN 2 ELSE 1 END), 0)::integer
    FROM generate_series(1, char_length(value)) AS position
$$;

CREATE FUNCTION reader_source_record_is_allowed(record_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SET search_path = public, pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM source_records AS record
        JOIN data_sources AS source ON source.id = record.source_id
        JOIN licenses AS license ON license.id = source.license_id
        WHERE record.id = record_id
          AND record.review_status = 'approved'
          AND record.quality_score IS NOT NULL
          AND license.usage_policy = 'allowed'
          AND btrim(source.attribution_text) <> ''
          AND (NOT license.attribution_required OR btrim(source.attribution_text) <> '')
    )
$$;

CREATE FUNCTION reader_content_passes_publication_gate(candidate_content_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
    item content_items%ROWTYPE;
    curated_level_code text;
    curated_lower_bound numeric;
    curated_upper_bound numeric;
    segment_count integer;
    metric_sentence_count integer;
    metric_token_count integer;
BEGIN
    SELECT * INTO item FROM content_items WHERE id = candidate_content_id;
    SELECT level.code, level.lower_bound, level.upper_bound
      INTO curated_level_code, curated_lower_bound, curated_upper_bound
    FROM proficiency_levels AS level
    WHERE level.id = item.curated_level_id;
    IF NOT FOUND
       OR item.publication_status <> 'published'
       OR item.language_code <> 'en'
       OR curated_level_code NOT IN ('A0', 'A1', 'A2', 'B1')
       OR item.difficulty IS NULL
       OR item.difficulty NOT BETWEEN curated_lower_bound AND curated_upper_bound
       OR item.quality_score IS NULL
       OR item.reviewed_at IS NULL
       OR item.published_at IS NULL
       OR item.reviewed_at > item.published_at
       OR NOT reader_source_record_is_allowed(item.source_record_id) THEN
        RETURN false;
    END IF;

    IF (SELECT count(*) FROM content_versions WHERE content_id = candidate_content_id) <> 1 THEN
        RETURN false;
    END IF;

    SELECT count(*), min(metrics.sentence_count), min(metrics.token_count)
      INTO segment_count, metric_sentence_count, metric_token_count
      FROM content_segments AS segment
      LEFT JOIN content_metrics AS metrics ON metrics.content_id = segment.content_id
     WHERE segment.content_id = candidate_content_id;

    IF segment_count NOT BETWEEN 1 AND 100
       OR metric_sentence_count IS DISTINCT FROM segment_count
       OR metric_token_count IS NULL
       OR metric_token_count > 20000
       OR (SELECT min(order_index) FROM content_segments
            WHERE content_id = candidate_content_id) <> 0
       OR (SELECT max(order_index) FROM content_segments
            WHERE content_id = candidate_content_id) <> segment_count - 1 THEN
        RETURN false;
    END IF;

    IF metric_token_count <> (
        SELECT COALESCE(sum(array_length(regexp_split_to_array(btrim(segment.text), '\s+'), 1)), 0)
        FROM content_segments AS segment
        WHERE segment.content_id = candidate_content_id
    ) OR EXISTS (
        SELECT 1
        FROM content_metrics AS metrics
        WHERE metrics.content_id = candidate_content_id
          AND metrics.calculated_at < (
              SELECT max(segment.created_at) FROM content_segments AS segment
              WHERE segment.content_id = candidate_content_id
          )
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM content_segments AS segment
        JOIN sentences AS sentence ON sentence.id = segment.sentence_id
        WHERE segment.content_id = candidate_content_id
          AND (
              segment.language_code <> item.language_code
              OR sentence.language_code <> item.language_code
              OR segment.text <> sentence.text
              OR segment.sentence_id IS NULL
              OR (segment.audio_id IS NOT NULL AND segment.audio_end_ms <= segment.audio_start_ms)
          )
    ) OR EXISTS (
        SELECT 1 FROM content_segments
        WHERE content_id = candidate_content_id AND sentence_id IS NULL
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM content_segments AS segment
        JOIN sentence_concepts AS left_occurrence
          ON left_occurrence.sentence_id = segment.sentence_id
        JOIN sentence_concepts AS right_occurrence
          ON right_occurrence.sentence_id = left_occurrence.sentence_id
         AND (left_occurrence.concept_id, left_occurrence.start_offset,
              left_occurrence.end_offset)
             < (right_occurrence.concept_id, right_occurrence.start_offset,
                right_occurrence.end_offset)
        WHERE segment.content_id = candidate_content_id
          AND left_occurrence.start_offset < right_occurrence.end_offset
          AND right_occurrence.start_offset < left_occurrence.end_offset
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM content_segments AS segment
        JOIN audio_assets AS audio ON audio.id = segment.audio_id
        WHERE segment.content_id = candidate_content_id
          AND (segment.audio_start_ms < 0 OR segment.audio_end_ms > audio.duration_ms)
    ) OR EXISTS (
        SELECT 1
        FROM content_segments AS segment
        JOIN sentence_audio AS link ON link.sentence_id = segment.sentence_id
        JOIN audio_assets AS audio ON audio.id = link.audio_id
        WHERE segment.content_id = candidate_content_id
          AND (link.start_ms < 0 OR link.end_ms > audio.duration_ms)
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM content_segments AS segment
        JOIN sentences AS sentence ON sentence.id = segment.sentence_id
        LEFT JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = sentence.id
        WHERE segment.content_id = candidate_content_id
        GROUP BY segment.id, sentence.id
        HAVING count(occurrence.concept_id) = 0
           OR bool_or(
                occurrence.language_code <> item.language_code
                OR occurrence.start_offset < 0
                OR occurrence.end_offset <= occurrence.start_offset
                OR occurrence.end_offset > utf16_code_unit_length(sentence.text)
           )
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        WITH actual AS (
            SELECT occurrence.concept_id, count(*)::integer AS occurrence_count
            FROM content_segments AS segment
            JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = segment.sentence_id
            WHERE segment.content_id = candidate_content_id
            GROUP BY occurrence.concept_id
        ), declared AS (
            SELECT concept_id, occurrence_count, language_code
            FROM content_concepts
            WHERE content_id = candidate_content_id
        )
        SELECT 1
        FROM actual
        FULL JOIN declared ON declared.concept_id = actual.concept_id
        WHERE actual.concept_id IS NULL
           OR declared.concept_id IS NULL
           OR actual.occurrence_count <> declared.occurrence_count
           OR declared.language_code <> item.language_code
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM content_concepts AS linked
        JOIN concepts AS concept ON concept.id = linked.concept_id
        WHERE linked.content_id = candidate_content_id
          AND concept.concept_type IN ('word', 'phrase')
          AND NOT EXISTS (SELECT 1 FROM lexemes WHERE concept_id = concept.id)
    ) THEN
        RETURN false;
    END IF;

    IF EXISTS (
        WITH dependency_records AS (
            SELECT item.source_record_id AS id
            UNION SELECT version.source_record_id FROM content_versions AS version
             WHERE version.content_id = candidate_content_id
            UNION SELECT segment.source_record_id FROM content_segments AS segment
             WHERE segment.content_id = candidate_content_id
            UNION SELECT sentence.source_record_id
              FROM content_segments AS segment JOIN sentences AS sentence ON sentence.id = segment.sentence_id
             WHERE segment.content_id = candidate_content_id
            UNION SELECT translation.source_record_id
              FROM content_segments AS segment
              JOIN sentence_translations AS translation ON translation.sentence_id = segment.sentence_id
             WHERE segment.content_id = candidate_content_id
            UNION SELECT concept.source_record_id
              FROM content_concepts AS linked JOIN concepts AS concept ON concept.id = linked.concept_id
             WHERE linked.content_id = candidate_content_id
            UNION SELECT lexeme.source_record_id
              FROM content_concepts AS linked JOIN lexemes AS lexeme ON lexeme.concept_id = linked.concept_id
             WHERE linked.content_id = candidate_content_id
            UNION SELECT sense.source_record_id
              FROM content_concepts AS linked
              JOIN lexemes AS lexeme ON lexeme.concept_id = linked.concept_id
              JOIN word_senses AS sense ON sense.lexeme_id = lexeme.id
             WHERE linked.content_id = candidate_content_id
            UNION SELECT audio.source_record_id
              FROM content_segments AS segment JOIN audio_assets AS audio ON audio.id = segment.audio_id
             WHERE segment.content_id = candidate_content_id
            UNION SELECT audio.source_record_id
              FROM content_segments AS segment
              JOIN sentence_audio AS link ON link.sentence_id = segment.sentence_id
              JOIN audio_assets AS audio ON audio.id = link.audio_id
             WHERE segment.content_id = candidate_content_id
        )
        SELECT 1 FROM dependency_records
        WHERE reader_source_record_is_allowed(id) IS DISTINCT FROM true
    ) THEN
        RETURN false;
    END IF;

    IF (
        WITH dependency_records AS (
            SELECT item.source_record_id AS id
            UNION SELECT version.source_record_id FROM content_versions AS version
             WHERE version.content_id = candidate_content_id
            UNION SELECT segment.source_record_id FROM content_segments AS segment
             WHERE segment.content_id = candidate_content_id
            UNION SELECT sentence.source_record_id
              FROM content_segments AS segment JOIN sentences AS sentence ON sentence.id = segment.sentence_id
             WHERE segment.content_id = candidate_content_id
            UNION SELECT concept.source_record_id
              FROM content_concepts AS linked JOIN concepts AS concept ON concept.id = linked.concept_id
             WHERE linked.content_id = candidate_content_id
            UNION SELECT translation.source_record_id
              FROM content_segments AS segment
              JOIN sentence_translations AS translation ON translation.sentence_id = segment.sentence_id
             WHERE segment.content_id = candidate_content_id
            UNION SELECT lexeme.source_record_id
              FROM content_concepts AS linked JOIN lexemes AS lexeme ON lexeme.concept_id = linked.concept_id
             WHERE linked.content_id = candidate_content_id
            UNION SELECT sense.source_record_id
              FROM content_concepts AS linked
              JOIN lexemes AS lexeme ON lexeme.concept_id = linked.concept_id
              JOIN word_senses AS sense ON sense.lexeme_id = lexeme.id
             WHERE linked.content_id = candidate_content_id
            UNION SELECT audio.source_record_id
              FROM content_segments AS segment JOIN audio_assets AS audio ON audio.id = segment.audio_id
             WHERE segment.content_id = candidate_content_id
            UNION SELECT audio.source_record_id
              FROM content_segments AS segment
              JOIN sentence_audio AS link ON link.sentence_id = segment.sentence_id
              JOIN audio_assets AS audio ON audio.id = link.audio_id
             WHERE segment.content_id = candidate_content_id
        )
        SELECT count(DISTINCT concat_ws('|', source.name, license.code, source.attribution_text,
                                        COALESCE(source.source_url, '')))
        FROM dependency_records AS dependency
        JOIN source_records AS record ON record.id = dependency.id
        JOIN data_sources AS source ON source.id = record.source_id
        JOIN licenses AS license ON license.id = source.license_id
        WHERE license.attribution_required
    ) > 1 THEN
        RETURN false;
    END IF;

    RETURN true;
END
$$;

CREATE FUNCTION enforce_reader_content_publication_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.publication_status = 'published'
       AND NOT reader_content_passes_publication_gate(NEW.id) THEN
        RAISE EXCEPTION 'published Reader content fails the complete dependency gate'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER content_publication_gate
AFTER INSERT OR UPDATE OF publication_status, source_record_id, curated_level_id, reviewed_at,
    published_at, quality_score ON content_items
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION enforce_reader_content_publication_gate();

CREATE FUNCTION enforce_published_reader_structure_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    old_content_id uuid;
    new_content_id uuid;
    old_sentence_id uuid;
    new_sentence_id uuid;
    old_audio_id uuid;
    new_audio_id uuid;
BEGIN
    IF TG_TABLE_NAME IN ('content_versions', 'content_segments', 'content_concepts',
                         'content_metrics') THEN
        IF TG_OP <> 'INSERT' THEN old_content_id := OLD.content_id; END IF;
        IF TG_OP <> 'DELETE' THEN new_content_id := NEW.content_id; END IF;
        IF EXISTS (
            SELECT 1 FROM content_items
            WHERE publication_status = 'published'
              AND id IN (old_content_id, new_content_id)
        ) THEN
            RAISE EXCEPTION 'published Reader content structure is immutable'
                USING ERRCODE = '23514';
        END IF;
    ELSIF TG_TABLE_NAME = 'sentences' THEN
        IF TG_OP <> 'INSERT' THEN old_sentence_id := OLD.id; END IF;
        IF TG_OP <> 'DELETE' THEN new_sentence_id := NEW.id; END IF;
    ELSIF TG_TABLE_NAME IN ('sentence_translations', 'sentence_concepts', 'sentence_audio') THEN
        IF TG_OP <> 'INSERT' THEN old_sentence_id := OLD.sentence_id; END IF;
        IF TG_OP <> 'DELETE' THEN new_sentence_id := NEW.sentence_id; END IF;
    ELSIF TG_TABLE_NAME = 'audio_assets' THEN
        IF TG_OP <> 'INSERT' THEN old_audio_id := OLD.id; END IF;
        IF TG_OP <> 'DELETE' THEN new_audio_id := NEW.id; END IF;
    END IF;

    IF old_sentence_id IS NOT NULL OR new_sentence_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM content_segments AS segment
            JOIN content_items AS item ON item.id = segment.content_id
            WHERE item.publication_status = 'published'
              AND segment.sentence_id IN (old_sentence_id, new_sentence_id)
        ) THEN
            RAISE EXCEPTION 'published Reader sentence structure is immutable'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF old_audio_id IS NOT NULL OR new_audio_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM content_segments AS segment
            JOIN content_items AS item ON item.id = segment.content_id
            WHERE item.publication_status = 'published'
              AND (
                  segment.audio_id IN (old_audio_id, new_audio_id)
                  OR EXISTS (
                      SELECT 1 FROM sentence_audio AS link
                      WHERE link.sentence_id = segment.sentence_id
                        AND link.audio_id IN (old_audio_id, new_audio_id)
                  )
              )
        ) THEN
            RAISE EXCEPTION 'published Reader audio structure is immutable'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER content_versions_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON content_versions
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER content_segments_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON content_segments
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER content_concepts_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON content_concepts
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER content_metrics_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON content_metrics
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER sentences_published_immutable
BEFORE UPDATE OR DELETE ON sentences
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER sentence_translations_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON sentence_translations
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER sentence_concepts_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON sentence_concepts
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER sentence_audio_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON sentence_audio
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();
CREATE TRIGGER audio_assets_published_immutable
BEFORE UPDATE OR DELETE ON audio_assets
FOR EACH ROW EXECUTE FUNCTION enforce_published_reader_structure_immutability();

CREATE TABLE user_content_progress (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_language_id uuid NOT NULL,
    content_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    current_segment_id uuid NOT NULL,
    furthest_segment_id uuid NOT NULL,
    started_at timestamptz NOT NULL,
    last_opened_at timestamptz NOT NULL,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, content_id),
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (current_segment_id, content_id, language_code)
        REFERENCES content_segments(id, content_id, language_code) ON DELETE RESTRICT,
    FOREIGN KEY (furthest_segment_id, content_id, language_code)
        REFERENCES content_segments(id, content_id, language_code) ON DELETE RESTRICT,
    CHECK (last_opened_at >= started_at),
    CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE reader_mutation_results (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key uuid NOT NULL,
    operation_type text NOT NULL CHECK (operation_type IN ('progress', 'save_sentence')),
    request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    resource_id uuid NOT NULL,
    result_snapshot jsonb NOT NULL CHECK (jsonb_typeof(result_snapshot) = 'object'),
    completed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, idempotency_key)
);

ALTER TABLE exposure_events
    ADD COLUMN request_fingerprint text CHECK (
        request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    ADD COLUMN result_snapshot jsonb CHECK (
        result_snapshot IS NULL OR (
            jsonb_typeof(result_snapshot) = 'object'
            AND result_snapshot ?& ARRAY[
                'exposureId', 'contentId', 'segmentId', 'exposureType',
                'acceptedConceptCount', 'occurredAt', 'recordedAt'
            ]
        )
    ),
    ADD CONSTRAINT exposure_events_reader_result_all_or_none CHECK (
        (request_fingerprint IS NULL AND result_snapshot IS NULL)
        OR (request_fingerprint IS NOT NULL AND result_snapshot IS NOT NULL)
    ),
    ADD CONSTRAINT exposure_events_reader_source_shape CHECK (
        request_fingerprint IS NULL
        OR (
            exposure_type IN ('read', 'listen', 'lookup')
            AND concept_id IS NULL
            AND content_id IS NOT NULL
            AND content_segment_id IS NOT NULL
            AND idempotency_key IS NOT NULL
            AND (
                (exposure_type IN ('read', 'listen') AND sentence_id IS NULL)
                OR (exposure_type = 'lookup' AND sentence_id IS NOT NULL)
            )
        )
    ),
    ADD CONSTRAINT exposure_events_reader_identity_unique
        UNIQUE (id, user_id, user_language_id, language_code);

CREATE TABLE reader_exposure_concepts (
    exposure_event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_language_id uuid NOT NULL,
    language_code text NOT NULL DEFAULT 'en',
    concept_id uuid NOT NULL,
    derivation_key text NOT NULL CHECK (derivation_key = 'concept:' || concept_id::text),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (exposure_event_id, concept_id),
    UNIQUE (user_id, exposure_event_id, derivation_key),
    FOREIGN KEY (exposure_event_id, user_id, user_language_id, language_code)
        REFERENCES exposure_events(id, user_id, user_language_id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (user_id, user_language_id, language_code)
        REFERENCES user_languages(user_id, id, language_code) ON DELETE CASCADE,
    FOREIGN KEY (concept_id, language_code)
        REFERENCES concepts(id, language_code) ON DELETE RESTRICT
);

CREATE FUNCTION enforce_reader_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_TABLE_NAME = 'exposure_events' THEN
        IF OLD.request_fingerprint IS NULL THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Reader source facts and replay snapshots are append-only'
        USING ERRCODE = '23514';
END
$$;

CREATE TRIGGER exposure_events_reader_append_only
BEFORE UPDATE OR DELETE ON exposure_events
FOR EACH ROW EXECUTE FUNCTION enforce_reader_history_append_only();
CREATE TRIGGER reader_exposure_concepts_append_only
BEFORE UPDATE OR DELETE ON reader_exposure_concepts
FOR EACH ROW EXECUTE FUNCTION enforce_reader_history_append_only();
CREATE TRIGGER reader_mutation_results_append_only
BEFORE UPDATE OR DELETE ON reader_mutation_results
FOR EACH ROW EXECUTE FUNCTION enforce_reader_history_append_only();

CREATE INDEX ix_content_items_reader_catalog
    ON content_items (curated_level_id, difficulty, id)
    WHERE publication_status = 'published';
CREATE INDEX ix_user_content_progress_profile
    ON user_content_progress (user_id, user_language_id, last_opened_at DESC, content_id);
CREATE INDEX ix_reader_exposure_concepts_profile
    ON reader_exposure_concepts (user_id, user_language_id, concept_id, exposure_event_id);

ALTER TABLE user_content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_mutation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_exposure_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_content_progress_select_own
    ON user_content_progress FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY reader_mutation_results_select_own
    ON reader_mutation_results FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
CREATE POLICY reader_exposure_concepts_select_own
    ON reader_exposure_concepts FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON user_content_progress, reader_mutation_results, reader_exposure_concepts
    TO authenticated;
REVOKE ALL ON user_content_progress, reader_mutation_results, reader_exposure_concepts FROM anon;

COMMENT ON FUNCTION reader_content_passes_publication_gate(uuid) IS
    'Fail-closed Reader visibility predicate; runtime reads must apply it in addition to published status.';
COMMENT ON TABLE user_content_progress IS
    'Sole learner x content segment-level resume and completion projection.';
COMMENT ON TABLE reader_exposure_concepts IS
    'Stable source Reader interaction to distinct canonical concept fan-out identities.';
COMMENT ON COLUMN exposure_events.result_snapshot IS
    'Exact immutable public Reader exposure result used for delayed idempotent replay.';
