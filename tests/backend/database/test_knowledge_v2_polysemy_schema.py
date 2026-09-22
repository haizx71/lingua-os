"""Integration and model tests for Knowledge V2 Wave K2-02 polysemy resolution."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from lingua_api.catalog.models import ConceptSense, ConceptSenseDto
from psycopg import Connection, errors
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from database.migrate import _connect, migrate_down, migrate_up


def _seed_source_and_concept(
    conn: Connection[tuple[object, ...]],
    *,
    canonical_key: str | None = None,
    concept_type: str = "grammar",
) -> uuid.UUID:
    """Create a valid canonical concept with approved provenance."""
    license_row = conn.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'Knowledge V2 permissive test license', 'allowed', false)
        RETURNING id
        """,
        (f"k2-02-lic-{uuid.uuid4()}",),
    ).fetchone()
    assert license_row is not None

    source_row = conn.execute(
        """
        INSERT INTO data_sources (name, source_type, source_version, license_id, attribution_text)
        VALUES (%s, 'internal', '2', %s, 'LINGUA OS K2-02 test fixture')
        RETURNING id
        """,
        (f"k2-02-src-{uuid.uuid4()}", license_row[0]),
    ).fetchone()
    assert source_row is not None

    record_row = conn.execute(
        """
        INSERT INTO source_records (
            source_id, source_record_key, raw_hash, transform_version,
            quality_score, review_status
        )
        VALUES (%s, %s, %s, 'k2-02-v1', 1, 'approved')
        RETURNING id
        """,
        (source_row[0], str(uuid.uuid4()), "c" * 64),
    ).fetchone()
    assert record_row is not None

    concept_row = conn.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('en', %s, %s, %s)
        RETURNING id
        """,
        (concept_type, canonical_key or f"k2-02:concept:{uuid.uuid4()}", record_row[0]),
    ).fetchone()
    assert concept_row is not None
    return concept_row[0]  # type: ignore[return-value]


MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "database" / "migrations"


def _seed_lexeme_with_senses(
    conn: Connection[tuple[object, ...]],
    *,
    lemma: str = "bank",
    normalized_form: str | None = None,
) -> tuple[uuid.UUID, uuid.UUID, list[uuid.UUID]]:
    """Create one legacy concept, one deduplicated lexeme and ordered senses."""
    concept_id = _seed_source_and_concept(
        conn,
        canonical_key=f"k2-02:legacy:{uuid.uuid4()}",
        concept_type="word",
    )
    source_record = conn.execute(
        "SELECT source_record_id FROM concepts WHERE id = %s",
        (concept_id,),
    ).fetchone()
    assert source_record is not None

    normalized = normalized_form or f"{lemma}-{uuid.uuid4().hex[:8]}"
    lexeme_row = conn.execute(
        """
        INSERT INTO lexemes (
            concept_id, language_code, lemma, normalized_form, part_of_speech, source_record_id
        )
        VALUES (%s, 'en', %s, %s, 'noun', %s)
        RETURNING id
        """,
        (concept_id, lemma, normalized, source_record[0]),
    ).fetchone()
    assert lexeme_row is not None

    sense_ids: list[uuid.UUID] = []
    definitions = ("financial institution", "land beside a river")
    for order, definition in enumerate(definitions, start=1):
        sense_row = conn.execute(
            """
            INSERT INTO word_senses (
                lexeme_id, sense_order, definition, definition_language_code,
                translated_definition, translation_language_code, source_record_id
            )
            VALUES (%s, %s, %s, 'en', %s, 'vi', %s)
            RETURNING id
            """,
            (
                lexeme_row[0],
                order,
                definition,
                "nghĩa " + str(order),
                source_record[0],
            ),
        ).fetchone()
        assert sense_row is not None
        sense_ids.append(sense_row[0])  # type: ignore[arg-type]

    return concept_id, lexeme_row[0], sense_ids  # type: ignore[return-value]


def test_concept_senses_table_structure_and_security(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    table = db_connection.execute(
        """
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.concept_senses'::regclass
        """
    ).fetchone()
    assert table == (False,)

    columns = {
        row[0]: row[1]
        for row in db_connection.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'concept_senses'
            ORDER BY ordinal_position
            """
        ).fetchall()
    }
    assert columns == {
        "concept_id": "uuid",
        "word_sense_id": "uuid",
        "is_primary": "boolean",
        "created_at": "timestamp with time zone",
    }

    primary_key = db_connection.execute(
        """
        SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
        FROM pg_index AS i
        JOIN pg_attribute AS a
          ON a.attrelid = i.indrelid
         AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'public.concept_senses'::regclass
          AND i.indisprimary
        GROUP BY i.indexrelid
        """
    ).fetchone()
    assert primary_key == (["concept_id", "word_sense_id"],)

    index_names = {
        row[0]
        for row in db_connection.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'concept_senses'
            """
        ).fetchall()
    }
    assert "ix_concept_senses_word_sense" in index_names

    for role in ("anon", "authenticated"):
        for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
            result = db_connection.execute(
                "SELECT has_table_privilege(%s, 'public.concept_senses', %s)",
                (role, privilege),
            ).fetchone()
            assert result == (False,), f"{role} must not have {privilege}"

    foreign_keys = db_connection.execute(
        """
        SELECT
            conname,
            confdeltype
        FROM pg_constraint
        WHERE conrelid = 'public.concept_senses'::regclass
          AND contype = 'f'
        ORDER BY conname
        """
    ).fetchall()
    assert [(row[0], row[1]) for row in foreign_keys] == [
        ("concept_senses_concept_id_fkey", "c"),
        ("concept_senses_word_sense_id_fkey", "c"),
    ]


def test_two_concepts_resolve_two_senses_through_one_lexeme(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _, lexeme_id, sense_ids = _seed_lexeme_with_senses(
        db_connection,
        lemma="bank",
        normalized_form=f"bank-{uuid.uuid4().hex[:8]}",
    )
    finance_concept = _seed_source_and_concept(
        db_connection,
        canonical_key=f"k2-02:bank:finance:{uuid.uuid4()}",
        concept_type="word",
    )
    river_concept = _seed_source_and_concept(
        db_connection,
        canonical_key=f"k2-02:bank:river:{uuid.uuid4()}",
        concept_type="word",
    )

    db_connection.execute(
        """
        INSERT INTO concept_senses (concept_id, word_sense_id, is_primary)
        VALUES (%s, %s, true), (%s, %s, true)
        """,
        (finance_concept, sense_ids[0], river_concept, sense_ids[1]),
    )

    rows = db_connection.execute(
        """
        SELECT cs.concept_id, ws.sense_order, ws.definition, ws.lexeme_id
        FROM concept_senses AS cs
        JOIN word_senses AS ws ON ws.id = cs.word_sense_id
        WHERE cs.concept_id IN (%s, %s)
        ORDER BY ws.sense_order
        """,
        (finance_concept, river_concept),
    ).fetchall()
    assert [(row[0], row[1], row[2], row[3]) for row in rows] == [
        (finance_concept, 1, "financial institution", lexeme_id),
        (river_concept, 2, "land beside a river", lexeme_id),
    ]

    lexeme_count = db_connection.execute(
        """
        SELECT count(*)
        FROM lexemes
        WHERE language_code = 'en'
          AND normalized_form = (
              SELECT normalized_form FROM lexemes WHERE id = %s
          )
          AND part_of_speech = 'noun'
        """,
        (lexeme_id,),
    ).fetchone()
    assert lexeme_count == (1,)

    with db_connection.cursor() as cursor:
        cursor.execute("SAVEPOINT k2_02_duplicate_lexeme")
        with pytest.raises(errors.UniqueViolation):
            cursor.execute(
                """
                INSERT INTO lexemes (
                    concept_id, language_code, lemma, normalized_form, part_of_speech,
                    source_record_id
                )
                SELECT concept_id, language_code, lemma, normalized_form, part_of_speech,
                       source_record_id
                FROM lexemes
                WHERE id = %s
                """,
                (lexeme_id,),
            )
        cursor.execute("ROLLBACK TO SAVEPOINT k2_02_duplicate_lexeme")
        cursor.execute("RELEASE SAVEPOINT k2_02_duplicate_lexeme")

    morphology_count = db_connection.execute(
        "SELECT count(*) FROM lexeme_forms WHERE lexeme_id = %s",
        (lexeme_id,),
    ).fetchone()
    assert morphology_count == (0,)


def test_concept_senses_cascade_on_concept_and_word_sense_delete(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _, lexeme_id, sense_ids = _seed_lexeme_with_senses(db_connection)
    bridge_concept = _seed_source_and_concept(
        db_connection,
        canonical_key=f"k2-02:cascade:{uuid.uuid4()}",
        concept_type="word",
    )
    db_connection.execute(
        """
        INSERT INTO concept_senses (concept_id, word_sense_id)
        VALUES (%s, %s)
        """,
        (bridge_concept, sense_ids[0]),
    )
    db_connection.execute("DELETE FROM concepts WHERE id = %s", (bridge_concept,))
    assert db_connection.execute(
        "SELECT count(*) FROM concept_senses WHERE concept_id = %s",
        (bridge_concept,),
    ).fetchone() == (0,)

    second_bridge_concept = _seed_source_and_concept(
        db_connection,
        canonical_key=f"k2-02:cascade-second:{uuid.uuid4()}",
        concept_type="word",
    )
    db_connection.execute(
        """
        INSERT INTO concept_senses (concept_id, word_sense_id)
        VALUES (%s, %s)
        """,
        (second_bridge_concept, sense_ids[1]),
    )
    db_connection.execute("DELETE FROM word_senses WHERE id = %s", (sense_ids[1],))
    assert db_connection.execute(
        "SELECT count(*) FROM concept_senses WHERE concept_id = %s",
        (second_bridge_concept,),
    ).fetchone() == (0,)

    # The legacy lexeme remains intact; deleting its word sense does not duplicate or
    # remove the shared lemma.
    assert db_connection.execute(
        "SELECT count(*) FROM lexemes WHERE id = %s",
        (lexeme_id,),
    ).fetchone() == (1,)


def test_legacy_sense_backfill_is_exact_and_learner_state_free(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    assert migrate_down(database_url, MIGRATIONS_DIR, steps=2) == ["0016", "0015"]

    with _connect(database_url) as conn:
        _, lexeme_id, sense_ids = _seed_lexeme_with_senses(
            conn,
            lemma="legacy-bank",
            normalized_form=f"legacy-bank-{uuid.uuid4().hex[:8]}",
        )
        conn.commit()

    assert migrate_up(database_url, MIGRATIONS_DIR) == ["0015", "0016"]
    assert migrate_up(database_url, MIGRATIONS_DIR) == []

    with _connect(database_url) as conn:
        rows = conn.execute(
            """
            SELECT is_primary
            FROM concept_senses
            WHERE word_sense_id = ANY(%s::uuid[])
            ORDER BY is_primary DESC
            """,
            (sense_ids,),
        ).fetchall()
        assert rows == [(True,), (False,)]

        learner_tables = (
            "user_concept_states",
            "user_skill_states",
            "learning_events",
            "exposure_events",
            "review_items",
            "fsrs_states",
            "review_events",
            "today_plans",
            "today_plan_activities",
            "user_saved_concepts",
            "user_saved_content",
            "user_saved_sentences",
        )
        for table_name in learner_tables:
            assert conn.execute(f"SELECT count(*) FROM {table_name}").fetchone() == (0,)

        # The one lexeme and both ordered senses are preserved exactly.
        assert conn.execute(
            "SELECT count(*) FROM lexemes WHERE id = %s",
            (lexeme_id,),
        ).fetchone() == (1,)


def test_concept_sense_orm_and_dto_roundtrip(
    isolated_migrated_postgres_url: str,
) -> None:
    db_url = isolated_migrated_postgres_url
    if db_url.startswith(("postgresql://", "postgresql+psycopg://")):
        sqlalchemy_url = db_url.replace("postgresql://", "postgresql+psycopg://")
        engine = create_engine(sqlalchemy_url)
    else:
        from psycopg.conninfo import conninfo_to_dict
        from sqlalchemy import URL

        params = conninfo_to_dict(db_url)
        user = str(params["user"]) if params.get("user") is not None else None
        pwd = str(params["password"]) if params.get("password") is not None else None
        host = str(params["host"]) if params.get("host") is not None else None
        port = int(str(params["port"])) if params.get("port") is not None else None
        dbname = str(params["dbname"]) if params.get("dbname") is not None else None
        engine = create_engine(
            URL.create(
                "postgresql+psycopg",
                username=user,
                password=pwd,
                host=host,
                port=port,
                database=dbname,
            )
        )

    with _connect(db_url) as conn:
        _, _, sense_ids = _seed_lexeme_with_senses(conn)
        bridge_concept = _seed_source_and_concept(
            conn,
            canonical_key=f"k2-02:orm:{uuid.uuid4()}",
            concept_type="word",
        )
        conn.commit()

    with Session(engine) as session:
        entity = ConceptSense(
            concept_id=bridge_concept,
            word_sense_id=sense_ids[0],
            is_primary=True,
        )
        session.add(entity)
        session.commit()

        loaded = session.scalar(
            select(ConceptSense).where(
                ConceptSense.concept_id == bridge_concept,
                ConceptSense.word_sense_id == sense_ids[0],
            )
        )
        assert loaded is not None
        assert loaded.is_primary is True
        assert loaded.created_at is not None

        dto = ConceptSenseDto(
            concept_id=loaded.concept_id,
            word_sense_id=loaded.word_sense_id,
            is_primary=loaded.is_primary,
            created_at=loaded.created_at,
        )
        assert dto.model_dump(mode="json", by_alias=True)["wordSenseId"] == str(sense_ids[0])

    engine.dispose()
