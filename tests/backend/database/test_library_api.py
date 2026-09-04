from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, cast
from unittest.mock import patch

import psycopg
import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.memory.store import PostgresMemoryStore

ROOT = Path(__file__).resolve().parents[3]
READER_SEED = ROOT / "database" / "seeds" / "task008_reader_mvp.sql"
NOW: Final = datetime(2026, 8, 30, 3, 0, tzinfo=UTC)

CONCEPT_ONE: Final = uuid.UUID("30000000-0000-4000-8000-000000000001")
CONCEPT_TWO: Final = uuid.UUID("30000000-0000-4000-8000-000000000002")
CONTENT_ONE: Final = uuid.UUID("40000000-0000-4000-8000-000000000001")
SENTENCE_ONE: Final = uuid.UUID("50000000-0000-4000-8000-000000000001")


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
class LibraryApiFixture:
    actor: AuthenticatedActor
    profile_id: uuid.UUID
    client: TestClient
    database_url: str


@pytest.fixture
def library_api(migrated_postgres_url: str) -> LibraryApiFixture:
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
        connection.commit()

    actor = AuthenticatedActor(actor_id)
    application = create_app(
        database_url=migrated_postgres_url,
        token_verifier=StubTokenVerifier(actor),
        clock=FixedClock(),
        cursor_secret=b"library-api-test-cursor-secret-32b",
    )
    return LibraryApiFixture(
        actor=actor,
        profile_id=uuid.UUID(str(profile[0])),
        client=TestClient(application),
        database_url=migrated_postgres_url,
    )


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
        return {k: resolve(v) for k, v in value.items()}

    raw_schema = contract["components"]["schemas"][schema_name]
    schema = cast(dict[str, object], resolve(deepcopy(raw_schema)))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)


def test_put_concept_creates_membership_intent_event_and_fsrs_lineage(
    library_api: LibraryApiFixture,
) -> None:
    res = library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    _assert_contract_schema("LibraryMutationResponse", body)
    assert body["data"]["isSaved"] is True
    assert body["data"]["itemType"] == "concept"

    with psycopg.connect(library_api.database_url) as conn:
        # 1. user_saved_concepts
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 1

        # 2. concept_save_intents
        intent = conn.execute(
            """
            SELECT id, user_language_id, language_code
            FROM concept_save_intents
            WHERE user_id = %s AND concept_id = %s
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert intent is not None
        assert intent[1] == library_api.profile_id
        assert intent[2] == "en"

        # 3. learning_events
        event = conn.execute(
            """
            SELECT event_type, source_type, source_event_id, derivation_key
            FROM learning_events
            WHERE user_id = %s AND concept_id = %s
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert event is not None
        assert event[0] == "learning.concept.saved.v1"
        assert event[1] == "concept_save_intent"
        assert event[2] == intent[0]
        assert event[3] == f"concept:{CONCEPT_ONE}"

        # 4. user_concept_states
        state = conn.execute(
            """
            SELECT status, has_learning_intent, recognition_positive_mass
            FROM user_concept_states
            WHERE user_id = %s AND concept_id = %s
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert state is not None
        assert state[0] == "learning"
        assert state[1] is True
        assert state[2] == 0

        # 5. review_items
        ri = conn.execute(
            "SELECT id, created_from FROM review_items WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert ri is not None
        assert ri[1] == "learner_saved"

        # 6. fsrs_states
        fsrs = conn.execute(
            "SELECT state, stability, difficulty FROM fsrs_states WHERE review_item_id = %s",
            (ri[0],),
        ).fetchone()
        assert fsrs is not None
        assert fsrs[0] == "new"


def test_put_concept_repeated_is_idempotent_and_does_not_reset_fsrs(
    library_api: LibraryApiFixture,
) -> None:
    # First save
    res1 = library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res1.status_code == 200

    # Simulate user studying and mutating FSRS card
    with psycopg.connect(library_api.database_url) as conn:
        conn.execute(
            """
            UPDATE fsrs_states
            SET state = 'review', stability = 4.5, difficulty = 3.2,
                last_review_at = '2026-08-30 02:00:00+00', step = NULL
            WHERE review_item_id IN (
                SELECT id FROM review_items
                WHERE user_id = %s AND concept_id = %s
            )
            """,
            (library_api.actor.id, CONCEPT_ONE),
        )
        conn.commit()

    # Second save (idempotent PUT)
    res2 = library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res2.status_code == 200
    assert res2.json()["data"]["isSaved"] is True

    # Check invariants: exactly 1 intent, 1 learning event, FSRS NOT reset
    with psycopg.connect(library_api.database_url) as conn:
        intent_count = conn.execute(
            "SELECT count(*) FROM concept_save_intents WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert intent_count is not None and intent_count[0] == 1

        event_count = conn.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert event_count is not None and event_count[0] == 1

        fsrs = conn.execute(
            """
            SELECT state, stability FROM fsrs_states
            WHERE review_item_id IN (
                SELECT id FROM review_items
                WHERE user_id = %s AND concept_id = %s
            )
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert fsrs is not None
        assert fsrs[0] == "review"
        assert float(fsrs[1]) == pytest.approx(4.5)


def test_put_concept_concurrent_converges_safely(
    library_api: LibraryApiFixture,
) -> None:
    def call_save() -> int:
        r = library_api.client.put(
            f"/v1/library/concepts/{CONCEPT_TWO}",
            params={"languageProfileId": str(library_api.profile_id)},
            headers=_headers(),
        )
        return r.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(call_save)
        f2 = executor.submit(call_save)
        status1 = f1.result()
        status2 = f2.result()

    assert status1 == 200
    assert status2 == 200

    with psycopg.connect(library_api.database_url) as conn:
        saved_count = conn.execute(
            "SELECT count(*) FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_TWO),
        ).fetchone()
        assert saved_count is not None and saved_count[0] == 1

        intent_count = conn.execute(
            "SELECT count(*) FROM concept_save_intents WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_TWO),
        ).fetchone()
        assert intent_count is not None and intent_count[0] == 1

        event_count = conn.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_TWO),
        ).fetchone()
        assert event_count is not None and event_count[0] == 1

        review_count = conn.execute(
            "SELECT count(*) FROM review_items WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_TWO),
        ).fetchone()
        assert review_count is not None and review_count[0] == 1


