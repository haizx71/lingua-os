"""Bounded PostgreSQL read model for Language Brain v1."""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

import psycopg
from psycopg import Connection, Cursor

from lingua_api.brain.cursor import BrainCursor
from lingua_api.brain.domain import (
    AttributionProjection,
    BrainConceptDetailProjection,
    BrainConceptListItem,
    BrainConceptProjection,
    BrainSummaryProjection,
    ConceptIdentityProjection,
    DefinitionProjection,
    EvidenceProjection,
    ExampleProjection,
    GrammarSpecificationProjection,
    GrammarStructuralSlotProjection,
    MemoryProjection,
    ProficiencyLevelProjection,
    RelationProjection,
)
from lingua_api.catalog.sql import allowed_record_sql
from lingua_api.competence.domain import (
    CompetenceProjection,
    CompetenceScoreProjection,
    ConceptStatus,
)
from lingua_api.memory.domain import AuthenticatedActor


class BrainNotFound(Exception):
    """The requested profile or visible catalog concept does not exist for the actor."""


class BrainProjectionUnavailable(Exception):
    """Persisted projection data violates the frozen Brain read contract."""


class BrainSnapshot:
    def __init__(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        as_of: datetime,
        cursor: Cursor[tuple[object, ...]] | None = None,
    ) -> None:
        self.connection = connection
        self.actor = actor
        self.as_of = as_of
        self._cursor = cursor

    @property
    def cursor(self) -> Cursor[tuple[object, ...]]:
        if self._cursor is None:
            self._cursor = self.connection.cursor()
        return self._cursor

    @cursor.setter
    def cursor(self, value: Cursor[tuple[object, ...]] | None) -> None:
        self._cursor = value

    def execute(
        self,
        query: str,
        params: Sequence[object] | Mapping[str, object] | None = None,
    ) -> Cursor[tuple[object, ...]]:
        if self._cursor is not None:
            return self._cursor.execute(query, params)
        return self.connection.execute(query, params)


class PostgresBrainStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    def connect(self) -> Connection[tuple[object, ...]]:
        return cast(Connection[tuple[object, ...]], psycopg.connect(self._database_url))

    @contextmanager
    def snapshot(self, *, actor: AuthenticatedActor) -> Iterator[BrainSnapshot]:
        with self.connect() as connection:
            connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            with connection.cursor() as cursor:
                row = cursor.execute("SELECT transaction_timestamp()").fetchone()
                if row is None or not isinstance(row[0], datetime):
                    raise BrainProjectionUnavailable("database snapshot timestamp is unavailable")
                yield BrainSnapshot(connection, actor=actor, as_of=_datetime(row[0]), cursor=cursor)

    @staticmethod
    def resolve_profile(snapshot: BrainSnapshot, requested_id: UUID | None) -> UUID:
        if requested_id is None:
            row = snapshot.execute(
                """
                SELECT id FROM user_languages
                WHERE user_id = %s AND language_code = 'en'
                  AND native_language_code = 'vi' AND status = 'active'
                ORDER BY created_at, id
                LIMIT 1
                """,
                (snapshot.actor.id,),
            ).fetchone()
        else:
            row = snapshot.execute(
                """
                SELECT id FROM user_languages
                WHERE id = %s AND user_id = %s AND language_code = 'en'
                  AND native_language_code = 'vi' AND status = 'active'
                """,
                (requested_id, snapshot.actor.id),
            ).fetchone()
        if row is None:
            raise BrainNotFound("active English learner profile was not found")
        return _uuid(row[0])

    @staticmethod
    def load_summary(snapshot: BrainSnapshot, profile_id: UUID) -> BrainSummaryProjection:
        status_rows = snapshot.execute(
            f"""
            WITH anchors AS ({_ANCHOR_SQL}), projected AS (
                SELECT COALESCE(retrievability.effective_status, state.status, 'unseen') AS status
                FROM anchors
                JOIN concepts AS concept ON concept.id = anchors.concept_id
                LEFT JOIN user_concept_states AS state
                  ON state.user_id = %s AND state.user_language_id = %s
                 AND state.concept_id = anchors.concept_id
                 AND state.competence_parameter_set_id IS NOT NULL
                LEFT JOIN v_learner_concept_retrievability AS retrievability
                  ON retrievability.user_id = state.user_id
                 AND retrievability.user_language_id = state.user_language_id
                 AND retrievability.concept_id = state.concept_id
                WHERE concept.language_code = 'en'
                  AND {allowed_record_sql("concept.source_record_id")}
            )
            SELECT status, count(*) FROM projected GROUP BY status
            """,
            [
                *_anchor_parameters(snapshot.actor.id, profile_id),
                snapshot.actor.id,
                profile_id,
            ],
        ).fetchall()
        counts = {status: 0 for status in ConceptStatus}
        for raw_status, raw_count in status_rows:
            try:
                counts[ConceptStatus(str(raw_status))] = int(cast(int, raw_count))
            except ValueError as error:
                raise BrainProjectionUnavailable("invalid concept status projection") from error

        due_row = snapshot.execute(
            f"""
            SELECT count(*)
            FROM review_items AS item
            JOIN fsrs_states AS state ON state.review_item_id = item.id
            JOIN concepts AS concept ON concept.id = item.concept_id
            WHERE item.user_id = %s AND item.user_language_id = %s
              AND item.language_code = 'en' AND item.status = 'active'
              AND state.user_id = %s AND state.due_at <= %s
              AND {allowed_record_sql("concept.source_record_id")}
            """,
            (snapshot.actor.id, profile_id, snapshot.actor.id, snapshot.as_of),
        ).fetchone()
        due_count = 0 if due_row is None else int(cast(int, due_row[0]))

        competence = _load_skill_competence(snapshot, profile_id)
        recent = _load_recent(snapshot, profile_id)
        return BrainSummaryProjection(
            language_profile_id=profile_id,
            status_counts=counts,
            due_count=due_count,
            competence=competence,
            starting_level_estimate=None,
            recent_concepts=tuple(recent),
            calculated_at=snapshot.as_of,
        )

    @staticmethod
    def list_concepts(
        snapshot: BrainSnapshot,
        *,
        profile_id: UUID,
        status: ConceptStatus | None,
        query: str | None,
        boundary: BrainCursor | None,
        limit: int,
    ) -> list[BrainConceptListItem]:
        filters: list[str] = []
        parameters = _anchor_parameters(snapshot.actor.id, profile_id)
        parameters.extend((snapshot.actor.id, profile_id, snapshot.actor.id, profile_id))
        if status is not None:
            filters.append("COALESCE(retrievability.effective_status, state.status, 'unseen') = %s")
            parameters.append(status.value)
        if query is not None:
            filters.append(
                f"(lower(concept.canonical_key) LIKE %s OR EXISTS ("
                "SELECT 1 FROM lexemes AS matched_lexeme "
                "WHERE matched_lexeme.concept_id = concept.id "
                f"AND {allowed_record_sql('matched_lexeme.source_record_id')} "
                "AND lower(matched_lexeme.normalized_form) LIKE %s))"
            )
            prefix = f"{query}%"
            parameters.extend((prefix, prefix))
        if boundary is not None:
            filters.append("(concept.canonical_key, concept.id) > (%s, %s)")
            parameters.extend((boundary.canonical_key, boundary.concept_id))
        where = "" if not filters else "AND " + " AND ".join(filters)
        parameters.append(limit)
        rows = snapshot.execute(
            f"""
            WITH anchors AS ({_ANCHOR_SQL})
            SELECT concept.id, concept.language_code, concept.canonical_key,
                   COALESCE(lexeme.lemma, concept.canonical_key), lexeme.part_of_speech,
                   framework.code, level.code, level.label,
                   source.name, license.code, source.attribution_text, source.source_url,
                   license.attribution_required,
                   COALESCE(retrievability.effective_status, state.status),
                   state.competence_parameter_set_id,
                   state.recognition, state.recognition_confidence,
                   state.recognition_evidence_count, state.recognition_last_evidence_at,
                   state.listening, state.listening_confidence,
                   state.listening_evidence_count, state.listening_last_evidence_at,
                   state.production, state.production_confidence,
                   state.production_evidence_count, state.production_last_evidence_at,
                   state.mastery, state.confidence, state.exposure_count, state.last_seen_at,
                   memory.state, memory.due_at, memory.last_review_at,
                   CASE WHEN item.status = 'active' AND memory.due_at <= %s THEN true ELSE false END
            FROM anchors
            JOIN concepts AS concept ON concept.id = anchors.concept_id
            JOIN source_records AS concept_record ON concept_record.id = concept.source_record_id
            JOIN data_sources AS source ON source.id = concept_record.source_id
            JOIN licenses AS license ON license.id = source.license_id
            LEFT JOIN user_concept_states AS state
              ON state.user_id = %s AND state.user_language_id = %s
             AND state.concept_id = concept.id
             AND state.competence_parameter_set_id IS NOT NULL
            LEFT JOIN v_learner_concept_retrievability AS retrievability
              ON retrievability.user_id = state.user_id
             AND retrievability.user_language_id = state.user_language_id
             AND retrievability.concept_id = state.concept_id
            LEFT JOIN review_items AS item
              ON item.user_id = %s AND item.concept_id = concept.id
             AND item.user_language_id = %s
            LEFT JOIN fsrs_states AS memory
              ON memory.review_item_id = item.id AND memory.user_id = item.user_id
            LEFT JOIN LATERAL ({_LEXEME_SQL}) AS lexeme ON true
            LEFT JOIN LATERAL ({_LEVEL_SQL}) AS mapped ON true
            LEFT JOIN proficiency_levels AS level ON level.id = mapped.level_id
            LEFT JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            WHERE concept.language_code = 'en'
              AND {allowed_record_sql("concept.source_record_id")}
              {where}
            ORDER BY concept.canonical_key, concept.id
            LIMIT %s
            """,
            [
                *parameters[:6],
                snapshot.as_of,
                *parameters[6:-1],
                parameters[-1],
            ],
        ).fetchall()
        return [_list_item(row) for row in rows]

    @staticmethod
    def load_detail(
        snapshot: BrainSnapshot, *, profile_id: UUID, concept_id: UUID
    ) -> BrainConceptDetailProjection:
        row = snapshot.execute(
            f"""
            SELECT concept.id, concept.language_code, concept.canonical_key,
                   COALESCE(lexeme.lemma, concept.canonical_key), lexeme.part_of_speech,
                   framework.code, level.code, level.label,
                   source.name, license.code, source.attribution_text, source.source_url,
                   license.attribution_required,
                   COALESCE(retrievability.effective_status, state.status),
                   state.competence_parameter_set_id,
                   state.recognition, state.recognition_confidence,
                   state.recognition_evidence_count, state.recognition_last_evidence_at,
                   state.listening, state.listening_confidence,
                   state.listening_evidence_count, state.listening_last_evidence_at,
                   state.production, state.production_confidence,
                   state.production_evidence_count, state.production_last_evidence_at,
                   state.mastery, state.confidence, state.exposure_count, state.last_seen_at,
                   memory.state, memory.due_at, memory.last_review_at,
                   CASE WHEN item.status = 'active' AND memory.due_at <= %s
                        THEN true ELSE false END,
                   COALESCE(review_count.value, 0)
            FROM concepts AS concept
            JOIN source_records AS concept_record ON concept_record.id = concept.source_record_id
            JOIN data_sources AS source ON source.id = concept_record.source_id
            JOIN licenses AS license ON license.id = source.license_id
            LEFT JOIN user_concept_states AS state
              ON state.user_id = %s AND state.user_language_id = %s
             AND state.concept_id = concept.id
             AND state.competence_parameter_set_id IS NOT NULL
            LEFT JOIN v_learner_concept_retrievability AS retrievability
              ON retrievability.user_id = state.user_id
             AND retrievability.user_language_id = state.user_language_id
             AND retrievability.concept_id = state.concept_id
            LEFT JOIN review_items AS item
              ON item.user_id = %s AND item.user_language_id = %s
             AND item.concept_id = concept.id
            LEFT JOIN fsrs_states AS memory
              ON memory.review_item_id = item.id AND memory.user_id = item.user_id
            LEFT JOIN LATERAL (
                SELECT count(*) AS value FROM review_events AS event
                WHERE event.user_id = %s AND event.review_item_id = item.id
            ) AS review_count ON true
            LEFT JOIN LATERAL ({_LEXEME_SQL}) AS lexeme ON true
            LEFT JOIN LATERAL ({_LEVEL_SQL}) AS mapped ON true
            LEFT JOIN proficiency_levels AS level ON level.id = mapped.level_id
            LEFT JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            WHERE concept.id = %s AND concept.language_code = 'en'
              AND {allowed_record_sql("concept.source_record_id")}
            """,
            (
                snapshot.as_of,
                snapshot.actor.id,
                profile_id,
                snapshot.actor.id,
                profile_id,
                snapshot.actor.id,
                concept_id,
            ),
        ).fetchone()
        if row is None:
            raise BrainNotFound("visible English concept was not found")
        item = _list_item(row[:35])
        definitions = _load_definitions(snapshot, concept_id)
        examples = _load_examples(snapshot, concept_id)
        relations = _load_relations(snapshot, concept_id)
        grammar = _load_grammar_specification(snapshot, concept_id)
        learner = item.learner
        evidence = EvidenceProjection(
            exposure_count=learner.exposure_count,
            review_count=int(cast(int, row[35])),
            last_seen_at=learner.last_seen_at,
            last_reviewed_at=None if learner.memory is None else learner.memory.last_reviewed_at,
        )
        return BrainConceptDetailProjection(
            identity=item.identity,
            learner=learner,
            definitions=tuple(definitions),
            examples=tuple(examples),
            relations=tuple(relations),
            grammar=grammar,
            evidence=evidence,
        )

    @staticmethod
    def load_concept_summaries(
        snapshot: BrainSnapshot, *, profile_id: UUID, concept_ids: set[UUID]
    ) -> dict[UUID, tuple[BrainConceptListItem, bool]]:
        """Load actor-scoped Brain projections for linked catalog concepts in one batch."""
        if not concept_ids:
            return {}
        rows = snapshot.execute(
            f"""
            SELECT concept.id, concept.language_code, concept.canonical_key,
                   COALESCE(lexeme.lemma, concept.canonical_key), lexeme.part_of_speech,
                   framework.code, level.code, level.label,
                   source.name, license.code, source.attribution_text, source.source_url,
                   license.attribution_required,
                   COALESCE(retrievability.effective_status, state.status),
                   state.competence_parameter_set_id,
                   state.recognition, state.recognition_confidence,
                   state.recognition_evidence_count, state.recognition_last_evidence_at,
                   state.listening, state.listening_confidence,
                   state.listening_evidence_count, state.listening_last_evidence_at,
                   state.production, state.production_confidence,
                   state.production_evidence_count, state.production_last_evidence_at,
                   state.mastery, state.confidence, state.exposure_count, state.last_seen_at,
                   memory.state, memory.due_at, memory.last_review_at,
                   CASE WHEN item.status = 'active' AND memory.due_at <= %s
                        THEN true ELSE false END,
                   saved.concept_id IS NOT NULL
            FROM concepts AS concept
            JOIN source_records AS concept_record ON concept_record.id = concept.source_record_id
            JOIN data_sources AS source ON source.id = concept_record.source_id
            JOIN licenses AS license ON license.id = source.license_id
            LEFT JOIN user_concept_states AS state
              ON state.user_id = %s AND state.user_language_id = %s
             AND state.concept_id = concept.id
             AND state.competence_parameter_set_id IS NOT NULL
            LEFT JOIN v_learner_concept_retrievability AS retrievability
              ON retrievability.user_id = state.user_id
             AND retrievability.user_language_id = state.user_language_id
             AND retrievability.concept_id = state.concept_id
            LEFT JOIN review_items AS item
              ON item.user_id = %s AND item.user_language_id = %s
             AND item.concept_id = concept.id
            LEFT JOIN fsrs_states AS memory
              ON memory.review_item_id = item.id AND memory.user_id = item.user_id
            LEFT JOIN LATERAL ({_LEXEME_SQL}) AS lexeme ON true
            LEFT JOIN LATERAL ({_LEVEL_SQL}) AS mapped ON true
            LEFT JOIN proficiency_levels AS level ON level.id = mapped.level_id
            LEFT JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
            LEFT JOIN user_saved_concepts AS saved
              ON saved.user_id = %s AND saved.user_language_id = %s
             AND saved.concept_id = concept.id
            WHERE concept.id = ANY(%s) AND concept.language_code = 'en'
              AND {allowed_record_sql("concept.source_record_id")}
            ORDER BY concept.id
            """,
            (
                snapshot.as_of,
                snapshot.actor.id,
                profile_id,
                snapshot.actor.id,
                profile_id,
                snapshot.actor.id,
                profile_id,
                list(concept_ids),
            ),
        ).fetchall()
        return {_uuid(row[0]): (_list_item(row[:35]), bool(row[35])) for row in rows}


