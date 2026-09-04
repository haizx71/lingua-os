from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from threading import Event
from typing import Final, cast

import psycopg
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.competence.service import CompetenceEngine
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor, IdempotencyConflict
from lingua_api.reader.domain import (
    ExposureCommand,
    ReaderExposureType,
    ReaderMutationInFlight,
)
from lingua_api.reader.service import ReaderApplication
from psycopg import Connection

from database.migrate import migrate_down

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
NOW: Final = datetime(2026, 8, 30, 3, 0, tzinfo=UTC)
CONTENT_ONE: Final = uuid.UUID("40000000-0000-4000-8000-000000000001")
CONTENT_TWO: Final = uuid.UUID("40000000-0000-4000-8000-000000000002")
CONTENT_FOUR: Final = uuid.UUID("40000000-0000-4000-8000-000000000004")
SEGMENT_ONE: Final = uuid.UUID("60000000-0000-4000-8000-000000000001")
SEGMENT_TWO: Final = uuid.UUID("60000000-0000-4000-8000-000000000002")
SEGMENT_THREE: Final = uuid.UUID("60000000-0000-4000-8000-000000000003")
SEGMENT_FOUR: Final = uuid.UUID("60000000-0000-4000-8000-000000000004")
SEGMENT_TEN: Final = uuid.UUID("60000000-0000-4000-8000-000000000010")
SENTENCE_ONE: Final = uuid.UUID("50000000-0000-4000-8000-000000000001")
SENTENCE_TWO: Final = uuid.UUID("50000000-0000-4000-8000-000000000002")
SENTENCE_TEN: Final = uuid.UUID("50000000-0000-4000-8000-000000000010")


@dataclass(frozen=True)
class FixedClock:
    def now(self) -> datetime:
        return NOW


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return self.actor


@dataclass(frozen=True)
class ReaderApiSeed:
    actor: AuthenticatedActor
    profile_id: uuid.UUID
    client: TestClient


@pytest.fixture
def reader_api(migrated_postgres_url: str) -> ReaderApiSeed:
    actor_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert profile is not None
        connection.execute(
            """
            WITH parameter AS (
                SELECT id, version FROM competence_parameter_sets WHERE is_default
            )
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, language_code, status,
                 recognition, listening, production, mastery, confidence, exposure_count,
                 recognition_positive_mass, recognition_negative_mass,
                 recognition_confidence, recognition_evidence_count,
                 listening_positive_mass, listening_negative_mass,
                 listening_confidence, listening_evidence_count,
                 production_positive_mass, production_negative_mass,
                 production_confidence, production_evidence_count,
                 has_projectable_evidence, highest_achievement_status,
                 state_version, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version)
            SELECT %s, %s, '30000000-0000-4000-8000-000000000001'::uuid, 'en', 'familiar',
                   0.7, 0.7, 0.7, 0.7, 0.5, 2,
                   3.6, 0.4, 0.5, 4, 3.6, 0.4, 0.5, 4, 3.6, 0.4, 0.5, 4,
                   true, 'familiar', 1, 'competence-beta-v1', parameter.id, parameter.version
            FROM parameter
            UNION ALL
            SELECT %s, %s, '30000000-0000-4000-8000-000000000002'::uuid, 'en', 'mastered',
                   0.9, 0.9, 0.9, 0.9, 0.8, 4,
                   16, 0, 0.8, 16, 16, 0, 0.8, 16, 16, 0, 0.8, 16,
                   true, 'mastered', 1, 'competence-beta-v1', parameter.id, parameter.version
            FROM parameter
            """,
            (actor_id, profile[0], actor_id, profile[0]),
        )
        connection.commit()

    actor = AuthenticatedActor(actor_id)
    application = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        clock=FixedClock(),
        cursor_secret=b"reader-api-test-cursor-secret-32bytes",
    )
    return ReaderApiSeed(actor, uuid.UUID(str(profile[0])), TestClient(application))


def _headers(key: uuid.UUID | None = None) -> dict[str, str]:
    headers = {"Authorization": "Bearer valid-token"}
    if key is not None:
        headers["Idempotency-Key"] = str(key)
    return headers


def _assert_contract_schema(schema_name: str, payload: object) -> None:
    with open(ROOT / "contracts" / "openapi.yaml", encoding="utf-8") as source:
        contract = yaml.safe_load(source)

    def resolve(value: object) -> object:
        if isinstance(value, list):
            return [resolve(item) for item in value]
        if not isinstance(value, dict):
            return value
        reference = value.get("$ref")
        if isinstance(reference, str):
            target: object = contract
            for part in reference.removeprefix("#/").split("/"):
                target = cast(dict[str, object], target)[part]
            return resolve(deepcopy(target))
        return {key: resolve(item) for key, item in value.items()}

    raw_schema = contract["components"]["schemas"][schema_name]
    schema = cast(dict[str, object], resolve(deepcopy(raw_schema)))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)


