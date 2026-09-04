"""Strict Reader mutation DTOs matching the frozen OpenAPI schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator
from pydantic.json_schema import SkipJsonSchema

from lingua_api.content.models import ApiModel, ReadingProgressDto, ResponseMetaDto


class ReaderReadExposureRequestDto(ApiModel):
    language_profile_id: UUID
    content_id: UUID
    segment_id: UUID
    exposure_type: Literal["read"]
    occurred_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ReaderListenExposureRequestDto(ApiModel):
    language_profile_id: UUID
    content_id: UUID
    segment_id: UUID
    exposure_type: Literal["listen"]
    occurred_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ReaderLookupExposureRequestDto(ApiModel):
    language_profile_id: UUID
    content_id: UUID
    segment_id: UUID
    sentence_id: UUID
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=1)
    exposure_type: Literal["lookup"]
    occurred_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )

    @model_validator(mode="after")
    def end_follows_start(self) -> ReaderLookupExposureRequestDto:
        if self.end_offset <= self.start_offset:
            raise ValueError("endOffset must be greater than startOffset")
        return self


ReaderExposureRequestDto = Annotated[
    ReaderReadExposureRequestDto | ReaderListenExposureRequestDto | ReaderLookupExposureRequestDto,
    Field(discriminator="exposure_type"),
]


class ReaderExposureResultDto(ApiModel):
    exposure_id: UUID
    content_id: UUID
    segment_id: UUID
    exposure_type: Literal["read", "listen", "lookup"]
    accepted_concept_count: int = Field(ge=1, le=1000)
    occurred_at: datetime
    recorded_at: datetime


class ReaderExposureResponseDto(ApiModel):
    data: ReaderExposureResultDto
    meta: ResponseMetaDto


class UpdateReaderProgressRequestDto(ApiModel):
    language_profile_id: UUID
    current_segment_id: UUID
    is_completed: bool


class ReadingProgressResponseDto(ApiModel):
    data: ReadingProgressDto
    meta: ResponseMetaDto


class SaveSentenceRequestDto(ApiModel):
    sentence_id: UUID


class LibraryMutationResultDto(ApiModel):
    id: UUID
    item_type: Literal["content", "sentence", "concept"]
    is_saved: bool
    saved_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class LibraryMutationResponseDto(ApiModel):
    data: LibraryMutationResultDto
    meta: ResponseMetaDto


class SentenceConceptAnnotationDto(ApiModel):
    concept_id: UUID
    canonical_form: str = Field(min_length=1, max_length=300)
    start_offset: int = Field(ge=0)
    end_offset: int = Field(ge=1)
    status: Literal[
        "unseen", "discovered", "learning", "familiar", "active", "mastered", "weak", "forgotten"
    ]


class ReaderSentenceDto(ApiModel):
    id: UUID
    text: str = Field(min_length=1, max_length=5000)
    order: int = Field(ge=0)
    concepts: list[SentenceConceptAnnotationDto]


class ReaderSegmentDto(ApiModel):
    id: UUID
    order: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=20000)
    sentences: list[ReaderSentenceDto]


class ReaderAnalysisDto(ApiModel):
    analysis_id: UUID
    target_language_code: str
    translation_language_code: str
    segments: list[ReaderSegmentDto]
    analyzed_at: datetime


class ReaderAnalyzeResponseDto(ApiModel):
    data: ReaderAnalysisDto
    meta: ResponseMetaDto