_ANCHOR_SQL = """
    SELECT concept_id FROM user_concept_states
    WHERE user_id = %s AND user_language_id = %s AND language_code = 'en'
      AND competence_parameter_set_id IS NOT NULL
      AND (status <> 'unseen' OR exposure_count > 0
           OR has_learning_intent OR has_projectable_evidence)
    UNION
    SELECT concept_id FROM review_items
    WHERE user_id = %s AND user_language_id = %s AND language_code = 'en'
    UNION
    SELECT concept_id FROM user_saved_concepts
    WHERE user_id = %s AND user_language_id = %s AND language_code = 'en'
"""

_LEXEME_SQL = f"""
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
"""

_LEVEL_SQL = f"""
    SELECT mapping.level_id
    FROM framework_mappings AS mapping
    WHERE mapping.concept_id = concept.id
      AND {allowed_record_sql("mapping.source_record_id")}
    ORDER BY mapping.confidence DESC, mapping.level_id
    LIMIT 1
"""


def _anchor_parameters(actor_id: UUID, profile_id: UUID) -> list[object]:
    return [actor_id, profile_id, actor_id, profile_id, actor_id, profile_id]


def _load_skill_competence(snapshot: BrainSnapshot, profile_id: UUID) -> CompetenceProjection:
    rows = snapshot.execute(
        """
        SELECT skill, score, confidence, evidence_count, last_evidence_at
        FROM user_skill_states
        WHERE user_id = %s AND user_language_id = %s
          AND competence_parameter_set_id IS NOT NULL
        """,
        (snapshot.actor.id, profile_id),
    ).fetchall()
    zero = CompetenceProjection.zero()
    scores = {
        "recognition": zero.recognition,
        "listening": zero.listening,
        "production": zero.production,
    }
    for skill, score, confidence, count, updated_at in rows:
        if str(skill) not in scores:
            raise BrainProjectionUnavailable("invalid skill projection")
        scores[str(skill)] = CompetenceScoreProjection(
            score=_float(score),
            confidence=_float(confidence),
            evidence_count=int(cast(int, count)),
            updated_at=_optional_datetime(updated_at),
        )
    return CompetenceProjection(
        recognition=scores["recognition"],
        listening=scores["listening"],
        production=scores["production"],
    )


