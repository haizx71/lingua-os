-- LINGUA OS does not expose domain tables directly to browser Supabase clients.
-- Supabase Auth is the browser-facing identity boundary; FastAPI is the domain/data boundary.
-- Remove PostgREST table/sequence/function privileges from browser roles as defense in depth.
--
-- Keep USAGE on the public schema itself: schema visibility does not grant access to contained
-- objects, and retaining it preserves normal PostgreSQL/PostgREST name resolution. The actual
-- data/execution capabilities below are revoked from browser roles.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Keep newly created public objects closed by default. Table/sequence browser grants are
-- Supabase schema-scoped defaults, so revoke them in public. Function EXECUTE is different:
-- PostgreSQL grants it to PUBLIC as a global default, and a schema-scoped REVOKE cannot remove
-- a global default privilege. Revoke PUBLIC globally for functions, then remove any explicit
-- Supabase browser-role function grants scoped to public. Existing service-role grants remain.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
