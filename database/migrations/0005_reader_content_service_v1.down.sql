-- TASK-008 rollback for disposable databases without Reader learner activity.

SET LOCAL search_path = public, pg_catalog;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM user_content_progress)
       OR EXISTS (SELECT 1 FROM reader_mutation_results)
       OR EXISTS (SELECT 1 FROM reader_exposure_concepts)
       OR EXISTS (SELECT 1 FROM exposure_events WHERE request_fingerprint IS NOT NULL)
       OR EXISTS (
            SELECT 1 FROM learning_events
            WHERE source_type = 'exposure_event' AND event_type = 'learning.exposure.recorded.v1'
       )
    THEN
        RAISE EXCEPTION 'Refusing lossy TASK-008 rollback after Reader learner activity';
    END IF;
END
$$;

DROP TRIGGER audio_assets_published_immutable ON audio_assets;
DROP TRIGGER sentence_audio_published_immutable ON sentence_audio;
DROP TRIGGER sentence_concepts_published_immutable ON sentence_concepts;
DROP TRIGGER sentence_translations_published_immutable ON sentence_translations;
DROP TRIGGER sentences_published_immutable ON sentences;
DROP TRIGGER content_metrics_published_immutable ON content_metrics;
DROP TRIGGER content_concepts_published_immutable ON content_concepts;
DROP TRIGGER content_segments_published_immutable ON content_segments;
DROP TRIGGER content_versions_published_immutable ON content_versions;
DROP FUNCTION enforce_published_reader_structure_immutability();

DROP TRIGGER reader_mutation_results_append_only ON reader_mutation_results;
DROP TRIGGER reader_exposure_concepts_append_only ON reader_exposure_concepts;
DROP TRIGGER exposure_events_reader_append_only ON exposure_events;
DROP FUNCTION enforce_reader_history_append_only();

DROP POLICY reader_exposure_concepts_select_own ON reader_exposure_concepts;
DROP POLICY reader_mutation_results_select_own ON reader_mutation_results;
DROP POLICY user_content_progress_select_own ON user_content_progress;
REVOKE ALL ON reader_exposure_concepts, reader_mutation_results, user_content_progress
    FROM authenticated, anon;

DROP INDEX ix_reader_exposure_concepts_profile;
DROP INDEX ix_user_content_progress_profile;
DROP INDEX ix_content_items_reader_catalog;
DROP TABLE reader_exposure_concepts;

ALTER TABLE exposure_events
    DROP CONSTRAINT exposure_events_reader_identity_unique,
    DROP CONSTRAINT exposure_events_reader_source_shape,
    DROP CONSTRAINT exposure_events_reader_result_all_or_none,
    DROP COLUMN result_snapshot,
    DROP COLUMN request_fingerprint;

DROP TABLE reader_mutation_results;
DROP TABLE user_content_progress;

DROP TRIGGER content_publication_gate ON content_items;
DROP FUNCTION enforce_reader_content_publication_gate();
DROP FUNCTION reader_content_passes_publication_gate(uuid);
DROP FUNCTION reader_source_record_is_allowed(uuid);
DROP FUNCTION utf16_code_unit_length(text);

ALTER TABLE content_segments
    DROP CONSTRAINT content_segments_identity_unique,
    DROP COLUMN segment_type;

ALTER TABLE content_items
    DROP CONSTRAINT content_items_publish_review_check,
    DROP CONSTRAINT content_items_review_timeline_check,
    DROP COLUMN reviewed_at,
    DROP COLUMN curated_level_id;

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
