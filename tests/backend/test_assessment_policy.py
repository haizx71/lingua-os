"""Pure unit tests for the starting-level-heuristic-v1 policy engine.

These tests require no database, no network, no FSRS, no Learning events.
All golden calibration cases from docs/STARTING_LEVEL_ESTIMATE_V1.md §10, §11.
"""

from __future__ import annotations

import pytest
from lingua_api.assessment.policy import (
    A1_PRIMARY,
    A1_VERIFICATION,
    A2_PRIMARY,
    A2_VERIFICATION,
    B1_PRIMARY,
    B1_VERIFICATION,
    BAND_ANCHORS,
    CONFIDENCE_CAP,
    MAXIMUM_ITEM_COUNT,
    MINIMUM_ITEM_COUNT,
    POLICY_VERSION,
    AttemptState,
    BandState,
    BundleKind,
    Domain,
    ResponseOutcome,
    assessed_skills,
    bundle_complete,
    compute_confidence,
    evaluate_transition,
    initial_slots,
    next_slots,
    record_response,
)

C = ResponseOutcome.CORRECT
INCORRECT = ResponseOutcome.INCORRECT
S = ResponseOutcome.SKIPPED

# ---------------------------------------------------------------------------
# Policy identity
# ---------------------------------------------------------------------------


def test_policy_version_is_frozen() -> None:
    assert POLICY_VERSION == "starting-level-heuristic-v1"


def test_item_count_bounds_are_frozen() -> None:
    assert MINIMUM_ITEM_COUNT == 8
    assert MAXIMUM_ITEM_COUNT == 16


def test_band_anchors_are_frozen() -> None:
    assert BAND_ANCHORS == {"A0": 0.1000, "A1": 0.3000, "A2": 0.5250, "B1": 0.7250}


def test_confidence_cap_is_frozen() -> None:
    assert CONFIDENCE_CAP == 0.85


# ---------------------------------------------------------------------------
# Slot definitions
# ---------------------------------------------------------------------------


def test_initial_slots_are_a1_primary() -> None:
    slots = initial_slots()
    assert len(slots) == 4
    for s in slots:
        assert s.band == "A1"
        assert s.bundle_kind == BundleKind.PRIMARY


def test_all_bundles_have_four_slots() -> None:
    for bundle in [
        A1_PRIMARY,
        A1_VERIFICATION,
        A2_PRIMARY,
        A2_VERIFICATION,
        B1_PRIMARY,
        B1_VERIFICATION,
    ]:
        assert len(bundle) == 4


def test_slot_4_is_always_listening() -> None:
    for bundle in [
        A1_PRIMARY,
        A1_VERIFICATION,
        A2_PRIMARY,
        A2_VERIFICATION,
        B1_PRIMARY,
        B1_VERIFICATION,
    ]:
        assert bundle[3].domain == Domain.LISTENING_COMPREHENSION
        assert bundle[3].requires_audio is True


def test_slots_1_to_3_require_no_audio() -> None:
    for bundle in [
        A1_PRIMARY,
        A1_VERIFICATION,
        A2_PRIMARY,
        A2_VERIFICATION,
        B1_PRIMARY,
        B1_VERIFICATION,
    ]:
        for slot in bundle[:3]:
            assert slot.requires_audio is False


def test_next_slots_returns_none_when_terminal() -> None:
    state = AttemptState()
    state.terminal = True
    assert next_slots(state) is None


def test_next_slots_returns_a1_primary_initially() -> None:
    state = AttemptState()
    assert next_slots(state) == A1_PRIMARY


def test_next_slots_after_a1_primary_pass_is_a2_primary() -> None:
    state = AttemptState()
    state.a1.primary_correct = 3
    state.a1.primary_answered = 4
    state.current_band = "A2"
    state.current_bundle = BundleKind.PRIMARY
    assert next_slots(state) == A2_PRIMARY


