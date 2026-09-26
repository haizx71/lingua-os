"""Integration tests for Knowledge V2 Wave K2-03 graph integrity."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import pytest
from lingua_api.catalog.graph_service import (
    fetch_prerequisite_ancestors,
    fetch_prerequisite_descendants,
)
from lingua_api.catalog.models import ConceptEdge, ConceptEdgeDto, ConceptEdgeRelation
from psycopg import Connection, errors
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from database.migrate import _connect, migrate_down, migrate_up

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "database" / "migrations"
GRAPH_RELATION_TYPES = tuple(
    sorted(ConceptEdgeRelation(value).value for value in ConceptEdgeRelation)
)


def _seed_source_and_concept(
    conn: Connection[tuple[object, ...]],
    *,
    concept_type: str = "word",
    canonical_key: str | None = None,
) -> tuple[uuid.UUID, uuid.UUID]:
    license_row = conn.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'K2-03 test license', 'allowed', false)
        RETURNING id
        """,
        (f"k2-03-lic-{uuid.uuid4()}",),
    ).fetchone()
    assert license_row is not None

    source_row = conn.execute(
        """
        INSERT INTO data_sources (name, source_type, source_version, license_id, attribution_text)
        VALUES (%s, 'internal', 'k2-03', %s, 'LINGUA OS K2-03 tests')
        RETURNING id
        """,
        (f"k2-03-source-{uuid.uuid4()}", license_row[0]),
    ).fetchone()
    assert source_row is not None

    record_row = conn.execute(
        """
        INSERT INTO source_records (
            source_id, source_record_key, raw_hash, transform_version,
            quality_score, review_status
        )
        VALUES (%s, %s, %s, 'k2-03-v1', 1, 'approved')
        RETURNING id
        """,
        (source_row[0], str(uuid.uuid4()), "d" * 64),
    ).fetchone()
    assert record_row is not None

    concept_row = conn.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('en', %s, %s, %s)
        RETURNING id
        """,
        (concept_type, canonical_key or f"k2-03:concept:{uuid.uuid4()}", record_row[0]),
    ).fetchone()
    assert concept_row is not None
    return concept_row[0], record_row[0]  # type: ignore[return-value]


def _insert_edge(
    conn: Connection[tuple[object, ...]],
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    relation_type: str = "prerequisite_of",
) -> None:
    conn.execute(
        """
        INSERT INTO concept_edges (
            source_concept_id, target_concept_id, relation_type, metadata
        )
        VALUES (%s, %s, %s, '{}'::jsonb)
        """,
        (source_id, target_id, relation_type),
    )


def _assert_rejected(
    conn: Connection[tuple[object, ...]],
    query: str,
    params: tuple[object, ...],
    error_type: type[BaseException],
) -> None:
    with conn.cursor() as cursor:
        cursor.execute("SAVEPOINT k2_03_expected_failure")
        with pytest.raises(error_type):
            cursor.execute(query, params)
        cursor.execute("ROLLBACK TO SAVEPOINT k2_03_expected_failure")
        cursor.execute("RELEASE SAVEPOINT k2_03_expected_failure")


def test_graph_schema_constraints_and_indexes(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    table = db_connection.execute(
        """
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.concept_edges'::regclass
        """
    ).fetchone()
    assert table == (False,)

    columns = {
        row[0]: row[1]
        for row in db_connection.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'concept_edges'
            ORDER BY ordinal_position
            """
        ).fetchall()
    }
    assert columns == {
        "id": "uuid",
        "source_concept_id": "uuid",
        "target_concept_id": "uuid",
        "relation_type": "text",
        "weight": "real",
        "metadata": "jsonb",
        "created_at": "timestamp with time zone",
    }

    indexes = {
        row[0]
        for row in db_connection.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'concept_edges'
            """
        ).fetchall()
    }
    assert {
        "concept_edges_pkey",
        "uq_concept_edges_directed",
        "ix_concept_edges_source",
        "ix_concept_edges_target",
        "ix_concept_edges_prereqs",
    } <= indexes


def test_graph_relation_taxonomy_and_duplicate_identity(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    source_id, _ = _seed_source_and_concept(db_connection)
    target_id, _ = _seed_source_and_concept(db_connection)

    for relation_type in GRAPH_RELATION_TYPES:
        _insert_edge(db_connection, source_id, target_id, relation_type)

    assert db_connection.execute(
        "SELECT count(*) FROM concept_edges WHERE source_concept_id = %s",
        (source_id,),
    ).fetchone() == (len(GRAPH_RELATION_TYPES),)

    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (source_concept_id, target_concept_id, relation_type)
        VALUES (%s, %s, 'prerequisite_of')
        """,
        (source_id, target_id),
        errors.UniqueViolation,
    )
    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (source_concept_id, target_concept_id, relation_type)
        VALUES (%s, %s, 'not_a_v2_relation')
        """,
        (source_id, target_id),
        errors.CheckViolation,
    )
    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (
            source_concept_id, target_concept_id, relation_type, weight
        )
        VALUES (%s, %s, 'part_of', 1.1)
        """,
        (target_id, source_id),
        errors.CheckViolation,
    )
    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (
            source_concept_id, target_concept_id, relation_type, metadata
        )
        VALUES (%s, %s, 'part_of', '[]'::jsonb)
        """,
        (target_id, source_id),
        errors.CheckViolation,
    )


def test_self_cycle_deep_cycle_and_update_cycle_are_rejected(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    first_id, _ = _seed_source_and_concept(db_connection)
    second_id, _ = _seed_source_and_concept(db_connection)
    third_id, _ = _seed_source_and_concept(db_connection)

    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (source_concept_id, target_concept_id, relation_type)
        VALUES (%s, %s, 'prerequisite_of')
        """,
        (first_id, first_id),
        errors.CheckViolation,
    )

    _insert_edge(db_connection, first_id, second_id)
    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (source_concept_id, target_concept_id, relation_type)
        VALUES (%s, %s, 'prerequisite_of')
        """,
        (second_id, first_id),
        errors.CheckViolation,
    )
    _insert_edge(db_connection, second_id, third_id)

    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (source_concept_id, target_concept_id, relation_type)
        VALUES (%s, %s, 'prerequisite_of')
        """,
        (third_id, first_id),
        errors.CheckViolation,
    )
    _assert_rejected(
        db_connection,
        """
        UPDATE concept_edges
        SET source_concept_id = %s, target_concept_id = %s
        WHERE source_concept_id = %s
          AND target_concept_id = %s
          AND relation_type = 'prerequisite_of'
        """,
        (third_id, second_id, first_id, second_id),
        errors.CheckViolation,
    )


