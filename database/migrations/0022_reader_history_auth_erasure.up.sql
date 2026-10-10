-- Migration 0022: permit Reader-history removal only during Auth identity erasure.

SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.enforce_reader_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
    IF TG_TABLE_NAME = 'exposure_events' THEN
        IF OLD.request_fingerprint IS NULL THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
            RETURN NEW;
        END IF;
    END IF;

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

    RAISE EXCEPTION 'Reader source facts and replay snapshots are append-only'
        USING ERRCODE = '23514';
END
$$;
