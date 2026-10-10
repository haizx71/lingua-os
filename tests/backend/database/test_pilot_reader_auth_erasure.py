"""Reproduce the pre-0022 blocker and prove the versioned Auth-erasure guard.

This module always creates loopback PostgreSQL and overrides the shared
database fixture, so it cannot use TEST_DATABASE_URL or a hosted target.
"""

from __future__ import annotations

import socket
import subprocess
import sys
import time
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import Event
from time import monotonic, sleep

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from psycopg.conninfo import make_conninfo

from database.migrate import MigrationChecksumError, discover_migrations, migrate_down, migrate_up
from tests.acceptance.support import k2_hosted_probe as probe
from tests.backend.database.conftest import _run_docker
from tests.backend.database.test_admin_content_api import (
    READER_SEED,
    AdminApi,
    _headers,
)
from tests.backend.database.test_pilot_reader_catalog_probe import (
    _actor_reader_target,
    _candidate_files,
    _create_candidate,
    _ensure_sentence_annotations,
    _put_translations,
    _validate_and_publish,
)

AUTH_BOOTSTRAP = Path(__file__).with_name("supabase_test_bootstrap.sql")
POSTGRES_IMAGE = "postgres:17.11-alpine3.24"
ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / "database" / "migrations"


def _safe_start_local_container(*args: str) -> subprocess.CompletedProcess[str] | None:
    try:
        return _run_docker(*args)
    except Exception:
        return None


def test_local_container_start_failure_does_not_return_docker_arguments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sentinel = "local-password-sentinel"

    def fail_with_argv(*args: str) -> None:
        raise subprocess.CalledProcessError(1, ["docker", *args, sentinel])

    monkeypatch.setattr(sys.modules[__name__], "_run_docker", fail_with_argv)
    result = _safe_start_local_container("run", "--env", f"POSTGRES_PASSWORD={sentinel}")
    assert result is None
    assert sentinel not in repr(result)


@dataclass(frozen=True)
class ErasureTokenVerifier:
    owner: AuthenticatedActor
    learner: AuthenticatedActor
    control: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token == "owner-token":
            return self.owner
        if token == "survivor-token":
            return self.learner
        if token == "learner-token":
            return self.learner
        if token == "control-token":
            return self.control
        raise AssertionError("unexpected local Reader erasure test token")


def _free_loopback_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_local_postgres(database_url: str) -> None:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            with psycopg.connect(database_url, connect_timeout=2) as connection:
                connection.execute("SELECT 1")
            return
        except psycopg.Error:
            time.sleep(0.5)
    raise RuntimeError("Local Reader erasure PostgreSQL did not become ready") from None


def _function_definition(database_url: str) -> str:
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            "SELECT pg_catalog.pg_get_functiondef("
            "'public.enforce_reader_history_append_only()'::regprocedure)"
        ).fetchone()
    if row is None or not isinstance(row[0], str):
        pytest.fail("Reader history trigger function was unavailable in local PostgreSQL.")
    return row[0]


def _reader_guard_boundary_snapshot(database_url: str) -> tuple[object, ...]:
    with psycopg.connect(database_url) as connection:
        function = connection.execute(
            """SELECT procedure.proowner::regrole::text, procedure.proacl,
                      procedure.prosecdef
               FROM pg_catalog.pg_proc AS procedure
               WHERE procedure.oid =
                   'public.enforce_reader_history_append_only()'::regprocedure"""
        ).fetchone()
        triggers = connection.execute(
            """SELECT relation.relname::text, trigger.tgname::text,
                      pg_catalog.pg_get_triggerdef(trigger.oid),
                      trigger.tgfoid::regprocedure::text, trigger.tgtype,
                      trigger.tgisinternal
               FROM pg_catalog.pg_trigger AS trigger
               JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger.tgrelid
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
               WHERE namespace.nspname = 'public'
                 AND relation.relname IN (
                     'exposure_events', 'reader_exposure_concepts',
                     'reader_mutation_results'
                 )
                 AND trigger.tgname <> 'aaa_reader_auth_erasure_probe'
               ORDER BY relation.relname, trigger.tgname, trigger.oid"""
        ).fetchall()
    if function is None or function[2] is not False:
        pytest.fail("Reader history guard did not retain its invoker-security boundary.")
    if len(triggers) < 3:
        pytest.fail("Reader history trigger bindings were incomplete in local PostgreSQL.")
    return (*function[:2], tuple(triggers))


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """Always provide loopback disposable PostgreSQL, ignoring hosted env vars."""
    port = _free_loopback_port()
    container_name = f"lingua-reader-erasure-{uuid.uuid4().hex[:12]}"
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
        pytest.fail("Local Reader erasure PostgreSQL container could not start.", pytrace=False)
    container_id = result.stdout.strip()
    database_url = f"postgresql://postgres:{password}@127.0.0.1:{port}/lingua_test"
    try:
        _wait_local_postgres(database_url)
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
                pytest.fail(
                    "Local Reader erasure PostgreSQL container cleanup failed.", pytrace=False
                )


