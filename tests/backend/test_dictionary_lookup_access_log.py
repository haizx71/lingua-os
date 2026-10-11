from __future__ import annotations

import asyncio
import io
import logging
import socket
import threading
import time
import uuid
from dataclasses import dataclass, field

import httpx2 as httpx
import uvicorn
from fastapi import FastAPI
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from uvicorn.logging import AccessFormatter


@dataclass
class StubTokenVerifier:
    actor: AuthenticatedActor = field(
        default_factory=lambda: AuthenticatedActor(
            uuid.UUID("10000000-0000-4000-8000-000000000098")
        )
    )

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "dictionary-access-log-test-token":
            raise AssertionError("unexpected token")
        return self.actor


def test_actual_uvicorn_access_log_never_contains_lookup_body_or_query() -> None:
    app: FastAPI = create_app(token_verifier=StubTokenVerifier())
    app.state.dictionary_lookup_provider = None

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    port = listener.getsockname()[1]

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
    access_logger = logging.getLogger("uvicorn.access")
    captured_output = io.StringIO()
    output = logging.StreamHandler(captured_output)
    output.setFormatter(AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s'))
    access_logger.addHandler(output)
    previous_level = access_logger.level
    access_logger.setLevel(logging.INFO)
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
        base = f"http://127.0.0.1:{port}"
        targets = (
            "/v1/dictionary/lookup?surface=readerquerysentinel",
            "/v1/dictionary/lookup/?surface=readerquerysentinel",
            "/%76%31/%64ictionary/%6c%6f%6f%6b%75%70?surface=readerquerysentinel",
            "/v1/dictionary/lookup%2F?surface=readerquerysentinel",
        )
        responses = [
            httpx.post(
                f"{base}{target}",
                json={"surface": "readerbodysecret"},
                headers={"Authorization": "Bearer dictionary-access-log-test-token"},
                timeout=2,
                trust_env=False,
            )
            for target in targets
        ]
        assert responses[0].status_code == 503
        assert responses[0].headers["cache-control"] == "private, no-store"
        assert all(response.status_code in {307, 404, 503} for response in responses)
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        listener.close()
        access_logger.removeHandler(output)
        access_logger.setLevel(previous_level)

    assert not thread.is_alive(), "local Uvicorn server did not stop"
    log_output = captured_output.getvalue()
    assert log_output.count("?[redacted]") == 4
    assert "/v1/dictionary/lookup?[redacted]" in log_output
    assert "readerquerysentinel" not in log_output
    assert "readerbodysecret" not in log_output
