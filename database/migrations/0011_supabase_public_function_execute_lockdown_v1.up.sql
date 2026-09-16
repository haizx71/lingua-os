-- LINGUA OS security hardening: the browser must not gain database-function
-- execution through PostgreSQL's implicit PUBLIC grant. Domain access remains
-- behind FastAPI/PostgreSQL; trigger execution is unaffected by this revoke.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Prevent newly-created public-schema functions from silently reopening the
-- same execution surface for PUBLIC (and therefore anon/authenticated).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
