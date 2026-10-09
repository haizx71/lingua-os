"""Read-only, bounded proof for the K2 hosted acceptance runner."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import psycopg
from psycopg import sql

EXPECTED_LEARNER_TABLES = (
    "assessment_attempt_items",
    "assessment_attempts",
    "assessment_idempotency_log",
    "assessment_responses",
    "assessment_results",
    "concept_save_intents",
    "exposure_events",
    "fsrs_states",
    "learner_profiles",
    "learning_events",
    "profile_mutation_results",
    "reader_exposure_concepts",
    "reader_mutation_results",
    "review_events",
    "review_items",
    "today_activity_review_items",
    "today_plan_activities",
    "today_plans",
    "user_concept_states",
    "user_content_progress",
    "user_language_projection_heads",
    "user_languages",
    "user_saved_concepts",
    "user_saved_content",
    "user_saved_sentences",
    "user_skill_states",
    "users",
)
DIRECT_USER_OWNER_TABLES = tuple(
    table
    for table in EXPECTED_LEARNER_TABLES
    if table not in {"users", "profile_mutation_results", "reader_exposure_concepts"}
)
# These are all remaining FKs that reference one of the 27 Auth-owned learner
# tables. The two recursive owner edges are included alongside the other known
# inter-learner cascades; the three RESTRICT edges deliberately remain pinned.
NONOWNER_INBOUND_FKS = (
    (
        "assessment_attempt_items",
        "assessment_attempt_items_attempt_id_user_id_template_id_fkey",
        ("attempt_id", "user_id", "template_id"),
        "assessment_attempts",
        ("id", "user_id", "template_id"),
        "c",
        True,
    ),
    (
        "assessment_responses",
        "assessment_responses_attempt_id_user_id_template_id_fkey",
        ("attempt_id", "user_id", "template_id"),
        "assessment_attempts",
        ("id", "user_id", "template_id"),
        "c",
        True,
    ),
    (
        "assessment_results",
        "assessment_results_attempt_id_user_id_template_id_fkey",
        ("attempt_id", "user_id", "template_id"),
        "assessment_attempts",
        ("id", "user_id", "template_id"),
        "c",
        True,
    ),
    (
        "reader_exposure_concepts",
        "reader_exposure_concepts_exposure_event_id_user_id_user_la_fkey",
        ("exposure_event_id", "user_id", "user_language_id", "language_code"),
        "exposure_events",
        ("id", "user_id", "user_language_id", "language_code"),
        "c",
        True,
    ),
    (
        "learning_events",
        "learning_events_causation_fkey",
        ("causation_learning_event_id",),
        "learning_events",
        ("learning_event_id",),
        "r",
        False,
    ),
    (
        "fsrs_states",
        "fsrs_states_review_item_id_user_id_fkey",
        ("review_item_id", "user_id"),
        "review_items",
        ("id", "user_id"),
        "c",
        True,
    ),
    (
        "review_events",
        "review_events_review_item_id_user_id_fkey",
        ("review_item_id", "user_id"),
        "review_items",
        ("id", "user_id"),
        "c",
        True,
    ),
    (
        "today_activity_review_items",
        "today_activity_review_items_review_item_id_user_id_languag_fkey",
        ("review_item_id", "user_id", "language_code"),
        "review_items",
        ("id", "user_id", "language_code"),
        "r",
        True,
    ),
    (
        "today_plan_activities",
        "today_plan_activities_review_item_id_user_id_language_code_fkey",
        ("review_item_id", "user_id", "language_code"),
        "review_items",
        ("id", "user_id", "language_code"),
        "r",
        False,
    ),
    (
        "today_activity_review_items",
        "today_activity_review_items_activity_id_user_id_language_c_fkey",
        ("activity_id", "user_id", "language_code"),
        "today_plan_activities",
        ("id", "user_id", "language_code"),
        "c",
        True,
    ),
    (
        "today_plan_activities",
        "today_plan_activities_plan_id_user_id_language_code_fkey",
        ("plan_id", "user_id", "language_code"),
        "today_plans",
        ("id", "user_id", "language_code"),
        "c",
        True,
    ),
    (
        "assessment_attempts",
        "assessment_attempts_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "concept_save_intents",
        "concept_save_intents_user_id_user_language_id_language_cod_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "exposure_events",
        "exposure_events_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "learning_events",
        "learning_events_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "profile_mutation_results",
        "profile_mutation_results_user_id_language_profile_id_fkey",
        ("user_id", "language_profile_id"),
        "user_languages",
        ("user_id", "id"),
        "c",
        True,
    ),
    (
        "reader_exposure_concepts",
        "reader_exposure_concepts_user_id_user_language_id_language_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "review_items",
        "review_items_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "today_plans",
        "today_plans_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "user_concept_states",
        "user_concept_states_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "user_content_progress",
        "user_content_progress_user_id_user_language_id_language_co_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "user_language_projection_heads",
        "user_language_projection_heads_user_id_user_language_id_fkey",
        ("user_id", "user_language_id"),
        "user_languages",
        ("user_id", "id"),
        "c",
        True,
    ),
    (
        "user_saved_concepts",
        "user_saved_concepts_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "user_saved_content",
        "user_saved_content_user_id_user_language_id_language_code_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "user_saved_sentences",
        "user_saved_sentences_user_id_user_language_id_language_cod_fkey",
        ("user_id", "user_language_id", "language_code"),
        "user_languages",
        ("user_id", "id", "language_code"),
        "c",
        True,
    ),
    (
        "user_skill_states",
        "user_skill_states_user_id_user_language_id_fkey",
        ("user_id", "user_language_id"),
        "user_languages",
        ("user_id", "id"),
        "c",
        True,
    ),
)
ROOT_AUTH_OWNER_FK = (
    "public",
    "users",
    "users_id_fkey",
    ("id",),
    "auth",
    "users",
    ("id",),
    "c",
    "a",
    "s",
    True,
    False,
    False,
    True,
)


def _expected_inbound_owner_fk_closure() -> frozenset[tuple[Any, ...]]:
    edges: set[tuple[Any, ...]] = {ROOT_AUTH_OWNER_FK}
    for table in DIRECT_USER_OWNER_TABLES:
        edges.add(
            (
                "public",
                table,
                f"{table}_user_id_fkey",
                ("user_id",),
                "public",
                "users",
                ("id",),
                "c",
                "a",
                "s",
                True,
                False,
                False,
                True,
            )
        )
    for (
        source,
        name,
        source_columns,
        target,
        target_columns,
        delete_action,
        source_not_null,
    ) in NONOWNER_INBOUND_FKS:
        edges.add(
            (
                "public",
                source,
                name,
                source_columns,
                "public",
                target,
                target_columns,
                delete_action,
                "a",
                "s",
                True,
                False,
                False,
                source_not_null,
            )
        )
    return frozenset(edges)


EXPECTED_INBOUND_OWNER_FK_CLOSURE = _expected_inbound_owner_fk_closure()
OWNER_FK_SIGNATURES = frozenset(
    {
        ("public", "users", "users_id_fkey"),
        *(("public", table, f"{table}_user_id_fkey") for table in DIRECT_USER_OWNER_TABLES),
        (
            "public",
            "reader_exposure_concepts",
            "reader_exposure_concepts_exposure_event_id_user_id_user_la_fkey",
        ),
        (
            "public",
            "profile_mutation_results",
            "profile_mutation_results_user_id_language_profile_id_fkey",
        ),
    }
)
EXPECTED_CATALOG_TABLES = (
    "audio_assets",
    "concepts",
    "content_concepts",
    "content_items",
    "content_metrics",
    "content_segments",
    "content_versions",
    "data_sources",
    "lexemes",
    "licenses",
    "phonetic_transcriptions",
    "proficiency_levels",
    "schema_migrations",
    "sentence_audio",
    "sentence_concepts",
    "sentence_translations",
    "sentences",
    "source_records",
    "word_senses",
)
EXPECTED_READONLY_ROLE = "k2_hosted_acceptance_reader"
EXPECTED_APP_MIGRATION_HEAD = "0021"
EXPECTED_SUPABASE_PLATFORM_TAIL = (
    "concept_save_intent_auth_erasure_0019",
    "k2_hosted_acceptance_reader_staging",
    "today_remediation_reason_codes_0020",
    "k2_09_hosted_fixture_control_0021",
)
K2_ANCHOR_CONCEPT_ID = UUID("7f110000-0000-4000-8000-000000000004")
K2_ANCHOR_LEMMA = "frll-anchor"
MAX_ROWS_PER_TABLE = 100_000
MAX_TOTAL_ROWS = 300_000
MAX_ROW_BYTES = 16_384
MAX_TOTAL_BYTES = 128 * 1024 * 1024


class ProbeError(Exception):
    pass


# The base-candidate order must come from the production ContentStore. The probe
# passes its existing read-only transaction to that implementation; it never
# creates a second connection or reimplements its fit ordering.
API_SOURCE = Path(__file__).resolve().parents[3] / "services" / "api" / "src"
sys.path.insert(0, str(API_SOURCE))
from lingua_api.content.store import PostgresContentStore  # noqa: E402
from lingua_api.memory.domain import AuthenticatedActor  # noqa: E402


def _require_verified_staging_connection(database_url: str) -> None:
    try:
        parsed = urlsplit(database_url)
        root = Path(os.environ["PGSSLROOTCERT"]).resolve(strict=True)
        pinned_root = (
            Path(__file__).resolve().parents[3] / "database" / "certs" / "supabase-prod-ca-2021.crt"
        ).resolve(strict=True)
        valid = (
            parsed.scheme == "postgresql"
            and parsed.username == "k2_hosted_acceptance_reader.bdmtdvvnbicgkfririjo"
            and bool(parsed.password)
            and parsed.hostname == "aws-0-ap-southeast-1.pooler.supabase.com"
            and parsed.port == 5432
            and parsed.path == "/postgres"
            and parsed.query == "sslmode=verify-full"
            and not parsed.fragment
            and root == pinned_root
        )
    except (KeyError, OSError, ValueError):
        valid = False
    if not valid:
        raise ProbeError


def _connection() -> psycopg.Connection[tuple[Any, ...]]:
    database_url = os.environ.get("K2_STAGING_READONLY_DATABASE_URL", "").strip()
    if not database_url:
        raise ProbeError
    _require_verified_staging_connection(database_url)
    connection = psycopg.connect(database_url, autocommit=False)
    connection.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
    status = connection.execute(
        """SELECT current_user,
                  current_setting('transaction_read_only'),
                  current_setting('default_transaction_read_only'),
                  role.rolsuper,
                  role.rolcreaterole,
                  role.rolcreatedb,
                  role.rolreplication,
                  role.rolbypassrls,
                  role.rolinherit,
                  role.rolcanlogin,
                  role.rolconnlimit,
                  (SELECT count(*) FROM pg_auth_members WHERE member = role.oid),
                  has_schema_privilege(current_user, 'public', 'CREATE'),
                  has_database_privilege(current_user, current_database(), 'CREATE')
           FROM pg_roles AS role
           WHERE role.rolname = current_user"""
    ).fetchone()
    if (
        status is None
        or status[0] != EXPECTED_READONLY_ROLE
        or status[1:3] != ("on", "on")
        or status[3:9] != (False, False, False, False, False, False)
        or status[9:12] != (True, 5, 0)
        or status[12:14] != (False, False)
    ):
        connection.close()
        raise ProbeError
    return connection


def _table_inventory(connection: psycopg.Connection[tuple[Any, ...]]) -> tuple[str, ...]:
    rows = connection.execute(
        """WITH RECURSIVE learner_owned_tables(table_oid) AS (
               SELECT 'public.users'::regclass::oid
               UNION
               SELECT child.oid
               FROM learner_owned_tables AS parent
               JOIN pg_constraint AS foreign_key
                 ON foreign_key.contype = 'f'
                AND foreign_key.confrelid = parent.table_oid
               JOIN pg_class AS child ON child.oid = foreign_key.conrelid
               JOIN pg_namespace AS child_schema ON child_schema.oid = child.relnamespace
               WHERE child_schema.nspname = 'public'
                 AND child.relkind IN ('r', 'p')
           ), owner_column_tables AS (
               SELECT relation.oid
               FROM pg_class AS relation
               JOIN pg_namespace AS relation_schema ON relation_schema.oid = relation.relnamespace
               JOIN pg_attribute AS attribute ON attribute.attrelid = relation.oid
               WHERE relation_schema.nspname = 'public'
                 AND relation.relkind IN ('r', 'p')
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND attribute.attname = 'user_id'
           ), expected_owner_tables AS (
               SELECT table_oid FROM learner_owned_tables
               UNION
               SELECT oid FROM owner_column_tables
           )
           SELECT relation.relname,
                  bool_or(attribute.attname = 'user_id') AS owns_by_user_id,
                  bool_or(attribute.attname = 'id') AS has_id
           FROM expected_owner_tables AS owned
           JOIN pg_class AS relation ON relation.oid = owned.table_oid
           JOIN pg_namespace AS relation_schema ON relation_schema.oid = relation.relnamespace
           LEFT JOIN pg_attribute AS attribute
             ON attribute.attrelid = relation.oid
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
           WHERE relation_schema.nspname = 'public'
             AND relation.relkind IN ('r', 'p')
           GROUP BY relation.relname
           ORDER BY relation.relname"""
    ).fetchall()
    actual = tuple(row[0] for row in rows)
    if actual != tuple(sorted(EXPECTED_LEARNER_TABLES)):
        raise ProbeError
    for table_name, owns_by_user_id, has_id in rows:
        if table_name == "users":
            if not has_id:
                raise ProbeError
        elif not owns_by_user_id:
            raise ProbeError
        privileges = connection.execute(
            """SELECT has_table_privilege(current_user, %s, 'SELECT'),
                      has_table_privilege(current_user, %s, 'INSERT'),
                      has_table_privilege(current_user, %s, 'UPDATE'),
                      has_table_privilege(current_user, %s, 'DELETE'),
                      has_table_privilege(current_user, %s, 'TRUNCATE'),
                      has_table_privilege(current_user, %s, 'TRIGGER')""",
            tuple(f"public.{table_name}" for _ in range(6)),
        ).fetchone()
        if privileges is None or privileges[0] is not True or any(privileges[1:]):
            raise ProbeError

    all_public_privileges = connection.execute(
        """SELECT relation.relname,
                  has_table_privilege(current_user, relation.oid, 'SELECT'),
                  has_table_privilege(current_user, relation.oid, 'INSERT'),
                  has_table_privilege(current_user, relation.oid, 'UPDATE'),
                  has_table_privilege(current_user, relation.oid, 'DELETE'),
                  has_table_privilege(current_user, relation.oid, 'TRUNCATE'),
                  has_table_privilege(current_user, relation.oid, 'TRIGGER'),
                  has_table_privilege(current_user, relation.oid, 'REFERENCES'),
                  has_table_privilege(current_user, relation.oid, 'MAINTAIN')
           FROM pg_class AS relation
           JOIN pg_namespace AS relation_schema ON relation_schema.oid = relation.relnamespace
           WHERE relation_schema.nspname = 'public'
             AND relation.relkind IN ('r', 'p', 'v', 'm')"""
    ).fetchall()
    readable = {row[0] for row in all_public_privileges if row[1] is True}
    if readable != set(EXPECTED_LEARNER_TABLES) | set(EXPECTED_CATALOG_TABLES) or any(
        any(row[2:]) for row in all_public_privileges
    ):
        raise ProbeError

    policy_rows = connection.execute(
        """SELECT relation.relname, relation.relrowsecurity,
                  relation.relforcerowsecurity,
                  EXISTS (
                      SELECT 1 FROM pg_policy AS policy
                      WHERE policy.polrelid = relation.oid
                        AND policy.polname = 'k2_hosted_acceptance_reader_select_all'
                        AND policy.polcmd = 'r'
                        AND policy.polpermissive
                        AND policy.polroles = ARRAY[(SELECT oid FROM pg_roles
                                                     WHERE rolname = current_user)]::oid[]
                        AND pg_get_expr(policy.polqual, policy.polrelid) = 'true'
                  ) AS exact_reader_policy,
                  EXISTS (
                      SELECT 1 FROM pg_policy AS policy
                      WHERE policy.polrelid = relation.oid
                        AND NOT policy.polpermissive
                        AND policy.polcmd IN ('r', '*')
                        AND (0 = ANY(policy.polroles)
                             OR (SELECT oid FROM pg_roles WHERE rolname = current_user)
                                = ANY(policy.polroles))
                  ) AS restrictive_policy
           FROM pg_class AS relation
           JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
           WHERE schema.nspname = 'public'
             AND relation.relname = ANY(%s)
             AND relation.relkind IN ('r', 'p')
           ORDER BY relation.relname""",
        (list(EXPECTED_LEARNER_TABLES),),
    ).fetchall()
    if len(policy_rows) != len(EXPECTED_LEARNER_TABLES):
        raise ProbeError
    without_rls = {"assessment_attempt_items", "assessment_idempotency_log"}
    if any(
        forced
        or restrictive
        or (not enabled and (name not in without_rls or exact))
        or (enabled and (name in without_rls or not exact))
        for name, enabled, forced, exact, restrictive in policy_rows
    ):
        raise ProbeError
    return actual


def _snapshot(
    connection: psycopg.Connection[tuple[Any, ...]], actor_id: UUID | None
) -> dict[str, Any]:
    inventory = _table_inventory(connection)
    tables: dict[str, dict[str, Any]] = {}
    total_rows = 0
    total_bytes = 0

    for table_name in inventory:
        owner_column = "id" if table_name == "users" else "user_id"
        query = sql.SQL("SELECT to_jsonb(row_data)::text FROM public.{} AS row_data").format(
            sql.Identifier(table_name)
        )
        parameters: tuple[Any, ...] = ()
        if actor_id is not None:
            query += sql.SQL(" WHERE {} = %s").format(sql.Identifier(owner_column))
            parameters = (actor_id,)
        query += sql.SQL(" ORDER BY to_jsonb(row_data)::text")

        digest = hashlib.sha256()
        row_count = 0
        with connection.cursor(name="k2_acceptance_snapshot") as cursor:
            cursor.execute(query, parameters)
            while batch := cursor.fetchmany(500):
                for (serialized,) in batch:
                    row = serialized.encode("utf-8")
                    if len(row) > MAX_ROW_BYTES:
                        raise ProbeError
                    row_count += 1
                    total_rows += 1
                    total_bytes += len(row)
                    if (
                        row_count > MAX_ROWS_PER_TABLE
                        or total_rows > MAX_TOTAL_ROWS
                        or total_bytes > MAX_TOTAL_BYTES
                    ):
                        raise ProbeError
                    digest.update(row)
                    digest.update(b"\n")
        tables[table_name] = {"rows": row_count, "sha256": digest.hexdigest()}

    return {"tables": tables, "totalRows": total_rows}


def _migration_head(connection: psycopg.Connection[tuple[Any, ...]]) -> dict[str, Any]:
    rows = connection.execute(
        "SELECT version, name FROM public.schema_migrations ORDER BY version"
    ).fetchall()
    expected = [f"{number:04d}" for number in range(1, 22)]
    if [row[0] for row in rows] != expected or rows[-1][1] != "k2_09_hosted_fixture_control":
        raise ProbeError
    migration_rows = connection.execute(
        "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
    ).fetchall()
    platform_tail = tuple(row[1] for row in migration_rows[-len(EXPECTED_SUPABASE_PLATFORM_TAIL) :])
    platform_versions = [row[0] for row in migration_rows[-len(EXPECTED_SUPABASE_PLATFORM_TAIL) :]]
    if (
        len(migration_rows) < len(EXPECTED_SUPABASE_PLATFORM_TAIL)
        or platform_tail != EXPECTED_SUPABASE_PLATFORM_TAIL
        or platform_versions != sorted(platform_versions)
        or len(set(platform_versions)) != len(platform_versions)
    ):
        raise ProbeError
    privileges = connection.execute(
        """SELECT has_column_privilege(current_user, 'supabase_migrations.schema_migrations',
                                        'version', 'SELECT'),
                  has_column_privilege(current_user, 'supabase_migrations.schema_migrations',
                                        'name', 'SELECT'),
              has_table_privilege(
                  current_user, 'supabase_migrations.schema_migrations', 'SELECT'
              ),
                  has_column_privilege(current_user, 'supabase_migrations.schema_migrations',
                                        'statements', 'SELECT'),
              has_table_privilege(
                  current_user, 'supabase_migrations.schema_migrations', 'INSERT'
              ),
              has_table_privilege(
                  current_user, 'supabase_migrations.schema_migrations', 'UPDATE'
              ),
              has_table_privilege(
                  current_user, 'supabase_migrations.schema_migrations', 'DELETE'
              ),
              has_table_privilege(
                  current_user, 'supabase_migrations.schema_migrations', 'TRUNCATE'
              )"""
    ).fetchone()
    if privileges != (True, True, False, False, False, False, False, False):
        raise ProbeError
    return {"appMigrationHead": rows[-1][0], "appliedMigrations": len(rows)}


def _actor_ownership_graph(connection: psycopg.Connection[tuple[Any, ...]]) -> dict[str, Any]:
    rows = connection.execute(
        """SELECT source_namespace.nspname::text, source_table.relname::text,
                  constraint_row.conname::text,
                  ARRAY(
                      SELECT source_column.attname::text
                      FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key(attnum, ordinal)
                      JOIN pg_catalog.pg_attribute AS source_column
                        ON source_column.attrelid = constraint_row.conrelid
                       AND source_column.attnum = key.attnum
                      ORDER BY key.ordinal
                  ),
                  target_namespace.nspname::text, target_table.relname::text,
                  ARRAY(
                      SELECT target_column.attname::text
                      FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key(attnum, ordinal)
                      JOIN pg_catalog.pg_attribute AS target_column
                        ON target_column.attrelid = constraint_row.confrelid
                       AND target_column.attnum = key.attnum
                      ORDER BY key.ordinal
                  ),
                  constraint_row.confdeltype::text, constraint_row.confupdtype::text,
                  constraint_row.confmatchtype::text, constraint_row.convalidated,
                  constraint_row.condeferrable, constraint_row.condeferred,
                  NOT EXISTS (
                      SELECT 1
                      FROM unnest(constraint_row.conkey) AS key(attnum)
                      JOIN pg_catalog.pg_attribute AS source_column
                        ON source_column.attrelid = constraint_row.conrelid
                       AND source_column.attnum = key.attnum
                      WHERE NOT source_column.attnotnull
                  )
             FROM pg_catalog.pg_constraint AS constraint_row
             JOIN pg_catalog.pg_class AS source_table
               ON source_table.oid = constraint_row.conrelid
             JOIN pg_catalog.pg_namespace AS source_namespace
               ON source_namespace.oid = source_table.relnamespace
             JOIN pg_catalog.pg_class AS target_table
               ON target_table.oid = constraint_row.confrelid
             JOIN pg_catalog.pg_namespace AS target_namespace
               ON target_namespace.oid = target_table.relnamespace
            WHERE constraint_row.contype = 'f'
              AND (
                  (target_namespace.nspname = 'public'
                   AND target_table.relname::text = ANY(%s))
                  OR (source_namespace.nspname = 'public'
                      AND source_table.relname = 'users'
                      AND target_namespace.nspname = 'auth'
                      AND target_table.relname = 'users')
              )
            ORDER BY target_namespace.nspname, target_table.relname,
                     source_namespace.nspname, source_table.relname, constraint_row.conname""",
        (list(EXPECTED_LEARNER_TABLES),),
    ).fetchall()
    actual_edges = frozenset(
        (
            row[0],
            row[1],
            row[2],
            tuple(row[3]),
            row[4],
            row[5],
            tuple(row[6]),
            row[7],
            row[8],
            row[9],
            row[10],
            row[11],
            row[12],
            row[13],
        )
        for row in rows
    )
    actual_owner_signatures = {edge[:3] for edge in actual_edges}
    if (
        len(EXPECTED_LEARNER_TABLES) != 27
        or len(DIRECT_USER_OWNER_TABLES) != 24
        or len(OWNER_FK_SIGNATURES) != 27
        or len(actual_edges) != len(rows)
        or actual_edges != EXPECTED_INBOUND_OWNER_FK_CLOSURE
        or not OWNER_FK_SIGNATURES.issubset(actual_owner_signatures)
        or any(
            edge[7] != "c"
            or edge[10] is not True
            or edge[11] is not False
            or edge[12] is not False
            or edge[13] is not True
            for edge in actual_edges
            if edge[:3] in OWNER_FK_SIGNATURES
        )
    ):
        raise ProbeError
    return {
        "ownershipGraphValid": True,
        "ownedTableCount": 27,
        "ownershipEdgeCount": 27,
        "incomingConstraintCount": 51,
    }


def _anchor_material(connection: psycopg.Connection[tuple[Any, ...]]) -> dict[str, bool]:
    lexeme = connection.execute(
        "SELECT id FROM public.lexemes WHERE concept_id = %s ORDER BY id LIMIT 1",
        (K2_ANCHOR_CONCEPT_ID,),
    ).fetchone()
    if lexeme is None:
        raise ProbeError
    lexeme_id = lexeme[0]

    sense = connection.execute(
        """SELECT translated_definition, translation_language_code
           FROM public.word_senses
           WHERE lexeme_id = %s
           ORDER BY CASE
               WHEN translation_language_code = 'vi'
                AND translated_definition IS NOT NULL THEN 0 ELSE 1
           END, sense_order
           LIMIT 1""",
        (lexeme_id,),
    ).fetchone()
    has_translated_definition = bool(
        sense is not None
        and sense[1] == "vi"
        and isinstance(sense[0], str)
        and 0 < len(sense[0].strip()) <= 2000
    )

    phonetic = connection.execute(
        """SELECT audio_uri
           FROM public.phonetic_transcriptions
           WHERE lexeme_id = %s AND audio_uri IS NOT NULL
           ORDER BY CASE accent_variant
               WHEN 'en_US' THEN 0 WHEN 'en_GB' THEN 1 ELSE 2
           END, accent_variant
           LIMIT 1""",
        (lexeme_id,),
    ).fetchone()
    has_https_audio = False
    if phonetic is not None and isinstance(phonetic[0], str):
        try:
            audio = urlsplit(phonetic[0])
            has_https_audio = (
                audio.scheme == "https"
                and bool(audio.netloc)
                and audio.username is None
                and audio.password is None
            )
        except ValueError:
            has_https_audio = False

    example = connection.execute(
        """SELECT sentence.text, occurrence.start_offset, occurrence.end_offset
           FROM public.sentence_concepts AS occurrence
           JOIN public.sentences AS sentence
             ON sentence.id = occurrence.sentence_id
            AND sentence.language_code = occurrence.language_code
           WHERE occurrence.concept_id = %s
             AND occurrence.language_code = 'en'
             AND occurrence.occurrence_role = 'target'
             AND char_length(sentence.text) <= 3000
             AND EXISTS (
                 SELECT 1
                 FROM public.content_segments AS segment
                 JOIN public.content_items AS content
                   ON content.id = segment.content_id
                  AND content.language_code = segment.language_code
                 WHERE segment.sentence_id = sentence.id
                   AND segment.language_code = 'en'
                   AND content.publication_status = 'published'
                   AND public.reader_content_passes_publication_gate(content.id)
             )
           ORDER BY sentence.quality_score DESC NULLS LAST,
                    sentence.id, occurrence.start_offset
           LIMIT 1""",
        (K2_ANCHOR_CONCEPT_ID,),
    ).fetchone()
    has_published_cloze_target = False
    if example is not None and isinstance(example[0], str):
        sentence, start, end = example
        has_published_cloze_target = (
            isinstance(start, int)
            and isinstance(end, int)
            and 0 <= start < end <= len(sentence)
            and bool(sentence[start:end].strip())
        )

    return {
        "hasTranslatedDefinition": has_translated_definition,
        "hasHttpsAudio": has_https_audio,
        "hasPublishedClozeTarget": has_published_cloze_target,
    }


def _k208_fixture_privilege_preflight(
    connection: psycopg.Connection[tuple[Any, ...]],
) -> dict[str, bool]:
    _table_inventory(connection)
    role_rows = connection.execute(
        """SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
                  rolbypassrls, rolcanlogin, rolinherit
           FROM pg_roles
           WHERE rolname = ANY(%s)
           ORDER BY rolname""",
        ([EXPECTED_READONLY_ROLE, "anon", "authenticated", "service_role"],),
    ).fetchall()
    expected_role_flags = {
        "anon": (False, False, False, False, False, False, True),
        "authenticated": (False, False, False, False, False, False, True),
        EXPECTED_READONLY_ROLE: (False, False, False, False, False, True, False),
        "service_role": (False, False, False, False, True, False, True),
    }
    if {row[0]: tuple(row[1:]) for row in role_rows} != expected_role_flags:
        raise ProbeError

    schema_rows = connection.execute(
        """SELECT role.rolname, schema.nspname,
                  has_schema_privilege(role.oid, schema.oid, 'USAGE'),
                  has_schema_privilege(role.oid, schema.oid, 'CREATE')
           FROM pg_roles AS role
           CROSS JOIN pg_namespace AS schema
           WHERE role.rolname = ANY(%s)
             AND schema.nspname = ANY(ARRAY['auth', 'public'])
           ORDER BY role.rolname, schema.nspname""",
        ([EXPECTED_READONLY_ROLE, "anon", "authenticated", "service_role"],),
    ).fetchall()
    expected_schema_flags = {
        ("anon", "auth"): (True, False),
        ("anon", "public"): (False, False),
        ("authenticated", "auth"): (True, False),
        ("authenticated", "public"): (False, False),
        (EXPECTED_READONLY_ROLE, "auth"): (False, False),
        (EXPECTED_READONLY_ROLE, "public"): (True, False),
        ("service_role", "auth"): (True, False),
        ("service_role", "public"): (True, False),
    }
    if {(row[0], row[1]): tuple(row[2:]) for row in schema_rows} != expected_schema_flags:
        raise ProbeError
    public_schema_acl_rows = connection.execute(
        """SELECT schema.nspname,
                  EXISTS (
                      SELECT 1
                      FROM aclexplode(
                          COALESCE(schema.nspacl, acldefault('n', schema.nspowner))
                      ) AS acl
                      WHERE acl.grantee = 0
                  ) AS has_public_grant
           FROM pg_namespace AS schema
           WHERE schema.nspname = ANY(ARRAY['auth', 'public'])
           ORDER BY schema.nspname"""
    ).fetchall()
    if public_schema_acl_rows != [("auth", False), ("public", False)]:
        raise ProbeError

    owner_rls_rows = connection.execute(
        """WITH expected_relations(schema_name, relation_name, relation_kind,
                                   expected_owner, expected_rls, expected_force) AS (
               VALUES
                   ('public', 'users', 'r', 'postgres', true, false),
                   ('public', 'user_languages', 'r', 'postgres', true, false),
                   ('public', 'user_concept_states', 'r', 'postgres', true, false),
                   ('public', 'v_learner_concept_retrievability', 'v', 'postgres', false, false),
                   ('auth', 'users', 'r', 'supabase_auth_admin', true, false)
           )
           SELECT expected.schema_name, expected.relation_name,
                  relation.relkind::text, owner.rolname,
                  relation.relrowsecurity, relation.relforcerowsecurity,
                  expected.relation_kind, expected.expected_owner,
                  expected.expected_rls, expected.expected_force,
                  (SELECT count(*)::integer FROM pg_policy AS policy
                   WHERE policy.polrelid = relation.oid)
           FROM expected_relations AS expected
           JOIN pg_namespace AS schema ON schema.nspname = expected.schema_name
           JOIN pg_class AS relation
             ON relation.relnamespace = schema.oid
            AND relation.relname = expected.relation_name
           JOIN pg_roles AS owner ON owner.oid = relation.relowner
           ORDER BY expected.schema_name, expected.relation_name"""
    ).fetchall()
    expected_owner_rls_rows = [
        (
            "auth",
            "users",
            "r",
            "supabase_auth_admin",
            True,
            False,
            "r",
            "supabase_auth_admin",
            True,
            False,
            0,
        ),
        (
            "public",
            "user_concept_states",
            "r",
            "postgres",
            True,
            False,
            "r",
            "postgres",
            True,
            False,
            2,
        ),
        ("public", "user_languages", "r", "postgres", True, False, "r", "postgres", True, False, 2),
        ("public", "users", "r", "postgres", True, False, "r", "postgres", True, False, 2),
        (
            "public",
            "v_learner_concept_retrievability",
            "v",
            "postgres",
            False,
            False,
            "v",
            "postgres",
            False,
            False,
            0,
        ),
    ]
    if owner_rls_rows != expected_owner_rls_rows:
        raise ProbeError

    policy_rows = connection.execute(
        """SELECT schema.nspname, relation.relname, policy.polname, policy.polcmd,
                  policy.polpermissive,
                  ARRAY(SELECT CASE WHEN granted_role.role_oid = 0 THEN 'PUBLIC'
                                    ELSE pg_get_userbyid(granted_role.role_oid) END
                        FROM unnest(policy.polroles) AS granted_role(role_oid)
                        ORDER BY 1),
                  pg_get_expr(policy.polqual, policy.polrelid),
                  pg_get_expr(policy.polwithcheck, policy.polrelid)
           FROM pg_policy AS policy
           JOIN pg_class AS relation ON relation.oid = policy.polrelid
           JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
           WHERE schema.nspname = 'public'
             AND relation.relname = ANY(ARRAY['users', 'user_languages', 'user_concept_states'])
           ORDER BY relation.relname, policy.polname"""
    ).fetchall()
    expected_policies = [
        (
            "public",
            "user_concept_states",
            "k2_hosted_acceptance_reader_select_all",
            "r",
            True,
            [EXPECTED_READONLY_ROLE],
            "true",
            None,
        ),
        (
            "public",
            "user_concept_states",
            "user_concept_states_select_own",
            "r",
            True,
            ["authenticated"],
            "(( SELECT auth.uid() AS uid) = user_id)",
            None,
        ),
        (
            "public",
            "user_languages",
            "k2_hosted_acceptance_reader_select_all",
            "r",
            True,
            [EXPECTED_READONLY_ROLE],
            "true",
            None,
        ),
        (
            "public",
            "user_languages",
            "user_languages_select_own",
            "r",
            True,
            ["authenticated"],
            "(( SELECT auth.uid() AS uid) = user_id)",
            None,
        ),
        (
            "public",
            "users",
            "k2_hosted_acceptance_reader_select_all",
            "r",
            True,
            [EXPECTED_READONLY_ROLE],
            "true",
            None,
        ),
        (
            "public",
            "users",
            "users_select_own",
            "r",
            True,
            ["authenticated"],
            "(( SELECT auth.uid() AS uid) = id)",
            None,
        ),
    ]
    if policy_rows != expected_policies:
        raise ProbeError

    privilege_rows = connection.execute(
        """WITH expected_relations(schema_name, relation_name) AS (
               VALUES ('public', 'users'), ('public', 'user_languages'),
                      ('public', 'user_concept_states'),
                      ('public', 'v_learner_concept_retrievability'), ('auth', 'users')
           ), relations AS (
               SELECT expected.schema_name, expected.relation_name, relation.oid
               FROM expected_relations AS expected
               JOIN pg_namespace AS schema ON schema.nspname = expected.schema_name
               JOIN pg_class AS relation
                 ON relation.relnamespace = schema.oid
                AND relation.relname = expected.relation_name
           ), roles AS (
               SELECT oid, rolname
               FROM pg_roles
               WHERE rolname = ANY(%s)
           )
           SELECT relation.schema_name, relation.relation_name, role.rolname,
                  has_table_privilege(role.oid, relation.oid, 'SELECT'),
                  has_table_privilege(role.oid, relation.oid, 'INSERT'),
                  has_table_privilege(role.oid, relation.oid, 'UPDATE'),
                  has_table_privilege(role.oid, relation.oid, 'DELETE'),
                  has_table_privilege(role.oid, relation.oid, 'TRUNCATE')
           FROM relations AS relation CROSS JOIN roles AS role
           ORDER BY relation.schema_name, relation.relation_name, role.rolname""",
        ([EXPECTED_READONLY_ROLE, "anon", "authenticated", "service_role"],),
    ).fetchall()
    expected_privileges = []
    for schema_name, relation_name in [
        ("auth", "users"),
        ("public", "user_concept_states"),
        ("public", "user_languages"),
        ("public", "users"),
        ("public", "v_learner_concept_retrievability"),
    ]:
        for role_name in sorted(expected_role_flags):
            if schema_name == "auth":
                flags = (False, False, False, False, False)
            elif relation_name == "v_learner_concept_retrievability":
                flags = (role_name == "service_role", False, False, False, False)
            elif role_name == "service_role":
                flags = (True, True, True, True, True)
            elif role_name == EXPECTED_READONLY_ROLE:
                flags = (True, False, False, False, False)
            else:
                flags = (False, False, False, False, False)
            expected_privileges.append((schema_name, relation_name, role_name, *flags))
    if privilege_rows != expected_privileges:
        raise ProbeError
    return {
        "fixtureCapabilityReady": True,
        "authBoundaryUnchanged": True,
        "learnerOwnerRlsPolicyBaseline": True,
        "readerSelectOnly": True,
        "serviceFixtureAndViewAclBaseline": True,
    }


def _k208_catalog_preflight(
    connection: psycopg.Connection[tuple[Any, ...]],
) -> dict[str, Any]:
    _table_inventory(connection)
    rows = connection.execute(
        """SELECT item.id,
                  ((metrics.token_count + 179) / 180)::integer AS estimated_minutes,
                  count(DISTINCT linked.concept_id)::integer AS linked_count
           FROM public.content_items AS item
           JOIN public.content_metrics AS metrics ON metrics.content_id = item.id
           JOIN public.proficiency_levels AS level ON level.id = item.curated_level_id
           JOIN public.source_records AS record ON record.id = item.source_record_id
           JOIN public.data_sources AS source ON source.id = record.source_id
           JOIN public.licenses AS license ON license.id = source.license_id
           JOIN public.content_concepts AS linked ON linked.content_id = item.id
           WHERE item.language_code = 'en'
             AND item.publication_status = 'published'
             AND public.reader_content_passes_publication_gate(item.id)
           GROUP BY item.id, metrics.token_count
           HAVING count(DISTINCT linked.concept_id) BETWEEN 1 AND 4"""
    ).fetchall()
    eligible = len(rows)
    five_minute = sum(1 for _, minutes, _ in rows if int(minutes) == 5)
    source_rank_shape_row = connection.execute(
        "SELECT to_regclass('public.v_learner_concept_retrievability') IS NOT NULL"
    ).fetchone()
    if source_rank_shape_row is None:
        raise ProbeError
    return {
        "eligibleContentCount": eligible,
        "fiveMinuteRemediationCount": five_minute,
        "hasNovelControl": eligible >= 3,
        "sourceRankShapeAvailable": source_rank_shape_row[0] is True,
    }


def _k208_candidate_base(
    connection: psycopg.Connection[tuple[Any, ...]], actor_id: UUID, profile_id: UUID
) -> dict[str, Any]:
    actor = AuthenticatedActor(actor_id)
    store = PostgresContentStore("")
    resolved = store.resolve_profile(connection, actor=actor, requested_id=profile_id)
    if resolved != profile_id:
        raise ProbeError
    summaries = store.list_summaries(
        actor=actor,
        language_profile_id=profile_id,
        boundary=None,
        # Read one past the reviewed finite candidate cap so truncation is
        # detected instead of silently hiding a possible competitor.
        limit=21,
        today_as_of=None,
        connection=connection,
    )
    if len(summaries) > 20:
        raise ProbeError
    content_ids = [summary.id for summary in summaries]
    linked = (
        connection.execute(
            """SELECT item.id AS content_id,
                  array_agg(DISTINCT link.concept_id ORDER BY link.concept_id),
                  count(DISTINCT link.concept_id) FILTER (
                      WHERE COALESCE(state.status, 'unseen') = 'unseen'
                  )::integer
           FROM unnest(%s::uuid[]) AS selected(content_id)
           JOIN public.content_items AS item ON item.id = selected.content_id
           LEFT JOIN public.content_concepts AS link ON link.content_id = item.id
           LEFT JOIN public.user_concept_states AS state
             ON state.user_id = %s AND state.user_language_id = %s
            AND state.concept_id = link.concept_id
           GROUP BY item.id""",
            (content_ids, actor_id, profile_id),
        ).fetchall()
        if content_ids
        else []
    )
    by_content = {row[0]: row for row in linked}
    result = []
    for summary in summaries:
        row = by_content.get(summary.id)
        if row is None:
            raise ProbeError
        concept_ids = [] if row[1] is None else [str(value) for value in row[1]]
        unseen = int(row[2])
        if len(concept_ids) > 100 or unseen < 0 or unseen > len(concept_ids):
            raise ProbeError
        progress = summary.reading_progress
        result.append(
            {
                "contentId": str(summary.id),
                "estimatedMinutes": summary.estimated_minutes,
                "linkedConceptIds": concept_ids,
                "unseenCount": unseen,
                "isSaved": summary.is_saved,
                "isUnfinished": progress is not None and not progress.is_completed,
                "isCompleted": progress is not None and progress.is_completed,
            }
        )
    state_rows = (
        connection.execute(
            """SELECT DISTINCT state.concept_id, state.status, state.state_version
           FROM public.user_concept_states AS state
           JOIN public.content_concepts AS link ON link.concept_id = state.concept_id
           WHERE state.user_id = %s AND state.user_language_id = %s
             AND link.content_id = ANY(%s)
           ORDER BY state.concept_id""",
            (actor_id, profile_id, content_ids),
        ).fetchall()
        if content_ids
        else []
    )
    return {
        "candidates": result,
        "stateConceptIds": [str(row[0]) for row in state_rows],
        "stateStatuses": [
            {
                "conceptId": str(row[0]),
                "status": str(row[1]),
                "stateVersion": int(row[2]),
            }
            for row in state_rows
        ],
    }


def _k208_due_candidate_overlap(
    connection: psycopg.Connection[tuple[Any, ...]],
    actor_id: UUID,
    profile_id: UUID,
    due_concept_ids: list[UUID],
) -> dict[str, Any]:
    if len(due_concept_ids) != 20 or len(set(due_concept_ids)) != 20:
        raise ProbeError
    profile = PostgresContentStore("").resolve_profile(
        connection,
        actor=AuthenticatedActor(actor_id),
        requested_id=profile_id,
    )
    if profile != profile_id:
        raise ProbeError
    row = connection.execute(
        """SELECT count(*)::integer
           FROM unnest(%s::uuid[]) AS due(concept_id)
           WHERE EXISTS (
               SELECT 1
               FROM public.content_concepts AS linked
               JOIN public.content_items AS item ON item.id = linked.content_id
               JOIN public.proficiency_levels AS level ON level.id = item.curated_level_id
               JOIN public.content_metrics AS metrics ON metrics.content_id = item.id
               JOIN public.source_records AS record ON record.id = item.source_record_id
               JOIN public.data_sources AS source ON source.id = record.source_id
               JOIN public.licenses AS license ON license.id = source.license_id
               WHERE linked.concept_id = due.concept_id
                 AND item.language_code = 'en'
                 AND item.publication_status = 'published'
                 AND public.reader_content_passes_publication_gate(item.id)
           )""",
        (due_concept_ids,),
    ).fetchone()
    if row is None or type(row[0]) is not int or not 0 <= row[0] <= 20:
        raise ProbeError
    return {"overlapCount": row[0]}


def _actor_lineage(
    connection: psycopg.Connection[tuple[Any, ...]], actor_id: UUID
) -> dict[str, Any]:
    state = connection.execute(
        """SELECT recognition_evidence_count, listening_evidence_count,
                  production_evidence_count, production_positive_mass::text,
                  production_negative_mass::text
           FROM public.user_concept_states
           WHERE user_id = %s AND concept_id = %s""",
        (actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchall()
    if len(state) > 1:
        raise ProbeError

    counts = connection.execute(
        """SELECT
               (SELECT count(*) FROM public.review_items
                WHERE user_id = %s AND concept_id = %s),
               (SELECT count(*) FROM public.fsrs_states AS memory
                JOIN public.review_items AS item ON item.id = memory.review_item_id
                WHERE item.user_id = %s AND item.concept_id = %s)""",
        (actor_id, K2_ANCHOR_CONCEPT_ID, actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchone()
    if counts is None:
        raise ProbeError

    events = connection.execute(
        """SELECT event.exercise_mode, event.evidence_mode, event.correct,
                  event.evidence_json ->> 'responseText',
                  event.result_competence_snapshot #>> '{production,evidenceCount}'
           FROM public.review_events AS event
           JOIN public.review_items AS item
             ON item.id = event.review_item_id AND item.user_id = event.user_id
           WHERE event.user_id = %s AND item.concept_id = %s
           ORDER BY event.created_at, event.id""",
        (actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchall()
    if len(events) > 10:
        raise ProbeError

    empty_state = (0, 0, 0, "0", "0")
    projection = state[0] if state else empty_state
    safe_events: list[dict[str, Any]] = []
    for exercise_mode, evidence_mode, correct, response_text, production_count in events:
        if exercise_mode not in {"self_recall", "multiple_choice", "typing", "cloze", "listening"}:
            raise ProbeError
        if evidence_mode not in {"recognition", "listening", "production"}:
            raise ProbeError
        safe_events.append(
            {
                "exerciseMode": exercise_mode,
                "evidenceMode": evidence_mode,
                "correct": correct,
                "responseTextMatchesAnchor": response_text == K2_ANCHOR_LEMMA,
                "resultProductionEvidenceCount": (
                    None if production_count is None else int(production_count)
                ),
            }
        )

    return {
        "userConceptStateRows": len(state),
        "reviewItemRows": int(counts[0]),
        "fsrsStateRows": int(counts[1]),
        "recognitionEvidenceCount": int(projection[0]),
        "listeningEvidenceCount": int(projection[1]),
        "productionEvidenceCount": int(projection[2]),
        "productionPositiveMass": str(projection[3]),
        "productionNegativeMass": str(projection[4]),
        "events": safe_events,
    }


def _frll_decimal(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    if len(text) > 64 or not re.fullmatch(r"-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?", text):
        raise ProbeError
    return text


def _frll_timestamp(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        timestamp = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        text = timestamp.astimezone(timezone.utc).isoformat()
    elif isinstance(value, str):
        text = value
    else:
        raise ProbeError
    if len(text) > 64 or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)", text
    ):
        raise ProbeError
    return text


def _frll_snapshot_memory(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProbeError
    state = value.get("state")
    params_version = value.get("paramsVersion")
    step = value.get("step")
    state_version = value.get("stateVersion")
    if (
        state not in {"learning", "review", "relearning"}
        or not isinstance(params_version, str)
        or not 1 <= len(params_version) <= 64
        or type(state_version) is not int
        or state_version < 2
    ):
        raise ProbeError
    result = {
        "state": state,
        "dueAt": _frll_timestamp(value.get("dueAt")),
        "lastReviewedAt": _frll_timestamp(value.get("lastReviewAt")),
        "difficulty": _frll_decimal(value.get("difficulty")),
        "stability": _frll_decimal(value.get("stability")),
        "step": step,
        "stateVersion": state_version,
        "paramsVersion": params_version,
    }
    if (
        result["dueAt"] is None
        or result["lastReviewedAt"] is None
        or result["difficulty"] is None
        or result["stability"] is None
    ):
        raise ProbeError
    if state == "review":
        if step is not None:
            raise ProbeError
    elif type(step) is not int or step < 0:
        raise ProbeError
    return result


def _frll_snapshot_competence(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict) or set(value) != {"recognition", "listening", "production"}:
        raise ProbeError
    result: dict[str, dict[str, Any]] = {}
    for dimension in ("recognition", "listening", "production"):
        row = value.get(dimension)
        if not isinstance(row, dict):
            raise ProbeError
        score = _frll_decimal(row.get("score"))
        confidence = _frll_decimal(row.get("confidence"))
        evidence_count = row.get("evidenceCount")
        if score is None or confidence is None or type(evidence_count) is not int or evidence_count < 0:
            raise ProbeError
        result[dimension] = {
            "score": score,
            "confidence": confidence,
            "evidenceCount": evidence_count,
            "updatedAt": _frll_timestamp(row.get("updatedAt")),
        }
    return result


def _frll_semantic_proof(
    connection: psycopg.Connection[tuple[Any, ...]],
    actor_id: UUID,
    profile_id: UUID,
    idempotency_key_sha256: str | None,
) -> dict[str, Any]:
    # All SQL is fixed SELECT-only and anchored to the one accepted FRLL concept.
    # Raw review keys and snapshot UUIDs are kept only transiently in this process.
    identity = connection.execute(
        """SELECT
               (SELECT count(*)::integer FROM public.users WHERE id = %s),
               (SELECT count(*)::integer FROM public.learner_profiles WHERE user_id = %s),
               (SELECT count(*)::integer FROM public.user_languages WHERE user_id = %s),
               (SELECT count(*)::integer FROM public.user_languages WHERE user_id = %s AND id = %s)""",
        (actor_id, actor_id, actor_id, actor_id, profile_id),
    ).fetchone()
    if identity is None or any(type(value) is not int or not 0 <= value <= 20 for value in identity):
        raise ProbeError
    user_rows, learner_profile_rows, language_profile_rows, bound_rows = identity

    save_counts = connection.execute(
        """SELECT
               (SELECT count(*)::integer FROM public.user_saved_concepts
                WHERE user_id = %s AND concept_id = %s),
               (SELECT count(*)::integer FROM public.concept_save_intents
                WHERE user_id = %s AND concept_id = %s),
               (SELECT count(*)::integer FROM public.learning_events AS event
                JOIN public.concept_save_intents AS intent
                  ON event.source_type = 'concept_save_intent'
                 AND event.source_event_id = intent.id AND event.user_id = intent.user_id
                WHERE intent.user_id = %s AND intent.concept_id = %s
                  AND event.event_type = 'learning.concept.saved.v1'),
               (SELECT count(*)::integer FROM public.review_items
                WHERE user_id = %s AND concept_id = %s),
               (SELECT count(*)::integer FROM public.fsrs_states AS memory
                JOIN public.review_items AS item ON item.id = memory.review_item_id
                WHERE item.user_id = %s AND item.concept_id = %s)""",
        (actor_id, K2_ANCHOR_CONCEPT_ID, actor_id, K2_ANCHOR_CONCEPT_ID,
         actor_id, K2_ANCHOR_CONCEPT_ID, actor_id, K2_ANCHOR_CONCEPT_ID,
         actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchone()
    if save_counts is None or any(type(value) is not int or not 0 <= value <= 100 for value in save_counts):
        raise ProbeError

    concept_rows = connection.execute(
        """SELECT status, mastery::text, confidence::text, exposure_count, last_seen_at,
                  state_version, has_learning_intent, has_projectable_evidence,
                  recognition::text, recognition_confidence::text, recognition_evidence_count,
                  recognition_last_evidence_at,
                  listening::text, listening_confidence::text, listening_evidence_count,
                  listening_last_evidence_at,
                  production::text, production_confidence::text, production_evidence_count,
                  production_last_evidence_at
           FROM public.user_concept_states
           WHERE user_id = %s AND concept_id = %s""",
        (actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchall()
    if len(concept_rows) > 1:
        raise ProbeError
    if concept_rows:
        row = concept_rows[0]
        status = row[0]
        if status not in {"unseen", "discovered", "learning", "familiar", "active", "mastered", "weak", "forgotten"}:
            raise ProbeError
        concept = {
            "rowCount": 1,
            "status": status,
            "mastery": _frll_decimal(row[1]),
            "confidence": _frll_decimal(row[2]),
            "exposureCount": row[3],
            "lastSeenAt": _frll_timestamp(row[4]),
            "stateVersion": row[5],
            "hasLearningIntent": row[6],
            "hasProjectableEvidence": row[7],
            "recognition": {"score": _frll_decimal(row[8]), "confidence": _frll_decimal(row[9]),
                            "evidenceCount": row[10], "lastEvidenceAt": _frll_timestamp(row[11])},
            "listening": {"score": _frll_decimal(row[12]), "confidence": _frll_decimal(row[13]),
                           "evidenceCount": row[14], "lastEvidenceAt": _frll_timestamp(row[15])},
            "production": {"score": _frll_decimal(row[16]), "confidence": _frll_decimal(row[17]),
                           "evidenceCount": row[18], "lastEvidenceAt": _frll_timestamp(row[19])},
        }
        if (type(concept["exposureCount"]) is not int or concept["exposureCount"] < 0 or
            type(concept["stateVersion"]) is not int or concept["stateVersion"] < 1 or
            type(concept["hasLearningIntent"]) is not bool or
            type(concept["hasProjectableEvidence"]) is not bool):
            raise ProbeError
        for dimension in ("recognition", "listening", "production"):
            details = concept[dimension]
            if (details["score"] is None or details["confidence"] is None or
                type(details["evidenceCount"]) is not int or details["evidenceCount"] < 0):
                raise ProbeError
    else:
        empty_dimension = {"score": None, "confidence": None, "evidenceCount": None, "lastEvidenceAt": None}
        concept = {
            "rowCount": 0, "status": None, "mastery": None, "confidence": None,
            "exposureCount": None, "lastSeenAt": None, "stateVersion": None,
            "hasLearningIntent": None, "hasProjectableEvidence": None,
            "recognition": empty_dimension, "listening": empty_dimension, "production": empty_dimension,
        }

    memory_rows = connection.execute(
        """SELECT memory.state, memory.state_version, memory.due_at, memory.last_review_at,
                  memory.difficulty::text, memory.stability::text,
                  memory.params_version, memory.step
           FROM public.fsrs_states AS memory
           JOIN public.review_items AS item ON item.id = memory.review_item_id AND item.user_id = memory.user_id
           WHERE item.user_id = %s AND item.concept_id = %s""",
        (actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchall()
    if len(memory_rows) > 1:
        raise ProbeError
    if memory_rows:
        memory_row = memory_rows[0]
        if (memory_row[0] not in {"new", "learning", "review", "relearning"} or
            type(memory_row[1]) is not int or memory_row[1] < 1 or
            not isinstance(memory_row[6], str) or not 1 <= len(memory_row[6]) <= 64):
            raise ProbeError
        state = memory_row[0]
        due_at = _frll_timestamp(memory_row[2])
        last_review_at = _frll_timestamp(memory_row[3])
        difficulty = _frll_decimal(memory_row[4])
        stability = _frll_decimal(memory_row[5])
        step = memory_row[7]
        if due_at is None:
            raise ProbeError
        if state == "new":
            if (
                last_review_at is not None
                or difficulty is not None
                or stability is not None
                or step is not None
            ):
                raise ProbeError
        elif state == "review":
            if (
                last_review_at is None
                or difficulty is None
                or stability is None
                or step is not None
            ):
                raise ProbeError
        elif (
            last_review_at is None
            or difficulty is None
            or stability is None
            or type(step) is not int
            or step < 0
        ):
            raise ProbeError
        memory = {
            "rowCount": 1, "state": state, "stateVersion": memory_row[1],
            "dueAt": due_at, "lastReviewedAt": last_review_at,
            "difficulty": difficulty, "stability": stability, "step": step,
            "paramsVersion": memory_row[6],
        }
    else:
        memory = {
            "rowCount": 0, "state": None, "stateVersion": None, "dueAt": None,
            "lastReviewedAt": None, "difficulty": None, "stability": None, "step": None,
            "paramsVersion": None,
        }

    review_rows = connection.execute(
        """SELECT event.idempotency_key, event.rating, event.response_time_ms, event.correct,
                  event.exercise_mode, event.evidence_mode,
                  event.result_memory_snapshot, event.result_competence_snapshot,
                  (SELECT count(*)::integer FROM public.learning_events AS learning
                   WHERE learning.user_id = event.user_id AND learning.source_type = 'review_event'
                     AND learning.source_event_id = event.id
                     AND learning.event_type = 'learning.review.completed.v1')
           FROM public.review_events AS event
           JOIN public.review_items AS item ON item.id = event.review_item_id AND item.user_id = event.user_id
           WHERE event.user_id = %s AND item.concept_id = %s
           ORDER BY event.created_at, event.id""",
        (actor_id, K2_ANCHOR_CONCEPT_ID),
    ).fetchall()
    if len(review_rows) > 10:
        raise ProbeError
    if review_rows:
        (event_key, rating, response_time_ms, correct, exercise_mode, evidence_mode,
         memory_snapshot, competence_snapshot, learning_count) = review_rows[-1]
        if (rating not in {"again", "hard", "good", "easy"} or
            type(response_time_ms) is not int or response_time_ms < 0 or
            (correct is not None and type(correct) is not bool) or
            exercise_mode not in {
                "self_recall", "multiple_choice", "typing", "cloze", "listening",
            } or
            (correct is not None and exercise_mode != "self_recall") or
            evidence_mode not in {"recognition", "listening", "cloze", "production"} or
            type(learning_count) is not int or not 0 <= learning_count <= 10 or
            not isinstance(event_key, str)):
            raise ProbeError
        review = {
            "eventRows": len(review_rows),
            "reviewLearningEventRows": sum(row[8] for row in review_rows),
            "idempotencyKeyMatched": bool(idempotency_key_sha256 and
                hashlib.sha256(event_key.encode("utf-8")).hexdigest() == idempotency_key_sha256),
            "rating": rating,
            "responseTimeMs": response_time_ms,
            "correct": correct,
            "exerciseMode": exercise_mode,
            "evidenceMode": evidence_mode,
            "resultMemory": _frll_snapshot_memory(memory_snapshot),
            "resultCompetence": _frll_snapshot_competence(competence_snapshot),
        }
    else:
        review = {
            "eventRows": 0, "reviewLearningEventRows": 0, "idempotencyKeyMatched": False,
            "rating": None, "responseTimeMs": None, "correct": None,
            "exerciseMode": None, "evidenceMode": None,
            "resultMemory": None, "resultCompetence": None,
        }

    head_rows = connection.execute(
        """SELECT next_ingestion_sequence, projection_method_version, state_version
           FROM public.user_language_projection_heads
           WHERE user_id = %s AND user_language_id = %s""",
        (actor_id, profile_id),
    ).fetchall()
    if len(head_rows) > 1:
        raise ProbeError
    if head_rows:
        next_sequence, method_version, projection_state_version = head_rows[0]
        if (type(next_sequence) is not int or next_sequence < 1 or
            not isinstance(method_version, str) or not 1 <= len(method_version) <= 64 or
            type(projection_state_version) is not int or projection_state_version < 1):
            raise ProbeError
        projection_head = {
            "headRows": 1, "nextIngestionSequence": next_sequence,
            "methodVersion": method_version, "stateVersion": projection_state_version,
        }
    else:
        projection_head = {"headRows": 0, "nextIngestionSequence": None,
                           "methodVersion": None, "stateVersion": None}

    skill_rows = connection.execute(
        """SELECT skill, score::text, confidence::text, evidence_count, state_version,
                  last_evidence_at, method_version
           FROM public.user_skill_states
           WHERE user_id = %s AND user_language_id = %s
           ORDER BY skill""",
        (actor_id, profile_id),
    ).fetchall()
    if len(skill_rows) > 3:
        raise ProbeError
    skills: list[dict[str, Any]] = []
    for skill, score, confidence, evidence_count, state_version, last_evidence_at, method_version in skill_rows:
        if (skill not in {"recognition", "listening", "production"} or
            _frll_decimal(score) is None or _frll_decimal(confidence) is None or
            type(evidence_count) is not int or evidence_count < 0 or
            type(state_version) is not int or state_version < 1 or
            not isinstance(method_version, str) or not 1 <= len(method_version) <= 64):
            raise ProbeError
        skills.append({
            "skill": skill, "score": _frll_decimal(score), "confidence": _frll_decimal(confidence),
            "evidenceCount": evidence_count, "stateVersion": state_version,
            "lastEvidenceAt": _frll_timestamp(last_evidence_at), "methodVersion": method_version,
        })
    if len({item["skill"] for item in skills}) != len(skills):
        raise ProbeError

    return {
        "identity": {
            "userRows": user_rows, "learnerProfileRows": learner_profile_rows,
            "languageProfileRows": language_profile_rows, "profileBound": bound_rows == 1,
        },
        "save": {
            "savedMembershipRows": save_counts[0], "saveIntentRows": save_counts[1],
            "saveLearningEventRows": save_counts[2], "reviewItemRows": save_counts[3],
            "fsrsStateRows": save_counts[4],
        },
        "concept": concept,
        "memory": memory,
        "review": review,
        "projection": {**projection_head, "skillRows": len(skills), "skills": skills},
    }


def _today_review_targets(
    connection: psycopg.Connection[tuple[Any, ...]], actor_id: UUID
) -> dict[str, Any]:
    row = connection.execute(
        """
        WITH latest_plan AS (
            SELECT id, engine_version
            FROM public.today_plans
            WHERE user_id = %s
            ORDER BY as_of DESC, id DESC
            LIMIT 1
        )
        SELECT plan.engine_version,
               count(DISTINCT activity.id)::integer,
               count(DISTINCT activity.id) FILTER (
                   WHERE activity.activity_type = 'review'
               )::integer,
               max(activity.target_count) FILTER (
                   WHERE activity.activity_type = 'review'
               ),
               COALESCE((
                   SELECT array_agg(target.review_item_id ORDER BY target.position)
                   FROM (
                       SELECT mapping.review_item_id, mapping.position
                       FROM public.today_plan_activities AS review_activity
                       JOIN public.today_activity_review_items AS mapping
                         ON mapping.activity_id = review_activity.id
                        AND mapping.user_id = review_activity.user_id
                       WHERE review_activity.plan_id = plan.id
                         AND review_activity.user_id = %s
                         AND review_activity.activity_type = 'review'
                       ORDER BY mapping.position
                       LIMIT 182
                   ) AS target
               ), ARRAY[]::uuid[])
        FROM latest_plan AS plan
        LEFT JOIN public.today_plan_activities AS activity
          ON activity.plan_id = plan.id AND activity.user_id = %s
        GROUP BY plan.id, plan.engine_version
        """,
        (actor_id, actor_id, actor_id),
    ).fetchone()
    if row is None:
        return {
            "engineVersion": None,
            "activityCount": 0,
            "reviewActivityCount": 0,
            "targetCount": 0,
            "reviewItemIds": [],
        }

    engine_version, activity_count, review_activity_count, target_count, raw_ids = row
    review_item_ids = [] if raw_ids is None else [str(value) for value in raw_ids]
    normalized_target_count = 0 if target_count is None else int(target_count)
    if (
        not isinstance(engine_version, str)
        or not 0 <= int(activity_count) <= 20
        or not 0 <= int(review_activity_count) <= 1
        or not 0 <= normalized_target_count <= 181
        or len(review_item_ids) != normalized_target_count
        or len(set(review_item_ids)) != len(review_item_ids)
    ):
        raise ProbeError
    return {
        "engineVersion": engine_version,
        "activityCount": int(activity_count),
        "reviewActivityCount": int(review_activity_count),
        "targetCount": normalized_target_count,
        "reviewItemIds": review_item_ids,
    }


def main() -> int:
    action = os.environ.get("K2_ACCEPTANCE_PROBE_ACTION", "")
    actor_value = os.environ.get("K2_ACCEPTANCE_ACTOR_ID", "")
    profile_value = os.environ.get("K2_ACCEPTANCE_PROFILE_ID", "")
    concept_values = os.environ.get("K2_ACCEPTANCE_CONCEPT_IDS", "")
    idempotency_key_sha256 = os.environ.get("K2_ACCEPTANCE_IDEMPOTENCY_KEY_SHA256", "")
    try:
        if os.environ.get("K2_ACCEPTANCE_IDEMPOTENCY_KEY") is not None:
            raise ProbeError
        actor_id = UUID(actor_value) if actor_value else None
        profile_id = UUID(profile_value) if profile_value else None
        raw_concepts = json.loads(concept_values) if concept_values else None
        due_concept_ids = None
        if raw_concepts is not None:
            if (
                not isinstance(raw_concepts, list)
                or len(raw_concepts) != 20
                or any(not isinstance(value, str) for value in raw_concepts)
            ):
                raise ProbeError
            due_concept_ids = [UUID(value) for value in raw_concepts]
            if len(set(due_concept_ids)) != 20 or any(
                str(value) != raw for value, raw in zip(due_concept_ids, raw_concepts, strict=True)
            ):
                raise ProbeError
        if action not in {
            "retained_snapshot",
            "actor_snapshot",
            "actor_lineage",
            "migrations",
            "actor_ownership_graph",
            "actor_absent",
            "anchor_material",
            "today_review_targets",
            "k208_fixture_privilege_preflight",
            "k208_catalog_preflight",
            "k208_candidate_base",
            "k208_due_candidate_overlap",
            "frll_anchor_semantic_proof",
        }:
            raise ProbeError
        if (
            action in {"actor_snapshot", "actor_lineage", "actor_absent", "today_review_targets",
                       "frll_anchor_semantic_proof"}
            and actor_id is None
        ):
            raise ProbeError
        if action in {"k208_candidate_base", "k208_due_candidate_overlap", "frll_anchor_semantic_proof"}:
            if actor_id is None or profile_id is None:
                raise ProbeError
        elif profile_id is not None:
            raise ProbeError
        if idempotency_key_sha256 and (
            action != "frll_anchor_semantic_proof"
            or not re.fullmatch(r"[a-f0-9]{64}", idempotency_key_sha256)
        ):
            raise ProbeError
        if action == "k208_due_candidate_overlap":
            if due_concept_ids is None:
                raise ProbeError
        elif due_concept_ids is not None:
            raise ProbeError
        if (
            action in {"k208_fixture_privilege_preflight", "k208_catalog_preflight"}
            and actor_id is not None
        ):
            raise ProbeError

        with _connection() as connection:
            if action == "migrations":
                _table_inventory(connection)
                output: dict[str, Any] = _migration_head(connection)
            elif action == "actor_ownership_graph":
                _table_inventory(connection)
                _migration_head(connection)
                output = _actor_ownership_graph(connection)
            elif action == "anchor_material":
                _table_inventory(connection)
                _migration_head(connection)
                output = _anchor_material(connection)
            elif action == "k208_fixture_privilege_preflight":
                output = _k208_fixture_privilege_preflight(connection)
            elif action == "k208_catalog_preflight":
                output = _k208_catalog_preflight(connection)
            elif action == "k208_candidate_base":
                if actor_id is None or profile_id is None:
                    raise ProbeError
                output = _k208_candidate_base(connection, actor_id, profile_id)
            elif action == "k208_due_candidate_overlap":
                if actor_id is None or profile_id is None or due_concept_ids is None:
                    raise ProbeError
                output = _k208_due_candidate_overlap(
                    connection, actor_id, profile_id, due_concept_ids
                )
            elif action == "frll_anchor_semantic_proof":
                if actor_id is None or profile_id is None:
                    raise ProbeError
                output = _frll_semantic_proof(
                    connection, actor_id, profile_id, idempotency_key_sha256 or None
                )
            elif action == "actor_lineage":
                if actor_id is None:
                    raise ProbeError
                output = _actor_lineage(connection, actor_id)
            elif action == "today_review_targets":
                if actor_id is None:
                    raise ProbeError
                output = _today_review_targets(connection, actor_id)
            elif action == "retained_snapshot":
                output = _snapshot(connection, None)
            else:
                snapshot = _snapshot(connection, actor_id)
                if action == "actor_absent" and snapshot["totalRows"] != 0:
                    raise ProbeError
                output = snapshot
        sys.stdout.write(json.dumps(output, sort_keys=True, separators=(",", ":")))
        return 0
    except Exception:
        sys.stderr.write("K2 hosted acceptance read-only probe failed closed.\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
