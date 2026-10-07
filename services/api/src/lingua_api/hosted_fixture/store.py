"""Transactional catalog fixture operations; deliberately contains no Auth/learner SQL."""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qsl, urlsplit
from uuid import UUID

import psycopg
from psycopg import Connection
from psycopg.errors import ForeignKeyViolation, UniqueViolation

from lingua_api.hosted_fixture.errors import (
    FixtureConflict,
    FixtureForbidden,
    FixtureInternal,
    FixtureUnavailable,
)
from lingua_api.hosted_fixture.protocol import (
    ACTIVE_TTL_SECONDS,
    ADVISORY_LOCK_KEY,
    ARTIFACT_RELATIVE_PATH,
    ARTIFACT_SHA256,
    LICENSE_CODE,
    LICENSE_NAME,
    PROTOCOL_VERSION,
    REAPER_BATCH_LIMIT,
    RENDER_SERVICE_ID,
    RENDER_SERVICE_NAME,
    REPOSITORY_ID,
    SOURCE_ATTRIBUTION,
    SOURCE_NAME,
    SOURCE_VERSION,
    SUPABASE_PROJECT_REF,
    TERMINAL_RETENTION_SECONDS,
    TRANSACTION_TIMEOUT_MS,
    FixtureIds,
    RunClaims,
    derive_fixture_ids,
    fixture_payload,
    source_record_hash,
    success_counts,
)

_PUBLIC_MUTATION_TABLES = (
    "concept_senses",
    "concepts",
    "lexeme_forms",
    "lexemes",
    "source_records",
    "word_senses",
)
_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_EXPECTED_SOURCE_TYPE = "internal"
_EXPECTED_LICENSE_POLICY = "allowed"
_EXPECTED_ATTRIBUTION_REQUIRED = False
_DIRECT_DATABASE_HOST = f"db.{SUPABASE_PROJECT_REF}.supabase.co"
_SHARED_POOLER_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"
_PINNED_CA_RELATIVE_PATH = Path("database/certs/supabase-prod-ca-2021.crt")
_PINNED_CA_SHA256 = "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7"
_LIBPQ_TARGET_OVERRIDES = (
    "PGHOST",
    "PGHOSTADDR",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGOPTIONS",
)


def _database_url_matches_project(database_url: str, project_ref: str) -> bool:
    """Bind the existing database URI to the fixed Supabase project without exposing it."""
    if project_ref != SUPABASE_PROJECT_REF or not database_url or len(database_url) > 16_384:
        return False
    try:
        parsed = urlsplit(database_url)
        port = parsed.port
        username = parsed.username
        query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    except (ValueError, UnicodeError):
        return False
    if (
        parsed.scheme not in {"postgres", "postgresql"}
        or parsed.fragment
        or parsed.path != "/postgres"
        or parsed.hostname is None
        or username is None
        or parsed.netloc.count("@") != 1
    ):
        return False

    userinfo = parsed.netloc.split("@", 1)[0]
    raw_username = userinfo.partition(":")[0]
    if not raw_username or "%" in raw_username or (":" in userinfo and not parsed.password):
        return False

    if parsed.hostname == _DIRECT_DATABASE_HOST:
        target_matches = port == 5432 and username == "postgres"
    elif parsed.hostname == _SHARED_POOLER_HOST:
        target_matches = port in {5432, 6543} and username == f"postgres.{project_ref}"
    else:
        target_matches = False

    if not target_matches or parsed.netloc.rsplit("@", 1)[-1] != f"{parsed.hostname}:{port}":
        return False

    seen: set[str] = set()
    for name, value in query:
        if name in seen:
            return False
        seen.add(name)
        if name == "sslmode":
            if value not in {"require", "verify-ca", "verify-full"}:
                return False
        elif name == "sslrootcert":
            if not value or "\x00" in value:
                return False
        else:
            # In particular, reject libpq host/service/user/database overrides.
            return False
    return True


def _verified_pinned_ca_path() -> str:
    """Return the repository-pinned Supabase CA only when its bytes match the reviewed digest."""
    path = Path(__file__).resolve().parents[5] / _PINNED_CA_RELATIVE_PATH
    try:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        raise FixtureUnavailable() from None
    if digest != _PINNED_CA_SHA256:
        raise FixtureUnavailable()
    return str(path)


