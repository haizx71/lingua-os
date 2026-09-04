from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Final, cast

import psycopg
import pytest
from lingua_api.memory.domain import (
    AuthenticatedActor,
    CreatedFrom,
    IdempotencyConflict,
    MemoryConfigurationError,
    MemoryItemInactive,
    MemoryItemNotFound,
    MemoryLineageExists,
    MemoryState,
    ReviewExerciseMode,
    ReviewRating,
    ReviewSubmission,
)
from lingua_api.memory.service import PostgresMemoryEngine

REVIEWED_AT: Final = datetime(2026, 8, 22, 3, 0, tzinfo=UTC)


@dataclass
class MutableClock:
    current: datetime

    def now(self) -> datetime:
        return self.current


@dataclass(frozen=True)
class SeededMemory:
    actor: AuthenticatedActor
    user_language_id: uuid.UUID
    concept_id: uuid.UUID


def _seed_actor_and_concept(database_url: str) -> SeededMemory:
    actor_id = uuid.uuid4()
    with psycopg.connect(database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        language_row = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'basics', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert language_row is not None

        license_row = connection.execute(
            """
            INSERT INTO licenses (code, name, usage_policy, attribution_required)
            VALUES (%s, 'Memory engine test license', 'allowed', false)
            RETURNING id
            """,
            (f"engine-license-{uuid.uuid4()}",),
        ).fetchone()
        assert license_row is not None
        source_row = connection.execute(
            """
            INSERT INTO data_sources
                (name, source_type, source_version, license_id, attribution_text)
            VALUES (%s, 'internal', '1', %s, 'Memory engine fixture')
            RETURNING id
            """,
            (f"engine-source-{uuid.uuid4()}", license_row[0]),
        ).fetchone()
        assert source_row is not None
        source_record_row = connection.execute(
            """
            INSERT INTO source_records
                (source_id, source_record_key, raw_hash, transform_version,
                 quality_score, review_status)
            VALUES (%s, %s, %s, 'engine-test-v1', 1, 'approved')
            RETURNING id
            """,
            (source_row[0], str(uuid.uuid4()), "d" * 64),
        ).fetchone()
        assert source_record_row is not None
        concept_row = connection.execute(
            """
            INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
            VALUES ('en', 'word', %s, %s)
            RETURNING id
            """,
            (f"engine-concept-{uuid.uuid4()}", source_record_row[0]),
        ).fetchone()
        assert concept_row is not None
        connection.commit()

    return SeededMemory(
        actor=AuthenticatedActor(actor_id),
        user_language_id=language_row[0],
        concept_id=concept_row[0],
    )


def _delete_actor(database_url: str, actor: AuthenticatedActor) -> None:
    with psycopg.connect(database_url) as connection:
        connection.execute("DELETE FROM users WHERE id = %s", (actor.id,))
        connection.execute("DELETE FROM auth.users WHERE id = %s", (actor.id,))
        connection.commit()


def _seed_second_concept(database_url: str, seeded: SeededMemory) -> uuid.UUID:
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            """
            INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
            SELECT language_code, concept_type, %s, source_record_id
            FROM concepts
            WHERE id = %s
            RETURNING id
            """,
            (f"engine-concept-{uuid.uuid4()}", seeded.concept_id),
        ).fetchone()
        assert row is not None
        connection.commit()
    return cast(uuid.UUID, row[0])


@pytest.fixture
def seeded_memory(migrated_postgres_url: str) -> Iterator[SeededMemory]:
    seeded = _seed_actor_and_concept(migrated_postgres_url)
    try:
        yield seeded
    finally:
        _delete_actor(migrated_postgres_url, seeded.actor)


@pytest.fixture
def clock() -> MutableClock:
    return MutableClock(REVIEWED_AT)


@pytest.fixture
def engine(migrated_postgres_url: str, clock: MutableClock) -> PostgresMemoryEngine:
    return PostgresMemoryEngine(migrated_postgres_url, clock=clock)


def _activate(engine: PostgresMemoryEngine, seeded: SeededMemory) -> uuid.UUID:
    item = engine.activate(
        actor=seeded.actor,
        user_language_id=seeded.user_language_id,
        concept_id=seeded.concept_id,
        created_from=CreatedFrom.LEARNER_SAVED,
    )
    return item.review_item_id


