from __future__ import annotations

import uuid
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import psycopg
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.auth import AccessTokenInvalid
from lingua_api.brain.store import PostgresBrainStore
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
WORD_ONE = uuid.UUID("30000000-0000-4000-8000-000000000001")
WORD_TWO = uuid.UUID("30000000-0000-4000-8000-000000000002")
WORD_THREE = uuid.UUID("30000000-0000-4000-8000-000000000003")
WORD_FOUR = uuid.UUID("30000000-0000-4000-8000-000000000004")
WORD_FIVE = uuid.UUID("30000000-0000-4000-8000-000000000005")
WORD_SIX = uuid.UUID("30000000-0000-4000-8000-000000000006")
GRAMMAR = uuid.UUID("33000000-0000-4000-8000-000000000001")
SKILL = uuid.UUID("33000000-0000-4000-8000-000000000002")
RESTRICTED = uuid.UUID("33000000-0000-4000-8000-000000000003")
PHRASE = uuid.UUID("33000000-0000-4000-8000-000000000004")
COMPETENCE_PARAMETERS = uuid.UUID("00000000-0000-4000-8600-000000000002")


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "valid-token":
            raise AccessTokenInvalid("invalid bearer token")
        return self.actor


@dataclass(frozen=True)
class BrainApiSeed:
    actor: AuthenticatedActor
    projection_actor: AuthenticatedActor
    profile_id: uuid.UUID
    other_profile_id: uuid.UUID
    non_english_profile_id: uuid.UUID
    new_profile_id: uuid.UUID
    client: TestClient
    projection_client: TestClient
    new_client: TestClient
    application: FastAPI
    database_url: str


