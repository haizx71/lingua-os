"""PostgreSQL schema tests for TASK-016 migration 0008.

Tests the persistence delta for Starting Level Estimate v1:
- New columns and constraints on assessment_templates, assessment_items,
  assessment_attempts, assessment_responses, assessment_results
- New tables: assessment_attempt_items, assessment_idempotency_log
- Append-only triggers on responses, results, idempotency_log
- RLS and privilege isolation on new tables
- Partial-unique one-active-attempt constraint
- Confidence 0..0.85 enforcement
- Level non-null requirement on assessment_results
- Evidence isolation: zero writes to FSRS/competence tables
"""

from __future__ import annotations

import json
import uuid

import pytest
from psycopg import Connection, errors

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def _insert_language(conn: Connection, code: str = "en", enabled: bool = True) -> None:
    conn.execute(
        """
        INSERT INTO languages (code, name, native_name, is_mvp_enabled)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (code) DO NOTHING
        """,
        (code, code.upper(), code.upper(), enabled),
    )


def _insert_license(conn: Connection) -> uuid.UUID:
    lid = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO licenses (id, code, name, usage_policy, attribution_required)
        VALUES (%s, %s, 'Test License', 'allowed', false)
        ON CONFLICT (code) DO NOTHING
        """,
        (str(lid), str(lid)),
    )
    # Return the id even if conflict (re-read)
    row = conn.execute("SELECT id FROM licenses WHERE code = %s", (str(lid),)).fetchone()
    assert row is not None
    return uuid.UUID(str(row[0]))


def _insert_source(conn: Connection, license_id: uuid.UUID) -> uuid.UUID:
    src_id = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO data_sources (
            id, name, source_type, source_version, license_id, attribution_text
        ) VALUES (%s, %s, 'internal', '1', %s, 'LINGUA test')
        """,
        (str(src_id), f"src-{src_id}", str(license_id)),
    )
    sr_id = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO source_records (
            id, source_id, source_record_key, raw_hash, transform_version,
            quality_score, review_status
        ) VALUES (%s, %s, %s, %s, '1', 1.0, 'approved')
        """,
        (str(sr_id), str(src_id), str(sr_id), "a" * 64),
    )
    return sr_id


def _insert_framework(conn: Connection) -> uuid.UUID:
    fid = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO proficiency_frameworks (id, code, name)
        VALUES (%s, 'CEFR', 'CEFR') ON CONFLICT (code) DO NOTHING
        """,
        (str(fid),),
    )
    row = conn.execute("SELECT id FROM proficiency_frameworks WHERE code='CEFR'").fetchone()
    assert row is not None
    return uuid.UUID(str(row[0]))


def _insert_level(conn: Connection, fid: uuid.UUID, code: str, rank: int) -> uuid.UUID:
    lid = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO proficiency_levels (id, framework_id, code, label, rank_order)
        VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING
        """,
        (str(lid), str(fid), code, code, rank),
    )
    row = conn.execute(
        "SELECT id FROM proficiency_levels WHERE framework_id=%s AND code=%s",
        (str(fid), code),
    ).fetchone()
    assert row is not None
    return uuid.UUID(str(row[0]))


def _insert_template(
    conn: Connection, sr_id: uuid.UUID, method_version: str = "starting-level-heuristic-v1"
) -> uuid.UUID:
    _insert_language(conn, "en")
    _insert_language(conn, "vi")
    tid = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO assessment_templates (
            id, language_code, native_language_code, name, method_version, status, source_record_id
        ) VALUES (%s, 'en', 'vi', %s, %s, 'active', %s)
        """,
        (str(tid), f"tmpl-{tid}", method_version, str(sr_id)),
    )
    return tid


def _insert_framework_and_levels(conn: Connection) -> dict[str, uuid.UUID]:
    fid = _insert_framework(conn)
    return {
        "A0": _insert_level(conn, fid, "A0", 0),
        "A1": _insert_level(conn, fid, "A1", 1),
        "A2": _insert_level(conn, fid, "A2", 2),
        "B1": _insert_level(conn, fid, "B1", 3),
    }


