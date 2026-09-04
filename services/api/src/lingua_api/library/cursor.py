"""Signed actor/filter-scoped keyset cursor for Library items."""

from __future__ import annotations

import base64
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from lingua_api.library.domain import InvalidLibraryCursor


@dataclass(frozen=True)
class LibraryCursor:
    actor_id: UUID
    language_profile_id: UUID
    saved_at: datetime
    item_id: UUID
    item_type: str | None
    query: str | None


class LibraryCursorCodec:
    def __init__(self, secret: bytes) -> None:
        if len(secret) < 32:
            raise ValueError("library cursor secret must contain at least 32 bytes")
        self._secret = secret

    def encode(self, cursor: LibraryCursor) -> str:
        payload = json.dumps(
            {
                "v": 1,
                "actorId": str(cursor.actor_id),
                "languageProfileId": str(cursor.language_profile_id),
                "savedAt": cursor.saved_at.astimezone(UTC).isoformat(),
                "itemId": str(cursor.item_id),
                "itemType": cursor.item_type,
                "query": cursor.query,
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        signature = hmac.digest(self._secret, payload, "sha256")
        return f"{_encode(payload)}.{_encode(signature)}"

    def decode(self, token: str) -> LibraryCursor:
        try:
            encoded_payload, encoded_signature = token.split(".", maxsplit=1)
            payload = _decode(encoded_payload)
            signature = _decode(encoded_signature)
            if not hmac.compare_digest(signature, hmac.digest(self._secret, payload, "sha256")):
                raise InvalidLibraryCursor("library cursor signature is invalid")
            decoded = json.loads(payload)
            if decoded.get("v") != 1:
                raise InvalidLibraryCursor("library cursor version is unsupported")
            return LibraryCursor(
                actor_id=UUID(decoded["actorId"]),
                language_profile_id=UUID(decoded["languageProfileId"]),
                saved_at=datetime.fromisoformat(decoded["savedAt"]),
                item_id=UUID(decoded["itemId"]),
                item_type=decoded.get("itemType"),
                query=decoded.get("query"),
            )
        except InvalidLibraryCursor:
            raise
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise InvalidLibraryCursor("library cursor is malformed") from error


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    decoded = base64.b64decode(value + padding, altchars=b"-_", validate=True)
    if _encode(decoded) != value:
        raise ValueError("non-canonical base64url encoding")
    return decoded
