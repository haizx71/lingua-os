"""Strict owner-content DTOs derived from the OpenAPI contract."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
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
        str_strip_whitespace=True,
    )


class AdminContentStatusDto(StrEnum):
    RAW = "raw"
    NORMALIZED = "normalized"
    ENRICHED = "enriched"
    REVIEWED = "reviewed"
    PUBLISHED = "published"
    QUARANTINED = "quarantined"
    RETIRED = "retired"


class ReaderContentLevelDto(StrEnum):
    A0 = "A0"
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"


class ResponseMetaDto(ApiModel):
    request_id: UUID
    api_version: Literal["1.0"] = "1.0"


class CreateAdminContentRequestDto(ApiModel):
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=100_000)
    language_code: Literal["en"]
    level: ReaderContentLevelDto
    author_name: str = Field(min_length=1, max_length=200)
    source_name: str = Field(min_length=1, max_length=200)
    source_version: str = Field(min_length=1, max_length=100)
    attribution_text: str = Field(min_length=1, max_length=1_000)
    rights_statement: str = Field(min_length=1, max_length=1_000)


class UpdateAdminContentRequestDto(ApiModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        populate_by_name=True,
        serialize_by_alias=True,
        str_strip_whitespace=True,
        validate_default=True,
    )

    title: Annotated[str, Field(min_length=1, max_length=500)] | SkipJsonSchema[None] = None
    body: Annotated[str, Field(min_length=1, max_length=100_000)] | SkipJsonSchema[None] = None
    level: ReaderContentLevelDto | SkipJsonSchema[None] = None
    author_name: Annotated[str, Field(min_length=1, max_length=200)] | SkipJsonSchema[None] = None
    source_name: Annotated[str, Field(min_length=1, max_length=200)] | SkipJsonSchema[None] = None
    source_version: Annotated[str, Field(min_length=1, max_length=100)] | SkipJsonSchema[None] = (
        None
    )
    attribution_text: (
        Annotated[str, Field(min_length=1, max_length=1_000)] | SkipJsonSchema[None]
    ) = None
    rights_statement: (
        Annotated[str, Field(min_length=1, max_length=1_000)] | SkipJsonSchema[None]
    ) = None

    @model_validator(mode="after")
    def require_change(self) -> UpdateAdminContentRequestDto:
        if not self.model_fields_set:
            raise ValueError("at least one content field is required")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("content fields cannot be null")
        return self


class AdminSentencePreviewDto(ApiModel):
    id: UUID
    order: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=5_000)
    concept_count: int = Field(ge=0)


class AdminContentDto(ApiModel):
    id: UUID
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=100_000)
    language_code: Literal["en"]
    content_type: Literal["article"]
    level: ReaderContentLevelDto
    status: AdminContentStatusDto
    author_name: str = Field(min_length=1, max_length=200)
    source_name: str = Field(min_length=1, max_length=200)
    source_version: str = Field(min_length=1, max_length=100)
    license_code: Literal["LINGUA-FIRST-PARTY"]
    attribution_text: str = Field(min_length=1, max_length=1_000)
    rights_statement: str = Field(min_length=1, max_length=1_000)
    source_record_key: str = Field(min_length=1, max_length=200)
    raw_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    sentences: list[AdminSentencePreviewDto] = Field(max_length=100)
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ValidationIssueDto(ApiModel):
    field: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=300)


class AdminContentValidationDto(ApiModel):
    content: AdminContentDto
    is_valid: bool
    issues: list[ValidationIssueDto] = Field(max_length=100)


class AdminContentListResponseDto(ApiModel):
    data: list[AdminContentDto] = Field(max_length=100)
    meta: ResponseMetaDto


class AdminContentResponseDto(ApiModel):
    data: AdminContentDto
    meta: ResponseMetaDto


class AdminContentValidationResponseDto(ApiModel):
    data: AdminContentValidationDto
    meta: ResponseMetaDto
