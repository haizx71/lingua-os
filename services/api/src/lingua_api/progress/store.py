"""PostgreSQL read model for the frozen Progress v1 projection."""

from __future__ import annotations

import math
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from lingua_api.brain.domain import ProficiencyLevelProjection
from lingua_api.brain.store import BrainNotFound, BrainSnapshot, PostgresBrainStore
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.progress.domain import (
    ProgressDayProjection,
    ProgressOverviewProjection,
    RetentionPointProjection,
    StartingLevelProjection,
)


class ProgressProjectionUnavailable(RuntimeError):
    """Persisted evidence violates the frozen Progress v1 projection contract."""


class PostgresProgressStore:
    def __init__(self, database_url: str) -> None:
        self._brain = PostgresBrainStore(database_url)

    def load(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None,
        window_days: int,
    ) -> ProgressOverviewProjection:
        with self._brain.snapshot(actor=actor) as snapshot:
            profile_id = self._brain.resolve_profile(snapshot, language_profile_id)
            profile_created_at, time_zone = self._profile_context(snapshot, profile_id)
            zone = _zone(time_zone)
            window_end = snapshot.as_of.astimezone(zone).date()
            window_start = window_end - timedelta(days=window_days - 1)
            start_instant = datetime.combine(window_start, time.min, tzinfo=zone).astimezone(UTC)
            end_exclusive = datetime.combine(
                window_end + timedelta(days=1), time.min, tzinfo=zone
            ).astimezone(UTC)

            brain_summary = self._brain.load_summary(snapshot, profile_id)
            today = self._today_days(snapshot, profile_id, window_start, window_end)
            exposed = self._exposure_days(
                snapshot,
                profile_id,
                time_zone,
                start_instant,
                end_exclusive,
            )
            review = self._review_days(
                snapshot,
                profile_id,
                time_zone,
                start_instant,
                end_exclusive,
            )

            daily_activity: list[ProgressDayProjection] = []
            retention_trend: list[RetentionPointProjection] = []
            cursor = window_start
            while cursor <= window_end:
                seconds, activities, daily_target = today.get(cursor, (0, 0, 0))
                minutes = 0 if seconds <= 0 else math.ceil(seconds / 60)
                exposure_count = exposed.get(cursor, 0)
                reviewed_count, correct_count, strengthened_count = review.get(cursor, (0, 0, 0))
                daily_activity.append(
                    ProgressDayProjection(
                        date=cursor,
                        minutes=minutes,
                        activities_completed=activities,
                        goal_met=daily_target > 0 and seconds >= daily_target * 60,
                        concepts_exposed=exposure_count,
                        concepts_strengthened=strengthened_count,
                    )
                )
                retention_trend.append(
                    RetentionPointProjection(
                        date=cursor,
                        successful_review_ratio=(
                            0.0 if reviewed_count == 0 else correct_count / reviewed_count
                        ),
                        reviewed_count=reviewed_count,
                    )
                )
                cursor += timedelta(days=1)

            profile_created_date = profile_created_at.astimezone(zone).date()
            eligible_start = max(window_start, profile_created_date)
            target_learning_days = max(0, (window_end - eligible_start).days + 1)

            return ProgressOverviewProjection(
                language_profile_id=profile_id,
                window_start=window_start,
                window_end=window_end,
                starting_level_estimate=self._starting_level(snapshot, profile_id),
                memory_health=self._memory_health(snapshot, profile_id),
                competence=brain_summary.competence,
                successful_learning_days=sum(day.goal_met for day in daily_activity),
                target_learning_days=target_learning_days,
                concepts_exposed=self._window_exposed_count(
                    snapshot, profile_id, start_instant, end_exclusive
                ),
                concepts_strengthened=self._window_strengthened_count(
                    snapshot, profile_id, start_instant, end_exclusive
                ),
                total_minutes=sum(day.minutes for day in daily_activity),
                daily_activity=tuple(daily_activity),
                retention_trend=tuple(retention_trend),
                calculated_at=snapshot.as_of,
            )

    @staticmethod
    def _profile_context(snapshot: BrainSnapshot, profile_id: UUID) -> tuple[datetime, str]:
        row = snapshot.connection.execute(
            """
            SELECT language.created_at, learner.time_zone
            FROM user_languages AS language
            JOIN learner_profiles AS learner ON learner.user_id = language.user_id
            JOIN users AS app_user ON app_user.id = language.user_id
            WHERE language.id = %s AND language.user_id = %s
              AND language.status = 'active' AND app_user.deleted_at IS NULL
            """,
            (profile_id, snapshot.actor.id),
        ).fetchone()
        if row is None or row[1] is None:
            raise BrainNotFound("product-ready learner progress context was not found")
        return _datetime(row[0]), str(row[1])

    @staticmethod
    def _today_days(
        snapshot: BrainSnapshot,
        profile_id: UUID,
        window_start: date,
        window_end: date,
    ) -> dict[date, tuple[int, int, int]]:
        rows = snapshot.connection.execute(
            """
            SELECT plan.plan_date,
                   COALESCE(sum(CASE WHEN activity.status = 'completed'
                                     THEN COALESCE(activity.duration_seconds, 0)
                                     ELSE 0 END), 0),
                   count(*) FILTER (WHERE activity.status = 'completed'),
                   max(plan.daily_minutes)
            FROM today_plans AS plan
            LEFT JOIN today_plan_activities AS activity
              ON activity.plan_id = plan.id AND activity.user_id = plan.user_id
            WHERE plan.user_id = %s AND plan.user_language_id = %s
              AND plan.plan_date BETWEEN %s AND %s
            GROUP BY plan.plan_date
            """,
            (snapshot.actor.id, profile_id, window_start, window_end),
        ).fetchall()
        return {
            _date(row[0]): (
                int(cast(int, row[1])),
                int(cast(int, row[2])),
                int(cast(int, row[3])),
            )
            for row in rows
        }

    @staticmethod
    def _exposure_days(
        snapshot: BrainSnapshot,
        profile_id: UUID,
        time_zone: str,
        start_instant: datetime,
        end_exclusive: datetime,
    ) -> dict[date, int]:
        rows = snapshot.connection.execute(
            """
            SELECT (occurred_at AT TIME ZONE %s)::date AS local_date,
                   count(DISTINCT concept_id)
            FROM exposure_events
            WHERE user_id = %s AND user_language_id = %s
              AND language_code = 'en' AND concept_id IS NOT NULL
              AND occurred_at >= %s AND occurred_at < %s
            GROUP BY local_date
            """,
            (time_zone, snapshot.actor.id, profile_id, start_instant, end_exclusive),
        ).fetchall()
        return {_date(row[0]): int(cast(int, row[1])) for row in rows}

    @staticmethod
    def _review_days(
        snapshot: BrainSnapshot,
        profile_id: UUID,
        time_zone: str,
        start_instant: datetime,
        end_exclusive: datetime,
    ) -> dict[date, tuple[int, int, int]]:
        rows = snapshot.connection.execute(
            """
            SELECT (event.reviewed_at AT TIME ZONE %s)::date AS local_date,
                   count(*),
                   count(*) FILTER (WHERE event.correct IS TRUE),
                   count(DISTINCT item.concept_id) FILTER (WHERE event.correct IS TRUE)
            FROM review_events AS event
            JOIN review_items AS item
              ON item.id = event.review_item_id AND item.user_id = event.user_id
            WHERE event.user_id = %s AND item.user_language_id = %s
              AND event.reviewed_at >= %s AND event.reviewed_at < %s
            GROUP BY local_date
            """,
            (time_zone, snapshot.actor.id, profile_id, start_instant, end_exclusive),
        ).fetchall()
        return {
            _date(row[0]): (
                int(cast(int, row[1])),
                int(cast(int, row[2])),
                int(cast(int, row[3])),
            )
            for row in rows
        }

    @staticmethod
    def _window_exposed_count(
        snapshot: BrainSnapshot,
        profile_id: UUID,
        start_instant: datetime,
        end_exclusive: datetime,
    ) -> int:
        row = snapshot.connection.execute(
            """
            SELECT count(DISTINCT concept_id)
            FROM exposure_events
            WHERE user_id = %s AND user_language_id = %s
              AND language_code = 'en' AND concept_id IS NOT NULL
              AND occurred_at >= %s AND occurred_at < %s
            """,
            (snapshot.actor.id, profile_id, start_instant, end_exclusive),
        ).fetchone()
        return 0 if row is None else int(cast(int, row[0]))

    @staticmethod
    def _window_strengthened_count(
        snapshot: BrainSnapshot,
        profile_id: UUID,
        start_instant: datetime,
        end_exclusive: datetime,
    ) -> int:
        row = snapshot.connection.execute(
            """
            SELECT count(DISTINCT item.concept_id)
            FROM review_events AS event
            JOIN review_items AS item
              ON item.id = event.review_item_id AND item.user_id = event.user_id
            WHERE event.user_id = %s AND item.user_language_id = %s
              AND event.correct IS TRUE
              AND event.reviewed_at >= %s AND event.reviewed_at < %s
            """,
            (snapshot.actor.id, profile_id, start_instant, end_exclusive),
        ).fetchone()
        return 0 if row is None else int(cast(int, row[0]))

    @staticmethod
    def _memory_health(snapshot: BrainSnapshot, profile_id: UUID) -> float:
        row = snapshot.connection.execute(
            """
            SELECT count(*),
                   count(*) FILTER (WHERE memory.due_at <= %s)
            FROM review_items AS item
            JOIN fsrs_states AS memory
              ON memory.review_item_id = item.id AND memory.user_id = item.user_id
            WHERE item.user_id = %s AND item.user_language_id = %s
              AND item.language_code = 'en' AND item.status = 'active'
            """,
            (snapshot.as_of, snapshot.actor.id, profile_id),
        ).fetchone()
        if row is None:
            return 0.0
        total = int(cast(int, row[0]))
        overdue = int(cast(int, row[1]))
        if total == 0:
            return 0.0
        return max(0.0, min(1.0, (total - overdue) / total))

    @staticmethod
    def _starting_level(
        snapshot: BrainSnapshot, profile_id: UUID
    ) -> StartingLevelProjection | None:
        row = snapshot.connection.execute(
            """
            SELECT framework.code, level.code, level.label,
                   result.confidence, result.confidence_band,
                   result.assessed_skills, result.evidence_count,
                   result.method_version, result.estimated_at
            FROM assessment_attempts AS attempt
            JOIN assessment_results AS result
              ON result.attempt_id = attempt.id AND result.user_id = attempt.user_id
            JOIN proficiency_levels AS level ON level.id = result.estimated_level_id
            JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            WHERE attempt.user_id = %s AND attempt.user_language_id = %s
              AND attempt.status = 'completed'
            ORDER BY result.estimated_at DESC, result.id DESC
            LIMIT 1
            """,
            (snapshot.actor.id, profile_id),
        ).fetchone()
        if row is None:
            return None
        skills = row[5]
        if not isinstance(skills, list):
            skills = list(cast(tuple[object, ...], skills))
        return StartingLevelProjection(
            level=ProficiencyLevelProjection(str(row[0]), str(row[1]), str(row[2])),
            confidence=_float(row[3]),
            confidence_band=str(row[4]),
            assessed_skills=tuple(str(skill) for skill in skills),
            evidence_count=int(cast(int, row[6])),
            method_version=str(row[7]),
            estimated_at=_datetime(row[8]),
        )


def _zone(value: str) -> ZoneInfo:
    try:
        return ZoneInfo(value)
    except ZoneInfoNotFoundError as error:
        raise BrainNotFound("product-ready learner progress context was not found") from error


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ProgressProjectionUnavailable("progress timestamp must be timezone-aware")
    return value.astimezone(UTC)


def _date(value: object) -> date:
    if not isinstance(value, date):
        raise ProgressProjectionUnavailable("progress date has an unexpected type")
    return value


def _float(value: object) -> float:
    if not isinstance(value, int | float | Decimal):
        raise ProgressProjectionUnavailable("progress score has an unexpected type")
    return float(value)
