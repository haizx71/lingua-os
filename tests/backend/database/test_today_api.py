from __future__ import annotations

import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final, cast

import psycopg
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor, CreatedFrom
from lingua_api.memory.service import PostgresMemoryEngine
from lingua_api.today.service import TodayApplication

from database.migrate import migrate_down

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
NOW: Final = datetime(2026, 9, 1, 1, 0, tzinfo=UTC)


@dataclass(frozen=True)
class FixedClock:
    def now(self) -> datetime:
        return NOW


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
            (actor_id, profile_id, progress[0], progress[0], NOW, NOW),
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
    memory = PostgresMemoryEngine(migrated_postgres_url, clock=FixedClock())
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
        clock=FixedClock(),
        cursor_secret=b"today-api-test-cursor-secret-32bytes",
    )
    yield TodayApiSeed(actor, profile_id, TestClient(app))


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
                "SELECT count(*) FROM user_saved_content WHERE user_id = %s", (actor_id,)
            ).fetchone(),
            connection.execute(
                """
                SELECT jsonb_agg(to_jsonb(progress) ORDER BY progress.content_id)
                FROM user_content_progress AS progress WHERE progress.user_id = %s
                """,
                (actor_id,),
            ).fetchone(),
        )


def test_today_get_persists_stable_local_day_plan_and_preserves_review_order(
    today_api: TodayApiSeed, migrated_postgres_url: str
) -> None:
    before = _authority_snapshot(migrated_postgres_url, today_api.actor.id)
    first = _get_plan(today_api)
    second = _get_plan(today_api)

    assert first == second
    assert first["planDate"] == "2026-09-01"
    assert first["timeZone"] == "Asia/Ho_Chi_Minh"
    assert first["engineVersion"] == "today-heuristic-v1"
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
            (today_api.actor.id, NOW),
        ).fetchall()
        assert mapped == authoritative
        assert connection.execute(
            """
            SELECT count(*) FROM today_plans
            WHERE user_id = %s AND user_language_id = %s AND plan_date = '2026-09-01'
            """,
            (today_api.actor.id, today_api.profile_id),
        ).fetchone() == (1,)


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
    application = TodayApplication(migrated_postgres_url, clock=FixedClock())

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
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE learner_profiles SET time_zone = 'America/Los_Angeles' WHERE user_id = %s",
            (today_api.actor.id,),
        )
        connection.commit()

    second = _get_plan(today_api)

    assert first["planDate"] == "2026-09-01"
    assert second["planDate"] == "2026-08-31"
    assert second["timeZone"] == "America/Los_Angeles"
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
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=5
    ) == ["0014", "0013", "0012", "0011", "0010"]
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