def test_content_list_is_published_ordered_cursor_paginated_and_overlaid(
    reader_api: ReaderApiSeed,
) -> None:
    first = reader_api.client.get(
        "/v1/content/recommended",
        params={"languageProfileId": str(reader_api.profile_id), "limit": 1},
        headers=_headers(),
    )
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["data"]) == 1
    assert first_body["data"][0]["difficultyLabel"] == "A1"
    assert first_body["meta"]["hasMore"] is True

    second = reader_api.client.get(
        "/v1/content/recommended",
        params={
            "languageProfileId": str(reader_api.profile_id),
            "limit": 2,
            "cursor": first_body["meta"]["nextCursor"],
        },
        headers=_headers(),
    )
    assert second.status_code == 200
    ids = [first_body["data"][0]["id"], *(item["id"] for item in second.json()["data"])]
    assert len(ids) == len(set(ids)) == 3
    assert str(CONTENT_FOUR) not in ids

    walked_ids: list[str] = []
    cursor: str | None = None
    while True:
        params: dict[str, str | int] = {
            "languageProfileId": str(reader_api.profile_id),
            "limit": 1,
        }
        if cursor is not None:
            params["cursor"] = cursor
        page = reader_api.client.get(
            "/v1/content/recommended", params=params, headers=_headers()
        ).json()
        walked_ids.extend(item["id"] for item in page["data"])
        if not page["meta"]["hasMore"]:
            break
        cursor = page["meta"]["nextCursor"]
    assert walked_ids == ids


def test_content_detail_is_bounded_and_keeps_dictionary_detail_lazy(
    reader_api: ReaderApiSeed,
) -> None:
    response = reader_api.client.get(f"/v1/content/{CONTENT_ONE}", headers=_headers())
    assert response.status_code == 200
    body = response.json()["data"]
    assert [segment["order"] for segment in body["segments"]] == [0, 1, 2]
    annotations = body["segments"][0]["sentences"][0]["concepts"]
    assert len(annotations) == 3
    assert annotations[0]["conceptId"] == annotations[1]["conceptId"]
    assert {"definitions", "examples", "relations", "ipa"}.isdisjoint(annotations[0])

    hidden = reader_api.client.get(f"/v1/content/{CONTENT_FOUR}", headers=_headers())
    assert hidden.status_code == 404


def test_catalog_sentence_save_is_exactly_replayable_and_library_authoritative(
    reader_api: ReaderApiSeed,
) -> None:
    key = uuid.uuid4()
    first = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(SENTENCE_ONE)},
        headers=_headers(key),
    )
    replay = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(SENTENCE_ONE)},
        headers=_headers(key),
    )
    assert first.status_code == replay.status_code == 200
    assert first.json()["data"] == replay.json()["data"]
    assert first.json()["data"]["isSaved"] is True

    invalid = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(SENTENCE_TEN)},
        headers=_headers(uuid.uuid4()),
    )
    assert invalid.status_code == 404


def test_progress_is_monotonic_replayable_and_separate_from_learning(
    reader_api: ReaderApiSeed,
    migrated_postgres_url: str,
) -> None:
    def update(
        segment: uuid.UUID, completed: bool = False, key: uuid.UUID | None = None
    ) -> Response:
        return reader_api.client.put(
            f"/v1/reader/progress/{CONTENT_ONE}",
            json={
                "languageProfileId": str(reader_api.profile_id),
                "currentSegmentId": str(segment),
                "isCompleted": completed,
            },
            headers=_headers(key or uuid.uuid4()),
        )

    first_key = uuid.uuid4()
    first = update(SEGMENT_TWO, key=first_key)
    replay = update(SEGMENT_TWO, key=first_key)
    backwards = update(SEGMENT_ONE)
    completed = update(SEGMENT_THREE, completed=True)
    reopened = update(SEGMENT_ONE)
    assert first.status_code == replay.status_code == backwards.status_code == 200
    assert first.json()["data"] == replay.json()["data"]
    assert backwards.json()["data"]["currentSegmentId"] == str(SEGMENT_ONE)
    assert backwards.json()["data"]["furthestSegmentId"] == str(SEGMENT_TWO)
    assert completed.json()["data"]["progressPercent"] == 100
    assert reopened.json()["data"]["isCompleted"] is True
    assert reopened.json()["data"]["completedAt"] == completed.json()["data"]["completedAt"]

    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s", (reader_api.actor.id,)
        ).fetchone() == (0,)
        assert connection.execute(
            "SELECT count(*) FROM user_saved_content WHERE user_id = %s", (reader_api.actor.id,)
        ).fetchone() == (0,)


