from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import cast

import psycopg
import pytest
from psycopg import Connection, errors
from psycopg.types.json import Jsonb

COMPETENCE_PARAMETER_SET_ID = uuid.UUID("00000000-0000-4000-8600-000000000002")
COMPETENCE_VERSION = "competence-beta-v1"


def _seed_owned_concept(
    connection: Connection[tuple[object, ...]], *, concept_type: str = "word"
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    user_id = uuid.uuid4()
    connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (user_id,))
    connection.execute("INSERT INTO users (id) VALUES (%s)", (user_id,))
    profile = connection.execute(
        """
        INSERT INTO user_languages
            (user_id, language_code, interface_language_code, native_language_code,
             goal, daily_minutes)
        VALUES (%s, 'en', 'vi', 'vi', 'basics', 20)
        RETURNING id
        """,
        (user_id,),
    ).fetchone()
    license_row = connection.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'Competence test', 'allowed', false)
        RETURNING id
        """,
        (f"competence-{uuid.uuid4()}",),
    ).fetchone()
    assert profile is not None and license_row is not None
    source = connection.execute(
        """
        INSERT INTO data_sources
            (name, source_type, source_version, license_id, attribution_text)
        VALUES (%s, 'internal', '1', %s, 'Competence fixture')
        RETURNING id
        """,
        (f"competence-source-{uuid.uuid4()}", license_row[0]),
    ).fetchone()
    assert source is not None
    source_record = connection.execute(
        """
        INSERT INTO source_records
            (source_id, source_record_key, raw_hash, transform_version,
             quality_score, review_status)
        VALUES (%s, %s, %s, 'competence-v1', 1, 'approved')
        RETURNING id
        """,
        (source[0], str(uuid.uuid4()), uuid.uuid4().hex * 2),
    ).fetchone()
    assert source_record is not None
    concept = connection.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('en', %s, %s, %s)
        RETURNING id
        """,
        (concept_type, f"competence-{uuid.uuid4()}", source_record[0]),
    ).fetchone()
    assert concept is not None
    return user_id, cast(uuid.UUID, profile[0]), cast(uuid.UUID, concept[0])


