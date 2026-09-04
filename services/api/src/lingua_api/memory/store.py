"""Actor-scoped PostgreSQL repository primitives for the Memory Engine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection
from psycopg.types.json import Jsonb

from lingua_api.memory.domain import (
    ActivatedMemoryItem,
    AuthenticatedActor,
    CreatedFrom,
    DueMemoryItem,
    FsrsParameters,
    HistoricalReviewEvent,
    IdempotentReviewEvent,
    MemoryConfigurationError,
    MemoryItemNotFound,
    MemoryState,
    MemoryStateSnapshot,
    ParameterSet,
    ReviewExerciseMode,
    ReviewRating,
    ReviewSubmission,
    ReviewTransition,
    map_exercise_mode,
)


@dataclass(frozen=True)
class LockedMemoryItem:
    status: str
    concept_id: UUID
    user_language_id: UUID
    memory: MemoryStateSnapshot


class PostgresMemoryStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @staticmethod
    def assert_activation_boundary(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        concept_id: UUID,
    ) -> None:
        row = connection.execute(
            """
            SELECT user_language.id
            FROM user_languages AS user_language
            JOIN concepts AS concept
              ON concept.id = %s
             AND concept.language_code = user_language.language_code
            WHERE user_language.id = %s AND user_language.user_id = %s
            FOR SHARE OF user_language, concept
            """,
            (concept_id, user_language_id, actor.id),
        ).fetchone()
        if row is None:
            raise MemoryItemNotFound("owned language profile or concept was not found")

    @staticmethod
    def load_default_parameter_set(
        connection: Connection[tuple[object, ...]],
    ) -> ParameterSet:
        row = connection.execute(
            """
            SELECT id, version, algorithm_version, library_version, parameters
            FROM fsrs_parameter_sets
            WHERE is_default
            """
        ).fetchone()
        if row is None:
            raise MemoryConfigurationError("no default FSRS parameter set is configured")
        return _parameter_set(row)

    @staticmethod
    def load_parameter_set(
        connection: Connection[tuple[object, ...]],
        *,
        parameter_set_id: UUID,
        params_version: str,
    ) -> ParameterSet:
        row = connection.execute(
            """
            SELECT id, version, algorithm_version, library_version, parameters
            FROM fsrs_parameter_sets
            WHERE id = %s AND version = %s
            """,
            (parameter_set_id, params_version),
        ).fetchone()
        if row is None:
            raise MemoryConfigurationError("referenced FSRS parameter set is missing")
        return _parameter_set(row)

    @staticmethod
    def insert_lineage(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        concept_id: UUID,
        created_from: CreatedFrom,
        activated_at: datetime,
        parameter_set: ParameterSet,
    ) -> ActivatedMemoryItem:
        review_item_row = connection.execute(
            """
            INSERT INTO review_items
                (user_id, user_language_id, concept_id, status, created_from,
                 created_at, updated_at)
            VALUES (%s, %s, %s, 'active', %s, %s, %s)
            RETURNING id
            """,
            (
                actor.id,
                user_language_id,
                concept_id,
                created_from.value,
                activated_at,
                activated_at,
            ),
        ).fetchone()
        if review_item_row is None:
            raise MemoryConfigurationError("review item insert returned no identifier")
        review_item_id = _uuid(review_item_row[0])
        connection.execute(
            """
            INSERT INTO fsrs_states
                (review_item_id, user_id, difficulty, stability, due_at, last_review_at,
                 state, step, parameter_set_id, params_version, state_version,
                 created_at, updated_at)
            VALUES (%s, %s, NULL, NULL, %s, NULL, 'new', NULL, %s, %s, 1, %s, %s)
            """,
            (
                review_item_id,
                actor.id,
                activated_at,
                parameter_set.id,
                parameter_set.version,
                activated_at,
                activated_at,
            ),
        )
        memory = MemoryStateSnapshot(
            review_item_id=review_item_id,
            difficulty=None,
            stability=None,
            due_at=activated_at,
            last_review_at=None,
            state=MemoryState.NEW,
            step=None,
            parameter_set_id=parameter_set.id,
            params_version=parameter_set.version,
            state_version=1,
        )
        return ActivatedMemoryItem(
            review_item_id=review_item_id,
            concept_id=concept_id,
            memory=memory,
        )

    @staticmethod
    def lock_memory_item(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
    ) -> LockedMemoryItem:
        row = connection.execute(
            """
            SELECT review_item.status, review_item.concept_id, review_item.user_language_id,
                   state.difficulty, state.stability, state.due_at, state.last_review_at,
                   state.state, state.step, state.parameter_set_id, state.params_version,
                   state.state_version
            FROM review_items AS review_item
            JOIN fsrs_states AS state ON state.review_item_id = review_item.id
            WHERE review_item.id = %s AND review_item.user_id = %s
            FOR UPDATE OF review_item, state
            """,
            (review_item_id, actor.id),
        ).fetchone()
        if row is None:
            raise MemoryItemNotFound("memory item was not found for the authenticated actor")
        memory = MemoryStateSnapshot(
            review_item_id=review_item_id,
            difficulty=_optional_float(row[3]),
            stability=_optional_float(row[4]),
            due_at=_datetime(row[5]),
            last_review_at=_optional_datetime(row[6]),
            state=MemoryState(str(row[7])),
            step=_optional_int(row[8]),
            parameter_set_id=_uuid(row[9]),
            params_version=str(row[10]),
            state_version=int(cast(int, row[11])),
        )
        return LockedMemoryItem(
            status=str(row[0]),
            concept_id=_uuid(row[1]),
            user_language_id=_uuid(row[2]),
            memory=memory,
        )

    @staticmethod
    def find_idempotent_event(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        idempotency_key: UUID,
    ) -> IdempotentReviewEvent | None:
        row = connection.execute(
            """
            SELECT id, request_fingerprint, result_memory_snapshot
            FROM review_events
            WHERE user_id = %s AND idempotency_key = %s
            """,
            (actor.id, str(idempotency_key)),
        ).fetchone()
        if row is None:
            return None
        return IdempotentReviewEvent(
            event_id=_uuid(row[0]),
            request_fingerprint=str(row[1]),
            result_memory=(
                None if row[2] is None else _memory_snapshot(cast(dict[str, object], row[2]))
            ),
        )

    @staticmethod
    def insert_review_event(
        connection: Connection[tuple[object, ...]],
        *,
        event_id: UUID,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        exercise_mode: ReviewExerciseMode,
        submission: ReviewSubmission,
        transition: ReviewTransition,
        request_fingerprint: str,
        evidence: dict[str, str],
    ) -> None:
        connection.execute(
            """
            INSERT INTO review_events
                (id, review_item_id, user_id, exercise_mode, evidence_mode, rating,
                 response_time_ms, correct, evidence_json, idempotency_key,
                 request_fingerprint, parameter_set_id, params_version, result_memory_snapshot,
                 reviewed_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                event_id,
                review_item_id,
                actor.id,
                exercise_mode.value,
                map_exercise_mode(exercise_mode).value,
                submission.rating.value,
                submission.response_time_ms,
                submission.correct,
                Jsonb(evidence),
                str(submission.idempotency_key),
                request_fingerprint,
                transition.state.parameter_set_id,
                transition.state.params_version,
                Jsonb(_memory_snapshot_payload(transition.state)),
                transition.reviewed_at,
                transition.reviewed_at,
            ),
        )

    @staticmethod
    def load_review_history_through_event(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        event_id: UUID,
    ) -> tuple[datetime, list[HistoricalReviewEvent]]:
        item_row = connection.execute(
            """
            SELECT created_at
            FROM review_items
            WHERE id = %s AND user_id = %s
            """,
            (review_item_id, actor.id),
        ).fetchone()
        rows = connection.execute(
            """
            WITH target AS (
                SELECT reviewed_at, created_at, id
                FROM review_events
                WHERE id = %s AND review_item_id = %s AND user_id = %s
            )
            SELECT event.id, event.rating, event.response_time_ms, event.reviewed_at,
                   event.parameter_set_id, event.params_version
            FROM review_events AS event
            CROSS JOIN target
            WHERE event.review_item_id = %s
              AND event.user_id = %s
              AND (event.reviewed_at, event.created_at, event.id)
                  <= (target.reviewed_at, target.created_at, target.id)
            ORDER BY event.reviewed_at, event.created_at, event.id
            """,
            (event_id, review_item_id, actor.id, review_item_id, actor.id),
        ).fetchall()
        if item_row is None or not rows or _uuid(rows[-1][0]) != event_id:
            raise MemoryConfigurationError("review history is incomplete")
        return _datetime(item_row[0]), [
            HistoricalReviewEvent(
                event_id=_uuid(row[0]),
                rating=ReviewRating(str(row[1])),
                response_time_ms=0 if row[2] is None else int(cast(int, row[2])),
                reviewed_at=_datetime(row[3]),
                parameter_set_id=_uuid(row[4]),
                params_version=str(row[5]),
            )
            for row in rows
        ]

    @staticmethod
    def count_due(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        due_at: datetime,
    ) -> int:
        row = connection.execute(
            """
            SELECT count(*)
            FROM fsrs_states AS state
            JOIN review_items AS review_item ON review_item.id = state.review_item_id
            WHERE state.user_id = %s
              AND review_item.user_id = %s
              AND review_item.user_language_id = %s
              AND review_item.status = 'active'
              AND state.due_at <= %s
            """,
            (actor.id, actor.id, user_language_id, due_at),
        ).fetchone()
        if row is None:
            raise MemoryConfigurationError("due-count query returned no result")
        return int(cast(int, row[0]))

    @staticmethod
    def update_state(
        connection: Connection[tuple[object, ...]],
        *,
        previous_version: int,
        transition: ReviewTransition,
    ) -> bool:
        state = transition.state
        cursor = connection.execute(
            """
            UPDATE fsrs_states
            SET difficulty = %s,
                stability = %s,
                due_at = %s,
                last_review_at = %s,
                state = %s,
                step = %s,
                state_version = %s,
                updated_at = %s
            WHERE review_item_id = %s AND state_version = %s
            """,
            (
                state.difficulty,
                state.stability,
                state.due_at,
                state.last_review_at,
                state.state.value,
                state.step,
                state.state_version,
                transition.reviewed_at,
                state.review_item_id,
                previous_version,
            ),
        )
        return cursor.rowcount == 1

    @staticmethod
    def touch_review_item(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_item_id: UUID,
        reviewed_at: datetime,
    ) -> None:
        connection.execute(
            """
            UPDATE review_items
            SET updated_at = %s
            WHERE id = %s AND user_id = %s
            """,
            (reviewed_at, review_item_id, actor.id),
        )

    def list_due(
        self,
        *,
        actor: AuthenticatedActor,
        due_at: datetime,
        limit: int,
    ) -> list[DueMemoryItem]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT review_item.id, review_item.concept_id, state.due_at,
                       state.state, state.state_version
                FROM fsrs_states AS state
                JOIN review_items AS review_item ON review_item.id = state.review_item_id
                WHERE state.user_id = %s
                  AND review_item.user_id = %s
                  AND review_item.status = 'active'
                  AND state.due_at <= %s
                ORDER BY state.due_at, state.review_item_id
                LIMIT %s
                """,
                (actor.id, actor.id, due_at, limit),
            ).fetchall()
        return [
            DueMemoryItem(
                review_item_id=_uuid(row[0]),
                concept_id=_uuid(row[1]),
                due_at=_datetime(row[2]),
                state=MemoryState(str(row[3])),
                state_version=int(cast(int, row[4])),
            )
            for row in rows
        ]


def _parameter_set(row: tuple[object, ...]) -> ParameterSet:
    payload = cast(dict[str, object], row[4])
    return ParameterSet(
        id=_uuid(row[0]),
        version=str(row[1]),
        algorithm_version=str(row[2]),
        library_version=str(row[3]),
        parameters=FsrsParameters.from_mapping(payload),
    )


def _uuid(value: object) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise MemoryConfigurationError("database timestamp has an unexpected type")
    return value


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    if not isinstance(value, int | float | Decimal):
        raise MemoryConfigurationError("database numeric value has an unexpected type")
    return float(value)


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    if not isinstance(value, int):
        raise MemoryConfigurationError("database integer value has an unexpected type")
    return value


def _memory_snapshot_payload(snapshot: MemoryStateSnapshot) -> dict[str, object]:
    return {
        "reviewItemId": str(snapshot.review_item_id),
        "difficulty": snapshot.difficulty,
        "stability": snapshot.stability,
        "dueAt": snapshot.due_at.isoformat(),
        "lastReviewAt": (
            snapshot.last_review_at.isoformat() if snapshot.last_review_at is not None else None
        ),
        "state": snapshot.state.value,
        "step": snapshot.step,
        "parameterSetId": str(snapshot.parameter_set_id),
        "paramsVersion": snapshot.params_version,
        "stateVersion": snapshot.state_version,
    }


def _memory_snapshot(payload: dict[str, object]) -> MemoryStateSnapshot:
    try:
        return MemoryStateSnapshot(
            review_item_id=_uuid(payload["reviewItemId"]),
            difficulty=_optional_float(payload["difficulty"]),
            stability=_optional_float(payload["stability"]),
            due_at=datetime.fromisoformat(str(payload["dueAt"])),
            last_review_at=(
                None
                if payload["lastReviewAt"] is None
                else datetime.fromisoformat(str(payload["lastReviewAt"]))
            ),
            state=MemoryState(str(payload["state"])),
            step=_optional_int(payload["step"]),
            parameter_set_id=_uuid(payload["parameterSetId"]),
            params_version=str(payload["paramsVersion"]),
            state_version=int(cast(int, payload["stateVersion"])),
        )
    except (KeyError, TypeError, ValueError) as error:
        raise MemoryConfigurationError("review result snapshot is malformed") from error
