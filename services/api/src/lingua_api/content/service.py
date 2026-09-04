"""Application orchestration for published Reader catalog queries."""

from __future__ import annotations

from uuid import UUID

from lingua_api.content.cursor import ContentCursor, ContentCursorCodec
from lingua_api.content.domain import (
    ContentDetailProjection,
    ContentNotFound,
    ContentPage,
    InvalidContentCursor,
)
from lingua_api.content.store import PostgresContentStore
from lingua_api.memory.domain import AuthenticatedActor


class ContentApplication:
    def __init__(self, database_url: str, *, cursor_secret: bytes) -> None:
        self._store = PostgresContentStore(database_url)
        self._cursor = ContentCursorCodec(cursor_secret)

    def list_recommended(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID | None,
        cursor: str | None,
        limit: int,
    ) -> ContentPage:
        boundary = self._cursor.decode(cursor) if cursor is not None else None
        requested_profile = language_profile_id
        if boundary is not None:
            if requested_profile is not None and requested_profile != boundary.language_profile_id:
                raise InvalidContentCursor("cursor does not belong to the requested profile")
            requested_profile = boundary.language_profile_id
        with self._store.connect() as connection:
            self._store.require_application_identity(connection, actor=actor)
            profile_id = self._store.resolve_profile(
                connection, actor=actor, requested_id=requested_profile
            )
        if profile_id is None:
            if requested_profile is not None:
                raise InvalidContentCursor("owned active English profile was not found")
            return ContentPage((), None, False)
        rows = self._store.list_summaries(
            actor=actor,
            language_profile_id=profile_id,
            boundary=boundary,
            limit=limit + 1,
        )
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = None
        if has_more:
            last = items[-1]
            next_cursor = self._cursor.encode(
                ContentCursor(
                    language_profile_id=profile_id,
                    distance=last.sort_distance,
                    known_ratio=last.sort_known_ratio,
                    difficulty=last.sort_difficulty,
                    content_id=last.id,
                )
            )
        return ContentPage(tuple(items), next_cursor, has_more)

    def get_content(
        self, *, actor: AuthenticatedActor, content_id: UUID
    ) -> ContentDetailProjection:
        with self._store.connect() as connection:
            self._store.require_application_identity(connection, actor=actor)
            profile_id = self._store.resolve_profile(connection, actor=actor, requested_id=None)
        if profile_id is None:
            raise ContentNotFound("active English profile is unavailable")
        return self._store.get_detail(
            actor=actor, language_profile_id=profile_id, content_id=content_id
        )
