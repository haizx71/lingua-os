-- Rollback only: restore PostgreSQL's global default function execution grant.

ALTER DEFAULT PRIVILEGES
    GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
