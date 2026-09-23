from __future__ import annotations

import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final, cast

import psycopg
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.auth import AccessTokenForbidden, AccessTokenInvalid
from lingua_api.competence.service import CompetenceEngine
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor, CreatedFrom
from lingua_api.memory.service import PostgresMemoryEngine

NOW: Final = datetime(2026, 8, 23, 3, 0, tzinfo=UTC)
RATINGS: Final = ("again", "hard", "good", "easy")
COMPETENCE_PARAMETER_SET_ID: Final = uuid.UUID("00000000-0000-4000-8600-000000000002")


@dataclass
class MutableApiClock:
    current: datetime = NOW

    def now(self) -> datetime:
        return self.current


@dataclass(frozen=True)
class ApiSeed:
    actor: AuthenticatedActor
    language_profile_id: uuid.UUID
    review_item_id: uuid.UUID
    concept_id: uuid.UUID


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token == "forbidden-token":
            raise AccessTokenForbidden("learner role is required")
        if token != "valid-token":
            raise AccessTokenInvalid("invalid bearer token")
        return self.actor


def _seed_review_api(database_url: str, clock: MutableApiClock) -> ApiSeed:
    actor_id = uuid.uuid4()
    with psycopg.connect(database_url) as connection:
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
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert profile is not None
        license_row = connection.execute(
            """
            INSERT INTO licenses (code, name, usage_policy, attribution_required)
            VALUES (%s, 'Review API test', 'allowed', false)
            RETURNING id
            """,
            (f"review-api-{uuid.uuid4()}",),
        ).fetchone()
        assert license_row is not None
        source = connection.execute(
            """
            INSERT INTO data_sources
                (name, source_type, source_version, license_id, attribution_text)
            VALUES (%s, 'internal', '1', %s, 'Review API fixture')
            RETURNING id
            """,
            (f"review-api-{uuid.uuid4()}", license_row[0]),
        ).fetchone()
        assert source is not None
        source_record = connection.execute(
            """
            INSERT INTO source_records
                (source_id, source_record_key, raw_hash, transform_version,
                 quality_score, review_status)
            VALUES (%s, %s, %s, 'review-api-v1', 1, 'approved')
            RETURNING id
            """,
            (source[0], str(uuid.uuid4()), "a" * 64),
        ).fetchone()
        assert source_record is not None
        concept = connection.execute(
            """
            INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
            VALUES ('en', 'word', %s, %s)
            RETURNING id
            """,
            (f"appointment-{uuid.uuid4()}", source_record[0]),
        ).fetchone()
        assert concept is not None
        lexeme = connection.execute(
            """
            INSERT INTO lexemes
                (concept_id, language_code, lemma, normalized_form, part_of_speech,
                 source_record_id)
            VALUES (%s, 'en', 'appointment', %s, 'noun', %s)
            RETURNING id
            """,
            (concept[0], f"appointment-{uuid.uuid4()}", source_record[0]),
        ).fetchone()
        assert lexeme is not None
        connection.execute(
            """
            INSERT INTO word_senses
                (lexeme_id, sense_order, definition, definition_language_code,
                 translated_definition, translation_language_code, source_record_id)
            VALUES (%s, 1, 'An arrangement to meet.', 'en', 'Một cuộc hẹn.', 'vi', %s)
            """,
            (lexeme[0], source_record[0]),
        )
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, recognition, listening,
                 production, confidence, exposure_count, state_version,
                 recognition_positive_mass, recognition_negative_mass,
                 recognition_confidence, recognition_evidence_count,
                 recognition_last_evidence_at,
                 listening_positive_mass, listening_negative_mass,
                 listening_confidence, listening_evidence_count,
                 listening_last_evidence_at, recent_competence_outcomes,
                 has_projectable_evidence, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version)
            VALUES (%s, %s, %s, 'learning', 0.6, 0.4, 0.5, 0.14, 9, 1,
                    1, 0, 0.2, 1, %s, 0, 1, 0.2, 1, %s,
                    '{"recognition":[1],"listening":[0],"production":[]}'::jsonb,
                    true, 'competence-beta-v1', %s, 'competence-beta-v1')
            """,
            (
                actor_id,
                profile[0],
                concept[0],
                clock.now(),
                clock.now(),
                COMPETENCE_PARAMETER_SET_ID,
            ),
        )
        for skill, score, confidence, evidence_count in (
            ("recognition", 0.61, 0.71, 11),
            ("listening", 0.52, 0.62, 8),
            ("production", 0.43, 0.53, 5),
        ):
            connection.execute(
                """
                INSERT INTO user_skill_states
                    (user_id, user_language_id, skill, score, confidence, evidence_count,
                     assessed_at, method_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'projection-v1')
                """,
                (actor_id, profile[0], skill, score, confidence, evidence_count, clock.now()),
            )
        connection.commit()

    actor = AuthenticatedActor(actor_id)
    item = PostgresMemoryEngine(database_url, clock=clock).activate(
        actor=actor,
        user_language_id=profile[0],
        concept_id=concept[0],
        created_from=CreatedFrom.LEARNER_SAVED,
    )
    return ApiSeed(actor, profile[0], item.review_item_id, concept[0])


def _seed_second_review_for_actor(
    database_url: str, seed: ApiSeed, clock: MutableApiClock
) -> uuid.UUID:
    with psycopg.connect(database_url) as connection:
        source_record = connection.execute(
            "SELECT source_record_id FROM concepts WHERE id = %s", (seed.concept_id,)
        ).fetchone()
        assert source_record is not None
        concept = connection.execute(
            """
            INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
            VALUES ('en', 'word', %s, %s)
            RETURNING id
            """,
            (f"available-{uuid.uuid4()}", source_record[0]),
        ).fetchone()
        assert concept is not None
        connection.execute(
            """
            INSERT INTO lexemes
                (concept_id, language_code, lemma, normalized_form, part_of_speech,
                 source_record_id)
            VALUES (%s, 'en', 'available', %s, 'adjective', %s)
            """,
            (concept[0], f"available-{uuid.uuid4()}", source_record[0]),
        )
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, recognition, listening,
                 production, confidence, exposure_count, state_version,
                 recognition_positive_mass, recognition_negative_mass,
                 recognition_confidence, recognition_evidence_count,
                 recognition_last_evidence_at, recent_competence_outcomes,
                 has_projectable_evidence, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version)
            VALUES (%s, %s, %s, 'learning', 0.4, 0.5, 0.5, 0.08, 4, 1,
                    0, 1, 0.2, 1, %s,
                    '{"recognition":[0],"listening":[],"production":[]}'::jsonb,
                    true, 'competence-beta-v1', %s, 'competence-beta-v1')
            """,
            (
                seed.actor.id,
                seed.language_profile_id,
                concept[0],
                clock.now(),
                COMPETENCE_PARAMETER_SET_ID,
            ),
        )
        connection.commit()
    return (
        PostgresMemoryEngine(database_url, clock=clock)
        .activate(
            actor=seed.actor,
            user_language_id=seed.language_profile_id,
            concept_id=concept[0],
            created_from=CreatedFrom.LEARNER_SAVED,
        )
        .review_item_id
    )


