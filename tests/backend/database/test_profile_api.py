from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import psycopg
import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.profile.domain import language_profile_etag

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return self.actor


@dataclass(frozen=True)
class ProfileApiSeed:
    actor: AuthenticatedActor
    client: TestClient
    database_url: str


@pytest.fixture
def profile_api(migrated_postgres_url: str) -> ProfileApiSeed:
    actor = AuthenticatedActor(uuid.uuid4(), "learner@example.com")
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
    app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        cursor_secret=b"profile-api-test-cursor-secret-32bytes",
    )
    return ProfileApiSeed(
        actor, TestClient(app, raise_server_exceptions=False), migrated_postgres_url
    )


def _headers(**extra: str) -> dict[str, str]:
    return {"Authorization": "Bearer valid-token", **extra}


def _bootstrap(seed: ProfileApiSeed) -> tuple[dict[str, object], str]:
    response = seed.client.get("/v1/me", headers=_headers())
    assert response.status_code == 200, response.text
    return response.json()["data"], response.headers["etag"]


def _ready(seed: ProfileApiSeed) -> str:
    _, etag = _bootstrap(seed)
    response = seed.client.patch(
        "/v1/me",
        headers=_headers(**{"If-Match": etag}),
        json={"timeZone": "Asia/Ho_Chi_Minh"},
    )
    assert response.status_code == 200, response.text
    return response.headers["etag"]


def _create(seed: ProfileApiSeed, key: uuid.UUID | None = None) -> tuple[dict[str, object], str]:
    response = seed.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(key or uuid.uuid4())}),
        json={
            "targetLanguageCode": "en",
            "nativeLanguageCode": "vi",
            "goal": "communication",
            "dailyMinutes": 20,
            "selfEstimatedLevelCode": "A1",
            "targetLevelCode": "B1",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"], response.headers["etag"]


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


def test_collection_child_etag_supports_stale_refetch_and_intentional_update(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    created, created_etag = _create(profile_api)
    profile_id = str(created["id"])
    client = profile_api.client
    first = client.get("/v1/me/languages", headers=_headers())
    assert first.status_code == 200
    assert "etag" not in first.headers  # Not a collection validator.
    e1 = first.json()["data"][0]["etag"]
    assert e1 == created["etag"] == created_etag
    assert e1 == language_profile_etag(uuid.UUID(profile_id), 1)
    assert client.get("/v1/me/languages", headers=_headers()).json()["data"] == first.json()["data"]
    parent = client.get("/v1/me", headers=_headers())
    assert parent.json()["data"]["languageProfiles"][0]["etag"] == e1
    assert parent.headers["etag"] != e1
    cross_resource = client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": parent.headers["etag"]}),
        json={"goal": "travel"},
    )
    assert cross_resource.status_code == 412
    updated = client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": e1}),
        json={"goal": "travel"},
    )
    assert updated.status_code == 200
    e2 = updated.json()["data"]["etag"]
    assert e2 == updated.headers["etag"] == language_profile_etag(uuid.UUID(profile_id), 2)
    assert e2 != e1
    stale = client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": e1}),
        json={"goal": "work"},
    )
    assert stale.status_code == 412
    assert stale.json()["error"]["code"] == "PRECONDITION_FAILED"
    refreshed = client.get("/v1/me/languages", headers=_headers())
    assert refreshed.json()["data"][0]["etag"] == e2
    assert refreshed.json()["data"][0]["goal"] == "travel"
    current = client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": refreshed.json()["data"][0]["etag"]}),
        json={"goal": "work"},
    )
    assert current.status_code == 200
    assert current.json()["data"]["etag"] == current.headers["etag"]
    assert current.headers["etag"] == language_profile_etag(uuid.UUID(profile_id), 3)
    noop = client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": current.headers["etag"]}),
        json={"goal": "work"},
    )
    assert noop.json()["data"] == current.json()["data"]
    assert noop.headers["etag"] == current.headers["etag"]
    _assert_contract_schema("LanguageProfilesResponse", refreshed.json())
    _assert_contract_schema("LanguageProfileResponse", current.json())
    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT revision FROM user_languages WHERE id = %s", (profile_id,)
        ).fetchone() == (3,)


