"""Application orchestration for read-only Language Brain snapshots."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from uuid import UUID

from lingua_api.brain.cursor import BrainCursor, BrainCursorCodec, InvalidBrainCursor
from lingua_api.brain.domain import (
    BrainConceptDetailProjection,
    BrainConceptListItem,
    BrainSummaryProjection,
)
from lingua_api.brain.store import PostgresBrainStore
from lingua_api.competence.domain import ConceptStatus
from lingua_api.memory.domain import AuthenticatedActor


@dataclass(frozen=True)
class BrainConceptPage:
    items: tuple[BrainConceptListItem, ...]
    next_cursor: str | None
    has_more: bool


class BrainApplication:
    def __init__(self, database_url: str, *, cursor_secret: bytes) -> None:
        self._store = PostgresBrainStore(database_url)
        self._cursor = BrainCursorCodec(cursor_secret)

    def get_summary(
        self, *, actor: AuthenticatedActor, language_profile_id: UUID | None
    ) -> BrainSummaryProjection:
        with self._store.snapshot(actor=actor) as snapshot:
            profile_id = self._store.resolve_profile(snapshot, language_profile_id)
            return self._store.load_summary(snapshot, profile_id)

    def list_concepts(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None,
        status: ConceptStatus | None,
        query: str | None,
        cursor: str | None,
        limit: int,
    ) -> BrainConceptPage:
        normalized_query = _normalize_query(query)
        with self._store.snapshot(actor=actor) as snapshot:
            profile_id = self._store.resolve_profile(snapshot, language_profile_id)
            boundary = None if cursor is None else self._cursor.decode(cursor)
            if boundary is not None and (
                boundary.actor_id != actor.id
                or boundary.language_profile_id != profile_id
                or boundary.status != status
                or boundary.query != normalized_query
            ):
                raise InvalidBrainCursor("brain cursor scope does not match the request")
            rows = self._store.list_concepts(
                snapshot,
                profile_id=profile_id,
                status=status,
                query=normalized_query,
                boundary=boundary,
                limit=limit + 1,
            )
            has_more = len(rows) > limit
            items = rows[:limit]
            next_cursor = None
            if has_more:
                last = items[-1]
                next_cursor = self._cursor.encode(
                    BrainCursor(
                        actor_id=actor.id,
                        language_profile_id=profile_id,
                        status=status,
                        query=normalized_query,
                        canonical_key=last.identity.canonical_key,
                        concept_id=last.identity.id,
                    )
                )
            return BrainConceptPage(tuple(items), next_cursor, has_more)

    def get_concept(
        self, *, actor: AuthenticatedActor, concept_id: UUID
    ) -> BrainConceptDetailProjection:
        with self._store.snapshot(actor=actor) as snapshot:
            profile_id = self._store.resolve_profile(snapshot, None)
            return self._store.load_detail(snapshot, profile_id=profile_id, concept_id=concept_id)


def _normalize_query(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = unicodedata.normalize("NFKC", value).strip().casefold()
    if not normalized:
        raise InvalidBrainCursor("brain query must contain a searchable value")
    return normalized
