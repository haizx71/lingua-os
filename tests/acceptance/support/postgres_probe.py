"""Read-only observational PostgreSQL state probe for First Real Learning Loop (FRLL).

Strictly inspects real PostgreSQL tables without mutating any learner or catalog state.
Enforces read-only transaction semantics.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row


def normalize_scalar_for_json(val: Any) -> Any:
    """Normalize a single scalar or structure for deterministic JSON serialization.

    Canonical conversions:
    - Decimal -> canonical decimal string (exact PostgreSQL precision preserved)
    - UUID -> canonical lowercase UUID string
    - datetime / date -> ISO-8601 string
    - int / float / str / bool / None -> native JSON types
    - dict -> recursively normalized dict
    - list / tuple -> recursively normalized list

    Fails closed on any unknown/unsupported object type.
    """
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: normalize_scalar_for_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [normalize_scalar_for_json(item) for item in val]
    raise TypeError(
        f"Unsupported type for canonical JSON serialization: {type(val).__name__} (value: {val!r})"
    )


class CanonicalJsonEncoder(json.JSONEncoder):
    """Fail-closed JSONEncoder for canonical PostgreSQL scalar types."""

    def default(self, o: Any) -> Any:
        if isinstance(o, Decimal):
            return str(o)
        if isinstance(o, UUID):
            return str(o)
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return super().default(o)


def serialize_digest_to_json(digest: LearnerStateDigest, indent: int | None = 2) -> str:
    """Serialize LearnerStateDigest to deterministic JSON using canonical type mapping."""
    raw = asdict(digest)
    normalized = normalize_scalar_for_json(raw)
    return json.dumps(normalized, indent=indent, cls=CanonicalJsonEncoder)


@dataclass(frozen=True)
class LearnerStateDigest:
    user_id: str
    concept_id: str
    user_exists: bool
    profile_time_zone: str | None
    language_profile_ids: list[str]
    is_concept_saved: bool
    save_intent_count: int
    save_intent_ids: list[str]
    review_item_count: int
    review_item_ids: list[str]
    fsrs_state_count: int
    fsrs_states: list[dict[str, Any]]
    learning_event_count: int
    learning_events: list[dict[str, Any]]
    review_event_count: int
    review_events: list[dict[str, Any]]
    concept_state: dict[str, Any] | None
    skill_states: list[dict[str, Any]]
    today_plan_count: int
    today_plan_ids: list[str]
    today_activity_review_item_ids: list[str]
    today_plans: list[dict[str, Any]] = field(default_factory=list)
    today_activities: list[dict[str, Any]] = field(default_factory=list)


class PostgresLearnerProbe:
    """Observational, strictly read-only PostgreSQL probe for learner state."""

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def _open_read_only_connection(self) -> psycopg.Connection[Any]:
        connection = psycopg.connect(self.database_url, autocommit=False, row_factory=dict_row)
        connection.execute("SET TRANSACTION READ ONLY")
        return connection

    def capture_digest(self, user_id: UUID, concept_id: UUID) -> LearnerStateDigest:
        with self._open_read_only_connection() as conn:
            user_row = conn.execute("SELECT id FROM users WHERE id = %s", (user_id,)).fetchone()

            profile_row = conn.execute(
                "SELECT time_zone FROM learner_profiles WHERE user_id = %s", (user_id,)
            ).fetchone()

            lang_rows = conn.execute(
                "SELECT id FROM user_languages WHERE user_id = %s ORDER BY created_at ASC",
                (user_id,),
            ).fetchall()

            saved_row = conn.execute(
                "SELECT saved_at FROM user_saved_concepts WHERE user_id = %s AND concept_id = %s",
                (user_id, concept_id),
            ).fetchone()

            intent_rows = conn.execute(
                """
                SELECT id, created_at
                FROM concept_save_intents
                WHERE user_id = %s AND concept_id = %s
                ORDER BY created_at ASC
                """,
                (user_id, concept_id),
            ).fetchall()

            item_rows = conn.execute(
                """
                SELECT id, status, created_from
                FROM review_items
                WHERE user_id = %s AND concept_id = %s
                ORDER BY created_at ASC
                """,
                (user_id, concept_id),
            ).fetchall()
            item_ids = [row["id"] for row in item_rows]

            fsrs_rows: list[dict[str, Any]] = []
            if item_ids:
                fsrs_rows = conn.execute(
                    """
                    SELECT review_item_id, state, state_version, last_review_at, due_at,
                           stability, difficulty, step
                    FROM fsrs_states
                    WHERE user_id = %s AND review_item_id = ANY(%s)
                    ORDER BY review_item_id ASC
                    """,
                    (user_id, item_ids),
                ).fetchall()

            learning_event_rows = conn.execute(
                """
                SELECT learning_event_id,
                       learning_event_id AS id,
                       event_type, source_type, source_event_id, ingestion_sequence, created_at
                FROM learning_events
                WHERE user_id = %s AND concept_id = %s
                ORDER BY ingestion_sequence ASC NULLS LAST, created_at ASC
                """,
                (user_id, concept_id),
            ).fetchall()

            review_event_rows: list[dict[str, Any]] = []
            if item_ids:
                review_event_rows = conn.execute(
                    """
                    SELECT id, review_item_id, idempotency_key, rating, response_time_ms,
                           request_fingerprint, created_at,
                           (result_memory_snapshot IS NOT NULL) AS has_memory_snapshot,
                           (result_competence_snapshot IS NOT NULL) AS has_competence_snapshot,
                           result_memory_snapshot, result_competence_snapshot,
                           result_remaining_due_count, result_feedback
                    FROM review_events
                    WHERE user_id = %s AND review_item_id = ANY(%s)
                    ORDER BY created_at ASC
                    """,
                    (user_id, item_ids),
                ).fetchall()

            concept_state_row = conn.execute(
                """
                SELECT status, state_version, has_learning_intent, has_projectable_evidence,
                       mastery, mastery AS mastery_score,
                       confidence,
                       recognition, recognition AS recognition_score,
                       listening, listening AS listening_score,
                       production, production AS production_score,
                       recognition_evidence_count,
                       listening_evidence_count, production_evidence_count
                FROM user_concept_states
                WHERE user_id = %s AND concept_id = %s
                """,
                (user_id, concept_id),
            ).fetchone()

            skill_rows = conn.execute(
                """
                SELECT skill, skill AS skill_type, score, confidence, evidence_count
                FROM user_skill_states
                WHERE user_id = %s
                ORDER BY skill ASC
                """,
                (user_id,),
            ).fetchall()

            today_plan_rows = conn.execute(
                """
                SELECT id, plan_date, plan_date AS local_date, time_zone, engine_version, as_of
                FROM today_plans
                WHERE user_id = %s
                ORDER BY created_at ASC
                """,
                (user_id,),
            ).fetchall()
            today_plan_ids = [row["id"] for row in today_plan_rows]

            today_review_item_ids: list[str] = []
            if item_ids:
                mapped_rows = conn.execute(
                    """
                    SELECT review_item_id
                    FROM today_activity_review_items
                    WHERE review_item_id = ANY(%s)
                    """,
                    (item_ids,),
                ).fetchall()
                today_review_item_ids = [str(r["review_item_id"]) for r in mapped_rows]

            today_activity_rows = conn.execute(
                """
                SELECT id, plan_id, activity_type, position, estimated_minutes, reason_codes,
                       concept_id, content_id, review_item_id, status, target_count, completed_count
                FROM today_plan_activities
                WHERE user_id = %s
                ORDER BY position ASC, id ASC
                """,
                (user_id,),
            ).fetchall()

            return LearnerStateDigest(
                user_id=str(user_id),
                concept_id=str(concept_id),
                user_exists=user_row is not None,
                profile_time_zone=profile_row["time_zone"] if profile_row else None,
                language_profile_ids=[str(r["id"]) for r in lang_rows],
                is_concept_saved=saved_row is not None,
                save_intent_count=len(intent_rows),
                save_intent_ids=[str(r["id"]) for r in intent_rows],
                review_item_count=len(item_rows),
                review_item_ids=[str(i) for i in item_ids],
                fsrs_state_count=len(fsrs_rows),
                fsrs_states=[
                    {k: normalize_scalar_for_json(v) for k, v in row.items()} for row in fsrs_rows
                ],
                learning_event_count=len(learning_event_rows),
                learning_events=[
                    {k: normalize_scalar_for_json(v) for k, v in row.items()}
                    for row in learning_event_rows
                ],
                review_event_count=len(review_event_rows),
                review_events=[
                    {k: normalize_scalar_for_json(v) for k, v in row.items()}
                    for row in review_event_rows
                ],
                concept_state={
                    k: normalize_scalar_for_json(v) for k, v in concept_state_row.items()
                }
                if concept_state_row
                else None,
                skill_states=[
                    {k: normalize_scalar_for_json(v) for k, v in row.items()} for row in skill_rows
                ],
                today_plan_count=len(today_plan_rows),
                today_plan_ids=[str(p) for p in today_plan_ids],
                today_activity_review_item_ids=today_review_item_ids,
                today_plans=[
                    {k: normalize_scalar_for_json(v) for k, v in row.items()}
                    for row in today_plan_rows
                ],
                today_activities=[
                    {k: normalize_scalar_for_json(v) for k, v in row.items()}
                    for row in today_activity_rows
                ],
            )

    def teardown_disposable_user(self, user_id: UUID) -> dict[str, Any]:
        """Scoped teardown of a disposable test user's application-owned state.

        Strictly scoped to user_id. Preserves all foreign key constraint triggers so
        DELETE FROM users performs normal canonical ON DELETE CASCADE.
        Disables ONLY the exact named user triggers that block deletion:
        - profile_mutation_results_append_only (on profile_mutation_results)
        - concept_save_intents_immutable_history (on concept_save_intents)
        """
        if not isinstance(user_id, UUID):
            raise ValueError(f"Invalid user_id for teardown: {user_id!r}")

        with psycopg.connect(self.database_url, autocommit=False) as conn:
            existing_user = conn.execute(
                "SELECT id FROM users WHERE id = %s", (user_id,)
            ).fetchone()

            # If users parent row is already gone, purge any existing orphaned child rows
            if not existing_user:
                return self.recover_orphaned_learner_state(user_id)

            named_triggers = [
                ("profile_mutation_results", "profile_mutation_results_append_only"),
                ("concept_save_intents", "concept_save_intents_immutable_history"),
            ]

            disabled_triggers: list[tuple[str, str]] = []
            for table, trigger in named_triggers:
                try:
                    conn.execute(f"ALTER TABLE {table} DISABLE TRIGGER {trigger}")
                    disabled_triggers.append((table, trigger))
                except Exception:
                    pass

            try:
                # 1. Delete rows from profile_mutation_results (resolves RESTRICT FK)
                res_profile_mut = conn.execute(
                    "DELETE FROM profile_mutation_results WHERE user_id = %s", (user_id,)
                )
                deleted_profile_mutations = res_profile_mut.rowcount

                # 2. Delete rows from concept_save_intents (resolves immutable history trigger)
                res_intents = conn.execute(
                    "DELETE FROM concept_save_intents WHERE user_id = %s", (user_id,)
                )
                deleted_intents = res_intents.rowcount

                # 3. RE-ENABLE triggers BEFORE deleting users so FK cascade triggers are 100% active
                for table, trigger in reversed(disabled_triggers):
                    conn.execute(f"ALTER TABLE {table} ENABLE TRIGGER {trigger}")
                disabled_triggers.clear()

                # 4. Delete root user from users with normal canonical ON DELETE CASCADE.
                # All foreign key cascade triggers (RI_FKey_cascade_del) are active!
                # Downstream tables (learner_profiles, user_languages, review_items, fsrs_states,
                # user_concept_states, user_saved_concepts, learning_events) cascade delete.
                res_users = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
                deleted_users = res_users.rowcount

                conn.commit()

                # Verify cleanup to ensure no orphan rows were left behind
                cleanup_check = self.verify_cleanup(user_id)
                if not cleanup_check["clean"]:
                    # If any child rows somehow remained, purge them via orphan recovery
                    return self.recover_orphaned_learner_state(user_id)

                return {
                    "user_id": str(user_id),
                    "status": "success",
                    "deleted_users": deleted_users,
                    "deleted_intents": deleted_intents,
                    "deleted_profile_mutations": deleted_profile_mutations,
                    "clean": True,
                }
            except Exception:
                conn.rollback()
                raise
            finally:
                if disabled_triggers:
                    try:
                        for table, trigger in reversed(disabled_triggers):
                            conn.execute(f"ALTER TABLE {table} ENABLE TRIGGER {trigger}")
                        conn.commit()
                    except Exception:
                        pass

    def recover_orphaned_learner_state(self, user_id: UUID) -> dict[str, Any]:
        """Scoped recovery to purge orphaned learner rows when users parent row was deleted.

        Strictly scoped to user_id. Never deletes catalog or unrelated users.
        """
        if not isinstance(user_id, UUID):
            raise ValueError(f"Invalid user_id for orphan recovery: {user_id!r}")

        with psycopg.connect(self.database_url, autocommit=False) as conn:
            named_triggers = [
                ("profile_mutation_results", "profile_mutation_results_append_only"),
                ("concept_save_intents", "concept_save_intents_immutable_history"),
                ("learning_events", "learning_events_append_only"),
            ]

            disabled_triggers: list[tuple[str, str]] = []
            for table, trigger in named_triggers:
                try:
                    conn.execute(f"ALTER TABLE {table} DISABLE TRIGGER {trigger}")
                    disabled_triggers.append((table, trigger))
                except Exception:
                    pass

            try:
                conn.execute("DELETE FROM profile_mutation_results WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM concept_save_intents WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM learning_events WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM fsrs_states WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM review_events WHERE user_id = %s", (user_id,))
                conn.execute(
                    "DELETE FROM today_activity_review_items WHERE user_id = %s", (user_id,)
                )
                conn.execute("DELETE FROM today_plan_activities WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM today_plans WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM review_items WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM user_concept_states WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM user_skill_states WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM user_saved_concepts WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM user_languages WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM learner_profiles WHERE user_id = %s", (user_id,))
                conn.execute("DELETE FROM users WHERE id = %s", (user_id,))

                # Re-enable triggers within the same transaction before commit
                for table, trigger in reversed(disabled_triggers):
                    conn.execute(f"ALTER TABLE {table} ENABLE TRIGGER {trigger}")
                disabled_triggers.clear()

                conn.commit()

                cleanup_check = self.verify_cleanup(user_id)
                return {
                    "user_id": str(user_id),
                    "status": "recovered",
                    "clean": cleanup_check["clean"],
                    "counts": cleanup_check["counts"],
                }
            except Exception:
                conn.rollback()
                raise
            finally:
                if disabled_triggers:
                    try:
                        for table, trigger in reversed(disabled_triggers):
                            conn.execute(f"ALTER TABLE {table} ENABLE TRIGGER {trigger}")
                        conn.commit()
                    except Exception:
                        pass

    def verify_cleanup(
        self, user_id: UUID, anchor_concept_id: UUID | None = None
    ) -> dict[str, Any]:
        """Observational read-only verification proving complete isolation and cleanup."""
        if not isinstance(user_id, UUID):
            raise ValueError(f"Invalid user_id for verification: {user_id!r}")

        with self._open_read_only_connection() as conn:

            def get_count(query: str, params: tuple[Any, ...]) -> int:
                row = conn.execute(query, params).fetchone()
                return int(row["c"]) if row is not None else 0

            user_count = get_count("SELECT count(*) AS c FROM users WHERE id = %s", (user_id,))
            profile_count = get_count(
                "SELECT count(*) AS c FROM learner_profiles WHERE user_id = %s", (user_id,)
            )
            lang_count = get_count(
                "SELECT count(*) AS c FROM user_languages WHERE user_id = %s", (user_id,)
            )
            review_item_count = get_count(
                "SELECT count(*) AS c FROM review_items WHERE user_id = %s", (user_id,)
            )
            fsrs_count = get_count(
                "SELECT count(*) AS c FROM fsrs_states WHERE user_id = %s", (user_id,)
            )
            learning_event_count = get_count(
                "SELECT count(*) AS c FROM learning_events WHERE user_id = %s", (user_id,)
            )
            save_intent_count = get_count(
                "SELECT count(*) AS c FROM concept_save_intents WHERE user_id = %s", (user_id,)
            )
            profile_mutation_count = get_count(
                "SELECT count(*) AS c FROM profile_mutation_results WHERE user_id = %s", (user_id,)
            )
            concept_state_count = get_count(
                "SELECT count(*) AS c FROM user_concept_states WHERE user_id = %s", (user_id,)
            )
            saved_concept_count = get_count(
                "SELECT count(*) AS c FROM user_saved_concepts WHERE user_id = %s", (user_id,)
            )
            today_plan_count = get_count(
                "SELECT count(*) AS c FROM today_plans WHERE user_id = %s", (user_id,)
            )
            today_activity_count = get_count(
                "SELECT count(*) AS c FROM today_plan_activities WHERE user_id = %s", (user_id,)
            )
            today_review_item_count = get_count(
                "SELECT count(*) AS c FROM today_activity_review_items WHERE user_id = %s",
                (user_id,),
            )
            review_events_count = get_count(
                "SELECT count(*) AS c FROM review_events WHERE user_id = %s", (user_id,)
            )

            anchor_count = 1
            if anchor_concept_id is not None:
                anchor_count = get_count(
                    "SELECT count(*) AS c FROM concepts WHERE id = %s", (anchor_concept_id,)
                )

            is_clean = (
                user_count == 0
                and profile_count == 0
                and lang_count == 0
                and review_item_count == 0
                and fsrs_count == 0
                and learning_event_count == 0
                and save_intent_count == 0
                and profile_mutation_count == 0
                and concept_state_count == 0
                and saved_concept_count == 0
                and today_plan_count == 0
                and today_activity_count == 0
                and today_review_item_count == 0
                and review_events_count == 0
                and (anchor_count >= 1 if anchor_concept_id is not None else True)
            )

            return {
                "user_id": str(user_id),
                "clean": is_clean,
                "counts": {
                    "users": user_count,
                    "learner_profiles": profile_count,
                    "user_languages": lang_count,
                    "review_items": review_item_count,
                    "fsrs_states": fsrs_count,
                    "learning_events": learning_event_count,
                    "concept_save_intents": save_intent_count,
                    "profile_mutation_results": profile_mutation_count,
                    "user_concept_states": concept_state_count,
                    "user_saved_concepts": saved_concept_count,
                    "today_plans": today_plan_count,
                    "today_plan_activities": today_activity_count,
                    "today_activity_review_items": today_review_item_count,
                    "review_events": review_events_count,
                },
                "anchor_concept_intact": (
                    anchor_count >= 1 if anchor_concept_id is not None else True
                ),
            }


def main() -> None:
    args = sys.argv[1:]
    usage_msg = (
        "Usage: python -m postgres_probe [<database_url>] <user_id> <concept_id>\n"
        "       python -m postgres_probe [<database_url>] --teardown <user_id>\n"
        "       python -m postgres_probe [<database_url>] --recover-orphan <user_id>\n"
        "       python -m postgres_probe [<database_url>] --verify-cleanup <user_id> [anchor_id]"
    )
    if not args:
        print(usage_msg, file=sys.stderr)
        sys.exit(1)

    db_url = os.environ.get("DATABASE_URL")
    if "://" in args[0]:
        db_url = args[0]
        args = args[1:]

    if not args:
        print(usage_msg, file=sys.stderr)
        sys.exit(1)

    if args[0] in ("--teardown", "--recover-orphan"):
        if len(args) != 2:
            print(usage_msg, file=sys.stderr)
            sys.exit(1)
    elif args[0] == "--verify-cleanup":
        if not (2 <= len(args) <= 3):
            print(usage_msg, file=sys.stderr)
            sys.exit(1)

    elif len(args) != 2:
        print(usage_msg, file=sys.stderr)
        sys.exit(1)

    if not db_url or not db_url.strip():
        print(
            "ERROR: DATABASE_URL is missing or empty in environment",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(args) == 2 and args[0] == "--teardown":
        user_id = UUID(args[1])
        probe = PostgresLearnerProbe(db_url)
        res = probe.teardown_disposable_user(user_id)
        print(json.dumps(res, indent=2))
        return

    if len(args) == 2 and args[0] == "--recover-orphan":
        user_id = UUID(args[1])
        probe = PostgresLearnerProbe(db_url)
        res = probe.recover_orphaned_learner_state(user_id)
        print(json.dumps(res, indent=2))
        return

    if (len(args) == 2 or len(args) == 3) and args[0] == "--verify-cleanup":
        user_id = UUID(args[1])
        anchor_id = UUID(args[2]) if len(args) == 3 else None
        probe = PostgresLearnerProbe(db_url)
        res = probe.verify_cleanup(user_id, anchor_id)
        print(json.dumps(res, indent=2))
        return

    if len(args) == 2:
        user_id = UUID(args[0])
        concept_id = UUID(args[1])
        probe = PostgresLearnerProbe(db_url)
        digest = probe.capture_digest(user_id, concept_id)
        print(serialize_digest_to_json(digest, indent=2))
        return

    print(usage_msg, file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
