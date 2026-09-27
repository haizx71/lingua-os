from __future__ import annotations

import shutil
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from threading import Event
from time import monotonic, sleep

import psycopg
import pytest
from psycopg import Connection, sql
from psycopg.conninfo import make_conninfo

from database.migrate import migrate_down, migrate_up

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / "database" / "migrations"
AUTH_BOOTSTRAP = Path(__file__).with_name("supabase_test_bootstrap.sql")


@contextmanager
def _isolated_database(postgres_url: str) -> Iterator[str]:
    database_name = f"lingua_profile_{uuid.uuid4().hex}"
    admin_url = make_conninfo(postgres_url, dbname="postgres")
    database_url = make_conninfo(postgres_url, dbname=database_name)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    try:
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        yield database_url
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name))
            )


def _insert_profile_replay(
    connection: Connection[tuple[object, ...]],
    *,
    actor_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    selected_actor_id = actor_id or uuid.uuid4()
    profile_id = uuid.uuid4()
    replay_key = uuid.uuid4()
    connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (selected_actor_id,))
    connection.execute("INSERT INTO users (id) VALUES (%s)", (selected_actor_id,))
    connection.execute(
        "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, NULL)",
        (selected_actor_id,),
    )
    connection.execute(
        """
        INSERT INTO user_languages
            (id, user_id, language_code, native_language_code, goal, daily_minutes)
        VALUES (%s, %s, 'en', 'vi', 'communication', 20)
        """,
        (profile_id, selected_actor_id),
    )
    connection.execute(
        """
        INSERT INTO profile_mutation_results
            (user_id, idempotency_key, operation_type, schema_version,
             request_fingerprint, language_profile_id, http_status,
             result_data_snapshot, result_etag, completed_at)
        VALUES (%s, %s, 'create-language-profile-v1', 1, %s, %s, 201,
                '{}'::jsonb, '"profile-etag"', now())
        """,
        (selected_actor_id, replay_key, "d" * 64, profile_id),
    )
    return selected_actor_id, profile_id, replay_key


