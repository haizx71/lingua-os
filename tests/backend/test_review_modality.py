from __future__ import annotations

from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import ReviewExerciseMode
from lingua_api.review.modality import ReviewMaterial, ReviewPromptSelection, select_review_prompt


def _score(value: float, evidence_count: int) -> CompetenceScoreProjection:
    return CompetenceScoreProjection(
        score=value,
        confidence=0.5,
        evidence_count=evidence_count,
        updated_at=None,
    )


def _competence(
    *,
    recognition: tuple[float, int] = (0.5, 0),
    listening: tuple[float, int] = (0.5, 0),
    production: tuple[float, int] = (0.5, 0),
) -> CompetenceProjection:
    return CompetenceProjection(
        recognition=_score(*recognition),
        listening=_score(*listening),
        production=_score(*production),
    )


def _select(competence: CompetenceProjection, material: ReviewMaterial) -> ReviewPromptSelection:
    return select_review_prompt(
        fallback_prompt_text="Một cuộc hẹn.",
        competence=competence,
        material=material,
    )


def test_equal_weak_scores_use_stable_recognition_first_tie_break() -> None:
    selected = _select(
        _competence(recognition=(0.2, 2), listening=(0.2, 2), production=(0.8, 2)),
        ReviewMaterial(
            example_sentence="I made an appointment yesterday.",
            example_translation="Hôm qua tôi đã đặt một cuộc hẹn.",
            example_start_offset=10,
            example_end_offset=21,
            audio_url="https://media.example.test/appointment.mp3",
            translated_definition="Một cuộc hẹn.",
        ),
    )

    assert selected.exercise_mode is ReviewExerciseMode.CLOZE
    assert selected.context_sentence == "I made an _______ yesterday."


def test_listening_is_selected_when_it_is_the_weakest_observed_dimension() -> None:
    selected = _select(
        _competence(recognition=(0.7, 2), listening=(0.1, 1), production=(0.8, 2)),
        ReviewMaterial(audio_url="https://media.example.test/appointment.mp3"),
    )

    assert selected.exercise_mode is ReviewExerciseMode.LISTENING
    assert selected.audio_url == "https://media.example.test/appointment.mp3"


def test_production_uses_typing_when_a_vietnamese_definition_exists() -> None:
    selected = _select(
        _competence(recognition=(0.8, 2), listening=(0.7, 2), production=(0.1, 1)),
        ReviewMaterial(translated_definition="Một cuộc hẹn."),
    )

    assert selected.exercise_mode is ReviewExerciseMode.TYPING
    assert selected.prompt_text == "Một cuộc hẹn."


def test_missing_example_and_audio_skip_unsupported_dimensions() -> None:
    selected = _select(
        _competence(recognition=(0.1, 1), listening=(0.2, 1), production=(0.3, 1)),
        ReviewMaterial(
            example_sentence="I made an appointment.",
            example_start_offset=99,
            example_end_offset=110,
        ),
    )

    assert selected.exercise_mode is ReviewExerciseMode.SELF_RECALL
    assert selected.prompt_text == "Một cuộc hẹn."


def test_zero_evidence_dimensions_are_unknown_and_use_self_recall() -> None:
    selected = _select(
        _competence(),
        ReviewMaterial(
            example_sentence="I made an appointment.",
            example_start_offset=10,
            example_end_offset=21,
            audio_url="https://media.example.test/appointment.mp3",
            translated_definition="Một cuộc hẹn.",
        ),
    )

    assert selected.exercise_mode is ReviewExerciseMode.SELF_RECALL


def test_non_https_audio_is_not_eligible_for_listening() -> None:
    selected = _select(
        _competence(recognition=(0.9, 1), listening=(0.1, 1), production=(0.8, 1)),
        ReviewMaterial(audio_url="s3://private-bucket/audio.mp3"),
    )

    assert selected.exercise_mode is ReviewExerciseMode.SELF_RECALL
