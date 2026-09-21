-- Migration 0014 Rollback: Knowledge System V2 Canonical Structures
-- Drops additive canonical tables in reverse order.

DROP TABLE IF EXISTS public.phonetic_transcriptions;
DROP TABLE IF EXISTS public.phrase_specifications;
DROP TABLE IF EXISTS public.grammar_specifications;
