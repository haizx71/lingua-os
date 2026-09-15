-- LINGUA OS does not expose domain tables directly to browser Supabase clients.
-- Supabase Auth is the browser-facing identity boundary; FastAPI is the domain/data boundary.
-- Remove PostgREST schema/table/sequence/function privileges from browser roles as defense in depth.
--
-- PostgreSQL grants USAGE on public and EXECUTE on new functions to PUBLIC by default. Revoking only
-- anon/authenticated is insufficient because those roles inherit PUBLIC privileges. Close both paths.

REVOKE USAGE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Keep newly created public objects closed by default. ALTER DEFAULT PRIVILEGES applies to objects
-- created by the migration owner (the same role used by LINGUA migrations in deployed environments).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
