from __future__ import annotations

import asyncio
import io
import json
import logging
import socket
import threading
import time
import uuid
from collections.abc import Iterable
from typing import Any

import httpx2 as httpx
import uvicorn
from fastapi import FastAPI
from lingua_api.dictionary.lookup import LOOKUP_PATH, MAX_LOOKUP_REQUEST_BYTES
from lingua_api.dictionary.request_limit import DictionaryLookupRequestBodyLimitMiddleware
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.routes import authenticated_actor


def _messages(chunks: Iterable[bytes]) -> list[dict[str, object]]:
    values = list(chunks)
    return [
        {"type": "http.request", "body": chunk, "more_body": index < len(values) - 1}
        for index, chunk in enumerate(values)
    ]


def _scope(
    *,
    path: str = LOOKUP_PATH,
    method: str = "POST",
    headers: list[tuple[bytes, bytes]] | None = None,
) -> dict[str, Any]:
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": headers or [],
        "state": {"request_id": uuid.uuid4()},
    }


async def _invoke_guard(
    *,
    body_messages: list[dict[str, object]],
    headers: list[tuple[bytes, bytes]] | None = None,
    path: str = LOOKUP_PATH,
    method: str = "POST",
) -> tuple[list[dict[str, object]], list[bytes], int]:
    messages = iter(body_messages)
    receive_calls = 0
    app_bodies: list[bytes] = []
    response_messages: list[dict[str, object]] = []

    async def receive() -> dict[str, object]:
        nonlocal receive_calls
        receive_calls += 1
        try:
            return next(messages)
        except StopIteration:
            return {"type": "http.disconnect"}

    async def inner_app(scope: object, app_receive: Any, send: Any) -> None:
        del scope
        chunks: list[bytes] = []
        while True:
            message = await app_receive()
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        app_bodies.append(b"".join(chunks))
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok", "more_body": False})

    async def send(message: dict[str, object]) -> None:
        response_messages.append(message)

    await DictionaryLookupRequestBodyLimitMiddleware(inner_app)(
        _scope(path=path, method=method, headers=headers), receive, send
    )
    return response_messages, app_bodies, receive_calls


def _status(messages: list[dict[str, object]]) -> int | None:
    for message in messages:
        if message.get("type") == "http.response.start":
            return int(message["status"])
    return None


def _body(messages: list[dict[str, object]]) -> bytes:
    return b"".join(
        message.get("body", b"")
        for message in messages
        if message.get("type") == "http.response.body"
    )


def test_asgi_lookup_body_limit_counts_streamed_bytes_before_router() -> None:
    exact_body = b"x" * MAX_LOOKUP_REQUEST_BYTES
    exact_messages, exact_bodies, _ = asyncio.run(
        _invoke_guard(
            body_messages=_messages((exact_body[:512], exact_body[512:])),
            headers=[(b"content-length", str(len(exact_body)).encode())],
        )
    )
    assert _status(exact_messages) == 200
    assert exact_bodies == [exact_body]

    secret_body = b"x" * MAX_LOOKUP_REQUEST_BYTES + b"SENTINEL"
    oversized_messages, oversized_bodies, calls = asyncio.run(
        _invoke_guard(
            body_messages=_messages(
                (secret_body[:MAX_LOOKUP_REQUEST_BYTES], secret_body[MAX_LOOKUP_REQUEST_BYTES:])
            ),
            headers=[(b"content-length", b"1")],
        )
    )
    response_body = _body(oversized_messages)
    assert _status(oversized_messages) == 422
    assert oversized_bodies == []
    assert calls == 2
    assert b"SENTINEL" not in response_body
    assert json.loads(response_body)["error"]["code"] == "VALIDATION_ERROR"
    assert json.loads(response_body)["error"]["message"] == "The request is invalid."


