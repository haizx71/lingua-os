"""Bounded read-only PostgreSQL projection store for Progress Overview v1."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import psycopg
from psycopg import Connection, Cursor

from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.profile.domain import ProficiencyLevel, StartingLevelEstimate
from lingua_api.progress.domain import (
    DailyPlanAggregate,
    DailyReviewAggregate,
    ProgressNotFound,
    ProgressOverviewProjection,
    ProgressProjectionUnavailable,
    ProgressWindow,
    compute_daily_activity,
    compute_memory_health,
    compute_retention_trend,
    resolve_window_bounds,
)


class ProgressSnapshot:
    def __init__(
        self,
        connection: Connection[tuple[object, ...]],
        cursor: Cursor[tuple[object, ...]] | None = None,
        *,
        actor: AuthenticatedActor,
        as_of: datetime,
    ) -> None:
        self.connection = connection
        self.cursor = cursor if cursor is not None else connection.cursor()
        self.actor = actor
        self.as_of = as_of


class PostgresProgressStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @contextmanager
    def snapshot(self, *, actor: AuthenticatedActor) -> Iterator[ProgressSnapshot]:
        with self.connect() as connection:
            connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            with connection.cursor() as cursor:
                cursor.execute("SELECT transaction_timestamp()")
                row = cursor.fetchone()
                if row is None or not isinstance(row[0], datetime):
                    raise ProgressProjectionUnavailable(
                        "database snapshot timestamp is unavailable"
                    )
                yield ProgressSnapshot(connection, cursor, actor=actor, as_of=_datetime(row[0]))

    @staticmethod
    def resolve_profile(
        snapshot: ProgressSnapshot,
        requested_id: UUID | None,
    ) -> tuple[UUID, str | None, int, StartingLevelEstimate | None]:
        parameters: tuple[object, ...]
        where_clause = ""
        if requested_id is None:
            parameters = (snapshot.actor.id,)
        else:
            where_clause = "AND language.id = %s"
            parameters = (snapshot.actor.id, requested_id)

        row = snapshot.cursor.execute(
            f"""
            SELECT language.id,
                   learner.time_zone,
                   language.daily_minutes,
                   estimate.level_id,
                   estimate.framework_code,
                   estimate.level_code,
                   estimate.level_label,
                   estimate.confidence,
                   estimate.confidence_band,
                   estimate.assessed_skills,
                   estimate.evidence_count,
                   estimate.method_version,
                   estimate.estimated_at
            FROM user_languages AS language
            LEFT JOIN learner_profiles AS learner ON learner.user_id = language.user_id
            LEFT JOIN LATERAL (
                SELECT estimated_level.id AS level_id,
                       estimated_framework.code AS framework_code,
                       estimated_level.code AS level_code,
                       estimated_level.label AS level_label,
                       result.confidence,
                       result.framework_mapping ->> 'confidenceBand' AS confidence_band,
                       result.assessed_skills,
                       result.evidence_count,
                       result.method_version,
                       result.estimated_at
                FROM assessment_attempts AS attempt
                JOIN assessment_results AS result
                  ON result.attempt_id = attempt.id AND result.user_id = attempt.user_id
                JOIN proficiency_levels AS estimated_level
                  ON estimated_level.id = result.estimated_level_id
                JOIN proficiency_frameworks AS estimated_framework
                  ON estimated_framework.id = estimated_level.framework_id
                WHERE attempt.user_id = language.user_id
                  AND attempt.user_language_id = language.id
                  AND attempt.status = 'completed'
                  AND result.framework_mapping ->> 'confidenceBand' IN ('low', 'medium', 'high')
                ORDER BY result.estimated_at DESC, result.id DESC
                LIMIT 1
            ) AS estimate ON true
            WHERE language.user_id = %s
              AND language.language_code = 'en'
              AND language.native_language_code = 'vi'
              AND language.status = 'active'
              {where_clause}
            ORDER BY language.created_at, language.id
            LIMIT 1
            """,
            parameters,
        ).fetchone()
        if row is None:
            raise ProgressNotFound("active English learner profile was not found")

        estimate = (
            None
            if row[3] is None
            else StartingLevelEstimate(
                level=ProficiencyLevel(
                    _uuid(row[3]),
                    str(row[4]),
                    str(row[5]),
                    str(row[6]),
                ),
                confidence=_float(row[7]),
                confidence_band=str(row[8]),
                assessed_skills=tuple(str(item) for item in cast(list[object], row[9])),
                evidence_count=int(cast(int, row[10])),
                method_version=str(row[11]),
                estimated_at=_datetime(row[12]),
            )
        )
        return (
            _uuid(row[0]),
            None if row[1] is None else str(row[1]),
            int(cast(int, row[2])),
            estimate,
        )

    @staticmethod
    def load_overview(
        snapshot: ProgressSnapshot,
        *,
        profile_id: UUID,
        time_zone: str | None,
        daily_minutes: int,
        starting_level_estimate: StartingLevelEstimate | None,
        window: ProgressWindow,
    ) -> ProgressOverviewProjection:
        window_start, window_end, days = resolve_window_bounds(
            as_of=snapshot.as_of,
            time_zone=time_zone,
            window=window,
        )
        tz_name = (time_zone or "UTC").strip() or "UTC"
        try:
            ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, KeyError, ValueError):
            tz_name = "UTC"

        cursor = snapshot.cursor
        memory_health = _load_retrievability(
            cursor,
            user_id=snapshot.actor.id,
            profile_id=profile_id,
        )
        competence = _load_skill_competence(
            cursor,
            user_id=snapshot.actor.id,
            profile_id=profile_id,
        )

        plan_rows = cursor.execute(
            """
            SELECT plan.plan_date,
                   MAX(plan.daily_minutes)::integer AS daily_target,
                   COALESCE(
                       SUM(
                           CASE WHEN activity.status = 'completed'
                                 THEN activity.estimated_minutes
                                 ELSE 0
                            END
                        ),
                        0
                    )::integer AS completed_minutes,
                    COUNT(activity.id) FILTER (WHERE activity.status = 'completed')::integer
                        AS completed_activities
            FROM today_plans AS plan
            LEFT JOIN today_plan_activities AS activity
              ON activity.plan_id = plan.id AND activity.user_id = plan.user_id
            WHERE plan.user_id = %s
              AND plan.user_language_id = %s
              AND plan.plan_date BETWEEN %s AND %s
            GROUP BY plan.plan_date
            """,
            (snapshot.actor.id, profile_id, window_start, window_end),
        ).fetchall()
        plans_by_date: dict[date, DailyPlanAggregate] = {}
        for row in plan_rows:
            plan_day = _date(row[0])
            plans_by_date[plan_day] = DailyPlanAggregate(
                plan_date=plan_day,
                daily_minutes_target=int(cast(int, row[1])),
                completed_minutes=int(cast(int, row[2])),
                activities_completed=int(cast(int, row[3])),
            )

        exposure_rows = cursor.execute(
            """
            WITH raw_exposures AS (
                SELECT (event.occurred_at AT TIME ZONE %s)::date AS local_date,
                       COALESCE(rec.concept_id, event.concept_id) AS concept_id
                FROM exposure_events AS event
                LEFT JOIN reader_exposure_concepts AS rec
                  ON rec.exposure_event_id = event.id
                 AND rec.user_id = event.user_id
                WHERE event.user_id = %s
                  AND event.user_language_id = %s
                  AND (event.occurred_at AT TIME ZONE %s)::date BETWEEN %s AND %s
            )
            SELECT local_date, COUNT(DISTINCT concept_id)::integer
            FROM raw_exposures
            WHERE concept_id IS NOT NULL
            GROUP BY local_date
            """,
            (tz_name, snapshot.actor.id, profile_id, tz_name, window_start, window_end),
        ).fetchall()
        exposed_by_date: dict[date, int] = {
            _date(row[0]): int(cast(int, row[1])) for row in exposure_rows
        }

        total_exposed_row = cursor.execute(
            """
            WITH raw_exposures AS (
                SELECT COALESCE(rec.concept_id, event.concept_id) AS concept_id
                FROM exposure_events AS event
                LEFT JOIN reader_exposure_concepts AS rec
                  ON rec.exposure_event_id = event.id
                 AND rec.user_id = event.user_id
                WHERE event.user_id = %s
                  AND event.user_language_id = %s
                  AND (event.occurred_at AT TIME ZONE %s)::date BETWEEN %s AND %s
            )
            SELECT COUNT(DISTINCT concept_id)::integer
            FROM raw_exposures
            WHERE concept_id IS NOT NULL
            """,
            (snapshot.actor.id, profile_id, tz_name, window_start, window_end),
        ).fetchone()
        total_concepts_exposed = (
            0 if total_exposed_row is None else int(cast(int, total_exposed_row[0]))
        )

        review_rows = cursor.execute(
            """
            SELECT (event.reviewed_at AT TIME ZONE %s)::date AS local_date,
                   COUNT(*)::integer AS reviewed_count,
                   COUNT(*) FILTER (
                       WHERE event.correct IS TRUE AND event.rating IN ('good', 'easy')
                   )::integer AS successful_count,
                   COUNT(DISTINCT item.concept_id) FILTER (
                       WHERE event.correct IS TRUE AND event.rating IN ('good', 'easy')
                   )::integer AS strengthened_concepts
            FROM review_events AS event
            JOIN review_items AS item
              ON item.id = event.review_item_id AND item.user_id = event.user_id
            WHERE event.user_id = %s
              AND item.user_language_id = %s
              AND (event.reviewed_at AT TIME ZONE %s)::date BETWEEN %s AND %s
            GROUP BY local_date
            """,
            (tz_name, snapshot.actor.id, profile_id, tz_name, window_start, window_end),
        ).fetchall()
        reviews_by_date: dict[date, DailyReviewAggregate] = {}
        strengthened_by_date: dict[date, int] = {}
        for row in review_rows:
            rev_day = _date(row[0])
            reviewed_count = int(cast(int, row[1]))
            successful_count = int(cast(int, row[2]))
            strengthened_count = int(cast(int, row[3]))
            reviews_by_date[rev_day] = DailyReviewAggregate(
                review_date=rev_day,
                reviewed_count=reviewed_count,
                successful_count=successful_count,
                strengthened_concepts_count=strengthened_count,
            )
            strengthened_by_date[rev_day] = strengthened_count

        total_strengthened_row = cursor.execute(
            """
            SELECT COUNT(DISTINCT item.concept_id)::integer
            FROM review_events AS event
            JOIN review_items AS item
              ON item.id = event.review_item_id AND item.user_id = event.user_id
            WHERE event.user_id = %s
              AND item.user_language_id = %s
              AND event.correct IS TRUE
              AND event.rating IN ('good', 'easy')
              AND (event.reviewed_at AT TIME ZONE %s)::date BETWEEN %s AND %s
            """,
            (snapshot.actor.id, profile_id, tz_name, window_start, window_end),
        ).fetchone()
        total_concepts_strengthened = (
            0 if total_strengthened_row is None else int(cast(int, total_strengthened_row[0]))
        )

        daily_activity = compute_daily_activity(
            days=days,
            default_daily_minutes=daily_minutes,
            plans_by_date=plans_by_date,
            exposed_by_date=exposed_by_date,
            strengthened_by_date=strengthened_by_date,
        )
        retention_trend = compute_retention_trend(
            days=days,
            reviews_by_date=reviews_by_date,
            fallback_memory_health=memory_health,
        )
        total_minutes = sum(day.minutes for day in daily_activity)
        successful_days = sum(1 for day in daily_activity if day.goal_met)

        return ProgressOverviewProjection(
            language_profile_id=profile_id,
            window_start=window_start,
            window_end=window_end,
            starting_level_estimate=starting_level_estimate,
            memory_health=memory_health,
            competence=competence,
            successful_learning_days=successful_days,
            target_learning_days=len(days),
            concepts_exposed=total_concepts_exposed,
            concepts_strengthened=total_concepts_strengthened,
            total_minutes=total_minutes,
            daily_activity=daily_activity,
            retention_trend=retention_trend,
            calculated_at=snapshot.as_of,
        )


def _load_retrievability(
    cursor: Cursor[tuple[object, ...]],
    *,
    user_id: UUID,
    profile_id: UUID,
) -> float:
    retrievability_rows = cursor.execute(
        """
        SELECT current_retrievability
        FROM v_learner_concept_retrievability
        WHERE user_id = %s
          AND user_language_id = %s
          AND current_retrievability IS NOT NULL
        """,
        (user_id, profile_id),
    ).fetchall()
    return compute_memory_health(
        tuple(_float(row[0]) for row in retrievability_rows if row[0] is not None)
    )


def _load_skill_competence(
    cursor: Cursor[tuple[object, ...]],
    *,
    user_id: UUID,
    profile_id: UUID,
) -> CompetenceProjection:
    rows = cursor.execute(
        """
        SELECT skill, score, confidence, evidence_count, last_evidence_at
        FROM user_skill_states
        WHERE user_id = %s AND user_language_id = %s
          AND competence_parameter_set_id IS NOT NULL
        """,
        (user_id, profile_id),
    ).fetchall()
    zero = CompetenceProjection.zero()
    scores = {
        "recognition": zero.recognition,
        "listening": zero.listening,
        "production": zero.production,
    }
    for skill, score, confidence, count, updated_at in rows:
        if str(skill) not in scores:
            raise ProgressProjectionUnavailable("invalid skill projection")
        scores[str(skill)] = CompetenceScoreProjection(
            score=_float(score),
            confidence=_float(confidence),
            evidence_count=int(cast(int, count)),
            updated_at=_optional_datetime(updated_at),
        )
    return CompetenceProjection(
        recognition=scores["recognition"],
        listening=scores["listening"],
        production=scores["production"],
    )


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _date(value: object) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise ProgressProjectionUnavailable("projection timestamp has an unexpected type")
    if value.tzinfo is None:
        raise ProgressProjectionUnavailable("projection timestamp must be timezone-aware")
    return value.astimezone(UTC)


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)


def _float(value: object) -> float:
    if not isinstance(value, int | float | Decimal):
        raise ProgressProjectionUnavailable("projection numeric value has an unexpected type")
    return float(value)
