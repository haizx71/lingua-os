from __future__ import annotations

from uuid import UUID

from lingua_api.reader.analyze_policy import (
    CatalogMatchCandidate,
    analyze_transient_text,
)

MAKE = UUID("00000000-0000-4000-8000-000000000001")
AN = UUID("00000000-0000-4000-8000-000000000002")
APPOINTMENT = UUID("00000000-0000-4000-8000-000000000003")
MAKE_APPOINTMENT = UUID("00000000-0000-4000-8000-000000000004")
NEW_YORK = UUID("00000000-0000-4000-8000-000000000005")
NEW_YORK_CITY = UUID("00000000-0000-4000-8000-000000000006")


def _candidate(concept_id: UUID, form: str, canonical: str | None = None) -> CatalogMatchCandidate:
    return CatalogMatchCandidate(concept_id, canonical or form, form)


def _annotations(
    text: str, candidates: tuple[CatalogMatchCandidate, ...]
) -> list[tuple[str, int, int, str]]:
    analysis = analyze_transient_text(text, candidates)
    return [
        (
            annotation.canonical_form,
            annotation.start_offset_utf16,
            annotation.end_offset_utf16,
            sentence.text[annotation.start_index : annotation.end_index],
        )
        for segment in analysis
        for sentence in segment.sentences
        for annotation in sentence.annotations
    ]


def test_leftmost_longest_prefers_phrase_over_nested_words() -> None:
    candidates = (
        _candidate(MAKE, "make"),
        _candidate(AN, "an"),
        _candidate(APPOINTMENT, "appointment"),
        _candidate(MAKE_APPOINTMENT, "make an appointment"),
    )

    assert _annotations("make an appointment", candidates) == [
        ("make an appointment", 0, 19, "make an appointment")
    ]


def test_longest_exact_match_selects_new_york_city() -> None:
    candidates = (
        _candidate(NEW_YORK, "new york", "New York"),
        _candidate(NEW_YORK_CITY, "new york city", "New York City"),
    )

    assert _annotations("New York City", candidates) == [("New York City", 0, 13, "New York City")]


def test_earlier_match_wins_and_discards_later_overlap() -> None:
    early = _candidate(MAKE, "alpha beta", "alpha beta")
    later = _candidate(APPOINTMENT, "beta gamma", "beta gamma")

    assert _annotations("alpha beta gamma", (later, early)) == [("alpha beta", 0, 10, "alpha beta")]


def test_equal_span_uses_stable_concept_uuid_tie_break() -> None:
    higher = _candidate(UUID("ffffffff-ffff-4fff-8fff-ffffffffffff"), "term", "higher")
    lower = _candidate(UUID("00000000-0000-4000-8000-000000000001"), "term", "lower")

    analysis = analyze_transient_text("term", (higher, lower))
    annotation = analysis[0].sentences[0].annotations[0]

    assert annotation.concept_id == lower.concept_id


def test_repeated_phrase_occurrences_are_resolved_independently() -> None:
    phrase = _candidate(MAKE_APPOINTMENT, "make an appointment")

    assert _annotations("make an appointment, then make an appointment.", (phrase,)) == [
        ("make an appointment", 0, 19, "make an appointment"),
        ("make an appointment", 26, 45, "make an appointment"),
    ]


def test_punctuation_and_compatibility_whitespace_preserve_original_span() -> None:
    phrase = _candidate(NEW_YORK_CITY, "new york city", "New York City")

    fullwidth = "\uff2e\uff45\uff57   \uff39\uff4f\uff52\uff4b \uff23\uff49\uff54\uff59"
    assert _annotations(f"({fullwidth})!", (phrase,)) == [("New York City", 1, 16, fullwidth)]


def test_unicode_combining_text_and_emoji_use_original_utf16_offsets() -> None:
    cafe = _candidate(MAKE, "café", "café")

    assert _annotations("🙂 CAFE\u0301!", (cafe,)) == [("café", 3, 8, "CAFE\u0301")]


def test_substring_inside_larger_unicode_token_does_not_match() -> None:
    appointment = _candidate(APPOINTMENT, "appointment")

    assert _annotations("preappointment appointment2 appointment", (appointment,)) == [
        ("appointment", 28, 39, "appointment")
    ]


def test_unknown_token_remains_unmatched() -> None:
    assert _annotations("flibbertigibbet", (_candidate(MAKE, "make"),)) == []


def test_phrase_never_crosses_a_sentence_boundary_and_results_are_deterministic() -> None:
    phrase = _candidate(MAKE_APPOINTMENT, "appointment make", "appointment make")
    word = _candidate(APPOINTMENT, "appointment")
    text = "appointment. Make an appointment!"

    first = analyze_transient_text(text, (phrase, word))
    second = analyze_transient_text(text, (word, phrase))

    assert first == second
    assert [sentence.text for segment in first for sentence in segment.sentences] == [
        "appointment.",
        "Make an appointment!",
    ]
    assert _annotations(text, (phrase, word)) == [
        ("appointment", 0, 11, "appointment"),
        ("appointment", 8, 19, "appointment"),
    ]
