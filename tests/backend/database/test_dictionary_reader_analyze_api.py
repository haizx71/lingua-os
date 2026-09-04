from __future__ import annotations

import uuid
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, cast

import psycopg
import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
TASK_SEED = ROOT / "database" / "seeds" / "task008a_dictionary_reader_analyze.sql"
NOW: Final = datetime(2026, 9, 2, 4, 0, tzinfo=UTC)
WORD_ONE: Final = uuid.UUID("30000000-0000-4000-8000-000000000001")
PHRASE: Final = uuid.UUID("33000000-0000-4000-8000-000000000001")
GRAMMAR: Final = uuid.UUID("33000000-0000-4000-8000-000000000007")
SKILL: Final = uuid.UUID("33000000-0000-4000-8000-000000000008")
TIE_LOW: Final = uuid.UUID("33000000-0000-4000-8000-000000000009")
HIDDEN: Final = uuid.UUID("33000000-0000-4000-8000-000000000011")
RESTRICTED: Final = uuid.UUID("33000000-0000-4000-8000-000000000012")


@dataclass(frozen=True)
class FixedClock:
    def now(self) -> datetime:
        return NOW


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "valid-token":
            raise AssertionError("unexpected token")
        return self.actor


@dataclass(frozen=True)
class DictionaryApiSeed:
    actor: AuthenticatedActor
    profile_id: uuid.UUID
    client: TestClient
    database_url: str


def _create_actor(database_url: str) -> tuple[AuthenticatedActor, uuid.UUID]:
    actor = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (actor.id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor.id,),
        )
        row = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (actor.id,),
        ).fetchone()
        assert row is not None
        connection.commit()
    return actor, uuid.UUID(str(row[0]))


def _client(database_url: str, actor: AuthenticatedActor) -> TestClient:
    return TestClient(
        create_app(
            database_url=database_url,
            token_verifier=StubTokenVerifier(actor),
            clock=FixedClock(),
            cursor_secret=b"task008a-dictionary-cursor-secret-32bytes",
        )
    )


