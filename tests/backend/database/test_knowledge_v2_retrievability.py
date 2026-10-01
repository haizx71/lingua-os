"""Integration coverage for Knowledge V2 Wave K2-05 retrievability projection."""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fsrs import Card, Scheduler, State
from lingua_api.competence.domain import ConceptStatus
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.memory.retrievability import (
    RetrievabilityProjectionUnavailable,
    fetch_concept_retrievability,
)
from psycopg import Connection, errors, sql
from psycopg.types.json import Jsonb

from database.migrate import _connect, discover_migrations, migrate_down, migrate_up
from scripts.verify_frll_database import LEARNER_DERIVED_TABLES

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "database" / "migrations"
K2_05_LEARNER_TABLES = (
    *LEARNER_DERIVED_TABLES,
    "user_content_progress",
    "reader_mutation_results",
    "reader_exposure_concepts",
    "assessment_attempt_items",
    "assessment_idempotency_log",
)


@dataclass(frozen=True)
class ProjectionSeed:
    actor: AuthenticatedActor
    user_language_id: uuid.UUID
    concept_id: uuid.UUID
    review_item_id: uuid.UUID
    parameter_set_id: uuid.UUID
    params_version: str


def _learner_snapshots(
    connection: Connection[tuple[object, ...]],
) -> dict[str, tuple[int, str]]:
    snapshots: dict[str, tuple[int, str]] = {}
    for table in K2_05_LEARNER_TABLES:
        row = connection.execute(
            sql.SQL(
                "SELECT count(*), COALESCE(jsonb_agg(to_jsonb(snapshot_row) "
                "ORDER BY to_jsonb(snapshot_row)::text), '[]'::jsonb)::text "
                "FROM {} AS snapshot_row"
            ).format(sql.Identifier(table))
        ).fetchone()
        assert row is not None
        snapshots[table] = (int(cast(int, row[0])), str(row[1]))
    return snapshots