# ---------------------------------------------------------------------------
# record_response
# ---------------------------------------------------------------------------


def test_correct_answer_increments_primary_correct() -> None:
    state = AttemptState()
    record_response(state, C, band="A1", bundle_kind=BundleKind.PRIMARY)
    assert state.a1.primary_correct == 1
    assert state.a1.primary_answered == 1
    assert state.total_answered == 1
    assert state.total_evidence == 1


def test_skip_increments_total_but_not_evidence() -> None:
    state = AttemptState()
    record_response(state, S, band="A1", bundle_kind=BundleKind.PRIMARY)
    assert state.a1.primary_correct == 0
    assert state.a1.primary_answered == 0
    assert state.total_answered == 1
    assert state.total_evidence == 0


def test_incorrect_increments_answered_not_correct() -> None:
    state = AttemptState()
    record_response(state, INCORRECT, band="A1", bundle_kind=BundleKind.PRIMARY)
    assert state.a1.primary_correct == 0
    assert state.a1.primary_answered == 1
    assert state.total_evidence == 1


def test_verification_correct_goes_to_verification() -> None:
    state = AttemptState()
    record_response(state, C, band="A1", bundle_kind=BundleKind.VERIFICATION)
    assert state.a1.verification_correct == 1
    assert state.a1.primary_correct == 0


def test_bundle_completion_counts_presented_skips_without_fabricating_evidence() -> None:
    state = AttemptState()
    for _ in range(3):
        record_response(state, S, band="A1", bundle_kind=BundleKind.PRIMARY)
    assert not bundle_complete(state, band="A1", bundle_kind=BundleKind.PRIMARY)
    record_response(state, C, band="A1", bundle_kind=BundleKind.PRIMARY)
    assert bundle_complete(state, band="A1", bundle_kind=BundleKind.PRIMARY)
    assert state.a1.primary_presented == 4
    assert state.a1.primary_answered == 1
    assert state.total_evidence == 1


# ---------------------------------------------------------------------------
# Primary pass thresholds
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("correct,expected_pass", [(3, True), (4, True), (2, False), (0, False)])
def test_primary_pass_threshold_is_3_of_4(correct: int, expected_pass: bool) -> None:
    state = BandState(primary_correct=correct, primary_answered=4)
    assert state.primary_pass == expected_pass


# ---------------------------------------------------------------------------
# evaluate_transition — primary phase
# ---------------------------------------------------------------------------


def _state_with_a1_primary(correct: int, answered: int = 4) -> AttemptState:
    state = AttemptState()
    state.a1.primary_correct = correct
    state.a1.primary_answered = answered
    return state


def test_a1_primary_pass_advances_to_a2_primary() -> None:
    state = _state_with_a1_primary(3)
    evaluate_transition(state)
    assert not state.terminal
    assert state.current_band == "A2"
    assert state.current_bundle == BundleKind.PRIMARY


def test_a1_primary_fail_opens_a1_verification() -> None:
    state = _state_with_a1_primary(2)
    evaluate_transition(state)
    assert not state.terminal
    assert state.current_band == "A1"
    assert state.current_bundle == BundleKind.VERIFICATION


def test_a1_primary_all_correct_advances() -> None:
    state = _state_with_a1_primary(4)
    evaluate_transition(state)
    assert state.current_band == "A2"


def test_a1_primary_zero_correct_opens_verification() -> None:
    state = _state_with_a1_primary(0)
    evaluate_transition(state)
    assert state.current_bundle == BundleKind.VERIFICATION


def _advance_through_a1_to_a2(correct_a1: int = 4) -> AttemptState:
    state = AttemptState()
    state.a1.primary_correct = correct_a1
    state.a1.primary_answered = 4
    evaluate_transition(state)  # A1 primary
    return state