def _submission(
    rating: ReviewRating = ReviewRating.GOOD,
    *,
    idempotency_key: uuid.UUID | None = None,
    response_text: str | None = None,
) -> ReviewSubmission:
    return ReviewSubmission(
        idempotency_key=idempotency_key or uuid.uuid4(),
        rating=rating,
        response_time_ms=820,
        correct=None,
        response_text=response_text,
        selected_option_id=None,
    )


def test_activation_creates_one_new_state_bound_to_the_default_parameter_set(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
) -> None:
    review_item_id = _activate(engine, seeded_memory)

    with psycopg.connect(migrated_postgres_url) as connection:
        row = connection.execute(
            """
            SELECT ri.user_id, ri.concept_id, fs.state, fs.difficulty, fs.stability,
                   fs.due_at, fs.last_review_at, fs.state_version, ps.version, ps.is_default
            FROM review_items AS ri
            JOIN fsrs_states AS fs ON fs.review_item_id = ri.id
            JOIN fsrs_parameter_sets AS ps ON ps.id = fs.parameter_set_id
            WHERE ri.id = %s
            """,
            (review_item_id,),
        ).fetchone()

    assert row == (
        seeded_memory.actor.id,
        seeded_memory.concept_id,
        "new",
        None,
        None,
        REVIEWED_AT,
        None,
        1,
        "fsrs6-global-default-v1",
        True,
    )


def test_duplicate_activation_cannot_create_a_second_lineage(
    engine: PostgresMemoryEngine, seeded_memory: SeededMemory
) -> None:
    _activate(engine, seeded_memory)

    with pytest.raises(MemoryLineageExists):
        _activate(engine, seeded_memory)


def test_activation_rejects_when_no_default_parameter_set_is_available(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("UPDATE fsrs_parameter_sets SET is_default = false")
        connection.commit()

    try:
        with pytest.raises(MemoryConfigurationError, match="no default"):
            _activate(engine, seeded_memory)
    finally:
        with psycopg.connect(migrated_postgres_url) as connection:
            connection.execute(
                "UPDATE fsrs_parameter_sets SET is_default = true WHERE version = %s",
                ("fsrs6-global-default-v1",),
            )
            connection.commit()


@pytest.mark.parametrize("rating", list(ReviewRating))
def test_real_postgres_review_transition_persists_every_rating(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
    rating: ReviewRating,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    outcome = engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        submission=_submission(rating),
    )

    assert outcome.replayed is False
    assert outcome.memory.state is not MemoryState.NEW
    assert outcome.memory.state_version == 2
    assert outcome.memory.due_at > REVIEWED_AT
    with psycopg.connect(migrated_postgres_url) as connection:
        row = connection.execute(
            """
            SELECT fs.state_version, fs.due_at, ri.updated_at,
                   re.rating, re.parameter_set_id, re.params_version,
                   re.result_memory_snapshot
            FROM fsrs_states AS fs
            JOIN review_items AS ri ON ri.id = fs.review_item_id
            JOIN review_events AS re ON re.review_item_id = fs.review_item_id
            WHERE fs.review_item_id = %s
            """,
            (review_item_id,),
        ).fetchone()
    assert row is not None
    assert row[0] == 2
    assert row[1] == outcome.memory.due_at
    assert row[2] == REVIEWED_AT
    assert row[3:6] == (
        rating.value,
        outcome.memory.parameter_set_id,
        outcome.memory.params_version,
    )
    result_snapshot = row[6]
    assert isinstance(result_snapshot, dict)
    assert result_snapshot["reviewItemId"] == str(review_item_id)
    assert result_snapshot["stateVersion"] == 2


def test_all_presentation_modes_update_one_lineage_and_keep_their_evidence_mapping(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
    clock: MutableClock,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    expected_modes = [
        (ReviewExerciseMode.SELF_RECALL, "production"),
        (ReviewExerciseMode.MULTIPLE_CHOICE, "recognition"),
        (ReviewExerciseMode.TYPING, "production"),
        (ReviewExerciseMode.CLOZE, "cloze"),
        (ReviewExerciseMode.LISTENING, "listening"),
    ]
    for index, (mode, _) in enumerate(expected_modes):
        clock.current = REVIEWED_AT + timedelta(minutes=index)
        engine.review(
            actor=seeded_memory.actor,
            review_item_id=review_item_id,
            exercise_mode=mode,
            submission=_submission(),
        )

    with psycopg.connect(migrated_postgres_url) as connection:
        lineage_count = connection.execute(
            "SELECT count(*) FROM review_items WHERE user_id = %s AND concept_id = %s",
            (seeded_memory.actor.id, seeded_memory.concept_id),
        ).fetchone()
        state_version = connection.execute(
            "SELECT state_version FROM fsrs_states WHERE review_item_id = %s",
            (review_item_id,),
        ).fetchone()
        modes = connection.execute(
            """
            SELECT exercise_mode, evidence_mode
            FROM review_events
            WHERE review_item_id = %s
            ORDER BY reviewed_at, created_at
            """,
            (review_item_id,),
        ).fetchall()

    assert lineage_count == (1,)
    assert state_version == (6,)
    assert modes == [(mode.value, evidence) for mode, evidence in expected_modes]


def test_same_idempotency_key_replays_without_advancing_twice(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    submission = _submission()
    first = engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.CLOZE,
        submission=submission,
    )
    second = engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.CLOZE,
        submission=submission,
    )

    assert first.replayed is False
    assert second.replayed is True
    assert second.event_id == first.event_id
    with psycopg.connect(migrated_postgres_url) as connection:
        counts = connection.execute(
            """
            SELECT (SELECT count(*) FROM review_events WHERE review_item_id = %s),
                   (SELECT state_version FROM fsrs_states WHERE review_item_id = %s)
            """,
            (review_item_id, review_item_id),
        ).fetchone()
    assert counts == (1, 2)


def test_delayed_replay_returns_original_transition_after_later_review(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
    clock: MutableClock,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    submission_a = _submission(ReviewRating.GOOD)
    first = engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        submission=submission_a,
    )
    clock.current += timedelta(minutes=1)
    second = engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        submission=_submission(ReviewRating.HARD),
    )
    clock.current += timedelta(minutes=1)

    replay = engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        submission=submission_a,
    )

    assert first.memory.state_version == 2
    assert second.memory.state_version == 3
    assert replay.replayed is True
    assert replay.event_id == first.event_id
    assert replay.memory == first.memory
    with psycopg.connect(migrated_postgres_url) as connection:
        persisted = connection.execute(
            "SELECT state_version FROM fsrs_states WHERE review_item_id = %s",
            (review_item_id,),
        ).fetchone()
    assert persisted == (3,)