def _as_uuid(value: object) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _seed_projection(
    connection: Connection[tuple[object, ...]],
    *,
    status: str = "mastered",
    stability: float | None = 10.0,
    last_review_at: datetime | None = None,
    weight_20: float | None = None,
    weight_overrides: dict[int, float] | None = None,
) -> ProjectionSeed:
    actor = AuthenticatedActor(uuid.uuid4())
    connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
    connection.execute("INSERT INTO users (id) VALUES (%s)", (actor.id,))
    language_row = connection.execute(
        """
        INSERT INTO user_languages
            (user_id, language_code, interface_language_code, native_language_code,
             goal, daily_minutes)
        VALUES (%s, 'en', 'vi', 'vi', 'basics', 20)
        RETURNING id
        """,
        (actor.id,),
    ).fetchone()
    assert language_row is not None
    user_language_id = _as_uuid(language_row[0])

    license_row = connection.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'K2-05 test license', 'allowed', false)
        RETURNING id
        """,
        (f"k2-05-license-{uuid.uuid4()}",),
    ).fetchone()
    assert license_row is not None
    source_row = connection.execute(
        """
        INSERT INTO data_sources
            (name, source_type, source_version, license_id, attribution_text)
        VALUES (%s, 'internal', 'k2-05', %s, 'LINGUA OS K2-05 tests')
        RETURNING id
        """,
        (f"k2-05-source-{uuid.uuid4()}", license_row[0]),
    ).fetchone()
    assert source_row is not None
    record_row = connection.execute(
        """
        INSERT INTO source_records
            (source_id, source_record_key, raw_hash, transform_version,
             quality_score, review_status)
        VALUES (%s, %s, %s, 'k2-05-v1', 1, 'approved')
        RETURNING id
        """,
        (source_row[0], str(uuid.uuid4()), "5" * 64),
    ).fetchone()
    assert record_row is not None
    concept_row = connection.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('en', 'word', %s, %s)
        RETURNING id
        """,
        (f"k2-05:concept:{uuid.uuid4()}", record_row[0]),
    ).fetchone()
    assert concept_row is not None
    concept_id = _as_uuid(concept_row[0])

    connection.execute(
        """
        INSERT INTO user_concept_states
            (user_id, user_language_id, concept_id, status, recognition,
             listening, production, mastery, confidence, state_version)
        VALUES (%s, %s, %s, %s, 0.9, 0.8, 0.7, 0.8, 0.9, 11)
        """,
        (actor.id, user_language_id, concept_id, status),
    )
    item_row = connection.execute(
        """
        INSERT INTO review_items
            (user_id, user_language_id, concept_id, status, created_from)
        VALUES (%s, %s, %s, 'active', 'learner_saved')
        RETURNING id
        """,
        (actor.id, user_language_id, concept_id),
    ).fetchone()
    assert item_row is not None
    review_item_id = _as_uuid(item_row[0])

    parameter_row = connection.execute(
        """
        SELECT id, version, parameters
        FROM fsrs_parameter_sets
        WHERE is_default
        """
    ).fetchone()
    assert parameter_row is not None
    parameter_set_id = _as_uuid(parameter_row[0])
    params_version = str(parameter_row[1])
    if weight_20 is not None or weight_overrides:
        payload = cast(dict[str, Any], parameter_row[2]).copy()
        weights = list(cast(list[float], payload["model_weights"]))
        if weight_20 is not None:
            weights[20] = weight_20
        for index, value in (weight_overrides or {}).items():
            weights[index] = value
        payload["model_weights"] = weights
        parameter_set_id = uuid.uuid4()
        params_version = f"k2-05-custom-{uuid.uuid4()}"
        connection.execute(
            """
            INSERT INTO fsrs_parameter_sets
                (id, scope, language_code, version, algorithm_version,
                 library_version, parameters, is_default)
            VALUES (%s, 'global', NULL, %s, 'FSRS-6', '6.3.2', %s, false)
            """,
            (parameter_set_id, params_version, Jsonb(payload)),
        )

    if stability is None:
        connection.execute(
            """
            INSERT INTO fsrs_states
                (review_item_id, user_id, difficulty, stability, due_at, last_review_at,
                 state, step, parameter_set_id, params_version, state_version)
            VALUES (%s, %s, NULL, NULL, transaction_timestamp(), NULL,
                    'new', NULL, %s, %s, 3)
            """,
            (review_item_id, actor.id, parameter_set_id, params_version),
        )
    else:
        reviewed_at = last_review_at or datetime.now(UTC) - timedelta(days=30)
        connection.execute(
            """
            INSERT INTO fsrs_states
                (review_item_id, user_id, difficulty, stability, due_at, last_review_at,
                 state, step, parameter_set_id, params_version, state_version)
            VALUES (%s, %s, 5, %s, %s, %s, 'review', NULL, %s, %s, 3)
            """,
            (
                review_item_id,
                actor.id,
                stability,
                reviewed_at + timedelta(days=365),
                reviewed_at,
                parameter_set_id,
                params_version,
            ),
        )

    return ProjectionSeed(
        actor=actor,
        user_language_id=user_language_id,
        concept_id=concept_id,
        review_item_id=review_item_id,
        parameter_set_id=parameter_set_id,
        params_version=params_version,
    )


def _scheduler_for_parameter_set(
    connection: Connection[tuple[object, ...]], parameter_set_id: uuid.UUID
) -> Scheduler:
    row = connection.execute(
        "SELECT parameters FROM fsrs_parameter_sets WHERE id = %s",
        (parameter_set_id,),
    ).fetchone()
    assert row is not None
    payload = cast(dict[str, Any], row[0])
    return Scheduler(
        parameters=cast(list[float], payload["model_weights"]),
        desired_retention=float(payload["desired_retention"]),
        enable_fuzzing=False,
    )


