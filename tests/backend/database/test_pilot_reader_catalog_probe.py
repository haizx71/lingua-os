"""Real PostgreSQL coverage for the fixed Reader catalog acceptance probe.

This module always creates its own loopback PostgreSQL container. It deliberately
does not consult TEST_DATABASE_URL, which may point at a hosted database.
"""

from __future__ import annotations

import hashlib
import socket
import time
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient
from lingua_api.memory.domain import AuthenticatedActor

from tests.acceptance.support import k2_hosted_probe as probe
from tests.backend.database.conftest import _run_docker
from tests.backend.database.test_admin_content_api import (
    READER_SEED,
    AdminApi,
    TokenVerifier,
    _headers,
)

ROOT = Path(__file__).resolve().parents[3]
AUTH_BOOTSTRAP = Path(__file__).with_name("supabase_test_bootstrap.sql")
POSTGRES_IMAGE = "postgres:17.11-alpine3.24"


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
    raise RuntimeError("Local Reader probe PostgreSQL did not become ready")


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """Override the shared fixture so this test can never use a remote URL."""
    port = _free_loopback_port()
    container_name = f"lingua-reader-probe-{uuid.uuid4().hex[:12]}"
    password = f"local-{uuid.uuid4().hex}"
    result = _run_docker(
        "run", "--detach", "--rm", "--name", container_name,
        "--publish", f"127.0.0.1:{port}:5432",
        "--env", f"POSTGRES_PASSWORD={password}",
        "--env", "POSTGRES_DB=lingua_test", POSTGRES_IMAGE,
    )
    container_id = result.stdout.strip()
    database_url = f"postgresql://postgres:{password}@127.0.0.1:{port}/lingua_test"
    try:
        _wait_local_postgres(database_url)
        with psycopg.connect(database_url) as connection:
            connection.execute(AUTH_BOOTSTRAP.read_text(encoding="utf-8"))
        yield database_url
    finally:
        if container_id:
            _run_docker("rm", "--force", container_id, check=False)


@pytest.fixture
def admin_api(isolated_migrated_postgres_url: str) -> Iterator[AdminApi]:
    owner = AuthenticatedActor(uuid.uuid4())
    learner = AuthenticatedActor(uuid.uuid4())
    with psycopg.connect(isolated_migrated_postgres_url) as connection:
        connection.execute(READER_SEED.read_text(encoding="utf-8"))
        for actor in (owner, learner):
            connection.execute("INSERT INTO auth.users (id) VALUES (%s)", (actor.id,))
            connection.execute("INSERT INTO users (id) VALUES (%s)", (actor.id,))
            connection.execute(
                "INSERT INTO learner_profiles (user_id, time_zone) VALUES (%s, 'Etc/UTC')",
                (actor.id,),
            )
        connection.execute(
            """
            INSERT INTO user_languages
                (user_id, language_code, interface_language_code, native_language_code,
                 goal, current_level_id, daily_minutes)
            VALUES (%s, 'en', 'vi', 'vi', 'communication',
                    '00000000-0000-4000-8100-000000000001', 20)
            """,
            (owner.id,),
        )
        connection.commit()
    from lingua_api.main import create_app

    app = create_app(
        database_url=isolated_migrated_postgres_url,
        token_verifier=TokenVerifier(owner, learner),
        cursor_secret=b"pilot-reader-probe-local-db-cursor-secret",
        admin_user_ids=str(owner.id),
    )
    yield AdminApi(TestClient(app), isolated_migrated_postgres_url, owner)


def _candidate_files() -> tuple[dict[str, Any], dict[str, Any]]:
    manifest, candidate = probe._pilot_reader_manifest_files()
    if len(candidate["pairs"]) != 72:
        pytest.fail("Pinned Reader candidate pair manifest was invalid.")
    return manifest, candidate


