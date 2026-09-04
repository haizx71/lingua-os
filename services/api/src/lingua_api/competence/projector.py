"""Pure competence-beta-v1 evidence interpretation and projection."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal

from lingua_api.competence.domain import (
    ACHIEVEMENT_RANK,
    CompetenceDimension,
    CompetenceParameters,
    ConceptProjection,
    ConceptStatus,
    ConceptType,
    DerivedConceptProjection,
    DimensionProjection,
    EvidenceObservation,
    MasteryPolicy,
    ProjectionHistory,
)
from lingua_api.memory.domain import ReviewExerciseMode, ReviewRating

MODE_DIMENSION = {
    ReviewExerciseMode.SELF_RECALL: CompetenceDimension.PRODUCTION,
    ReviewExerciseMode.MULTIPLE_CHOICE: CompetenceDimension.RECOGNITION,
    ReviewExerciseMode.TYPING: CompetenceDimension.PRODUCTION,
    ReviewExerciseMode.CLOZE: CompetenceDimension.RECOGNITION,
    ReviewExerciseMode.LISTENING: CompetenceDimension.LISTENING,
}


def canonicalize_review(
    *,
    parameters: CompetenceParameters,
    exercise_mode: ReviewExerciseMode,
    rating: ReviewRating | None,
    correct: bool | None,
    occurred_at: datetime,
) -> EvidenceObservation | None:
    if correct is not None:
        outcome = Decimal("1") if correct else Decimal("0")
        weight = (
            parameters.self_reported_evidence_weight
            if exercise_mode is ReviewExerciseMode.SELF_RECALL
            else parameters.objective_evidence_weight
        )
    elif rating is not None:
        outcome = parameters.rating_outcome(rating.value)
        weight = parameters.self_reported_evidence_weight
    else:
        return None
    return EvidenceObservation(
        dimension=MODE_DIMENSION[exercise_mode],
        outcome=outcome,
        weight=weight,
        occurred_at=occurred_at,
    )


def apply_observation(
    state: DimensionProjection, observation: EvidenceObservation
) -> DimensionProjection:
    """Apply one observation to a single matching dimension."""
    projection = ConceptProjection.zero(state.parameters)
    projection = ConceptProjection(
        recognition=state
        if observation.dimension is CompetenceDimension.RECOGNITION
        else projection.recognition,
        listening=state
        if observation.dimension is CompetenceDimension.LISTENING
        else projection.listening,
        production=state
        if observation.dimension is CompetenceDimension.PRODUCTION
        else projection.production,
    ).apply(observation)
    return projection.dimension(observation.dimension)


def replay(
    observations: Iterable[EvidenceObservation], *, parameters: CompetenceParameters
) -> ConceptProjection:
    projection = ConceptProjection.zero(parameters)
    for observation in observations:
        projection = projection.apply(observation)
    return projection


def derive_concept(
    projection: ConceptProjection,
    *,
    concept_type: ConceptType,
    history: ProjectionHistory,
    policy: MasteryPolicy | None = None,
) -> DerivedConceptProjection:
    parameters = projection.recognition.parameters
    actual_policy = policy or parameters.policy_for(concept_type)
    if actual_policy is None and concept_type is not ConceptType.SKILL:
        raise ValueError("a versioned mastery policy is required for non-skill concepts")
    mastery: Decimal | None = None
    aggregate_confidence = Decimal("0")
    required: tuple[CompetenceDimension, ...] = ()
    if actual_policy is not None:
        required = actual_policy.required_dimensions
        aggregate_confidence = sum(
            (
                actual_policy.weight(dimension) * projection.dimension(dimension).confidence
                for dimension in required
            ),
            Decimal("0"),
        )
        if all(
            projection.dimension(dimension).effective_mass
            >= parameters.min_mastery_effective_mass_per_dimension
            for dimension in required
        ):
            mastery = sum(
                (
                    actual_policy.weight(dimension) * projection.dimension(dimension).score
                    for dimension in required
                ),
                Decimal("0"),
            )

    status = _derive_status(
        projection=projection,
        history=history,
        required=required,
        mastery=mastery,
        aggregate_confidence=aggregate_confidence,
        parameters=parameters,
    )
    highest = _higher_achievement(history.highest_achievement_status, status)
    return DerivedConceptProjection(
        projection=projection,
        mastery=mastery,
        aggregate_confidence=aggregate_confidence,
        status=status,
        highest_achievement_status=highest,
        has_learning_intent=history.has_learning_intent,
    )


def _derive_status(
    *,
    projection: ConceptProjection,
    history: ProjectionHistory,
    required: tuple[CompetenceDimension, ...],
    mastery: Decimal | None,
    aggregate_confidence: Decimal,
    parameters: CompetenceParameters,
) -> ConceptStatus:
    thresholds = parameters.status
    established = history.highest_achievement_status in ACHIEVEMENT_RANK
    latest_three_zero = any(
        len(projection.dimension(dimension).recent_outcomes)
        >= thresholds.forgotten_consecutive_count
        and all(
            outcome == thresholds.forgotten_outcome
            for outcome in projection.dimension(dimension).recent_outcomes[
                -thresholds.forgotten_consecutive_count :
            ]
        )
        for dimension in required
    )
    latest_two_weak = any(
        len(projection.dimension(dimension).recent_outcomes) >= thresholds.weak_consecutive_count
        and all(
            outcome < thresholds.weak_outcome_max
            for outcome in projection.dimension(dimension).recent_outcomes[
                -thresholds.weak_consecutive_count :
            ]
        )
        for dimension in required
    )
    if (
        established
        and latest_three_zero
        and mastery is not None
        and mastery < thresholds.forgotten_mastery_max
        and aggregate_confidence >= thresholds.forgotten_confidence_min
    ):
        return ConceptStatus.FORGOTTEN
    if established and (
        latest_two_weak
        or (
            mastery is not None
            and mastery < thresholds.familiar_mastery_min
            and aggregate_confidence >= thresholds.familiar_confidence_min
        )
    ):
        return ConceptStatus.WEAK
    if (
        mastery is not None
        and mastery >= thresholds.mastered_mastery_min
        and aggregate_confidence >= thresholds.mastered_confidence_min
    ):
        return ConceptStatus.MASTERED
    if (
        mastery is not None
        and mastery >= thresholds.active_mastery_min
        and aggregate_confidence >= thresholds.active_confidence_min
    ):
        return ConceptStatus.ACTIVE
    if (
        mastery is not None
        and mastery >= thresholds.familiar_mastery_min
        and aggregate_confidence >= thresholds.familiar_confidence_min
    ):
        return ConceptStatus.FAMILIAR
    if history.has_learning_intent or history.has_projectable_evidence:
        return ConceptStatus.LEARNING
    if history.has_passive_exposure:
        return ConceptStatus.DISCOVERED
    return ConceptStatus.UNSEEN


def _higher_achievement(
    previous: ConceptStatus | None, current: ConceptStatus
) -> ConceptStatus | None:
    if current not in ACHIEVEMENT_RANK:
        return previous
    if previous not in ACHIEVEMENT_RANK:
        return current
    return current if ACHIEVEMENT_RANK[current] > ACHIEVEMENT_RANK[previous] else previous