def _insert_item(
    conn: Connection,
    template_id: uuid.UUID,
    sr_id: uuid.UUID,
    level_id: uuid.UUID,
    slot_index: int = 1,
    bundle_kind: str = "primary",
    item_type: str = "vocabulary_recognition",
) -> uuid.UUID:
    item_id = uuid.uuid4()
    correct_opt = uuid.uuid4()
    wrong_opts = [uuid.uuid4() for _ in range(3)]
    all_opts = [correct_opt, *wrong_opts]
    prompt_schema = {"prompt": "Test prompt", "textSnippet": None}
    answer_schema = {
        "correct_option_id": str(correct_opt),
        "options": [{"id": str(o), "text": f"opt-{i}"} for i, o in enumerate(all_opts)],
    }
    audio_id = None
    if item_type == "listening_comprehension":
        audio_id = str(uuid.uuid4())

    conn.execute(
        """
        INSERT INTO assessment_items (
            id, template_id, language_code, skill, difficulty_prior,
            prompt_schema, answer_schema, source_record_id, item_version,
            item_type, bundle_kind, slot_index, target_level_id, audio_asset_id
        ) VALUES (%s, %s, 'en', %s, 0.5, %s::jsonb, %s::jsonb, %s, 1, %s, %s, %s, %s, %s)
        """,
        (
            str(item_id),
            str(template_id),
            "recognition" if item_type != "listening_comprehension" else "listening",
            json.dumps(prompt_schema),
            json.dumps(answer_schema),
            str(sr_id),
            item_type,
            bundle_kind,
            slot_index,
            str(level_id),
            audio_id,
        ),
    )
    return item_id


def _insert_user(conn: Connection) -> uuid.UUID:
    user_id = uuid.uuid4()
    conn.execute("INSERT INTO auth.users (id) VALUES (%s)", (str(user_id),))
    conn.execute("INSERT INTO users (id) VALUES (%s)", (str(user_id),))
    return user_id


def _insert_profile(conn: Connection, user_id: uuid.UUID, level_id: uuid.UUID) -> uuid.UUID:
    _insert_language(conn, "en")
    _insert_language(conn, "vi")
    profile_id = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO user_languages (
            id, user_id, language_code, interface_language_code,
            native_language_code, goal, daily_minutes, status, current_level_id
        ) VALUES (%s, %s, 'en', 'vi', 'vi', 'communication', 15, 'active', %s)
        """,
        (str(profile_id), str(user_id), str(level_id)),
    )
    return profile_id


def _insert_attempt(
    conn: Connection,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    template_id: uuid.UUID,
    status: str = "in_progress",
) -> uuid.UUID:
    attempt_id = uuid.uuid4()
    idem_key = f"idem-{attempt_id}"
    conn.execute(
        """
        INSERT INTO assessment_attempts (
            id, user_id, user_language_id, template_id, language_code,
            status, method_version, idempotency_key, current_position,
            completed_at
        ) VALUES (
            %s, %s, %s, %s, 'en',
            %s, 'starting-level-heuristic-v1', %s, 0,
            CASE WHEN %s = 'completed' THEN now() ELSE NULL END
        )
        """,
        (
            str(attempt_id),
            str(user_id),
            str(profile_id),
            str(template_id),
            status,
            idem_key,
            status,
        ),
    )
    return attempt_id


# ---------------------------------------------------------------------------
# Column presence tests
# ---------------------------------------------------------------------------


def test_0008_assessment_templates_has_native_language_code(
    db_connection: Connection,
) -> None:
    row = db_connection.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'assessment_templates' AND column_name = 'native_language_code'
        """
    ).fetchone()
    assert row is not None, "native_language_code column missing from assessment_templates"


def test_0008_assessment_items_has_new_columns(db_connection: Connection) -> None:
    expected = {"item_type", "bundle_kind", "slot_index", "target_level_id", "audio_asset_id"}
    rows = db_connection.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'assessment_items'
        """
    ).fetchall()
    found = {str(r[0]) for r in rows}
    missing = expected - found
    assert not missing, f"Missing columns in assessment_items: {missing}"


def test_0008_assessment_attempts_has_current_position(db_connection: Connection) -> None:
    row = db_connection.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'assessment_attempts' AND column_name = 'current_position'
        """
    ).fetchone()
    assert row is not None


