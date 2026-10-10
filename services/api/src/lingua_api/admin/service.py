"""Owner-authorized application orchestration for first-party content."""

from __future__ import annotations

from uuid import UUID

from lingua_api.admin.domain import (
    AdminCatalogConceptProjection,
    AdminContentProjection,
    AdminContentValidationProjection,
)
from lingua_api.admin.store import PostgresAdminContentStore
from lingua_api.memory.clock import Clock, SystemClock


class AdminContentApplication:
    def __init__(self, database_url: str, *, clock: Clock | None = None) -> None:
        self._store = PostgresAdminContentStore(database_url)
        self._clock = clock or SystemClock()

    def list_content(self) -> tuple[AdminContentProjection, ...]:
        return self._store.list()

    def get_content(self, content_id: UUID) -> AdminContentProjection:
        return self._store.get(content_id)

    def search_concepts(
        self, query: str, *, limit: int
    ) -> tuple[AdminCatalogConceptProjection, ...]:
        return self._store.search_concepts(query, limit=limit)

    def create_content(self, values: dict[str, str]) -> AdminContentProjection:
        return self._store.create(values, now=self._clock.now())

    def update_content(self, content_id: UUID, updates: dict[str, str]) -> AdminContentProjection:
        return self._store.update(content_id, updates, now=self._clock.now())

    def put_vietnamese_translations(
        self,
        content_id: UUID,
        entries: list[tuple[int, str, str]],
        source: dict[str, str] | None,
    ) -> AdminContentProjection:
        return self._store.put_vietnamese_translations(
            content_id, entries, source, now=self._clock.now()
        )

    def validate_content(self, content_id: UUID) -> AdminContentValidationProjection:
        content, issues = self._store.validate(content_id, now=self._clock.now())
        return AdminContentValidationProjection(content, not issues, issues)

    def publish_content(self, content_id: UUID) -> AdminContentProjection:
        return self._store.publish(content_id, now=self._clock.now())

    def retire_content(self, content_id: UUID) -> AdminContentProjection:
        return self._store.retire(content_id, now=self._clock.now())

    def put_sentence_concept(
        self,
        content_id: UUID,
        sentence_id: UUID,
        concept_id: UUID,
        *,
        start_offset: int,
        end_offset: int,
        occurrence_role: str,
    ) -> AdminContentProjection:
        return self._store.put_sentence_concept(
            content_id,
            sentence_id,
            concept_id,
            start_offset=start_offset,
            end_offset=end_offset,
            occurrence_role=occurrence_role,
            now=self._clock.now(),
        )

    def delete_sentence_concept(
        self,
        content_id: UUID,
        sentence_id: UUID,
        concept_id: UUID,
        *,
        start_offset: int,
        end_offset: int,
    ) -> AdminContentProjection:
        return self._store.delete_sentence_concept(
            content_id,
            sentence_id,
            concept_id,
            start_offset=start_offset,
            end_offset=end_offset,
            now=self._clock.now(),
        )