def test_asgi_lookup_body_limit_rejects_ambiguous_framing_and_cancellation() -> None:
    for headers in (
        [(b"content-length", b"4"), (b"content-length", b"4")],
        [(b"content-length", b"nope")],
        [(b"content-length", b"2"), (b"transfer-encoding", b"chunked")],
    ):
        response_messages, app_bodies, calls = asyncio.run(
            _invoke_guard(body_messages=[], headers=headers)
        )
        assert _status(response_messages) == 422
        assert app_bodies == []
        assert calls == 0

    response_messages, app_bodies, calls = asyncio.run(
        _invoke_guard(
            body_messages=[
                {"type": "http.request", "body": b"partial", "more_body": True},
                {"type": "http.disconnect"},
            ],
        )
    )
    assert response_messages == []
    assert app_bodies == []
    assert calls == 2


def test_asgi_lookup_body_limit_is_scoped_to_the_canonical_post_route() -> None:
    body = b"x" * (MAX_LOOKUP_REQUEST_BYTES + 1)
    for path, method in (("/v1/dictionary/other", "POST"), (LOOKUP_PATH, "GET")):
        response_messages, app_bodies, _ = asyncio.run(
            _invoke_guard(body_messages=_messages((body,)), path=path, method=method)
        )
        assert _status(response_messages) == 200
        assert app_bodies == [body]


def test_actual_uvicorn_rejects_large_unauthenticated_body_before_auth() -> None:
    app: FastAPI = create_app()
    app.state.dictionary_lookup_provider = None
    auth_calls = 0
    actor = AuthenticatedActor(uuid.UUID("10000000-0000-4000-8000-000000000097"))

    def auth_probe() -> AuthenticatedActor:
        nonlocal auth_calls
        auth_calls += 1
        return actor

    app.dependency_overrides[authenticated_actor] = auth_probe
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    port = listener.getsockname()[1]
    access_logger = logging.getLogger("uvicorn.access")
    access_log_level = access_logger.level
    access_stream = io.StringIO()
    access_handler = logging.StreamHandler(access_stream)
    access_logger.addHandler(access_handler)
    access_logger.setLevel(logging.INFO)
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="127.0.0.1",
            port=port,
            access_log=True,
            log_config=None,
            lifespan="off",
        )
    )
    thread = threading.Thread(
        target=lambda: asyncio.run(server.serve(sockets=[listener])),
        daemon=True,
    )
    thread.start()

    try:
        deadline = time.monotonic() + 5
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started, "local Uvicorn server did not start"
        base = f"http://127.0.0.1:{port}{LOOKUP_PATH}"
        prefix = b'{"surface":"tea"}'
        exact_body = prefix + b" " * (MAX_LOOKUP_REQUEST_BYTES - len(prefix))
        with httpx.Client(timeout=2, trust_env=False) as client:
            accepted_boundary = client.post(
                base,
                content=exact_body,
                headers={"Content-Type": "application/json"},
            )
            assert accepted_boundary.status_code == 503, accepted_boundary.text
            assert auth_calls == 1

            sentinel = b"body-secret-sentinel"
            oversized_body = (
                b'{"surface":"tea","padding":"'
                + b"x" * (MAX_LOOKUP_REQUEST_BYTES + 20)
                + sentinel
                + b'"}'
            )
            oversized = client.post(base, content=oversized_body)
            assert oversized.status_code == 422
            assert oversized.json()["error"]["code"] == "VALIDATION_ERROR"
            assert oversized.json()["error"]["message"] == "The request is invalid."
            assert sentinel.decode() not in oversized.text
            assert auth_calls == 1

            chunks = (
                b'{"surface":"tea","padding":"',
                b"c" * MAX_LOOKUP_REQUEST_BYTES,
                b'"}',
            )
            chunked = client.post(
                base,
                content=iter(chunks),
                headers={"Content-Type": "application/json"},
            )
            assert chunked.status_code == 422
            assert chunked.json()["error"]["code"] == "VALIDATION_ERROR"
            assert auth_calls == 1
            assert sentinel.decode() not in access_stream.getvalue()
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        listener.close()
        access_logger.removeHandler(access_handler)
        access_logger.setLevel(access_log_level)
        access_handler.close()

    assert not thread.is_alive(), "local Uvicorn server did not stop"