def _replace_seed_lineage_with_raw_weight(
    connection: Connection[tuple[object, ...]],
    seed: ProjectionSeed,
    *,
    weight_index: int,
    json_numeric: str,
) -> tuple[uuid.UUID, str]:
    parameter_set_id = uuid.uuid4()
    params_version = f"k2-05-raw-{uuid.uuid4()}"
    connection.execute(
        """
        INSERT INTO fsrs_parameter_sets
            (id, scope, language_code, version, algorithm_version,
             library_version, parameters, is_default)
        SELECT %s, 'global', NULL, %s, 'FSRS-6', '6.3.2',
               jsonb_set(
                   parameters,
                   ARRAY['model_weights', %s],
                   %s::jsonb,
                   false
               ),
               false
        FROM fsrs_parameter_sets
        WHERE is_default
        """,
        (parameter_set_id, params_version, str(weight_index), json_numeric),
    )
    connection.execute(
        """
        UPDATE fsrs_states
        SET parameter_set_id = %s, params_version = %s
        WHERE review_item_id = %s AND user_id = %s
        """,
        (parameter_set_id, params_version, seed.review_item_id, seed.actor.id),
    )
    return parameter_set_id, params_version


def _projection_row(
    connection: Connection[tuple[object, ...]], seed: ProjectionSeed
) -> tuple[object, ...]:
    row = connection.execute(
        """
        SELECT stored_status, effective_status, memory_state, due_at, last_review_at,
               parameter_set_id, params_version, current_retrievability, calculated_at
        FROM public.v_learner_concept_retrievability
        WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
        """,
        (seed.actor.id, seed.user_language_id, seed.concept_id),
    ).fetchone()
    assert row is not None
    return row


def _card_for_row(seed: ProjectionSeed, row: tuple[object, ...], stability: float) -> Card:
    last_review_at = cast(datetime, row[4])
    return Card(
        card_id=seed.review_item_id.int,
        state=State.Review,
        step=None,
        stability=stability,
        difficulty=5.0,
        due=cast(datetime, row[3]),
        last_review=last_review_at,
    )


@pytest.mark.parametrize("weight_20", [0.1, 0.1542, 0.3, 0.8])
def test_sql_projection_matches_pyfsrs_parameter_lineage(
    db_connection: Connection[tuple[object, ...]], weight_20: float
) -> None:
    seed = _seed_projection(db_connection, stability=7.25, weight_20=weight_20)
    row = _projection_row(db_connection, seed)
    scheduler = _scheduler_for_parameter_set(db_connection, seed.parameter_set_id)
    expected = scheduler.get_card_retrievability(
        _card_for_row(seed, row, 7.25),
        current_datetime=cast(datetime, row[8]),
    )
    actual = float(cast(float, row[7]))

    assert math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-9)
    assert row[5:7] == (seed.parameter_set_id, seed.params_version)


def test_new_card_projects_zero_without_dynamic_downgrade(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection, status="learning", stability=None)
    row = _projection_row(db_connection, seed)

    assert row[0:3] == ("learning", "learning", "new")
    assert row[4] is None
    assert float(cast(float, row[7])) == 0


