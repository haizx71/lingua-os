"""PostgreSQL persistence primitives for competence projections and replay."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

from lingua_api.competence.domain import (
    CompetenceDimension,
    CompetenceParameters,
    CompetenceProjection,
    CompetenceScoreProjection,
    ConceptProjection,
    ConceptStatus,
    ConceptType,
    DerivedConceptProjection,
    DimensionProjection,
    MasteryPolicy,
    ProjectionHistory,
    StatusThresholds,
)
from lingua_api.memory.domain import AuthenticatedActor, MemoryConfigurationError

DEFAULT_PARAMETER_SET_ID = UUID("00000000-0000-4000-8600-000000000002")
METHOD_VERSION = "competence-beta-v1"


@dataclass(frozen=True)
class ProjectionContext:
    actor_id: UUID
    user_language_id: UUID
    concept_id: UUID
    language_code: str
    concept_type: ConceptType
    ingestion_sequence: int
    parameter_set_id: UUID
    parameter_version: str
    parameters: CompetenceParameters
    concept: ConceptProjection
    history: ProjectionHistory
    policy: MasteryPolicy | None
    concept_state_version: int
    exposure_count: int
    last_seen_at: datetime | None
    skill_states: dict[CompetenceDimension, DimensionProjection]
    skill_state_versions: dict[CompetenceDimension, int]


@dataclass(frozen=True)
class ReplayEvent:
    concept_id: UUID
    concept_type: ConceptType
    event_type: str
    payload: dict[str, object]
    ingested_at: datetime
    ingestion_sequence: int
    policy: MasteryPolicy | None


class PostgresCompetenceStore:
    @staticmethod
    def find_learning_derivation(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        source_type: str,
        source_event_id: UUID,
        derivation_key: str,
    ) -> str | None:
        row = connection.execute(
            """
            SELECT request_fingerprint
            FROM learning_events
            WHERE user_id = %s AND source_type = %s
              AND source_event_id = %s AND derivation_key = %s
            """,
            (actor.id, source_type, source_event_id, derivation_key),
        ).fetchone()
        return None if row is None else str(row[0])

    @staticmethod
    def lock_projection_context(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        concept_id: UUID,
        at: datetime,
    ) -> ProjectionContext:
        connection.execute(
            """
            INSERT INTO user_language_projection_heads
                (user_language_id, user_id, parameter_set_id, parameter_version,
                 created_at, updated_at)
            SELECT profile.id, profile.user_id, parameter.id, parameter.version, %s, %s
            FROM user_languages AS profile
            CROSS JOIN competence_parameter_sets AS parameter
            WHERE profile.id = %s AND profile.user_id = %s
              AND profile.language_code = 'en' AND parameter.is_default
            ON CONFLICT (user_language_id) DO NOTHING
            """,
            (at, at, user_language_id, actor.id),
        )
        head = connection.execute(
            """
            SELECT head.next_ingestion_sequence, head.parameter_set_id,
                   head.parameter_version, profile.language_code, parameter.parameters
            FROM user_language_projection_heads AS head
            JOIN user_languages AS profile
              ON profile.id = head.user_language_id AND profile.user_id = head.user_id
            JOIN competence_parameter_sets AS parameter
              ON parameter.id = head.parameter_set_id
             AND parameter.version = head.parameter_version
            WHERE head.user_language_id = %s AND head.user_id = %s
            FOR UPDATE OF head
            """,
            (user_language_id, actor.id),
        ).fetchone()
        if head is None:
            raise MemoryConfigurationError("owned competence projection head is unavailable")
        sequence = int(cast(int, head[0]))
        parameter_set_id = _uuid(head[1])
        parameter_version = str(head[2])
        language_code = str(head[3])
        parameters = _parameters(parameter_version, cast(dict[str, object], head[4]))

        connection.execute(
            """
            INSERT INTO user_skill_states
                (user_id, user_language_id, skill, score, confidence, evidence_count,
                 assessed_at, method_version, positive_mass, negative_mass,
                 state_version, competence_parameter_set_id,
                 competence_parameter_version, created_at, updated_at)
            SELECT %s, %s, skill, 0.5, 0, 0, %s, %s, 0, 0, 1, %s, %s, %s, %s
            FROM (VALUES ('recognition'), ('listening'), ('production')) AS dimensions(skill)
            ON CONFLICT (user_language_id, skill) DO NOTHING
            """,
            (
                actor.id,
                user_language_id,
                at,
                METHOD_VERSION,
                parameter_set_id,
                parameter_version,
                at,
                at,
            ),
        )
        connection.execute(
            """
            UPDATE user_skill_states
            SET score = 0.5, confidence = 0, evidence_count = 0,
                positive_mass = 0, negative_mass = 0, last_evidence_at = NULL,
                assessed_at = %s, method_version = %s, state_version = state_version + 1,
                competence_parameter_set_id = %s, competence_parameter_version = %s,
                updated_at = %s
            WHERE user_id = %s AND user_language_id = %s
              AND competence_parameter_set_id IS NULL
            """,
            (
                at,
                METHOD_VERSION,
                parameter_set_id,
                parameter_version,
                at,
                actor.id,
                user_language_id,
            ),
        )
        skill_rows = connection.execute(
            """
            SELECT skill, positive_mass, negative_mass, evidence_count,
                   last_evidence_at, state_version
            FROM user_skill_states
            WHERE user_id = %s AND user_language_id = %s
            ORDER BY skill
            FOR UPDATE
            """,
            (actor.id, user_language_id),
        ).fetchall()
        if len(skill_rows) != 3:
            raise MemoryConfigurationError("language competence dimensions are incomplete")

        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, language_code, status,
                 recognition, listening, production, mastery, confidence,
                 state_version, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version,
                 created_at, updated_at)
            SELECT %s, profile.id, concept.id, profile.language_code, 'unseen',
                   0.5, 0.5, 0.5, NULL, 0, 1, %s, %s, %s, %s, %s
            FROM user_languages AS profile
            JOIN concepts AS concept ON concept.id = %s
             AND concept.language_code = profile.language_code
            WHERE profile.id = %s AND profile.user_id = %s
            ON CONFLICT (user_id, concept_id) DO NOTHING
            """,
            (
                actor.id,
                METHOD_VERSION,
                parameter_set_id,
                parameter_version,
                at,
                at,
                concept_id,
                user_language_id,
                actor.id,
            ),
        )
        connection.execute(
            """
            UPDATE user_concept_states
            SET recognition = 0.5, listening = 0.5, production = 0.5,
                mastery = NULL, confidence = 0,
                recognition_positive_mass = 0, recognition_negative_mass = 0,
                recognition_confidence = 0, recognition_evidence_count = 0,
                recognition_last_evidence_at = NULL,
                listening_positive_mass = 0, listening_negative_mass = 0,
                listening_confidence = 0, listening_evidence_count = 0,
                listening_last_evidence_at = NULL,
                production_positive_mass = 0, production_negative_mass = 0,
                production_confidence = 0, production_evidence_count = 0,
                production_last_evidence_at = NULL,
                recent_competence_outcomes =
                    '{"recognition":[],"listening":[],"production":[]}'::jsonb,
                has_projectable_evidence = false, highest_achievement_status = NULL,
                status = CASE WHEN exposure_count > 0 THEN 'discovered' ELSE 'unseen' END,
                projection_method_version = %s,
                competence_parameter_set_id = %s, competence_parameter_version = %s,
                state_version = state_version + 1, updated_at = %s
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
              AND competence_parameter_set_id IS NULL
            """,
            (
                METHOD_VERSION,
                parameter_set_id,
                parameter_version,
                at,
                actor.id,
                user_language_id,
                concept_id,
            ),
        )
        concept_row = connection.execute(
            """
            SELECT concept.concept_type,
                   state.recognition_positive_mass, state.recognition_negative_mass,
                   state.recognition_evidence_count, state.recognition_last_evidence_at,
                   state.listening_positive_mass, state.listening_negative_mass,
                   state.listening_evidence_count, state.listening_last_evidence_at,
                   state.production_positive_mass, state.production_negative_mass,
                   state.production_evidence_count, state.production_last_evidence_at,
                   state.recent_competence_outcomes, state.exposure_count, state.last_seen_at,
                   state.has_learning_intent, state.has_projectable_evidence,
                   state.highest_achievement_status, state.state_version,
                   policy.recognition_weight, policy.listening_weight,
                   policy.production_weight
            FROM user_concept_states AS state
            JOIN concepts AS concept ON concept.id = state.concept_id
            LEFT JOIN concept_competence_policies AS policy
              ON policy.concept_id = state.concept_id
             AND policy.parameter_set_id = state.competence_parameter_set_id
             AND policy.parameter_version = state.competence_parameter_version
            WHERE state.user_id = %s AND state.user_language_id = %s
              AND state.concept_id = %s
            FOR UPDATE OF state
            """,
            (actor.id, user_language_id, concept_id),
        ).fetchone()
        if concept_row is None:
            raise MemoryConfigurationError("owned concept projection is unavailable")
        connection.execute(
            """
            UPDATE user_language_projection_heads
            SET next_ingestion_sequence = next_ingestion_sequence + 1,
                state_version = state_version + 1, updated_at = %s
            WHERE user_language_id = %s AND user_id = %s
            """,
            (at, user_language_id, actor.id),
        )
        return _context(
            actor=actor,
            user_language_id=user_language_id,
            concept_id=concept_id,
            language_code=language_code,
            sequence=sequence,
            parameter_set_id=parameter_set_id,
            parameter_version=parameter_version,
            parameters=parameters,
            concept_row=concept_row,
            skill_rows=skill_rows,
        )

    @staticmethod
    def append_learning_event(
        connection: Connection[tuple[object, ...]],
        *,
        learning_event_id: UUID,
        context: ProjectionContext,
        source_event_id: UUID,
        derivation_key: str,
        request_fingerprint: str,
        idempotency_key: str,
        payload: dict[str, object],
        event_type: str,
        source_type: str,
        occurred_at: datetime,
        ingested_at: datetime,
    ) -> None:
        connection.execute(
            """
            INSERT INTO learning_events
                (learning_event_id, user_id, user_language_id, language_code,
                 event_type, concept_id, payload, schema_version, idempotency_key,
                 occurred_at, created_at, source_type, source_event_id, derivation_key,
                 request_fingerprint, ingestion_sequence, ingested_at,
                 projection_method_version, competence_parameter_set_id,
                 competence_parameter_version)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                learning_event_id,
                context.actor_id,
                context.user_language_id,
                context.language_code,
                event_type,
                context.concept_id,
                Jsonb(payload),
                idempotency_key,
                occurred_at,
                ingested_at,
                source_type,
                source_event_id,
                derivation_key,
                request_fingerprint,
                context.ingestion_sequence,
                ingested_at,
                METHOD_VERSION,
                context.parameter_set_id,
                context.parameter_version,
            ),
        )

    @staticmethod
    def lock_exposure_source(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: UUID,
    ) -> tuple[UUID, UUID, str, str, datetime]:
        row = connection.execute(
            """
            SELECT user_language_id, concept_id, exposure_type, idempotency_key, occurred_at
            FROM exposure_events
            WHERE id = %s AND user_id = %s AND concept_id IS NOT NULL
              AND exposure_type IN ('read', 'listen', 'lookup')
            FOR UPDATE
            """,
            (exposure_event_id, actor.id),
        ).fetchone()
        if row is None:
            raise MemoryConfigurationError("owned passive exposure source is unavailable")
        return _uuid(row[0]), _uuid(row[1]), str(row[2]), str(row[3]), _datetime(row[4])

    @staticmethod
    def lock_reader_exposure_source(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: UUID,
        concept_id: UUID,
    ) -> tuple[UUID, UUID, str, str, datetime]:
        row = connection.execute(
            """
            SELECT exposure.user_language_id, link.concept_id, exposure.exposure_type,
                   exposure.idempotency_key, exposure.occurred_at
            FROM exposure_events AS exposure
            JOIN reader_exposure_concepts AS link
              ON link.exposure_event_id = exposure.id
             AND link.user_id = exposure.user_id
             AND link.user_language_id = exposure.user_language_id
             AND link.language_code = exposure.language_code
            WHERE exposure.id = %s AND exposure.user_id = %s
              AND link.concept_id = %s
              AND exposure.concept_id IS NULL
              AND exposure.exposure_type IN ('read', 'listen', 'lookup')
            FOR UPDATE OF exposure
            """,
            (exposure_event_id, actor.id, concept_id),
        ).fetchone()
        if row is None:
            raise MemoryConfigurationError("owned Reader passive exposure source is unavailable")
        return _uuid(row[0]), _uuid(row[1]), str(row[2]), str(row[3]), _datetime(row[4])

    @staticmethod
    def update_passive_concept(
        connection: Connection[tuple[object, ...]],
        *,
        context: ProjectionContext,
        status: ConceptStatus,
        at: datetime,
    ) -> None:
        cursor = connection.execute(
            """
            UPDATE user_concept_states
            SET exposure_count = exposure_count + 1, last_seen_at = %s,
                status = %s, state_version = state_version + 1, updated_at = %s
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
              AND state_version = %s AND competence_parameter_set_id = %s
              AND competence_parameter_version = %s
            """,
            (
                at,
                status.value,
                at,
                context.actor_id,
                context.user_language_id,
                context.concept_id,
                context.concept_state_version,
                context.parameter_set_id,
                context.parameter_version,
            ),
        )
        if cursor.rowcount != 1:
            raise MemoryConfigurationError("passive concept state version did not update")

    @staticmethod
    def update_concept_save_intent(
        connection: Connection[tuple[object, ...]],
        *,
        context: ProjectionContext,
        status: ConceptStatus,
        at: datetime,
    ) -> None:
        cursor = connection.execute(
            """
            UPDATE user_concept_states
            SET has_learning_intent = true,
                status = %s,
                state_version = state_version + 1,
                updated_at = %s
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
              AND state_version = %s AND competence_parameter_set_id = %s
              AND competence_parameter_version = %s
            """,
            (
                status.value,
                at,
                context.actor_id,
                context.user_language_id,
                context.concept_id,
                context.concept_state_version,
                context.parameter_set_id,
                context.parameter_version,
            ),
        )
        if cursor.rowcount != 1:
            raise MemoryConfigurationError("concept save intent state version did not update")

    @staticmethod
    def update_skill(
        connection: Connection[tuple[object, ...]],
        *,
        context: ProjectionContext,
        dimension: CompetenceDimension,
        state: DimensionProjection,
        at: datetime,
    ) -> None:
        cursor = connection.execute(
            """
            UPDATE user_skill_states
            SET score = %s, confidence = %s, evidence_count = %s,
                positive_mass = %s, negative_mass = %s, last_evidence_at = %s,
                assessed_at = %s, method_version = %s,
                state_version = state_version + 1, updated_at = %s
            WHERE user_id = %s AND user_language_id = %s AND skill = %s
              AND state_version = %s AND competence_parameter_set_id = %s
              AND competence_parameter_version = %s
            """,
            (
                state.score,
                state.confidence,
                state.evidence_count,
                state.positive_mass,
                state.negative_mass,
                state.last_evidence_at,
                at,
                METHOD_VERSION,
                at,
                context.actor_id,
                context.user_language_id,
                dimension.value,
                context.skill_state_versions[dimension],
                context.parameter_set_id,
                context.parameter_version,
            ),
        )
        if cursor.rowcount != 1:
            raise MemoryConfigurationError("language competence state version did not update")

    @staticmethod
    def update_concept(
        connection: Connection[tuple[object, ...]],
        *,
        context: ProjectionContext,
        derived: DerivedConceptProjection,
        at: datetime,
    ) -> CompetenceProjection:
        projection = derived.projection
        recent = {
            dimension.value: [
                float(value) for value in projection.dimension(dimension).recent_outcomes
            ]
            for dimension in CompetenceDimension
        }
        cursor = connection.execute(
            """
            UPDATE user_concept_states
            SET recognition = %s, recognition_positive_mass = %s,
                recognition_negative_mass = %s, recognition_confidence = %s,
                recognition_evidence_count = %s, recognition_last_evidence_at = %s,
                listening = %s, listening_positive_mass = %s,
                listening_negative_mass = %s, listening_confidence = %s,
                listening_evidence_count = %s, listening_last_evidence_at = %s,
                production = %s, production_positive_mass = %s,
                production_negative_mass = %s, production_confidence = %s,
                production_evidence_count = %s, production_last_evidence_at = %s,
                recent_competence_outcomes = %s, has_projectable_evidence = true,
                mastery = %s, confidence = %s, status = %s,
                highest_achievement_status = %s,
                projection_method_version = %s, state_version = state_version + 1,
                updated_at = %s
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
              AND state_version = %s AND competence_parameter_set_id = %s
              AND competence_parameter_version = %s
            RETURNING recognition, recognition_confidence, recognition_evidence_count,
                      recognition_last_evidence_at, listening, listening_confidence,
                      listening_evidence_count, listening_last_evidence_at,
                      production, production_confidence, production_evidence_count,
                      production_last_evidence_at, updated_at
            """,
            (
                projection.recognition.score,
                projection.recognition.positive_mass,
                projection.recognition.negative_mass,
                projection.recognition.confidence,
                projection.recognition.evidence_count,
                projection.recognition.last_evidence_at,
                projection.listening.score,
                projection.listening.positive_mass,
                projection.listening.negative_mass,
                projection.listening.confidence,
                projection.listening.evidence_count,
                projection.listening.last_evidence_at,
                projection.production.score,
                projection.production.positive_mass,
                projection.production.negative_mass,
                projection.production.confidence,
                projection.production.evidence_count,
                projection.production.last_evidence_at,
                Jsonb(recent),
                derived.mastery,
                derived.aggregate_confidence,
                derived.status.value,
                (
                    None
                    if derived.highest_achievement_status is None
                    else derived.highest_achievement_status.value
                ),
                METHOD_VERSION,
                at,
                context.actor_id,
                context.user_language_id,
                context.concept_id,
                context.concept_state_version,
                context.parameter_set_id,
                context.parameter_version,
            ),
        )
        row = cursor.fetchone()
        if row is None:
            raise MemoryConfigurationError("concept competence state version did not update")
        return _public_projection(row)

    @staticmethod
    def store_review_result(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_event_id: UUID,
        competence: CompetenceProjection,
        remaining_due_count: int,
        feedback: str,
    ) -> None:
        cursor = connection.execute(
            """
            UPDATE review_events
            SET result_competence_snapshot = %s,
                result_remaining_due_count = %s,
                result_feedback = %s
            WHERE id = %s AND user_id = %s
              AND result_competence_snapshot IS NULL
            """,
            (
                Jsonb(_snapshot_payload(competence)),
                remaining_due_count,
                feedback,
                review_event_id,
                actor.id,
            ),
        )
        if cursor.rowcount != 1:
            raise MemoryConfigurationError("review competence result was not stored exactly once")

    @staticmethod
    def load_review_result(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_event_id: UUID,
    ) -> tuple[CompetenceProjection, int, str | None] | None:
        row = connection.execute(
            """
            SELECT result_competence_snapshot, result_remaining_due_count, result_feedback
            FROM review_events WHERE id = %s AND user_id = %s
            """,
            (review_event_id, actor.id),
        ).fetchone()
        if row is None or row[0] is None or row[1] is None:
            return None
        return (
            _snapshot(cast(dict[str, object], row[0])),
            int(cast(int, row[1])),
            None if row[2] is None else str(row[2]),
        )

    @staticmethod
    def lock_and_load_replay_events(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
    ) -> tuple[UUID, str, CompetenceParameters, list[ReplayEvent]]:
        head = connection.execute(
            """
            SELECT head.parameter_set_id, head.parameter_version, parameter.parameters
            FROM user_language_projection_heads AS head
            JOIN competence_parameter_sets AS parameter
              ON parameter.id = head.parameter_set_id
             AND parameter.version = head.parameter_version
            WHERE head.user_id = %s AND head.user_language_id = %s
            FOR UPDATE
            """,
            (actor.id, user_language_id),
        ).fetchone()
        if head is None:
            raise MemoryConfigurationError("owned replay projection head is unavailable")
        rows = connection.execute(
            """
            SELECT event.concept_id, concept.concept_type, event.event_type, event.payload,
                   event.ingested_at, event.ingestion_sequence,
                   policy.recognition_weight, policy.listening_weight,
                   policy.production_weight
            FROM learning_events AS event
            JOIN concepts AS concept ON concept.id = event.concept_id
            LEFT JOIN concept_competence_policies AS policy
              ON policy.concept_id = event.concept_id
             AND policy.parameter_set_id = event.competence_parameter_set_id
             AND policy.parameter_version = event.competence_parameter_version
            WHERE event.user_id = %s AND event.user_language_id = %s
              AND event.ingestion_sequence IS NOT NULL
            ORDER BY event.ingestion_sequence, event.learning_event_id
            """,
            (actor.id, user_language_id),
        ).fetchall()
        events: list[ReplayEvent] = []
        for row in rows:
            policy = None
            if all(value is not None for value in row[6:9]):
                policy = MasteryPolicy(
                    recognition=_decimal(row[6]),
                    listening=_decimal(row[7]),
                    production=_decimal(row[8]),
                    version=str(head[1]),
                )
            events.append(
                ReplayEvent(
                    concept_id=_uuid(row[0]),
                    concept_type=ConceptType(str(row[1])),
                    event_type=str(row[2]),
                    payload=cast(dict[str, object], row[3]),
                    ingested_at=_datetime(row[4]),
                    ingestion_sequence=int(cast(int, row[5])),
                    policy=policy,
                )
            )
        parameters = _parameters(str(head[1]), cast(dict[str, object], head[2]))
        return _uuid(head[0]), str(head[1]), parameters, events

    @staticmethod
    def replace_profile_projections(
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        parameter_set_id: UUID,
        parameter_version: str,
        skills: dict[CompetenceDimension, DimensionProjection],
        concepts: dict[UUID, tuple[object, int, datetime | None]],
        max_sequence: int,
        rebuilt_at: datetime,
    ) -> None:
        connection.execute(
            "DELETE FROM user_concept_states WHERE user_id = %s AND user_language_id = %s",
            (actor.id, user_language_id),
        )
        connection.execute(
            "DELETE FROM user_skill_states WHERE user_id = %s AND user_language_id = %s",
            (actor.id, user_language_id),
        )
        language = connection.execute(
            "SELECT language_code FROM user_languages WHERE id = %s AND user_id = %s",
            (user_language_id, actor.id),
        ).fetchone()
        if language is None:
            raise MemoryConfigurationError("owned replay language profile disappeared")
        language_code = str(language[0])
        for dimension in CompetenceDimension:
            state = skills[dimension]
            connection.execute(
                """
                INSERT INTO user_skill_states
                    (user_id, user_language_id, skill, score, confidence, evidence_count,
                     assessed_at, method_version, positive_mass, negative_mass,
                     last_evidence_at, state_version, competence_parameter_set_id,
                     competence_parameter_version, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s, %s, %s)
                """,
                (
                    actor.id,
                    user_language_id,
                    dimension.value,
                    state.score,
                    state.confidence,
                    state.evidence_count,
                    rebuilt_at,
                    METHOD_VERSION,
                    state.positive_mass,
                    state.negative_mass,
                    state.last_evidence_at,
                    parameter_set_id,
                    parameter_version,
                    rebuilt_at,
                    rebuilt_at,
                ),
            )
        for concept_id, (raw_derived, exposure_count, last_seen_at) in concepts.items():
            if not isinstance(raw_derived, DerivedConceptProjection):
                raise TypeError("rebuilt concept projection has an unexpected type")
            derived = raw_derived
            projection = derived.projection
            recent = {
                dimension.value: [
                    float(value) for value in projection.dimension(dimension).recent_outcomes
                ]
                for dimension in CompetenceDimension
            }
            connection.execute(
                """
                INSERT INTO user_concept_states
                    (user_id, user_language_id, concept_id, language_code, status,
                     recognition, listening, production, mastery, confidence,
                     exposure_count, last_seen_at, state_version, projection_method_version,
                     recognition_positive_mass, recognition_negative_mass,
                     recognition_confidence, recognition_evidence_count,
                     recognition_last_evidence_at,
                     listening_positive_mass, listening_negative_mass,
                     listening_confidence, listening_evidence_count,
                     listening_last_evidence_at,
                     production_positive_mass, production_negative_mass,
                     production_confidence, production_evidence_count,
                     production_last_evidence_at, recent_competence_outcomes,
                     has_learning_intent,
                     has_projectable_evidence, highest_achievement_status,
                     competence_parameter_set_id, competence_parameter_version,
                     created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    actor.id,
                    user_language_id,
                    concept_id,
                    language_code,
                    derived.status.value,
                    projection.recognition.score,
                    projection.listening.score,
                    projection.production.score,
                    derived.mastery,
                    derived.aggregate_confidence,
                    exposure_count,
                    last_seen_at,
                    METHOD_VERSION,
                    projection.recognition.positive_mass,
                    projection.recognition.negative_mass,
                    projection.recognition.confidence,
                    projection.recognition.evidence_count,
                    projection.recognition.last_evidence_at,
                    projection.listening.positive_mass,
                    projection.listening.negative_mass,
                    projection.listening.confidence,
                    projection.listening.evidence_count,
                    projection.listening.last_evidence_at,
                    projection.production.positive_mass,
                    projection.production.negative_mass,
                    projection.production.confidence,
                    projection.production.evidence_count,
                    projection.production.last_evidence_at,
                    Jsonb(recent),
                    derived.has_learning_intent,
                    any(
                        projection.dimension(dimension).evidence_count > 0
                        for dimension in CompetenceDimension
                    ),
                    (
                        None
                        if derived.highest_achievement_status is None
                        else derived.highest_achievement_status.value
                    ),
                    parameter_set_id,
                    parameter_version,
                    rebuilt_at,
                    rebuilt_at,
                ),
            )
        connection.execute(
            """
            UPDATE user_language_projection_heads
            SET next_ingestion_sequence = %s, state_version = state_version + 1,
                updated_at = %s
            WHERE user_id = %s AND user_language_id = %s
            """,
            (max_sequence + 1, rebuilt_at, actor.id, user_language_id),
        )


