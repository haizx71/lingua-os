"""Strict TASK-008 public DTOs derived from the frozen OpenAPI contract."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
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


class ConceptStatusDto(StrEnum):
    UNSEEN = "unseen"
    DISCOVERED = "discovered"
    LEARNING = "learning"
    FAMILIAR = "familiar"
    ACTIVE = "active"
    MASTERED = "mastered"
    WEAK = "weak"
    FORGOTTEN = "forgotten"


class ReaderContentLevelDto(StrEnum):
    A0 = "A0"
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"


class ContentSegmentTypeDto(StrEnum):
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    DIALOGUE_TURN = "dialogue_turn"
    CAPTION = "caption"


class ContentTypeDto(StrEnum):
    STORY = "story"
    ARTICLE = "article"
    DIALOGUE = "dialogue"
    LESSON = "lesson"
    TRANSCRIPT = "transcript"


class ResponseMetaDto(ApiModel):
    request_id: UUID
    api_version: Literal["1.0"] = "1.0"


class CursorResponseMetaDto(ResponseMetaDto):
    next_cursor: str | None = Field(max_length=512)
    has_more: bool
    page_size: int = Field(ge=0, le=100)


class AttributionDto(ApiModel):
    source_name: str = Field(min_length=1, max_length=200)
    license_code: str = Field(min_length=1, max_length=64)
    attribution_text: str = Field(min_length=1, max_length=1000)
    source_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ReadingProgressDto(ApiModel):
    content_id: UUID
    current_segment_id: UUID
    furthest_segment_id: UUID
    progress_percent: int = Field(ge=0, le=100)
    is_completed: bool
    started_at: datetime
    last_opened_at: datetime
    completed_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ContentSummaryDto(ApiModel):
    id: UUID
    content_type: ContentTypeDto
    title: str = Field(min_length=1, max_length=500)
    subtitle: Annotated[str, Field(max_length=500)] | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    excerpt: Annotated[str, Field(max_length=1000)] | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    target_language_code: str
    difficulty_score: float = Field(ge=0, le=1)
    difficulty_label: ReaderContentLevelDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    known_concept_ratio: float = Field(ge=0, le=1)
    estimated_minutes: int = Field(ge=0, le=1440)
    cover_image_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    fit_reason: Annotated[str, Field(max_length=300)] | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    is_saved: bool
    reading_progress: ReadingProgressDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    attribution: AttributionDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class SentenceConceptAnnotationDto(ApiModel):
    concept_id: UUID
    canonical_form: str = Field(min_length=1, max_length=300)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=1)
    status: ConceptStatusDto


class ReaderSentenceDto(ApiModel):
    id: UUID
    text: str = Field(min_length=1, max_length=5000)
    translation: (
        Annotated[str, StringConstraints(strip_whitespace=False), Field(max_length=5000)]
        | SkipJsonSchema[None]
    ) = Field(default=None, exclude_if=lambda value: value is None)
    audio_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    order: int = Field(ge=0)
    concepts: list[SentenceConceptAnnotationDto]


class ContentSegmentDto(ApiModel):
    id: UUID
    order: int = Field(ge=0)
    segment_type: ContentSegmentTypeDto
    speaker: Annotated[str, Field(max_length=120)] | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    text: str = Field(min_length=1, max_length=20000)
    start_ms: Annotated[int, Field(ge=0)] | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    end_ms: Annotated[int, Field(ge=0)] | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    sentences: list[ReaderSentenceDto]


class ContentDetailDto(ApiModel):
    summary: ContentSummaryDto
    total_words: int = Field(ge=0)
    audio_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    segments: list[ContentSegmentDto]


class ContentRecommendationsResponseDto(ApiModel):
    data: list[ContentSummaryDto] = Field(max_length=100)
    meta: CursorResponseMetaDto


class ContentResponseDto(ApiModel):
    data: ContentDetailDto
    meta: ResponseMetaDto