def _load_recent(snapshot: BrainSnapshot, profile_id: UUID) -> list[BrainConceptListItem]:
    rows = snapshot.execute(
        f"""
        SELECT concept.id, concept.language_code, concept.canonical_key,
               COALESCE(lexeme.lemma, concept.canonical_key), lexeme.part_of_speech,
               framework.code, level.code, level.label,
               source.name, license.code, source.attribution_text, source.source_url,
               license.attribution_required,
               COALESCE(retrievability.effective_status, state.status),
               state.competence_parameter_set_id,
               state.recognition, state.recognition_confidence,
               state.recognition_evidence_count, state.recognition_last_evidence_at,
               state.listening, state.listening_confidence,
               state.listening_evidence_count, state.listening_last_evidence_at,
               state.production, state.production_confidence,
               state.production_evidence_count, state.production_last_evidence_at,
               state.mastery, state.confidence, state.exposure_count, state.last_seen_at,
               memory.state, memory.due_at, memory.last_review_at,
               CASE WHEN item.status = 'active' AND memory.due_at <= %s THEN true ELSE false END
        FROM user_concept_states AS state
        LEFT JOIN v_learner_concept_retrievability AS retrievability
          ON retrievability.user_id = state.user_id
         AND retrievability.user_language_id = state.user_language_id
         AND retrievability.concept_id = state.concept_id
        JOIN concepts AS concept ON concept.id = state.concept_id
        JOIN source_records AS concept_record ON concept_record.id = concept.source_record_id
        JOIN data_sources AS source ON source.id = concept_record.source_id
        JOIN licenses AS license ON license.id = source.license_id
        LEFT JOIN review_items AS item
          ON item.user_id = state.user_id AND item.user_language_id = state.user_language_id
         AND item.concept_id = state.concept_id
        LEFT JOIN fsrs_states AS memory
          ON memory.review_item_id = item.id AND memory.user_id = item.user_id
        LEFT JOIN LATERAL ({_LEXEME_SQL}) AS lexeme ON true
        LEFT JOIN LATERAL ({_LEVEL_SQL}) AS mapped ON true
        LEFT JOIN proficiency_levels AS level ON level.id = mapped.level_id
        LEFT JOIN proficiency_frameworks AS framework ON framework.id = level.framework_id
        WHERE state.user_id = %s AND state.user_language_id = %s
          AND state.language_code = 'en' AND state.competence_parameter_set_id IS NOT NULL
          AND (state.status <> 'unseen' OR state.exposure_count > 0
               OR state.has_learning_intent OR state.has_projectable_evidence)
          AND {allowed_record_sql("concept.source_record_id")}
        ORDER BY state.updated_at DESC, state.concept_id
        LIMIT 10
        """,
        (snapshot.as_of, snapshot.actor.id, profile_id),
    ).fetchall()
    return [_list_item(row) for row in rows]


