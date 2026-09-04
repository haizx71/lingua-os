"""Competence transaction participant for canonical Review evidence."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from psycopg import Connection

from lingua_api.competence.domain import (
    CompetenceDimension,
    CompetenceParameters,
    CompetenceProjection,
    ConceptProjection,
    ConceptType,
    DerivedConceptProjection,
    DimensionProjection,
    EvidenceObservation,
    MasteryPolicy,
    ProjectionHistory,
)
from lingua_api.competence.projector import canonicalize_review, derive_concept
from lingua_api.competence.store import PostgresCompetenceStore, ProjectionContext
from lingua_api.memory.domain import (
    AuthenticatedActor,
    IdempotencyConflict,
    ReviewExerciseMode,
    ReviewSubmission,
)


class CompetenceEngine:
    def __init__(self) -> None:
        self._store = PostgresCompetenceStore()

    def apply_review(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        concept_id: UUID,
        review_item_id: UUID,
        review_event_id: UUID,
        exercise_mode: ReviewExerciseMode,
        submission: ReviewSubmission,
        reviewed_at: datetime,
    ) -> CompetenceProjection:
        context = self._store.lock_projection_context(
            connection,
            actor=actor,
            user_language_id=user_language_id,
            concept_id=concept_id,
            at=reviewed_at,
        )
        observation = canonicalize_review(
            parameters=context.parameters,
            exercise_mode=exercise_mode,
            rating=submission.rating,
            correct=submission.correct,
            occurred_at=reviewed_at,
        )
        if observation is None:
            raise ValueError("completed Review evidence must be projectable")
        derivation_key = f"concept:{concept_id}"
        payload: dict[str, object] = {
            "reviewEventId": str(review_event_id),
            "reviewItemId": str(review_item_id),
            "exerciseMode": exercise_mode.value,
            "rating": submission.rating.value,
            "correct": submission.correct,
            "responseTimeMs": submission.response_time_ms,
            "dimension": observation.dimension.value,
            "outcome": str(observation.outcome),
            "weight": str(observation.weight),
        }
        fingerprint = _fingerprint(
            context=context,
            source_event_id=review_event_id,
            derivation_key=derivation_key,
            payload=payload,
            occurred_at=reviewed_at,
        )
        self._store.append_learning_event(
            connection,
            learning_event_id=uuid4(),
            context=context,
            source_event_id=review_event_id,
            derivation_key=derivation_key,
            request_fingerprint=fingerprint,
            idempotency_key=str(submission.idempotency_key),
            payload=payload,
            event_type="learning.review.completed.v1",
            source_type="review_event",
            occurred_at=reviewed_at,
            ingested_at=reviewed_at,
        )
        next_skill = context.skill_states[observation.dimension]
        next_skill = DimensionProjection(
            positive_mass=next_skill.positive_mass + observation.weight * observation.outcome,
            negative_mass=next_skill.negative_mass + observation.weight * (1 - observation.outcome),
            evidence_count=next_skill.evidence_count + 1,
            last_evidence_at=reviewed_at,
            recent_outcomes=(),
            parameters=context.parameters,
        )
        self._store.update_skill(
            connection,
            context=context,
            dimension=observation.dimension,
            state=next_skill,
            at=reviewed_at,
        )
        next_concept = context.concept.apply(observation)
        history = ProjectionHistory(
            has_passive_exposure=context.history.has_passive_exposure,
            has_learning_intent=context.history.has_learning_intent,
            has_projectable_evidence=True,
            highest_achievement_status=context.history.highest_achievement_status,
        )
        derived = derive_concept(
            next_concept,
            concept_type=context.concept_type,
            history=history,
            policy=context.policy,
        )
        return self._store.update_concept(
            connection, context=context, derived=derived, at=reviewed_at
        )

    def apply_passive_exposure(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: UUID,
        ingested_at: datetime,
    ) -> None:
        (
            user_language_id,
            concept_id,
            exposure_type,
            idempotency_key,
            occurred_at,
        ) = self._store.lock_exposure_source(
            connection, actor=actor, exposure_event_id=exposure_event_id
        )
        self._apply_passive_values(
            connection,
            actor=actor,
            exposure_event_id=exposure_event_id,
            ingested_at=ingested_at,
            user_language_id=user_language_id,
            concept_id=concept_id,
            exposure_type=exposure_type,
            idempotency_key=idempotency_key,
            occurred_at=occurred_at,
        )

    def apply_reader_passive_exposure(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: UUID,
        concept_id: UUID,
        ingested_at: datetime,
    ) -> None:
        (
            user_language_id,
            resolved_concept_id,
            exposure_type,
            idempotency_key,
            occurred_at,
        ) = self._store.lock_reader_exposure_source(
            connection,
            actor=actor,
            exposure_event_id=exposure_event_id,
            concept_id=concept_id,
        )
        self._apply_passive_values(
            connection,
            actor=actor,
            exposure_event_id=exposure_event_id,
            ingested_at=ingested_at,
            user_language_id=user_language_id,
            concept_id=resolved_concept_id,
            exposure_type=exposure_type,
            idempotency_key=idempotency_key,
            occurred_at=occurred_at,
        )

    def _apply_passive_values(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: UUID,
        ingested_at: datetime,
        user_language_id: UUID,
        concept_id: UUID,
        exposure_type: str,
        idempotency_key: str,
        occurred_at: datetime,
    ) -> None:
        derivation_key = f"concept:{concept_id}"
        payload: dict[str, object] = {"exposureType": exposure_type}
        fingerprint = _fingerprint_values(
            user_language_id=user_language_id,
            concept_id=concept_id,
            source_event_id=exposure_event_id,
            derivation_key=derivation_key,
            payload=payload,
            occurred_at=occurred_at,
            event_type="learning.exposure.recorded.v1",
            source_type="exposure_event",
        )
        existing_fingerprint = self._store.find_learning_derivation(
            connection,
            actor=actor,
            source_type="exposure_event",
            source_event_id=exposure_event_id,
            derivation_key=derivation_key,
        )
        if existing_fingerprint is not None:
            if existing_fingerprint != fingerprint:
                raise IdempotencyConflict("canonical exposure derivation fingerprint conflicts")
            return
        context = self._store.lock_projection_context(
            connection,
            actor=actor,
            user_language_id=user_language_id,
            concept_id=concept_id,
            at=ingested_at,
        )
        self._store.append_learning_event(
            connection,
            learning_event_id=uuid4(),
            context=context,
            source_event_id=exposure_event_id,
            derivation_key=derivation_key,
            request_fingerprint=fingerprint,
            idempotency_key=idempotency_key,
            payload=payload,
            event_type="learning.exposure.recorded.v1",
            source_type="exposure_event",
            occurred_at=occurred_at,
            ingested_at=ingested_at,
        )
        derived = derive_concept(
            context.concept,
            concept_type=context.concept_type,
            history=ProjectionHistory(
                has_passive_exposure=True,
                has_learning_intent=context.history.has_learning_intent,
                has_projectable_evidence=context.history.has_projectable_evidence,
                highest_achievement_status=context.history.highest_achievement_status,
            ),
            policy=context.policy,
        )
        self._store.update_passive_concept(
            connection, context=context, status=derived.status, at=ingested_at
        )

    def store_review_result(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_event_id: UUID,
        competence: CompetenceProjection,
        remaining_due_count: int,
        feedback: str,
    ) -> None:
        self._store.store_review_result(
            connection,
            actor=actor,
            review_event_id=review_event_id,
            competence=competence,
            remaining_due_count=remaining_due_count,
            feedback=feedback,
        )

    def load_review_result(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        review_event_id: UUID,
    ) -> tuple[CompetenceProjection, int, str | None] | None:
        return self._store.load_review_result(
            connection, actor=actor, review_event_id=review_event_id
        )

    def rebuild_profile(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        user_language_id: UUID,
        rebuilt_at: datetime,
    ) -> None:
        (
            parameter_set_id,
            parameter_version,
            parameters,
            events,
        ) = self._store.lock_and_load_replay_events(
            connection, actor=actor, user_language_id=user_language_id
        )
        skills = {
            dimension: DimensionProjection.zero(parameters) for dimension in CompetenceDimension
        }
        concepts: dict[UUID, _ReplayConcept] = {}
        max_sequence = 0
        for event in events:
            max_sequence = max(max_sequence, event.ingestion_sequence)
            state = concepts.setdefault(
                event.concept_id,
                _ReplayConcept.zero(event.concept_type, event.policy, parameters),
            )
            if event.event_type == "learning.review.completed.v1":
                observation = EvidenceObservation(
                    dimension=CompetenceDimension(str(event.payload["dimension"])),
                    outcome=Decimal(str(event.payload["outcome"])),
                    weight=Decimal(str(event.payload["weight"])),
                    occurred_at=event.ingested_at,
                )
                state.projection = state.projection.apply(observation)
                skills[observation.dimension] = _apply_dimension_state(
                    skills[observation.dimension], observation
                )
                state.history = ProjectionHistory(
                    has_passive_exposure=state.history.has_passive_exposure,
                    has_learning_intent=state.history.has_learning_intent,
                    has_projectable_evidence=True,
                    highest_achievement_status=state.history.highest_achievement_status,
                )
            elif event.event_type == "learning.exposure.recorded.v1":
                state.exposure_count += 1
                state.last_seen_at = event.ingested_at
                state.history = ProjectionHistory(
                    has_passive_exposure=True,
                    has_learning_intent=state.history.has_learning_intent,
                    has_projectable_evidence=state.history.has_projectable_evidence,
                    highest_achievement_status=state.history.highest_achievement_status,
                )
            elif event.event_type == "learning.concept.saved.v1":
                state.history = ProjectionHistory(
                    has_passive_exposure=state.history.has_passive_exposure,
                    has_learning_intent=True,
                    has_projectable_evidence=state.history.has_projectable_evidence,
                    highest_achievement_status=state.history.highest_achievement_status,
                )
            state.derived = derive_concept(
                state.projection,
                concept_type=state.concept_type,
                history=state.history,
                policy=state.policy,
            )
            state.history = ProjectionHistory(
                has_passive_exposure=state.history.has_passive_exposure,
                has_learning_intent=state.history.has_learning_intent,
                has_projectable_evidence=state.history.has_projectable_evidence,
                highest_achievement_status=state.derived.highest_achievement_status,
            )
        self._store.replace_profile_projections(
            connection,
            actor=actor,
            user_language_id=user_language_id,
            parameter_set_id=parameter_set_id,
            parameter_version=parameter_version,
            skills=skills,
            concepts={
                concept_id: (state.derived, state.exposure_count, state.last_seen_at)
                for concept_id, state in concepts.items()
            },
            max_sequence=max_sequence,
            rebuilt_at=rebuilt_at,
        )


@dataclass
class _ReplayConcept:
    concept_type: ConceptType
    policy: MasteryPolicy | None
    projection: ConceptProjection
    history: ProjectionHistory
    derived: DerivedConceptProjection
    exposure_count: int = 0
    last_seen_at: datetime | None = None

    @classmethod
    def zero(
        cls,
        concept_type: ConceptType,
        policy: MasteryPolicy | None,
        parameters: CompetenceParameters,
    ) -> _ReplayConcept:
        projection = ConceptProjection.zero(parameters)
        history = ProjectionHistory()
        return cls(
            concept_type=concept_type,
            policy=policy,
            projection=projection,
            history=history,
            derived=derive_concept(
                projection, concept_type=concept_type, history=history, policy=policy
            ),
        )


def _apply_dimension_state(
    state: DimensionProjection, observation: EvidenceObservation
) -> DimensionProjection:
    return DimensionProjection(
        positive_mass=state.positive_mass + observation.weight * observation.outcome,
        negative_mass=state.negative_mass
        + observation.weight * (Decimal("1") - observation.outcome),
        evidence_count=state.evidence_count + 1,
        last_evidence_at=observation.occurred_at,
        recent_outcomes=(),
        parameters=state.parameters,
    )


def _fingerprint(
    *,
    context: ProjectionContext,
    source_event_id: UUID,
    derivation_key: str,
    payload: dict[str, object],
    occurred_at: datetime,
    event_type: str = "learning.review.completed.v1",
    source_type: str = "review_event",
) -> str:
    return _fingerprint_values(
        user_language_id=context.user_language_id,
        concept_id=context.concept_id,
        source_event_id=source_event_id,
        derivation_key=derivation_key,
        payload=payload,
        occurred_at=occurred_at,
        event_type=event_type,
        source_type=source_type,
    )


def _fingerprint_values(
    *,
    user_language_id: UUID,
    concept_id: UUID,
    source_event_id: UUID,
    derivation_key: str,
    payload: dict[str, object],
    occurred_at: datetime,
    event_type: str,
    source_type: str,
) -> str:
    logical = {
        "eventType": event_type,
        "schemaVersion": 1,
        "userLanguageId": str(user_language_id),
        "conceptId": str(concept_id),
        "sourceType": source_type,
        "sourceEventId": str(source_event_id),
        "derivationKey": derivation_key,
        "payload": payload,
        "occurredAt": occurred_at.isoformat(),
    }
    return hashlib.sha256(
        json.dumps(logical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
