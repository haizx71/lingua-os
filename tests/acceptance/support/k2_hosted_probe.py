"""Read-only, bounded proof for the K2 hosted acceptance runner."""

from __future__ import annotations

import hashlib
import json
import os
import sys
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
EXPECTED_APP_MIGRATION_HEAD = "0020"
EXPECTED_SUPABASE_PLATFORM_TAIL = (
    "concept_save_intent_auth_erasure_0019",
    "k2_hosted_acceptance_reader_staging",
    "today_remediation_reason_codes_0020",
)
K2_ANCHOR_CONCEPT_ID = UUID("7f110000-0000-4000-8000-000000000004")
K2_ANCHOR_LEMMA = "frll-anchor"
MAX_ROWS_PER_TABLE = 100_000
MAX_TOTAL_ROWS = 300_000
MAX_ROW_BYTES = 16_384
MAX_TOTAL_BYTES = 128 * 1024 * 1024


class ProbeError(Exception):
    pass


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


def _connection():
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


def _table_inventory(connection) -> tuple[str, ...]:
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


def _snapshot(connection, actor_id: UUID | None) -> dict[str, Any]:
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


def _migration_head(connection) -> dict[str, Any]:
    rows = connection.execute(
        "SELECT version, name FROM public.schema_migrations ORDER BY version"
    ).fetchall()
    expected = [f"{number:04d}" for number in range(1, 21)]
    if [row[0] for row in rows] != expected or rows[-1][1] != "today_remediation_reason_codes":
        raise ProbeError
    migration_rows = connection.execute(
        "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"
    ).fetchall()
    platform_tail = tuple(row[1] for row in migration_rows[-3:])
    platform_versions = [row[0] for row in migration_rows[-3:]]
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


def _anchor_material(connection) -> dict[str, bool]:
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


def _actor_lineage(connection, actor_id: UUID) -> dict[str, Any]:
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


def _today_review_targets(connection, actor_id: UUID) -> dict[str, Any]:
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
    try:
        actor_id = UUID(actor_value) if actor_value else None
        if action not in {
            "retained_snapshot",
            "actor_snapshot",
            "actor_lineage",
            "migrations",
            "actor_absent",
            "anchor_material",
            "today_review_targets",
        }:
            raise ProbeError
        if (
            action in {"actor_snapshot", "actor_lineage", "actor_absent", "today_review_targets"}
            and actor_id is None
        ):
            raise ProbeError

        with _connection() as connection:
            if action == "migrations":
                _table_inventory(connection)
                output: dict[str, Any] = _migration_head(connection)
            elif action == "anchor_material":
                _table_inventory(connection)
                _migration_head(connection)
                output = _anchor_material(connection)
            elif action == "actor_lineage":
                output = _actor_lineage(connection, actor_id)
            elif action == "today_review_targets":
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
