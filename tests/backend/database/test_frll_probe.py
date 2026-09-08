"""FRLL probe completeness against persisted PostgreSQL values, not source strings."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from psycopg.rows import dict_row

from tests.acceptance.support.postgres_probe import (
    PostgresLearnerProbe,
    normalize_scalar_for_json,
)

PARAMETERS = uuid.UUID("00000000-0000-4000-8600-000000000002")
CONCEPT = uuid.UUID("30000000-0000-4000-8000-000000000001")
SEED = Path(__file__).resolve().parents[3] / "database/seeds/task008_reader_mvp.sql"


def test_f1_probe_uses_repeatable_read_and_rejects_writes(migrated_postgres_url: str) -> None:
    probe = PostgresLearnerProbe(migrated_postgres_url)
    with probe._open_read_only_connection() as connection:
        isolation = connection.execute("SHOW transaction_isolation").fetchone()
        assert isolation is not None
        assert isolation["transaction_isolation"] == "repeatable read"
        with pytest.raises(psycopg.errors.ReadOnlySqlTransaction):
            connection.execute("INSERT INTO users (id) VALUES (%s)", (uuid.uuid4(),))


@pytest.fixture
def persisted_probe_learner(migrated_postgres_url: str) -> Iterator[tuple[str, uuid.UUID]]:
    actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(SEED.read_text(encoding="utf-8"))
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            """
            INSERT INTO user_languages
                (id, user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 20)
            """,
            (profile_id, actor_id),
        )
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, state_version,
                 projection_method_version, competence_parameter_set_id,
                 competence_parameter_version, production, production_confidence,
                 production_evidence_count, production_positive_mass, production_negative_mass,
                 production_last_evidence_at, has_learning_intent, has_projectable_evidence)
            VALUES (%s, %s, %s, 'learning', 3, 'competence-beta-v1', %s,
                    'competence-beta-v1', 0.51851852, 0.11111111, 1,
                    0.333333333333333333, 0.166666666666666667,
                    '2026-09-06T10:00:00Z', true, true)
            """,
            (actor_id, profile_id, CONCEPT, PARAMETERS),
        )
        connection.execute(
            """
            INSERT INTO user_skill_states
                (user_id, user_language_id, skill, score, confidence, evidence_count,
                 method_version, positive_mass, negative_mass, last_evidence_at,
                 state_version, competence_parameter_set_id, competence_parameter_version)
            VALUES (%s, %s, 'production', 0.51851852, 0.11111111, 1,
                    'competence-beta-v1', 0.333333333333333333, 0.166666666666666667,
                    '2026-09-06T10:00:00Z', 2, %s, 'competence-beta-v1')
            """,
            (actor_id, profile_id, PARAMETERS),
        )
        connection.execute(
            """
            INSERT INTO user_language_projection_heads
                (user_id, user_language_id, next_ingestion_sequence, parameter_set_id,
                 parameter_version, state_version)
            VALUES (%s, %s, 3, %s, 'competence-beta-v1', 3)
            """,
            (actor_id, profile_id, PARAMETERS),
        )
    try:
        yield migrated_postgres_url, actor_id
    finally:
        with psycopg.connect(migrated_postgres_url) as connection:
            connection.execute("DELETE FROM users WHERE id = %s", (actor_id,))
            connection.execute("DELETE FROM auth.users WHERE id = %s", (actor_id,))


@pytest.mark.parametrize(
    ("table", "digest_field"),
    [
        ("user_concept_states", "concept_state"),
        ("user_skill_states", "skill_states"),
        ("user_language_projection_heads", "projection_heads"),
    ],
)
def test_f1_digest_preserves_complete_persisted_projection(
    persisted_probe_learner: tuple[str, uuid.UUID], table: str, digest_field: str
) -> None:
    database_url, actor_id = persisted_probe_learner
    digest = PostgresLearnerProbe(database_url).capture_digest(actor_id, CONCEPT)
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        # Table names come exclusively from the static parametrization above.
        expected = connection.execute(
            psycopg.sql.SQL("SELECT * FROM {} WHERE user_id = %s").format(
                psycopg.sql.Identifier(table)
            ),
            (actor_id,),
        ).fetchone()
    assert expected is not None
    captured = getattr(digest, digest_field, None)
    assert captured is not None, f"Digest omitted {digest_field}"
    if digest_field != "concept_state":
        assert len(captured) == 1
        captured = captured[0]
    for column, value in expected.items():
        assert column in captured, f"Digest omitted persisted {table}.{column}"
        assert captured[column] == normalize_scalar_for_json(value), column


def test_f1_cleanup_reports_competence_tables_and_verifies_cascade(
    persisted_probe_learner: tuple[str, uuid.UUID],
) -> None:
    database_url, actor_id = persisted_probe_learner
    probe = PostgresLearnerProbe(database_url)
    before = probe.verify_cleanup(actor_id, CONCEPT)
    assert before["counts"].get("user_skill_states") == 1
    assert before["counts"].get("user_language_projection_heads") == 1

    probe.teardown_disposable_user(actor_id)

    after = probe.verify_cleanup(actor_id, CONCEPT)
    assert after["clean"] is True
    assert after["counts"]["user_skill_states"] == 0
    assert after["counts"]["user_language_projection_heads"] == 0
    assert after["anchor_concept_intact"] is True