def test_archived_collection_token_reactivates_same_identity_and_preserves_create_replay(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    key = uuid.uuid4()
    original, e1 = _create(profile_api, key)
    profile_id = str(original["id"])
    archived = profile_api.client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": e1}),
        json={"status": "archived"},
    )
    assert archived.status_code == 200
    listed = profile_api.client.get("/v1/me/languages", headers=_headers())
    child = listed.json()["data"][0]
    assert child["status"] == "archived"
    assert child["etag"] == archived.headers["etag"] != e1
    restored = profile_api.client.patch(
        f"/v1/me/languages/{child['id']}",
        headers=_headers(**{"If-Match": child["etag"]}),
        json={"status": "active"},
    )
    assert restored.status_code == 200
    assert restored.json()["data"]["id"] == profile_id
    assert restored.json()["data"]["status"] == "active"
    assert restored.json()["data"]["etag"] == restored.headers["etag"] != child["etag"]
    replay, replay_etag = _create(profile_api, key)
    assert replay == original
    assert replay["etag"] == replay_etag == e1
    assert replay_etag != restored.headers["etag"]
    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT id, revision FROM user_languages WHERE user_id = %s",
            (profile_api.actor.id,),
        ).fetchall() == [(uuid.UUID(profile_id), 3)]
        snapshot = connection.execute(
            "SELECT result_data_snapshot FROM profile_mutation_results WHERE user_id = %s",
            (profile_api.actor.id,),
        ).fetchone()
        assert snapshot is not None
        assert "etag" not in cast(dict[str, object], snapshot[0])
        # Existing pre-correction snapshot format suffices without rewriting history.


@pytest.mark.parametrize("status", ["active", "archived"])
def test_collection_never_discloses_foreign_child_or_token(
    profile_api: ProfileApiSeed,
    status: str,
) -> None:
    _ready(profile_api)
    owner_data, token = _create(profile_api)
    profile_id = str(owner_data["id"])
    if status == "archived":
        archived = profile_api.client.patch(
            f"/v1/me/languages/{profile_id}",
            headers=_headers(**{"If-Match": token}),
            json={"status": status},
        )
        token = archived.headers["etag"]
    stranger = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(profile_api.database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (stranger.id,))
    client = TestClient(
        create_app(
            database_url=profile_api.database_url,
            token_verifier=StubTokenVerifier(stranger),
            cursor_secret=b"profile-api-test-cursor-secret-32bytes",
        )
    )
    assert client.get("/v1/me", headers=_headers()).status_code == 200
    listed = client.get("/v1/me/languages", headers=_headers())
    assert listed.json()["data"] == []
    assert profile_id not in listed.text and token not in listed.text
    hidden_errors = []
    for target, supplied in ((profile_id, token), (profile_id, "*"), (str(uuid.uuid4()), token)):
        hidden = client.patch(
            f"/v1/me/languages/{target}",
            headers=_headers(**{"If-Match": supplied}),
            json={"status": "active"},
        )
        assert hidden.status_code == 404
        assert "etag" not in hidden.headers
        error = hidden.json()["error"]
        hidden_errors.append((error["code"], error["message"]))
    assert len(set(hidden_errors)) == 1


@pytest.mark.parametrize("invalid", [None, "malformed", "*", 'W/"weak"', '"a", "b"', '"stale"'])
def test_discoverable_token_does_not_relax_child_patch_preconditions(
    profile_api: ProfileApiSeed,
    invalid: str | None,
) -> None:
    _ready(profile_api)
    created, _ = _create(profile_api)
    headers = _headers() if invalid is None else _headers(**{"If-Match": invalid})
    response = profile_api.client.patch(
        f"/v1/me/languages/{created['id']}",
        headers=headers,
        json={"status": "archived"},
    )
    assert response.status_code == 412
    assert response.json()["error"]["code"] == "PRECONDITION_FAILED"
    current = profile_api.client.get("/v1/me/languages", headers=_headers())
    assert current.json()["data"] == [created]