def test_profile_migration_adds_only_frozen_profile_authorities(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    columns = {
        (str(row[0]), str(row[1]), str(row[2]), row[3])
        for row in db_connection.execute(
            """
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('learner_profiles', 'user_languages')
              AND column_name IN ('time_zone', 'revision', 'native_language_code',
                                  'interface_language_code')
            """
        ).fetchall()
    }

    assert ("learner_profiles", "time_zone", "text", "YES") in columns
    assert ("learner_profiles", "revision", "bigint", "NO") in columns
    assert ("user_languages", "revision", "bigint", "NO") in columns
    assert ("user_languages", "native_language_code", "text", "NO") in columns
    assert ("user_languages", "interface_language_code", "text", "YES") in columns
    assert db_connection.execute(
        """
        SELECT column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'learner_profiles'
          AND column_name = 'time_zone'
        """
    ).fetchone() == (None,)

    tables = {
        str(row[0])
        for row in db_connection.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
    }
    assert "profile_mutation_results" in tables


def test_profile_schema_rejects_invalid_goal_revision_and_replay_shape(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id = uuid.uuid4()
    db_connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
    db_connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
    db_connection.execute(
        "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, NULL)",
        (actor_id,),
    )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, native_language_code, goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'general', 20)
            """,
            (actor_id,),
        )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            "UPDATE learner_profiles SET revision = 0 WHERE user_id = %s",
            (actor_id,),
        )


def test_profile_mutation_results_are_not_browser_readable_or_writable(
    migrated_postgres_url: str,
) -> None:
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    replay_key = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as admin:
        admin.execute("INSERT INTO auth.users (id) VALUES (%s), (%s)", (owner_id, other_id))
        admin.execute("INSERT INTO users (id) VALUES (%s), (%s)", (owner_id, other_id))
        admin.execute(
            """
            INSERT INTO user_languages
                (id, user_id, language_code, native_language_code, goal, daily_minutes)
            VALUES (%s, %s, 'en', 'vi', 'communication', 20)
            """,
            (profile_id, owner_id),
        )
        admin.execute(
            """
            INSERT INTO profile_mutation_results
                (user_id, idempotency_key, operation_type, schema_version,
                 request_fingerprint, language_profile_id, http_status,
                 result_data_snapshot, result_etag, completed_at)
            VALUES (%s, %s, 'create-language-profile-v1', 1, %s, %s, 201,
                    '{}'::jsonb, '"profile-etag"', now())
            """,
            (owner_id, replay_key, "a" * 64, profile_id),
        )
        admin.commit()

    for actor_id in (owner_id, other_id):
        with psycopg.connect(migrated_postgres_url) as session:
            session.execute("SET ROLE authenticated")
            session.execute(
                "SELECT set_config('request.jwt.claim.sub', %s, false)", (str(actor_id),)
            )
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                session.execute(
                    "SELECT idempotency_key FROM public.profile_mutation_results"
                ).fetchall()


def test_profile_replay_snapshot_is_append_only(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    replay_key = uuid.uuid4()
    db_connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
    db_connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
    db_connection.execute(
        """
        INSERT INTO user_languages
            (id, user_id, language_code, native_language_code, goal, daily_minutes)
        VALUES (%s, %s, 'en', 'vi', 'travel', 20)
        """,
        (profile_id, actor_id),
    )
    db_connection.execute(
        """
        INSERT INTO profile_mutation_results
            (user_id, idempotency_key, operation_type, schema_version,
             request_fingerprint, language_profile_id, http_status,
             result_data_snapshot, result_etag, completed_at)
        VALUES (%s, %s, 'create-language-profile-v1', 1, %s, %s, 201,
                '{}'::jsonb, '"profile-etag"', now())
        """,
        (actor_id, replay_key, "b" * 64, profile_id),
    )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            "UPDATE profile_mutation_results SET result_etag = %s "
            "WHERE user_id = %s AND idempotency_key = %s",
            ('"changed"', actor_id, replay_key),
        )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            "DELETE FROM profile_mutation_results WHERE user_id = %s AND idempotency_key = %s",
            (actor_id, replay_key),
        )


def test_profile_replay_cannot_be_deleted_while_auth_identity_exists(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, replay_key = _insert_profile_replay(db_connection)

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            "DELETE FROM profile_mutation_results WHERE user_id = %s AND idempotency_key = %s",
            (actor_id, replay_key),
        )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute("DELETE FROM user_languages WHERE id = %s", (profile_id,))

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute("DELETE FROM users WHERE id = %s", (actor_id,))

    assert db_connection.execute(
        "SELECT count(*) FROM auth.users WHERE id = %s", (actor_id,)
    ).fetchone() == (1,)
    assert db_connection.execute(
        "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s", (actor_id,)
    ).fetchone() == (1,)


def test_auth_identity_erasure_cascades_replay_only_for_erased_actor(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, _, _ = _insert_profile_replay(db_connection)
    other_actor_id, _, _ = _insert_profile_replay(db_connection)

    db_connection.execute(
        """
        CREATE TABLE public.profile_mutation_delete_probe (
            user_id uuid NOT NULL,
            trigger_depth integer NOT NULL,
            auth_identity_present boolean NOT NULL
        )
        """
    )
    db_connection.execute(
        """
        CREATE FUNCTION public.capture_profile_mutation_delete_context()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog
        AS $$
        BEGIN
            INSERT INTO public.profile_mutation_delete_probe
                (user_id, trigger_depth, auth_identity_present)
            VALUES (
                OLD.user_id,
                pg_catalog.pg_trigger_depth(),
                EXISTS (
                    SELECT 1
                    FROM auth.users AS auth_user
                    WHERE auth_user.id = OLD.user_id
                )
            );
            RETURN OLD;
        END
        $$
        """
    )
    db_connection.execute(
        """
        CREATE TRIGGER aaa_profile_mutation_delete_probe
        BEFORE DELETE ON public.profile_mutation_results
        FOR EACH ROW EXECUTE FUNCTION public.capture_profile_mutation_delete_context()
        """
    )

    auth_privileges = db_connection.execute(
        """
        SELECT has_schema_privilege('supabase_auth_admin', 'auth', 'USAGE'),
               has_table_privilege('supabase_auth_admin', 'auth.users', 'SELECT'),
               has_table_privilege('supabase_auth_admin', 'auth.users', 'DELETE'),
               has_table_privilege('supabase_auth_admin', 'public.users', 'DELETE')
        """
    ).fetchone()
    assert auth_privileges == (True, True, True, False)

    db_connection.execute("SET ROLE supabase_auth_admin")
    db_connection.execute("DELETE FROM auth.users WHERE id = %s", (actor_id,))
    db_connection.execute("RESET ROLE")

    probe = db_connection.execute(
        """
        SELECT trigger_depth, auth_identity_present
        FROM public.profile_mutation_delete_probe
        WHERE user_id = %s
        """,
        (actor_id,),
    ).fetchall()
    assert len(probe) == 1
    assert probe[0][0] > 1
    assert probe[0][1] is False

    for table, owner_key in (
        ("users", "id"),
        ("learner_profiles", "user_id"),
        ("user_languages", "user_id"),
        ("profile_mutation_results", "user_id"),
    ):
        assert db_connection.execute(
            f"SELECT count(*) FROM public.{table} WHERE {owner_key} = %s", (actor_id,)
        ).fetchone() == (0,)
    assert db_connection.execute(
        "SELECT count(*) FROM auth.users WHERE id = %s", (actor_id,)
    ).fetchone() == (0,)

    assert db_connection.execute(
        "SELECT count(*) FROM auth.users WHERE id = %s", (other_actor_id,)
    ).fetchone() == (1,)
    assert db_connection.execute(
        "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s",
        (other_actor_id,),
    ).fetchone() == (1,)


def test_profile_replay_insert_racing_auth_erasure_cannot_leave_orphan(
    migrated_postgres_url: str,
) -> None:
    actor_id = uuid.uuid4()
    replay_key = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as setup:
        _, profile_id, _ = _insert_profile_replay(setup, actor_id=actor_id)
        setup.commit()

    application_name = f"profile-erasure-race-{uuid.uuid4().hex}"
    contender_url = make_conninfo(migrated_postgres_url, application_name=application_name)
    deletion = psycopg.connect(migrated_postgres_url)
    try:
        deletion.execute("DELETE FROM auth.users WHERE id = %s", (actor_id,))

        started = Event()

        def insert_replay_after_delete_starts() -> None:
            with psycopg.connect(contender_url) as contender:
                started.set()
                contender.execute(
                    """
                    INSERT INTO profile_mutation_results
                        (user_id, idempotency_key, operation_type, schema_version,
                         request_fingerprint, language_profile_id, http_status,
                         result_data_snapshot, result_etag, completed_at)
                    VALUES (%s, %s, 'create-language-profile-v1', 1, %s, %s, 201,
                            '{}'::jsonb, '"profile-etag"', now())
                    """,
                    (actor_id, replay_key, "e" * 64, profile_id),
                )

        with ThreadPoolExecutor(max_workers=1) as executor:
            pending_insert = executor.submit(insert_replay_after_delete_starts)
            try:
                assert started.wait(timeout=5)

                deadline = monotonic() + 5
                blocked = False
                while monotonic() < deadline:
                    with psycopg.connect(migrated_postgres_url) as observer:
                        wait_type = observer.execute(
                            """
                            SELECT wait_event_type
                            FROM pg_stat_activity
                            WHERE application_name = %s
                            """,
                            (application_name,),
                        ).fetchone()
                    if wait_type is not None and wait_type[0] == "Lock":
                        blocked = True
                        break
                    sleep(0.02)
                assert blocked, "concurrent replay insert did not wait on Auth erasure"
            finally:
                deletion.commit()

            with pytest.raises(psycopg.errors.ForeignKeyViolation):
                pending_insert.result(timeout=10)
    finally:
        deletion.close()

    with psycopg.connect(migrated_postgres_url) as check:
        assert check.execute(
            "SELECT count(*) FROM auth.users WHERE id = %s", (actor_id,)
        ).fetchone() == (0,)
        assert check.execute(
            "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s", (actor_id,)
        ).fetchone() == (0,)


def test_0018_0019_auth_erasure_migrations_roll_back_and_reapply_without_data_loss(
    isolated_migrated_postgres_url: str,
) -> None:
    actor_id = uuid.uuid4()
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        _insert_profile_replay(connection, actor_id=actor_id)
        connection.commit()
        migration_0018 = connection.execute(
            "SELECT name, checksum FROM schema_migrations WHERE version = '0018'"
        ).fetchone()
        migration_0019 = connection.execute(
            "SELECT name, checksum FROM schema_migrations WHERE version = '0019'"
        ).fetchone()
        assert migration_0018 is not None
        assert migration_0019 is not None

    assert migrate_down(isolated_migrated_postgres_url, MIGRATIONS, steps=2) == [
        "0019",
        "0018",
    ]
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        foreign_key = connection.execute(
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'public.profile_mutation_results'::regclass
              AND conname =
                  'profile_mutation_results_user_id_language_profile_id_fkey'
            """
        ).fetchone()
        assert foreign_key is not None
        assert foreign_key[0].endswith("ON DELETE RESTRICT")
        assert connection.execute(
            "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s",
            (actor_id,),
        ).fetchone() == (1,)

    assert migrate_up(isolated_migrated_postgres_url, MIGRATIONS) == ["0018", "0019"]
    assert migrate_up(isolated_migrated_postgres_url, MIGRATIONS) == []
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        foreign_key = connection.execute(
            """
            SELECT pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'public.profile_mutation_results'::regclass
              AND conname =
                  'profile_mutation_results_user_id_language_profile_id_fkey'
            """
        ).fetchone()
        assert foreign_key is not None
        assert foreign_key[0].endswith("ON DELETE CASCADE")
        assert connection.execute(
            "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s",
            (actor_id,),
        ).fetchone() == (1,)


