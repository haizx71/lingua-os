from __future__ import annotations

import socket
import subprocess
import time
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest

from tests.acceptance.support import k2_hosted_probe as probe
from tests.backend.database.conftest import AUTH_BOOTSTRAP, POSTGRES_IMAGE, _run_docker


def _safe_start_local_container(*args: str) -> subprocess.CompletedProcess[str] | None:
    try:
        return _run_docker(*args)
    except Exception:
        return None


def _available_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_postgres(database_url: str) -> None:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            with psycopg.connect(database_url, connect_timeout=2) as connection:
                connection.execute("SELECT 1")
            return
        except psycopg.Error:
            time.sleep(0.5)
    raise RuntimeError("Local retained-snapshot PostgreSQL did not become ready") from None


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """Use loopback-only disposable PostgreSQL; never inherit TEST_DATABASE_URL."""
    port = _available_port()
    container_name = f"lingua-reader-retained-{uuid.uuid4().hex[:12]}"
    password = f"local-{uuid.uuid4().hex}"
    result = _safe_start_local_container(
        "run",
        "--detach",
        "--rm",
        "--name",
        container_name,
        "--publish",
        f"127.0.0.1:{port}:5432",
        "--env",
        f"POSTGRES_PASSWORD={password}",
        "--env",
        "POSTGRES_DB=lingua_test",
        POSTGRES_IMAGE,
    )
    if result is None:
        pytest.fail("Local retained-snapshot PostgreSQL container could not start.", pytrace=False)

    container_id = result.stdout.strip()
    database_url = f"postgresql://postgres:{password}@127.0.0.1:{port}/lingua_test"
    try:
        _wait_for_postgres(database_url)
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        yield database_url
    finally:
        if container_id:
            cleanup_ok = True
            try:
                _run_docker("rm", "--force", container_id, check=False)
            except Exception:
                cleanup_ok = False
            if not cleanup_ok:
                pytest.fail("Local retained-snapshot PostgreSQL cleanup failed.", pytrace=False)


@pytest.mark.parametrize("isolated_postgres_at_migration", ["0022"], indirect=True)
def test_pilot_retained_snapshot_excludes_only_exact_actor(
    isolated_postgres_at_migration: tuple[str, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_url, _ = isolated_postgres_at_migration
    monkeypatch.setattr(
        probe,
        "_table_inventory",
        lambda _connection: tuple(sorted(probe.EXPECTED_LEARNER_TABLES)),
    )
    target_actor = uuid.uuid4()
    unrelated_actor = uuid.uuid4()
    with psycopg.connect(database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (target_actor,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (target_actor,))
        connection.commit()

    with psycopg.connect(database_url) as connection:
        before = probe._snapshot(connection, None, exclude_actor_id=target_actor)
        target = probe._snapshot(connection, target_actor)
    assert before["totalRows"] == 0
    assert target["totalRows"] == 1
    assert set(before["tables"]) == set(probe.EXPECTED_LEARNER_TABLES)
    assert str(target_actor) not in repr(before)
    assert all(table["rows"] == 0 for table in before["tables"].values())

    with psycopg.connect(database_url) as connection:
        connection.execute("DELETE FROM auth.users WHERE id = %s", (target_actor,))
    with psycopg.connect(database_url) as connection:
        after = probe._snapshot(connection, None, exclude_actor_id=target_actor)
        target_after = probe._snapshot(connection, target_actor)
    assert after == before
    assert target_after["totalRows"] == 0

    with psycopg.connect(database_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (unrelated_actor,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (unrelated_actor,))
    with psycopg.connect(database_url) as connection:
        changed = probe._snapshot(connection, None, exclude_actor_id=target_actor)
    assert changed != before
    assert str(target_actor) not in repr(changed)


def test_pilot_retained_snapshot_uses_null_preserving_exact_exclusion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor_id = uuid.uuid4()

    class Cursor:
        def __init__(self) -> None:
            self.statement = ""
            self.parameters: tuple[Any, ...] | None = None
            self.sent = False

        def __enter__(self) -> Cursor:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def execute(self, statement: Any, parameters: tuple[Any, ...]) -> None:
            self.statement = str(statement)
            self.parameters = parameters

        def fetchmany(self, _size: int) -> list[tuple[str]]:
            if self.sent:
                return []
            self.sent = True
            return [('{"id":"retained"}',)]

    class Connection:
        def __init__(self) -> None:
            self.cursor_value = Cursor()

        def cursor(self, *, name: str) -> Cursor:
            assert name == "k2_acceptance_snapshot"
            return self.cursor_value

    connection = Connection()
    monkeypatch.setattr(probe, "_table_inventory", lambda _connection: ("users",))
    snapshot = probe._snapshot(connection, None, exclude_actor_id=actor_id)

    assert " IS DISTINCT FROM %s" in connection.cursor_value.statement
    assert "WHERE users.id = %s" not in connection.cursor_value.statement
    assert connection.cursor_value.parameters == (actor_id,)
    assert snapshot["tables"]["users"]["rows"] == 1
    assert str(actor_id) not in repr(snapshot)
