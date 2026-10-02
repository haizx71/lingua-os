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
BRIDGE_OWNER: Final = uuid.UUID("33000000-0000-4000-8000-000000000101")
BRIDGE_SECONDARY: Final = uuid.UUID("33000000-0000-4000-8000-000000000102")
BRIDGE_RELATED: Final = uuid.UUID("33000000-0000-4000-8000-000000000103")
BRIDGE_UNAPPROVED: Final = uuid.UUID("33000000-0000-4000-8000-000000000104")
BRIDGE_LEGACY: Final = uuid.UUID("33000000-0000-4000-8000-000000000105")
BRIDGE_EMPTY: Final = uuid.UUID("33000000-0000-4000-8000-000000000106")
BRIDGE_CROSS_LANGUAGE: Final = uuid.UUID("33000000-0000-4000-8000-000000000107")
BRIDGE_FOREIGN_OWNER: Final = uuid.UUID("33000000-0000-4000-8000-000000000108")


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


def _seed_bridge_catalog(database_url: str) -> None:
    with psycopg.connect(database_url) as connection:
        connection.execute(
            """
            INSERT INTO concepts
                (id, language_code, concept_type, canonical_key, source_record_id)
            VALUES
                (%s, 'en', 'word', 'bridge-owner', '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'bridge-secondary', '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'bridge-related', '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'bridge-unapproved', '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'bridge-legacy', '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'bridge-empty', '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'bridge-cross-language', '21000000-0000-4000-8000-000000000001'),
                (%s, 'vi', 'word', 'foreign-owner', '21000000-0000-4000-8000-000000000001')
            """,
            (
                BRIDGE_OWNER,
                BRIDGE_SECONDARY,
                BRIDGE_RELATED,
                BRIDGE_UNAPPROVED,
                BRIDGE_LEGACY,
                BRIDGE_EMPTY,
                BRIDGE_CROSS_LANGUAGE,
                BRIDGE_FOREIGN_OWNER,
            ),
        )
        connection.execute(
            """
            INSERT INTO lexemes
                (id, concept_id, language_code, lemma, normalized_form,
                 part_of_speech, source_record_id)
            VALUES
                (%s, %s, 'en', 'go', 'go', 'verb',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'go back', 'go back', 'verb',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'unapproved go', 'k209blocked', 'verb',
                 '21000000-0000-4000-8000-000000000003'),
                ('34000000-0000-4000-8000-000000000104', %s, 'en', 'legacy go', 'legacygo', 'verb',
                 '21000000-0000-4000-8000-000000000001'),
                ('34000000-0000-4000-8000-000000000105', %s, 'en', 'emptyword', 'emptyword', NULL,
                 '21000000-0000-4000-8000-000000000001'),
                ('34000000-0000-4000-8000-000000000106', %s, 'vi', 'a foreign lemma',
                 'a-foreign', 'noun',
                 '21000000-0000-4000-8000-000000000001')
            """,
            (
                uuid.UUID("34000000-0000-4000-8000-000000000101"),
                BRIDGE_OWNER,
                uuid.UUID("34000000-0000-4000-8000-000000000102"),
                BRIDGE_OWNER,
                uuid.UUID("34000000-0000-4000-8000-000000000103"),
                BRIDGE_UNAPPROVED,
                BRIDGE_LEGACY,
                BRIDGE_EMPTY,
                BRIDGE_FOREIGN_OWNER,
            ),
        )
        connection.execute(
            """
            INSERT INTO lexeme_forms
                (id, lexeme_id, form, normalized_form, form_type, source_record_id)
            VALUES
                ('35000000-0000-4000-8000-000000000101',
                 '34000000-0000-4000-8000-000000000101', 'going', 'going', 'present_participle',
                 '21000000-0000-4000-8000-000000000001'),
                ('35000000-0000-4000-8000-000000000102',
                 '34000000-0000-4000-8000-000000000101', 'went', 'went', 'past',
                 '21000000-0000-4000-8000-000000000001')
            """
        )
        connection.execute(
            """
            INSERT INTO word_senses
                (id, lexeme_id, sense_order, definition, definition_language_code,
                 translated_definition, translation_language_code, source_record_id)
            VALUES
                ('36000000-0000-4000-8000-000000000101',
                 '34000000-0000-4000-8000-000000000101', 1,
                 'Move from one place to another.', 'en', 'Đi từ nơi này đến nơi khác.', 'vi',
                 '21000000-0000-4000-8000-000000000001'),
                ('36000000-0000-4000-8000-000000000102',
                 '34000000-0000-4000-8000-000000000101', 2,
                 'Leave a place.', 'en', NULL, NULL,
                 '21000000-0000-4000-8000-000000000001'),
                ('36000000-0000-4000-8000-000000000103',
                 '34000000-0000-4000-8000-000000000102', 1,
                 'Return to a place.', 'en', 'Quay lại một nơi.', 'vi',
                 '21000000-0000-4000-8000-000000000001'),
                ('36000000-0000-4000-8000-000000000104',
                 '34000000-0000-4000-8000-000000000103', 1,
                 'A blocked definition.', 'en', 'Nghĩa bị chặn.', 'vi',
                 '21000000-0000-4000-8000-000000000003'),
                ('36000000-0000-4000-8000-000000000105',
                 '34000000-0000-4000-8000-000000000104', 1,
                 'A legacy direct sense.', 'en', 'Một nghĩa trực tiếp cũ.', 'vi',
                 '21000000-0000-4000-8000-000000000001'),
                ('36000000-0000-4000-8000-000000000106',
                 '34000000-0000-4000-8000-000000000106', 1,
                 'Vietnamese-only foreign definition.', 'vi', 'Vietnamese gloss.', 'en',
                 '21000000-0000-4000-8000-000000000001')
            """
        )
        connection.execute(
            """
            INSERT INTO concept_senses (concept_id, word_sense_id, is_primary)
            VALUES
                (%s, '36000000-0000-4000-8000-000000000101', true),
                (%s, '36000000-0000-4000-8000-000000000101', false),
                (%s, '36000000-0000-4000-8000-000000000102', false),
                (%s, '36000000-0000-4000-8000-000000000102', false),
                (%s, '36000000-0000-4000-8000-000000000103', true),
                (%s, '36000000-0000-4000-8000-000000000104', false),
                (%s, '36000000-0000-4000-8000-000000000103', false),
                (%s, '36000000-0000-4000-8000-000000000106', false)
            """,
            (
                BRIDGE_OWNER,
                BRIDGE_SECONDARY,
                BRIDGE_OWNER,
                BRIDGE_RELATED,
                BRIDGE_OWNER,
                BRIDGE_UNAPPROVED,
                BRIDGE_CROSS_LANGUAGE,
                BRIDGE_CROSS_LANGUAGE,
            ),
        )
        connection.execute(
            """
            INSERT INTO concept_relations
                (source_concept_id, target_concept_id, language_code,
                 relation_type, weight, source_record_id)
            VALUES (%s, %s, 'en', 'related', 0.5,
                    '21000000-0000-4000-8000-000000000001')
            """,
            (BRIDGE_OWNER, BRIDGE_CROSS_LANGUAGE),
        )
        connection.commit()


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
    assert response.headers["cache-control"] == "private, no-store"
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

    other_actor, _ = _create_actor(dictionary_api.database_url)
    other_response = _client(dictionary_api.database_url, other_actor).get(
        f"/v1/concepts/{WORD_ONE}", headers=_headers()
    )
    assert other_response.status_code == 200
    assert other_response.headers["cache-control"] == "private, no-store"
    assert other_response.json()["data"]["learner"]["status"] == "unseen"


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
    assert set(first.json()) == {"data", "meta"}


