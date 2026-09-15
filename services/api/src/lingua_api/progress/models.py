"""Strict transport DTOs for the frozen Progress v1 contract."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from lingua_api.brain.models import StartingLevelEstimateDto
from lingua_api.review.models import ApiModel, CompetenceSignalsDto, ResponseMetaDto


class ProgressDayDto(ApiModel):
    date: date
    minutes: int = Field(ge=0, le=1440)
    activities_completed: int = Field(ge=0)
    goal_met: bool
    concepts_exposed: int = Field(ge=0)
    concepts_strengthened: int = Field(ge=0)


class RetentionPointDto(ApiModel):
    date: date
    successful_review_ratio: float = Field(ge=0, le=1)
    reviewed_count: int = Field(ge=0)


class ProgressOverviewDto(ApiModel):
    language_profile_id: UUID
    window_start: date
    window_end: date
    starting_level_estimate: StartingLevelEstimateDto | None
    memory_health: float = Field(ge=0, le=1)
    competence: CompetenceSignalsDto
    successful_learning_days: int = Field(ge=0, le=31)
    target_learning_days: int = Field(ge=0, le=31)
    concepts_exposed: int = Field(ge=0)
    concepts_strengthened: int = Field(ge=0)
    total_minutes: int = Field(ge=0)
    daily_activity: list[ProgressDayDto] = Field(max_length=31)
    retention_trend: list[RetentionPointDto] = Field(max_length=31)
    calculated_at: datetime


class ProgressOverviewResponseDto(ApiModel):
    data: ProgressOverviewDto
    meta: ResponseMetaDto
