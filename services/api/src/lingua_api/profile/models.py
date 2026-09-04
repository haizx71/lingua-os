"""Strict Profile transport DTOs matching the frozen TASK-006E schemas."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import Field
from pydantic.json_schema import SkipJsonSchema

from lingua_api.review.models import ApiModel


class LearningGoalDto(StrEnum):
    COMMUNICATION = "communication"
    WORK = "work"
    TRAVEL = "travel"
    BASICS = "basics"
    ACADEMIC = "academic"


class LanguageProfileStatusDto(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class ConfidenceBandDto(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CompetenceDimensionDto(StrEnum):
    RECOGNITION = "recognition"
    LISTENING = "listening"
    PRODUCTION = "production"


class ProficiencyLevelDto(ApiModel):
    framework_code: str = Field(min_length=1, max_length=32)
    code: str = Field(min_length=1, max_length=16)
    label: str = Field(min_length=1, max_length=100)


class StartingLevelEstimateDto(ApiModel):
    level: ProficiencyLevelDto
    confidence: float = Field(ge=0, le=1)
    confidence_band: ConfidenceBandDto
    assessed_skills: list[CompetenceDimensionDto] = Field(min_length=1)
    evidence_count: int = Field(ge=0)
    method_version: str = Field(min_length=1, max_length=64)
    estimated_at: datetime


class LanguageProfileDto(ApiModel):
    id: UUID
    etag: str = Field(min_length=1, json_schema_extra={"readOnly": True})
    target_language_code: str = Field(min_length=2, max_length=35)
    native_language_code: str = Field(min_length=2, max_length=35)
    goal: LearningGoalDto
    daily_minutes: int = Field(ge=5, le=180)
    target_level: ProficiencyLevelDto | None
    starting_level_estimate: StartingLevelEstimateDto | None
    status: LanguageProfileStatusDto
    created_at: datetime
    updated_at: datetime


class MeProfileDto(ApiModel):
    id: UUID
    email: str | None = Field(max_length=320)
    display_name: str | None = Field(min_length=1, max_length=120)
    interface_language_code: str = Field(min_length=2, max_length=35)
    time_zone: str | None = Field(min_length=1, max_length=64)
    language_profiles: list[LanguageProfileDto] = Field(max_length=20)
    created_at: datetime
    updated_at: datetime


class UpdateMeRequestDto(ApiModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    interface_language_code: str | SkipJsonSchema[None] = Field(
        default=None, min_length=2, max_length=35
    )
    time_zone: str | SkipJsonSchema[None] = Field(default=None, min_length=1, max_length=64)


class CreateLanguageProfileRequestDto(ApiModel):
    target_language_code: Literal["en"]
    native_language_code: Literal["vi"]
    goal: LearningGoalDto
    daily_minutes: int = Field(ge=5, le=180)
    self_estimated_level_code: str | SkipJsonSchema[None] = Field(
        default=None, min_length=1, max_length=16
    )
    target_level_code: str | SkipJsonSchema[None] = Field(default=None, min_length=1, max_length=16)


class UpdateLanguageProfileRequestDto(ApiModel):
    goal: LearningGoalDto | SkipJsonSchema[None] = None
    daily_minutes: int | SkipJsonSchema[None] = Field(default=None, ge=5, le=180)
    target_level_code: str | None = Field(default=None, min_length=1, max_length=16)
    status: LanguageProfileStatusDto | SkipJsonSchema[None] = None


class ResponseMetaDto(ApiModel):
    request_id: UUID
    api_version: Literal["1.0"] = "1.0"


class MeResponseDto(ApiModel):
    data: MeProfileDto
    meta: ResponseMetaDto


class LanguageProfilesResponseDto(ApiModel):
    data: list[LanguageProfileDto] = Field(max_length=20)
    meta: ResponseMetaDto


class LanguageProfileResponseDto(ApiModel):
    data: LanguageProfileDto
    meta: ResponseMetaDto
