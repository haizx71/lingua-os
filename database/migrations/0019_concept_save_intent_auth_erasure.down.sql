-- Migration 0019 rollback: restore unconditional concept save-intent immutability.

SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.enforce_concept_save_intent_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $
BEGIN
    RAISE EXCEPTION 'Concept save intent history is immutable'
        USING ERRCODE = '23514';
END
$$;
