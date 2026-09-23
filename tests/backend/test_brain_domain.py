from __future__ import annotations

import inspect
from uuid import UUID

import pytest
from lingua_api.brain.cursor import BrainCursor, BrainCursorCodec
from lingua_api.brain.domain import BrainConceptProjection, ConceptStatus
from lingua_api.brain.store import PostgresBrainStore

ACTOR_ID = UUID("10000000-0000-0000-0000-000000000001")
PROFILE_ID = UUID("20000000-0000-0000-0000-000000000001")
CONCEPT_ID = UUID("30000000-0000-0000-0000-000000000001")
SECRET = b"brain-cursor-secret-that-is-long-enough"


def test_synthetic_zero_projection_preserves_frozen_semantics() -> None:
    projection = BrainConceptProjection.synthetic_zero(concept_id=CONCEPT_ID)

    assert projection.status is ConceptStatus.UNSEEN
    assert projection.mastery is None
    assert projection.confidence == 0
    assert projection.exposure_count == 0
    assert projection.memory is None
    for score in (
        projection.competence.recognition,
        projection.competence.listening,
        projection.competence.production,
    ):
        assert score.score == 0.5
        assert score.confidence == 0
        assert score.evidence_count == 0
        assert score.updated_at is None


def test_brain_cursor_round_trips_all_scope_bindings() -> None:
    codec = BrainCursorCodec(SECRET)
    cursor = BrainCursor(
        actor_id=ACTOR_ID,
        language_profile_id=PROFILE_ID,
        status=ConceptStatus.DISCOVERED,
        query="learn",
        canonical_key="learning",
        concept_id=CONCEPT_ID,
    )

    assert codec.decode(codec.encode(cursor)) == cursor


def test_brain_cursor_rejects_tampering() -> None:
    codec = BrainCursorCodec(SECRET)
    token = codec.encode(
        BrainCursor(
            actor_id=ACTOR_ID,
            language_profile_id=PROFILE_ID,
            status=None,
            query=None,
            canonical_key="word",
            concept_id=CONCEPT_ID,
        )
    )

    replacement = "A" if token[-1] != "A" else "B"
    with pytest.raises(ValueError, match="cursor"):
        codec.decode(token[:-1] + replacement)


def test_brain_store_has_no_write_offset_event_replay_or_raw_scheduler_path() -> None:
    source = inspect.getsource(PostgresBrainStore).upper()

    for forbidden in (
        "INSERT INTO",
        "UPDATE ",
        "DELETE FROM",
        " OFFSET ",
        "LEARNING_EVENTS",
        "REVIEW_EVENTS AS EVENT\n                JOIN",
        "PY_FSRS",
        "CURRENT_RETRIEVABILITY",
        "STABILITY",
        "DIFFICULTY",
        "PARAMS_VERSION",
    ):
        assert forbidden not in source
    assert "V_LEARNER_CONCEPT_RETRIEVABILITY" in source
    assert "EFFECTIVE_STATUS" in source
