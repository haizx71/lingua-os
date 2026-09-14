"""Transactional PostgreSQL authoring store over the existing Reader schema."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID, uuid4

import psycopg
from psycopg import Connection

from lingua_api.admin.domain import (
    AdminCatalogConceptProjection,
    AdminContentProjection,
    AdminInvalidState,
    AdminNotFound,
    AdminSentenceConceptProjection,
    AdminSentenceProjection,
    AdminValidationError,
    AdminValidationIssue,
)
from lingua_api.catalog.sql import allowed_record_sql
from lingua_api.reader.analyze_policy import (
    CatalogMatchCandidate,
    analyze_transient_text,
    candidate_lookup_tokens,
    normalize_match_text,
)

LICENSE_CODE = "LINGUA-FIRST-PARTY"
AUTHORING_VERSION = "admin-first-party-v1"


class PostgresAdminContentStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    def create(self, values: dict[str, str], *, now: datetime) -> AdminContentProjection:
        content_id = uuid4()
        source_id = uuid4()
        source_record_id = uuid4()
        body = values["body"]
        sentences = self._sentences(body)
        raw_hash = _raw_hash(values)
        with self.connect() as connection:
            level_id, difficulty = self._level(connection, values["level"])
            self._ensure_license(connection)
            license_id = connection.execute(
                "SELECT id FROM licenses WHERE code = %s", (LICENSE_CODE,)
            ).fetchone()
            assert license_id is not None
            connection.execute(
                """
                INSERT INTO data_sources
                    (id, name, source_type, source_version, license_id, attribution_text)
                VALUES (%s, %s, 'internal', %s, %s, %s)
                """,
                (
                    source_id,
                    values["source_name"],
                    _pinned_source_version(values["source_version"], content_id),
                    license_id[0],
                    values["attribution_text"],
                ),
            )
            metadata = _metadata(values)
            connection.execute(
                """
                INSERT INTO source_records
                    (id, source_id, source_record_key, raw_hash, transform_version,
                     review_status, imported_at, metadata)
                VALUES (%s, %s, %s, %s, %s, 'normalized', %s, %s::jsonb)
                """,
                (
                    source_record_id,
                    source_id,
                    f"admin:{content_id}",
                    raw_hash,
                    AUTHORING_VERSION,
                    now,
                    json.dumps(metadata, ensure_ascii=False),
                ),
            )
            connection.execute(
                """
                INSERT INTO content_items
                    (id, language_code, content_type, title, difficulty, publication_status,
                     source_record_id, curated_level_id, created_at, updated_at)
                VALUES (%s, 'en', 'article', %s, %s, 'normalized', %s, %s, %s, %s)
                """,
                (content_id, values["title"], difficulty, source_record_id, level_id, now, now),
            )
            connection.execute(
                """
                INSERT INTO content_versions
                    (content_id, version, content_hash, source_record_id, created_at)
                VALUES (%s, 1, %s, %s, %s)
                """,
                (content_id, _text_hash(body), source_record_id, now),
            )
            self._write_structure(
                connection,
                content_id=content_id,
                source_record_id=source_record_id,
                body=body,
                sentences=sentences,
                difficulty=difficulty,
                now=now,
            )
            connection.commit()
            return self._get(connection, content_id)

    def list(self) -> tuple[AdminContentProjection, ...]:
        with self.connect() as connection:
            ids = connection.execute(
                """
                SELECT item.id
                FROM content_items AS item
                JOIN source_records AS record ON record.id = item.source_record_id
                WHERE record.metadata ->> 'authoringVersion' = %s
                ORDER BY item.updated_at DESC, item.id
                LIMIT 100
                """,
                (AUTHORING_VERSION,),
            ).fetchall()
            return tuple(self._get(connection, _uuid(row[0])) for row in ids)

    def get(self, content_id: UUID) -> AdminContentProjection:
        with self.connect() as connection:
            return self._get(connection, content_id)

    def search_concepts(
        self, query: str, *, limit: int
    ) -> tuple[AdminCatalogConceptProjection, ...]:
        normalized = normalize_match_text(query)
        if not normalized:
            raise AdminValidationError("concept search query must contain searchable text")
        with self.connect() as connection:
            rows = connection.execute(
                f"""
                WITH matched AS (
                    SELECT concept.id, lexeme.normalized_form AS matched_form
                    FROM concepts AS concept
                    JOIN lexemes AS lexeme ON lexeme.concept_id = concept.id
                    WHERE concept.language_code = 'en'
                      AND lexeme.normalized_form LIKE %s ESCAPE '\\'
                      AND {allowed_record_sql("concept.source_record_id")}
                      AND {allowed_record_sql("lexeme.source_record_id")}
                    UNION
                    SELECT concept.id, form.normalized_form
                    FROM concepts AS concept
                    JOIN lexemes AS lexeme ON lexeme.concept_id = concept.id
                    JOIN lexeme_forms AS form ON form.lexeme_id = lexeme.id
                    WHERE concept.language_code = 'en'
                      AND form.normalized_form LIKE %s ESCAPE '\\'
                      AND {allowed_record_sql("concept.source_record_id")}
                      AND {allowed_record_sql("lexeme.source_record_id")}
                      AND {allowed_record_sql("form.source_record_id")}
                    UNION
                    SELECT concept.id, concept.canonical_key
                    FROM concepts AS concept
                    WHERE concept.language_code = 'en'
                      AND concept.concept_type IN ('grammar', 'skill')
                      AND concept.canonical_key LIKE %s ESCAPE '\\'
                      AND {allowed_record_sql("concept.source_record_id")}
                )
                SELECT concept.id, concept.concept_type,
                       COALESCE(canonical.lemma, concept.canonical_key),
                       canonical.part_of_speech, sense.definition,
                       min(matched.matched_form)
                FROM matched
                JOIN concepts AS concept ON concept.id = matched.id
                LEFT JOIN LATERAL (
                    SELECT lexeme.id, lexeme.lemma, lexeme.part_of_speech
                    FROM lexemes AS lexeme
                    WHERE lexeme.concept_id = concept.id
                      AND {allowed_record_sql("lexeme.source_record_id")}
                    ORDER BY lexeme.normalized_form, lexeme.id LIMIT 1
                ) AS canonical ON true
                LEFT JOIN LATERAL (
                    SELECT word_sense.definition
                    FROM word_senses AS word_sense
                    WHERE word_sense.lexeme_id = canonical.id
                      AND {allowed_record_sql("word_sense.source_record_id")}
                    ORDER BY word_sense.sense_order, word_sense.id LIMIT 1
                ) AS sense ON true
                GROUP BY concept.id, concept.concept_type, canonical.lemma,
                         canonical.part_of_speech, sense.definition
                ORDER BY (min(matched.matched_form) = %s) DESC,
                         min(matched.matched_form), concept.id
                LIMIT %s
                """,
                (
                    f"{_escape_like(normalized)}%",
                    f"{_escape_like(normalized)}%",
                    f"{_escape_like(normalized)}%",
                    normalized,
                    limit,
                ),
            ).fetchall()
            return tuple(_catalog_concept(row[:5]) for row in rows)

    def put_sentence_concept(
        self,
        content_id: UUID,
        sentence_id: UUID,
        concept_id: UUID,
        *,
        start_offset: int,
        end_offset: int,
        occurrence_role: str,
        now: datetime,
    ) -> AdminContentProjection:
        with self.connect() as connection:
            current, sentence_text = self._mapping_context(
                connection, content_id, sentence_id, concept_id
            )
            surface_text = _utf16_slice(sentence_text, start_offset, end_offset)
            if not surface_text.strip():
                raise AdminValidationError("concept occurrence must contain visible text")
            existing = connection.execute(
                """
                SELECT occurrence_role FROM sentence_concepts
                WHERE sentence_id = %s AND concept_id = %s
                  AND start_offset = %s AND end_offset = %s
                """,
                (sentence_id, concept_id, start_offset, end_offset),
            ).fetchone()
            if existing == (occurrence_role,):
                return current
            overlap = connection.execute(
                """
                SELECT 1 FROM sentence_concepts
                WHERE sentence_id = %s
                  AND start_offset < %s AND end_offset > %s
                  AND NOT (concept_id = %s AND start_offset = %s AND end_offset = %s)
                LIMIT 1
                """,
                (sentence_id, end_offset, start_offset, concept_id, start_offset, end_offset),
            ).fetchone()
            if overlap is not None:
                raise AdminValidationError("concept occurrence overlaps an existing mapping")
            connection.execute(
                """
                INSERT INTO sentence_concepts
                    (sentence_id, concept_id, language_code, start_offset, end_offset,
                     occurrence_role)
                VALUES (%s, %s, 'en', %s, %s, %s)
                ON CONFLICT (sentence_id, concept_id, start_offset, end_offset)
                DO UPDATE SET occurrence_role = EXCLUDED.occurrence_role
                """,
                (sentence_id, concept_id, start_offset, end_offset, occurrence_role),
            )
            self._finish_mapping_change(connection, content_id, now=now)
            connection.commit()
            return self._get(connection, content_id)

    def delete_sentence_concept(
        self,
        content_id: UUID,
        sentence_id: UUID,
        concept_id: UUID,
        *,
        start_offset: int,
        end_offset: int,
        now: datetime,
    ) -> AdminContentProjection:
        with self.connect() as connection:
            current, sentence_text = self._mapping_context(
                connection, content_id, sentence_id, concept_id
            )
            _utf16_slice(sentence_text, start_offset, end_offset)
            cursor = connection.execute(
                """
                DELETE FROM sentence_concepts
                WHERE sentence_id = %s AND concept_id = %s
                  AND start_offset = %s AND end_offset = %s
                """,
                (sentence_id, concept_id, start_offset, end_offset),
            )
            if cursor.rowcount == 0:
                return current
            self._finish_mapping_change(connection, content_id, now=now)
            connection.commit()
            return self._get(connection, content_id)

    def update(
        self, content_id: UUID, updates: dict[str, str], *, now: datetime
    ) -> AdminContentProjection:
        with self.connect() as connection:
            current = self._get(connection, content_id, lock=True)
            if current.status in {"published", "retired"}:
                raise AdminInvalidState("published or retired content cannot be edited")
            values = {
                "title": current.title,
                "body": current.body,
                "level": current.level,
                "author_name": current.author_name,
                "source_name": current.source_name,
                "source_version": current.source_version,
                "attribution_text": current.attribution_text,
                "rights_statement": current.rights_statement,
            }
            values.update(updates)
            sentences = self._sentences(values["body"])
            level_id, difficulty = self._level(connection, values["level"])
            row = connection.execute(
                "SELECT source_record_id FROM content_items WHERE id = %s", (content_id,)
            ).fetchone()
            assert row is not None
            source_record_id = _uuid(row[0])
            source_row = connection.execute(
                "SELECT source_id FROM source_records WHERE id = %s", (source_record_id,)
            ).fetchone()
            assert source_row is not None
            source_id = _uuid(source_row[0])
            connection.execute(
                """
                UPDATE data_sources
                SET name = %s, source_version = %s, attribution_text = %s
                WHERE id = %s
                """,
                (
                    values["source_name"],
                    _pinned_source_version(values["source_version"], content_id),
                    values["attribution_text"],
                    source_id,
                ),
            )
            connection.execute(
                """
                UPDATE source_records
                SET raw_hash = %s, review_status = 'normalized', quality_score = NULL,
                    reviewed_at = NULL, metadata = %s::jsonb
                WHERE id = %s
                """,
                (
                    _raw_hash(values),
                    json.dumps(_metadata(values), ensure_ascii=False),
                    source_record_id,
                ),
            )
            connection.execute(
                """
                UPDATE content_items
                SET title = %s, difficulty = %s, quality_score = NULL,
                    publication_status = 'normalized', curated_level_id = %s,
                    reviewed_at = NULL, published_at = NULL, updated_at = %s
                WHERE id = %s
                """,
                (values["title"], difficulty, level_id, now, content_id),
            )
            self._delete_structure(connection, content_id)
            connection.execute(
                """
                UPDATE content_versions
                SET content_hash = %s, source_record_id = %s, created_at = %s
                WHERE content_id = %s AND version = 1
                """,
                (_text_hash(values["body"]), source_record_id, now, content_id),
            )
            self._write_structure(
                connection,
                content_id=content_id,
                source_record_id=source_record_id,
                body=values["body"],
                sentences=sentences,
                difficulty=difficulty,
                now=now,
            )
            connection.commit()
            return self._get(connection, content_id)

    def validate(
        self, content_id: UUID, *, now: datetime
    ) -> tuple[AdminContentProjection, tuple[AdminValidationIssue, ...]]:
        with self.connect() as connection:
            current = self._get(connection, content_id, lock=True)
            if current.status in {"published", "retired"}:
                raise AdminInvalidState("published or retired content cannot be validated")
            issues = tuple(
                AdminValidationIssue(
                    f"sentences[{sentence.order}].concepts",
                    "At least one authoritative catalog concept is required.",
                )
                for sentence in current.sentences
                if sentence.concept_count == 0
            )
            provenance = connection.execute(
                """
                SELECT license.usage_policy, source.attribution_text,
                       record.raw_hash, record.metadata ->> 'rightsStatement'
                FROM content_items AS item
                JOIN source_records AS record ON record.id = item.source_record_id
                JOIN data_sources AS source ON source.id = record.source_id
                JOIN licenses AS license ON license.id = source.license_id
                WHERE item.id = %s
                """,
                (content_id,),
            ).fetchone()
            if provenance is None or provenance[0] != "allowed":
                issues += (
                    AdminValidationIssue(
                        "licenseCode", "The first-party license must allow publication."
                    ),
                )
            if provenance is None or not str(provenance[1]).strip():
                issues += (AdminValidationIssue("attributionText", "Attribution is required."),)
            if provenance is None or re.fullmatch(r"[0-9a-f]{64}", str(provenance[2])) is None:
                issues += (AdminValidationIssue("rawHash", "A valid source hash is required."),)
            if provenance is None or not str(provenance[3]).strip():
                issues += (
                    AdminValidationIssue("rightsStatement", "A rights statement is required."),
                )
            if not issues:
                row = connection.execute(
                    "SELECT source_record_id FROM content_items WHERE id = %s", (content_id,)
                ).fetchone()
                assert row is not None
                connection.execute(
                    """
                    UPDATE source_records
                    SET review_status = 'approved', quality_score = 1, reviewed_at = %s
                    WHERE id = %s
                    """,
                    (now, row[0]),
                )
                connection.execute(
                    """
                    UPDATE content_items
                    SET publication_status = 'reviewed', quality_score = 1,
                        reviewed_at = %s, updated_at = %s
                    WHERE id = %s
                    """,
                    (now, now, content_id),
                )
            connection.commit()
            return self._get(connection, content_id), issues

    def publish(self, content_id: UUID, *, now: datetime) -> AdminContentProjection:
        with self.connect() as connection:
            current = self._get(connection, content_id, lock=True)
            if current.status != "reviewed":
                raise AdminInvalidState("only reviewed content can be published")
            try:
                connection.execute(
                    """
                    UPDATE content_items
                    SET publication_status = 'published', published_at = %s, updated_at = %s
                    WHERE id = %s
                    """,
                    (now, now, content_id),
                )
                connection.commit()
            except psycopg.errors.CheckViolation as error:
                connection.rollback()
                raise AdminInvalidState(
                    "content failed the authoritative publication gate"
                ) from error
            return self._get(connection, content_id)

    def retire(self, content_id: UUID, *, now: datetime) -> AdminContentProjection:
        with self.connect() as connection:
            current = self._get(connection, content_id, lock=True)
            if current.status != "published":
                raise AdminInvalidState("only published content can be retired")
            connection.execute(
                """
                UPDATE content_items
                SET publication_status = 'retired', updated_at = %s
                WHERE id = %s
                """,
                (now, content_id),
            )
            connection.commit()
            return self._get(connection, content_id)

    def _mapping_context(
        self,
        connection: Connection[tuple[object, ...]],
        content_id: UUID,
        sentence_id: UUID,
        concept_id: UUID,
    ) -> tuple[AdminContentProjection, str]:
        current = self._get(connection, content_id, lock=True)
        if current.status in {"published", "retired"}:
            raise AdminInvalidState("published or retired content concepts cannot be edited")
        sentence = connection.execute(
            """
            SELECT sentence.text
            FROM content_segments AS segment
            JOIN sentences AS sentence ON sentence.id = segment.sentence_id
            WHERE segment.content_id = %s AND segment.sentence_id = %s
            """,
            (content_id, sentence_id),
        ).fetchone()
        if sentence is None:
            raise AdminNotFound("admin content sentence was not found")
        concept = connection.execute(
            f"""
            SELECT concept.id
            FROM concepts AS concept
            WHERE concept.id = %s AND concept.language_code = 'en'
              AND {allowed_record_sql("concept.source_record_id")}
              AND (
                  concept.concept_type IN ('grammar', 'skill')
                  OR EXISTS (
                      SELECT 1 FROM lexemes AS lexeme
                      WHERE lexeme.concept_id = concept.id
                        AND {allowed_record_sql("lexeme.source_record_id")}
                  )
              )
            """,
            (concept_id,),
        ).fetchone()
        if concept is None:
            raise AdminNotFound("catalog concept was not found")
        return current, str(sentence[0])

    @staticmethod
    def _finish_mapping_change(
        connection: Connection[tuple[object, ...]], content_id: UUID, *, now: datetime
    ) -> None:
        connection.execute("DELETE FROM content_concepts WHERE content_id = %s", (content_id,))
        connection.execute(
            """
            INSERT INTO content_concepts
                (content_id, concept_id, language_code, occurrence_count)
            SELECT %s, occurrence.concept_id, 'en', count(*)::integer
            FROM content_segments AS segment
            JOIN sentence_concepts AS occurrence ON occurrence.sentence_id = segment.sentence_id
            WHERE segment.content_id = %s
            GROUP BY occurrence.concept_id
            """,
            (content_id, content_id),
        )
        connection.execute(
            """
            UPDATE source_records AS record
            SET review_status = 'normalized', quality_score = NULL, reviewed_at = NULL
            FROM content_items AS item
            WHERE item.id = %s AND record.id = item.source_record_id
            """,
            (content_id,),
        )
        connection.execute(
            """
            UPDATE content_items
            SET publication_status = 'normalized', quality_score = NULL,
                reviewed_at = NULL, updated_at = %s
            WHERE id = %s
            """,
            (now, content_id),
        )

    @staticmethod
    def _sentences(body: str) -> tuple[str, ...]:
        from lingua_api.admin.domain import segment_english_text

        return segment_english_text(body)

    @staticmethod
    def _ensure_license(connection: Connection[tuple[object, ...]]) -> None:
        connection.execute(
            """
            INSERT INTO licenses (code, name, usage_policy, attribution_required)
            VALUES (%s, 'LINGUA OS First-Party Content', 'allowed', false)
            ON CONFLICT (code) DO NOTHING
            """,
            (LICENSE_CODE,),
        )
        row = connection.execute(
            "SELECT usage_policy, attribution_required FROM licenses WHERE code = %s",
            (LICENSE_CODE,),
        ).fetchone()
        if row != ("allowed", False):
            raise AdminValidationError("first-party license configuration is not publishable")

    @staticmethod
    def _level(connection: Connection[tuple[object, ...]], level: str) -> tuple[UUID, Decimal]:
        row = connection.execute(
            """
            SELECT level.id, (level.lower_bound + level.upper_bound) / 2
            FROM proficiency_levels AS level
            JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            WHERE framework.code = 'CEFR' AND level.code = %s
              AND level.code IN ('A0', 'A1', 'A2', 'B1')
            """,
            (level,),
        ).fetchone()
        if row is None:
            raise AdminValidationError("curated Reader level is unavailable")
        return _uuid(row[0]), Decimal(str(row[1]))

    def _write_structure(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        content_id: UUID,
        source_record_id: UUID,
        body: str,
        sentences: tuple[str, ...],
        difficulty: Decimal,
        now: datetime,
    ) -> None:
        candidates = self._load_candidates(connection, body)
        analyzed = analyze_transient_text(body, candidates)
        concept_counts: Counter[UUID] = Counter()
        token_count = 0
        for order, segment in enumerate(analyzed):
            sentence = segment.sentences[0]
            sentence_id = uuid4()
            segment_id = uuid4()
            token_count += len(re.split(r"\s+", sentence.text.strip()))
            connection.execute(
                """
                INSERT INTO sentences
                    (id, language_code, text, normalized_text, difficulty, quality_score,
                     source_record_id, created_at)
                VALUES (%s, 'en', %s, %s, %s, 1, %s, %s)
                """,
                (
                    sentence_id,
                    sentence.text,
                    normalize_match_text(sentence.text),
                    difficulty,
                    source_record_id,
                    now,
                ),
            )
            connection.execute(
                """
                INSERT INTO content_segments
                    (id, content_id, language_code, order_index, sentence_id, text,
                     segment_type, source_record_id, created_at)
                VALUES (%s, %s, 'en', %s, %s, %s, 'sentence', %s, %s)
                """,
                (
                    segment_id,
                    content_id,
                    order,
                    sentence_id,
                    sentence.text,
                    source_record_id,
                    now,
                ),
            )
            for annotation in sentence.annotations:
                connection.execute(
                    """
                    INSERT INTO sentence_concepts
                        (sentence_id, concept_id, language_code, start_offset, end_offset,
                         occurrence_role)
                    VALUES (%s, %s, 'en', %s, %s, 'target')
                    """,
                    (
                        sentence_id,
                        annotation.concept_id,
                        annotation.start_offset_utf16,
                        annotation.end_offset_utf16,
                    ),
                )
                concept_counts[annotation.concept_id] += 1
        for concept_id, count in concept_counts.items():
            connection.execute(
                """
                INSERT INTO content_concepts
                    (content_id, concept_id, language_code, occurrence_count)
                VALUES (%s, %s, 'en', %s)
                """,
                (content_id, concept_id, count),
            )
        connection.execute(
            """
            INSERT INTO content_metrics
                (content_id, token_count, sentence_count, metrics_version, calculated_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (content_id, token_count, len(sentences), AUTHORING_VERSION, now),
        )

    @staticmethod
    def _delete_structure(connection: Connection[tuple[object, ...]], content_id: UUID) -> None:
        sentence_ids = [
            _uuid(row[0])
            for row in connection.execute(
                "SELECT sentence_id FROM content_segments WHERE content_id = %s", (content_id,)
            ).fetchall()
        ]
        connection.execute("DELETE FROM content_concepts WHERE content_id = %s", (content_id,))
        connection.execute("DELETE FROM content_metrics WHERE content_id = %s", (content_id,))
        connection.execute("DELETE FROM content_segments WHERE content_id = %s", (content_id,))
        if sentence_ids:
            connection.execute(
                "DELETE FROM sentence_concepts WHERE sentence_id = ANY(%s::uuid[])",
                (sentence_ids,),
            )
            connection.execute("DELETE FROM sentences WHERE id = ANY(%s::uuid[])", (sentence_ids,))

    @staticmethod
    def _load_candidates(
        connection: Connection[tuple[object, ...]], body: str
    ) -> tuple[CatalogMatchCandidate, ...]:
        tokens = candidate_lookup_tokens(body)
        if not tokens:
            return ()
        rows = connection.execute(
            f"""
            WITH input_tokens AS (SELECT unnest(%s::text[]) AS token), candidates AS (
                SELECT lexeme.concept_id, lexeme.lemma, lexeme.normalized_form
                FROM input_tokens
                JOIN lexemes AS lexeme
                  ON lexeme.language_code = 'en'
                 AND (lexeme.normalized_form = input_tokens.token
                      OR left(lexeme.normalized_form, char_length(input_tokens.token) + 1)
                         = input_tokens.token || ' ')
                JOIN concepts AS concept ON concept.id = lexeme.concept_id
                WHERE concept.concept_type IN ('word', 'phrase')
                  AND {allowed_record_sql("concept.source_record_id")}
                  AND {allowed_record_sql("lexeme.source_record_id")}
                UNION
                SELECT lexeme.concept_id, lexeme.lemma, form.normalized_form
                FROM input_tokens
                JOIN lexeme_forms AS form
                  ON form.normalized_form = input_tokens.token
                     OR left(form.normalized_form, char_length(input_tokens.token) + 1)
                        = input_tokens.token || ' '
                JOIN lexemes AS lexeme ON lexeme.id = form.lexeme_id
                JOIN concepts AS concept ON concept.id = lexeme.concept_id
                WHERE lexeme.language_code = 'en'
                  AND concept.concept_type IN ('word', 'phrase')
                  AND {allowed_record_sql("concept.source_record_id")}
                  AND {allowed_record_sql("lexeme.source_record_id")}
                  AND {allowed_record_sql("form.source_record_id")}
            )
            SELECT DISTINCT concept_id, lemma, normalized_form
            FROM candidates ORDER BY normalized_form, concept_id
            """,
            (list(tokens),),
        ).fetchall()
        return tuple(CatalogMatchCandidate(_uuid(row[0]), str(row[1]), str(row[2])) for row in rows)

    @staticmethod
    def _get(
        connection: Connection[tuple[object, ...]], content_id: UUID, *, lock: bool = False
    ) -> AdminContentProjection:
        suffix = " FOR UPDATE" if lock else ""
        row = connection.execute(
            f"""
            SELECT item.id, item.title, item.language_code, item.content_type, level.code,
                   item.publication_status, source.name, record.source_record_key,
                   record.raw_hash, record.metadata, license.code, source.attribution_text,
                   item.published_at, item.created_at, item.updated_at
            FROM content_items AS item
            JOIN proficiency_levels AS level ON level.id = item.curated_level_id
            JOIN source_records AS record ON record.id = item.source_record_id
            JOIN data_sources AS source ON source.id = record.source_id
            JOIN licenses AS license ON license.id = source.license_id
            WHERE item.id = %s AND record.metadata ->> 'authoringVersion' = %s{suffix}
            """,
            (content_id, AUTHORING_VERSION),
        ).fetchone()
        if row is None:
            raise AdminNotFound("admin content was not found")
        metadata = cast(dict[str, object], row[9])
        sentence_rows = connection.execute(
            """
            SELECT sentence.id, segment.order_index, sentence.text
            FROM content_segments AS segment
            JOIN sentences AS sentence ON sentence.id = segment.sentence_id
            WHERE segment.content_id = %s
            ORDER BY segment.order_index
            """,
            (content_id,),
        ).fetchall()
        sentence_projections: list[AdminSentenceProjection] = []
        for value in sentence_rows:
            sentence_id = _uuid(value[0])
            sentence_text = str(value[2])
            occurrence_rows = connection.execute(
                f"""
                SELECT concept.id, concept.concept_type,
                       COALESCE(canonical.lemma, concept.canonical_key),
                       canonical.part_of_speech, sense.definition,
                       occurrence.start_offset, occurrence.end_offset,
                       occurrence.occurrence_role
                FROM sentence_concepts AS occurrence
                JOIN concepts AS concept ON concept.id = occurrence.concept_id
                LEFT JOIN LATERAL (
                    SELECT lexeme.id, lexeme.lemma, lexeme.part_of_speech
                    FROM lexemes AS lexeme
                    WHERE lexeme.concept_id = concept.id
                      AND {allowed_record_sql("lexeme.source_record_id")}
                    ORDER BY lexeme.normalized_form, lexeme.id LIMIT 1
                ) AS canonical ON true
                LEFT JOIN LATERAL (
                    SELECT word_sense.definition
                    FROM word_senses AS word_sense
                    WHERE word_sense.lexeme_id = canonical.id
                      AND {allowed_record_sql("word_sense.source_record_id")}
                    ORDER BY word_sense.sense_order, word_sense.id LIMIT 1
                ) AS sense ON true
                WHERE occurrence.sentence_id = %s
                ORDER BY occurrence.start_offset, occurrence.end_offset, concept.id
                """,
                (sentence_id,),
            ).fetchall()
            concepts = tuple(
                AdminSentenceConceptProjection(
                    concept=_catalog_concept(occurrence[:5]),
                    start_offset=int(cast(int, occurrence[5])),
                    end_offset=int(cast(int, occurrence[6])),
                    occurrence_role=str(occurrence[7]),
                    surface_text=_utf16_slice(
                        sentence_text,
                        int(cast(int, occurrence[5])),
                        int(cast(int, occurrence[6])),
                    ),
                )
                for occurrence in occurrence_rows
            )
            sentence_projections.append(
                AdminSentenceProjection(
                    sentence_id,
                    int(cast(int, value[1])),
                    sentence_text,
                    len(concepts),
                    concepts,
                )
            )
        return AdminContentProjection(
            id=_uuid(row[0]),
            title=str(row[1]),
            body=str(metadata["body"]),
            language_code=str(row[2]),
            content_type=str(row[3]),
            level=str(row[4]),
            status=str(row[5]),
            author_name=str(metadata["authorName"]),
            source_name=str(row[6]),
            source_version=str(metadata["sourceVersion"]),
            license_code=str(row[10]),
            attribution_text=str(row[11]),
            rights_statement=str(metadata["rightsStatement"]),
            source_record_key=str(row[7]),
            raw_hash=str(row[8]),
            sentences=tuple(sentence_projections),
            published_at=cast(datetime | None, row[12]),
            created_at=cast(datetime, row[13]),
            updated_at=cast(datetime, row[14]),
        )


