from __future__ import annotations

from pathlib import Path

import psycopg
import pytest

from database.migrate import migrate_down, migrate_up

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / "database" / "migrations"


def _insert_receipt(connection: psycopg.Connection[tuple[object, ...]], state: str) -> None:
    connection.execute(
        """
        INSERT INTO private.k2_hosted_fixture_receipts
            (repository_id, run_id, run_attempt, sha, protocol_version,
             source_record_id, source_record_hash, state, closed_at)
        VALUES (1367261125, 9001, 1, %s, 'k2-09-bridge-fixture.v1', %s, %s, %s,
                CASE WHEN %s = 'CLOSED' THEN clock_timestamp() ELSE NULL END)
        """,
        ("a" * 40, "10000000-0000-4000-8000-000000000001", "b" * 64, state, state),
    )


def test_0021_private_receipt_owner_acl_rls_columns_and_no_fk(
    isolated_migrated_postgres_url: str,
) -> None:
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT version, name FROM public.schema_migrations ORDER BY version DESC LIMIT 1"
        ).fetchone() == ("0021", "k2_09_hosted_fixture_control")

        schema = connection.execute(
            """
            SELECT pg_catalog.pg_get_userbyid(namespace.nspowner),
                   EXISTS (
                       SELECT 1
                       FROM pg_catalog.aclexplode(COALESCE(
                           namespace.nspacl,
                           pg_catalog.acldefault('n', namespace.nspowner)
                       )) AS acl
                       WHERE acl.grantee = 0
                   )
            FROM pg_catalog.pg_namespace AS namespace
            WHERE namespace.nspname = 'private'
            """
        ).fetchone()
        assert schema is not None
        assert schema[0] == "postgres"
        assert schema[1] is False

        table = connection.execute(
            """
            SELECT pg_catalog.pg_get_userbyid(class.relowner),
                   class.relrowsecurity, class.relforcerowsecurity, class.relacl,
                   EXISTS (
                       SELECT 1
                       FROM pg_catalog.aclexplode(COALESCE(
                           class.relacl,
                           pg_catalog.acldefault('r', class.relowner)
                       )) AS acl
                       WHERE acl.grantee = 0
                   )
            FROM pg_catalog.pg_class AS class
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
            WHERE namespace.nspname = 'private'
              AND class.relname = 'k2_hosted_fixture_receipts'
              AND class.relkind = 'r'
            """
        ).fetchone()
        assert table is not None
        assert table[0] == "postgres"
        assert table[1:3] == (True, True)
        assert table[4] is False
        for role in ("anon", "authenticated", "service_role"):
            assert connection.execute(
                "SELECT has_schema_privilege(%s, 'private', 'USAGE'), "
                "has_schema_privilege(%s, 'private', 'CREATE')",
                (role, role),
            ).fetchone() == (False, False)
            assert connection.execute(
                """
                SELECT bool_or(has_table_privilege(%s, 'private.k2_hosted_fixture_receipts', privilege))
                FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
                                  'REFERENCES', 'TRIGGER']) AS privileges(privilege)
                """,
                (role,),
            ).fetchone() == (False,)

        assert connection.execute(
            "SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'private'"
        ).fetchone() == (0,)
        assert connection.execute(
            """
            SELECT count(*) FROM pg_catalog.pg_constraint AS constraint_row
            JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
            WHERE namespace.nspname = 'private'
              AND class.relname = 'k2_hosted_fixture_receipts'
              AND constraint_row.contype = 'f'
            """
        ).fetchone() == (0,)
        assert tuple(
            row[0]
            for row in connection.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'private' AND table_name = 'k2_hosted_fixture_receipts'
                ORDER BY ordinal_position
                """
            ).fetchall()
        ) == (
            "repository_id",
            "run_id",
            "run_attempt",
            "sha",
            "protocol_version",
            "source_record_id",
            "source_record_hash",
            "state",
            "created_at",
            "closed_at",
        )


@pytest.mark.parametrize("state", ["ACTIVE", "CLOSED"])
def test_0021_down_refuses_to_drop_active_or_retained_receipt(
    isolated_migrated_postgres_url: str,
    state: str,
) -> None:
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        _insert_receipt(connection, state)

    with pytest.raises(psycopg.Error):
        migrate_down(isolated_migrated_postgres_url, MIGRATIONS, steps=1)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1"
        ).fetchone() == ("0021",)
        assert connection.execute(
            "SELECT state FROM private.k2_hosted_fixture_receipts"
        ).fetchone() == (state,)


def test_0021_down_drops_only_empty_table_and_reapply_fails_closed_on_existing_schema(
    isolated_migrated_postgres_url: str,
) -> None:
    assert migrate_down(isolated_migrated_postgres_url, MIGRATIONS, steps=1) == ["0021"]
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT pg_catalog.to_regnamespace('private') IS NOT NULL"
        ).fetchone() == (True,)
        assert connection.execute(
            "SELECT pg_catalog.to_regclass('private.k2_hosted_fixture_receipts')"
        ).fetchone() == (None,)

    with pytest.raises(psycopg.Error):
        migrate_up(isolated_migrated_postgres_url, MIGRATIONS)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT pg_catalog.to_regclass('private.k2_hosted_fixture_receipts')"
        ).fetchone() == (None,)
        assert connection.execute(
            "SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1"
        ).fetchone() == ("0020",)


def test_0021_down_serializes_with_uncommitted_receipt_insert(
    isolated_migrated_postgres_url: str,
) -> None:
    from concurrent.futures import ThreadPoolExecutor
    from time import monotonic, sleep

    with psycopg.connect(isolated_migrated_postgres_url) as writer:
        _insert_receipt(writer, "ACTIVE")
        with ThreadPoolExecutor(max_workers=1) as pool:
            rollback = pool.submit(
                migrate_down, isolated_migrated_postgres_url, MIGRATIONS, steps=1
            )
            deadline = monotonic() + 5
            while monotonic() < deadline:
                with psycopg.connect(isolated_migrated_postgres_url) as observer:
                    waiting = observer.execute(
                        """
                        SELECT EXISTS (
                            SELECT 1 FROM pg_catalog.pg_locks
                            WHERE NOT granted
                              AND locktype = 'relation'
                              AND relation = 'private.k2_hosted_fixture_receipts'::regclass
                        )
                        """
                    ).fetchone()
                if waiting == (True,):
                    break
                sleep(0.02)
            assert waiting == (True,), "rollback did not wait for the in-flight receipt insert"
            writer.commit()
            with pytest.raises(psycopg.Error):
                rollback.result(timeout=10)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT state FROM private.k2_hosted_fixture_receipts"
        ).fetchone() == ("ACTIVE",)
        assert connection.execute(
            "SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1"
        ).fetchone() == ("0021",)
