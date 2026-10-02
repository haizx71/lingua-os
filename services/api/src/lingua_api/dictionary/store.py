"""Bounded PostgreSQL Dictionary catalog read model."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import cast
from uuid import UUID

from lingua_api.brain.domain import ProficiencyLevelProjection
from lingua_api.brain.store import (
    BrainProjectionUnavailable,
    BrainSnapshot,
    PostgresBrainStore,
)
from lingua_api.catalog.sql import allowed_record_sql
from lingua_api.competence.domain import ConceptStatus
from lingua_api.dictionary.cursor import DictionaryCursor
from lingua_api.dictionary.domain import (
    DictionaryLemmaGroupProjection,
    DictionaryLinkedConceptProjection,
    DictionarySenseProjection,
    DictionarySummaryProjection,
)

_MATCHING_CTES = f"""
matching_lexeme_forms AS (
    SELECT lexeme.id AS lexeme_id, lexeme.concept_id AS direct_concept_id,
           lexeme.language_code, lexeme.source_record_id, lexeme.normalized_form AS matched_form
    FROM lexemes AS lexeme
    WHERE lexeme.language_code = %s
      AND lexeme.normalized_form >= %s AND lexeme.normalized_form < %s
      AND lexeme.normalized_form LIKE %s ESCAPE '\\'
      AND {allowed_record_sql("lexeme.source_record_id")}
    UNION
    SELECT lexeme.id AS lexeme_id, lexeme.concept_id AS direct_concept_id,
           lexeme.language_code, lexeme.source_record_id, form.normalized_form AS matched_form
    FROM lexeme_forms AS form
    JOIN lexemes AS lexeme ON lexeme.id = form.lexeme_id
    WHERE lexeme.language_code = %s
      AND form.normalized_form >= %s AND form.normalized_form < %s
      AND form.normalized_form LIKE %s ESCAPE '\\'
      AND {allowed_record_sql("lexeme.source_record_id")}
      AND {allowed_record_sql("form.source_record_id")}
), candidate_forms AS (
    SELECT linked.id AS concept_id, matched.lexeme_id, matched.matched_form
    FROM matching_lexeme_forms AS matched
    JOIN word_senses AS sense ON sense.lexeme_id = matched.lexeme_id
    JOIN concept_senses AS bridge ON bridge.word_sense_id = sense.id
    JOIN concepts AS linked ON linked.id = bridge.concept_id
    WHERE linked.language_code = matched.language_code
      AND linked.concept_type IN ('word', 'phrase')
      AND {allowed_record_sql("sense.source_record_id")}
      AND {allowed_record_sql("linked.source_record_id")}
    UNION
    SELECT matched.direct_concept_id, matched.lexeme_id, matched.matched_form
    FROM matching_lexeme_forms AS matched
    JOIN concepts AS linked ON linked.id = matched.direct_concept_id
    WHERE linked.language_code = matched.language_code
      AND linked.concept_type IN ('word', 'phrase')
      AND {allowed_record_sql("linked.source_record_id")}
      AND NOT EXISTS (
          SELECT 1 FROM concept_senses AS bridge
          WHERE bridge.concept_id = linked.id
      )
)
"""


@dataclass
class _SenseBuilder:
    id: UUID
    order: int
    definition: str
    definition_language_code: str
    translated_definition: str | None
    translation_language_code: str | None
    concept_ids: set[UUID] = field(default_factory=set)


@dataclass
class _LemmaBuilder:
    id: UUID
    lemma: str
    part_of_speech: str | None
    matched_forms: tuple[str, ...]
    senses: dict[UUID, _SenseBuilder] = field(default_factory=dict)


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
        parameters: list[object] = _matching_parameters(language_code, query)
        parameters.extend(
            (
                snapshot.as_of,
                snapshot.actor.id,
                profile_id,
                snapshot.actor.id,
                profile_id,
            )
        )
        if boundary is not None:
            filters = "WHERE (matched.normalized_form, concept.id) > (%s, %s)"
            parameters.extend((boundary.matched_normalized_form, boundary.concept_id))
        parameters.append(limit)
        rows = snapshot.connection.execute(
            f"""
            WITH {_MATCHING_CTES}, matched AS (
                SELECT concept_id, min(matched_form) AS normalized_form
                FROM candidate_forms
                GROUP BY concept_id
            )
            SELECT concept.id, COALESCE(canonical.lemma, concept.canonical_key),
                   canonical.part_of_speech,
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
                SELECT candidate.lemma, candidate.part_of_speech
                FROM (
                    SELECT direct.lemma, direct.part_of_speech, 0 AS preference,
                           direct.normalized_form, direct.id
                    FROM lexemes AS direct
                    WHERE direct.concept_id = concept.id
                      AND direct.language_code = concept.language_code
                      AND {allowed_record_sql("direct.source_record_id")}
                    UNION ALL
                    SELECT linked.lemma, linked.part_of_speech, 1 AS preference,
                           linked.normalized_form, linked.id
                    FROM concept_senses AS bridge
                    JOIN word_senses AS sense ON sense.id = bridge.word_sense_id
                    JOIN lexemes AS linked ON linked.id = sense.lexeme_id
                    WHERE bridge.concept_id = concept.id
                      AND linked.language_code = concept.language_code
                      AND {allowed_record_sql("sense.source_record_id")}
                      AND {allowed_record_sql("linked.source_record_id")}
                ) AS candidate
                ORDER BY candidate.preference, candidate.normalized_form, candidate.id
                LIMIT 1
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
            parameters,
        ).fetchall()
        return [_summary(row) for row in rows]

    @staticmethod
    def load_lemma_groups(
        snapshot: BrainSnapshot,
        *,
        profile_id: UUID,
        language_code: str,
        query: str,
        concept_ids: set[UUID],
    ) -> list[DictionaryLemmaGroupProjection]:
        if not concept_ids:
            return []
        rows = snapshot.connection.execute(
            f"""
            WITH {_MATCHING_CTES}, selected_lexemes AS (
                SELECT lexeme_id,
                       array_agg(DISTINCT matched_form ORDER BY matched_form) AS matched_forms
                FROM candidate_forms
                WHERE concept_id = ANY(%s)
                GROUP BY lexeme_id
            ), approved_senses AS (
                SELECT lexeme.id AS lexeme_id, lexeme.normalized_form,
                       sense.id AS sense_id, sense.sense_order, sense.definition,
                       sense.definition_language_code, sense.translated_definition,
                       sense.translation_language_code
                FROM selected_lexemes AS selected
                JOIN lexemes AS lexeme ON lexeme.id = selected.lexeme_id
                JOIN word_senses AS sense ON sense.lexeme_id = lexeme.id
                WHERE {allowed_record_sql("lexeme.source_record_id")}
                  AND {allowed_record_sql("sense.source_record_id")}
            ), sense_concepts AS (
                SELECT sense.lexeme_id, sense.sense_id, linked.id AS concept_id
                FROM approved_senses AS sense
                JOIN concept_senses AS bridge ON bridge.word_sense_id = sense.sense_id
                JOIN concepts AS linked ON linked.id = bridge.concept_id
                WHERE linked.language_code = %s
                  AND linked.concept_type IN ('word', 'phrase')
                  AND {allowed_record_sql("linked.source_record_id")}
                UNION
                SELECT sense.lexeme_id, sense.sense_id, owner.id AS concept_id
                FROM approved_senses AS sense
                JOIN lexemes AS lexeme ON lexeme.id = sense.lexeme_id
                JOIN concepts AS owner ON owner.id = lexeme.concept_id
                WHERE owner.language_code = %s
                  AND owner.concept_type IN ('word', 'phrase')
                  AND {allowed_record_sql("owner.source_record_id")}
                  AND NOT EXISTS (
                      SELECT 1 FROM concept_senses AS bridge
                      WHERE bridge.concept_id = owner.id
                  )
            )
            SELECT lexeme.id, lexeme.lemma, lexeme.part_of_speech,
                   selected.matched_forms, sense.sense_id, sense.sense_order,
                   sense.definition, sense.definition_language_code,
                   sense.translated_definition, sense.translation_language_code,
                   linked.concept_id
            FROM selected_lexemes AS selected
            JOIN lexemes AS lexeme ON lexeme.id = selected.lexeme_id
            LEFT JOIN approved_senses AS sense ON sense.lexeme_id = lexeme.id
            LEFT JOIN sense_concepts AS linked
              ON linked.lexeme_id = sense.lexeme_id AND linked.sense_id = sense.sense_id
            WHERE {allowed_record_sql("lexeme.source_record_id")}
            ORDER BY lexeme.id, sense.sense_order, sense.sense_id, linked.concept_id
            """,
            [
                *_matching_parameters(language_code, query),
                list(concept_ids),
                language_code,
                language_code,
            ],
        ).fetchall()

        builders: dict[UUID, _LemmaBuilder] = {}
        linked_concept_ids: set[UUID] = set()
        for row in rows:
            lexeme_id = _uuid(row[0])
            group = builders.setdefault(
                lexeme_id,
                _LemmaBuilder(
                    id=lexeme_id,
                    lemma=str(row[1]),
                    part_of_speech=None if row[2] is None else str(row[2]),
                    matched_forms=tuple(str(form) for form in cast(list[object], row[3])),
                ),
            )
            if row[4] is None:
                continue
            sense_id = _uuid(row[4])
            sense = group.senses.setdefault(
                sense_id,
                _SenseBuilder(
                    id=sense_id,
                    order=int(cast(int, row[5])),
                    definition=str(row[6]),
                    definition_language_code=str(row[7]),
                    translated_definition=None if row[8] is None else str(row[8]),
                    translation_language_code=None if row[9] is None else str(row[9]),
                ),
            )
            if row[10] is not None:
                linked_id = _uuid(row[10])
                sense.concept_ids.add(linked_id)
                linked_concept_ids.add(linked_id)

        brain_summaries = PostgresBrainStore.load_concept_summaries(
            snapshot, profile_id=profile_id, concept_ids=linked_concept_ids
        )
        missing_ids = linked_concept_ids.difference(brain_summaries)
        if missing_ids:
            raise BrainProjectionUnavailable(
                "approved Dictionary linked concepts could not be projected"
            )

        return [
            DictionaryLemmaGroupProjection(
                lexeme_id=group.id,
                lemma=group.lemma,
                part_of_speech=group.part_of_speech,
                matched_forms=group.matched_forms,
                senses=tuple(
                    DictionarySenseProjection(
                        id=sense.id,
                        order=sense.order,
                        definition=sense.definition,
                        definition_language_code=sense.definition_language_code,
                        translated_definition=sense.translated_definition,
                        translation_language_code=sense.translation_language_code,
                        concepts=tuple(
                            DictionaryLinkedConceptProjection(
                                item=brain_summaries[concept_id][0],
                                is_saved=brain_summaries[concept_id][1],
                            )
                            for concept_id in sorted(sense.concept_ids)
                        ),
                    )
                    for sense in sorted(
                        group.senses.values(), key=lambda item: (item.order, item.id)
                    )
                ),
            )
            for group in sorted(builders.values(), key=lambda item: item.id)
        ]


def _matching_parameters(language_code: str, query: str) -> list[object]:
    return [
        language_code,
        query,
        f"{query}\U0010ffff",
        f"{_escape_like(query)}%",
        language_code,
        query,
        f"{query}\U0010ffff",
        f"{_escape_like(query)}%",
    ]


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
