from __future__ import annotations

from pathlib import Path

import psycopg
import pytest
from psycopg import Connection

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"


def _load_seed(connection: Connection[tuple[object, ...]]) -> None:
    connection.execute(READER_SEED.read_text(encoding="utf-8"))


def test_reader_migration_adds_only_the_bounded_authorities(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    tables = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            """
        ).fetchall()
    }
    assert {
        "user_content_progress",
        "reader_mutation_results",
        "reader_exposure_concepts",
    } <= tables

    item_columns = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'content_items'
            """
        ).fetchall()
    }
    segment_columns = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'content_segments'
            """
        ).fetchall()
    }
    assert {"curated_level_id", "reviewed_at"} <= item_columns
    assert "segment_type" in segment_columns


def test_reader_seed_is_deterministic_and_publication_gate_is_fail_closed(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _load_seed(db_connection)
    _load_seed(db_connection)

    counts = db_connection.execute(
        """
        SELECT
            (SELECT count(*) FROM content_items WHERE id::text LIKE '40000000-%'),
            (SELECT count(*) FROM sentences WHERE id::text LIKE '50000000-%'),
            (SELECT count(*) FROM concepts WHERE id::text LIKE '30000000-%'),
            (SELECT count(*) FROM sentence_concepts
              WHERE sentence_id::text LIKE '50000000-%')
        """
    ).fetchone()
    assert counts == (5, 14, 30, 42)

    public_rows = db_connection.execute(
        """
        SELECT id
        FROM content_items
        WHERE id::text LIKE '40000000-%'
          AND publication_status = 'published'
          AND reader_content_passes_publication_gate(id)
        ORDER BY id
        """
    ).fetchall()
    assert [str(row[0]) for row in public_rows] == [
        "40000000-0000-4000-8000-000000000001",
        "40000000-0000-4000-8000-000000000002",
        "40000000-0000-4000-8000-000000000003",
    ]

    restricted = db_connection.execute(
        """
        SELECT reader_content_passes_publication_gate(
            '40000000-0000-4000-8000-000000000005'::uuid
        )
        """
    ).fetchone()
    assert restricted == (False,)


def test_publication_gate_rejects_restricted_content(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _load_seed(db_connection)
    with pytest.raises(psycopg.errors.CheckViolation):
        db_connection.execute(
            """
            UPDATE content_items
            SET publication_status = 'published', published_at = now()
            WHERE id = '40000000-0000-4000-8000-000000000005'
            """
        )


def test_segment_type_rejects_unapproved_values(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _load_seed(db_connection)
    with pytest.raises(psycopg.errors.CheckViolation):
        db_connection.execute(
            """
            UPDATE content_segments SET segment_type = 'chapter'
            WHERE id = '60000000-0000-4000-8000-000000000001'
            """
        )


@pytest.mark.parametrize("usage_policy", ["restricted", "unknown", "prohibited"])
def test_publication_source_gate_rejects_every_non_allowed_license_state(
    db_connection: Connection[tuple[object, ...]], usage_policy: str
) -> None:
    _load_seed(db_connection)
    db_connection.execute(
        """
        UPDATE licenses SET usage_policy = %s
        WHERE id = '10000000-0000-4000-8000-000000000002'
        """,
        (usage_policy,),
    )
    assert db_connection.execute(
        """
        SELECT reader_source_record_is_allowed(
            '21000000-0000-4000-8000-000000000002'::uuid
        )
        """
    ).fetchone() == (False,)


@pytest.mark.parametrize(
    ("statement", "message"),
    [
        (
            """
            UPDATE content_segments SET text = text || ' changed'
            WHERE id = '60000000-0000-4000-8000-000000000001'
            """,
            "published Reader content structure is immutable",
        ),
        (
            """
            UPDATE sentences SET text = text || ' changed'
            WHERE id = '50000000-0000-4000-8000-000000000001'
            """,
            "published Reader sentence structure is immutable",
        ),
        (
            """
            UPDATE sentence_concepts SET end_offset = end_offset - 1
            WHERE sentence_id = '50000000-0000-4000-8000-000000000001'
              AND start_offset = 0
            """,
            "published Reader sentence structure is immutable",
        ),
    ],
)
def test_published_reader_structure_is_immutable(
    db_connection: Connection[tuple[object, ...]], statement: str, message: str
) -> None:
    _load_seed(db_connection)
    with pytest.raises(psycopg.errors.CheckViolation, match=message):
        db_connection.execute(statement)
