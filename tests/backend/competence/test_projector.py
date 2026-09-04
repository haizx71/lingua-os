from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from lingua_api.competence.domain import (
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
    StatusThresholds,
)
from lingua_api.competence.projector import (
    apply_observation,
    canonicalize_review,
    replay,
)
from lingua_api.competence.projector import (
    derive_concept as _derive_concept,
)
from lingua_api.memory.domain import ReviewExerciseMode, ReviewRating

NOW = datetime(2026, 8, 23, 8, 0, tzinfo=UTC)
LEXICAL_POLICY = MasteryPolicy(
    recognition=Decimal("0.4"),
    listening=Decimal("0.3"),
    production=Decimal("0.3"),
    version="competence-beta-v1",
)
GRAMMAR_POLICY = MasteryPolicy(
    recognition=Decimal("0.5"),
    listening=Decimal("0"),
    production=Decimal("0.5"),
    version="competence-beta-v1",
)
PARAMETERS = CompetenceParameters(
    version="competence-beta-v1",
    prior_alpha=Decimal("2"),
    prior_beta=Decimal("2"),
    objective_evidence_weight=Decimal("1"),
    self_reported_evidence_weight=Decimal("0.5"),
    confidence_half_saturation_mass=Decimal("4"),
    min_mastery_effective_mass_per_dimension=Decimal("2"),
    rating_outcomes=(
        ("again", Decimal("0")),
        ("hard", Decimal(1) / Decimal(3)),
        ("good", Decimal(2) / Decimal(3)),
        ("easy", Decimal("1")),
    ),
    mastery_policies=(
        (ConceptType.WORD, LEXICAL_POLICY),
        (ConceptType.PHRASE, LEXICAL_POLICY),
        (ConceptType.GRAMMAR, GRAMMAR_POLICY),
    ),
    status=StatusThresholds(
        familiar_mastery_min=Decimal("0.60"),
        familiar_confidence_min=Decimal("0.40"),
        active_mastery_min=Decimal("0.75"),
        active_confidence_min=Decimal("0.60"),
        mastered_mastery_min=Decimal("0.85"),
        mastered_confidence_min=Decimal("0.75"),
        weak_outcome_max=Decimal("0.50"),
        weak_consecutive_count=2,
        forgotten_outcome=Decimal("0"),
        forgotten_consecutive_count=3,
        forgotten_mastery_max=Decimal("0.50"),
        forgotten_confidence_min=Decimal("0.50"),
    ),
)


def derive_concept(
    projection: ConceptProjection,
    *,
    concept_type: ConceptType,
    history: ProjectionHistory,
    policy: MasteryPolicy | None = None,
) -> DerivedConceptProjection:
    configured = policy
    if concept_type in {ConceptType.WORD, ConceptType.PHRASE}:
        configured = LEXICAL_POLICY
    elif concept_type is ConceptType.GRAMMAR:
        configured = GRAMMAR_POLICY
    return _derive_concept(
        projection,
        concept_type=concept_type,
        history=history,
        policy=configured,
    )


def _observation(
    outcome: str,
    *,
    weight: str = "1",
    dimension: CompetenceDimension = CompetenceDimension.RECOGNITION,
) -> EvidenceObservation:
    return EvidenceObservation(
        dimension=dimension,
        outcome=Decimal(outcome),
        weight=Decimal(weight),
        occurred_at=NOW,
    )


def _dimension(*outcomes: str, weight: str = "1") -> DimensionProjection:
    state = DimensionProjection.zero(PARAMETERS)
    for outcome in outcomes:
        state = apply_observation(state, _observation(outcome, weight=weight))
    return state


def test_zero_evidence_uses_symmetric_prior_without_fake_confidence() -> None:
    state = DimensionProjection.zero(PARAMETERS)

    assert state.score == Decimal("0.5")
    assert state.confidence == Decimal("0")
    assert state.effective_mass == Decimal("0")
    assert state.evidence_count == 0


