from __future__ import annotations

from dataclasses import fields, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from lingua_api.memory.domain import (
    EvidenceMode,
    FsrsParameters,
    MemoryState,
    MemoryStateSnapshot,
    ParameterSet,
    ReviewExerciseMode,
    ReviewRating,
    ReviewSubmission,
    map_exercise_mode,
)
from lingua_api.memory.scheduler import FsrsSchedulerAdapter

REVIEW_ITEM_ID = UUID("10000000-0000-4000-8000-000000000001")
PARAMETER_SET_ID = UUID("00000000-0000-4000-8600-000000000001")
REVIEWED_AT = datetime(2026, 8, 22, 3, 0, tzinfo=UTC)


@pytest.fixture
def parameter_set() -> ParameterSet:
    return ParameterSet(
        id=PARAMETER_SET_ID,
        version="fsrs6-global-default-v1",
        algorithm_version="FSRS-6",
        library_version="6.3.2",
        parameters=FsrsParameters(
            model_weights=(
                0.212,
                1.2931,
                2.3065,
                8.2956,
                6.4133,
                0.8334,
                3.0194,
                0.001,
                1.8722,
                0.1666,
                0.796,
                1.4835,
                0.0614,
                0.2629,
                1.6483,
                0.6014,
                1.8729,
                0.5425,
                0.0912,
                0.0658,
                0.1542,
            ),
            desired_retention=0.9,
            learning_steps_seconds=(60, 600),
            relearning_steps_seconds=(600,),
            maximum_interval_days=36500,
            enable_fuzzing=False,
        ),
    )


@pytest.fixture
def new_state() -> MemoryStateSnapshot:
    return MemoryStateSnapshot(
        review_item_id=REVIEW_ITEM_ID,
        difficulty=None,
        stability=None,
        due_at=REVIEWED_AT,
        last_review_at=None,
        state=MemoryState.NEW,
        step=None,
        parameter_set_id=PARAMETER_SET_ID,
        params_version="fsrs6-global-default-v1",
        state_version=1,
    )


@pytest.mark.parametrize(
    ("exercise_mode", "evidence_mode"),
    [
        (ReviewExerciseMode.SELF_RECALL, EvidenceMode.PRODUCTION),
        (ReviewExerciseMode.MULTIPLE_CHOICE, EvidenceMode.RECOGNITION),
        (ReviewExerciseMode.TYPING, EvidenceMode.PRODUCTION),
        (ReviewExerciseMode.CLOZE, EvidenceMode.CLOZE),
        (ReviewExerciseMode.LISTENING, EvidenceMode.LISTENING),
    ],
)
def test_contract_exercise_modes_map_to_internal_evidence_modes(
    exercise_mode: ReviewExerciseMode, evidence_mode: EvidenceMode
) -> None:
    assert map_exercise_mode(exercise_mode) is evidence_mode


@pytest.mark.parametrize("rating", list(ReviewRating))
def test_first_review_calculates_a_valid_due_date_for_every_rating(
    parameter_set: ParameterSet,
    new_state: MemoryStateSnapshot,
    rating: ReviewRating,
) -> None:
    transition = FsrsSchedulerAdapter().transition(
        state=new_state,
        rating=rating,
        reviewed_at=REVIEWED_AT,
        parameter_set=parameter_set,
        response_time_ms=850,
    )

    assert transition.state.difficulty is not None
    assert transition.state.stability is not None
    assert 1 <= transition.state.difficulty <= 10
    assert transition.state.stability > 0
    assert transition.state.due_at > REVIEWED_AT
    assert transition.state.due_at.utcoffset() == timedelta(0)
    assert transition.state.last_review_at == REVIEWED_AT
    assert transition.state.state is not MemoryState.NEW
    assert transition.state.state_version == 2
    assert transition.reviewed_at == REVIEWED_AT