def _load_definitions(snapshot: BrainSnapshot, concept_id: UUID) -> list[DefinitionProjection]:
    rows = snapshot.execute(
        f"""
        WITH own_senses AS (
            SELECT lexeme.id AS lexeme_id, lexeme.normalized_form,
                   sense.id AS sense_id, sense.definition, sense.translated_definition,
                   sense.definition_language_code, sense.sense_order
            FROM concept_senses AS bridge
            JOIN word_senses AS sense ON sense.id = bridge.word_sense_id
            JOIN lexemes AS lexeme ON lexeme.id = sense.lexeme_id
            JOIN concepts AS concept ON concept.id = bridge.concept_id
            WHERE bridge.concept_id = %s
              AND lexeme.language_code = concept.language_code
              AND {allowed_record_sql("lexeme.source_record_id")}
              AND {allowed_record_sql("sense.source_record_id")}
            UNION ALL
            SELECT lexeme.id AS lexeme_id, lexeme.normalized_form,
                   sense.id AS sense_id, sense.definition, sense.translated_definition,
                   sense.definition_language_code, sense.sense_order
            FROM concepts AS concept
            JOIN lexemes AS lexeme ON lexeme.concept_id = concept.id
            JOIN word_senses AS sense ON sense.lexeme_id = lexeme.id
            WHERE concept.id = %s
              AND lexeme.language_code = concept.language_code
              AND {allowed_record_sql("lexeme.source_record_id")}
              AND {allowed_record_sql("sense.source_record_id")}
              AND NOT EXISTS (
                  SELECT 1 FROM concept_senses AS bridge
                  WHERE bridge.concept_id = concept.id
              )
        )
        SELECT definition, translated_definition, definition_language_code, sense_order
        FROM own_senses
        ORDER BY normalized_form, lexeme_id, sense_order, sense_id
        LIMIT 100
        """,
        (concept_id, concept_id),
    ).fetchall()
    return [
        DefinitionProjection(
            str(row[0]), _optional_text(row[1]), str(row[2]), int(cast(int, row[3]))
        )
        for row in rows
    ]