def _seed_non_lexical_review_for_actor(
    database_url: str,
    seed: ApiSeed,
    clock: MutableApiClock,
    *,
    concept_type: str,
    canonical_form: str,
) -> uuid.UUID:
    with psycopg.connect(database_url) as connection:
        source_record = connection.execute(
            "SELECT source_record_id FROM concepts WHERE id = %s", (seed.concept_id,)
        ).fetchone()
        assert source_record is not None
        concept = connection.execute(
            """
            INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
            VALUES ('en', %s, %s, %s)
            RETURNING id
            """,
            (concept_type, canonical_form, source_record[0]),
        ).fetchone()
        assert concept is not None
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, recognition, listening,
                 production, confidence, exposure_count, state_version)
            VALUES (%s, %s, %s, 'learning', 0.5, 0.4, 0.3, 0.6, 4, 1)
            """,
            (seed.actor.id, seed.language_profile_id, concept[0]),
        )
        connection.commit()
    return (
        PostgresMemoryEngine(database_url, clock=clock)
        .activate(
            actor=seed.actor,
            user_language_id=seed.language_profile_id,
            concept_id=concept[0],
            created_from=CreatedFrom.LEARNER_SAVED,
        )
        .review_item_id
    )


@pytest.fixture
def api_clock() -> MutableApiClock:
    return MutableApiClock()


@pytest.fixture
def api_seed(migrated_postgres_url: str, api_clock: MutableApiClock) -> Iterator[ApiSeed]:
    seed = _seed_review_api(migrated_postgres_url, api_clock)
    try:
        yield seed
    finally:
        with psycopg.connect(migrated_postgres_url) as connection:
            connection.execute("DELETE FROM users WHERE id = %s", (seed.actor.id,))
            connection.execute("DELETE FROM auth.users WHERE id = %s", (seed.actor.id,))
            connection.commit()


@pytest.fixture
def api_client(
    migrated_postgres_url: str, api_seed: ApiSeed, api_clock: MutableApiClock
) -> TestClient:
    return TestClient(
        create_app(
            database_url=migrated_postgres_url,
            token_verifier=StubTokenVerifier(api_seed.actor),
            clock=api_clock,
            cursor_secret=b"review-api-test-cursor-secret-32-bytes",
        ),
        raise_server_exceptions=False,
    )


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer valid-token"}


def _assert_contract_schema(schema_name: str, payload: object) -> None:
    with open("contracts/openapi.yaml", encoding="utf-8") as source:
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


def _answer(
    client: TestClient,
    review_item_id: uuid.UUID,
    *,
    rating: str = "good",
    key: uuid.UUID | None = None,
    body_extra: dict[str, object] | None = None,
) -> Response:
    body: dict[str, object] = {"rating": rating, "responseTimeMs": 820}
    body.update(body_extra or {})
    return client.post(
        f"/v1/review/{review_item_id}/answer",
        headers={**_auth(), "Idempotency-Key": str(key or uuid.uuid4())},
        json=body,
    )


def test_queue_requires_a_valid_bearer_token(api_client: TestClient) -> None:
    missing = api_client.get("/v1/review/queue")
    invalid = api_client.get("/v1/review/queue", headers={"Authorization": "Bearer attacker-token"})

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert missing.json()["error"]["code"] == "UNAUTHENTICATED"
    assert "token" not in invalid.text.lower()


def test_queue_keeps_non_learner_credentials_inside_its_documented_401(
    api_client: TestClient,
) -> None:
    response = api_client.get(
        "/v1/review/queue",
        headers={"Authorization": "Bearer forbidden-token"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_authenticated_queue_returns_owned_due_projection(
    api_client: TestClient, api_seed: ApiSeed
) -> None:
    response = api_client.get(
        "/v1/review/queue",
        params={"languageProfileId": str(api_seed.language_profile_id)},
        headers=_auth(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]) == 1
    item = payload["data"][0]
    assert item["reviewItemId"] == str(api_seed.review_item_id)
    assert item["concept"]["canonicalForm"] == "appointment"
    assert item["concept"]["partOfSpeech"] == "noun"
    assert item["exerciseMode"] == "self_recall"
    assert item["prompt"]["promptText"] == "Một cuộc hẹn."
    assert item["competence"]["recognition"]["evidenceCount"] == 1
    assert payload["meta"]["pageSize"] == 1


def test_queue_uses_temporal_effective_status_without_rewriting_stored_status(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        before = connection.execute(
            """
            SELECT status, state_version, recognition_positive_mass,
                   recognition_negative_mass, listening_positive_mass,
                   listening_negative_mass, recent_competence_outcomes
            FROM user_concept_states
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.language_profile_id, api_seed.concept_id),
        ).fetchone()
        assert before is not None
        connection.execute(
            """
            UPDATE user_concept_states SET status = 'active'
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.language_profile_id, api_seed.concept_id),
        )
        connection.execute(
            """
            UPDATE fsrs_states
            SET state = 'review', difficulty = 5, stability = 1, step = NULL,
                last_review_at = '2025-01-01T00:00:00Z',
                due_at = '2025-01-02T00:00:00Z'
            WHERE review_item_id = %s AND user_id = %s
            """,
            (api_seed.review_item_id, api_seed.actor.id),
        )
        connection.commit()

    response = api_client.get("/v1/review/queue", headers=_auth())

    assert response.status_code == 200
    assert response.json()["data"][0]["concept"]["status"] == "forgotten"
    with psycopg.connect(migrated_postgres_url) as connection:
        after = connection.execute(
            """
            SELECT status, state_version, recognition_positive_mass,
                   recognition_negative_mass, listening_positive_mass,
                   listening_negative_mass, recent_competence_outcomes
            FROM user_concept_states
            WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.language_profile_id, api_seed.concept_id),
        ).fetchone()
    assert after is not None
    assert after == ("active", *before[1:])


