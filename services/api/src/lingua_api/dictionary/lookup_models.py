"""Lexical-only DTOs for exact Reader word lookup."""

from __future__ import annotations

from enum import StrEnum

from pydantic import AnyHttpUrl, Field

from lingua_api.review.models import ApiModel, ResponseMetaDto


class DictionaryLookupRequestDto(ApiModel):
    surface: str = Field(min_length=1, max_length=80)


class DictionaryLookupMatchStatusDto(StrEnum):
    FOUND = "found"
    NOT_FOUND = "not_found"


class DictionaryLookupAttributionDto(ApiModel):
    source_name: str = Field(min_length=1, max_length=200)
    source_url: AnyHttpUrl
    license_code: str = Field(min_length=1, max_length=80)
    license_url: AnyHttpUrl
    attribution_text: str = Field(min_length=1, max_length=500)
    change_notice: str | None = Field(default=None, min_length=1, max_length=500)


class DictionaryLookupSenseDto(ApiModel):
    sense_order: int = Field(ge=1)
    gloss_vi: str = Field(min_length=1, max_length=500)


class DictionaryLookupEntryDto(ApiModel):
    matched_surface: str = Field(min_length=1, max_length=80)
    part_of_speech: str | None = Field(default=None, min_length=1, max_length=64)
    form_of: str | None = Field(default=None, min_length=1, max_length=80)
    senses: list[DictionaryLookupSenseDto] = Field(min_length=1, max_length=32)
    attributions: list[DictionaryLookupAttributionDto] = Field(min_length=1, max_length=4)


class DictionaryLookupResultDto(ApiModel):
    match_status: DictionaryLookupMatchStatusDto
    entries: list[DictionaryLookupEntryDto] = Field(max_length=8)


class DictionaryLookupDataDto(DictionaryLookupResultDto):
    surface: str = Field(min_length=1, max_length=80)


class DictionaryLookupResponseDto(ApiModel):
    data: DictionaryLookupDataDto
    meta: ResponseMetaDto
