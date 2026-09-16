"""Application orchestration for the read-only Progress v1 projection."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.progress.domain import ProgressOverviewProjection
from lingua_api.progress.store import PostgresProgressStore

ProgressWindow = Literal["week", "month"]


class ProgressApplication:
    def __init__(self, database_url: str) -> None:
        self._store = PostgresProgressStore(database_url)

    def get_overview(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None,
        window: ProgressWindow,
    ) -> ProgressOverviewProjection:
        window_days = 7 if window == "week" else 30
        return self._store.load(
            actor=actor,
            language_profile_id=language_profile_id,
            window_days=window_days,
        )
