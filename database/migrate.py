"""Transactional SQL migration runner for the LINGUA OS PostgreSQL schema."""

from __future__ import annotations

import argparse
import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path

import psycopg
from psycopg import Connection

DEFAULT_MIGRATIONS_DIR = Path(__file__).with_name("migrations")
MIGRATION_PATTERN = re.compile(
    r"^(?P<version>\d{4})_(?P<name>[a-z0-9_]+)\.(?P<direction>up|down)\.sql$"
)


class MigrationError(RuntimeError):
    """Base migration failure."""


class MigrationChecksumError(MigrationError):
    """An applied migration no longer matches its recorded checksum."""


@dataclass(frozen=True)
class Migration:
    """A paired forward and rollback SQL migration."""

    version: str
    name: str
    up_path: Path
    down_path: Path
    checksum: str


def _checksum(up_path: Path, down_path: Path) -> str:
    digest = hashlib.sha256()
    for label, path in ((b"up\0", up_path), (b"down\0", down_path)):
        digest.update(label)
        digest.update(path.read_bytes())
    return digest.hexdigest()


def discover_migrations(migrations_dir: Path = DEFAULT_MIGRATIONS_DIR) -> list[Migration]:
    """Return validated migration pairs ordered by numeric version."""
    discovered: dict[tuple[str, str], dict[str, Path]] = {}
    for path in migrations_dir.glob("*.sql"):
        match = MIGRATION_PATTERN.fullmatch(path.name)
        if match is None:
            continue
        key = (match.group("version"), match.group("name"))
        directions = discovered.setdefault(key, {})
        direction = match.group("direction")
        if direction in directions:
            raise MigrationError(f"Duplicate {direction} migration for {key[0]}_{key[1]}")
        directions[direction] = path

    migrations: list[Migration] = []
    seen_versions: set[str] = set()
    for (version, name), directions in sorted(discovered.items()):
        if version in seen_versions:
            raise MigrationError(f"Migration version {version} is not unique")
        seen_versions.add(version)
        if set(directions) != {"up", "down"}:
            raise MigrationError(f"Migration {version}_{name} requires both up and down SQL files")
        up_path = directions["up"]
        down_path = directions["down"]
        migrations.append(
            Migration(
                version=version,
                name=name,
                up_path=up_path,
                down_path=down_path,
                checksum=_checksum(up_path, down_path),
            )
        )
    return migrations


def _connect(database_url: str) -> Connection[tuple[object, ...]]:
    return psycopg.connect(database_url)


def _ensure_history(connection: Connection[tuple[object, ...]]) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            version text PRIMARY KEY,
            name text NOT NULL,
            checksum text NOT NULL CHECK (length(checksum) = 64),
            applied_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    connection.commit()


def _acquire_migration_lock(connection: Connection[tuple[object, ...]]) -> None:
    # A session-level advisory lock serializes runners across deploy processes. PostgreSQL
    # releases it automatically when this dedicated connection closes, including on errors.
    connection.execute(
        "SELECT pg_advisory_lock(hashtextextended('lingua_os_schema_migrations', 0))"
    )


def _applied_migrations(
    connection: Connection[tuple[object, ...]],
) -> dict[str, tuple[str, str]]:
    rows = connection.execute(
        "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version"
    ).fetchall()
    return {str(version): (str(name), str(checksum)) for version, name, checksum in rows}


def migrate_up(database_url: str, migrations_dir: Path = DEFAULT_MIGRATIONS_DIR) -> list[str]:
    """Apply every pending migration transactionally and return applied versions."""
    migrations = discover_migrations(migrations_dir)
    applied_now: list[str] = []
    with _connect(database_url) as connection:
        _ensure_history(connection)
        _acquire_migration_lock(connection)
        applied = _applied_migrations(connection)
        known_versions = {migration.version for migration in migrations}
        unknown_versions = set(applied) - known_versions
        if unknown_versions:
            raise MigrationError(
                "Applied migrations are missing from disk: " + ", ".join(sorted(unknown_versions))
            )

        for migration in migrations:
            recorded = applied.get(migration.version)
            if recorded is not None:
                recorded_name, recorded_checksum = recorded
                if (recorded_name, recorded_checksum) != (migration.name, migration.checksum):
                    raise MigrationChecksumError(
                        f"Applied migration {migration.version}_{recorded_name} was modified"
                    )
                continue

            with connection.transaction():
                connection.execute(migration.up_path.read_text(encoding="utf-8"))
                connection.execute(
                    """
                    INSERT INTO public.schema_migrations (version, name, checksum)
                    VALUES (%s, %s, %s)
                    """,
                    (migration.version, migration.name, migration.checksum),
                )
            applied_now.append(migration.version)
    return applied_now


def migrate_down(
    database_url: str,
    migrations_dir: Path = DEFAULT_MIGRATIONS_DIR,
    *,
    steps: int = 1,
) -> list[str]:
    """Roll back the most recent migrations and return reverted versions."""
    if steps < 1:
        raise ValueError("steps must be at least 1")
    migrations = {migration.version: migration for migration in discover_migrations(migrations_dir)}
    reverted: list[str] = []
    with _connect(database_url) as connection:
        _ensure_history(connection)
        _acquire_migration_lock(connection)
        rows = connection.execute(
            "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version DESC"
        ).fetchall()
        for version_value, name_value, checksum_value in rows[:steps]:
            version = str(version_value)
            migration = migrations.get(version)
            if migration is None:
                raise MigrationError(f"Cannot roll back unknown migration {version}")
            if (str(name_value), str(checksum_value)) != (migration.name, migration.checksum):
                raise MigrationChecksumError(
                    f"Applied migration {version}_{name_value} was modified"
                )
            with connection.transaction():
                connection.execute(migration.down_path.read_text(encoding="utf-8"))
                connection.execute(
                    "DELETE FROM public.schema_migrations WHERE version = %s", (version,)
                )
            reverted.append(version)
    return reverted


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise MigrationError("DATABASE_URL is required")
    return database_url


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--migrations-dir", type=Path, default=DEFAULT_MIGRATIONS_DIR, help="Migration directory"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("up", help="Apply pending migrations")
    down_parser = subparsers.add_parser("down", help="Roll back recent migrations")
    down_parser.add_argument("--steps", type=int, default=1)
    args = parser.parse_args()

    database_url = _database_url()
    if args.command == "up":
        versions = migrate_up(database_url, args.migrations_dir)
        action = "Applied"
    else:
        versions = migrate_down(database_url, args.migrations_dir, steps=args.steps)
        action = "Reverted"
    print(f"{action}: {', '.join(versions) if versions else 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
