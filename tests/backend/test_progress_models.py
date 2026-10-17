"""Unit tests for Progress Overview v1 transport DTOs and route serialization."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from fastapi.testclient import TestClient
from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.profile.domain import ProficiencyLevel, StartingLevelEstimate
from lingua_api.progress.domain import (
    ProgressDayProjection,
    ProgressNotFound,
    ProgressOverviewProjection,
    ProgressWindow,
    RetentionPointProjection,
)

ACTOR_ID = UUID("00000000-0000-4000-8000-000000000001")
PROFILE_ID = UUID("00000000-0000-4000-8000-000000000002")
LEVEL_ID = UUID("00000000-0000-4000-8000-000000000003")


class _StubVerifier:
    def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return AuthenticatedActor(id=ACTOR_ID, email="learner@example.test")


class _StubProgressApplication:
    def __init__(self, *, raise_not_found: bool = False) -> None:
        self.raise_not_found = raise_not_found
        self.calls: list[tuple[UUID, UUID | None, ProgressWindow]] = []

    def get_overview(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None = None,
        window: ProgressWindow = ProgressWindow.WEEK,
    ) -> ProgressOverviewProjection:
        self.calls.append((actor.id, language_profile_id, window))
        if self.raise_not_found:
            raise ProgressNotFound("profile not found")
        now = datetime(2026, 10, 14, 12, 0, tzinfo=UTC)
        score = CompetenceScoreProjection(
            score=0.72,
            confidence=0.68,
            evidence_count=12,
            updated_at=now,
        )
        return ProgressOverviewProjection(
            language_profile_id=language_profile_id or PROFILE_ID,
            window_start=date(2026, 10, 8),
            window_end=date(2026, 10, 14),
            starting_level_estimate=StartingLevelEstimate(
                level=ProficiencyLevel(LEVEL_ID, "CEFR", "A2", "Elementary"),
                confidence=0.78,
                confidence_band="medium",
                assessed_skills=("recognition", "listening"),
                evidence_count=10,
                method_version="starting-level-heuristic-v1",
                estimated_at=now,
            ),
            memory_health=0.87,
            competence=CompetenceProjection(
                recognition=score,
                listening=score,
                production=score,
            ),
            successful_learning_days=5,
            target_learning_days=7,
            concepts_exposed=14,
            concepts_strengthened=26,
            total_minutes=115,
            daily_activity=(
                ProgressDayProjection(
                    date=date(2026, 10, 14),
                    minutes=25,
                    activities_completed=3,
                    goal_met=True,
                    concepts_exposed=4,
                    concepts_strengthened=6,
                ),
            ),
            retention_trend=(
                RetentionPointProjection(
                    date=date(2026, 10, 14),
                    successful_review_ratio=0.87,
                    reviewed_count=15,
                ),
            ),
            calculated_at=now,
        )


def test_get_progress_overview_serializes_contract_valid_envelope() -> None:
    app = create_app(token_verifier=_StubVerifier())
    stub = _StubProgressApplication()
    app.state.progress_application = stub
    client = TestClient(app)

    response = client.get(
        f"/v1/progress/overview?languageProfileId={PROFILE_ID}&window=week",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["apiVersion"] == "1.0"
    data = payload["data"]
    assert data["languageProfileId"] == str(PROFILE_ID)
    assert data["windowStart"] == "2026-10-08"
    assert data["windowEnd"] == "2026-10-14"
    assert data["memoryHealth"] == 0.87
    assert data["successfulLearningDays"] == 5
    assert data["targetLearningDays"] == 7
    assert data["conceptsExposed"] == 14
    assert data["conceptsStrengthened"] == 26
    assert data["totalMinutes"] == 115
    assert len(data["dailyActivity"]) == 1
    assert data["dailyActivity"][0]["goalMet"] is True
    assert len(data["retentionTrend"]) == 1
    assert data["retentionTrend"][0]["successfulReviewRatio"] == 0.87
    assert stub.calls == [(ACTOR_ID, PROFILE_ID, ProgressWindow.WEEK)]


def test_get_progress_overview_returns_404_when_profile_missing() -> None:
    app = create_app(token_verifier=_StubVerifier())
    app.state.progress_application = _StubProgressApplication(raise_not_found=True)
    client = TestClient(app)

    response = client.get(
        "/v1/progress/overview",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
