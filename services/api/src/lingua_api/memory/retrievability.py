"""Private typed reads for the Knowledge V2 retrievability projection."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from typing import cast
from uuid import UUID

from psycopg import Connection

from lingua_api.competence.domain import ConceptStatus
from lingua_api.memory.domain import AuthenticatedActor, MemoryState


class RetrievabilityProjectionUnavailable(RuntimeError):
    """Persisted FSRS lineage cannot produce a valid py-fsrs 6.3.2 projection."""


@dataclass(frozen=True)
class ConceptRetrievabilityProjection:
    """Internal projection; raw FSRS parameters never cross the public API boundary."""

    user_language_id: UUID
    concept_id: UUID
    review_item_id: UUID | None
    stored_status: ConceptStatus
    effective_status: ConceptStatus
    memory_state: MemoryState | None
    due_at: datetime | None
    last_review_at: datetime | None
    parameter_set_id: UUID | None
    params_version: str | None
    current_retrievability: float
    calculated_at: datetime


def fetch_concept_retrievability(
    connection: Connection[tuple[object, ...]],
    *,
    actor: AuthenticatedActor,
    user_language_id: UUID,
    concept_id: UUID,
) -> ConceptRetrievabilityProjection | None:
    """Load one actor-owned concept projection without mutating scheduler state."""

    row = connection.execute(
        """
        SELECT user_language_id, concept_id, review_item_id,
               stored_status, effective_status, memory_state,
               due_at, last_review_at, parameter_set_id, params_version,
               current_retrievability, calculated_at
        FROM public.v_learner_concept_retrievability
        WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
        """,
        (actor.id, user_language_id, concept_id),
    ).fetchone()
    if row is None:
        return None

    score = _retrievability(row[10])
    try:
        stored_status = ConceptStatus(str(row[3]))
        effective_status = ConceptStatus(str(row[4]))
        memory_state = None if row[5] is None else MemoryState(str(row[5]))
    except ValueError as error:
        raise RetrievabilityProjectionUnavailable(
            "retrievability projection contains an unsupported state"
        ) from error

    calculated_at = _datetime(row[11], field_name="calculated_at")
    return ConceptRetrievabilityProjection(
        user_language_id=_uuid(row[0], field_name="user_language_id"),
        concept_id=_uuid(row[1], field_name="concept_id"),
        review_item_id=_optional_uuid(row[2], field_name="review_item_id"),
        stored_status=stored_status,
        effective_status=effective_status,
        memory_state=memory_state,
        due_at=_optional_datetime(row[6], field_name="due_at"),
        last_review_at=_optional_datetime(row[7], field_name="last_review_at"),
        parameter_set_id=_optional_uuid(row[8], field_name="parameter_set_id"),
        params_version=None if row[9] is None else str(row[9]),
        current_retrievability=score,
        calculated_at=calculated_at,
    )


def _retrievability(value: object) -> float:
    if value is None:
        raise RetrievabilityProjectionUnavailable(
            "FSRS parameter lineage cannot produce retrievability"
        )
    try:
        score = float(cast(float, value))
    except (TypeError, ValueError) as error:
        raise RetrievabilityProjectionUnavailable(
            "retrievability projection is not numeric"
        ) from error
    if not math.isfinite(score) or not 0 <= score <= 1:
        raise RetrievabilityProjectionUnavailable("retrievability projection is outside [0, 1]")
    return score


def _uuid(value: object, *, field_name: str) -> UUID:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise RetrievabilityProjectionUnavailable(f"{field_name} is invalid") from error


def _optional_uuid(value: object, *, field_name: str) -> UUID | None:
    return None if value is None else _uuid(value, field_name=field_name)


def _datetime(value: object, *, field_name: str) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise RetrievabilityProjectionUnavailable(f"{field_name} is not timezone-aware")
    return value


def _optional_datetime(value: object, *, field_name: str) -> datetime | None:
    return None if value is None else _datetime(value, field_name=field_name)