def test_symmetric_relation_can_store_both_directions(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    source_id, _ = _seed_source_and_concept(db_connection)
    target_id, _ = _seed_source_and_concept(db_connection)

    _insert_edge(db_connection, source_id, target_id, "synonym_of")
    _insert_edge(db_connection, target_id, source_id, "synonym_of")

    assert db_connection.execute(
        "SELECT count(*) FROM concept_edges WHERE relation_type = 'synonym_of'"
    ).fetchone() == (2,)


def test_foreign_keys_and_delete_cascades_only_the_v2_edges(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    source_id, _ = _seed_source_and_concept(db_connection)
    target_id, _ = _seed_source_and_concept(db_connection)
    dependent_id, _ = _seed_source_and_concept(db_connection)
    _insert_edge(db_connection, source_id, target_id)
    _insert_edge(db_connection, dependent_id, target_id)

    _assert_rejected(
        db_connection,
        """
        INSERT INTO concept_edges (source_concept_id, target_concept_id, relation_type)
        VALUES (%s, %s, 'part_of')
        """,
        (source_id, uuid.uuid4()),
        errors.ForeignKeyViolation,
    )

    db_connection.execute("DELETE FROM concepts WHERE id = %s", (source_id,))
    assert db_connection.execute(
        "SELECT count(*) FROM concept_edges WHERE source_concept_id = %s",
        (source_id,),
    ).fetchone() == (0,)
    assert db_connection.execute(
        "SELECT count(*) FROM concept_edges WHERE target_concept_id = %s",
        (target_id,),
    ).fetchone() == (1,)

    db_connection.execute("DELETE FROM concepts WHERE id = %s", (target_id,))
    assert db_connection.execute(
        "SELECT count(*) FROM concept_edges WHERE target_concept_id = %s",
        (target_id,),
    ).fetchone() == (0,)


def test_legacy_backfill_reapply_and_learner_isolation(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    assert migrate_down(database_url, MIGRATIONS_DIR, steps=3) == ["0018", "0017", "0016"]

    with _connect(database_url) as conn:
        source_id, source_record_id = _seed_source_and_concept(conn)
        target_id, _ = _seed_source_and_concept(conn)
        conn.execute(
            """
            INSERT INTO concept_relations (
                source_concept_id, target_concept_id, language_code,
                relation_type, weight, source_record_id
            )
            VALUES (%s, %s, 'en', 'prerequisite', 0.75, %s)
            """,
            (source_id, target_id, source_record_id),
        )
        conn.commit()

    assert migrate_up(database_url, MIGRATIONS_DIR) == ["0016", "0017", "0018"]
    assert migrate_up(database_url, MIGRATIONS_DIR) == []

    with _connect(database_url) as conn:
        row = conn.execute(
            """
            SELECT relation_type, weight, metadata->>'legacy_table'
            FROM concept_edges
            WHERE source_concept_id = %s AND target_concept_id = %s
            """,
            (source_id, target_id),
        ).fetchone()
        assert row == ("prerequisite_of", 0.75, "concept_relations")
        assert conn.execute("SELECT count(*) FROM concept_relations").fetchone() == (1,)

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


def test_recursive_graph_queries_are_bounded(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    first_id, _ = _seed_source_and_concept(db_connection)
    second_id, _ = _seed_source_and_concept(db_connection)
    third_id, _ = _seed_source_and_concept(db_connection)
    _insert_edge(db_connection, first_id, second_id)
    _insert_edge(db_connection, second_id, third_id)

    ancestors = fetch_prerequisite_ancestors(db_connection, third_id, max_depth=4)
    assert {(row.required_concept_id, row.depth) for row in ancestors} == {
        (first_id, 2),
        (second_id, 1),
    }

    descendants = fetch_prerequisite_descendants(db_connection, first_id, max_depth=1)
    assert [(row.dependent_concept_id, row.depth) for row in descendants] == [(second_id, 1)]

    with pytest.raises(ValueError):
        fetch_prerequisite_ancestors(db_connection, third_id, max_depth=0)
    with pytest.raises(ValueError):
        fetch_prerequisite_ancestors(db_connection, third_id, max_depth=5)


def test_graph_orm_and_dto_roundtrip(
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
        source_id, _ = _seed_source_and_concept(conn)
        target_id, _ = _seed_source_and_concept(conn)
        conn.commit()

    with Session(engine) as session:
        entity = ConceptEdge(
            source_concept_id=source_id,
            target_concept_id=target_id,
            relation_type=ConceptEdgeRelation.PART_OF.value,
            weight=0.8,
            edge_metadata={"origin": "k2-03-test"},
        )
        session.add(entity)
        session.commit()

        loaded = session.scalar(
            select(ConceptEdge).where(
                ConceptEdge.source_concept_id == source_id,
                ConceptEdge.target_concept_id == target_id,
            )
        )
        assert loaded is not None
        assert loaded.edge_metadata == {"origin": "k2-03-test"}
        dto = ConceptEdgeDto(
            id=loaded.id,
            source_concept_id=loaded.source_concept_id,
            target_concept_id=loaded.target_concept_id,
            relation_type=ConceptEdgeRelation(loaded.relation_type),
            weight=loaded.weight,
            metadata=loaded.edge_metadata,
            created_at=loaded.created_at,
        )
        assert dto.model_dump(mode="json", by_alias=True)["relationType"] == "part_of"

    engine.dispose()


def test_function_and_table_privilege_lockdown(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    for role in ("anon", "authenticated", "authenticator"):
        for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
            assert db_connection.execute(
                "SELECT has_table_privilege(%s, 'public.concept_edges', %s)",
                (role, privilege),
            ).fetchone() == (False,)

        assert db_connection.execute(
            """
            SELECT has_function_privilege(
                %s,
                'public.fn_check_concept_edges_acyclic()',
                'EXECUTE'
            )
            """,
            (role,),
        ).fetchone() == (False,)

    assert db_connection.execute(
        """
        SELECT has_function_privilege(
            'service_role',
            'public.fn_check_concept_edges_acyclic()',
            'EXECUTE'
        )
        """
    ).fetchone() == (True,)

    function_row = db_connection.execute(
        """
        SELECT prosecdef, proconfig
        FROM pg_proc
        WHERE oid = 'public.fn_check_concept_edges_acyclic()'::regprocedure
        """
    ).fetchone()
    assert function_row is not None
    assert function_row[0] is False
    proconfig = function_row[1] if isinstance(function_row[1], (list, tuple)) else ()
    assert "search_path=public, pg_temp" in proconfig


def _run_opposing_insert(
    database_url: str,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    barrier: Barrier,
) -> str:
    try:
        with _connect(database_url) as conn:
            barrier.wait(timeout=10)
            _insert_edge(conn, source_id, target_id)
            conn.commit()
            return "accepted"
    except errors.CheckViolation:
        return "rejected"


def test_concurrent_opposing_writes_leave_zero_cycles(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    with _connect(database_url) as conn:
        first_id, _ = _seed_source_and_concept(conn)
        second_id, _ = _seed_source_and_concept(conn)
        conn.commit()

    barrier = Barrier(2)
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = (
            executor.submit(
                _run_opposing_insert,
                database_url,
                first_id,
                second_id,
                barrier,
            ),
            executor.submit(
                _run_opposing_insert,
                database_url,
                second_id,
                first_id,
                barrier,
            ),
        )
        results = sorted(future.result(timeout=20) for future in futures)

    assert results == ["accepted", "rejected"]
    with _connect(database_url) as conn:
        assert conn.execute(
            """
            SELECT count(*)
            FROM public.concept_edges
            WHERE relation_type = 'prerequisite_of'
            """
        ).fetchone() == (1,)


def test_concept_edge_does_not_touch_learner_state(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    concept_states_before = db_connection.execute(
        "SELECT count(*) FROM user_concept_states"
    ).fetchone()
    review_items_before = db_connection.execute("SELECT count(*) FROM review_items").fetchone()

    source_id, _ = _seed_source_and_concept(db_connection)
    target_id, _ = _seed_source_and_concept(db_connection)
    _insert_edge(db_connection, source_id, target_id)

    assert (
        db_connection.execute("SELECT count(*) FROM user_concept_states").fetchone()
        == concept_states_before
    )
    assert (
        db_connection.execute("SELECT count(*) FROM review_items").fetchone() == review_items_before
    )
