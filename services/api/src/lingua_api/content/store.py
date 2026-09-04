"""PostgreSQL read model for published Reader content and learner overlays."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection

from lingua_api.content.cursor import ContentCursor
from lingua_api.content.domain import (
    AttributionProjection,
    ConceptAnnotationProjection,
    ContentDetailProjection,
    ContentNotFound,
    ContentSegmentProjection,
    ContentSummaryProjection,
    ReaderSentenceProjection,
    ReadingProgressProjection,
)
from lingua_api.memory.domain import AuthenticatedActor


class PostgresContentStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @staticmethod
    def require_application_identity(
        connection: Connection[tuple[object, ...]], *, actor: AuthenticatedActor
    ) -> None:
        row = connection.execute(
            """
            SELECT 1
            FROM users AS app_user
            JOIN learner_profiles AS learner ON learner.user_id = app_user.id
            WHERE app_user.id = %s AND app_user.deleted_at IS NULL
            """,
            (actor.id,),
        ).fetchone()
        if row is None:
            raise ContentNotFound("application profile was not found")

    @staticmethod
    def resolve_profile(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        requested_id: UUID | None,
    ) -> UUID | None:
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
                WHERE id = %s AND user_id = %s AND language_code = 'en' AND status = 'active'
                """,
                (requested_id, actor.id),
            ).fetchone()
        return None if row is None else _uuid(row[0])

    def list_summaries(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID,
        boundary: ContentCursor | None,
        limit: int,
        connection: Connection[tuple[object, ...]] | None = None,
    ) -> list[ContentSummaryProjection]:
        if connection is None:
            with self.connect() as owned_connection:
                return self.list_summaries(
                    actor=actor,
                    language_profile_id=language_profile_id,
                    boundary=boundary,
                    limit=limit,
                    connection=owned_connection,
                )
        boundary_sql = ""
        parameters: list[object] = [actor.id, language_profile_id, actor.id, language_profile_id]
        if boundary is not None:
            boundary_sql = """
                WHERE (distance, -known_ratio, difficulty_score, id)
                    > (%s, %s, %s, %s)
            """
            parameters.extend(
                (boundary.distance, -boundary.known_ratio, boundary.difficulty, boundary.content_id)
            )
        parameters.append(limit)
        if connection is not None:
            rows = connection.execute(
                f"""
                WITH owned_profile AS (
                    SELECT profile.id, level.rank_order AS learner_rank
                    FROM user_languages AS profile
                    LEFT JOIN proficiency_levels AS level ON level.id = profile.current_level_id
                    WHERE profile.user_id = %s AND profile.id = %s
                      AND profile.language_code = 'en' AND profile.status = 'active'
                ), known AS (
                    SELECT linked.content_id,
                           count(DISTINCT linked.concept_id) AS total_count,
                           count(DISTINCT linked.concept_id) FILTER (
                               WHERE state.status IN ('familiar', 'active', 'mastered')
                           ) AS known_count
                    FROM content_concepts AS linked
                    LEFT JOIN user_concept_states AS state
                      ON state.user_id = %s AND state.user_language_id = %s
                     AND state.concept_id = linked.concept_id
                    GROUP BY linked.content_id
                ), catalog AS (
                    SELECT item.id, item.content_type, item.title, item.summary,
                           item.language_code, item.difficulty AS difficulty_score,
                           level.code AS difficulty_label,
                           COALESCE(known.known_count::numeric / NULLIF(known.total_count, 0), 0)
                               AS known_ratio,
                           ((metrics.token_count + 179) / 180)::integer AS estimated_minutes,
                           saved.content_id IS NOT NULL AS is_saved,
                           progress.current_segment_id, progress.furthest_segment_id,
                           progress.started_at, progress.last_opened_at, progress.completed_at,
                           furthest.order_index AS furthest_order,
                           metrics.sentence_count AS segment_count,
                           source.name AS source_name, license.code AS license_code,
                           source.attribution_text, source.source_url,
                           license.attribution_required,
                           COALESCE(abs(level.rank_order - profile.learner_rank), level.rank_order)
                               AS distance
                    FROM owned_profile AS profile
                    JOIN content_items AS item ON item.language_code = 'en'
                    JOIN proficiency_levels AS level ON level.id = item.curated_level_id
                    JOIN content_metrics AS metrics ON metrics.content_id = item.id
                    JOIN source_records AS record ON record.id = item.source_record_id
                    JOIN data_sources AS source ON source.id = record.source_id
                    JOIN licenses AS license ON license.id = source.license_id
                    LEFT JOIN known ON known.content_id = item.id
                    LEFT JOIN user_saved_content AS saved
                      ON saved.user_id = %s AND saved.user_language_id = profile.id
                     AND saved.content_id = item.id
                    LEFT JOIN user_content_progress AS progress
                      ON progress.user_id = %s AND progress.user_language_id = profile.id
                     AND progress.content_id = item.id
                    LEFT JOIN content_segments AS furthest
                      ON furthest.id = progress.furthest_segment_id
                    WHERE item.publication_status = 'published'
                      AND reader_content_passes_publication_gate(item.id)
                )
                SELECT * FROM catalog
                {boundary_sql}
                ORDER BY distance, known_ratio DESC, difficulty_score, id
                LIMIT %s
                """,
                [*parameters[:4], actor.id, actor.id, *parameters[4:]],
            ).fetchall()
        return [_summary(row) for row in rows]

    def get_detail(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID,
        content_id: UUID,
    ) -> ContentDetailProjection:
        with self.connect() as connection:
            row = connection.execute(
                """
                WITH known AS (
                    SELECT count(DISTINCT linked.concept_id) AS total_count,
                           count(DISTINCT linked.concept_id) FILTER (
                               WHERE state.status IN ('familiar', 'active', 'mastered')
                           ) AS known_count
                    FROM content_concepts AS linked
                    LEFT JOIN user_concept_states AS state
                      ON state.user_id = %s AND state.user_language_id = %s
                     AND state.concept_id = linked.concept_id
                    WHERE linked.content_id = %s
                )
                SELECT item.id, item.content_type, item.title, item.summary,
                       item.language_code, item.difficulty, level.code,
                       COALESCE(known.known_count::numeric / NULLIF(known.total_count, 0), 0),
                       ((metrics.token_count + 179) / 180)::integer,
                       saved.content_id IS NOT NULL,
                       progress.current_segment_id, progress.furthest_segment_id,
                       progress.started_at, progress.last_opened_at, progress.completed_at,
                       furthest.order_index, metrics.sentence_count,
                       source.name, license.code, source.attribution_text, source.source_url,
                       license.attribution_required,
                       COALESCE(abs(level.rank_order - learner_level.rank_order), level.rank_order),
                       metrics.token_count
                FROM content_items AS item
                JOIN proficiency_levels AS level ON level.id = item.curated_level_id
                JOIN content_metrics AS metrics ON metrics.content_id = item.id
                JOIN user_languages AS profile
                  ON profile.id = %s AND profile.user_id = %s
                 AND profile.language_code = 'en' AND profile.status = 'active'
                LEFT JOIN proficiency_levels AS learner_level
                  ON learner_level.id = profile.current_level_id
                CROSS JOIN known
                JOIN source_records AS record ON record.id = item.source_record_id
                JOIN data_sources AS source ON source.id = record.source_id
                JOIN licenses AS license ON license.id = source.license_id
                LEFT JOIN user_saved_content AS saved
                  ON saved.user_id = %s AND saved.user_language_id = profile.id
                 AND saved.content_id = item.id
                LEFT JOIN user_content_progress AS progress
                  ON progress.user_id = %s AND progress.user_language_id = profile.id
                 AND progress.content_id = item.id
                LEFT JOIN content_segments AS furthest ON furthest.id = progress.furthest_segment_id
                WHERE item.id = %s AND item.publication_status = 'published'
                  AND reader_content_passes_publication_gate(item.id)
                """,
                (
                    actor.id,
                    language_profile_id,
                    content_id,
                    language_profile_id,
                    actor.id,
                    actor.id,
                    actor.id,
                    content_id,
                ),
            ).fetchone()
            if row is None:
                raise ContentNotFound("published Reader content was not found")
            summary = _summary(row[:23])
            total_words = int(cast(int, row[23]))
            segment_rows = connection.execute(
                """
                SELECT segment.id, segment.order_index, segment.segment_type, segment.text,
                       segment.audio_start_ms, segment.audio_end_ms,
                       sentence.id, sentence.text, translation.text,
                       COALESCE(segment_audio.storage_uri, sentence_audio_asset.storage_uri)
                FROM content_segments AS segment
                JOIN sentences AS sentence ON sentence.id = segment.sentence_id
                LEFT JOIN LATERAL (
                    SELECT text FROM sentence_translations
                    WHERE sentence_id = sentence.id AND target_language_code = 'vi'
                    ORDER BY id LIMIT 1
                ) AS translation ON true
                LEFT JOIN audio_assets AS segment_audio ON segment_audio.id = segment.audio_id
                LEFT JOIN LATERAL (
                    SELECT audio.storage_uri
                    FROM sentence_audio AS link
                    JOIN audio_assets AS audio ON audio.id = link.audio_id
                    WHERE link.sentence_id = sentence.id
                    ORDER BY link.start_ms, link.audio_id LIMIT 1
                ) AS sentence_audio_asset ON true
                WHERE segment.content_id = %s
                ORDER BY segment.order_index, segment.id
                """,
                (content_id,),
            ).fetchall()
            annotation_rows = connection.execute(
                """
                SELECT occurrence.sentence_id, occurrence.concept_id,
                       COALESCE(lexeme.lemma, concept.canonical_key),
                       occurrence.start_offset, occurrence.end_offset,
                       COALESCE(state.status, 'unseen')
                FROM content_segments AS segment
                JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = segment.sentence_id
                JOIN concepts AS concept ON concept.id = occurrence.concept_id
                LEFT JOIN LATERAL (
                    SELECT lemma FROM lexemes WHERE concept_id = concept.id ORDER BY id LIMIT 1
                ) AS lexeme ON true
                LEFT JOIN user_concept_states AS state
                  ON state.user_id = %s AND state.user_language_id = %s
                 AND state.concept_id = concept.id
                WHERE segment.content_id = %s
                ORDER BY occurrence.sentence_id, occurrence.start_offset,
                         occurrence.end_offset, occurrence.concept_id
                """,
                (actor.id, language_profile_id, content_id),
            ).fetchall()
        annotations: dict[UUID, list[ConceptAnnotationProjection]] = defaultdict(list)
        for annotation in annotation_rows:
            annotations[_uuid(annotation[0])].append(
                ConceptAnnotationProjection(
                    concept_id=_uuid(annotation[1]),
                    canonical_form=str(annotation[2]),
                    start_offset=int(cast(int, annotation[3])),
                    end_offset=int(cast(int, annotation[4])),
                    status=str(annotation[5]),
                )
            )
        segments = tuple(_segment(row, annotations) for row in segment_rows)
        return ContentDetailProjection(summary, total_words, _content_audio(segment_rows), segments)