def test_reusing_idempotency_key_for_different_payload_is_rejected(
    engine: PostgresMemoryEngine, seeded_memory: SeededMemory
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    idempotency_key = uuid.uuid4()
    engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.CLOZE,
        submission=_submission(ReviewRating.GOOD, idempotency_key=idempotency_key),
    )

    with pytest.raises(IdempotencyConflict):
        engine.review(
            actor=seeded_memory.actor,
            review_item_id=review_item_id,
            exercise_mode=ReviewExerciseMode.CLOZE,
            submission=_submission(ReviewRating.EASY, idempotency_key=idempotency_key),
        )


def test_database_failure_rolls_back_event_and_state_together(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            """
            CREATE FUNCTION fail_memory_state_update_for_test()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'injected memory update failure';
            END
            $$
            """
        )
        connection.execute(
            """
            CREATE TRIGGER fail_memory_state_update_for_test
            BEFORE UPDATE ON fsrs_states
            FOR EACH ROW EXECUTE FUNCTION fail_memory_state_update_for_test()
            """
        )
        connection.commit()

    try:
        with pytest.raises(psycopg.DatabaseError, match="injected memory update failure"):
            engine.review(
                actor=seeded_memory.actor,
                review_item_id=review_item_id,
                exercise_mode=ReviewExerciseMode.TYPING,
                submission=_submission(),
            )
    finally:
        with psycopg.connect(migrated_postgres_url) as connection:
            connection.execute("DROP TRIGGER fail_memory_state_update_for_test ON fsrs_states")
            connection.execute("DROP FUNCTION fail_memory_state_update_for_test()")
            connection.commit()

    with psycopg.connect(migrated_postgres_url) as connection:
        counts = connection.execute(
            """
            SELECT (SELECT count(*) FROM review_events WHERE review_item_id = %s),
                   (SELECT state_version FROM fsrs_states WHERE review_item_id = %s)
            """,
            (review_item_id, review_item_id),
        ).fetchone()
    assert counts == (0, 1)