def test_competence_beta_v1_parameter_set_is_seeded_and_immutable(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    row = db_connection.execute(
        """
        SELECT id, version, method_version, parameters, is_default
        FROM competence_parameter_sets WHERE is_default
        """
    ).fetchone()

    assert row is not None
    assert row[:3] == (
        COMPETENCE_PARAMETER_SET_ID,
        COMPETENCE_VERSION,
        COMPETENCE_VERSION,
    )
    assert isinstance(row[3], Mapping)
    assert row[3]["prior_alpha"] == 2
    assert row[3]["prior_beta"] == 2
    assert row[3]["confidence_half_saturation_mass"] == 4
    assert row[3]["mastery_policies"] == {
        "word": {"recognition": 0.4, "listening": 0.3, "production": 0.3},
        "phrase": {"recognition": 0.4, "listening": 0.3, "production": 0.3},
        "grammar": {"recognition": 0.5, "listening": 0, "production": 0.5},
    }
    assert row[4] is True

    with pytest.raises(psycopg.DatabaseError, match="immutable"):
        db_connection.execute(
            "UPDATE competence_parameter_sets SET parameters = '{}'::jsonb WHERE id = %s",
            (COMPETENCE_PARAMETER_SET_ID,),
        )


def test_skill_policy_requires_bounded_weights_that_sum_to_one(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _, _, concept_id = _seed_owned_concept(db_connection, concept_type="skill")
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO concept_competence_policies
                (concept_id, parameter_set_id, parameter_version,
                 recognition_weight, listening_weight, production_weight)
            VALUES (%s, %s, %s, 0.6, 0.6, 0)
            """,
            (concept_id, COMPETENCE_PARAMETER_SET_ID, COMPETENCE_VERSION),
        )


def test_versioned_skill_policy_history_is_immutable(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    _, _, concept_id = _seed_owned_concept(db_connection, concept_type="skill")
    db_connection.execute(
        """
        INSERT INTO concept_competence_policies
            (concept_id, parameter_set_id, parameter_version,
             recognition_weight, listening_weight, production_weight)
        VALUES (%s, %s, %s, 0, 1, 0)
        """,
        (concept_id, COMPETENCE_PARAMETER_SET_ID, COMPETENCE_VERSION),
    )

    with pytest.raises(psycopg.DatabaseError, match="immutable"), db_connection.transaction():
        db_connection.execute(
            """
            UPDATE concept_competence_policies SET listening_weight = 0.5,
                recognition_weight = 0.5
            WHERE concept_id = %s AND parameter_set_id = %s AND parameter_version = %s
            """,
            (concept_id, COMPETENCE_PARAMETER_SET_ID, COMPETENCE_VERSION),
        )


def test_legacy_scalar_projection_has_no_evidence_lineage(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, profile_id, concept_id = _seed_owned_concept(db_connection)
    row = db_connection.execute(
        """
        INSERT INTO user_concept_states
            (user_id, user_language_id, concept_id, status,
             recognition, listening, production, confidence, state_version)
        VALUES (%s, %s, %s, 'learning', 0, 0.9, 0.2, 0.8, 1)
        RETURNING recognition, recognition_positive_mass, recognition_negative_mass,
                  recognition_evidence_count, competence_parameter_set_id
        """,
        (user_id, profile_id, concept_id),
    ).fetchone()

    assert row == (0, 0, 0, 0, None)


def test_canonical_learning_identity_and_fingerprint_are_constrained(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, profile_id, concept_id = _seed_owned_concept(db_connection)
    source_event_id = uuid.uuid4()
    payload = Jsonb(
        {
            "exerciseMode": "cloze",
            "rating": "good",
            "correct": True,
            "outcome": 1,
            "weight": 1,
            "dimension": "recognition",
        }
    )
    values = (
        user_id,
        profile_id,
        concept_id,
        source_event_id,
        f"concept:{concept_id}",
        "a" * 64,
        COMPETENCE_PARAMETER_SET_ID,
        COMPETENCE_VERSION,
        payload,
    )
    db_connection.execute(
        """
        INSERT INTO learning_events
            (user_id, user_language_id, concept_id, event_type, payload,
             source_type, source_event_id, derivation_key, request_fingerprint,
             ingestion_sequence, ingested_at, projection_method_version,
             competence_parameter_set_id, competence_parameter_version)
        VALUES (%s, %s, %s, 'learning.review.completed.v1', %s,
                'review_event', %s, %s, %s, 1, now(), 'competence-beta-v1', %s, %s)
        """,
        (
            values[0],
            values[1],
            values[2],
            values[8],
            values[3],
            values[4],
            values[5],
            values[6],
            values[7],
        ),
    )

    with pytest.raises(errors.UniqueViolation):
        db_connection.execute(
            """
            INSERT INTO learning_events
                (user_id, user_language_id, concept_id, event_type, payload,
                 source_type, source_event_id, derivation_key, request_fingerprint,
                 ingestion_sequence, ingested_at, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version)
            VALUES (%s, %s, %s, 'learning.review.completed.v1', %s,
                    'review_event', %s, %s, %s, 2, now(), 'competence-beta-v1', %s, %s)
            """,
            (
                values[0],
                values[1],
                values[2],
                values[8],
                values[3],
                values[4],
                values[5],
                values[6],
                values[7],
            ),
        )


def test_projection_head_is_owned_and_replay_indexes_are_concrete(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    indexes = {
        row[0]: row[1]
        for row in db_connection.execute(
            """
            SELECT indexname, indexdef FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname IN (
                'uq_learning_events_source_derivation',
                'uq_learning_events_profile_ingestion_sequence',
                'ix_learning_events_profile_replay'
              )
            """
        ).fetchall()
    }
    assert set(indexes) == {
        "uq_learning_events_source_derivation",
        "uq_learning_events_profile_ingestion_sequence",
        "ix_learning_events_profile_replay",
    }
    rls = db_connection.execute(
        "SELECT relrowsecurity FROM pg_class WHERE relname = 'user_language_projection_heads'"
    ).fetchone()
    assert rls == (True,)


def test_canonical_learning_events_reject_direct_update_and_delete(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, profile_id, concept_id = _seed_owned_concept(db_connection)
    event_id = db_connection.execute(
        """
        INSERT INTO learning_events
            (user_id, user_language_id, concept_id, event_type, payload,
             source_type, source_event_id, derivation_key, request_fingerprint,
             ingestion_sequence, ingested_at, projection_method_version,
             competence_parameter_set_id, competence_parameter_version)
        VALUES (%s, %s, %s, 'learning.exposure.recorded.v1', '{}'::jsonb,
                'exposure_event', %s, %s, %s, 1, now(), 'competence-beta-v1', %s, %s)
        RETURNING learning_event_id
        """,
        (
            user_id,
            profile_id,
            concept_id,
            uuid.uuid4(),
            f"concept:{concept_id}",
            "b" * 64,
            COMPETENCE_PARAMETER_SET_ID,
            COMPETENCE_VERSION,
        ),
    ).fetchone()
    assert event_id is not None

    with pytest.raises(psycopg.DatabaseError, match="append-only"), db_connection.transaction():
        db_connection.execute(
            "UPDATE learning_events SET payload = '{\"changed\": true}'::jsonb "
            "WHERE learning_event_id = %s",
            (event_id[0],),
        )
    with pytest.raises(psycopg.DatabaseError, match="append-only"), db_connection.transaction():
        db_connection.execute(
            "DELETE FROM learning_events WHERE learning_event_id = %s",
            (event_id[0],),
        )