def test_bridge_search_returns_complete_groups_and_actor_scoped_badges(
    dictionary_api: DictionaryApiSeed,
) -> None:
    _seed_bridge_catalog(dictionary_api.database_url)
    with psycopg.connect(dictionary_api.database_url) as connection:
        connection.execute(
            """
            WITH parameter AS (
                SELECT id, version FROM competence_parameter_sets WHERE is_default
            )
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, language_code, status,
                 recognition, listening, production, mastery, confidence, exposure_count,
                 state_version, projection_method_version, has_projectable_evidence,
                 highest_achievement_status, competence_parameter_set_id,
                 competence_parameter_version)
            SELECT %s, %s, %s, 'en', 'familiar', 0.7, 0.6, 0.5, 0.61, 0.5, 3,
                   1, 'competence-beta-v1', true, 'familiar', parameter.id, parameter.version
            FROM parameter
            """,
            (dictionary_api.actor.id, dictionary_api.profile_id, BRIDGE_OWNER),
        )
        connection.execute(
            """
            INSERT INTO user_saved_concepts (user_id, user_language_id, concept_id, language_code)
            VALUES (%s, %s, %s, 'en')
            """,
            (dictionary_api.actor.id, dictionary_api.profile_id, BRIDGE_SECONDARY),
        )
        connection.commit()

    first = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "go", "limit": 1, "includeLemmaGroups": "true"},
        headers=_headers(),
    )
    assert first.status_code == 200
    assert first.headers["cache-control"] == "private, no-store"
    body = first.json()
    _assert_contract_schema("DictionarySearchResponse", body)
    assert [item["id"] for item in body["data"]] == [str(BRIDGE_OWNER)]
    assert len(body["lemmaGroups"]) == 2
    groups = {group["lexemeId"]: group for group in body["lemmaGroups"]}
    first_lexeme = groups["34000000-0000-4000-8000-000000000101"]
    second_lexeme = groups["34000000-0000-4000-8000-000000000102"]
    assert first_lexeme["lemma"] == "go"
    assert first_lexeme["matchedForms"] == ["go", "going"]
    assert [sense["senseOrder"] for sense in first_lexeme["senses"]] == [1, 2]
    assert "translatedDefinition" not in first_lexeme["senses"][1]
    assert "translationLanguageCode" not in first_lexeme["senses"][1]
    assert [item["concept"]["id"] for item in first_lexeme["senses"][0]["concepts"]] == [
        str(BRIDGE_OWNER),
        str(BRIDGE_SECONDARY),
    ]
    secondary = first_lexeme["senses"][0]["concepts"][1]
    assert secondary["isSaved"] is True
    assert secondary["concept"]["status"] == "unseen"
    assert second_lexeme["senses"][0]["concepts"][0]["concept"]["status"] == "familiar"
    assert second_lexeme["senses"][0]["concepts"][0]["mastery"] == 0.61

    second = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={
            "query": "go",
            "limit": 1,
            "cursor": body["meta"]["nextCursor"],
            "includeLemmaGroups": "false",
        },
        headers=_headers(),
    )
    assert second.status_code == 200
    assert second.json()["data"][0]["id"] == str(BRIDGE_SECONDARY)
    assert "lemmaGroups" not in second.json()

    third = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={
            "query": "go",
            "limit": 1,
            "cursor": second.json()["meta"]["nextCursor"],
            "includeLemmaGroups": "true",
        },
        headers=_headers(),
    )
    assert third.status_code == 200
    assert third.json()["data"][0]["id"] == str(BRIDGE_RELATED)
    assert third.json()["lemmaGroups"] == [first_lexeme]

    other_actor, _ = _create_actor(dictionary_api.database_url)
    other = _client(dictionary_api.database_url, other_actor).get(
        "/v1/dictionary/search",
        params={"query": "go", "limit": 1, "includeLemmaGroups": "true"},
        headers=_headers(),
    )
    assert other.status_code == 200
    assert other.headers["cache-control"] == "private, no-store"
    other_concepts = [
        linked
        for group in other.json()["lemmaGroups"]
        for sense in group["senses"]
        for linked in sense["concepts"]
    ]
    assert all(linked["isSaved"] is False for linked in other_concepts)
    assert (
        next(
            linked["concept"]["status"]
            for linked in other_concepts
            if linked["concept"]["id"] == str(BRIDGE_OWNER)
        )
        == "unseen"
    )