def test_concurrent_same_key_submission_cannot_double_advance(
    migrated_postgres_url: str,
    seeded_memory: SeededMemory,
    clock: MutableClock,
) -> None:
    engine = PostgresMemoryEngine(migrated_postgres_url, clock=clock)
    review_item_id = _activate(engine, seeded_memory)
    submission = _submission()

    def submit() -> tuple[uuid.UUID, bool]:
        outcome = PostgresMemoryEngine(migrated_postgres_url, clock=clock).review(
            actor=seeded_memory.actor,
            review_item_id=review_item_id,
            exercise_mode=ReviewExerciseMode.LISTENING,
            submission=submission,
        )
        return outcome.event_id, outcome.replayed

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(lambda _: submit(), range(2)))

    assert {event_id for event_id, _ in outcomes} == {outcomes[0][0]}
    assert sorted(replayed for _, replayed in outcomes) == [False, True]
    with psycopg.connect(migrated_postgres_url) as connection:
        counts = connection.execute(
            """
            SELECT (SELECT count(*) FROM review_events WHERE review_item_id = %s),
                   (SELECT state_version FROM fsrs_states WHERE review_item_id = %s)
            """,
            (review_item_id, review_item_id),
        ).fetchone()
    assert counts == (1, 2)


def test_concurrent_same_key_on_different_lineages_is_a_domain_conflict(
    migrated_postgres_url: str,
    seeded_memory: SeededMemory,
    clock: MutableClock,
) -> None:
    engine = PostgresMemoryEngine(migrated_postgres_url, clock=clock)
    first_item_id = _activate(engine, seeded_memory)
    second_concept_id = _seed_second_concept(migrated_postgres_url, seeded_memory)
    second_item_id = engine.activate(
        actor=seeded_memory.actor,
        user_language_id=seeded_memory.user_language_id,
        concept_id=second_concept_id,
        created_from=CreatedFrom.LEARNER_SAVED,
    ).review_item_id
    shared_key = uuid.uuid4()

    def submit(review_item_id: uuid.UUID) -> object:
        try:
            return PostgresMemoryEngine(migrated_postgres_url, clock=clock).review(
                actor=seeded_memory.actor,
                review_item_id=review_item_id,
                exercise_mode=ReviewExerciseMode.SELF_RECALL,
                submission=_submission(idempotency_key=shared_key),
            )
        except Exception as error:  # captured so both real transactions can finish
            return error

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(submit, (first_item_id, second_item_id)))

    assert sum(not isinstance(outcome, Exception) for outcome in outcomes) == 1
    errors_seen = [outcome for outcome in outcomes if isinstance(outcome, Exception)]
    assert len(errors_seen) == 1
    assert isinstance(errors_seen[0], IdempotencyConflict)
    assert not isinstance(errors_seen[0], psycopg.errors.UniqueViolation)
    with psycopg.connect(migrated_postgres_url) as connection:
        event_count = connection.execute(
            "SELECT count(*) FROM review_events WHERE idempotency_key = %s",
            (str(shared_key),),
        ).fetchone()
        versions = connection.execute(
            """
            SELECT state_version
            FROM fsrs_states
            WHERE review_item_id IN (%s, %s)
            ORDER BY state_version
            """,
            (first_item_id, second_item_id),
        ).fetchall()
    assert event_count == (1,)
    assert versions == [(1,), (2,)]


def test_concurrent_distinct_submissions_serialize_without_lost_update(
    migrated_postgres_url: str,
    seeded_memory: SeededMemory,
    clock: MutableClock,
) -> None:
    engine = PostgresMemoryEngine(migrated_postgres_url, clock=clock)
    review_item_id = _activate(engine, seeded_memory)
    submissions = [_submission(ReviewRating.HARD), _submission(ReviewRating.GOOD)]

    def submit(submission: ReviewSubmission) -> None:
        PostgresMemoryEngine(migrated_postgres_url, clock=clock).review(
            actor=seeded_memory.actor,
            review_item_id=review_item_id,
            exercise_mode=ReviewExerciseMode.MULTIPLE_CHOICE,
            submission=submission,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(submit, submissions))

    with psycopg.connect(migrated_postgres_url) as connection:
        counts = connection.execute(
            """
            SELECT (SELECT count(*) FROM review_events WHERE review_item_id = %s),
                   (SELECT state_version FROM fsrs_states WHERE review_item_id = %s)
            """,
            (review_item_id, review_item_id),
        ).fetchone()
    assert counts == (2, 3)


