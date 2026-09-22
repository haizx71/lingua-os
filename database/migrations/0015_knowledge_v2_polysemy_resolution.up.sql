-- Migration 0015: Knowledge System V2 Polysemy Resolution
-- Adds the canonical concept-to-word-sense bridge without duplicating lexemes or morphology.
-- Existing concept/word-sense provenance remains authoritative on the referenced parent rows.

CREATE TABLE IF NOT EXISTS public.concept_senses (
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    word_sense_id UUID NOT NULL REFERENCES public.word_senses(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (concept_id, word_sense_id)
);

CREATE INDEX IF NOT EXISTS ix_concept_senses_word_sense
    ON public.concept_senses(word_sense_id);

-- Canonical knowledge is served through FastAPI, not the browser Data API.
REVOKE ALL PRIVILEGES ON TABLE public.concept_senses FROM anon, authenticated;

-- Backfill the existing V1 one-lexeme/one-sense mappings. The predicate is retained
-- as a defensive guard for compatible historical schemas where concept_id may be nullable.
INSERT INTO public.concept_senses (concept_id, word_sense_id, is_primary)
SELECT DISTINCT
    l.concept_id,
    ws.id AS word_sense_id,
    (ws.sense_order = 1) AS is_primary
FROM public.lexemes AS l
JOIN public.word_senses AS ws
    ON ws.lexeme_id = l.id
WHERE l.concept_id IS NOT NULL
ON CONFLICT (concept_id, word_sense_id) DO NOTHING;
