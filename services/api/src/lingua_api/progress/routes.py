"""Authenticated FastAPI transport adapter for Progress v1."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Query, Request, Security
from pydantic.json_schema import SkipJsonSchema

from lingua_api.brain.models import (
    CompetenceDimensionDto,
    ConfidenceBandDto,
    StartingLevelEstimateDto,
)
from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.progress.domain import ProgressOverviewProjection, StartingLevelProjection
from lingua_api.progress.models import (
    ProgressDayDto,
    ProgressOverviewDto,
    ProgressOverviewResponseDto,
    RetentionPointDto,
)
from lingua_api.progress.service import ProgressApplication, ProgressWindow
from lingua_api.review.models import (
    CompetenceScoreDto,
    CompetenceSignalsDto,
    ErrorEnvelopeDto,
    ProficiencyLevelDto,
    ResponseMetaDto,
)
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/progress", tags=["Progress"])

RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto, "description": "Missing or invalid bearer token."},
    404: {"model": ErrorEnvelopeDto, "description": "Progress context not found."},
    422: {"model": ErrorEnvelopeDto, "description": "Request validation failed."},
    500: {"model": ErrorEnvelopeDto, "description": "Unexpected server failure."},
}


@router.get(
    "/overview",
    operation_id="getProgressOverview",
    response_model=ProgressOverviewResponseDto,
    responses=RESPONSES,
)
def get_progress_overview(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    language_profile_id: Annotated[
        UUID | SkipJsonSchema[None], Query(alias="languageProfileId")
    ] = None,
    window: Annotated[ProgressWindow, Query()] = "week",
) -> ProgressOverviewResponseDto:
    application = cast(ProgressApplication, request.app.state.progress_application)
    overview = application.get_overview(
        actor=actor,
        language_profile_id=language_profile_id,
        window=window,
    )
    return ProgressOverviewResponseDto(
        data=_overview(overview),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _overview(value: ProgressOverviewProjection) -> ProgressOverviewDto:
    return ProgressOverviewDto(
        language_profile_id=value.language_profile_id,
        window_start=value.window_start,
        window_end=value.window_end,
        starting_level_estimate=_starting_level(value.starting_level_estimate),
        memory_health=value.memory_health,
        competence=_competence(value.competence),
        successful_learning_days=value.successful_learning_days,
        target_learning_days=value.target_learning_days,
        concepts_exposed=value.concepts_exposed,
        concepts_strengthened=value.concepts_strengthened,
        total_minutes=value.total_minutes,
        daily_activity=[
            ProgressDayDto(
                date=day.date,
                minutes=day.minutes,
                activities_completed=day.activities_completed,
                goal_met=day.goal_met,
                concepts_exposed=day.concepts_exposed,
                concepts_strengthened=day.concepts_strengthened,
            )
            for day in value.daily_activity
        ],
        retention_trend=[
            RetentionPointDto(
                date=point.date,
                successful_review_ratio=point.successful_review_ratio,
                reviewed_count=point.reviewed_count,
            )
            for point in value.retention_trend
        ],
        calculated_at=value.calculated_at,
    )


def _starting_level(value: StartingLevelProjection | None) -> StartingLevelEstimateDto | None:
    if value is None:
        return None
    return StartingLevelEstimateDto(
        level=ProficiencyLevelDto(
            framework_code=value.level.framework_code,
            code=value.level.code,
            label=value.level.label,
        ),
        confidence=value.confidence,
        confidence_band=ConfidenceBandDto(value.confidence_band),
        assessed_skills=[CompetenceDimensionDto(skill) for skill in value.assessed_skills],
        evidence_count=value.evidence_count,
        method_version=value.method_version,
        estimated_at=value.estimated_at,
    )


def _competence(value: CompetenceProjection) -> CompetenceSignalsDto:
    return CompetenceSignalsDto(
        recognition=_score(value.recognition),
        listening=_score(value.listening),
        production=_score(value.production),
    )


def _score(value: CompetenceScoreProjection) -> CompetenceScoreDto:
    return CompetenceScoreDto(
        score=value.score,
        confidence=value.confidence,
        evidence_count=value.evidence_count,
        updated_at=value.updated_at,
    )
