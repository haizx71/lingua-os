"""Transactional Memory Engine orchestration without HTTP or recommendation logic."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

from psycopg import Connection, errors

from lingua_api.memory.clock import Clock, SystemClock
from lingua_api.memory.domain import (
    ActivatedMemoryItem,
    AuthenticatedActor,
    ConcurrentMemoryUpdate,
    CreatedFrom,
    DueMemoryItem,
    IdempotencyConflict,
    MemoryItemInactive,
    MemoryLineageExists,
    MemoryState,
    MemoryStateSnapshot,
    ReviewExerciseMode,
    ReviewOutcome,
    ReviewSubmission,
)
from lingua_api.memory.scheduler import FsrsSchedulerAdapter
from lingua_api.memory.store import LockedMemoryItem, PostgresMemoryStore

LOGGER = logging.getLogger("lingua_api.memory")


class PostgresMemoryEngine:
    def __init__(
        self,
        database_url: str,
        *,
        clock: Clock | None = None,
        scheduler: FsrsSchedulerAdapter | None = None,
    ) -> None:
        self._clock = clock or SystemClock()
        self._scheduler = scheduler or FsrsSchedulerAdapter()
        self._store = PostgresMemoryStore(database_url)

    def activate(
        self,
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        concept_id: UUID,
        created_from: CreatedFrom,
    ) -> ActivatedMemoryItem:
        activated_at = _utc(self._clock.now())
        try:
            with self._store.connect() as connection, connection.transaction():
                self._store.assert_activation_boundary(
                    connection,
                    actor=actor,
                    user_language_id=user_language_id,
                    concept_id=concept_id,
                )
                parameter_set = self._store.load_default_parameter_set(connection)
                item = self._store.insert_lineage(
                    connection,
                    actor=actor,
                    user_language_id=user_language_id,
                    concept_id=concept_id,
                    created_from=created_from,
                    activated_at=activated_at,
                    parameter_set=parameter_set,
                )
        except errors.UniqueViolation as error:
            raise MemoryLineageExists(
                "the learner/concept memory lineage already exists"
            ) from error
        self._log(
            {
                "event": "memory.lineage.activated",
                "actor": _safe_actor_id(actor),
                "reviewItemId": str(item.review_item_id),
                "parameterVersion": item.memory.params_version,
            }
        )
        return item

    def ensure_lineage_in_transaction(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        concept_id: UUID,
        created_from: CreatedFrom = CreatedFrom.LEARNER_SAVED,
        activated_at: datetime | None = None,
    ) -> tuple[UUID, bool]:
        """Ensure review item and fsrs state exist within caller's transaction
        without overwriting existing state.
        """
        at = _utc(activated_at or self._clock.now())
        self._store.assert_activation_boundary(
            connection,
            actor=actor,
            user_language_id=user_language_id,
            concept_id=concept_id,
        )
        parameter_set = self._store.load_default_parameter_set(connection)
        review_item_id, created = self._store.ensure_lineage(
            connection,
            actor=actor,
            user_language_id=user_language_id,
            concept_id=concept_id,
            created_from=created_from,
            activated_at=at,
            parameter_set=parameter_set,
        )
        if created:
            self._log(
                {
                    "event": "memory.lineage.activated",
                    "actor": _safe_actor_id(actor),
                    "reviewItemId": str(review_item_id),
                    "parameterVersion": parameter_set.version,
                }
            )
        return review_item_id, created

    def review(
        self,
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        exercise_mode: ReviewExerciseMode,
        submission: ReviewSubmission,
    ) -> ReviewOutcome:
        reviewed_at = _utc(self._clock.now())
        try:
            with self._store.connect() as connection, connection.transaction():
                outcome, _ = self.review_in_transaction(
                    connection,
                    actor=actor,
                    review_item_id=review_item_id,
                    exercise_mode=exercise_mode,
                    submission=submission,
                    reviewed_at=reviewed_at,
                )
        except errors.UniqueViolation as error:
            if error.diag.constraint_name == "review_events_user_id_idempotency_key_key":
                raise IdempotencyConflict(
                    "idempotency key was reused by another review request"
                ) from error
            raise
        self._log(
            {
                "event": "memory.review.replayed"
                if outcome.replayed
                else "memory.review.completed",
                "actor": _safe_actor_id(actor),
                "reviewItemId": str(review_item_id),
                "eventId": str(outcome.event_id),
                "parameterVersion": outcome.memory.params_version,
                "state": outcome.memory.state.value,
                "stateVersion": outcome.memory.state_version,
            }
        )
        return outcome

    def connect(self) -> Connection[tuple[object, ...]]:
        """Open a connection for an application-owned cross-engine transaction."""
        return self._store.connect()

    def review_in_transaction(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        exercise_mode: ReviewExerciseMode,
        submission: ReviewSubmission,
        reviewed_at: datetime,
        validate_exercise_mode: Callable[[Connection[tuple[object, ...]], LockedMemoryItem], None]
        | None = None,
    ) -> tuple[ReviewOutcome, LockedMemoryItem]:
        """Apply Memory using a caller-owned transaction and never commit independently."""
        reviewed_at = _utc(reviewed_at)
        fingerprint = _request_fingerprint(
            review_item_id=review_item_id,
            exercise_mode=exercise_mode,
            submission=submission,
        )
        locked = self._store.lock_memory_item(
            connection, actor=actor, review_item_id=review_item_id
        )
        if locked.status != "active":
            raise MemoryItemInactive(f"memory item is {locked.status}")
        existing = self._store.find_idempotent_event(
            connection,
            actor=actor,
            idempotency_key=submission.idempotency_key,
        )
        if existing is None and validate_exercise_mode is not None:
            validate_exercise_mode(connection, locked)
        if existing is not None:
            if existing.request_fingerprint != fingerprint:
                raise IdempotencyConflict(
                    "idempotency key was reused with a different review payload"
                )
            outcome_memory = existing.result_memory or self._reconstruct_result(
                connection,
                actor=actor,
                review_item_id=review_item_id,
                event_id=existing.event_id,
            )
            event_id = existing.event_id
            replayed = True
        else:
            parameter_set = self._store.load_parameter_set(
                connection,
                parameter_set_id=locked.memory.parameter_set_id,
                params_version=locked.memory.params_version,
            )
            transition = self._scheduler.transition(
                state=locked.memory,
                rating=submission.rating,
                reviewed_at=reviewed_at,
                parameter_set=parameter_set,
                response_time_ms=submission.response_time_ms,
            )
            event_id = uuid4()
            self._store.insert_review_event(
                connection,
                event_id=event_id,
                actor=actor,
                review_item_id=review_item_id,
                exercise_mode=exercise_mode,
                submission=submission,
                transition=transition,
                request_fingerprint=fingerprint,
                evidence=_evidence(submission),
            )
            if not self._store.update_state(
                connection,
                previous_version=locked.memory.state_version,
                transition=transition,
            ):
                raise ConcurrentMemoryUpdate("memory state version did not update")
            self._store.touch_review_item(
                connection,
                actor=actor,
                review_item_id=review_item_id,
                reviewed_at=reviewed_at,
            )
            outcome_memory = transition.state
            replayed = False
        remaining_due_count = self._store.count_due(
            connection,
            actor=actor,
            user_language_id=locked.user_language_id,
            due_at=reviewed_at,
        )
        return (
            ReviewOutcome(
                event_id=event_id,
                memory=outcome_memory,
                replayed=replayed,
                remaining_due_count=remaining_due_count,
            ),
            locked,
        )

    def _reconstruct_result(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        event_id: UUID,
    ) -> MemoryStateSnapshot:
        activated_at, history = self._store.load_review_history_through_event(
            connection,
            actor=actor,
            review_item_id=review_item_id,
            event_id=event_id,
        )
        first = history[0]
        state = MemoryStateSnapshot(
            review_item_id=review_item_id,
            difficulty=None,
            stability=None,
            due_at=activated_at,
            last_review_at=None,
            state=MemoryState.NEW,
            step=None,
            parameter_set_id=first.parameter_set_id,
            params_version=first.params_version,
            state_version=1,
        )
        for historical in history:
            parameter_set = self._store.load_parameter_set(
                connection,
                parameter_set_id=historical.parameter_set_id,
                params_version=historical.params_version,
            )
            transition = self._scheduler.transition(
                state=state,
                rating=historical.rating,
                reviewed_at=historical.reviewed_at,
                parameter_set=parameter_set,
                response_time_ms=historical.response_time_ms,
            )
            if historical.event_id == event_id:
                return transition.state
            state = _persisted_precision(transition.state)
        raise RuntimeError("target review event disappeared during reconstruction")

    def list_due(
        self,
        *,
        actor: AuthenticatedActor,
        limit: int = 20,
    ) -> list[DueMemoryItem]:
        if not 1 <= limit <= 100:
            raise ValueError("limit must be between 1 and 100")
        return self._store.list_due(
            actor=actor,
            due_at=_utc(self._clock.now()),
            limit=limit,
        )

    @staticmethod
    def _log(payload: dict[str, object]) -> None:
        LOGGER.info(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None or value.utcoffset() != timedelta(0):
        raise ValueError("clock must return a timezone-aware UTC datetime")
    return value


def _request_fingerprint(
    *,
    review_item_id: UUID,
    exercise_mode: ReviewExerciseMode,
    submission: ReviewSubmission,
) -> str:
    payload = {
        "reviewItemId": str(review_item_id),
        "exerciseMode": exercise_mode.value,
        "rating": submission.rating.value,
        "responseTimeMs": submission.response_time_ms,
        "correct": submission.correct,
        "responseText": submission.response_text,
        "selectedOptionId": (
            str(submission.selected_option_id)
            if submission.selected_option_id is not None
            else None
        ),
    }
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _evidence(submission: ReviewSubmission) -> dict[str, str]:
    evidence: dict[str, str] = {}
    if submission.response_text is not None:
        evidence["responseText"] = submission.response_text
    if submission.selected_option_id is not None:
        evidence["selectedOptionId"] = str(submission.selected_option_id)
    return evidence


def _safe_actor_id(actor: AuthenticatedActor) -> str:
    return hashlib.sha256(actor.id.bytes).hexdigest()[:16]


def _persisted_precision(state: MemoryStateSnapshot) -> MemoryStateSnapshot:
    def rounded(value: float | None) -> float | None:
        if value is None:
            return None
        return float(Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))

    return replace(
        state,
        difficulty=rounded(state.difficulty),
        stability=rounded(state.stability),
    )
