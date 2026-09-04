"""Strict DTOs for the frozen TASK-004 Today contract."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import Field
from pydantic.json_schema import SkipJsonSchema

from lingua_api.review.models import ApiModel, ResponseMetaDto


class LearningActivityTypeDto(StrEnum):
    REVIEW = "review"
    READ = "read"
    LISTEN = "listen"
    LEARN = "learn"


class TodayPlanStatusDto(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"


class TodayActivityStatusDto(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class TodayReasonCodeDto(StrEnum):
    FSRS_DUE = "FSRS_DUE"
    WEAK_RECOGNITION = "WEAK_RECOGNITION"
    WEAK_LISTENING = "WEAK_LISTENING"
    LOW_PRODUCTION_EVIDENCE = "LOW_PRODUCTION_EVIDENCE"
    CONTENT_FIT = "CONTENT_FIT"
    RECENT_EXPOSURE = "RECENT_EXPOSURE"
    NEW_CONCEPT_BUDGET = "NEW_CONCEPT_BUDGET"


class TodayActivityDto(ApiModel):
    id: UUID
    position: int = Field(ge=0)
    activity_type: LearningActivityTypeDto
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=500)
    estimated_minutes: int = Field(ge=0, le=240)
    reason_codes: list[TodayReasonCodeDto] = Field(min_length=1, max_length=10)
    reason_text: str = Field(min_length=1, max_length=300)
    status: TodayActivityStatusDto
    target_count: int | SkipJsonSchema[None] = Field(
        default=None, ge=0, exclude_if=lambda value: value is None
    )
    completed_count: int = Field(ge=0)
    content_id: UUID | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    concept_id: UUID | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    review_item_id: UUID | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    completed_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    created_at: datetime


class TodayPlanDto(ApiModel):
    id: UUID
    language_profile_id: UUID
    plan_date: date
    time_zone: str = Field(min_length=1, max_length=64)
    target_minutes: int = Field(ge=5, le=180)
    completed_minutes: int = Field(ge=0, le=1440)
    status: TodayPlanStatusDto
    engine_version: str = Field(min_length=1, max_length=64)
    activities: list[TodayActivityDto] = Field(max_length=20)
    created_at: datetime
    updated_at: datetime


class CompleteTodayActivityRequestDto(ApiModel):
    duration_seconds: int | SkipJsonSchema[None] = Field(
        default=None, ge=0, le=86400, exclude_if=lambda value: value is None
    )


class TodayCompletionDto(ApiModel):
    plan: TodayPlanDto
    activity: TodayActivityDto


class TodayPlanResponseDto(ApiModel):
    data: TodayPlanDto
    meta: ResponseMetaDto


class TodayCompletionResponseDto(ApiModel):
    data: TodayCompletionDto
    meta: ResponseMetaDto
