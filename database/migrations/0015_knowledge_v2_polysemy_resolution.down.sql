-- Migration 0015 Rollback: Knowledge System V2 Polysemy Resolution
-- Drops the additive bridge. Any bridge data written after cutover is intentionally removed
-- under the repository's documented data-rollback semantics.

DROP TABLE IF EXISTS public.concept_senses;
