"""Pure Today candidate and decision types with no transport or database dependency."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal
from uuid import UUID

type TodayActivityType = Literal["review", "read", "listen"]
type TodayPlanStatus = Literal["active", "completed"]


class TodayNotFound(LookupError):
    """The actor has no matching profile or persisted plan."""


class TodayInvalidState(RuntimeError):
    """An activity cannot be completed without authoritative proof."""


class TodayIdempotencyConflict(RuntimeError):
    """A completion idempotency key was reused with another fingerprint."""


class TodayPlanUnavailable(RuntimeError):
    """A persisted plan references content that no longer passes its authority gate."""


@dataclass(frozen=True)
class ReviewCandidate:
    review_item_id: UUID
    concept_id: UUID
    due_at: datetime


@dataclass(frozen=True)
class ContentCandidate:
    content_id: UUID
    title: str
    estimated_minutes: int
    source_rank: int
    unseen_concept_count: int = 0
    is_unfinished: bool = False
    is_saved: bool = False
    is_completed: bool = False
    has_audio: bool = False
    weak_recognition: bool = False
    weak_listening: bool = False
    low_production_evidence: bool = False
    forgotten: bool = False
    recently_exposed: bool = False
    last_opened_at: datetime | None = None
    saved_at: datetime | None = None
    reinforcement_concept_ids: tuple[UUID, ...] = ()


@dataclass(frozen=True)
class TodayContext:
    target_minutes: int
    as_of: datetime


@dataclass(frozen=True)
class TodayActivityDecision:
    activity_type: TodayActivityType
    title: str
    description: str
    estimated_minutes: int
    reason_codes: tuple[str, ...]
    reason_text: str
    target_count: int
    review_item_ids: tuple[UUID, ...] = ()
    content_id: UUID | None = None
    concept_id: UUID | None = None
    diagnostics: dict[str, object] | None = None


@dataclass(frozen=True)
class TodayDecision:
    status: TodayPlanStatus
    activities: tuple[TodayActivityDecision, ...]
    unused_minutes: int


@dataclass(frozen=True)
class TodayProfile:
    user_language_id: UUID
    time_zone: str | None
    daily_minutes: int


@dataclass(frozen=True)
class TodayActivityProjection:
    id: UUID
    position: int
    activity_type: str
    title: str
    description: str
    estimated_minutes: int
    reason_codes: tuple[str, ...]
    reason_text: str
    status: str
    target_count: int
    completed_count: int
    content_id: UUID | None
    concept_id: UUID | None
    review_item_id: UUID | None
    completed_at: datetime | None
    created_at: datetime


@dataclass(frozen=True)
class TodayPlanProjection:
    id: UUID
    language_profile_id: UUID
    plan_date: date
    time_zone: str
    target_minutes: int
    completed_minutes: int
    status: str
    engine_version: str
    activities: tuple[TodayActivityProjection, ...]
    as_of: datetime
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class TodayCompletionProjection:
    plan: TodayPlanProjection
    activity: TodayActivityProjection
    replayed: bool