class PostgresFixtureStore:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise FixtureUnavailable()
        self._database_url = database_url
        self._artifact = self._load_artifact()

    def assert_render_target(
        self, environ: dict[str, str] | os._Environ[str] | None = None
    ) -> None:
        values = os.environ if environ is None else environ
        if (
            values.get("RENDER_SERVICE_ID") != RENDER_SERVICE_ID
            or values.get("RENDER_SERVICE_NAME") != RENDER_SERVICE_NAME
            or values.get("SUPABASE_URL") != f"https://{SUPABASE_PROJECT_REF}.supabase.co"
            or any(values.get(name) for name in _LIBPQ_TARGET_OVERRIDES)
            or not _database_url_matches_project(self._database_url, SUPABASE_PROJECT_REF)
        ):
            raise FixtureForbidden()

    def runtime_guard(self) -> None:
        self.assert_render_target()
        try:
            with self._connect() as connection:
                self._runtime_guard(connection)
        except (FixtureConflict, FixtureForbidden, FixtureUnavailable):
            raise
        except psycopg.Error:
            raise FixtureUnavailable() from None

    def inspect(self, claims: RunClaims) -> dict[str, Any]:
        ids = derive_fixture_ids(claims)
        try:
            with self._connect() as connection, connection.transaction():
                self._runtime_guard(connection)
                self._lock_and_verify_manifest(connection)
                source_id, license_id = self._approved_source(connection)
                raw_hash = source_record_hash(ids, source_id=source_id, license_id=license_id)
                receipt = self._receipt(connection, claims.run_id)
                if receipt is None:
                    self._assert_no_collisions(connection, ids, source_id, raw_hash)
                    if self._fixture_counts(connection, ids) != success_counts(present=False):
                        raise FixtureConflict()
                    return self._inspection_dto("ABSENT", None, success_counts(present=False))
                self._assert_receipt(receipt, claims, ids, raw_hash)
                state = str(receipt[7])
                if state == "CLOSED":
                    self._assert_fixture_absent(connection, ids, source_id, raw_hash)
                    return self._inspection_dto("CLOSED", None, success_counts(present=False))
                self._assert_fixture_tree(connection, ids, source_id, raw_hash)
                return self._inspection_dto("ACTIVE", ids, success_counts(present=True))
        except (FixtureConflict, FixtureForbidden, FixtureUnavailable, FixtureInternal):
            raise
        except (UniqueViolation, ForeignKeyViolation):
            raise FixtureConflict() from None
        except psycopg.Error:
            raise FixtureUnavailable() from None

    def setup(self, claims: RunClaims) -> dict[str, Any]:
        ids = derive_fixture_ids(claims)
        try:
            with self._connect() as connection, connection.transaction():
                self._runtime_guard(connection)
                self._lock_and_verify_manifest(connection)
                source_id, license_id = self._approved_source(connection)
                raw_hash = source_record_hash(ids, source_id=source_id, license_id=license_id)
                receipt = self._receipt(connection, claims.run_id, for_update=True)
                if receipt is not None:
                    self._assert_receipt(receipt, claims, ids, raw_hash)
                    if str(receipt[7]) != "ACTIVE":
                        raise FixtureConflict()
                    self._assert_fixture_tree(connection, ids, source_id, raw_hash)
                    response = self._setup_dto(ids, "verified_existing")
                    return response

                self._assert_no_collisions(connection, ids, source_id, raw_hash)
                self._lock_source_identity(connection, source_id, license_id)
                self._insert_fixture(connection, ids, source_id=source_id, raw_hash=raw_hash)
                inserted = self._fixture_counts(connection, ids)
                if inserted != success_counts(present=True):
                    raise FixtureConflict()
                connection.execute(
                    """
                    INSERT INTO private.k2_hosted_fixture_receipts
                        (repository_id, run_id, run_attempt, sha, protocol_version,
                         source_record_id, source_record_hash, state)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
                    """,
                    (
                        claims.repository_id,
                        claims.run_id,
                        claims.run_attempt,
                        claims.sha,
                        PROTOCOL_VERSION,
                        ids.source_record,
                        raw_hash,
                    ),
                )
                self._assert_fixture_tree(connection, ids, source_id, raw_hash)
                return self._setup_dto(ids, "created")
        except (FixtureConflict, FixtureForbidden, FixtureUnavailable, FixtureInternal):
            raise
        except (UniqueViolation, ForeignKeyViolation):
            raise FixtureConflict() from None
        except psycopg.Error:
            raise FixtureUnavailable() from None

    def cleanup(self, claims: RunClaims) -> dict[str, Any]:
        ids = derive_fixture_ids(claims)
        try:
            with self._connect() as connection, connection.transaction():
                self._runtime_guard(connection)
                self._lock_and_verify_manifest(connection)
                source_id, license_id = self._approved_source(connection)
                raw_hash = source_record_hash(ids, source_id=source_id, license_id=license_id)
                receipt = self._receipt(connection, claims.run_id, for_update=True)
                if receipt is None:
                    raise FixtureConflict()
                self._assert_receipt(receipt, claims, ids, raw_hash)
                if str(receipt[7]) == "CLOSED":
                    self._assert_fixture_absent(connection, ids, source_id, raw_hash)
                    return self._cleanup_dto(success_counts(present=False))
                self._assert_fixture_tree(connection, ids, source_id, raw_hash)
                self._lock_fixture_parents(connection, ids, source_id)
                self._assert_no_external_cascade_rows(connection, ids)
                self._delete_fixture(connection, ids)
                self._assert_fixture_absent(connection, ids, source_id, raw_hash)
                updated = connection.execute(
                    """
                    UPDATE private.k2_hosted_fixture_receipts
                    SET state = 'CLOSED', closed_at = clock_timestamp()
                    WHERE repository_id = %s AND run_id = %s AND run_attempt = %s
                      AND sha = %s AND protocol_version = %s AND state = 'ACTIVE'
                    """,
                    (
                        claims.repository_id,
                        claims.run_id,
                        claims.run_attempt,
                        claims.sha,
                        PROTOCOL_VERSION,
                    ),
                )
                if updated.rowcount != 1:
                    raise FixtureConflict()
                return self._cleanup_dto(success_counts(present=True))
        except (FixtureConflict, FixtureForbidden, FixtureUnavailable, FixtureInternal):
            raise
        except (UniqueViolation, ForeignKeyViolation):
            raise FixtureConflict() from None
        except psycopg.Error:
            raise FixtureUnavailable() from None

    def reap_candidates(self) -> list[dict[str, Any]]:
        """Return a bounded, non-sensitive snapshot for GitHub completion checks."""
        try:
            with self._connect() as connection, connection.transaction():
                self._runtime_guard(connection)
                self._lock_and_verify_manifest(connection)
                rows = connection.execute(
                    """
                    SELECT repository_id, run_id, run_attempt, sha, protocol_version,
                           source_record_id, source_record_hash, state, created_at, closed_at
                    FROM private.k2_hosted_fixture_receipts
                    WHERE (state = 'ACTIVE'
                           AND created_at <= clock_timestamp() - (%s * interval '1 second'))
                       OR (state = 'CLOSED'
                           AND closed_at <= clock_timestamp() - (%s * interval '1 second'))
                    ORDER BY created_at, run_id
                    LIMIT %s
                    """,
                    (ACTIVE_TTL_SECONDS, TERMINAL_RETENTION_SECONDS, REAPER_BATCH_LIMIT),
                ).fetchall()
                return [
                    {
                        "repository_id": _as_int(row[0]),
                        "run_id": _as_int(row[1]),
                        "run_attempt": _as_int(row[2]),
                        "sha": str(row[3]),
                        "protocol_version": str(row[4]),
                        "source_record_id": str(row[5]),
                        "source_record_hash": str(row[6]),
                        "state": str(row[7]),
                        "created_at": row[8],
                        "closed_at": row[9],
                    }
                    for row in rows
                ]
        except (FixtureConflict, FixtureForbidden, FixtureUnavailable, FixtureInternal):
            raise
        except psycopg.Error:
            raise FixtureUnavailable() from None

    def reap(self, candidates: list[dict[str, Any]]) -> dict[str, int | str]:
        """Apply only the exact previously inspected bounded candidate set."""
        if len(candidates) > REAPER_BATCH_LIMIT:
            raise FixtureConflict()
        if not candidates:
            return {
                "protocolVersion": PROTOCOL_VERSION,
                "processedCount": 0,
                "closedFixtureCount": 0,
                "purgedReceiptCount": 0,
            }
        try:
            with self._connect() as connection, connection.transaction():
                self._runtime_guard(connection)
                self._lock_and_verify_manifest(connection)
                closed = 0
                purged = 0
                for candidate in candidates:
                    receipt = self._receipt(connection, int(candidate["run_id"]), for_update=True)
                    if receipt is None or self._receipt_tuple(receipt) != self._candidate_tuple(
                        candidate
                    ):
                        raise FixtureConflict()
                    state = str(receipt[7])
                    if state == "ACTIVE":
                        if not self._is_expired(receipt):
                            raise FixtureConflict()
                        claims = RunClaims(
                            repository_id=int(receipt[0]),
                            run_id=int(receipt[1]),
                            run_attempt=int(receipt[2]),
                            sha=str(receipt[3]),
                            workflow_sha=str(receipt[3]),
                            jti="verified-reaper-receipt",
                            issued_at=0,
                            expires_at=1,
                        )
                        ids = derive_fixture_ids(claims)
                        source_id, license_id = self._approved_source(connection)
                        raw_hash = source_record_hash(
                            ids, source_id=source_id, license_id=license_id
                        )
                        if (
                            int(receipt[0]) != REPOSITORY_ID
                            or str(receipt[4]) != PROTOCOL_VERSION
                            or str(receipt[5]) != str(ids.source_record)
                            or str(receipt[6]) != raw_hash
                        ):
                            raise FixtureConflict()
                        self._assert_fixture_tree(connection, ids, source_id, raw_hash)
                        self._lock_fixture_parents(connection, ids, source_id)
                        self._assert_no_external_cascade_rows(connection, ids)
                        self._delete_fixture(connection, ids)
                        self._assert_fixture_absent(connection, ids, source_id, raw_hash)
                        updated = connection.execute(
                            """
                            UPDATE private.k2_hosted_fixture_receipts
                            SET state = 'CLOSED', closed_at = clock_timestamp()
                            WHERE repository_id = %s AND run_id = %s AND run_attempt = %s
                              AND sha = %s AND state = 'ACTIVE'
                            """,
                            (receipt[0], receipt[1], receipt[2], receipt[3]),
                        )
                        if updated.rowcount != 1:
                            raise FixtureConflict()
                        closed += 1
                    elif state == "CLOSED":
                        if not self._is_expired(receipt, terminal=True):
                            raise FixtureConflict()
                        claims = RunClaims(
                            repository_id=int(receipt[0]),
                            run_id=int(receipt[1]),
                            run_attempt=int(receipt[2]),
                            sha=str(receipt[3]),
                            workflow_sha=str(receipt[3]),
                            jti="verified-reaper-receipt",
                            issued_at=0,
                            expires_at=1,
                        )
                        try:
                            ids = derive_fixture_ids(claims)
                        except ValueError:
                            raise FixtureConflict() from None
                        source_id, license_id = self._approved_source(connection)
                        raw_hash = source_record_hash(
                            ids, source_id=source_id, license_id=license_id
                        )
                        self._assert_receipt(receipt, claims, ids, raw_hash)
                        self._assert_fixture_absent(connection, ids, source_id, raw_hash)
                        deleted = connection.execute(
                            """
                            DELETE FROM private.k2_hosted_fixture_receipts
                            WHERE repository_id = %s AND run_id = %s AND run_attempt = %s
                              AND sha = %s AND state = 'CLOSED'
                            """,
                            (receipt[0], receipt[1], receipt[2], receipt[3]),
                        )
                        if deleted.rowcount != 1:
                            raise FixtureConflict()
                        purged += 1
                    else:
                        raise FixtureConflict()
                return {
                    "protocolVersion": PROTOCOL_VERSION,
                    "processedCount": len(candidates),
                    "closedFixtureCount": closed,
                    "purgedReceiptCount": purged,
                }
        except (FixtureConflict, FixtureForbidden, FixtureUnavailable, FixtureInternal):
            raise
        except (UniqueViolation, ForeignKeyViolation):
            raise FixtureConflict() from None
        except psycopg.Error:
            raise FixtureUnavailable() from None

    def _connect(self) -> Connection[tuple[object, ...]]:
        self.assert_render_target()
        pinned_ca_path = _verified_pinned_ca_path()
        return cast(
            Connection[tuple[object, ...]],
            psycopg.connect(
                self._database_url,
                connect_timeout=5,
                prepare_threshold=None,
                # These keyword arguments take precedence over the existing DSN and
                # libpq defaults, upgrading this controller connection to verified TLS.
                sslmode="verify-full",
                sslrootcert=pinned_ca_path,
                options=(
                    f"-c statement_timeout={TRANSACTION_TIMEOUT_MS} "
                    "-c lock_timeout=5000 -c idle_in_transaction_session_timeout=10000"
                ),
            ),
        )

    @staticmethod
    def _load_artifact() -> dict[str, Any]:
        root = Path(__file__).resolve().parents[5]
        path = root / ARTIFACT_RELATIVE_PATH
        try:
            content = path.read_bytes()
            if hashlib.sha256(content).hexdigest() != ARTIFACT_SHA256:
                raise FixtureInternal()
            artifact = json.loads(content)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            raise FixtureInternal() from None
        if (
            not isinstance(artifact, dict)
            or artifact.get("schemaVersion") != "k2-09-schema-guard.v1"
        ):
            raise FixtureInternal()
        return artifact

    def _runtime_guard(self, connection: Connection[tuple[object, ...]]) -> None:
        self.assert_render_target()
        role = connection.execute(
            """
            SELECT current_user, role.rolbypassrls
            FROM pg_catalog.pg_roles AS role
            WHERE role.rolname = current_user
            """
        ).fetchone()
        if role is None or role[0] != "postgres" or role[1] is not True:
            raise FixtureForbidden()
        owner_rows = connection.execute(
            """
            SELECT class.relname, pg_catalog.pg_get_userbyid(class.relowner)
            FROM pg_catalog.pg_class AS class
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
            WHERE namespace.nspname = 'public'
              AND class.relname = ANY(%s)
              AND class.relkind IN ('r', 'p')
            ORDER BY class.relname
            """,
            (list(_PUBLIC_MUTATION_TABLES),),
        ).fetchall()
        if tuple(str(row[0]) for row in owner_rows) != tuple(sorted(_PUBLIC_MUTATION_TABLES)):
            raise FixtureForbidden()
        if any(row[1] != "postgres" for row in owner_rows):
            raise FixtureForbidden()
        ledger = connection.execute(
            "SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if ledger is None or ledger[0] != "0021":
            raise FixtureConflict()
        receipt_owner = connection.execute(
            """
            SELECT pg_catalog.pg_get_userbyid(class.relowner)
            FROM pg_catalog.pg_class AS class
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
            WHERE namespace.nspname = 'private'
              AND class.relname = 'k2_hosted_fixture_receipts'
              AND class.relkind = 'r'
            """
        ).fetchone()
        if receipt_owner is None or receipt_owner[0] != "postgres":
            raise FixtureForbidden()

    def _lock_and_verify_manifest(self, connection: Connection[tuple[object, ...]]) -> None:
        connection.execute(
            "SELECT pg_catalog.set_config('statement_timeout', %s, true)",
            (f"{TRANSACTION_TIMEOUT_MS}ms",),
        )
        connection.execute("SELECT pg_catalog.set_config('lock_timeout', '5000ms', true)")
        connection.execute("SELECT pg_catalog.pg_advisory_xact_lock(%s)", (ADVISORY_LOCK_KEY,))
        tables = self._artifact.get("triggerTableScope")
        targets = self._artifact.get("foreignKeyTargetTables")
        mutation = self._artifact.get("mutationTables")
        if not all(isinstance(items, list) for items in (tables, targets, mutation)):
            raise FixtureInternal()
        tables = cast(list[Any], tables)
        targets = cast(list[Any], targets)
        mutation = cast(list[Any], mutation)
        if set(mutation) != set(_PUBLIC_MUTATION_TABLES):
            raise FixtureInternal()
        for name in sorted(tables):
            if not isinstance(name, str) or not _IDENTIFIER_RE.fullmatch(name):
                raise FixtureInternal()
            connection.execute(f'LOCK TABLE public."{name}" IN SHARE MODE')
        foreign_keys = self._live_foreign_keys(connection, targets)
        triggers = self._live_triggers(connection, tables)
        expected_fks = sorted(
            self._artifact.get("foreignKeys", []),
            key=lambda item: (
                item["referencing_schema"],
                item["referencing_table"],
                item["constraint_name"],
            ),
        )
        expected_triggers = sorted(
            self._artifact.get("triggers", []),
            key=lambda item: (item["schema_name"], item["table_name"], item["trigger_name"]),
        )
        if foreign_keys != expected_fks or triggers != expected_triggers:
            raise FixtureConflict()

    @staticmethod
    def _live_foreign_keys(
        connection: Connection[tuple[object, ...]], targets: list[Any]
    ) -> list[dict[str, Any]]:
        rows = connection.execute(
            """
            SELECT source_ns.nspname, source.relname, target.relname, constraint_row.conname,
                   constraint_row.confdeltype, constraint_row.condeferrable,
                   constraint_row.condeferred, constraint_row.convalidated,
                   pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
            FROM pg_catalog.pg_constraint AS constraint_row
            JOIN pg_catalog.pg_class AS source ON source.oid = constraint_row.conrelid
            JOIN pg_catalog.pg_namespace AS source_ns ON source_ns.oid = source.relnamespace
            JOIN pg_catalog.pg_class AS target ON target.oid = constraint_row.confrelid
            JOIN pg_catalog.pg_namespace AS target_ns ON target_ns.oid = target.relnamespace
            WHERE constraint_row.contype = 'f'
              AND target_ns.nspname = 'public'
              AND target.relname = ANY(%s)
            ORDER BY source_ns.nspname, source.relname, constraint_row.conname
            """,
            (targets,),
        ).fetchall()
        actions = {"a": "a", "r": "r", "c": "c", "n": "n", "d": "d"}
        return [
            {
                "referencing_schema": str(row[0]),
                "referencing_table": str(row[1]),
                "referenced_table": str(row[2]),
                "constraint_name": str(row[3]),
                "delete_action": actions[str(row[4])],
                "deferrable": bool(row[5]),
                "initially_deferred": bool(row[6]),
                "validated": bool(row[7]),
                "definition": str(row[8]),
            }
            for row in rows
        ]

    @staticmethod
    def _live_triggers(
        connection: Connection[tuple[object, ...]], tables: list[Any]
    ) -> list[dict[str, Any]]:
        rows = connection.execute(
            """
            SELECT namespace.nspname, relation.relname, trigger.tgname, trigger.tgenabled,
                   function_ns.nspname, function.proname,
                   pg_catalog.md5(pg_catalog.replace(
                       pg_catalog.pg_get_triggerdef(trigger.oid) || function.prosrc,
                       E'\\r\\n', E'\\n'
                   ))
            FROM pg_catalog.pg_trigger AS trigger
            JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger.tgrelid
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
            JOIN pg_catalog.pg_proc AS function ON function.oid = trigger.tgfoid
            JOIN pg_catalog.pg_namespace AS function_ns ON function_ns.oid = function.pronamespace
            WHERE NOT trigger.tgisinternal
              AND namespace.nspname = 'public'
              AND relation.relname = ANY(%s)
            ORDER BY namespace.nspname, relation.relname, trigger.tgname
            """,
            (tables,),
        ).fetchall()
        return [
            {
                "schema_name": str(row[0]),
                "table_name": str(row[1]),
                "trigger_name": str(row[2]),
                "enabled": str(row[3]),
                "function_schema": str(row[4]),
                "function_name": str(row[5]),
                "definition_digest": str(row[6]),
            }
            for row in rows
        ]

    @staticmethod
    def _approved_source(connection: Connection[tuple[object, ...]]) -> tuple[UUID, UUID]:
        rows = connection.execute(
            """
            SELECT source.id, license.id
            FROM public.data_sources AS source
            JOIN public.licenses AS license ON license.id = source.license_id
            WHERE source.name = %s AND source.source_version = %s
              AND source.source_type = %s AND source.attribution_text = %s
              AND license.code = %s AND license.name = %s
              AND license.usage_policy = %s
              AND license.attribution_required = %s
              AND EXISTS (
                  SELECT 1 FROM public.source_records AS record
                  WHERE record.source_id = source.id
                    AND record.review_status = 'approved'
                    AND record.quality_score IS NOT NULL
              )
            """,
            (
                SOURCE_NAME,
                SOURCE_VERSION,
                _EXPECTED_SOURCE_TYPE,
                SOURCE_ATTRIBUTION,
                LICENSE_CODE,
                LICENSE_NAME,
                _EXPECTED_LICENSE_POLICY,
                _EXPECTED_ATTRIBUTION_REQUIRED,
            ),
        ).fetchall()
        if len(rows) != 1:
            raise FixtureConflict()
        return UUID(str(rows[0][0])), UUID(str(rows[0][1]))

    @staticmethod
    def _lock_source_identity(
        connection: Connection[tuple[object, ...]], source_id: UUID, license_id: UUID
    ) -> None:
        source = connection.execute(
            "SELECT id FROM public.data_sources WHERE id = %s FOR KEY SHARE", (source_id,)
        ).fetchone()
        license_row = connection.execute(
            "SELECT id FROM public.licenses WHERE id = %s FOR KEY SHARE", (license_id,)
        ).fetchone()
        if source is None or license_row is None:
            raise FixtureConflict()

    def _receipt(
        self,
        connection: Connection[tuple[object, ...]],
        run_id: int,
        *,
        for_update: bool = False,
    ) -> tuple[Any, ...] | None:
        query = """
            SELECT repository_id, run_id, run_attempt, sha, protocol_version,
                   source_record_id, source_record_hash, state, created_at, closed_at
            FROM private.k2_hosted_fixture_receipts
            WHERE repository_id = %s AND run_id = %s
        """
        if for_update:
            query += " FOR UPDATE"
        row = connection.execute(query, (REPOSITORY_ID, run_id)).fetchone()
        return cast(tuple[Any, ...] | None, row)

    @staticmethod
    def _assert_receipt(
        receipt: tuple[Any, ...], claims: RunClaims, ids: FixtureIds, raw_hash: str
    ) -> None:
        if (
            int(receipt[0]) != claims.repository_id
            or int(receipt[1]) != claims.run_id
            or int(receipt[2]) != claims.run_attempt
            or str(receipt[3]) != claims.sha
            or str(receipt[4]) != PROTOCOL_VERSION
            or str(receipt[5]) != str(ids.source_record)
            or str(receipt[6]) != raw_hash
            or str(receipt[7]) not in {"ACTIVE", "CLOSED"}
            or receipt[8] is None
            or (str(receipt[7]) == "ACTIVE") != (receipt[9] is None)
        ):
            raise FixtureConflict()

    def _assert_no_collisions(
        self,
        connection: Connection[tuple[object, ...]],
        ids: FixtureIds,
        source_id: UUID,
        raw_hash: str,
    ) -> None:
        collisions = connection.execute(
            """
            SELECT
              EXISTS (SELECT 1 FROM public.source_records WHERE id = %s
                       OR (source_id = %s AND source_record_key = %s)) AS source_record,
              EXISTS (SELECT 1 FROM public.concepts WHERE id = ANY(%s)
                       OR canonical_key = ANY(%s)) AS concepts,
              EXISTS (SELECT 1 FROM public.lexemes WHERE id = %s
                       OR normalized_form = ANY(%s) OR lemma = ANY(%s)) AS lexemes,
              EXISTS (SELECT 1 FROM public.lexeme_forms WHERE id = %s
                       OR normalized_form = ANY(%s) OR form = ANY(%s)) AS forms,
              EXISTS (SELECT 1 FROM public.word_senses WHERE id = ANY(%s)) AS senses,
              EXISTS (SELECT 1 FROM public.concept_senses
                       WHERE concept_id = ANY(%s) OR word_sense_id = ANY(%s)) AS bridges
            """,
            (
                ids.source_record,
                source_id,
                ids.source_record_key,
                [ids.owner_concept, ids.secondary_concept],
                [ids.owner_canonical_key, ids.secondary_canonical_key],
                ids.lexeme,
                [ids.lemma, ids.inflected_form],
                [ids.lemma, ids.inflected_form],
                ids.form,
                [ids.lemma, ids.inflected_form],
                [ids.lemma, ids.inflected_form],
                [ids.sense_one, ids.sense_two],
                [ids.owner_concept, ids.secondary_concept],
                [ids.sense_one, ids.sense_two],
            ),
        ).fetchone()
        if collisions is None or any(bool(value) for value in collisions):
            raise FixtureConflict()
        if connection.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM public.source_records
                WHERE source_id=%s AND source_record_key=%s AND raw_hash=%s
            )
            """,
            (source_id, ids.source_record_key, raw_hash),
        ).fetchone() != (False,):
            raise FixtureConflict()

    @staticmethod
    def _fixture_counts(
        connection: Connection[tuple[object, ...]], ids: FixtureIds
    ) -> dict[str, int]:
        owner_ids = [ids.owner_concept, ids.secondary_concept]
        sense_ids = [ids.sense_one, ids.sense_two]
        source_count = _count(
            connection,
            "SELECT count(*) FROM public.source_records WHERE id=%s OR source_record_key=%s",
            (ids.source_record, ids.source_record_key),
        )
        concept_count = _count(
            connection,
            "SELECT count(*) FROM public.concepts WHERE id = ANY(%s) OR canonical_key = ANY(%s)",
            (owner_ids, [ids.owner_canonical_key, ids.secondary_canonical_key]),
        )
        lexeme_count = _count(
            connection,
            "SELECT count(*) FROM public.lexemes WHERE id=%s",
            (ids.lexeme,),
        )
        form_count = _count(
            connection,
            "SELECT count(*) FROM public.lexeme_forms WHERE id=%s",
            (ids.form,),
        )
        sense_count = _count(
            connection,
            "SELECT count(*) FROM public.word_senses WHERE id = ANY(%s)",
            (sense_ids,),
        )
        bridge_count = _count(
            connection,
            """
            SELECT count(*) FROM public.concept_senses
            WHERE concept_id = ANY(%s) OR word_sense_id = ANY(%s)
            """,
            (owner_ids, sense_ids),
        )
        return {
            "sourceRecords": source_count,
            "concepts": concept_count,
            "lexemes": lexeme_count,
            "forms": form_count,
            "senses": sense_count,
            "bridges": bridge_count,
        }

    def _insert_fixture(
        self,
        connection: Connection[tuple[object, ...]],
        ids: FixtureIds,
        *,
        source_id: UUID,
        raw_hash: str,
    ) -> None:
        payload = fixture_payload(ids, source_id=source_id)
        connection.execute(
            """
            INSERT INTO public.source_records
                (id, source_id, source_record_key, raw_hash, transform_version,
                 quality_score, review_status, imported_at, reviewed_at, metadata)
            VALUES (%s, %s, %s, %s, %s, 1.0, 'approved', clock_timestamp(),
                    clock_timestamp(), %s::jsonb)
            """,
            (
                ids.source_record,
                source_id,
                ids.source_record_key,
                raw_hash,
                PROTOCOL_VERSION,
                json.dumps({"fixtureProtocol": PROTOCOL_VERSION}, separators=(",", ":")),
            ),
        )
        for item in payload["concepts"]:
            connection.execute(
                """
                INSERT INTO public.concepts
                    (id, language_code, concept_type, canonical_key, source_record_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    UUID(item["id"]),
                    item["language_code"],
                    item["concept_type"],
                    item["canonical_key"],
                    ids.source_record,
                ),
            )
        for item in payload["lexemes"]:
            connection.execute(
                """
                INSERT INTO public.lexemes
                    (id, concept_id, language_code, lemma, normalized_form,
                     part_of_speech, source_record_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    ids.lexeme,
                    ids.owner_concept,
                    item["language_code"],
                    item["lemma"],
                    item["normalized_form"],
                    item["part_of_speech"],
                    ids.source_record,
                ),
            )
        for item in payload["lexeme_forms"]:
            connection.execute(
                """
                INSERT INTO public.lexeme_forms
                    (id, lexeme_id, form, normalized_form, form_type, source_record_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    ids.form,
                    ids.lexeme,
                    item["form"],
                    item["normalized_form"],
                    item["form_type"],
                    ids.source_record,
                ),
            )
        for item in payload["word_senses"]:
            connection.execute(
                """
                INSERT INTO public.word_senses
                    (id, lexeme_id, sense_order, definition, definition_language_code,
                     translated_definition, translation_language_code, source_record_id)
                VALUES (%s, %s, %s, %s, %s, NULL, NULL, %s)
                """,
                (
                    UUID(item["id"]),
                    ids.lexeme,
                    item["sense_order"],
                    item["definition"],
                    item["definition_language_code"],
                    ids.source_record,
                ),
            )
        for item in payload["concept_senses"]:
            connection.execute(
                """
                INSERT INTO public.concept_senses (concept_id, word_sense_id, is_primary)
                VALUES (%s, %s, %s)
                """,
                (
                    UUID(item["concept_id"]),
                    UUID(item["word_sense_id"]),
                    item["is_primary"],
                ),
            )

    def _assert_fixture_tree(
        self,
        connection: Connection[tuple[object, ...]],
        ids: FixtureIds,
        source_id: UUID,
        raw_hash: str,
    ) -> None:
        payload = fixture_payload(ids, source_id=source_id)
        source = connection.execute(
            """
            SELECT id::text, source_id::text, source_record_key, raw_hash, transform_version,
                   quality_score::text, review_status, metadata
            FROM public.source_records WHERE id = %s
            """,
            (ids.source_record,),
        ).fetchall()
        expected_source = payload["source_records"][0]
        if len(source) != 1 or tuple(source[0]) != (
            expected_source["id"],
            expected_source["source_id"],
            expected_source["source_record_key"],
            raw_hash,
            expected_source["transform_version"],
            "1.0000",
            expected_source["review_status"],
            expected_source["metadata"],
        ):
            raise FixtureConflict()
        queries: tuple[tuple[str, tuple[Any, ...], list[dict[str, Any]], tuple[str, ...]], ...] = (
            (
                """
                SELECT id::text, language_code, concept_type, canonical_key,
                       source_record_id::text
                FROM public.concepts WHERE id = ANY(%s) ORDER BY id
                """,
                ([ids.owner_concept, ids.secondary_concept],),
                payload["concepts"],
                ("id", "language_code", "concept_type", "canonical_key", "source_record_id"),
            ),
            (
                """
                SELECT id::text, concept_id::text, language_code, lemma, normalized_form,
                       part_of_speech, source_record_id::text
                FROM public.lexemes WHERE id = %s ORDER BY id
                """,
                (ids.lexeme,),
                payload["lexemes"],
                (
                    "id",
                    "concept_id",
                    "language_code",
                    "lemma",
                    "normalized_form",
                    "part_of_speech",
                    "source_record_id",
                ),
            ),
            (
                """
                SELECT id::text, lexeme_id::text, form, normalized_form, form_type,
                       source_record_id::text
                FROM public.lexeme_forms WHERE id = %s ORDER BY id
                """,
                (ids.form,),
                payload["lexeme_forms"],
                ("id", "lexeme_id", "form", "normalized_form", "form_type", "source_record_id"),
            ),
            (
                """
                SELECT id::text, lexeme_id::text, sense_order, definition,
                       definition_language_code, translated_definition,
                       translation_language_code, source_record_id::text
                FROM public.word_senses WHERE id = ANY(%s) ORDER BY sense_order
                """,
                ([ids.sense_one, ids.sense_two],),
                payload["word_senses"],
                (
                    "id",
                    "lexeme_id",
                    "sense_order",
                    "definition",
                    "definition_language_code",
                    "translated_definition",
                    "translation_language_code",
                    "source_record_id",
                ),
            ),
            (
                """
                SELECT concept_id::text, word_sense_id::text, is_primary
                FROM public.concept_senses
                WHERE concept_id = ANY(%s) OR word_sense_id = ANY(%s)
                ORDER BY concept_id, word_sense_id
                """,
                ([ids.owner_concept, ids.secondary_concept], [ids.sense_one, ids.sense_two]),
                payload["concept_senses"],
                ("concept_id", "word_sense_id", "is_primary"),
            ),
        )
        for sql, parameters, expected_rows, columns in queries:
            rows = connection.execute(sql, parameters).fetchall()
            expected = sorted(
                [tuple(item[column] for column in columns) for item in expected_rows],
                key=lambda item: tuple(str(value) for value in item),
            )
            actual = sorted(
                [tuple(row) for row in rows],
                key=lambda item: tuple(str(value) for value in item),
            )
            if actual != expected:
                raise FixtureConflict()
        if self._fixture_counts(connection, ids) != success_counts(present=True):
            raise FixtureConflict()

    def _assert_fixture_absent(
        self,
        connection: Connection[tuple[object, ...]],
        ids: FixtureIds,
        source_id: UUID,
        raw_hash: str,
    ) -> None:
        del source_id, raw_hash
        if self._fixture_counts(connection, ids) != success_counts(present=False):
            raise FixtureConflict()

    @staticmethod
    def _lock_fixture_parents(
        connection: Connection[tuple[object, ...]], ids: FixtureIds, source_id: UUID
    ) -> None:
        locked = connection.execute(
            "SELECT id FROM public.data_sources WHERE id = %s FOR UPDATE", (source_id,)
        ).fetchone()
        if locked is None:
            raise FixtureConflict()
        source_record = connection.execute(
            "SELECT id FROM public.source_records WHERE id = %s FOR UPDATE",
            (ids.source_record,),
        ).fetchone()
        if source_record is None:
            raise FixtureConflict()
        for table, values in (
            ("concepts", [ids.owner_concept, ids.secondary_concept]),
            ("lexemes", [ids.lexeme]),
            ("word_senses", [ids.sense_one, ids.sense_two]),
            ("lexeme_forms", [ids.form]),
        ):
            if not _IDENTIFIER_RE.fullmatch(table):
                raise FixtureInternal()
            connection.execute(
                f'SELECT id FROM public."{table}" WHERE id = ANY(%s) ORDER BY id FOR UPDATE',
                (values,),
            ).fetchall()

    @staticmethod
    def _assert_no_external_cascade_rows(
        connection: Connection[tuple[object, ...]], ids: FixtureIds
    ) -> None:
        concept_ids = [ids.owner_concept, ids.secondary_concept]
        queries = (
            ("concept_competence_policies", "concept_id = ANY(%s)", concept_ids),
            (
                "concept_edges",
                "source_concept_id = ANY(%s) OR target_concept_id = ANY(%s)",
                (concept_ids, concept_ids),
            ),
            ("grammar_specifications", "concept_id = ANY(%s)", concept_ids),
            (
                "phrase_specifications",
                "concept_id = ANY(%s) OR headword_concept_id = ANY(%s)",
                (concept_ids, concept_ids),
            ),
            ("phonetic_transcriptions", "lexeme_id = %s", (ids.lexeme,)),
        )
        for table, predicate, parameters in queries:
            if not _IDENTIFIER_RE.fullmatch(table):
                raise FixtureInternal()
            query_parameters = parameters if isinstance(parameters, tuple) else (parameters,)
            row = connection.execute(
                f'SELECT EXISTS (SELECT 1 FROM public."{table}" WHERE {predicate})',
                query_parameters,
            ).fetchone()
            if row != (False,):
                raise FixtureConflict()

    @staticmethod
    def _delete_fixture(connection: Connection[tuple[object, ...]], ids: FixtureIds) -> None:
        expected = (
            (
                "concept_senses",
                """
                DELETE FROM public.concept_senses
                WHERE concept_id = ANY(%s) OR word_sense_id = ANY(%s)
                """,
                ([ids.owner_concept, ids.secondary_concept], [ids.sense_one, ids.sense_two]),
                3,
            ),
            ("lexeme_forms", "DELETE FROM public.lexeme_forms WHERE id = %s", (ids.form,), 1),
            (
                "word_senses",
                "DELETE FROM public.word_senses WHERE id = ANY(%s)",
                ([ids.sense_one, ids.sense_two],),
                2,
            ),
            ("lexemes", "DELETE FROM public.lexemes WHERE id = %s", (ids.lexeme,), 1),
            (
                "concepts",
                "DELETE FROM public.concepts WHERE id = ANY(%s)",
                ([ids.owner_concept, ids.secondary_concept],),
                2,
            ),
            (
                "source_records",
                "DELETE FROM public.source_records WHERE id = %s",
                (ids.source_record,),
                1,
            ),
        )
        if {item[0] for item in expected} != set(_PUBLIC_MUTATION_TABLES):
            raise FixtureInternal()
        for _table, sql, parameters, expected_count in expected:
            result = connection.execute(sql, parameters)
            if result.rowcount != expected_count:
                raise FixtureConflict()

    @staticmethod
    def _inspection_dto(
        state: str, ids: FixtureIds | None, counts: dict[str, int]
    ) -> dict[str, Any]:
        present = state == "ACTIVE"
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "receiptState": state,
            "fixturePresent": present,
            "fixture": None if not present or ids is None else _fixture_dto(ids),
            "counts": counts,
        }

    @staticmethod
    def _setup_dto(ids: FixtureIds, disposition: str) -> dict[str, Any]:
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "receiptState": "ACTIVE",
            "disposition": disposition,
            "fixturePresent": True,
            "fixture": _fixture_dto(ids),
            "counts": success_counts(present=True),
        }

    @staticmethod
    def _cleanup_dto(counts: dict[str, int]) -> dict[str, Any]:
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "receiptState": "CLOSED",
            "fixturePresent": False,
            "counts": counts,
        }

    @staticmethod
    def _receipt_tuple(row: tuple[Any, ...]) -> tuple[Any, ...]:
        return (
            int(row[0]),
            int(row[1]),
            int(row[2]),
            str(row[3]),
            str(row[4]),
            str(row[5]),
            str(row[6]),
            str(row[7]),
            row[8],
            row[9],
        )

    @staticmethod
    def _candidate_tuple(candidate: dict[str, Any]) -> tuple[Any, ...]:
        return (
            int(candidate["repository_id"]),
            int(candidate["run_id"]),
            int(candidate["run_attempt"]),
            str(candidate["sha"]),
            str(candidate["protocol_version"]),
            str(candidate["source_record_id"]),
            str(candidate["source_record_hash"]),
            str(candidate["state"]),
            candidate["created_at"],
            candidate["closed_at"],
        )

    @staticmethod
    def _is_expired(receipt: tuple[Any, ...], *, terminal: bool = False) -> bool:
        moment = receipt[9] if terminal else receipt[8]
        if not isinstance(moment, datetime):
            return False
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=UTC)
        elapsed = datetime.now(UTC) - moment.astimezone(UTC)
        minimum = (
            timedelta(seconds=TERMINAL_RETENTION_SECONDS)
            if terminal
            else timedelta(seconds=ACTIVE_TTL_SECONDS)
        )
        return elapsed >= minimum


def _fixture_dto(ids: FixtureIds) -> dict[str, Any]:
    from lingua_api.hosted_fixture.protocol import fixture_dto

    return fixture_dto(ids)


def _as_int(value: object) -> int:
    if type(value) is not int:
        raise FixtureUnavailable()
    return value


def _count(
    connection: Connection[tuple[object, ...]],
    sql: str,
    parameters: tuple[Any, ...],
) -> int:
    row = connection.execute(sql, parameters).fetchone()
    if row is None:
        raise FixtureUnavailable()
    return _as_int(row[0])
