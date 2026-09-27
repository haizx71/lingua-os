"""Deterministic Review modality selection from observed competence and canonical material."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import ReviewExerciseMode


@dataclass(frozen=True)
class ReviewMaterial:
    translated_definition: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    example_start_offset: int | None = None
    example_end_offset: int | None = None
    audio_url: str | None = None


@dataclass(frozen=True)
class ReviewPromptSelection:
    exercise_mode: ReviewExerciseMode
    prompt_text: str
    context_sentence: str | None = None
    translation: str | None = None
    audio_url: str | None = None


_DIMENSION_ORDER = {"recognition": 0, "listening": 1, "production": 2}


def select_review_prompt(
    *,
    fallback_prompt_text: str,
    competence: CompetenceProjection,
    material: ReviewMaterial,
) -> ReviewPromptSelection:
    """Select the weakest observed dimension with usable material; ties are stable.

    Zero-evidence dimensions are unknown rather than weak, so they are not ranked.
    Unsupported modalities are skipped and the selector falls back to self-recall.
    """
    dimensions: tuple[tuple[str, CompetenceScoreProjection], ...] = (
        ("recognition", competence.recognition),
        ("listening", competence.listening),
        ("production", competence.production),
    )
    ranked = sorted(
        (
            (score.score, _DIMENSION_ORDER[name], name)
            for name, score in dimensions
            if score.evidence_count > 0
        ),
        key=lambda item: (item[0], item[1]),
    )
    safe_translation = _bounded_text(material.example_translation, 3000)
    safe_example = _bounded_text(material.example_sentence, 3000)

    for _, _, dimension in ranked:
        if dimension == "recognition":
            cloze = _cloze_sentence(
                safe_example,
                material.example_start_offset,
                material.example_end_offset,
            )
            if cloze is not None:
                return ReviewPromptSelection(
                    exercise_mode=ReviewExerciseMode.CLOZE,
                    prompt_text="Điền từ còn thiếu vào câu ví dụ.",
                    context_sentence=cloze,
                    translation=safe_translation,
                )
        elif dimension == "listening":
            audio_url = _https_audio_url(material.audio_url)
            if audio_url is not None:
                return ReviewPromptSelection(
                    exercise_mode=ReviewExerciseMode.LISTENING,
                    prompt_text="Nghe âm thanh và nhớ lại từ hoặc cụm từ.",
                    audio_url=audio_url,
                )
        elif dimension == "production":
            definition = _bounded_text(material.translated_definition, 2000)
            if definition is not None:
                return ReviewPromptSelection(
                    exercise_mode=ReviewExerciseMode.TYPING,
                    prompt_text=definition,
                )

    return ReviewPromptSelection(
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        prompt_text=fallback_prompt_text,
        context_sentence=safe_example,
        translation=safe_translation,
    )


def _cloze_sentence(
    sentence: str | None,
    start_offset: int | None,
    end_offset: int | None,
) -> str | None:
    if (
        sentence is None
        or start_offset is None
        or end_offset is None
        or start_offset < 0
        or end_offset <= start_offset
        or end_offset > len(sentence)
        or not sentence[start_offset:end_offset].strip()
    ):
        return None
    return f"{sentence[:start_offset]}_____{sentence[end_offset:]}"


def _bounded_text(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized or len(normalized) > max_length:
        return None
    return normalized


def _https_audio_url(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
        ):
            return None
    except ValueError:
        return None
    return value
