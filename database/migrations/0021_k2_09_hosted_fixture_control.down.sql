DO $$
BEGIN
    IF current_user <> 'postgres' THEN
        RAISE EXCEPTION '0021 rollback requires the existing postgres database owner';
    END IF;
    IF pg_catalog.to_regclass('private.k2_hosted_fixture_receipts') IS NULL THEN
        RAISE EXCEPTION 'K2-09 hosted fixture receipt table is missing';
    END IF;
END
$$;

-- Serialize the empty check with setup/reap inserts. A weaker read lock can race
-- an uncommitted receipt insert and allow DROP TABLE to erase a committed ACTIVE row.
LOCK TABLE private.k2_hosted_fixture_receipts IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM private.k2_hosted_fixture_receipts) THEN
        RAISE EXCEPTION 'refusing 0021 rollback while any fixture receipt is retained';
    END IF;
END
$$;

DROP TABLE private.k2_hosted_fixture_receipts;