def test_bridge_detail_uses_only_approved_own_senses_and_legacy_fallback(
    dictionary_api: DictionaryApiSeed,
) -> None:
    _seed_bridge_catalog(dictionary_api.database_url)

    detail = dictionary_api.client.get(f"/v1/concepts/{BRIDGE_SECONDARY}", headers=_headers())
    assert detail.status_code == 200
    assert detail.json()["data"]["canonicalForm"] == "go"
    assert [item["definition"] for item in detail.json()["data"]["definitions"]] == [
        "Move from one place to another."
    ]

    legacy = dictionary_api.client.get(f"/v1/concepts/{BRIDGE_LEGACY}", headers=_headers())
    assert legacy.status_code == 200
    assert legacy.json()["data"]["canonicalForm"] == "legacy go"
    assert [item["definition"] for item in legacy.json()["data"]["definitions"]] == [
        "A legacy direct sense."
    ]
    legacy_search = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "legacygo", "includeLemmaGroups": "true"},
        headers=_headers(),
    )
    assert legacy_search.status_code == 200
    assert legacy_search.json()["data"][0]["id"] == str(BRIDGE_LEGACY)
    assert legacy_search.json()["lemmaGroups"][0]["senses"][0]["concepts"][0]["concept"][
        "id"
    ] == str(BRIDGE_LEGACY)

    empty_search = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "emptyword", "includeLemmaGroups": "true"},
        headers=_headers(),
    )
    assert empty_search.status_code == 200
    assert empty_search.json()["data"][0]["id"] == str(BRIDGE_EMPTY)
    assert empty_search.json()["lemmaGroups"][0]["senses"] == []
    assert "partOfSpeech" not in empty_search.json()["lemmaGroups"][0]

    blocked = dictionary_api.client.get(f"/v1/concepts/{BRIDGE_UNAPPROVED}", headers=_headers())
    assert blocked.status_code == 200
    assert blocked.json()["data"]["canonicalForm"] == "bridge-unapproved"
    assert blocked.json()["data"]["definitions"] == []
    hidden_search = dictionary_api.client.get(
        "/v1/dictionary/search", params={"query": "k209blocked"}, headers=_headers()
    )
    assert hidden_search.status_code == 200
    assert hidden_search.json()["data"] == []


