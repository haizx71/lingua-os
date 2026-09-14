from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"


@dataclass(frozen=True)
class TokenVerifier:
    owner: AuthenticatedActor
    learner: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token == "owner-token":
            return self.owner
        if token == "learner-token":
            return self.learner
        raise AssertionError("unexpected test token")


@dataclass(frozen=True)
class AdminApi:
    client: TestClient
    database_url: str
    owner: AuthenticatedActor


@pytest.fixture
def admin_api(isolated_migrated_postgres_url: str) -> AdminApi:
    owner = AuthenticatedActor(uuid.uuid4())
    learner = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        for actor in (owner, learner):
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
            connection.execute("INSERT INTO users (id) VALUES (%s)", (actor.id,))
            connection.execute(
                "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
                (actor.id,),
            )
        connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            """,
            (owner.id,),
        )
        connection.commit()
    app = create_app(
        database_url=isolated_migrated_postgres_url,
        token_verifier=TokenVerifier(owner, learner),
        cursor_secret=b"admin-content-test-cursor-secret-32bytes",
        admin_user_ids=str(owner.id),
    )
    return AdminApi(TestClient(app), isolated_migrated_postgres_url, owner)


def _headers(token: str = "owner-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _payload(**overrides: object) -> dict[str, object]:
    result: dict[str, object] = {
        "title": "A calm first morning",
        "body": "word01 word02. word03 word04!",
        "languageCode": "en",
        "level": "A1",
        "authorName": "LINGUA OS owner",
        "sourceName": "LINGUA OS original articles",
        "sourceVersion": "2026-09-13-v1",
        "attributionText": "Original article © LINGUA OS.",
        "rightsStatement": "Owner-authored first-party text approved for LINGUA OS use.",
    }
    result.update(overrides)
    return result


def _create(api: AdminApi, **overrides: object) -> dict[str, Any]:
    response = api.client.post("/v1/admin/content", json=_payload(**overrides), headers=_headers())
    assert response.status_code == 201, response.text
    return cast(dict[str, Any], response.json()["data"])


def _table_counts(database_url: str, tables: tuple[str, ...]) -> dict[str, object]:
    result: dict[str, object] = {}
    with psycopg.connect(database_url) as connection:
        for table in tables:
            row = connection.execute(f"SELECT count(*) FROM {table}").fetchone()
            assert row is not None
            result[table] = row[0]
    return result


def test_admin_auth_is_anonymous_401_non_owner_403_and_invalid_config_fail_closed(
    admin_api: AdminApi,
) -> None:
    assert admin_api.client.get("/v1/admin/content").status_code == 401
    assert (
        admin_api.client.get("/v1/admin/content", headers=_headers("learner-token")).status_code
        == 403
    )

    closed_app = create_app(
        database_url=admin_api.database_url,
        token_verifier=TokenVerifier(admin_api.owner, AuthenticatedActor(uuid.uuid4())),
        cursor_secret=b"admin-content-test-cursor-secret-32bytes",
        admin_user_ids="invalid-owner-config",
    )
    assert TestClient(closed_app).get("/v1/admin/content", headers=_headers()).status_code == 403


def test_create_list_inspect_update_and_deterministic_sentence_preview(admin_api: AdminApi) -> None:
    created = _create(admin_api)
    assert created["status"] == "normalized"
    assert created["licenseCode"] == "LINGUA-FIRST-PARTY"
    assert [sentence["text"] for sentence in created["sentences"]] == [
        "word01 word02.",
        "word03 word04!",
    ]
    assert [sentence["conceptCount"] for sentence in created["sentences"]] == [2, 2]
    assert [
        (occurrence["surfaceText"], occurrence["startOffset"], occurrence["endOffset"])
        for occurrence in created["sentences"][0]["concepts"]
    ] == [("word01", 0, 6), ("word02", 7, 13)]

    listed = admin_api.client.get("/v1/admin/content", headers=_headers())
    inspected = admin_api.client.get(f"/v1/admin/content/{created['id']}", headers=_headers())
    assert listed.status_code == inspected.status_code == 200
    assert listed.json()["data"][0]["id"] == created["id"]
    assert inspected.json()["data"] == created

    updated = admin_api.client.patch(
        f"/v1/admin/content/{created['id']}",
        json={"body": "word05 word06? word07 word08."},
        headers=_headers(),
    )
    assert updated.status_code == 200, updated.text
    assert [sentence["text"] for sentence in updated.json()["data"]["sentences"]] == [
        "word05 word06?",
        "word07 word08.",
    ]


def test_invalid_provenance_or_missing_attribution_cannot_publish(admin_api: AdminApi) -> None:
    missing = admin_api.client.post(
        "/v1/admin/content", json=_payload(attributionText=""), headers=_headers()
    )
    assert missing.status_code == 422

    created = _create(admin_api)
    with psycopg.connect(admin_api.database_url) as connection:
        connection.execute(
            "UPDATE licenses SET usage_policy = 'restricted' WHERE code = 'LINGUA-FIRST-PARTY'"
        )
        connection.commit()
    validation = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/validate", headers=_headers()
    )
    assert validation.status_code == 200
    assert validation.json()["data"]["isValid"] is False
    assert validation.json()["data"]["issues"][0]["field"] == "licenseCode"
    published = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/publish", headers=_headers()
    )
    assert published.status_code == 409


def test_unmapped_sentence_reports_validation_issue_instead_of_fake_concept(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api, body="This sentence has no indexed fixture concept.")
    assert created["sentences"][0]["conceptCount"] == 0

    validation = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/validate", headers=_headers()
    )
    assert validation.status_code == 200
    assert validation.json()["data"]["isValid"] is False
    assert validation.json()["data"]["issues"] == [
        {
            "field": "sentences[0].concepts",
            "reason": "At least one authoritative catalog concept is required.",
        }
    ]
    assert (
        admin_api.client.post(
            f"/v1/admin/content/{created['id']}/publish", headers=_headers()
        ).status_code
        == 409
    )


def test_owner_can_search_catalog_and_non_owner_cannot_use_admin_search(
    admin_api: AdminApi,
) -> None:
    response = admin_api.client.get(
        "/v1/admin/concepts/search", params={"query": "word01"}, headers=_headers()
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"] == [
        {
            "id": "30000000-0000-4000-8000-000000000001",
            "conceptType": "word",
            "canonicalForm": "word01",
            "partOfSpeech": "noun",
            "definition": "Synthetic fixture definition 1",
        }
    ]
    assert (
        admin_api.client.get(
            "/v1/admin/concepts/search",
            params={"query": "word01"},
            headers=_headers("learner-token"),
        ).status_code
        == 403
    )
    with psycopg.connect(admin_api.database_url) as connection:
        connection.execute(
            """
            INSERT INTO concepts
                (id, language_code, concept_type, canonical_key, source_record_id)
            VALUES ('30000000-0000-4000-8000-000000000099', 'en', 'grammar',
                    'grammar_fixture', '21000000-0000-4000-8000-000000000001')
            """
        )
        connection.commit()
    grammar = admin_api.client.get(
        "/v1/admin/concepts/search",
        params={"query": "grammar_fixture"},
        headers=_headers(),
    )
    assert grammar.status_code == 200
    assert grammar.json()["data"] == [
        {
            "id": "30000000-0000-4000-8000-000000000099",
            "conceptType": "grammar",
            "canonicalForm": "grammar_fixture",
            "partOfSpeech": None,
            "definition": None,
        }
    ]


def test_manual_mapping_is_idempotent_persistent_removable_and_actor_neutral(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api, body="Words can change.")
    content_id = created["id"]
    sentence_id = created["sentences"][0]["id"]
    concept_id = "30000000-0000-4000-8000-000000000001"
    path = f"/v1/admin/content/{content_id}/sentences/{sentence_id}/concepts/{concept_id}"
    learner_tables = (
        "user_saved_concepts",
        "user_saved_content",
        "user_saved_sentences",
        "learning_events",
        "exposure_events",
        "review_events",
        "review_items",
        "fsrs_states",
        "user_concept_states",
        "user_skill_states",
        "user_language_projection_heads",
        "user_content_progress",
        "reader_mutation_results",
        "reader_exposure_concepts",
        "today_plans",
        "today_plan_activities",
        "today_activity_review_items",
        "assessment_attempts",
        "assessment_attempt_items",
        "assessment_responses",
        "assessment_results",
        "assessment_idempotency_log",
        "profile_mutation_results",
        "concept_save_intents",
    )
    before = _table_counts(admin_api.database_url, learner_tables)

    added = admin_api.client.put(
        path,
        json={"startOffset": 0, "endOffset": 5, "occurrenceRole": "target"},
        headers=_headers(),
    )
    assert added.status_code == 200, added.text
    occurrence = added.json()["data"]["sentences"][0]["concepts"][0]
    assert occurrence == {
        "concept": {
            "id": concept_id,
            "conceptType": "word",
            "canonicalForm": "word01",
            "partOfSpeech": "noun",
            "definition": "Synthetic fixture definition 1",
        },
        "startOffset": 0,
        "endOffset": 5,
        "occurrenceRole": "target",
        "surfaceText": "Words",
    }

    duplicate = admin_api.client.put(
        path,
        json={"startOffset": 0, "endOffset": 5, "occurrenceRole": "target"},
        headers=_headers(),
    )
    reloaded = admin_api.client.get(f"/v1/admin/content/{content_id}", headers=_headers())
    assert duplicate.status_code == reloaded.status_code == 200
    assert duplicate.json()["data"]["sentences"][0]["conceptCount"] == 1
    assert reloaded.json()["data"]["sentences"][0]["concepts"] == [occurrence]

    validation = admin_api.client.post(
        f"/v1/admin/content/{content_id}/validate", headers=_headers()
    )
    assert validation.status_code == 200
    assert validation.json()["data"]["isValid"] is True

    published = admin_api.client.post(f"/v1/admin/content/{content_id}/publish", headers=_headers())
    assert published.status_code == 200

    after = _table_counts(admin_api.database_url, learner_tables)
    assert after == before


def test_manual_mapping_rejects_invalid_or_foreign_identity_and_published_mutation(
    admin_api: AdminApi,
) -> None:
    first = _create(admin_api, body="Words can change.")
    second = _create(admin_api, body="Another sentence here.")
    concept_id = "30000000-0000-4000-8000-000000000001"
    invalid_concept = str(uuid.uuid4())
    foreign = (
        f"/v1/admin/content/{first['id']}/sentences/"
        f"{second['sentences'][0]['id']}/concepts/{concept_id}"
    )
    body = {"startOffset": 0, "endOffset": 5, "occurrenceRole": "target"}
    assert (
        admin_api.client.put(foreign, json=body, headers=_headers("learner-token")).status_code
        == 403
    )
    assert admin_api.client.put(foreign, json=body, headers=_headers()).status_code == 404
    assert (
        admin_api.client.put(
            f"/v1/admin/content/{first['id']}/sentences/"
            f"{first['sentences'][0]['id']}/concepts/{invalid_concept}",
            json=body,
            headers=_headers(),
        ).status_code
        == 404
    )
    invalid_span = admin_api.client.put(
        f"/v1/admin/content/{first['id']}/sentences/"
        f"{first['sentences'][0]['id']}/concepts/{concept_id}",
        json={"startOffset": 0, "endOffset": 999, "occurrenceRole": "target"},
        headers=_headers(),
    )
    assert invalid_span.status_code == 422

    published = _create(admin_api)
    admin_api.client.post(f"/v1/admin/content/{published['id']}/validate", headers=_headers())
    admin_api.client.post(f"/v1/admin/content/{published['id']}/publish", headers=_headers())
    published_path = (
        f"/v1/admin/content/{published['id']}/sentences/"
        f"{published['sentences'][0]['id']}/concepts/{concept_id}"
    )
    assert admin_api.client.put(published_path, json=body, headers=_headers()).status_code == 409
    assert (
        admin_api.client.delete(
            published_path,
            params={"startOffset": 0, "endOffset": 6},
            headers=_headers(),
        ).status_code
        == 409
    )


def test_manual_mapping_can_be_removed_before_validation(admin_api: AdminApi) -> None:
    created = _create(admin_api, body="Words can change.")
    content_id = created["id"]
    sentence_id = created["sentences"][0]["id"]
    concept_id = "30000000-0000-4000-8000-000000000001"
    path = f"/v1/admin/content/{content_id}/sentences/{sentence_id}/concepts/{concept_id}"
    body = {"startOffset": 0, "endOffset": 5, "occurrenceRole": "target"}
    assert admin_api.client.put(path, json=body, headers=_headers()).status_code == 200
    removed = admin_api.client.delete(
        path, params={"startOffset": 0, "endOffset": 5}, headers=_headers()
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["data"]["sentences"][0]["conceptCount"] == 0
    assert removed.json()["data"]["sentences"][0]["concepts"] == []
    repeated = admin_api.client.delete(
        path, params={"startOffset": 0, "endOffset": 5}, headers=_headers()
    )
    assert repeated.status_code == 200


def test_valid_content_publishes_is_reader_visible_immutable_and_retirable(
    admin_api: AdminApi,
) -> None:
    with psycopg.connect(admin_api.database_url) as connection:
        before: dict[str, object] = {}
        for table in ("learning_events", "review_events", "user_concept_states"):
            row = connection.execute(f"SELECT count(*) FROM {table}").fetchone()
            assert row is not None
            before[table] = row[0]
    created = _create(admin_api)
    content_id = created["id"]
    validation = admin_api.client.post(
        f"/v1/admin/content/{content_id}/validate", headers=_headers()
    )
    assert validation.status_code == 200
    assert validation.json()["data"]["isValid"] is True
    published = admin_api.client.post(f"/v1/admin/content/{content_id}/publish", headers=_headers())
    assert published.status_code == 200, published.text
    assert published.json()["data"]["status"] == "published"

    reader = admin_api.client.get(f"/v1/content/{content_id}", headers=_headers())
    assert reader.status_code == 200, reader.text
    assert reader.json()["data"]["summary"]["title"] == "A calm first morning"

    assert (
        admin_api.client.patch(
            f"/v1/admin/content/{content_id}", json={"title": "Changed"}, headers=_headers()
        ).status_code
        == 409
    )
    with psycopg.connect(admin_api.database_url) as connection:
        sentence_id = published.json()["data"]["sentences"][0]["id"]
        with pytest.raises(psycopg.errors.CheckViolation):
            connection.execute(
                "UPDATE sentences SET text = 'changed' WHERE id = %s", (sentence_id,)
            )

    retired = admin_api.client.post(f"/v1/admin/content/{content_id}/retire", headers=_headers())
    assert retired.status_code == 200
    assert retired.json()["data"]["status"] == "retired"
    assert admin_api.client.get(f"/v1/content/{content_id}", headers=_headers()).status_code == 404

    with psycopg.connect(admin_api.database_url) as connection:
        after: dict[str, object] = {}
        for table in before:
            row = connection.execute(f"SELECT count(*) FROM {table}").fetchone()
            assert row is not None
            after[table] = row[0]
    assert after == before