def test_completion_rejects_a_non_final_segment(reader_api: ReaderApiSeed) -> None:
    response = reader_api.client.put(
        f"/v1/reader/progress/{CONTENT_ONE}",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "currentSegmentId": str(SEGMENT_TWO),
            "isCompleted": True,
        },
        headers=_headers(uuid.uuid4()),
    )
    assert response.status_code == 409


def test_read_exposure_fans_out_distinct_concepts_and_exactly_replays(
    reader_api: ReaderApiSeed,
    migrated_postgres_url: str,
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        masses_before = connection.execute(
            """
            SELECT recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s
              AND concept_id = '30000000-0000-4000-8000-000000000001'
            """,
            (reader_api.actor.id,),
        ).fetchone()
    key = uuid.uuid4()
    payload = {
        "languageProfileId": str(reader_api.profile_id),
        "contentId": str(CONTENT_ONE),
        "segmentId": str(SEGMENT_ONE),
        "exposureType": "read",
    }
    first = reader_api.client.post("/v1/reader/exposures", json=payload, headers=_headers(key))
    replay = reader_api.client.post("/v1/reader/exposures", json=payload, headers=_headers(key))
    assert first.status_code == replay.status_code == 200
    assert first.json()["data"] == replay.json()["data"]
    assert first.json()["data"]["acceptedConceptCount"] == 2

    with psycopg.connect(migrated_postgres_url) as connection:
        exposure_id = first.json()["data"]["exposureId"]
        assert connection.execute(
            "SELECT count(*) FROM reader_exposure_concepts WHERE exposure_event_id = %s",
            (exposure_id,),
        ).fetchone() == (2,)
        assert connection.execute(
            "SELECT count(*) FROM learning_events WHERE source_event_id = %s", (exposure_id,)
        ).fetchone() == (2,)
        masses = connection.execute(
            """
            SELECT recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s
              AND concept_id = '30000000-0000-4000-8000-000000000001'
            """,
            (reader_api.actor.id,),
        ).fetchone()
        assert masses == masses_before


def test_lookup_requires_the_exact_authoritative_utf16_span(reader_api: ReaderApiSeed) -> None:
    payload = {
        "languageProfileId": str(reader_api.profile_id),
        "contentId": str(CONTENT_ONE),
        "segmentId": str(SEGMENT_ONE),
        "sentenceId": str(SENTENCE_ONE),
        "startOffset": 0,
        "endOffset": 6,
        "exposureType": "lookup",
    }
    accepted = reader_api.client.post(
        "/v1/reader/exposures", json=payload, headers=_headers(uuid.uuid4())
    )
    assert accepted.status_code == 200
    assert accepted.json()["data"]["acceptedConceptCount"] == 1

    invalid = reader_api.client.post(
        "/v1/reader/exposures",
        json={**payload, "endOffset": 5},
        headers=_headers(uuid.uuid4()),
    )
    assert invalid.status_code == 422


def test_reader_idempotency_key_rejects_a_changed_payload(reader_api: ReaderApiSeed) -> None:
    key = uuid.uuid4()
    first = reader_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "contentId": str(CONTENT_ONE),
            "segmentId": str(SEGMENT_ONE),
            "exposureType": "read",
        },
        headers=_headers(key),
    )
    conflict = reader_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "contentId": str(CONTENT_ONE),
            "segmentId": str(SEGMENT_TWO),
            "exposureType": "read",
        },
        headers=_headers(key),
    )
    assert first.status_code == 200
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


def test_concurrent_same_exposure_uses_one_postgresql_source_fact(
    reader_api: ReaderApiSeed,
    migrated_postgres_url: str,
) -> None:
    application = ReaderApplication(migrated_postgres_url, clock=FixedClock())
    key = uuid.uuid4()
    command = ExposureCommand(
        language_profile_id=reader_api.profile_id,
        content_id=CONTENT_ONE,
        segment_id=SEGMENT_ONE,
        exposure_type=ReaderExposureType.READ,
    )

    def invoke() -> uuid.UUID | None:
        try:
            return application.record_exposure(
                actor=reader_api.actor, command=command, idempotency_key=key
            ).exposure_id
        except ReaderMutationInFlight:
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: invoke(), range(2)))
    accepted_ids = {result for result in results if result is not None}
    assert len(accepted_ids) == 1
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM exposure_events WHERE user_id = %s AND idempotency_key = %s",
            (reader_api.actor.id, str(key)),
        ).fetchone() == (1,)


