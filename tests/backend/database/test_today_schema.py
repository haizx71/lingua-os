from __future__ import annotations

import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg import Connection

from database.migrate import migrate_down, migrate_up

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
MIGRATIONS = ROOT / "database" / "migrations"


def test_today_migration_adds_stable_plan_and_completion_authorities(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    columns = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'today_plan_activities'
            """
        ).fetchall()
    }
    tables = {
        str(row[0])
        for row in db_connection.execute(
            """
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
            """
        ).fetchall()
    }

    assert {
        "target_count",
        "completed_count",
        "title_snapshot",
        "description_snapshot",
        "reason_text_snapshot",
        "selection_diagnostics",
        "completion_request_fingerprint",
        "completion_result_snapshot",
        "duration_seconds",
    } <= columns
    assert "today_activity_review_items" in tables


def test_today_plan_is_unique_for_every_lifecycle_state_and_review_targets_are_ordered(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, review_item_id, concept_id = _seed_owner_and_review(db_connection)
    plan_id = _insert_plan(db_connection, actor_id, profile_id)
    activity_id = _insert_review_activity(
        db_connection, plan_id, actor_id, review_item_id, concept_id
    )
    db_connection.execute(
        """
        INSERT INTO today_activity_review_items
            (activity_id, user_id, language_code, review_item_id, position)
        VALUES (%s, %s, 'en', %s, 0)
        """,
        (activity_id, actor_id, review_item_id),
    )

    assert db_connection.execute(
        """
        SELECT review_item_id, position FROM today_activity_review_items
        WHERE activity_id = %s ORDER BY position
        """,
        (activity_id,),
    ).fetchall() == [(review_item_id, 0)]

    with pytest.raises(psycopg.errors.UniqueViolation), db_connection.transaction():
        _insert_plan(db_connection, actor_id, profile_id, status="expired")


def test_today_activity_rejects_invalid_target_shape_and_fake_completion_snapshot(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, review_item_id, concept_id = _seed_owner_and_review(db_connection)
    plan_id = _insert_plan(db_connection, actor_id, profile_id)

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        _insert_review_activity(
            db_connection,
            plan_id,
            actor_id,
            review_item_id,
            concept_id,
            target_count=0,
        )

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            """
            INSERT INTO today_plan_activities
                (plan_id, user_id, language_code, activity_type, position,
                 estimated_minutes, reason_codes, content_id, target_count,
                 title_snapshot, description_snapshot, reason_text_snapshot,
                 selection_diagnostics, status, idempotency_key)
            VALUES (%s, %s, 'en', 'read', 1, 5, ARRAY['CONTENT_FIT'],
                    '40000000-0000-4000-8000-000000000001', 1,
                    'Read', 'Read content', 'Fit', '{}'::jsonb, 'pending', %s)
            """,
            (plan_id, actor_id, str(uuid.uuid4())),
        )


def test_today_reason_code_check_accepts_remediation_and_rejects_unknown_values(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, review_item_id, concept_id = _seed_owner_and_review(db_connection)
    plan_id = _insert_plan(db_connection, actor_id, profile_id)
    activity_id = _insert_review_activity(
        db_connection, plan_id, actor_id, review_item_id, concept_id
    )
    allowed = ["FORGOTTEN_REMEDIATION", "CONTENT_FIT"]
    db_connection.execute(
        "UPDATE today_plan_activities SET reason_codes = %s WHERE id = %s",
        (allowed, activity_id),
    )
    assert db_connection.execute(
        "SELECT reason_codes FROM today_plan_activities WHERE id = %s", (activity_id,)
    ).fetchone() == (allowed,)

    with pytest.raises(psycopg.errors.CheckViolation), db_connection.transaction():
        db_connection.execute(
            "UPDATE today_plan_activities SET reason_codes = ARRAY['FUTURE_REASON'] WHERE id = %s",
            (activity_id,),
        )
    assert db_connection.execute(
        "SELECT reason_codes FROM today_plan_activities WHERE id = %s", (activity_id,)
    ).fetchone() == (allowed,)


def test_0020_reason_code_migration_rolls_back_and_reapplies_safely(
    isolated_migrated_postgres_url: str,
) -> None:
    assert migrate_down(isolated_migrated_postgres_url, MIGRATIONS, steps=1) == ["0020"]
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        actor_id, profile_id, review_item_id, concept_id = _seed_owner_and_review(connection)
        plan_id = _insert_plan(connection, actor_id, profile_id)
        activity_id = _insert_review_activity(
            connection, plan_id, actor_id, review_item_id, concept_id
        )
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute(
                "UPDATE today_plan_activities SET reason_codes = %s WHERE id = %s",
                (["WEAK_REMEDIATION", "CONTENT_FIT"], activity_id),
            )

    assert migrate_up(isolated_migrated_postgres_url, MIGRATIONS) == ["0020"]


def test_0020_rollback_refuses_persisted_remediation_reasons_before_changing_constraint(
    isolated_migrated_postgres_url: str,
) -> None:
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        actor_id, profile_id, review_item_id, concept_id = _seed_owner_and_review(connection)
        plan_id = _insert_plan(connection, actor_id, profile_id)
        activity_id = _insert_review_activity(
            connection, plan_id, actor_id, review_item_id, concept_id
        )
        connection.execute(
            "UPDATE today_plan_activities SET reason_codes = %s WHERE id = %s",
            (["WEAK_REMEDIATION", "CONTENT_FIT"], activity_id),
        )

    with pytest.raises(psycopg.errors.RaiseException, match="Refusing 0020 rollback"):
        migrate_down(isolated_migrated_postgres_url, MIGRATIONS, steps=1)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        constraint = connection.execute(
            """
            SELECT pg_get_constraintdef(constraint_row.oid)
            FROM pg_constraint AS constraint_row
            WHERE constraint_row.conrelid = 'today_plan_activities'::regclass
              AND constraint_row.conname = 'today_plan_activities_reason_codes_check'
            """
        ).fetchone()
        persisted = connection.execute(
            "SELECT reason_codes FROM today_plan_activities WHERE id = %s", (activity_id,)
        ).fetchone()
    assert constraint is not None and "WEAK_REMEDIATION" in str(constraint[0])
    assert persisted == (["WEAK_REMEDIATION", "CONTENT_FIT"],)


def test_today_review_mapping_rejects_another_owner(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    actor_id, profile_id, review_item_id, concept_id = _seed_owner_and_review(db_connection)
    other_id, _, other_review_id, _ = _seed_owner_and_review(db_connection)
    plan_id = _insert_plan(db_connection, actor_id, profile_id)
    activity_id = _insert_review_activity(
        db_connection, plan_id, actor_id, review_item_id, concept_id
    )

    with pytest.raises(psycopg.errors.ForeignKeyViolation), db_connection.transaction():
        db_connection.execute(
            """
            INSERT INTO today_activity_review_items
                (activity_id, user_id, language_code, review_item_id, position)
            VALUES (%s, %s, 'en', %s, 0)
            """,
            (activity_id, actor_id, other_review_id),
        )
    assert other_id != actor_id


def _seed_owner_and_review(
    connection: Connection[tuple[object, ...]],
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]:
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
             goal, daily_minutes)
        VALUES (%s, 'en', 'vi', 'vi', 'communication', 25) RETURNING id
        """,
        (actor_id,),
    ).fetchone()
    assert profile_row is not None
    profile_id = uuid.UUID(str(profile_row[0]))
    concept_id = uuid.UUID("30000000-0000-4000-8000-000000000001")
    review_row = connection.execute(
        """
        INSERT INTO review_items
            (user_id, user_language_id, concept_id, language_code, status, created_from)
        VALUES (%s, %s, %s, 'en', 'active', 'learner_saved') RETURNING id
        """,
        (actor_id, profile_id, concept_id),
    ).fetchone()
    assert review_row is not None
    return actor_id, profile_id, uuid.UUID(str(review_row[0])), concept_id