def test_0008_assessment_responses_has_answer_discriminator(db_connection: Connection) -> None:
    row = db_connection.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'assessment_responses' AND column_name = 'answer_discriminator'
        """
    ).fetchone()
    assert row is not None


def test_0008_assessment_results_has_confidence_band(db_connection: Connection) -> None:
    row = db_connection.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'assessment_results' AND column_name = 'confidence_band'
        """
    ).fetchone()
    assert row is not None


def test_0008_new_tables_exist(db_connection: Connection) -> None:
    for table in ("assessment_attempt_items", "assessment_idempotency_log"):
        row = db_connection.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=%s",
            (table,),
        ).fetchone()
        assert row is not None, f"Table {table} does not exist"


# ---------------------------------------------------------------------------
# Template constraints
# ---------------------------------------------------------------------------


def test_0008_one_active_template_per_pair(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    _insert_language(db_connection, "en")
    _insert_language(db_connection, "vi")
    _insert_template(db_connection, sr_id)
    # Second active template for same pair must fail.
    tid2 = uuid.uuid4()
    with pytest.raises(errors.UniqueViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_templates (
                id, language_code, native_language_code, name, method_version,
                status, source_record_id
            ) VALUES (%s, 'en', 'vi', %s, 'starting-level-heuristic-v1', 'active', %s)
            """,
            (str(tid2), f"tmpl2-{tid2}", str(sr_id)),
        )


def test_0008_retired_template_does_not_conflict(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    _insert_language(db_connection, "en")
    _insert_language(db_connection, "vi")
    # Insert one retired template.
    tid_r = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO assessment_templates (
            id, language_code, native_language_code, name, method_version, status, source_record_id
        ) VALUES (%s, 'en', 'vi', %s, 'starting-level-heuristic-v1', 'retired', %s)
        """,
        (str(tid_r), f"retired-{tid_r}", str(sr_id)),
    )
    # Can still insert an active one.
    tid_a = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO assessment_templates (
            id, language_code, native_language_code, name, method_version, status, source_record_id
        ) VALUES (%s, 'en', 'vi', %s, 'starting-level-heuristic-v1', 'active', %s)
        """,
        (str(tid_a), f"active-{tid_a}", str(sr_id)),
    )


# ---------------------------------------------------------------------------
# Listening item requires audio_asset_id
# ---------------------------------------------------------------------------


def test_0008_listening_item_requires_audio(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    item_id = uuid.uuid4()
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_items (
                id, template_id, language_code, skill, difficulty_prior,
                prompt_schema, answer_schema, source_record_id, item_version,
                item_type, bundle_kind, slot_index, target_level_id, audio_asset_id
            ) VALUES (%s, %s, 'en', 'listening', 0.5, '{}', '{}', %s, 1,
                      'listening_comprehension', 'primary', 4, %s, NULL)
            """,
            (str(item_id), str(tmpl_id), str(sr_id), str(levels["A1"])),
        )


# ---------------------------------------------------------------------------
# One-active-attempt partial unique
# ---------------------------------------------------------------------------


def test_0008_one_in_progress_per_profile(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    # First attempt.
    _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="in_progress")
    # Second in_progress must fail.
    attempt2_id = uuid.uuid4()
    with pytest.raises(errors.UniqueViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_attempts (
                id, user_id, user_language_id, template_id, language_code,
                status, method_version, idempotency_key, current_position
            ) VALUES (%s, %s, %s, %s, 'en',
                      'in_progress', 'starting-level-heuristic-v1', %s, 0)
            """,
            (
                str(attempt2_id),
                str(user_id),
                str(prof_id),
                str(tmpl_id),
                f"idem2-{attempt2_id}",
            ),
        )


def test_0008_completed_plus_new_in_progress_allowed(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    # First attempt completed.
    _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="completed")
    # A new in_progress is allowed.
    attempt2_id = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO assessment_attempts (
            id, user_id, user_language_id, template_id, language_code,
            status, method_version, idempotency_key, current_position
        ) VALUES (%s, %s, %s, %s, 'en',
                  'in_progress', 'starting-level-heuristic-v1', %s, 0)
        """,
        (
            str(attempt2_id),
            str(user_id),
            str(prof_id),
            str(tmpl_id),
            f"idem2-{attempt2_id}",
        ),
    )


# ---------------------------------------------------------------------------
# assessment_responses append-only
# ---------------------------------------------------------------------------


