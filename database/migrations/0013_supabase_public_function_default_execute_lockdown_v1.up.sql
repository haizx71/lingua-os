-- 0011 revoked EXECUTE from existing public functions, but a schema-scoped
-- default-privilege revoke cannot override PostgreSQL's global PUBLIC default.
-- Close that future-function path for the migration/deployment role as well.

ALTER DEFAULT PRIVILEGES
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
