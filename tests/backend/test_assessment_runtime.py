"""Transport-boundary tests for TASK-016 without requiring PostgreSQL."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from lingua_api.assessment.router import router
from lingua_api.assessment.store import (
    AssessmentItemPublic,
    AssessmentProgressData,
    AssessmentSessionData,
    _session_from_snapshot,
    _session_to_snapshot,
)
from lingua_api.main import create_app


def _session() -> AssessmentSessionData:
    now = datetime.now(UTC)
    return AssessmentSessionData(
        id=uuid4(),
        language_profile_id=uuid4(),
        status="in_progress",
        method_version="starting-level-heuristic-v1",
        progress=AssessmentProgressData(answered_count=0),
        current_item=AssessmentItemPublic(
            id=uuid4(),
            domain="listening_comprehension",
            skill="listening",
            prompt="Choose the sentence you hear.",
            text_snippet=None,
            audio_url="/assets/audio/test",
            options=[{"id": str(uuid4()), "text": "Option"}],
            allow_skip=True,
        ),
        result=None,
        started_at=now,
        updated_at=now,
        completed_at=None,
    )


def test_public_snapshot_round_trip_excludes_private_scoring_fields() -> None:
    snapshot = _session_to_snapshot(_session())
    assert "correct_option_id" not in str(snapshot)
    assert "difficulty_prior" not in str(snapshot)
    restored = _session_from_snapshot(snapshot)
    assert restored.current_item is not None
    assert restored.current_item.audio_url == "/assets/audio/test"


def test_assessment_router_publishes_contract_paths_and_idempotency_headers() -> None:
    app = create_app()
    spec = app.openapi()
    assert "/v1/assessments" in spec["paths"]
    assert "/v1/assessments/{assessmentId}" in spec["paths"]
    operation = spec["paths"]["/v1/assessments/{assessmentId}/responses"]["post"]
    assert operation["operationId"] == "submitStartingLevelResponse"
    assert any(
        parameter["name"] == "Idempotency-Key" and parameter["in"] == "header"
        for parameter in operation["parameters"]
    )


def test_assessment_router_has_exactly_three_public_operations() -> None:
    assert {getattr(route, "operation_id", None) for route in router.routes} == {
        "startStartingLevelAssessment",
        "getStartingLevelAssessment",
        "submitStartingLevelResponse",
    }