def test_profile_migration_preserves_known_legacy_pair_and_fails_closed_preflight(
    postgres_url: str, tmp_path: Path
) -> None:
    partial = tmp_path / "migrations"
    shutil.copytree(MIGRATIONS, partial)
    for version in (
        "0007",
        "0008",
        "0009",
        "0010",
        "0011",
        "0012",
        "0013",
        "0014",
        "0015",
        "0016",
        "0017",
        "0018",
        "0019",
    ):
        for path in partial.glob(f"{version}_*.sql"):
            path.unlink()

    with _isolated_database(postgres_url) as database_url:
        assert migrate_up(database_url, partial) == [
            "0001",
            "0002",
            "0003",
            "0004",
            "0005",
            "0006",
        ]
        actor_id = uuid.uuid4()
        with psycopg.connect(database_url) as connection:
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
            connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
            connection.execute(
                """
                INSERT INTO learner_profiles (user_id, time_zone)
                VALUES (%s, 'Mars/Olympus')
                """,
                (actor_id,),
            )
            connection.execute(
                """
                INSERT INTO user_languages
                    (user_id, language_code, interface_language_code, goal, daily_minutes)
                VALUES (%s, 'vi', 'vi', 'general', 20)
                """,
                (actor_id,),
            )

        shutil.copy2(MIGRATIONS / "0007_profile_language_auth_bootstrap_v1.up.sql", partial)
        shutil.copy2(MIGRATIONS / "0007_profile_language_auth_bootstrap_v1.down.sql", partial)

        with pytest.raises(psycopg.errors.RaiseException, match="invalid legacy IANA timezone"):
            migrate_up(database_url, partial)

        with psycopg.connect(database_url) as connection:
            connection.execute(
                "UPDATE learner_profiles SET time_zone = 'Asia/Ho_Chi_Minh' WHERE user_id = %s",
                (actor_id,),
            )
        with pytest.raises(psycopg.errors.RaiseException, match="ambiguous legacy language pair"):
            migrate_up(database_url, partial)

        with psycopg.connect(database_url) as connection:
            connection.execute(
                "UPDATE user_languages SET language_code = 'en' WHERE user_id = %s",
                (actor_id,),
            )
        with pytest.raises(psycopg.errors.RaiseException, match="goal outside"):
            migrate_up(database_url, partial)

        with psycopg.connect(database_url) as connection:
            connection.execute(
                "UPDATE user_languages SET goal = 'communication' WHERE user_id = %s",
                (actor_id,),
            )
        assert migrate_up(database_url, partial) == ["0007"]

        with psycopg.connect(database_url) as connection:
            assert connection.execute(
                """
                SELECT interface_language_code, native_language_code, revision
                FROM user_languages WHERE user_id = %s
                """,
                (actor_id,),
            ).fetchone() == ("vi", "vi", 1)
            assert connection.execute(
                "SELECT time_zone, revision FROM learner_profiles WHERE user_id = %s",
                (actor_id,),
            ).fetchone() == ("Asia/Ho_Chi_Minh", 1)