def _ensure_sentence_annotations(database_url: str, body: str) -> None:
    """Add only local synthetic lexical rows needed to annotate each candidate sentence."""
    from lingua_api.reader.analyze_policy import candidate_lookup_tokens

    seed_record_id = uuid.UUID("21000000-0000-4000-8000-000000000001")
    sentences = probe._pilot_reader_manifest_files()[1]["pairs"]
    first_tokens: set[str] = set()
    for _, english, _ in sentences:
        tokens = candidate_lookup_tokens(english)
        if not tokens:
            pytest.fail("Pinned Reader candidate contained a sentence without lexical tokens.")
        first_tokens.add(tokens[0])
    if not sentences or " ".join(pair[1] for pair in sentences) != body:
        pytest.fail("Pinned Reader candidate body did not match its ordered sentences.")

    with psycopg.connect(database_url) as connection:
        for token in sorted(first_tokens):
            existing = connection.execute(
                """
                SELECT 1 FROM lexemes AS lexeme
                JOIN concepts AS concept ON concept.id = lexeme.concept_id
                WHERE lexeme.language_code = 'en'
                  AND lexeme.normalized_form = %s
                  AND concept.concept_type IN ('word', 'phrase')
                LIMIT 1
                """,
                (token,),
            ).fetchone()
            if existing is not None:
                continue
            concept_id = uuid.uuid4()
            lexeme_id = uuid.uuid4()
            connection.execute(
                """
                INSERT INTO concepts
                    (id, language_code, concept_type, canonical_key, source_record_id)
                VALUES (%s, 'en', 'word', %s, %s)
                """,
                (concept_id, f"pilot-reader-test-{concept_id.hex}", seed_record_id),
            )
            connection.execute(
                """
                INSERT INTO lexemes
                    (id, concept_id, language_code, lemma, normalized_form,
                     part_of_speech, source_record_id)
                VALUES (%s, %s, 'en', %s, %s, 'noun', %s)
                """,
                (lexeme_id, concept_id, token, token, seed_record_id),
            )
        connection.commit()


def _create_candidate(api: AdminApi, manifest: dict[str, Any], candidate: dict[str, Any]) -> str:
    content_source = manifest["content"]
    created = api.client.post(
        "/v1/admin/content",
        headers=_headers(),
        json={
            "title": content_source["title"],
            "body": candidate["body"],
            "languageCode": content_source["languageCode"],
            "level": content_source["level"],
            "authorName": content_source["authorName"],
            "sourceName": content_source["sourceName"],
            "sourceVersion": content_source["sourceVersion"],
            "attributionText": content_source["attributionText"],
            "rightsStatement": content_source["rightsStatement"],
        },
    )
    if created.status_code != 201:
        pytest.fail("Normal Owner Admin content creation failed in local PostgreSQL test.")
    content_id = created.json()["data"]["id"]
    return str(content_id)


def _put_translations(
    api: AdminApi,
    content_id: str,
    manifest: dict[str, Any],
    candidate: dict[str, Any],
    *,
    foreign_source: bool = False,
    foreign_text: bool = False,
) -> None:
    source = dict(manifest["translationSource"])
    if foreign_source:
        source["sourceName"] = "Different local first-party source"
    pairs = candidate["pairs"]
    entries = [
        {
            "ordinal": ordinal,
            "sourceText": english,
            "translationText": (
                f"Dịch thử {ordinal}" if foreign_text else vietnamese
            ),
        }
        for ordinal, english, vietnamese in pairs
    ]
    response = api.client.put(
        f"/v1/admin/content/{content_id}/translations/vi",
        headers=_headers(),
        json={"entries": entries, "source": source},
    )
    if response.status_code != 200:
        pytest.fail("Normal Owner Admin Vietnamese translation write failed locally.")


def _validate_and_publish(api: AdminApi, content_id: str) -> None:
    validation = api.client.post(f"/v1/admin/content/{content_id}/validate", headers=_headers())
    if validation.status_code != 200 or validation.json()["data"]["isValid"] is not True:
        pytest.fail("Normal Owner Admin validation did not approve the synthetic Reader candidate.")
    published = api.client.post(f"/v1/admin/content/{content_id}/publish", headers=_headers())
    if published.status_code != 200 or published.json()["data"]["status"] != "published":
        pytest.fail("Normal Owner Admin publication failed in local PostgreSQL test.")