def test_child_patch_rejects_repeated_current_if_match_headers(profile_api: ProfileApiSeed) -> None:
    _ready(profile_api)
    created, token = _create(profile_api)
    response = profile_api.client.patch(
        f"/v1/me/languages/{created['id']}",
        headers=[("Authorization", "Bearer valid-token"), ("If-Match", token), ("If-Match", token)],
        json={"status": "archived"},
    )
    assert response.status_code == 412
    assert response.json()["error"]["code"] == "PRECONDITION_FAILED"
    assert profile_api.client.get("/v1/me/languages", headers=_headers()).json()["data"] == [
        created
    ]


def test_get_me_is_the_only_minimal_bootstrap_and_returns_auth_email(
    profile_api: ProfileApiSeed,
) -> None:
    data, etag = _bootstrap(profile_api)

    assert data == {
        "id": str(profile_api.actor.id),
        "email": "learner@example.com",
        "displayName": None,
        "interfaceLanguageCode": "vi",
        "timeZone": None,
        "languageProfiles": [],
        "createdAt": data["createdAt"],
        "updatedAt": data["updatedAt"],
    }
    assert etag.startswith('"') and not etag.startswith("W/")
    response = profile_api.client.get("/v1/me", headers=_headers())
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["etag"] == etag

    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM users WHERE id = %s", (profile_api.actor.id,)
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT count(*) FROM learner_profiles WHERE user_id = %s", (profile_api.actor.id,)
        ).fetchone() == (1,)
        for table in (
            "user_languages",
            "learning_events",
            "review_items",
            "user_skill_states",
            "assessment_attempts",
            "today_plans",
        ):
            assert connection.execute(
                f"SELECT count(*) FROM {table} WHERE user_id = %s", (profile_api.actor.id,)
            ).fetchone() == (0,)