@pytest.mark.parametrize(
    ("outcome", "positive", "negative", "score"),
    [
        ("1", "1", "0", Decimal("0.6")),
        ("0", "0", "1", Decimal("0.4")),
        (
            "0.3333333333333333333333333333",
            "0.1666666666666666666666666666",
            "0.3333333333333333333333333334",
            Decimal(13) / Decimal(27),
        ),
        (
            "0.6666666666666666666666666667",
            "0.3333333333333333333333333334",
            "0.1666666666666666666666666666",
            Decimal(14) / Decimal(27),
        ),
    ],
)
def test_soft_beta_golden_updates(
    outcome: str, positive: str, negative: str, score: Decimal
) -> None:
    state = apply_observation(
        DimensionProjection.zero(PARAMETERS),
        _observation(outcome, weight="0.5" if outcome not in {"0", "1"} else "1"),
    )

    assert state.positive_mass == Decimal(positive)
    assert state.negative_mass == Decimal(negative)
    assert abs(state.score - score) <= Decimal("1e-27")


@pytest.mark.parametrize(
    ("rating", "outcome"),
    [
        (ReviewRating.AGAIN, Decimal("0")),
        (ReviewRating.HARD, Decimal(1) / Decimal(3)),
        (ReviewRating.GOOD, Decimal(2) / Decimal(3)),
        (ReviewRating.EASY, Decimal("1")),
    ],
)
def test_rating_fallback_uses_half_weight(rating: ReviewRating, outcome: Decimal) -> None:
    observation = canonicalize_review(
        parameters=PARAMETERS,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        rating=rating,
        correct=None,
        occurred_at=NOW,
    )

    assert observation is not None
    assert observation.outcome == outcome
    assert observation.weight == Decimal("0.5")


def test_objective_correctness_precedes_rating_and_self_recall_is_discounted() -> None:
    objective = canonicalize_review(
        parameters=PARAMETERS,
        exercise_mode=ReviewExerciseMode.MULTIPLE_CHOICE,
        rating=ReviewRating.AGAIN,
        correct=True,
        occurred_at=NOW,
    )
    self_report = canonicalize_review(
        parameters=PARAMETERS,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        rating=ReviewRating.EASY,
        correct=False,
        occurred_at=NOW,
    )

    assert objective == _observation("1")
    assert self_report == _observation("0", weight="0.5", dimension=CompetenceDimension.PRODUCTION)


@pytest.mark.parametrize(
    ("mode", "dimension"),
    [
        (ReviewExerciseMode.SELF_RECALL, CompetenceDimension.PRODUCTION),
        (ReviewExerciseMode.MULTIPLE_CHOICE, CompetenceDimension.RECOGNITION),
        (ReviewExerciseMode.TYPING, CompetenceDimension.PRODUCTION),
        (ReviewExerciseMode.CLOZE, CompetenceDimension.RECOGNITION),
        (ReviewExerciseMode.LISTENING, CompetenceDimension.LISTENING),
    ],
)
def test_every_review_mode_maps_to_one_dimension(
    mode: ReviewExerciseMode, dimension: CompetenceDimension
) -> None:
    observation = canonicalize_review(
        parameters=PARAMETERS,
        exercise_mode=mode,
        rating=ReviewRating.GOOD,
        correct=None,
        occurred_at=NOW,
    )

    assert observation is not None
    assert observation.dimension is dimension


def test_conflicting_evidence_is_bounded_and_confidence_only_uses_effective_mass() -> None:
    state = _dimension("1", "0", "1", "0")

    assert state.score == Decimal("0.5")
    assert state.confidence == Decimal("0.5")
    assert Decimal("0") <= state.score <= Decimal("1")
    assert Decimal("0") <= state.confidence <= Decimal("1")


def test_confidence_grows_monotonically_and_excludes_prior_mass() -> None:
    zero = DimensionProjection.zero(PARAMETERS)
    one = _dimension("1")
    two = _dimension("1", "1")

    assert zero.confidence == Decimal("0")
    assert zero.confidence < one.confidence < two.confidence
    assert one.confidence == Decimal("0.2")
    assert two.confidence == Decimal(1) / Decimal(3)


def test_lexical_mastery_waits_for_every_required_dimension_without_renormalizing() -> None:
    projection = ConceptProjection(
        recognition=_dimension("1", "1"),
        listening=_dimension("1", "1"),
        production=_dimension("1"),
    )

    derived = derive_concept(
        projection,
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(),
    )

    assert derived.mastery is None
    assert derived.aggregate_confidence == (
        Decimal("0.4") * projection.recognition.confidence
        + Decimal("0.3") * projection.listening.confidence
        + Decimal("0.3") * projection.production.confidence
    )


