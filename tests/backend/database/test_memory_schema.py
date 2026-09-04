from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import cast

import psycopg
import pytest
from psycopg import Connection, errors
from psycopg.types.json import Jsonb

DEFAULT_PARAMETER_SET_ID = uuid.UUID("00000000-0000-4000-8600-000000000001")
DEFAULT_PARAMETER_VERSION = "fsrs6-global-default-v1"
DEFAULT_WEIGHTS = [
    0.212,
    1.2931,
    2.3065,
    8.2956,
    6.4133,
    0.8334,
    3.0194,
    0.001,
    1.8722,
    0.1666,
    0.796,
    1.4835,
    0.0614,
    0.2629,
    1.6483,
    0.6014,
    1.8729,
    0.5425,
    0.0912,
    0.0658,
    0.1542,
]


def _seed_review_item(
    connection: Connection[tuple[object, ...]],
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    user_id = uuid.uuid4()
    connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (user_id,))
    connection.execute("INSERT INTO users (id) VALUES (%s)", (user_id,))
    language_row = connection.execute(
        """
        INSERT INTO user_languages
            (user_id, language_code, interface_language_code, native_language_code,
             goal, daily_minutes)
        VALUES (%s, 'en', 'vi', 'vi', 'basics', 20)
        RETURNING id
        """,
        (user_id,),
    ).fetchone()
    assert language_row is not None
    user_language_id = language_row[0]

    license_row = connection.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'Memory test license', 'allowed', false)
        RETURNING id
        """,
        (f"memory-license-{uuid.uuid4()}",),
    ).fetchone()
    assert license_row is not None
    source_row = connection.execute(
        """
        INSERT INTO data_sources
            (name, source_type, source_version, license_id, attribution_text)
        VALUES (%s, 'internal', '1', %s, 'Memory schema fixture')
        RETURNING id
        """,
        (f"memory-source-{uuid.uuid4()}", license_row[0]),
    ).fetchone()
    assert source_row is not None
    source_record_row = connection.execute(
        """
        INSERT INTO source_records
            (source_id, source_record_key, raw_hash, transform_version,
             quality_score, review_status)
        VALUES (%s, %s, %s, 'memory-test-v1', 1, 'approved')
        RETURNING id
        """,
        (source_row[0], str(uuid.uuid4()), "b" * 64),
    ).fetchone()
    assert source_record_row is not None
    concept_row = connection.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('en', 'word', %s, %s)
        RETURNING id
        """,
        (f"memory-concept-{uuid.uuid4()}", source_record_row[0]),
    ).fetchone()
    assert concept_row is not None
    review_item_row = connection.execute(
        """
        INSERT INTO review_items
            (user_id, user_language_id, concept_id, status, created_from)
        VALUES (%s, %s, %s, 'active', 'learner_saved')
        RETURNING id
        """,
        (user_id, user_language_id, concept_row[0]),
    ).fetchone()
    assert review_item_row is not None
    return user_id, user_language_id, review_item_row[0]  # type: ignore[return-value]


