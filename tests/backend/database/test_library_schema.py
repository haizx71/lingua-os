from __future__ import annotations

import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg import Connection

from database.migrate import migrate_down, migrate_up

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
MIGRATIONS_DIR = ROOT / "database" / "migrations"


def test_migration_0009_adds_concept_save_intents_table_and_indexes(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    columns = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'concept_save_intents'
            """
        ).fetchall()
    }
    assert {
        "id",
        "user_id",
        "user_language_id",
        "concept_id",
        "language_code",
        "created_at",
    } <= columns

    indexes = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'user_saved_concepts'
            """
        ).fetchall()
    }
    assert "ix_saved_concepts_user_saved_at" in indexes


def test_concept_save_intents_immutability_enforced(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, concept_id = _seed_owner_and_concept(db_connection)
    intent_id = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO concept_save_intents
            (id, user_id, user_language_id, concept_id, language_code)
        VALUES (%s, %s, %s, %s, 'en')
        """,
        (intent_id, actor_id, profile_id, concept_id),
    )

    with (
        pytest.raises(psycopg.errors.CheckViolation, match="immutable"),
        db_connection.transaction(),
    ):
        db_connection.execute(
            "UPDATE concept_save_intents SET language_code = 'vi' WHERE id = %s",
            (intent_id,),
        )

    with (
        pytest.raises(psycopg.errors.CheckViolation, match="immutable"),
        db_connection.transaction(),
    ):
        db_connection.execute(
            "DELETE FROM concept_save_intents WHERE id = %s",
            (intent_id,),
        )


def test_concept_save_intents_uniqueness_per_user_and_concept(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, concept_id = _seed_owner_and_concept(db_connection)
    db_connection.execute(
        """
        INSERT INTO concept_save_intents
            (user_id, user_language_id, concept_id, language_code)
        VALUES (%s, %s, %s, 'en')
        """,
        (actor_id, profile_id, concept_id),
    )

    with pytest.raises(psycopg.errors.UniqueViolation), db_connection.transaction():
        db_connection.execute(
            """
            INSERT INTO concept_save_intents
                (user_id, user_language_id, concept_id, language_code)
            VALUES (%s, %s, %s, 'en')
            """,
            (actor_id, profile_id, concept_id),
        )


def test_learning_events_source_type_accepts_concept_save_intent(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, concept_id = _seed_owner_and_concept(db_connection)
    intent_id = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO concept_save_intents
            (id, user_id, user_language_id, concept_id, language_code)
        VALUES (%s, %s, %s, %s, 'en')
        """,
        (intent_id, actor_id, profile_id, concept_id),
    )

    param_row = db_connection.execute(
        "SELECT id, version FROM competence_parameter_sets WHERE is_default"
    ).fetchone()
    assert param_row is not None
    param_id, param_version = param_row

    db_connection.execute(
        """
        INSERT INTO learning_events
            (learning_event_id, user_id, user_language_id, language_code, event_type,
             concept_id, payload, source_type, source_event_id, derivation_key,
             request_fingerprint, ingestion_sequence, ingested_at,
             projection_method_version, competence_parameter_set_id, competence_parameter_version)
        VALUES (%s, %s, %s, 'en', 'learning.concept.saved.v1', %s, '{}'::jsonb,
                'concept_save_intent', %s, 'concept:save',
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 1, now(),
                'competence-beta-v1', %s, %s)
        """,
        (uuid.uuid4(), actor_id, profile_id, concept_id, intent_id, param_id, param_version),
    )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            """
            INSERT INTO learning_events
                (learning_event_id, user_id, user_language_id, language_code, event_type,
                 concept_id, payload, source_type, source_event_id, derivation_key,
                 request_fingerprint, ingestion_sequence, ingested_at,
                 projection_method_version, competence_parameter_set_id,
                 competence_parameter_version)
            VALUES (%s, %s, %s, 'en', 'learning.concept.saved.v1', %s, '{}'::jsonb,
                    'invalid_source_type', %s, 'concept:save',
                    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 2, now(),
                    'competence-beta-v1', %s, %s)
            """,
            (uuid.uuid4(), actor_id, profile_id, concept_id, intent_id, param_id, param_version),
        )


def test_migration_0009_rollback_and_replay(isolated_migrated_postgres_url: str) -> None:
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        table_exists = connection.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'concept_save_intents'
            """
        ).fetchone()
        assert table_exists is not None

    assert migrate_down(isolated_migrated_postgres_url, MIGRATIONS_DIR, steps=1) == ["0010"]
    assert migrate_down(isolated_migrated_postgres_url, MIGRATIONS_DIR, steps=1) == ["0009"]

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        table_after_down = connection.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'concept_save_intents'
            """
        ).fetchone()
        assert table_after_down is None

    assert migrate_up(isolated_migrated_postgres_url, MIGRATIONS_DIR) == ["0009", "0010"]

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        table_after_up = connection.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'concept_save_intents'
            """
        ).fetchone()
        assert table_after_up is not None


def _seed_owner_and_concept(
    connection: Connection[tuple[object, ...]],
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    connection.execute(READER_SEED.read_text(encoding="utf-8"))
    actor_id = uuid.uuid4()
    connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
    connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
    connection.execute(
        "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Asia/Ho_Chi_Minh')",
        (actor_id,),
    )
    profile_row = connection.execute(
        """
        INSERT INTO user_languages
            (user_id, language_code, interface_language_code, native_language_code,
             goal, current_level_id, daily_minutes)
        VALUES (%s, 'en', 'vi', 'vi', 'communication',
                '00000000-0000-4000-8100-000000000001', 20)
        RETURNING id
        """,
        (actor_id,),
    ).fetchone()
    assert profile_row is not None
    profile_id = uuid.UUID(str(profile_row[0]))
    concept_id = uuid.UUID("30000000-0000-4000-8000-000000000001")
    return actor_id, profile_id, concept_id


def test_concept_save_intents_browser_roles_are_locked_out(migrated_postgres_url: str) -> None:
    owner_id = uuid.uuid4()
    intent_id = uuid.uuid4()
    concept_id = uuid.UUID("30000000-0000-4000-8000-000000000001")

    with psycopg.connect(migrated_postgres_url) as admin:
        admin.execute(READER_SEED.read_text(encoding="utf-8"))
        admin.execute("INSERT INTO auth.users (id) VALUES (%s)", (owner_id,))
        admin.execute("INSERT INTO users (id) VALUES (%s)", (owner_id,))
        admin.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Asia/Ho_Chi_Minh')",
            (owner_id,),
        )
        profile_row = admin.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            RETURNING id
            """,
            (owner_id,),
        ).fetchone()
        assert profile_row is not None
        admin.execute(
            """
            INSERT INTO concept_save_intents
                (id, user_id, user_language_id, concept_id, language_code)
            VALUES (%s, %s, %s, %s, 'en')
            """,
            (intent_id, owner_id, profile_row[0], concept_id),
        )
        admin.commit()

    with psycopg.connect(migrated_postgres_url) as authenticated_session:
        authenticated_session.execute("SET ROLE authenticated")
        authenticated_session.execute(
            "SELECT set_config('request.jwt.claim.sub', %s, false)", (str(owner_id),)
        )
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            authenticated_session.execute("SELECT id FROM concept_save_intents").fetchall()

    with psycopg.connect(migrated_postgres_url) as anon_session:
        anon_session.execute("SET ROLE anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            anon_session.execute("SELECT id FROM concept_save_intents").fetchall()