def test_lexical_and_grammar_mastery_use_frozen_weights() -> None:
    projection = ConceptProjection(
        recognition=_dimension("1", "1"),
        listening=_dimension("0", "0"),
        production=_dimension("1", "0"),
    )

    lexical = derive_concept(
        projection,
        concept_type=ConceptType.PHRASE,
        history=ProjectionHistory.projectable(),
    )
    grammar = derive_concept(
        projection,
        concept_type=ConceptType.GRAMMAR,
        history=ProjectionHistory.projectable(),
    )

    assert lexical.mastery == (
        Decimal("0.4") * projection.recognition.score
        + Decimal("0.3") * projection.listening.score
        + Decimal("0.3") * projection.production.score
    )
    assert grammar.mastery == (
        Decimal("0.5") * projection.recognition.score + Decimal("0.5") * projection.production.score
    )


def test_skill_requires_explicit_versioned_policy() -> None:
    projection = ConceptProjection(
        recognition=_dimension("1", "1"),
        listening=_dimension("1", "1"),
        production=_dimension("1", "1"),
    )

    missing = derive_concept(
        projection,
        concept_type=ConceptType.SKILL,
        history=ProjectionHistory.projectable(),
    )
    configured = derive_concept(
        projection,
        concept_type=ConceptType.SKILL,
        history=ProjectionHistory.projectable(),
        policy=MasteryPolicy(
            recognition=Decimal("0"),
            listening=Decimal("1"),
            production=Decimal("0"),
            version="competence-beta-v1",
        ),
    )

    assert missing.mastery is None
    assert missing.aggregate_confidence == Decimal("0")
    assert missing.status is ConceptStatus.LEARNING
    assert configured.mastery == projection.listening.score


def test_non_skill_policy_is_resolved_from_versioned_configuration() -> None:
    recognition_only = MasteryPolicy(
        recognition=Decimal("1"),
        listening=Decimal("0"),
        production=Decimal("0"),
        version="competence-beta-v1-test",
    )
    parameters = replace(
        PARAMETERS,
        mastery_policies=((ConceptType.WORD, recognition_only),),
    )
    recognition = DimensionProjection.zero(parameters)
    recognition = apply_observation(recognition, _observation("1"))
    recognition = apply_observation(recognition, _observation("1"))
    projection = ConceptProjection(
        recognition,
        DimensionProjection.zero(parameters),
        DimensionProjection.zero(parameters),
    )

    derived = _derive_concept(
        projection,
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(),
    )

    assert derived.mastery == recognition.score


def test_math_ratings_and_status_thresholds_use_parameter_lineage() -> None:
    thresholds = replace(
        PARAMETERS.status,
        familiar_mastery_min=Decimal("0.9"),
        active_mastery_min=Decimal("0.95"),
        mastered_mastery_min=Decimal("0.99"),
    )
    parameters = replace(
        PARAMETERS,
        prior_alpha=Decimal("4"),
        prior_beta=Decimal("1"),
        self_reported_evidence_weight=Decimal("0.25"),
        confidence_half_saturation_mass=Decimal("2"),
        rating_outcomes=(
            ("again", Decimal("0")),
            ("hard", Decimal("0.2")),
            ("good", Decimal("0.9")),
            ("easy", Decimal("1")),
        ),
        status=thresholds,
    )
    zero = DimensionProjection.zero(parameters)
    rating = canonicalize_review(
        parameters=parameters,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        rating=ReviewRating.GOOD,
        correct=None,
        occurred_at=NOW,
    )
    successful = apply_observation(zero, _observation("1"))
    three_successes = successful
    for _ in range(2):
        three_successes = apply_observation(three_successes, _observation("1"))
    derived = _derive_concept(
        ConceptProjection(three_successes, three_successes, three_successes),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(),
    )

    assert zero.score == Decimal("0.8")
    assert successful.confidence == Decimal(1) / Decimal(3)
    assert rating is not None and rating.outcome == Decimal("0.9")
    assert rating.weight == Decimal("0.25")
    assert derived.status is ConceptStatus.LEARNING


def test_passive_exposure_only_discovers_and_never_changes_dimensions() -> None:
    projection = ConceptProjection.zero(PARAMETERS)
    derived = derive_concept(
        projection,
        concept_type=ConceptType.WORD,
        history=ProjectionHistory(has_passive_exposure=True),
    )

    assert derived.projection == projection
    assert derived.mastery is None
    assert derived.status is ConceptStatus.DISCOVERED