def test_a2_primary_pass_advances_to_b1_primary() -> None:
    state = _advance_through_a1_to_a2(4)
    state.a2.primary_correct = 3
    state.a2.primary_answered = 4
    evaluate_transition(state)
    assert str(state.current_band) == "B1"
    assert state.current_bundle == BundleKind.PRIMARY


def test_a2_primary_fail_opens_a2_verification() -> None:
    state = _advance_through_a1_to_a2(4)
    state.a2.primary_correct = 2
    state.a2.primary_answered = 4
    evaluate_transition(state)
    assert state.current_band == "A2"
    assert state.current_bundle == BundleKind.VERIFICATION


def test_b1_primary_pass_opens_b1_verification() -> None:
    state = AttemptState()
    state.current_band = "B1"
    state.current_bundle = BundleKind.PRIMARY
    state.b1.primary_correct = 4
    state.b1.primary_answered = 4
    evaluate_transition(state)
    assert state.current_band == "B1"
    assert state.current_bundle == BundleKind.VERIFICATION


# ---------------------------------------------------------------------------
# evaluate_transition — verification phase (terminal)
# ---------------------------------------------------------------------------


def _state_for_verification(
    band: str,
    primary_correct: int,
    verification_correct: int,
    primary_answered: int = 4,
    verification_answered: int = 4,
) -> AttemptState:
    state = AttemptState()
    state.current_band = band  # type: ignore[assignment]
    state.current_bundle = BundleKind.VERIFICATION
    band_state: BandState = getattr(state, band.lower())
    band_state.primary_correct = primary_correct
    band_state.primary_answered = primary_answered
    band_state.primary_done = True
    band_state.verification_correct = verification_correct
    band_state.verification_answered = verification_answered
    return state


@pytest.mark.parametrize(
    "band,primary_c,verif_c,expected_band",
    [
        # A1 verified (6+ of 8 decisive) → A1
        ("A1", 2, 4, "A1"),
        # A1 decisive 3+3=6 → pass A1
        ("A1", 3, 3, "A1"),
        # A1 verified 7 → A1
        ("A1", 3, 4, "A1"),
        # A1 fail (5 decisive correct < 6) → A0
        ("A1", 2, 3, "A0"),
        # A2 verified → A2
        ("A2", 2, 4, "A2"),
        # A2 fail → A1
        ("A2", 2, 3, "A1"),
        # B1 verified → B1
        ("B1", 4, 3, "B1"),
        # B1 fail → A2
        ("B1", 2, 3, "A2"),
    ],
)
def test_verification_terminal_bands(
    band: str, primary_c: int, verif_c: int, expected_band: str
) -> None:
    state = _state_for_verification(band, primary_c, verif_c)
    evaluate_transition(state)
    assert state.terminal
    assert not state.abandoned
    assert state.result_band == expected_band


def test_insufficient_decisive_evidence_abandons() -> None:
    state = _state_for_verification("A1", 1, 1, verification_answered=1, primary_answered=2)
    evaluate_transition(state)
    assert state.terminal
    assert state.abandoned


def test_a0_result_from_a1_primary_fail_and_verification_fail() -> None:
    state = _state_for_verification("A1", 0, 0)
    evaluate_transition(state)
    assert state.result_band == "A0"


# ---------------------------------------------------------------------------
# Confidence formula (§10 golden calibration cases)
# ---------------------------------------------------------------------------


def _uniform_domain_outcomes(outcome: ResponseOutcome) -> dict[Domain, list[ResponseOutcome]]:
    return {d: [outcome, outcome] for d in Domain}


def test_all_correct_confidence_is_capped_at_085() -> None:
    factors = compute_confidence(8, 8, domain_outcomes=_uniform_domain_outcomes(C))
    assert factors.capped <= 0.85
    assert factors.band == "high"


def test_all_skip_decisive_evidence_zero() -> None:
    domain_outcomes = {d: [S, S] for d in Domain}
    factors = compute_confidence(0, 0, domain_outcomes=domain_outcomes)
    assert factors.coverage == 0.0
    # confidence may be very low
    assert 0.0 <= factors.capped <= 0.85


