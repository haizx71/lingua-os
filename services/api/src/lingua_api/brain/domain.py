"""Transport-independent Language Brain read projections."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from lingua_api.competence.domain import CompetenceProjection, ConceptStatus

__all__ = ["ConceptStatus"]


@dataclass(frozen=True)
class MemoryProjection:
    state: str
    due_at: datetime
    last_reviewed_at: datetime | None
    is_due: bool


@dataclass(frozen=True)
class ProficiencyLevelProjection:
    framework_code: str
    code: str
    label: str


@dataclass(frozen=True)
class AttributionProjection:
    source_name: str
    license_code: str
    attribution_text: str
    source_url: str | None


@dataclass(frozen=True)
class ConceptIdentityProjection:
    id: UUID
    language_code: str
    canonical_key: str
    canonical_form: str
    part_of_speech: str | None
    level: ProficiencyLevelProjection | None
    attribution: AttributionProjection | None


@dataclass(frozen=True)
class DefinitionProjection:
    definition: str
    translation: str | None
    language_code: str
    order: int


@dataclass(frozen=True)
class ExampleProjection:
    sentence_id: UUID
    text: str
    translation: str | None
    audio_url: str | None


@dataclass(frozen=True)
class RelationProjection:
    concept_id: UUID
    relation_type: str
    canonical_form: str


@dataclass(frozen=True)
class EvidenceProjection:
    exposure_count: int
    review_count: int
    last_seen_at: datetime | None
    last_reviewed_at: datetime | None


@dataclass(frozen=True)
class BrainConceptProjection:
    concept_id: UUID
    status: ConceptStatus
    competence: CompetenceProjection
    mastery: float | None
    confidence: float
    memory: MemoryProjection | None
    exposure_count: int
    last_seen_at: datetime | None

    @classmethod
    def synthetic_zero(cls, *, concept_id: UUID) -> BrainConceptProjection:
        return cls(
            concept_id=concept_id,
            status=ConceptStatus.UNSEEN,
            competence=CompetenceProjection.zero(),
            mastery=None,
            confidence=0.0,
            memory=None,
            exposure_count=0,
            last_seen_at=None,
        )


@dataclass(frozen=True)
class BrainConceptListItem:
    identity: ConceptIdentityProjection
    learner: BrainConceptProjection


@dataclass(frozen=True)
class BrainConceptDetailProjection:
    identity: ConceptIdentityProjection
    learner: BrainConceptProjection
    definitions: tuple[DefinitionProjection, ...]
    examples: tuple[ExampleProjection, ...]
    relations: tuple[RelationProjection, ...]
    evidence: EvidenceProjection


@dataclass(frozen=True)
class BrainSummaryProjection:
    language_profile_id: UUID
    status_counts: dict[ConceptStatus, int]
    due_count: int
    competence: CompetenceProjection
    starting_level_estimate: None
    recent_concepts: tuple[BrainConceptListItem, ...]
    calculated_at: datetime
