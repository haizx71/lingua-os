-- LINGUA OS keeps application/domain data behind FastAPI + PostgreSQL.
-- Browser Supabase roles therefore do not need USAGE on the public schema.
-- Revoking schema USAGE adds a second boundary so a future accidental table
-- or function grant does not immediately expose the application schema.

REVOKE USAGE ON SCHEMA public FROM PUBLIC, anon, authenticated;
