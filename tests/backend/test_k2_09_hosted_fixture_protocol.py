from __future__ import annotations

import json
import time
from collections.abc import Callable
from contextlib import suppress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from lingua_api.hosted_fixture import github
from lingua_api.hosted_fixture.errors import (
    FixtureConflict,
    FixtureForbidden,
    FixtureInternal,
    FixtureUnauthenticated,
    FixtureUnavailable,
)
from lingua_api.hosted_fixture.protocol import (
    AUDIENCE,
    GITHUB_REPOSITORY_API,
    OIDC_ISSUER,
    OWNER_ID,
    REPOSITORY,
    REPOSITORY_ID,
    WORKFLOW_NAME,
    WORKFLOW_REF,
    RunClaims,
    derive_fixture_ids,
    fixture_payload,
    source_record_hash,
)
from lingua_api.main import create_app


def _serve_local_http(
    responder: Callable[[BaseHTTPRequestHandler], None],
) -> tuple[ThreadingHTTPServer, Thread, str]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            responder(self)

        def log_message(self, format: str, *args: object) -> None:
            del format, args

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f"http://127.0.0.1:{server.server_port}"


def _stop_local_http(server: ThreadingHTTPServer, thread: Thread) -> None:
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


def _claims(*, audience: object = AUDIENCE, **overrides: object) -> dict[str, Any]:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": OIDC_ISSUER,
        "aud": audience,
        "exp": now + 300,
        "nbf": now - 5,
        "iat": now - 5,
        "jti": "test-jti",
        "repository_id": str(REPOSITORY_ID),
        "repository": REPOSITORY,
        "repository_owner_id": str(OWNER_ID),
        "repository_owner": "haizx71",
        "ref": "refs/heads/master",
        "workflow_ref": WORKFLOW_REF,
        "workflow": WORKFLOW_NAME,
        "event_name": "workflow_dispatch",
        "actor_id": str(OWNER_ID),
        "sha": "a" * 40,
        "workflow_sha": "a" * 40,
        "run_id": "123456",
        "run_attempt": "1",
    }
    claims.update(overrides)
    return claims


def test_fixture_ids_and_content_are_deterministic_and_distinct() -> None:
    claims = RunClaims(
        repository_id=REPOSITORY_ID,
        run_id=123456,
        run_attempt=1,
        sha="a" * 40,
        workflow_sha="a" * 40,
        jti="test-jti",
        issued_at=100,
        expires_at=200,
    )
    first = derive_fixture_ids(claims)
    second = derive_fixture_ids(claims)
    assert first == second
    assert len(first.suffix) == 64 and set(first.suffix) <= set("abcdefghijklmnop")
    assert (
        len(
            {
                first.source_record,
                first.owner_concept,
                first.secondary_concept,
                first.lexeme,
                first.form,
                first.sense_one,
                first.sense_two,
            }
        )
        == 7
    )
    payload = fixture_payload(first, source_id=__import__("uuid").UUID(int=1))
    assert [
        len(payload[table])
        for table in (
            "source_records",
            "concepts",
            "lexemes",
            "lexeme_forms",
            "word_senses",
            "concept_senses",
        )
    ] == [1, 2, 1, 1, 2, 3]
    assert payload["concept_senses"][1]["concept_id"] == str(first.secondary_concept)
    assert payload["concept_senses"][1]["word_sense_id"] == str(first.sense_one)


def test_source_hash_binds_source_license_and_fixture_ids() -> None:
    claims = RunClaims(
        repository_id=REPOSITORY_ID,
        run_id=123456,
        run_attempt=1,
        sha="a" * 40,
        workflow_sha="a" * 40,
        jti="test-jti",
        issued_at=100,
        expires_at=200,
    )
    ids = derive_fixture_ids(claims)
    first = source_record_hash(
        ids, source_id=__import__("uuid").UUID(int=1), license_id=__import__("uuid").UUID(int=2)
    )
    changed_source = source_record_hash(
        ids, source_id=__import__("uuid").UUID(int=3), license_id=__import__("uuid").UUID(int=2)
    )
    changed_attempt = derive_fixture_ids(
        RunClaims(
            repository_id=REPOSITORY_ID,
            run_id=123456,
            run_attempt=2,
            sha="a" * 40,
            workflow_sha="a" * 40,
            jti="test-jti",
            issued_at=100,
            expires_at=200,
        )
    )
    assert first != changed_source
    assert first != source_record_hash(
        changed_attempt,
        source_id=__import__("uuid").UUID(int=1),
        license_id=__import__("uuid").UUID(int=2),
    )


