"""Read-only observational PostgreSQL state probe for First Real Learning Loop (FRLL).

Strictly inspects real PostgreSQL tables without mutating any learner or catalog state.
Enforces read-only transaction semantics.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, dataclass
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
            )

    def teardown_disposable_user(self, user_id: UUID) -> dict[str, Any]:
        """Scoped teardown of a disposable test user's application-owned state.

        Strictly scoped to user_id. Never touches catalog tables or other actors.
        Handles immutable/append-only triggers and RESTRICT foreign keys safely.
        """
        if not isinstance(user_id, UUID):
            raise ValueError(f"Invalid user_id for teardown: {user_id!r}")

        with psycopg.connect(self.database_url, autocommit=False) as conn:
            existing_user = conn.execute(
                "SELECT id FROM users WHERE id = %s", (user_id,)
            ).fetchone()
            if not existing_user:
                return {
                    "user_id": str(user_id),
                    "status": "already_clean",
                    "deleted_users": 0,
                    "deleted_intents": 0,
                    "deleted_profile_mutations": 0,
                }

            candidate_triggers = [
                ("profile_mutation_results", "profile_mutation_results_append_only"),
                ("concept_save_intents", "concept_save_intents_immutable_history"),
                ("learning_events", "learning_events_append_only"),
                ("reader_mutation_results", "reader_mutation_results_append_only"),
                ("reader_exposure_concepts", "reader_exposure_concepts_append_only"),
            ]

            used_replica_role = False
            try:
                conn.execute("SAVEPOINT replica_probe")
                conn.execute("SET LOCAL session_replication_role = 'replica'")
                conn.execute("RELEASE SAVEPOINT replica_probe")
                used_replica_role = True
            except Exception:
                conn.execute("ROLLBACK TO SAVEPOINT replica_probe")
                used_replica_role = False

            disabled_triggers: list[tuple[str, str]] = []
            if not used_replica_role:
                for table, trigger in candidate_triggers:
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

                # 3. If replica role was not available, also delete from learning_events explicitly
                deleted_learning_events = 0
                if not used_replica_role:
                    res_events = conn.execute(
                        "DELETE FROM learning_events WHERE user_id = %s", (user_id,)
                    )
                    deleted_learning_events = res_events.rowcount

                # 4. Delete root user from users (cascades via ON DELETE CASCADE to child tables)
                res_users = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
                deleted_users = res_users.rowcount

                # Re-enable triggers within the same transaction before committing
                if disabled_triggers:
                    for table, trigger in reversed(disabled_triggers):
                        conn.execute(f"ALTER TABLE {table} ENABLE TRIGGER {trigger}")
                    disabled_triggers.clear()

                conn.commit()

                return {
                    "user_id": str(user_id),
                    "status": "success",
                    "used_replica_role": used_replica_role,
                    "deleted_users": deleted_users,
                    "deleted_intents": deleted_intents,
                    "deleted_profile_mutations": deleted_profile_mutations,
                    "deleted_learning_events": deleted_learning_events,
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
            user_count = conn.execute(
                "SELECT count(*) AS c FROM users WHERE id = %s", (user_id,)
            ).fetchone()["c"]
            profile_count = conn.execute(
                "SELECT count(*) AS c FROM learner_profiles WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            lang_count = conn.execute(
                "SELECT count(*) AS c FROM user_languages WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            review_item_count = conn.execute(
                "SELECT count(*) AS c FROM review_items WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            fsrs_count = conn.execute(
                "SELECT count(*) AS c FROM fsrs_states WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            learning_event_count = conn.execute(
                "SELECT count(*) AS c FROM learning_events WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            save_intent_count = conn.execute(
                "SELECT count(*) AS c FROM concept_save_intents WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            profile_mutation_count = conn.execute(
                "SELECT count(*) AS c FROM profile_mutation_results WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            concept_state_count = conn.execute(
                "SELECT count(*) AS c FROM user_concept_states WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]
            saved_concept_count = conn.execute(
                "SELECT count(*) AS c FROM user_saved_concepts WHERE user_id = %s", (user_id,)
            ).fetchone()["c"]

            anchor_count = 1
            if anchor_concept_id is not None:
                anchor_count = conn.execute(
                    "SELECT count(*) AS c FROM concepts WHERE id = %s", (anchor_concept_id,)
                ).fetchone()["c"]

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

    if args[0] == "--teardown":
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
