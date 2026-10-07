"""Bounded GitHub OIDC verification and fixed GitHub REST reads."""

from __future__ import annotations

import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

import jwt
from jwt import InvalidTokenError

from lingua_api.hosted_fixture.errors import (
    FixtureForbidden,
    FixtureUnauthenticated,
    FixtureUnavailable,
)
from lingua_api.hosted_fixture.protocol import (
    AUDIENCE,
    GITHUB_API,
    GITHUB_REPOSITORY_API,
    OIDC_ISSUER,
    OIDC_JWKS_URL,
    OWNER_ID,
    REPOSITORY,
    REPOSITORY_ID,
    WORKFLOW_NAME,
    WORKFLOW_REF,
    RunClaims,
)

MAX_JWKS_BYTES = 64 * 1024
MAX_GITHUB_RESPONSE_BYTES = 96 * 1024
HTTP_TIMEOUT_SECONDS = 5
MAX_TOKEN_LIFETIME_SECONDS = 15 * 60
MAX_RUN_ID = 2**63 - 1
MAX_RUN_ATTEMPT = 2**31 - 1


class _RejectRedirects(HTTPRedirectHandler):
    def redirect_request(
        self,
        request: Request,
        file_pointer: Any,
        code: int,
        message: str,
        headers: Any,
        new_url: str,
    ) -> None:
        del request, file_pointer, code, message, headers, new_url
        return None


_OPENER = build_opener(_RejectRedirects())


def _get_json(url: str, *, headers: dict[str, str], max_bytes: int) -> dict[str, Any]:
    request = Request(url, headers=headers, method="GET")
    try:
        with _OPENER.open(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise FixtureUnavailable()
            raw = response.read(max_bytes + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        del error
        raise FixtureUnavailable() from None
    if len(raw) > max_bytes:
        raise FixtureUnavailable()
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise FixtureUnavailable() from None
    if not isinstance(value, dict):
        raise FixtureUnavailable()
    return value


def verify_oidc_token(token: str, *, now: int | None = None) -> RunClaims:
    if not token or len(token) > 16_384:
        raise FixtureUnauthenticated()
    try:
        header = jwt.get_unverified_header(token)
        key_id = header.get("kid")
        if header.get("alg") != "RS256" or not isinstance(key_id, str) or not key_id:
            raise FixtureUnauthenticated()
    except (InvalidTokenError, TypeError, ValueError):
        raise FixtureUnauthenticated() from None

    jwks = _get_json(
        OIDC_JWKS_URL,
        headers={"Accept": "application/json", "User-Agent": "lingua-os-k2-09"},
        max_bytes=MAX_JWKS_BYTES,
    )
    keys = jwks.get("keys")
    if not isinstance(keys, list) or len(keys) > 32:
        raise FixtureUnavailable()
    matching = [
        item
        for item in keys
        if isinstance(item, dict) and item.get("kid") == key_id and item.get("kty") == "RSA"
    ]
    if len(matching) != 1:
        raise FixtureUnauthenticated()

    try:
        signing_key = jwt.PyJWK.from_dict(matching[0], algorithm="RS256").key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=AUDIENCE,
            issuer=OIDC_ISSUER,
            options={
                "require": [
                    "iss",
                    "aud",
                    "exp",
                    "nbf",
                    "iat",
                    "jti",
                    "repository_id",
                    "repository",
                    "repository_owner_id",
                    "ref",
                    "workflow_ref",
                    "workflow",
                    "event_name",
                    "actor_id",
                    "sha",
                    "workflow_sha",
                    "run_id",
                    "run_attempt",
                ],
            },
            leeway=30,
        )
    except (InvalidTokenError, TypeError, ValueError, KeyError):
        raise FixtureUnauthenticated() from None

    if claims.get("aud") != AUDIENCE:
        raise FixtureUnauthenticated()
    current = int(time.time()) if now is None else now
    exp = _positive_int(claims.get("exp"))
    nbf = _nonnegative_int(claims.get("nbf"))
    iat = _nonnegative_int(claims.get("iat"))
    if exp is None or nbf is None or iat is None:
        raise FixtureUnauthenticated()
    if exp <= current or nbf > current + 30 or iat > current + 30:
        raise FixtureUnauthenticated()
    if exp - iat > MAX_TOKEN_LIFETIME_SECONDS or iat > exp or nbf > exp:
        raise FixtureUnauthenticated()

    if (
        str(claims.get("repository_id")) != str(REPOSITORY_ID)
        or claims.get("repository") != REPOSITORY
        or str(claims.get("repository_owner_id")) != str(OWNER_ID)
        or claims.get("repository_owner") != "haizx71"
        or claims.get("ref") != "refs/heads/master"
        or claims.get("workflow_ref") != WORKFLOW_REF
        or claims.get("workflow") != WORKFLOW_NAME
        or claims.get("event_name") != "workflow_dispatch"
        or str(claims.get("actor_id")) != str(OWNER_ID)
    ):
        raise FixtureForbidden()

    jti = claims.get("jti")
    sha = claims.get("sha")
    workflow_sha = claims.get("workflow_sha")
    run_id = _positive_bounded_int(claims.get("run_id"), maximum=MAX_RUN_ID)
    run_attempt = _positive_bounded_int(claims.get("run_attempt"), maximum=MAX_RUN_ATTEMPT)
    if not isinstance(jti, str) or not isinstance(sha, str) or not isinstance(workflow_sha, str):
        raise FixtureUnauthenticated()
    if run_id is None or run_attempt is None:
        raise FixtureUnauthenticated()
    result = RunClaims(
        repository_id=REPOSITORY_ID,
        run_id=run_id,
        run_attempt=run_attempt,
        sha=sha,
        workflow_sha=workflow_sha,
        jti=jti,
        issued_at=iat,
        expires_at=exp,
    )
    try:
        result.validate()
    except ValueError:
        raise FixtureUnauthenticated() from None
    return result


def _positive_int(value: object) -> int | None:
    parsed = _integer(value)
    return parsed if parsed is not None and parsed > 0 else None


def _positive_bounded_int(value: object, *, maximum: int) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, str):
        if (
            not value
            or len(value) > len(str(maximum))
            or not value.isascii()
            or not value.isdecimal()
            or value.startswith("0")
        ):
            return None
        parsed = int(value)
    else:
        return None
    return parsed if 0 < parsed <= maximum else None


