"""Strict transport DTOs for the frozen Language Brain v1 contract."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import Field, StringConstraints
from pydantic.json_schema import SkipJsonSchema

from lingua_api.review.models import (
    ApiModel,
    CompetenceSignalsDto,
    ConceptStatusDto,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    MemorySnapshotDto,
    ProficiencyLevelDto,
    ResponseMetaDto,
)


class AttributionDto(ApiModel):
    source_name: str = Field(min_length=1, max_length=200)
    license_code: str = Field(min_length=1, max_length=64)
    attribution_text: str = Field(min_length=1, max_length=1000)
    source_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ConfidenceBandDto(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CompetenceDimensionDto(StrEnum):
    RECOGNITION = "recognition"
    LISTENING = "listening"
    PRODUCTION = "production"


class ConceptDefinitionDto(ApiModel):
    definition: str = Field(min_length=1, max_length=4000)
    translation: str | SkipJsonSchema[None] = Field(
        default=None, max_length=4000, exclude_if=lambda value: value is None
    )
    language_code: str
    order: int = Field(ge=0)


class ConceptExampleDto(ApiModel):
    sentence_id: UUID
    text: str = Field(min_length=1, max_length=5000)
    translation: str | SkipJsonSchema[None] = Field(
        default=None, max_length=5000, exclude_if=lambda value: value is None
    )
    audio_url: str | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ConceptRelationDto(ApiModel):
    concept_id: UUID
    relation_type: str = Field(min_length=1, max_length=64)
    canonical_form: str = Field(min_length=1, max_length=300)


class GrammarStructuralSlotDto(ApiModel):
    label: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=100)
    required: bool
    examples: list[Annotated[str, StringConstraints(min_length=1)]] = Field(max_length=10)


class GrammarSpecificationDto(ApiModel):
    pattern_formula: str = Field(min_length=1, max_length=1000)
    syntactic_category: str = Field(min_length=1, max_length=100)
    pragmatic_function: str = Field(min_length=1, max_length=2000)
    vietnamese_explanation: str = Field(min_length=1, max_length=4000)
    vietnamese_common_traps: str | SkipJsonSchema[None] = Field(
        default=None, max_length=4000, exclude_if=lambda value: value is None
    )
    structural_slots: list[GrammarStructuralSlotDto] = Field(min_length=1, max_length=20)


class ConceptLearnerProjectionDto(ApiModel):
    status: ConceptStatusDto
    is_due: bool
    exposure_count: int = Field(ge=0)
    last_seen_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    memory: MemorySnapshotDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    competence: CompetenceSignalsDto


class ConceptDetailDto(ApiModel):
    id: UUID
    language_code: str
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
    definitions: list[ConceptDefinitionDto]
    examples: list[ConceptExampleDto] = Field(max_length=50)
    relations: list[ConceptRelationDto] = Field(max_length=100)
    grammar: GrammarSpecificationDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    learner: ConceptLearnerProjectionDto
    attribution: AttributionDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class BrainConceptSummaryDto(ApiModel):
    concept: ConceptSummaryDto
    competence: CompetenceSignalsDto
    mastery: float | None = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    memory: MemorySnapshotDto | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    exposure_count: int = Field(ge=0)
    last_seen_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ConceptStatusCountsDto(ApiModel):
    total: int = Field(ge=0)
    unseen: int = Field(ge=0)
    discovered: int = Field(ge=0)
    learning: int = Field(ge=0)
    familiar: int = Field(ge=0)
    active: int = Field(ge=0)
    mastered: int = Field(ge=0)
    weak: int = Field(ge=0)
    forgotten: int = Field(ge=0)


class StartingLevelEstimateDto(ApiModel):
    level: ProficiencyLevelDto
    confidence: float = Field(ge=0, le=1)
    confidence_band: ConfidenceBandDto
    assessed_skills: list[CompetenceDimensionDto] = Field(min_length=1)
    evidence_count: int = Field(ge=0)
    method_version: str = Field(min_length=1, max_length=64)
    estimated_at: datetime


class BrainSummaryDto(ApiModel):
    language_profile_id: UUID
    status_counts: ConceptStatusCountsDto
    due_count: int = Field(ge=0)
    memory_health: float | None = Field(ge=0, le=1)
    competence: CompetenceSignalsDto
    starting_level_estimate: StartingLevelEstimateDto | None
    recent_concepts: list[BrainConceptSummaryDto] = Field(max_length=10)
    calculated_at: datetime


class EvidenceSummaryDto(ApiModel):
    exposure_count: int = Field(ge=0)
    review_count: int = Field(ge=0)
    last_seen_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )
    last_reviewed_at: datetime | SkipJsonSchema[None] = Field(
        default=None, exclude_if=lambda value: value is None
    )


class BrainConceptDetailDto(ApiModel):
    concept: ConceptDetailDto
    status: ConceptStatusDto
    competence: CompetenceSignalsDto
    mastery: float | None = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    memory: MemorySnapshotDto | None
    evidence: EvidenceSummaryDto


class BrainSummaryResponseDto(ApiModel):
    data: BrainSummaryDto
    meta: ResponseMetaDto


class BrainConceptListResponseDto(ApiModel):
    data: list[BrainConceptSummaryDto] = Field(max_length=100)
    meta: CursorResponseMetaDto


class BrainConceptResponseDto(ApiModel):
    data: BrainConceptDetailDto
    meta: ResponseMetaDto
