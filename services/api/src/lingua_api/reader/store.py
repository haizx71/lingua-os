"""PostgreSQL persistence boundary for Reader commands."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection
from psycopg.types.json import Jsonb

from lingua_api.content.domain import ContentNotFound, ReadingProgressProjection
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.reader.domain import ExposureCommand, ReaderValidationError, SaveSentenceResult


class PostgresReaderStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @staticmethod
    def try_lock_idempotency(
        connection: Connection[tuple[object, ...]], *, actor: AuthenticatedActor, key: UUID
    ) -> bool:
        row = connection.execute(
            "SELECT pg_try_advisory_xact_lock(hashtextextended(%s, 0))",
            (f"reader-idempotency:{actor.id}:{key}",),
        ).fetchone()
        return row is not None and bool(row[0])

    @staticmethod
    def lock_progress_resource(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        content_id: UUID,
    ) -> None:
        connection.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
            (f"reader-progress:{actor.id}:{content_id}",),
        )

    @staticmethod
    def find_mutation(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        key: UUID,
    ) -> tuple[str, str, dict[str, object]] | None:
        row = connection.execute(
            """
            SELECT operation_type, request_fingerprint, result_snapshot
            FROM reader_mutation_results
            WHERE user_id = %s AND idempotency_key = %s
            """,
            (actor.id, key),
        ).fetchone()
        if row is None:
            return None
        return str(row[0]), str(row[1]), cast(dict[str, object], row[2])

    @staticmethod
    def store_mutation(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        key: UUID,
        operation_type: str,
        fingerprint: str,
        resource_id: UUID,
        snapshot: dict[str, object],
        completed_at: datetime,
    ) -> None:
        connection.execute(
            """
            INSERT INTO reader_mutation_results
                (user_id, idempotency_key, operation_type, request_fingerprint,
                 resource_id, result_snapshot, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                actor.id,
                key,
                operation_type,
                fingerprint,
                resource_id,
                Jsonb(snapshot),
                completed_at,
            ),
        )

    @staticmethod
    def resolve_profile(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        requested_id: UUID | None,
    ) -> UUID:
        if requested_id is None:
            row = connection.execute(
                """
                SELECT id FROM user_languages
                WHERE user_id = %s AND language_code = 'en' AND status = 'active'
                ORDER BY created_at, id LIMIT 1
                """,
                (actor.id,),
            ).fetchone()
        else:
            row = connection.execute(
                """
                SELECT id FROM user_languages
                WHERE user_id = %s AND id = %s AND language_code = 'en' AND status = 'active'
                """,
                (actor.id, requested_id),
            ).fetchone()
        if row is None:
            raise ReaderValidationError("owned active English profile is invalid")
        return _uuid(row[0])

    @staticmethod
    def save_sentence(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        sentence_id: UUID,
        at: datetime,
    ) -> SaveSentenceResult:
        row = connection.execute(
            """
            SELECT profile.id, sentence.language_code
            FROM user_languages AS profile
            JOIN sentences AS sentence ON sentence.id = %s
             AND sentence.language_code = profile.language_code
            JOIN content_segments AS segment ON segment.sentence_id = sentence.id
            JOIN content_items AS item ON item.id = segment.content_id
             AND item.language_code = segment.language_code
            WHERE profile.user_id = %s AND profile.language_code = 'en'
              AND profile.status = 'active'
              AND item.publication_status = 'published'
              AND reader_content_passes_publication_gate(item.id)
            ORDER BY profile.created_at, profile.id
            LIMIT 1
            FOR SHARE OF item, sentence
            """,
            (sentence_id, actor.id),
        ).fetchone()
        if row is None:
            raise ContentNotFound("published catalog sentence was not found")
        profile_id = _uuid(row[0])
        language_code = str(row[1])
        saved = connection.execute(
            """
            INSERT INTO user_saved_sentences
                (user_id, user_language_id, sentence_id, language_code, saved_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id, sentence_id) DO NOTHING
            RETURNING saved_at
            """,
            (actor.id, profile_id, sentence_id, language_code, at),
        ).fetchone()
        if saved is None:
            saved = connection.execute(
                """
                SELECT saved_at FROM user_saved_sentences
                WHERE user_id = %s AND sentence_id = %s
                """,
                (actor.id, sentence_id),
            ).fetchone()
        if saved is None:
            raise RuntimeError("sentence save did not persist")
        return SaveSentenceResult(sentence_id, True, _datetime(saved[0]))

    @staticmethod
    def resolve_progress_target(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID,
        content_id: UUID,
        segment_id: UUID,
    ) -> tuple[int, int, str]:
        row = connection.execute(
            """
            SELECT segment.order_index, metrics.sentence_count, item.language_code
            FROM user_languages AS profile
            JOIN content_items AS item ON item.id = %s
             AND item.language_code = profile.language_code
            JOIN content_metrics AS metrics ON metrics.content_id = item.id
            JOIN content_segments AS segment ON segment.id = %s
             AND segment.content_id = item.id AND segment.language_code = item.language_code
            WHERE profile.id = %s AND profile.user_id = %s
              AND profile.language_code = 'en' AND profile.status = 'active'
              AND item.publication_status = 'published'
              AND reader_content_passes_publication_gate(item.id)
            FOR SHARE OF item, segment
            """,
            (content_id, segment_id, language_profile_id, actor.id),
        ).fetchone()
        if row is None:
            raise ReaderValidationError("progress target is outside owned published content")
        return int(cast(int, row[0])), int(cast(int, row[1])), str(row[2])

    @staticmethod
    def write_progress(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID,
        content_id: UUID,
        current_segment_id: UUID,
        current_order: int,
        segment_count: int,
        language_code: str,
        is_completed: bool,
        at: datetime,
    ) -> ReadingProgressProjection:
        existing = connection.execute(
            """
            SELECT progress.current_segment_id, progress.furthest_segment_id,
                   furthest.order_index, progress.started_at, progress.completed_at
            FROM user_content_progress AS progress
            JOIN content_segments AS furthest ON furthest.id = progress.furthest_segment_id
            WHERE progress.user_id = %s AND progress.content_id = %s
            FOR UPDATE OF progress
            """,
            (actor.id, content_id),
        ).fetchone()
        started_at = at if existing is None else _datetime(existing[3])
        completed_at = None if existing is None else _optional_datetime(existing[4])
        if is_completed and completed_at is None:
            completed_at = at
        if existing is None or current_order > int(cast(int, existing[2])):
            furthest_segment_id = current_segment_id
            furthest_order = current_order
        else:
            furthest_segment_id = _uuid(existing[1])
            furthest_order = int(cast(int, existing[2]))
        connection.execute(
            """
            INSERT INTO user_content_progress
                (user_id, user_language_id, content_id, language_code,
                 current_segment_id, furthest_segment_id, started_at, last_opened_at,
                 completed_at, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, content_id) DO UPDATE
            SET current_segment_id = EXCLUDED.current_segment_id,
                furthest_segment_id = EXCLUDED.furthest_segment_id,
                last_opened_at = EXCLUDED.last_opened_at,
                completed_at = EXCLUDED.completed_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                actor.id,
                language_profile_id,
                content_id,
                language_code,
                current_segment_id,
                furthest_segment_id,
                started_at,
                at,
                completed_at,
                at,
                at,
            ),
        )
        percent = 100 if completed_at is not None else (100 * furthest_order) // segment_count
        return ReadingProgressProjection(
            content_id=content_id,
            current_segment_id=current_segment_id,
            furthest_segment_id=furthest_segment_id,
            progress_percent=percent,
            is_completed=completed_at is not None,
            started_at=started_at,
            last_opened_at=at,
            completed_at=completed_at,
        )

    @staticmethod
    def find_exposure(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        key: UUID,
    ) -> tuple[str, dict[str, object]] | None:
        row = connection.execute(
            """
            SELECT request_fingerprint, result_snapshot
            FROM exposure_events
            WHERE user_id = %s AND idempotency_key = %s AND request_fingerprint IS NOT NULL
            """,
            (actor.id, str(key)),
        ).fetchone()
        if row is None:
            return None
        return str(row[0]), cast(dict[str, object], row[1])

    @staticmethod
    def resolve_exposure(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        command: ExposureCommand,
    ) -> tuple[datetime, tuple[UUID, ...], str]:
        profile_id = PostgresReaderStore.resolve_profile(
            connection, actor=actor, requested_id=command.language_profile_id
        )
        row = connection.execute(
            """
            SELECT item.published_at, item.language_code, segment.sentence_id,
                   (
                       segment.audio_id IS NOT NULL
                       OR EXISTS (
                           SELECT 1 FROM sentence_audio AS audio
                           WHERE audio.sentence_id = segment.sentence_id
                       )
                   ) AS has_audio
            FROM content_items AS item
            JOIN content_segments AS segment ON segment.id = %s
             AND segment.content_id = item.id AND segment.language_code = item.language_code
            WHERE item.id = %s AND item.language_code = 'en'
              AND item.publication_status = 'published'
              AND reader_content_passes_publication_gate(item.id)
            FOR SHARE OF item, segment
            """,
            (command.segment_id, command.content_id),
        ).fetchone()
        if row is None:
            raise ContentNotFound("published Reader exposure target was not found")
        if command.exposure_type.value == "listen" and not bool(row[3]):
            raise ReaderValidationError("listen exposure requires authoritative segment audio")
        if command.exposure_type.value == "lookup":
            if command.sentence_id != _uuid(row[2]):
                raise ReaderValidationError("lookup sentence does not belong to the segment")
            concepts = connection.execute(
                """
                SELECT concept_id FROM sentence_concepts
                WHERE sentence_id = %s AND start_offset = %s AND end_offset = %s
                  AND language_code = 'en'
                ORDER BY concept_id
                """,
                (command.sentence_id, command.start_offset, command.end_offset),
            ).fetchall()
            if len(concepts) != 1:
                raise ReaderValidationError("lookup span is not one authoritative occurrence")
        else:
            concepts = connection.execute(
                """
                SELECT DISTINCT occurrence.concept_id
                FROM content_segments AS segment
                JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = segment.sentence_id
                WHERE segment.id = %s AND segment.content_id = %s
                  AND occurrence.language_code = 'en'
                ORDER BY occurrence.concept_id
                """,
                (command.segment_id, command.content_id),
            ).fetchall()
        if not concepts:
            raise ReaderValidationError("Reader exposure resolved no authoritative concepts")
        del profile_id
        return _datetime(row[0]), tuple(_uuid(value[0]) for value in concepts), str(row[1])

    @staticmethod
    def insert_exposure(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        command: ExposureCommand,
        exposure_id: UUID,
        key: UUID,
        fingerprint: str,
        concepts: tuple[UUID, ...],
        occurred_at: datetime,
        recorded_at: datetime,
        snapshot: dict[str, object],
        language_code: str,
    ) -> None:
        evidence: dict[str, object] = {"clientAttested": True}
        if command.start_offset is not None:
            evidence["startOffset"] = command.start_offset
            evidence["endOffset"] = command.end_offset
        connection.execute(
            """
            INSERT INTO exposure_events
                (id, user_id, user_language_id, language_code, exposure_type, content_id,
                 sentence_id, content_segment_id, evidence, idempotency_key,
                 occurred_at, created_at, request_fingerprint, result_snapshot)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                exposure_id,
                actor.id,
                command.language_profile_id,
                language_code,
                command.exposure_type.value,
                command.content_id,
                command.sentence_id,
                command.segment_id,
                Jsonb(evidence),
                str(key),
                occurred_at,
                recorded_at,
                fingerprint,
                Jsonb(snapshot),
            ),
        )
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO reader_exposure_concepts
                    (exposure_event_id, user_id, user_language_id, language_code,
                     concept_id, derivation_key, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        exposure_id,
                        actor.id,
                        command.language_profile_id,
                        language_code,
                        concept_id,
                        f"concept:{concept_id}",
                        recorded_at,
                    )
                    for concept_id in concepts
                ],
            )


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise TypeError("expected database timestamp")
    if value.tzinfo is None:
        raise TypeError("expected timezone-aware database timestamp")
    return value.astimezone(UTC)


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)
