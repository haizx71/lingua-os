"""Actor-scoped relational read model for the Review API adapter."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection

from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import AuthenticatedActor, MemoryItemNotFound, MemoryState
from lingua_api.review.domain import DueReviewProjection, ReviewProjectionUnavailable

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
    ) -> list[DueReviewProjection]:
        boundary_sql = ""
        parameters: list[object] = [actor.id, actor.id, language_profile_id, as_of]
        if after_due_at is not None and after_review_item_id is not None:
            boundary_sql = "AND (state.due_at, review_item.id) > (%s, %s)"
            parameters.extend((after_due_at, after_review_item_id))
        parameters.append(limit)
        with self.connect() as connection:
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
                       concept_state.updated_at
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
                    SELECT definition, translated_definition
                    FROM word_senses
                    WHERE lexeme_id = lexeme.id
                    ORDER BY sense_order
                    LIMIT 1
                ) AS sense ON true
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
    return DueReviewProjection(
        review_item_id=_uuid(row[0]),
        concept_id=_uuid(row[1]),
        canonical_form=str(row[2]),
        part_of_speech=None if row[3] is None else str(row[3]),
        concept_status="unseen" if row[4] is None else str(row[4]),
        prompt_text=str(row[5]),
        due_at=_datetime(row[6]),
        last_review_at=_optional_datetime(row[7]),
        memory_state=MemoryState(str(row[8])),
        framework_code=None if row[9] is None else str(row[9]),
        level_code=None if row[10] is None else str(row[10]),
        level_label=None if row[11] is None else str(row[11]),
        competence=_concept_competence(row[12:26]),
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


def _float(value: object) -> float:
    if not isinstance(value, int | float | Decimal):
        raise ReviewProjectionUnavailable("projection score has an unexpected type")
    return float(value)