def test_get_me_returns_null_when_verified_token_has_no_email(
    migrated_postgres_url: str,
) -> None:
    actor = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
    app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        cursor_secret=b"profile-api-test-cursor-secret-32bytes",
    )

    response = TestClient(app, raise_server_exceptions=False).get("/v1/me", headers=_headers())

    assert response.status_code == 200
    assert response.json()["data"]["email"] is None
    with psycopg.connect(migrated_postgres_url) as connection:
        assert "email" not in {
            str(row[0])
            for row in connection.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name IN ('users', 'learner_profiles')
                """
            ).fetchall()
        }


def test_downstream_gets_never_bootstrap_application_identity(
    profile_api: ProfileApiSeed,
) -> None:
    requests: tuple[tuple[str, dict[str, str]], ...] = (
        ("/v1/today", {}),
        ("/v1/brain/summary", {}),
        ("/v1/review/queue", {}),
        ("/v1/content/recommended", {}),
    )
    for path, params in requests:
        response = profile_api.client.get(path, headers=_headers(), params=params)
        assert response.status_code == 404, (path, response.text)
        assert response.json()["error"]["code"] == "NOT_FOUND"

    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM users WHERE id = %s", (profile_api.actor.id,)
        ).fetchone() == (0,)
        assert connection.execute(
            "SELECT count(*) FROM learner_profiles WHERE user_id = %s", (profile_api.actor.id,)
        ).fetchone() == (0,)


def test_concurrent_first_bootstrap_converges_on_one_identity(profile_api: ProfileApiSeed) -> None:
    def get_me() -> tuple[int, str, str]:
        response = profile_api.client.get("/v1/me", headers=_headers())
        return response.status_code, response.headers["etag"], response.json()["data"]["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: get_me(), range(2)))

    assert {result[0] for result in results} == {200}
    assert {result[1] for result in results}.__len__() == 1
    assert {result[2] for result in results} == {str(profile_api.actor.id)}


def test_bootstrap_rejects_stale_auth_and_never_resurrects_tombstoned_user(
    migrated_postgres_url: str,
) -> None:
    stale_actor = AuthenticatedActor(uuid.uuid4())
    stale_app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(stale_actor),
        cursor_secret=b"profile-api-test-cursor-secret-32bytes",
    )
    stale_response = TestClient(stale_app, raise_server_exceptions=False).get(
        "/v1/me", headers=_headers()
    )
    assert stale_response.status_code == 403
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM users WHERE id = %s", (stale_actor.id,)
        ).fetchone() == (0,)

    deleted_actor = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (deleted_actor.id,))
        connection.execute(
            "INSERT INTO users (id, deleted_at) VALUES (%s, now())", (deleted_actor.id,)
        )
    deleted_app = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(deleted_actor),
        cursor_secret=b"profile-api-test-cursor-secret-32bytes",
    )
    deleted_response = TestClient(deleted_app, raise_server_exceptions=False).get(
        "/v1/me", headers=_headers()
    )
    assert deleted_response.status_code == 403
    with psycopg.connect(migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM learner_profiles WHERE user_id = %s", (deleted_actor.id,)
        ).fetchone() == (0,)


@pytest.mark.parametrize("if_match", [None, "*", 'W/"weak"', '"one", "two"', '"stale"'])
def test_patch_me_rejects_every_invalid_precondition(
    profile_api: ProfileApiSeed, if_match: str | None
) -> None:
    _bootstrap(profile_api)
    headers = _headers()
    if if_match is not None:
        headers["If-Match"] = if_match

    response = profile_api.client.patch("/v1/me", headers=headers, json={"displayName": "Anh Minh"})

    assert response.status_code == 412
    assert response.json()["error"]["code"] == "PRECONDITION_FAILED"


def test_patch_me_rejects_multiple_if_match_header_lines(profile_api: ProfileApiSeed) -> None:
    _, etag = _bootstrap(profile_api)

    response = profile_api.client.patch(
        "/v1/me",
        headers=[
            ("Authorization", "Bearer valid-token"),
            ("If-Match", etag),
            ("If-Match", etag),
        ],
        json={"displayName": "Anh Minh"},
    )

    assert response.status_code == 412
    assert response.json()["error"]["code"] == "PRECONDITION_FAILED"


def test_patch_me_validates_timezone_and_noop_preserves_revision(
    profile_api: ProfileApiSeed,
) -> None:
    _, etag = _bootstrap(profile_api)
    invalid = profile_api.client.patch(
        "/v1/me",
        headers=_headers(**{"If-Match": etag}),
        json={"timeZone": "+07:00"},
    )
    assert invalid.status_code == 422

    updated = profile_api.client.patch(
        "/v1/me",
        headers=_headers(**{"If-Match": etag}),
        json={"displayName": "Anh Minh", "timeZone": "Asia/Ho_Chi_Minh"},
    )
    assert updated.status_code == 200
    updated_etag = updated.headers["etag"]
    assert updated_etag != etag
    assert updated.json()["data"]["timeZone"] == "Asia/Ho_Chi_Minh"

    noop = profile_api.client.patch(
        "/v1/me",
        headers=_headers(**{"If-Match": updated_etag}),
        json={"displayName": "Anh Minh"},
    )
    assert noop.status_code == 200
    assert noop.headers["etag"] == updated_etag


def test_language_create_requires_timezone_and_exact_replay_survives_later_update(
    profile_api: ProfileApiSeed,
) -> None:
    _bootstrap(profile_api)
    key = uuid.uuid4()
    request = {
        "targetLanguageCode": "en",
        "nativeLanguageCode": "vi",
        "goal": "communication",
        "dailyMinutes": 20,
        "selfEstimatedLevelCode": "A1",
        "targetLevelCode": "B1",
    }
    blocked = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(key)}),
        json=request,
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "INVALID_STATE_TRANSITION"

    _ready(profile_api)
    created = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(key)}),
        json=request,
    )
    assert created.status_code == 201
    original_data = created.json()["data"]
    original_etag = created.headers["etag"]
    assert original_data["nativeLanguageCode"] == "vi"
    assert original_data["targetLanguageCode"] == "en"
    assert original_data["targetLevel"]["code"] == "B1"
    assert original_data["startingLevelEstimate"] is None
    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            """
            SELECT current.code, target.code, language.interface_language_code
            FROM user_languages AS language
            LEFT JOIN proficiency_levels AS current ON current.id = language.current_level_id
            LEFT JOIN proficiency_levels AS target ON target.id = language.target_level_id
            WHERE language.id = %s AND language.user_id = %s
            """,
            (uuid.UUID(str(original_data["id"])), profile_api.actor.id),
        ).fetchone() == ("A1", "B1", None)

    changed = profile_api.client.patch(
        f"/v1/me/languages/{original_data['id']}",
        headers=_headers(**{"If-Match": original_etag}),
        json={"goal": "travel", "dailyMinutes": 30},
    )
    assert changed.status_code == 200
    assert changed.json()["data"]["goal"] == "travel"

    replay = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(key)}),
        json=request,
    )
    assert replay.status_code == 201
    assert replay.json()["data"] == original_data
    assert replay.headers["etag"] == original_etag
    assert replay.json()["meta"]["requestId"] != created.json()["meta"]["requestId"]


def test_language_create_rejects_key_reuse_and_lifetime_duplicate(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    key = uuid.uuid4()
    _create(profile_api, key)

    reused = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(key)}),
        json={
            "targetLanguageCode": "en",
            "nativeLanguageCode": "vi",
            "goal": "travel",
            "dailyMinutes": 20,
        },
    )
    assert reused.status_code == 409
    assert reused.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

    duplicate = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(uuid.uuid4())}),
        json={
            "targetLanguageCode": "en",
            "nativeLanguageCode": "vi",
            "goal": "communication",
            "dailyMinutes": 20,
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CONFLICT"


def test_concurrent_same_key_language_create_replays_one_committed_result(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    key = uuid.uuid4()
    request = {
        "targetLanguageCode": "en",
        "nativeLanguageCode": "vi",
        "goal": "communication",
        "dailyMinutes": 20,
    }

    def create() -> tuple[int, dict[str, object], str]:
        response = profile_api.client.post(
            "/v1/me/languages",
            headers=_headers(**{"Idempotency-Key": str(key)}),
            json=request,
        )
        return response.status_code, response.json()["data"], response.headers["etag"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: create(), range(2)))

    assert [result[0] for result in results] == [201, 201]
    assert results[0][1] == results[1][1]
    assert results[0][2] == results[1][2]
    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM user_languages WHERE user_id = %s", (profile_api.actor.id,)
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s",
            (profile_api.actor.id,),
        ).fetchone() == (1,)


def test_concurrent_same_key_different_language_payloads_accept_exactly_one_command(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    key = uuid.uuid4()

    def create(goal: str) -> tuple[int, str | None]:
        response = profile_api.client.post(
            "/v1/me/languages",
            headers=_headers(**{"Idempotency-Key": str(key)}),
            json={
                "targetLanguageCode": "en",
                "nativeLanguageCode": "vi",
                "goal": goal,
                "dailyMinutes": 20,
            },
        )
        payload = response.json()
        error = payload.get("error")
        code = None if error is None else str(error["code"])
        return response.status_code, code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, ("communication", "travel")))

    assert sorted(status for status, _ in results) == [201, 409]
    assert [code for status, code in results if status == 409] == ["IDEMPOTENCY_KEY_REUSED"]
    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM user_languages WHERE user_id = %s", (profile_api.actor.id,)
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT count(*) FROM profile_mutation_results WHERE user_id = %s",
            (profile_api.actor.id,),
        ).fetchone() == (1,)


@pytest.mark.parametrize(
    ("goal", "daily_minutes"),
    [
        ("communication", 5),
        ("work", 180),
        ("travel", 20),
        ("basics", 20),
        ("academic", 20),
    ],
)
def test_language_create_accepts_registry_goals_and_daily_minute_boundaries(
    profile_api: ProfileApiSeed, goal: str, daily_minutes: int
) -> None:
    _ready(profile_api)
    response = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(uuid.uuid4())}),
        json={
            "targetLanguageCode": "en",
            "nativeLanguageCode": "vi",
            "goal": goal,
            "dailyMinutes": daily_minutes,
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["data"]["goal"] == goal
    assert response.json()["data"]["dailyMinutes"] == daily_minutes


@pytest.mark.parametrize(
    "override",
    [
        {"targetLanguageCode": "fr"},
        {"nativeLanguageCode": "fr"},
        {"goal": "general"},
        {"dailyMinutes": 4},
        {"dailyMinutes": 181},
    ],
)
def test_language_create_rejects_unsupported_pair_goal_and_daily_minute_values(
    profile_api: ProfileApiSeed, override: dict[str, object]
) -> None:
    _ready(profile_api)
    body: dict[str, object] = {
        "targetLanguageCode": "en",
        "nativeLanguageCode": "vi",
        "goal": "communication",
        "dailyMinutes": 20,
    }
    body.update(override)

    response = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(uuid.uuid4())}),
        json=body,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_learner_revision_change_does_not_invalidate_language_profile_etag(
    profile_api: ProfileApiSeed,
) -> None:
    _, learner_etag = _bootstrap(profile_api)
    profile_api.client.patch(
        "/v1/me",
        headers=_headers(**{"If-Match": learner_etag}),
        json={"timeZone": "Asia/Ho_Chi_Minh"},
    )
    data, language_etag = _create(profile_api)
    current_me = profile_api.client.get("/v1/me", headers=_headers())
    updated_me = profile_api.client.patch(
        "/v1/me",
        headers=_headers(**{"If-Match": current_me.headers["etag"]}),
        json={"displayName": "Anh Minh"},
    )
    assert updated_me.status_code == 200

    language_update = profile_api.client.patch(
        f"/v1/me/languages/{data['id']}",
        headers=_headers(**{"If-Match": language_etag}),
        json={"goal": "work"},
    )
    assert language_update.status_code == 200, language_update.text


def test_concurrent_patch_with_one_etag_accepts_one_writer_and_advances_parent_revision(
    profile_api: ProfileApiSeed,
) -> None:
    parent_before, parent_etag_before = _bootstrap(profile_api)
    _ready(profile_api)
    data, language_etag = _create(profile_api)
    parent_after_create, parent_etag_after_create = _bootstrap(profile_api)
    assert parent_etag_after_create != parent_etag_before
    assert parent_after_create["updatedAt"] != parent_before["updatedAt"]

    def patch(goal: str) -> int:
        response = profile_api.client.patch(
            f"/v1/me/languages/{data['id']}",
            headers=_headers(**{"If-Match": language_etag}),
            json={"goal": goal},
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(patch, ("travel", "work")))

    assert statuses == [200, 412]
    _, parent_etag_after_patch = _bootstrap(profile_api)
    assert parent_etag_after_patch != parent_etag_after_create


def test_language_patch_hides_foreign_resource_before_etag_and_reactivates_same_row(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    data, etag = _create(profile_api)
    profile_id = str(data["id"])

    hidden = profile_api.client.patch(
        f"/v1/me/languages/{uuid.uuid4()}",
        headers=_headers(**{"If-Match": '"stale"'}),
        json={"goal": "travel"},
    )
    assert hidden.status_code == 404

    other_id = uuid.uuid4()
    with psycopg.connect(profile_api.database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (other_id,))
        connection.execute("INSERT INTO users (id) VALUES (%s)", (other_id,))
        connection.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (other_id,),
        )
        foreign = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, native_language_code, goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'work', 20) RETURNING id
            """,
            (other_id,),
        ).fetchone()
    assert foreign is not None
    foreign_hidden = profile_api.client.patch(
        f"/v1/me/languages/{foreign[0]}",
        headers=_headers(**{"If-Match": '"stale"'}),
        json={"goal": "travel"},
    )
    assert foreign_hidden.status_code == hidden.status_code == 404
    assert foreign_hidden.json()["error"]["code"] == hidden.json()["error"]["code"]
    assert foreign_hidden.json()["error"]["message"] == hidden.json()["error"]["message"]

    archived = profile_api.client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": etag}),
        json={"status": "archived"},
    )
    assert archived.status_code == 200
    archived_etag = archived.headers["etag"]
    assert archived.json()["data"]["id"] == profile_id

    duplicate_after_archive = profile_api.client.post(
        "/v1/me/languages",
        headers=_headers(**{"Idempotency-Key": str(uuid.uuid4())}),
        json={
            "targetLanguageCode": "en",
            "nativeLanguageCode": "vi",
            "goal": "communication",
            "dailyMinutes": 20,
        },
    )
    assert duplicate_after_archive.status_code == 409
    assert duplicate_after_archive.json()["error"]["code"] == "CONFLICT"

    restored = profile_api.client.patch(
        f"/v1/me/languages/{profile_id}",
        headers=_headers(**{"If-Match": archived_etag}),
        json={"status": "active"},
    )
    assert restored.status_code == 200
    assert restored.json()["data"]["id"] == profile_id

    listed = profile_api.client.get("/v1/me/languages", headers=_headers())
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["data"]] == [profile_id]


