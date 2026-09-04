-- Deterministic, idempotent TASK-008 development/acceptance catalog.
-- All prose is synthetic LINGUA-authored fixture content; no external corpus is imported.

SET LOCAL search_path = public, pg_catalog;

-- Make deterministic re-seeding a deliberate pre-publication rebuild. Published structure is
-- immutable, so the fixed fixture items must leave the public state before no-op conflict inserts.
UPDATE content_items
SET publication_status = 'reviewed', published_at = NULL
WHERE id IN (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003'
)
  AND publication_status = 'published';

INSERT INTO licenses (id, code, name, usage_policy, attribution_required, created_at)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'LINGUA-FIXTURE',
     'LINGUA authored acceptance fixtures', 'allowed', true, '2026-08-01T00:00:00Z'),
    ('10000000-0000-4000-8000-000000000002', 'RESTRICTED-FIXTURE',
     'Restricted negative-test fixtures', 'restricted', true, '2026-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO data_sources
    (id, name, source_type, source_version, source_url, license_id, attribution_text, created_at)
VALUES
    ('20000000-0000-4000-8000-000000000001', 'LINGUA Reader fixtures', 'internal', 'task008-v1',
     'https://lingua.invalid/fixtures/task008', '10000000-0000-4000-8000-000000000001',
     'Synthetic LINGUA OS acceptance content.', '2026-08-01T00:00:00Z'),
    ('20000000-0000-4000-8000-000000000002', 'Restricted Reader fixtures', 'internal', 'task008-v1',
     'https://lingua.invalid/fixtures/restricted', '10000000-0000-4000-8000-000000000002',
     'Restricted acceptance fixture; never learner-visible.', '2026-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO source_records
    (id, source_id, source_record_key, raw_hash, transform_version, quality_score,
     review_status, imported_at, reviewed_at, metadata)
VALUES
    ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
     'task008-allowed', repeat('a', 64), 'task008-seed-v1', 1, 'approved',
     '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z', '{"fixture":true}'),
    ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
     'task008-restricted', repeat('b', 64), 'task008-seed-v1', 1, 'approved',
     '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z', '{"fixture":true}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO concepts
    (id, language_code, concept_type, canonical_key, source_record_id, created_at, updated_at)
SELECT
    ('30000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    'en', 'word', 'word' || lpad(number::text, 2, '0'),
    '21000000-0000-4000-8000-000000000001'::uuid,
    '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'
FROM generate_series(1, 30) AS number
ON CONFLICT (id) DO NOTHING;

INSERT INTO lexemes
    (id, concept_id, language_code, lemma, normalized_form, part_of_speech,
     source_record_id, created_at)
SELECT
    ('31000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    ('30000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    'en', 'word' || lpad(number::text, 2, '0'), 'word' || lpad(number::text, 2, '0'), 'noun',
    '21000000-0000-4000-8000-000000000001'::uuid, '2026-08-01T00:00:00Z'
FROM generate_series(1, 30) AS number
ON CONFLICT (id) DO NOTHING;

INSERT INTO word_senses
    (id, lexeme_id, sense_order, definition, definition_language_code,
     translated_definition, translation_language_code, source_record_id, created_at)
SELECT
    ('32000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    ('31000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    1, 'Synthetic fixture definition ' || number, 'en',
    'Định nghĩa dữ liệu kiểm thử ' || number, 'vi',
    '21000000-0000-4000-8000-000000000001'::uuid, '2026-08-01T00:00:00Z'
FROM generate_series(1, 30) AS number
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_items
    (id, language_code, content_type, title, summary, difficulty, quality_score,
     publication_status, source_record_id, published_at, curated_level_id, reviewed_at,
     created_at, updated_at)
VALUES
    ('40000000-0000-4000-8000-000000000001', 'en', 'story', 'A quiet morning',
     'A0 synthetic Reader fixture.', 0.10, 1, 'reviewed',
     '21000000-0000-4000-8000-000000000001', '2026-08-05T00:00:00Z',
     '00000000-0000-4000-8100-000000000000',
     '2026-08-03T00:00:00Z', '2026-08-01T00:00:00Z', '2026-08-03T00:00:00Z'),
    ('40000000-0000-4000-8000-000000000002', 'en', 'dialogue', 'At the small cafe',
     'A1 synthetic Reader fixture with audio.', 0.28, 1, 'reviewed',
     '21000000-0000-4000-8000-000000000001', '2026-08-05T00:00:00Z',
     '00000000-0000-4000-8100-000000000001',
     '2026-08-03T00:00:00Z', '2026-08-01T00:00:00Z', '2026-08-03T00:00:00Z'),
    ('40000000-0000-4000-8000-000000000003', 'en', 'article', 'A useful city walk',
     'A2 synthetic Reader fixture.', 0.46, 1, 'reviewed',
     '21000000-0000-4000-8000-000000000001', '2026-08-05T00:00:00Z',
     '00000000-0000-4000-8100-000000000002',
     '2026-08-03T00:00:00Z', '2026-08-01T00:00:00Z', '2026-08-03T00:00:00Z'),
    ('40000000-0000-4000-8000-000000000004', 'en', 'article', 'Draft longer reading',
     'B1 reviewed but unpublished fixture.', 0.70, 1, 'reviewed',
     '21000000-0000-4000-8000-000000000001', NULL,
     '00000000-0000-4000-8100-000000000003',
     '2026-08-03T00:00:00Z', '2026-08-01T00:00:00Z', '2026-08-03T00:00:00Z'),
    ('40000000-0000-4000-8000-000000000005', 'en', 'story', 'Restricted quarantine',
     'Negative publication fixture.', 0.20, 1, 'quarantined',
     '21000000-0000-4000-8000-000000000002', NULL,
     '00000000-0000-4000-8100-000000000001',
     '2026-08-03T00:00:00Z', '2026-08-01T00:00:00Z', '2026-08-03T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_versions
    (id, content_id, version, content_hash, source_record_id, created_at)
SELECT
    ('41000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    ('40000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    1, repeat(to_hex(number), 64),
    CASE WHEN number = 5
         THEN '21000000-0000-4000-8000-000000000002'::uuid
         ELSE '21000000-0000-4000-8000-000000000001'::uuid END,
    '2026-08-01T00:00:00Z'
FROM generate_series(1, 5) AS number
ON CONFLICT (id) DO NOTHING;

WITH sentence_values AS (
    SELECT number,
           CASE WHEN number = 1 THEN ARRAY[1, 1, 2]
                ELSE ARRAY[((number * 2) % 30) + 1,
                           ((number * 2 + 1) % 30) + 1,
                           ((number * 2 + 2) % 30) + 1] END AS concepts
    FROM generate_series(1, 14) AS number
)
INSERT INTO sentences
    (id, language_code, text, normalized_text, difficulty, quality_score,
     source_record_id, created_at)
SELECT
    ('50000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    'en',
    format('word%s word%s word%s', lpad(concepts[1]::text, 2, '0'),
           lpad(concepts[2]::text, 2, '0'), lpad(concepts[3]::text, 2, '0')),
    format('word%s word%s word%s', lpad(concepts[1]::text, 2, '0'),
           lpad(concepts[2]::text, 2, '0'), lpad(concepts[3]::text, 2, '0')),
    LEAST(0.08 + number * 0.035, 0.80), 1,
    CASE WHEN number >= 13
         THEN '21000000-0000-4000-8000-000000000002'::uuid
         ELSE '21000000-0000-4000-8000-000000000001'::uuid END,
    '2026-08-01T00:00:00Z'
FROM sentence_values
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentence_translations
    (id, sentence_id, target_language_code, text, source_record_id, created_at)
SELECT
    ('51000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    ('50000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    'vi', 'Bản dịch kiểm thử ' || number,
    CASE WHEN number >= 13
         THEN '21000000-0000-4000-8000-000000000002'::uuid
         ELSE '21000000-0000-4000-8000-000000000001'::uuid END,
    '2026-08-01T00:00:00Z'
FROM generate_series(1, 14) AS number
ON CONFLICT (id) DO NOTHING;

INSERT INTO audio_assets
    (id, language_code, storage_uri, duration_ms, speaker_metadata, source_record_id, created_at)
VALUES (
    '52000000-0000-4000-8000-000000000001', 'en',
    'https://lingua.invalid/fixtures/task008/audio-1.mp3', 3000,
    '{"fixture":true}', '21000000-0000-4000-8000-000000000001', '2026-08-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentence_audio
    (sentence_id, audio_id, language_code, start_ms, end_ms)
VALUES (
    '50000000-0000-4000-8000-000000000004',
    '52000000-0000-4000-8000-000000000001', 'en', 0, 3000
)
ON CONFLICT DO NOTHING;

WITH assignment AS (
    SELECT number,
           CASE WHEN number <= 3 THEN 1 WHEN number <= 6 THEN 2 WHEN number <= 9 THEN 3
                WHEN number <= 12 THEN 4 ELSE 5 END AS content_number
    FROM generate_series(1, 14) AS number
)
INSERT INTO content_segments
    (id, content_id, language_code, order_index, sentence_id, text, segment_type,
     audio_id, audio_start_ms, audio_end_ms, source_record_id, created_at)
SELECT
    ('60000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    ('40000000-0000-4000-8000-' || lpad(content_number::text, 12, '0'))::uuid,
    'en', CASE WHEN content_number < 5 THEN (number - 1) % 3 ELSE number - 13 END,
    ('50000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    sentence.text,
    CASE WHEN content_number = 2 THEN 'dialogue_turn' ELSE 'sentence' END,
    CASE WHEN number = 4 THEN '52000000-0000-4000-8000-000000000001'::uuid END,
    CASE WHEN number = 4 THEN 0 END,
    CASE WHEN number = 4 THEN 3000 END,
    CASE WHEN content_number = 5
         THEN '21000000-0000-4000-8000-000000000002'::uuid
         ELSE '21000000-0000-4000-8000-000000000001'::uuid END,
    '2026-08-01T00:00:00Z'
FROM assignment
JOIN sentences AS sentence
  ON sentence.id = ('50000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid
ON CONFLICT (id) DO NOTHING;

WITH sentence_values AS (
    SELECT number,
           CASE WHEN number = 1 THEN ARRAY[1, 1, 2]
                ELSE ARRAY[((number * 2) % 30) + 1,
                           ((number * 2 + 1) % 30) + 1,
                           ((number * 2 + 2) % 30) + 1] END AS concepts
    FROM generate_series(1, 14) AS number
), occurrences AS (
    SELECT number, concepts[ordinality] AS concept_number,
           CASE ordinality WHEN 1 THEN 0 WHEN 2 THEN 7 ELSE 14 END AS start_offset,
           CASE ordinality WHEN 1 THEN 6 WHEN 2 THEN 13 ELSE 20 END AS end_offset
    FROM sentence_values CROSS JOIN generate_series(1, 3) AS ordinality
)
INSERT INTO sentence_concepts
    (sentence_id, concept_id, language_code, start_offset, end_offset, occurrence_role)
SELECT
    ('50000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
    ('30000000-0000-4000-8000-' || lpad(concept_number::text, 12, '0'))::uuid,
    'en', start_offset, end_offset, 'target'
FROM occurrences
ON CONFLICT DO NOTHING;

INSERT INTO content_concepts (content_id, concept_id, language_code, occurrence_count)
SELECT segment.content_id, occurrence.concept_id, 'en', count(*)::integer
FROM content_segments AS segment
JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = segment.sentence_id
WHERE segment.id::text LIKE '60000000-%'
GROUP BY segment.content_id, occurrence.concept_id
ON CONFLICT (content_id, concept_id) DO NOTHING;

INSERT INTO content_metrics
    (content_id, token_count, sentence_count, lexical_diversity, knownness_prior,
     metrics_version, calculated_at)
SELECT content_id, count(*)::integer * 3, count(*)::integer, 0.75, 0.50,
       'reader-qa-v1', '2026-08-04T00:00:00Z'
FROM content_segments
WHERE id::text LIKE '60000000-%'
GROUP BY content_id
ON CONFLICT (content_id) DO NOTHING;

UPDATE content_items
SET publication_status = 'published', published_at = '2026-08-05T00:00:00Z',
    updated_at = '2026-08-05T00:00:00Z'
WHERE id IN (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003'
);
