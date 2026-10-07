from __future__ import annotations

from pathlib import Path

import psycopg
import pytest

from database.migrate import migrate_down, migrate_up
from tests.acceptance.support import k2_hosted_probe

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
                SELECT bool_or(
                    has_table_privilege(%s, 'private.k2_hosted_fixture_receipts', privilege)
                )
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


def test_actor_ownership_graph_matches_all_27_tables_and_51_inbound_fks(
    isolated_migrated_postgres_url: str,
) -> None:
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert k2_hosted_probe._actor_ownership_graph(connection) == {
            "ownershipGraphValid": True,
            "ownedTableCount": 27,
            "ownershipEdgeCount": 27,
            "incomingConstraintCount": 51,
        }
        causation = connection.execute(
            """
            SELECT source_namespace.nspname, source_table.relname,
                   constraint_row.conname, constraint_row.confdeltype,
                   constraint_row.convalidated, constraint_row.condeferrable,
                   ARRAY(
                       SELECT attribute.attname::text
                       FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key(attnum, ordinal)
                       JOIN pg_catalog.pg_attribute AS attribute
                         ON attribute.attrelid = constraint_row.conrelid
                        AND attribute.attnum = key.attnum
                       ORDER BY key.ordinal
                   ),
                   target_namespace.nspname, target_table.relname,
                   ARRAY(
                       SELECT attribute.attname::text
                       FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key(attnum, ordinal)
                       JOIN pg_catalog.pg_attribute AS attribute
                         ON attribute.attrelid = constraint_row.confrelid
                        AND attribute.attnum = key.attnum
                       ORDER BY key.ordinal
                   )
            FROM pg_catalog.pg_constraint AS constraint_row
            JOIN pg_catalog.pg_class AS source_table
              ON source_table.oid = constraint_row.conrelid
            JOIN pg_catalog.pg_namespace AS source_namespace
              ON source_namespace.oid = source_table.relnamespace
            JOIN pg_catalog.pg_class AS target_table
              ON target_table.oid = constraint_row.confrelid
            JOIN pg_catalog.pg_namespace AS target_namespace
              ON target_namespace.oid = target_table.relnamespace
            WHERE constraint_row.contype = 'f'
              AND source_namespace.nspname = 'public'
              AND source_table.relname = 'learning_events'
              AND target_namespace.nspname = 'public'
              AND target_table.relname = 'learning_events'
            """
        ).fetchone()
        assert causation == (
            "public",
            "learning_events",
            "learning_events_causation_fkey",
            "r",
            True,
            False,
            ["causation_learning_event_id"],
            "public",
            "learning_events",
            ["learning_event_id"],
        )


def test_cross_actor_causation_restrict_aborts_auth_cascade_atomically(
    isolated_migrated_postgres_url: str,
) -> None:
    from uuid import uuid4

    actor_a, actor_b = uuid4(), uuid4()
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s), (%s)", (actor_a, actor_b))
        connection.execute("INSERT INTO public.users (id) VALUES (%s), (%s)", (actor_a, actor_b))
        connection.execute(
            "INSERT INTO public.learner_profiles (user_id, time_zone) "
            "VALUES (%s, 'Etc/UTC'), (%s, 'Etc/UTC')",
            (actor_a, actor_b),
        )
        profiles = connection.execute(
            """
            INSERT INTO public.user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20),
                   (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            RETURNING user_id, id
            """,
            (actor_a, actor_b),
        ).fetchall()
        profile_by_actor = {row[0]: row[1] for row in profiles}
        event_a_row = connection.execute(
            """
            INSERT INTO public.learning_events (user_id, user_language_id, event_type)
            VALUES (%s, %s, 'learning.review.completed.v1') RETURNING learning_event_id
            """,
            (actor_a, profile_by_actor[actor_a]),
        ).fetchone()
        assert event_a_row is not None
        event_a = event_a_row[0]
        event_b_row = connection.execute(
            """
            INSERT INTO public.learning_events
                (user_id, user_language_id, event_type, causation_learning_event_id)
            VALUES (%s, %s, 'learning.review.completed.v1', %s) RETURNING learning_event_id
            """,
            (actor_b, profile_by_actor[actor_b], event_a),
        ).fetchone()
        assert event_b_row is not None
        event_b = event_b_row[0]

    # The distinct actor-B causal reference must block deleting actor A and
    # roll back the entire Auth cascade, preserving both users and both events.
    with (
        pytest.raises(psycopg.Error),
        psycopg.connect(isolated_migrated_postgres_url) as connection,
    ):
        connection.execute("DELETE FROM auth.users WHERE id = %s", (actor_a,))
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM auth.users WHERE id = ANY(%s)", ([actor_a, actor_b],)
        ).fetchone() == (2,)
        assert connection.execute(
            "SELECT count(*) FROM public.users WHERE id = ANY(%s)", ([actor_a, actor_b],)
        ).fetchone() == (2,)
        assert connection.execute(
            "SELECT count(*) FROM public.learning_events WHERE learning_event_id = ANY(%s)",
            ([event_a, event_b],),
        ).fetchone() == (2,)

        # Learning events are append-only. Delete the synthetic referencing
        # actor through the normal Auth cascade, then A can be erased normally.
        connection.execute("DELETE FROM auth.users WHERE id = %s", (actor_b,))
        connection.execute("DELETE FROM auth.users WHERE id = %s", (actor_a,))
        assert connection.execute(
            "SELECT count(*) FROM auth.users WHERE id = ANY(%s)", ([actor_a, actor_b],)
        ).fetchone() == (0,)
        assert connection.execute(
            "SELECT count(*) FROM public.users WHERE id = ANY(%s)", ([actor_a, actor_b],)
        ).fetchone() == (0,)
        assert connection.execute(
            "SELECT count(*) FROM public.learning_events WHERE learning_event_id = ANY(%s)",
            ([event_a, event_b],),
        ).fetchone() == (0,)


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
