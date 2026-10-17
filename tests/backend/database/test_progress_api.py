"""Integration tests for Progress Overview v1 against real PostgreSQL."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.progress.models import ProgressOverviewResponseDto

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
COMPETENCE_PARAMETER_SET_ID = uuid.UUID("00000000-0000-4000-8600-000000000002")
FSRS_PARAMETER_SET_ID = uuid.UUID("00000000-0000-4000-8600-000000000001")


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return self.actor


@dataclass(frozen=True)
class ProgressTestSeed:
    actor: AuthenticatedActor
    profile_id: uuid.UUID
    other_actor: AuthenticatedActor
    other_profile_id: uuid.UUID
    client: TestClient
    database_url: str


@pytest.fixture
def progress_api_seed(migrated_postgres_url: str) -> ProgressTestSeed:
    actor_id = uuid.uuid4()
    other_actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    other_profile_id = uuid.uuid4()
    now = datetime.now(UTC)

    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))

        # Primary user
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Asia/Ho_Chi_Minh')",
            (actor_id,),
        )
        connection.execute(
            """
            INSERT INTO user_languages (
                id, user_id, language_code, interface_language_code, native_language_code,
                goal, daily_minutes, status, created_at
            ) VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 25, 'active', %s)
            """,
            (profile_id, actor_id, now),
        )

        # Other user (for cross-tenant anti-IDOR testing)
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (other_actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (other_actor_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Asia/Ho_Chi_Minh')",
            (other_actor_id,),
        )
        connection.execute(
            """
            INSERT INTO user_languages (
                id, user_id, language_code, interface_language_code, native_language_code,
                goal, daily_minutes, status, created_at
            ) VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 20, 'active', %s)
            """,
            (other_profile_id, other_actor_id, now),
        )

        # Concepts from seed
        concept_row = connection.execute("SELECT id FROM concepts ORDER BY id LIMIT 1").fetchone()
        assert concept_row is not None
        concept_id = concept_row[0]

        # Review item & memory state for retrievability
        review_item_id = uuid.uuid4()
        connection.execute(
            """
            INSERT INTO review_items (
                id, user_id, user_language_id, concept_id, language_code, status, created_from
            ) VALUES (%s, %s, %s, %s, 'en', 'active', 'learner_saved')
            """,
            (review_item_id, actor_id, profile_id, concept_id),
        )
        connection.execute(
            """
            INSERT INTO user_concept_states (
                user_id, user_language_id, concept_id, status, recognition, listening,
                production, confidence, exposure_count, state_version
            ) VALUES (%s, %s, %s, 'active', 0.8, 0.6, 0.4, 0.7, 5, 1)
            """,
            (actor_id, profile_id, concept_id),
        )
        connection.execute(
            """
            INSERT INTO fsrs_states (
                review_item_id, user_id, state, stability, difficulty, due_at,
                last_review_at, parameter_set_id, params_version
            ) VALUES (
                %s, %s, 'review', 10.0, 5.0, %s, %s, %s, 'fsrs6-global-default-v1'
            )
            """,
            (review_item_id, actor_id, now + timedelta(days=2), now, FSRS_PARAMETER_SET_ID),
        )

        # Skill states for competence
        for skill, score, confidence, count in (
            ("recognition", 0.80, 0.75, 10),
            ("listening", 0.60, 0.65, 8),
            ("production", 0.40, 0.55, 6),
        ):
            connection.execute(
                """
                INSERT INTO user_skill_states (
                    user_id, user_language_id, skill, score, confidence, evidence_count,
                    assessed_at, method_version, positive_mass, negative_mass, state_version,
                    competence_parameter_set_id, competence_parameter_version
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, 'test-v1', 1, 0, 1, %s, 'competence-beta-v1'
                )
                """,
                (
                    actor_id,
                    profile_id,
                    skill,
                    score,
                    confidence,
                    count,
                    now,
                    COMPETENCE_PARAMETER_SET_ID,
                ),
            )

        # Plan & activities for today in local learner timezone
        local_today = now.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
        plan_id = uuid.uuid4()
        connection.execute(
            """
            INSERT INTO today_plans (
                id, user_id, user_language_id, language_code, plan_date, time_zone,
                daily_minutes, new_concept_budget, engine_version, status,
                as_of, unused_minutes, generation_diagnostics
            ) VALUES (
                %s, %s, %s, 'en', %s, 'Asia/Ho_Chi_Minh',
                25, 0, 'today-heuristic-v1', 'active',
                %s, 0, '{}'::jsonb
            )
            """,
            (plan_id, actor_id, profile_id, local_today, now),
        )
        activity_id = uuid.uuid4()
        connection.execute(
            """
            INSERT INTO today_plan_activities (
                id, plan_id, user_id, language_code, activity_type, position,
                estimated_minutes, reason_codes, target_count, title_snapshot,
                description_snapshot, reason_text_snapshot, selection_diagnostics,
                status, completed_at, idempotency_key, review_item_id,
                completion_request_fingerprint, completion_result_snapshot
            ) VALUES (
                %s, %s, %s, 'en', 'review', 1,
                25, ARRAY['CONTENT_FIT'], 1, 'Daily Review',
                'Review items', 'Fit', '{}'::jsonb,
                'completed', %s, %s, %s,
                %s, '{}'::jsonb
            )
            """,
            (activity_id, plan_id, actor_id, now, str(uuid.uuid4()), review_item_id, "e" * 64),
        )
        connection.execute(
            """
            INSERT INTO today_activity_review_items (
                activity_id, user_id, language_code, review_item_id, position
            ) VALUES (%s, %s, 'en', %s, 1)
            """,
            (activity_id, actor_id, review_item_id),
        )

        # Exposure event
        connection.execute(
            """
            INSERT INTO exposure_events (
                id, user_id, user_language_id, language_code, exposure_type,
                concept_id, occurred_at
            ) VALUES (%s, %s, %s, 'en', 'read', %s, %s)
            """,
            (uuid.uuid4(), actor_id, profile_id, concept_id, now),
        )

        # Review event (successful)
        memory_snapshot = json.dumps(
            {
                "reviewItemId": str(review_item_id),
                "difficulty": 2.0,
                "stability": 1.0,
                "dueAt": (now + timedelta(days=1)).isoformat(),
                "lastReviewAt": now.isoformat(),
                "state": "review",
                "step": 0,
                "parameterSetId": str(FSRS_PARAMETER_SET_ID),
                "paramsVersion": "fsrs6-global-default-v1",
                "stateVersion": 2,
            }
        )
        connection.execute(
            """
            INSERT INTO review_events (
                id, review_item_id, user_id, exercise_mode, evidence_mode, rating,
                correct, idempotency_key, request_fingerprint,
                parameter_set_id, params_version, reviewed_at, result_memory_snapshot
            ) VALUES (
                %s, %s, %s, 'self_recall', 'recognition', 'good',
                true, %s, %s,
                %s, 'fsrs6-global-default-v1', %s, %s::jsonb
            )
            """,
            (
                uuid.uuid4(),
                review_item_id,
                actor_id,
                str(uuid.uuid4()),
                "d" * 64,
                FSRS_PARAMETER_SET_ID,
                now,
                memory_snapshot,
            ),
        )

        connection.commit()

    actor = AuthenticatedActor(actor_id, "learner@example.test")
    other_actor = AuthenticatedActor(other_actor_id, "other@example.test")
    app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        cursor_secret=b"progress-api-test-cursor-secret-32b",
    )
    return ProgressTestSeed(
        actor=actor,
        profile_id=profile_id,
        other_actor=other_actor,
        other_profile_id=other_profile_id,
        client=TestClient(app),
        database_url=migrated_postgres_url,
    )


def test_unauthenticated_progress_overview_returns_401(
    progress_api_seed: ProgressTestSeed,
) -> None:
    response = progress_api_seed.client.get("/v1/progress/overview")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_authenticated_learner_receives_accurate_progress_overview_week_and_month(
    progress_api_seed: ProgressTestSeed,
) -> None:
    client = progress_api_seed.client
    headers = {"Authorization": "Bearer valid-token"}

    # Week window test
    week_resp = client.get(
        f"/v1/progress/overview?languageProfileId={progress_api_seed.profile_id}&window=week",
        headers=headers,
    )
    assert week_resp.status_code == 200, week_resp.text
    week_dto = ProgressOverviewResponseDto.model_validate(week_resp.json())
    data = week_dto.data

    assert data.language_profile_id == progress_api_seed.profile_id
    assert data.target_learning_days == 7
    assert len(data.daily_activity) == 7
    assert len(data.retention_trend) == 7
    assert data.successful_learning_days == 1
    assert data.total_minutes == 25
    assert data.concepts_exposed == 1
    assert data.concepts_strengthened == 1
    assert data.memory_health > 0.0

    assert data.competence.recognition.score == 0.8
    assert data.competence.listening.score == 0.6
    assert data.competence.production.score == 0.4

    today_activity = data.daily_activity[-1]
    assert today_activity.minutes == 25
    assert today_activity.activities_completed == 1
    assert today_activity.goal_met is True
    assert today_activity.concepts_exposed == 1
    assert today_activity.concepts_strengthened == 1

    today_retention = data.retention_trend[-1]
    assert today_retention.reviewed_count == 1
    assert today_retention.successful_review_ratio == 1.0

    # Month window test
    month_resp = client.get(
        f"/v1/progress/overview?languageProfileId={progress_api_seed.profile_id}&window=month",
        headers=headers,
    )
    assert month_resp.status_code == 200, month_resp.text
    month_dto = ProgressOverviewResponseDto.model_validate(month_resp.json())
    month_data = month_dto.data

    assert month_data.target_learning_days == 30
    assert len(month_data.daily_activity) == 30
    assert len(month_data.retention_trend) == 30
    assert month_data.successful_learning_days == 1
    assert month_data.total_minutes == 25


def test_cross_tenant_language_profile_id_returns_404(
    progress_api_seed: ProgressTestSeed,
) -> None:
    client = progress_api_seed.client
    headers = {"Authorization": "Bearer valid-token"}

    # Actor attempts to read other user's language profile id
    response = client.get(
        f"/v1/progress/overview?languageProfileId={progress_api_seed.other_profile_id}",
        headers=headers,
    )
    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "NOT_FOUND"


def test_malformed_time_zone_gracefully_falls_back_to_utc(
    progress_api_seed: ProgressTestSeed,
) -> None:
    client = progress_api_seed.client
    headers = {"Authorization": "Bearer valid-token"}

    # Corrupt learner time_zone to an invalid timezone string
    with psycopg.connect(progress_api_seed.database_url) as connection:
        connection.execute(
            "UPDATE learner_profiles SET time_zone = 'Invalid/Zone_Name' WHERE user_id = %s",
            (progress_api_seed.actor.id,),
        )
        connection.commit()

    # Must gracefully fall back to UTC instead of throwing psycopg InvalidParameterValue
    response = client.get(
        f"/v1/progress/overview?languageProfileId={progress_api_seed.profile_id}&window=week",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    dto = ProgressOverviewResponseDto.model_validate(response.json())
    assert len(dto.data.daily_activity) == 7