def test_concurrent_progress_updates_never_regress_furthest_segment(
    reader_api: ReaderApiSeed,
    migrated_postgres_url: str,
) -> None:
    application = ReaderApplication(migrated_postgres_url, clock=FixedClock())

    def update(segment_id: uuid.UUID) -> None:
        application.update_progress(
            actor=reader_api.actor,
            language_profile_id=reader_api.profile_id,
            content_id=CONTENT_ONE,
            current_segment_id=segment_id,
            is_completed=False,
            idempotency_key=uuid.uuid4(),
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(update, (SEGMENT_ONE, SEGMENT_THREE)))
    with psycopg.connect(migrated_postgres_url) as connection:
        row = connection.execute(
            """
            SELECT furthest_segment_id FROM user_content_progress
            WHERE user_id = %s AND content_id = %s
            """,
            (reader_api.actor.id, CONTENT_ONE),
        ).fetchone()
    assert row is not None
    assert row[0] == SEGMENT_THREE


class FailOnSecondPassiveProjection(CompetenceEngine):
    def __init__(self) -> None:
        super().__init__()
        self.calls = 0

    def apply_reader_passive_exposure(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: uuid.UUID,
        concept_id: uuid.UUID,
        ingested_at: datetime,
    ) -> None:
        self.calls += 1
        if self.calls == 2:
            raise RuntimeError("injected second-child failure")
        super().apply_reader_passive_exposure(
            connection,
            actor=actor,
            exposure_event_id=exposure_event_id,
            concept_id=concept_id,
            ingested_at=ingested_at,
        )


class BlockingPassiveProjection(CompetenceEngine):
    def __init__(self, entered: Event, release: Event) -> None:
        super().__init__()
        self.entered = entered
        self.release = release

    def apply_reader_passive_exposure(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        exposure_event_id: uuid.UUID,
        concept_id: uuid.UUID,
        ingested_at: datetime,
    ) -> None:
        self.entered.set()
        if not self.release.wait(timeout=5):
            raise RuntimeError("publication-lock test timed out")
        super().apply_reader_passive_exposure(
            connection,
            actor=actor,
            exposure_event_id=exposure_event_id,
            concept_id=concept_id,
            ingested_at=ingested_at,
        )


def test_exposure_rolls_back_source_children_and_projection_together(
    reader_api: ReaderApiSeed,
    migrated_postgres_url: str,
) -> None:
    key = uuid.uuid4()
    application = ReaderApplication(
        migrated_postgres_url,
        clock=FixedClock(),
        competence=FailOnSecondPassiveProjection(),
    )
    with pytest.raises(RuntimeError, match="second-child failure"):
        application.record_exposure(
            actor=reader_api.actor,
            idempotency_key=key,
            command=ExposureCommand(
                language_profile_id=reader_api.profile_id,
                content_id=CONTENT_ONE,
                segment_id=SEGMENT_ONE,
                exposure_type=ReaderExposureType.READ,
            ),
        )
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM exposure_events WHERE user_id = %s AND idempotency_key = %s",
            (reader_api.actor.id, str(key)),
        ).fetchone() == (0,)
        assert connection.execute(
            """
            SELECT count(*) FROM learning_events
            WHERE user_id = %s AND source_type = 'exposure_event'
              AND idempotency_key = %s
            """,
            (reader_api.actor.id, str(key)),
        ).fetchone() == (0,)


def test_exposure_holds_publication_identity_until_transaction_commit(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    entered = Event()
    release = Event()
    application = ReaderApplication(
        migrated_postgres_url,
        clock=FixedClock(),
        competence=BlockingPassiveProjection(entered, release),
    )
    command = ExposureCommand(
        language_profile_id=reader_api.profile_id,
        content_id=CONTENT_ONE,
        segment_id=SEGMENT_ONE,
        exposure_type=ReaderExposureType.READ,
    )
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            application.record_exposure,
            actor=reader_api.actor,
            command=command,
            idempotency_key=uuid.uuid4(),
        )
        assert entered.wait(timeout=5)
        try:
            with psycopg.connect(migrated_postgres_url) as connection:
                connection.execute("SET LOCAL lock_timeout = '250ms'")
                with pytest.raises(psycopg.errors.LockNotAvailable):
                    connection.execute(
                        """
                        UPDATE content_items SET publication_status = 'retired'
                        WHERE id = %s
                        """,
                        (CONTENT_ONE,),
                    )
        finally:
            release.set()
        assert future.result(timeout=5).content_id == CONTENT_ONE