@pytest.fixture
def erasure_api(
    isolated_postgres_at_migration: tuple[str, Path],
) -> tuple[AdminApi, AuthenticatedActor, AuthenticatedActor, AuthenticatedActor]:
    database_url, _ = isolated_postgres_at_migration
    owner = AuthenticatedActor(uuid.uuid4())
    survivor = AuthenticatedActor(uuid.uuid4())
    control = AuthenticatedActor(uuid.uuid4())
    racer = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(database_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        for actor in (owner, survivor, control, racer):
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
            connection.execute("INSERT INTO users (id) VALUES (%s)", (actor.id,))
            connection.execute(
                "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
                (actor.id,),
            )
            connection.execute(
                """INSERT INTO user_languages
                     (user_id, language_code, interface_language_code, native_language_code,
                      goal, current_level_id, daily_minutes)
                   VALUES (%s, 'en', 'vi', 'vi', 'communication',
                           '00000000-0000-4000-8100-000000000001', 20)""",
                (actor.id,),
            )
        connection.commit()

    app = create_app(
        database_url=database_url,
        token_verifier=ErasureTokenVerifier(owner, survivor, control),
        cursor_secret=b"pilot-reader-auth-erasure-local-db-cursor-secret",
        admin_user_ids=str(owner.id),
    )
    api = AdminApi(TestClient(app), database_url, owner)
    return api, survivor, control, racer


def _actor_snapshot(database_url: str, actor_id: uuid.UUID) -> dict[str, object]:
    with psycopg.connect(database_url) as connection:
        return probe._snapshot(connection, actor_id)


def _zero_actor_rows(database_url: str, actor_id: uuid.UUID) -> bool:
    snapshot = _actor_snapshot(database_url, actor_id)
    tables = snapshot.get("tables")
    if (
        snapshot.get("totalRows") != 0
        or not isinstance(tables, dict)
        or set(tables) != set(probe.EXPECTED_LEARNER_TABLES)
    ):
        return False
    return all(isinstance(table, dict) and table.get("rows") == 0 for table in tables.values())


def _delete_as_supabase_auth_owner(database_url: str, actor_id: uuid.UUID) -> None:
    """Model the trusted local Auth-owner hard delete that fires FK cascades."""
    with psycopg.connect(database_url) as connection:
        connection.execute("SET LOCAL ROLE supabase_auth_admin")
        connection.execute("DELETE FROM auth.users WHERE id = %s", (actor_id,))


def _install_delete_context_probes(connection: psycopg.Connection[tuple[object, ...]]) -> None:
    connection.execute(
        """CREATE TABLE public.reader_auth_erasure_delete_probe (
               user_id uuid NOT NULL,
               table_name text NOT NULL,
               trigger_depth integer NOT NULL,
               auth_identity_present boolean NOT NULL
           )"""
    )
    connection.execute(
        """CREATE FUNCTION public.capture_reader_auth_erasure_delete_context()
           RETURNS trigger
           LANGUAGE plpgsql
           SECURITY DEFINER
           SET search_path = pg_catalog
           AS $function$
           BEGIN
               INSERT INTO public.reader_auth_erasure_delete_probe
                   (user_id, table_name, trigger_depth, auth_identity_present)
               VALUES (
                   OLD.user_id,
                   TG_TABLE_NAME,
                   pg_catalog.pg_trigger_depth(),
                   EXISTS (
                       SELECT 1 FROM auth.users AS auth_user
                       WHERE auth_user.id = OLD.user_id
                   )
               );
               RETURN OLD;
           END
           $function$"""
    )
    for table_name in (
        "exposure_events",
        "reader_exposure_concepts",
        "reader_mutation_results",
    ):
        connection.execute(
            f"""CREATE TRIGGER aaa_reader_auth_erasure_probe
                BEFORE DELETE ON public.{table_name}
                FOR EACH ROW
                EXECUTE FUNCTION public.capture_reader_auth_erasure_delete_context()"""
        )


def _assert_guard_rejects(
    connection: psycopg.Connection[tuple[object, ...]], statement: str, actor_id: uuid.UUID
) -> None:
    with pytest.raises(
        psycopg.errors.CheckViolation,
        match="Reader source facts and replay snapshots are append-only",
    ) as error:
        connection.execute(statement, (actor_id,))
    if error.value.sqlstate != "23514":
        pytest.fail("Reader direct mutation did not fail with the guard SQLSTATE.")


def _assert_reader_guard_direct_mutations_rejected(database_url: str, actor_id: uuid.UUID) -> None:
    statements = (
        "UPDATE exposure_events SET result_snapshot = result_snapshot "
        "WHERE user_id = %s AND request_fingerprint IS NOT NULL",
        "DELETE FROM exposure_events WHERE user_id = %s AND request_fingerprint IS NOT NULL",
        "UPDATE reader_exposure_concepts SET derivation_key = derivation_key WHERE user_id = %s",
        "DELETE FROM reader_exposure_concepts WHERE user_id = %s",
        "UPDATE reader_mutation_results SET completed_at = completed_at "
        "WHERE user_id = %s AND operation_type = 'progress'",
        "DELETE FROM reader_mutation_results WHERE user_id = %s AND operation_type = 'progress'",
    )
    for statement in statements:
        with psycopg.connect(database_url) as connection:
            _assert_guard_rejects(connection, statement, actor_id)


@contextmanager
def _reader_erasure_migration(database_url: str) -> Iterator[tuple[str, str]]:
    """Apply actual 0022 and restore the exact 0021 trigger function on exit."""
    original_definition = _function_definition(database_url)
    migration_matches = [item for item in discover_migrations(MIGRATIONS) if item.version == "0022"]
    if len(migration_matches) != 1 or migration_matches[0].name != "reader_history_auth_erasure":
        pytest.fail("The pinned Reader Auth-erasure migration pair was not uniquely discoverable.")
    migration = migration_matches[0]
    if migrate_up(database_url, MIGRATIONS) != ["0022"]:
        pytest.fail("The exact-0021 disposable database did not apply only migration 0022.")
    with psycopg.connect(database_url) as connection:
        recorded = connection.execute(
            "SELECT name, checksum FROM public.schema_migrations WHERE version = '0022'"
        ).fetchone()
    if recorded != (migration.name, migration.checksum):
        pytest.fail("Migration 0022 ledger did not record its exact discovered checksum.")
    if migrate_up(database_url, MIGRATIONS) != []:
        pytest.fail("Migration 0022 was not a no-op on its exact applied checksum.")
    try:
        yield original_definition, migration.checksum
    finally:
        with psycopg.connect(database_url) as connection:
            head = connection.execute(
                "SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1"
            ).fetchone()
        if head == ("0022",):
            if migrate_down(database_url, MIGRATIONS, steps=1) != ["0022"]:
                pytest.fail(
                    "Migration 0022 could not roll back from the local disposable database."
                )
        elif head != ("0021",):
            pytest.fail("Reader erasure test left an unexpected migration head.")
        if _function_definition(database_url) != original_definition:
            pytest.fail("Migration 0022 down did not restore the exact 0021 function definition.")


def _assert_concurrent_insert_waits_for_auth_erasure(
    database_url: str, actor_id: uuid.UUID
) -> None:
    application_name = f"reader-erasure-race-{uuid.uuid4().hex}"
    contender_url = make_conninfo(database_url, application_name=application_name)
    deletion = psycopg.connect(database_url)
    try:
        deletion.execute("SET LOCAL ROLE supabase_auth_admin")
        deletion.execute("DELETE FROM auth.users WHERE id = %s", (actor_id,))
        started = Event()

        def insert_reader_result() -> None:
            with psycopg.connect(contender_url) as contender:
                started.set()
                contender.execute(
                    """INSERT INTO public.reader_mutation_results
                         (user_id, idempotency_key, operation_type, request_fingerprint,
                          resource_id, result_snapshot, completed_at)
                       VALUES (%s, %s, 'progress', %s, %s, '{}'::jsonb, now())""",
                    (actor_id, uuid.uuid4(), "e" * 64, uuid.uuid4()),
                )

        with ThreadPoolExecutor(max_workers=1) as executor:
            pending_insert = executor.submit(insert_reader_result)
            try:
                assert started.wait(timeout=5)
                deadline = monotonic() + 5
                blocked = False
                while monotonic() < deadline:
                    with psycopg.connect(database_url) as observer:
                        wait_type = observer.execute(
                            """SELECT wait_event_type FROM pg_catalog.pg_stat_activity
                               WHERE application_name = %s""",
                            (application_name,),
                        ).fetchone()
                    if wait_type is not None and wait_type[0] == "Lock":
                        blocked = True
                        break
                    sleep(0.02)
                assert blocked, "concurrent Reader result insert did not wait on Auth erasure"
            finally:
                deletion.commit()
            with pytest.raises(psycopg.errors.ForeignKeyViolation) as error:
                pending_insert.result(timeout=10)
            assert error.value.sqlstate == "23503"
    finally:
        deletion.close()


@pytest.mark.parametrize("isolated_postgres_at_migration", ["0021"], indirect=True)
def test_reader_auth_erasure_is_narrowly_allowed_only_for_trusted_cascade(
    erasure_api: tuple[AdminApi, AuthenticatedActor, AuthenticatedActor, AuthenticatedActor],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reproduce the 0021 blocker and exercise the real 0022 migration locally."""
    api, survivor, control, racer = erasure_api
    owner_id = api.owner.id
    monkeypatch.setattr(
        probe,
        "_table_inventory",
        lambda _connection: tuple(sorted(probe.EXPECTED_LEARNER_TABLES)),
    )

    manifest, candidate = _candidate_files()
    _ensure_sentence_annotations(api.database_url, candidate["body"])
    content_id = _create_candidate(api, manifest, candidate)
    _put_translations(api, content_id, manifest, candidate)
    _validate_and_publish(api, content_id)

    survivor_profile_id, survivor_segment_id, _, survivor_lookup = _actor_reader_target(
        api.database_url, survivor.id, content_id
    )
    survivor_save = api.client.put(
        f"/v1/library/concepts/{survivor_lookup[2]}",
        params={"languageProfileId": str(survivor_profile_id)},
        headers=_headers("survivor-token"),
    )
    if survivor_save.status_code != 200:
        pytest.fail("Local retained Actor B concept Save did not use the normal Library endpoint.")
    survivor_read = api.client.post(
        "/v1/reader/exposures",
        headers={**_headers("survivor-token"), "Idempotency-Key": str(uuid.uuid4())},
        json={
            "languageProfileId": str(survivor_profile_id),
            "contentId": content_id,
            "segmentId": str(survivor_segment_id),
            "exposureType": "read",
        },
    )
    if survivor_read.status_code != 200:
        pytest.fail("Local retained Actor B Reader completion exposure failed.")
    survivor_progress = api.client.put(
        f"/v1/reader/progress/{content_id}",
        json={
            "languageProfileId": str(survivor_profile_id),
            "currentSegmentId": str(survivor_segment_id),
            "isCompleted": True,
        },
        headers={**_headers("survivor-token"), "Idempotency-Key": str(uuid.uuid4())},
    )
    if survivor_progress.status_code != 200:
        pytest.fail("Local retained Actor B Reader completion progress failed.")
    survivor_before = _actor_snapshot(api.database_url, survivor.id)

    # A saved-concept-only control exercises the accepted 0019 exception under
    # the current migration set. Actor B remains separate and is never deleted.
    control_profile_id, _, _, control_lookup = _actor_reader_target(
        api.database_url, control.id, content_id
    )
    saved = api.client.put(
        f"/v1/library/concepts/{control_lookup[2]}",
        params={"languageProfileId": str(control_profile_id)},
        headers=_headers("control-token"),
    )
    if saved.status_code != 200:
        pytest.fail("Local concept Save control did not use the normal Library endpoint.")
    _delete_as_supabase_auth_owner(api.database_url, control.id)
    if not _zero_actor_rows(api.database_url, control.id):
        pytest.fail("Local Save-only Auth cascade did not erase all 27 actor tables.")
    with psycopg.connect(api.database_url) as connection:
        if (
            connection.execute("SELECT 1 FROM auth.users WHERE id = %s", (control.id,)).fetchone()
            is not None
        ):
            pytest.fail("Local Save-only Auth identity remained after trusted deletion.")

    profile_id, segment_id, eligible_concepts, lookup = _actor_reader_target(
        api.database_url, owner_id, content_id
    )
    saved = api.client.put(
        f"/v1/library/concepts/{lookup[2]}",
        params={"languageProfileId": str(profile_id)},
        headers=_headers(),
    )
    if saved.status_code != 200:
        pytest.fail("Local Reader actor concept Save did not use the normal Library endpoint.")

    read_response = api.client.post(
        "/v1/reader/exposures",
        headers={**_headers(), "Idempotency-Key": str(uuid.uuid4())},
        json={
            "languageProfileId": str(profile_id),
            "contentId": content_id,
            "segmentId": str(segment_id),
            "exposureType": "read",
        },
    )
    if read_response.status_code != 200 or read_response.json()["data"][
        "acceptedConceptCount"
    ] != len(eligible_concepts):
        pytest.fail("Normal local Reader completion exposure did not accept its final segment.")

    progress = api.client.put(
        f"/v1/reader/progress/{content_id}",
        json={
            "languageProfileId": str(profile_id),
            "currentSegmentId": str(segment_id),
            "isCompleted": True,
        },
        headers={**_headers(), "Idempotency-Key": str(uuid.uuid4())},
    )
    if progress.status_code != 200 or progress.json()["data"]["isCompleted"] is not True:
        pytest.fail("Normal local Reader final-segment progress did not complete.")

    with psycopg.connect(api.database_url) as connection:
        effects = connection.execute(
            """SELECT
                 (SELECT count(*) FROM exposure_events
                   WHERE user_id = %s AND request_fingerprint IS NOT NULL),
                 (SELECT count(*) FROM reader_exposure_concepts WHERE user_id = %s),
                 (SELECT count(*) FROM reader_mutation_results
                   WHERE user_id = %s AND operation_type = 'progress'),
                 (SELECT count(*) FROM user_content_progress
                   WHERE user_id = %s AND completed_at IS NOT NULL)""",
            (owner_id, owner_id, owner_id, owner_id),
        ).fetchone()
    if not effects or any(value < 1 for value in effects):
        pytest.fail("Local normal Reader completion history was incomplete for erasure test.")

    # The accepted current guard rejects direct mutation for every affected row
    # and blocks Auth cascade deletion, rolling the whole deletion back.
    _assert_reader_guard_direct_mutations_rejected(api.database_url, owner_id)
    owner_before_failed_delete = _actor_snapshot(api.database_url, owner_id)
    with psycopg.connect(api.database_url) as connection:
        with pytest.raises(
            psycopg.errors.CheckViolation,
            match="Reader source facts and replay snapshots are append-only",
        ) as error:
            connection.execute("SET LOCAL ROLE supabase_auth_admin")
            connection.execute("DELETE FROM auth.users WHERE id = %s", (owner_id,))
        if error.value.sqlstate != "23514":
            pytest.fail("Current Auth cascade blocker did not fail with SQLSTATE 23514.")
        connection.rollback()
    with psycopg.connect(api.database_url) as connection:
        if (
            connection.execute("SELECT 1 FROM auth.users WHERE id = %s", (owner_id,)).fetchone()
            is None
        ):
            pytest.fail("Failed current Auth cascade did not roll back identity deletion.")
        if connection.execute(
            """SELECT count(*) FROM reader_mutation_results
               WHERE user_id = %s AND operation_type = 'progress'""",
            (owner_id,),
        ).fetchone() != (1,):
            pytest.fail("Failed current Auth cascade left an unexpected mutation-result count.")
    if _actor_snapshot(api.database_url, owner_id) != owner_before_failed_delete:
        pytest.fail("Failed current Auth cascade changed the actor's complete 27-table snapshot.")

    # Apply the real paired migration to this exact-0021 disposable database.
    boundary_before_0022 = _reader_guard_boundary_snapshot(api.database_url)
    with _reader_erasure_migration(api.database_url) as (pre_0022_function, checksum):
        if _reader_guard_boundary_snapshot(api.database_url) != boundary_before_0022:
            pytest.fail("Migration 0022 changed Reader guard owner, ACL, or trigger bindings.")
        _assert_reader_guard_direct_mutations_rejected(api.database_url, owner_id)

        with psycopg.connect(api.database_url) as connection:
            privilege_rows = connection.execute(
                """SELECT has_schema_privilege('supabase_auth_admin', 'auth', 'USAGE'),
                          has_table_privilege('supabase_auth_admin', 'auth.users', 'SELECT'),
                          has_table_privilege('supabase_auth_admin', 'auth.users', 'DELETE'),
                          has_table_privilege('supabase_auth_admin', 'public.users', 'DELETE')"""
            ).fetchone()
        if privilege_rows != (True, True, True, False):
            pytest.fail("Local Auth owner privilege boundary differed from the accepted baseline.")

        # Deleting the public parent while its Auth identity exists is not an
        # erasure path, even though child deletes run at cascade depth.
        with psycopg.connect(api.database_url) as connection:
            _assert_guard_rejects(
                connection,
                "DELETE FROM public.users WHERE id = %s",
                owner_id,
            )

        # Keep the legacy NULL-fingerprint exposure branch exactly as it
        # works today: an old row can still be updated or deleted.
        with psycopg.connect(api.database_url) as connection:
            legacy_row = connection.execute(
                """INSERT INTO public.exposure_events
                     (user_id, user_language_id, language_code, exposure_type,
                      content_id, content_segment_id, evidence)
                   VALUES (%s, %s, 'en', 'read', %s, %s, '{}'::jsonb)
                   RETURNING id""",
                (owner_id, profile_id, content_id, segment_id),
            ).fetchone()
            if legacy_row is None:
                pytest.fail("Local legacy exposure row could not be created.")
            legacy_id = legacy_row[0]
            updated = connection.execute(
                """UPDATE public.exposure_events
                   SET evidence = '{\"legacyUpdated\":true}'::jsonb
                   WHERE id = %s AND request_fingerprint IS NULL
                   RETURNING evidence""",
                (legacy_id,),
            ).fetchone()
            if updated != ({"legacyUpdated": True},):
                pytest.fail("Candidate guard changed legacy exposure update behavior.")
            deleted = connection.execute(
                "DELETE FROM public.exposure_events WHERE id = %s RETURNING id",
                (legacy_id,),
            ).fetchone()
            if deleted != (legacy_id,):
                pytest.fail("Candidate guard changed legacy exposure delete behavior.")

            _install_delete_context_probes(connection)

        _delete_as_supabase_auth_owner(api.database_url, owner_id)
        if not _zero_actor_rows(api.database_url, owner_id):
            pytest.fail("Candidate trusted Auth cascade did not erase all 27 actor tables.")
        with psycopg.connect(api.database_url) as connection:
            if (
                connection.execute("SELECT 1 FROM auth.users WHERE id = %s", (owner_id,)).fetchone()
                is not None
            ):
                pytest.fail("Candidate trusted Auth cascade left the Auth identity present.")
            observations = connection.execute(
                """SELECT table_name, count(*), bool_and(trigger_depth > 1),
                          bool_and(NOT auth_identity_present)
                   FROM public.reader_auth_erasure_delete_probe
                   WHERE user_id = %s
                   GROUP BY table_name""",
                (owner_id,),
            ).fetchall()
            expected_tables = {
                "exposure_events",
                "reader_exposure_concepts",
                "reader_mutation_results",
            }
            if {row[0] for row in observations} != expected_tables or any(
                row[1] < 1 or row[2] is not True or row[3] is not True for row in observations
            ):
                pytest.fail(
                    "Reader cascade did not prove depth>1 and absent Auth parent per row type."
                )

        # A real concurrent insert referencing the deleting public parent must
        # wait, then fail its FK check after Auth erasure commits.
        _assert_concurrent_insert_waits_for_auth_erasure(api.database_url, racer.id)
        if not _zero_actor_rows(api.database_url, racer.id):
            pytest.fail("Concurrent insert race left rows for the erased race actor.")
        with psycopg.connect(api.database_url) as connection:
            if (
                connection.execute("SELECT 1 FROM auth.users WHERE id = %s", (racer.id,)).fetchone()
                is not None
            ):
                pytest.fail("Concurrent race Auth identity remained after deletion.")
            if connection.execute(
                "SELECT count(*) FROM reader_mutation_results WHERE user_id = %s",
                (racer.id,),
            ).fetchone() != (0,):
                pytest.fail("Concurrent Reader result insert left an orphan row.")

        # A checksum mismatch must stop reapplication instead of accepting an
        # altered or unknown migration pair.
        with psycopg.connect(api.database_url) as connection:
            connection.execute(
                "UPDATE public.schema_migrations SET checksum = %s WHERE version = '0022'",
                ("0" * 64,),
            )
        try:
            with pytest.raises(MigrationChecksumError):
                migrate_up(api.database_url, MIGRATIONS)
        finally:
            with psycopg.connect(api.database_url) as connection:
                connection.execute(
                    "UPDATE public.schema_migrations SET checksum = %s WHERE version = '0022'",
                    (checksum,),
                )

        # Roll back only 0022 and prove the exact original guard rejects Auth
        # erasure for Actor B's retained Reader history, then reapply cleanly.
        if migrate_down(api.database_url, MIGRATIONS, steps=1) != ["0022"]:
            pytest.fail("Migration 0022 did not roll back as the current head.")
        if _function_definition(api.database_url) != pre_0022_function:
            pytest.fail("Migration 0022 down changed the exact pre-0022 guard definition.")
        if _reader_guard_boundary_snapshot(api.database_url) != boundary_before_0022:
            pytest.fail("Migration 0022 down changed Reader guard owner, ACL, or trigger bindings.")
        with psycopg.connect(api.database_url) as connection:
            with pytest.raises(
                psycopg.errors.CheckViolation,
                match="Reader source facts and replay snapshots are append-only",
            ) as error:
                connection.execute("SET LOCAL ROLE supabase_auth_admin")
                connection.execute("DELETE FROM auth.users WHERE id = %s", (survivor.id,))
            if error.value.sqlstate != "23514":
                pytest.fail("Rolled-back migration did not restore SQLSTATE 23514 behavior.")
            connection.rollback()
        if migrate_up(api.database_url, MIGRATIONS) != ["0022"]:
            pytest.fail("Migration 0022 did not reapply from the exact 0021 state.")
        if migrate_up(api.database_url, MIGRATIONS) != []:
            pytest.fail("Reapplied migration 0022 was not checksum-stable and idempotent.")

    if _actor_snapshot(api.database_url, survivor.id) != survivor_before:
        pytest.fail("Auth erasure changed Actor B's complete 27-table snapshot.")
