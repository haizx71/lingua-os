"""Unit tests for FRLL observational PostgreSQL probe."""

from __future__ import annotations

import os
import uuid
from dataclasses import asdict

import psycopg
import pytest

from tests.acceptance.support.postgres_probe import LearnerStateDigest, PostgresLearnerProbe


def test_learner_state_digest_structure() -> None:
    digest = LearnerStateDigest(
        user_id=str(uuid.uuid4()),
        concept_id=str(uuid.uuid4()),
        user_exists=False,
        profile_time_zone=None,
        language_profile_ids=[],
        is_concept_saved=False,
        save_intent_count=0,
        save_intent_ids=[],
        review_item_count=0,
        review_item_ids=[],
        fsrs_state_count=0,
        fsrs_states=[],
        learning_event_count=0,
        learning_events=[],
        review_event_count=0,
        review_events=[],
        concept_state=None,
        skill_states=[],
        today_plan_count=0,
        today_plan_ids=[],
        today_activity_review_item_ids=[],
    )
    raw = asdict(digest)
    assert raw["user_exists"] is False
    assert raw["save_intent_count"] == 0
    assert raw["review_event_count"] == 0


def test_probe_enforces_read_only_transaction() -> None:
    db_url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        pytest.skip("PostgreSQL environment not configured")

    probe = PostgresLearnerProbe(db_url)
    with (
        pytest.raises(psycopg.errors.ReadOnlySqlTransaction),
        probe._open_read_only_connection() as conn,
    ):
        # Attempting a write in read-only transaction must fail closed
        conn.execute(
            "INSERT INTO users (id) VALUES (%s)",
            (uuid.uuid4(),),
        )