def test_content_cursor_and_profile_scope_are_fail_closed(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    first = reader_api.client.get(
        "/v1/content/recommended",
        params={"languageProfileId": str(reader_api.profile_id), "limit": 1},
        headers=_headers(),
    )
    cursor = first.json()["meta"]["nextCursor"]
    tampered = reader_api.client.get(
        "/v1/content/recommended",
        params={"cursor": cursor[:-1] + ("A" if cursor[-1] != "A" else "B")},
        headers=_headers(),
    )
    assert tampered.status_code == 422

    other_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (other_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (other_id,))
        other_profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (other_id,),
        ).fetchone()
        vietnamese_profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'vi', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (reader_api.actor.id,),
        ).fetchone()
        connection.commit()
    assert other_profile is not None and vietnamese_profile is not None
    foreign = reader_api.client.get(
        "/v1/content/recommended",
        params={"languageProfileId": str(other_profile[0])},
        headers=_headers(),
    )
    assert foreign.status_code == 422
    wrong_language = reader_api.client.get(
        "/v1/content/recommended",
        params={"languageProfileId": str(vietnamese_profile[0])},
        headers=_headers(),
    )
    assert wrong_language.status_code == 422


def test_content_get_with_zero_state_is_read_only_and_serializes_unseen(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        before = connection.execute(
            "SELECT count(*) FROM user_concept_states WHERE user_id = %s",
            (reader_api.actor.id,),
        ).fetchone()
    response = reader_api.client.get(f"/v1/content/{CONTENT_TWO}", headers=_headers())
    assert response.status_code == 200
    statuses = {
        concept["status"]
        for segment in response.json()["data"]["segments"]
        for sentence in segment["sentences"]
        for concept in sentence["concepts"]
    }
    assert statuses == {"unseen"}
    assert all(
        "due" not in concept
        for segment in response.json()["data"]["segments"]
        for sentence in segment["sentences"]
        for concept in sentence["concepts"]
    )
    with psycopg.connect(migrated_postgres_url) as connection:
        after = connection.execute(
            "SELECT count(*) FROM user_concept_states WHERE user_id = %s",
            (reader_api.actor.id,),
        ).fetchone()
    assert after == before


def test_sentence_save_rejects_transport_concepts_and_missing_catalog_identity(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    extra = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(SENTENCE_ONE), "conceptIds": [str(uuid.uuid4())]},
        headers=_headers(uuid.uuid4()),
    )
    missing = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(uuid.uuid4())},
        headers=_headers(uuid.uuid4()),
    )
    assert extra.status_code == 422
    assert missing.status_code == 404

    first = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(SENTENCE_ONE)},
        headers=_headers(uuid.uuid4()),
    )
    already_saved = reader_api.client.post(
        "/v1/reader/save-sentence",
        json={"sentenceId": str(SENTENCE_ONE)},
        headers=_headers(uuid.uuid4()),
    )
    assert first.status_code == already_saved.status_code == 200
    assert first.json()["data"] == already_saved.json()["data"]
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            """
            SELECT count(*) FROM user_saved_sentences
            WHERE user_id = %s AND sentence_id = %s
            """,
            (reader_api.actor.id, SENTENCE_ONE),
        ).fetchone() == (1,)


def test_progress_rejects_wrong_hierarchy_and_preserves_competence(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        before = connection.execute(
            """
            SELECT status, recognition, listening, production, confidence,
                   recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s ORDER BY concept_id
            """,
            (reader_api.actor.id,),
        ).fetchall()
    invalid_segment = reader_api.client.put(
        f"/v1/reader/progress/{CONTENT_ONE}",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "currentSegmentId": str(uuid.uuid4()),
            "isCompleted": False,
        },
        headers=_headers(uuid.uuid4()),
    )
    unpublished = reader_api.client.put(
        f"/v1/reader/progress/{CONTENT_FOUR}",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "currentSegmentId": str(SEGMENT_TEN),
            "isCompleted": False,
        },
        headers=_headers(uuid.uuid4()),
    )
    assert invalid_segment.status_code == unpublished.status_code == 422
    accepted = reader_api.client.put(
        f"/v1/reader/progress/{CONTENT_ONE}",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "currentSegmentId": str(SEGMENT_TWO),
            "isCompleted": False,
        },
        headers=_headers(uuid.uuid4()),
    )
    assert accepted.status_code == 200
    assert accepted.json()["data"]["progressPercent"] == 33
    with psycopg.connect(migrated_postgres_url) as connection:
        after = connection.execute(
            """
            SELECT status, recognition, listening, production, confidence,
                   recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s ORDER BY concept_id
            """,
            (reader_api.actor.id,),
        ).fetchall()
    assert after == before


