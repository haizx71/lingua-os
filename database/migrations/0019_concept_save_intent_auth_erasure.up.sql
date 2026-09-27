-- Migration 0019: permit concept save-intent cleanup only during Auth identity erasure.
-- Active identities retain immutable first-save history.

SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.enforce_concept_save_intent_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND pg_catalog.pg_trigger_depth() > 1
       AND NOT EXISTS (
           SELECT 1
           FROM auth.users AS auth_user
           WHERE auth_user.id = OLD.user_id
       )
    THEN
        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Concept save intent history is immutable'
        USING ERRCODE = '23514';
END
$$;