@pytest.fixture(scope="module")
def brain_api(migrated_postgres_url: str) -> BrainApiSeed:
    actor_id = uuid.uuid4()
    other_actor_id = uuid.uuid4()
    new_actor_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        connection.execute(
            """
            UPDATE word_senses AS sense
            SET translated_definition = NULL, translation_language_code = NULL
            FROM lexemes AS lexeme
            WHERE sense.lexeme_id = lexeme.id AND lexeme.concept_id = %s
            """,
            (WORD_SIX,),
        )
        connection.execute(
            "INSERT INTO auth.users (id) VALUES (%s), (%s), (%s)",
            (actor_id, other_actor_id, new_actor_id),
        )
        connection.execute(
            "INSERT INTO users (id) VALUES (%s), (%s), (%s)",
            (actor_id, other_actor_id, new_actor_id),
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
        other_profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (other_actor_id,),
        ).fetchone()
        assert profile is not None and other_profile is not None
        profile_id = uuid.UUID(str(profile[0]))
        other_profile_id = uuid.UUID(str(other_profile[0]))
        non_english_profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'vi', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        new_profile = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
            RETURNING id
            """,
            (new_actor_id,),
        ).fetchone()
        assert non_english_profile is not None and new_profile is not None
        non_english_profile_id = uuid.UUID(str(non_english_profile[0]))
        new_profile_id = uuid.UUID(str(new_profile[0]))

        connection.execute(
            """
            INSERT INTO concepts
                (id, language_code, concept_type, canonical_key, source_record_id)
            VALUES (%s, 'en', 'grammar', 'brain-present-perfect',
                    '21000000-0000-4000-8000-000000000001')
            ON CONFLICT (id) DO NOTHING
            """,
            (GRAMMAR,),
        )
        connection.execute(
            """
            INSERT INTO grammar_specifications
                (id, concept_id, pattern_formula, syntactic_category, pragmatic_function,
                 vietnamese_explanation, vietnamese_common_traps, structural_slots)
            VALUES
                ('33000000-0000-4000-8100-000000000001', %s,
                 'S + have/has + V3/ed', 'tense_aspect',
                 'Connect a past action to the present.',
                 'Dùng have/has với quá khứ phân từ để nối hành động quá khứ với hiện tại.',
                 'Không dùng mốc thời gian quá khứ đã kết thúc.',
                 '[{"label":"S","role":"subject","required":true,"examples":["I","she"]},'
                 ' {"label":"have/has + V3","role":"present_relevance","required":true,'
                 '  "examples":["have finished","has gone"]}]'::jsonb)
            ON CONFLICT (concept_id) DO NOTHING
            """,
            (GRAMMAR,),
        )
        connection.execute(
            """
            INSERT INTO concepts
                (id, language_code, concept_type, canonical_key, source_record_id)
            VALUES
                (%s, 'en', 'skill', 'brain-listening-for-detail',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, 'en', 'word', 'restricted-hidden',
                 '21000000-0000-4000-8000-000000000002'),
                (%s, 'en', 'phrase', 'word01',
                 '21000000-0000-4000-8000-000000000001')
            ON CONFLICT (id) DO NOTHING
            """,
            (SKILL, RESTRICTED, PHRASE),
        )
        connection.execute(
            """
            INSERT INTO concept_relations
                (source_concept_id, target_concept_id, language_code, relation_type,
                 source_record_id)
            VALUES (%s, %s, 'en', 'related',
                    '21000000-0000-4000-8000-000000000001')
            ON CONFLICT DO NOTHING
            """,
            (WORD_ONE, WORD_TWO),
        )
        connection.execute(
            """
            INSERT INTO concept_relations
                (source_concept_id, target_concept_id, language_code, relation_type,
                 source_record_id)
            VALUES
                (%s, %s, 'en', 'antonym',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'family',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'prerequisite',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'synonym',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'synonym',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'prerequisite',
                 '21000000-0000-4000-8000-000000000001'),
                (%s, %s, 'en', 'related',
                 '21000000-0000-4000-8000-000000000001')
            ON CONFLICT DO NOTHING
            """,
            (
                WORD_ONE,
                WORD_THREE,
                WORD_ONE,
                WORD_FOUR,
                WORD_ONE,
                WORD_FIVE,
                WORD_ONE,
                WORD_SIX,
                WORD_TWO,
                WORD_ONE,
                WORD_TWO,
                GRAMMAR,
                WORD_ONE,
                RESTRICTED,
            ),
        )

        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status,
                 recognition, listening, production, mastery, confidence,
                 exposure_count, last_seen_at, state_version,
                 recognition_confidence, recognition_evidence_count,
                 recognition_last_evidence_at,
                 listening_confidence, listening_evidence_count,
                 listening_last_evidence_at,
                 production_confidence, production_evidence_count,
                 production_last_evidence_at,
                 has_projectable_evidence, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version)
            VALUES (%s, %s, %s, 'active', 0.8, 0.7, 0.6, 0.71, 0.62,
                    7, '2026-08-30T03:00:00Z', 1,
                    0.7, 8, '2026-08-30T03:00:00Z',
                    0.6, 6, '2026-08-30T03:00:00Z',
                    0.5, 4, '2026-08-30T03:00:00Z', true,
                    'competence-beta-v1', %s, 'competence-beta-v1')
            """,
            (actor_id, profile_id, WORD_ONE, COMPETENCE_PARAMETERS),
        )
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, exposure_count,
                 last_seen_at, state_version, projection_method_version,
                 competence_parameter_set_id, competence_parameter_version)
            VALUES (%s, %s, %s, 'discovered', 3, '2026-08-30T03:00:00Z', 1,
                    'competence-beta-v1', %s, 'competence-beta-v1')
            """,
            (actor_id, profile_id, WORD_TWO, COMPETENCE_PARAMETERS),
        )
        connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status,
                 recognition, listening, production, mastery, confidence,
                 exposure_count, last_seen_at, state_version, projection_method_version)
            VALUES (%s, %s, %s, 'mastered', 0.99, 0.99, 0.99, 0.99, 0.99,
                    99, '2026-08-30T03:00:00Z', 1, 'legacy-v0')
            """,
            (actor_id, profile_id, WORD_SIX),
        )

        connection.execute(
            """
            INSERT INTO user_saved_concepts
                (user_id, user_language_id, concept_id)
            VALUES (%s, %s, %s)
            """,
            (actor_id, profile_id, WORD_THREE),
        )
        review_item = connection.execute(
            """
            INSERT INTO review_items
                (user_id, user_language_id, concept_id, status, created_from)
            VALUES (%s, %s, %s, 'active', 'learner_saved')
            RETURNING id
            """,
            (actor_id, profile_id, WORD_FOUR),
        ).fetchone()
        parameter = connection.execute(
            "SELECT id, version FROM fsrs_parameter_sets ORDER BY created_at LIMIT 1"
        ).fetchone()
        assert review_item is not None and parameter is not None
        connection.execute(
            """
            INSERT INTO fsrs_states
                (review_item_id, user_id, due_at, state, parameter_set_id, params_version)
            VALUES (%s, %s, '2026-08-30T00:00:00Z', 'new', %s, %s)
            """,
            (review_item[0], actor_id, parameter[0], parameter[1]),
        )

        for skill, score, confidence, count in (
            ("recognition", 0.81, 0.75, 16),
            ("listening", 0.64, 0.55, 9),
            ("production", 0.57, 0.35, 4),
        ):
            connection.execute(
                """
                INSERT INTO user_skill_states
                    (user_id, user_language_id, skill, score, confidence, evidence_count,
                     assessed_at, method_version, last_evidence_at,
                     competence_parameter_set_id, competence_parameter_version)
                VALUES (%s, %s, %s, %s, %s, %s, '2026-08-30T03:00:00Z',
                        'competence-beta-v1', '2026-08-30T03:00:00Z', %s,
                        'competence-beta-v1')
                """,
                (actor_id, profile_id, skill, score, confidence, count, COMPETENCE_PARAMETERS),
            )

        projection_states = (
            (WORD_ONE, "unseen", 0.5, 0.5, 0.5, None, 0.0, 0, True, False),
            (WORD_TWO, "discovered", 0.5, 0.5, 0.5, None, 0.0, 1, False, False),
            (WORD_THREE, "learning", 0.61, 0.52, 0.43, 0.52, 0.42, 3, True, True),
            (WORD_FOUR, "familiar", 0.61, 0.52, 0.43, 0.52, 0.42, 3, True, True),
            (WORD_FIVE, "active", 0.61, 0.52, 0.43, 0.52, 0.42, 3, True, True),
            (WORD_SIX, "mastered", 0.61, 0.52, 0.43, 0.52, 0.42, 3, True, True),
            (GRAMMAR, "weak", 0.61, 0.52, 0.43, 0.52, 0.42, 3, True, True),
            (SKILL, "forgotten", 0.11, 0.22, 0.33, 0.22, 0.44, 3, True, True),
            (PHRASE, "active", 0.61, 0.52, 0.43, 0.52, 0.42, 3, True, True),
        )
        for (
            concept_id,
            status,
            recognition,
            listening,
            production,
            mastery,
            confidence,
            exposure_count,
            has_learning_intent,
            has_projectable_evidence,
        ) in projection_states:
            evidence_count = 1 if has_projectable_evidence else 0
            connection.execute(
                """
                INSERT INTO user_concept_states
                    (user_id, user_language_id, concept_id, status,
                     recognition, listening, production, mastery, confidence,
                     exposure_count, state_version,
                     recognition_confidence, recognition_evidence_count,
                     listening_confidence, listening_evidence_count,
                     production_confidence, production_evidence_count,
                     has_learning_intent, has_projectable_evidence,
                     projection_method_version, competence_parameter_set_id,
                     competence_parameter_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1,
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        'competence-beta-v1', %s, 'competence-beta-v1')
                """,
                (
                    other_actor_id,
                    other_profile_id,
                    concept_id,
                    status,
                    recognition,
                    listening,
                    production,
                    mastery,
                    confidence,
                    exposure_count,
                    confidence,
                    evidence_count,
                    confidence,
                    evidence_count,
                    confidence,
                    evidence_count,
                    has_learning_intent,
                    has_projectable_evidence,
                    COMPETENCE_PARAMETERS,
                ),
            )
        connection.commit()

    actor = AuthenticatedActor(actor_id)
    app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        cursor_secret=b"brain-api-test-cursor-secret-32-bytes",
    )
    projection_actor = AuthenticatedActor(other_actor_id)
    projection_app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(projection_actor),
        cursor_secret=b"brain-api-test-cursor-secret-32-bytes",
    )
    new_app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(AuthenticatedActor(new_actor_id)),
        cursor_secret=b"brain-api-test-cursor-secret-32-bytes",
    )
    return BrainApiSeed(
        actor,
        projection_actor,
        profile_id,
        other_profile_id,
        non_english_profile_id,
        new_profile_id,
        TestClient(app),
        TestClient(projection_app),
        TestClient(new_app),
        app,
        migrated_postgres_url,
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

    schema = cast(
        dict[str, object],
        resolve(deepcopy(contract["components"]["schemas"][schema_name])),
    )
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)


