"""Unit tests for Progress Overview v1 domain projections and pure calculations."""

from __future__ import annotations

from datetime import UTC, date, datetime

from lingua_api.progress.domain import (
    DailyPlanAggregate,
    DailyReviewAggregate,
    ProgressWindow,
    compute_daily_activity,
    compute_memory_health,
    compute_retention_trend,
    resolve_window_bounds,
)


def test_resolve_window_bounds_respects_learner_iana_timezone() -> None:
    # 2026-10-14 18:30 UTC is 2026-10-15 01:30 in Asia/Ho_Chi_Minh (+07:00)
    as_of = datetime(2026, 10, 14, 18, 30, tzinfo=UTC)
    start_week, end_week, days_week = resolve_window_bounds(
        as_of=as_of,
        time_zone="Asia/Ho_Chi_Minh",
        window=ProgressWindow.WEEK,
    )
    assert end_week == date(2026, 10, 15)
    assert start_week == date(2026, 10, 9)
    assert len(days_week) == 7
    assert days_week[0] == start_week
    assert days_week[-1] == end_week

    start_month, end_month, days_month = resolve_window_bounds(
        as_of=as_of,
        time_zone="Asia/Ho_Chi_Minh",
        window=ProgressWindow.MONTH,
    )
    assert end_month == date(2026, 10, 15)
    assert start_month == date(2026, 9, 16)
    assert len(days_month) == 30


def test_compute_memory_health_clamps_and_handles_empty_inputs() -> None:
    assert compute_memory_health(()) == 0.0
    assert compute_memory_health((0.8, 0.9, 1.0)) == 0.9
    assert compute_memory_health((-0.2, 1.4)) == 0.5


def test_compute_daily_activity_and_retention_trend_preserve_order_and_bounds() -> None:
    d1 = date(2026, 10, 13)
    d2 = date(2026, 10, 14)
    days = (d1, d2)

    plans = {
        d1: DailyPlanAggregate(
            plan_date=d1,
            daily_minutes_target=20,
            completed_minutes=25,
            activities_completed=3,
        ),
    }
    exposed = {d1: 4, d2: 0}
    strengthened = {d1: 6, d2: 0}

    activity = compute_daily_activity(
        days=days,
        default_daily_minutes=20,
        plans_by_date=plans,
        exposed_by_date=exposed,
        strengthened_by_date=strengthened,
    )
    assert len(activity) == 2
    assert activity[0].date == d1
    assert activity[0].minutes == 25
    assert activity[0].activities_completed == 3
    assert activity[0].goal_met is True
    assert activity[0].concepts_exposed == 4
    assert activity[0].concepts_strengthened == 6

    assert activity[1].date == d2
    assert activity[1].minutes == 0
    assert activity[1].goal_met is False

    reviews = {
        d1: DailyReviewAggregate(
            review_date=d1,
            reviewed_count=10,
            successful_count=9,
            strengthened_concepts_count=6,
        ),
    }
    trend = compute_retention_trend(
        days=days,
        reviews_by_date=reviews,
        fallback_memory_health=0.85,
    )
    assert len(trend) == 2
    assert trend[0].successful_review_ratio == 0.9
    assert trend[0].reviewed_count == 10
    assert trend[1].successful_review_ratio == 0.85
    assert trend[1].reviewed_count == 0