def test_first_review_due_dates_follow_rating_strength(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    adapter = FsrsSchedulerAdapter()
    due_dates = {
        rating: adapter.transition(
            state=new_state,
            rating=rating,
            reviewed_at=REVIEWED_AT,
            parameter_set=parameter_set,
            response_time_ms=850,
        ).state.due_at
        for rating in ReviewRating
    }

    assert due_dates[ReviewRating.AGAIN] < due_dates[ReviewRating.HARD]
    assert due_dates[ReviewRating.HARD] < due_dates[ReviewRating.GOOD]
    assert due_dates[ReviewRating.GOOD] < due_dates[ReviewRating.EASY]


def test_transition_is_deterministic_when_clock_and_parameters_are_fixed(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    adapter = FsrsSchedulerAdapter()

    first = adapter.transition(
        state=new_state,
        rating=ReviewRating.GOOD,
        reviewed_at=REVIEWED_AT,
        parameter_set=parameter_set,
        response_time_ms=850,
    )
    second = adapter.transition(
        state=new_state,
        rating=ReviewRating.GOOD,
        reviewed_at=REVIEWED_AT,
        parameter_set=parameter_set,
        response_time_ms=850,
    )

    assert first == second


def test_review_lifecycle_reaches_review_and_relearning(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    adapter = FsrsSchedulerAdapter()
    reviewed = adapter.transition(
        state=new_state,
        rating=ReviewRating.EASY,
        reviewed_at=REVIEWED_AT,
        parameter_set=parameter_set,
        response_time_ms=850,
    ).state
    assert reviewed.state is MemoryState.REVIEW

    relearning = adapter.transition(
        state=reviewed,
        rating=ReviewRating.AGAIN,
        reviewed_at=reviewed.due_at,
        parameter_set=parameter_set,
        response_time_ms=850,
    ).state
    assert relearning.state is MemoryState.RELEARNING

    graduated = adapter.transition(
        state=relearning,
        rating=ReviewRating.GOOD,
        reviewed_at=relearning.due_at,
        parameter_set=parameter_set,
        response_time_ms=850,
    ).state
    assert graduated.state is MemoryState.REVIEW


def test_transition_rejects_naive_review_timestamp(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    with pytest.raises(ValueError, match="timezone-aware UTC"):
        FsrsSchedulerAdapter().transition(
            state=new_state,
            rating=ReviewRating.GOOD,
            reviewed_at=REVIEWED_AT.replace(tzinfo=None),
            parameter_set=parameter_set,
            response_time_ms=850,
        )


def test_transition_rejects_out_of_order_review_timestamp(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    reviewed = (
        FsrsSchedulerAdapter()
        .transition(
            state=new_state,
            rating=ReviewRating.GOOD,
            reviewed_at=REVIEWED_AT,
            parameter_set=parameter_set,
            response_time_ms=850,
        )
        .state
    )

    with pytest.raises(ValueError, match="before the previous review"):
        FsrsSchedulerAdapter().transition(
            state=reviewed,
            rating=ReviewRating.GOOD,
            reviewed_at=REVIEWED_AT - timedelta(microseconds=1),
            parameter_set=parameter_set,
            response_time_ms=850,
        )


def test_transition_rejects_wrong_parameter_reference(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    mismatched = ParameterSet(
        id=UUID("00000000-0000-4000-8600-000000000002"),
        version=parameter_set.version,
        algorithm_version=parameter_set.algorithm_version,
        library_version=parameter_set.library_version,
        parameters=parameter_set.parameters,
    )

    with pytest.raises(ValueError, match="parameter set"):
        FsrsSchedulerAdapter().transition(
            state=new_state,
            rating=ReviewRating.GOOD,
            reviewed_at=REVIEWED_AT,
            parameter_set=mismatched,
            response_time_ms=850,
        )


def test_transition_rejects_an_unsupported_algorithm_version(
    parameter_set: ParameterSet, new_state: MemoryStateSnapshot
) -> None:
    unsupported = replace(parameter_set, algorithm_version="unknown-fsrs")

    with pytest.raises(ValueError, match="unsupported algorithm version"):
        FsrsSchedulerAdapter().transition(
            state=new_state,
            rating=ReviewRating.GOOD,
            reviewed_at=REVIEWED_AT,
            parameter_set=unsupported,
            response_time_ms=850,
        )


def test_review_submission_contains_only_learner_owned_contract_inputs() -> None:
    assert {field.name for field in fields(ReviewSubmission)} == {
        "idempotency_key",
        "rating",
        "response_time_ms",
        "correct",
        "response_text",
        "selected_option_id",
    }


def test_unknown_rating_and_exercise_mode_are_rejected() -> None:
    with pytest.raises(ValueError):
        ReviewRating("perfect")
    with pytest.raises(ValueError):
        ReviewExerciseMode("recognition")
