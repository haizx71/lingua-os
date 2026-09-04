"""Application orchestration for the two authoritative Today operations."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from psycopg import errors

from lingua_api.memory.clock import Clock, SystemClock
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.today.domain import (
    TodayCompletionProjection,
    TodayContext,
    TodayIdempotencyConflict,
    TodayInvalidState,
    TodayNotFound,
    TodayPlanProjection,
    TodayPlanUnavailable,
)
from lingua_api.today.policy import TODAY_HEURISTIC_V1, build_today_decision
from lingua_api.today.store import PostgresTodayStore


class TodayApplication:
    def __init__(self, database_url: str, *, clock: Clock | None = None) -> None:
        self._clock = clock or SystemClock()
        self._store = PostgresTodayStore(database_url)

    def get_plan(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None,
        requested_date: date | None,
    ) -> TodayPlanProjection:
        as_of = _utc(self._clock.now())
        profile_id: UUID | None = None
        effective_date: date | None = None
        try:
            with self._store.connect() as connection, connection.transaction():
                connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                profile = self._store.resolve_profile(
                    connection, actor=actor, requested_id=language_profile_id
                )
                profile_id = profile.user_language_id
                time_zone = profile.time_zone
                if time_zone is None:
                    raise TodayInvalidState("learner profile requires an IANA timezone")
                effective_date = _local_date(as_of, time_zone)
                target_date = requested_date or effective_date
                existing = self._store.load_plan(
                    connection,
                    actor=actor,
                    profile_id=profile.user_language_id,
                    plan_date=target_date,
                )
                if requested_date is not None and requested_date != effective_date:
                    if existing is None:
                        raise TodayNotFound("past or future Today dates are retrieval-only")
                    return existing
                if existing is not None:
                    self._store.expire_prior_plans(
                        connection,
                        actor=actor,
                        profile_id=profile.user_language_id,
                        plan_date=target_date,
                        time_zone=time_zone,
                        changed_at=as_of,
                    )
                    if existing.time_zone != time_zone or existing.status == "expired":
                        connection.execute(
                            """
                            UPDATE today_plans
                            SET time_zone = %s,
                                status = CASE WHEN status = 'expired' THEN 'active' ELSE status END,
                                updated_at = %s
                            WHERE id = %s AND user_id = %s
                            """,
                            (time_zone, as_of, existing.id, actor.id),
                        )
                    self._store.reconcile_counts(connection, actor=actor, plan_id=existing.id)
                    reconciled = self._store.load_plan(
                        connection,
                        actor=actor,
                        profile_id=profile.user_language_id,
                        plan_date=target_date,
                    )
                    assert reconciled is not None
                    return reconciled

                self._store.expire_prior_plans(
                    connection,
                    actor=actor,
                    profile_id=profile.user_language_id,
                    plan_date=target_date,
                    time_zone=time_zone,
                    changed_at=as_of,
                )
                review_limit = min(
                    profile.daily_minutes + 1,
                    TODAY_HEURISTIC_V1.review_candidate_limit_max,
                )
                reviews = self._store.list_review_candidates(
                    connection,
                    actor=actor,
                    profile_id=profile.user_language_id,
                    as_of=as_of,
                    limit=review_limit,
                )
                content = self._store.list_content_candidates(
                    connection,
                    actor=actor,
                    profile_id=profile.user_language_id,
                    as_of=as_of,
                    limit=TODAY_HEURISTIC_V1.content_candidate_limit,
                )
                decision = build_today_decision(
                    TodayContext(profile.daily_minutes, as_of), reviews, content
                )
                self._store.persist_decision(
                    connection,
                    actor=actor,
                    profile=profile,
                    plan_date=target_date,
                    as_of=as_of,
                    decision=decision,
                    review_candidate_count=len(reviews),
                    content_candidate_count=len(content),
                )
                generated = self._store.load_plan(
                    connection,
                    actor=actor,
                    profile_id=profile.user_language_id,
                    plan_date=target_date,
                )
                assert generated is not None
                return generated
        except errors.UniqueViolation as error:
            if error.diag.constraint_name != "today_plans_owned_profile_day_unique":
                raise
            if profile_id is None or effective_date is None:
                raise
            with self._store.connect() as winner_connection:
                winner = self._store.load_plan(
                    winner_connection,
                    actor=actor,
                    profile_id=profile_id,
                    plan_date=requested_date or effective_date,
                )
                if winner is None:
                    raise TodayPlanUnavailable(
                        "concurrent Today generation winner was not visible"
                    ) from error
                return winner

    def complete_activity(
        self,
        *,
        actor: AuthenticatedActor,
        plan_id: UUID,
        activity_id: UUID,
        idempotency_key: UUID,
        duration_seconds: int | None,
    ) -> TodayCompletionProjection:
        completed_at = _utc(self._clock.now())
        try:
            return self._store.complete_activity(
                actor=actor,
                plan_id=plan_id,
                activity_id=activity_id,
                idempotency_key=idempotency_key,
                duration_seconds=duration_seconds,
                completed_at=completed_at,
            )
        except errors.UniqueViolation as error:
            if error.diag.constraint_name == "today_plan_activities_user_id_idempotency_key_key":
                raise TodayIdempotencyConflict(
                    "completion key belongs to another Today activity"
                ) from error
            raise


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() != UTC.utcoffset(value):
        raise ValueError("clock must return a timezone-aware UTC datetime")
    return value


def _local_date(as_of: datetime, time_zone: str | None) -> date:
    if time_zone is None:
        raise TodayInvalidState("learner profile requires an IANA timezone")
    try:
        zone = ZoneInfo(time_zone)
    except ZoneInfoNotFoundError as error:
        raise TodayInvalidState("learner profile requires a valid IANA timezone") from error
    return as_of.astimezone(zone).date()
