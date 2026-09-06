"""Read-only observational PostgreSQL state probe for First Real Learning Loop (FRLL).

Strictly inspects real PostgreSQL tables without mutating any learner or catalog state.
Enforces read-only transaction semantics.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, dataclass
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row


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
                           stability, difficulty, scheduled_days, reps, lapses
                    FROM fsrs_states
                    WHERE user_id = %s AND review_item_id = ANY(%s)
                    ORDER BY review_item_id ASC
                    """,
                    (user_id, item_ids),
                ).fetchall()

            learning_event_rows = conn.execute(
                """
                SELECT id, event_type, source_type, source_event_id, ingestion_sequence, created_at
                FROM learning_events
                WHERE user_id = %s AND concept_id = %s
                ORDER BY ingestion_sequence ASC
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
                       mastery_score, confidence, recognition_score, listening_score,
                       production_score, recognition_evidence_count,
                       listening_evidence_count, production_evidence_count
                FROM user_concept_states
                WHERE user_id = %s AND concept_id = %s
                """,
                (user_id, concept_id),
            ).fetchone()

            skill_rows = conn.execute(
                """
                SELECT skill_type, score, confidence, evidence_count
                FROM user_skill_states
                WHERE user_id = %s
                ORDER BY skill_type ASC
                """,
                (user_id,),
            ).fetchall()

            today_plan_rows = conn.execute(
                """
                SELECT id, local_date, time_zone, engine_version, as_of
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

            # Format rows for clean serializability
            def _clean(val: Any) -> Any:
                if isinstance(val, UUID):
                    return str(val)
                if hasattr(val, "isoformat"):
                    return val.isoformat()
                return val

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
                fsrs_states=[{k: _clean(v) for k, v in row.items()} for row in fsrs_rows],
                learning_event_count=len(learning_event_rows),
                learning_events=[
                    {k: _clean(v) for k, v in row.items()} for row in learning_event_rows
                ],
                review_event_count=len(review_event_rows),
                review_events=[{k: _clean(v) for k, v in row.items()} for row in review_event_rows],
                concept_state={k: _clean(v) for k, v in concept_state_row.items()}
                if concept_state_row
                else None,
                skill_states=[{k: _clean(v) for k, v in row.items()} for row in skill_rows],
                today_plan_count=len(today_plan_rows),
                today_plan_ids=[str(p) for p in today_plan_ids],
                today_activity_review_item_ids=today_review_item_ids,
            )


def main() -> None:
    if len(sys.argv) == 3:
        db_url = os.environ.get("DATABASE_URL")
        if not db_url or not db_url.strip():
            print(
                "ERROR: DATABASE_URL is missing or empty in environment",
                file=sys.stderr,
            )
            sys.exit(1)
        user_id = UUID(sys.argv[1])
        concept_id = UUID(sys.argv[2])
    elif len(sys.argv) >= 4:
        db_url = sys.argv[1]
        user_id = UUID(sys.argv[2])
        concept_id = UUID(sys.argv[3])
    else:
        print(
            "Usage: python -m postgres_probe [<database_url>] <user_id> <concept_id>",
            file=sys.stderr,
        )
        sys.exit(1)

    probe = PostgresLearnerProbe(db_url)
    digest = probe.capture_digest(user_id, concept_id)
    print(json.dumps(asdict(digest), indent=2))


if __name__ == "__main__":
    main()