def _load_examples(snapshot: BrainSnapshot, concept_id: UUID) -> list[ExampleProjection]:
    rows = snapshot.execute(
        f"""
        SELECT DISTINCT ON (sentence.id)
               sentence.id, sentence.text, translation.text, audio.storage_uri
        FROM sentence_concepts AS linked
        JOIN sentences AS sentence ON sentence.id = linked.sentence_id
        LEFT JOIN LATERAL (
            SELECT candidate.text
            FROM sentence_translations AS candidate
            WHERE candidate.sentence_id = sentence.id AND candidate.target_language_code = 'vi'
              AND {allowed_record_sql("candidate.source_record_id")}
            ORDER BY candidate.id LIMIT 1
        ) AS translation ON true
        LEFT JOIN LATERAL (
            SELECT asset.storage_uri
            FROM sentence_audio AS link
            JOIN audio_assets AS asset ON asset.id = link.audio_id
            WHERE link.sentence_id = sentence.id
              AND {allowed_record_sql("asset.source_record_id")}
            ORDER BY asset.id LIMIT 1
        ) AS audio ON true
        WHERE linked.concept_id = %s
          AND {allowed_record_sql("sentence.source_record_id")}
        ORDER BY sentence.id
        LIMIT 50
        """,
        (concept_id,),
    ).fetchall()
    return [
        ExampleProjection(
            _uuid(row[0]), str(row[1]), _optional_text(row[2]), _optional_text(row[3])
        )
        for row in rows
    ]