def test_fsrs6_default_parameter_set_is_seeded_exactly_once(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    row = db_connection.execute(
        """
        SELECT id, scope, language_code, version, algorithm_version, library_version,
               parameters, is_default
        FROM fsrs_parameter_sets
        WHERE is_default
        """
    ).fetchone()

    assert row is not None
    assert row[:6] == (
        DEFAULT_PARAMETER_SET_ID,
        "global",
        None,
        DEFAULT_PARAMETER_VERSION,
        "FSRS-6",
        "6.3.2",
    )
    parameters = row[6]
    assert isinstance(parameters, Mapping)
    assert parameters == {
        "model_weights": DEFAULT_WEIGHTS,
        "desired_retention": 0.9,
        "learning_steps_seconds": [60, 600],
        "relearning_steps_seconds": [600],
        "maximum_interval_days": 36500,
        "enable_fuzzing": False,
    }
    assert row[7] is True
    count = db_connection.execute(
        "SELECT count(*) FROM fsrs_parameter_sets WHERE is_default"
    ).fetchone()
    assert count == (1,)


def test_parameter_history_is_immutable_but_default_marker_can_change(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    with pytest.raises(psycopg.DatabaseError, match="immutable"):
        db_connection.execute(
            "UPDATE fsrs_parameter_sets SET parameters = '{}'::jsonb WHERE id = %s",
            (DEFAULT_PARAMETER_SET_ID,),
        )
    db_connection.rollback()

    db_connection.execute(
        "UPDATE fsrs_parameter_sets SET is_default = false WHERE id = %s",
        (DEFAULT_PARAMETER_SET_ID,),
    )
    marker = db_connection.execute(
        "SELECT is_default FROM fsrs_parameter_sets WHERE id = %s",
        (DEFAULT_PARAMETER_SET_ID,),
    ).fetchone()
    assert marker == (False,)

    with pytest.raises(psycopg.DatabaseError, match="immutable"):
        db_connection.execute(
            "DELETE FROM fsrs_parameter_sets WHERE id = %s",
            (DEFAULT_PARAMETER_SET_ID,),
        )


def test_new_memory_state_allows_only_the_uninitialized_fsrs_shape(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, _, review_item_id = _seed_review_item(db_connection)
    db_connection.execute(
        """
        INSERT INTO fsrs_states
            (review_item_id, user_id, difficulty, stability, due_at, last_review_at,
             state, step, parameter_set_id, params_version)
        VALUES (%s, %s, NULL, NULL, now(), NULL, 'new', NULL, %s, %s)
        """,
        (review_item_id, user_id, DEFAULT_PARAMETER_SET_ID, DEFAULT_PARAMETER_VERSION),
    )

    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            UPDATE fsrs_states
            SET state = 'learning', step = 0
            WHERE review_item_id = %s
            """,
            (review_item_id,),
        )


@pytest.mark.parametrize(
    ("exercise_mode", "evidence_mode"),
    [
        ("self_recall", "production"),
        ("multiple_choice", "recognition"),
        ("typing", "production"),
        ("cloze", "cloze"),
        ("listening", "listening"),
    ],
)
def test_review_events_persist_contract_and_evidence_modes(
    db_connection: Connection[tuple[object, ...]],
    exercise_mode: str,
    evidence_mode: str,
) -> None:
    user_id, _, review_item_id = _seed_review_item(db_connection)
    db_connection.execute(
        """
        INSERT INTO review_events
            (review_item_id, user_id, exercise_mode, evidence_mode, rating,
             response_time_ms, correct, idempotency_key, request_fingerprint,
             parameter_set_id, params_version, result_memory_snapshot)
        VALUES (%s, %s, %s, %s, 'good', 800, NULL, %s, %s, %s, %s, %s)
        """,
        (
            review_item_id,
            user_id,
            exercise_mode,
            evidence_mode,
            str(uuid.uuid4()),
            "c" * 64,
            DEFAULT_PARAMETER_SET_ID,
            DEFAULT_PARAMETER_VERSION,
            Jsonb(
                {
                    "reviewItemId": str(review_item_id),
                    "difficulty": 2.0,
                    "stability": 1.0,
                    "dueAt": "2026-08-24T03:00:00+00:00",
                    "lastReviewAt": "2026-08-23T03:00:00+00:00",
                    "state": "review",
                    "step": None,
                    "parameterSetId": str(DEFAULT_PARAMETER_SET_ID),
                    "paramsVersion": DEFAULT_PARAMETER_VERSION,
                    "stateVersion": 2,
                }
            ),
        ),
    )

    row = db_connection.execute(
        """
        SELECT exercise_mode, evidence_mode, correct
        FROM review_events
        WHERE review_item_id = %s
        """,
        (review_item_id,),
    ).fetchone()
    assert row == (exercise_mode, evidence_mode, None)


def test_new_review_event_requires_an_idempotent_result_snapshot(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, _, review_item_id = _seed_review_item(db_connection)

    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO review_events
                (review_item_id, user_id, exercise_mode, evidence_mode, rating,
                 response_time_ms, correct, idempotency_key, request_fingerprint,
                 parameter_set_id, params_version)
            VALUES (%s, %s, 'self_recall', 'production', 'good', 800, NULL,
                    %s, %s, %s, %s)
            """,
            (
                review_item_id,
                user_id,
                str(uuid.uuid4()),
                "d" * 64,
                DEFAULT_PARAMETER_SET_ID,
                DEFAULT_PARAMETER_VERSION,
            ),
        )


def test_memory_due_query_index_is_user_scoped(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    definition = db_connection.execute(
        """
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'ix_fsrs_states_user_due_at'
        """
    ).fetchone()
    assert definition is not None
    assert "(user_id, due_at, review_item_id)" in cast(str, definition[0])
