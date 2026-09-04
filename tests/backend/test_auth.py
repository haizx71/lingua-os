from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final, cast

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey
from lingua_api.auth import (
    AccessTokenForbidden,
    AccessTokenInvalid,
    SigningKey,
    SupabaseJwtVerifier,
)

ISSUER: Final = "https://lingua-test.supabase.co/auth/v1"


@dataclass(frozen=True)
class _SigningKey:
    key: object


@dataclass(frozen=True)
class _SigningKeys:
    public_key: RSAPublicKey

    def get_signing_key_from_jwt(self, token: str) -> SigningKey:
        del token
        return cast(SigningKey, _SigningKey(self.public_key))


@pytest.fixture(scope="module")
def rsa_keys() -> tuple[RSAPrivateKey, RSAPublicKey]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def _token(private_key: RSAPrivateKey, **overrides: object) -> str:
    claims: dict[str, object] = {
        "iss": ISSUER,
        "aud": "authenticated",
        "sub": str(uuid.uuid4()),
        "role": "authenticated",
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256")


def test_supabase_verifier_validates_signature_issuer_audience_and_actor(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey],
) -> None:
    private_key, public_key = rsa_keys
    subject = uuid.uuid4()
    verifier = SupabaseJwtVerifier(
        "https://lingua-test.supabase.co",
        signing_key_client=_SigningKeys(public_key),
    )

    actor = verifier.verify(_token(private_key, sub=str(subject)))

    assert actor.id == subject
    assert actor.email is None


def test_supabase_verifier_retains_only_a_syntactically_valid_optional_email(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey],
) -> None:
    private_key, public_key = rsa_keys
    verifier = SupabaseJwtVerifier(
        "https://lingua-test.supabase.co",
        signing_key_client=_SigningKeys(public_key),
    )

    assert verifier.verify(_token(private_key, email="learner@example.com")).email == (
        "learner@example.com"
    )
    assert verifier.verify(_token(private_key, email="not-an-email")).email is None
    assert verifier.verify(_token(private_key, email=123)).email is None


@pytest.mark.parametrize(
    ("claim", "value"),
    (
        ("aud", "service_role"),
        ("iss", "https://attacker.invalid/auth/v1"),
        ("exp", datetime.now(UTC) - timedelta(minutes=1)),
        ("sub", "not-a-uuid"),
    ),
)
def test_supabase_verifier_rejects_invalid_required_claims(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey], claim: str, value: object
) -> None:
    private_key, public_key = rsa_keys
    verifier = SupabaseJwtVerifier(
        "https://lingua-test.supabase.co",
        signing_key_client=_SigningKeys(public_key),
    )

    with pytest.raises(AccessTokenInvalid):
        verifier.verify(_token(private_key, **{claim: value}))


def test_supabase_verifier_rejects_non_learner_role(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey],
) -> None:
    private_key, public_key = rsa_keys
    verifier = SupabaseJwtVerifier(
        "https://lingua-test.supabase.co",
        signing_key_client=_SigningKeys(public_key),
    )

    with pytest.raises(AccessTokenForbidden):
        verifier.verify(_token(private_key, role="service_role"))


def test_supabase_verifier_requires_https() -> None:
    with pytest.raises(ValueError, match="HTTPS"):
        SupabaseJwtVerifier("http://localhost:54321")