def _load_relations(snapshot: BrainSnapshot, concept_id: UUID) -> list[RelationProjection]:
    rows = snapshot.execute(
        f"""
        SELECT target.id, relation.relation_type,
               COALESCE(lexeme.lemma, target.canonical_key)
        FROM concept_relations AS relation
        JOIN concepts AS source ON source.id = relation.source_concept_id
        JOIN concepts AS target ON target.id = relation.target_concept_id
        LEFT JOIN LATERAL (
            SELECT candidate.lemma
            FROM (
                SELECT direct.lemma, 0 AS preference, direct.normalized_form, direct.id
                FROM lexemes AS direct
                WHERE direct.concept_id = target.id
                  AND direct.language_code = target.language_code
                  AND {allowed_record_sql("direct.source_record_id")}
                UNION ALL
                SELECT linked.lemma, 1 AS preference, linked.normalized_form, linked.id
                FROM concept_senses AS bridge
                JOIN word_senses AS sense ON sense.id = bridge.word_sense_id
                JOIN lexemes AS linked ON linked.id = sense.lexeme_id
                WHERE bridge.concept_id = target.id
                  AND linked.language_code = target.language_code
                  AND {allowed_record_sql("sense.source_record_id")}
                  AND {allowed_record_sql("linked.source_record_id")}
            ) AS candidate
            ORDER BY candidate.preference, candidate.normalized_form, candidate.id
            LIMIT 1
        ) AS lexeme ON true
        WHERE relation.source_concept_id = %s
          AND source.language_code = 'en' AND target.language_code = 'en'
          AND {allowed_record_sql("relation.source_record_id")}
          AND {allowed_record_sql("source.source_record_id")}
          AND {allowed_record_sql("target.source_record_id")}
        ORDER BY relation.relation_type, target.canonical_key, target.id
        LIMIT 100
        """,
        (concept_id,),
    ).fetchall()
    return [RelationProjection(_uuid(row[0]), str(row[1]), str(row[2])) for row in rows]


