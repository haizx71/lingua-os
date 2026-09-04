"""Signed actor/filter-scoped keyset cursor for Dictionary search."""

from __future__ import annotations

import base64
import hmac
import json
from dataclasses import dataclass
from uuid import UUID


class InvalidDictionaryCursor(ValueError):
    """A Dictionary cursor is malformed, tampered with, or out of scope."""


@dataclass(frozen=True)
class DictionaryCursor:
    actor_id: UUID
    language_profile_id: UUID
    language_code: str
    query: str
    matched_normalized_form: str
    concept_id: UUID


class DictionaryCursorCodec:
    def __init__(self, secret: bytes) -> None:
        if len(secret) < 32:
            raise ValueError("dictionary cursor secret must contain at least 32 bytes")
        self._secret = secret

    def encode(self, cursor: DictionaryCursor) -> str:
        payload = json.dumps(
            {
                "v": 1,
                "actorId": str(cursor.actor_id),
                "languageProfileId": str(cursor.language_profile_id),
                "languageCode": cursor.language_code,
                "query": cursor.query,
                "matchedNormalizedForm": cursor.matched_normalized_form,
                "conceptId": str(cursor.concept_id),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        signature = hmac.digest(self._secret, payload, "sha256")
        return f"{_encode(payload)}.{_encode(signature)}"

    def decode(self, token: str) -> DictionaryCursor:
        try:
            encoded_payload, encoded_signature = token.split(".", maxsplit=1)
            payload = _decode(encoded_payload)
            signature = _decode(encoded_signature)
            if not hmac.compare_digest(signature, hmac.digest(self._secret, payload, "sha256")):
                raise InvalidDictionaryCursor("dictionary cursor signature is invalid")
            decoded = json.loads(payload)
            if decoded.get("v") != 1:
                raise InvalidDictionaryCursor("dictionary cursor version is unsupported")
            return DictionaryCursor(
                actor_id=UUID(decoded["actorId"]),
                language_profile_id=UUID(decoded["languageProfileId"]),
                language_code=str(decoded["languageCode"]),
                query=str(decoded["query"]),
                matched_normalized_form=str(decoded["matchedNormalizedForm"]),
                concept_id=UUID(decoded["conceptId"]),
            )
        except InvalidDictionaryCursor:
            raise
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise InvalidDictionaryCursor("dictionary cursor is malformed") from error


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    decoded = base64.b64decode(value + padding, altchars=b"-_", validate=True)
    if _encode(decoded) != value:
        raise ValueError("non-canonical base64url encoding")
    return decoded
