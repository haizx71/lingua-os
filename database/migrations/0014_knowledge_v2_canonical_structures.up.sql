-- Migration 0014: Knowledge System V2 Canonical Structures
-- Creates additive canonical tables for grammar specifications, phrase templates, and phonetic transcriptions.
-- Complies with Migration 0010-0013 privilege lockdown (zero access to browser roles).

-- 1. Grammar Specifications Table
CREATE TABLE IF NOT EXISTS public.grammar_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL UNIQUE REFERENCES public.concepts(id) ON DELETE CASCADE,
    pattern_formula TEXT NOT NULL,
    syntactic_category TEXT NOT NULL,
    pragmatic_function TEXT NOT NULL,
    vietnamese_explanation TEXT NOT NULL,
    vietnamese_common_traps TEXT,
    structural_slots JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ix_grammar_specs_category ON public.grammar_specifications(syntactic_category);

-- 2. Phrase Specifications Table
CREATE TABLE IF NOT EXISTS public.phrase_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_id UUID NOT NULL UNIQUE REFERENCES public.concepts(id) ON DELETE CASCADE,
    base_pattern TEXT NOT NULL,
    headword_concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    slot_template JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ix_phrase_specs_headword ON public.phrase_specifications(headword_concept_id);

-- 3. Phonetic Transcriptions Table
CREATE TABLE IF NOT EXISTS public.phonetic_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id UUID NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
    accent_variant TEXT NOT NULL CHECK (accent_variant IN ('en_US', 'en_GB', 'en_AU')),
    ipa TEXT NOT NULL,
    audio_uri TEXT,
    duration_ms INTEGER,
    audio_source TEXT CHECK (audio_source IN ('human_studio', 'high_quality_neural_tts')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_phonetic_lexeme_accent UNIQUE (lexeme_id, accent_variant)
);

CREATE INDEX IF NOT EXISTS ix_phonetic_lookup ON public.phonetic_transcriptions(lexeme_id, accent_variant);

-- 4. Explicit Browser Role Privilege Revocation (Defense-in-Depth)
REVOKE ALL PRIVILEGES ON TABLE public.grammar_specifications FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.phrase_specifications FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.phonetic_transcriptions FROM anon, authenticated;
