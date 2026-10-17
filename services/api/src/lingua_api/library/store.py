"""PostgreSQL persistence for the Library service."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

import psycopg
from psycopg import Connection, Cursor

from lingua_api.content.domain import AttributionProjection, ReadingProgressProjection
from lingua_api.library.domain import (
    LibraryNotFound,
    LibraryValidationError,
    SavedConceptItem,
    SavedContentItem,
    SavedSentenceItem,
    SentenceConceptAnnotation,
)
from lingua_api.memory.domain import AuthenticatedActor


class PostgresLibraryStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @staticmethod
    def resolve_active_profile(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
    ) -> UUID:
        row = connection.execute(
            """
            SELECT id FROM user_languages
            WHERE user_id = %s AND language_code = 'en' AND status = 'active'
            ORDER BY created_at, id LIMIT 1
            """,
            (actor.id,),
        ).fetchone()
        if row is None:
            raise LibraryNotFound("owned active English profile was not found")
        return _uuid(row[0])

    @staticmethod
    def save_concept(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        concept_id: UUID,
        at: datetime,
    ) -> tuple[datetime, bool, UUID]:
        row = connection.execute(
            """
            SELECT concept.id
            FROM user_languages AS profile
            JOIN concepts AS concept ON concept.id = %s
             AND concept.language_code = profile.language_code
            WHERE profile.id = %s AND profile.user_id = %s AND profile.status = 'active'
            FOR SHARE OF concept, profile
            """,
            (concept_id, profile_id, actor.id),
        ).fetchone()
        if row is None:
            raise LibraryNotFound("concept was not found in active language profile")

        saved = connection.execute(
            """
            INSERT INTO user_saved_concepts
                (user_id, user_language_id, concept_id, language_code, saved_at)
            VALUES (%s, %s, %s, 'en', %s)
            ON CONFLICT (user_id, concept_id) DO NOTHING
            RETURNING saved_at
            """,
            (actor.id, profile_id, concept_id, at),
        ).fetchone()
        if saved is None:
            saved_existing = connection.execute(
                """
                SELECT saved_at FROM user_saved_concepts
                WHERE user_id = %s AND concept_id = %s
                """,
                (actor.id, concept_id),
            ).fetchone()
            if saved_existing is None:
                raise LibraryValidationError("saved concept state conflict")
            saved_at = _datetime(saved_existing[0])
        else:
            saved_at = _datetime(saved[0])

        intent = connection.execute(
            """
            INSERT INTO concept_save_intents
                (user_id, user_language_id, concept_id, language_code, created_at)
            VALUES (%s, %s, %s, 'en', %s)
            ON CONFLICT (user_id, concept_id) DO NOTHING
            RETURNING id
            """,
            (actor.id, profile_id, concept_id, at),
        ).fetchone()
        if intent is not None:
            return saved_at, True, _uuid(intent[0])

        existing_intent = connection.execute(
            """
            SELECT id FROM concept_save_intents
            WHERE user_id = %s AND concept_id = %s
            """,
            (actor.id, concept_id),
        ).fetchone()
        if existing_intent is None:
            raise LibraryValidationError("concept save intent conflict occurred")
        return saved_at, False, _uuid(existing_intent[0])

    @staticmethod
    def unsave_concept(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        concept_id: UUID,
    ) -> None:
        concept_exists = connection.execute(
            "SELECT 1 FROM concepts WHERE id = %s AND language_code = 'en'",
            (concept_id,),
        ).fetchone()
        if concept_exists is None:
            raise LibraryNotFound("concept was not found")
        connection.execute(
            "DELETE FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
            (actor.id, concept_id),
        )

    @staticmethod
    def save_content(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        content_id: UUID,
        at: datetime,
    ) -> datetime:
        row = connection.execute(
            """
            SELECT profile.id
            FROM user_languages AS profile
            JOIN content_items AS item ON item.id = %s
             AND item.language_code = profile.language_code
            WHERE profile.id = %s AND profile.user_id = %s AND profile.status = 'active'
              AND item.publication_status = 'published'
              AND reader_content_passes_publication_gate(item.id)
            FOR SHARE OF item, profile
            """,
            (content_id, profile_id, actor.id),
        ).fetchone()
        if row is None:
            raise LibraryNotFound("published content was not found in active language profile")

        saved = connection.execute(
            """
            INSERT INTO user_saved_content
                (user_id, user_language_id, content_id, language_code, saved_at)
            VALUES (%s, %s, %s, 'en', %s)
            ON CONFLICT (user_id, content_id) DO NOTHING
            RETURNING saved_at
            """,
            (actor.id, profile_id, content_id, at),
        ).fetchone()
        if saved is None:
            saved_existing = connection.execute(
                """
                SELECT saved_at FROM user_saved_content
                WHERE user_id = %s AND content_id = %s
                """,
                (actor.id, content_id),
            ).fetchone()
            if saved_existing is None:
                raise LibraryValidationError("saved content state conflict")
            return _datetime(saved_existing[0])
        return _datetime(saved[0])

    @staticmethod
    def unsave_content(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        content_id: UUID,
    ) -> None:
        content_exists = connection.execute(
            "SELECT 1 FROM content_items WHERE id = %s AND language_code = 'en'",
            (content_id,),
        ).fetchone()
        if content_exists is None:
            raise LibraryNotFound("content was not found")
        connection.execute(
            "DELETE FROM user_saved_content WHERE user_id = %s AND content_id = %s",
            (actor.id, content_id),
        )

    @staticmethod
    def save_sentence(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        sentence_id: UUID,
        at: datetime,
    ) -> datetime:
        row = connection.execute(
            """
            SELECT profile.id
            FROM user_languages AS profile
            JOIN sentences AS sentence ON sentence.id = %s
             AND sentence.language_code = profile.language_code
            JOIN content_segments AS segment ON segment.sentence_id = sentence.id
            JOIN content_items AS item ON item.id = segment.content_id
             AND item.language_code = segment.language_code
            WHERE profile.id = %s AND profile.user_id = %s AND profile.status = 'active'
              AND item.publication_status = 'published'
              AND reader_content_passes_publication_gate(item.id)
            LIMIT 1
            FOR SHARE OF sentence, item, profile
            """,
            (sentence_id, profile_id, actor.id),
        ).fetchone()
        if row is None:
            raise LibraryNotFound(
                "published catalog sentence was not found in active language profile"
            )

        saved = connection.execute(
            """
            INSERT INTO user_saved_sentences
                (user_id, user_language_id, sentence_id, language_code, saved_at)
            VALUES (%s, %s, %s, 'en', %s)
            ON CONFLICT (user_id, sentence_id) DO NOTHING
            RETURNING saved_at
            """,
            (actor.id, profile_id, sentence_id, at),
        ).fetchone()
        if saved is None:
            saved_existing = connection.execute(
                """
                SELECT saved_at FROM user_saved_sentences
                WHERE user_id = %s AND sentence_id = %s
                """,
                (actor.id, sentence_id),
            ).fetchone()
            if saved_existing is None:
                raise LibraryValidationError("saved sentence state conflict")
            return _datetime(saved_existing[0])
        return _datetime(saved[0])

    @staticmethod
    def unsave_sentence(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        sentence_id: UUID,
    ) -> None:
        sentence_exists = connection.execute(
            "SELECT 1 FROM sentences WHERE id = %s AND language_code = 'en'",
            (sentence_id,),
        ).fetchone()
        if sentence_exists is None:
            raise LibraryNotFound("sentence was not found")
        connection.execute(
            "DELETE FROM user_saved_sentences WHERE user_id = %s AND sentence_id = %s",
            (actor.id, sentence_id),
        )

    def list_saved_items(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        item_type: str | None,
        query: str | None,
        after_saved_at: datetime | None,
        after_item_id: UUID | None,
        limit: int,
        now: datetime,
    ) -> tuple[tuple[SavedConceptItem | SavedContentItem | SavedSentenceItem, ...], bool]:
        if hasattr(connection, "cursor") and callable(connection.cursor):
            with connection.cursor() as cursor:
                return self._list_saved_items_query(
                    connection=connection,
                    cursor=cursor,
                    actor=actor,
                    profile_id=profile_id,
                    item_type=item_type,
                    query=query,
                    after_saved_at=after_saved_at,
                    after_item_id=after_item_id,
                    limit=limit,
                    now=now,
                )
        return self._list_saved_items_query(
            connection=connection,
            cursor=None,
            actor=actor,
            profile_id=profile_id,
            item_type=item_type,
            query=query,
            after_saved_at=after_saved_at,
            after_item_id=after_item_id,
            limit=limit,
            now=now,
        )

    def _list_saved_items_query(
        self,
        *,
        connection: Connection[tuple[object, ...]],
        cursor: Cursor[tuple[object, ...]] | None,
        actor: AuthenticatedActor,
        profile_id: UUID,
        item_type: str | None,
        query: str | None,
        after_saved_at: datetime | None,
        after_item_id: UUID | None,
        limit: int,
        now: datetime,
    ) -> tuple[tuple[SavedConceptItem | SavedContentItem | SavedSentenceItem, ...], bool]:
        executor: Connection[tuple[object, ...]] | Cursor[tuple[object, ...]] = (
            cursor if cursor is not None else connection
        )
        pattern = f"%{_escape_like(query)}%" if query is not None else None

        # 1. Fetch unified IDs and types ordered by saved_at DESC, item_id DESC
        rows = executor.execute(
            """
            WITH saved_union AS (
                SELECT 'concept' AS item_type, sc.concept_id AS item_id, sc.saved_at
                FROM user_saved_concepts AS sc
                JOIN concepts AS c ON c.id = sc.concept_id
                LEFT JOIN LATERAL (
                    SELECT lemma FROM lexemes WHERE concept_id = c.id ORDER BY id LIMIT 1
                ) AS lex ON true
                WHERE sc.user_id = %s
                  AND (%s::text IS NULL OR %s::text = 'concept')
                  AND (%s::text IS NULL OR COALESCE(lex.lemma, c.canonical_key) ILIKE %s)

                UNION ALL

                SELECT 'content' AS item_type, sct.content_id AS item_id, sct.saved_at
                FROM user_saved_content AS sct
                JOIN content_items AS ct ON ct.id = sct.content_id
                WHERE sct.user_id = %s
                  AND (%s::text IS NULL OR %s::text = 'content')
                  AND (%s::text IS NULL OR ct.title ILIKE %s)

                UNION ALL

                SELECT 'sentence' AS item_type, ss.sentence_id AS item_id, ss.saved_at
                FROM user_saved_sentences AS ss
                JOIN sentences AS s ON s.id = ss.sentence_id
                WHERE ss.user_id = %s
                  AND (%s::text IS NULL OR %s::text = 'sentence')
                  AND (%s::text IS NULL OR s.text ILIKE %s)
            )
            SELECT item_type, item_id, saved_at
            FROM saved_union
            WHERE (%s::timestamptz IS NULL OR (saved_at, item_id) < (%s::timestamptz, %s::uuid))
            ORDER BY saved_at DESC, item_id DESC
            LIMIT %s
            """,
            (
                actor.id,
                item_type,
                item_type,
                pattern,
                pattern,
                actor.id,
                item_type,
                item_type,
                pattern,
                pattern,
                actor.id,
                item_type,
                item_type,
                pattern,
                pattern,
                after_saved_at,
                after_saved_at,
                after_item_id,
                limit + 1,
            ),
        ).fetchall()

        has_more = len(rows) > limit
        selected_rows = rows[:limit]
        if not selected_rows:
            return (), False

        # Group by item_type to batch-fetch details
        concept_ids = [_uuid(row[1]) for row in selected_rows if str(row[0]) == "concept"]
        content_ids = [_uuid(row[1]) for row in selected_rows if str(row[0]) == "content"]
        sentence_ids = [_uuid(row[1]) for row in selected_rows if str(row[0]) == "sentence"]

        concepts_by_id = self._load_concepts(
            connection,
            actor=actor,
            profile_id=profile_id,
            concept_ids=concept_ids,
            now=now,
            cursor=cursor,
        )
        content_by_id = self._load_content(
            connection,
            actor=actor,
            profile_id=profile_id,
            content_ids=content_ids,
            cursor=cursor,
        )
        sentences_by_id = self._load_sentences(
            connection,
            actor=actor,
            profile_id=profile_id,
            sentence_ids=sentence_ids,
            cursor=cursor,
        )

        items: list[SavedConceptItem | SavedContentItem | SavedSentenceItem] = []
        for row in selected_rows:
            itype = str(row[0])
            iid = _uuid(row[1])
            isaved_at = _datetime(row[2])
            if itype == "concept" and iid in concepts_by_id:
                raw = concepts_by_id[iid]
                items.append(
                    SavedConceptItem(
                        concept_id=iid,
                        canonical_form=raw["canonical_form"],
                        part_of_speech=raw["part_of_speech"],
                        ipa=raw["ipa"],
                        audio_url=raw["audio_url"],
                        level=raw["level"],
                        status=raw["status"],
                        is_due=raw["is_due"],
                        saved_at=isaved_at,
                    )
                )
            elif itype == "content" and iid in content_by_id:
                raw_c = content_by_id[iid]
                items.append(
                    SavedContentItem(
                        content_id=iid,
                        content_type=raw_c["content_type"],
                        title=raw_c["title"],
                        subtitle=raw_c["subtitle"],
                        excerpt=raw_c["excerpt"],
                        target_language_code=raw_c["target_language_code"],
                        difficulty_score=raw_c["difficulty_score"],
                        difficulty_label=raw_c["difficulty_label"],
                        known_concept_ratio=raw_c["known_concept_ratio"],
                        estimated_minutes=raw_c["estimated_minutes"],
                        cover_image_url=raw_c["cover_image_url"],
                        fit_reason=raw_c["fit_reason"],
                        is_saved=True,
                        reading_progress=raw_c["reading_progress"],
                        attribution=raw_c["attribution"],
                        saved_at=isaved_at,
                    )
                )
            elif itype == "sentence" and iid in sentences_by_id:
                raw_s = sentences_by_id[iid]
                items.append(
                    SavedSentenceItem(
                        sentence_id=iid,
                        order=raw_s["order"],
                        text=raw_s["text"],
                        translation=raw_s["translation"],
                        audio_url=raw_s["audio_url"],
                        concepts=raw_s["concepts"],
                        saved_at=isaved_at,
                    )
                )

        return tuple(items), has_more

    @staticmethod
    def _load_concepts(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        concept_ids: list[UUID],
        now: datetime,
        cursor: Cursor[tuple[object, ...]] | None = None,
    ) -> dict[UUID, dict[str, Any]]:
        if not concept_ids:
            return {}
        executor: Connection[tuple[object, ...]] | Cursor[tuple[object, ...]] = (
            cursor if cursor is not None else connection
        )
        rows = executor.execute(
            """
            SELECT concept.id,
                   COALESCE(lexeme.lemma, concept.canonical_key) AS canonical_form,
                   lexeme.part_of_speech,
                   level.code AS level_code,
                   COALESCE(retrievability.effective_status, ucs.status, 'unseen') AS status,
                   COALESCE(fs.due_at <= %s, false) AS is_due,
                   phonetic.ipa,
                   phonetic.audio_uri
            FROM concepts AS concept
            LEFT JOIN LATERAL (
                SELECT id, lemma, part_of_speech
                FROM lexemes
                WHERE concept_id = concept.id
                ORDER BY id
                LIMIT 1
            ) AS lexeme ON true
            LEFT JOIN LATERAL (
                SELECT ipa, audio_uri
                FROM phonetic_transcriptions
                WHERE lexeme_id = lexeme.id
                ORDER BY CASE WHEN accent_variant = 'en_US' THEN 0 ELSE 1 END, id
                LIMIT 1
            ) AS phonetic ON true
            LEFT JOIN LATERAL (
                SELECT level_id
                FROM framework_mappings
                WHERE concept_id = concept.id
                ORDER BY confidence DESC, level_id
                LIMIT 1
            ) AS mapping ON true
            LEFT JOIN proficiency_levels AS level ON level.id = mapping.level_id
            LEFT JOIN user_concept_states AS ucs
              ON ucs.user_id = %s AND ucs.user_language_id = %s AND ucs.concept_id = concept.id
            LEFT JOIN v_learner_concept_retrievability AS retrievability
              ON retrievability.user_id = ucs.user_id
             AND retrievability.user_language_id = ucs.user_language_id
             AND retrievability.concept_id = ucs.concept_id
            LEFT JOIN review_items AS ri
              ON ri.user_id = %s AND ri.concept_id = concept.id
            LEFT JOIN fsrs_states AS fs ON fs.review_item_id = ri.id
            WHERE concept.id = ANY(%s)
            """,
            (now, actor.id, profile_id, actor.id, concept_ids),
        ).fetchall()
        result: dict[UUID, dict[str, Any]] = {}
        for r in rows:
            cid = _uuid(r[0])
            result[cid] = {
                "canonical_form": str(r[1]),
                "part_of_speech": None if r[2] is None else str(r[2]),
                "ipa": None if r[6] is None else str(r[6]),
                "audio_url": None if r[7] is None else str(r[7]),
                "level": None if r[3] is None else str(r[3]),
                "status": str(r[4]),
                "is_due": bool(r[5]),
            }
        return result

    @staticmethod
    def _load_content(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        content_ids: list[UUID],
        cursor: Cursor[tuple[object, ...]] | None = None,
    ) -> dict[UUID, dict[str, Any]]:
        if not content_ids:
            return {}
        executor: Connection[tuple[object, ...]] | Cursor[tuple[object, ...]] = (
            cursor if cursor is not None else connection
        )
        rows = executor.execute(
            """
            WITH known AS (
                SELECT linked.content_id,
                       count(DISTINCT linked.concept_id) AS total_count,
                       count(DISTINCT linked.concept_id) FILTER (
                           WHERE state.status IN ('familiar', 'active', 'mastered')
                       ) AS known_count
                FROM content_concepts AS linked
                LEFT JOIN user_concept_states AS state
                  ON state.user_id = %s AND state.user_language_id = %s
                 AND state.concept_id = linked.concept_id
                WHERE linked.content_id = ANY(%s)
                GROUP BY linked.content_id
            )
            SELECT item.id, item.content_type, item.title, item.summary,
                   item.language_code, item.difficulty AS difficulty_score,
                   level.code AS difficulty_label,
                   COALESCE(
                       known.known_count::numeric / NULLIF(known.total_count, 0), 0
                   ) AS known_ratio,
                   ((metrics.token_count + 179) / 180)::integer AS estimated_minutes,
                   progress.current_segment_id, progress.furthest_segment_id,
                   progress.started_at, progress.last_opened_at, progress.completed_at,
                   furthest.order_index AS furthest_order,
                   metrics.sentence_count AS segment_count,
                   source.name AS source_name, license.code AS license_code,
                   source.attribution_text, source.source_url,
                   license.attribution_required
            FROM content_items AS item
            JOIN proficiency_levels AS level ON level.id = item.curated_level_id
            JOIN content_metrics AS metrics ON metrics.content_id = item.id
            JOIN source_records AS record ON record.id = item.source_record_id
            JOIN data_sources AS source ON source.id = record.source_id
            JOIN licenses AS license ON license.id = source.license_id
            LEFT JOIN known ON known.content_id = item.id
            LEFT JOIN user_content_progress AS progress
              ON progress.user_id = %s
             AND progress.user_language_id = %s
             AND progress.content_id = item.id
            LEFT JOIN content_segments AS furthest ON furthest.id = progress.furthest_segment_id
            WHERE item.id = ANY(%s)
            """,
            (actor.id, profile_id, content_ids, actor.id, profile_id, content_ids),
        ).fetchall()
        result: dict[UUID, dict[str, Any]] = {}
        for r in rows:
            cid = _uuid(r[0])
            level = str(r[6])
            known_ratio_dec = cast(Decimal, r[7])
            known_ratio = float(known_ratio_dec)
            difficulty_dec = cast(Decimal, r[5])

            progress = None
            if r[9] is not None:
                furthest_order = int(cast(int, r[14]))
                segment_count = int(cast(int, r[15]))
                completed_at = _optional_datetime(r[13])
                progress = ReadingProgressProjection(
                    content_id=cid,
                    current_segment_id=_uuid(r[9]),
                    furthest_segment_id=_uuid(r[10]),
                    progress_percent=100
                    if completed_at is not None
                    else (100 * furthest_order) // segment_count,
                    is_completed=completed_at is not None,
                    started_at=_datetime(r[11]),
                    last_opened_at=_datetime(r[12]),
                    completed_at=completed_at,
                )
            attribution = None
            if bool(r[20]):
                attribution = AttributionProjection(
                    source_name=str(r[16]),
                    license_code=str(r[17]),
                    attribution_text=str(r[18]),
                    source_url=None if r[19] is None else str(r[19]),
                )

            result[cid] = {
                "content_type": str(r[1]),
                "title": str(r[2]),
                "subtitle": None,
                "excerpt": None if r[3] is None else str(r[3]),
                "target_language_code": str(r[4]),
                "difficulty_score": float(difficulty_dec),
                "difficulty_label": level,
                "known_concept_ratio": known_ratio,
                "estimated_minutes": int(cast(int, r[8])),
                "cover_image_url": None,
                "fit_reason": (
                    f"Phù hợp mức {level}; {round(known_ratio * 100)}% khái niệm đã biết."
                ),
                "reading_progress": progress,
                "attribution": attribution,
            }
        return result

    @staticmethod
    def _load_sentences(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        profile_id: UUID,
        sentence_ids: list[UUID],
        cursor: Cursor[tuple[object, ...]] | None = None,
    ) -> dict[UUID, dict[str, Any]]:
        if not sentence_ids:
            return {}
        executor: Connection[tuple[object, ...]] | Cursor[tuple[object, ...]] = (
            cursor if cursor is not None else connection
        )
        rows = executor.execute(
            """
            SELECT sentence.id, sentence.text, trans.text AS translation,
                   asset.storage_uri AS audio_url
            FROM sentences AS sentence
            LEFT JOIN LATERAL (
                SELECT text FROM sentence_translations
                WHERE sentence_id = sentence.id
                ORDER BY id
                LIMIT 1
            ) AS trans ON true
            LEFT JOIN LATERAL (
                SELECT a.storage_uri
                FROM sentence_audio AS sa
                JOIN audio_assets AS a ON a.id = sa.audio_id
                WHERE sa.sentence_id = sentence.id
                ORDER BY sa.start_ms
                LIMIT 1
            ) AS asset ON true
            WHERE sentence.id = ANY(%s)
            """,
            (sentence_ids,),
        ).fetchall()

        concept_rows = executor.execute(
            """
            SELECT sc.sentence_id, sc.concept_id, sc.start_offset, sc.end_offset,
                   COALESCE(lexeme.lemma, c.canonical_key) AS canonical_form,
                   COALESCE(retrievability.effective_status, ucs.status, 'unseen')
            FROM sentence_concepts AS sc
            JOIN concepts AS c ON c.id = sc.concept_id
            LEFT JOIN LATERAL (
                SELECT lemma FROM lexemes WHERE concept_id = c.id ORDER BY id LIMIT 1
            ) AS lexeme ON true
            LEFT JOIN user_concept_states AS ucs
              ON ucs.user_id = %s AND ucs.user_language_id = %s AND ucs.concept_id = sc.concept_id
            LEFT JOIN v_learner_concept_retrievability AS retrievability
              ON retrievability.user_id = ucs.user_id
             AND retrievability.user_language_id = ucs.user_language_id
             AND retrievability.concept_id = ucs.concept_id
            WHERE sc.sentence_id = ANY(%s)
            ORDER BY sc.sentence_id, sc.start_offset, sc.end_offset
            """,
            (actor.id, profile_id, sentence_ids),
        ).fetchall()
        annotations_by_sentence: dict[UUID, list[SentenceConceptAnnotation]] = defaultdict(list)
        for cr in concept_rows:
            annotations_by_sentence[_uuid(cr[0])].append(
                SentenceConceptAnnotation(
                    concept_id=_uuid(cr[1]),
                    canonical_form=str(cr[4]),
                    start_offset_utf16=int(cast(int, cr[2])),
                    end_offset_utf16=int(cast(int, cr[3])),
                    status=str(cr[5]),
                )
            )

        result: dict[UUID, dict[str, Any]] = {}
        for r in rows:
            sid = _uuid(r[0])
            result[sid] = {
                "order": 0,
                "text": str(r[1]),
                "translation": None if r[2] is None else str(r[2]),
                "audio_url": None if r[3] is None else str(r[3]),
                "concepts": tuple(annotations_by_sentence.get(sid, ())),
            }
        return result


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


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
