from __future__ import annotations

import hashlib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from threading import Barrier, Event
from time import monotonic, sleep
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.hosted_fixture import routes as hosted_fixture_routes
from lingua_api.hosted_fixture import store as hosted_fixture_store
from lingua_api.hosted_fixture.errors import (
    FixtureConflict,
    FixtureForbidden,
    FixtureUnavailable,
)
from lingua_api.hosted_fixture.protocol import (
    GITHUB_CONTENTS_READ_TOKEN_HEADER,
    LICENSE_CODE,
    LICENSE_NAME,
    REPOSITORY_ID,
    SOURCE_ATTRIBUTION,
    SOURCE_NAME,
    SOURCE_VERSION,
    SUPABASE_PROJECT_REF,
    FixtureIds,
    RunClaims,
    derive_fixture_ids,
)
from lingua_api.hosted_fixture.store import PostgresFixtureStore, _verified_pinned_ca_path
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.errors import ForeignKeyViolation

_TEST_SERVICE_DATABASE_URL = (
    f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
)
_PINNED_CA_SHA256 = "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7"
_READER_SEED = Path(__file__).resolve().parents[3] / "database" / "seeds" / "task008_reader_mvp.sql"


@dataclass(frozen=True)
class _LocalApiVerifier:
    actor: AuthenticatedActor

    def verify(self, token: str) -> AuthenticatedActor:
        if token != "valid-token":
            raise AssertionError("unexpected local test token")
        return self.actor