def test_library_membership_progress_and_exposure_remain_independent(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    progress = reader_api.client.put(
        f"/v1/reader/progress/{CONTENT_ONE}",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "currentSegmentId": str(SEGMENT_TWO),
            "isCompleted": False,
        },
        headers=_headers(uuid.uuid4()),
    )
    exposure = reader_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "contentId": str(CONTENT_ONE),
            "segmentId": str(SEGMENT_ONE),
            "exposureType": "read",
        },
        headers=_headers(uuid.uuid4()),
    )
    assert progress.status_code == exposure.status_code == 200

    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            """
            INSERT INTO user_saved_content
                (user_id, user_language_id, content_id, language_code)
            VALUES (%s, %s, %s, 'en')
            """,
            (reader_api.actor.id, reader_api.profile_id, CONTENT_ONE),
        )
        connection.commit()
    saved_detail = reader_api.client.get(f"/v1/content/{CONTENT_ONE}", headers=_headers())
    assert saved_detail.json()["data"]["summary"]["isSaved"] is True
    assert saved_detail.json()["data"]["summary"]["readingProgress"]["progressPercent"] == 33

    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "DELETE FROM user_saved_content WHERE user_id = %s AND content_id = %s",
            (reader_api.actor.id, CONTENT_ONE),
        )
        connection.commit()
    unsaved_detail = reader_api.client.get(f"/v1/content/{CONTENT_ONE}", headers=_headers())
    assert unsaved_detail.json()["data"]["summary"]["isSaved"] is False
    assert unsaved_detail.json()["data"]["summary"]["readingProgress"]["progressPercent"] == 33
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM exposure_events WHERE user_id = %s",
            (reader_api.actor.id,),
        ).fetchone() == (1,)


def test_listen_discovers_unseen_concepts_without_competence_or_fsrs_mutation(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        fsrs_before = connection.execute(
            "SELECT count(*) FROM fsrs_states WHERE user_id = %s", (reader_api.actor.id,)
        ).fetchone()
    response = reader_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "contentId": str(CONTENT_TWO),
            "segmentId": str(SEGMENT_FOUR),
            "exposureType": "listen",
        },
        headers=_headers(uuid.uuid4()),
    )
    assert response.status_code == 200
    assert response.json()["data"]["acceptedConceptCount"] == 3
    with psycopg.connect(migrated_postgres_url) as connection:
        projected = connection.execute(
            """
            SELECT status, recognition, listening, production, confidence,
                   recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s
              AND concept_id IN (
                '30000000-0000-4000-8000-000000000009',
                '30000000-0000-4000-8000-000000000010',
                '30000000-0000-4000-8000-000000000011'
              )
            ORDER BY concept_id
            """,
            (reader_api.actor.id,),
        ).fetchall()
        fsrs_after = connection.execute(
            "SELECT count(*) FROM fsrs_states WHERE user_id = %s", (reader_api.actor.id,)
        ).fetchone()
    assert len(projected) == 3
    assert all(
        row
        == (
            "discovered",
            Decimal("0.5"),
            Decimal("0.5"),
            Decimal("0.5"),
            Decimal("0"),
            Decimal("0"),
            Decimal("0"),
            Decimal("0"),
            Decimal("0"),
            Decimal("0"),
            Decimal("0"),
        )
        for row in projected
    )
    assert fsrs_after == fsrs_before


