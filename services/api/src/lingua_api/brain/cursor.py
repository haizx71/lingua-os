"""Signed opaque keyset cursor for the actor-scoped Brain concept list."""

from __future__ import annotations

import base64
import hmac
import json
from dataclasses import dataclass
from uuid import UUID

from lingua_api.competence.domain import ConceptStatus


class InvalidBrainCursor(ValueError):
    """Raised when a Brain cursor is malformed or has an invalid signature."""


@dataclass(frozen=True)
class BrainCursor:
    actor_id: UUID
    language_profile_id: UUID
    status: ConceptStatus | None
    query: str | None
    canonical_key: str
    concept_id: UUID


class BrainCursorCodec:
    def __init__(self, secret: bytes) -> None:
        if len(secret) < 32:
            raise ValueError("brain cursor secret must contain at least 32 bytes")
        self._secret = secret

    def encode(self, cursor: BrainCursor) -> str:
        payload = json.dumps(
            {
                "v": 1,
                "actorId": str(cursor.actor_id),
                "languageProfileId": str(cursor.language_profile_id),
                "status": None if cursor.status is None else cursor.status.value,
                "query": cursor.query,
                "canonicalKey": cursor.canonical_key,
                "conceptId": str(cursor.concept_id),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        signature = hmac.digest(self._secret, payload, "sha256")
        return f"{_encode(payload)}.{_encode(signature)}"

    def decode(self, token: str) -> BrainCursor:
        try:
            encoded_payload, encoded_signature = token.split(".", maxsplit=1)
            payload = _decode(encoded_payload)
            signature = _decode(encoded_signature)
            expected = hmac.digest(self._secret, payload, "sha256")
            if not hmac.compare_digest(signature, expected):
                raise InvalidBrainCursor("brain cursor signature is invalid")
            decoded = json.loads(payload)
            if decoded.get("v") != 1:
                raise InvalidBrainCursor("brain cursor version is unsupported")
            raw_status = decoded["status"]
            return BrainCursor(
                actor_id=UUID(decoded["actorId"]),
                language_profile_id=UUID(decoded["languageProfileId"]),
                status=None if raw_status is None else ConceptStatus(raw_status),
                query=decoded["query"],
                canonical_key=str(decoded["canonicalKey"]),
                concept_id=UUID(decoded["conceptId"]),
            )
        except InvalidBrainCursor:
            raise
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise InvalidBrainCursor("brain cursor is malformed") from error


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    decoded = base64.b64decode(value + padding, altchars=b"-_", validate=True)
    if _encode(decoded) != value:
        raise ValueError("non-canonical base64url encoding")
    return decoded