def test_oidc_verifier_requires_exact_signed_claims_and_scalar_audience(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk["kid"] = "test-key"
    monkeypatch.setattr(github, "_get_json", lambda *args, **kwargs: {"keys": [public_jwk]})

    def token(claims: dict[str, Any]) -> str:
        return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})

    verified = github.verify_oidc_token(token(_claims()))
    assert verified.run_id == 123456
    assert verified.run_attempt == 1
    assert verified.sha == "a" * 40

    with pytest.raises(FixtureUnauthenticated):
        github.verify_oidc_token(token(_claims(audience=[AUDIENCE])))
    with pytest.raises(FixtureForbidden):
        github.verify_oidc_token(token(_claims(repository_id="1367261126")))
    with pytest.raises(FixtureForbidden):
        github.verify_oidc_token(token(_claims(actor_id="95479548")))
    with pytest.raises(FixtureUnauthenticated):
        github.verify_oidc_token(token(_claims(workflow_sha="b" * 40)))
    assert github.verify_oidc_token(token(_claims(run_id=123456, run_attempt=1))).run_id == 123456


@pytest.mark.parametrize(
    ("claim", "value_factory", "expected_error"),
    [
        ("iss", lambda now: "https://attacker.invalid", FixtureUnauthenticated),
        ("repository", lambda now: "attacker/repository", FixtureForbidden),
        ("repository_owner_id", lambda now: "1", FixtureForbidden),
        ("repository_owner", lambda now: "attacker", FixtureForbidden),
        ("ref", lambda now: "refs/heads/attacker", FixtureForbidden),
        ("workflow_ref", lambda now: "attacker/workflow.yml@refs/heads/master", FixtureForbidden),
        ("workflow", lambda now: "Attacker workflow", FixtureForbidden),
        ("event_name", lambda now: "pull_request", FixtureForbidden),
        ("sha", lambda now: "not-a-git-sha", FixtureUnauthenticated),
        ("jti", lambda now: "", FixtureUnauthenticated),
        ("exp", lambda now: now - 60, FixtureUnauthenticated),
        ("nbf", lambda now: now + 60, FixtureUnauthenticated),
        ("iat", lambda now: now + 60, FixtureUnauthenticated),
        ("exp", lambda now: now + 901, FixtureUnauthenticated),
    ],
)
def test_oidc_verifier_rejects_bad_signed_claim_values(
    monkeypatch: pytest.MonkeyPatch,
    claim: str,
    value_factory: Callable[[int], object],
    expected_error: type[Exception],
) -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk["kid"] = "test-key"
    monkeypatch.setattr(github, "_get_json", lambda *args, **kwargs: {"keys": [public_jwk]})

    now = int(time.time())
    signed = jwt.encode(
        _claims(**{claim: value_factory(now)}),
        private_key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )

    with pytest.raises(expected_error):
        github.verify_oidc_token(signed, now=now)


@pytest.mark.parametrize(
    ("claim", "value"),
    [
        ("run_id", "0"),
        ("run_id", "01"),
        ("run_id", "+1"),
        ("run_id", " 1"),
        ("run_id", "1.0"),
        ("run_id", "9223372036854775808"),
        ("run_id", True),
        ("run_attempt", "0"),
        ("run_attempt", "01"),
        ("run_attempt", "2147483648"),
        ("run_attempt", False),
    ],
)
def test_oidc_verifier_rejects_noncanonical_or_out_of_range_run_claims(
    monkeypatch: pytest.MonkeyPatch, claim: str, value: object
) -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk["kid"] = "test-key"
    monkeypatch.setattr(github, "_get_json", lambda *args, **kwargs: {"keys": [public_jwk]})
    signed = jwt.encode(
        _claims(**{claim: value}), private_key, algorithm="RS256", headers={"kid": "test-key"}
    )

    with pytest.raises(FixtureUnauthenticated):
        github.verify_oidc_token(signed)


def test_current_master_sha_uses_compact_fixed_git_ref(monkeypatch: pytest.MonkeyPatch) -> None:
    expected_sha = "a" * 40
    reference_payload = {
        "ref": "refs/heads/master",
        "node_id": "fixed-test-ref",
        "url": f"{GITHUB_REPOSITORY_API}/git/refs/heads/master",
        "object": {
            "type": "commit",
            "sha": expected_sha,
            "url": f"{GITHUB_REPOSITORY_API}/git/commits/{expected_sha}",
        },
    }
    calls: list[tuple[str, str, int]] = []

    def get_json(url: str, *, token: str, max_bytes: int) -> dict[str, Any]:
        calls.append((url, token, max_bytes))
        assert url != f"{GITHUB_REPOSITORY_API}/commits/master"
        return reference_payload

    monkeypatch.setattr(github, "_github_get", get_json)

    assert github.current_master_sha("fixed-local-token") == expected_sha
    assert calls == [
        (
            f"{GITHUB_REPOSITORY_API}/git/ref/heads/master",
            "fixed-local-token",
            github.MAX_GITHUB_RESPONSE_BYTES,
        )
    ]


