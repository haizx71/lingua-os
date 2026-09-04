"""Signed opaque keyset cursor for the learner-overlaid content catalog."""

from __future__ import annotations

import base64
import hmac
import json
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from lingua_api.content.domain import InvalidContentCursor


@dataclass(frozen=True)
class ContentCursor:
    language_profile_id: UUID
    distance: int
    known_ratio: Decimal
    difficulty: Decimal
    content_id: UUID


class ContentCursorCodec:
    def __init__(self, secret: bytes) -> None:
        if len(secret) < 32:
            raise ValueError("content cursor secret must contain at least 32 bytes")
        self._secret = secret

    def encode(self, cursor: ContentCursor) -> str:
        payload = json.dumps(
            {
                "v": 1,
                "languageProfileId": str(cursor.language_profile_id),
                "distance": cursor.distance,
                "knownRatio": str(cursor.known_ratio),
                "difficulty": str(cursor.difficulty),
                "contentId": str(cursor.content_id),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        signature = hmac.digest(self._secret, payload, "sha256")
        return f"{_encode(payload)}.{_encode(signature)}"

    def decode(self, token: str) -> ContentCursor:
        try:
            encoded_payload, encoded_signature = token.split(".", maxsplit=1)
            payload = _decode(encoded_payload)
            signature = _decode(encoded_signature)
            if not hmac.compare_digest(signature, hmac.digest(self._secret, payload, "sha256")):
                raise InvalidContentCursor("content cursor signature is invalid")
            decoded = json.loads(payload)
            if decoded.get("v") != 1:
                raise InvalidContentCursor("content cursor version is unsupported")
            return ContentCursor(
                language_profile_id=UUID(decoded["languageProfileId"]),
                distance=int(decoded["distance"]),
                known_ratio=Decimal(decoded["knownRatio"]),
                difficulty=Decimal(decoded["difficulty"]),
                content_id=UUID(decoded["contentId"]),
            )
        except InvalidContentCursor:
            raise
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise InvalidContentCursor("content cursor is malformed") from error


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    decoded = base64.b64decode(value + padding, altchars=b"-_", validate=True)
    if _encode(decoded) != value:
        raise ValueError("non-canonical base64url encoding")
    return decoded