@pytest.fixture
def dictionary_api(isolated_migrated_postgres_url: str) -> DictionaryApiSeed:
    migrated_postgres_url = isolated_migrated_postgres_url
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        connection.execute(TASK_SEED.read_text(encoding="utf-8"))
        connection.commit()
    actor, profile_id = _create_actor(migrated_postgres_url)
    with psycopg.connect(migrated_postgres_url) as connection:
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
            SELECT %s, %s, candidate.concept_id, 'en', candidate.status,
                   0.7, 0.6, 0.5, 0.61, 0.5, 3,
                   3.6, 0.4, 0.5, 4, 2.4, 1.6, 0.4, 4, 1.2, 2.8, 0.3, 4,
                   true, candidate.status, 1, 'competence-beta-v1',
                   parameter.id, parameter.version
            FROM parameter
            CROSS JOIN (VALUES
                (%s::uuid, 'familiar'),
                (%s::uuid, 'active')
            ) AS candidate(concept_id, status)
            """,
            (actor.id, profile_id, WORD_ONE, PHRASE),
        )
        connection.commit()
    return DictionaryApiSeed(
        actor, profile_id, _client(migrated_postgres_url, actor), migrated_postgres_url
    )


def _headers() -> dict[str, str]:
    return {"Authorization": "Bearer valid-token"}


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

    schema = resolve(deepcopy(contract["components"]["schemas"][schema_name]))
    Draft202012Validator(cast(dict[str, object], schema), format_checker=FormatChecker()).validate(
        payload
    )


def test_dictionary_detail_returns_approved_catalog_and_owned_projection(
    dictionary_api: DictionaryApiSeed,
) -> None:
    response = dictionary_api.client.get(f"/v1/concepts/{WORD_ONE}", headers=_headers())

    assert response.status_code == 200
    body = response.json()
    _assert_contract_schema("ConceptResponse", body)
    assert body["data"]["canonicalForm"] == "word01"
    assert body["data"]["partOfSpeech"] == "noun"
    assert body["data"]["learner"]["status"] == "familiar"
    assert body["data"]["learner"]["competence"]["recognition"]["score"] == 0.7
    assert body["data"]["definitions"][0]["translation"].startswith("Định nghĩa")
    assert body["data"]["examples"]
    assert body["data"]["attribution"]["licenseCode"] == "LINGUA-FIXTURE"
    assert {"mastery", "confidence", "positiveMass", "difficulty"}.isdisjoint(
        body["data"]["learner"]
    )


def test_nonlexical_concepts_have_no_fabricated_pos(dictionary_api: DictionaryApiSeed) -> None:
    for concept_id in (GRAMMAR, SKILL):
        response = dictionary_api.client.get(f"/v1/concepts/{concept_id}", headers=_headers())
        assert response.status_code == 200
        assert "partOfSpeech" not in response.json()["data"]
        assert response.json()["data"]["learner"]["status"] == "unseen"


def test_unapproved_and_restricted_concepts_are_resource_hidden(
    dictionary_api: DictionaryApiSeed,
) -> None:
    for concept_id in (HIDDEN, RESTRICTED):
        response = dictionary_api.client.get(f"/v1/concepts/{concept_id}", headers=_headers())
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    for query in ("hiddenword", "restrictedword"):
        response = dictionary_api.client.get(
            "/v1/dictionary/search", params={"query": query}, headers=_headers()
        )
        assert response.status_code == 200
        assert response.json()["data"] == []


def test_dictionary_search_is_stable_cursor_paginated_and_literal(
    dictionary_api: DictionaryApiSeed,
) -> None:
    first = dictionary_api.client.get(
        "/v1/dictionary/search", params={"query": " WORD ", "limit": 2}, headers=_headers()
    )
    repeated = dictionary_api.client.get(
        "/v1/dictionary/search", params={"query": " WORD ", "limit": 2}, headers=_headers()
    )
    assert first.status_code == repeated.status_code == 200
    assert first.json()["data"] == repeated.json()["data"]
    assert [item["canonicalForm"] for item in first.json()["data"]] == ["word01", "word02"]
    assert first.json()["meta"]["hasMore"] is True

    second = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "word", "limit": 2, "cursor": first.json()["meta"]["nextCursor"]},
        headers=_headers(),
    )
    assert [item["canonicalForm"] for item in second.json()["data"]] == ["word03", "word04"]

    literal = dictionary_api.client.get(
        "/v1/dictionary/search", params={"query": "%_"}, headers=_headers()
    )
    assert literal.status_code == 200
    assert literal.json()["data"] == []


def test_dictionary_cursor_rejects_tampering_and_another_actor(
    dictionary_api: DictionaryApiSeed,
) -> None:
    page = dictionary_api.client.get(
        "/v1/dictionary/search", params={"query": "word", "limit": 1}, headers=_headers()
    ).json()
    cursor = page["meta"]["nextCursor"]
    replacement = "A" if cursor[-1] != "A" else "B"
    tampered = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "word", "cursor": cursor[:-1] + replacement},
        headers=_headers(),
    )
    assert tampered.status_code == 422

    foreign_actor, _ = _create_actor(dictionary_api.database_url)
    foreign = _client(dictionary_api.database_url, foreign_actor).get(
        "/v1/dictionary/search",
        params={"query": "word", "cursor": cursor},
        headers=_headers(),
    )
    assert foreign.status_code == 422


def test_reader_analyze_uses_leftmost_longest_and_owned_status(
    dictionary_api: DictionaryApiSeed,
) -> None:
    response = dictionary_api.client.post(
        "/v1/reader/analyze",
        json={
            "text": "Make an appointment, then make an appointment.",
            "targetLanguageCode": "en",
            "translationLanguageCode": "vi",
        },
        headers=_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    _assert_contract_schema("ReaderAnalyzeResponse", body)
    annotations = body["data"]["segments"][0]["sentences"][0]["concepts"]
    assert [
        (item["conceptId"], item["startOffset"], item["endOffset"]) for item in annotations
    ] == [
        (str(PHRASE), 0, 19),
        (str(PHRASE), 26, 45),
    ]
    assert all(item["status"] == "active" for item in annotations)


def test_reader_analyze_handles_alias_ties_unicode_boundaries_and_unknowns(
    dictionary_api: DictionaryApiSeed,
) -> None:
    response = dictionary_api.client.post(
        "/v1/reader/analyze",
        json={
            "text": "🙂 TERM preappointment flibbertigibbet.",
            "targetLanguageCode": "en",
            "translationLanguageCode": "vi",
        },
        headers=_headers(),
    )

    assert response.status_code == 200
    annotations = response.json()["data"]["segments"][0]["sentences"][0]["concepts"]
    assert annotations == [
        {
            "conceptId": str(TIE_LOW),
            "canonicalForm": "tie low",
            "startOffset": 3,
            "endOffset": 7,
            "status": "unseen",
        }
    ]


def test_reader_analyze_is_deterministic_where_metadata_permits(
    dictionary_api: DictionaryApiSeed,
) -> None:
    request = {
        "title": "Temporary",
        "text": "New York City. Unknown.",
        "targetLanguageCode": "en",
        "translationLanguageCode": "vi",
    }
    first = dictionary_api.client.post("/v1/reader/analyze", json=request, headers=_headers())
    second = dictionary_api.client.post("/v1/reader/analyze", json=request, headers=_headers())

    assert first.status_code == second.status_code == 200
    assert first.json()["data"] == second.json()["data"]


def test_reader_analyze_validates_auth_language_and_input_bounds(
    dictionary_api: DictionaryApiSeed,
) -> None:
    valid = {
        "text": "word01",
        "targetLanguageCode": "en",
        "translationLanguageCode": "vi",
    }
    assert dictionary_api.client.post("/v1/reader/analyze", json=valid).status_code == 401
    assert (
        dictionary_api.client.post(
            "/v1/reader/analyze", json={**valid, "text": "x" * 20_001}, headers=_headers()
        ).status_code
        == 422
    )
    assert (
        dictionary_api.client.post(
            "/v1/reader/analyze",
            json={**valid, "targetLanguageCode": "vi"},
            headers=_headers(),
        ).status_code
        == 422
    )


def test_dictionary_and_analyze_are_side_effect_free(dictionary_api: DictionaryApiSeed) -> None:
    tables = (
        "learning_events",
        "user_concept_states",
        "user_skill_states",
        "review_items",
        "fsrs_states",
        "user_saved_concepts",
        "user_saved_content",
        "user_saved_sentences",
        "user_content_progress",
        "today_plans",
        "content_items",
        "sentences",
        "concepts",
    )

    def counts() -> tuple[int, ...]:
        with psycopg.connect(dictionary_api.database_url) as connection:
            values: list[int] = []
            for table in tables:
                row = connection.execute(f"SELECT count(*) FROM {table}").fetchone()
                assert row is not None
                values.append(cast(int, row[0]))
            return tuple(values)

    before = counts()
    detail = dictionary_api.client.get(f"/v1/concepts/{WORD_ONE}", headers=_headers())
    analyze = dictionary_api.client.post(
        "/v1/reader/analyze",
        json={
            "text": "word01 make an appointment unknown",
            "targetLanguageCode": "en",
            "translationLanguageCode": "vi",
        },
        headers=_headers(),
    )

    assert detail.status_code == analyze.status_code == 200
    assert counts() == before
