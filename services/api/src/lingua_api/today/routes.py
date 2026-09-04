"""Authenticated FastAPI adapters for the frozen Today operations."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Header, Path, Query, Request, Security
from pydantic.json_schema import SkipJsonSchema

from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import ErrorEnvelopeDto, ResponseMetaDto
from lingua_api.review.routes import authenticated_actor
from lingua_api.today.domain import TodayActivityProjection, TodayPlanProjection
from lingua_api.today.models import (
    CompleteTodayActivityRequestDto,
    LearningActivityTypeDto,
    TodayActivityDto,
    TodayActivityStatusDto,
    TodayCompletionDto,
    TodayCompletionResponseDto,
    TodayPlanDto,
    TodayPlanResponseDto,
    TodayPlanStatusDto,
    TodayReasonCodeDto,
)
from lingua_api.today.service import TodayApplication

router = APIRouter(prefix="/v1/today", tags=["Today"])

PLAN_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto, "description": "Missing or invalid bearer token."},
    404: {"model": ErrorEnvelopeDto, "description": "Profile or historical plan not found."},
    409: {"model": ErrorEnvelopeDto, "description": "Profile timezone is not ready."},
    422: {"model": ErrorEnvelopeDto, "description": "Request validation failed."},
    500: {"model": ErrorEnvelopeDto, "description": "Unexpected server failure."},
    503: {"model": ErrorEnvelopeDto, "description": "Today plan is temporarily unavailable."},
}
COMPLETE_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto, "description": "Missing or invalid bearer token."},
    403: {"model": ErrorEnvelopeDto, "description": "Authenticated actor is not allowed."},
    404: {"model": ErrorEnvelopeDto, "description": "Owned plan or activity not found."},
    409: {"model": ErrorEnvelopeDto, "description": "Missing proof or idempotency conflict."},
    422: {"model": ErrorEnvelopeDto, "description": "Request validation failed."},
    500: {"model": ErrorEnvelopeDto, "description": "Unexpected server failure."},
}


@router.get(
    "",
    operation_id="getTodayPlan",
    response_model=TodayPlanResponseDto,
    responses=PLAN_RESPONSES,
)
def get_today_plan(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    language_profile_id: Annotated[
        UUID | SkipJsonSchema[None], Query(alias="languageProfileId")
    ] = None,
    requested_date: Annotated[date | SkipJsonSchema[None], Query(alias="date")] = None,
) -> TodayPlanResponseDto:
    application = cast(TodayApplication, request.app.state.today_application)
    plan = application.get_plan(
        actor=actor,
        language_profile_id=language_profile_id,
        requested_date=requested_date,
    )
    return TodayPlanResponseDto(
        data=_plan(plan), meta=ResponseMetaDto(request_id=request.state.request_id)
    )


@router.post(
    "/{planId}/activities/{activityId}/complete",
    operation_id="completeTodayActivity",
    response_model=TodayCompletionResponseDto,
    responses=COMPLETE_RESPONSES,
)
def complete_today_activity(
    request: Request,
    plan_id: Annotated[UUID, Path(alias="planId")],
    activity_id: Annotated[UUID, Path(alias="activityId")],
    body: CompleteTodayActivityRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> TodayCompletionResponseDto:
    application = cast(TodayApplication, request.app.state.today_application)
    result = application.complete_activity(
        actor=actor,
        plan_id=plan_id,
        activity_id=activity_id,
        idempotency_key=idempotency_key,
        duration_seconds=body.duration_seconds,
    )
    return TodayCompletionResponseDto(
        data=TodayCompletionDto(plan=_plan(result.plan), activity=_activity(result.activity)),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _plan(plan: TodayPlanProjection) -> TodayPlanDto:
    return TodayPlanDto(
        id=plan.id,
        language_profile_id=plan.language_profile_id,
        plan_date=plan.plan_date,
        time_zone=plan.time_zone,
        target_minutes=plan.target_minutes,
        completed_minutes=plan.completed_minutes,
        status=TodayPlanStatusDto(plan.status),
        engine_version=plan.engine_version,
        activities=[_activity(item) for item in plan.activities],
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _activity(activity: TodayActivityProjection) -> TodayActivityDto:
    return TodayActivityDto(
        id=activity.id,
        position=activity.position,
        activity_type=LearningActivityTypeDto(activity.activity_type),
        title=activity.title,
        description=activity.description,
        estimated_minutes=activity.estimated_minutes,
        reason_codes=[TodayReasonCodeDto(value) for value in activity.reason_codes],
        reason_text=activity.reason_text,
        status=TodayActivityStatusDto(activity.status),
        target_count=activity.target_count,
        completed_count=activity.completed_count,
        content_id=activity.content_id,
        concept_id=activity.concept_id,
        review_item_id=activity.review_item_id,
        completed_at=activity.completed_at,
        created_at=activity.created_at,
    )