@dataclass(frozen=True)
class _LocalApiClock:
    instant: datetime = datetime(2026, 8, 30, 3, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.instant


def _seed_approved_source(database_url: str) -> None:
    with psycopg.connect(database_url) as connection:
        license_rows = connection.execute(
            """
            SELECT id, name, usage_policy, attribution_required
            FROM public.licenses WHERE code=%s
            """,
            (LICENSE_CODE,),
        ).fetchall()
        if not license_rows:
            license_id = uuid4()
            connection.execute(
                """
                INSERT INTO public.licenses
                    (id, code, name, usage_policy, attribution_required)
                VALUES (%s, %s, %s, 'allowed', false)
                """,
                (license_id, LICENSE_CODE, LICENSE_NAME),
            )
        else:
            assert len(license_rows) == 1
            license_id = license_rows[0][0]
            assert license_rows[0][1:] == (LICENSE_NAME, "allowed", False)

        source_rows = connection.execute(
            """
            SELECT id, source_type, license_id, attribution_text
            FROM public.data_sources WHERE name=%s AND source_version=%s
            """,
            (SOURCE_NAME, SOURCE_VERSION),
        ).fetchall()
        if not source_rows:
            source_id = uuid4()
            connection.execute(
                """
                INSERT INTO public.data_sources
                    (id, name, source_type, source_version, license_id, attribution_text)
                VALUES (%s, %s, 'internal', %s, %s, %s)
                """,
                (source_id, SOURCE_NAME, SOURCE_VERSION, license_id, SOURCE_ATTRIBUTION),
            )
        else:
            assert len(source_rows) == 1
            source_id = source_rows[0][0]
            assert source_rows[0][1:] == (
                "internal",
                license_id,
                SOURCE_ATTRIBUTION,
            )

        approved = connection.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM public.source_records
                WHERE source_id=%s AND review_status='approved' AND quality_score IS NOT NULL
            )
            """,
            (source_id,),
        ).fetchone()
        if approved != (True,):
            record_id = uuid4()
            connection.execute(
                """
                INSERT INTO public.source_records
                    (id, source_id, source_record_key, raw_hash, transform_version,
                     quality_score, review_status, imported_at, reviewed_at, metadata)
                VALUES (%s, %s, %s, %s, %s, 1.0, 'approved', %s, %s, '{}'::jsonb)
                """,
                (
                    record_id,
                    source_id,
                    "k209-local-fixture-source",
                    "c" * 64,
                    "local-test-seed.v1",
                    datetime.now(UTC),
                    datetime.now(UTC),
                ),
            )


def _claims(run_id: int = 915009) -> RunClaims:
    return RunClaims(
        repository_id=REPOSITORY_ID,
        run_id=run_id,
        run_attempt=1,
        sha="d" * 40,
        workflow_sha="d" * 40,
        jti=f"local-test-{run_id}",
        issued_at=1_800_000_000,
        expires_at=1_800_000_300,
    )


def _enable_fixed_target(monkeypatch: pytest.MonkeyPatch, local_database_url: str) -> None:
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-daip7vbm8hqs73dp00pg")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "lingua-api-staging")
    monkeypatch.setenv("SUPABASE_URL", f"https://{SUPABASE_PROJECT_REF}.supabase.co")
    monkeypatch.delenv("RENDER_PROJECT_ID", raising=False)
    original_connect = psycopg.connect

    def connect_local_fixture_database(conninfo: object, *args: object, **kwargs: object):
        if conninfo == _TEST_SERVICE_DATABASE_URL:
            assert kwargs.get("sslmode") == "verify-full"
            assert kwargs.get("sslrootcert") == _verified_pinned_ca_path()
            local_kwargs = {
                key: value for key, value in kwargs.items() if key not in {"sslmode", "sslrootcert"}
            }
            return original_connect(local_database_url, *args, **local_kwargs)  # type: ignore[arg-type]
        return original_connect(conninfo, *args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(psycopg, "connect", connect_local_fixture_database)


def test_runtime_guard_checks_postgres_bypass_and_six_catalog_owners(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    store.runtime_guard()

    monkeypatch.setenv("RENDER_SERVICE_ID", "another-service")
    with pytest.raises(FixtureForbidden):
        store.runtime_guard()


def test_fixture_controller_source_does_not_reference_auth_or_learner_relations() -> None:
    source = Path(hosted_fixture_store.__file__).read_text(encoding="utf-8").casefold()
    forbidden_relations = (
        "auth.users",
        "public.users",
        "learner_profiles",
        "user_languages",
        "user_skill_states",
        "user_concept_states",
        "learning_events",
        "exposure_events",
        "review_items",
        "fsrs_states",
        "review_events",
        "user_saved_concepts",
        "user_saved_content",
        "user_saved_sentences",
        "today_plans",
        "today_plan_activities",
        "assessment_attempts",
        "assessment_responses",
        "assessment_results",
        "user_language_projection_heads",
        "user_content_progress",
        "reader_mutation_results",
        "today_activity_review_items",
        "assessment_attempt_items",
        "assessment_idempotency_log",
        "concept_save_intents",
        "reader_exposure_concepts",
        "profile_mutation_results",
    )
    assert all(relation not in source for relation in forbidden_relations)


@pytest.mark.parametrize(
    "database_url",
    [
        f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres",
        (
            f"postgresql://postgres.{SUPABASE_PROJECT_REF}@"
            "aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
        ),
        (
            f"postgresql://postgres.{SUPABASE_PROJECT_REF}@"
            "aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full"
        ),
    ],
)
def test_render_target_accepts_only_project_bound_direct_and_shared_pooler_dsns(
    database_url: str,
) -> None:
    store = PostgresFixtureStore(database_url)
    store.assert_render_target(
        {
            "RENDER_SERVICE_ID": "srv-daip7vbm8hqs73dp00pg",
            "RENDER_SERVICE_NAME": "lingua-api-staging",
            "SUPABASE_URL": f"https://{SUPABASE_PROJECT_REF}.supabase.co",
        }
    )


def test_store_disables_prepared_statements_for_shared_transaction_pooler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_url = (
        f"postgresql://postgres.{SUPABASE_PROJECT_REF}@"
        "aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
        "?sslmode=require&sslrootcert=%2Ftmp%2Funtrusted-ca.crt"
    )
    store = PostgresFixtureStore(database_url)
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-daip7vbm8hqs73dp00pg")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "lingua-api-staging")
    monkeypatch.setenv("SUPABASE_URL", f"https://{SUPABASE_PROJECT_REF}.supabase.co")
    calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    def capture_connect(*args: object, **kwargs: object) -> object:
        calls.append((args, kwargs))
        return object()

    monkeypatch.setattr(psycopg, "connect", capture_connect)
    store._connect()
    assert len(calls) == 1
    args, kwargs = calls[0]
    assert args == (database_url,)
    assert kwargs["prepare_threshold"] is None
    assert kwargs["sslmode"] == "verify-full"
    pinned_ca_path = Path(str(kwargs["sslrootcert"]))
    assert pinned_ca_path == Path(_verified_pinned_ca_path())
    assert hashlib.sha256(pinned_ca_path.read_bytes()).hexdigest() == _PINNED_CA_SHA256
    effective_tls = conninfo_to_dict(
        make_conninfo(
            database_url,
            sslmode=kwargs["sslmode"],
            sslrootcert=kwargs["sslrootcert"],
        )
    )
    assert effective_tls["sslmode"] == "verify-full"
    assert Path(effective_tls["sslrootcert"]) == pinned_ca_path
    assert "statement_timeout=8000" in str(kwargs["options"])


def test_pinned_ca_mismatch_fails_before_opening_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-daip7vbm8hqs73dp00pg")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "lingua-api-staging")
    monkeypatch.setenv("SUPABASE_URL", f"https://{SUPABASE_PROJECT_REF}.supabase.co")
    monkeypatch.setattr(hosted_fixture_store, "_PINNED_CA_SHA256", "0" * 64)
    connections: list[bool] = []
    monkeypatch.setattr(psycopg, "connect", lambda *args, **kwargs: connections.append(True))

    with pytest.raises(FixtureUnavailable):
        PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)._connect()
    assert connections == []


@pytest.mark.parametrize(
    ("supabase_url", "database_url"),
    [
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            "postgresql://postgres@db.foreignproject.supabase.co:5432/postgres",
        ),
        (
            "https://foreignproject.supabase.co",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres",
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            (
                "postgresql://postgres.foreignproject@"
                "aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
            ),
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:6543/postgres",
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=disable",
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=prefer",
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/other",
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            (
                f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
                "?hostaddr=127.0.0.1"
            ),
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            (
                f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
                "?service=other"
            ),
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co",
            (
                f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432,"
                "db.foreignproject.supabase.co:5432/postgres"
            ),
        ),
        (
            f"https://user@{SUPABASE_PROJECT_REF}.supabase.co",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres",
        ),
        (
            f"https://{SUPABASE_PROJECT_REF}.supabase.co?project=other",
            f"postgresql://postgres@db.{SUPABASE_PROJECT_REF}.supabase.co:5432/postgres",
        ),
    ],
)
def test_runtime_guard_rejects_unbound_or_ambiguous_dsn_before_connect(
    monkeypatch: pytest.MonkeyPatch, supabase_url: str, database_url: str
) -> None:
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-daip7vbm8hqs73dp00pg")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "lingua-api-staging")
    monkeypatch.setenv("SUPABASE_URL", supabase_url)
    connections: list[bool] = []

    def forbidden_connect(*args: object, **kwargs: object) -> None:
        del args, kwargs
        connections.append(True)
        raise AssertionError("invalid project target reached PostgreSQL")

    monkeypatch.setattr(psycopg, "connect", forbidden_connect)
    store = PostgresFixtureStore(database_url)
    with pytest.raises(FixtureForbidden):
        store.runtime_guard()
    assert connections == []


def test_runtime_guard_requires_supabase_url_before_connect(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-daip7vbm8hqs73dp00pg")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "lingua-api-staging")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    connections: list[bool] = []
    monkeypatch.setattr(
        psycopg,
        "connect",
        lambda *args, **kwargs: connections.append(True),
    )
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    with pytest.raises(FixtureForbidden):
        store.runtime_guard()
    assert connections == []


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("PGHOSTADDR", "127.0.0.1"),
        ("PGSERVICE", "other-service"),
        ("PGSERVICEFILE", "C:/temporary/libpq-service.conf"),
        ("PGHOST", "another-host"),
        ("PGOPTIONS", "-c session_replication_role=replica"),
    ],
)
def test_libpq_target_overrides_abort_before_store_connection(
    monkeypatch: pytest.MonkeyPatch, name: str, value: str
) -> None:
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-daip7vbm8hqs73dp00pg")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "lingua-api-staging")
    monkeypatch.setenv("SUPABASE_URL", f"https://{SUPABASE_PROJECT_REF}.supabase.co")
    monkeypatch.setenv(name, value)
    connections: list[bool] = []

    def forbidden_connect(*args: object, **kwargs: object) -> None:
        del args, kwargs
        connections.append(True)
        raise AssertionError("libpq override reached PostgreSQL")

    monkeypatch.setattr(psycopg, "connect", forbidden_connect)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    with pytest.raises(FixtureForbidden):
        store._connect()
    assert connections == []


def test_fixture_setup_inspect_retry_cleanup_and_terminal_replay(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims()

    absent = store.inspect(claims)
    assert absent["receiptState"] == "ABSENT"
    assert absent["fixture"] is None
    assert absent["counts"] == {
        "sourceRecords": 0,
        "concepts": 0,
        "lexemes": 0,
        "forms": 0,
        "senses": 0,
        "bridges": 0,
    }

    created = store.setup(claims)
    assert created["receiptState"] == "ACTIVE"
    assert created["disposition"] == "created"
    assert created["counts"] == {
        "sourceRecords": 1,
        "concepts": 2,
        "lexemes": 1,
        "forms": 1,
        "senses": 2,
        "bridges": 3,
    }
    active = store.inspect(claims)
    assert active["receiptState"] == "ACTIVE"
    assert active["fixture"] == created["fixture"]

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        before = connection.execute(
            "SELECT created_at FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone()
    assert store.setup(claims)["disposition"] == "verified_existing"
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        after = connection.execute(
            "SELECT created_at FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone()
    assert after == before

    closed = store.cleanup(claims)
    assert closed["receiptState"] == "CLOSED"
    assert closed["fixturePresent"] is False
    assert closed["counts"] == created["counts"]
    assert store.inspect(claims)["receiptState"] == "CLOSED"
    repeated_cleanup = store.cleanup(claims)
    assert set(repeated_cleanup) == {"protocolVersion", "receiptState", "fixturePresent", "counts"}
    assert repeated_cleanup["counts"] == {
        "sourceRecords": 0,
        "concepts": 0,
        "lexemes": 0,
        "forms": 0,
        "senses": 0,
        "bridges": 0,
    }
    with pytest.raises(FixtureConflict):
        store.setup(claims)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        receipt = connection.execute(
            "SELECT state, closed_at FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone()
        assert receipt is not None and receipt[0] == "CLOSED" and receipt[1] is not None
        counts = connection.execute(
            """
            SELECT
              (SELECT count(*) FROM public.source_records
                WHERE source_record_key LIKE 'k2-09-fixture:%'),
              (SELECT count(*) FROM public.concepts WHERE canonical_key LIKE 'word:k2-09-%:%'),
              (SELECT count(*) FROM public.lexemes WHERE lemma LIKE 'kfixture%'),
              (SELECT count(*) FROM public.lexeme_forms WHERE form LIKE 'kfixtures%'),
              (SELECT count(*) FROM public.word_senses
                WHERE definition LIKE 'K2-09 fixture sense%'),
              (SELECT count(*) FROM public.concept_senses
                WHERE concept_id IN (
                  SELECT id FROM public.concepts WHERE canonical_key LIKE 'word:k2-09-%:%'
                ))
            """
        ).fetchone()
        assert counts == (0, 0, 0, 0, 0, 0)


def test_concurrent_same_run_setup_returns_one_creation_and_one_verified_retry(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    claims = _claims(915032)
    barrier = Barrier(2)

    def setup() -> dict[str, object]:
        barrier.wait(timeout=5)
        return PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL).setup(claims)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: setup(), range(2)))

    assert sorted(str(result["disposition"]) for result in results) == [
        "created",
        "verified_existing",
    ]
    assert all(result["receiptState"] == "ACTIVE" for result in results)
    assert results[0]["fixture"] == results[1]["fixture"]
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone() == (1,)


def test_later_attempt_cannot_adopt_active_or_closed_run_receipt(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    original = _claims(915035)
    later = replace(original, run_attempt=2, jti="local-test-later-attempt")
    created = store.setup(original)

    with pytest.raises(FixtureConflict):
        store.setup(later)
    assert store.inspect(original)["fixture"] == created["fixture"]
    assert store.cleanup(original)["receiptState"] == "CLOSED"
    with pytest.raises(FixtureConflict):
        store.setup(later)
    assert store.inspect(original)["receiptState"] == "CLOSED"


def test_fixture_word_without_explicit_policy_uses_normal_save_and_review_api(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(_READER_SEED.read_text(encoding="utf-8"))
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims(915034)
    fixture = store.setup(claims)["fixture"]
    owner_concept_id = str(fixture["ids"]["ownerConceptId"])
    actor_id = uuid4()

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (actor_id,))
        connection.execute(
            "INSERT INTO public.learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
            (actor_id,),
        )
        profile = connection.execute(
            """
            INSERT INTO public.user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert profile is not None
        profile_id = str(profile[0])

    client = TestClient(
        create_app(
            database_url=isolated_migrated_postgres_url,
            token_verifier=_LocalApiVerifier(AuthenticatedActor(actor_id)),
            clock=_LocalApiClock(),
            cursor_secret=b"k209-local-api-test-cursor-secret-32b",
        )
    )
    headers = {"Authorization": "Bearer valid-token"}
    try:
        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            assert connection.execute(
                "SELECT count(*) FROM public.concept_competence_policies WHERE concept_id=%s",
                (owner_concept_id,),
            ).fetchone() == (0,)

        saved = client.put(
            f"/v1/library/concepts/{owner_concept_id}",
            params={"languageProfileId": profile_id},
            headers=headers,
        )
        assert saved.status_code == 200
        assert saved.json()["data"]["isSaved"] is True

        queue = client.get(
            "/v1/review/queue",
            params={"languageProfileId": profile_id},
            headers=headers,
        )
        assert queue.status_code == 200
        assert len(queue.json()["data"]) == 1
        queued = queue.json()["data"][0]
        assert queued["concept"]["id"] == owner_concept_id
        idempotency_key = str(uuid4())
        answer_path = f"/v1/review/{queued['reviewItemId']}/answer"
        answer_headers = {**headers, "Idempotency-Key": idempotency_key}
        answer_body = {"rating": "good", "responseTimeMs": 820}
        answered = client.post(answer_path, headers=answer_headers, json=answer_body)
        assert answered.status_code == 200
        replayed = client.post(answer_path, headers=answer_headers, json=answer_body)
        assert replayed.status_code == 200
        assert replayed.json()["data"] == answered.json()["data"]

        brain = client.get(f"/v1/brain/concepts/{owner_concept_id}", headers=headers)
        assert brain.status_code == 200
        assert brain.json()["data"]["competence"] == answered.json()["data"]["competence"]
        assert brain.json()["data"]["mastery"] is None
        assert brain.json()["data"]["evidence"]["reviewCount"] == 1
        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            assert connection.execute(
                "SELECT count(*) FROM public.concept_competence_policies WHERE concept_id=%s",
                (owner_concept_id,),
            ).fetchone() == (0,)
    finally:
        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            connection.execute("DELETE FROM auth.users WHERE id=%s", (actor_id,))
        store.cleanup(claims)