@pytest.mark.parametrize(
    "payload",
    [
        {"ref": "refs/heads/other", "object": {"type": "commit", "sha": "a" * 40}},
        {"ref": "refs/heads/master", "object": {"type": "tag", "sha": "a" * 40}},
        {"ref": "refs/heads/master", "object": {"type": "commit", "sha": "A" * 40}},
        {"ref": "refs/heads/master", "object": {"type": "commit", "sha": "a" * 39}},
        {"ref": "refs/heads/master", "object": {}},
        {"ref": "refs/heads/master", "object": "not-an-object"},
        {"ref": "refs/heads/master"},
    ],
)
def test_current_master_sha_rejects_wrong_or_unrecognized_ref_shape(
    monkeypatch: pytest.MonkeyPatch, payload: dict[str, Any]
) -> None:
    calls: list[tuple[str, str, int]] = []

    def get_json(url: str, *, token: str, max_bytes: int) -> dict[str, Any]:
        calls.append((url, token, max_bytes))
        return payload

    monkeypatch.setattr(github, "_github_get", get_json)

    with pytest.raises(FixtureUnavailable):
        github.current_master_sha("fixed-local-token")
    assert calls == [
        (
            f"{GITHUB_REPOSITORY_API}/git/ref/heads/master",
            "fixed-local-token",
            github.MAX_GITHUB_RESPONSE_BYTES,
        )
    ]


