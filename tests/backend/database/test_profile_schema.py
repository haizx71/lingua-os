from __future__ import annotations

import shutil
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

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


def test_profile_migration_preserves_known_legacy_pair_and_fails_closed_preflight(
    postgres_url: str, tmp_path: Path
) -> None:
    partial = tmp_path / "migrations"
    shutil.copytree(MIGRATIONS, partial)
    for version in ("0007", "0008", "0009", "0010", "0011", "0012", "0013"):
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

        assert migrate_down(database_url, MIGRATIONS, steps=4) == [
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
