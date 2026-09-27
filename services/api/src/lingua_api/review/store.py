"""Actor-scoped relational read model for the Review API adapter."""

from __future__ import annotations

from contextlib import nullcontext
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection

from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import AuthenticatedActor, MemoryItemNotFound, MemoryState
from lingua_api.review.domain import DueReviewProjection, ReviewProjectionUnavailable
from lingua_api.review.modality import ReviewMaterial, select_review_prompt

CONCEPT_STATUSES = frozenset(
    {"unseen", "discovered", "learning", "familiar", "active", "mastered", "weak", "forgotten"}
)


class PostgresReviewReadStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    def require_application_identity(self, *, actor: AuthenticatedActor) -> None:
        with self.connect() as connection:
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
            raise MemoryItemNotFound("application profile was not found")

    def resolve_language_profile(
        self,
        *,
        actor: AuthenticatedActor,
        requested_id: UUID | None,
    ) -> UUID | None:
        with self.connect() as connection:
            if requested_id is not None:
                row = connection.execute(
                    """
                    SELECT id FROM user_languages
                    WHERE id = %s AND user_id = %s AND language_code = 'en' AND status = 'active'
                    """,
                    (requested_id, actor.id),
                ).fetchone()
            else:
                row = connection.execute(
                    """
                    SELECT id FROM user_languages
                    WHERE user_id = %s AND language_code = 'en' AND status = 'active'
                    ORDER BY created_at, id
                    LIMIT 1
                    """,
                    (actor.id,),
                ).fetchone()
        return None if row is None else _uuid(row[0])

    def load_owned_item_profile(self, *, actor: AuthenticatedActor, review_item_id: UUID) -> UUID:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT user_language_id
                FROM review_items
                WHERE id = %s AND user_id = %s
                """,
                (review_item_id, actor.id),
            ).fetchone()
        if row is None:
            raise MemoryItemNotFound("review item was not found for the authenticated actor")
        return _uuid(row[0])

    def list_due(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID,
        as_of: datetime,
        after_due_at: datetime | None,
        after_review_item_id: UUID | None,
        limit: int,
        connection: Connection[tuple[object, ...]] | None = None,
        review_item_id: UUID | None = None,
    ) -> list[DueReviewProjection]:
        boundary_sql = ""
        parameters: list[object] = [actor.id, actor.id, language_profile_id, as_of]
        item_sql = ""
        if review_item_id is not None:
            item_sql = "AND review_item.id = %s"
            parameters.append(review_item_id)
        if after_due_at is not None and after_review_item_id is not None:
            boundary_sql = "AND (state.due_at, review_item.id) > (%s, %s)"
            parameters.extend((after_due_at, after_review_item_id))
        parameters.append(limit)
        connection_context = self.connect() if connection is None else nullcontext(connection)
        with connection_context as connection:
            rows = connection.execute(
                f"""
                SELECT review_item.id, concept.id,
                       COALESCE(lexeme.lemma, concept.canonical_key),
                       lexeme.part_of_speech,
                       COALESCE(retrievability.effective_status, concept_state.status),
                       COALESCE(sense.translated_definition, sense.definition,
                                lexeme.lemma, concept.canonical_key),
                       state.due_at, state.last_review_at, state.state,
                       framework.code, level.code, level.label,
                       concept_state.competence_parameter_set_id,
                       concept_state.recognition, concept_state.recognition_confidence,
                       concept_state.recognition_evidence_count,
                       concept_state.recognition_last_evidence_at,
                       concept_state.listening, concept_state.listening_confidence,
                       concept_state.listening_evidence_count,
                       concept_state.listening_last_evidence_at,
                       concept_state.production, concept_state.production_confidence,
                       concept_state.production_evidence_count,
                       concept_state.production_last_evidence_at,
                       concept_state.updated_at,
                       sense.translated_definition, sense.translation_language_code,
                       example.sentence_text, example.translation,
                       example.start_offset, example.end_offset, phonetic.audio_uri
                FROM fsrs_states AS state
                JOIN review_items AS review_item ON review_item.id = state.review_item_id
                JOIN concepts AS concept ON concept.id = review_item.concept_id
                LEFT JOIN user_concept_states AS concept_state
                  ON concept_state.user_id = review_item.user_id
                 AND concept_state.concept_id = review_item.concept_id
                LEFT JOIN v_learner_concept_retrievability AS retrievability
                  ON retrievability.user_id = review_item.user_id
                 AND retrievability.user_language_id = review_item.user_language_id
                 AND retrievability.concept_id = review_item.concept_id
                LEFT JOIN LATERAL (
                    SELECT id, lemma, part_of_speech
                    FROM lexemes
                    WHERE concept_id = concept.id
                    ORDER BY id
                    LIMIT 1
                ) AS lexeme ON true
                LEFT JOIN LATERAL (
                    SELECT definition, translated_definition, translation_language_code
                    FROM word_senses
                    WHERE lexeme_id = lexeme.id
                    ORDER BY CASE
                        WHEN translation_language_code = 'vi'
                         AND translated_definition IS NOT NULL THEN 0 ELSE 1
                    END, sense_order
                    LIMIT 1
                ) AS sense ON true
                LEFT JOIN LATERAL (
                    SELECT sentence.text AS sentence_text,
                           translation.text AS translation,
                           occurrence.start_offset, occurrence.end_offset
                    FROM sentence_concepts AS occurrence
                    JOIN sentences AS sentence
                      ON sentence.id = occurrence.sentence_id
                     AND sentence.language_code = occurrence.language_code
                    LEFT JOIN LATERAL (
                        SELECT sentence_translation.text
                        FROM sentence_translations AS sentence_translation
                        WHERE sentence_translation.sentence_id = sentence.id
                          AND sentence_translation.target_language_code = 'vi'
                        ORDER BY sentence_translation.source_record_id, sentence_translation.id
                        LIMIT 1
                    ) AS translation ON true
                    WHERE occurrence.concept_id = concept.id
                      AND occurrence.language_code = 'en'
                      AND occurrence.occurrence_role = 'target'
                      AND char_length(sentence.text) <= 3000
                      AND EXISTS (
                          SELECT 1
                          FROM content_segments AS segment
                          JOIN content_items AS content
                            ON content.id = segment.content_id
                           AND content.language_code = segment.language_code
                          WHERE segment.sentence_id = sentence.id
                            AND segment.language_code = 'en'
                            AND content.publication_status = 'published'
                            AND reader_content_passes_publication_gate(content.id)
                      )
                    ORDER BY sentence.quality_score DESC NULLS LAST,
                             sentence.id, occurrence.start_offset
                    LIMIT 1
                ) AS example ON true
                LEFT JOIN LATERAL (
                    SELECT audio_uri
                    FROM phonetic_transcriptions
                    WHERE lexeme_id = lexeme.id AND audio_uri IS NOT NULL
                    ORDER BY CASE accent_variant
                        WHEN 'en_US' THEN 0 WHEN 'en_GB' THEN 1 ELSE 2
                    END, accent_variant
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
                LEFT JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
                WHERE state.user_id = %s
                  AND review_item.user_id = %s
                  AND review_item.user_language_id = %s
                  AND review_item.status = 'active'
                  AND state.due_at <= %s
                  {item_sql}
                  {boundary_sql}
                ORDER BY state.due_at, review_item.id
                LIMIT %s
                """,
                parameters,
            ).fetchall()
        projections = [_due_projection(row) for row in rows]
        if any(item.concept_status not in CONCEPT_STATUSES for item in projections):
            raise ReviewProjectionUnavailable("due concept status projection is missing or invalid")
        return projections


def _due_projection(row: tuple[object, ...]) -> DueReviewProjection:
    if row[2] is None or row[5] is None:
        raise ReviewProjectionUnavailable("due concept projection is incomplete")
    canonical_form = str(row[2])
    competence = _concept_competence(row[12:26])
    translated_definition = _optional_text(row[26]) if row[27] == "vi" else None
    prompt = select_review_prompt(
        fallback_prompt_text=str(row[5]),
        competence=competence,
        material=ReviewMaterial(
            translated_definition=translated_definition,
            example_sentence=_optional_text(row[28]),
            example_translation=_optional_text(row[29]),
            example_start_offset=_optional_int(row[30]),
            example_end_offset=_optional_int(row[31]),
            audio_url=_optional_text(row[32]),
        ),
    )
    return DueReviewProjection(
        review_item_id=_uuid(row[0]),
        concept_id=_uuid(row[1]),
        canonical_form=canonical_form,
        part_of_speech=None if row[3] is None else str(row[3]),
        concept_status="unseen" if row[4] is None else str(row[4]),
        prompt_text=prompt.prompt_text,
        exercise_mode=prompt.exercise_mode,
        context_sentence=prompt.context_sentence,
        translation=prompt.translation,
        audio_url=prompt.audio_url,
        due_at=_datetime(row[6]),
        last_review_at=_optional_datetime(row[7]),
        memory_state=MemoryState(str(row[8])),
        framework_code=None if row[9] is None else str(row[9]),
        level_code=None if row[10] is None else str(row[10]),
        level_label=None if row[11] is None else str(row[11]),
        competence=competence,
    )


def _concept_competence(values: tuple[object, ...]) -> CompetenceProjection:
    if values[0] is None:
        return CompetenceProjection.zero()
    return CompetenceProjection(
        recognition=_score_projection(values[1:5]),
        listening=_score_projection(values[5:9]),
        production=_score_projection(values[9:13]),
    )


def _score_projection(values: tuple[object, ...]) -> CompetenceScoreProjection:
    if values[0] is None:
        raise ReviewProjectionUnavailable("versioned concept competence score is missing")
    return CompetenceScoreProjection(
        score=_float(values[0]),
        confidence=_float(values[1]),
        evidence_count=int(cast(int, values[2])),
        updated_at=_optional_datetime(values[3]),
    )


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise ReviewProjectionUnavailable("projection timestamp has an unexpected type")
    return value


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ReviewProjectionUnavailable("prompt material has an unexpected type")
    return value


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        raise ReviewProjectionUnavailable("prompt offset has an unexpected type")
    return value


def _float(value: object) -> float:
    if not isinstance(value, int | float | Decimal):
        raise ReviewProjectionUnavailable("projection score has an unexpected type")
    return float(value)
