from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg import Connection, errors, sql
from psycopg.conninfo import make_conninfo

from database.migrate import MigrationChecksumError, migrate_down, migrate_up

EXPECTED_TABLES = {
    "assessment_attempts",
    "assessment_item_concepts",
    "assessment_items",
    "assessment_responses",
    "assessment_results",
    "competence_parameter_sets",
    "concept_competence_policies",
    "concept_save_intents",
    "exposure_events",
    "assessment_templates",
    "concept_relations",
    "concept_topics",
    "concepts",
    "content_concepts",
    "content_items",
    "content_metrics",
    "content_segments",
    "content_versions",
    "data_sources",
    "framework_mappings",
    "fsrs_parameter_sets",
    "fsrs_states",
    "languages",
    "learner_profiles",
    "learning_events",
    "lexeme_forms",
    "lexemes",
    "licenses",
    "proficiency_frameworks",
    "proficiency_levels",
    "profile_mutation_results",
    "reader_exposure_concepts",
    "reader_mutation_results",
    "review_events",
    "review_items",
    "sentence_concepts",
    "sentence_translations",
    "sentences",
    "source_records",
    "today_plan_activities",
    "today_activity_review_items",
    "today_plans",
    "topics",
    "user_concept_states",
    "user_content_progress",
    "user_languages",
    "user_language_projection_heads",
    "user_saved_concepts",
    "user_saved_content",
    "user_saved_sentences",
    "user_skill_states",
    "users",
    "word_senses",
}

USER_OWNED_TABLES = {
    "assessment_attempts",
    "assessment_responses",
    "assessment_results",
    "concept_save_intents",
    "exposure_events",
    "fsrs_states",
    "learner_profiles",
    "learning_events",
    "reader_exposure_concepts",
    "reader_mutation_results",
    "profile_mutation_results",
    "review_events",
    "review_items",
    "today_plan_activities",
    "today_activity_review_items",
    "today_plans",
    "user_concept_states",
    "user_content_progress",
    "user_languages",
    "user_language_projection_heads",
    "user_saved_concepts",
    "user_saved_content",
    "user_saved_sentences",
    "user_skill_states",
    "users",
}


def _seed_user(
    connection: Connection[tuple[object, ...]], user_id: uuid.UUID | None = None
) -> tuple[uuid.UUID, uuid.UUID]:
    actual_user_id = user_id or uuid.uuid4()
    connection.execute(
        "INSERT INTO auth.users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING",
        (actual_user_id,),
    )
    connection.execute("INSERT INTO users (id) VALUES (%s)", (actual_user_id,))
    language_id = connection.execute(
        """
        INSERT INTO user_languages
            (user_id, language_code, interface_language_code, native_language_code,
             goal, daily_minutes)
        VALUES (%s, 'en', 'vi', 'vi', 'communication', 20)
        RETURNING id
        """,
        (actual_user_id,),
    ).fetchone()
    assert language_id is not None
    return actual_user_id, language_id[0]  # type: ignore[return-value]


def _seed_source(connection: Connection[tuple[object, ...]]) -> uuid.UUID:
    license_id = connection.execute(
        """
        INSERT INTO licenses (code, name, usage_policy, attribution_required)
        VALUES (%s, 'Test permissive license', 'allowed', true)
        RETURNING id
        """,
        (f"test-license-{uuid.uuid4()}",),
    ).fetchone()
    assert license_id is not None
    source_id = connection.execute(
        """
        INSERT INTO data_sources (name, source_type, source_version, license_id,
                                  attribution_text)
        VALUES (%s, 'internal', '1', %s, 'LINGUA OS test fixture')
        RETURNING id
        """,
        (f"test-source-{uuid.uuid4()}", license_id[0]),
    ).fetchone()
    assert source_id is not None
    record_id = connection.execute(
        """
        INSERT INTO source_records (source_id, source_record_key, raw_hash,
                                    transform_version, quality_score, review_status)
        VALUES (%s, %s, %s, 'test-v1', 1, 'approved')
        RETURNING id
        """,
        (source_id[0], str(uuid.uuid4()), "a" * 64),
    ).fetchone()
    assert record_id is not None
    return record_id[0]  # type: ignore[return-value]


