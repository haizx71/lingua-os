-- Rollback migration 0022: restore the exact migration-0005 Reader history guard.

SET LOCAL search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION enforce_reader_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_TABLE_NAME = 'exposure_events' THEN
        IF OLD.request_fingerprint IS NULL THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Reader source facts and replay snapshots are append-only'
        USING ERRCODE = '23514';
END
$$;