def test_passive_repetition_never_promotes_existing_statuses(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        before = connection.execute(
            """
            SELECT concept_id, status, recognition, listening, production, confidence,
                   recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s ORDER BY concept_id
            """,
            (reader_api.actor.id,),
        ).fetchall()
    for _ in range(2):
        response = reader_api.client.post(
            "/v1/reader/exposures",
            json={
                "languageProfileId": str(reader_api.profile_id),
                "contentId": str(CONTENT_ONE),
                "segmentId": str(SEGMENT_ONE),
                "exposureType": "read",
            },
            headers=_headers(uuid.uuid4()),
        )
        assert response.status_code == 200
    with psycopg.connect(migrated_postgres_url) as connection:
        after = connection.execute(
            """
            SELECT concept_id, status, recognition, listening, production, confidence,
                   recognition_positive_mass, recognition_negative_mass,
                   listening_positive_mass, listening_negative_mass,
                   production_positive_mass, production_negative_mass
            FROM user_concept_states
            WHERE user_id = %s
              AND concept_id IN (
                '30000000-0000-4000-8000-000000000001',
                '30000000-0000-4000-8000-000000000002'
              )
            ORDER BY concept_id
            """,
            (reader_api.actor.id,),
        ).fetchall()
    assert after == before


def test_exposure_rejects_invalid_profile_hierarchy_time_and_lookup_sentence(
    reader_api: ReaderApiSeed,
) -> None:
    base = {
        "languageProfileId": str(reader_api.profile_id),
        "contentId": str(CONTENT_ONE),
        "segmentId": str(SEGMENT_ONE),
        "exposureType": "read",
    }
    cases = [
        ({**base, "languageProfileId": str(uuid.uuid4())}, 422),
        (
            {
                **base,
                "contentId": str(CONTENT_FOUR),
                "segmentId": str(SEGMENT_TEN),
            },
            404,
        ),
        ({**base, "occurredAt": (NOW - timedelta(days=30)).isoformat()}, 422),
        ({**base, "occurredAt": (NOW + timedelta(minutes=6)).isoformat()}, 422),
        ({**base, "exposureType": "listen"}, 422),
        (
            {
                **base,
                "exposureType": "lookup",
                "sentenceId": str(SENTENCE_TWO),
                "startOffset": 0,
                "endOffset": 6,
            },
            422,
        ),
    ]
    for payload, expected_status in cases:
        response = reader_api.client.post(
            "/v1/reader/exposures", json=payload, headers=_headers(uuid.uuid4())
        )
        assert response.status_code == expected_status


def test_new_key_creates_new_source_while_delayed_replay_stays_historical(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    payload = {
        "languageProfileId": str(reader_api.profile_id),
        "contentId": str(CONTENT_ONE),
        "segmentId": str(SEGMENT_ONE),
        "exposureType": "read",
    }
    first_key = uuid.uuid4()
    first = reader_api.client.post(
        "/v1/reader/exposures", json=payload, headers=_headers(first_key)
    )
    second = reader_api.client.post(
        "/v1/reader/exposures", json=payload, headers=_headers(uuid.uuid4())
    )
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE content_items SET title = 'Metadata changed after exposure' WHERE id = %s",
            (CONTENT_ONE,),
        )
        connection.commit()
    replay = reader_api.client.post(
        "/v1/reader/exposures", json=payload, headers=_headers(first_key)
    )
    assert first.status_code == second.status_code == replay.status_code == 200
    assert first.json()["data"] == replay.json()["data"]
    assert first.json()["data"]["exposureId"] != second.json()["data"]["exposureId"]


def test_reader_source_and_replay_history_are_append_only(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    exposure_key = uuid.uuid4()
    exposure = reader_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "contentId": str(CONTENT_ONE),
            "segmentId": str(SEGMENT_ONE),
            "exposureType": "read",
        },
        headers=_headers(exposure_key),
    )
    progress_key = uuid.uuid4()
    progress = reader_api.client.put(
        f"/v1/reader/progress/{CONTENT_ONE}",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "currentSegmentId": str(SEGMENT_ONE),
            "isCompleted": False,
        },
        headers=_headers(progress_key),
    )
    assert exposure.status_code == progress.status_code == 200
    exposure_id = exposure.json()["data"]["exposureId"]

    statements = (
        (
            "UPDATE exposure_events SET occurred_at = occurred_at + interval '1 second' "
            "WHERE id = %s",
            (exposure_id,),
        ),
        (
            "DELETE FROM reader_exposure_concepts WHERE exposure_event_id = %s",
            (exposure_id,),
        ),
        (
            "DELETE FROM reader_mutation_results WHERE user_id = %s AND idempotency_key = %s",
            (reader_api.actor.id, progress_key),
        ),
    )
    for statement, parameters in statements:
        with (
            psycopg.connect(migrated_postgres_url) as connection,
            pytest.raises(
                psycopg.errors.CheckViolation,
                match="Reader source facts and replay snapshots are append-only",
            ),
        ):
            connection.execute(statement, parameters)


def test_concurrent_same_key_different_exposures_have_one_winner(
    reader_api: ReaderApiSeed, migrated_postgres_url: str
) -> None:
    application = ReaderApplication(migrated_postgres_url, clock=FixedClock())
    key = uuid.uuid4()
    commands = (
        ExposureCommand(
            language_profile_id=reader_api.profile_id,
            content_id=CONTENT_ONE,
            segment_id=SEGMENT_ONE,
            exposure_type=ReaderExposureType.READ,
        ),
        ExposureCommand(
            language_profile_id=reader_api.profile_id,
            content_id=CONTENT_ONE,
            segment_id=SEGMENT_TWO,
            exposure_type=ReaderExposureType.READ,
        ),
    )

    def invoke(command: ExposureCommand) -> str:
        try:
            application.record_exposure(
                actor=reader_api.actor, command=command, idempotency_key=key
            )
            return "accepted"
        except ReaderMutationInFlight:
            return "in-flight"
        except IdempotencyConflict:
            return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(invoke, commands))
    assert outcomes.count("accepted") == 1
    assert set(outcomes) <= {"accepted", "in-flight", "conflict"}
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM exposure_events WHERE user_id = %s AND idempotency_key = %s",
            (reader_api.actor.id, str(key)),
        ).fetchone() == (1,)