def test_today_fails_closed_without_timezone_and_persists_no_plan(
    profile_api: ProfileApiSeed,
) -> None:
    _bootstrap(profile_api)
    with psycopg.connect(profile_api.database_url) as connection:
        row = connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, native_language_code, goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'communication', 20)
            RETURNING id
            """,
            (profile_api.actor.id,),
        ).fetchone()
    assert row is not None
    profile_id = uuid.UUID(str(row[0]))

    response = profile_api.client.get(
        "/v1/today",
        headers=_headers(),
        params={"languageProfileId": str(profile_id)},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE_TRANSITION"
    with psycopg.connect(profile_api.database_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM today_plans WHERE user_id = %s", (profile_api.actor.id,)
        ).fetchone() == (0,)


def test_brain_resolves_profile_from_native_language_not_legacy_interface_snapshot(
    profile_api: ProfileApiSeed,
) -> None:
    _ready(profile_api)
    data, _ = _create(profile_api)

    response = profile_api.client.get(
        "/v1/brain/summary",
        headers=_headers(),
        params={"languageProfileId": str(data["id"])},
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"]["languageProfileId"] == data["id"]


def test_profile_success_envelopes_conform_to_frozen_openapi(profile_api: ProfileApiSeed) -> None:
    me = profile_api.client.get("/v1/me", headers=_headers())
    assert me.status_code == 200
    _assert_contract_schema("MeResponse", me.json())

    _ready(profile_api)
    created_data, _ = _create(profile_api)
    created = profile_api.client.get("/v1/me/languages", headers=_headers())
    assert created.status_code == 200
    _assert_contract_schema("LanguageProfilesResponse", created.json())
    _assert_contract_schema(
        "LanguageProfileResponse",
        {
            "data": created_data,
            "meta": {"requestId": str(uuid.uuid4()), "apiVersion": "1.0"},
        },
    )
