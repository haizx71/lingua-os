-- TASK-KNOWLEDGE-001
-- Query-supporting indexes for the relational knowledge catalog.
-- No learner-state, FSRS, competence, Brain, Today, or contract semantics change.

CREATE INDEX IF NOT EXISTS ix_concept_topics_topic_concept
    ON public.concept_topics (topic_id, concept_id);

CREATE INDEX IF NOT EXISTS ix_concept_relations_source_language_relation
    ON public.concept_relations (source_concept_id, language_code, relation_type, target_concept_id);

CREATE INDEX IF NOT EXISTS ix_concept_relations_target_language_relation
    ON public.concept_relations (target_concept_id, language_code, relation_type, source_concept_id);

CREATE INDEX IF NOT EXISTS ix_framework_mappings_concept_level
    ON public.framework_mappings (concept_id, level_id, confidence DESC);

CREATE INDEX IF NOT EXISTS ix_word_senses_translation_language
    ON public.word_senses (translation_language_code, lexeme_id, sense_order)
    WHERE translation_language_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_lexeme_forms_normalized_lookup
    ON public.lexeme_forms (normalized_form, lexeme_id, form_type);