def test_reader_validation_exceptions_do_not_leak_internal_messages(
    reader_api: ReaderApiSeed,
) -> None:
    response = reader_api.client.post(
        "/v1/reader/exposures",
        json={
            "languageProfileId": str(reader_api.profile_id),
            "contentId": str(CONTENT_ONE),
            "segmentId": str(SEGMENT_ONE),
            "exposureType": "read",
            "occurredAt": (NOW + timedelta(minutes=6)).isoformat(),
        },
        headers=_headers(uuid.uuid4()),
    )
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "The Reader request is invalid."
    assert "future" not in response.text


def test_reader_success_responses_match_the_frozen_openapi_schemas(
    reader_api: ReaderApiSeed,
) -> None:
    responses = (
        (
            "ContentRecommendationsResponse",
            reader_api.client.get(
                "/v1/content/recommended",
                params={"languageProfileId": str(reader_api.profile_id)},
                headers=_headers(),
            ),
        ),
        (
            "ContentResponse",
            reader_api.client.get(f"/v1/content/{CONTENT_ONE}", headers=_headers()),
        ),
        (
            "LibraryMutationResponse",
            reader_api.client.post(
                "/v1/reader/save-sentence",
                json={"sentenceId": str(SENTENCE_ONE)},
                headers=_headers(uuid.uuid4()),
            ),
        ),
        (
            "ReadingProgressResponse",
            reader_api.client.put(
                f"/v1/reader/progress/{CONTENT_ONE}",
                json={
                    "languageProfileId": str(reader_api.profile_id),
                    "currentSegmentId": str(SEGMENT_ONE),
                    "isCompleted": False,
                },
                headers=_headers(uuid.uuid4()),
            ),
        ),
        (
            "ReaderExposureResponse",
            reader_api.client.post(
                "/v1/reader/exposures",
                json={
                    "languageProfileId": str(reader_api.profile_id),
                    "contentId": str(CONTENT_ONE),
                    "segmentId": str(SEGMENT_ONE),
                    "exposureType": "read",
                },
                headers=_headers(uuid.uuid4()),
            ),
        ),
    )
    for schema_name, response in responses:
        assert response.status_code == 200
        _assert_contract_schema(schema_name, response.json())


def test_fastapi_reader_operations_match_frozen_operation_metadata(
    reader_api: ReaderApiSeed,
) -> None:
    with open(ROOT / "contracts" / "openapi.yaml", encoding="utf-8") as source:
        authoritative = yaml.safe_load(source)
    generated = cast(FastAPI, reader_api.client.app).openapi()
    operations = (
        ("/v1/content/recommended", "get"),
        ("/v1/content/{contentId}", "get"),
        ("/v1/reader/save-sentence", "post"),
        ("/v1/reader/progress/{contentId}", "put"),
        ("/v1/reader/exposures", "post"),
    )
    for path, method in operations:
        actual = generated["paths"][path][method]
        expected = authoritative["paths"][path][method]
        assert actual["operationId"] == expected["operationId"]
        assert set(actual["responses"]) == set(expected["responses"])
        assert actual["security"] == [{"bearerAuth": []}]


def test_0005_rollback_refuses_reader_activity(isolated_migrated_postgres_url: str) -> None:
    actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        connection.execute(
            """
            INSERT INTO user_languages
                (id, user_id, language_code, interface_language_code,
                 native_language_code, goal, daily_minutes)
            VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 20)
            """,
            (profile_id, actor_id),
        )
        connection.execute(
            """
            INSERT INTO reader_mutation_results
                (user_id, idempotency_key, operation_type, request_fingerprint,
                 resource_id, result_snapshot, completed_at)
            VALUES (%s, %s, 'progress', %s, %s, '{}'::jsonb, now())
            """,
            (actor_id, uuid.uuid4(), "d" * 64, uuid.uuid4()),
        )

    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0009"]
    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0008"]
    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0007"]
    assert migrate_down(
        isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1
    ) == ["0006"]
    with pytest.raises(psycopg.errors.RaiseException, match="Refusing lossy TASK-008 rollback"):
        migrate_down(isolated_migrated_postgres_url, ROOT / "database" / "migrations", steps=1)
