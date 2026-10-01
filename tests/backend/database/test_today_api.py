from __future__ import annotations

import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from zoneinfo import ZoneInfo

import psycopg
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.content.store import PostgresContentStore
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor, CreatedFrom
from lingua_api.memory.service import PostgresMemoryEngine
from lingua_api.today.domain import TodayContext
from lingua_api.today.policy import (
    TODAY_HEURISTIC_V1,
    TODAY_HEURISTIC_V2,
    build_today_decision,
)
from lingua_api.today.service import TodayApplication
from lingua_api.today.store import PostgresTodayStore

from database.migrate import migrate_down
from tests.acceptance.support import k2_hosted_probe

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"


@dataclass(frozen=True)
class DatabaseClock:
    database_url: str

    def now(self) -> datetime:
        with psycopg.connect(self.database_url) as connection:
            row = connection.execute("SELECT transaction_timestamp()").fetchone()
        assert row is not None and isinstance(row[0], datetime)
        return row[0].astimezone(UTC)


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return self.actor


@dataclass(frozen=True)
class TodayApiSeed:
    actor: AuthenticatedActor
    profile_id: uuid.UUID
    client: TestClient


@pytest.fixture
def today_api(migrated_postgres_url: str) -> Iterator[TodayApiSeed]:
    actor_id = uuid.uuid4()
    clock = DatabaseClock(migrated_postgres_url)
    now = clock.now()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
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
        progress = connection.execute(
            """
            SELECT segment.id
            FROM content_segments AS segment
            WHERE segment.content_id = '40000000-0000-4000-8000-000000000001'
            ORDER BY segment.order_index LIMIT 1
            """
        ).fetchone()
        assert progress is not None
        connection.execute(
            """
            INSERT INTO user_content_progress
                (user_id, user_language_id, content_id, language_code,
                 current_segment_id, furthest_segment_id, started_at, last_opened_at)
            VALUES (%s, %s, '40000000-0000-4000-8000-000000000001', 'en',
                    %s, %s, %s, %s)
            """,
            (actor_id, profile_id, progress[0], progress[0], now, now),
        )
        concept_rows = connection.execute(
            """
            SELECT concept_id FROM content_concepts
            WHERE content_id = '40000000-0000-4000-8000-000000000001'
            ORDER BY concept_id LIMIT 5
            """
        ).fetchall()
        connection.commit()

    actor = AuthenticatedActor(actor_id)
    memory = PostgresMemoryEngine(migrated_postgres_url, clock=clock)
    for row in concept_rows:
        memory.activate(
            actor=actor,
            user_language_id=profile_id,
            concept_id=uuid.UUID(str(row[0])),
            created_from=CreatedFrom.LEARNER_SAVED,
        )
    app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        clock=clock,
        cursor_secret=b"today-api-test-cursor-secret-32bytes",
    )
    yield TodayApiSeed(actor, profile_id, TestClient(app))


def _stored_plan_as_of(database_url: str, plan_id: str) -> datetime:
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            "SELECT as_of FROM today_plans WHERE id = %s", (plan_id,)
        ).fetchone()
    assert row is not None and isinstance(row[0], datetime)
    return row[0].astimezone(UTC)


def _headers(key: uuid.UUID | None = None) -> dict[str, str]:
    result = {"Authorization": "Bearer valid-token"}
    if key is not None:
        result["Idempotency-Key"] = str(key)
    return result


def _get_plan(seed: TodayApiSeed) -> dict[str, Any]:
    response = seed.client.get(
        "/v1/today",
        params={"languageProfileId": str(seed.profile_id)},
        headers=_headers(),
    )
    assert response.status_code == 200, response.text
    return cast(dict[str, Any], response.json()["data"])


def _assert_contract_schema(schema_name: str, payload: object) -> None:
    with open(ROOT / "contracts" / "openapi.yaml", encoding="utf-8") as source:
        contract = yaml.safe_load(source)

    def resolve(value: object) -> object:
        if isinstance(value, list):
            return [resolve(item) for item in value]
        if not isinstance(value, dict):
            return value
        reference = value.get("$ref")
        if isinstance(reference, str):
            target: object = contract
            for part in reference.removeprefix("#/").split("/"):
                target = cast(dict[str, object], target)[part]
            return resolve(deepcopy(target))
        return {key: resolve(item) for key, item in value.items()}

    raw_schema = contract["components"]["schemas"][schema_name]
    schema = cast(dict[str, object], resolve(deepcopy(raw_schema)))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)