def _context(
    *,
    actor: AuthenticatedActor,
    user_language_id: UUID,
    concept_id: UUID,
    language_code: str,
    sequence: int,
    parameter_set_id: UUID,
    parameter_version: str,
    parameters: CompetenceParameters,
    concept_row: tuple[object, ...],
    skill_rows: list[tuple[object, ...]],
) -> ProjectionContext:
    recent = cast(dict[str, object], concept_row[13])
    dimensions = {
        CompetenceDimension.RECOGNITION: _dimension(
            concept_row[1:5], recent, "recognition", parameters
        ),
        CompetenceDimension.LISTENING: _dimension(
            concept_row[5:9], recent, "listening", parameters
        ),
        CompetenceDimension.PRODUCTION: _dimension(
            concept_row[9:13], recent, "production", parameters
        ),
    }
    explicit_policy = None
    if all(value is not None for value in concept_row[20:23]):
        explicit_policy = MasteryPolicy(
            recognition=_decimal(concept_row[20]),
            listening=_decimal(concept_row[21]),
            production=_decimal(concept_row[22]),
            version=parameter_version,
        )
    skills = {
        CompetenceDimension(str(row[0])): DimensionProjection(
            positive_mass=_decimal(row[1]),
            negative_mass=_decimal(row[2]),
            evidence_count=int(cast(int, row[3])),
            last_evidence_at=_optional_datetime(row[4]),
            recent_outcomes=(),
            parameters=parameters,
        )
        for row in skill_rows
    }
    versions = {CompetenceDimension(str(row[0])): int(cast(int, row[5])) for row in skill_rows}
    return ProjectionContext(
        actor_id=actor.id,
        user_language_id=user_language_id,
        concept_id=concept_id,
        language_code=language_code,
        concept_type=ConceptType(str(concept_row[0])),
        ingestion_sequence=sequence,
        parameter_set_id=parameter_set_id,
        parameter_version=parameter_version,
        parameters=parameters,
        concept=ConceptProjection(
            recognition=dimensions[CompetenceDimension.RECOGNITION],
            listening=dimensions[CompetenceDimension.LISTENING],
            production=dimensions[CompetenceDimension.PRODUCTION],
        ),
        history=ProjectionHistory(
            has_passive_exposure=int(cast(int, concept_row[14])) > 0,
            has_learning_intent=bool(concept_row[16]),
            has_projectable_evidence=bool(concept_row[17]),
            highest_achievement_status=(
                None if concept_row[18] is None else ConceptStatus(str(concept_row[18]))
            ),
        ),
        policy=explicit_policy,
        concept_state_version=int(cast(int, concept_row[19])),
        exposure_count=int(cast(int, concept_row[14])),
        last_seen_at=_optional_datetime(concept_row[15]),
        skill_states=skills,
        skill_state_versions=versions,
    )


