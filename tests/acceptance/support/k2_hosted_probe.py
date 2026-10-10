"""Read-only, bounded proof for the K2 hosted acceptance runner."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import UTC, datetime, timezone
from decimal import Decimal
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
PILOT_READER_EXPECTED_APP_MIGRATIONS = (
    ("0001", "core_schema_v1", "5fdafed11c84fab783710a8e91975823a1145cb790b118717429dbe8b99f91b1"),
    ("0002", "memory_engine_fsrs_v1", "5acd2108dd226d6554e42f62906f6789f202c5ca7e8841c1953e31f965f4c2c5"),
    ("0003", "review_idempotency_result_v1", "f4c57bd2f69a643e96750f2990bea6ce65d87a37dfe4db6990422ec2cbe38352"),
    ("0004", "learner_evidence_competence_v1", "3b83d20ac1b6f6bab22098f7dd20f79d55c5fc753b247355b461804a517e034f"),
    ("0005", "reader_content_service_v1", "c9ce8e8c4cbc97c586a1862d3b8cd9195b12d89ac2e1a58eb9b33beadd29aa1c"),
    ("0006", "today_engine_heuristic_v1", "5c4a3f05197c7ad8f51a77315faa2c85395df3326b80ae149c966abeba85ed7c"),
    ("0007", "profile_language_auth_bootstrap_v1", "830ac90cdec081595487b2ac69e9780d0dfbc913810943bb2d4482ac744404c6"),
    ("0008", "starting_level_estimate_v1", "b76075886ffc2d3c0ecb8c9a1064e7b66832fe6b579331898a78c41fa0ee8687"),
    ("0009", "library_concept_save_intent_v1", "25e30a361bb340890d11299e85721c3d0e02bb9c95e76f4ca9429333bb9bca46"),
    ("0010", "supabase_public_data_api_lockdown_v1", "204f68779b61e8658b0530e1f69c26e51882652d4f2a0dc11a60553e771e79b1"),
    ("0011", "supabase_public_function_execute_lockdown_v1", "204852a4b6db4ed3cedf2eff215dcce2a8413d4a4324a4997f8d13d76c78e4dc"),
    ("0012", "supabase_public_schema_browser_lockdown_v1", "7d590e0324909afc98c9b8a5973b7fa3212235aa25bcbaec030688d1447929bd"),
    ("0013", "supabase_public_function_default_execute_lockdown_v1", "0dbdeda5f8fadee2a6d4d3790e0c67ecb5a5fae16b025e8fd8fa6486d5d9ed4e"),
    ("0014", "knowledge_v2_canonical_structures", "9dee05acb17f002f21dd3465d838953da33f57037ba621b274c69829e3348fd3"),
    ("0015", "knowledge_v2_polysemy_resolution", "7a4af88604d164627fc35b389a4cbaf678fee1946e41b4b110059c2936b00fc8"),
    ("0016", "knowledge_v2_graph_dag", "7d6b44285247b6c5897ffd0f89f70589f0c216baf6eff4272a84395ae5c48a6f"),
    ("0017", "knowledge_v2_learner_retrievability", "0bcdaea9705e8f3a80ce0a7f124481aed2ea8b426eba346072c22d992acb8e8d"),
    ("0018", "profile_replay_auth_erasure", "235df17290f98606a7964674a77c6cadef1fb1b1fdd83eaa766e1486077e84f1"),
    ("0019", "concept_save_intent_auth_erasure", "62fb829f1db617db5e84b2219a4270989de0b6df314c38e92c2f7747aec39f2c"),
    ("0020", "today_remediation_reason_codes", "afe0163c081ba91f0d2f42d24b3059feb809fc26e40f1c9cc7b615b2e0f389e3"),
    ("0021", "k2_09_hosted_fixture_control", "3c984a59afe9031ee5480a4fa111d5fb239b5f7164af39289712f1e98ad45ca6"),
    ("0022", "reader_history_auth_erasure", "1924d92b88e9f20ed1264850830a4f8f4794dad21f07a79d0a9b284b482ac858"),
)
PILOT_READER_EXPECTED_PLATFORM_PRIOR = (
    ("20260915154706", "supabase_public_data_api_lockdown_v1"),
    ("20260916001615", "supabase_public_function_execute_lockdown_v1"),
    ("20260916001828", "supabase_public_schema_browser_lockdown_v1"),
    ("20260916044338", "knowledge_catalog_indexes_v1"),
    ("20260920231552", "supabase_public_function_default_execute_lockdown_v1"),
    ("20260921234533", "knowledge_v2_canonical_structures"),
    ("20260922100838", "knowledge_v2_polysemy_resolution"),
    ("20260922101401", "knowledge_v2_graph_dag"),
    ("20260923081253", "knowledge_v2_learner_retrievability_0017"),
    ("20260927021246", "profile_replay_auth_erasure_0018"),
    ("20260927034218", "concept_save_intent_auth_erasure_0019"),
    ("20260928164141", "k2_hosted_acceptance_reader_staging"),
    ("20261001112955", "today_remediation_reason_codes_0020"),
    ("20261007201853", "k2_09_hosted_fixture_control_0021"),
)
PILOT_READER_EXPECTED_PLATFORM_0022_NAME = "reader_history_auth_erasure_0022"
# Exact platform migration version read back after the reviewed migration-only hosted apply.
PILOT_READER_EXPECTED_PLATFORM_0022_VERSION: str | None = "20261010174303"
PILOT_READER_CANDIDATE_SHA256 = "25bad1e7e228211508477937752fb647696dc3cf1c76cd2fce53a7f81609b19f"
PILOT_READER_BODY_SHA256 = "180a51f21f5e26e43d49abcf2a828ae3b6b72a04671c101fbf1dfb5d7cd93e5e"
PILOT_READER_PUBLICATION_MANIFEST_SHA256 = (
    "724014360eb401de10d2e72c897834b4e177f32a131a6a7ca331d3aa03135200"
)
PILOT_READER_LICENSE_CODE = "LINGUA-FIRST-PARTY"
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
PILOT_READER_STABLE_TABLES = (
    "exposure_events",
    "learning_events",
    "reader_exposure_concepts",
    "user_concept_states",
)


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
    connection: psycopg.Connection[tuple[Any, ...]],
    actor_id: UUID | None,
    *,
    exclude_actor_id: UUID | None = None,
) -> dict[str, Any]:
    if actor_id is not None and exclude_actor_id is not None:
        raise ProbeError
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
        elif exclude_actor_id is not None:
            query += sql.SQL(" WHERE {} IS DISTINCT FROM %s").format(
                sql.Identifier(owner_column)
            )
            parameters = (exclude_actor_id,)
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


def _pilot_reader_migration_head(
    connection: psycopg.Connection[tuple[Any, ...]],
) -> dict[str, Any]:
    platform_0022_version = PILOT_READER_EXPECTED_PLATFORM_0022_VERSION
    if (
        not isinstance(platform_0022_version, str)
        or not re.fullmatch(r"\d{14}", platform_0022_version)
    ):
        raise ProbeError

    app_rows = connection.execute(
        "SELECT version, name, checksum FROM public.schema_migrations ORDER BY version"
    ).fetchall()
    if app_rows != list(PILOT_READER_EXPECTED_APP_MIGRATIONS):
        raise ProbeError

    platform_rows = connection.execute(
        "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
    ).fetchall()
    expected_platform = [
        *PILOT_READER_EXPECTED_PLATFORM_PRIOR,
        (platform_0022_version, PILOT_READER_EXPECTED_PLATFORM_0022_NAME),
    ]
    if (
        platform_rows != expected_platform
        or int(platform_0022_version) <= int(PILOT_READER_EXPECTED_PLATFORM_PRIOR[-1][0])
    ):
        raise ProbeError

    app_privileges = connection.execute(
        """SELECT has_column_privilege(current_user, 'public.schema_migrations',
                                         'version', 'SELECT'),
                  has_column_privilege(current_user, 'public.schema_migrations',
                                         'name', 'SELECT'),
                  has_column_privilege(current_user, 'public.schema_migrations',
                                         'checksum', 'SELECT'),
                  has_table_privilege(current_user, 'public.schema_migrations', 'SELECT'),
                  has_table_privilege(current_user, 'public.schema_migrations', 'INSERT'),
                  has_table_privilege(current_user, 'public.schema_migrations', 'UPDATE'),
                  has_table_privilege(current_user, 'public.schema_migrations', 'DELETE'),
                  has_table_privilege(current_user, 'public.schema_migrations', 'TRUNCATE')"""
    ).fetchone()
    if app_privileges != (True, True, True, True, False, False, False, False):
        raise ProbeError

    platform_privileges = connection.execute(
        """SELECT has_column_privilege(current_user, 'supabase_migrations.schema_migrations',
                                         'version', 'SELECT'),
                  has_column_privilege(current_user, 'supabase_migrations.schema_migrations',
                                         'name', 'SELECT'),
                  has_table_privilege(current_user, 'supabase_migrations.schema_migrations',
                                      'SELECT'),
                  has_column_privilege(current_user, 'supabase_migrations.schema_migrations',
                                       'statements', 'SELECT'),
                  has_table_privilege(current_user, 'supabase_migrations.schema_migrations',
                                      'INSERT'),
                  has_table_privilege(current_user, 'supabase_migrations.schema_migrations',
                                      'UPDATE'),
                  has_table_privilege(current_user, 'supabase_migrations.schema_migrations',
                                      'DELETE'),
                  has_table_privilege(current_user, 'supabase_migrations.schema_migrations',
                                      'TRUNCATE')"""
    ).fetchone()
    if platform_privileges != (True, True, False, False, False, False, False, False):
        raise ProbeError
    return {"appMigrationHead": "0022", "appliedMigrations": 22}


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


def _pilot_reader_manifest_files() -> tuple[dict[str, Any], dict[str, Any]]:
    root = Path(__file__).resolve().parents[3]
    candidate_path = (
        root / "knowledge" / "staging" / "pilot-reader-vi-draft" / "translation-draft.json"
    )
    manifest_path = (
        root / "knowledge" / "staging" / "pilot-reader-vi-draft" / "publication-manifest.json"
    )
    try:
        candidate_bytes = candidate_path.read_bytes()
        manifest_bytes = manifest_path.read_bytes()
        if hashlib.sha256(candidate_bytes).hexdigest() != PILOT_READER_CANDIDATE_SHA256:
            raise ProbeError
        if hashlib.sha256(manifest_bytes).hexdigest() != PILOT_READER_PUBLICATION_MANIFEST_SHA256:
            raise ProbeError
        candidate = json.loads(candidate_bytes)
        manifest = json.loads(manifest_bytes)
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise ProbeError from None
    if not isinstance(candidate, dict) or not isinstance(manifest, dict):
        raise ProbeError

    approval = manifest.get("owner_approval")
    content = manifest.get("content")
    translation = manifest.get("translationSource")
    sentences = candidate.get("sentences")
    if (
        manifest.get("schema_version") != "lingua.pilot.reader-publication.v1"
        or manifest.get("scope") != "staging_only"
        or manifest.get("candidate_id") != "pilot-reader-tea-vi-v1"
        or manifest.get("candidate_sha256") != PILOT_READER_CANDIDATE_SHA256
        or manifest.get("candidate_body_sha256") != PILOT_READER_BODY_SHA256
        or manifest.get("sentence_count") != 72
        or manifest.get("identity_policy")
        != (
            "Resolve exactly one normally published content identity matching this manifest "
            "and the complete approved candidate. Keep that identity transient in the "
            "runner; preserve the previous published item and learner references."
        )
        or not isinstance(approval, dict)
        or approval.get("exact_candidate_editorial_rights_and_staging_scope") is not True
        or approval.get("publication_requires_normal_admin_validation_and_reviewed_runtime")
        is not True
        or approval.get("supersedes_historical_candidate_pending_flags") is not True
        or approval.get("inherits_pr38_approval") is not False
        or not isinstance(content, dict)
        or not isinstance(translation, dict)
        or candidate.get("title") != content.get("title")
        or candidate.get("language") != content.get("languageCode")
        or candidate.get("candidate_body_sha256") != PILOT_READER_BODY_SHA256
        or not isinstance(candidate.get("body"), str)
        or not isinstance(sentences, list)
        or len(sentences) != 72
    ):
        raise ProbeError

    expected_pairs: list[tuple[int, str, str]] = []
    for ordinal, sentence in enumerate(sentences, start=1):
        if (
            not isinstance(sentence, dict)
            or sentence.get("ordinal") != ordinal
            or not isinstance(sentence.get("english"), str)
            or not isinstance(sentence.get("vietnamese"), str)
            or not sentence["english"].strip()
            or not sentence["vietnamese"].strip()
            or "\n" in sentence["english"]
            or "\t" in sentence["english"]
            or "\n" in sentence["vietnamese"]
            or "\t" in sentence["vietnamese"]
            or hashlib.sha256(sentence["english"].encode("utf-8")).hexdigest()
            != sentence.get("english_sha256")
        ):
            raise ProbeError
        expected_pairs.append((ordinal, sentence["english"], sentence["vietnamese"]))

    body = candidate["body"]
    if (
        body != " ".join(pair[1] for pair in expected_pairs)
        or hashlib.sha256(body.encode("utf-8")).hexdigest() != PILOT_READER_BODY_SHA256
    ):
        raise ProbeError
    return manifest, {"pairs": expected_pairs, "body": body}


def _pilot_reader_translation_raw_hash(
    source: dict[str, Any], pairs: list[tuple[int, str, str]]
) -> str:
    entries = [
        {"ordinal": ordinal, "sourceText": english, "translationText": vietnamese}
        for ordinal, english, vietnamese in pairs
    ]
    canonical = {
        "targetLanguageCode": "vi",
        "source": {
            "authorName": source["authorName"],
            "sourceName": source["sourceName"],
            "sourceVersion": source["sourceVersion"],
            "attributionText": source["attributionText"],
            "rightsStatement": source["rightsStatement"],
        },
        "entries": entries,
    }
    return hashlib.sha256(
        json.dumps(
            canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()


def _pilot_reader_catalog_manifest(
    connection: psycopg.Connection[tuple[Any, ...]],
) -> dict[str, Any]:
    _table_inventory(connection)
    manifest, candidate = _pilot_reader_manifest_files()
    expected_content = manifest["content"]
    expected_translation = manifest["translationSource"]

    identity_rows = connection.execute(
        """SELECT item.id, item.title, item.language_code, item.publication_status,
                  item.content_type, level.code, version.version, version.content_hash,
                  public.reader_content_passes_publication_gate(item.id),
                  source.source_type, source.name, source.source_version,
                  source.attribution_text, license.code, license.usage_policy,
                  record.review_status, record.quality_score,
                  record.metadata ->> 'authorName',
                  record.metadata ->> 'sourceVersion',
                  record.metadata ->> 'rightsStatement',
                  (SELECT count(*) FROM public.content_versions AS all_versions
                   WHERE all_versions.content_id = item.id),
                  item.quality_score,
                  record.metadata ->> 'authoringVersion',
                  record.metadata ->> 'sourceName',
                  record.metadata ->> 'body',
                  record.metadata ->> 'languageCode',
                  record.metadata ->> 'licenseCode'
           FROM public.content_versions AS version
           JOIN public.content_items AS item ON item.id = version.content_id
           JOIN public.proficiency_levels AS level ON level.id = item.curated_level_id
           JOIN public.source_records AS record ON record.id = item.source_record_id
           JOIN public.data_sources AS source ON source.id = record.source_id
           JOIN public.licenses AS license ON license.id = source.license_id
           WHERE version.content_hash = %s
           ORDER BY item.id, version.version
           LIMIT 2""",
        (PILOT_READER_BODY_SHA256,),
    ).fetchall()
    if len(identity_rows) != 1:
        raise ProbeError
    identity = identity_rows[0]
    content_id = identity[0]
    content_provenance = {
        "authorMatched": identity[17] == expected_content.get("authorName"),
        "sourceNameMatched": identity[10] == expected_content.get("sourceName"),
        "sourceVersionMatched": identity[18] == expected_content.get("sourceVersion")
        and identity[11] == f"{expected_content.get('sourceVersion')}#content-{content_id}",
        "attributionMatched": identity[12] == expected_content.get("attributionText"),
        "rightsStatementMatched": identity[19] == expected_content.get("rightsStatement"),
        "approved": identity[15] == "approved" and identity[16] == 1 and identity[21] == 1,
        "firstPartySource": identity[9] == "internal",
        "firstPartyLicense": identity[13] == PILOT_READER_LICENSE_CODE
        and identity[14] == "allowed",
    }
    if (
        not isinstance(content_id, UUID)
        or identity[1] != expected_content.get("title")
        or identity[2] != expected_content.get("languageCode")
        or identity[3] != "published"
        or identity[4] != "article"
        or identity[5] != expected_content.get("level")
        or identity[6] != 1
        or identity[7] != PILOT_READER_BODY_SHA256
        or identity[8] is not True
        or identity[20] != 1
        or identity[22] != "admin-first-party-v1"
        or identity[23] != expected_content.get("sourceName")
        or identity[24] != candidate["body"]
        or identity[25] != expected_content.get("languageCode")
        or identity[26] != PILOT_READER_LICENSE_CODE
        or not all(content_provenance.values())
    ):
        raise ProbeError

    sentence_rows = connection.execute(
        """SELECT segment.order_index, segment.text, sentence.text, translation.text,
                  translation_record.review_status, translation_record.quality_score,
                  translation_record.metadata ->> 'authorName',
                  translation_record.metadata ->> 'sourceVersion',
                  translation_record.metadata ->> 'rightsStatement',
                  translation_source.source_type, translation_source.name,
                  translation_source.source_version, translation_source.attribution_text,
                  translation_license.code, translation_license.usage_policy,
                  translation_record.raw_hash,
                  translation_record.metadata ->> 'authoringVersion',
                  translation_record.metadata ->> 'contentId',
                  translation_record.metadata ->> 'targetLanguageCode',
                  translation_record.metadata ->> 'licenseCode',
                  translation_record.metadata -> 'entries'
           FROM public.content_segments AS segment
           JOIN public.sentences AS sentence
             ON sentence.id = segment.sentence_id
            AND sentence.language_code = segment.language_code
           LEFT JOIN public.sentence_translations AS translation
             ON translation.sentence_id = sentence.id
            AND translation.target_language_code = 'vi'
           LEFT JOIN public.source_records AS translation_record
             ON translation_record.id = translation.source_record_id
           LEFT JOIN public.data_sources AS translation_source
             ON translation_source.id = translation_record.source_id
           LEFT JOIN public.licenses AS translation_license
             ON translation_license.id = translation_source.license_id
           WHERE segment.content_id = %s
           ORDER BY segment.order_index, translation.id
           LIMIT 145""",
        (content_id,),
    ).fetchall()
    expected_pairs = candidate["pairs"]
    expected_translation_hash = _pilot_reader_translation_raw_hash(
        expected_translation, expected_pairs
    )
    expected_translation_entries = [
        {"ordinal": ordinal, "sourceText": english, "translationText": vietnamese}
        for ordinal, english, vietnamese in expected_pairs
    ]
    if len(sentence_rows) != len(expected_pairs):
        raise ProbeError
    translations: list[str] = []
    for ordinal, (row, expected) in enumerate(
        zip(sentence_rows, expected_pairs, strict=True), start=1
    ):
        if (
            row[0] != ordinal - 1
            or row[1] != expected[1]
            or row[2] != expected[1]
            or row[3] != expected[2]
            or row[4] != "approved"
            or row[5] is None
            or row[6] != expected_translation.get("authorName")
            or row[7] != expected_translation.get("sourceVersion")
            or row[8] != expected_translation.get("rightsStatement")
            or row[9] != "internal"
            or row[10] != expected_translation.get("sourceName")
            or row[11] != (
                f"{expected_translation.get('sourceVersion')}#content-{content_id}-translation-"
                f"{expected_translation_hash[:12]}"
            )
            or row[12] != expected_translation.get("attributionText")
            or row[13] != PILOT_READER_LICENSE_CODE
            or row[14] != "allowed"
            or row[15] != expected_translation_hash
            or row[16] != "admin-translation-v1"
            or row[17] != str(content_id)
            or row[18] != "vi"
            or row[19] != PILOT_READER_LICENSE_CODE
            or row[20] != expected_translation_entries
        ):
            raise ProbeError
        translations.append(row[3])

    # This second bounded query obtains only one internal equality key per row;
    # the key is never returned or logged.
    translation_source_rows = connection.execute(
        """SELECT translation.source_record_id
           FROM public.content_segments AS segment
           JOIN public.sentences AS sentence
             ON sentence.id = segment.sentence_id
            AND sentence.language_code = segment.language_code
           JOIN public.sentence_translations AS translation
             ON translation.sentence_id = sentence.id
            AND translation.target_language_code = 'vi'
           WHERE segment.content_id = %s
           ORDER BY segment.order_index, translation.id
           LIMIT 73""",
        (content_id,),
    ).fetchall()
    if len(translation_source_rows) != 72 or len({row[0] for row in translation_source_rows}) != 1:
        raise ProbeError

    concept_row = connection.execute(
        """SELECT count(DISTINCT concept_id)::integer
           FROM public.content_concepts WHERE content_id = %s""",
        (content_id,),
    ).fetchone()
    if concept_row is None or type(concept_row[0]) is not int or concept_row[0] < 1:
        raise ProbeError

    translation_hash = hashlib.sha256(
        "\n".join(
            f"{ordinal}\t{text}" for ordinal, text in enumerate(translations, start=1)
        ).encode("utf-8")
    ).hexdigest()
    pair_hash = hashlib.sha256(
        "\n".join(
            f"{ordinal}\t{english}\t{translation}"
            for ordinal, english, translation in expected_pairs
        ).encode("utf-8")
    ).hexdigest()
    if translation_hash != hashlib.sha256(
        "\n".join(
            f"{ordinal}\t{pair[2]}" for ordinal, pair in enumerate(expected_pairs, start=1)
        ).encode("utf-8")
    ).hexdigest():
        raise ProbeError

    return {
        "contentId": str(content_id),
        "contentCount": 1,
        "segmentCount": len(sentence_rows),
        "sentenceCount": len(sentence_rows),
        "translationCount": len(translations),
        "conceptCount": int(concept_row[0]),
        "candidateSha256": PILOT_READER_CANDIDATE_SHA256,
        "bodySha256": PILOT_READER_BODY_SHA256,
        "translationSha256": translation_hash,
        "pairSha256": pair_hash,
        "contentProvenance": content_provenance,
        "translationProvenance": {
            "sourceRecordCount": len({row[0] for row in translation_source_rows}),
            "authorMatched": True,
            "sourceNameMatched": True,
            "sourceVersionMatched": True,
            "attributionMatched": True,
            "rightsStatementMatched": True,
            "approved": True,
            "firstPartySource": True,
            "firstPartyLicense": True,
        },
    }


def _pilot_reader_passive_concept_state(
    row: tuple[Any, ...],
    concept_id: UUID,
    *,
    recorded_at: datetime,
    parameter_set_id: UUID,
    parameter_version: str,
    projection_method_version: str,
) -> dict[str, Any]:
    (
        actual_concept_id, status, recognition, listening, production, mastery, confidence,
        exposure_count, has_learning_intent, has_projectable_evidence, highest_achievement_status,
        recognition_positive, recognition_negative, recognition_confidence, recognition_evidence,
        recognition_last, listening_positive, listening_negative, listening_confidence,
        listening_evidence, listening_last, production_positive, production_negative,
        production_confidence, production_evidence, production_last, outcomes, language_code,
        state_version, last_seen_at, state_projection_method_version,
        state_parameter_set_id, state_parameter_version, created_at, updated_at,
    ) = row
    try:
        neutral = (
            UUID(str(actual_concept_id)) == concept_id
            and status == "discovered"
            and language_code == "en"
            and Decimal(str(recognition)) == Decimal("0.5")
            and Decimal(str(listening)) == Decimal("0.5")
            and Decimal(str(production)) == Decimal("0.5")
            and mastery is None
            and Decimal(str(confidence)) == Decimal("0")
            and type(exposure_count) is int and exposure_count == 1
            and has_learning_intent is False
            and has_projectable_evidence is False
            and highest_achievement_status is None
            and all(Decimal(str(value)) == Decimal("0") for value in (
                recognition_positive, recognition_negative, recognition_confidence,
                listening_positive, listening_negative, listening_confidence,
                production_positive, production_negative, production_confidence,
            ))
            and recognition_evidence == listening_evidence == production_evidence == 0
            and recognition_last is listening_last is production_last is None
            and outcomes == {"recognition": [], "listening": [], "production": []}
            and state_version == 2
            and _pilot_reader_aware_datetime(last_seen_at) == recorded_at
            and state_projection_method_version == projection_method_version
            and UUID(str(state_parameter_set_id)) == parameter_set_id
            and state_parameter_version == parameter_version
            and _pilot_reader_aware_datetime(created_at) == recorded_at
            and _pilot_reader_aware_datetime(updated_at) == recorded_at
        )
    except (ArithmeticError, TypeError, ValueError):
        neutral = False
    if not neutral:
        raise ProbeError
    return {
        "conceptId": str(concept_id),
        "status": "discovered",
        "exposureCount": 1,
        "passiveOnly": True,
    }


def _pilot_reader_aware_datetime(value: object) -> datetime:
    try:
        parsed = (
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            if isinstance(value, str)
            else value
        )
        if not isinstance(parsed, datetime) or parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ProbeError
        return parsed.astimezone(UTC)
    except (OverflowError, TypeError, ValueError):
        raise ProbeError from None


def _pilot_reader_stable_rows(
    connection: psycopg.Connection[tuple[Any, ...]],
    *,
    actor_id: UUID,
    profile_id: UUID,
    phase: str,
    eligible_ids: list[UUID],
    expected_exposure_id: UUID | None,
) -> dict[str, dict[str, Any]]:
    if phase not in {"before", "after"} or (phase == "after") != (expected_exposure_id is not None):
        raise ProbeError

    tables: dict[str, dict[str, Any]] = {}
    total_rows = 0
    total_bytes = 0
    for table_name in PILOT_READER_STABLE_TABLES:
        query = sql.SQL(
            "SELECT to_jsonb(row_data)::text FROM public.{} AS row_data "
            "WHERE row_data.user_id = %s"
        ).format(sql.Identifier(table_name))
        parameters: tuple[Any, ...] = (actor_id,)
        if phase == "after":
            if table_name == "exposure_events":
                query += sql.SQL(" AND row_data.id <> %s")
                parameters += (expected_exposure_id,)
            elif table_name == "reader_exposure_concepts":
                query += sql.SQL(" AND row_data.exposure_event_id <> %s")
                parameters += (expected_exposure_id,)
            elif table_name == "learning_events":
                query += sql.SQL(
                    " AND NOT (row_data.source_type = 'exposure_event' "
                    "AND row_data.source_event_id = %s)"
                )
                parameters += (expected_exposure_id,)
            else:
                query += sql.SQL(
                    " AND NOT (row_data.user_language_id = %s "
                    "AND row_data.concept_id = ANY(%s))"
                )
                parameters += (profile_id, eligible_ids)
        query += sql.SQL(' ORDER BY to_jsonb(row_data)::text COLLATE "C"')

        digest = hashlib.sha256()
        row_count = 0
        with connection.cursor(name=f"pilot_reader_stable_{table_name}") as cursor:
            cursor.execute(query, parameters)
            while batch := cursor.fetchmany(500):
                for (serialized,) in batch:
                    if not isinstance(serialized, str):
                        raise ProbeError
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
    return tables


def _pilot_reader_completion(
    connection: psycopg.Connection[tuple[Any, ...]],
    *,
    actor_id: UUID,
    profile_id: UUID,
    concept_ids: list[UUID],
    binding: dict[str, Any],
    idempotency_key_sha256: str | None,
) -> dict[str, Any]:
    _table_inventory(connection)
    phase = binding.get("phase")
    content_id = UUID(str(binding.get("contentId")))
    segment_id = UUID(str(binding.get("segmentId")))
    if phase not in {"before", "after"}:
        raise ProbeError
    profile = connection.execute(
        "SELECT language_code, status FROM public.user_languages WHERE id = %s AND user_id = %s",
        (profile_id, actor_id),
    ).fetchone()
    if profile != ("en", "active"):
        raise ProbeError
    segment = connection.execute(
        """SELECT item.publication_status, item.language_code,
                  public.reader_content_passes_publication_gate(item.id),
                  target.order_index,
                  (SELECT count(*)::integer FROM public.content_segments AS all_segments
                   WHERE all_segments.content_id = item.id)
           FROM public.content_items AS item
           JOIN public.content_segments AS target ON target.content_id = item.id
           WHERE item.id = %s AND target.id = %s""",
        (content_id, segment_id),
    ).fetchone()
    if segment != ("published", "en", True, 71, 72):
        raise ProbeError
    eligible_rows = connection.execute(
        """SELECT DISTINCT occurrence.concept_id
           FROM public.content_segments AS target
           JOIN public.sentence_concepts AS occurrence
             ON occurrence.sentence_id = target.sentence_id
            AND occurrence.language_code = 'en'
           WHERE target.id = %s AND target.content_id = %s
           ORDER BY occurrence.concept_id
           LIMIT 1001""",
        (segment_id, content_id),
    ).fetchall()
    eligible_ids = [UUID(str(row[0])) for row in eligible_rows]
    if not eligible_ids or len(eligible_ids) > 1000 or eligible_ids != sorted(set(eligible_ids)):
        raise ProbeError
    if eligible_ids != sorted(concept_ids) or len(concept_ids) != len(set(concept_ids)):
        raise ProbeError

    exposure_rows = connection.execute(
        """SELECT id, user_language_id, language_code, exposure_type, content_id,
                  content_segment_id, idempotency_key, result_snapshot, created_at, occurred_at
           FROM public.exposure_events
           WHERE user_id = %s AND user_language_id = %s
             AND content_id = %s AND content_segment_id = %s
           ORDER BY id
           LIMIT 2""",
        (actor_id, profile_id, content_id, segment_id),
    ).fetchall()
    link_rows: list[tuple[Any, ...]] = []
    learning_rows: list[tuple[Any, ...]] = []
    exposure_ids = [UUID(str(row[0])) for row in exposure_rows]
    expected_recorded_at: datetime | None = None
    expected_occurred_at: datetime | None = None
    expected_exposure_id: UUID | None = None
    if phase == "before":
        if exposure_rows or "projectionHeadBefore" in binding:
            raise ProbeError
    else:
        expected_exposure_id = UUID(str(binding.get("exposureId")))
        if idempotency_key_sha256 is None or len(exposure_rows) != 1:
            raise ProbeError
        exposure = exposure_rows[0]
        (
            actual_id, actual_profile, language_code, exposure_type, actual_content,
            actual_segment, idempotency_key, result_snapshot, exposure_created_at,
            exposure_occurred_at,
        ) = exposure
        if (
            UUID(str(actual_id)) != expected_exposure_id
            or UUID(str(actual_profile)) != profile_id
            or language_code != "en"
            or exposure_type != "read"
            or UUID(str(actual_content)) != content_id
            or UUID(str(actual_segment)) != segment_id
            or hashlib.sha256(str(idempotency_key).encode("ascii")).hexdigest()
            != idempotency_key_sha256
            or not isinstance(result_snapshot, dict)
            or set(result_snapshot) != {
                "acceptedConceptCount", "contentId", "exposureId", "exposureType",
                "occurredAt", "recordedAt", "segmentId",
            }
            or result_snapshot.get("acceptedConceptCount") != len(eligible_ids)
            or result_snapshot.get("contentId") != str(content_id)
            or result_snapshot.get("exposureId") != str(expected_exposure_id)
            or result_snapshot.get("exposureType") != "read"
            or result_snapshot.get("segmentId") != str(segment_id)
        ):
            raise ProbeError
        expected_recorded_at = _pilot_reader_aware_datetime(result_snapshot.get("recordedAt"))
        expected_occurred_at = _pilot_reader_aware_datetime(result_snapshot.get("occurredAt"))
        if _pilot_reader_aware_datetime(exposure_created_at) != expected_recorded_at:
            raise ProbeError
        if _pilot_reader_aware_datetime(exposure_occurred_at) != expected_occurred_at:
            raise ProbeError
        link_rows = connection.execute(
            """SELECT user_id, user_language_id, language_code, concept_id, derivation_key,
                      created_at
               FROM public.reader_exposure_concepts
               WHERE exposure_event_id = %s
               ORDER BY concept_id
               LIMIT 1001""",
            (expected_exposure_id,),
        ).fetchall()
        learning_rows = connection.execute(
            """SELECT user_id, user_language_id, language_code, event_type, concept_id,
                      payload, idempotency_key, source_type, source_event_id, derivation_key,
                      ingestion_sequence, ingested_at, projection_method_version,
                      competence_parameter_set_id, competence_parameter_version,
                      occurred_at, created_at
               FROM public.learning_events
               WHERE user_id = %s AND source_type = 'exposure_event'
                 AND source_event_id = %s
               ORDER BY concept_id
               LIMIT 1001""",
            (actor_id, expected_exposure_id),
        ).fetchall()

    states = connection.execute(
        """SELECT concept_id, status, recognition, listening, production, mastery, confidence,
                  exposure_count, has_learning_intent, has_projectable_evidence,
                  highest_achievement_status,
                  recognition_positive_mass, recognition_negative_mass,
                  recognition_confidence, recognition_evidence_count, recognition_last_evidence_at,
                  listening_positive_mass, listening_negative_mass,
                  listening_confidence, listening_evidence_count, listening_last_evidence_at,
                  production_positive_mass, production_negative_mass,
                  production_confidence, production_evidence_count, production_last_evidence_at,
                  recent_competence_outcomes, language_code, state_version, last_seen_at,
                  projection_method_version, competence_parameter_set_id,
                  competence_parameter_version, created_at, updated_at
           FROM public.user_concept_states
           WHERE user_id = %s AND user_language_id = %s AND concept_id = ANY(%s)
           ORDER BY concept_id
           LIMIT 1001""",
        (actor_id, profile_id, eligible_ids),
    ).fetchall()
    if phase == "before" and states:
        raise ProbeError
    if phase == "after" and len(states) != len(eligible_ids):
        raise ProbeError

    head_rows = connection.execute(
        """SELECT head.user_id, head.user_language_id, head.state_version,
                  head.next_ingestion_sequence, head.parameter_set_id, head.parameter_version,
                  head.projection_method_version, head.updated_at,
                  (to_jsonb(head) - ARRAY[
                      'state_version', 'next_ingestion_sequence', 'updated_at'
                  ]::text[])::text
           FROM public.user_language_projection_heads AS head
           WHERE head.user_id = %s AND head.user_language_id = %s
           LIMIT 2""",
        (actor_id, profile_id),
    ).fetchall()
    if len(head_rows) != 1:
        raise ProbeError
    (head_user_id, head_profile_id, head_state_version, next_sequence, parameter_set_id,
     parameter_version, projection_method_version, head_updated_at,
     immutable_head_json) = head_rows[0]
    if (UUID(str(head_user_id)) != actor_id or UUID(str(head_profile_id)) != profile_id
            or type(head_state_version) is not int or head_state_version < 1
            or type(next_sequence) is not int or next_sequence < 1
            or parameter_set_id is None or not isinstance(parameter_version, str)
            or not parameter_version or projection_method_version != "competence-beta-v1"
            or not isinstance(immutable_head_json, str)
            or len(immutable_head_json.encode("utf-8")) > MAX_ROW_BYTES):
        raise ProbeError
    parameter_set_id = UUID(str(parameter_set_id))
    head_updated_at = _pilot_reader_aware_datetime(head_updated_at)
    immutable_head_sha256 = hashlib.sha256(immutable_head_json.encode("utf-8")).hexdigest()

    projection_head_before: dict[str, int] | None = None
    if phase == "after":
        raw_head_before = binding.get("projectionHeadBefore")
        if (
            not isinstance(raw_head_before, dict)
            or set(raw_head_before) != {"stateVersion", "nextIngestionSequence"}
            or type(raw_head_before.get("stateVersion")) is not int
            or raw_head_before["stateVersion"] < 1
            or type(raw_head_before.get("nextIngestionSequence")) is not int
            or raw_head_before["nextIngestionSequence"] < 1
            or expected_recorded_at is None
            or head_updated_at != expected_recorded_at
            or head_state_version != raw_head_before["stateVersion"] + len(eligible_ids)
            or next_sequence != raw_head_before["nextIngestionSequence"] + len(eligible_ids)
        ):
            raise ProbeError
        projection_head_before = raw_head_before

    skill_rows = connection.execute(
        """SELECT skill, score, confidence, evidence_count, positive_mass, negative_mass,
                  last_evidence_at, state_version, competence_parameter_set_id,
                  competence_parameter_version
           FROM public.user_skill_states
           WHERE user_id = %s AND user_language_id = %s
           ORDER BY skill
           LIMIT 4""",
        (actor_id, profile_id),
    ).fetchall()
    if len(skill_rows) != 3:
        raise ProbeError
    expected_skills = ("listening", "production", "recognition")
    for row, expected_skill in zip(skill_rows, expected_skills, strict=True):
        (skill, score, confidence, evidence_count, positive_mass, negative_mass,
         last_evidence_at, state_version, skill_parameter_id, skill_parameter_version) = row
        if (
            skill != expected_skill
            or Decimal(str(score)) != Decimal("0.5")
            or Decimal(str(confidence)) != Decimal("0")
            or evidence_count != 0
            or Decimal(str(positive_mass)) != Decimal("0")
            or Decimal(str(negative_mass)) != Decimal("0")
            or last_evidence_at is not None
            or state_version != 1
            or UUID(str(skill_parameter_id)) != UUID(str(parameter_set_id))
            or skill_parameter_version != parameter_version
        ):
            raise ProbeError

    concept_states = [] if phase == "before" else [
        _pilot_reader_passive_concept_state(
            row,
            concept_id,
            recorded_at=expected_recorded_at,
            parameter_set_id=parameter_set_id,
            parameter_version=parameter_version,
            projection_method_version=projection_method_version,
        )
        for row, concept_id in zip(states, eligible_ids, strict=True)
    ]

    if phase == "before":
        linked_ids: list[UUID] = []
        learning_ids: list[UUID] = []
    else:
        linked_ids = []
        for row in link_rows:
            row_user, row_profile, language_code, concept_id, derivation_key, created_at = row
            concept_id = UUID(str(concept_id))
            if (UUID(str(row_user)) != actor_id or UUID(str(row_profile)) != profile_id
                    or language_code != "en" or derivation_key != f"concept:{concept_id}"
                    or _pilot_reader_aware_datetime(created_at) != expected_recorded_at):
                raise ProbeError
            linked_ids.append(concept_id)
        learning_ids = []
        event_sequences: list[int] = []
        for row in learning_rows:
            (row_user, row_profile, language_code, event_type, concept_id, payload,
             event_key, source_type, source_event_id, derivation_key, ingestion_sequence,
             ingested_at, event_projection_method_version, event_parameter_set_id,
             event_parameter_version, occurred_at, created_at) = row
            concept_id = UUID(str(concept_id))
            if (UUID(str(row_user)) != actor_id or UUID(str(row_profile)) != profile_id
                    or language_code != "en" or event_type != "learning.exposure.recorded.v1"
                    or payload != {"exposureType": "read"}
                    or str(event_key) != str(idempotency_key)
                    or source_type != "exposure_event"
                    or UUID(str(source_event_id)) != expected_exposure_id
                    or derivation_key != f"concept:{concept_id}"
                    or type(ingestion_sequence) is not int
                    or _pilot_reader_aware_datetime(ingested_at) != expected_recorded_at
                    or _pilot_reader_aware_datetime(created_at) != expected_recorded_at
                    or _pilot_reader_aware_datetime(occurred_at) != expected_occurred_at
                    or event_projection_method_version != projection_method_version
                    or UUID(str(event_parameter_set_id)) != parameter_set_id
                    or event_parameter_version != parameter_version):
                raise ProbeError
            event_sequences.append(ingestion_sequence)
            learning_ids.append(concept_id)
        if (len(linked_ids) != len(eligible_ids) or len(set(linked_ids)) != len(linked_ids)
                or sorted(linked_ids) != eligible_ids
                or len(learning_ids) != len(eligible_ids)
                or len(set(learning_ids)) != len(learning_ids)
                or sorted(learning_ids) != eligible_ids):
            raise ProbeError
        expected_sequences = list(range(
            projection_head_before["nextIngestionSequence"],
            projection_head_before["nextIngestionSequence"] + len(eligible_ids),
        ))
        if sorted(event_sequences) != expected_sequences:
            raise ProbeError

    stable_rows = _pilot_reader_stable_rows(
        connection,
        actor_id=actor_id,
        profile_id=profile_id,
        phase=phase,
        eligible_ids=eligible_ids,
        expected_exposure_id=expected_exposure_id,
    )

    return {
        "phase": phase,
        "eligibleConceptIds": [str(value) for value in eligible_ids],
        "exposureEventIds": [str(value) for value in exposure_ids],
        "linkedConceptIds": [str(value) for value in linked_ids],
        "learningConceptIds": [str(value) for value in learning_ids],
        "conceptStates": concept_states,
        "skillStateCount": len(skill_rows),
        "skillNames": list(expected_skills),
        "skillStatesPassiveOnly": True,
        "projectionHead": {
            "rowCount": len(head_rows),
            "stateVersion": head_state_version,
            "nextIngestionSequence": next_sequence,
            "parameterVersion": parameter_version,
            "immutableSha256": immutable_head_sha256,
            "updatedAtMatchesCompletion": (
                None if phase == "before" else head_updated_at == expected_recorded_at
            ),
        },
        "stableRows": stable_rows,
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
    reader_binding_value = os.environ.get("K2_ACCEPTANCE_PILOT_READER_BINDING", "")
    try:
        if os.environ.get("K2_ACCEPTANCE_IDEMPOTENCY_KEY") is not None:
            raise ProbeError
        actor_id = UUID(actor_value) if actor_value else None
        profile_id = UUID(profile_value) if profile_value else None
        raw_concepts = json.loads(concept_values) if concept_values else None
        due_concept_ids = None
        reader_concept_ids = None
        if raw_concepts is not None:
            if not isinstance(raw_concepts, list) or any(
                not isinstance(value, str) for value in raw_concepts
            ):
                raise ProbeError
            if action == "pilot_reader_completion":
                if not 1 <= len(raw_concepts) <= 1000:
                    raise ProbeError
                reader_concept_ids = [UUID(value) for value in raw_concepts]
                if len(set(reader_concept_ids)) != len(reader_concept_ids) or any(
                    str(value) != raw
                    for value, raw in zip(reader_concept_ids, raw_concepts, strict=True)
                ):
                    raise ProbeError
            else:
                if len(raw_concepts) != 20:
                    raise ProbeError
                due_concept_ids = [UUID(value) for value in raw_concepts]
                if len(set(due_concept_ids)) != 20 or any(
                    str(value) != raw
                    for value, raw in zip(due_concept_ids, raw_concepts, strict=True)
                ):
                    raise ProbeError
        reader_binding = None
        if reader_binding_value:
            reader_binding = json.loads(reader_binding_value)
            if not isinstance(reader_binding, dict):
                raise ProbeError
        if action not in {
            "retained_snapshot",
            "actor_snapshot",
            "actor_lineage",
            "migrations",
            "pilot_reader_migrations",
            "actor_ownership_graph",
            "actor_absent",
            "pilot_reader_actor_zero",
            "anchor_material",
            "pilot_reader_catalog_manifest",
            "pilot_reader_completion",
            "pilot_reader_retained_snapshot_excluding_actor",
            "today_review_targets",
            "k208_fixture_privilege_preflight",
            "k208_catalog_preflight",
            "k208_candidate_base",
            "k208_due_candidate_overlap",
            "frll_anchor_semantic_proof",
        }:
            raise ProbeError
        if (
            action in {
                "actor_snapshot", "actor_lineage", "actor_absent", "today_review_targets",
                "frll_anchor_semantic_proof", "pilot_reader_completion",
                "pilot_reader_actor_zero", "pilot_reader_retained_snapshot_excluding_actor",
            }
            and actor_id is None
        ):
            raise ProbeError
        if action in {
            "k208_candidate_base",
            "k208_due_candidate_overlap",
            "frll_anchor_semantic_proof",
            "pilot_reader_completion",
        }:
            if actor_id is None or profile_id is None:
                raise ProbeError
        elif profile_id is not None:
            raise ProbeError
        if action == "pilot_reader_migrations" and actor_id is not None:
            raise ProbeError
        if idempotency_key_sha256 and (
            action not in {"frll_anchor_semantic_proof", "pilot_reader_completion"}
            or not re.fullmatch(r"[a-f0-9]{64}", idempotency_key_sha256)
        ):
            raise ProbeError
        if action == "k208_due_candidate_overlap":
            if due_concept_ids is None:
                raise ProbeError
        elif due_concept_ids is not None:
            raise ProbeError
        if action == "pilot_reader_completion":
            if (reader_concept_ids is None or not isinstance(reader_binding, dict)
                    or set(reader_binding) not in ({"phase", "contentId", "segmentId"},
                                                   {"phase", "contentId", "segmentId", "exposureId",
                                                    "projectionHeadBefore"})):
                raise ProbeError
            try:
                binding_content_id = UUID(reader_binding["contentId"])
                binding_segment_id = UUID(reader_binding["segmentId"])
            except (KeyError, TypeError, ValueError):
                raise ProbeError from None
            if (str(binding_content_id) != reader_binding.get("contentId")
                    or str(binding_segment_id) != reader_binding.get("segmentId")):
                raise ProbeError
            if reader_binding.get("phase") == "before":
                if (
                    set(reader_binding) != {"phase", "contentId", "segmentId"}
                    or idempotency_key_sha256
                ):
                    raise ProbeError
            elif reader_binding.get("phase") == "after":
                head_before = reader_binding.get("projectionHeadBefore")
                try:
                    exposure_id = UUID(reader_binding.get("exposureId", ""))
                except (TypeError, ValueError):
                    raise ProbeError from None
                if (set(reader_binding) != {"phase", "contentId", "segmentId", "exposureId",
                                           "projectionHeadBefore"}
                        or str(exposure_id) != reader_binding.get("exposureId")
                        or not isinstance(head_before, dict)
                        or set(head_before) != {"stateVersion", "nextIngestionSequence"}
                        or type(head_before.get("stateVersion")) is not int
                        or head_before["stateVersion"] < 1
                        or type(head_before.get("nextIngestionSequence")) is not int
                        or head_before["nextIngestionSequence"] < 1
                        or not re.fullmatch(r"[a-f0-9]{64}", idempotency_key_sha256)):
                    raise ProbeError
            else:
                raise ProbeError
        elif reader_concept_ids is not None or reader_binding is not None:
            raise ProbeError
        if reader_binding_value and action != "pilot_reader_completion":
            raise ProbeError
        if action in {
            "k208_fixture_privilege_preflight", "k208_catalog_preflight",
            "pilot_reader_catalog_manifest", "pilot_reader_migrations",
        } and actor_id is not None:
            raise ProbeError

        with _connection() as connection:
            if action == "migrations":
                _table_inventory(connection)
                output: dict[str, Any] = _migration_head(connection)
            elif action == "pilot_reader_migrations":
                _table_inventory(connection)
                output = _pilot_reader_migration_head(connection)
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
            elif action == "pilot_reader_catalog_manifest":
                output = _pilot_reader_catalog_manifest(connection)
            elif action == "pilot_reader_completion":
                if (
                    actor_id is None
                    or profile_id is None
                    or reader_concept_ids is None
                    or reader_binding is None
                ):
                    raise ProbeError
                output = _pilot_reader_completion(
                    connection,
                    actor_id=actor_id,
                    profile_id=profile_id,
                    concept_ids=reader_concept_ids,
                    binding=reader_binding,
                    idempotency_key_sha256=idempotency_key_sha256 or None,
                )
            elif action == "pilot_reader_retained_snapshot_excluding_actor":
                if actor_id is None:
                    raise ProbeError
                _table_inventory(connection)
                _pilot_reader_migration_head(connection)
                output = _snapshot(connection, None, exclude_actor_id=actor_id)
            elif action == "pilot_reader_actor_zero":
                if actor_id is None:
                    raise ProbeError
                _table_inventory(connection)
                _pilot_reader_migration_head(connection)
                output = _snapshot(connection, actor_id)
                if output["totalRows"] != 0:
                    raise ProbeError
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