def _authority_snapshot(database_url: str, actor_id: uuid.UUID) -> tuple[object, ...]:
    with psycopg.connect(database_url) as connection:
        return (
            connection.execute(
                """
                SELECT jsonb_agg(to_jsonb(state) ORDER BY state.review_item_id)
                FROM fsrs_states AS state WHERE state.user_id = %s
                """,
                (actor_id,),
            ).fetchone(),
            connection.execute(
                """
                SELECT jsonb_agg(to_jsonb(state) ORDER BY state.concept_id)
                FROM user_concept_states AS state WHERE state.user_id = %s
                """,
                (actor_id,),
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM learning_events WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM exposure_events WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM review_events WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM concept_save_intents WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM user_saved_concepts WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM user_saved_content WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                "SELECT count(*) FROM user_saved_sentences WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                """
                SELECT jsonb_agg(to_jsonb(progress) ORDER BY progress.content_id)
                FROM user_content_progress AS progress WHERE progress.user_id = %s
                """,
                (actor_id,),
            ).fetchone(),
            connection.execute(
                """
                SELECT jsonb_agg(to_jsonb(state) ORDER BY state.skill)
                FROM user_skill_states AS state WHERE state.user_id = %s
                """,
                (actor_id,),
            ).fetchone(),
            connection.execute(
                """
                SELECT jsonb_agg(to_jsonb(head) ORDER BY head.user_language_id)
                FROM user_language_projection_heads AS head WHERE head.user_id = %s
                """,
                (actor_id,),
            ).fetchone(),
        )


def test_today_returns_persisted_v1_plan_without_regenerating_it(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    store = PostgresTodayStore(migrated_postgres_url)
    with store.connect() as connection, connection.transaction():
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        as_of = store.transaction_timestamp(connection)
        profile = store.resolve_profile(
            connection, actor=today_api.actor, requested_id=today_api.profile_id
        )
        assert profile.time_zone is not None
        plan_date = as_of.astimezone(ZoneInfo(profile.time_zone)).date()
        reviews = store.list_review_candidates(
            connection,
            actor=today_api.actor,
            profile_id=profile.user_language_id,
            as_of=as_of,
            limit=min(profile.daily_minutes + 1, TODAY_HEURISTIC_V1.review_candidate_limit_max),
        )
        content = store.list_content_candidates(
            connection,
            actor=today_api.actor,
            profile_id=profile.user_language_id,
            as_of=as_of,
            limit=TODAY_HEURISTIC_V1.content_candidate_limit,
            policy=TODAY_HEURISTIC_V1,
        )
        decision = build_today_decision(
            TodayContext(profile.daily_minutes, as_of),
            reviews,
            content,
            policy=TODAY_HEURISTIC_V1,
        )
        store.persist_decision(
            connection,
            actor=today_api.actor,
            profile=profile,
            plan_date=plan_date,
            as_of=as_of,
            decision=decision,
            review_candidate_count=len(reviews),
            content_candidate_count=len(content),
            policy=TODAY_HEURISTIC_V1,
        )

    response = today_api.client.get(
        "/v1/today",
        params={
            "languageProfileId": str(today_api.profile_id),
            "date": plan_date.isoformat(),
        },
        headers=_headers(),
    )
    assert response.status_code == 200, response.text
    returned = cast(dict[str, Any], response.json()["data"])
    assert returned["engineVersion"] == TODAY_HEURISTIC_V1.version
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM today_plans WHERE user_id = %s",
            (today_api.actor.id,),
        ).fetchone() == (1,)
        stored = connection.execute(
            "SELECT engine_version, generation_diagnostics->>'policyVersion' "
            "FROM today_plans WHERE id = %s",
            (returned["id"],),
        ).fetchone()
    assert stored == (TODAY_HEURISTIC_V1.version, TODAY_HEURISTIC_V1.version)


def test_today_get_persists_stable_local_day_plan_and_preserves_review_order(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    before = _authority_snapshot(migrated_postgres_url, today_api.actor.id)
    first = _get_plan(today_api)
    second = _get_plan(today_api)

    assert first == second
    first_as_of = _stored_plan_as_of(migrated_postgres_url, first["id"])
    assert (
        first["planDate"] == first_as_of.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date().isoformat()
    )
    assert first["timeZone"] == "Asia/Ho_Chi_Minh"
    assert first["engineVersion"] == "today-heuristic-v2"
    activities = first["activities"]
    assert [item["activityType"] for item in activities] == ["review", "read"]
    assert activities[0]["targetCount"] == 5
    assert sum(item["estimatedMinutes"] for item in activities) <= 25
    assert all(item["activityType"] != "learn" for item in activities)
    assert all("selectionDiagnostics" not in item for item in activities)
    assert _authority_snapshot(migrated_postgres_url, today_api.actor.id) == before
    _assert_contract_schema(
        "TodayPlanResponse",
        {
            "data": first,
            "meta": {"requestId": str(uuid.uuid4()), "apiVersion": "1.0"},
        },
    )

    with psycopg.connect(migrated_postgres_url) as connection:
        mapped = connection.execute(
            """
            SELECT target.review_item_id
            FROM today_activity_review_items AS target
            JOIN today_plan_activities AS activity ON activity.id = target.activity_id
            WHERE activity.plan_id = %s
            ORDER BY target.position
            """,
            (first["id"],),
        ).fetchall()
        authoritative = connection.execute(
            """
            SELECT item.id FROM review_items AS item
            JOIN fsrs_states AS state ON state.review_item_id = item.id
            WHERE item.user_id = %s AND state.due_at <= %s
            ORDER BY state.due_at, item.id LIMIT 5
            """,
            (today_api.actor.id, first_as_of),
        ).fetchall()
        assert mapped == authoritative
        assert connection.execute(
            """
            SELECT count(*) FROM today_plans
            WHERE user_id = %s AND user_language_id = %s AND plan_date = %s
            """,
            (today_api.actor.id, today_api.profile_id, first["planDate"]),
        ).fetchone() == (1,)


def test_today_remediation_uses_effective_status_and_excludes_due_concepts_beyond_review_limit(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    content_id = uuid.UUID("40000000-0000-4000-8000-000000000001")
    store = PostgresTodayStore(migrated_postgres_url)
    with store.connect() as connection, connection.transaction():
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        as_of = store.transaction_timestamp(connection)
        target = connection.execute(
            """
            SELECT linked.concept_id, item.id, memory.parameter_set_id, memory.params_version
            FROM content_concepts AS linked
            JOIN review_items AS item
              ON item.user_id = %s AND item.user_language_id = %s
             AND item.concept_id = linked.concept_id
            JOIN fsrs_states AS memory
              ON memory.review_item_id = item.id AND memory.user_id = item.user_id
            WHERE linked.content_id = %s
            ORDER BY linked.concept_id
            LIMIT 1
            """,
            (today_api.actor.id, today_api.profile_id, content_id),
        ).fetchone()
        assert target is not None
        target_concept = uuid.UUID(str(target[0]))
        target_review_id = uuid.UUID(str(target[1]))
        parameter_set_id = uuid.UUID(str(target[2]))
        params_version = str(target[3])
        # Memory activation creates review/FSRS lineage only; seed the stored
        # competence projection row this retrievability test exercises.
        projection_state = connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, state_version)
            VALUES (%s, %s, %s, 'active', 1)
            RETURNING id
            """,
            (today_api.actor.id, today_api.profile_id, target_concept),
        ).fetchone()
        assert projection_state is not None
        connection.execute(
            """
            UPDATE fsrs_states
            SET difficulty = 5, stability = 1, step = NULL, state = 'review',
                last_review_at = '2025-01-01T00:00:00Z', due_at = %s
            WHERE review_item_id = %s AND user_id = %s
            """,
            (as_of + timedelta(hours=1), target_review_id, today_api.actor.id),
        )
        other_concepts = connection.execute(
            """
            SELECT concept.id
            FROM concepts AS concept
            WHERE concept.language_code = 'en'
              AND NOT EXISTS (
                  SELECT 1 FROM review_items AS existing
                  WHERE existing.user_id = %s AND existing.concept_id = concept.id
              )
            ORDER BY concept.id
            LIMIT 22
            """,
            (today_api.actor.id,),
        ).fetchall()
        assert len(other_concepts) == 22
        for (concept_id,) in other_concepts:
            row = connection.execute(
                """
                INSERT INTO review_items
                    (user_id, user_language_id, concept_id, language_code, status, created_from)
                VALUES (%s, %s, %s, 'en', 'active', 'placement')
                RETURNING id
                """,
                (today_api.actor.id, today_api.profile_id, concept_id),
            ).fetchone()
            assert row is not None
            connection.execute(
                """
                INSERT INTO fsrs_states
                    (review_item_id, user_id, difficulty, stability, due_at, last_review_at,
                     state, parameter_set_id, params_version)
                VALUES (%s, %s, 5, 1, %s, %s, 'review', %s, %s)
                """,
                (
                    row[0],
                    today_api.actor.id,
                    as_of - timedelta(days=2),
                    as_of - timedelta(days=2),
                    parameter_set_id,
                    params_version,
                ),
            )
        connection.execute(
            """
            UPDATE fsrs_states
            SET due_at = %s, last_review_at = %s, difficulty = 5, stability = 1,
                step = NULL, state = 'review'
            WHERE user_id = %s AND review_item_id <> %s
            """,
            (
                as_of - timedelta(days=2),
                as_of - timedelta(days=2),
                today_api.actor.id,
                target_review_id,
            ),
        )

        projection = connection.execute(
            """
            SELECT stored_status, effective_status, calculated_at
            FROM public.v_learner_concept_retrievability
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
            """,
            (today_api.actor.id, today_api.profile_id, target_concept),
        ).fetchone()
        assert projection == ("active", "forgotten", as_of)

        candidates = store.list_content_candidates(
            connection,
            actor=today_api.actor,
            profile_id=today_api.profile_id,
            as_of=as_of,
            limit=20,
            policy=TODAY_HEURISTIC_V2,
        )
        content_candidate = next(item for item in candidates if item.content_id == content_id)
        assert content_candidate.remediation_status == "forgotten"
        assert target_concept in content_candidate.reinforcement_concept_ids

        connection.execute(
            "UPDATE fsrs_states SET due_at = %s WHERE review_item_id = %s AND user_id = %s",
            (as_of - timedelta(hours=1), target_review_id, today_api.actor.id),
        )
        selected_reviews = store.list_review_candidates(
            connection,
            actor=today_api.actor,
            profile_id=today_api.profile_id,
            as_of=as_of,
            limit=26,
        )
        assert len(selected_reviews) == 26
        assert target_review_id not in {item.review_item_id for item in selected_reviews}
        due_candidate = store.list_content_candidates(
            connection,
            actor=today_api.actor,
            profile_id=today_api.profile_id,
            as_of=as_of,
            limit=20,
            policy=TODAY_HEURISTIC_V2,
        )
        due_content = next(item for item in due_candidate if item.content_id == content_id)
        assert due_content.remediation_status is None
        assert target_concept not in due_content.reinforcement_concept_ids


def test_today_completion_requires_reader_proof_and_exactly_replays(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    plan = _get_plan(today_api)
    activity = next(item for item in plan["activities"] if item["activityType"] == "read")
    key = uuid.uuid4()
    endpoint = f"/v1/today/{plan['id']}/activities/{activity['id']}/complete"

    missing = today_api.client.post(endpoint, json={"durationSeconds": 120}, headers=_headers(key))
    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "INVALID_STATE_TRANSITION"

    with psycopg.connect(migrated_postgres_url) as connection:
        segment = connection.execute(
            """
            SELECT id FROM content_segments WHERE content_id = %s
            ORDER BY order_index LIMIT 1
            """,
            (activity["contentId"],),
        ).fetchone()
        assert segment is not None
    exposure = today_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(today_api.profile_id),
            "contentId": activity["contentId"],
            "segmentId": str(segment[0]),
            "exposureType": "read",
        },
        headers=_headers(uuid.uuid4()),
    )
    assert exposure.status_code == 200, exposure.text
    with psycopg.connect(migrated_postgres_url) as connection:
        learning_count = connection.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s",
            (today_api.actor.id,),
        ).fetchone()

    accepted = today_api.client.post(endpoint, json={"durationSeconds": 120}, headers=_headers(key))
    replay = today_api.client.post(endpoint, json={"durationSeconds": 120}, headers=_headers(key))
    conflict = today_api.client.post(endpoint, json={"durationSeconds": 121}, headers=_headers(key))

    assert accepted.status_code == replay.status_code == 200
    assert accepted.json()["data"] == replay.json()["data"]
    assert accepted.json()["data"]["activity"]["status"] == "completed"
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    _assert_contract_schema("TodayCompletionResponse", accepted.json())
    with psycopg.connect(migrated_postgres_url) as connection:
        assert (
            connection.execute(
                "SELECT count(*) FROM learning_events WHERE user_id = %s",
                (today_api.actor.id,),
            ).fetchone()
            == learning_count
        )