def _actor_reader_target(
    database_url: str, actor_id: uuid.UUID, content_id: str
) -> tuple[
    uuid.UUID,
    uuid.UUID,
    list[uuid.UUID],
    tuple[uuid.UUID, uuid.UUID, uuid.UUID, int, int],
]:
    with psycopg.connect(database_url) as connection:
        profile_row = connection.execute(
            """SELECT id FROM public.user_languages
               WHERE user_id = %s AND language_code = 'en' AND status = 'active'""",
            (actor_id,),
        ).fetchone()
        final_segment_row = connection.execute(
            """SELECT id FROM public.content_segments
               WHERE content_id = %s AND order_index = 71""",
            (content_id,),
        ).fetchone()
        if profile_row is None or final_segment_row is None:
            pytest.fail("Local Reader profile or pinned final segment was unavailable.")
        profile_id = uuid.UUID(str(profile_row[0]))
        final_segment_id = uuid.UUID(str(final_segment_row[0]))
        eligible_rows = connection.execute(
            """SELECT DISTINCT occurrence.concept_id
               FROM public.content_segments AS target
               JOIN public.sentence_concepts AS occurrence
                 ON occurrence.sentence_id = target.sentence_id
                AND occurrence.language_code = 'en'
               WHERE target.id = %s AND target.content_id = %s
               ORDER BY occurrence.concept_id""",
            (final_segment_id, content_id),
        ).fetchall()
        eligible_ids = [uuid.UUID(str(row[0])) for row in eligible_rows]
        lookup_row = connection.execute(
            """SELECT target.id, target.sentence_id, occurrence.concept_id,
                      occurrence.start_offset, occurrence.end_offset
               FROM public.content_segments AS target
               JOIN public.sentence_concepts AS occurrence
                 ON occurrence.sentence_id = target.sentence_id
                AND occurrence.language_code = 'en'
               WHERE target.content_id = %s AND target.order_index < 71
                 AND NOT (occurrence.concept_id = ANY(%s))
               ORDER BY target.order_index, occurrence.concept_id
               LIMIT 1""",
            (content_id, eligible_ids),
        ).fetchone()
        if not eligible_ids or lookup_row is None:
            pytest.fail("Local Reader candidate lacked a distinct passive lookup sample.")
        lookup = (
            uuid.UUID(str(lookup_row[0])),
            uuid.UUID(str(lookup_row[1])),
            uuid.UUID(str(lookup_row[2])),
            int(lookup_row[3]),
            int(lookup_row[4]),
        )
    return profile_id, final_segment_id, eligible_ids, lookup


def _reader_completion_binding(
    content_id: str,
    segment_id: uuid.UUID,
    *,
    exposure_id: uuid.UUID | None = None,
    projection_head_before: dict[str, int] | None = None,
) -> dict[str, Any]:
    binding: dict[str, Any] = {
        "phase": "before" if exposure_id is None else "after",
        "contentId": content_id,
        "segmentId": str(segment_id),
    }
    if exposure_id is not None:
        binding["exposureId"] = str(exposure_id)
    if projection_head_before is not None:
        binding["projectionHeadBefore"] = projection_head_before
    return binding


def _reader_completion_proof(
    database_url: str,
    *,
    actor_id: uuid.UUID,
    profile_id: uuid.UUID,
    content_id: str,
    segment_id: uuid.UUID,
    concept_ids: list[uuid.UUID],
    exposure_id: uuid.UUID | None = None,
    projection_head_before: dict[str, int] | None = None,
    idempotency_key_sha256: str | None = None,
    connection: psycopg.Connection[tuple[Any, ...]] | None = None,
) -> dict[str, Any]:
    binding = _reader_completion_binding(
        content_id, segment_id, exposure_id=exposure_id,
        projection_head_before=projection_head_before,
    )
    if connection is not None:
        return probe._pilot_reader_completion(
            connection,
            actor_id=actor_id,
            profile_id=profile_id,
            concept_ids=concept_ids,
            binding=binding,
            idempotency_key_sha256=idempotency_key_sha256,
        )
    with psycopg.connect(database_url) as local_connection:
        return probe._pilot_reader_completion(
            local_connection,
            actor_id=actor_id,
            profile_id=profile_id,
            concept_ids=concept_ids,
            binding=binding,
            idempotency_key_sha256=idempotency_key_sha256,
        )


