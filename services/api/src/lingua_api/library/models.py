"""FastAPI DTOs for the Library service conforming to OpenAPI v1."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field
from pydantic.json_schema import SkipJsonSchema

from lingua_api.content.models import ContentSummaryDto, ReaderSentenceDto
from lingua_api.review.models import (
    ApiModel,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    ResponseMetaDto,
)


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


class SavedConceptItemDto(ApiModel):
    item_type: Literal["concept"] = "concept"
    saved_at: datetime
    concept: ConceptSummaryDto


class SavedContentItemDto(ApiModel):
    item_type: Literal["content"] = "content"
    saved_at: datetime
    content: ContentSummaryDto


class SavedSentenceItemDto(ApiModel):
    item_type: Literal["sentence"] = "sentence"
    saved_at: datetime
    sentence: ReaderSentenceDto


LibraryItemDto = Annotated[
    SavedConceptItemDto | SavedContentItemDto | SavedSentenceItemDto,
    Field(discriminator="item_type"),
]


class LibraryItemsResponseDto(ApiModel):
    data: list[LibraryItemDto] = Field(max_length=100)
    meta: CursorResponseMetaDto