def test_sql_projection_uses_integer_elapsed_days_and_clamps_future_reviews(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    calculated_at = cast(
        datetime,
        db_connection.execute("SELECT transaction_timestamp()").fetchone()[0],  # type: ignore[index]
    )
    seed = _seed_projection(
        db_connection,
        status="active",
        stability=8.0,
        last_review_at=calculated_at - timedelta(days=4, hours=23, minutes=59),
    )
    row = _projection_row(db_connection, seed)
    scheduler = _scheduler_for_parameter_set(db_connection, seed.parameter_set_id)
    expected = scheduler.get_card_retrievability(
        _card_for_row(seed, row, 8.0),
        current_datetime=cast(datetime, row[8]),
    )
    assert math.isclose(float(cast(float, row[7])), expected, rel_tol=1e-6)

    db_connection.execute(
        "UPDATE fsrs_states SET last_review_at = transaction_timestamp() + interval '1 second', "
        "due_at = transaction_timestamp() + interval '1 day' WHERE review_item_id = %s",
        (seed.review_item_id,),
    )
    future_row = _projection_row(db_connection, seed)
    assert float(cast(float, future_row[7])) == 1


def _first_day_below(scheduler: Scheduler, *, stability: float, threshold: float) -> int:
    now = datetime(2026, 9, 23, tzinfo=UTC)
    for days in range(1, 100_001):
        card = Card(
            card_id=1,
            state=State.Review,
            step=None,
            stability=stability,
            difficulty=5.0,
            due=now,
            last_review=now - timedelta(days=days),
        )
        if scheduler.get_card_retrievability(card, current_datetime=now) < threshold:
            return days
    raise AssertionError(f"no day crossed threshold {threshold}")


@pytest.mark.parametrize(
    ("stored_status", "threshold", "expected_below", "expected_above"),
    [
        ("active", 0.75, "weak", "active"),
        ("mastered", 0.70, "weak", "mastered"),
        ("active", 0.50, "forgotten", "weak"),
        ("mastered", 0.50, "forgotten", "weak"),
    ],
)
def test_decay_thresholds_map_both_sides_to_accepted_statuses(
    db_connection: Connection[tuple[object, ...]],
    stored_status: str,
    threshold: float,
    expected_below: str,
    expected_above: str,
) -> None:
    stability = 10.0
    seed = _seed_projection(db_connection, status=stored_status, stability=stability)
    scheduler = _scheduler_for_parameter_set(db_connection, seed.parameter_set_id)
    days = _first_day_below(scheduler, stability=stability, threshold=threshold)
    db_connection.execute(
        """
        UPDATE fsrs_states
        SET last_review_at = transaction_timestamp() - make_interval(days => %s),
            due_at = transaction_timestamp() + interval '1 day'
        WHERE review_item_id = %s
        """,
        (days, seed.review_item_id),
    )
    below_row = _projection_row(db_connection, seed)

    below = float(cast(float, below_row[7]))
    assert below < threshold
    if expected_below == "weak":
        assert below >= 0.50
    assert below_row[1] == expected_below

    db_connection.execute(
        """
        UPDATE fsrs_states
        SET last_review_at = transaction_timestamp() - make_interval(days => %s)
        WHERE review_item_id = %s
        """,
        (days - 1, seed.review_item_id),
    )
    above_row = _projection_row(db_connection, seed)
    assert float(cast(float, above_row[7])) >= threshold
    assert above_row[1] == expected_above


def test_invalid_parameter_lineage_fails_closed_in_typed_repository(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection, stability=5.0, weight_20=0.0)
    row = _projection_row(db_connection, seed)
    assert row[7] is None

    with pytest.raises(RetrievabilityProjectionUnavailable):
        fetch_concept_retrievability(
            db_connection,
            actor=seed.actor,
            user_language_id=seed.user_language_id,
            concept_id=seed.concept_id,
        )


@pytest.mark.parametrize(
    ("weight_index", "invalid_value"),
    [(0, 0.0), (4, 10.1), (7, 0.751), (16, 0.99), (19, 0.801)],
)
def test_any_out_of_bounds_pyfsrs_weight_fails_closed(
    db_connection: Connection[tuple[object, ...]],
    weight_index: int,
    invalid_value: float,
) -> None:
    seed = _seed_projection(
        db_connection,
        stability=5.0,
        weight_overrides={weight_index: invalid_value},
    )
    assert _projection_row(db_connection, seed)[7] is None


def test_extreme_json_numeric_weight_fails_closed_without_projection_error(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection, stability=5.0)
    _replace_seed_lineage_with_raw_weight(
        db_connection,
        seed,
        weight_index=0,
        json_numeric="1e10000",
    )

    assert _projection_row(db_connection, seed)[7] is None
    with pytest.raises(RetrievabilityProjectionUnavailable):
        fetch_concept_retrievability(
            db_connection,
            actor=seed.actor,
            user_language_id=seed.user_language_id,
            concept_id=seed.concept_id,
        )


def test_new_card_requires_valid_parameter_lineage_for_zero_projection(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection, stability=None, weight_overrides={0: 0.0})
    assert _projection_row(db_connection, seed)[7] is None
    with pytest.raises(RetrievabilityProjectionUnavailable):
        fetch_concept_retrievability(
            db_connection,
            actor=seed.actor,
            user_language_id=seed.user_language_id,
            concept_id=seed.concept_id,
        )


def test_missing_memory_lineage_fails_closed(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection, stability=None)
    db_connection.execute(
        "DELETE FROM fsrs_states WHERE review_item_id = %s",
        (seed.review_item_id,),
    )
    assert _projection_row(db_connection, seed)[7] is None
    with pytest.raises(RetrievabilityProjectionUnavailable):
        fetch_concept_retrievability(
            db_connection,
            actor=seed.actor,
            user_language_id=seed.user_language_id,
            concept_id=seed.concept_id,
        )


def test_typed_repository_is_actor_and_profile_scoped(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection, stability=12.0)
    projection = fetch_concept_retrievability(
        db_connection,
        actor=seed.actor,
        user_language_id=seed.user_language_id,
        concept_id=seed.concept_id,
    )
    assert projection is not None
    assert projection.concept_id == seed.concept_id
    assert projection.review_item_id == seed.review_item_id
    assert projection.stored_status is ConceptStatus.MASTERED
    assert 0 <= projection.current_retrievability <= 1

    assert (
        fetch_concept_retrievability(
            db_connection,
            actor=AuthenticatedActor(uuid.uuid4()),
            user_language_id=seed.user_language_id,
            concept_id=seed.concept_id,
        )
        is None
    )


def test_view_shape_owner_and_privileges(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    columns = [
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'v_learner_concept_retrievability'
            ORDER BY ordinal_position
            """
        ).fetchall()
    ]
    assert columns == [
        "user_id",
        "user_language_id",
        "concept_id",
        "review_item_id",
        "stored_status",
        "effective_status",
        "memory_state",
        "due_at",
        "last_review_at",
        "parameter_set_id",
        "params_version",
        "current_retrievability",
        "calculated_at",
    ]

    metadata = db_connection.execute(
        """
        SELECT pg_get_userbyid(relowner), reloptions
        FROM pg_class
        WHERE oid = 'public.v_learner_concept_retrievability'::regclass
        """
    ).fetchone()
    assert metadata is not None
    assert metadata[0] not in {"anon", "authenticated", "authenticator", "service_role"}
    assert "security_barrier=true" in cast(list[str], metadata[1])

    for role in ("anon", "authenticated", "authenticator"):
        assert db_connection.execute(
            "SELECT has_table_privilege(%s, 'public.v_learner_concept_retrievability', 'SELECT')",
            (role,),
        ).fetchone() == (False,)
    assert db_connection.execute(
        """
        SELECT count(*)
        FROM pg_class AS relation
        CROSS JOIN LATERAL aclexplode(
            COALESCE(relation.relacl, acldefault('r', relation.relowner))
        ) AS privilege
        WHERE relation.oid = 'public.v_learner_concept_retrievability'::regclass
          AND privilege.grantee = 0
          AND privilege.privilege_type = 'SELECT'
        """
    ).fetchone() == (0,)
    assert db_connection.execute(
        "SELECT has_table_privilege('service_role', "
        "'public.v_learner_concept_retrievability', 'SELECT')"
    ).fetchone() == (True,)
    for privilege in ("INSERT", "UPDATE", "DELETE", "TRUNCATE"):
        assert db_connection.execute(
            "SELECT has_table_privilege('service_role', "
            "'public.v_learner_concept_retrievability', %s)",
            (privilege,),
        ).fetchone() == (False,)


def test_service_role_can_read_view_while_browser_role_is_denied(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection)
    db_connection.execute("SET LOCAL ROLE service_role")
    assert db_connection.execute(
        """
        SELECT count(*)
        FROM public.v_learner_concept_retrievability
        WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
        """,
        (seed.actor.id, seed.user_language_id, seed.concept_id),
    ).fetchone() == (1,)
    db_connection.execute("RESET ROLE")

    db_connection.execute("SAVEPOINT browser_denied")
    db_connection.execute("SET LOCAL ROLE authenticated")
    with pytest.raises(errors.InsufficientPrivilege):
        db_connection.execute("SELECT * FROM public.v_learner_concept_retrievability")
    db_connection.execute("ROLLBACK TO SAVEPOINT browser_denied")
    db_connection.execute("RELEASE SAVEPOINT browser_denied")


def _plan_nodes(plan: dict[str, object]) -> list[dict[str, object]]:
    nodes = [plan]
    for child in cast(list[dict[str, object]], plan.get("Plans", [])):
        nodes.extend(_plan_nodes(child))
    return nodes


def test_actor_profile_query_plan_is_bounded_without_new_index(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection)
    for _ in range(24):
        _seed_projection(db_connection)
    db_connection.execute("SET LOCAL enable_seqscan = off")
    result = db_connection.execute(
        """
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT concept_id, effective_status, current_retrievability
        FROM public.v_learner_concept_retrievability
        WHERE user_id = %s AND user_language_id = %s
        """,
        (seed.actor.id, seed.user_language_id),
    ).fetchone()
    assert result is not None
    document = cast(list[dict[str, object]], result[0])[0]
    assert float(cast(float, document["Execution Time"])) < 15
    nodes = _plan_nodes(cast(dict[str, object], document["Plan"]))
    assert all(node.get("Node Type") != "Materialize" for node in nodes)
    indexed_relations = {
        str(node["Relation Name"])
        for node in nodes
        if node.get("Node Type") in {"Index Scan", "Index Only Scan", "Bitmap Heap Scan"}
        and "Relation Name" in node
    }
    assert {"user_concept_states", "review_items", "fsrs_states"} <= indexed_relations
    assert all(
        node.get("Node Type") != "Seq Scan"
        for node in nodes
        if node.get("Relation Name") in {"user_concept_states", "review_items", "fsrs_states"}
    )
    assert all(
        int(cast(int, node.get("Actual Rows", 0))) <= 1
        for node in nodes
        if node.get("Relation Name") in {"user_concept_states", "review_items", "fsrs_states"}
    )
    assert db_connection.execute(
        """
        SELECT count(*)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'ix_fsrs_states_retrievability_speed'
        """
    ).fetchone() == (0,)


def test_0017_checksum_rollback_reapply_and_learner_delta(
    isolated_migrated_postgres_url: str,
) -> None:
    database_url = isolated_migrated_postgres_url
    migration = next(item for item in discover_migrations(MIGRATIONS_DIR) if item.version == "0017")
    with _connect(database_url) as connection:
        _seed_projection(connection)
        connection.commit()
        before = _learner_snapshots(connection)
        schema_acl_before = connection.execute(
            "SELECT nspacl::text FROM pg_namespace WHERE nspname = 'public'"
        ).fetchone()
        registry = connection.execute(
            "SELECT name, checksum FROM schema_migrations WHERE version = '0017'"
        ).fetchone()
        assert registry == (migration.name, migration.checksum)

    assert migrate_down(database_url, MIGRATIONS_DIR, steps=4) == [
        "0020",
        "0019",
        "0018",
        "0017",
    ]
    with _connect(database_url) as connection:
        assert connection.execute(
            "SELECT to_regclass('public.v_learner_concept_retrievability')"
        ).fetchone() == (None,)
        assert (
            connection.execute(
                "SELECT nspacl::text FROM pg_namespace WHERE nspname = 'public'"
            ).fetchone()
            == schema_acl_before
        )
        assert _learner_snapshots(connection) == before

    assert migrate_up(database_url, MIGRATIONS_DIR) == ["0017", "0018", "0019", "0020"]
    assert migrate_up(database_url, MIGRATIONS_DIR) == []
    with _connect(database_url) as connection:
        assert _learner_snapshots(connection) == before


def test_projection_reads_do_not_mutate_learner_rows(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    seed = _seed_projection(db_connection)
    before = _learner_snapshots(db_connection)

    for _ in range(3):
        assert _projection_row(db_connection, seed) is not None
        assert (
            fetch_concept_retrievability(
                db_connection,
                actor=seed.actor,
                user_language_id=seed.user_language_id,
                concept_id=seed.concept_id,
            )
            is not None
        )

    assert _learner_snapshots(db_connection) == before