def test_actor_cannot_review_another_learners_item(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    other = _seed_actor_and_concept(migrated_postgres_url)
    try:
        with pytest.raises(MemoryItemNotFound):
            engine.review(
                actor=other.actor,
                review_item_id=review_item_id,
                exercise_mode=ReviewExerciseMode.SELF_RECALL,
                submission=_submission(),
            )
    finally:
        _delete_actor(migrated_postgres_url, other.actor)


@pytest.mark.parametrize("status", ["suspended", "retired"])
def test_inactive_items_cannot_be_reviewed(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
    status: str,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE review_items SET status = %s WHERE id = %s", (status, review_item_id)
        )
        connection.commit()

    with pytest.raises(MemoryItemInactive):
        engine.review(
            actor=seeded_memory.actor,
            review_item_id=review_item_id,
            exercise_mode=ReviewExerciseMode.SELF_RECALL,
            submission=_submission(),
        )


def test_review_does_not_mutate_competence_projection(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, recognition,
                 listening, production, mastery, confidence, state_version)
            VALUES (%s, %s, %s, 'learning', 0.2, 0.3, 0.4, 0.3, 0.5, 7)
            """,
            (
                seeded_memory.actor.id,
                seeded_memory.user_language_id,
                seeded_memory.concept_id,
            ),
        )
        connection.commit()

    engine.review(
        actor=seeded_memory.actor,
        review_item_id=review_item_id,
        exercise_mode=ReviewExerciseMode.SELF_RECALL,
        submission=_submission(),
    )

    with psycopg.connect(migrated_postgres_url) as connection:
        competence = connection.execute(
            """
            SELECT recognition, listening, production, mastery, confidence, state_version
            FROM user_concept_states
            WHERE user_id = %s AND concept_id = %s
            """,
            (seeded_memory.actor.id, seeded_memory.concept_id),
        ).fetchone()
    assert competence == (
        Decimal("0.2000"),
        Decimal("0.3000"),
        Decimal("0.4000"),
        Decimal("0.3000"),
        Decimal("0.5000"),
        7,
    )


def test_due_query_returns_only_owned_active_due_items_in_stable_order(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    migrated_postgres_url: str,
    clock: MutableClock,
) -> None:
    first_id = _activate(engine, seeded_memory)
    second = _seed_actor_and_concept(migrated_postgres_url)
    try:
        second_engine = PostgresMemoryEngine(migrated_postgres_url, clock=clock)
        other_id = _activate(second_engine, second)
        assert other_id != first_id

        due = engine.list_due(actor=seeded_memory.actor, limit=20)
        assert [item.review_item_id for item in due] == [first_id]

        engine.review(
            actor=seeded_memory.actor,
            review_item_id=first_id,
            exercise_mode=ReviewExerciseMode.SELF_RECALL,
            submission=_submission(ReviewRating.EASY),
        )
        assert engine.list_due(actor=seeded_memory.actor, limit=20) == []
    finally:
        _delete_actor(migrated_postgres_url, second.actor)


def test_structured_review_log_excludes_response_text(
    engine: PostgresMemoryEngine,
    seeded_memory: SeededMemory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    review_item_id = _activate(engine, seeded_memory)
    sensitive_response = "nội dung câu trả lời riêng tư"
    with caplog.at_level(logging.INFO, logger="lingua_api.memory"):
        engine.review(
            actor=seeded_memory.actor,
            review_item_id=review_item_id,
            exercise_mode=ReviewExerciseMode.TYPING,
            submission=_submission(response_text=sensitive_response),
        )

    payload = json.loads(caplog.records[-1].message)
    assert payload["event"] == "memory.review.completed"
    assert payload["parameterVersion"] == "fsrs6-global-default-v1"
    assert sensitive_response not in caplog.text
