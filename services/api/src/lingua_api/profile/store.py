"""Actor-scoped PostgreSQL persistence for Profile lifecycle."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection, errors
from psycopg.types.json import Jsonb

from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.profile.domain import (
    CreateLanguageProfile,
    CreateLanguageProfileResult,
    LanguageProfileProjection,
    LearnerProfileProjection,
    ProficiencyLevel,
    ProfileConflict,
    ProfileForbidden,
    ProfileIdempotencyConflict,
    ProfileInvalidState,
    ProfileNotFound,
    ProfileValidationError,
    StartingLevelEstimate,
    create_fingerprint,
    language_profile_etag,
    learner_profile_etag,
    require_if_match,
    validate_status_transition,
    validate_time_zone,
)


class PostgresProfileStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    def bootstrap(self, actor: AuthenticatedActor) -> LearnerProfileProjection:
        with self.connect() as connection, connection.transaction():
            auth_exists = connection.execute(
                "SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = %s)", (actor.id,)
            ).fetchone()
            if auth_exists != (True,):
                raise ProfileForbidden("the verified auth identity no longer exists")
            connection.execute(
                "INSERT INTO users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING",
                (actor.id,),
            )
            lifecycle = connection.execute(
                "SELECT deleted_at FROM users WHERE id = %s FOR UPDATE", (actor.id,)
            ).fetchone()
            if lifecycle is None or lifecycle[0] is not None:
                raise ProfileForbidden("the application identity cannot be bootstrapped")
            connection.execute(
                """
                INSERT INTO learner_profiles
                    (user_id, display_name, interface_language_code, time_zone, revision)
                VALUES (%s, NULL, 'vi', NULL, 1)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (actor.id,),
            )
            return self._load_me(connection, actor.id)

    def get_me(self, actor: AuthenticatedActor) -> LearnerProfileProjection:
        with self.connect() as connection:
            return self._load_me(connection, actor.id)

    def update_me(
        self,
        actor: AuthenticatedActor,
        *,
        if_match: str | None,
        changes: dict[str, object],
    ) -> LearnerProfileProjection:
        with self.connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT profile.display_name, profile.interface_language_code,
                       profile.time_zone, profile.revision
                FROM learner_profiles AS profile
                JOIN users AS app_user ON app_user.id = profile.user_id
                WHERE profile.user_id = %s AND app_user.deleted_at IS NULL
                FOR UPDATE OF profile
                """,
                (actor.id,),
            ).fetchone()
            if row is None:
                raise ProfileNotFound("the application profile was not found")
            require_if_match(if_match, learner_profile_etag(actor.id, int(cast(int, row[3]))))

            display_name = cast(str | None, row[0])
            interface_language = str(row[1])
            time_zone = cast(str | None, row[2])
            if "display_name" in changes:
                display_name = cast(str | None, changes["display_name"])
            if "interface_language_code" in changes:
                interface_language = str(changes["interface_language_code"])
            if "time_zone" in changes:
                time_zone = str(changes["time_zone"])

            if (display_name, interface_language, time_zone) != (row[0], str(row[1]), row[2]):
                connection.execute(
                    """
                    UPDATE learner_profiles
                    SET display_name = %s, interface_language_code = %s, time_zone = %s,
                        revision = revision + 1, updated_at = now()
                    WHERE user_id = %s
                    """,
                    (display_name, interface_language, time_zone, actor.id),
                )
            return self._load_me(connection, actor.id)

    def list_languages(self, actor: AuthenticatedActor) -> tuple[LanguageProfileProjection, ...]:
        with self.connect() as connection:
            exists = connection.execute(
                """
                SELECT 1 FROM learner_profiles AS profile
                JOIN users AS app_user ON app_user.id = profile.user_id
                WHERE profile.user_id = %s AND app_user.deleted_at IS NULL
                """,
                (actor.id,),
            ).fetchone()
            if exists is None:
                raise ProfileNotFound("the application profile was not found")
            return self._load_languages(connection, actor.id)

    def create_language(
        self,
        actor: AuthenticatedActor,
        *,
        idempotency_key: UUID,
        command: CreateLanguageProfile,
    ) -> CreateLanguageProfileResult:
        fingerprint = create_fingerprint(command)
        try:
            with self.connect() as connection, connection.transaction():
                connection.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    (f"profile-create:{actor.id}:{idempotency_key}",),
                )
                replay = connection.execute(
                    """
                    SELECT request_fingerprint, result_data_snapshot, result_etag
                    FROM profile_mutation_results
                    WHERE user_id = %s AND idempotency_key = %s
                    """,
                    (actor.id, idempotency_key),
                ).fetchone()
                if replay is not None:
                    if str(replay[0]) != fingerprint:
                        raise ProfileIdempotencyConflict(
                            "the idempotency key belongs to another Profile command"
                        )
                    snapshot = cast(dict[str, object], replay[1])
                    return CreateLanguageProfileResult(
                        _profile_from_snapshot(snapshot), str(replay[2]), True
                    )

                learner = connection.execute(
                    """
                    SELECT profile.time_zone
                    FROM learner_profiles AS profile
                    JOIN users AS app_user ON app_user.id = profile.user_id
                    WHERE profile.user_id = %s AND app_user.deleted_at IS NULL
                    FOR UPDATE OF profile
                    """,
                    (actor.id,),
                ).fetchone()
                if learner is None:
                    raise ProfileNotFound("the application profile was not found")
                if learner[0] is None:
                    raise ProfileInvalidState("a timezone is required before language creation")
                try:
                    validate_time_zone(str(learner[0]))
                except ProfileValidationError as error:
                    raise ProfileInvalidState("the learner timezone is not ready") from error

                if (
                    connection.execute(
                        "SELECT 1 FROM user_languages WHERE user_id = %s AND language_code = %s",
                        (actor.id, command.target_language_code),
                    ).fetchone()
                    is not None
                ):
                    raise ProfileConflict("the lifetime target-language profile already exists")

                current_level = self._resolve_level(connection, command.self_estimated_level_code)
                target_level = self._resolve_level(connection, command.target_level_code)
                inserted = connection.execute(
                    """
                    INSERT INTO user_languages
                        (user_id, language_code, interface_language_code,
                         native_language_code, goal, current_level_id, target_level_id,
                         daily_minutes, status, revision)
                    VALUES (%s, %s, NULL, %s, %s, %s, %s, %s, 'active', 1)
                    RETURNING id
                    """,
                    (
                        actor.id,
                        command.target_language_code,
                        command.native_language_code,
                        command.goal,
                        None if current_level is None else current_level.id,
                        None if target_level is None else target_level.id,
                        command.daily_minutes,
                    ),
                ).fetchone()
                assert inserted is not None
                profile_id = _uuid(inserted[0])
                connection.execute(
                    """
                    UPDATE learner_profiles
                    SET revision = revision + 1, updated_at = now()
                    WHERE user_id = %s
                    """,
                    (actor.id,),
                )
                profile = self._load_language(connection, actor.id, profile_id)
                etag = language_profile_etag(profile.id, profile.revision)
                connection.execute(
                    """
                    INSERT INTO profile_mutation_results
                        (user_id, idempotency_key, operation_type, schema_version,
                         request_fingerprint, language_profile_id, http_status,
                         result_data_snapshot, result_etag, completed_at)
                    VALUES (%s, %s, 'create-language-profile-v1', 1, %s, %s, 201,
                            %s, %s, now())
                    """,
                    (
                        actor.id,
                        idempotency_key,
                        fingerprint,
                        profile.id,
                        Jsonb(_profile_snapshot(profile)),
                        etag,
                    ),
                )
                return CreateLanguageProfileResult(profile, etag, False)
        except errors.UniqueViolation as error:
            raise ProfileConflict("the lifetime target-language profile already exists") from error

    def update_language(
        self,
        actor: AuthenticatedActor,
        *,
        profile_id: UUID,
        if_match: str | None,
        changes: dict[str, object],
    ) -> LanguageProfileProjection:
        with self.connect() as connection, connection.transaction():
            row = connection.execute(
                """
                SELECT language.goal, language.daily_minutes, language.target_level_id,
                       language.status, language.revision
                FROM user_languages AS language
                JOIN learner_profiles AS learner ON learner.user_id = language.user_id
                JOIN users AS app_user ON app_user.id = language.user_id
                WHERE language.id = %s AND language.user_id = %s
                  AND app_user.deleted_at IS NULL
                FOR UPDATE OF language
                """,
                (profile_id, actor.id),
            ).fetchone()
            if row is None:
                raise ProfileNotFound("the owned Language Profile was not found")
            require_if_match(if_match, language_profile_etag(profile_id, int(cast(int, row[4]))))

            goal = str(row[0])
            daily_minutes = int(cast(int, row[1]))
            target_level_id = None if row[2] is None else _uuid(row[2])
            status = str(row[3])
            if "goal" in changes:
                goal = str(changes["goal"])
            if "daily_minutes" in changes:
                daily_minutes = int(cast(int, changes["daily_minutes"]))
            if "target_level_code" in changes:
                requested_level = cast(str | None, changes["target_level_code"])
                level = self._resolve_level(connection, requested_level)
                target_level_id = None if level is None else level.id
            if "status" in changes:
                requested_status = str(changes["status"])
                validate_status_transition(status, requested_status)
                status = requested_status

            if (goal, daily_minutes, target_level_id, status) != (
                str(row[0]),
                int(cast(int, row[1])),
                None if row[2] is None else _uuid(row[2]),
                str(row[3]),
            ):
                connection.execute(
                    """
                    UPDATE user_languages
                    SET goal = %s, daily_minutes = %s, target_level_id = %s, status = %s,
                        revision = revision + 1, updated_at = now()
                    WHERE id = %s AND user_id = %s
                    """,
                    (goal, daily_minutes, target_level_id, status, profile_id, actor.id),
                )
                connection.execute(
                    """
                    UPDATE learner_profiles
                    SET revision = revision + 1, updated_at = now()
                    WHERE user_id = %s
                    """,
                    (actor.id,),
                )
            return self._load_language(connection, actor.id, profile_id)

    def _load_me(
        self, connection: Connection[tuple[object, ...]], actor_id: UUID
    ) -> LearnerProfileProjection:
        row = connection.execute(
            """
            SELECT profile.user_id, profile.display_name, profile.interface_language_code,
                   profile.time_zone, profile.created_at, profile.updated_at, profile.revision
            FROM learner_profiles AS profile
            JOIN users AS app_user ON app_user.id = profile.user_id
            WHERE profile.user_id = %s AND app_user.deleted_at IS NULL
            """,
            (actor_id,),
        ).fetchone()
        if row is None:
            raise ProfileNotFound("the application profile was not found")
        return LearnerProfileProjection(
            user_id=_uuid(row[0]),
            display_name=None if row[1] is None else str(row[1]),
            interface_language_code=str(row[2]),
            time_zone=None if row[3] is None else str(row[3]),
            language_profiles=self._load_languages(connection, actor_id),
            created_at=_datetime(row[4]),
            updated_at=_datetime(row[5]),
            revision=int(cast(int, row[6])),
        )

    def _load_languages(
        self, connection: Connection[tuple[object, ...]], actor_id: UUID
    ) -> tuple[LanguageProfileProjection, ...]:
        rows = connection.execute(
            _LANGUAGE_SELECT + " ORDER BY language.created_at, language.id LIMIT 20", (actor_id,)
        ).fetchall()
        return tuple(_language_profile(row) for row in rows)

    def _load_language(
        self, connection: Connection[tuple[object, ...]], actor_id: UUID, profile_id: UUID
    ) -> LanguageProfileProjection:
        row = connection.execute(
            _LANGUAGE_SELECT + " AND language.id = %s",
            (actor_id, profile_id),
        ).fetchone()
        if row is None:
            raise ProfileNotFound("the owned Language Profile was not found")
        return _language_profile(row)

    @staticmethod
    def _resolve_level(
        connection: Connection[tuple[object, ...]], code: str | None
    ) -> ProficiencyLevel | None:
        if code is None:
            return None
        row = connection.execute(
            """
            SELECT level.id, framework.code, level.code, level.label
            FROM proficiency_levels AS level
            JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            WHERE framework.code = 'CEFR' AND level.code = %s
              AND level.code IN ('A0', 'A1', 'A2', 'B1')
            """,
            (code,),
        ).fetchone()
        if row is None:
            raise ProfileValidationError("the requested CEFR level is not activated for the MVP")
        return ProficiencyLevel(_uuid(row[0]), str(row[1]), str(row[2]), str(row[3]))


_LANGUAGE_SELECT = """
    SELECT language.id, language.user_id, language.language_code,
           language.native_language_code, language.goal, language.daily_minutes,
           language.status, language.created_at, language.updated_at, language.revision,
           target.id, target_framework.code, target.code, target.label,
           estimate.level_id, estimate.framework_code, estimate.level_code,
           estimate.level_label, estimate.confidence, estimate.confidence_band,
           estimate.assessed_skills, estimate.evidence_count, estimate.method_version,
           estimate.estimated_at
    FROM user_languages AS language
    LEFT JOIN proficiency_levels AS target ON target.id = language.target_level_id
    LEFT JOIN proficiency_frameworks AS target_framework
      ON target_framework.id = target.framework_id
    LEFT JOIN LATERAL (
        SELECT estimated_level.id AS level_id, estimated_framework.code AS framework_code,
               estimated_level.code AS level_code, estimated_level.label AS level_label,
               result.confidence,
               result.framework_mapping ->> 'confidenceBand' AS confidence_band,
               result.assessed_skills, result.evidence_count, result.method_version,
               result.estimated_at
        FROM assessment_attempts AS attempt
        JOIN assessment_results AS result
          ON result.attempt_id = attempt.id AND result.user_id = attempt.user_id
        JOIN proficiency_levels AS estimated_level ON estimated_level.id = result.estimated_level_id
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
"""


def _language_profile(row: tuple[object, ...]) -> LanguageProfileProjection:
    target = (
        None
        if row[10] is None
        else ProficiencyLevel(_uuid(row[10]), str(row[11]), str(row[12]), str(row[13]))
    )
    estimate = (
        None
        if row[14] is None
        else StartingLevelEstimate(
            level=ProficiencyLevel(_uuid(row[14]), str(row[15]), str(row[16]), str(row[17])),
            confidence=_float(row[18]),
            confidence_band=str(row[19]),
            assessed_skills=tuple(str(item) for item in cast(list[object], row[20])),
            evidence_count=int(cast(int, row[21])),
            method_version=str(row[22]),
            estimated_at=_datetime(row[23]),
        )
    )
    return LanguageProfileProjection(
        id=_uuid(row[0]),
        user_id=_uuid(row[1]),
        target_language_code=str(row[2]),
        native_language_code=str(row[3]),
        goal=str(row[4]),
        daily_minutes=int(cast(int, row[5])),
        target_level=target,
        starting_level_estimate=estimate,
        status=str(row[6]),
        created_at=_datetime(row[7]),
        updated_at=_datetime(row[8]),
        revision=int(cast(int, row[9])),
    )


def _profile_snapshot(profile: LanguageProfileProjection) -> dict[str, object]:
    return {
        "id": str(profile.id),
        "userId": str(profile.user_id),
        "targetLanguageCode": profile.target_language_code,
        "nativeLanguageCode": profile.native_language_code,
        "goal": profile.goal,
        "dailyMinutes": profile.daily_minutes,
        "targetLevel": _level_snapshot(profile.target_level),
        "startingLevelEstimate": _estimate_snapshot(profile.starting_level_estimate),
        "status": profile.status,
        "createdAt": profile.created_at.isoformat(),
        "updatedAt": profile.updated_at.isoformat(),
        "revision": profile.revision,
    }


def _profile_from_snapshot(raw: dict[str, object]) -> LanguageProfileProjection:
    return LanguageProfileProjection(
        id=UUID(str(raw["id"])),
        user_id=UUID(str(raw["userId"])),
        target_language_code=str(raw["targetLanguageCode"]),
        native_language_code=str(raw["nativeLanguageCode"]),
        goal=str(raw["goal"]),
        daily_minutes=int(cast(int, raw["dailyMinutes"])),
        target_level=_level_from_snapshot(cast(dict[str, object] | None, raw["targetLevel"])),
        starting_level_estimate=_estimate_from_snapshot(
            cast(dict[str, object] | None, raw["startingLevelEstimate"])
        ),
        status=str(raw["status"]),
        created_at=datetime.fromisoformat(str(raw["createdAt"])),
        updated_at=datetime.fromisoformat(str(raw["updatedAt"])),
        revision=int(cast(int, raw["revision"])),
    )


def _level_snapshot(level: ProficiencyLevel | None) -> dict[str, object] | None:
    if level is None:
        return None
    return {
        "id": str(level.id),
        "frameworkCode": level.framework_code,
        "code": level.code,
        "label": level.label,
    }


def _level_from_snapshot(raw: dict[str, object] | None) -> ProficiencyLevel | None:
    if raw is None:
        return None
    return ProficiencyLevel(
        UUID(str(raw["id"])), str(raw["frameworkCode"]), str(raw["code"]), str(raw["label"])
    )


def _estimate_snapshot(value: StartingLevelEstimate | None) -> dict[str, object] | None:
    if value is None:
        return None
    return {
        "level": _level_snapshot(value.level),
        "confidence": value.confidence,
        "confidenceBand": value.confidence_band,
        "assessedSkills": list(value.assessed_skills),
        "evidenceCount": value.evidence_count,
        "methodVersion": value.method_version,
        "estimatedAt": value.estimated_at.isoformat(),
    }


def _estimate_from_snapshot(raw: dict[str, object] | None) -> StartingLevelEstimate | None:
    if raw is None:
        return None
    level = _level_from_snapshot(cast(dict[str, object], raw["level"]))
    assert level is not None
    return StartingLevelEstimate(
        level=level,
        confidence=float(cast(float | int, raw["confidence"])),
        confidence_band=str(raw["confidenceBand"]),
        assessed_skills=tuple(str(item) for item in cast(list[object], raw["assessedSkills"])),
        evidence_count=int(cast(int, raw["evidenceCount"])),
        method_version=str(raw["methodVersion"]),
        estimated_at=datetime.fromisoformat(str(raw["estimatedAt"])),
    )


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ProfileValidationError("Profile timestamps must be timezone-aware")
    return value.astimezone(UTC)


def _float(value: object) -> float:
    if not isinstance(value, Decimal | int | float):
        raise ProfileValidationError("Profile confidence has an unexpected database type")
    return float(value)
