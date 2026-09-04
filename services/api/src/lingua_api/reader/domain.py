"""Reader command values and failures independent of HTTP and PostgreSQL."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class ReaderExposureType(StrEnum):
    READ = "read"
    LISTEN = "listen"
    LOOKUP = "lookup"


class ReaderValidationError(RuntimeError):
    """An owned catalog identity or authoritative occurrence is invalid."""


class ReaderMutationInFlight(RuntimeError):
    """A matching actor/idempotency command is still running."""


@dataclass(frozen=True)
class ExposureCommand:
    language_profile_id: UUID
    content_id: UUID
    segment_id: UUID
    exposure_type: ReaderExposureType
    occurred_at: datetime | None = None
    sentence_id: UUID | None = None
    start_offset: int | None = None
    end_offset: int | None = None


@dataclass(frozen=True)
class ExposureResult:
    exposure_id: UUID
    content_id: UUID
    segment_id: UUID
    exposure_type: ReaderExposureType
    accepted_concept_count: int
    occurred_at: datetime
    recorded_at: datetime


@dataclass(frozen=True)
class SaveSentenceResult:
    sentence_id: UUID
    is_saved: bool
    saved_at: datetime


@dataclass(frozen=True)
class AnalyzeAnnotationResult:
    concept_id: UUID
    canonical_form: str
    start_index: int
    end_index: int
    start_offset_utf16: int
    end_offset_utf16: int
    status: str


@dataclass(frozen=True)
class AnalyzeSentenceResult:
    id: UUID
    text: str
    order: int
    concepts: tuple[AnalyzeAnnotationResult, ...]


@dataclass(frozen=True)
class AnalyzeSegmentResult:
    id: UUID
    text: str
    order: int
    sentences: tuple[AnalyzeSentenceResult, ...]


@dataclass(frozen=True)
class AnalyzeResult:
    analysis_id: UUID
    target_language_code: str
    translation_language_code: str
    segments: tuple[AnalyzeSegmentResult, ...]
    analyzed_at: datetime