def test_review_activity_completion_requires_every_snapshotted_review_event(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    plan = _get_plan(today_api)
    review = next(item for item in plan["activities"] if item["activityType"] == "review")
    with psycopg.connect(migrated_postgres_url) as connection:
        targets = connection.execute(
            """
            SELECT review_item_id FROM today_activity_review_items
            WHERE activity_id = %s ORDER BY position
            """,
            (review["id"],),
        ).fetchall()

    for row in targets[:-1]:
        response = today_api.client.post(
            f"/v1/review/{row[0]}/answer",
            json={"rating": "good", "responseTimeMs": 800},
            headers=_headers(uuid.uuid4()),
        )
        assert response.status_code == 200, response.text
    partial = _get_plan(today_api)
    partial_review = next(
        item for item in partial["activities"] if item["activityType"] == "review"
    )
    assert partial_review["completedCount"] == len(targets) - 1
    endpoint = f"/v1/today/{plan['id']}/activities/{review['id']}/complete"
    assert (
        today_api.client.post(endpoint, json={}, headers=_headers(uuid.uuid4())).status_code == 409
    )

    final_target = targets[-1][0]
    answered = today_api.client.post(
        f"/v1/review/{final_target}/answer",
        json={"rating": "good", "responseTimeMs": 800},
        headers=_headers(uuid.uuid4()),
    )
    assert answered.status_code == 200
    with psycopg.connect(migrated_postgres_url) as connection:
        event_count = connection.execute(
            "SELECT count(*) FROM review_events WHERE user_id = %s",
            (today_api.actor.id,),
        ).fetchone()

    completed = today_api.client.post(endpoint, json={}, headers=_headers(uuid.uuid4()))
    assert completed.status_code == 200, completed.text
    assert completed.json()["data"]["activity"]["completedCount"] == len(targets)
    with psycopg.connect(migrated_postgres_url) as connection:
        assert (
            connection.execute(
                "SELECT count(*) FROM review_events WHERE user_id = %s",
                (today_api.actor.id,),
            ).fetchone()
            == event_count
        )


def test_today_generation_is_postgresql_concurrency_safe(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    application = TodayApplication(
        migrated_postgres_url, clock=DatabaseClock(migrated_postgres_url)
    )

    def invoke() -> uuid.UUID:
        return application.get_plan(
            actor=today_api.actor,
            language_profile_id=today_api.profile_id,
            requested_date=None,
        ).id

    with ThreadPoolExecutor(max_workers=2) as pool:
        plan_ids = list(pool.map(lambda _: invoke(), range(2)))

    assert len(set(plan_ids)) == 1
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM today_plans WHERE user_id = %s",
            (today_api.actor.id,),
        ).fetchone() == (1,)


def test_today_rejects_cross_owner_profile_and_does_not_generate_other_dates(
    today_api: TodayApiSeed,
) -> None:
    hidden = today_api.client.get(
        "/v1/today",
        params={"languageProfileId": str(uuid.uuid4())},
        headers=_headers(),
    )
    future = today_api.client.get(
        "/v1/today",
        params={"languageProfileId": str(today_api.profile_id), "date": "2026-09-02"},
        headers=_headers(),
    )

    assert hidden.status_code == future.status_code == 404


def test_timezone_change_expires_old_local_day_without_server_timezone(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    first = _get_plan(today_api)
    first_as_of = _stored_plan_as_of(migrated_postgres_url, first["id"])
    changed_zone_candidates = ("Etc/GMT+12", "Etc/GMT-14")
    safe_alternatives: list[tuple[float, str]] = []
    for zone_name in changed_zone_candidates:
        local_as_of = first_as_of.astimezone(ZoneInfo(zone_name))
        if local_as_of.date().isoformat() == first["planDate"]:
            continue
        next_local_midnight = (local_as_of + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        seconds_until_local_day_changes = (next_local_midnight - local_as_of).total_seconds()
        safe_alternatives.append((seconds_until_local_day_changes, zone_name))
    assert safe_alternatives
    changed_time_zone = max(safe_alternatives)[1]
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE learner_profiles SET time_zone = %s WHERE user_id = %s",
            (changed_time_zone, today_api.actor.id),
        )
        connection.commit()

    second = _get_plan(today_api)

    second_as_of = _stored_plan_as_of(migrated_postgres_url, second["id"])
    assert (
        first["planDate"] == first_as_of.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date().isoformat()
    )
    assert (
        second["planDate"]
        == second_as_of.astimezone(ZoneInfo(changed_time_zone)).date().isoformat()
    )
    assert second["planDate"] != first["planDate"]
    assert second["timeZone"] == changed_time_zone
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT status FROM today_plans WHERE id = %s", (first["id"],)
        ).fetchone() == ("expired",)
        connection.execute(
            "UPDATE learner_profiles SET time_zone = 'Asia/Ho_Chi_Minh' WHERE user_id = %s",
            (today_api.actor.id,),
        )
        connection.commit()

    returned = _get_plan(today_api)
    assert returned["id"] == first["id"]
    assert returned["status"] == "active"
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT status FROM today_plans WHERE id = %s", (second["id"],)
        ).fetchone() == ("expired",)


