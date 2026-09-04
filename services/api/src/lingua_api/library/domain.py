"""Domain types and projections for the Library service."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from lingua_api.content.domain import AttributionProjection, ReadingProgressProjection


class LibraryNotFound(ValueError):
    """The requested concept, content, sentence, or profile does not exist."""


class LibraryValidationError(ValueError):
    """A Library request fails domain validation or constraints."""


class InvalidLibraryCursor(ValueError):
    """A Library cursor is malformed, tampered with, or out of scope."""


@dataclass(frozen=True)
class SentenceConceptAnnotation:
    concept_id: UUID
    canonical_form: str
    start_offset_utf16: int
    end_offset_utf16: int
    status: str


@dataclass(frozen=True)
class SavedConceptItem:
    concept_id: UUID
    canonical_form: str
    part_of_speech: str | None
    ipa: str | None
    audio_url: str | None
    level: str | None
    status: str
    is_due: bool
    saved_at: datetime


@dataclass(frozen=True)
class SavedContentItem:
    content_id: UUID
    content_type: str
    title: str
    subtitle: str | None
    excerpt: str | None
    target_language_code: str
    difficulty_score: float
    difficulty_label: str | None
    known_concept_ratio: float
    estimated_minutes: int
    cover_image_url: str | None
    fit_reason: str | None
    is_saved: bool
    reading_progress: ReadingProgressProjection | None
    attribution: AttributionProjection | None
    saved_at: datetime


@dataclass(frozen=True)
class SavedSentenceItem:
    sentence_id: UUID
    order: int
    text: str
    translation: str | None
    audio_url: str | None
    concepts: tuple[SentenceConceptAnnotation, ...]
    saved_at: datetime


LibraryItemProjection = SavedConceptItem | SavedContentItem | SavedSentenceItem


@dataclass(frozen=True)
class SaveMutationResult:
    id: UUID
    item_type: str
    is_saved: bool
    saved_at: datetime | None


@dataclass(frozen=True)
class LibraryItemsPage:
    items: tuple[LibraryItemProjection, ...]
    next_cursor: str | None
    has_more: bool