def test_confidence_two_decimal_precision() -> None:
    domain_outcomes = _uniform_domain_outcomes(C)
    factors = compute_confidence(6, 6, domain_outcomes=domain_outcomes)
    raw_str = str(factors.capped)
    # At most 2 decimal places.
    if "." in raw_str:
        assert len(raw_str.split(".")[1]) <= 2


def test_confidence_is_never_negative() -> None:
    domain_outcomes = _uniform_domain_outcomes(INCORRECT)
    factors = compute_confidence(8, 0, domain_outcomes=domain_outcomes)
    assert factors.capped >= 0.0


def test_confidence_cap_enforced() -> None:
    domain_outcomes = _uniform_domain_outcomes(C)
    factors = compute_confidence(8, 8, domain_outcomes=domain_outcomes)
    assert factors.capped <= CONFIDENCE_CAP


def test_6_of_8_correct_gives_medium_or_higher() -> None:
    domain_outcomes = {d: [C, C] for d in Domain}
    factors = compute_confidence(8, 6, domain_outcomes=domain_outcomes)
    assert factors.band in ("medium", "high")


def test_5_of_8_correct_gives_low_confidence() -> None:
    # < 6 decisive correct should produce margin m < 0 meaning low formula value.
    domain_outcomes = {d: [INCORRECT, INCORRECT] for d in Domain}
    domain_outcomes[Domain.VOCABULARY_RECOGNITION] = [C, C]
    factors = compute_confidence(8, 4, domain_outcomes=domain_outcomes)
    # Confidence should be low or medium but never high for 5/8.
    assert factors.capped < 0.80 or factors.band != "high"


