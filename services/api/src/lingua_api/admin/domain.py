"""Transport-independent admin content values and deterministic policy."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from lingua_api.reader.analyze_policy import analyze_transient_text


class AdminNotFound(RuntimeError):
    """The requested first-party authoring record does not exist."""


class AdminInvalidState(RuntimeError):
    """The requested authoring lifecycle transition is not allowed."""


class AdminValidationError(RuntimeError):
    """Authoring input cannot produce a valid bounded content record."""


@dataclass(frozen=True)
class AdminValidationIssue:
    field: str
    reason: str


@dataclass(frozen=True)
class AdminSentenceProjection:
    id: UUID
    order: int
    text: str
    concept_count: int


@dataclass(frozen=True)
class AdminContentProjection:
    id: UUID
    title: str
    body: str
    language_code: str
    content_type: str
    level: str
    status: str
    author_name: str
    source_name: str
    source_version: str
    license_code: str
    attribution_text: str
    rights_statement: str
    source_record_key: str
    raw_hash: str
    sentences: tuple[AdminSentenceProjection, ...]
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class AdminContentValidationProjection:
    content: AdminContentProjection
    is_valid: bool
    issues: tuple[AdminValidationIssue, ...]


def segment_english_text(body: str) -> tuple[str, ...]:
    """Reuse the accepted provider-free Reader splitter and preserve public Unicode text."""
    if not body.strip():
        raise AdminValidationError("body must contain non-whitespace text")
    sentences = tuple(
        sentence.text
        for segment in analyze_transient_text(body, ())
        for sentence in segment.sentences
    )
    if not sentences:
        raise AdminValidationError("body did not contain a sentence")
    if len(sentences) > 100:
        raise AdminValidationError("body exceeds the 100-sentence Reader publication bound")
    return sentences
