"""Signed opaque keyset cursor for the Review due queue."""

from __future__ import annotations

import base64
import hmac
import json
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from lingua_api.review.domain import InvalidReviewCursor


@dataclass(frozen=True)
class ReviewCursor:
    language_profile_id: UUID
    as_of: datetime
    after_due_at: datetime
    after_review_item_id: UUID


class ReviewCursorCodec:
    def __init__(self, secret: bytes) -> None:
        if len(secret) < 32:
            raise ValueError("review cursor secret must contain at least 32 bytes")
        self._secret = secret

    def encode(self, cursor: ReviewCursor) -> str:
        payload = json.dumps(
            {
                "v": 1,
                "languageProfileId": str(cursor.language_profile_id),
                "asOf": cursor.as_of.isoformat(),
                "afterDueAt": cursor.after_due_at.isoformat(),
                "afterReviewItemId": str(cursor.after_review_item_id),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        signature = hmac.digest(self._secret, payload, "sha256")
        return f"{_encode(payload)}.{_encode(signature)}"

    def decode(self, token: str) -> ReviewCursor:
        try:
            encoded_payload, encoded_signature = token.split(".", maxsplit=1)
            payload = _decode(encoded_payload)
            signature = _decode(encoded_signature)
            expected = hmac.digest(self._secret, payload, "sha256")
            if not hmac.compare_digest(signature, expected):
                raise InvalidReviewCursor("review cursor signature is invalid")
            decoded = json.loads(payload)
            if decoded.get("v") != 1:
                raise InvalidReviewCursor("review cursor version is unsupported")
            return ReviewCursor(
                language_profile_id=UUID(decoded["languageProfileId"]),
                as_of=datetime.fromisoformat(decoded["asOf"]),
                after_due_at=datetime.fromisoformat(decoded["afterDueAt"]),
                after_review_item_id=UUID(decoded["afterReviewItemId"]),
            )
        except InvalidReviewCursor:
            raise
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise InvalidReviewCursor("review cursor is malformed") from error


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    decoded = base64.b64decode(value + padding, altchars=b"-_", validate=True)
    if _encode(decoded) != value:
        raise ValueError("non-canonical base64url encoding")
    return decoded
