-- Rollback only: restores schema USAGE to the browser roles.

GRANT USAGE ON SCHEMA public TO PUBLIC, anon, authenticated;