def _count(connection: psycopg.Connection[tuple[object, ...]], table: str) -> int:
    row = connection.execute(f"SELECT count(*) FROM {table}").fetchone()
    assert row is not None
    return int(cast(int, row[0]))


def test_brain_summary_uses_learner_anchors_and_persisted_skill_projection(
    brain_api: BrainApiSeed,
) -> None:
    response = brain_api.client.get(
        "/v1/brain/summary",
        params={"languageProfileId": str(brain_api.profile_id)},
        headers=_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["statusCounts"] == {
        "total": 4,
        "unseen": 2,
        "discovered": 1,
        "learning": 0,
        "familiar": 0,
        "active": 1,
        "mastered": 0,
        "weak": 0,
        "forgotten": 0,
    }
    assert body["data"]["dueCount"] == 1
    assert body["data"]["memoryHealth"] is None
    assert body["data"]["startingLevelEstimate"] is None
    assert body["data"]["competence"]["recognition"] == {
        "score": 0.81,
        "confidence": 0.75,
        "evidenceCount": 16,
        "updatedAt": "2026-08-30T03:00:00Z",
    }
    _assert_contract_schema("BrainSummaryResponse", body)


def test_brain_list_is_deduplicated_keyset_paginated_and_cursor_bound(
    brain_api: BrainApiSeed,
) -> None:
    first = brain_api.client.get("/v1/brain/concepts", params={"limit": 2}, headers=_headers())
    assert first.status_code == 200
    first_body = first.json()
    assert [item["concept"]["canonicalForm"] for item in first_body["data"]] == [
        "word01",
        "word02",
    ]
    assert first_body["meta"]["hasMore"] is True
    passive = first_body["data"][1]
    assert passive["concept"]["status"] == "discovered"
    assert passive["mastery"] is None
    assert passive["confidence"] == 0
    for score in passive["competence"].values():
        assert score == {"score": 0.5, "confidence": 0, "evidenceCount": 0}
    cursor = first_body["meta"]["nextCursor"]

    second = brain_api.client.get(
        "/v1/brain/concepts", params={"limit": 2, "cursor": cursor}, headers=_headers()
    )
    assert second.status_code == 200
    assert [item["concept"]["canonicalForm"] for item in second.json()["data"]] == [
        "word03",
        "word04",
    ]
    mismatched = brain_api.client.get(
        "/v1/brain/concepts",
        params={"limit": 2, "cursor": cursor, "status": "unseen"},
        headers=_headers(),
    )
    assert mismatched.status_code == 422
    assert mismatched.json()["error"]["code"] == "VALIDATION_ERROR"
    _assert_contract_schema("BrainConceptListResponse", first_body)


def test_brain_list_filters_exact_status_and_normalized_prefix(brain_api: BrainApiSeed) -> None:
    response = brain_api.client.get(
        "/v1/brain/concepts",
        params={"status": "unseen", "query": "  WoRd  "},
        headers=_headers(),
    )
    assert response.status_code == 200
    assert [item["concept"]["id"] for item in response.json()["data"]] == [
        str(WORD_THREE),
        str(WORD_FOUR),
    ]


@pytest.mark.parametrize("concept_id", [GRAMMAR, SKILL])
def test_catalog_only_nonlexical_detail_is_synthetic_zero_without_fake_pos(
    brain_api: BrainApiSeed,
    concept_id: uuid.UUID,
) -> None:
    response = brain_api.client.get(f"/v1/brain/concepts/{concept_id}", headers=_headers())
    assert response.status_code == 200
    body = response.json()
    assert "partOfSpeech" not in body["data"]["concept"]
    assert body["data"]["status"] == "unseen"
    assert body["data"]["mastery"] is None
    assert body["data"]["confidence"] == 0
    assert body["data"]["memory"] is None
    assert body["data"]["evidence"] == {"exposureCount": 0, "reviewCount": 0}
    for score in body["data"]["competence"].values():
        assert score == {"score": 0.5, "confidence": 0, "evidenceCount": 0}
    assert body["data"]["concept"]["learner"]["competence"] == body["data"]["competence"]
    _assert_contract_schema("BrainConceptResponse", body)


def test_grammar_detail_returns_structured_first_party_specification(
    brain_api: BrainApiSeed,
) -> None:
    response = brain_api.client.get(f"/v1/brain/concepts/{GRAMMAR}", headers=_headers())
    assert response.status_code == 200
    grammar = response.json()["data"]["concept"]["grammar"]
    assert grammar == {
        "patternFormula": "S + have/has + V3/ed",
        "syntacticCategory": "tense_aspect",
        "pragmaticFunction": "Connect a past action to the present.",
        "vietnameseExplanation": (
            "Dùng have/has với quá khứ phân từ để nối hành động quá khứ với hiện tại."
        ),
        "vietnameseCommonTraps": "Không dùng mốc thời gian quá khứ đã kết thúc.",
        "structuralSlots": [
            {
                "label": "S",
                "role": "subject",
                "required": True,
                "examples": ["I", "she"],
            },
            {
                "label": "have/has + V3",
                "role": "present_relevance",
                "required": True,
                "examples": ["have finished", "has gone"],
            },
        ],
    }
    lexical = brain_api.client.get(f"/v1/brain/concepts/{WORD_ONE}", headers=_headers())
    skill = brain_api.client.get(f"/v1/brain/concepts/{SKILL}", headers=_headers())
    assert "grammar" not in lexical.json()["data"]["concept"]
    assert "grammar" not in skill.json()["data"]["concept"]


def test_lexical_detail_omits_an_absent_optional_translation(brain_api: BrainApiSeed) -> None:
    response = brain_api.client.get(f"/v1/brain/concepts/{WORD_SIX}", headers=_headers())

    assert response.status_code == 200
    definition = response.json()["data"]["concept"]["definitions"][0]
    assert definition["definition"] == "Synthetic fixture definition 6"
    assert "translation" not in definition
    assert "grammar" not in response.json()["data"]["concept"]


def test_brain_hides_restricted_catalog_and_validates_query_bounds(brain_api: BrainApiSeed) -> None:
    hidden = brain_api.client.get(f"/v1/brain/concepts/{RESTRICTED}", headers=_headers())
    assert hidden.status_code == 404
    assert hidden.json()["error"]["code"] == "NOT_FOUND"

    oversized = brain_api.client.get(
        "/v1/brain/concepts", params={"query": "x" * 121}, headers=_headers()
    )
    assert oversized.status_code == 422

    unauthenticated = brain_api.client.get("/v1/brain/summary")
    assert unauthenticated.status_code == 401


def test_brain_detail_returns_only_direct_stored_relations_and_safe_catalog_data(
    brain_api: BrainApiSeed,
) -> None:
    response = brain_api.client.get(f"/v1/brain/concepts/{WORD_ONE}", headers=_headers())
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["concept"]["partOfSpeech"] == "noun"
    assert data["concept"]["definitions"]
    assert data["concept"]["examples"]
    assert data["concept"]["attribution"]["licenseCode"] == "LINGUA-FIXTURE"
    assert data["concept"]["relations"] == [
        {"conceptId": str(WORD_THREE), "relationType": "antonym", "canonicalForm": "word03"},
        {"conceptId": str(WORD_FOUR), "relationType": "family", "canonicalForm": "word04"},
        {
            "conceptId": str(WORD_FIVE),
            "relationType": "prerequisite",
            "canonicalForm": "word05",
        },
        {"conceptId": str(WORD_TWO), "relationType": "related", "canonicalForm": "word02"},
        {"conceptId": str(WORD_SIX), "relationType": "synonym", "canonicalForm": "word06"},
    ]
    assert all(
        item["conceptId"] not in {str(GRAMMAR), str(RESTRICTED)}
        for item in data["concept"]["relations"]
    )
    assert data["mastery"] == 0.71
    assert data["confidence"] == 0.62


def test_profile_ownership_is_hidden_and_all_gets_are_read_only(brain_api: BrainApiSeed) -> None:
    hidden = brain_api.client.get(
        "/v1/brain/summary",
        params={"languageProfileId": str(brain_api.other_profile_id)},
        headers=_headers(),
    )
    assert hidden.status_code == 404
    assert hidden.json()["error"]["code"] == "NOT_FOUND"

    tables = (
        "user_concept_states",
        "user_skill_states",
        "learning_events",
        "review_items",
        "fsrs_states",
        "review_events",
        "exposure_events",
        "user_content_progress",
        "user_saved_concepts",
        "user_saved_content",
        "user_saved_sentences",
        "today_plans",
        "today_plan_activities",
    )
    with psycopg.connect(brain_api.database_url) as connection:
        before = {table: _count(connection, table) for table in tables}
    assert brain_api.client.get("/v1/brain/summary", headers=_headers()).status_code == 200
    assert brain_api.client.get("/v1/brain/concepts", headers=_headers()).status_code == 200
    assert (
        brain_api.client.get(f"/v1/brain/concepts/{WORD_FIVE}", headers=_headers()).status_code
        == 200
    )
    with psycopg.connect(brain_api.database_url) as connection:
        after = {table: _count(connection, table) for table in tables}
    assert after == before


def test_brain_runtime_routes_match_frozen_operations(brain_api: BrainApiSeed) -> None:
    generated = brain_api.application.openapi()
    assert generated["paths"]["/v1/brain/summary"]["get"]["operationId"] == "getBrainSummary"
    assert generated["paths"]["/v1/brain/concepts"]["get"]["operationId"] == "listBrainConcepts"
    assert (
        generated["paths"]["/v1/brain/concepts/{conceptId}"]["get"]["operationId"]
        == "getBrainConcept"
    )


def test_completely_new_learner_is_synthetic_zero_without_persistence(
    brain_api: BrainApiSeed,
) -> None:
    with psycopg.connect(brain_api.database_url) as connection:
        before = _count(connection, "user_skill_states"), _count(connection, "user_concept_states")
    response = brain_api.new_client.get("/v1/brain/summary", headers=_headers())
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["languageProfileId"] == str(brain_api.new_profile_id)
    assert data["statusCounts"] == {
        "total": 0,
        "unseen": 0,
        "discovered": 0,
        "learning": 0,
        "familiar": 0,
        "active": 0,
        "mastered": 0,
        "weak": 0,
        "forgotten": 0,
    }
    assert data["memoryHealth"] is None
    assert data["startingLevelEstimate"] is None
    for score in data["competence"].values():
        assert score == {"score": 0.5, "confidence": 0, "evidenceCount": 0}
    with psycopg.connect(brain_api.database_url) as connection:
        after = _count(connection, "user_skill_states"), _count(connection, "user_concept_states")
    assert after == before


def test_all_authoritative_statuses_and_concept_types_are_read_without_recalculation(
    brain_api: BrainApiSeed,
) -> None:
    response = brain_api.projection_client.get(
        "/v1/brain/concepts", params={"limit": 100}, headers=_headers()
    )
    assert response.status_code == 200
    items = {item["concept"]["id"]: item for item in response.json()["data"]}
    assert {item["concept"]["status"] for item in items.values()} == {
        "unseen",
        "discovered",
        "learning",
        "familiar",
        "active",
        "mastered",
        "weak",
        "forgotten",
    }
    assert {str(PHRASE), str(GRAMMAR), str(SKILL)} <= set(items)
    assert "partOfSpeech" not in items[str(PHRASE)]["concept"]
    assert "partOfSpeech" not in items[str(GRAMMAR)]["concept"]
    assert "partOfSpeech" not in items[str(SKILL)]["concept"]
    passive = items[str(WORD_TWO)]
    assert passive["concept"]["status"] == "discovered"
    assert passive["mastery"] is None
    assert passive["confidence"] == 0
    for score in passive["competence"].values():
        assert score == {"score": 0.5, "confidence": 0, "evidenceCount": 0}
    custom_skill = items[str(SKILL)]
    assert custom_skill["competence"]["recognition"]["score"] == 0.11
    assert custom_skill["competence"]["listening"]["score"] == 0.22
    assert custom_skill["competence"]["production"]["score"] == 0.33
    assert custom_skill["mastery"] == 0.22
    assert custom_skill["confidence"] == 0.44


def test_equal_catalog_key_uses_concept_id_tie_break_and_cursor_rejects_tampering(
    brain_api: BrainApiSeed,
) -> None:
    first = brain_api.projection_client.get(
        "/v1/brain/concepts", params={"query": "word01", "limit": 1}, headers=_headers()
    )
    assert first.status_code == 200
    first_body = first.json()
    assert [item["concept"]["id"] for item in first_body["data"]] == [str(WORD_ONE)]
    assert first_body["meta"]["hasMore"] is True
    cursor = first_body["meta"]["nextCursor"]
    second = brain_api.projection_client.get(
        "/v1/brain/concepts",
        params={"query": "word01", "limit": 1, "cursor": cursor},
        headers=_headers(),
    )
    assert second.status_code == 200
    assert [item["concept"]["id"] for item in second.json()["data"]] == [str(PHRASE)]
    assert second.json()["meta"]["hasMore"] is False

    replacement = "A" if cursor[-1] != "A" else "B"
    tampered = brain_api.projection_client.get(
        "/v1/brain/concepts",
        params={"query": "word01", "limit": 1, "cursor": cursor[:-1] + replacement},
        headers=_headers(),
    )
    assert tampered.status_code == 422
    assert (
        brain_api.projection_client.get(
            "/v1/brain/concepts", params={"limit": 101}, headers=_headers()
        ).status_code
        == 422
    )


def test_missing_non_owned_and_non_english_profiles_share_not_found(
    brain_api: BrainApiSeed,
) -> None:
    profile_ids = (
        uuid.uuid4(),
        brain_api.other_profile_id,
        brain_api.non_english_profile_id,
    )
    responses = [
        brain_api.client.get(
            "/v1/brain/summary",
            params={"languageProfileId": str(profile_id)},
            headers=_headers(),
        )
        for profile_id in profile_ids
    ]
    assert [response.status_code for response in responses] == [404, 404, 404]
    assert [response.json()["error"]["code"] for response in responses] == [
        "NOT_FOUND",
        "NOT_FOUND",
        "NOT_FOUND",
    ]
    assert len({response.json()["error"]["message"] for response in responses}) == 1


def test_phrase_catalog_detail_is_zero_state_and_has_no_fake_pos(brain_api: BrainApiSeed) -> None:
    response = brain_api.client.get(f"/v1/brain/concepts/{PHRASE}", headers=_headers())
    assert response.status_code == 200
    data = response.json()["data"]
    assert "partOfSpeech" not in data["concept"]
    assert data["status"] == "unseen"
    assert data["mastery"] is None
    assert data["confidence"] == 0


def test_repeatable_read_snapshot_does_not_mix_concurrent_projection_versions(
    brain_api: BrainApiSeed,
) -> None:
    store = PostgresBrainStore(brain_api.database_url)
    try:
        with store.snapshot(actor=brain_api.projection_actor) as snapshot:
            profile_id = store.resolve_profile(snapshot, brain_api.other_profile_id)
            before = store.load_detail(snapshot, profile_id=profile_id, concept_id=SKILL)
            assert before.learner.status.value == "forgotten"
            with psycopg.connect(brain_api.database_url) as writer:
                writer.execute(
                    """
                    UPDATE user_concept_states
                    SET status = 'active', state_version = state_version + 1
                    WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
                    """,
                    (brain_api.projection_actor.id, brain_api.other_profile_id, SKILL),
                )
                writer.commit()
            during = store.load_detail(snapshot, profile_id=profile_id, concept_id=SKILL)
            assert during.learner.status.value == "forgotten"

        with store.snapshot(actor=brain_api.projection_actor) as later_snapshot:
            later = store.load_detail(
                later_snapshot, profile_id=brain_api.other_profile_id, concept_id=SKILL
            )
            assert later.learner.status.value == "active"
    finally:
        with psycopg.connect(brain_api.database_url) as writer:
            writer.execute(
                """
                UPDATE user_concept_states SET status = 'forgotten',
                       state_version = state_version + 1
                WHERE user_id = %s AND user_language_id = %s AND concept_id = %s
                """,
                (brain_api.projection_actor.id, brain_api.other_profile_id, SKILL),
            )
            writer.commit()