def _summary(row: tuple[object, ...]) -> ContentSummaryProjection:
    progress = None
    if row[10] is not None:
        segment_count = int(cast(int, row[16]))
        furthest_order = int(cast(int, row[15]))
        completed_at = _optional_datetime(row[14])
        progress = ReadingProgressProjection(
            content_id=_uuid(row[0]),
            current_segment_id=_uuid(row[10]),
            furthest_segment_id=_uuid(row[11]),
            progress_percent=100
            if completed_at is not None
            else (100 * furthest_order) // segment_count,
            is_completed=completed_at is not None,
            started_at=_datetime(row[12]),
            last_opened_at=_datetime(row[13]),
            completed_at=completed_at,
        )
    attribution = None
    if bool(row[21]):
        attribution = AttributionProjection(
            source_name=str(row[17]),
            license_code=str(row[18]),
            attribution_text=str(row[19]),
            source_url=None if row[20] is None else str(row[20]),
        )
    known_ratio_decimal = cast(Decimal, row[7])
    difficulty_decimal = cast(Decimal, row[5])
    known_ratio = float(known_ratio_decimal)
    level = str(row[6])
    return ContentSummaryProjection(
        id=_uuid(row[0]),
        content_type=str(row[1]),
        title=str(row[2]),
        subtitle=None,
        excerpt=None if row[3] is None else str(row[3]),
        target_language_code=str(row[4]),
        difficulty_score=float(difficulty_decimal),
        difficulty_label=level,
        known_concept_ratio=known_ratio,
        estimated_minutes=int(cast(int, row[8])),
        fit_reason=f"Phù hợp mức {level}; {round(known_ratio * 100)}% khái niệm đã biết.",
        is_saved=bool(row[9]),
        reading_progress=progress,
        attribution=attribution,
        sort_distance=int(cast(int, row[22])),
        sort_known_ratio=known_ratio_decimal,
        sort_difficulty=difficulty_decimal,
    )


def _segment(
    row: tuple[object, ...],
    annotations: dict[UUID, list[ConceptAnnotationProjection]],
) -> ContentSegmentProjection:
    sentence_id = _uuid(row[6])
    sentence = ReaderSentenceProjection(
        id=sentence_id,
        text=str(row[7]),
        translation=None if row[8] is None else str(row[8]),
        audio_url=None if row[9] is None else str(row[9]),
        order=int(cast(int, row[1])),
        concepts=tuple(annotations[sentence_id]),
    )
    return ContentSegmentProjection(
        id=_uuid(row[0]),
        order=int(cast(int, row[1])),
        segment_type=str(row[2]),
        text=str(row[3]),
        start_ms=None if row[4] is None else int(cast(int, row[4])),
        end_ms=None if row[5] is None else int(cast(int, row[5])),
        sentences=(sentence,),
    )


def _content_audio(rows: list[tuple[object, ...]]) -> str | None:
    urls = {str(row[9]) for row in rows if row[9] is not None}
    return next(iter(urls)) if len(urls) == 1 else None


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
