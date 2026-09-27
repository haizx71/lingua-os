"""Review application projections independent from HTTP and private FSRS fields."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from lingua_api.competence.domain import CompetenceProjection
from lingua_api.memory.domain import (
    MemoryState,
    MemoryStateSnapshot,
    ReviewExerciseMode,
    ReviewOutcome,
)


class ReviewProjectionUnavailable(RuntimeError):
    """Stored learner/lexical projections cannot satisfy the public Review contract."""


class InvalidReviewCursor(ValueError):
    """The opaque Review cursor is invalid, expired, or belongs to another query."""


class ReviewModeMismatch(ValueError):
    """A submitted Review mode differs from the server-selected prompt."""


@dataclass(frozen=True)
class DueReviewProjection:
    review_item_id: UUID
    concept_id: UUID
    canonical_form: str
    part_of_speech: str | None
    concept_status: str
    prompt_text: str
    exercise_mode: ReviewExerciseMode
    context_sentence: str | None
    translation: str | None
    audio_url: str | None
    due_at: datetime
    last_review_at: datetime | None
    memory_state: MemoryState
    framework_code: str | None
    level_code: str | None
    level_label: str | None
    competence: CompetenceProjection


@dataclass(frozen=True)
class ReviewQueuePage:
    items: tuple[DueReviewProjection, ...]
    next_cursor: str | None
    has_more: bool


@dataclass(frozen=True)
class ReviewAnswerProjection:
    review_item_id: UUID
    memory: MemoryStateSnapshot
    competence: CompetenceProjection
    remaining_due_count: int
    replayed: bool
    feedback: str | None = None

    @classmethod
    def from_memory_outcome(
        cls,
        outcome: ReviewOutcome,
        *,
        competence: CompetenceProjection,
        remaining_due_count: int | None = None,
        feedback: str | None = None,
    ) -> ReviewAnswerProjection:
        return cls(
            review_item_id=outcome.memory.review_item_id,
            memory=outcome.memory,
            competence=competence,
            remaining_due_count=(
                outcome.remaining_due_count if remaining_due_count is None else remaining_due_count
            ),
            replayed=outcome.replayed,
            feedback=feedback,
        )