def _assert_reader_completion_stable_rows_unchanged(
    before: dict[str, Any], after: dict[str, Any]
) -> None:
    expected_tables = set(probe.PILOT_READER_STABLE_TABLES)
    if (
        set(before.get("stableRows", {})) != expected_tables
        or set(after.get("stableRows", {})) != expected_tables
    ):
        raise AssertionError(
            "Reader completion stable-row proof did not cover its exact table set."
        )
    for table_name in probe.PILOT_READER_STABLE_TABLES:
        before_row = before["stableRows"][table_name]
        after_row = after["stableRows"][table_name]
        if before_row["rows"] != after_row["rows"] or before_row["sha256"] != after_row["sha256"]:
            raise AssertionError("Reader completion changed a retained actor row.")
    if (
        before["projectionHead"]["immutableSha256"]
        != after["projectionHead"]["immutableSha256"]
    ):
        raise AssertionError("Reader completion changed immutable projection-head fields.")


def _local_actor_snapshot(
    database_url: str, actor_id: uuid.UUID
) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        return probe._snapshot(connection, actor_id)


def _assert_reader_completion_delta(
    before: dict[str, Any], after: dict[str, Any], concept_count: int
) -> None:
    if set(before["tables"]) != set(probe.EXPECTED_LEARNER_TABLES):
        pytest.fail("Local Reader delta snapshot did not cover all 27 learner tables.")
    count_deltas = {
        name: after["tables"][name]["rows"] - before["tables"][name]["rows"]
        for name in probe.EXPECTED_LEARNER_TABLES
        if after["tables"][name]["rows"] != before["tables"][name]["rows"]
    }
    expected_count_deltas = {
        "exposure_events": 1,
        "learning_events": concept_count,
        "reader_exposure_concepts": concept_count,
        "user_concept_states": concept_count,
    }
    if count_deltas != expected_count_deltas:
        pytest.fail("Local Reader completion changed an unexpected learner-table row count.")
    changed_digests = {
        name for name in probe.EXPECTED_LEARNER_TABLES
        if after["tables"][name]["sha256"] != before["tables"][name]["sha256"]
    }
    if changed_digests != set(expected_count_deltas) | {"user_language_projection_heads"}:
        pytest.fail("Local Reader completion changed an unexpected learner-table digest.")


def _run_probe(database_url: str) -> dict[str, Any]:
    # The real probe SQL is exercised against migrated PostgreSQL. Its separate
    # hosted privilege inventory has its own unit tests and is outside this
    # catalog/provenance integration test's scope.
    original_inventory = probe._table_inventory
    probe._table_inventory = lambda _connection: tuple(
        sorted(set(probe.EXPECTED_LEARNER_TABLES) | set(probe.EXPECTED_CATALOG_TABLES))
    )
    try:
        with psycopg.connect(database_url) as connection:
            return probe._pilot_reader_catalog_manifest(connection)
    finally:
        probe._table_inventory = original_inventory


def _expect_probe_rejection(database_url: str) -> None:
    try:
        _run_probe(database_url)
    except probe.ProbeError:
        return
    pytest.fail("Reader catalog probe accepted a candidate with invalid publication state.")


@pytest.mark.parametrize("case", ["exact", "normalized", "missing_vi", "foreign_vi", "duplicate"])
def test_catalog_probe_resolves_only_exact_normally_published_candidate(
    admin_api: AdminApi, case: str
) -> None:
    manifest, candidate = _candidate_files()
    _ensure_sentence_annotations(admin_api.database_url, candidate["body"])

    content_id = _create_candidate(admin_api, manifest, candidate)
    if case not in {"normalized", "missing_vi"}:
        _put_translations(
            admin_api, content_id, manifest, candidate,
            foreign_source=case == "foreign_vi",
        )
    if case != "normalized":
        _validate_and_publish(admin_api, content_id)

    if case == "duplicate":
        second_id = _create_candidate(admin_api, manifest, candidate)
        _put_translations(admin_api, second_id, manifest, candidate)
        _validate_and_publish(admin_api, second_id)

    if case == "exact":
        proof = _run_probe(admin_api.database_url)
        if (
            proof.get("contentCount") != 1
            or proof.get("segmentCount") != 72
            or proof.get("sentenceCount") != 72
            or proof.get("translationCount") != 72
            or proof.get("candidateSha256") != probe.PILOT_READER_CANDIDATE_SHA256
            or proof.get("bodySha256") != probe.PILOT_READER_BODY_SHA256
            or proof.get("contentProvenance", {}).get("approved") is not True
            or proof.get("translationProvenance", {}).get("approved") is not True
        ):
            pytest.fail(
                "Reader catalog probe did not resolve the exact published 72-pair candidate."
            )
        return

    _expect_probe_rejection(admin_api.database_url)