def _metadata(values: dict[str, str]) -> dict[str, str]:
    return {
        "authoringVersion": AUTHORING_VERSION,
        "body": values["body"],
        "authorName": values["author_name"],
        "sourceName": values["source_name"],
        "sourceVersion": values["source_version"],
        "rightsStatement": values["rights_statement"],
        "languageCode": "en",
        "licenseCode": LICENSE_CODE,
    }


def _raw_hash(values: dict[str, str]) -> str:
    return hashlib.sha256(
        json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _catalog_concept(row: tuple[object, ...]) -> AdminCatalogConceptProjection:
    return AdminCatalogConceptProjection(
        id=_uuid(row[0]),
        concept_type=str(row[1]),
        canonical_form=str(row[2]),
        part_of_speech=None if row[3] is None else str(row[3]),
        definition=None if row[4] is None else str(row[4]),
    )


def _utf16_slice(value: str, start_offset: int, end_offset: int) -> str:
    if start_offset < 0 or end_offset <= start_offset:
        raise AdminValidationError("concept occurrence offsets are invalid")
    encoded = value.encode("utf-16-le")
    if end_offset * 2 > len(encoded):
        raise AdminValidationError("concept occurrence exceeds the sentence boundary")
    try:
        return encoded[start_offset * 2 : end_offset * 2].decode("utf-16-le")
    except UnicodeDecodeError as error:
        raise AdminValidationError("concept occurrence splits a Unicode character") from error


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _pinned_source_version(value: str, content_id: UUID) -> str:
    return f"{value}#content-{content_id}"


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
