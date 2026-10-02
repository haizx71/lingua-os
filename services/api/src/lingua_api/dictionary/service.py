"""Application orchestration for the read-only Dictionary API."""

from __future__ import annotations

import re
import unicodedata
from uuid import UUID

from lingua_api.brain.domain import BrainConceptDetailProjection
from lingua_api.brain.store import BrainNotFound
from lingua_api.dictionary.cursor import (
    DictionaryCursor,
    DictionaryCursorCodec,
    InvalidDictionaryCursor,
)
from lingua_api.dictionary.domain import (
    DictionaryNotFound,
    DictionaryPage,
    DictionaryValidationError,
)
from lingua_api.dictionary.store import PostgresDictionaryStore
from lingua_api.memory.domain import AuthenticatedActor


class DictionaryApplication:
    def __init__(self, database_url: str, *, cursor_secret: bytes) -> None:
        self._store = PostgresDictionaryStore(database_url)
        self._cursor = DictionaryCursorCodec(cursor_secret)

    def get_concept(
        self, *, actor: AuthenticatedActor, concept_id: UUID
    ) -> BrainConceptDetailProjection:
        try:
            with self._store.brain.snapshot(actor=actor) as snapshot:
                profile_id = self._store.brain.resolve_profile(snapshot, None)
                return self._store.brain.load_detail(
                    snapshot, profile_id=profile_id, concept_id=concept_id
                )
        except BrainNotFound as error:
            raise DictionaryNotFound("visible Dictionary concept was not found") from error

    def search(
        self,
        *,
        actor: AuthenticatedActor,
        query: str,
        language_code: str | None,
        cursor: str | None,
        limit: int,
        include_lemma_groups: bool = False,
    ) -> DictionaryPage:
        normalized_query = _normalize_query(query)
        requested_language = "en" if language_code is None else language_code
        if requested_language != "en":
            raise DictionaryNotFound("the requested language catalog is unavailable")
        try:
            with self._store.brain.snapshot(actor=actor) as snapshot:
                profile_id = self._store.brain.resolve_profile(snapshot, None)
                boundary = None if cursor is None else self._cursor.decode(cursor)
                if boundary is not None and (
                    boundary.actor_id != actor.id
                    or boundary.language_profile_id != profile_id
                    or boundary.language_code != requested_language
                    or boundary.query != normalized_query
                ):
                    raise InvalidDictionaryCursor("dictionary cursor scope does not match request")
                rows = self._store.search(
                    snapshot,
                    profile_id=profile_id,
                    language_code=requested_language,
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
                        DictionaryCursor(
                            actor_id=actor.id,
                            language_profile_id=profile_id,
                            language_code=requested_language,
                            query=normalized_query,
                            matched_normalized_form=last.matched_normalized_form,
                            concept_id=last.id,
                        )
                    )
                lemma_groups = None
                if include_lemma_groups and items:
                    lemma_groups = tuple(
                        self._store.load_lemma_groups(
                            snapshot,
                            profile_id=profile_id,
                            language_code=requested_language,
                            query=normalized_query,
                            concept_ids={item.id for item in items},
                        )
                    )
                elif include_lemma_groups:
                    lemma_groups = ()
                return DictionaryPage(tuple(items), next_cursor, has_more, lemma_groups)
        except BrainNotFound as error:
            raise DictionaryNotFound("active English profile was not found") from error


def _normalize_query(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        raise DictionaryValidationError("dictionary query must contain a searchable value")
    return normalized
