-- Migration 0016 rollback: Knowledge V2 graph and DAG integrity.
-- This is a destructive schema/data rollback for the additive V2 graph only.
DROP TRIGGER IF EXISTS trg_concept_edges_acyclic ON public.concept_edges;
DROP FUNCTION IF EXISTS public.fn_check_concept_edges_acyclic();
DROP TABLE IF EXISTS public.concept_edges;