def test_delete_concept_unsaves_but_preserves_intent_and_memory(
    library_api: LibraryApiFixture,
) -> None:
    # Save first
    res = library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res.status_code == 200

    # Delete (unsave)
    del_res = library_api.client.delete(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert del_res.status_code == 200
    del_body = del_res.json()
    _assert_contract_schema("LibraryMutationResponse", del_body)
    assert del_body["data"]["isSaved"] is False
    assert del_body["data"]["itemType"] == "concept"

    with psycopg.connect(library_api.database_url) as conn:
        # user_saved_concepts MUST be empty
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 0

        # Memory and intent MUST be preserved intact
        intent = conn.execute(
            "SELECT count(*) FROM concept_save_intents WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert intent is not None and intent[0] == 1

        event = conn.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert event is not None and event[0] == 1

        ri = conn.execute(
            "SELECT count(*) FROM review_items WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert ri is not None and ri[0] == 1

        fsrs = conn.execute(
            """
            SELECT count(*) FROM fsrs_states
            WHERE review_item_id IN (
                SELECT id FROM review_items
                WHERE user_id = %s AND concept_id = %s
            )
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert fsrs is not None and fsrs[0] == 1

        state = conn.execute(
            """
            SELECT has_learning_intent FROM user_concept_states
            WHERE user_id = %s AND concept_id = %s
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert state is not None and state[0] is True

    # Repeated DELETE is idempotent
    del_res2 = library_api.client.delete(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert del_res2.status_code == 200
    assert del_res2.json()["data"]["isSaved"] is False


def test_put_concept_resave_restores_membership_without_resetting_fsrs_or_intent(
    library_api: LibraryApiFixture,
) -> None:
    # 1. Save
    library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )

    # 2. Advance FSRS
    with psycopg.connect(library_api.database_url) as conn:
        conn.execute(
            """
            UPDATE fsrs_states
            SET state = 'review', stability = 10.2, difficulty = 2.5,
                last_review_at = '2026-08-30 02:00:00+00', step = NULL
            WHERE review_item_id IN (
                SELECT id FROM review_items
                WHERE user_id = %s AND concept_id = %s
            )
            """,
            (library_api.actor.id, CONCEPT_ONE),
        )
        conn.commit()

    # 3. Unsave
    del_res = library_api.client.delete(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert del_res.status_code == 200

    # 4. Resave
    resave = library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert resave.status_code == 200
    assert resave.json()["data"]["isSaved"] is True

    with psycopg.connect(library_api.database_url) as conn:
        # Membership is back
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 1

        # Intent was NOT duplicated
        intent = conn.execute(
            "SELECT count(*) FROM concept_save_intents WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert intent is not None and intent[0] == 1

        # Learning event was NOT duplicated
        event = conn.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert event is not None and event[0] == 1

        # FSRS state was NOT reset!
        fsrs = conn.execute(
            """
            SELECT state, stability FROM fsrs_states
            WHERE review_item_id IN (
                SELECT id FROM review_items
                WHERE user_id = %s AND concept_id = %s
            )
            """,
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert fsrs is not None
        assert fsrs[0] == "review"
        assert float(fsrs[1]) == pytest.approx(10.2)


def test_sentence_save_and_unsave_does_not_activate_memory(
    library_api: LibraryApiFixture,
) -> None:
    # Save sentence
    res = library_api.client.put(
        f"/v1/library/sentences/{SENTENCE_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    _assert_contract_schema("LibraryMutationResponse", body)
    assert body["data"]["isSaved"] is True
    assert body["data"]["itemType"] == "sentence"

    with psycopg.connect(library_api.database_url) as conn:
        # Sentence saved
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_sentences WHERE user_id = %s AND sentence_id = %s",
            (library_api.actor.id, SENTENCE_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 1

        # Invariant GAP-01: Sentence save MUST NOT activate Memory!
        reviews = conn.execute(
            "SELECT count(*) FROM review_items WHERE user_id = %s",
            (library_api.actor.id,),
        ).fetchone()
        assert reviews is not None and reviews[0] == 0

    # Unsave sentence
    del_res = library_api.client.delete(
        f"/v1/library/sentences/{SENTENCE_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["isSaved"] is False

    with psycopg.connect(library_api.database_url) as conn:
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_sentences WHERE user_id = %s AND sentence_id = %s",
            (library_api.actor.id, SENTENCE_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 0


def test_content_save_and_unsave_does_not_activate_memory(
    library_api: LibraryApiFixture,
) -> None:
    # Save content
    res = library_api.client.put(
        f"/v1/library/content/{CONTENT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    _assert_contract_schema("LibraryMutationResponse", body)
    assert body["data"]["isSaved"] is True
    assert body["data"]["itemType"] == "content"

    with psycopg.connect(library_api.database_url) as conn:
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_content WHERE user_id = %s AND content_id = %s",
            (library_api.actor.id, CONTENT_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 1

        # GAP-01: Content save MUST NOT activate Memory!
        reviews = conn.execute(
            "SELECT count(*) FROM review_items WHERE user_id = %s",
            (library_api.actor.id,),
        ).fetchone()
        assert reviews is not None and reviews[0] == 0

    # Unsave content
    del_res = library_api.client.delete(
        f"/v1/library/content/{CONTENT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["isSaved"] is False

    with psycopg.connect(library_api.database_url) as conn:
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_content WHERE user_id = %s AND content_id = %s",
            (library_api.actor.id, CONTENT_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 0


def test_transaction_rollback_on_mid_operation_failure(
    library_api: LibraryApiFixture,
) -> None:
    # Monkeypatch Memory store ensure_lineage to raise mid-transaction
    def failing_ensure_lineage(*args: object, **kwargs: object) -> tuple[uuid.UUID, bool]:
        raise RuntimeError("Simulated memory engine transient failure")

    with (
        patch.object(PostgresMemoryStore, "ensure_lineage", side_effect=failing_ensure_lineage),
        pytest.raises(RuntimeError, match="Simulated memory engine transient failure"),
    ):
        library_api.client.put(
            f"/v1/library/concepts/{CONCEPT_ONE}",
            params={"languageProfileId": str(library_api.profile_id)},
            headers=_headers(),
        )

    # Invariant: Entire transaction must have rolled back cleanly
    with psycopg.connect(library_api.database_url) as conn:
        saved = conn.execute(
            "SELECT count(*) FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert saved is not None and saved[0] == 0

        intents = conn.execute(
            "SELECT count(*) FROM concept_save_intents WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert intents is not None and intents[0] == 0

        events = conn.execute(
            "SELECT count(*) FROM learning_events WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert events is not None and events[0] == 0

        reviews = conn.execute(
            "SELECT count(*) FROM review_items WHERE user_id = %s AND concept_id = %s",
            (library_api.actor.id, CONCEPT_ONE),
        ).fetchone()
        assert reviews is not None and reviews[0] == 0


def test_library_authorization_and_ownership(
    library_api: LibraryApiFixture,
) -> None:
    # 1. Missing auth header -> 401
    unauth = library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
    )
    assert unauth.status_code == 401

    # 2. User with NO active language profile -> 404
    other_user_id = uuid.uuid4()
    with psycopg.connect(library_api.database_url) as conn:
        conn.execute("INSERT INTO auth.users (id) VALUES (%s)", (other_user_id,))
        conn.execute("INSERT INTO users (id) VALUES (%s)", (other_user_id,))
        conn.execute(
            "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (other_user_id,),
        )
        conn.commit()

    other_actor = AuthenticatedActor(other_user_id)
    other_app = create_app(
        database_url=library_api.database_url,
        token_verifier=StubTokenVerifier(other_actor),
        clock=FixedClock(),
        cursor_secret=b"library-api-test-cursor-secret-32b",
    )
    other_client = TestClient(other_app)
    bad_prof = other_client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        headers=_headers(),
    )
    assert bad_prof.status_code == 404

    # 3. Nonexistent concept -> 404
    bad_concept = uuid.uuid4()
    not_found = library_api.client.put(
        f"/v1/library/concepts/{bad_concept}",
        headers=_headers(),
    )
    assert not_found.status_code == 404

    # 4. User without profile cannot list items -> 404
    bad_list = other_client.get(
        "/v1/library/items",
        headers=_headers(),
    )
    assert bad_list.status_code == 404


def test_get_library_items_unified_filter_and_keyset_pagination(
    library_api: LibraryApiFixture,
) -> None:
    # Save 2 concepts, 1 content item, 1 sentence
    library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    library_api.client.put(
        f"/v1/library/concepts/{CONCEPT_TWO}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    library_api.client.put(
        f"/v1/library/content/{CONTENT_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    library_api.client.put(
        f"/v1/library/sentences/{SENTENCE_ONE}",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )

    # 1. Fetch all items (unified)
    res = library_api.client.get(
        "/v1/library/items",
        params={"languageProfileId": str(library_api.profile_id)},
        headers=_headers(),
    )
    assert res.status_code == 200
    body = res.json()
    _assert_contract_schema("LibraryItemsResponse", body)
    assert len(body["data"]) == 4
    types = {item["itemType"] for item in body["data"]}
    assert types == {"concept", "content", "sentence"}

    # 2. Filter itemType=concept
    concept_res = library_api.client.get(
        "/v1/library/items",
        params={"languageProfileId": str(library_api.profile_id), "itemType": "concept"},
        headers=_headers(),
    )
    assert concept_res.status_code == 200
    c_body = concept_res.json()
    _assert_contract_schema("LibraryItemsResponse", c_body)
    assert len(c_body["data"]) == 2
    for it in c_body["data"]:
        assert it["itemType"] == "concept"
        assert "concept" in it

    # 3. Filter itemType=content
    content_res = library_api.client.get(
        "/v1/library/items",
        params={"languageProfileId": str(library_api.profile_id), "itemType": "content"},
        headers=_headers(),
    )
    assert content_res.status_code == 200
    cnt_body = content_res.json()
    _assert_contract_schema("LibraryItemsResponse", cnt_body)
    assert len(cnt_body["data"]) == 1
    assert cnt_body["data"][0]["itemType"] == "content"
    assert cnt_body["data"][0]["content"]["id"] == str(CONTENT_ONE)
    assert cnt_body["data"][0]["content"]["isSaved"] is True

    # 4. Filter itemType=sentence
    sentence_res = library_api.client.get(
        "/v1/library/items",
        params={"languageProfileId": str(library_api.profile_id), "itemType": "sentence"},
        headers=_headers(),
    )
    assert sentence_res.status_code == 200
    s_body = sentence_res.json()
    _assert_contract_schema("LibraryItemsResponse", s_body)
    assert len(s_body["data"]) == 1
    assert s_body["data"][0]["itemType"] == "sentence"
    assert s_body["data"][0]["sentence"]["id"] == str(SENTENCE_ONE)

    # 5. Keyset pagination with limit=2
    page1 = library_api.client.get(
        "/v1/library/items",
        params={"languageProfileId": str(library_api.profile_id), "limit": 2},
        headers=_headers(),
    )
    assert page1.status_code == 200
    p1_body = page1.json()
    assert len(p1_body["data"]) == 2
    assert p1_body["meta"]["hasMore"] is True
    cursor = p1_body["meta"]["nextCursor"]
    assert cursor is not None

    page2 = library_api.client.get(
        "/v1/library/items",
        params={
            "languageProfileId": str(library_api.profile_id),
            "limit": 2,
            "cursor": cursor,
        },
        headers=_headers(),
    )
    assert page2.status_code == 200
    p2_body = page2.json()
    assert len(p2_body["data"]) == 2
    assert p2_body["meta"]["hasMore"] is False

    # Page 1 and Page 2 items must be disjoint
    p1_ids = {it[it["itemType"]]["id"] for it in p1_body["data"]}
    p2_ids = {it[it["itemType"]]["id"] for it in p2_body["data"]}
    assert p1_ids.isdisjoint(p2_ids)

    # 6. Tampered cursor -> 422
    bad_cursor_res = library_api.client.get(
        "/v1/library/items",
        params={"languageProfileId": str(library_api.profile_id), "cursor": "invalid-cursor"},
        headers=_headers(),
    )
    assert bad_cursor_res.status_code == 422
