"""Thin Review application adapter over relational projections and the Memory Engine."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from psycopg import Connection, errors

from lingua_api.competence.domain import CompetenceProjection
from lingua_api.competence.service import CompetenceEngine
from lingua_api.memory.clock import Clock, SystemClock
from lingua_api.memory.domain import (
    AuthenticatedActor,
    IdempotencyConflict,
    MemoryItemNotFound,
    ReviewExerciseMode,
    ReviewSubmission,
)
from lingua_api.memory.service import PostgresMemoryEngine
from lingua_api.memory.store import LockedMemoryItem
from lingua_api.review.cursor import ReviewCursor, ReviewCursorCodec
from lingua_api.review.domain import (
    InvalidReviewCursor,
    ReviewAnswerProjection,
    ReviewModeMismatch,
    ReviewQueuePage,
)
from lingua_api.review.store import PostgresReviewReadStore


class ReviewApplication:
    def __init__(
        self,
        database_url: str,
        *,
        cursor_secret: bytes,
        clock: Clock | None = None,
    ) -> None:
        self._clock = clock or SystemClock()
        self._memory = PostgresMemoryEngine(database_url, clock=self._clock)
        self._competence = CompetenceEngine()
        self._read_store = PostgresReviewReadStore(database_url)
        self._cursor = ReviewCursorCodec(cursor_secret)

    def list_queue(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None,
        cursor: str | None,
        limit: int,
    ) -> ReviewQueuePage:
        self._read_store.require_application_identity(actor=actor)
        decoded = self._cursor.decode(cursor) if cursor is not None else None
        requested_profile: UUID | None
        if decoded is not None:
            if (
                language_profile_id is not None
                and language_profile_id != decoded.language_profile_id
            ):
                raise InvalidReviewCursor(
                    "cursor does not belong to the requested language profile"
                )
            requested_profile = decoded.language_profile_id
            as_of = decoded.as_of
            after_due_at = decoded.after_due_at
            after_review_item_id = decoded.after_review_item_id
        else:
            requested_profile = language_profile_id
            as_of = _utc(self._clock.now())
            after_due_at = None
            after_review_item_id = None
        profile_id = self._read_store.resolve_language_profile(
            actor=actor, requested_id=requested_profile
        )
        if profile_id is None:
            return ReviewQueuePage((), None, False)
        rows = self._read_store.list_due(
            actor=actor,
            language_profile_id=profile_id,
            as_of=as_of,
            after_due_at=after_due_at,
            after_review_item_id=after_review_item_id,
            limit=limit + 1,
        )
        has_more = len(rows) > limit
        visible = rows[:limit]
        next_cursor = None
        if has_more:
            boundary = visible[-1]
            next_cursor = self._cursor.encode(
                ReviewCursor(profile_id, as_of, boundary.due_at, boundary.review_item_id)
            )
        return ReviewQueuePage(tuple(visible), next_cursor, has_more)

    def answer(
        self,
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        submission: ReviewSubmission,
        exercise_mode: ReviewExerciseMode = ReviewExerciseMode.SELF_RECALL,
        validate_exercise_mode: bool = False,
    ) -> ReviewAnswerProjection:
        reviewed_at = _utc(self._clock.now())
        feedback = "Đã ghi nhận kết quả ôn tập."
        stored_feedback: str | None
        try:
            with self._memory.connect() as connection, connection.transaction():

                def validate_mode(
                    transaction: Connection[tuple[object, ...]], locked: LockedMemoryItem
                ) -> None:
                    selected = self._read_store.list_due(
                        actor=actor,
                        language_profile_id=locked.user_language_id,
                        as_of=datetime.max.replace(tzinfo=UTC),
                        after_due_at=None,
                        after_review_item_id=None,
                        limit=1,
                        connection=transaction,
                        review_item_id=review_item_id,
                    )
                    if not selected:
                        raise MemoryItemNotFound(
                            "review item was not found for the authenticated actor"
                        )
                    if selected[0].exercise_mode != exercise_mode:
                        raise ReviewModeMismatch(
                            "submitted exercise mode differs from selected prompt"
                        )

                outcome, locked = self._memory.review_in_transaction(
                    connection,
                    actor=actor,
                    review_item_id=review_item_id,
                    exercise_mode=exercise_mode,
                    submission=submission,
                    reviewed_at=reviewed_at,
                    validate_exercise_mode=validate_mode if validate_exercise_mode else None,
                )
                if outcome.replayed:
                    stored = self._competence.load_review_result(
                        connection,
                        actor=actor,
                        review_event_id=outcome.event_id,
                    )
                    if stored is None:
                        competence = CompetenceProjection.zero()
                        remaining_due_count = outcome.remaining_due_count
                        stored_feedback = feedback
                    else:
                        competence, remaining_due_count, stored_feedback = stored
                else:
                    competence = self._competence.apply_review(
                        connection,
                        actor=actor,
                        user_language_id=locked.user_language_id,
                        concept_id=locked.concept_id,
                        review_item_id=review_item_id,
                        review_event_id=outcome.event_id,
                        exercise_mode=exercise_mode,
                        submission=submission,
                        reviewed_at=reviewed_at,
                    )
                    remaining_due_count = outcome.remaining_due_count
                    stored_feedback = feedback
                    self._competence.store_review_result(
                        connection,
                        actor=actor,
                        review_event_id=outcome.event_id,
                        competence=competence,
                        remaining_due_count=remaining_due_count,
                        feedback=feedback,
                    )
        except errors.UniqueViolation as error:
            if error.diag.constraint_name == "review_events_user_id_idempotency_key_key":
                raise IdempotencyConflict(
                    "idempotency key was reused by another review request"
                ) from error
            raise
        return ReviewAnswerProjection.from_memory_outcome(
            outcome,
            competence=competence,
            remaining_due_count=remaining_due_count,
            feedback=stored_feedback,
        )


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError("clock must return a timezone-aware UTC datetime")
    return value