def _load_grammar_specification(
    snapshot: BrainSnapshot, concept_id: UUID
) -> GrammarSpecificationProjection | None:
    row = snapshot.execute(
        """
        SELECT grammar.pattern_formula, grammar.syntactic_category,
               grammar.pragmatic_function, grammar.vietnamese_explanation,
               grammar.vietnamese_common_traps, grammar.structural_slots
        FROM grammar_specifications AS grammar
        JOIN concepts AS concept ON concept.id = grammar.concept_id
        WHERE grammar.concept_id = %s AND concept.concept_type = 'grammar'
        """,
        (concept_id,),
    ).fetchone()
    if row is None:
        return None
    pattern_formula = _required_bounded_text(row[0], field="pattern formula", limit=1000)
    syntactic_category = _required_bounded_text(row[1], field="syntactic category", limit=100)
    pragmatic_function = _required_bounded_text(row[2], field="pragmatic function", limit=2000)
    vietnamese_explanation = _required_bounded_text(
        row[3], field="Vietnamese explanation", limit=4000
    )
    vietnamese_common_traps = _optional_bounded_text(
        row[4], field="Vietnamese common traps", limit=4000
    )
    raw_slots = row[5]
    if not isinstance(raw_slots, list) or not 1 <= len(raw_slots) <= 20:
        raise BrainProjectionUnavailable("grammar structural slots are invalid")
    slots: list[GrammarStructuralSlotProjection] = []
    for raw_slot in raw_slots:
        if not isinstance(raw_slot, dict) or set(raw_slot) != {
            "label",
            "role",
            "required",
            "examples",
        }:
            raise BrainProjectionUnavailable("grammar structural slot shape is invalid")
        examples = raw_slot["examples"]
        if (
            not isinstance(raw_slot["label"], str)
            or not raw_slot["label"].strip()
            or len(raw_slot["label"]) > 100
            or not isinstance(raw_slot["role"], str)
            or not raw_slot["role"].strip()
            or len(raw_slot["role"]) > 100
            or not isinstance(raw_slot["required"], bool)
            or not isinstance(examples, list)
            or len(examples) > 10
            or any(not isinstance(value, str) or not value.strip() for value in examples)
        ):
            raise BrainProjectionUnavailable("grammar structural slot content is invalid")
        slots.append(
            GrammarStructuralSlotProjection(
                label=raw_slot["label"],
                role=raw_slot["role"],
                required=raw_slot["required"],
                examples=tuple(examples),
            )
        )
    return GrammarSpecificationProjection(
        pattern_formula=pattern_formula,
        syntactic_category=syntactic_category,
        pragmatic_function=pragmatic_function,
        vietnamese_explanation=vietnamese_explanation,
        vietnamese_common_traps=vietnamese_common_traps,
        structural_slots=tuple(slots),
    )


def _list_item(row: tuple[object, ...]) -> BrainConceptListItem:
    identity = ConceptIdentityProjection(
        id=_uuid(row[0]),
        language_code=str(row[1]),
        canonical_key=str(row[2]),
        canonical_form=str(row[3]),
        part_of_speech=_optional_text(row[4]),
        level=(
            None
            if row[5] is None
            else ProficiencyLevelProjection(str(row[5]), str(row[6]), str(row[7]))
        ),
        attribution=(
            AttributionProjection(str(row[8]), str(row[9]), str(row[10]), _optional_text(row[11]))
            if bool(row[12])
            else None
        ),
    )
    status = ConceptStatus.UNSEEN if row[13] is None else ConceptStatus(str(row[13]))
    competence = _concept_competence(row[14:27])
    memory = (
        None
        if row[31] is None
        else MemoryProjection(
            state=str(row[31]),
            due_at=_datetime(row[32]),
            last_reviewed_at=_optional_datetime(row[33]),
            is_due=bool(row[34]),
        )
    )
    learner = BrainConceptProjection(
        concept_id=identity.id,
        status=status,
        competence=competence,
        mastery=None if row[27] is None else _float(row[27]),
        confidence=0.0 if row[28] is None else _float(row[28]),
        memory=memory,
        exposure_count=0 if row[29] is None else int(cast(int, row[29])),
        last_seen_at=_optional_datetime(row[30]),
    )
    return BrainConceptListItem(identity=identity, learner=learner)


def _concept_competence(values: tuple[object, ...]) -> CompetenceProjection:
    if values[0] is None:
        return CompetenceProjection.zero()
    return CompetenceProjection(
        recognition=_score(values[1:5]),
        listening=_score(values[5:9]),
        production=_score(values[9:13]),
    )


def _score(values: tuple[object, ...]) -> CompetenceScoreProjection:
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
        raise BrainProjectionUnavailable("projection timestamp has an unexpected type")
    if value.tzinfo is None:
        raise BrainProjectionUnavailable("projection timestamp must be timezone-aware")
    return value.astimezone(UTC)


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)


def _optional_text(value: object) -> str | None:
    return None if value is None else str(value)


def _required_bounded_text(value: object, *, field: str, limit: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise BrainProjectionUnavailable(f"grammar {field} is invalid")
    return value


def _optional_bounded_text(value: object, *, field: str, limit: int) -> str | None:
    if value is None:
        return None
    return _required_bounded_text(value, field=field, limit=limit)


def _float(value: object) -> float:
    if not isinstance(value, int | float | Decimal):
        raise BrainProjectionUnavailable("projection score has an unexpected type")
    return float(value)
