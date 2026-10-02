"""Strict DTOs for the frozen Dictionary operations."""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from lingua_api.brain.models import BrainConceptSummaryDto, ConceptDetailDto
from lingua_api.review.models import (
    ApiModel,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    ResponseMetaDto,
)


class ConceptResponseDto(ApiModel):
    data: ConceptDetailDto
    meta: ResponseMetaDto


class DictionaryLinkedConceptDto(BrainConceptSummaryDto):
    is_saved: bool


class DictionarySenseDto(ApiModel):
    sense_id: UUID
    sense_order: int = Field(ge=1)
    definition: str = Field(min_length=1)
    definition_language_code: str = Field(min_length=2, max_length=10)
    translated_definition: str | None = Field(default=None, exclude_if=lambda value: value is None)
    translation_language_code: str | None = Field(
        default=None, exclude_if=lambda value: value is None
    )
    concepts: list[DictionaryLinkedConceptDto]


class DictionaryLemmaGroupDto(ApiModel):
    lexeme_id: UUID
    lemma: str = Field(min_length=1, max_length=300)
    part_of_speech: str | None = Field(default=None, exclude_if=lambda value: value is None)
    matched_forms: list[str] = Field(min_length=1)
    senses: list[DictionarySenseDto]


class DictionarySearchResponseDto(ApiModel):
    data: list[ConceptSummaryDto]
    meta: CursorResponseMetaDto
    lemma_groups: list[DictionaryLemmaGroupDto] | None = Field(
        default=None, exclude_if=lambda value: value is None
    )
