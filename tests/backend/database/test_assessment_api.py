from __future__ import annotations

import json
import shutil
import uuid
from collections.abc import Iterator, Sequence
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.assessment.domain import (
    AssessmentIdempotencyConflict,
    AssessmentInvalidState,
    AssessmentNotFound,
)
from lingua_api.assessment.store import (
    AssessmentSessionData,
    PostgresAssessmentStore,
)
from lingua_api.auth import AccessTokenInvalid
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from psycopg import sql
from psycopg.conninfo import make_conninfo

from database.migrate import migrate_down, migrate_up

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / "database" / "migrations"
AUTH_BOOTSTRAP = Path(__file__).with_name("supabase_test_bootstrap.sql")
POLICY_VERSION = "starting-level-heuristic-v1"
DOMAINS = (
    "vocabulary_recognition",
    "grammar_in_context",
    "reading_comprehension",
    "listening_comprehension",
)


@dataclass(frozen=True)
class AssessmentSeed:
    database_url: str
    actor: AuthenticatedActor
    profile_id: uuid.UUID
    template_id: uuid.UUID


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "valid-token":
            raise AccessTokenInvalid("invalid bearer token")
        return self.actor


def _seed_assessment(database_url: str) -> AssessmentSeed:
    actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    template_id = uuid.uuid4()
    license_id = uuid.uuid4()
    source_id = uuid.uuid4()
    source_record_id = uuid.uuid4()
    audio_id = uuid.uuid4()

    with psycopg.connect(database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        connection.execute(
            """
            INSERT INTO user_languages (
                id, user_id, language_code, interface_language_code,
                native_language_code, goal, daily_minutes, status
            ) VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 20, 'active')
            """,
            (profile_id, actor_id),
        )
        connection.execute(
            """
            INSERT INTO licenses (
                id, code, name, usage_policy, attribution_required
            ) VALUES (%s, %s, 'Assessment integration fixture', 'allowed', false)
            """,
            (license_id, f"assessment-{license_id}"),
        )
        connection.execute(
            """
            INSERT INTO data_sources (
                id, name, source_type, source_version, license_id, attribution_text
            ) VALUES (%s, %s, 'internal', '1', %s, 'LINGUA TASK-016 test fixture')
            """,
            (source_id, f"assessment-{source_id}", license_id),
        )
        connection.execute(
            """
            INSERT INTO source_records (
                id, source_id, source_record_key, raw_hash, transform_version,
                quality_score, review_status
            ) VALUES (%s, %s, %s, %s, 'assessment-test-v1', 1, 'approved')
            """,
            (source_record_id, source_id, str(source_record_id), "a" * 64),
        )
        connection.execute(
            """
            INSERT INTO audio_assets (
                id, language_code, storage_uri, duration_ms, source_record_id
            ) VALUES (%s, 'en', %s, 1000, %s)
            """,
            (audio_id, f"https://example.invalid/{audio_id}.mp3", source_record_id),
        )
        connection.execute(
            """
            INSERT INTO assessment_templates (
                id, language_code, native_language_code, name, method_version,
                status, source_record_id
            ) VALUES (%s, 'en', 'vi', %s, %s, 'active', %s)
            """,
            (template_id, f"TASK-016 {template_id}", POLICY_VERSION, source_record_id),
        )

        level_rows = connection.execute(
            """
                SELECT level.code, level.id
                FROM proficiency_levels level
                JOIN proficiency_frameworks framework ON framework.id = level.framework_id
                WHERE framework.code = 'CEFR' AND level.code IN ('A1', 'A2', 'B1')
                """
        ).fetchall()
        levels: dict[str, uuid.UUID] = {
            str(code): uuid.UUID(str(level_id)) for code, level_id in level_rows
        }
        assert set(levels) == {"A1", "A2", "B1"}

        for band in ("A1", "A2", "B1"):
            for bundle in ("primary", "verification"):
                for slot, domain in enumerate(DOMAINS, start=1):
                    item_id = uuid.uuid4()
                    option_ids = [uuid.uuid4() for _ in range(4)]
                    prompt = {
                        "prompt": f"{band}-{bundle}-{slot}",
                        "textSnippet": f"context-{band}-{bundle}-{slot}",
                    }
                    answer = {
                        "correct_option_id": str(option_ids[0]),
                        "options": [
                            {"id": str(option_id), "text": f"option-{index}"}
                            for index, option_id in enumerate(option_ids)
                        ],
                    }
                    connection.execute(
                        """
                        INSERT INTO assessment_items (
                            id, template_id, language_code, skill, difficulty_prior,
                            prompt_schema, answer_schema, source_record_id, item_version,
                            item_type, bundle_kind, slot_index, target_level_id,
                            audio_asset_id
                        ) VALUES (
                            %s, %s, 'en', %s, 0.5,
                            %s::jsonb, %s::jsonb, %s, 1,
                            %s, %s, %s, %s, %s
                        )
                        """,
                        (
                            item_id,
                            template_id,
                            "listening" if slot == 4 else "recognition",
                            json.dumps(prompt),
                            json.dumps(answer),
                            source_record_id,
                            domain,
                            bundle,
                            slot,
                            levels[band],
                            audio_id if slot == 4 else None,
                        ),
                    )

    return AssessmentSeed(
        database_url=database_url,
        actor=AuthenticatedActor(actor_id),
        profile_id=profile_id,
        template_id=template_id,
    )


def _option_for(
    seed: AssessmentSeed,
    session: AssessmentSessionData,
    *,
    correct: bool,
) -> uuid.UUID:
    assert session.current_item is not None
    with psycopg.connect(seed.database_url) as connection:
        row = connection.execute(
            """
            SELECT private_snapshot
            FROM assessment_attempt_items
            WHERE attempt_id = %s AND item_id = %s
            """,
            (session.id, session.current_item.id),
        ).fetchone()
    assert row is not None
    private = row[0]
    correct_id = uuid.UUID(private["correct_option_id"])
    if correct:
        return correct_id
    return next(
        uuid.UUID(option["id"])
        for option in private["options"]
        if uuid.UUID(option["id"]) != correct_id
    )


def _answer(
    seed: AssessmentSeed,
    store: PostgresAssessmentStore,
    session: AssessmentSessionData,
    outcome: bool | None,
    *,
    idempotency_key: uuid.UUID | None = None,
    response_time_ms: int = 500,
) -> AssessmentSessionData:
    assert session.current_item is not None
    selected = None if outcome is None else _option_for(seed, session, correct=outcome)
    return store.submit_response(
        seed.actor,
        attempt_id=session.id,
        item_id=session.current_item.id,
        selected_option_id=selected,
        skipped=outcome is None,
        response_time_ms=response_time_ms,
        idempotency_key=idempotency_key or uuid.uuid4(),
    )


def _drive(seed: AssessmentSeed, outcomes: Sequence[bool | None]) -> AssessmentSessionData:
    store = PostgresAssessmentStore(seed.database_url)
    session = store.start_or_resume(
        seed.actor,
        language_profile_id=seed.profile_id,
        idempotency_key=uuid.uuid4(),
    ).session
    for outcome in outcomes:
        session = _answer(seed, store, session, outcome)
    return session


def _row_counts(database_url: str, tables: tuple[str, ...]) -> dict[str, int]:
    with psycopg.connect(database_url) as connection:
        counts: dict[str, int] = {}
        for table in tables:
            row = connection.execute(
                sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
            ).fetchone()
            assert row is not None
            counts[table] = int(row[0])
        return counts


def test_concurrent_start_is_single_attempt_and_same_key_replays_exactly(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    shared_key = uuid.uuid4()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(
                store.start_or_resume,
                seed.actor,
                language_profile_id=seed.profile_id,
                idempotency_key=shared_key,
            )
            for _ in range(2)
        ]
    results = [future.result() for future in futures]
    assert results[0] == results[1]
    assert results[0].created is True

    with psycopg.connect(seed.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM assessment_attempts WHERE user_id = %s",
            (seed.actor.id,),
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT count(*) FROM assessment_idempotency_log WHERE user_id = %s",
            (seed.actor.id,),
        ).fetchone() == (1,)


def test_concurrent_start_with_distinct_keys_still_returns_one_attempt(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(
                store.start_or_resume,
                seed.actor,
                language_profile_id=seed.profile_id,
                idempotency_key=uuid.uuid4(),
            )
            for _ in range(2)
        ]
    results = [future.result() for future in futures]
    assert {result.session.id for result in results} == {results[0].session.id}
    assert sorted(result.created for result in results) == [False, True]


def test_start_and_answer_replay_are_exact_and_conflicts_do_not_advance(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    start_key = uuid.uuid4()
    original = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=start_key
    )
    assert original.created is True
    assert original.session.current_item is not None

    answer_key = uuid.uuid4()
    advanced = _answer(seed, store, original.session, True, idempotency_key=answer_key)
    replay = _answer(seed, store, original.session, True, idempotency_key=answer_key)
    assert replay == advanced
    assert replay.progress.answered_count == 1
    assert (
        store.start_or_resume(
            seed.actor, language_profile_id=seed.profile_id, idempotency_key=start_key
        )
        == original
    )

    with pytest.raises(AssessmentIdempotencyConflict):
        _answer(
            seed,
            store,
            original.session,
            True,
            idempotency_key=answer_key,
            response_time_ms=501,
        )
    with pytest.raises(AssessmentIdempotencyConflict):
        store.start_or_resume(
            seed.actor,
            language_profile_id=uuid.uuid4(),
            idempotency_key=start_key,
        )

    with psycopg.connect(seed.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM assessment_responses WHERE attempt_id = %s",
            (original.session.id,),
        ).fetchone() == (1,)


def test_concurrent_current_item_answers_advance_only_once(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    session = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    ).session
    current_item = session.current_item
    assert current_item is not None
    selected = _option_for(seed, session, correct=True)

    def submit() -> AssessmentSessionData:
        return store.submit_response(
            seed.actor,
            attempt_id=session.id,
            item_id=current_item.id,
            selected_option_id=selected,
            skipped=False,
            response_time_ms=500,
            idempotency_key=uuid.uuid4(),
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(submit) for _ in range(2)]
    successes: list[AssessmentSessionData] = []
    failures: list[BaseException] = []
    for future in futures:
        try:
            successes.append(future.result())
        except BaseException as error:
            failures.append(error)
    assert len(successes) == 1
    assert len(failures) == 1
    assert isinstance(failures[0], AssessmentInvalidState)
    assert successes[0].progress.answered_count == 1


def test_concurrent_same_key_answer_replays_one_transition(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    session = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    ).session
    current_item = session.current_item
    assert current_item is not None
    selected = _option_for(seed, session, correct=True)
    shared_key = uuid.uuid4()

    def submit() -> AssessmentSessionData:
        return store.submit_response(
            seed.actor,
            attempt_id=session.id,
            item_id=current_item.id,
            selected_option_id=selected,
            skipped=False,
            response_time_ms=500,
            idempotency_key=shared_key,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(submit) for _ in range(2)]
    results = [future.result() for future in futures]
    assert results[0] == results[1]
    assert results[0].progress.answered_count == 1
    with psycopg.connect(seed.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM assessment_responses WHERE attempt_id = %s",
            (session.id,),
        ).fetchone() == (1,)


@pytest.mark.parametrize(
    ("expected_level", "outcomes", "terminal_length", "expected_confidence"),
    [
        ("A0", [False] * 8, 8, 0.85),
        ("A1", [True, True, False, False, True, True, True, True], 8, 0.66),
        (
            "A2",
            [True, True, True, False, True, True, False, False, True, True, True, True],
            12,
            0.66,
        ),
        (
            "B1",
            [
                True,
                True,
                True,
                False,
                True,
                True,
                True,
                False,
                True,
                True,
                True,
                False,
                True,
                True,
                True,
                False,
            ],
            16,
            0.66,
        ),
    ],
)
def test_persisted_transition_flows_reach_each_supported_level(
    isolated_migrated_postgres_url: str,
    expected_level: str,
    outcomes: list[bool],
    terminal_length: int,
    expected_confidence: float,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    session = _drive(seed, outcomes)
    assert session.status == "completed"
    assert session.current_item is None
    assert session.progress.answered_count == terminal_length
    assert session.result is not None
    assert session.result.level_code == expected_level
    assert session.result.confidence == expected_confidence
    assert session.result.evidence_count == 8
    assert session.result.method_version == POLICY_VERSION

    with psycopg.connect(seed.database_url) as connection:
        row = connection.execute(
            """
            SELECT level.code, result.confidence, result.confidence_band,
                   result.evidence_count, attempt.current_position
            FROM assessment_results result
            JOIN proficiency_levels level ON level.id = result.estimated_level_id
            JOIN assessment_attempts attempt ON attempt.id = result.attempt_id
            WHERE result.attempt_id = %s
            """,
            (session.id,),
        ).fetchone()
    assert row is not None
    assert row[0] == expected_level
    assert float(row[1]) == expected_confidence
    assert row[2] in {"low", "medium", "high"}
    assert row[3:] == (8, terminal_length)


def test_skips_consume_slots_but_insufficient_evidence_abandons_without_result(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    session = _drive(seed, [False, False, None, None, False, False, False, None])
    assert session.status == "abandoned"
    assert session.progress.answered_count == 8
    assert session.current_item is None
    assert session.result is None
    with psycopg.connect(seed.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM assessment_responses WHERE attempt_id = %s",
            (session.id,),
        ).fetchone() == (8,)
        assert connection.execute(
            """
            SELECT count(*) FILTER (WHERE correct IS NOT NULL),
                   count(*) FILTER (WHERE answer_discriminator = 'skipped')
            FROM assessment_responses WHERE attempt_id = %s
            """,
            (session.id,),
        ).fetchone() == (5, 3)
        assert connection.execute(
            "SELECT count(*) FROM assessment_results WHERE attempt_id = %s",
            (session.id,),
        ).fetchone() == (0,)


def test_concurrent_final_answer_creates_one_response_and_one_result(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    session = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    ).session
    for _ in range(7):
        session = _answer(seed, store, session, False)
    current_item = session.current_item
    assert current_item is not None
    selected = _option_for(seed, session, correct=False)

    def finish() -> AssessmentSessionData:
        return store.submit_response(
            seed.actor,
            attempt_id=session.id,
            item_id=current_item.id,
            selected_option_id=selected,
            skipped=False,
            response_time_ms=500,
            idempotency_key=uuid.uuid4(),
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(finish) for _ in range(2)]
    outcomes: list[AssessmentSessionData | BaseException] = []
    for future in futures:
        try:
            outcomes.append(future.result())
        except BaseException as error:
            outcomes.append(error)
    assert sum(isinstance(outcome, AssessmentSessionData) for outcome in outcomes) == 1
    assert sum(isinstance(outcome, AssessmentInvalidState) for outcome in outcomes) == 1

    with psycopg.connect(seed.database_url) as connection:
        assert connection.execute(
            "SELECT status, current_position FROM assessment_attempts WHERE id = %s",
            (session.id,),
        ).fetchone() == ("completed", 8)
        assert connection.execute(
            "SELECT count(*) FROM assessment_responses WHERE attempt_id = %s",
            (session.id,),
        ).fetchone() == (8,)
        assert connection.execute(
            "SELECT count(*) FROM assessment_results WHERE attempt_id = %s",
            (session.id,),
        ).fetchone() == (1,)


def test_snapshots_and_completed_results_are_immutable(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    started = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    ).session
    assert started.current_item is not None
    original_item = started.current_item
    original_correct = _option_for(seed, started, correct=True)
    replacement_ids = [str(uuid.uuid4()) for _ in range(4)]
    replacement_answer = {
        "correct_option_id": replacement_ids[0],
        "options": [
            {"id": option_id, "text": f"new-{index}"}
            for index, option_id in enumerate(replacement_ids, start=1)
        ],
    }
    with psycopg.connect(seed.database_url) as connection:
        connection.execute(
            """
            UPDATE assessment_items
            SET prompt_schema = '{"prompt":"mutated"}'::jsonb,
                answer_schema = %s::jsonb
            WHERE id = %s
            """,
            (json.dumps(replacement_answer), original_item.id),
        )
    resumed = store.get_session(seed.actor, attempt_id=started.id)
    assert resumed.current_item == original_item
    advanced = store.submit_response(
        seed.actor,
        attempt_id=started.id,
        item_id=original_item.id,
        selected_option_id=original_correct,
        skipped=False,
        response_time_ms=500,
        idempotency_key=uuid.uuid4(),
    )
    assert advanced.progress.answered_count == 1

    with psycopg.connect(seed.database_url) as connection:
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute(
                """
                UPDATE assessment_attempt_items
                SET public_snapshot = jsonb_set(public_snapshot, '{prompt}', '"forged"')
                WHERE attempt_id = %s AND position = 1
                """,
                (started.id,),
            )
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute(
                "DELETE FROM assessment_attempt_items WHERE attempt_id = %s AND position = 1",
                (started.id,),
            )

    completed = advanced
    for _ in range(7):
        completed = _answer(seed, store, completed, False)
    with psycopg.connect(seed.database_url) as connection:
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute(
                "UPDATE assessment_results SET confidence = 0.8 WHERE attempt_id = %s",
                (completed.id,),
            )
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute(
                "DELETE FROM assessment_results WHERE attempt_id = %s", (completed.id,)
            )
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute(
                "UPDATE assessment_attempts SET method_version = 'forged' WHERE id = %s",
                (completed.id,),
            )


def test_public_http_payload_never_exposes_answer_or_private_scoring_data(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    client = TestClient(
        create_app(
            database_url=seed.database_url,
            token_verifier=StubTokenVerifier(seed.actor),
            cursor_secret=b"assessment-contract-test-secret-32-bytes",
        )
    )
    response = client.post(
        "/v1/assessments",
        headers={"Authorization": "Bearer valid-token", "Idempotency-Key": str(uuid.uuid4())},
        json={"languageProfileId": str(seed.profile_id)},
    )
    assert response.status_code == 201
    body = response.json()
    serialized = json.dumps(body).lower()
    for forbidden in (
        "correct_option",
        "correctoption",
        "iscorrect",
        "answer_schema",
        "private_snapshot",
        "difficulty_prior",
        "scoring",
        "diagnostics",
        "threshold",
    ):
        assert forbidden not in serialized
    assert set(body["data"]["currentItem"]) == {
        "id",
        "skill",
        "domain",
        "prompt",
        "textSnippet",
        "audioUrl",
        "options",
        "allowSkip",
    }


def test_ownership_hiding_and_archived_profile_lifecycle(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    session = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    ).session
    foreign_actor = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(seed.database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (foreign_actor.id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (foreign_actor.id,))

    with pytest.raises(AssessmentNotFound):
        store.get_session(foreign_actor, attempt_id=session.id)
    with pytest.raises(AssessmentNotFound):
        store.start_or_resume(
            foreign_actor,
            language_profile_id=seed.profile_id,
            idempotency_key=uuid.uuid4(),
        )
    assert session.current_item is not None
    with pytest.raises(AssessmentNotFound):
        store.submit_response(
            foreign_actor,
            attempt_id=session.id,
            item_id=session.current_item.id,
            selected_option_id=uuid.uuid4(),
            skipped=False,
            response_time_ms=500,
            idempotency_key=uuid.uuid4(),
        )

    with psycopg.connect(seed.database_url) as connection:
        connection.execute(
            "UPDATE user_languages SET status = 'archived' WHERE id = %s", (seed.profile_id,)
        )
    assert store.get_session(seed.actor, attempt_id=session.id).id == session.id
    with pytest.raises(AssessmentInvalidState):
        _answer(seed, store, session, True)
    with pytest.raises(AssessmentInvalidState):
        store.start_or_resume(
            seed.actor,
            language_profile_id=seed.profile_id,
            idempotency_key=uuid.uuid4(),
        )
    with psycopg.connect(seed.database_url) as connection:
        connection.execute(
            "UPDATE user_languages SET status = 'active' WHERE id = %s", (seed.profile_id,)
        )
    resumed = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    )
    assert resumed.created is False
    assert resumed.session.id == session.id


def test_assessment_does_not_write_learning_today_content_or_memory_state(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    isolated_tables = (
        "learning_events",
        "user_concept_states",
        "user_skill_states",
        "review_items",
        "fsrs_states",
        "review_events",
        "today_plans",
        "today_plan_activities",
        "content_items",
        "content_metrics",
    )
    before = _row_counts(seed.database_url, isolated_tables)
    completed = _drive(seed, [False] * 8)
    assert completed.status == "completed"
    assert _row_counts(seed.database_url, isolated_tables) == before


def test_assessment_rls_and_browser_privileges_are_actor_scoped(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    session = (
        PostgresAssessmentStore(seed.database_url)
        .start_or_resume(
            seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
        )
        .session
    )
    other_id = uuid.uuid4()
    with psycopg.connect(seed.database_url) as owner:
        owner.execute("SET ROLE authenticated")
        owner.execute(
            "SELECT set_config('request.jwt.claim.sub', %s, false)", (str(seed.actor.id),)
        )
        assert owner.execute("SELECT id FROM assessment_attempts").fetchall() == [(session.id,)]
        with pytest.raises(psycopg.errors.InsufficientPrivilege), owner.transaction():
            owner.execute("UPDATE assessment_attempts SET current_position = 1")
        with pytest.raises(psycopg.errors.InsufficientPrivilege), owner.transaction():
            owner.execute("SELECT * FROM assessment_attempt_items")

    with psycopg.connect(seed.database_url) as other:
        other.execute("SET ROLE authenticated")
        other.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (str(other_id),))
        assert other.execute("SELECT id FROM assessment_attempts").fetchall() == []

    with psycopg.connect(seed.database_url) as anonymous:
        anonymous.execute("SET ROLE anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            anonymous.execute("SELECT id FROM assessment_attempts").fetchall()


def test_failure_after_response_insert_rolls_back_the_entire_transition(
    isolated_migrated_postgres_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    store = PostgresAssessmentStore(seed.database_url)
    session = store.start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    ).session

    def fail_log(*args: Any, **kwargs: Any) -> None:
        del args, kwargs
        raise RuntimeError("controlled idempotency-log failure")

    monkeypatch.setattr(PostgresAssessmentStore, "_log_idempotency", fail_log)
    with pytest.raises(RuntimeError, match="controlled"):
        _answer(seed, store, session, True)

    with psycopg.connect(seed.database_url) as connection:
        assert connection.execute(
            "SELECT current_position, status FROM assessment_attempts WHERE id = %s",
            (session.id,),
        ).fetchone() == (0, "in_progress")
        assert connection.execute(
            "SELECT count(*) FROM assessment_responses WHERE attempt_id = %s",
            (session.id,),
        ).fetchone() == (0,)


def test_protected_0008_rollback_refuses_persisted_attempt_snapshots(
    isolated_migrated_postgres_url: str,
) -> None:
    seed = _seed_assessment(isolated_migrated_postgres_url)
    PostgresAssessmentStore(seed.database_url).start_or_resume(
        seed.actor, language_profile_id=seed.profile_id, idempotency_key=uuid.uuid4()
    )
    assert migrate_down(seed.database_url, MIGRATIONS, steps=1) == ["0009"]
    with pytest.raises(psycopg.errors.RaiseException, match="assessment_attempt_items"):
        migrate_down(seed.database_url, MIGRATIONS, steps=1)


@contextmanager
def _isolated_database(postgres_url: str) -> Iterator[str]:
    database_name = f"lingua_assessment_migration_{uuid.uuid4().hex}"
    admin_url = make_conninfo(postgres_url, dbname="postgres")
    database_url = make_conninfo(postgres_url, dbname=database_name)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    try:
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        yield database_url
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name))
            )


def test_0008_preflight_rejects_ambiguous_legacy_assessment_data(
    postgres_url: str,
    tmp_path: Path,
) -> None:
    partial = tmp_path / "migrations"
    shutil.copytree(MIGRATIONS, partial)
    up_0008_name = next(partial.glob("0008_*.up.sql")).name
    down_0008_name = next(partial.glob("0008_*.down.sql")).name
    for version in ("0008", "0009"):
        for path in partial.glob(f"{version}_*.sql"):
            path.unlink()

    with _isolated_database(postgres_url) as database_url:
        assert migrate_up(database_url, partial) == [
            "0001",
            "0002",
            "0003",
            "0004",
            "0005",
            "0006",
            "0007",
        ]
        with psycopg.connect(database_url) as connection:
            license_row = connection.execute(
                """
                INSERT INTO licenses (code, name, usage_policy, attribution_required)
                VALUES (%s, 'legacy', 'allowed', false) RETURNING id
                """,
                (f"legacy-{uuid.uuid4()}",),
            ).fetchone()
            assert license_row is not None
            license_id = license_row[0]
            source_row = connection.execute(
                """
                INSERT INTO data_sources (
                    name, source_type, source_version, license_id, attribution_text
                ) VALUES (%s, 'internal', '1', %s, 'legacy') RETURNING id
                """,
                (f"legacy-{uuid.uuid4()}", license_id),
            ).fetchone()
            assert source_row is not None
            source_id = source_row[0]
            source_record_row = connection.execute(
                """
                INSERT INTO source_records (
                    source_id, source_record_key, raw_hash, transform_version,
                    quality_score, review_status
                ) VALUES (%s, %s, %s, 'legacy', 1, 'approved') RETURNING id
                """,
                (source_id, str(uuid.uuid4()), "b" * 64),
            ).fetchone()
            assert source_record_row is not None
            source_record_id = source_record_row[0]
            connection.execute(
                """
                INSERT INTO assessment_templates (
                    language_code, name, method_version, status, source_record_id
                ) VALUES ('en', 'ambiguous legacy form', 'legacy-v0', 'draft', %s)
                """,
                (source_record_id,),
            )

        shutil.copy2(MIGRATIONS / up_0008_name, partial)
        shutil.copy2(MIGRATIONS / down_0008_name, partial)
        with pytest.raises(
            psycopg.errors.RaiseException, match="explicit native-language backfill"
        ):
            migrate_up(database_url, partial)
        with psycopg.connect(database_url) as connection:
            assert connection.execute(
                """
                SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'assessment_templates'
                  AND column_name = 'native_language_code'
                """
            ).fetchone() == (0,)
