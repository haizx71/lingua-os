"""Application orchestration for the three frozen Assessment operations."""

from __future__ import annotations

from uuid import UUID

from lingua_api.assessment.store import (
    AssessmentSessionData,
    PostgresAssessmentStore,
    StartResult,
)
from lingua_api.memory.domain import AuthenticatedActor


class AssessmentApplication:
    def __init__(self, database_url: str) -> None:
        self._store = PostgresAssessmentStore(database_url)

    def start_or_resume(
        self,
        actor: AuthenticatedActor,
        *,
        language_profile_id: UUID,
        idempotency_key: UUID,
    ) -> StartResult:
        return self._store.start_or_resume(
            actor,
            language_profile_id=language_profile_id,
            idempotency_key=idempotency_key,
        )

    def get_session(self, actor: AuthenticatedActor, *, attempt_id: UUID) -> AssessmentSessionData:
        return self._store.get_session(actor, attempt_id=attempt_id)

    def submit_response(
        self,
        actor: AuthenticatedActor,
        *,
        attempt_id: UUID,
        item_id: UUID,
        selected_option_id: UUID | None,
        skipped: bool,
        response_time_ms: int,
        idempotency_key: UUID,
    ) -> AssessmentSessionData:
        return self._store.submit_response(
            actor,
            attempt_id=attempt_id,
            item_id=item_id,
            selected_option_id=selected_option_id,
            skipped=skipped,
            response_time_ms=response_time_ms,
            idempotency_key=idempotency_key,
        )
