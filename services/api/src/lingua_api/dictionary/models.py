"""Strict DTOs for the frozen Dictionary operations."""

from __future__ import annotations

from lingua_api.brain.models import ConceptDetailDto
from lingua_api.review.models import (
    ApiModel,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    ResponseMetaDto,
)


class ConceptResponseDto(ApiModel):
    data: ConceptDetailDto
    meta: ResponseMetaDto


class DictionarySearchResponseDto(ApiModel):
    data: list[ConceptSummaryDto]
    meta: CursorResponseMetaDto
