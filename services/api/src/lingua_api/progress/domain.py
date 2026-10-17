"""Transport-independent Progress Overview v1 domain projections and pure calculations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from lingua_api.competence.domain import CompetenceProjection
from lingua_api.profile.domain import StartingLevelEstimate


class ProgressNotFound(Exception):
    """The requested active English language profile was not found for the actor."""


class ProgressProjectionUnavailable(Exception):
    """Persisted data violates the frozen Progress Overview v1 read contract."""


class ProgressWindow(StrEnum):
    WEEK = "week"
    MONTH = "month"


@dataclass(frozen=True)
class ProgressDayProjection:
    date: date
    minutes: int
    activities_completed: int
    goal_met: bool
    concepts_exposed: int
    concepts_strengthened: int


@dataclass(frozen=True)
class RetentionPointProjection:
    date: date
    successful_review_ratio: float
    reviewed_count: int


@dataclass(frozen=True)
class DailyPlanAggregate:
    plan_date: date
    daily_minutes_target: int
    completed_minutes: int
    activities_completed: int


@dataclass(frozen=True)
class DailyReviewAggregate:
    review_date: date
    reviewed_count: int
    successful_count: int
    strengthened_concepts_count: int


@dataclass(frozen=True)
class ProgressOverviewProjection:
    language_profile_id: UUID
    window_start: date
    window_end: date
    starting_level_estimate: StartingLevelEstimate | None
    memory_health: float
    competence: CompetenceProjection
    successful_learning_days: int
    target_learning_days: int
    concepts_exposed: int
    concepts_strengthened: int
    total_minutes: int
    daily_activity: tuple[ProgressDayProjection, ...]
    retention_trend: tuple[RetentionPointProjection, ...]
    calculated_at: datetime


def resolve_window_bounds(
    *,
    as_of: datetime,
    time_zone: str | None,
    window: ProgressWindow,
) -> tuple[date, date, tuple[date, ...]]:
    """Resolve inclusive learner-local calendar date bounds for week (7d) or month (30d)."""
    tz_name = (time_zone or "UTC").strip() or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, KeyError, ValueError):
        tz = ZoneInfo("UTC")

    aware_as_of = as_of.astimezone(UTC) if as_of.tzinfo is not None else as_of.replace(tzinfo=UTC)
    window_end = aware_as_of.astimezone(tz).date()
    day_count = 7 if window == ProgressWindow.WEEK else 30
    window_start = window_end - timedelta(days=day_count - 1)
    days = tuple(window_start + timedelta(days=offset) for offset in range(day_count))
    return window_start, window_end, days


def compute_memory_health(retrievabilities: tuple[float, ...]) -> float:
    """Compute bounded [0.0, 1.0] aggregate memory health from active FSRS retrievability."""
    valid = [max(0.0, min(1.0, float(value))) for value in retrievabilities]
    if not valid:
        return 0.0
    mean_value = sum(valid) / len(valid)
    return round(max(0.0, min(1.0, mean_value)), 4)


def compute_daily_activity(
    *,
    days: tuple[date, ...],
    default_daily_minutes: int,
    plans_by_date: dict[date, DailyPlanAggregate],
    exposed_by_date: dict[date, int],
    strengthened_by_date: dict[date, int],
) -> tuple[ProgressDayProjection, ...]:
    """Build ordered daily activity points across the requested calendar window."""
    result: list[ProgressDayProjection] = []
    safe_default_target = max(5, min(180, default_daily_minutes))
    for day in days:
        plan = plans_by_date.get(day)
        minutes = min(1440, max(0, plan.completed_minutes if plan is not None else 0))
        activities = max(0, plan.activities_completed if plan is not None else 0)
        target_minutes = plan.daily_minutes_target if plan is not None else safe_default_target
        concepts_exposed = max(0, exposed_by_date.get(day, 0))
        concepts_strengthened = max(0, strengthened_by_date.get(day, 0))
        goal_met = minutes >= target_minutes or (
            activities > 0 and (concepts_exposed > 0 or concepts_strengthened > 0) and minutes > 0
        )
        result.append(
            ProgressDayProjection(
                date=day,
                minutes=minutes,
                activities_completed=activities,
                goal_met=goal_met,
                concepts_exposed=concepts_exposed,
                concepts_strengthened=concepts_strengthened,
            )
        )
    return tuple(result)


def compute_retention_trend(
    *,
    days: tuple[date, ...],
    reviews_by_date: dict[date, DailyReviewAggregate],
    fallback_memory_health: float,
) -> tuple[RetentionPointProjection, ...]:
    """Build ordered retention points across the requested calendar window."""
    points: list[RetentionPointProjection] = []
    clamped_fallback = round(max(0.0, min(1.0, fallback_memory_health)), 4)
    for day in days:
        agg = reviews_by_date.get(day)
        if agg is None or agg.reviewed_count <= 0:
            points.append(
                RetentionPointProjection(
                    date=day,
                    successful_review_ratio=clamped_fallback,
                    reviewed_count=0,
                )
            )
        else:
            ratio = round(
                max(0.0, min(1.0, agg.successful_count / agg.reviewed_count)),
                4,
            )
            points.append(
                RetentionPointProjection(
                    date=day,
                    successful_review_ratio=ratio,
                    reviewed_count=agg.reviewed_count,
                )
            )
    return tuple(points)
