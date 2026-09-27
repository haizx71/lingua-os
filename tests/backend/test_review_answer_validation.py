from __future__ import annotations

import pytest
from lingua_api.review.models import (
    ReviewAnswerRequestDto,
    ReviewExerciseModeDto,
    ReviewRatingDto,
)
from pydantic import ValidationError


@pytest.mark.parametrize(
    "exercise_mode",
    [
        ReviewExerciseModeDto.MULTIPLE_CHOICE,
        ReviewExerciseModeDto.TYPING,
        ReviewExerciseModeDto.CLOZE,
        ReviewExerciseModeDto.LISTENING,
    ],
)
def test_caller_correctness_is_rejected_for_ungraded_modes(
    exercise_mode: ReviewExerciseModeDto,
) -> None:
    with pytest.raises(ValidationError, match="correct is accepted only for self_recall"):
        ReviewAnswerRequestDto(
            rating=ReviewRatingDto.GOOD,
            exercise_mode=exercise_mode,
            correct=True,
            response_time_ms=0,
        )


@pytest.mark.parametrize("exercise_mode", [None, ReviewExerciseModeDto.SELF_RECALL])
def test_caller_correctness_remains_allowed_for_self_recall_compatibility(
    exercise_mode: ReviewExerciseModeDto | None,
) -> None:
    request = ReviewAnswerRequestDto(
        rating=ReviewRatingDto.GOOD,
        exercise_mode=exercise_mode,
        correct=True,
        response_time_ms=0,
    )

    assert request.correct is True