def _seed_concept(
    connection: Connection[tuple[object, ...]], source_record_id: uuid.UUID
) -> uuid.UUID:
    row = connection.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('en', 'word', %s, %s)
        RETURNING id
        """,
        (f"test-{uuid.uuid4()}", source_record_id),
    ).fetchone()
    assert row is not None
    return row[0]  # type: ignore[return-value]


def test_empty_database_migration_is_reproducible_and_reversible(
    postgres_url: str, tmp_path: Path
) -> None:
    migrations_dir = Path(__file__).resolve().parents[3] / "database" / "migrations"
    database_name = f"lingua_migration_{uuid.uuid4().hex}"
    admin_url = make_conninfo(postgres_url, dbname="postgres")
    isolated_url = make_conninfo(postgres_url, dbname=database_name)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    try:
        with psycopg.connect(isolated_url) as connection:
            connection.execute(
                Path(__file__).with_name("supabase_test_bootstrap.sql").read_text(encoding="utf-8")
            )
        assert migrate_down(isolated_url, migrations_dir, steps=100) == []
        first_apply = migrate_up(isolated_url, migrations_dir)
        assert first_apply == [
            "0001",
            "0002",
            "0003",
            "0004",
            "0005",
            "0006",
            "0007",
            "0008",
            "0009",
            "0010",
            "0011",
            "0012",
            "0013",
            "0014",
            "0015",
            "0016",
            "0017",
            "0018",
            "0019",
        ]
        assert migrate_up(isolated_url, migrations_dir) == []

        assert migrate_down(isolated_url, migrations_dir, steps=10) == [
            "0019",
            "0018",
            "0017",
            "0016",
            "0015",
            "0014",
            "0013",
            "0012",
            "0011",
            "0010",
        ]
        assert migrate_up(isolated_url, migrations_dir) == [
            "0010",
            "0011",
            "0012",
            "0013",
            "0014",
            "0015",
            "0016",
            "0017",
            "0018",
            "0019",
        ]

        copied_migrations = tmp_path / "migrations"
        shutil.copytree(migrations_dir, copied_migrations)
        up_file = next(copied_migrations.glob("0001_*.up.sql"))
        up_file.write_text(up_file.read_text(encoding="utf-8") + "\n-- changed\n", encoding="utf-8")
        with pytest.raises(MigrationChecksumError):
            migrate_up(isolated_url, copied_migrations)
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name))
            )


def test_schema_contains_required_tables_rls_and_timestamptz(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    tables = {
        row[0]
        for row in db_connection.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
    }
    assert tables >= EXPECTED_TABLES

    rls_tables = {
        row[0]
        for row in db_connection.execute(
            """
            SELECT relname
            FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
            """
        ).fetchall()
    }
    assert rls_tables >= USER_OWNED_TABLES

    policy_rows = db_connection.execute(
        """
        SELECT tablename, roles, cmd, qual
        FROM pg_policies
        WHERE schemaname = 'public' AND policyname LIKE '%_select_own'
        """
    ).fetchall()
    policy_tables = {row[0] for row in policy_rows}
    assert policy_tables == USER_OWNED_TABLES
    for _, roles, command, expression in policy_rows:
        assert isinstance(roles, list)
        assert "authenticated" in roles
        assert command == "SELECT"
        assert isinstance(expression, str)
        assert "auth.uid()" in expression

    privilege_rows = db_connection.execute(
        """
        SELECT relname,
               has_table_privilege('authenticated', oid, 'SELECT'),
               has_table_privilege('anon', oid, 'SELECT')
        FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname = ANY(%s)
        """,
        (list(USER_OWNED_TABLES),),
    ).fetchall()
    assert {row[0] for row in privilege_rows} == USER_OWNED_TABLES
    assert all(row[1] is False and row[2] is False for row in privilege_rows)

    timestamp_types = db_connection.execute(
        """
        SELECT DISTINCT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name IN
              ('created_at', 'updated_at', 'occurred_at', 'reviewed_at', 'due_at')
        """
    ).fetchall()
    assert timestamp_types == [("timestamp with time zone",)]


def test_invalid_domain_values_are_rejected(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, language_id = _seed_user(db_connection)
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO user_skill_states
                (user_id, user_language_id, skill, score, confidence,
                 evidence_count, method_version)
            VALUES (%s, %s, 'recognition', 1.1, 0.5, 1, 'test-v1')
            """,
            (user_id, language_id),
        )
    db_connection.rollback()

    source_record_id = _seed_source(db_connection)
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            "INSERT INTO content_items "
            "(language_code, content_type, title, publication_status, source_record_id) "
            "VALUES ('en', 'story', 'Invalid', 'not-a-status', %s)",
            (source_record_id,),
        )


