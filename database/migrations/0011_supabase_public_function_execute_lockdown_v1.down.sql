-- Rollback only: restores PostgreSQL's broad default function execution model.
-- Do not use unless explicitly reverting 0011.

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