def _dimension(
    values: tuple[object, ...],
    recent: dict[str, object],
    name: str,
    parameters: CompetenceParameters,
) -> DimensionProjection:
    raw_recent = recent.get(name, [])
    if not isinstance(raw_recent, list):
        raise MemoryConfigurationError("recent competence outcomes are malformed")
    return DimensionProjection(
        positive_mass=_decimal(values[0]),
        negative_mass=_decimal(values[1]),
        evidence_count=int(cast(int, values[2])),
        last_evidence_at=_optional_datetime(values[3]),
        recent_outcomes=tuple(_decimal(value) for value in raw_recent),
        parameters=parameters,
    )


def _parameters(version: str, raw: dict[str, object]) -> CompetenceParameters:
    rating_outcomes = _object(raw.get("rating_outcomes"), "rating outcomes")
    mastery_policies = _object(raw.get("mastery_policies"), "mastery policies")
    status = _object(raw.get("status_thresholds"), "status thresholds")

    def policy(concept_type: ConceptType) -> tuple[ConceptType, MasteryPolicy]:
        weights = _object(mastery_policies.get(concept_type.value), f"{concept_type.value} policy")
        return (
            concept_type,
            MasteryPolicy(
                recognition=_decimal(weights.get("recognition")),
                listening=_decimal(weights.get("listening")),
                production=_decimal(weights.get("production")),
                version=version,
            ),
        )

    return CompetenceParameters(
        version=version,
        prior_alpha=_decimal(raw.get("prior_alpha")),
        prior_beta=_decimal(raw.get("prior_beta")),
        objective_evidence_weight=_decimal(raw.get("objective_evidence_weight")),
        self_reported_evidence_weight=_decimal(raw.get("self_reported_evidence_weight")),
        confidence_half_saturation_mass=_decimal(raw.get("confidence_half_saturation_mass")),
        min_mastery_effective_mass_per_dimension=_decimal(
            raw.get("min_mastery_effective_mass_per_dimension")
        ),
        rating_outcomes=tuple(
            (name, _decimal(rating_outcomes.get(name)))
            for name in ("again", "hard", "good", "easy")
        ),
        mastery_policies=tuple(
            policy(concept_type)
            for concept_type in (ConceptType.WORD, ConceptType.PHRASE, ConceptType.GRAMMAR)
        ),
        status=StatusThresholds(
            familiar_mastery_min=_decimal(status.get("familiar_mastery_min")),
            familiar_confidence_min=_decimal(status.get("familiar_confidence_min")),
            active_mastery_min=_decimal(status.get("active_mastery_min")),
            active_confidence_min=_decimal(status.get("active_confidence_min")),
            mastered_mastery_min=_decimal(status.get("mastered_mastery_min")),
            mastered_confidence_min=_decimal(status.get("mastered_confidence_min")),
            weak_outcome_max=_decimal(status.get("weak_outcome_max")),
            weak_consecutive_count=int(cast(int, status.get("weak_consecutive_count"))),
            forgotten_outcome=_decimal(status.get("forgotten_outcome")),
            forgotten_consecutive_count=int(cast(int, status.get("forgotten_consecutive_count"))),
            forgotten_mastery_max=_decimal(status.get("forgotten_mastery_max")),
            forgotten_confidence_min=_decimal(status.get("forgotten_confidence_min")),
        ),
    )