def test_reader_completion_probe_reconciles_real_postgres_passive_effects(
    admin_api: AdminApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Exercise the completion proof against real Reader writes in disposable PostgreSQL."""
    monkeypatch.setattr(
        probe,
        "_table_inventory",
        lambda _connection: tuple(sorted(probe.EXPECTED_LEARNER_TABLES)),
    )
    manifest, candidate = _candidate_files()
    _ensure_sentence_annotations(admin_api.database_url, candidate["body"])
    content_id = _create_candidate(admin_api, manifest, candidate)
    _put_translations(admin_api, content_id, manifest, candidate)
    _validate_and_publish(admin_api, content_id)

    actor_id = admin_api.owner.id
    profile_id, final_segment_id, final_concept_ids, lookup = _actor_reader_target(
        admin_api.database_url, actor_id, content_id
    )
    lookup_segment_id, lookup_sentence_id, lookup_concept_id, start_offset, end_offset = lookup
    lookup_key = uuid.uuid4()
    lookup_response = admin_api.client.post(
        "/v1/reader/exposures",
        headers={**_headers(), "Idempotency-Key": str(lookup_key)},
        json={
            "languageProfileId": str(profile_id),
            "contentId": content_id,
            "segmentId": str(lookup_segment_id),
            "sentenceId": str(lookup_sentence_id),
            "startOffset": start_offset,
            "endOffset": end_offset,
            "exposureType": "lookup",
        },
    )
    if (
        lookup_response.status_code != 200
        or lookup_response.json()["data"]["acceptedConceptCount"] != 1
    ):
        pytest.fail("Normal local Reader lookup did not resolve one authoritative concept.")
    lookup_exposure_id = uuid.UUID(str(lookup_response.json()["data"]["exposureId"]))
    if lookup_concept_id in final_concept_ids:
        pytest.fail("Local Reader lookup sample overlapped the final-segment concept set.")

    before_proof = _reader_completion_proof(
        admin_api.database_url,
        actor_id=actor_id,
        profile_id=profile_id,
        content_id=content_id,
        segment_id=final_segment_id,
        concept_ids=final_concept_ids,
    )
    if before_proof["phase"] != "before" or before_proof["skillStateCount"] != 3:
        pytest.fail("Local Reader before-proof did not accept the exact neutral bootstrap.")

    with psycopg.connect(admin_api.database_url) as connection:
        alternate_parameter_id = uuid.uuid4()
        connection.execute(
            """INSERT INTO public.competence_parameter_sets
                   (id, version, method_version, parameters, is_default)
               SELECT %s, version, method_version, parameters, false
               FROM public.competence_parameter_sets
               WHERE is_default""",
            (alternate_parameter_id,),
        )
        connection.execute(
            """UPDATE public.user_language_projection_heads
               SET parameter_set_id = %s
               WHERE user_id = %s AND user_language_id = %s""",
            (alternate_parameter_id, actor_id, profile_id),
        )
        connection.execute(
            """UPDATE public.user_skill_states
               SET competence_parameter_set_id = %s
               WHERE user_id = %s AND user_language_id = %s""",
            (alternate_parameter_id, actor_id, profile_id),
        )
        tampered_head_proof = _reader_completion_proof(
            admin_api.database_url,
            actor_id=actor_id,
            profile_id=profile_id,
            content_id=content_id,
            segment_id=final_segment_id,
            concept_ids=final_concept_ids,
            connection=connection,
        )
        if (
            tampered_head_proof["projectionHead"]["immutableSha256"]
            == before_proof["projectionHead"]["immutableSha256"]
        ):
            pytest.fail(
                "Local projection parameter-set tamper did not change the immutable-head proof."
            )
        connection.rollback()

    before_snapshot = _local_actor_snapshot(admin_api.database_url, actor_id)
    if before_snapshot["tables"]["user_content_progress"]["rows"] != 0:
        pytest.fail("Local Reader completion test unexpectedly started with content progress.")

    exposure_key = uuid.uuid4()
    read_response = admin_api.client.post(
        "/v1/reader/exposures",
        headers={**_headers(), "Idempotency-Key": str(exposure_key)},
        json={
            "languageProfileId": str(profile_id),
            "contentId": content_id,
            "segmentId": str(final_segment_id),
            "exposureType": "read",
        },
    )
    if read_response.status_code != 200:
        pytest.fail("Normal local Reader final-segment read failed.")
    read_data = read_response.json()["data"]
    exposure_id = uuid.UUID(str(read_data["exposureId"]))
    if read_data["acceptedConceptCount"] != len(final_concept_ids):
        pytest.fail("Local Reader response count did not equal its exact eligible concept set.")

    head_before = {
        "stateVersion": before_proof["projectionHead"]["stateVersion"],
        "nextIngestionSequence": before_proof["projectionHead"]["nextIngestionSequence"],
    }
    key_hash = hashlib.sha256(str(exposure_key).encode("ascii")).hexdigest()
    after_proof = _reader_completion_proof(
        admin_api.database_url,
        actor_id=actor_id,
        profile_id=profile_id,
        content_id=content_id,
        segment_id=final_segment_id,
        concept_ids=final_concept_ids,
        exposure_id=exposure_id,
        projection_head_before=head_before,
        idempotency_key_sha256=key_hash,
    )
    if (
        after_proof["eligibleConceptIds"] != [str(value) for value in sorted(final_concept_ids)]
        or after_proof["exposureEventIds"] != [str(exposure_id)]
        or after_proof["linkedConceptIds"] != [str(value) for value in sorted(final_concept_ids)]
        or after_proof["learningConceptIds"] != [str(value) for value in sorted(final_concept_ids)]
        or len(after_proof["conceptStates"]) != len(final_concept_ids)
        or any(state["passiveOnly"] is not True for state in after_proof["conceptStates"])
        or after_proof["projectionHead"]["stateVersion"]
        != head_before["stateVersion"] + len(final_concept_ids)
        or after_proof["projectionHead"]["nextIngestionSequence"]
        != head_before["nextIngestionSequence"] + len(final_concept_ids)
        or after_proof["projectionHead"]["parameterVersion"]
        != before_proof["projectionHead"]["parameterVersion"]
    ):
        pytest.fail("Local Reader passive proof did not reconcile every final-segment concept.")
    _assert_reader_completion_stable_rows_unchanged(before_proof, after_proof)
    if before_proof["projectionHead"]["updatedAtMatchesCompletion"] is not None or not after_proof[
        "projectionHead"
    ]["updatedAtMatchesCompletion"]:
        pytest.fail("Local Reader projection-head timestamp did not match the completion event.")
    after_snapshot = _local_actor_snapshot(admin_api.database_url, actor_id)
    _assert_reader_completion_delta(before_snapshot, after_snapshot, len(final_concept_ids))

    replay_response = admin_api.client.post(
        "/v1/reader/exposures",
        headers={**_headers(), "Idempotency-Key": str(exposure_key)},
        json={
            "languageProfileId": str(profile_id),
            "contentId": content_id,
            "segmentId": str(final_segment_id),
            "exposureType": "read",
        },
    )
    if replay_response.status_code != 200 or replay_response.json()["data"] != read_data:
        pytest.fail("Local Reader exact-key exposure replay did not return its original result.")
    if _local_actor_snapshot(admin_api.database_url, actor_id) != after_snapshot:
        pytest.fail("Local Reader exact-key replay changed the 27-table actor snapshot.")

    proof_args = {
        "actor_id": actor_id,
        "profile_id": profile_id,
        "content_id": content_id,
        "segment_id": final_segment_id,
        "concept_ids": final_concept_ids,
        "exposure_id": exposure_id,
        "projection_head_before": head_before,
        "idempotency_key_sha256": key_hash,
    }
    with psycopg.connect(admin_api.database_url) as connection:
        connection.execute(
            """UPDATE public.user_concept_states SET recognition = 0.7
               WHERE user_id = %s AND user_language_id = %s AND concept_id = %s""",
            (actor_id, profile_id, lookup_concept_id),
        )
        mutated_proof = _reader_completion_proof(
            admin_api.database_url, **proof_args, connection=connection
        )
        with pytest.raises(AssertionError, match="retained actor row"):
            _assert_reader_completion_stable_rows_unchanged(before_proof, mutated_proof)
        connection.rollback()

    with psycopg.connect(admin_api.database_url) as connection:
        with pytest.raises(psycopg.errors.CheckViolation, match="append-only"):
            connection.execute(
                """UPDATE public.exposure_events
                   SET evidence = evidence || '{"passiveAuditMutation":true}'::jsonb
                   WHERE id = %s AND user_id = %s""",
                (lookup_exposure_id, actor_id),
            )
        connection.rollback()

    with psycopg.connect(admin_api.database_url) as connection:
        with pytest.raises(psycopg.errors.CheckViolation, match="append-only"):
            connection.execute(
                """UPDATE public.learning_events
                   SET payload = payload || '{"passiveAuditMutation":true}'::jsonb
                   WHERE user_id = %s AND source_type = 'exposure_event'
                     AND source_event_id = %s""",
                (actor_id, lookup_exposure_id),
            )
        connection.rollback()

    with psycopg.connect(admin_api.database_url) as connection:
        with pytest.raises(psycopg.errors.CheckViolation, match="append-only"):
            connection.execute(
                """UPDATE public.reader_exposure_concepts
                   SET derivation_key = derivation_key || ':passive-audit-mutation'
                   WHERE exposure_event_id = %s AND user_id = %s AND concept_id = %s""",
                (lookup_exposure_id, actor_id, lookup_concept_id),
            )
        connection.rollback()

    with psycopg.connect(admin_api.database_url) as connection:
        foreign_link = connection.execute(
            """INSERT INTO public.reader_exposure_concepts
               (exposure_event_id, user_id, user_language_id, language_code,
                concept_id, derivation_key, created_at)
               SELECT exposure_event_id, user_id, user_language_id, language_code,
                      %s, %s, now()
               FROM public.reader_exposure_concepts
               WHERE exposure_event_id = %s
               LIMIT 1""",
            (lookup_concept_id, f"concept:{lookup_concept_id}", exposure_id),
        )
        if foreign_link.rowcount != 1:
            pytest.fail("Local foreign-link negative setup did not insert exactly one row.")
        with pytest.raises(probe.ProbeError):
            _reader_completion_proof(
                admin_api.database_url, **proof_args, connection=connection
            )
        connection.rollback()

    with psycopg.connect(admin_api.database_url) as connection:
        connection.execute(
            """UPDATE public.user_concept_states SET recognition = 0.7
               WHERE user_id = %s AND user_language_id = %s AND concept_id = %s""",
            (actor_id, profile_id, final_concept_ids[0]),
        )
        with pytest.raises(probe.ProbeError):
            _reader_completion_proof(
                admin_api.database_url, **proof_args, connection=connection
            )
        connection.rollback()

    duplicate_key = uuid.uuid4()
    duplicate_response = admin_api.client.post(
        "/v1/reader/exposures",
        headers={**_headers(), "Idempotency-Key": str(duplicate_key)},
        json={
            "languageProfileId": str(profile_id),
            "contentId": content_id,
            "segmentId": str(final_segment_id),
            "exposureType": "read",
        },
    )
    if duplicate_response.status_code != 200:
        pytest.fail("Local Reader second-key exposure control did not reach the cardinality gate.")
    with pytest.raises(probe.ProbeError):
        _reader_completion_proof(
            admin_api.database_url, **proof_args
        )
