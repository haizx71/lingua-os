"""Deterministic, provider-free matching for transient Reader Analyze v1."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from uuid import UUID

POLICY_VERSION = "reader-analyze-leftmost-longest-exact-v1"
MAX_SENTENCE_LENGTH = 5_000
_SENTENCE_END = frozenset(".!?")
_SENTENCE_CLOSERS = frozenset(('"', "'", "\u201d", "\u2019", ")", "]", "}"))


@dataclass(frozen=True)
class CatalogMatchCandidate:
    concept_id: UUID
    canonical_form: str
    normalized_form: str


@dataclass(frozen=True)
class AnalyzeAnnotation:
    concept_id: UUID
    canonical_form: str
    start_index: int
    end_index: int
    start_offset_utf16: int
    end_offset_utf16: int


@dataclass(frozen=True)
class AnalyzeSentence:
    text: str
    annotations: tuple[AnalyzeAnnotation, ...]


@dataclass(frozen=True)
class AnalyzeSegment:
    text: str
    sentences: tuple[AnalyzeSentence, ...]


@dataclass(frozen=True)
class _NormalizedText:
    value: str
    source_spans: tuple[tuple[int, int], ...]


def normalize_match_text(value: str) -> str:
    """Normalize only the comparison surface; public text always stays untouched."""
    return _normalize_with_source_map(value).value.strip()


def analyze_transient_text(
    text: str, candidates: tuple[CatalogMatchCandidate, ...]
) -> tuple[AnalyzeSegment, ...]:
    """Split bounded text and select non-overlapping exact catalog matches."""
    normalized_candidates = _normalized_candidates(candidates)
    return tuple(
        AnalyzeSegment(
            text=sentence_text,
            sentences=(
                AnalyzeSentence(
                    text=sentence_text,
                    annotations=_match_sentence(sentence_text, normalized_candidates),
                ),
            ),
        )
        for start, end in _sentence_spans(text)
        if (sentence_text := text[start:end])
    )


def candidate_lookup_tokens(text: str) -> tuple[str, ...]:
    """Return distinct normalized word tokens used to narrow one catalog query."""
    tokens: list[str] = []
    seen: set[str] = set()
    normalized = _normalize_with_source_map(text).value
    index = 0
    while index < len(normalized):
        if not _is_token_character(normalized[index]):
            index += 1
            continue
        end = index + 1
        while end < len(normalized) and _is_token_character(normalized[end]):
            end += 1
        token = normalized[index:end]
        if token not in seen:
            seen.add(token)
            tokens.append(token)
        index = end
    return tuple(tokens)


def _normalized_candidates(
    candidates: tuple[CatalogMatchCandidate, ...],
) -> tuple[CatalogMatchCandidate, ...]:
    unique: dict[tuple[UUID, str], CatalogMatchCandidate] = {}
    for candidate in candidates:
        normalized = normalize_match_text(candidate.normalized_form)
        if not normalized:
            continue
        key = (candidate.concept_id, normalized)
        unique[key] = CatalogMatchCandidate(
            concept_id=candidate.concept_id,
            canonical_form=candidate.canonical_form,
            normalized_form=normalized,
        )
    return tuple(unique.values())


def _match_sentence(
    text: str, candidates: tuple[CatalogMatchCandidate, ...]
) -> tuple[AnalyzeAnnotation, ...]:
    normalized = _normalize_with_source_map(text)
    utf16_prefix = _utf16_prefix_lengths(text)
    selected: list[AnalyzeAnnotation] = []
    position = 0
    while position < len(normalized.value):
        matches: list[tuple[int, CatalogMatchCandidate, int, int]] = []
        for candidate in candidates:
            end = position + len(candidate.normalized_form)
            if end > len(normalized.value):
                continue
            if not normalized.value.startswith(candidate.normalized_form, position):
                continue
            if not _is_token_bounded(normalized.value, position, end):
                continue
            source_start = normalized.source_spans[position][0]
            source_end = normalized.source_spans[end - 1][1]
            matches.append((source_end - source_start, candidate, source_start, source_end))
        if not matches:
            position += 1
            continue
        _, winner, source_start, source_end = min(
            matches,
            key=lambda match: (
                -match[0],
                match[1].normalized_form,
                match[1].concept_id,
            ),
        )
        selected.append(
            AnalyzeAnnotation(
                concept_id=winner.concept_id,
                canonical_form=winner.canonical_form,
                start_index=source_start,
                end_index=source_end,
                start_offset_utf16=utf16_prefix[source_start],
                end_offset_utf16=utf16_prefix[source_end],
            )
        )
        position += len(winner.normalized_form)
    return tuple(selected)


def _normalize_with_source_map(value: str) -> _NormalizedText:
    output: list[str] = []
    spans: list[tuple[int, int]] = []
    index = 0
    while index < len(value):
        cluster_start = index
        index += 1
        while index < len(value) and unicodedata.category(value[index]).startswith("M"):
            index += 1
        cluster = value[cluster_start:index]
        if cluster.isspace():
            if output and output[-1] == " ":
                spans[-1] = (spans[-1][0], index)
            else:
                output.append(" ")
                spans.append((cluster_start, index))
            continue
        transformed = unicodedata.normalize(
            "NFKC", unicodedata.normalize("NFKC", cluster).casefold()
        )
        for character in transformed:
            output.append(character)
            spans.append((cluster_start, index))
    return _NormalizedText("".join(output), tuple(spans))


def _sentence_spans(text: str) -> tuple[tuple[int, int], ...]:
    raw: list[tuple[int, int]] = []
    start = 0
    index = 0
    while index < len(text):
        if text[index] not in _SENTENCE_END:
            index += 1
            continue
        end = index + 1
        while end < len(text) and text[end] in _SENTENCE_END:
            end += 1
        while end < len(text) and text[end] in _SENTENCE_CLOSERS:
            end += 1
        if end == len(text) or text[end].isspace():
            _append_trimmed_chunks(raw, text, start, end)
            start = end
        index = end
    _append_trimmed_chunks(raw, text, start, len(text))
    return tuple(raw)


def _append_trimmed_chunks(
    output: list[tuple[int, int]], text: str, raw_start: int, raw_end: int
) -> None:
    start = raw_start
    end = raw_end
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    while end - start > MAX_SENTENCE_LENGTH:
        boundary = start + MAX_SENTENCE_LENGTH
        whitespace = text.rfind(" ", start, boundary + 1)
        if whitespace > start:
            boundary = whitespace
        output.append((start, boundary))
        start = boundary
        while start < end and text[start].isspace():
            start += 1
    if start < end:
        output.append((start, end))


def _is_token_bounded(value: str, start: int, end: int) -> bool:
    first_is_token = _is_token_character(value[start])
    last_is_token = _is_token_character(value[end - 1])
    if first_is_token and start > 0 and _is_token_character(value[start - 1]):
        return False
    return not (last_is_token and end < len(value) and _is_token_character(value[end]))


def _is_token_character(value: str) -> bool:
    return value == "_" or unicodedata.category(value)[0] in {"L", "M", "N"}


def _utf16_prefix_lengths(value: str) -> tuple[int, ...]:
    lengths = [0]
    for character in value:
        lengths.append(lengths[-1] + len(character.encode("utf-16-le")) // 2)
    return tuple(lengths)