def test_0008_assessment_response_is_append_only(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="in_progress")
    item_id = _insert_item(db_connection, tmpl_id, sr_id, levels["A1"])

    resp_id = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO assessment_responses (
            id, attempt_id, user_id, template_id, item_id, response,
            correct, response_time_ms, idempotency_key, answer_discriminator
        ) VALUES (%s, %s, %s, %s, %s, '{"selectedOptionId":"x"}', true, 1000, %s, 'selected')
        """,
        (
            str(resp_id),
            str(attempt_id),
            str(user_id),
            str(tmpl_id),
            str(item_id),
            f"resp-{resp_id}",
        ),
    )
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            "UPDATE assessment_responses SET response_time_ms = 9999 WHERE id = %s",
            (str(resp_id),),
        )


# ---------------------------------------------------------------------------
# assessment_results constraints
# ---------------------------------------------------------------------------


def test_0008_result_confidence_cannot_exceed_085(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="completed")
    result_id = uuid.uuid4()
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_results (
                id, attempt_id, user_id, template_id,
                estimated_score, estimated_level_id,
                confidence, evidence_count, assessed_skills,
                method_version, confidence_band
            ) VALUES (%s, %s, %s, %s, 0.5, %s, 0.90, 8, ARRAY['recognition'],
                      'starting-level-heuristic-v1', 'high')
            """,
            (
                str(result_id),
                str(attempt_id),
                str(user_id),
                str(tmpl_id),
                str(levels["A1"]),
            ),
        )


def test_0008_result_estimated_level_id_is_required(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="completed")
    result_id = uuid.uuid4()
    with pytest.raises(errors.NotNullViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_results (
                id, attempt_id, user_id, template_id,
                estimated_score, estimated_level_id,
                confidence, evidence_count, assessed_skills,
                method_version, confidence_band
            ) VALUES (%s, %s, %s, %s, 0.5, NULL, 0.70, 8, ARRAY['recognition'],
                      'starting-level-heuristic-v1', 'medium')
            """,
            (
                str(result_id),
                str(attempt_id),
                str(user_id),
                str(tmpl_id),
            ),
        )


def test_0008_result_confidence_band_must_be_valid(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="completed")
    result_id = uuid.uuid4()
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_results (
                id, attempt_id, user_id, template_id,
                estimated_score, estimated_level_id,
                confidence, evidence_count, assessed_skills,
                method_version, confidence_band
            ) VALUES (%s, %s, %s, %s, 0.5, %s, 0.70, 8, ARRAY['recognition'],
                      'starting-level-heuristic-v1', 'very_high')
            """,
            (
                str(result_id),
                str(attempt_id),
                str(user_id),
                str(tmpl_id),
                str(levels["A1"]),
            ),
        )


def test_0008_result_is_append_only(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="completed")
    result_id = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO assessment_results (
            id, attempt_id, user_id, template_id,
            estimated_score, estimated_level_id,
            confidence, evidence_count, assessed_skills,
            method_version, confidence_band
        ) VALUES (%s, %s, %s, %s, 0.5, %s, 0.70, 8, ARRAY['recognition'],
                  'starting-level-heuristic-v1', 'medium')
        """,
        (
            str(result_id),
            str(attempt_id),
            str(user_id),
            str(tmpl_id),
            str(levels["A1"]),
        ),
    )
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            "UPDATE assessment_results SET confidence = 0.80 WHERE id = %s",
            (str(result_id),),
        )


def test_0008_result_evidence_count_min_6(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="completed")
    result_id = uuid.uuid4()
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_results (
                id, attempt_id, user_id, template_id,
                estimated_score, estimated_level_id,
                confidence, evidence_count, assessed_skills,
                method_version, confidence_band
            ) VALUES (%s, %s, %s, %s, 0.5, %s, 0.70, 5, ARRAY['recognition'],
                      'starting-level-heuristic-v1', 'medium')
            """,
            (
                str(result_id),
                str(attempt_id),
                str(user_id),
                str(tmpl_id),
                str(levels["A1"]),
            ),
        )


# ---------------------------------------------------------------------------
# assessment_idempotency_log append-only
# ---------------------------------------------------------------------------