def _object(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise MemoryConfigurationError(f"competence {label} are missing or malformed")
    return cast(dict[str, object], value)


def _public_projection(row: tuple[object, ...]) -> CompetenceProjection:
    return CompetenceProjection(
        recognition=_public_score(row[0:4]),
        listening=_public_score(row[4:8]),
        production=_public_score(row[8:12]),
    )


def _public_score(values: tuple[object, ...]) -> CompetenceScoreProjection:
    return CompetenceScoreProjection(
        score=float(_decimal(values[0])),
        confidence=float(_decimal(values[1])),
        evidence_count=int(cast(int, values[2])),
        updated_at=_optional_datetime(values[3]),
    )


def _snapshot_payload(projection: CompetenceProjection) -> dict[str, object]:
    return {
        dimension.value: {
            "score": score.score,
            "confidence": score.confidence,
            "evidenceCount": score.evidence_count,
            "updatedAt": score.updated_at.isoformat() if score.updated_at is not None else None,
        }
        for dimension, score in (
            (CompetenceDimension.RECOGNITION, projection.recognition),
            (CompetenceDimension.LISTENING, projection.listening),
            (CompetenceDimension.PRODUCTION, projection.production),
        )
    }


def _snapshot(payload: dict[str, object]) -> CompetenceProjection:
    def score(name: str) -> CompetenceScoreProjection:
        value = cast(dict[str, object], payload[name])
        return CompetenceScoreProjection(
            score=float(_decimal(value["score"])),
            confidence=float(_decimal(value["confidence"])),
            evidence_count=int(cast(int, value["evidenceCount"])),
            updated_at=(
                None
                if value.get("updatedAt") is None
                else datetime.fromisoformat(str(value["updatedAt"]))
            ),
        )

    return CompetenceProjection(
        recognition=score("recognition"),
        listening=score("listening"),
        production=score("production"),
    )


def _decimal(value: object) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int | float | str) and not isinstance(value, bool):
        return Decimal(str(value))
    raise MemoryConfigurationError("competence numeric value has an unexpected type")


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise MemoryConfigurationError("competence timestamp has an unexpected type")
    return value


def _optional_datetime(value: object) -> datetime | None:
    return None if value is None else _datetime(value)
