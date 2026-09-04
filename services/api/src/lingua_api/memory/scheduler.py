"""Narrow adapter around the maintained py-fsrs implementation."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from importlib.metadata import version as distribution_version

from fsrs import Card, Rating, Scheduler, State

from lingua_api.memory.domain import (
    MemoryState,
    MemoryStateSnapshot,
    ParameterSet,
    ReviewRating,
    ReviewTransition,
)

SUPPORTED_ALGORITHM_VERSION = "FSRS-6"
SUPPORTED_LIBRARY_VERSION = "6.3.2"

_RATINGS = {
    ReviewRating.AGAIN: Rating.Again,
    ReviewRating.HARD: Rating.Hard,
    ReviewRating.GOOD: Rating.Good,
    ReviewRating.EASY: Rating.Easy,
}

_TO_FSRS_STATE = {
    MemoryState.LEARNING: State.Learning,
    MemoryState.REVIEW: State.Review,
    MemoryState.RELEARNING: State.Relearning,
}

_FROM_FSRS_STATE = {
    State.Learning: MemoryState.LEARNING,
    State.Review: MemoryState.REVIEW,
    State.Relearning: MemoryState.RELEARNING,
}


def _as_utc(value: datetime, *, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware UTC")
    if value.utcoffset() != timedelta(0):
        raise ValueError(f"{field_name} must be timezone-aware UTC")
    return value.astimezone(UTC)


class FsrsSchedulerAdapter:
    """Translate persisted Memory Engine state to and from py-fsrs cards."""

    def transition(
        self,
        *,
        state: MemoryStateSnapshot,
        rating: ReviewRating,
        reviewed_at: datetime,
        parameter_set: ParameterSet,
        response_time_ms: int,
    ) -> ReviewTransition:
        reviewed_at = _as_utc(reviewed_at, field_name="reviewed_at")
        due_at = _as_utc(state.due_at, field_name="due_at")
        last_review_at = (
            _as_utc(state.last_review_at, field_name="last_review_at")
            if state.last_review_at is not None
            else None
        )
        if last_review_at is not None and reviewed_at < last_review_at:
            raise ValueError("review timestamp is before the previous review")
        if response_time_ms < 0:
            raise ValueError("response_time_ms must be non-negative")
        if (state.parameter_set_id, state.params_version) != (
            parameter_set.id,
            parameter_set.version,
        ):
            raise ValueError("memory state references a different parameter set")

        scheduler = self._scheduler(parameter_set)
        card = self._card(state, due_at=due_at, last_review_at=last_review_at)
        next_card, review_log = scheduler.review_card(
            card=card,
            rating=_RATINGS[rating],
            review_datetime=reviewed_at,
            review_duration=response_time_ms,
        )
        next_state = MemoryStateSnapshot(
            review_item_id=state.review_item_id,
            difficulty=next_card.difficulty,
            stability=next_card.stability,
            due_at=next_card.due,
            last_review_at=next_card.last_review,
            state=_FROM_FSRS_STATE[next_card.state],
            step=next_card.step,
            parameter_set_id=parameter_set.id,
            params_version=parameter_set.version,
            state_version=state.state_version + 1,
        )
        return ReviewTransition(
            state=next_state,
            rating=rating,
            reviewed_at=review_log.review_datetime,
            response_time_ms=response_time_ms,
        )

    @staticmethod
    def _scheduler(parameter_set: ParameterSet) -> Scheduler:
        if parameter_set.algorithm_version != SUPPORTED_ALGORITHM_VERSION:
            raise ValueError(f"unsupported algorithm version: {parameter_set.algorithm_version}")
        if parameter_set.library_version != SUPPORTED_LIBRARY_VERSION:
            raise ValueError(f"unsupported py-fsrs version: {parameter_set.library_version}")
        installed_version = distribution_version("fsrs")
        if installed_version != SUPPORTED_LIBRARY_VERSION:
            raise RuntimeError(
                f"installed fsrs {installed_version} does not match {SUPPORTED_LIBRARY_VERSION}"
            )
        parameters = parameter_set.parameters
        return Scheduler(
            parameters=parameters.model_weights,
            desired_retention=parameters.desired_retention,
            learning_steps=tuple(
                timedelta(seconds=seconds) for seconds in parameters.learning_steps_seconds
            ),
            relearning_steps=tuple(
                timedelta(seconds=seconds) for seconds in parameters.relearning_steps_seconds
            ),
            maximum_interval=parameters.maximum_interval_days,
            enable_fuzzing=parameters.enable_fuzzing,
        )

    @staticmethod
    def _card(
        state: MemoryStateSnapshot,
        *,
        due_at: datetime,
        last_review_at: datetime | None,
    ) -> Card:
        if state.state is MemoryState.NEW:
            if state.difficulty is not None or state.stability is not None:
                raise ValueError("new memory state cannot have difficulty or stability")
            return Card(card_id=state.review_item_id.int, due=due_at)
        if state.difficulty is None or state.stability is None or last_review_at is None:
            raise ValueError("reviewed memory state is missing FSRS values")
        return Card(
            card_id=state.review_item_id.int,
            state=_TO_FSRS_STATE[state.state],
            step=state.step,
            stability=state.stability,
            difficulty=state.difficulty,
            due=due_at,
            last_review=last_review_at,
        )