def test_duplicate_primary_memory_lineage_is_rejected(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, language_id = _seed_user(db_connection)
    source_record_id = _seed_source(db_connection)
    concept_id = _seed_concept(db_connection, source_record_id)
    db_connection.execute(
        """
        INSERT INTO review_items (user_id, user_language_id, concept_id, status, created_from)
        VALUES (%s, %s, %s, 'active', 'learner_saved')
        """,
        (user_id, language_id, concept_id),
    )
    with pytest.raises(errors.UniqueViolation):
        db_connection.execute(
            """
            INSERT INTO review_items
                (user_id, user_language_id, concept_id, status, created_from)
            VALUES (%s, %s, %s, 'suspended', 'evidence_threshold')
            """,
            (user_id, language_id, concept_id),
        )


def test_referential_integrity_and_owner_boundary_are_enforced(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    with pytest.raises(errors.ForeignKeyViolation):
        db_connection.execute("INSERT INTO users (id) VALUES (%s)", (uuid.uuid4(),))
    db_connection.rollback()

    first_user, first_language = _seed_user(db_connection)
    second_user, _ = _seed_user(db_connection)
    source_record_id = _seed_source(db_connection)
    concept_id = _seed_concept(db_connection, source_record_id)

    with pytest.raises(errors.ForeignKeyViolation):
        db_connection.execute(
            """
            INSERT INTO user_concept_states
                (user_id, user_language_id, concept_id, status, state_version)
            VALUES (%s, %s, %s, 'learning', 1)
            """,
            (second_user, first_language, concept_id),
        )
    db_connection.rollback()

    first_user, first_language = _seed_user(db_connection)
    with pytest.raises(errors.ForeignKeyViolation):
        db_connection.execute(
            """
            INSERT INTO review_items
                (user_id, user_language_id, concept_id, status, created_from)
            VALUES (%s, %s, %s, 'active', 'learner_saved')
            """,
            (first_user, first_language, uuid.uuid4()),
        )


def test_today_activity_cannot_cross_the_plan_language(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    user_id, language_id = _seed_user(db_connection)
    source_record_id = _seed_source(db_connection)
    vietnamese_concept = db_connection.execute(
        """
        INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
        VALUES ('vi', 'word', %s, %s)
        RETURNING id
        """,
        (f"vi-test-{uuid.uuid4()}", source_record_id),
    ).fetchone()
    assert vietnamese_concept is not None
    plan_id = db_connection.execute(
        """
        INSERT INTO today_plans
            (user_id, user_language_id, language_code, plan_date, time_zone,
             daily_minutes, new_concept_budget, engine_version, status,
             as_of, unused_minutes, generation_diagnostics)
        VALUES (%s, %s, 'en', current_date, 'Asia/Ho_Chi_Minh', 20, 3,
                'test-v1', 'active', now(), 15, '{}'::jsonb)
        RETURNING id
        """,
        (user_id, language_id),
    ).fetchone()
    assert plan_id is not None

    with pytest.raises(errors.ForeignKeyViolation):
        db_connection.execute(
            """
            INSERT INTO today_plan_activities
                (plan_id, user_id, language_code, activity_type, position,
                 estimated_minutes, reason_codes, concept_id, target_count,
                 title_snapshot, description_snapshot, reason_text_snapshot,
                 selection_diagnostics)
            VALUES (%s, %s, 'en', 'learn', 0, 5, ARRAY['NEW_CONCEPT_BUDGET'], %s,
                    1, 'Learn', 'Learn concept', 'New concept', '{}'::jsonb)
            """,
            (plan_id[0], user_id, vietnamese_concept[0]),
        )


def test_imported_lexical_and_content_rows_require_provenance(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    with pytest.raises(errors.NotNullViolation):
        db_connection.execute(
            """
            INSERT INTO concepts (language_code, concept_type, canonical_key, source_record_id)
            VALUES ('en', 'word', %s, NULL)
            """,
            (f"missing-source-{uuid.uuid4()}",),
        )
    db_connection.rollback()

    with pytest.raises(errors.NotNullViolation):
        db_connection.execute(
            """
            INSERT INTO content_items
                (language_code, content_type, title, publication_status, source_record_id)
            VALUES ('en', 'story', 'Missing source', 'quarantined', NULL)
            """
        )


def test_published_content_requires_approved_usable_provenance(
    db_connection: Connection[tuple[object, ...]],
) -> None:
    source_record_id = _seed_source(db_connection)
    db_connection.execute(
        "UPDATE source_records SET review_status = 'review_pending' WHERE id = %s",
        (source_record_id,),
    )
    with pytest.raises(errors.CheckViolation):
        db_connection.execute(
            """
            INSERT INTO content_items
                (language_code, content_type, title, quality_score,
                 publication_status, source_record_id, published_at)
            VALUES ('en', 'story', 'Unsafe source', 0.9, 'published', %s, now())
            """,
            (source_record_id,),
        )


def test_browser_roles_cannot_query_domain_tables(migrated_postgres_url: str) -> None:
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    with psycopg.connect(migrated_postgres_url) as admin:
        _seed_user(admin, owner_id)
        _seed_user(admin, other_id)
        admin.commit()

    with psycopg.connect(migrated_postgres_url) as authenticated_session:
        authenticated_session.execute("SET ROLE authenticated")
        authenticated_session.execute(
            "SELECT set_config('request.jwt.claim.sub', %s, false)", (str(owner_id),)
        )
        with pytest.raises(errors.InsufficientPrivilege):
            authenticated_session.execute("SELECT id FROM public.users").fetchall()

    with psycopg.connect(migrated_postgres_url) as anonymous_session:
        anonymous_session.execute("SET ROLE anon")
        with pytest.raises(errors.InsufficientPrivilege):
            anonymous_session.execute("SELECT id FROM public.users").fetchall()


def test_query_path_indexes_exist(db_connection: Connection[tuple[object, ...]]) -> None:
    expected_indexes = {
        "ix_content_items_recommendation",
        "ix_content_items_reader_catalog",
        "ix_fsrs_states_due_at",
        "ix_learning_events_user_occurred_at",
        "ix_lexemes_lookup",
        "ix_review_events_user_reviewed_at",
        "ix_reader_exposure_concepts_profile",
        "ix_today_plans_user_plan_date",
        "ix_user_concept_states_user_status",
        "ix_user_content_progress_profile",
    }
    actual_indexes = {
        row[0]
        for row in db_connection.execute(
            "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
        ).fetchall()
    }
    assert actual_indexes >= expected_indexes
