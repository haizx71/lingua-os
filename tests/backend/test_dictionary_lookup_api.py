from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor


@dataclass
class StubTokenVerifier:
    actor: AuthenticatedActor = field(
        default_factory=lambda: AuthenticatedActor(
            uuid.UUID("10000000-0000-4000-8000-000000000099")
        )
    )

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "dictionary-test-token":
            raise AssertionError("unexpected token")
        return self.actor


@dataclass
class StubLookupProvider:
    results: dict[str, dict[str, Any]]
    seen: list[str] = field(default_factory=list)

    def lookup(self, normalized_surface: str) -> dict[str, Any]:
        self.seen.append(normalized_surface)
        return self.results.get(
            normalized_surface,
            {"match_status": "not_found", "entries": []},
        )


def _client(provider: StubLookupProvider | None = None) -> TestClient:
    app = create_app(token_verifier=StubTokenVerifier())
    app.state.dictionary_lookup_provider = provider
    return TestClient(app)


def _headers() -> dict[str, str]:
    return {"Authorization": "Bearer dictionary-test-token"}


def _entry(sense_count: int = 2) -> dict[str, Any]:
    return {
        "matched_surface": "café",
        "part_of_speech": "noun",
        "senses": [
            {"sense_order": order, "gloss_vi": f"nghĩa {order}"}
            for order in range(1, sense_count + 1)
        ],
        "attributions": [
            {
                "source_name": "Synthetic first-party test data",
                "source_url": "https://example.test/dictionary/cafe",
                "license_code": "CC0-1.0",
                "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                "attribution_text": "Synthetic test entry; no external source used.",
                "change_notice": "Synthetic example authored for local tests.",
            }
        ],
    }


def test_lookup_returns_every_exact_sense_without_learner_state_or_writes() -> None:
    provider = StubLookupProvider({"café": {"match_status": "found", "entries": [_entry()]}})
    client = _client(provider)

    response = client.post(
        "/v1/dictionary/lookup",
        json={"surface": "CAFE\u0301"},
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    body = response.json()["data"]
    assert body["surface"] == "CAFE\u0301"
    assert body["matchStatus"] == "found"
    assert [sense["glossVi"] for sense in body["entries"][0]["senses"]] == [
        "nghĩa 1",
        "nghĩa 2",
    ]
    assert provider.seen == ["café"]
    forbidden_fields = {
        "conceptId",
        "isSaved",
        "dueAt",
        "isDue",
        "exposureCount",
        "fsrs",
    }
    assert forbidden_fields.isdisjoint(_all_keys(response.json()))


def test_lookup_is_exact_and_returns_a_clear_no_match() -> None:
    provider = StubLookupProvider({"tea": {"match_status": "found", "entries": [_entry()]}})

    response = _client(provider).post(
        "/v1/dictionary/lookup",
        json={"surface": "teacup"},
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "surface": "teacup",
        "matchStatus": "not_found",
        "entries": [],
    }
    assert provider.seen == ["teacup"]


def test_lookup_fails_closed_when_the_approved_artifact_is_missing() -> None:
    response = _client().post(
        "/v1/dictionary/lookup",
        json={"surface": "tea"},
        headers=_headers(),
    )

    assert response.status_code == 503
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_lookup_fails_closed_without_truncating_oversized_complete_results() -> None:
    provider = StubLookupProvider(
        {
            "café": {
                "match_status": "found",
                "entries": [_entry(32), _entry(32), _entry(1)],
            }
        }
    )

    response = _client(provider).post(
        "/v1/dictionary/lookup",
        json={"surface": "café"},
        headers=_headers(),
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert response.json()["error"]["message"] == (
        "A complete dictionary result is not currently available."
    )


def test_lookup_requires_authentication_before_calling_provider() -> None:
    provider = StubLookupProvider({})

    response = _client(provider).post(
        "/v1/dictionary/lookup",
        json={"surface": "tea"},
    )

    assert response.status_code == 401
    assert provider.seen == []


def test_lookup_rejects_non_word_input_without_echoing_it() -> None:
    secret_sentence = "Mina visits the teahouse"
    provider = StubLookupProvider({})

    response = _client(provider).post(
        "/v1/dictionary/lookup",
        json={"surface": secret_sentence},
        headers=_headers(),
    )

    assert response.status_code == 422
    assert secret_sentence not in response.text
    assert provider.seen == []


def test_lookup_contract_documents_exact_bounded_surface_and_response() -> None:
    response = _client().get("/openapi.json")

    assert response.status_code == 200
    document = response.json()
    operation = document["paths"]["/v1/dictionary/lookup"]["post"]
    assert "parameters" not in operation
    surface = document["components"]["schemas"]["DictionaryLookupRequestDto"]["properties"][
        "surface"
    ]
    assert surface["minLength"] == 1
    assert surface["maxLength"] == 80
    assert (
        document["components"]["schemas"]["DictionaryLookupRequestDto"]["additionalProperties"]
        is False
    )
    schema = document["components"]["schemas"]["DictionaryLookupResponseDto"]
    assert schema["properties"]["data"]["$ref"].endswith("DictionaryLookupDataDto")
    entry = document["components"]["schemas"]["DictionaryLookupEntryDto"]
    assert entry["properties"]["senses"]["maxItems"] == 32
    assert entry["properties"]["attributions"]["maxItems"] == 4
    assert "413" not in operation["responses"]


def test_lookup_body_validation_errors_are_generic_and_do_not_echo_input() -> None:
    client = _client(StubLookupProvider({}))
    cases = (
        (b'{"surface":', "malformedbodysecret", "The request is invalid."),
        ({}, "missingbodysecret", "The request is invalid."),
        (
            {"surface": "tea", "sentence": "extrabodysecret"},
            "extrabodysecret",
            "The request is invalid.",
        ),
        (
            {"surface": "Mina visits the teahouse"},
            "Mina visits the teahouse",
            "The selected text is not a supported single word.",
        ),
    )
    for body, secret, expected_message in cases:
        kwargs = {"content": body} if isinstance(body, bytes) else {"json": body}
        response = client.post(
            "/v1/dictionary/lookup",
            headers=_headers(),
            **kwargs,
        )
        assert response.status_code == 422
        assert secret not in response.text
        assert response.json()["error"]["message"] == expected_message


def _all_keys(value: object) -> set[str]:
    if isinstance(value, dict):
        keys = set(value)
        for child in value.values():
            keys.update(_all_keys(child))
        return keys
    if isinstance(value, list):
        keys: set[str] = set()
        for child in value:
            keys.update(_all_keys(child))
        return keys
    return set()
