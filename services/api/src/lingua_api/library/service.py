"""Library application service orchestrating cross-engine transactions."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from lingua_api.competence.service import CompetenceEngine
from lingua_api.library.cursor import LibraryCursor, LibraryCursorCodec
from lingua_api.library.domain import (
    InvalidLibraryCursor,
    LibraryItemProjection,
    LibraryItemsPage,
    SavedConceptItem,
    SavedContentItem,
    SavedSentenceItem,
    SaveMutationResult,
)
from lingua_api.library.store import PostgresLibraryStore
from lingua_api.memory.clock import Clock, SystemClock
from lingua_api.memory.domain import AuthenticatedActor, CreatedFrom
from lingua_api.memory.service import PostgresMemoryEngine


class LibraryApplication:
    def __init__(
        self,
        database_url: str,
        *,
        cursor_secret: bytes,
        clock: Clock | None = None,
    ) -> None:
        self._database_url = database_url
        self._clock = clock or SystemClock()
        self._store = PostgresLibraryStore(database_url)
        self._memory = PostgresMemoryEngine(database_url, clock=self._clock)
        self._competence = CompetenceEngine()
        self._cursor = LibraryCursorCodec(cursor_secret)

    def save_concept(
        self,
        *,
        actor: AuthenticatedActor,
        concept_id: UUID,
    ) -> SaveMutationResult:
        at = _utc(self._clock.now())
        with self._store.connect() as connection, connection.transaction():
            profile_id = self._store.resolve_active_profile(connection, actor=actor)
            saved_at, is_first_save, save_intent_id = self._store.save_concept(
                connection,
                actor=actor,
                profile_id=profile_id,
                concept_id=concept_id,
                at=at,
            )
            if is_first_save:
                self._competence.apply_concept_save(
                    connection,
                    actor=actor,
                    save_intent_id=save_intent_id,
                    user_language_id=profile_id,
                    concept_id=concept_id,
                    at=at,
                )
            self._memory.ensure_lineage_in_transaction(
                connection,
                actor=actor,
                user_language_id=profile_id,
                concept_id=concept_id,
                created_from=CreatedFrom.LEARNER_SAVED,
                activated_at=at,
            )
        return SaveMutationResult(
            id=concept_id,
            item_type="concept",
            is_saved=True,
            saved_at=saved_at,
        )

    def unsave_concept(
        self,
        *,
        actor: AuthenticatedActor,
        concept_id: UUID,
    ) -> SaveMutationResult:
        with self._store.connect() as connection, connection.transaction():
            self._store.resolve_active_profile(connection, actor=actor)
            self._store.unsave_concept(connection, actor=actor, concept_id=concept_id)
        return SaveMutationResult(
            id=concept_id,
            item_type="concept",
            is_saved=False,
            saved_at=None,
        )

    def save_content(
        self,
        *,
        actor: AuthenticatedActor,
        content_id: UUID,
    ) -> SaveMutationResult:
        at = _utc(self._clock.now())
        with self._store.connect() as connection, connection.transaction():
            profile_id = self._store.resolve_active_profile(connection, actor=actor)
            saved_at = self._store.save_content(
                connection,
                actor=actor,
                profile_id=profile_id,
                content_id=content_id,
                at=at,
            )
        return SaveMutationResult(
            id=content_id,
            item_type="content",
            is_saved=True,
            saved_at=saved_at,
        )

    def unsave_content(
        self,
        *,
        actor: AuthenticatedActor,
        content_id: UUID,
    ) -> SaveMutationResult:
        with self._store.connect() as connection, connection.transaction():
            self._store.resolve_active_profile(connection, actor=actor)
            self._store.unsave_content(connection, actor=actor, content_id=content_id)
        return SaveMutationResult(
            id=content_id,
            item_type="content",
            is_saved=False,
            saved_at=None,
        )

    def save_sentence(
        self,
        *,
        actor: AuthenticatedActor,
        sentence_id: UUID,
    ) -> SaveMutationResult:
        at = _utc(self._clock.now())
        with self._store.connect() as connection, connection.transaction():
            profile_id = self._store.resolve_active_profile(connection, actor=actor)
            saved_at = self._store.save_sentence(
                connection,
                actor=actor,
                profile_id=profile_id,
                sentence_id=sentence_id,
                at=at,
            )
        return SaveMutationResult(
            id=sentence_id,
            item_type="sentence",
            is_saved=True,
            saved_at=saved_at,
        )

    def unsave_sentence(
        self,
        *,
        actor: AuthenticatedActor,
        sentence_id: UUID,
    ) -> SaveMutationResult:
        with self._store.connect() as connection, connection.transaction():
            self._store.resolve_active_profile(connection, actor=actor)
            self._store.unsave_sentence(connection, actor=actor, sentence_id=sentence_id)
        return SaveMutationResult(
            id=sentence_id,
            item_type="sentence",
            is_saved=False,
            saved_at=None,
        )

    def list_items(
        self,
        *,
        actor: AuthenticatedActor,
        item_type: str | None,
        query: str | None,
        cursor: str | None,
        limit: int,
    ) -> LibraryItemsPage:
        at = _utc(self._clock.now())
        after_saved_at: datetime | None = None
        after_item_id: UUID | None = None

        with self._store.connect() as connection:
            profile_id = self._store.resolve_active_profile(connection, actor=actor)
            if cursor is not None:
                decoded = self._cursor.decode(cursor)
                if decoded.actor_id != actor.id:
                    raise InvalidLibraryCursor("cursor does not belong to the authenticated actor")
                if decoded.language_profile_id != profile_id:
                    raise InvalidLibraryCursor(
                        "cursor does not belong to the active language profile"
                    )
                if decoded.item_type != item_type:
                    raise InvalidLibraryCursor("cursor itemType does not match requested itemType")
                if decoded.query != query:
                    raise InvalidLibraryCursor("cursor query does not match requested query")
                after_saved_at = decoded.saved_at
                after_item_id = decoded.item_id

            items, has_more = self._store.list_saved_items(
                connection,
                actor=actor,
                profile_id=profile_id,
                item_type=item_type,
                query=query,
                after_saved_at=after_saved_at,
                after_item_id=after_item_id,
                limit=limit,
                now=at,
            )

        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            last_id = _item_id(last_item)
            next_cursor = self._cursor.encode(
                LibraryCursor(
                    actor_id=actor.id,
                    language_profile_id=profile_id,
                    saved_at=last_item.saved_at,
                    item_id=last_id,
                    item_type=item_type,
                    query=query,
                )
            )

        return LibraryItemsPage(
            items=items,
            next_cursor=next_cursor,
            has_more=has_more,
        )


def _item_id(item: LibraryItemProjection) -> UUID:
    if isinstance(item, SavedConceptItem):
        return item.concept_id
    if isinstance(item, SavedContentItem):
        return item.content_id
    if isinstance(item, SavedSentenceItem):
        return item.sentence_id
    raise TypeError(f"unexpected library item projection type: {type(item)}")


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError("clock must return a timezone-aware UTC datetime")
    return value.astimezone(UTC)
