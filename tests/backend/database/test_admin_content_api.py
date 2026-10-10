from __future__ import annotations

import hashlib
import json
import time
import uuid
from collections import deque
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Barrier, Event, Lock
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


class RoleClock:
    def __init__(self, values: dict[str, datetime]) -> None:
        self._values = values
        self._pending: deque[str] = deque()
        self._lock = Lock()
        self.captured = {name: Event() for name in values}

    def schedule(self, role: str) -> None:
        with self._lock:
            self._pending.append(role)

    def now(self) -> datetime:
        with self._lock:
            role = self._pending.popleft() if self._pending else "create"
        self.captured[role].set()
        return self._values[role]


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


def _translation_source(**overrides: str) -> dict[str, str]:
    return {
        "authorName": "LINGUA OS editorial team",
        "sourceName": "LINGUA OS original Vietnamese translation",
        "sourceVersion": "pilot-v1",
        "attributionText": "Vietnamese translation by the LINGUA OS editorial team.",
        "rightsStatement": "First-party Vietnamese translation approved for LINGUA OS use.",
        **overrides,
    }


def _translation_payload(
    sentences: list[dict[str, Any]],
    translations: list[str] | None = None,
    *,
    source: dict[str, str] | None = None,
) -> dict[str, object]:
    values = translations or [f"Bản dịch câu {index + 1}." for index in range(len(sentences))]
    return {
        "entries": [
            {
                "ordinal": index + 1,
                "sourceText": sentence["text"],
                "translationText": values[index],
            }
            for index, sentence in enumerate(sentences)
        ],
        "source": source or _translation_source(),
    }


def _run_two_requests_concurrently(
    first: Callable[[], Any], second: Callable[[], Any]
) -> tuple[Any, Any]:
    barrier = Barrier(2)

    def run(request: Callable[[], Any]) -> Any:
        barrier.wait(timeout=10)
        return request()

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_result = executor.submit(run, first)
        second_result = executor.submit(run, second)
        return first_result.result(timeout=30), second_result.result(timeout=30)


def _wait_for_pg_lock_waiters(database_url: str, application_name: str, expected: int) -> None:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with psycopg.connect(database_url) as connection:
            row = connection.execute(
                """
                SELECT count(*)
                FROM pg_stat_activity
                WHERE datname = current_database()
                  AND application_name = %s
                  AND state = 'active'
                  AND wait_event_type = 'Lock'
                """,
                (application_name,),
            ).fetchone()
        if row is not None and cast(int, row[0]) >= expected:
            return
        time.sleep(0.01)
    raise AssertionError(f"expected {expected} admin requests waiting on the content row lock")


def _insert_foreign_vi_translation(
    api: AdminApi, sentence_id: str, *, target_language_code: str = "vi"
) -> str:
    source_id = uuid.uuid4()
    source_record_id = uuid.uuid4()
    with psycopg.connect(api.database_url) as connection:
        license_row = connection.execute(
            "SELECT id FROM licenses WHERE code = 'LINGUA-FIRST-PARTY'"
        ).fetchone()
        assert license_row is not None
        connection.execute(
            """
            INSERT INTO data_sources
                (id, name, source_type, source_version, license_id, attribution_text)
            VALUES (%s, %s, 'internal', %s, %s, %s)
            """,
            (
                source_id,
                f"External VI source {source_id}",
                f"test-{source_id}",
                license_row[0],
                "External Vietnamese translation test source.",
            ),
        )
        connection.execute(
            """
            INSERT INTO source_records
                (id, source_id, source_record_key, raw_hash, transform_version,
                 review_status, metadata)
            VALUES (%s, %s, %s, %s, 'external-test-v1', 'normalized', '{}'::jsonb)
            """,
            (source_record_id, source_id, f"external:{source_id}", "f" * 64),
        )
        translation_id = uuid.uuid4()
        connection.execute(
            """
            INSERT INTO sentence_translations
                (id, sentence_id, target_language_code, text, source_record_id)
            VALUES (%s, %s, %s, 'Bản dịch từ nguồn khác.', %s)
            """,
            (translation_id, sentence_id, target_language_code, source_record_id),
        )
        connection.commit()
    return str(translation_id)


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


