-- K2-09 private run receipt. Public catalog and learner/auth schemas are unchanged.
DO $$
BEGIN
    IF current_user <> 'postgres' THEN
        RAISE EXCEPTION '0021 requires the existing postgres database owner';
    END IF;
    IF pg_catalog.to_regnamespace('private') IS NOT NULL THEN
        RAISE EXCEPTION 'private schema must be absent before migration 0021';
    END IF;
END
$$;

CREATE SCHEMA private AUTHORIZATION postgres;
REVOKE ALL PRIVILEGES ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private.k2_hosted_fixture_receipts (
    repository_id bigint NOT NULL CHECK (repository_id = 1367261125),
    run_id bigint NOT NULL CHECK (run_id > 0),
    run_attempt integer NOT NULL CHECK (run_attempt > 0),
    sha text NOT NULL CHECK (sha ~ '^[a-f0-9]{40}$'),
    protocol_version text NOT NULL CHECK (protocol_version = 'k2-09-bridge-fixture.v1'),
    source_record_id uuid NOT NULL,
    source_record_hash text NOT NULL CHECK (source_record_hash ~ '^[a-f0-9]{64}$'),
    state text NOT NULL CHECK (state IN ('ACTIVE', 'CLOSED')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    closed_at timestamptz,
    PRIMARY KEY (repository_id, run_id),
    CHECK ((state = 'ACTIVE' AND closed_at IS NULL) OR
           (state = 'CLOSED' AND closed_at IS NOT NULL))
);

ALTER TABLE private.k2_hosted_fixture_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.k2_hosted_fixture_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE private.k2_hosted_fixture_receipts
    FROM PUBLIC, anon, authenticated, service_role;