def _insert_plan(
    connection: Connection[tuple[object, ...]],
    actor_id: uuid.UUID,
    profile_id: uuid.UUID,
    *,
    status: str = "active",
) -> uuid.UUID:
    row = connection.execute(
        """
        INSERT INTO today_plans
            (user_id, user_language_id, language_code, plan_date, time_zone,
             daily_minutes, new_concept_budget, engine_version, status, as_of,
             unused_minutes, generation_diagnostics)
        VALUES (%s, %s, 'en', DATE '2026-09-01', 'Asia/Ho_Chi_Minh',
                25, 4, 'today-heuristic-v1', %s, '2026-09-01T01:00:00Z', 24, '{}'::jsonb)
        RETURNING id
        """,
        (actor_id, profile_id, status),
    ).fetchone()
    assert row is not None
    return uuid.UUID(str(row[0]))


def _insert_review_activity(
    connection: Connection[tuple[object, ...]],
    plan_id: uuid.UUID,
    actor_id: uuid.UUID,
    review_item_id: uuid.UUID,
    concept_id: uuid.UUID,
    *,
    target_count: int = 1,
) -> uuid.UUID:
    row = connection.execute(
        """
        INSERT INTO today_plan_activities
            (plan_id, user_id, language_code, activity_type, position,
             estimated_minutes, reason_codes, concept_id, review_item_id, target_count,
             title_snapshot, description_snapshot, reason_text_snapshot,
             selection_diagnostics)
        VALUES (%s, %s, 'en', 'review', 0, 1, ARRAY['FSRS_DUE'], %s, %s, %s,
                'Review', 'Review due items', 'Due', '{}'::jsonb)
        RETURNING id
        """,
        (plan_id, actor_id, concept_id, review_item_id, target_count),
    ).fetchone()
    assert row is not None
    return uuid.UUID(str(row[0]))
