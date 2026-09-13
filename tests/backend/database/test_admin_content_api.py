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
