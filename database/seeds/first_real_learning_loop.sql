-- Deterministic LINGUA-authored acceptance catalog extension for First Real Learning Loop (FRLL).
-- Self-contained, idempotent catalog seed containing exactly one published English word concept.
-- MUST NOT seed any rows into learner-derived tables (review_items, fsrs_states, competence, etc.).

SET LOCAL search_path = public, pg_catalog;

INSERT INTO licenses (id, code, name, usage_policy, attribution_required, created_at)
VALUES (
    '10000000-0000-4000-8000-000000000001',
    'LINGUA-FIXTURE',
    'LINGUA authored acceptance fixtures',
    'allowed',
    true,
    '2026-08-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO data_sources (id, name, source_type, source_version, source_url, license_id, attribution_text, created_at)
VALUES (
    '20000000-0000-4000-8000-000000000004',
    'LINGUA FRLL Acceptance Fixtures',
    'internal',
    'frll-v1',
    'https://lingua.invalid/fixtures/frll',
    '10000000-0000-4000-8000-000000000001',
    'Synthetic LINGUA OS acceptance content for First Real Learning Loop.',
    '2026-09-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO source_records (
    id, source_id, source_record_key, raw_hash, transform_version, quality_score,
    review_status, imported_at, reviewed_at, metadata
)
VALUES (
    '21000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    'frll-anchor-record',
    repeat('f', 64),
    'frll-seed-v1',
    1,
    'approved',
    '2026-09-01T00:00:00Z',
    '2026-09-01T00:00:00Z',
    '{"fixture": "FRLL-04", "purpose": "First Real Learning Loop acceptance anchor"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO concepts (id, language_code, concept_type, canonical_key, source_record_id, created_at, updated_at)
VALUES (
    '7f110000-0000-4000-8000-000000000004',
    'en',
    'word',
    'frll-anchor',
    '21000000-0000-4000-8000-000000000004',
    '2026-09-01T00:00:00Z',
    '2026-09-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lexemes (
    id, concept_id, language_code, lemma, normalized_form, part_of_speech,
    source_record_id, created_at
)
VALUES (
    '7f120000-0000-4000-8000-000000000004',
    '7f110000-0000-4000-8000-000000000004',
    'en',
    'frll-anchor',
    'frll-anchor',
    'noun',
    '21000000-0000-4000-8000-000000000004',
    '2026-09-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lexeme_forms (
    id, lexeme_id, form, normalized_form, form_type, source_record_id, created_at
)
VALUES (
    '7f130000-0000-4000-8000-000000000004',
    '7f120000-0000-4000-8000-000000000004',
    'frll-anchor',
    'frll-anchor',
    'base',
    '21000000-0000-4000-8000-000000000004',
    '2026-09-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO word_senses (
    id, lexeme_id, sense_order, definition, definition_language_code,
    translated_definition, translation_language_code, source_record_id, created_at
)
VALUES (
    '7f140000-0000-4000-8000-000000000004',
    '7f120000-0000-4000-8000-000000000004',
    1,
    'A deterministic anchor concept for acceptance testing.',
    'en',
    'Một khái niệm mỏ neo tất định cho kiểm thử chấp nhận.',
    'vi',
    '21000000-0000-4000-8000-000000000004',
    '2026-09-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;