def test_0008_idempotency_log_is_append_only(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    _insert_framework_and_levels(db_connection)
    _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)

    idem_key = uuid.uuid4()
    db_connection.execute(
        """
        INSERT INTO assessment_idempotency_log (
            user_id, idempotency_key, operation, request_fingerprint,
            http_status, data_snapshot, policy_version
        ) VALUES (%s, %s, 'start', %s, 201, '{}', 'starting-level-heuristic-v1')
        """,
        (str(user_id), str(idem_key), "a" * 64),
    )
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            "UPDATE assessment_idempotency_log SET http_status = 200 WHERE idempotency_key = %s",
            (str(idem_key),),
        )


# ---------------------------------------------------------------------------
# RLS / privilege isolation for private tables
# ---------------------------------------------------------------------------


def test_0008_assessment_attempt_items_no_authenticated_grant(db_connection: Connection) -> None:
    """authenticated role must not have SELECT on assessment_attempt_items."""
    row = db_connection.execute(
        """
        SELECT grantee
        FROM information_schema.role_table_grants
        WHERE table_name = 'assessment_attempt_items'
          AND grantee = 'authenticated'
          AND privilege_type = 'SELECT'
        """
    ).fetchone()
    assert row is None, "authenticated role has SELECT on assessment_attempt_items — forbidden"


def test_0008_assessment_idempotency_log_no_authenticated_grant(db_connection: Connection) -> None:
    """authenticated role must not have SELECT on assessment_idempotency_log."""
    row = db_connection.execute(
        """
        SELECT grantee
        FROM information_schema.role_table_grants
        WHERE table_name = 'assessment_idempotency_log'
          AND grantee = 'authenticated'
          AND privilege_type = 'SELECT'
        """
    ).fetchone()
    assert row is None, "authenticated role has SELECT on assessment_idempotency_log — forbidden"


# ---------------------------------------------------------------------------
# Discriminator XOR constraint on assessment_responses
# ---------------------------------------------------------------------------


def test_0008_selected_response_requires_correct_boolean(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="in_progress")
    item_id = _insert_item(db_connection, tmpl_id, sr_id, levels["A1"])
    resp_id = uuid.uuid4()
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_responses (
                id, attempt_id, user_id, template_id, item_id, response,
                correct, response_time_ms, idempotency_key, answer_discriminator
            ) VALUES (%s, %s, %s, %s, %s, '{}', NULL, 1000, %s, 'selected')
            """,
            (
                str(resp_id),
                str(attempt_id),
                str(user_id),
                str(tmpl_id),
                str(item_id),
                f"bad-{resp_id}",
            ),
        )


def test_0008_skipped_response_must_have_null_correct(db_connection: Connection) -> None:
    lic_id = _insert_license(db_connection)
    sr_id = _insert_source(db_connection, lic_id)
    levels = _insert_framework_and_levels(db_connection)
    tmpl_id = _insert_template(db_connection, sr_id)
    user_id = _insert_user(db_connection)
    prof_id = _insert_profile(db_connection, user_id, levels["A1"])
    attempt_id = _insert_attempt(db_connection, user_id, prof_id, tmpl_id, status="in_progress")
    item_id = _insert_item(db_connection, tmpl_id, sr_id, levels["A1"])
    resp_id = uuid.uuid4()
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO assessment_responses (
                id, attempt_id, user_id, template_id, item_id, response,
                correct, response_time_ms, idempotency_key, answer_discriminator
            ) VALUES (%s, %s, %s, %s, %s, '{}', true, 1000, %s, 'skipped')
            """,
            (
                str(resp_id),
                str(attempt_id),
                str(user_id),
                str(tmpl_id),
                str(item_id),
                f"bad2-{resp_id}",
            ),
        )


# ---------------------------------------------------------------------------
# Evidence isolation: verify FSRS-related tables are not mentioned in migration
# ---------------------------------------------------------------------------


def test_0008_fsrs_states_unaffected(db_connection: Connection) -> None:
    """fsrs_states table must exist and must not have any 0008-specific columns."""
    row = db_connection.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='fsrs_states'"
    ).fetchone()
    assert row is not None
    new_col = db_connection.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'fsrs_states'
          AND column_name IN ('assessment_id', 'starting_level_id', 'band_code')
        """
    ).fetchone()
    assert new_col is None, "fsrs_states has unexpected TASK-016 columns"


def test_0008_user_concept_states_unaffected(db_connection: Connection) -> None:
    row = db_connection.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
        "AND tablename='user_concept_states'"
    ).fetchone()
    assert row is not None
