"""Transport-independent Dictionary projections and failures."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from lingua_api.brain.domain import ProficiencyLevelProjection
from lingua_api.competence.domain import ConceptStatus


class DictionaryNotFound(Exception):
    """The active catalog/profile resource is absent or hidden."""


class DictionaryValidationError(ValueError):
    """A Dictionary filter is unsupported or semantically empty."""


@dataclass(frozen=True)
class DictionarySummaryProjection:
    id: UUID
    canonical_form: str
    part_of_speech: str | None
    level: ProficiencyLevelProjection | None
    status: ConceptStatus
    is_due: bool
    matched_normalized_form: str


@dataclass(frozen=True)
class DictionaryPage:
    items: tuple[DictionarySummaryProjection, ...]
    next_cursor: str | None
    has_more: bool
