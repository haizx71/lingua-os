"""Application orchestration for the five frozen Profile operations."""

from __future__ import annotations

from uuid import UUID

from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.profile.domain import (
    CreateLanguageProfile,
    CreateLanguageProfileResult,
    LanguageProfileProjection,
    LearnerProfileProjection,
    LearningGoal,
    ProfileValidationError,
    language_profile_etag,
    learner_profile_etag,
    validate_time_zone,
)
from lingua_api.profile.store import PostgresProfileStore


class ProfileApplication:
    def __init__(self, database_url: str) -> None:
        self._store = PostgresProfileStore(database_url)

    def bootstrap_me(self, actor: AuthenticatedActor) -> tuple[LearnerProfileProjection, str]:
        profile = self._store.bootstrap(actor)
        return profile, learner_profile_etag(profile.user_id, profile.revision)

    def update_me(
        self,
        actor: AuthenticatedActor,
        *,
        if_match: str | None,
        changes: dict[str, object],
    ) -> tuple[LearnerProfileProjection, str]:
        if not changes:
            raise ProfileValidationError("at least one learner profile field is required")
        self._validate_me_changes(changes)
        profile = self._store.update_me(actor, if_match=if_match, changes=changes)
        return profile, learner_profile_etag(profile.user_id, profile.revision)

    def list_languages(self, actor: AuthenticatedActor) -> tuple[LanguageProfileProjection, ...]:
        return self._store.list_languages(actor)

    def create_language(
        self,
        actor: AuthenticatedActor,
        *,
        idempotency_key: UUID,
        command: CreateLanguageProfile,
    ) -> CreateLanguageProfileResult:
        if command.target_language_code != "en" or command.native_language_code != "vi":
            raise ProfileValidationError("only the activated Vietnamese-to-English pair is valid")
        try:
            LearningGoal(command.goal)
        except ValueError as error:
            raise ProfileValidationError("the learning goal is invalid") from error
        if not 5 <= command.daily_minutes <= 180:
            raise ProfileValidationError("dailyMinutes must be between 5 and 180")
        return self._store.create_language(actor, idempotency_key=idempotency_key, command=command)

    def update_language(
        self,
        actor: AuthenticatedActor,
        *,
        profile_id: UUID,
        if_match: str | None,
        changes: dict[str, object],
    ) -> tuple[LanguageProfileProjection, str]:
        if not changes:
            raise ProfileValidationError("at least one Language Profile field is required")
        if "goal" in changes:
            try:
                LearningGoal(str(changes["goal"]))
            except ValueError as error:
                raise ProfileValidationError("the learning goal is invalid") from error
        profile = self._store.update_language(
            actor, profile_id=profile_id, if_match=if_match, changes=changes
        )
        return profile, language_profile_etag(profile.id, profile.revision)

    @staticmethod
    def _validate_me_changes(changes: dict[str, object]) -> None:
        if "display_name" in changes:
            display_name = changes["display_name"]
            if display_name is not None and (
                not isinstance(display_name, str)
                or not display_name.strip()
                or len(display_name) > 120
            ):
                raise ProfileValidationError("displayName is invalid")
        if "interface_language_code" in changes and changes["interface_language_code"] != "vi":
            raise ProfileValidationError("only the Vietnamese MVP interface is activated")
        if "time_zone" in changes:
            time_zone = changes["time_zone"]
            if not isinstance(time_zone, str):
                raise ProfileValidationError("timeZone is invalid")
            validate_time_zone(time_zone)
