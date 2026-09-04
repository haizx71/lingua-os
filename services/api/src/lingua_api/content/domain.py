"""Transport-independent Reader catalog projections."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID


class ContentNotFound(RuntimeError):
    """The actor-visible published content or catalog sentence does not exist."""


class InvalidContentCursor(RuntimeError):
    """An opaque content cursor is malformed or belongs to another filter."""


@dataclass(frozen=True)
class ReadingProgressProjection:
    content_id: UUID
    current_segment_id: UUID
    furthest_segment_id: UUID
    progress_percent: int
    is_completed: bool
    started_at: datetime
    last_opened_at: datetime
    completed_at: datetime | None


@dataclass(frozen=True)
class AttributionProjection:
    source_name: str
    license_code: str
    attribution_text: str
    source_url: str | None


@dataclass(frozen=True)
class ContentSummaryProjection:
    id: UUID
    content_type: str
    title: str
    subtitle: str | None
    excerpt: str | None
    target_language_code: str
    difficulty_score: float
    difficulty_label: str
    known_concept_ratio: float
    estimated_minutes: int
    fit_reason: str
    is_saved: bool
    reading_progress: ReadingProgressProjection | None
    attribution: AttributionProjection | None
    sort_distance: int
    sort_known_ratio: Decimal
    sort_difficulty: Decimal


@dataclass(frozen=True)
class ConceptAnnotationProjection:
    concept_id: UUID
    canonical_form: str
    start_offset: int
    end_offset: int
    status: str


@dataclass(frozen=True)
class ReaderSentenceProjection:
    id: UUID
    text: str
    translation: str | None
    audio_url: str | None
    order: int
    concepts: tuple[ConceptAnnotationProjection, ...]


@dataclass(frozen=True)
class ContentSegmentProjection:
    id: UUID
    order: int
    segment_type: str
    text: str
    start_ms: int | None
    end_ms: int | None
    sentences: tuple[ReaderSentenceProjection, ...]


@dataclass(frozen=True)
class ContentDetailProjection:
    summary: ContentSummaryProjection
    total_words: int
    audio_url: str | None
    segments: tuple[ContentSegmentProjection, ...]


@dataclass(frozen=True)
class ContentPage:
    items: tuple[ContentSummaryProjection, ...]
    next_cursor: str | None
    has_more: bool
