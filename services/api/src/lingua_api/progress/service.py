"""Application orchestration for read-only Progress Overview v1 snapshots."""

from __future__ import annotations

from uuid import UUID

from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.progress.domain import (
    ProgressOverviewProjection,
    ProgressWindow,
)
from lingua_api.progress.store import PostgresProgressStore


class ProgressApplication:
    def __init__(self, database_url: str) -> None:
        self._store = PostgresProgressStore(database_url)

    def get_overview(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None = None,
        window: ProgressWindow = ProgressWindow.WEEK,
    ) -> ProgressOverviewProjection:
        with self._store.snapshot(actor=actor) as snapshot:
            profile_id, time_zone, daily_minutes, estimate = self._store.resolve_profile(
                snapshot, language_profile_id
            )
            return self._store.load_overview(
                snapshot,
                profile_id=profile_id,
                time_zone=time_zone,
                daily_minutes=daily_minutes,
                starting_level_estimate=estimate,
                window=window,
            )
