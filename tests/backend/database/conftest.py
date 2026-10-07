from __future__ import annotations

import os
import shutil
import socket
import subprocess
import time
import uuid
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from psycopg import Connection, sql
from psycopg.conninfo import make_conninfo

from database.migrate import migrate_up

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = ROOT / "database" / "migrations"
AUTH_BOOTSTRAP = Path(__file__).with_name("supabase_test_bootstrap.sql")
POSTGRES_IMAGE = "postgres:17.11-alpine3.24"


def _run_docker(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", *args],
        check=check,
        capture_output=True,
        text=True,
        timeout=120,
    )


def _available_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_postgres(database_url: str) -> None:
    deadline = time.monotonic() + 45
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with psycopg.connect(database_url, connect_timeout=2) as connection:
                connection.execute("SELECT 1")
            return
        except psycopg.Error as error:
            last_error = error
            time.sleep(0.5)
    raise RuntimeError("PostgreSQL test container did not become ready") from last_error


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    external_url = os.getenv("TEST_DATABASE_URL")
    if external_url:
        with psycopg.connect(external_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        yield external_url
        return

    port = _available_port()
    container_name = f"lingua-os-task003-{uuid.uuid4().hex[:12]}"
    try:
        result = _run_docker(
            "run",
            "--detach",
            "--rm",
            "--name",
            container_name,
            "--publish",
            f"127.0.0.1:{port}:5432",
            "--env",
            "POSTGRES_PASSWORD=lingua_test_password",
            "--env",
            "POSTGRES_DB=lingua_test",
            POSTGRES_IMAGE,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        pytest.fail(
            "A real PostgreSQL instance is required. Start Docker Desktop or set "
            f"TEST_DATABASE_URL. Docker error: {error}"
        )

    container_id = result.stdout.strip()
    database_url = f"postgresql://postgres:lingua_test_password@127.0.0.1:{port}/lingua_test"
    try:
        _wait_for_postgres(database_url)
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        yield database_url
    finally:
        if container_id:
            _run_docker("rm", "--force", container_id, check=False)


@pytest.fixture(scope="session")
def migrated_postgres_url(postgres_url: str) -> str:
    migrate_up(postgres_url, MIGRATIONS_DIR)
    return postgres_url


@pytest.fixture
def isolated_migrated_postgres_url(postgres_url: str) -> Iterator[str]:
    database_name = f"lingua_isolated_{uuid.uuid4().hex}"
    admin_url = make_conninfo(postgres_url, dbname="postgres")
    database_url = make_conninfo(postgres_url, dbname=database_name)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    try:
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        migrate_up(database_url, MIGRATIONS_DIR)
        yield database_url
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name))
            )


@pytest.fixture
def isolated_postgres_at_migration(
    postgres_url: str, request: pytest.FixtureRequest, tmp_path: Path
) -> Iterator[tuple[str, Path]]:
    """Create a disposable database migrated through the requested version only."""
    target_version = getattr(request, "param", None)
    if (
        not isinstance(target_version, str)
        or len(target_version) != 4
        or not target_version.isdigit()
    ):
        raise pytest.UsageError("migration boundary must be a four-digit version string")

    prefix_migrations_dir = tmp_path / "migrations"
    prefix_migrations_dir.mkdir()
    included_versions: set[str] = set()
    for migration_path in MIGRATIONS_DIR.glob("*.sql"):
        version = migration_path.name[:4]
        if version.isdigit() and version <= target_version:
            shutil.copyfile(migration_path, prefix_migrations_dir / migration_path.name)
            included_versions.add(version)
    if target_version not in included_versions:
        raise pytest.UsageError(f"unknown migration boundary {target_version}")

    database_name = f"lingua_boundary_{uuid.uuid4().hex}"
    admin_url = make_conninfo(postgres_url, dbname="postgres")
    database_url = make_conninfo(postgres_url, dbname=database_name)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    try:
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        applied = migrate_up(database_url, prefix_migrations_dir)
        if not applied or applied[-1] != target_version:
            pytest.fail(f"isolated migration prefix did not end at {target_version}")
        yield database_url, prefix_migrations_dir
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name))
            )


@pytest.fixture
def db_connection(migrated_postgres_url: str) -> Iterator[Connection[tuple[object, ...]]]:
    with psycopg.connect(migrated_postgres_url) as connection:
        yield connection
        connection.rollback()
