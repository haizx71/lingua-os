"""PostgreSQL authority adapter for deterministic Today generation and completion."""

from __future__ import annotations

import hashlib
import json
import math
from datetime import UTC, date, datetime, timedelta
from typing import Literal, cast
from uuid import UUID, uuid4

import psycopg
from psycopg import Connection
from psycopg.types.json import Jsonb

from lingua_api.content.store import PostgresContentStore
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.today.domain import (
    ContentCandidate,
    ReviewCandidate,
    TodayActivityProjection,
    TodayCompletionProjection,
    TodayDecision,
    TodayIdempotencyConflict,
    TodayInvalidState,
    TodayNotFound,
    TodayPlanProjection,
    TodayPlanUnavailable,
    TodayProfile,
)
from lingua_api.today.policy import TODAY_HEURISTIC_V1, TODAY_HEURISTIC_V2, TodayPolicy


class PostgresTodayStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._content = PostgresContentStore(database_url)

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @staticmethod
    def transaction_timestamp(connection: Connection[tuple[object, ...]]) -> datetime:
        row = connection.execute("SELECT transaction_timestamp()").fetchone()
        if row is None:
            raise TodayPlanUnavailable("database transaction timestamp is unavailable")
        return _datetime(row[0])

    @staticmethod
    def resolve_profile(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        requested_id: UUID | None,
    ) -> TodayProfile:
        parameters: tuple[object, ...]
        requested = ""
        if requested_id is None:
            parameters = (actor.id,)
        else:
            requested = "AND profile.id = %s"
            parameters = (actor.id, requested_id)
        row = connection.execute(
            f"""
            SELECT profile.id, learner.time_zone, profile.daily_minutes
            FROM user_languages AS profile
            JOIN learner_profiles AS learner ON learner.user_id = profile.user_id
            WHERE profile.user_id = %s AND profile.language_code = 'en'
              AND profile.status = 'active' {requested}
            ORDER BY profile.created_at, profile.id
            LIMIT 1
            """,
            parameters,
        ).fetchone()
        if row is None:
            raise TodayNotFound("active owned English profile was not found")
        return TodayProfile(
            _uuid(row[0]),
            None if row[1] is None else str(row[1]),
            int(cast(int, row[2])),
        )

    @staticmethod
    def expire_prior_plans(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        plan_date: date,
        time_zone: str,
        changed_at: datetime,
    ) -> None:
        connection.execute(
            """
            UPDATE today_plans
            SET status = 'expired', updated_at = %s
            WHERE user_id = %s AND user_language_id = %s AND status = 'active'
              AND (plan_date <> %s OR time_zone <> %s)
            """,
            (changed_at, actor.id, profile_id, plan_date, time_zone),
        )

    def load_plan(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        plan_date: date,
    ) -> TodayPlanProjection | None:
        plan_row = connection.execute(
            """
            SELECT id, user_language_id, plan_date, time_zone, daily_minutes, status,
                   engine_version, as_of, created_at, updated_at
            FROM today_plans
            WHERE user_id = %s AND user_language_id = %s AND plan_date = %s
            """,
            (actor.id, profile_id, plan_date),
        ).fetchone()
        if plan_row is None:
            return None
        plan_id = _uuid(plan_row[0])
        rows = connection.execute(
            """
            SELECT activity.id, activity.position, activity.activity_type,
                   activity.title_snapshot, activity.description_snapshot,
                   activity.estimated_minutes, activity.reason_codes,
                   activity.reason_text_snapshot, activity.status, activity.target_count,
                   activity.completed_count, activity.content_id, activity.concept_id,
                   activity.review_item_id, activity.completed_at, activity.created_at,
                   CASE WHEN activity.content_id IS NULL THEN true
                        ELSE reader_content_passes_publication_gate(activity.content_id)
                   END AS target_is_visible
            FROM today_plan_activities AS activity
            WHERE activity.plan_id = %s AND activity.user_id = %s
            ORDER BY activity.position, activity.id
            """,
            (plan_id, actor.id),
        ).fetchall()
        if any(not bool(row[16]) for row in rows):
            raise TodayPlanUnavailable("a persisted content target no longer passes publication")
        activities = tuple(_activity(row) for row in rows)
        completed_minutes = sum(
            item.estimated_minutes for item in activities if item.status == "completed"
        )
        return TodayPlanProjection(
            id=plan_id,
            language_profile_id=_uuid(plan_row[1]),
            plan_date=_date(plan_row[2]),
            time_zone=str(plan_row[3]),
            target_minutes=int(cast(int, plan_row[4])),
            completed_minutes=completed_minutes,
            status=str(plan_row[5]),
            engine_version=str(plan_row[6]),
            activities=activities,
            as_of=_datetime(plan_row[7]),
            created_at=_datetime(plan_row[8]),
            updated_at=_datetime(plan_row[9]),
        )

    @staticmethod
    def reconcile_counts(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        plan_id: UUID,
    ) -> None:
        connection.execute(
            """
            UPDATE today_plan_activities AS activity
            SET completed_count = CASE activity.activity_type
                    WHEN 'review' THEN (
                        SELECT count(*)::integer
                        FROM today_activity_review_items AS target
                        WHERE target.activity_id = activity.id
                          AND EXISTS (
                              SELECT 1 FROM review_events AS event
                              WHERE event.user_id = activity.user_id
                                AND event.review_item_id = target.review_item_id
                                AND event.reviewed_at >= plan.as_of
                          )
                    )
                    WHEN 'read' THEN CASE WHEN (
                        EXISTS (
                            SELECT 1 FROM exposure_events AS event
                            WHERE event.user_id = activity.user_id
                              AND event.content_id = activity.content_id
                              AND event.exposure_type = 'read'
                              AND event.occurred_at >= plan.as_of
                        ) OR EXISTS (
                            SELECT 1 FROM user_content_progress AS progress
                            WHERE progress.user_id = activity.user_id
                              AND progress.content_id = activity.content_id
                              AND progress.completed_at >= plan.as_of
                        )
                    ) THEN 1 ELSE 0 END
                    WHEN 'listen' THEN CASE WHEN EXISTS (
                        SELECT 1 FROM exposure_events AS event
                        WHERE event.user_id = activity.user_id
                          AND event.content_id = activity.content_id
                          AND event.exposure_type = 'listen'
                          AND event.occurred_at >= plan.as_of
                    ) THEN 1 ELSE 0 END
                    ELSE 0
                END,
                updated_at = GREATEST(activity.updated_at, plan.as_of)
            FROM today_plans AS plan
            WHERE plan.id = activity.plan_id AND plan.user_id = activity.user_id
              AND plan.id = %s AND plan.user_id = %s AND activity.status = 'pending'
            """,
            (plan_id, actor.id),
        )

    @staticmethod
    def list_review_candidates(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        as_of: datetime,
        limit: int,
    ) -> tuple[ReviewCandidate, ...]:
        rows = connection.execute(
            """
            SELECT item.id, item.concept_id, state.due_at
            FROM review_items AS item
            JOIN fsrs_states AS state
              ON state.review_item_id = item.id AND state.user_id = item.user_id
            WHERE item.user_id = %s AND item.user_language_id = %s
              AND item.language_code = 'en' AND item.status = 'active'
              AND state.due_at <= %s
            ORDER BY state.due_at, item.id
            LIMIT %s
            """,
            (actor.id, profile_id, as_of, limit),
        ).fetchall()
        return tuple(
            ReviewCandidate(_uuid(row[0]), _uuid(row[1]), _datetime(row[2])) for row in rows
        )

    def list_content_candidates(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        as_of: datetime,
        limit: int,
        policy: TodayPolicy = TODAY_HEURISTIC_V1,
    ) -> tuple[ContentCandidate, ...]:
        summaries = self._content.list_summaries(
            actor=actor,
            language_profile_id=profile_id,
            boundary=None,
            limit=limit,
            today_as_of=as_of if policy.version == TODAY_HEURISTIC_V2.version else None,
            connection=connection,
        )
        if not summaries:
            return ()
        content_ids = [item.id for item in summaries]
        effective_status = (
            "COALESCE(retrievability.effective_status, state.status)"
            if policy.version == TODAY_HEURISTIC_V2.version
            else "state.status"
        )
        due_remediation_filter = (
            "AND NOT due_check.is_due" if policy.version == TODAY_HEURISTIC_V2.version else ""
        )
        rows = connection.execute(
            f"""
            SELECT item.id,
                   count(DISTINCT linked.concept_id) FILTER (
                       WHERE COALESCE(state.status, 'unseen') = 'unseen'
                   )::integer AS unseen_count,
                   COALESCE(bool_or(
                       {effective_status} = 'forgotten'
                       {due_remediation_filter}
                   ), false) AS forgotten,
                   COALESCE(bool_or(
                       {effective_status} IN ('weak', 'forgotten')
                       {due_remediation_filter}
                       AND state.recognition_evidence_count > 0
                       AND state.recognition <= state.listening
                       AND state.recognition <= state.production
                   ), false) AS weak_recognition,
                   COALESCE(bool_or(
                       {effective_status} IN ('weak', 'forgotten')
                       {due_remediation_filter}
                       AND state.listening_evidence_count > 0
                       AND state.listening < state.recognition
                       AND state.listening <= state.production
                   ), false) AS weak_listening,
                   COALESCE(bool_or(
                       {effective_status} IN ('weak', 'forgotten')
                       {due_remediation_filter}
                       AND state.production_evidence_count < state.recognition_evidence_count
                       AND state.production_evidence_count < state.listening_evidence_count
                   ), false) AS low_production,
                   COALESCE(array_agg(DISTINCT linked.concept_id) FILTER (
                       WHERE {effective_status} IN ('weak', 'forgotten')
                         {due_remediation_filter}
                   ), ARRAY[]::uuid[]) AS reinforcement_ids,
                   EXISTS (
                       SELECT 1
                       FROM content_segments AS segment
                       WHERE segment.content_id = item.id
                         AND (
                             segment.audio_id IS NOT NULL
                             OR EXISTS (
                                 SELECT 1 FROM sentence_audio AS audio
                                 WHERE audio.sentence_id = segment.sentence_id
                             )
                         )
                   ) AS has_audio,
                   EXISTS (
                       SELECT 1
                       FROM content_concepts AS recent_link
                       JOIN reader_exposure_concepts AS derived
                         ON derived.user_id = %s AND derived.user_language_id = %s
                        AND derived.concept_id = recent_link.concept_id
                       JOIN exposure_events AS recent_event
                         ON recent_event.id = derived.exposure_event_id
                        AND recent_event.user_id = derived.user_id
                       WHERE recent_link.content_id = item.id
                         AND recent_event.occurred_at >= %s
                         AND recent_event.occurred_at <= %s
                   ) AS recently_exposed,
                   saved.saved_at,
                   CASE
                       WHEN bool_or(
                           {effective_status} = 'forgotten'
                           {due_remediation_filter}
                       ) THEN 'forgotten'
                       WHEN bool_or(
                           {effective_status} = 'weak'
                           {due_remediation_filter}
                       ) THEN 'weak'
                       ELSE NULL
                   END AS remediation_status
            FROM content_items AS item
            LEFT JOIN content_concepts AS linked ON linked.content_id = item.id
            LEFT JOIN user_concept_states AS state
              ON state.user_id = %s AND state.user_language_id = %s
             AND state.concept_id = linked.concept_id
            LEFT JOIN public.v_learner_concept_retrievability AS retrievability
              ON retrievability.user_id = state.user_id
             AND retrievability.user_language_id = state.user_language_id
             AND retrievability.concept_id = linked.concept_id
             AND retrievability.calculated_at = %s
            LEFT JOIN LATERAL (
                SELECT EXISTS (
                    SELECT 1
                    FROM review_items AS due_item
                    JOIN fsrs_states AS due_state
                      ON due_state.review_item_id = due_item.id
                     AND due_state.user_id = due_item.user_id
                    WHERE due_item.user_id = %s
                      AND due_item.user_language_id = %s
                      AND due_item.concept_id = linked.concept_id
                      AND due_item.language_code = 'en'
                      AND due_item.status = 'active'
                      AND due_state.due_at <= %s
                ) AS is_due
            ) AS due_check ON true
            LEFT JOIN user_saved_content AS saved
              ON saved.user_id = %s AND saved.user_language_id = %s
             AND saved.content_id = item.id
            WHERE item.id = ANY(%s)
            GROUP BY item.id, saved.saved_at
            """,
            (
                actor.id,
                profile_id,
                as_of - timedelta(hours=policy.recent_exposure_window_hours),
                as_of,
                actor.id,
                profile_id,
                as_of,
                actor.id,
                profile_id,
                as_of,
                actor.id,
                profile_id,
                content_ids,
            ),
        ).fetchall()
        enrichment = {_uuid(row[0]): row for row in rows}
        candidates: list[ContentCandidate] = []
        for source_rank, summary in enumerate(summaries):
            row = enrichment[summary.id]
            progress = summary.reading_progress
            remaining_estimate = summary.estimated_minutes
            if progress is not None and not progress.is_completed:
                remaining_estimate = max(
                    1,
                    math.ceil(summary.estimated_minutes * (100 - progress.progress_percent) / 100),
                )
            candidates.append(
                ContentCandidate(
                    content_id=summary.id,
                    title=summary.title,
                    estimated_minutes=remaining_estimate,
                    source_rank=source_rank,
                    unseen_concept_count=int(cast(int, row[1])),
                    is_unfinished=progress is not None and not progress.is_completed,
                    is_saved=summary.is_saved,
                    is_completed=progress is not None and progress.is_completed,
                    has_audio=bool(row[7]),
                    weak_recognition=bool(row[3]),
                    weak_listening=bool(row[4]),
                    low_production_evidence=bool(row[5]),
                    forgotten=bool(row[2]),
                    remediation_status=(
                        None if row[10] is None else cast(Literal["weak", "forgotten"], row[10])
                    )
                    if policy.version == TODAY_HEURISTIC_V2.version
                    else None,
                    recently_exposed=bool(row[8]),
                    last_opened_at=None if progress is None else progress.last_opened_at,
                    saved_at=_optional_datetime(row[9]),
                    reinforcement_concept_ids=tuple(
                        _uuid(value) for value in cast(list[object], row[6])
                    ),
                )
            )
        return tuple(candidates)

    @staticmethod
    def persist_decision(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile: TodayProfile,
        plan_date: date,
        as_of: datetime,
        decision: TodayDecision,
        review_candidate_count: int,
        content_candidate_count: int,
        policy: TodayPolicy = TODAY_HEURISTIC_V1,
    ) -> UUID:
        plan_id = uuid4()
        completed_at = as_of if decision.status == "completed" else None
        diagnostics = {
            "policyVersion": policy.version,
            "asOf": as_of.isoformat(),
            "reviewCandidateCount": review_candidate_count,
            "contentCandidateCount": content_candidate_count,
            "unusedMinutes": decision.unused_minutes,
            "goalRelevance": "NEUTRAL",
        }
        connection.execute(
            """
            INSERT INTO today_plans
                (id, user_id, user_language_id, language_code, plan_date, time_zone,
                 daily_minutes, new_concept_budget, engine_version, status, generated_at,
                 completed_at, created_at, updated_at, as_of, unused_minutes,
                 generation_diagnostics)
            VALUES (%s, %s, %s, 'en', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s)
            """,
            (
                plan_id,
                actor.id,
                profile.user_language_id,
                plan_date,
                profile.time_zone,
                profile.daily_minutes,
                policy.max_new_unseen_concepts,
                policy.version,
                decision.status,
                as_of,
                completed_at,
                as_of,
                as_of,
                as_of,
                decision.unused_minutes,
                Jsonb(diagnostics),
            ),
        )
        for position, activity in enumerate(decision.activities):
            activity_id = uuid4()
            first_review = activity.review_item_ids[0] if activity.review_item_ids else None
            connection.execute(
                """
                INSERT INTO today_plan_activities
                    (id, plan_id, user_id, language_code, activity_type, position,
                     estimated_minutes, reason_codes, concept_id, content_id, review_item_id,
                     status, created_at, updated_at, target_count, completed_count,
                     title_snapshot, description_snapshot, reason_text_snapshot,
                     selection_diagnostics)
                VALUES (%s, %s, %s, 'en', %s, %s, %s, %s, %s, %s, %s, 'pending',
                        %s, %s, %s, 0, %s, %s, %s, %s)
                """,
                (
                    activity_id,
                    plan_id,
                    actor.id,
                    activity.activity_type,
                    position,
                    activity.estimated_minutes,
                    list(activity.reason_codes),
                    activity.concept_id,
                    activity.content_id,
                    first_review,
                    as_of,
                    as_of,
                    activity.target_count,
                    activity.title,
                    activity.description,
                    activity.reason_text,
                    Jsonb(activity.diagnostics or {}),
                ),
            )
            if activity.review_item_ids:
                with connection.cursor() as cursor:
                    cursor.executemany(
                        """
                        INSERT INTO today_activity_review_items
                            (activity_id, user_id, language_code, review_item_id,
                             position, created_at)
                        VALUES (%s, %s, 'en', %s, %s, %s)
                        """,
                        [
                            (activity_id, actor.id, review_item_id, review_position, as_of)
                            for review_position, review_item_id in enumerate(
                                activity.review_item_ids
                            )
                        ],
                    )
        return plan_id

    def complete_activity(
        self,
        *,
        actor: AuthenticatedActor,
        plan_id: UUID,
        activity_id: UUID,
        idempotency_key: UUID,
        duration_seconds: int | None,
        completed_at: datetime,
    ) -> TodayCompletionProjection:
        fingerprint = _completion_fingerprint(actor.id, plan_id, activity_id, duration_seconds)
        with self.connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT activity.status, activity.idempotency_key,
                       activity.completion_request_fingerprint,
                       activity.completion_result_snapshot, activity.activity_type,
                       activity.target_count, activity.content_id, plan.user_language_id,
                       plan.plan_date, plan.as_of, plan.status,
                       CASE WHEN activity.content_id IS NULL THEN true
                            ELSE reader_content_passes_publication_gate(activity.content_id)
                       END
                FROM today_plan_activities AS activity
                JOIN today_plans AS plan
                  ON plan.id = activity.plan_id AND plan.user_id = activity.user_id
                WHERE activity.id = %s AND activity.plan_id = %s AND activity.user_id = %s
                FOR UPDATE OF activity, plan
                """,
                (activity_id, plan_id, actor.id),
            ).fetchone()
            if row is None:
                raise TodayNotFound("owned Today activity was not found")
            if not bool(row[11]):
                raise TodayPlanUnavailable("the content target no longer passes publication")
            if str(row[0]) == "completed":
                if str(row[1]) != str(idempotency_key) or str(row[2]) != fingerprint:
                    if str(row[1]) == str(idempotency_key):
                        raise TodayIdempotencyConflict(
                            "completion key was reused with another request"
                        )
                    raise TodayInvalidState("activity is already completed")
                snapshot = cast(dict[str, object], row[3])
                return _completion_from_snapshot(snapshot, replayed=True)
            if str(row[10]) != "active":
                raise TodayInvalidState("the Today plan is not active")
            if str(row[0]) != "pending":
                raise TodayInvalidState("activity is not pending")

            self.reconcile_counts(connection, actor=actor, plan_id=plan_id)
            proof = connection.execute(
                "SELECT completed_count FROM today_plan_activities WHERE id = %s",
                (activity_id,),
            ).fetchone()
            assert proof is not None
            if int(cast(int, proof[0])) < int(cast(int, row[5])):
                raise TodayInvalidState("authoritative activity proof is incomplete")

            connection.execute(
                """
                UPDATE today_plan_activities
                SET status = 'completed', completed_at = %s, updated_at = %s,
                    duration_seconds = %s, idempotency_key = %s,
                    completion_request_fingerprint = %s,
                    completion_result_snapshot = %s
                WHERE id = %s AND user_id = %s
                """,
                (
                    completed_at,
                    completed_at,
                    duration_seconds,
                    str(idempotency_key),
                    fingerprint,
                    Jsonb({"pendingSnapshot": True}),
                    activity_id,
                    actor.id,
                ),
            )
            remaining = connection.execute(
                """
                SELECT count(*) FROM today_plan_activities
                WHERE plan_id = %s AND status <> 'completed'
                """,
                (plan_id,),
            ).fetchone()
            assert remaining is not None
            if int(cast(int, remaining[0])) == 0:
                connection.execute(
                    """
                    UPDATE today_plans
                    SET status = 'completed', completed_at = %s, updated_at = %s
                    WHERE id = %s AND user_id = %s
                    """,
                    (completed_at, completed_at, plan_id, actor.id),
                )
            plan = self.load_plan(
                connection,
                actor=actor,
                profile_id=_uuid(row[7]),
                plan_date=_date(row[8]),
            )
            assert plan is not None
            activity = next(item for item in plan.activities if item.id == activity_id)
            result = TodayCompletionProjection(plan, activity, False)
            connection.execute(
                """
                UPDATE today_plan_activities
                SET completion_result_snapshot = %s
                WHERE id = %s AND user_id = %s
                """,
                (Jsonb(_completion_snapshot(result)), activity_id, actor.id),
            )
            return result


def _activity(row: tuple[object, ...]) -> TodayActivityProjection:
    return TodayActivityProjection(
        id=_uuid(row[0]),
        position=int(cast(int, row[1])),
        activity_type=str(row[2]),
        title=str(row[3]),
        description=str(row[4]),
        estimated_minutes=int(cast(int, row[5])),
        reason_codes=tuple(str(value) for value in cast(list[object], row[6])),
        reason_text=str(row[7]),
        status=str(row[8]),
        target_count=int(cast(int, row[9])),
        completed_count=int(cast(int, row[10])),
        content_id=_optional_uuid(row[11]),
        concept_id=_optional_uuid(row[12]),
        review_item_id=_optional_uuid(row[13]),
        completed_at=_optional_datetime(row[14]),
        created_at=_datetime(row[15]),
    )


def _completion_fingerprint(
    actor_id: UUID, plan_id: UUID, activity_id: UUID, duration_seconds: int | None
) -> str:
    body = json.dumps(
        {
            "actorId": str(actor_id),
            "planId": str(plan_id),
            "activityId": str(activity_id),
            "durationSeconds": duration_seconds,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()


def _completion_snapshot(result: TodayCompletionProjection) -> dict[str, object]:
    return {
        "plan": _plan_snapshot(result.plan),
        "activityId": str(result.activity.id),
    }


def _plan_snapshot(plan: TodayPlanProjection) -> dict[str, object]:
    return {
        "id": str(plan.id),
        "languageProfileId": str(plan.language_profile_id),
        "planDate": plan.plan_date.isoformat(),
        "timeZone": plan.time_zone,
        "targetMinutes": plan.target_minutes,
        "completedMinutes": plan.completed_minutes,
        "status": plan.status,
        "engineVersion": plan.engine_version,
        "asOf": plan.as_of.isoformat(),
        "createdAt": plan.created_at.isoformat(),
        "updatedAt": plan.updated_at.isoformat(),
        "activities": [_activity_snapshot(item) for item in plan.activities],
    }


def _activity_snapshot(activity: TodayActivityProjection) -> dict[str, object]:
    return {
        "id": str(activity.id),
        "position": activity.position,
        "activityType": activity.activity_type,
        "title": activity.title,
        "description": activity.description,
        "estimatedMinutes": activity.estimated_minutes,
        "reasonCodes": list(activity.reason_codes),
        "reasonText": activity.reason_text,
        "status": activity.status,
        "targetCount": activity.target_count,
        "completedCount": activity.completed_count,
        "contentId": None if activity.content_id is None else str(activity.content_id),
        "conceptId": None if activity.concept_id is None else str(activity.concept_id),
        "reviewItemId": (None if activity.review_item_id is None else str(activity.review_item_id)),
        "completedAt": (
            None if activity.completed_at is None else activity.completed_at.isoformat()
        ),
        "createdAt": activity.created_at.isoformat(),
    }


def _completion_from_snapshot(
    snapshot: dict[str, object], *, replayed: bool
) -> TodayCompletionProjection:
    raw_plan = cast(dict[str, object], snapshot["plan"])
    activities = tuple(
        _activity_from_snapshot(cast(dict[str, object], item))
        for item in cast(list[object], raw_plan["activities"])
    )
    plan = TodayPlanProjection(
        id=UUID(str(raw_plan["id"])),
        language_profile_id=UUID(str(raw_plan["languageProfileId"])),
        plan_date=date.fromisoformat(str(raw_plan["planDate"])),
        time_zone=str(raw_plan["timeZone"]),
        target_minutes=int(cast(int, raw_plan["targetMinutes"])),
        completed_minutes=int(cast(int, raw_plan["completedMinutes"])),
        status=str(raw_plan["status"]),
        engine_version=str(raw_plan["engineVersion"]),
        activities=activities,
        as_of=datetime.fromisoformat(str(raw_plan["asOf"])),
        created_at=datetime.fromisoformat(str(raw_plan["createdAt"])),
        updated_at=datetime.fromisoformat(str(raw_plan["updatedAt"])),
    )
    activity_id = UUID(str(snapshot["activityId"]))
    activity = next(item for item in activities if item.id == activity_id)
    return TodayCompletionProjection(plan, activity, replayed)


def _activity_from_snapshot(raw: dict[str, object]) -> TodayActivityProjection:
    return TodayActivityProjection(
        id=UUID(str(raw["id"])),
        position=int(cast(int, raw["position"])),
        activity_type=str(raw["activityType"]),
        title=str(raw["title"]),
        description=str(raw["description"]),
        estimated_minutes=int(cast(int, raw["estimatedMinutes"])),
        reason_codes=tuple(str(value) for value in cast(list[object], raw["reasonCodes"])),
        reason_text=str(raw["reasonText"]),
        status=str(raw["status"]),
        target_count=int(cast(int, raw["targetCount"])),
        completed_count=int(cast(int, raw["completedCount"])),
        content_id=_optional_uuid(raw["contentId"]),
        concept_id=_optional_uuid(raw["conceptId"]),
        review_item_id=_optional_uuid(raw["reviewItemId"]),
        completed_at=(
            None if raw["completedAt"] is None else datetime.fromisoformat(str(raw["completedAt"]))
        ),
        created_at=datetime.fromisoformat(str(raw["createdAt"])),
    )


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _optional_uuid(value: object) -> UUID | None:
    return None if value is None else _uuid(value)


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise TypeError("expected timezone-aware database timestamp")
    return value.astimezone(UTC)


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)


def _date(value: object) -> date:
    if not isinstance(value, date) or isinstance(value, datetime):
        raise TypeError("expected database date")
    return value