def test_unpublished_persisted_content_fails_closed(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    plan = _get_plan(today_api)
    content_id = next(
        item["contentId"]
        for item in plan["activities"]
        if item["activityType"] in {"read", "listen"}
    )
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE content_items SET publication_status = 'retired' WHERE id = %s",
            (content_id,),
        )
        connection.commit()
    try:
        response = today_api.client.get(
            "/v1/today",
            params={"languageProfileId": str(today_api.profile_id)},
            headers=_headers(),
        )
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
        assert content_id not in response.text
    finally:
        with psycopg.connect(migrated_postgres_url) as connection:
            connection.execute(
                "UPDATE content_items SET publication_status = 'published' WHERE id = %s",
                (content_id,),
            )
            connection.commit()


def test_invalid_profile_timezone_fails_closed_without_using_server_local_time(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE learner_profiles SET time_zone = 'Not/A_Zone' WHERE user_id = %s",
            (today_api.actor.id,),
        )
        connection.commit()

    response = today_api.client.get(
        "/v1/today",
        params={"languageProfileId": str(today_api.profile_id)},
        headers=_headers(),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_today_runtime_operations_match_frozen_openapi(today_api: TodayApiSeed) -> None:
    generated = cast(FastAPI, today_api.client.app).openapi()
    assert generated["paths"]["/v1/today"]["get"]["operationId"] == "getTodayPlan"
    completion_path = "/v1/today/{planId}/activities/{activityId}/complete"
    assert generated["paths"][completion_path]["post"]["operationId"] == "completeTodayActivity"
    assert set(generated["paths"]["/v1/today"]["get"]["responses"]) == {
        "200",
        "401",
        "404",
        "409",
        "422",
        "500",
        "503",
    }


def test_0006_rollback_refuses_generated_today_plans(
    isolated_migrated_postgres_url: str,
) -> None:
    actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        connection.execute(
            """
            INSERT INTO user_languages
                (id, user_id, language_code, interface_language_code,
                 native_language_code, goal, daily_minutes)
            VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 20)
            """,
            (profile_id, actor_id),
        )
        connection.execute(
            """
            INSERT INTO today_plans
                (user_id, user_language_id, language_code, plan_date, time_zone,
                 daily_minutes, new_concept_budget, engine_version, status,
                 as_of, unused_minutes, generation_diagnostics)
            VALUES (%s, %s, 'en', current_date, 'Etc/UTC', 20, 0,
                    'today-heuristic-v1', 'active', now(), 20, '{}'::jsonb)
            """,
            (actor_id, profile_id),
        )

    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=11
    ) == [
        "0020",
        "0019",
        "0018",
        "0017",
        "0016",
        "0015",
        "0014",
        "0013",
        "0012",
        "0011",
        "0010",
    ]
    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0009"]
    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0008"]
    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0007"]
    with pytest.raises(psycopg.errors.RaiseException, match="Refusing lossy TASK-010 rollback"):
        migrate_down(isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1)