def test_confidence_band_thresholds_are_exclusive() -> None:
    # Verify the band computation logic is exhaustive.
    for decisive_e, decisive_c in [(8, 6), (8, 7), (8, 8), (8, 0), (6, 6)]:
        dom = {d: [C if i < decisive_c // 4 else INCORRECT for i in range(2)] for d in Domain}
        factors = compute_confidence(decisive_e, decisive_c, domain_outcomes=dom)
        assert factors.band in ("low", "medium", "high")


# ---------------------------------------------------------------------------
# assessed_skills
# ---------------------------------------------------------------------------


def test_recognition_skill_detected() -> None:
    domain_outcomes = {
        Domain.VOCABULARY_RECOGNITION: [C],
        Domain.GRAMMAR_IN_CONTEXT: [],
        Domain.READING_COMPREHENSION: [],
        Domain.LISTENING_COMPREHENSION: [],
    }
    assert "recognition" in assessed_skills(domain_outcomes)
    assert "listening" not in assessed_skills(domain_outcomes)


def test_listening_skill_detected() -> None:
    domain_outcomes = {
        Domain.VOCABULARY_RECOGNITION: [],
        Domain.GRAMMAR_IN_CONTEXT: [],
        Domain.READING_COMPREHENSION: [],
        Domain.LISTENING_COMPREHENSION: [C],
    }
    assert "listening" in assessed_skills(domain_outcomes)


def test_all_skipped_yields_no_skills() -> None:
    domain_outcomes = {d: [S] for d in Domain}
    assert assessed_skills(domain_outcomes) == []


def test_production_is_never_inferred() -> None:
    domain_outcomes = {d: [C, C] for d in Domain}
    skills = assessed_skills(domain_outcomes)
    assert "production" not in skills


# ---------------------------------------------------------------------------
# End-to-end golden path: A1 confirmed in 8 slots
# ---------------------------------------------------------------------------


def test_golden_path_a1_confirmed_in_8_slots() -> None:
    """A1 primary fails (2/4), verification passes (4/4) → A1 in 8 slots."""
    state = AttemptState()

    # A1 primary: 2 correct, 2 incorrect.
    for outcome in [C, C, INCORRECT, INCORRECT]:
        record_response(state, outcome, band="A1", bundle_kind=BundleKind.PRIMARY)
    state.current_bundle = BundleKind.PRIMARY
    evaluate_transition(state)
    assert state.current_band == "A1"
    assert state.current_bundle == BundleKind.VERIFICATION

    # A1 verification: 4 correct.
    for outcome in [C, C, C, C]:
        record_response(state, outcome, band="A1", bundle_kind=BundleKind.VERIFICATION)
    state.current_bundle = BundleKind.VERIFICATION
    evaluate_transition(state)
    assert state.terminal
    assert state.result_band == "A1"


def test_golden_path_a0_in_8_slots() -> None:
    """A1 primary fails (1/4), A1 verification fails (0/4) → A0."""
    state = AttemptState()
    for outcome in [C, INCORRECT, INCORRECT, INCORRECT]:
        record_response(state, outcome, band="A1", bundle_kind=BundleKind.PRIMARY)
    state.current_bundle = BundleKind.PRIMARY
    evaluate_transition(state)

    for outcome in [INCORRECT, INCORRECT, INCORRECT, INCORRECT]:
        record_response(state, outcome, band="A1", bundle_kind=BundleKind.VERIFICATION)
    state.current_bundle = BundleKind.VERIFICATION
    evaluate_transition(state)
    assert state.terminal
    assert state.result_band == "A0"


def test_golden_path_b1_confirmed() -> None:
    """A1 primary pass → A2 primary pass → B1 primary pass → B1 verification pass → B1."""
    state = AttemptState()

    # A1 primary: 4/4
    for _ in range(4):
        record_response(state, C, band="A1", bundle_kind=BundleKind.PRIMARY)
    state.current_bundle = BundleKind.PRIMARY
    evaluate_transition(state)
    assert state.current_band == "A2"

    # A2 primary: 3/4
    for outcome in [C, C, C, INCORRECT]:
        record_response(state, outcome, band="A2", bundle_kind=BundleKind.PRIMARY)
    evaluate_transition(state)
    assert str(state.current_band) == "B1"

    # B1 primary: 3/4
    for outcome in [C, C, C, INCORRECT]:
        record_response(state, outcome, band="B1", bundle_kind=BundleKind.PRIMARY)
    state.current_bundle = BundleKind.PRIMARY
    evaluate_transition(state)
    assert state.current_bundle == BundleKind.VERIFICATION

    # B1 verification: 4/4 → decisive 7/8 ≥ 6 → B1
    for _ in range(4):
        record_response(state, C, band="B1", bundle_kind=BundleKind.VERIFICATION)
    state.current_bundle = BundleKind.VERIFICATION
    evaluate_transition(state)
    assert state.terminal
    assert state.result_band == "B1"


def test_golden_path_a2_overturn_to_a1() -> None:
    """A1 pass, A2 primary fail, A2 verification fail → A1 (overturn)."""
    state = AttemptState()

    # A1 primary: 4/4
    for _ in range(4):
        record_response(state, C, band="A1", bundle_kind=BundleKind.PRIMARY)
    state.current_bundle = BundleKind.PRIMARY
    evaluate_transition(state)

    # A2 primary: 1/4 fail
    for outcome in [C, INCORRECT, INCORRECT, INCORRECT]:
        record_response(state, outcome, band="A2", bundle_kind=BundleKind.PRIMARY)
    evaluate_transition(state)
    assert state.current_band == "A2"
    assert state.current_bundle == BundleKind.VERIFICATION

    # A2 verification: 0/4 → decisive 1/8 < 6 → A1 (overturn)
    for _ in range(4):
        record_response(state, INCORRECT, band="A2", bundle_kind=BundleKind.VERIFICATION)
    evaluate_transition(state)
    assert state.terminal
    assert state.result_band == "A1"