def test_status_precedence_degradation_and_recovery() -> None:
    strong = ConceptProjection(
        recognition=_dimension(*(["1"] * 20)),
        listening=_dimension(*(["1"] * 20)),
        production=_dimension(*(["1"] * 20)),
    )
    mastered = derive_concept(
        strong,
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(),
    )
    assert mastered.status is ConceptStatus.MASTERED

    one_failure = apply_observation(strong.recognition, _observation("0"))
    after_one = derive_concept(
        ConceptProjection(one_failure, strong.listening, strong.production),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(highest_achievement_status=ConceptStatus.MASTERED),
    )
    assert after_one.status is not ConceptStatus.WEAK

    two_failures = apply_observation(one_failure, _observation("0"))
    weak = derive_concept(
        ConceptProjection(two_failures, strong.listening, strong.production),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(highest_achievement_status=ConceptStatus.MASTERED),
    )
    assert weak.status is ConceptStatus.WEAK

    recovered_dimension = apply_observation(two_failures, _observation("1"))
    recovered = derive_concept(
        ConceptProjection(recovered_dimension, strong.listening, strong.production),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(highest_achievement_status=ConceptStatus.MASTERED),
    )
    assert recovered.status in {
        ConceptStatus.FAMILIAR,
        ConceptStatus.ACTIVE,
        ConceptStatus.MASTERED,
    }


def test_forgotten_precedes_weak_and_success_breaks_exact_zero_streak() -> None:
    recognition = _dimension(*(["1"] * 3), *(["0"] * 15))
    others = _dimension(*(["1"] * 8), *(["0"] * 10), "0.1")
    forgotten = derive_concept(
        ConceptProjection(recognition, others, others),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(highest_achievement_status=ConceptStatus.MASTERED),
    )

    assert forgotten.mastery is not None and forgotten.mastery < Decimal("0.5")
    assert forgotten.aggregate_confidence >= Decimal("0.5")
    assert forgotten.status is ConceptStatus.FORGOTTEN

    success = apply_observation(recognition, _observation("1"))
    recovered = derive_concept(
        ConceptProjection(success, others, others),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(highest_achievement_status=ConceptStatus.MASTERED),
    )
    assert recovered.status is ConceptStatus.WEAK


def test_incremental_projection_equals_full_replay() -> None:
    observations = (
        _observation("1"),
        _observation("0", dimension=CompetenceDimension.LISTENING),
        _observation("0.6666666666666666666666666667", weight="0.5"),
        _observation("1", dimension=CompetenceDimension.PRODUCTION),
    )
    incremental = ConceptProjection.zero(PARAMETERS)
    for observation in observations:
        incremental = incremental.apply(observation)

    assert replay(observations, parameters=PARAMETERS) == incremental


@pytest.mark.parametrize(
    ("successes_per_required_dimension", "expected"),
    [
        (3, ConceptStatus.FAMILIAR),
        (6, ConceptStatus.ACTIVE),
        (12, ConceptStatus.MASTERED),
    ],
)
def test_clean_objective_evidence_crosses_frozen_calibration_bands(
    successes_per_required_dimension: int, expected: ConceptStatus
) -> None:
    dimension = _dimension(*(["1"] * successes_per_required_dimension))
    derived = derive_concept(
        ConceptProjection(dimension, dimension, dimension),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory.projectable(),
    )

    assert derived.status is expected


def test_all_non_degradation_statuses_are_selected_without_memory_inputs() -> None:
    unseen = derive_concept(
        ConceptProjection.zero(PARAMETERS),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory(),
    )
    discovered = derive_concept(
        ConceptProjection.zero(PARAMETERS),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory(has_passive_exposure=True),
    )
    learning = derive_concept(
        ConceptProjection.zero(PARAMETERS),
        concept_type=ConceptType.WORD,
        history=ProjectionHistory(has_learning_intent=True),
    )

    assert unseen.status is ConceptStatus.UNSEEN
    assert discovered.status is ConceptStatus.DISCOVERED
    assert learning.status is ConceptStatus.LEARNING


@pytest.mark.parametrize(("outcome", "weight"), [("-0.1", "1"), ("1.1", "1"), ("0.5", "-1")])
def test_invalid_observation_domain_values_are_rejected(outcome: str, weight: str) -> None:
    with pytest.raises(ValueError):
        _observation(outcome, weight=weight)