def _nonnegative_int(value: object) -> int | None:
    parsed = _integer(value)
    return parsed if parsed is not None and parsed >= 0 else None


def _integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    return None


def current_master_sha(token: str) -> str:
    if not token or len(token) > 8192:
        raise FixtureForbidden()
    payload = _github_get(
        f"{GITHUB_REPOSITORY_API}/git/ref/heads/master",
        token=token,
        max_bytes=MAX_GITHUB_RESPONSE_BYTES,
    )
    reference = payload.get("ref")
    target = payload.get("object")
    if reference != "refs/heads/master" or not isinstance(target, dict):
        raise FixtureUnavailable()
    if target.get("type") != "commit":
        raise FixtureUnavailable()
    sha = target.get("sha")
    if (
        not isinstance(sha, str)
        or len(sha) != 40
        or any(ch not in "0123456789abcdef" for ch in sha)
    ):
        raise FixtureUnavailable()
    return sha


def completed_run_pair(*, token: str, run_id: int, attempt: int, sha: str) -> bool:
    """Return true only when both fixed GitHub run endpoints agree and are complete."""
    if not token or len(token) > 8192:
        raise FixtureForbidden()
    attempt_payload = _github_get(
        f"{GITHUB_REPOSITORY_API}/actions/runs/{run_id}/attempts/{attempt}",
        token=token,
        max_bytes=MAX_GITHUB_RESPONSE_BYTES,
    )
    latest_payload = _github_get(
        f"{GITHUB_REPOSITORY_API}/actions/runs/{run_id}",
        token=token,
        max_bytes=MAX_GITHUB_RESPONSE_BYTES,
    )
    return _run_payload_matches(attempt_payload, run_id=run_id, attempt=attempt, sha=sha) and (
        _run_payload_matches(latest_payload, run_id=run_id, attempt=attempt, sha=sha)
    )


def _github_get(url: str, *, token: str, max_bytes: int) -> dict[str, Any]:
    if not url.startswith(f"{GITHUB_API}/repos/{REPOSITORY}/"):
        raise FixtureUnavailable()
    return _get_json(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lingua-os-k2-09",
        },
        max_bytes=max_bytes,
    )


def _run_payload_matches(payload: dict[str, Any], *, run_id: int, attempt: int, sha: str) -> bool:
    repository = payload.get("repository")
    if not isinstance(repository, dict):
        return False
    return (
        _integer(payload.get("id")) == run_id
        and _integer(payload.get("run_attempt")) == attempt
        and payload.get("status") == "completed"
        and repository.get("id") == REPOSITORY_ID
        and payload.get("path") == ".github/workflows/k2-hosted-acceptance.yml"
        and payload.get("name") == WORKFLOW_NAME
        and payload.get("event") == "workflow_dispatch"
        and payload.get("head_branch") == "master"
        and payload.get("head_sha") == sha
    )
