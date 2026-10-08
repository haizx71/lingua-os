from __future__ import annotations

import os
import re
import shutil
import socket
import subprocess
import threading
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor

ROOT = Path(__file__).resolve().parents[3]
ANCHOR_ID = "7f110000-0000-4000-8000-000000000004"
AUTH_HEADERS = {"Authorization": "Bearer valid-token"}


class StubTokenVerifier:
    def __init__(self, actor: AuthenticatedActor) -> None:
        self.actor = actor

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "valid-token":
            raise AssertionError("unexpected local test token")
        return self.actor


@dataclass(frozen=True)
class LocalTodayBrowserState:
    client: TestClient = field(repr=False)
    profile_id: uuid.UUID = field(repr=False)
    actor_id: uuid.UUID = field(repr=False)


@pytest.fixture
def local_today_client(isolated_migrated_postgres_url: str) -> Iterator[LocalTodayBrowserState]:
    database_url = isolated_migrated_postgres_url
    actor_id = uuid.uuid4()
    with psycopg.connect(database_url) as connection:
        seed = ROOT / "database" / "seeds" / "first_real_learning_loop.sql"
        connection.execute(seed.read_text(encoding="utf-8"))
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))

    actor = AuthenticatedActor(actor_id)
    client = TestClient(create_app(
        database_url=database_url,
        token_verifier=StubTokenVerifier(actor),
        cursor_secret=b"k210-local-today-browser-test-secret",
    ))
    me = client.get("/v1/me", headers=AUTH_HEADERS)
    assert me.status_code == 200
    assert me.json()["data"]["languageProfiles"] == []
    timezone = client.patch(
        "/v1/me",
        headers={**AUTH_HEADERS, "If-Match": me.headers["etag"]},
        json={"timeZone": "Asia/Ho_Chi_Minh"},
    )
    assert timezone.status_code == 200
    profile = client.post(
        "/v1/me/languages",
        headers={**AUTH_HEADERS, "Idempotency-Key": str(uuid.uuid4())},
        json={
            "targetLanguageCode": "en",
            "nativeLanguageCode": "vi",
            "goal": "communication",
            "dailyMinutes": 15,
        },
    )
    assert profile.status_code == 201
    profile_id = uuid.UUID(profile.json()["data"]["id"])

    saved = client.put(f"/v1/library/concepts/{ANCHOR_ID}", headers=AUTH_HEADERS)
    assert saved.status_code == 200
    queue = client.get("/v1/review/queue", headers=AUTH_HEADERS)
    assert queue.status_code == 200
    assert len(queue.json()["data"]) == 1
    assert queue.json()["data"][0]["concept"]["id"] == ANCHOR_ID

    with psycopg.connect(database_url) as connection:
        fresh_memory = connection.execute(
            """
            SELECT state, difficulty, stability, step
            FROM fsrs_states WHERE user_id = %s
            """,
            (actor_id,),
        ).fetchone()
    assert fresh_memory == ("new", None, None, None)
    yield LocalTodayBrowserState(client, profile_id, actor_id)


def test_real_saved_frll_anchor_renders_from_local_today_api_in_browser(
    local_today_client: LocalTodayBrowserState,
) -> None:
    client = local_today_client.client
    profile_id = local_today_client.profile_id
    actor_id = local_today_client.actor_id
    first = client.get("/v1/today", headers=AUTH_HEADERS)
    assert first.status_code == 200
    plan = first.json()["data"]
    review = next(item for item in plan["activities"] if item["activityType"] == "review")
    assert plan["languageProfileId"] == str(profile_id)
    assert review["reasonCodes"] == ["FSRS_DUE"]
    assert review["targetCount"] == 1

    class ApiBridgeHandler(BaseHTTPRequestHandler):
        observed: list[tuple[str, int]] = []

        def log_message(self, _format: str, *_args: object) -> None:
            return

        def _cors_origin(self) -> str | None:
            origin = self.headers.get("Origin", "")
            if not origin:
                return None
            parsed = urlsplit(origin)
            if parsed.scheme != "http" or parsed.hostname != "127.0.0.1":
                return None
            return origin

        def do_OPTIONS(self) -> None:
            origin = self._cors_origin()
            if self.client_address[0] != "127.0.0.1" or (self.headers.get("Origin") and origin is None):
                self.send_error(403)
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "authorization")
            self.end_headers()

        def do_GET(self) -> None:
            origin = self._cors_origin()
            if self.client_address[0] != "127.0.0.1" or (self.headers.get("Origin") and origin is None):
                self.send_error(403)
                return
            parsed = urlsplit(self.path)
            if parsed.path not in {"/v1/me", "/v1/me/languages", "/v1/today"} or self.headers.get("Authorization") != "Bearer valid-token":
                self.send_error(403)
                return
            response = client.get(self.path, headers=AUTH_HEADERS)
            ApiBridgeHandler.observed.append((parsed.path, response.status_code))
            self.send_response(response.status_code)
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(response.content)))
            self.end_headers()
            self.wfile.write(response.content)

    node = shutil.which("node")
    assert node is not None

    ApiBridgeHandler.observed = []
    api_server = ThreadingHTTPServer(("127.0.0.1", 0), ApiBridgeHandler)
    api_thread = threading.Thread(target=api_server.serve_forever, daemon=True)
    api_thread.start()
    api_port = api_server.server_address[1]

    browser_script = ROOT / "tests" / "acceptance" / "support" / "k210_local_today_browser_temp.mjs"
    child_env = {
        name: os.environ[name]
        for name in (
            "PATH", "SystemRoot", "WINDIR", "PATHEXT", "TEMP", "TMP",
            "USERPROFILE", "LOCALAPPDATA", "APPDATA",
        )
        if name in os.environ
    }
    try:
        result = subprocess.run(
            [node, str(browser_script), str(api_port), str(actor_id), str(profile_id)],
            cwd=ROOT,
            env=child_env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=60,
            check=False,
        )
        if result.returncode != 0 or "K2_LOCAL_TODAY_BROWSER_PASS" not in result.stdout:
            safe_marker = next(
                (
                    line
                    for line in result.stdout.splitlines()
                    if re.fullmatch(
                        r"K2_LOCAL_TODAY_BROWSER_FAIL stage=(?:vite_start|intercept_module|page_route|page_navigation|today_heading|complete) class=(?:none|module_resolution|module_file_missing|package_missing|module_load|dirname_unavailable|process_unavailable|k2_guard_rejected|timeout|other) direct=\d{1,3} me=\d{1,3} languages=\d{1,3} today=\d{1,3} api_ok=\d{1,3} api_error=\d{1,3} api_failed=\d{1,3}",
                        line,
                    )
                ),
                None,
            )
            pytest.fail(
                safe_marker
                or "The loopback-only Today browser render did not pass; runtime details suppressed."
            )
    finally:
        api_server.shutdown()
        api_server.server_close()
        api_thread.join(timeout=2)

    assert ApiBridgeHandler.observed.count(("/v1/me", 200)) >= 2
    assert ApiBridgeHandler.observed.count(("/v1/me/languages", 200)) >= 1
    assert ApiBridgeHandler.observed.count(("/v1/today", 200)) >= 1