def test_owner_can_author_exact_72_pair_vi_set_idempotently_and_inspect_reader_values(
    admin_api: AdminApi,
) -> None:
    candidate_path = (
        ROOT / "knowledge" / "staging" / "pilot-reader-vi-draft" / "translation-draft.json"
    )
    candidate_bytes = candidate_path.read_bytes()
    assert hashlib.sha256(candidate_bytes).hexdigest() == (
        "25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f"
    )
    candidate = json.loads(candidate_bytes)
    created = _create(
        admin_api,
        title=candidate["title"],
        body=candidate["body"],
        level=candidate["curated_level_candidate"],
    )
    sentences = created["sentences"]
    candidate_rows = candidate["sentences"]
    assert len(sentences) == len(candidate_rows) == 72
    assert [sentence["text"] for sentence in sentences] == [
        item["english"] for item in candidate_rows
    ]
    payload = _translation_payload(
        sentences,
        [item["vietnamese"] for item in candidate_rows],
    )
    path = f"/v1/admin/content/{created['id']}/translations/vi"

    before = _table_counts(
        admin_api.database_url,
        ("sentence_translations", "learning_events", "review_events", "user_concept_states"),
    )
    assert admin_api.client.put(path, json=payload).status_code == 401
    assert (
        admin_api.client.put(path, json=payload, headers=_headers("learner-token")).status_code
        == 403
    )

    saved = admin_api.client.put(path, json=payload, headers=_headers())
    assert saved.status_code == 200, saved.text
    data = saved.json()["data"]
    assert [sentence["translationVi"] for sentence in data["sentences"]] == [
        item["vietnamese"] for item in candidate_rows
    ]
    assert data["translationSource"]["targetLanguageCode"] == "vi"
    assert data["translationSource"]["sourceName"] == payload["source"]["sourceName"]
    assert data["translationSource"]["sourceRecordKey"].startswith(
        f"admin-translation:{created['id']}:"
    )
    assert len(data["translationSource"]["rawHash"]) == 64
    first_source_key = data["translationSource"]["sourceRecordKey"]

    replay = admin_api.client.put(path, json=payload, headers=_headers())
    assert replay.status_code == 200, replay.text
    assert replay.json()["data"]["translationSource"]["sourceRecordKey"] == first_source_key
    assert (
        replay.json()["data"]["translationSource"]["rawHash"]
        == data["translationSource"]["rawHash"]
    )
    after = _table_counts(
        admin_api.database_url,
        ("sentence_translations", "learning_events", "review_events", "user_concept_states"),
    )
    assert after["sentence_translations"] == before["sentence_translations"] + 72
    assert {key: after[key] for key in before if key != "sentence_translations"} == {
        key: before[key] for key in before if key != "sentence_translations"
    }
    with psycopg.connect(admin_api.database_url) as connection:
        source_count = connection.execute(
            """
            SELECT count(*) FROM source_records
            WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
        assert source_count == (1,)


def test_translation_put_rejects_partial_or_stale_alignment_and_preserves_vi_text_exactly(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    path = f"/v1/admin/content/{created['id']}/translations/vi"
    entries = _translation_payload(created["sentences"])
    partial = {**entries, "entries": entries["entries"][:-1]}
    assert admin_api.client.put(path, json=partial, headers=_headers()).status_code == 422

    stale_entries = [dict(entry) for entry in entries["entries"]]
    stale_entries[0]["sourceText"] = "A different English sentence."
    stale = {**entries, "entries": stale_entries}
    assert admin_api.client.put(path, json=stale, headers=_headers()).status_code == 422

    whitespace_entries = [dict(entry) for entry in entries["entries"]]
    whitespace_entries[0]["translationText"] = "  Bản dịch giữ nguyên khoảng trắng.  "
    exact = {**entries, "entries": whitespace_entries}
    saved = admin_api.client.put(path, json=exact, headers=_headers())
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["sentences"][0]["translationVi"] == (
        "  Bản dịch giữ nguyên khoảng trắng.  "
    )

    current = _table_counts(admin_api.database_url, ("sentence_translations", "source_records"))
    again = admin_api.client.put(path, json=partial, headers=_headers())
    assert again.status_code == 422
    assert (
        _table_counts(admin_api.database_url, ("sentence_translations", "source_records"))
        == current
    )


def test_translation_replacement_and_clear_fail_atomically_when_any_vi_row_is_foreign(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    path = f"/v1/admin/content/{created['id']}/translations/vi"
    original = _translation_payload(created["sentences"])
    saved = admin_api.client.put(path, json=original, headers=_headers())
    assert saved.status_code == 200, saved.text
    sentence_id = created["sentences"][0]["id"]
    foreign_id = _insert_foreign_vi_translation(admin_api, sentence_id)

    with psycopg.connect(admin_api.database_url) as connection:
        before_rows = connection.execute(
            """
            SELECT id, sentence_id, text, source_record_id
            FROM sentence_translations WHERE sentence_id = ANY(%s::uuid[])
            ORDER BY id
            """,
            ([sentence["id"] for sentence in created["sentences"]],),
        ).fetchall()
        before_sources = connection.execute(
            """
            SELECT count(*) FROM source_records
            WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
    assert any(str(row[0]) == foreign_id for row in before_rows)

    replacement_payload = _translation_payload(
        created["sentences"],
        [f"Bản sửa câu {index + 1}." for index in range(len(created["sentences"]))],
    )
    replacement = admin_api.client.put(path, json=replacement_payload, headers=_headers())
    assert replacement.status_code == 409, replacement.text
    cleared = admin_api.client.put(path, json={"entries": []}, headers=_headers())
    assert cleared.status_code == 409, cleared.text

    with psycopg.connect(admin_api.database_url) as connection:
        after_rows = connection.execute(
            """
            SELECT id, sentence_id, text, source_record_id
            FROM sentence_translations WHERE sentence_id = ANY(%s::uuid[])
            ORDER BY id
            """,
            ([sentence["id"] for sentence in created["sentences"]],),
        ).fetchall()
        after_sources = connection.execute(
            """
            SELECT count(*) FROM source_records
            WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
    assert after_rows == before_rows
    assert after_sources == before_sources


def test_translation_validation_approves_provenance_and_reader_returns_vi(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    path = f"/v1/admin/content/{created['id']}/translations/vi"
    translations = [
        "  Bản dịch đầu tiên cần giữ nguyên khoảng trắng.  ",
        *[f"Bản dịch câu {index + 1}." for index in range(1, len(created["sentences"]))],
    ]
    payload = _translation_payload(created["sentences"], translations)
    saved = admin_api.client.put(path, json=payload, headers=_headers())
    assert saved.status_code == 200, saved.text

    validation = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/validate", headers=_headers()
    )
    assert validation.status_code == 200, validation.text
    assert validation.json()["data"]["isValid"] is True
    translation_key = validation.json()["data"]["content"]["translationSource"]["sourceRecordKey"]
    with psycopg.connect(admin_api.database_url) as connection:
        source = connection.execute(
            """
            SELECT record.review_status, record.quality_score, record.reviewed_at,
                   source.attribution_text, license.usage_policy
            FROM source_records AS record
            JOIN data_sources AS source ON source.id = record.source_id
            JOIN licenses AS license ON license.id = source.license_id
            WHERE record.source_record_key = %s
            """,
            (translation_key,),
        ).fetchone()
    assert source is not None
    assert source[0] == "approved" and source[1] == 1 and source[2] is not None
    assert source[3] and source[4] == "allowed"

    published = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/publish", headers=_headers()
    )
    assert published.status_code == 200, published.text
    reader = admin_api.client.get(f"/v1/content/{created['id']}", headers=_headers())
    assert reader.status_code == 200, reader.text
    reader_sentences = [
        sentence
        for segment in reader.json()["data"]["segments"]
        for sentence in segment["sentences"]
    ]
    assert [sentence["translation"] for sentence in reader_sentences] == translations


def test_metadata_and_identical_body_patch_preserve_translation_but_body_change_clears_it(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    content_path = f"/v1/admin/content/{created['id']}"
    translation_path = f"{content_path}/translations/vi"
    payload = _translation_payload(created["sentences"])
    assert (
        admin_api.client.put(translation_path, json=payload, headers=_headers()).status_code == 200
    )
    before_ids = [sentence["id"] for sentence in created["sentences"]]

    metadata_patch = admin_api.client.patch(
        content_path, json={"title": "A calmer first morning"}, headers=_headers()
    )
    assert metadata_patch.status_code == 200, metadata_patch.text
    assert [sentence["id"] for sentence in metadata_patch.json()["data"]["sentences"]] == before_ids
    assert [
        sentence["translationVi"] for sentence in metadata_patch.json()["data"]["sentences"]
    ] == [item["translationText"] for item in payload["entries"]]

    same_body = admin_api.client.patch(
        content_path, json={"body": created["body"]}, headers=_headers()
    )
    assert same_body.status_code == 200, same_body.text
    assert [sentence["id"] for sentence in same_body.json()["data"]["sentences"]] == before_ids
    assert all(sentence["translationVi"] for sentence in same_body.json()["data"]["sentences"])

    changed_body = admin_api.client.patch(
        content_path, json={"body": "word05 word06."}, headers=_headers()
    )
    assert changed_body.status_code == 200, changed_body.text
    assert changed_body.json()["data"]["body"] == "word05 word06."
    assert all(
        sentence["translationVi"] is None for sentence in changed_body.json()["data"]["sentences"]
    )
    assert changed_body.json()["data"]["translationSource"] is None
    assert [sentence["id"] for sentence in changed_body.json()["data"]["sentences"]] != before_ids
    with psycopg.connect(admin_api.database_url) as connection:
        old_translations = connection.execute(
            "SELECT count(*) FROM sentence_translations WHERE sentence_id = ANY(%s::uuid[])",
            (before_ids,),
        ).fetchone()
        history = connection.execute(
            """
            SELECT count(*) FROM source_records
            WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
    assert old_translations == (0,)
    assert history == (1,)


def test_body_replacement_rolls_back_all_changes_when_foreign_translation_restricts_sentence(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    content_path = f"/v1/admin/content/{created['id']}"
    translation_path = f"{content_path}/translations/vi"
    payload = _translation_payload(created["sentences"])
    assert (
        admin_api.client.put(translation_path, json=payload, headers=_headers()).status_code == 200
    )
    foreign_id = _insert_foreign_vi_translation(admin_api, created["sentences"][0]["id"])
    before = admin_api.client.get(content_path, headers=_headers()).json()["data"]

    changed = admin_api.client.patch(
        content_path, json={"body": "word05 word06."}, headers=_headers()
    )
    assert changed.status_code == 409, changed.text
    after = admin_api.client.get(content_path, headers=_headers()).json()["data"]
    assert after["body"] == before["body"]
    assert [sentence["id"] for sentence in after["sentences"]] == [
        sentence["id"] for sentence in before["sentences"]
    ]
    assert [sentence["translationVi"] for sentence in after["sentences"]] == [
        sentence["translationVi"] for sentence in before["sentences"]
    ]
    with psycopg.connect(admin_api.database_url) as connection:
        foreign_count = connection.execute(
            "SELECT count(*) FROM sentence_translations WHERE id = %s", (foreign_id,)
        ).fetchone()
        owned_count = connection.execute(
            """
            SELECT count(*) FROM sentence_translations AS translation
            JOIN source_records AS record ON record.id = translation.source_record_id
            WHERE record.metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND record.metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
    assert foreign_count == (1,)
    assert owned_count == (len(created["sentences"]),)


def test_body_replacement_rolls_back_when_another_language_references_sentence(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    content_path = f"/v1/admin/content/{created['id']}"
    translation_path = f"{content_path}/translations/vi"
    payload = _translation_payload(created["sentences"])
    assert (
        admin_api.client.put(translation_path, json=payload, headers=_headers()).status_code == 200
    )
    other_language_id = _insert_foreign_vi_translation(
        admin_api, created["sentences"][0]["id"], target_language_code="en"
    )
    before = admin_api.client.get(content_path, headers=_headers()).json()["data"]

    changed = admin_api.client.patch(
        content_path, json={"body": "word05 word06."}, headers=_headers()
    )

    assert changed.status_code == 409, changed.text
    after = admin_api.client.get(content_path, headers=_headers()).json()["data"]
    assert after["body"] == before["body"]
    assert after["sentences"] == before["sentences"]
    with psycopg.connect(admin_api.database_url) as connection:
        other_language = connection.execute(
            "SELECT target_language_code, text FROM sentence_translations WHERE id = %s",
            (other_language_id,),
        ).fetchone()
        source_history = connection.execute(
            """
            SELECT count(*) FROM source_records
            WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
    assert other_language == ("en", "Bản dịch từ nguồn khác.")
    assert source_history == (1,)


def test_published_and_retired_translation_sets_are_immutable(admin_api: AdminApi) -> None:
    created = _create(admin_api)
    path = f"/v1/admin/content/{created['id']}/translations/vi"
    original = _translation_payload(created["sentences"])
    assert admin_api.client.put(path, json=original, headers=_headers()).status_code == 200
    replacement = _translation_payload(
        created["sentences"],
        [f"Thay đổi câu {index + 1}." for index in range(len(created["sentences"]))],
    )
    validation = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/validate", headers=_headers()
    )
    assert validation.status_code == 200 and validation.json()["data"]["isValid"] is True
    published = admin_api.client.post(
        f"/v1/admin/content/{created['id']}/publish", headers=_headers()
    )
    assert published.status_code == 200, published.text
    before_published = admin_api.client.get(
        f"/v1/admin/content/{created['id']}", headers=_headers()
    ).json()["data"]

    assert admin_api.client.put(path, json=replacement, headers=_headers()).status_code == 409
    assert admin_api.client.put(path, json={"entries": []}, headers=_headers()).status_code == 409
    after_published = admin_api.client.get(
        f"/v1/admin/content/{created['id']}", headers=_headers()
    ).json()["data"]
    assert after_published["sentences"] == before_published["sentences"]
    assert after_published["translationSource"] == before_published["translationSource"]

    retired = admin_api.client.post(f"/v1/admin/content/{created['id']}/retire", headers=_headers())
    assert retired.status_code == 200, retired.text
    assert admin_api.client.put(path, json=replacement, headers=_headers()).status_code == 409
    assert admin_api.client.put(path, json={"entries": []}, headers=_headers()).status_code == 409
    after_retired = admin_api.client.get(
        f"/v1/admin/content/{created['id']}", headers=_headers()
    ).json()["data"]
    assert after_retired["status"] == "retired"
    assert after_retired["sentences"] == before_published["sentences"]
    assert after_retired["translationSource"] == before_published["translationSource"]


def test_translation_and_body_replacement_race_serializes_on_content_row(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    content_path = f"/v1/admin/content/{created['id']}"
    translation_path = f"{content_path}/translations/vi"
    source_sentence_ids = [sentence["id"] for sentence in created["sentences"]]
    payload = _translation_payload(created["sentences"])

    translation_result, body_result = _run_two_requests_concurrently(
        lambda: admin_api.client.put(translation_path, json=payload, headers=_headers()),
        lambda: admin_api.client.patch(
            content_path, json={"body": "word05 word06."}, headers=_headers()
        ),
    )

    assert body_result.status_code == 200, body_result.text
    assert translation_result.status_code in {200, 422}, translation_result.text
    current = admin_api.client.get(content_path, headers=_headers())
    assert current.status_code == 200
    assert current.json()["data"]["body"] == "word05 word06."
    assert all(
        sentence["translationVi"] is None for sentence in current.json()["data"]["sentences"]
    )
    with psycopg.connect(admin_api.database_url) as connection:
        old_rows = connection.execute(
            "SELECT count(*) FROM sentence_translations WHERE sentence_id = ANY(%s::uuid[])",
            (source_sentence_ids,),
        ).fetchone()
        history = connection.execute(
            """
            SELECT count(*) FROM source_records
            WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchone()
    assert old_rows == (0,)
    assert history == (1 if translation_result.status_code == 200 else 0,)


def test_translation_and_validation_race_keeps_one_complete_owned_set(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    path = f"/v1/admin/content/{created['id']}/translations/vi"
    payload = _translation_payload(created["sentences"])

    translation_result, validation_result = _run_two_requests_concurrently(
        lambda: admin_api.client.put(path, json=payload, headers=_headers()),
        lambda: admin_api.client.post(
            f"/v1/admin/content/{created['id']}/validate", headers=_headers()
        ),
    )

    assert translation_result.status_code == validation_result.status_code == 200
    detail = admin_api.client.get(f"/v1/admin/content/{created['id']}", headers=_headers())
    assert detail.status_code == 200
    current = detail.json()["data"]
    assert current["status"] in {"normalized", "reviewed"}
    assert [sentence["translationVi"] for sentence in current["sentences"]] == [
        entry["translationText"] for entry in payload["entries"]
    ]
    with psycopg.connect(admin_api.database_url) as connection:
        translation_sources = connection.execute(
            """
            SELECT record.review_status
            FROM source_records AS record
            WHERE record.metadata ->> 'authoringVersion' = 'admin-translation-v1'
              AND record.metadata ->> 'contentId' = %s
            """,
            (created["id"],),
        ).fetchall()
    assert len(translation_sources) == 1
    expected_source_status = "approved" if current["status"] == "reviewed" else "normalized"
    assert translation_sources == [(expected_source_status,)]


def test_validation_waiting_behind_translation_preserves_import_timestamp_order(
    admin_api: AdminApi,
) -> None:
    base_time = datetime.now(UTC) + timedelta(minutes=2)
    validation_time = base_time + timedelta(seconds=1)
    translation_time = base_time + timedelta(seconds=2)
    clock = RoleClock(
        {"create": base_time, "validate": validation_time, "translate": translation_time}
    )
    application_name = "admin-content-timestamp-race"
    application_database_url = psycopg.conninfo.make_conninfo(
        admin_api.database_url, application_name=application_name
    )
    app = create_app(
        database_url=application_database_url,
        token_verifier=TokenVerifier(admin_api.owner, AuthenticatedActor(uuid.uuid4())),
        clock=clock,
        cursor_secret=b"admin-content-test-cursor-secret-32bytes",
        admin_user_ids=str(admin_api.owner.id),
    )
    api = AdminApi(
        TestClient(app, raise_server_exceptions=False), application_database_url, admin_api.owner
    )
    created = _create(api)
    content_id = created["id"]
    translation_payload = _translation_payload(created["sentences"])
    translation_path = f"/v1/admin/content/{content_id}/translations/vi"
    validation_path = f"/v1/admin/content/{content_id}/validate"

    locker = psycopg.connect(admin_api.database_url)
    executor = ThreadPoolExecutor(max_workers=2)
    translation_future = None
    validation_future = None
    try:
        locker.execute("SELECT id FROM content_items WHERE id = %s FOR UPDATE", (content_id,))
        clock.schedule("translate")
        translation_future = executor.submit(
            lambda: api.client.put(translation_path, json=translation_payload, headers=_headers()),
        )
        assert clock.captured["translate"].wait(timeout=5)
        _wait_for_pg_lock_waiters(application_database_url, application_name, expected=1)

        clock.schedule("validate")
        validation_future = executor.submit(
            lambda: api.client.post(validation_path, headers=_headers())
        )
        assert clock.captured["validate"].wait(timeout=5)
        _wait_for_pg_lock_waiters(application_database_url, application_name, expected=2)

        with psycopg.connect(admin_api.database_url) as connection:
            translations_before_release = connection.execute(
                """
                SELECT count(*)
                FROM source_records
                WHERE metadata ->> 'authoringVersion' = 'admin-translation-v1'
                  AND metadata ->> 'contentId' = %s
                """,
                (content_id,),
            ).fetchone()
        assert translations_before_release == (0,)
        assert translation_time > validation_time
        locker.commit()
    finally:
        if locker.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
            locker.rollback()
        executor.shutdown(wait=True, cancel_futures=True)
        locker.close()

    assert translation_future is not None and validation_future is not None
    translation_result = translation_future.result(timeout=30)
    validation_result = validation_future.result(timeout=30)
    assert translation_result.status_code == 200, translation_result.text
    assert validation_result.status_code == 200, validation_result.text
    assert validation_result.json()["data"]["isValid"] is True

    with psycopg.connect(admin_api.database_url) as connection:
        content_review = connection.execute(
            """
            SELECT item.reviewed_at, original.imported_at, original.reviewed_at
            FROM content_items AS item
            JOIN source_records AS original ON original.id = item.source_record_id
            WHERE item.id = %s
            """,
            (content_id,),
        ).fetchone()
        translation_reviews = connection.execute(
            """
            SELECT record.review_status, record.imported_at, record.reviewed_at
            FROM content_items AS item
            JOIN source_records AS record
              ON record.metadata ->> 'authoringVersion' = 'admin-translation-v1'
             AND record.metadata ->> 'contentId' = item.id::text
            WHERE item.id = %s
            """,
            (content_id,),
        ).fetchall()

    assert content_review is not None
    content_reviewed_at, original_imported_at, original_reviewed_at = content_review
    assert original_reviewed_at >= original_imported_at
    assert content_reviewed_at >= original_imported_at
    assert len(translation_reviews) == 1
    translation_status, translation_imported_at, translation_reviewed_at = translation_reviews[0]
    assert translation_status == "approved"
    assert translation_imported_at == translation_time
    assert translation_reviewed_at >= translation_imported_at
    assert content_reviewed_at >= translation_imported_at


def test_translation_and_publish_race_never_mutates_published_content(
    admin_api: AdminApi,
) -> None:
    created = _create(admin_api)
    content_id = created["id"]
    path = f"/v1/admin/content/{content_id}/translations/vi"
    payload = _translation_payload(created["sentences"])
    validation = admin_api.client.post(
        f"/v1/admin/content/{content_id}/validate", headers=_headers()
    )
    assert validation.status_code == 200 and validation.json()["data"]["isValid"] is True

    translation_result, publish_result = _run_two_requests_concurrently(
        lambda: admin_api.client.put(path, json=payload, headers=_headers()),
        lambda: admin_api.client.post(
            f"/v1/admin/content/{content_id}/publish", headers=_headers()
        ),
    )

    assert (translation_result.status_code, publish_result.status_code) in {
        (200, 409),
        (409, 200),
    }
    current = admin_api.client.get(f"/v1/admin/content/{content_id}", headers=_headers())
    assert current.status_code == 200
    data = current.json()["data"]
    if data["status"] == "published":
        assert translation_result.status_code == 409
        assert all(sentence["translationVi"] is None for sentence in data["sentences"])
        assert data["translationSource"] is None
    else:
        assert data["status"] == "normalized"
        assert translation_result.status_code == 200
        assert all(sentence["translationVi"] for sentence in data["sentences"])
        assert data["translationSource"] is not None
