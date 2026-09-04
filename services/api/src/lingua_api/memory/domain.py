"""Typed Memory Engine domain values independent from HTTP DTOs and database rows."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class ReviewRating(StrEnum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


class ReviewExerciseMode(StrEnum):
    SELF_RECALL = "self_recall"
    MULTIPLE_CHOICE = "multiple_choice"
    TYPING = "typing"
    CLOZE = "cloze"
    LISTENING = "listening"


class EvidenceMode(StrEnum):
    RECOGNITION = "recognition"
    LISTENING = "listening"
    CLOZE = "cloze"
    PRODUCTION = "production"


class MemoryState(StrEnum):
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"


class CreatedFrom(StrEnum):
    LEARNER_SAVED = "learner_saved"
    EVIDENCE_THRESHOLD = "evidence_threshold"
    PLACEMENT = "placement"


class MemoryEngineError(RuntimeError):
    """Base error for domain-safe Memory Engine failures."""


class MemoryConfigurationError(MemoryEngineError):
    """The server has no usable default/versioned scheduler configuration."""


class MemoryItemNotFound(MemoryEngineError):
    """The item does not exist inside the authenticated actor boundary."""


class MemoryItemInactive(MemoryEngineError):
    """A suspended or retired item cannot accept review evidence."""


class MemoryLineageExists(MemoryEngineError):
    """The learner/concept primary memory lineage already exists."""


class IdempotencyConflict(MemoryEngineError):
    """An idempotency key was reused with a different logical payload."""


class ConcurrentMemoryUpdate(MemoryEngineError):
    """The locked state version did not update exactly once."""


EXERCISE_TO_EVIDENCE_MODE: dict[ReviewExerciseMode, EvidenceMode] = {
    ReviewExerciseMode.SELF_RECALL: EvidenceMode.PRODUCTION,
    ReviewExerciseMode.MULTIPLE_CHOICE: EvidenceMode.RECOGNITION,
    ReviewExerciseMode.TYPING: EvidenceMode.PRODUCTION,
    ReviewExerciseMode.CLOZE: EvidenceMode.CLOZE,
    ReviewExerciseMode.LISTENING: EvidenceMode.LISTENING,
}


def map_exercise_mode(exercise_mode: ReviewExerciseMode) -> EvidenceMode:
    """Map a presentation variant to audit/evidence metadata, never a schedule."""
    return EXERCISE_TO_EVIDENCE_MODE[exercise_mode]


@dataclass(frozen=True)
class FsrsParameters:
    model_weights: tuple[float, ...]
    desired_retention: float
    learning_steps_seconds: tuple[int, ...]
    relearning_steps_seconds: tuple[int, ...]
    maximum_interval_days: int
    enable_fuzzing: bool

    def __post_init__(self) -> None:
        if len(self.model_weights) != 21:
            raise ValueError("FSRS-6 requires exactly 21 model weights")
        if not 0 < self.desired_retention <= 1:
            raise ValueError("desired_retention must be in (0, 1]")
        if any(
            step <= 0 for step in (*self.learning_steps_seconds, *self.relearning_steps_seconds)
        ):
            raise ValueError("learning and relearning steps must be positive")
        if self.maximum_interval_days < 1:
            raise ValueError("maximum_interval_days must be positive")

    @classmethod
    def from_mapping(cls, payload: Mapping[str, object]) -> FsrsParameters:
        weights = _float_tuple(payload.get("model_weights"), field_name="model_weights")
        learning_steps = _int_tuple(
            payload.get("learning_steps_seconds"), field_name="learning_steps_seconds"
        )
        relearning_steps = _int_tuple(
            payload.get("relearning_steps_seconds"), field_name="relearning_steps_seconds"
        )
        desired_retention = payload.get("desired_retention")
        maximum_interval_days = payload.get("maximum_interval_days")
        enable_fuzzing = payload.get("enable_fuzzing")
        if not isinstance(desired_retention, int | float) or isinstance(desired_retention, bool):
            raise ValueError("desired_retention must be numeric")
        if not isinstance(maximum_interval_days, int) or isinstance(maximum_interval_days, bool):
            raise ValueError("maximum_interval_days must be an integer")
        if not isinstance(enable_fuzzing, bool):
            raise ValueError("enable_fuzzing must be a boolean")
        return cls(
            model_weights=weights,
            desired_retention=float(desired_retention),
            learning_steps_seconds=learning_steps,
            relearning_steps_seconds=relearning_steps,
            maximum_interval_days=maximum_interval_days,
            enable_fuzzing=enable_fuzzing,
        )


@dataclass(frozen=True)
class ParameterSet:
    id: UUID
    version: str
    algorithm_version: str
    library_version: str
    parameters: FsrsParameters


@dataclass(frozen=True)
class MemoryStateSnapshot:
    review_item_id: UUID
    difficulty: float | None
    stability: float | None
    due_at: datetime
    last_review_at: datetime | None
    state: MemoryState
    step: int | None
    parameter_set_id: UUID
    params_version: str
    state_version: int


@dataclass(frozen=True)
class ReviewTransition:
    state: MemoryStateSnapshot
    rating: ReviewRating
    reviewed_at: datetime
    response_time_ms: int


@dataclass(frozen=True)
class AuthenticatedActor:
    id: UUID
    email: str | None = None

    @property
    def user_id(self) -> UUID:
        """Compatibility alias for bounded contexts that name the actor key user_id."""
        return self.id


@dataclass(frozen=True)
class ReviewSubmission:
    idempotency_key: UUID
    rating: ReviewRating
    response_time_ms: int
    correct: bool | None
    response_text: str | None
    selected_option_id: UUID | None

    def __post_init__(self) -> None:
        if not 0 <= self.response_time_ms <= 3_600_000:
            raise ValueError("response_time_ms must be between 0 and 3600000")
        if self.response_text is not None and len(self.response_text) > 5000:
            raise ValueError("response_text must not exceed 5000 characters")


@dataclass(frozen=True)
class ActivatedMemoryItem:
    review_item_id: UUID
    concept_id: UUID
    memory: MemoryStateSnapshot


@dataclass(frozen=True)
class ReviewOutcome:
    event_id: UUID
    memory: MemoryStateSnapshot
    replayed: bool
    remaining_due_count: int


@dataclass(frozen=True)
class IdempotentReviewEvent:
    event_id: UUID
    request_fingerprint: str
    result_memory: MemoryStateSnapshot | None


@dataclass(frozen=True)
class HistoricalReviewEvent:
    event_id: UUID
    rating: ReviewRating
    response_time_ms: int
    reviewed_at: datetime
    parameter_set_id: UUID
    params_version: str


@dataclass(frozen=True)
class DueMemoryItem:
    review_item_id: UUID
    concept_id: UUID
    due_at: datetime
    state: MemoryState
    state_version: int


def _float_tuple(value: object, *, field_name: str) -> tuple[float, ...]:
    if not isinstance(value, list):
        raise ValueError(f"{field_name} must be an array")
    result: list[float] = []
    for item in value:
        if not isinstance(item, int | float) or isinstance(item, bool):
            raise ValueError(f"{field_name} must contain numbers")
        result.append(float(item))
    return tuple(result)


def _int_tuple(value: object, *, field_name: str) -> tuple[int, ...]:
    if not isinstance(value, list) or any(
        not isinstance(item, int) or isinstance(item, bool) for item in value
    ):
        raise ValueError(f"{field_name} must contain integers")
    return tuple(value)
