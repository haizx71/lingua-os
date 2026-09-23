-- Migration 0017 rollback: drop only the additive read projection.
DROP VIEW IF EXISTS public.v_learner_concept_retrievability;