def test_same_queue_page_returns_different_competence_for_different_concepts(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    second_item_id = _seed_second_review_for_actor(migrated_postgres_url, api_seed, api_clock)

    response = api_client.get("/v1/review/queue", params={"limit": 10}, headers=_auth())

    assert response.status_code == 200
    items = {item["reviewItemId"]: item for item in response.json()["data"]}
    first_score = items[str(api_seed.review_item_id)]["competence"]["recognition"]["score"]
    second_score = items[str(second_item_id)]["competence"]["recognition"]["score"]
    assert first_score == 0.6
    assert second_score == 0.4


def test_zero_evidence_queue_read_is_synthetic_and_writes_no_projection(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "DELETE FROM user_concept_states WHERE user_id = %s AND concept_id = %s",
            (api_seed.actor.id, api_seed.concept_id),
        )
        connection.commit()

    response = api_client.get("/v1/review/queue", headers=_auth())

    assert response.status_code == 200
    item = response.json()["data"][0]
    assert item["concept"]["status"] == "unseen"
    for dimension in ("recognition", "listening", "production"):
        assert item["competence"][dimension]["score"] == 0.5
        assert item["competence"][dimension]["confidence"] == 0
        assert item["competence"][dimension]["evidenceCount"] == 0
    with psycopg.connect(migrated_postgres_url) as connection:
        count = connection.execute(
            "SELECT count(*) FROM user_concept_states WHERE user_id = %s AND concept_id = %s",
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
    assert count == (0,)


def test_language_aggregate_cannot_contaminate_queue_concept_competence(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE user_skill_states SET score = 0, confidence = 1 WHERE user_id = %s",
            (api_seed.actor.id,),
        )
        connection.commit()

    response = api_client.get("/v1/review/queue", headers=_auth())

    assert response.status_code == 200
    competence = response.json()["data"][0]["competence"]
    assert competence["recognition"]["score"] == 0.6
    assert competence["recognition"]["confidence"] == 0.2


@pytest.mark.parametrize("exposure_type", ["read", "listen", "lookup"])
def test_passive_exposure_is_idempotent_and_never_changes_competence(
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
    exposure_type: str,
) -> None:
    exposure_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        before = connection.execute(
            """
            SELECT recognition, listening, production,
                   recognition_evidence_count, listening_evidence_count,
                   production_evidence_count, exposure_count
            FROM user_concept_states WHERE user_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO exposure_events
                (id, user_id, user_language_id, language_code, exposure_type,
                 concept_id, idempotency_key, occurred_at)
            VALUES (%s, %s, %s, 'en', %s, %s, %s, %s)
            """,
            (
                exposure_id,
                api_seed.actor.id,
                api_seed.language_profile_id,
                exposure_type,
                api_seed.concept_id,
                str(uuid.uuid4()),
                api_clock.now(),
            ),
        )
        engine = CompetenceEngine()
        with connection.transaction():
            engine.apply_passive_exposure(
                connection,
                actor=api_seed.actor,
                exposure_event_id=exposure_id,
                ingested_at=api_clock.now(),
            )
        with connection.transaction():
            engine.apply_passive_exposure(
                connection,
                actor=api_seed.actor,
                exposure_event_id=exposure_id,
                ingested_at=api_clock.now(),
            )
        after = connection.execute(
            """
            SELECT recognition, listening, production,
                   recognition_evidence_count, listening_evidence_count,
                   production_evidence_count, exposure_count
            FROM user_concept_states WHERE user_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
        event_count = connection.execute(
            "SELECT count(*) FROM learning_events WHERE source_event_id = %s",
            (exposure_id,),
        ).fetchone()

    assert before is not None and after is not None
    assert after[:6] == before[:6]
    assert after[6] == before[6] + 1
    assert event_count == (1,)


def test_queue_serializes_grammar_and_skill_without_fake_part_of_speech(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    _seed_non_lexical_review_for_actor(
        migrated_postgres_url,
        api_seed,
        api_clock,
        concept_type="grammar",
        canonical_form="present-perfect",
    )
    _seed_non_lexical_review_for_actor(
        migrated_postgres_url,
        api_seed,
        api_clock,
        concept_type="skill",
        canonical_form="listening-for-gist",
    )

    response = api_client.get("/v1/review/queue", headers=_auth())

    assert response.status_code == 200
    concepts = {
        item["concept"]["canonicalForm"]: item["concept"] for item in response.json()["data"]
    }
    assert concepts["appointment"]["partOfSpeech"] == "noun"
    for canonical_form in ("present-perfect", "listening-for-gist"):
        assert "partOfSpeech" not in concepts[canonical_form]
        assert not ({"unknown", "other", "n/a"} & set(concepts[canonical_form].values()))
    _assert_contract_schema("ReviewQueueResponse", response.json())


def test_queue_hides_another_actors_language_profile(
    api_client: TestClient, migrated_postgres_url: str, api_clock: MutableApiClock
) -> None:
    other = _seed_review_api(migrated_postgres_url, api_clock)
    try:
        response = api_client.get(
            "/v1/review/queue",
            params={"languageProfileId": str(other.language_profile_id)},
            headers=_auth(),
        )
        assert response.status_code == 200
        assert response.json()["data"] == []
    finally:
        with psycopg.connect(migrated_postgres_url) as connection:
            connection.execute("DELETE FROM users WHERE id = %s", (other.actor.id,))
            connection.execute("DELETE FROM auth.users WHERE id = %s", (other.actor.id,))
            connection.commit()


@pytest.mark.parametrize("rating", RATINGS)
def test_answer_accepts_each_authoritative_rating(
    api_client: TestClient, api_seed: ApiSeed, rating: str
) -> None:
    response = _answer(api_client, api_seed.review_item_id, rating=rating)

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["reviewItemId"] == str(api_seed.review_item_id)
    assert payload["data"]["memory"]["state"] != "new"
    assert payload["data"]["remainingDueCount"] == 0
    assert payload["meta"]["apiVersion"] == "1.0"


def test_review_success_responses_validate_against_authoritative_openapi(
    api_client: TestClient, api_seed: ApiSeed
) -> None:
    queue = api_client.get("/v1/review/queue", headers=_auth())
    answer = _answer(api_client, api_seed.review_item_id)

    assert queue.status_code == answer.status_code == 200
    _assert_contract_schema("ReviewQueueResponse", queue.json())
    _assert_contract_schema("ReviewAnswerResponse", answer.json())


def test_answer_requires_idempotency_key(api_client: TestClient, api_seed: ApiSeed) -> None:
    response = api_client.post(
        f"/v1/review/{api_seed.review_item_id}/answer",
        headers=_auth(),
        json={"rating": "good", "responseTimeMs": 100},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    _assert_contract_schema("ErrorEnvelope", response.json())


def test_answer_maps_forbidden_actor_without_leaking_auth_details(
    api_client: TestClient, api_seed: ApiSeed
) -> None:
    response = api_client.post(
        f"/v1/review/{api_seed.review_item_id}/answer",
        headers={
            "Authorization": "Bearer forbidden-token",
            "Idempotency-Key": str(uuid.uuid4()),
        },
        json={"rating": "good", "responseTimeMs": 100},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
    assert "role" not in response.text.lower()


def test_invalid_rating_uses_the_contract_validation_envelope(
    api_client: TestClient, api_seed: ApiSeed
) -> None:
    response = _answer(api_client, api_seed.review_item_id, rating="perfect")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_answer_replay_is_stable_and_does_not_advance_twice(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    key = uuid.uuid4()
    first = _answer(api_client, api_seed.review_item_id, key=key)
    replay = _answer(api_client, api_seed.review_item_id, key=key)

    assert first.status_code == replay.status_code == 200
    assert replay.json()["data"]["memory"] == first.json()["data"]["memory"]
    assert replay.json()["data"]["competence"] == first.json()["data"]["competence"]
    with psycopg.connect(migrated_postgres_url) as connection:
        count = connection.execute(
            "SELECT count(*) FROM review_events WHERE review_item_id = %s",
            (api_seed.review_item_id,),
        ).fetchone()
    assert count == (1,)


def test_delayed_http_replay_returns_the_exact_historical_domain_result(
    api_client: TestClient, api_seed: ApiSeed, api_clock: MutableApiClock
) -> None:
    key_a = uuid.uuid4()
    first = _answer(api_client, api_seed.review_item_id, key=key_a, rating="good")
    api_clock.current += timedelta(minutes=1)
    later = _answer(api_client, api_seed.review_item_id, rating="hard")
    api_clock.current += timedelta(minutes=1)
    replay = _answer(api_client, api_seed.review_item_id, key=key_a, rating="good")

    assert first.status_code == later.status_code == replay.status_code == 200
    assert replay.json()["data"] == first.json()["data"]
    assert replay.json()["data"]["memory"] != later.json()["data"]["memory"]
    assert replay.json()["data"]["competence"] != later.json()["data"]["competence"]


def test_idempotency_key_reuse_maps_to_safe_contract_conflict(
    api_client: TestClient, api_seed: ApiSeed
) -> None:
    key = uuid.uuid4()
    assert _answer(api_client, api_seed.review_item_id, key=key, rating="good").status_code == 200
    conflict = _answer(api_client, api_seed.review_item_id, key=key, rating="easy")

    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert "constraint" not in conflict.text.lower()
    assert "postgres" not in conflict.text.lower()


def test_answer_rejects_unknown_and_inactive_items(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    missing = _answer(api_client, uuid.uuid4())
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE review_items SET status = 'suspended' WHERE id = %s",
            (api_seed.review_item_id,),
        )
        connection.commit()
    inactive = _answer(api_client, api_seed.review_item_id)

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "NOT_FOUND"
    assert inactive.status_code == 409
    assert inactive.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_public_request_and_response_reject_internal_or_ownership_fields(
    api_client: TestClient, api_seed: ApiSeed
) -> None:
    rejected = _answer(
        api_client,
        api_seed.review_item_id,
        body_extra={"userId": str(api_seed.actor.id), "difficulty": 8.2},
    )
    accepted = _answer(api_client, api_seed.review_item_id)

    assert rejected.status_code == 422
    assert accepted.status_code == 200
    serialized = accepted.json()
    for private_name in (
        "userId",
        "difficulty",
        "stability",
        "stateVersion",
        "parameterSet",
        "paramsVersion",
    ):
        assert private_name not in str(serialized)


def test_remaining_due_count_is_derived_after_the_accepted_transaction(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    _seed_second_review_for_actor(migrated_postgres_url, api_seed, api_clock)

    response = _answer(api_client, api_seed.review_item_id, rating="easy")

    assert response.status_code == 200
    assert response.json()["data"]["remainingDueCount"] == 1


def test_answer_returns_post_event_concept_competence_without_profile_contamination(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    response = _answer(api_client, api_seed.review_item_id, rating="again")

    assert response.status_code == 200
    competence = response.json()["data"]["competence"]
    assert competence["recognition"] | {"updatedAt": "authoritative-projection-time"} == {
        "score": 0.6,
        "confidence": 0.2,
        "evidenceCount": 1,
        "updatedAt": "authoritative-projection-time",
    }
    assert competence["production"]["score"] == pytest.approx(4 / 9)
    assert competence["production"]["evidenceCount"] == 1
    with psycopg.connect(migrated_postgres_url) as connection:
        rows = connection.execute(
            """
            SELECT skill, score, confidence, evidence_count
            FROM user_skill_states
            WHERE user_id = %s
            ORDER BY skill
            """,
            (api_seed.actor.id,),
        ).fetchall()
    assert len(rows) == 3


def test_missing_language_aggregate_does_not_block_review_concept_projection(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "DELETE FROM user_skill_states WHERE user_id = %s AND skill = 'production'",
            (api_seed.actor.id,),
        )
        connection.commit()

    response = _answer(api_client, api_seed.review_item_id)

    assert response.status_code == 200
    assert response.json()["data"]["competence"]["recognition"]["score"] == 0.6


def test_first_review_creates_zero_evidence_projection_then_applies_one_event(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "DELETE FROM user_concept_states WHERE user_id = %s AND concept_id = %s",
            (api_seed.actor.id, api_seed.concept_id),
        )
        connection.commit()

    response = _answer(api_client, api_seed.review_item_id, rating="good")

    assert response.status_code == 200
    competence = response.json()["data"]["competence"]
    assert competence["recognition"] | {"updatedAt": None} == {
        "score": 0.5,
        "confidence": 0,
        "evidenceCount": 0,
        "updatedAt": None,
    }
    assert competence["production"]["score"] == pytest.approx(14 / 27)
    assert competence["production"]["confidence"] == pytest.approx(1 / 9)
    assert competence["production"]["evidenceCount"] == 1
    with psycopg.connect(migrated_postgres_url) as connection:
        row = connection.execute(
            """
            SELECT production_positive_mass, production_negative_mass,
                   production_evidence_count, competence_parameter_set_id,
                   (SELECT count(*) FROM learning_events
                    WHERE user_id = %s AND concept_id = %s)
            FROM user_concept_states
            WHERE user_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.concept_id, api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
    assert row is not None
    assert float(row[0]) == pytest.approx(1 / 3)
    assert float(row[1]) == pytest.approx(1 / 6)
    assert row[2:] == (1, COMPETENCE_PARAMETER_SET_ID, 1)


def test_reviewing_one_concept_does_not_modify_another_concept_projection(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    second_item_id = _seed_second_review_for_actor(migrated_postgres_url, api_seed, api_clock)
    with psycopg.connect(migrated_postgres_url) as connection:
        second_concept = connection.execute(
            "SELECT concept_id FROM review_items WHERE id = %s", (second_item_id,)
        ).fetchone()
        assert second_concept is not None
        before = connection.execute(
            "SELECT recognition, state_version FROM user_concept_states WHERE concept_id = %s",
            (second_concept[0],),
        ).fetchone()

    assert _answer(api_client, api_seed.review_item_id).status_code == 200

    with psycopg.connect(migrated_postgres_url) as connection:
        after = connection.execute(
            "SELECT recognition, state_version FROM user_concept_states WHERE concept_id = %s",
            (second_concept[0],),
        ).fetchone()
    assert after == before


def test_competence_failure_rolls_back_memory_review_event_and_learning_event(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    application = cast(FastAPI, api_client.app).state.review_application

    def fail_projection(*args: object, **kwargs: object) -> object:
        raise RuntimeError("injected competence failure")

    with monkeypatch.context() as scoped:
        scoped.setattr(application._competence, "apply_review", fail_projection)
        failed = _answer(api_client, api_seed.review_item_id, key=uuid.uuid4())
    assert failed.status_code == 500

    with psycopg.connect(migrated_postgres_url) as connection:
        state = connection.execute(
            "SELECT state_version FROM fsrs_states WHERE review_item_id = %s",
            (api_seed.review_item_id,),
        ).fetchone()
        review_count = connection.execute(
            "SELECT count(*) FROM review_events WHERE review_item_id = %s",
            (api_seed.review_item_id,),
        ).fetchone()
        learning_count = connection.execute(
            "SELECT count(*) FROM learning_events WHERE concept_id = %s",
            (api_seed.concept_id,),
        ).fetchone()
    assert state == (1,)
    assert review_count == (0,)
    assert learning_count == (0,)
    assert _answer(api_client, api_seed.review_item_id).status_code == 200


def test_full_database_rebuild_matches_incremental_projection_from_learning_events(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "DELETE FROM user_concept_states WHERE user_id = %s AND concept_id = %s",
            (api_seed.actor.id, api_seed.concept_id),
        )
        connection.execute(
            "DELETE FROM user_skill_states WHERE user_id = %s",
            (api_seed.actor.id,),
        )
        connection.commit()
    assert _answer(api_client, api_seed.review_item_id, rating="good").status_code == 200
    api_clock.current += timedelta(minutes=1)
    assert _answer(api_client, api_seed.review_item_id, rating="again").status_code == 200

    exposure_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            """
            INSERT INTO exposure_events
                (id, user_id, user_language_id, language_code, exposure_type,
                 concept_id, idempotency_key, occurred_at)
            VALUES (%s, %s, %s, 'en', 'read', %s, %s, %s)
            """,
            (
                exposure_id,
                api_seed.actor.id,
                api_seed.language_profile_id,
                api_seed.concept_id,
                str(uuid.uuid4()),
                api_clock.now() - timedelta(days=3),
            ),
        )
        engine = CompetenceEngine()
        engine.apply_passive_exposure(
            connection,
            actor=api_seed.actor,
            exposure_event_id=exposure_id,
            ingested_at=api_clock.now(),
        )
        connection.commit()

        concept_before = connection.execute(
            """
            SELECT status, recognition, listening, production, mastery, confidence,
                   exposure_count, recognition_positive_mass, recognition_negative_mass,
                   recognition_evidence_count, listening_positive_mass,
                   listening_negative_mass, listening_evidence_count,
                   production_positive_mass, production_negative_mass,
                   production_evidence_count, recent_competence_outcomes,
                   highest_achievement_status, competence_parameter_version
            FROM user_concept_states WHERE user_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
        skills_before = connection.execute(
            """
            SELECT skill, score, confidence, evidence_count, positive_mass, negative_mass,
                   competence_parameter_version
            FROM user_skill_states WHERE user_id = %s ORDER BY skill
            """,
            (api_seed.actor.id,),
        ).fetchall()
        engine.rebuild_profile(
            connection,
            actor=api_seed.actor,
            user_language_id=api_seed.language_profile_id,
            rebuilt_at=api_clock.now() + timedelta(minutes=1),
        )
        connection.commit()
        concept_after = connection.execute(
            """
            SELECT status, recognition, listening, production, mastery, confidence,
                   exposure_count, recognition_positive_mass, recognition_negative_mass,
                   recognition_evidence_count, listening_positive_mass,
                   listening_negative_mass, listening_evidence_count,
                   production_positive_mass, production_negative_mass,
                   production_evidence_count, recent_competence_outcomes,
                   highest_achievement_status, competence_parameter_version
            FROM user_concept_states WHERE user_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
        skills_after = connection.execute(
            """
            SELECT skill, score, confidence, evidence_count, positive_mass, negative_mass,
                   competence_parameter_version
            FROM user_skill_states WHERE user_id = %s ORDER BY skill
            """,
            (api_seed.actor.id,),
        ).fetchall()

    assert concept_after == concept_before
    assert skills_after == skills_before


def test_concurrent_cross_lineage_same_key_maps_loser_to_api_conflict(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    second_item_id = _seed_second_review_for_actor(migrated_postgres_url, api_seed, api_clock)
    shared_key = uuid.uuid4()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda item_id: _answer(api_client, item_id, key=shared_key),
                (api_seed.review_item_id, second_item_id),
            )
        )

    assert sorted(response.status_code for response in responses) == [200, 409]
    conflict = next(response for response in responses if response.status_code == 409)
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
    assert "unique" not in conflict.text.lower()


def test_concurrent_same_concept_distinct_evidence_has_no_lost_projection_update(
    api_client: TestClient, api_seed: ApiSeed, migrated_postgres_url: str
) -> None:
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(
            "DELETE FROM user_concept_states WHERE user_id = %s AND concept_id = %s",
            (api_seed.actor.id, api_seed.concept_id),
        )
        connection.execute(
            "DELETE FROM user_skill_states WHERE user_id = %s",
            (api_seed.actor.id,),
        )
        connection.commit()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda rating: _answer(
                    api_client, api_seed.review_item_id, rating=rating, key=uuid.uuid4()
                ),
                ("easy", "again"),
            )
        )

    assert [response.status_code for response in responses] == [200, 200]
    with psycopg.connect(migrated_postgres_url) as connection:
        concept = connection.execute(
            """
            SELECT production_evidence_count, production_positive_mass,
                   production_negative_mass
            FROM user_concept_states WHERE user_id = %s AND concept_id = %s
            """,
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
        events = connection.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s AND concept_id = %s",
            (api_seed.actor.id, api_seed.concept_id),
        ).fetchone()
    assert concept == (2, 0.5, 0.5)
    assert events == (2,)


def test_queue_cursor_is_opaque_keyset_state_and_rejects_tampering(
    api_client: TestClient,
    api_seed: ApiSeed,
    migrated_postgres_url: str,
    api_clock: MutableApiClock,
) -> None:
    _seed_second_review_for_actor(migrated_postgres_url, api_seed, api_clock)
    first_page = api_client.get("/v1/review/queue", params={"limit": 1}, headers=_auth())
    assert first_page.status_code == 200
    cursor = first_page.json()["meta"]["nextCursor"]
    assert isinstance(cursor, str)
    assert first_page.json()["meta"]["hasMore"] is True
    assert "offset" not in first_page.text
    second_page = api_client.get(
        "/v1/review/queue", params={"limit": 1, "cursor": cursor}, headers=_auth()
    )
    assert second_page.status_code == 200
    first_ids = {item["reviewItemId"] for item in first_page.json()["data"]}
    second_ids = {item["reviewItemId"] for item in second_page.json()["data"]}
    assert first_ids.isdisjoint(second_ids)
    tampered = api_client.get(
        "/v1/review/queue",
        params={"cursor": cursor[:-1] + ("A" if cursor[-1] != "A" else "B")},
        headers=_auth(),
    )
    assert tampered.status_code == 422


def test_fastapi_publishes_authoritative_review_operations(
    api_client: TestClient,
) -> None:
    with open("contracts/openapi.yaml", encoding="utf-8") as source:
        authoritative = yaml.safe_load(source)
    generated = cast(FastAPI, api_client.app).openapi()

    assert {
        "/v1/review/queue",
        "/v1/review/{reviewItemId}/answer",
    } <= set(generated["paths"])
    for path, method in (
        ("/v1/review/queue", "get"),
        ("/v1/review/{reviewItemId}/answer", "post"),
    ):
        actual = generated["paths"][path][method]
        expected = authoritative["paths"][path][method]
        assert actual["operationId"] == expected["operationId"]
        assert set(actual["responses"]) == set(expected["responses"])
        assert actual["security"] == [{"bearerAuth": []}]
    request_schema = generated["components"]["schemas"]["ReviewAnswerRequestDto"]
    assert set(request_schema["required"]) == {"rating", "responseTimeMs"}
    for optional_name in ("correct", "responseText", "selectedOptionId"):
        assert "null" not in str(request_schema["properties"][optional_name])
    concept_schema = generated["components"]["schemas"]["ConceptSummaryDto"]
    assert "partOfSpeech" not in concept_schema["required"]
    part_of_speech_variants = concept_schema["properties"]["partOfSpeech"]["anyOf"]
    assert any(variant.get("type") == "null" for variant in part_of_speech_variants)
    assert (
        next(variant for variant in part_of_speech_variants if variant.get("type") == "string")[
            "maxLength"
        ]
        == 64
    )
    queue_parameters = generated["paths"]["/v1/review/queue"]["get"]["parameters"]
    assert {parameter["name"] for parameter in queue_parameters} == {
        "cursor",
        "limit",
        "languageProfileId",
    }
    assert all("null" not in str(parameter["schema"]) for parameter in queue_parameters)


def test_health_remains_outside_product_openapi(api_client: TestClient) -> None:
    assert api_client.get("/health").status_code == 200
    assert "/health" not in cast(FastAPI, api_client.app).openapi()["paths"]
