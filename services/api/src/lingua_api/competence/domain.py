"""Pure competence domain values with no transport or persistence dependency."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from decimal import Decimal
from enum import StrEnum


class CompetenceDimension(StrEnum):
    RECOGNITION = "recognition"
    LISTENING = "listening"
    PRODUCTION = "production"


class ConceptType(StrEnum):
    WORD = "word"
    PHRASE = "phrase"
    GRAMMAR = "grammar"
    SKILL = "skill"


class ConceptStatus(StrEnum):
    UNSEEN = "unseen"
    DISCOVERED = "discovered"
    LEARNING = "learning"
    FAMILIAR = "familiar"
    ACTIVE = "active"
    MASTERED = "mastered"
    WEAK = "weak"
    FORGOTTEN = "forgotten"


ACHIEVEMENT_RANK = {
    ConceptStatus.FAMILIAR: 1,
    ConceptStatus.ACTIVE: 2,
    ConceptStatus.MASTERED: 3,
}


@dataclass(frozen=True)
class MasteryPolicy:
    recognition: Decimal
    listening: Decimal
    production: Decimal
    version: str

    def __post_init__(self) -> None:
        weights = (self.recognition, self.listening, self.production)
        if any(weight < 0 or weight > 1 for weight in weights):
            raise ValueError("mastery weights must be in [0,1]")
        if sum(weights, Decimal("0")) != Decimal("1"):
            raise ValueError("mastery weights must sum to 1")
        if not self.version.strip():
            raise ValueError("policy version is required")

    @property
    def required_dimensions(self) -> tuple[CompetenceDimension, ...]:
        return tuple(dimension for dimension in CompetenceDimension if self.weight(dimension) > 0)

    def weight(self, dimension: CompetenceDimension) -> Decimal:
        if dimension is CompetenceDimension.RECOGNITION:
            return self.recognition
        if dimension is CompetenceDimension.LISTENING:
            return self.listening
        return self.production


@dataclass(frozen=True)
class StatusThresholds:
    familiar_mastery_min: Decimal
    familiar_confidence_min: Decimal
    active_mastery_min: Decimal
    active_confidence_min: Decimal
    mastered_mastery_min: Decimal
    mastered_confidence_min: Decimal
    weak_outcome_max: Decimal
    weak_consecutive_count: int
    forgotten_outcome: Decimal
    forgotten_consecutive_count: int
    forgotten_mastery_max: Decimal
    forgotten_confidence_min: Decimal

    def __post_init__(self) -> None:
        bounded = (
            self.familiar_mastery_min,
            self.familiar_confidence_min,
            self.active_mastery_min,
            self.active_confidence_min,
            self.mastered_mastery_min,
            self.mastered_confidence_min,
            self.weak_outcome_max,
            self.forgotten_outcome,
            self.forgotten_mastery_max,
            self.forgotten_confidence_min,
        )
        if any(value < 0 or value > 1 for value in bounded):
            raise ValueError("status thresholds must be in [0,1]")
        if not (self.familiar_mastery_min <= self.active_mastery_min <= self.mastered_mastery_min):
            raise ValueError("mastery achievement thresholds must be monotonic")
        if not (
            self.familiar_confidence_min
            <= self.active_confidence_min
            <= self.mastered_confidence_min
        ):
            raise ValueError("confidence achievement thresholds must be monotonic")
        if not 1 <= self.weak_consecutive_count <= 3:
            raise ValueError("weak streak length must fit retained outcome history")
        if not 1 <= self.forgotten_consecutive_count <= 3:
            raise ValueError("forgotten streak length must fit retained outcome history")


@dataclass(frozen=True)
class CompetenceParameters:
    version: str
    prior_alpha: Decimal
    prior_beta: Decimal
    objective_evidence_weight: Decimal
    self_reported_evidence_weight: Decimal
    confidence_half_saturation_mass: Decimal
    min_mastery_effective_mass_per_dimension: Decimal
    rating_outcomes: tuple[tuple[str, Decimal], ...]
    mastery_policies: tuple[tuple[ConceptType, MasteryPolicy], ...]
    status: StatusThresholds

    def __post_init__(self) -> None:
        if not self.version.strip():
            raise ValueError("parameter version is required")
        if self.prior_alpha <= 0 or self.prior_beta <= 0:
            raise ValueError("Beta priors must be positive")
        if self.objective_evidence_weight <= 0 or self.self_reported_evidence_weight <= 0:
            raise ValueError("evidence weights must be positive")
        if self.confidence_half_saturation_mass <= 0:
            raise ValueError("confidence mass constant must be positive")
        if self.min_mastery_effective_mass_per_dimension < 0:
            raise ValueError("mastery eligibility mass must be non-negative")
        if {name for name, _ in self.rating_outcomes} != {"again", "hard", "good", "easy"}:
            raise ValueError("all four rating outcomes must be configured exactly once")
        if any(outcome < 0 or outcome > 1 for _, outcome in self.rating_outcomes):
            raise ValueError("rating outcomes must be in [0,1]")

    def rating_outcome(self, rating: str) -> Decimal:
        for candidate, outcome in self.rating_outcomes:
            if candidate == rating:
                return outcome
        raise ValueError(f"rating outcome is not configured: {rating}")

    def policy_for(self, concept_type: ConceptType) -> MasteryPolicy | None:
        for candidate, policy in self.mastery_policies:
            if candidate is concept_type:
                return policy
        return None


@dataclass(frozen=True)
class EvidenceObservation:
    dimension: CompetenceDimension
    outcome: Decimal
    weight: Decimal
    occurred_at: datetime

    def __post_init__(self) -> None:
        if not Decimal("0") <= self.outcome <= Decimal("1"):
            raise ValueError("outcome must be in [0,1]")
        if self.weight < 0:
            raise ValueError("weight must be non-negative")
        if self.occurred_at.tzinfo is None or self.occurred_at.utcoffset() is None:
            raise ValueError("occurred_at must be timezone-aware")


@dataclass(frozen=True)
class DimensionProjection:
    positive_mass: Decimal
    negative_mass: Decimal
    evidence_count: int
    last_evidence_at: datetime | None
    recent_outcomes: tuple[Decimal, ...]
    parameters: CompetenceParameters

    def __post_init__(self) -> None:
        if self.positive_mass < 0 or self.negative_mass < 0:
            raise ValueError("evidence mass must be non-negative")
        if self.evidence_count < 0:
            raise ValueError("evidence_count must be non-negative")
        if len(self.recent_outcomes) > 3:
            raise ValueError("only the latest three outcomes are retained")

    @classmethod
    def zero(cls, parameters: CompetenceParameters) -> DimensionProjection:
        return cls(Decimal("0"), Decimal("0"), 0, None, (), parameters)

    @property
    def effective_mass(self) -> Decimal:
        return self.positive_mass + self.negative_mass

    @property
    def score(self) -> Decimal:
        return (self.parameters.prior_alpha + self.positive_mass) / (
            self.parameters.prior_alpha + self.parameters.prior_beta + self.effective_mass
        )

    @property
    def variance(self) -> Decimal:
        """Posterior Beta variance for internal uncertainty and convergence checks."""
        alpha = self.parameters.prior_alpha + self.positive_mass
        beta = self.parameters.prior_beta + self.negative_mass
        total = alpha + beta
        return (alpha * beta) / (total * total * (total + 1))

    @property
    def confidence(self) -> Decimal:
        if self.effective_mass == 0:
            return Decimal("0")
        return self.effective_mass / (
            self.effective_mass + self.parameters.confidence_half_saturation_mass
        )


@dataclass(frozen=True)
class ConceptProjection:
    recognition: DimensionProjection
    listening: DimensionProjection
    production: DimensionProjection

    def __post_init__(self) -> None:
        if not (
            self.recognition.parameters == self.listening.parameters == self.production.parameters
        ):
            raise ValueError("concept dimensions must share one parameter lineage")

    @classmethod
    def zero(cls, parameters: CompetenceParameters) -> ConceptProjection:
        return cls(
            recognition=DimensionProjection.zero(parameters),
            listening=DimensionProjection.zero(parameters),
            production=DimensionProjection.zero(parameters),
        )

    def dimension(self, value: CompetenceDimension) -> DimensionProjection:
        if value is CompetenceDimension.RECOGNITION:
            return self.recognition
        if value is CompetenceDimension.LISTENING:
            return self.listening
        return self.production

    def apply(self, observation: EvidenceObservation) -> ConceptProjection:
        return replace(
            self,
            **{
                observation.dimension.value: _apply_dimension(
                    self.dimension(observation.dimension), observation
                )
            },
        )


@dataclass(frozen=True)
class ProjectionHistory:
    has_passive_exposure: bool = False
    has_learning_intent: bool = False
    has_projectable_evidence: bool = False
    highest_achievement_status: ConceptStatus | None = None

    @classmethod
    def projectable(
        cls, *, highest_achievement_status: ConceptStatus | None = None
    ) -> ProjectionHistory:
        return cls(
            has_projectable_evidence=True,
            highest_achievement_status=highest_achievement_status,
        )


@dataclass(frozen=True)
class DerivedConceptProjection:
    projection: ConceptProjection
    mastery: Decimal | None
    aggregate_confidence: Decimal
    status: ConceptStatus
    highest_achievement_status: ConceptStatus | None
    has_learning_intent: bool = False


@dataclass(frozen=True)
class CompetenceScoreProjection:
    score: float
    confidence: float
    evidence_count: int
    updated_at: datetime | None


@dataclass(frozen=True)
class CompetenceProjection:
    recognition: CompetenceScoreProjection
    listening: CompetenceScoreProjection
    production: CompetenceScoreProjection

    @classmethod
    def zero(cls) -> CompetenceProjection:
        score = CompetenceScoreProjection(0.5, 0.0, 0, None)
        return cls(score, score, score)


def _apply_dimension(
    state: DimensionProjection, observation: EvidenceObservation
) -> DimensionProjection:
    positive_delta = observation.weight * observation.outcome
    negative_delta = observation.weight * (Decimal("1") - observation.outcome)
    return DimensionProjection(
        positive_mass=state.positive_mass + positive_delta,
        negative_mass=state.negative_mass + negative_delta,
        evidence_count=state.evidence_count + 1,
        last_evidence_at=observation.occurred_at,
        recent_outcomes=(*state.recent_outcomes, observation.outcome)[-3:],
        parameters=state.parameters,
    )
