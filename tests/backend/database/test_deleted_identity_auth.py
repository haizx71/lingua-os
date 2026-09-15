from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor


@dataclass(frozen=True)
class StubTokenVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        del token
        return self.actor


def test_deleted_supabase_identity_invalidates_still_signed_jwt(
    migrated_postgres_url: str,
) -> None:
    deleted_actor = AuthenticatedActor(uuid.uuid4(), "deleted@example.com")
    client = TestClient(
        create_app(
            database_url=migrated_postgres_url,
            token_verifier=StubTokenVerifier(deleted_actor),
            cursor_secret=b"deleted-identity-test-secret-000001",
        )
    )

    response = client.get(
        "/v1/me",
        headers={"Authorization": "Bearer still-cryptographically-valid-token"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"
    assert response.headers["x-request-id"] == response.json()["error"]["requestId"]
