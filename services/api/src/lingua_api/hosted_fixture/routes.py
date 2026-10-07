"""Private fixed-path K2-09 control routes; not a public API contract."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from lingua_api.hosted_fixture.errors import (
    FixtureConflict,
    FixtureForbidden,
    FixtureInternal,
    FixtureUnauthenticated,
    FixtureUnavailable,
)
from lingua_api.hosted_fixture.github import (
    completed_run_pair,
    current_master_sha,
    verify_oidc_token,
)
from lingua_api.hosted_fixture.protocol import (
    GITHUB_CONTENTS_READ_TOKEN_HEADER,
    RENDER_SERVICE_NAME,
)
from lingua_api.hosted_fixture.store import PostgresFixtureStore

router = APIRouter(
    prefix="/internal/k2-hosted-fixtures/k2-09",
    tags=["Internal K2 hosted fixture control"],
    include_in_schema=False,
)

_ERRORS: dict[type[Exception], tuple[int, str, str]] = {
    FixtureUnauthenticated: (
        401,
        "K2_FIXTURE_UNAUTHENTICATED",
        "K2-09 fixture authorization failed.",
    ),
    FixtureForbidden: (403, "K2_FIXTURE_FORBIDDEN", "K2-09 fixture request is not permitted."),
    FixtureConflict: (
        409,
        "K2_FIXTURE_CONFLICT",
        "K2-09 fixture state conflicts with this request.",
    ),
    FixtureUnavailable: (
        503,
        "K2_FIXTURE_UNAVAILABLE",
        "K2-09 fixture control plane is temporarily unavailable.",
    ),
    FixtureInternal: (500, "K2_FIXTURE_INTERNAL", "K2-09 fixture request failed."),
}


@router.post("/setup", include_in_schema=False)
async def setup_fixture(request: Request) -> JSONResponse:
    return await _handle(request, "setup")


@router.get("/inspect", include_in_schema=False)
async def inspect_fixture(request: Request) -> JSONResponse:
    return await _handle(request, "inspect")


@router.post("/cleanup", include_in_schema=False)
async def cleanup_fixture(request: Request) -> JSONResponse:
    return await _handle(request, "cleanup")


@router.post("/reap-expired", include_in_schema=False)
async def reap_fixtures(request: Request) -> JSONResponse:
    return await _handle(request, "reap")


async def _handle(request: Request, operation: str) -> JSONResponse:
    try:
        await _require_empty_request(request)
        claims = verify_oidc_token(_bearer_token(request))
        store = _store(request)
        store.assert_render_target()
        if operation == "setup":
            github_token = _github_token(request, required=True)
            _require_deployed_sha(claims.sha)
            if current_master_sha(github_token) != claims.sha:
                raise FixtureForbidden()
            store.runtime_guard()
            return _success(store.setup(claims))
        if operation == "inspect":
            store.runtime_guard()
            result = store.inspect(claims)
            if result["receiptState"] == "ABSENT":
                github_token = _github_token(request, required=True)
                _require_deployed_sha(claims.sha)
                if current_master_sha(github_token) != claims.sha:
                    raise FixtureForbidden()
            return _success(result)
        if operation == "cleanup":
            return _success(store.cleanup(claims))
        if operation == "reap":
            github_token = _github_token(request, required=True)
            _require_deployed_sha(claims.sha)
            if current_master_sha(github_token) != claims.sha:
                raise FixtureForbidden()
            store.runtime_guard()
            candidates = store.reap_candidates()
            for candidate in candidates:
                if candidate["state"] == "ACTIVE" and not completed_run_pair(
                    token=github_token,
                    run_id=int(candidate["run_id"]),
                    attempt=int(candidate["run_attempt"]),
                    sha=str(candidate["sha"]),
                ):
                    raise FixtureConflict()
            return _success(store.reap(candidates))
        raise FixtureInternal()
    except (
        FixtureUnauthenticated,
        FixtureForbidden,
        FixtureConflict,
        FixtureUnavailable,
        FixtureInternal,
    ) as error:
        return _error(error)
    except Exception:
        return _error(FixtureInternal())


def _store(request: Request) -> PostgresFixtureStore:
    store = getattr(request.app.state, "hosted_fixture_store", None)
    if not isinstance(store, PostgresFixtureStore):
        raise FixtureUnavailable()
    return store


async def _require_empty_request(request: Request) -> None:
    if request.scope.get("query_string", b"") or request.headers.get("content-length", "0") not in {
        "0",
        "",
    }:
        raise FixtureForbidden()
    if request.headers.get("transfer-encoding"):
        raise FixtureForbidden()
    async for chunk in request.stream():
        if chunk:
            raise FixtureForbidden()


def _bearer_token(request: Request) -> str:
    value = request.headers.get("authorization", "")
    prefix, separator, token = value.partition(" ")
    if prefix.lower() != "bearer" or separator != " " or not token or token != token.strip():
        raise FixtureUnauthenticated()
    return token


def _github_token(request: Request, *, required: bool) -> str:
    value = request.headers.get(GITHUB_CONTENTS_READ_TOKEN_HEADER, "")
    if not value and not required:
        return ""
    if not value or len(value) > 8192 or value != value.strip():
        raise FixtureForbidden()
    return value


def _require_deployed_sha(expected: str) -> None:
    import os
    import re

    if os.getenv("RENDER_SERVICE_NAME", "").strip() != RENDER_SERVICE_NAME:
        raise FixtureForbidden()
    deployed = os.getenv("RENDER_GIT_COMMIT", "").strip()
    if re.fullmatch(r"[a-f0-9]{40}", deployed) is None or deployed != expected:
        raise FixtureForbidden()


def _success(value: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        status_code=200,
        content=value,
        headers={"Cache-Control": "no-store"},
    )


def _error(error: Exception) -> JSONResponse:
    status, code, message = _ERRORS.get(
        type(error),
        (500, "K2_FIXTURE_INTERNAL", "K2-09 fixture request failed."),
    )
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
        headers={"Cache-Control": "no-store"},
    )