def test_cross_language_sense_links_do_not_change_english_lexical_identity(
    dictionary_api: DictionaryApiSeed,
) -> None:
    _seed_bridge_catalog(dictionary_api.database_url)

    detail = dictionary_api.client.get(f"/v1/concepts/{BRIDGE_CROSS_LANGUAGE}", headers=_headers())
    assert detail.status_code == 200
    assert detail.json()["data"]["canonicalForm"] == "go back"
    assert [item["definition"] for item in detail.json()["data"]["definitions"]] == [
        "Return to a place."
    ]

    search = dictionary_api.client.get(
        "/v1/dictionary/search", params={"query": "go", "limit": 100}, headers=_headers()
    )
    assert search.status_code == 200
    cross_language = next(
        item for item in search.json()["data"] if item["id"] == str(BRIDGE_CROSS_LANGUAGE)
    )
    assert cross_language["canonicalForm"] == "go back"

    owner_detail = dictionary_api.client.get(f"/v1/concepts/{BRIDGE_OWNER}", headers=_headers())
    assert owner_detail.status_code == 200
    relation = next(
        item
        for item in owner_detail.json()["data"]["relations"]
        if item["conceptId"] == str(BRIDGE_CROSS_LANGUAGE)
    )
    assert relation["canonicalForm"] == "go back"


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
    _seed_bridge_catalog(dictionary_api.database_url)
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
        "lexemes",
        "lexeme_forms",
        "word_senses",
        "concept_senses",
    )

    def snapshot() -> tuple[tuple[str, ...], ...]:
        with psycopg.connect(dictionary_api.database_url) as connection:
            values: list[tuple[str, ...]] = []
            for table in tables:
                rows = connection.execute(
                    f"SELECT to_jsonb(row)::text FROM {table} AS row ORDER BY to_jsonb(row)::text"
                ).fetchall()
                values.append(tuple(str(row[0]) for row in rows))
            return tuple(values)

    before = snapshot()
    detail = dictionary_api.client.get(f"/v1/concepts/{WORD_ONE}", headers=_headers())
    grouped = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "go", "includeLemmaGroups": "true"},
        headers=_headers(),
    )
    inflected = dictionary_api.client.get(
        "/v1/dictionary/search",
        params={"query": "went", "includeLemmaGroups": "true"},
        headers=_headers(),
    )
    analyze = dictionary_api.client.post(
        "/v1/reader/analyze",
        json={
            "text": "word01 make an appointment unknown",
            "targetLanguageCode": "en",
            "translationLanguageCode": "vi",
        },
        headers=_headers(),
    )

    assert (
        detail.status_code
        == grouped.status_code
        == inflected.status_code
        == analyze.status_code
        == 200
    )
    assert grouped.json()["lemmaGroups"]
    inflected_group = next(
        item
        for item in inflected.json()["lemmaGroups"]
        if item["lexemeId"] == "34000000-0000-4000-8000-000000000101"
    )
    assert inflected_group["lemma"] == "go"
    assert inflected_group["matchedForms"] == ["went"]
    assert [sense["senseOrder"] for sense in inflected_group["senses"]] == [1, 2]
    assert [linked["concept"]["id"] for linked in inflected_group["senses"][0]["concepts"]] == [
        str(BRIDGE_OWNER),
        str(BRIDGE_SECONDARY),
    ]
    assert snapshot() == before
