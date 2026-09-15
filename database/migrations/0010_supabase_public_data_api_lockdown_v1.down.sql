-- Rollback only: restore the broad Supabase-generated browser grants that existed
-- before 0010. This intentionally re-opens the Data API surface and should not be
-- used in normal operation.

GRANT USAGE ON SCHEMA public TO PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