def test_k208_candidate_base_probe_matches_production_store_and_today_order(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    """The acceptance reader base probe matches real ContentStore and TodayStore ordering."""
    content_store = PostgresContentStore(migrated_postgres_url)
    today_store = PostgresTodayStore(migrated_postgres_url)
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        # Rebuild the three published test articles as a bounded, 5-minute N/W/F set.
        # The transaction rolls back at context exit, so this remains disposable test data.
        candidate_ids = [
            uuid.UUID("40000000-0000-4000-8000-000000000001"),
            uuid.UUID("40000000-0000-4000-8000-000000000002"),
            uuid.UUID("40000000-0000-4000-8000-000000000003"),
        ]
        connection.execute(
            """UPDATE content_items
               SET publication_status = 'reviewed', published_at = NULL
               WHERE id = ANY(%s)""",
            (candidate_ids,),
        )
        assignments = [(candidate_ids[index], index + 1) for index in range(3)]
        for content_id, concept_number in assignments:
            token = f"word{concept_number:02d}"
            body = " ".join([token] * 241)
            connection.execute(
                """UPDATE sentences AS sentence
                   SET text = %s, normalized_text = %s
                   FROM content_segments AS segment
                   WHERE segment.content_id = %s AND segment.sentence_id = sentence.id""",
                (body, body, content_id),
            )
            connection.execute(
                """UPDATE content_segments AS segment
                   SET text = sentence.text
                   FROM sentences AS sentence
                   WHERE segment.content_id = %s AND segment.sentence_id = sentence.id""",
                (content_id,),
            )
            connection.execute(
                """DELETE FROM sentence_concepts AS occurrence
                   USING content_segments AS segment
                   WHERE segment.content_id = %s
                     AND occurrence.sentence_id = segment.sentence_id""",
                (content_id,),
            )
            connection.execute(
                """INSERT INTO sentence_concepts
                       (sentence_id, concept_id, language_code, start_offset, end_offset,
                        occurrence_role)
                   SELECT segment.sentence_id,
                          ('30000000-0000-4000-8000-' || lpad(%s::text, 12, '0'))::uuid,
                          'en', 0, 6, 'target'
                   FROM content_segments AS segment
                   WHERE segment.content_id = %s""",
                (concept_number, content_id),
            )
        connection.execute(
            "DELETE FROM content_concepts WHERE content_id = ANY(%s)", (candidate_ids,)
        )
        connection.execute(
            """INSERT INTO content_concepts
                   (content_id, concept_id, language_code, occurrence_count)
               SELECT segment.content_id, occurrence.concept_id, 'en', count(*)::integer
               FROM content_segments AS segment
               JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = segment.sentence_id
               WHERE segment.content_id = ANY(%s)
               GROUP BY segment.content_id, occurrence.concept_id""",
            (candidate_ids,),
        )
        connection.execute(
            """UPDATE content_metrics
               SET token_count = 723, sentence_count = 3, calculated_at = transaction_timestamp()
               WHERE content_id = ANY(%s)""",
            (candidate_ids,),
        )
        connection.execute(
            """UPDATE content_items
               SET publication_status = 'published', published_at = transaction_timestamp()
               WHERE id = ANY(%s)""",
            (candidate_ids,),
        )

        actor_ids = [uuid.uuid4() for _ in range(4)]
        profile_ids: list[uuid.UUID] = []
        for actor_id in actor_ids:
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
            connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
            connection.execute(
                "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Asia/Ho_Chi_Minh')",
                (actor_id,),
            )
            profile_id = connection.execute(
                """INSERT INTO user_languages
                       (user_id, language_code, interface_language_code, native_language_code,
                        goal, daily_minutes)
                   VALUES (%s, 'en', 'vi', 'vi', 'communication', 15) RETURNING id""",
                (actor_id,),
            ).fetchone()[0]
            profile_ids.append(uuid.UUID(str(profile_id)))

        baseline_orders: list[list[str]] = []
        for actor_id, profile_id in zip(actor_ids, profile_ids, strict=True):
            baseline_summaries = content_store.list_summaries(
                actor=AuthenticatedActor(actor_id),
                language_profile_id=profile_id,
                boundary=None,
                limit=20,
                today_as_of=None,
                connection=connection,
            )
            assert len(baseline_summaries) == 3
            baseline_orders.append([str(row.id) for row in baseline_summaries])

        due_concept_rows = connection.execute(
            """SELECT concept.id
               FROM concepts AS concept
               WHERE concept.language_code = 'en'
                 AND NOT EXISTS (
                     SELECT 1
                     FROM public.content_concepts AS linked
                     JOIN public.content_items AS item ON item.id = linked.content_id
                     WHERE linked.concept_id = concept.id
                       AND item.language_code = 'en'
                       AND item.publication_status = 'published'
                       AND public.reader_content_passes_publication_gate(item.id)
                 )
               ORDER BY concept.id
               LIMIT 20"""
        ).fetchall()
        assert len(due_concept_rows) == 20
        due_concepts = [uuid.UUID(str(row[0])) for row in due_concept_rows]
        assert len(set(due_concepts)) == 20
        as_of = today_store.transaction_timestamp(connection)
        fsrs_parameters = connection.execute(
            """SELECT parameter_set_id, params_version
               FROM fsrs_states
               WHERE user_id = %s
               ORDER BY review_item_id
               LIMIT 1""",
            (today_api.actor.id,),
        ).fetchone()
        assert fsrs_parameters is not None
        due_review_ids: dict[int, list[uuid.UUID]] = {}
        for actor_index in (0, 1):
            actor_due_ids: list[uuid.UUID] = []
            for due_index, concept_id in enumerate(due_concepts):
                review_row = connection.execute(
                    """INSERT INTO review_items
                           (user_id, user_language_id, concept_id, language_code, status,
                            created_from)
                       VALUES (%s, %s, %s, 'en', 'active', 'placement')
                       RETURNING id""",
                    (actor_ids[actor_index], profile_ids[actor_index], concept_id),
                ).fetchone()
                assert review_row is not None
                review_id = uuid.UUID(str(review_row[0]))
                actor_due_ids.append(review_id)
                connection.execute(
                    """INSERT INTO fsrs_states
                           (review_item_id, user_id, difficulty, stability, due_at, last_review_at,
                            state, parameter_set_id, params_version)
                       VALUES (%s, %s, 5, 1, %s, %s, 'review', %s, %s)""",
                    (
                        review_id,
                        actor_ids[actor_index],
                        as_of - timedelta(days=1) + timedelta(seconds=due_index),
                        as_of - timedelta(days=2),
                        fsrs_parameters[0],
                        fsrs_parameters[1],
                    ),
                )
            due_review_ids[actor_index] = actor_due_ids

        weak_concept = uuid.UUID("30000000-0000-4000-8000-000000000002")
        forgotten_concept = uuid.UUID("30000000-0000-4000-8000-000000000003")
        for actor_index, states in enumerate(
            (
                (),
                ((weak_concept, "weak"), (forgotten_concept, "forgotten")),
                ((weak_concept, "weak"),),
                (),
            )
        ):
            for concept_id, status in states:
                connection.execute(
                    """INSERT INTO user_concept_states
                           (user_id, user_language_id, concept_id, status, state_version)
                       VALUES (%s, %s, %s, %s, 1)""",
                    (actor_ids[actor_index], profile_ids[actor_index], concept_id, status),
                )

        actual_orders: list[list[str]] = []
        for actor_index, (actor_id, profile_id) in enumerate(
            zip(actor_ids, profile_ids, strict=True)
        ):
            actor = AuthenticatedActor(actor_id)
            summaries = content_store.list_summaries(
                actor=actor,
                language_profile_id=profile_id,
                boundary=None,
                limit=20,
                today_as_of=None,
                connection=connection,
            )
            proof = k2_hosted_probe._k208_candidate_base(connection, actor_id, profile_id)
            as_of = today_store.transaction_timestamp(connection)
            candidates = today_store.list_content_candidates(
                connection,
                actor=actor,
                profile_id=profile_id,
                as_of=as_of,
                limit=20,
                policy=TODAY_HEURISTIC_V2,
            )
            assert len(proof["candidates"]) == len(summaries) == len(candidates) == 3
            assert [row["contentId"] for row in proof["candidates"]] == [
                str(row.id) for row in summaries
            ]
            assert [str(row.id) for row in summaries] == baseline_orders[actor_index]
            assert [row["estimatedMinutes"] for row in proof["candidates"]] == [
                row.estimated_minutes for row in summaries
            ]
            assert all(len(row["linkedConceptIds"]) == 1 for row in proof["candidates"])
            assert all(row["estimatedMinutes"] == 5 for row in proof["candidates"])
            assert not any(
                row["isSaved"] or row["isUnfinished"] or row["isCompleted"]
                for row in proof["candidates"]
            )
            expected_state = (
                {str(weak_concept): "weak", str(forgotten_concept): "forgotten"}
                if actor_id == actor_ids[1]
                else {str(weak_concept): "weak"}
                if actor_id == actor_ids[2]
                else {}
            )
            assert {
                row["conceptId"]: row["status"] for row in proof["stateStatuses"]
            } == expected_state
            assert set(proof["stateConceptIds"]) == set(expected_state)
            expected_unseen_by_content = {
                str(candidate_ids[0]): 1,
                str(candidate_ids[1]): 0 if actor_id in (actor_ids[1], actor_ids[2]) else 1,
                str(candidate_ids[2]): 0 if actor_id == actor_ids[1] else 1,
            }
            assert {
                row["contentId"]: row["unseenCount"] for row in proof["candidates"]
            } == expected_unseen_by_content
            assert all(value <= 4 for value in expected_unseen_by_content.values())
            baseline = [row["contentId"] for row in proof["candidates"]]
            actual = [str(item.content_id) for item in candidates]
            assert baseline == baseline_orders[actor_index]
            assert set(baseline) == set(actual) == {str(item) for item in candidate_ids}
            reviews = today_store.list_review_candidates(
                connection,
                actor=actor,
                profile_id=profile_id,
                as_of=as_of,
                limit=20,
            )
            expected_reviews = due_review_ids.get(actor_index, [])
            assert len(reviews) == len(expected_reviews) == (20 if actor_index < 2 else 0)
            assert [item.review_item_id for item in reviews] == expected_reviews
            assert not set(due_concepts).intersection(
                concept_id for row in proof["candidates"] for concept_id in row["linkedConceptIds"]
            )
            decision = build_today_decision(
                TodayContext(15, as_of), reviews, candidates, policy=TODAY_HEURISTIC_V2
            )
            if actor_index == 0:
                assert len(decision.activities) == 1
                activity = decision.activities[0]
                assert (
                    activity.activity_type,
                    activity.target_count,
                    activity.estimated_minutes,
                ) == ("review", 15, 15)
                assert activity.review_item_ids == tuple(expected_reviews[:15])
                assert decision.unused_minutes == 0
            elif actor_index == 1:
                assert len(decision.activities) == 2
                review_activity, content_activity = decision.activities
                assert (
                    review_activity.activity_type,
                    review_activity.target_count,
                    review_activity.estimated_minutes,
                ) == ("review", 10, 10)
                assert review_activity.review_item_ids == tuple(expected_reviews[:10])
                assert (
                    content_activity.activity_type,
                    content_activity.content_id,
                    content_activity.estimated_minutes,
                ) == ("read", candidate_ids[2], 5)
                assert content_activity.reason_codes == (
                    "FORGOTTEN_REMEDIATION",
                    "CONTENT_FIT",
                    "WEAK_RECOGNITION",
                )
                assert decision.unused_minutes == 0
            else:
                assert not decision.activities or decision.activities[0].activity_type != "review"
                content_activity = decision.activities[0]
                expected_content = candidate_ids[1] if actor_index == 2 else candidate_ids[0]
                assert (
                    content_activity.activity_type,
                    content_activity.content_id,
                    content_activity.estimated_minutes,
                ) == ("read", expected_content, 5)
                assert content_activity.reason_codes == (
                    ("WEAK_REMEDIATION", "CONTENT_FIT", "NEW_CONCEPT_BUDGET")
                    if actor_index == 2
                    else ("CONTENT_FIT", "NEW_CONCEPT_BUDGET")
                )
                assert decision.unused_minutes == 10
            statuses = {str(item.content_id): item.remediation_status for item in candidates}
            if actor_id == actor_ids[1]:
                assert statuses == {
                    str(candidate_ids[0]): None,
                    str(candidate_ids[1]): "weak",
                    str(candidate_ids[2]): "forgotten",
                }
            elif actor_id == actor_ids[2]:
                assert statuses == {
                    str(candidate_ids[0]): None,
                    str(candidate_ids[1]): "weak",
                    str(candidate_ids[2]): None,
                }
            else:
                assert all(value is None for value in statuses.values())
            for row in proof["candidates"]:
                actual_candidate = next(
                    item for item in candidates if str(item.content_id) == row["contentId"]
                )
                assert row["unseenCount"] == actual_candidate.unseen_concept_count
            actual_orders.append(actual)

        assert len(set(tuple(order) for order in baseline_orders)) == 1
        expected_v2 = [
            [str(candidate_ids[0]), str(candidate_ids[1]), str(candidate_ids[2])],
            [str(candidate_ids[2]), str(candidate_ids[1]), str(candidate_ids[0])],
            [str(candidate_ids[1]), str(candidate_ids[0]), str(candidate_ids[2])],
            [str(candidate_ids[0]), str(candidate_ids[1]), str(candidate_ids[2])],
        ]
        assert baseline_orders == expected_v2[:1] * 4
        assert actual_orders == expected_v2
        connection.rollback()
