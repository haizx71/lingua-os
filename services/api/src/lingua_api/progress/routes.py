"""Authenticated FastAPI transport adapter for Progress Overview v1."""

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
from lingua_api.profile.domain import StartingLevelEstimate
from lingua_api.progress.domain import (
    ProgressOverviewProjection,
    ProgressWindow,
)
from lingua_api.progress.models import (
    ProgressDayDto,
    ProgressOverviewDto,
    ProgressOverviewResponseDto,
    ProgressWindowDto,
    RetentionPointDto,
)
from lingua_api.progress.service import ProgressApplication
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
    404: {"model": ErrorEnvelopeDto, "description": "Active language profile was not found."},
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
    window: Annotated[ProgressWindowDto, Query()] = ProgressWindowDto.WEEK,
) -> ProgressOverviewResponseDto:
    application = cast(ProgressApplication, request.app.state.progress_application)
    projection = application.get_overview(
        actor=actor,
        language_profile_id=language_profile_id,
        window=ProgressWindow(window.value),
    )
    return ProgressOverviewResponseDto(
        data=_overview_dto(projection),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _overview_dto(projection: ProgressOverviewProjection) -> ProgressOverviewDto:
    return ProgressOverviewDto(
        language_profile_id=projection.language_profile_id,
        window_start=projection.window_start,
        window_end=projection.window_end,
        starting_level_estimate=_estimate_dto(projection.starting_level_estimate),
        memory_health=projection.memory_health,
        competence=_competence_dto(projection.competence),
        successful_learning_days=projection.successful_learning_days,
        target_learning_days=projection.target_learning_days,
        concepts_exposed=projection.concepts_exposed,
        concepts_strengthened=projection.concepts_strengthened,
        total_minutes=projection.total_minutes,
        daily_activity=[
            ProgressDayDto(
                date=day.date,
                minutes=day.minutes,
                activities_completed=day.activities_completed,
                goal_met=day.goal_met,
                concepts_exposed=day.concepts_exposed,
                concepts_strengthened=day.concepts_strengthened,
            )
            for day in projection.daily_activity
        ],
        retention_trend=[
            RetentionPointDto(
                date=point.date,
                successful_review_ratio=point.successful_review_ratio,
                reviewed_count=point.reviewed_count,
            )
            for point in projection.retention_trend
        ],
        calculated_at=projection.calculated_at,
    )


def _estimate_dto(estimate: StartingLevelEstimate | None) -> StartingLevelEstimateDto | None:
    if estimate is None:
        return None
    return StartingLevelEstimateDto(
        level=ProficiencyLevelDto(
            framework_code=estimate.level.framework_code,
            code=estimate.level.code,
            label=estimate.level.label,
        ),
        confidence=estimate.confidence,
        confidence_band=ConfidenceBandDto(estimate.confidence_band),
        assessed_skills=[CompetenceDimensionDto(skill) for skill in estimate.assessed_skills],
        evidence_count=estimate.evidence_count,
        method_version=estimate.method_version,
        estimated_at=estimate.estimated_at,
    )


def _competence_dto(competence: CompetenceProjection) -> CompetenceSignalsDto:
    return CompetenceSignalsDto(
        recognition=_score_dto(competence.recognition),
        listening=_score_dto(competence.listening),
        production=_score_dto(competence.production),
    )


def _score_dto(score: CompetenceScoreProjection) -> CompetenceScoreDto:
    return CompetenceScoreDto(
        score=score.score,
        confidence=score.confidence,
        evidence_count=score.evidence_count,
        updated_at=score.updated_at,
    )