def test_profile_migration_refuses_lossy_rollback_after_bootstrap(
    postgres_url: str,
) -> None:
    with _isolated_database(postgres_url) as database_url:
        migrate_up(database_url, MIGRATIONS)
        actor_id = uuid.uuid4()
        with psycopg.connect(database_url) as connection:
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
            connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
            connection.execute(
                "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, NULL)",
                (actor_id,),
            )

        assert migrate_down(database_url, MIGRATIONS, steps=10) == [
            "0019",
            "0018",
            "0017",
            "0016",
            "0015",
            "0014",
            "0013",
            "0012",
            "0011",
            "0010",
        ]
        assert migrate_down(database_url, MIGRATIONS, steps=1) == ["0009"]
        assert migrate_down(database_url, MIGRATIONS, steps=1) == ["0008"]
        with pytest.raises(psycopg.errors.RaiseException, match="timezone cannot be invented"):
            migrate_down(database_url, MIGRATIONS, steps=1)

        with psycopg.connect(database_url) as connection:
            connection.execute(
                """
                UPDATE learner_profiles
                SET time_zone = 'Asia/Ho_Chi_Minh', revision = 2
                WHERE user_id = %s
                """,
                (actor_id,),
            )
        with pytest.raises(psycopg.errors.RaiseException, match="learner revision changes"):
            migrate_down(database_url, MIGRATIONS, steps=1)

        profile_id = uuid.uuid4()
        with psycopg.connect(database_url) as connection:
            connection.execute(
                "UPDATE learner_profiles SET revision = 1 WHERE user_id = %s", (actor_id,)
            )
            connection.execute(
                """
                INSERT INTO user_languages
                    (id, user_id, language_code, native_language_code, goal, daily_minutes)
                VALUES (%s, %s, 'en', 'vi', 'communication', 20)
                """,
                (profile_id, actor_id),
            )
        with pytest.raises(
            psycopg.errors.RaiseException, match="native language cannot be collapsed"
        ):
            migrate_down(database_url, MIGRATIONS, steps=1)

        with psycopg.connect(database_url) as connection:
            connection.execute(
                "UPDATE user_languages SET interface_language_code = 'vi' WHERE id = %s",
                (profile_id,),
            )
            connection.execute(
                """
                INSERT INTO profile_mutation_results
                    (user_id, idempotency_key, operation_type, schema_version,
                     request_fingerprint, language_profile_id, http_status,
                     result_data_snapshot, result_etag, completed_at)
                VALUES (%s, %s, 'create-language-profile-v1', 1, %s, %s, 201,
                        '{}'::jsonb, '"etag"', now())
                """,
                (actor_id, uuid.uuid4(), "c" * 64, profile_id),
            )
        with pytest.raises(psycopg.errors.RaiseException, match="replay exists"):
            migrate_down(database_url, MIGRATIONS, steps=1)
