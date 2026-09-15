from __future__ import annotations

import uuid
from dataclasses import dataclass

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.auth import AccessTokenInvalid
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "valid-token":
            raise AccessTokenInvalid("invalid bearer token")
        return self.actor


@pytest.fixture()
def progress_client(migrated_postgres_url: str) -> tuple[TestClient, uuid.UUID]:
    actor_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            """
            INSERT INTO learner_profiles (user_id, time_zone)
            VALUES (%s, 'Asia/Ho_Chi_Minh')
            """,
            (actor_id,),
        )
        profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert profile is not None
        profile_id = uuid.UUID(str(profile[0]))
        connection.commit()

    app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(AuthenticatedActor(actor_id)),
        cursor_secret=b"progress-test-cursor-secret-000001",
    )
    return TestClient(app), profile_id


def test_progress_empty_projection_is_real_zero_evidence(
    progress_client: tuple[TestClient, uuid.UUID],
) -> None:
    client, profile_id = progress_client

    response = client.get(
        "/v1/progress/overview?window=week",
        headers={"Authorization": "Bearer valid-token"},
    )

    assert response.status_code == 200
    payload = response.json()
    data = payload["data"]
    assert data["languageProfileId"] == str(profile_id)
    assert data["startingLevelEstimate"] is None
    assert data["memoryHealth"] == 0
    assert data["successfulLearningDays"] == 0
    assert data["targetLearningDays"] == 1
    assert data["conceptsExposed"] == 0
    assert data["conceptsStrengthened"] == 0
    assert data["totalMinutes"] == 0
    assert len(data["dailyActivity"]) == 7
    assert len(data["retentionTrend"]) == 7
    assert all(day["minutes"] == 0 for day in data["dailyActivity"])
    assert all(day["activitiesCompleted"] == 0 for day in data["dailyActivity"])
    assert all(day["goalMet"] is False for day in data["dailyActivity"])
    assert all(point["reviewedCount"] == 0 for point in data["retentionTrend"])
    assert payload["meta"]["requestId"]
    assert response.headers["x-request-id"] == payload["meta"]["requestId"]


def test_progress_requires_authentication(
    progress_client: tuple[TestClient, uuid.UUID],
) -> None:
    client, _ = progress_client

    response = client.get("/v1/progress/overview")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_readiness_checks_real_database_and_core_auth_config(
    progress_client: tuple[TestClient, uuid.UUID],
) -> None:
    client, _ = progress_client

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "service": "lingua-api",
        "status": "ready",
        "version": "0.1.0",
    }
    assert response.headers["x-request-id"]