def test_completed_run_pair_checks_both_fixed_attempt_and_latest_endpoints(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_id = 123456
    attempt = 2
    sha = "a" * 40

    def run_payload(*, run_attempt: int) -> dict[str, Any]:
        return {
            "id": run_id,
            "run_attempt": run_attempt,
            "status": "completed",
            "repository": {"id": REPOSITORY_ID},
            "path": ".github/workflows/k2-hosted-acceptance.yml",
            "name": WORKFLOW_NAME,
            "event": "workflow_dispatch",
            "head_branch": "master",
            "head_sha": sha,
        }

    responses = [run_payload(run_attempt=attempt), run_payload(run_attempt=attempt)]
    calls: list[tuple[str, str, int]] = []

    def get_json(url: str, *, token: str, max_bytes: int) -> dict[str, Any]:
        calls.append((url, token, max_bytes))
        return responses.pop(0)

    monkeypatch.setattr(github, "_github_get", get_json)
    assert github.completed_run_pair(
        token="fixed-local-token", run_id=run_id, attempt=attempt, sha=sha
    )
    assert calls == [
        (
            f"{GITHUB_REPOSITORY_API}/actions/runs/{run_id}/attempts/{attempt}",
            "fixed-local-token",
            github.MAX_GITHUB_RESPONSE_BYTES,
        ),
        (
            f"{GITHUB_REPOSITORY_API}/actions/runs/{run_id}",
            "fixed-local-token",
            github.MAX_GITHUB_RESPONSE_BYTES,
        ),
    ]

    responses.extend([run_payload(run_attempt=attempt), run_payload(run_attempt=attempt + 1)])
    assert not github.completed_run_pair(
        token="fixed-local-token", run_id=run_id, attempt=attempt, sha=sha
    )


def test_completed_run_pair_fails_closed_on_github_transport_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unavailable(*args: object, **kwargs: object) -> dict[str, Any]:
        del args, kwargs
        raise FixtureUnavailable()

    monkeypatch.setattr(github, "_github_get", unavailable)
    with pytest.raises(FixtureUnavailable):
        github.completed_run_pair(token="fixed-local-token", run_id=123456, attempt=1, sha="a" * 40)


def test_github_get_refuses_nonfixed_destination_before_http(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[bool] = []
    monkeypatch.setattr(github, "_get_json", lambda *args, **kwargs: calls.append(True))
    with pytest.raises(FixtureUnavailable) as caught:
        github._github_get(
            "https://api.github.com/repos/attacker/repository/actions/runs/1",
            token="local-test-token",
            max_bytes=128,
        )
    assert str(caught.value) == ""
    assert calls == []


@pytest.mark.parametrize(
    ("path", "status", "body", "max_bytes"),
    [
        ("/oversize", 200, b"12345", 4),
        ("/malformed", 200, b"{", 32),
        ("/http-error", 503, b"provider detail must be suppressed", 128),
    ],
)
def test_get_json_suppresses_oversize_malformed_and_http_failures(
    path: str,
    status: int,
    body: bytes,
    max_bytes: int,
) -> None:
    requests: list[tuple[str, str | None]] = []

    def respond(request: BaseHTTPRequestHandler) -> None:
        requests.append((request.path, request.headers.get("Authorization")))
        request.send_response(status)
        request.send_header("Content-Length", str(len(body)))
        request.end_headers()
        with suppress(OSError):
            request.wfile.write(body)

    server, thread, base_url = _serve_local_http(respond)
    try:
        with pytest.raises(FixtureUnavailable) as caught:
            github._get_json(
                f"{base_url}{path}",
                headers={"Authorization": "Bearer local-transport-token"},
                max_bytes=max_bytes,
            )
        assert str(caught.value) == ""
        assert requests == [(path, "Bearer local-transport-token")]
    finally:
        _stop_local_http(server, thread)


def test_get_json_rejects_redirect_without_forwarding_authorization() -> None:
    redirected_requests: list[str] = []

    def accept_redirect_target(request: BaseHTTPRequestHandler) -> None:
        redirected_requests.append(request.path)
        request.send_response(200)
        request.send_header("Content-Length", "2")
        request.end_headers()
        request.wfile.write(b"{}")

    target, target_thread, target_url = _serve_local_http(accept_redirect_target)

    def redirect(request: BaseHTTPRequestHandler) -> None:
        request.send_response(302)
        request.send_header("Location", f"{target_url}/target")
        request.send_header("Content-Length", "0")
        request.end_headers()

    source, source_thread, source_url = _serve_local_http(redirect)
    try:
        with pytest.raises(FixtureUnavailable) as caught:
            github._get_json(
                f"{source_url}/redirect",
                headers={"Authorization": "Bearer redirect-test-token"},
                max_bytes=128,
            )
        assert str(caught.value) == ""
        assert redirected_requests == []
    finally:
        _stop_local_http(source, source_thread)
        _stop_local_http(target, target_thread)


def test_get_json_suppresses_real_socket_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    def slow_response(request: BaseHTTPRequestHandler) -> None:
        time.sleep(0.05)
        request.send_response(200)
        request.send_header("Content-Length", "2")
        request.end_headers()
        with suppress(OSError):
            request.wfile.write(b"{}")

    server, thread, base_url = _serve_local_http(slow_response)
    monkeypatch.setattr(github, "HTTP_TIMEOUT_SECONDS", 0.005)
    try:
        with pytest.raises(FixtureUnavailable) as caught:
            github._get_json(f"{base_url}/slow", headers={}, max_bytes=128)
        assert str(caught.value) == ""
    finally:
        _stop_local_http(server, thread)


@pytest.mark.parametrize(
    ("method", "path", "body", "expected_status"),
    [
        ("GET", "/internal/k2-hosted-fixtures/k2-09/inspect", b"", 401),
        ("GET", "/internal/k2-hosted-fixtures/k2-09/inspect?run_id=1", b"", 403),
        ("POST", "/internal/k2-hosted-fixtures/k2-09/setup", b"{}", 403),
    ],
)
def test_private_routes_are_not_in_openapi_and_reject_untrusted_shapes(
    method: str, path: str, body: bytes, expected_status: int
) -> None:
    app = create_app(
        database_url=None,
        cursor_secret=b"test-cursor-secret-value-longer-than-32-bytes",
    )
    client = TestClient(app)
    response = client.request(method, path, content=body)
    assert response.status_code == expected_status
    assert response.headers["cache-control"] == "no-store"
    if expected_status == 401:
        assert response.json() == {
            "error": {
                "code": "K2_FIXTURE_UNAUTHENTICATED",
                "message": "K2-09 fixture authorization failed.",
            }
        }
    openapi = client.get("/openapi.json").json()
    assert not any("/internal/k2-hosted-fixtures" in path for path in openapi["paths"])


@pytest.mark.parametrize(
    ("exception", "status", "code", "message"),
    [
        (
            FixtureUnauthenticated("provider detail"),
            401,
            "K2_FIXTURE_UNAUTHENTICATED",
            "K2-09 fixture authorization failed.",
        ),
        (
            FixtureForbidden("provider detail"),
            403,
            "K2_FIXTURE_FORBIDDEN",
            "K2-09 fixture request is not permitted.",
        ),
        (
            FixtureConflict("provider detail"),
            409,
            "K2_FIXTURE_CONFLICT",
            "K2-09 fixture state conflicts with this request.",
        ),
        (
            FixtureUnavailable("provider detail"),
            503,
            "K2_FIXTURE_UNAVAILABLE",
            "K2-09 fixture control plane is temporarily unavailable.",
        ),
        (
            FixtureInternal("provider detail"),
            500,
            "K2_FIXTURE_INTERNAL",
            "K2-09 fixture request failed.",
        ),
    ],
)
def test_private_error_mapping_is_static(
    exception: Exception,
    status: int,
    code: str,
    message: str,
) -> None:
    from lingua_api.hosted_fixture.routes import _error

    response = _error(exception)
    assert response.status_code == status
    body = json.loads(bytes(response.body))
    assert body == {"error": {"code": code, "message": message}}
    assert "provider detail" not in json.dumps(body)