def test_tree_drift_is_conflict_and_setup_never_repairs(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims(915010)
    created = store.setup(claims)
    lemma = str(created["fixture"]["lemma"])
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(
            "UPDATE public.lexemes SET lemma=%s WHERE lemma=%s",
            (lemma + "drift", lemma),
        )
    with pytest.raises(FixtureConflict):
        store.setup(claims)
    with pytest.raises(FixtureConflict):
        store.inspect(claims)
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT lemma FROM public.lexemes WHERE lemma=%s", (lemma + "drift",)
        ).fetchone() == (lemma + "drift",)
        assert connection.execute(
            "SELECT state FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone() == ("ACTIVE",)


@pytest.mark.parametrize(
    "collision",
    [
        "concept_id",
        "canonical_key",
        "inflected_form",
        "lexeme_lemma_inflected",
        "lexeme_normalized_inflected",
        "form_lemma",
        "form_normalized_lemma",
    ],
)
def test_setup_collision_preflight_preserves_the_preexisting_catalog_row(
    isolated_migrated_postgres_url: str,
    monkeypatch: pytest.MonkeyPatch,
    collision: str,
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    run_ids = {
        "concept_id": 915022,
        "canonical_key": 915023,
        "inflected_form": 915024,
        "lexeme_lemma_inflected": 915027,
        "lexeme_normalized_inflected": 915028,
        "form_lemma": 915029,
        "form_normalized_lemma": 915030,
    }
    claims = _claims(run_ids[collision])
    ids = derive_fixture_ids(claims)
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        source_record_id = connection.execute(
            """
            SELECT record.id
            FROM public.source_records AS record
            JOIN public.data_sources AS source ON source.id=record.source_id
            WHERE source.name=%s AND source.source_version=%s
              AND record.review_status='approved'
            LIMIT 1
            """,
            (SOURCE_NAME, SOURCE_VERSION),
        ).fetchone()
        assert source_record_id is not None
        if collision in {"concept_id", "canonical_key"}:
            concept_id = ids.owner_concept if collision == "concept_id" else uuid4()
            canonical_key = (
                ids.owner_canonical_key if collision == "canonical_key" else f"external:{uuid4()}"
            )
            connection.execute(
                """
                INSERT INTO public.concepts
                    (id, language_code, concept_type, canonical_key, source_record_id)
                VALUES (%s, 'en', 'word', %s, %s)
                """,
                (concept_id, canonical_key, source_record_id[0]),
            )
            conflicting_row = ("concepts", "id", concept_id)
        else:
            concept_id = uuid4()
            lexeme_id = uuid4()
            connection.execute(
                """
                INSERT INTO public.concepts
                    (id, language_code, concept_type, canonical_key, source_record_id)
                VALUES (%s, 'en', 'word', %s, %s)
                """,
                (concept_id, f"external:{uuid4()}", source_record_id[0]),
            )
            if collision.startswith("lexeme_"):
                lemma = (
                    ids.inflected_form
                    if collision == "lexeme_lemma_inflected"
                    else f"external-{uuid4()}"
                )
                normalized = (
                    ids.inflected_form
                    if collision == "lexeme_normalized_inflected"
                    else f"external-{uuid4()}"
                )
                connection.execute(
                    """
                    INSERT INTO public.lexemes
                        (id, concept_id, language_code, lemma, normalized_form,
                         part_of_speech, source_record_id)
                    VALUES (%s, %s, 'en', %s, %s, 'noun', %s)
                    """,
                    (lexeme_id, concept_id, lemma, normalized, source_record_id[0]),
                )
                column = "lemma" if collision == "lexeme_lemma_inflected" else "normalized_form"
                conflicting_row = ("lexemes", column, ids.inflected_form)
            else:
                connection.execute(
                    """
                    INSERT INTO public.lexemes
                        (id, concept_id, language_code, lemma, normalized_form,
                         part_of_speech, source_record_id)
                    VALUES (%s, %s, 'en', %s, %s, 'noun', %s)
                    """,
                    (
                        lexeme_id,
                        concept_id,
                        f"external-{uuid4()}",
                        f"external-{uuid4()}",
                        source_record_id[0],
                    ),
                )
                form = ids.inflected_form if collision == "inflected_form" else ids.lemma
                normalized = (
                    form
                    if collision == "inflected_form"
                    else f"external-{uuid4()}"
                    if collision == "form_lemma"
                    else ids.lemma
                )
                connection.execute(
                    """
                    INSERT INTO public.lexeme_forms
                        (lexeme_id, form, normalized_form, form_type, source_record_id)
                    VALUES (%s, %s, %s, 'inflection', %s)
                    """,
                    (lexeme_id, form, normalized, source_record_id[0]),
                )
                column = (
                    "form" if collision in {"inflected_form", "form_lemma"} else "normalized_form"
                )
                conflicting_row = ("lexeme_forms", column, form if column == "form" else normalized)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        before_counts = store._fixture_counts(connection, ids)
    with pytest.raises(FixtureConflict):
        store.setup(claims)
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        after_counts = store._fixture_counts(connection, ids)
        receipt_count = connection.execute(
            "SELECT count(*) FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone()
        table, column, key = conflicting_row
        assert connection.execute(
            f'SELECT count(*) FROM public."{table}" WHERE "{column}"=%s', (key,)
        ).fetchone() == (1,)
    assert after_counts == before_counts
    assert receipt_count == (0,)


@pytest.mark.parametrize("delete_action", ["CASCADE", "SET NULL"])
def test_cross_schema_foreign_key_drift_blocks_setup_and_cleanup_atomically(
    isolated_migrated_postgres_url: str,
    monkeypatch: pytest.MonkeyPatch,
    delete_action: str,
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims(915020 if delete_action == "CASCADE" else 915021)
    fixture_ids = derive_fixture_ids(claims)
    schema = "k209_external_fk_test"
    constraint = "external_concept_reference_fk"

    def fixture_counts(connection: psycopg.Connection) -> tuple[int, ...]:
        row = connection.execute(
            """
            SELECT
              (SELECT count(*) FROM public.source_records WHERE id=%s),
              (SELECT count(*) FROM public.concepts WHERE id=ANY(%s)),
              (SELECT count(*) FROM public.lexemes WHERE id=%s),
              (SELECT count(*) FROM public.lexeme_forms WHERE id=%s),
              (SELECT count(*) FROM public.word_senses WHERE id=ANY(%s)),
              (SELECT count(*) FROM public.concept_senses WHERE concept_id=ANY(%s))
            """,
            (
                fixture_ids.source_record,
                [fixture_ids.owner_concept, fixture_ids.secondary_concept],
                fixture_ids.lexeme,
                fixture_ids.form,
                [fixture_ids.sense_one, fixture_ids.sense_two],
                [fixture_ids.owner_concept, fixture_ids.secondary_concept],
            ),
        ).fetchone()
        assert row is not None
        return tuple(int(value) for value in row)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        connection.execute(f'CREATE SCHEMA "{schema}"')
        connection.execute(
            f'''CREATE TABLE "{schema}".external_reference (
                id integer PRIMARY KEY,
                concept_id uuid,
                CONSTRAINT "{constraint}" FOREIGN KEY (concept_id)
                    REFERENCES public.concepts(id) ON DELETE {delete_action}
            )'''
        )
        before_setup_rows = fixture_counts(connection)
        before_setup_receipt_count = connection.execute(
            "SELECT count(*) FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone()
    try:
        with pytest.raises(FixtureConflict):
            store.setup(claims)
        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            assert fixture_counts(connection) == before_setup_rows == (0, 0, 0, 0, 0, 0)
            assert (
                connection.execute(
                    "SELECT count(*) FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
                    (claims.run_id,),
                ).fetchone()
                == before_setup_receipt_count
                == (0,)
            )
            connection.execute(
                f'ALTER TABLE "{schema}".external_reference DROP CONSTRAINT "{constraint}"'
            )

        created = store.setup(claims)
        concept_id = created["fixture"]["ids"]["ownerConceptId"]
        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            connection.execute(
                f'''ALTER TABLE "{schema}".external_reference
                    ADD CONSTRAINT "{constraint}" FOREIGN KEY (concept_id)
                    REFERENCES public.concepts(id) ON DELETE {delete_action}'''
            )
            connection.execute(
                f'INSERT INTO "{schema}".external_reference (id, concept_id) VALUES (1, %s)',
                (concept_id,),
            )
            before_cleanup = (
                *fixture_counts(connection),
                *connection.execute(
                    "SELECT state FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
                    (claims.run_id,),
                ).fetchone(),
                *connection.execute(
                    """
                    SELECT concept_id::text FROM "k209_external_fk_test".external_reference
                    WHERE id=1
                    """
                ).fetchone(),
            )
            assert before_cleanup[:6] == (1, 2, 1, 1, 2, 3)

        with pytest.raises(FixtureConflict):
            store.cleanup(claims)

        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            after_cleanup = (
                *fixture_counts(connection),
                *connection.execute(
                    "SELECT state FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
                    (claims.run_id,),
                ).fetchone(),
                *connection.execute(
                    """
                    SELECT concept_id::text FROM "k209_external_fk_test".external_reference
                    WHERE id=1
                    """
                ).fetchone(),
            )
            assert after_cleanup == before_cleanup
            assert after_cleanup[-2] == "ACTIVE"
            assert after_cleanup[-1] == concept_id
    finally:
        with psycopg.connect(isolated_migrated_postgres_url) as connection:
            connection.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')


def test_cleanup_rolls_back_when_ordinary_saved_concept_references_fixture(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims(915011)
    created = store.setup(claims)
    concept_id = created["fixture"]["ids"]["ownerConceptId"]
    actor_id = uuid4()

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (actor_id,))
        language = connection.execute(
            """
            INSERT INTO public.user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 5)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
        assert language is not None
        connection.execute(
            """
            INSERT INTO public.user_saved_concepts
                (user_id, user_language_id, concept_id, language_code)
            VALUES (%s, %s, %s, 'en')
            """,
            (actor_id, language[0], concept_id),
        )

    with pytest.raises(FixtureConflict):
        store.cleanup(claims)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT state FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone() == ("ACTIVE",)
        assert connection.execute(
            "SELECT count(*) FROM public.user_saved_concepts WHERE user_id=%s AND concept_id=%s",
            (actor_id, concept_id),
        ).fetchone() == (1,)
        assert connection.execute(
            "SELECT count(*) FROM public.concepts WHERE id=%s", (concept_id,)
        ).fetchone() == (1,)
        connection.execute("DELETE FROM auth.users WHERE id=%s", (actor_id,))

    assert store.cleanup(claims)["receiptState"] == "CLOSED"


def test_cleanup_parent_locks_serialize_a_concurrent_saved_concept_reference(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims(915025)
    created = store.setup(claims)
    actor_id = uuid4()
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor_id,))
        connection.execute("INSERT INTO public.users (id) VALUES (%s)", (actor_id,))
        profile = connection.execute(
            """
            INSERT INTO public.user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication', 5)
            RETURNING id
            """,
            (actor_id,),
        ).fetchone()
    assert profile is not None

    parent_locked = Event()
    release_cleanup = Event()
    insert_started = Event()
    original_guard = PostgresFixtureStore._assert_no_external_cascade_rows

    def pause_after_parent_locks(connection: psycopg.Connection, ids: FixtureIds) -> None:
        original_guard(connection, ids)
        parent_locked.set()
        if not release_cleanup.wait(timeout=10):
            raise AssertionError("cleanup lock test did not release the transaction")

    monkeypatch.setattr(
        PostgresFixtureStore,
        "_assert_no_external_cascade_rows",
        staticmethod(pause_after_parent_locks),
    )
    application_name = "k209-fixture-fk-lock-test"
    with ThreadPoolExecutor(max_workers=2) as executor:
        cleanup_future = executor.submit(store.cleanup, claims)
        insert_future = None

        try:
            assert parent_locked.wait(timeout=5)

            def add_saved_reference() -> None:
                with psycopg.connect(
                    isolated_migrated_postgres_url,
                    application_name=application_name,
                ) as connection:
                    connection.execute("SET lock_timeout = '10s'")
                    insert_started.set()
                    connection.execute(
                        """
                        INSERT INTO public.user_saved_concepts
                            (user_id, user_language_id, concept_id, language_code)
                        VALUES (%s, %s, %s, 'en')
                        """,
                        (actor_id, profile[0], created["fixture"]["ids"]["ownerConceptId"]),
                    )

            insert_future = executor.submit(add_saved_reference)
            assert insert_started.wait(timeout=5)
            deadline = monotonic() + 5
            blocked = False
            while monotonic() < deadline:
                with psycopg.connect(isolated_migrated_postgres_url) as monitor:
                    blocked = monitor.execute(
                        """
                        SELECT EXISTS (
                            SELECT 1 FROM pg_catalog.pg_stat_activity
                            WHERE application_name=%s AND wait_event_type='Lock'
                        )
                        """,
                        (application_name,),
                    ).fetchone() == (True,)
                if blocked:
                    break
                sleep(0.05)
            assert blocked
        finally:
            release_cleanup.set()

        assert cleanup_future.result(timeout=15)["receiptState"] == "CLOSED"
        assert insert_future is not None
        with pytest.raises(ForeignKeyViolation):
            insert_future.result(timeout=15)

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM public.user_saved_concepts WHERE user_id=%s",
            (actor_id,),
        ).fetchone() == (0,)
        connection.execute("DELETE FROM auth.users WHERE id=%s", (actor_id,))


def test_reaper_purges_expired_closed_receipt_only_after_exact_fixture_absence(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    claims = _claims(915012)
    created = store.setup(claims)
    assert store.cleanup(claims)["receiptState"] == "CLOSED"

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        source_record_id = connection.execute(
            """
            SELECT record.id
            FROM public.source_records AS record
            JOIN public.data_sources AS source ON source.id = record.source_id
            WHERE source.name=%s AND source.source_version=%s
              AND record.source_record_key='k209-local-fixture-source'
            """,
            (SOURCE_NAME, SOURCE_VERSION),
        ).fetchone()
        assert source_record_id is not None
        connection.execute(
            """
            UPDATE private.k2_hosted_fixture_receipts
            SET closed_at = clock_timestamp() - interval '76 days'
            WHERE run_id=%s
            """,
            (claims.run_id,),
        )

    candidates = store.reap_candidates()
    assert len(candidates) == 1 and candidates[0]["state"] == "CLOSED"
    fixture = created["fixture"]
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(
            """
            INSERT INTO public.concepts
                (id, language_code, concept_type, canonical_key, source_record_id)
            VALUES (%s, 'en', 'word', %s, %s)
            """,
            (
                fixture["ids"]["ownerConceptId"],
                f"word:k2-09-owner:{fixture['lemma'][len('kfixture') :]}",
                source_record_id[0],
            ),
        )

    with pytest.raises(FixtureConflict):
        store.reap(candidates)
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT state FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone() == ("CLOSED",)
        connection.execute(
            "DELETE FROM public.concepts WHERE id=%s",
            (fixture["ids"]["ownerConceptId"],),
        )

    result = store.reap(store.reap_candidates())
    assert result["purgedReceiptCount"] == 1
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone() == (0,)


def test_authenticated_routes_gate_absent_setup_and_allow_owned_cleanup_after_deploy_change(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    claims = _claims(915013)
    monkeypatch.setenv("RENDER_GIT_COMMIT", claims.sha)
    _seed_approved_source(isolated_migrated_postgres_url)
    github_tokens: list[str] = []

    monkeypatch.setattr(hosted_fixture_routes, "verify_oidc_token", lambda token: claims)

    def current_master_sha(token: str) -> str:
        github_tokens.append(token)
        return claims.sha

    monkeypatch.setattr(hosted_fixture_routes, "current_master_sha", current_master_sha)
    client = TestClient(
        create_app(
            database_url=_TEST_SERVICE_DATABASE_URL,
            cursor_secret=b"test-cursor-secret-value-longer-than-32-bytes",
        )
    )
    headers = {"Authorization": "Bearer signed-test-token"}
    path = "/internal/k2-hosted-fixtures/k2-09"
    github_header = {GITHUB_CONTENTS_READ_TOKEN_HEADER: "github-read-token-for-local-test"}

    absent_without_token = client.get(f"{path}/inspect", headers=headers)
    assert absent_without_token.status_code == 403
    absent = client.get(f"{path}/inspect", headers={**headers, **github_header})
    assert absent.status_code == 200
    assert absent.json()["receiptState"] == "ABSENT"
    assert github_tokens == ["github-read-token-for-local-test"]

    setup_without_token = client.post(f"{path}/setup", headers=headers)
    assert setup_without_token.status_code == 403
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        assert connection.execute(
            "SELECT count(*) FROM private.k2_hosted_fixture_receipts WHERE run_id=%s",
            (claims.run_id,),
        ).fetchone() == (0,)

    setup = client.post(f"{path}/setup", headers={**headers, **github_header})
    assert setup.status_code == 200
    assert setup.headers["cache-control"] == "no-store"
    assert setup.json()["receiptState"] == "ACTIVE"
    assert github_tokens == ["github-read-token-for-local-test"] * 2

    active = client.get(f"{path}/inspect", headers=headers)
    assert active.status_code == 200
    assert active.json()["receiptState"] == "ACTIVE"
    assert github_tokens == ["github-read-token-for-local-test"] * 2

    monkeypatch.setenv("RENDER_GIT_COMMIT", "e" * 40)
    cleanup = client.post(f"{path}/cleanup", headers=headers)
    assert cleanup.status_code == 200
    assert cleanup.json()["receiptState"] == "CLOSED"
    assert github_tokens == ["github-read-token-for-local-test"] * 2


def test_reaper_requires_completed_exact_run_pair_before_active_fixture_cleanup(
    isolated_migrated_postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_fixed_target(monkeypatch, isolated_migrated_postgres_url)
    _seed_approved_source(isolated_migrated_postgres_url)
    claims = _claims(915026)
    monkeypatch.setenv("RENDER_GIT_COMMIT", claims.sha)
    monkeypatch.setattr(hosted_fixture_routes, "verify_oidc_token", lambda token: claims)
    current_master_calls: list[str] = []

    def current_master_sha(token: str) -> str:
        current_master_calls.append(token)
        return claims.sha

    monkeypatch.setattr(hosted_fixture_routes, "current_master_sha", current_master_sha)
    pair_calls: list[tuple[str, int, int, str]] = []
    pair_state = {"completed": False, "unavailable": False}

    def completed_pair(*, token: str, run_id: int, attempt: int, sha: str) -> bool:
        pair_calls.append((token, run_id, attempt, sha))
        if pair_state["unavailable"]:
            raise FixtureUnavailable()
        return pair_state["completed"]

    monkeypatch.setattr(hosted_fixture_routes, "completed_run_pair", completed_pair)
    store = PostgresFixtureStore(_TEST_SERVICE_DATABASE_URL)
    created = store.setup(claims)
    client = TestClient(
        create_app(
            database_url=_TEST_SERVICE_DATABASE_URL,
            cursor_secret=b"test-cursor-secret-value-longer-than-32-bytes",
        )
    )
    headers = {
        "Authorization": "Bearer signed-test-token",
        GITHUB_CONTENTS_READ_TOKEN_HEADER: "github-actions-read-token-for-local-test",
    }
    reap_path = "/internal/k2-hosted-fixtures/k2-09/reap-expired"

    within_ttl = client.post(reap_path, headers=headers)
    assert within_ttl.status_code == 200
    assert within_ttl.json() == {
        "protocolVersion": "k2-09-bridge-fixture.v1",
        "processedCount": 0,
        "closedFixtureCount": 0,
        "purgedReceiptCount": 0,
    }
    assert pair_calls == []
    assert store.inspect(claims)["receiptState"] == "ACTIVE"

    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(
            """
            UPDATE private.k2_hosted_fixture_receipts
            SET created_at=clock_timestamp() - interval '3 hours'
            WHERE repository_id=%s AND run_id=%s
            """,
            (claims.repository_id, claims.run_id),
        )

    pair_state["unavailable"] = True
    unavailable = client.post(reap_path, headers=headers)
    assert unavailable.status_code == 503
    assert unavailable.json() == {
        "error": {
            "code": "K2_FIXTURE_UNAVAILABLE",
            "message": "K2-09 fixture control plane is temporarily unavailable.",
        }
    }
    assert store.inspect(claims)["receiptState"] == "ACTIVE"
    assert store.inspect(claims)["fixture"] == created["fixture"]
    pair_state["unavailable"] = False

    refused = client.post(reap_path, headers=headers)
    assert refused.status_code == 409
    assert refused.json() == {
        "error": {
            "code": "K2_FIXTURE_CONFLICT",
            "message": "K2-09 fixture state conflicts with this request.",
        }
    }
    assert store.inspect(claims)["receiptState"] == "ACTIVE"
    assert store.inspect(claims)["fixture"] == created["fixture"]

    pair_state["completed"] = True
    completed = client.post(reap_path, headers=headers)
    assert completed.status_code == 200
    assert completed.headers["cache-control"] == "no-store"
    assert completed.json() == {
        "protocolVersion": "k2-09-bridge-fixture.v1",
        "processedCount": 1,
        "closedFixtureCount": 1,
        "purgedReceiptCount": 0,
    }
    assert len(pair_calls) == 3
    assert pair_calls == [
        ("github-actions-read-token-for-local-test", claims.run_id, claims.run_attempt, claims.sha),
        ("github-actions-read-token-for-local-test", claims.run_id, claims.run_attempt, claims.sha),
        ("github-actions-read-token-for-local-test", claims.run_id, claims.run_attempt, claims.sha),
    ]
    assert current_master_calls == ["github-actions-read-token-for-local-test"] * 4
    closed = store.inspect(claims)
    assert closed["receiptState"] == "CLOSED"
    assert closed["fixture"] is None
    assert closed["counts"] == {
        "sourceRecords": 0,
        "concepts": 0,
        "lexemes": 0,
        "forms": 0,
        "senses": 0,
        "bridges": 0,
    }
