"""Bounded PostgreSQL Dictionary catalog read model."""

from __future__ import annotations

from uuid import UUID

from lingua_api.brain.domain import ProficiencyLevelProjection
from lingua_api.brain.store import BrainSnapshot, PostgresBrainStore
from lingua_api.catalog.sql import allowed_record_sql
from lingua_api.competence.domain import ConceptStatus
from lingua_api.dictionary.cursor import DictionaryCursor
from lingua_api.dictionary.domain import DictionarySummaryProjection


class PostgresDictionaryStore:
    def __init__(self, database_url: str) -> None:
        self.brain = PostgresBrainStore(database_url)

    @staticmethod
    def search(
        snapshot: BrainSnapshot,
        *,
        profile_id: UUID,
        language_code: str,
        query: str,
        boundary: DictionaryCursor | None,
        limit: int,
    ) -> list[DictionarySummaryProjection]:
        filters = ""
        parameters: list[object] = [
            language_code,
            query,
            f"{query}\U0010ffff",
            f"{_escape_like(query)}%",
            language_code,
            query,
            f"{query}\U0010ffff",
            f"{_escape_like(query)}%",
            snapshot.actor.id,
            profile_id,
            snapshot.actor.id,
            profile_id,
            snapshot.as_of,
        ]
        if boundary is not None:
            filters = "WHERE (matched.normalized_form, concept.id) > (%s, %s)"
            parameters.extend((boundary.matched_normalized_form, boundary.concept_id))
        parameters.append(limit)
        rows = snapshot.connection.execute(
            f"""
            WITH candidate_forms AS (
                SELECT lexeme.concept_id, lexeme.normalized_form
                FROM lexemes AS lexeme
                JOIN concepts AS source_concept ON source_concept.id = lexeme.concept_id
                WHERE lexeme.language_code = %s
                  AND source_concept.concept_type IN ('word', 'phrase')
                  AND lexeme.normalized_form >= %s AND lexeme.normalized_form < %s
                  AND lexeme.normalized_form LIKE %s ESCAPE '\\'
                  AND {allowed_record_sql("source_concept.source_record_id")}
                  AND {allowed_record_sql("lexeme.source_record_id")}
                UNION
                SELECT lexeme.concept_id, form.normalized_form
                FROM lexeme_forms AS form
                JOIN lexemes AS lexeme ON lexeme.id = form.lexeme_id
                JOIN concepts AS source_concept ON source_concept.id = lexeme.concept_id
                WHERE lexeme.language_code = %s
                  AND source_concept.concept_type IN ('word', 'phrase')
                  AND form.normalized_form >= %s AND form.normalized_form < %s
                  AND form.normalized_form LIKE %s ESCAPE '\\'
                  AND {allowed_record_sql("source_concept.source_record_id")}
                  AND {allowed_record_sql("lexeme.source_record_id")}
                  AND {allowed_record_sql("form.source_record_id")}
            ), matched AS (
                SELECT concept_id, min(normalized_form) AS normalized_form
                FROM candidate_forms GROUP BY concept_id
            )
            SELECT concept.id, canonical.lemma, canonical.part_of_speech,
                   framework.code, level.code, level.label,
                   COALESCE(state.status, 'unseen'),
                   CASE WHEN review.status = 'active' AND memory.due_at <= %s
                        THEN true ELSE false END,
                   matched.normalized_form
            FROM matched
            JOIN concepts AS concept ON concept.id = matched.concept_id
            LEFT JOIN user_concept_states AS state
              ON state.user_id = %s AND state.user_language_id = %s
             AND state.concept_id = concept.id
             AND state.competence_parameter_set_id IS NOT NULL
            LEFT JOIN review_items AS review
              ON review.user_id = %s AND review.user_language_id = %s
             AND review.concept_id = concept.id
            LEFT JOIN fsrs_states AS memory
              ON memory.review_item_id = review.id AND memory.user_id = review.user_id
            LEFT JOIN LATERAL (
                SELECT lexeme.lemma, lexeme.part_of_speech
                FROM lexemes AS lexeme
                WHERE lexeme.concept_id = concept.id
                  AND {allowed_record_sql("lexeme.source_record_id")}
                ORDER BY lexeme.normalized_form, lexeme.id LIMIT 1
            ) AS canonical ON true
            LEFT JOIN LATERAL (
                SELECT mapping.level_id
                FROM framework_mappings AS mapping
                WHERE mapping.concept_id = concept.id
                  AND {allowed_record_sql("mapping.source_record_id")}
                ORDER BY mapping.confidence DESC, mapping.level_id LIMIT 1
            ) AS mapped ON true
            LEFT JOIN proficiency_levels AS level ON level.id = mapped.level_id
            LEFT JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            {filters}
            ORDER BY matched.normalized_form, concept.id
            LIMIT %s
            """,
            [
                *parameters[:8],
                parameters[12],
                *parameters[8:12],
                *parameters[13:],
            ],
        ).fetchall()
        return [_summary(row) for row in rows]


def _summary(row: tuple[object, ...]) -> DictionarySummaryProjection:
    return DictionarySummaryProjection(
        id=_uuid(row[0]),
        canonical_form=str(row[1]),
        part_of_speech=None if row[2] is None else str(row[2]),
        level=(
            None
            if row[3] is None
            else ProficiencyLevelProjection(str(row[3]), str(row[4]), str(row[5]))
        ),
        status=ConceptStatus(str(row[6])),
        is_due=bool(row[7]),
        matched_normalized_form=str(row[8]),
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
