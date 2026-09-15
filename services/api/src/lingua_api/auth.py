"""Testable Supabase bearer-token verification boundary."""

from __future__ import annotations

import re
from typing import Any, Protocol, cast
from uuid import UUID

import jwt
from jwt import InvalidTokenError, PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from lingua_api.memory.domain import AuthenticatedActor


class AccessTokenInvalid(RuntimeError):
    """The bearer credential is missing, malformed, expired, or not authentic."""


class AccessTokenForbidden(RuntimeError):
    """The authentic token does not represent an authenticated learner."""


class AuthConfigurationError(RuntimeError):
    """The server cannot verify credentials because auth is not configured or reachable."""


class AccessTokenVerifier(Protocol):
    def verify(self, token: str) -> AuthenticatedActor: ...


class SigningKey(Protocol):
    key: object


class SigningKeyClient(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> SigningKey: ...


class SupabaseJwtVerifier:
    """Verify asymmetric Supabase JWTs against the project's bounded JWKS cache."""

    def __init__(
        self,
        supabase_url: str,
        *,
        audience: str = "authenticated",
        signing_key_client: SigningKeyClient | None = None,
    ) -> None:
        base_url = supabase_url.rstrip("/")
        if not base_url.startswith("https://"):
            raise ValueError("SUPABASE_URL must use HTTPS")
        self._issuer = f"{base_url}/auth/v1"
        self._audience = audience
        self._signing_keys = signing_key_client or cast(
            SigningKeyClient,
            PyJWKClient(
                f"{self._issuer}/.well-known/jwks.json",
                cache_jwk_set=True,
                lifespan=600,
                timeout=5,
            ),
        )

    def verify(self, token: str) -> AuthenticatedActor:
        try:
            signing_key = self._signing_keys.get_signing_key_from_jwt(token)
        except PyJWKClientConnectionError as error:
            raise AuthConfigurationError("Supabase JWKS endpoint is unavailable") from error

        try:
            claims = jwt.decode(
                token,
                cast(Any, signing_key.key),
                algorithms=["RS256", "ES256"],
                audience=self._audience,
                issuer=self._issuer,
                options={"require": ["exp", "iss", "sub", "aud", "role"]},
            )
            subject = UUID(str(claims["sub"]))
        except (InvalidTokenError, KeyError, TypeError, ValueError) as error:
            raise AccessTokenInvalid("bearer credential could not be verified") from error
        if claims.get("role") != "authenticated":
            raise AccessTokenForbidden("bearer credential lacks the learner role")
        return AuthenticatedActor(subject, _verified_email(claims.get("email")))


_EMAIL_LOCAL = re.compile(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+")
_EMAIL_DOMAIN_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")


def _verified_email(value: object) -> str | None:
    if not isinstance(value, str) or value != value.strip() or len(value) > 320:
        return None
    if value.count("@") != 1:
        return None
    local, domain = value.rsplit("@", 1)
    if (
        not local
        or len(local) > 64
        or local.startswith(".")
        or local.endswith(".")
        or ".." in local
        or _EMAIL_LOCAL.fullmatch(local) is None
    ):
        return None
    labels = domain.split(".")
    if len(domain) > 255 or len(labels) < 2:
        return None
    if any(_EMAIL_DOMAIN_LABEL.fullmatch(label) is None for label in labels):
        return None
    return value
