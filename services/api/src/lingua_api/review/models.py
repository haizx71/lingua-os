"""Strict public DTOs matching the authoritative TASK-004 Review schemas."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.json_schema import SkipJsonSchema


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ReviewRatingDto(StrEnum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


class ReviewExerciseModeDto(StrEnum):
    SELF_RECALL = "self_recall"
    MULTIPLE_CHOICE = "multiple_choice"
    TYPING = "typing"
    CLOZE = "cloze"
    LISTENING = "listening"


class MemoryStateDto(StrEnum):
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"


class ConceptStatusDto(StrEnum):
    UNSEEN = "unseen"
    DISCOVERED = "discovered"
    LEARNING = "learning"
    FAMILIAR = "familiar"
    ACTIVE = "active"
    MASTERED = "mastered"
    WEAK = "weak"
    FORGOTTEN = "forgotten"


class ErrorCodeDto(StrEnum):
    UNAUTHENTICATED = "UNAUTHENTICATED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    PRECONDITION_FAILED = "PRECONDITION_FAILED"
    CONFLICT = "CONFLICT"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class CompetenceScoreDto(ApiModel):
    score: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    evidence_count: int = Field(ge=0)
    updated_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class CompetenceSignalsDto(ApiModel):
    recognition: CompetenceScoreDto
    listening: CompetenceScoreDto
    production: CompetenceScoreDto


class MemorySnapshotDto(ApiModel):
    state: MemoryStateDto
    due_at: datetime
    last_reviewed_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    is_due: bool


class ProficiencyLevelDto(ApiModel):
    framework_code: str
    code: str
    label: str


class ConceptSummaryDto(ApiModel):
    id: UUID
    canonical_form: str = Field(min_length=1, max_length=300)
    part_of_speech: str | None = Field(
        default=None, min_length=1, max_length=64, exclude_if=lambda value: value is None
    )
    ipa: str | SkipJsonSchema[None] = Field(
        default=None, max_length=200, exclude_if=lambda value: value is None
    )
    audio_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    level: ProficiencyLevelDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    status: ConceptStatusDto
    is_due: bool


class ReviewPromptOptionDto(ApiModel):
    id: UUID
    text: str = Field(min_length=1, max_length=500)


class ReviewPromptDto(ApiModel):
    prompt_text: str = Field(min_length=1, max_length=2000)
    context_sentence: str | SkipJsonSchema[None] = Field(
        default=None, max_length=3000, exclude_if=lambda value: value is None
    )
    translation: str | SkipJsonSchema[None] = Field(
        default=None, max_length=3000, exclude_if=lambda value: value is None
    )
    audio_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    options: list[ReviewPromptOptionDto] | SkipJsonSchema[None] = Field(
        default=None,
        min_length=2,
        max_length=10,
        exclude_if=lambda value: value is None,
    )


class ReviewQueueItemDto(ApiModel):
    review_item_id: UUID
    concept: ConceptSummaryDto
    exercise_mode: ReviewExerciseModeDto
    prompt: ReviewPromptDto
    memory: MemorySnapshotDto
    competence: CompetenceSignalsDto


class ReviewAnswerRequestDto(ApiModel):
    rating: ReviewRatingDto
    exercise_mode: ReviewExerciseModeDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    correct: bool | SkipJsonSchema[None] = Field(
        default=None,
        description=(
            "Caller-reported correctness is accepted only for self_recall (including the "
            "legacy request that omits exerciseMode). The server does not grade other modes."
        ),
        exclude_if=lambda value: value is None,
    )
    response_text: str | SkipJsonSchema[None] = Field(
        default=None, max_length=5000, exclude_if=lambda value: value is None
    )
    selected_option_id: UUID | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    response_time_ms: int = Field(ge=0, le=3_600_000)

    @model_validator(mode="after")
    def reject_ungraded_correctness(self) -> ReviewAnswerRequestDto:
        if (
            self.correct is not None
            and self.exercise_mode is not None
            and self.exercise_mode is not ReviewExerciseModeDto.SELF_RECALL
        ):
            raise ValueError(
                "correct is accepted only for self_recall; other exercise modes are not graded"
            )
        return self


class ReviewAnswerResultDto(ApiModel):
    review_item_id: UUID
    memory: MemorySnapshotDto
    competence: CompetenceSignalsDto
    remaining_due_count: int = Field(ge=0)
    feedback: str | SkipJsonSchema[None] = Field(
        default=None, max_length=500, exclude_if=lambda value: value is None
    )


class ResponseMetaDto(ApiModel):
    request_id: UUID
    api_version: Literal["1.0"] = "1.0"


class CursorResponseMetaDto(ResponseMetaDto):
    next_cursor: str | None = Field(max_length=512)
    has_more: bool
    page_size: int = Field(ge=0, le=100)


class ReviewQueueResponseDto(ApiModel):
    data: list[ReviewQueueItemDto] = Field(max_length=100)
    meta: CursorResponseMetaDto


class ReviewAnswerResponseDto(ApiModel):
    data: ReviewAnswerResultDto
    meta: ResponseMetaDto


class ErrorDetailDto(ApiModel):
    field: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=300)


class ErrorBodyDto(ApiModel):
    code: ErrorCodeDto
    message: str = Field(min_length=1, max_length=500)
    request_id: UUID
    details: list[ErrorDetailDto] | SkipJsonSchema[None] = Field(
        default=None, max_length=100, exclude_if=lambda value: value is None
    )
    retry_after_seconds: int | SkipJsonSchema[None] = Field(
        default=None, ge=1, exclude_if=lambda value: value is None
    )


class ErrorEnvelopeDto(ApiModel):
    error: ErrorBodyDto
