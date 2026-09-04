"""PostgreSQL persistence layer for the Assessment bounded context.

Implements start/resume, get, and answer operations with:
- actor-scoped queries only
- row-level locking for concurrency
- partial-unique one-active-attempt enforcement
- exact idempotency replay from assessment_idempotency_log
- append-only responses/results/snapshots
- zero writes to learning_events, user_concept_states, review_items, fsrs_states

Authority: docs/STARTING_LEVEL_ESTIMATE_V1.md §12, §13, §17.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

import psycopg
from psycopg import Connection
from psycopg.rows import dict_row

from lingua_api.assessment.domain import (
    AssessmentIdempotencyConflict,
    AssessmentInvalidState,
    AssessmentNotFound,
    AssessmentUnavailable,
    AssessmentValidationError,
)
from lingua_api.assessment.policy import (
    POLICY_VERSION,
    AttemptState,
    BandCode,
    BandState,
    BundleKind,
    Domain,
    PolicySlot,
    ResponseOutcome,
    assessed_skills,
    bundle_complete,
    compute_confidence,
    evaluate_transition,
    initial_slots,
    next_slots,
    record_response,
)
from lingua_api.memory.domain import AuthenticatedActor

LOGGER = logging.getLogger("lingua_api.assessment.store")

# ---------------------------------------------------------------------------
# Data objects returned to the service / router layer
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AssessmentItemPublic:
    """Safe public question payload — no answer key."""

    id: UUID
    domain: str
    skill: str
    prompt: str
    text_snippet: str | None
    audio_url: str | None
    options: list[dict[str, str]]
    allow_skip: bool


@dataclass(frozen=True)
class AssessmentProgressData:
    answered_count: int
    minimum_item_count: int = 8
    maximum_item_count: int = 16


@dataclass(frozen=True)
class StartingLevelEstimateData:
    level_framework_code: str
    level_code: str
    level_label: str
    confidence: float
    confidence_band: str
    assessed_skills: list[str]
    evidence_count: int
    method_version: str
    estimated_at: datetime


@dataclass(frozen=True)
class AssessmentSessionData:
    id: UUID
    language_profile_id: UUID
    status: str
    method_version: str
    progress: AssessmentProgressData
    current_item: AssessmentItemPublic | None
    result: StartingLevelEstimateData | None
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None


@dataclass(frozen=True)
class StartResult:
    session: AssessmentSessionData
    created: bool  # True = 201, False = 200


@dataclass(frozen=True)
class IdempotencyEntry:
    http_status: int
    data_snapshot: dict[str, Any]
    policy_version: str
    request_fingerprint: str


# ---------------------------------------------------------------------------
# PostgreSQL store
# ---------------------------------------------------------------------------


class PostgresAssessmentStore:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    # ------------------------------------------------------------------
    # Start or resume
    # ------------------------------------------------------------------

    def start_or_resume(
        self,
        actor: AuthenticatedActor,
        *,
        language_profile_id: UUID,
        idempotency_key: UUID,
    ) -> StartResult:
        with (
            psycopg.connect(self._database_url, row_factory=dict_row) as conn,
            conn.transaction(),
        ):
            fingerprint = _start_fingerprint(actor, language_profile_id)
            self._lock_idempotency_key(conn, actor, idempotency_key)
            # Exact replay check.
            replay = self._check_idempotency(
                conn, actor, idempotency_key=idempotency_key, operation="start"
            )
            if replay is not None:
                if replay.request_fingerprint != fingerprint:
                    raise AssessmentIdempotencyConflict("idempotency key reused")
                session = _session_from_snapshot(replay.data_snapshot)
                return StartResult(session=session, created=(replay.http_status == 201))

            # Validate profile ownership and active state.
            profile = self._require_active_profile(conn, actor, language_profile_id)

            # Check for existing in_progress or completed attempt.
            attempt = self._find_current_attempt(conn, actor, profile["id"])

            if attempt is not None and (
                attempt["status"] == "completed" or attempt["status"] == "in_progress"
            ):
                session = self._build_session(conn, attempt)
                snapshot = _session_to_snapshot(session)
                self._log_idempotency(
                    conn,
                    actor,
                    idempotency_key=idempotency_key,
                    operation="start",
                    fingerprint=fingerprint,
                    attempt_id=attempt["id"],
                    response_id=None,
                    http_status=200,
                    data_snapshot=snapshot,
                )
                return StartResult(session=session, created=False)

            # Find active template.
            template = self._require_active_template(conn)

            # Create new attempt.
            attempt_id = uuid4()
            conn.execute(
                """
                    INSERT INTO assessment_attempts (
                        id, user_id, user_language_id, template_id, language_code,
                        status, method_version, idempotency_key, current_position
                    ) VALUES (
                        %s, %s, %s, %s, 'en', 'in_progress', %s, %s, 0
                    )
                    """,
                (
                    str(attempt_id),
                    str(actor.user_id),
                    str(profile["id"]),
                    str(template["id"]),
                    POLICY_VERSION,
                    str(idempotency_key),
                ),
            )

            # Select and snapshot the initial four A1 primary slots.
            slots = initial_slots()
            self._append_slots(conn, actor, attempt_id, template["id"], slots, position_start=1)

            # Re-read the full attempt row.
            attempt_row = conn.execute(
                "SELECT * FROM assessment_attempts WHERE id = %s",
                (str(attempt_id),),
            ).fetchone()
            assert attempt_row is not None

            session = self._build_session(conn, attempt_row)
            snapshot = _session_to_snapshot(session)
            self._log_idempotency(
                conn,
                actor,
                idempotency_key=idempotency_key,
                operation="start",
                fingerprint=fingerprint,
                attempt_id=attempt_id,
                response_id=None,
                http_status=201,
                data_snapshot=snapshot,
            )
            return StartResult(session=session, created=True)

    # ------------------------------------------------------------------
    # Get (read-only)
    # ------------------------------------------------------------------

    def get_session(self, actor: AuthenticatedActor, *, attempt_id: UUID) -> AssessmentSessionData:
        with psycopg.connect(self._database_url, row_factory=dict_row) as conn:
            attempt = conn.execute(
                "SELECT * FROM assessment_attempts WHERE id = %s AND user_id = %s",
                (str(attempt_id), str(actor.user_id)),
            ).fetchone()
            if attempt is None:
                raise AssessmentNotFound("assessment not found")
            return self._build_session(conn, attempt)

    # ------------------------------------------------------------------
    # Submit response
    # ------------------------------------------------------------------

    def submit_response(
        self,
        actor: AuthenticatedActor,
        *,
        attempt_id: UUID,
        item_id: UUID,
        selected_option_id: UUID | None,
        skipped: bool,
        response_time_ms: int,
        idempotency_key: UUID,
    ) -> AssessmentSessionData:
        with (
            psycopg.connect(self._database_url, row_factory=dict_row) as conn,
            conn.transaction(),
        ):
            if skipped != (selected_option_id is None):
                raise AssessmentValidationError(
                    "answer must contain exactly one of selected_option_id or skipped"
                )
            self._lock_idempotency_key(conn, actor, idempotency_key)
            # Exact replay check.
            fingerprint = _answer_fingerprint(
                actor,
                attempt_id,
                item_id,
                selected_option_id,
                skipped,
                response_time_ms,
            )
            replay = self._check_idempotency(
                conn, actor, idempotency_key=idempotency_key, operation="answer"
            )
            if replay is not None:
                # Different fingerprint = key reuse for another command.
                if replay.request_fingerprint != fingerprint:
                    raise AssessmentIdempotencyConflict("idempotency key reused")
                return _session_from_snapshot(replay.data_snapshot)

            # Lock the attempt row.
            attempt = conn.execute(
                """
                    SELECT a.*, ul.status AS profile_status
                    FROM assessment_attempts a
                    JOIN user_languages ul ON ul.id = a.user_language_id
                        AND ul.user_id = a.user_id
                    WHERE a.id = %s AND a.user_id = %s
                    FOR UPDATE
                    """,
                (str(attempt_id), str(actor.user_id)),
            ).fetchone()
            if attempt is None:
                raise AssessmentNotFound("assessment not found")
            if attempt["status"] != "in_progress":
                raise AssessmentInvalidState("assessment is not in progress")
            if attempt["profile_status"] != "active":
                raise AssessmentInvalidState("language profile is not active")

            # Find the current snapshot item at current_position + 1.
            current_pos = (attempt["current_position"] or 0) + 1
            snap = conn.execute(
                """
                    SELECT * FROM assessment_attempt_items
                    WHERE attempt_id = %s AND position = %s
                    """,
                (str(attempt_id), current_pos),
            ).fetchone()
            if snap is None:
                raise AssessmentInvalidState("no current item found for this assessment")

            if str(snap["item_id"]) != str(item_id):
                raise AssessmentInvalidState("submitted item is not the current item")

            # Validate selected option is in the private snapshot.
            if not skipped and selected_option_id is not None:
                private = snap["private_snapshot"]
                option_ids = [str(o["id"]) for o in private.get("options", [])]
                if str(selected_option_id) not in option_ids:
                    raise AssessmentValidationError(
                        "selected option does not belong to the current item"
                    )

            # Derive correctness (server-side only).
            correct: bool | None
            answer_discriminator: str
            if skipped:
                correct = None
                answer_discriminator = "skipped"
            else:
                private = snap["private_snapshot"]
                correct_id = str(private.get("correct_option_id", ""))
                correct = str(selected_option_id) == correct_id
                answer_discriminator = "selected"

            # Persist the response.
            response_id = uuid4()
            response_json = (
                {"skipped": True} if skipped else {"selectedOptionId": str(selected_option_id)}
            )
            conn.execute(
                """
                    INSERT INTO assessment_responses (
                        id, attempt_id, user_id, template_id, item_id,
                        response, correct, response_time_ms, evidence,
                        idempotency_key, answer_discriminator
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s::jsonb, %s, %s, '{}'::jsonb,
                        %s, %s
                    )
                    """,
                (
                    str(response_id),
                    str(attempt_id),
                    str(actor.user_id),
                    str(attempt["template_id"]),
                    str(item_id),
                    json.dumps(response_json),
                    correct,
                    response_time_ms,
                    str(idempotency_key),
                    answer_discriminator,
                ),
            )

            # Advance position.
            conn.execute(
                """
                    UPDATE assessment_attempts
                    SET current_position = %s, updated_at = now()
                    WHERE id = %s
                    """,
                (current_pos, str(attempt_id)),
            )

            # Rebuild attempt state from all responses.
            attempt_state = self._rebuild_state(conn, attempt_id)

            # Determine if the current bundle is now complete.
            band = attempt_state.current_band
            bundle = attempt_state.current_bundle

            slots_in_current_bundle = self._count_slots_in_bundle(conn, attempt_id, band, bundle)
            bundle_full = slots_in_current_bundle >= 4

            if bundle_full and not attempt_state.terminal:
                evaluate_transition(attempt_state)

            if attempt_state.terminal:
                if not attempt_state.abandoned and attempt_state.result_band is not None:
                    # Write the result atomically.
                    self._write_result(
                        conn, actor, attempt_id, attempt["template_id"], attempt_state
                    )
                    conn.execute(
                        """
                            UPDATE assessment_attempts
                            SET status = 'completed', completed_at = now(), updated_at = now()
                            WHERE id = %s
                            """,
                        (str(attempt_id),),
                    )
                else:
                    conn.execute(
                        """
                            UPDATE assessment_attempts
                            SET status = 'abandoned', updated_at = now()
                            WHERE id = %s
                            """,
                        (str(attempt_id),),
                    )
            elif bundle_full and not attempt_state.terminal:
                # Append next bundle.
                next_bundle_slots = next_slots(attempt_state)
                if next_bundle_slots:
                    self._append_slots(
                        conn,
                        actor,
                        attempt_id,
                        attempt["template_id"],
                        next_bundle_slots,
                        position_start=current_pos + 1,
                    )

            # Re-read and build updated session.
            updated_attempt = conn.execute(
                "SELECT * FROM assessment_attempts WHERE id = %s",
                (str(attempt_id),),
            ).fetchone()
            assert updated_attempt is not None

            session = self._build_session(conn, updated_attempt)
            snapshot = _session_to_snapshot(session)
            snapshot["_fingerprint"] = fingerprint

            self._log_idempotency(
                conn,
                actor,
                idempotency_key=idempotency_key,
                operation="answer",
                fingerprint=fingerprint,
                attempt_id=attempt_id,
                response_id=response_id,
                http_status=200,
                data_snapshot=snapshot,
            )
            return session

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _lock_idempotency_key(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        idempotency_key: UUID,
    ) -> None:
        """Serialize concurrent commands sharing one actor-scoped key."""
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
            (f"assessment:{actor.id}:{idempotency_key}",),
        )

    def _require_active_profile(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        language_profile_id: UUID,
    ) -> dict[str, Any]:
        from lingua_api.assessment.domain import AssessmentInvalidState, AssessmentNotFound

        profile = conn.execute(
            """
            SELECT id, status FROM user_languages
            WHERE id = %s AND user_id = %s AND language_code = 'en'
              AND native_language_code = 'vi'
            FOR UPDATE
            """,
            (str(language_profile_id), str(actor.user_id)),
        ).fetchone()
        if profile is None:
            raise AssessmentNotFound("language profile not found")
        if profile["status"] != "active":
            raise AssessmentInvalidState("language profile is not active")
        return dict(profile)

    def _find_current_attempt(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        profile_id: UUID,
    ) -> dict[str, Any] | None:
        row = conn.execute(
            """
            SELECT * FROM assessment_attempts
            WHERE user_id = %s AND user_language_id = %s
            ORDER BY (status = 'completed') DESC, started_at DESC
            LIMIT 1
            FOR UPDATE
            """,
            (str(actor.user_id), str(profile_id)),
        ).fetchone()
        return dict(row) if row is not None else None

    def _require_active_template(self, conn: Connection[dict[str, Any]]) -> dict[str, Any]:
        template = conn.execute(
            """
            SELECT id, method_version
            FROM assessment_templates
            WHERE status = 'active'
              AND language_code = 'en'
              AND native_language_code = 'vi'
              AND method_version = %s
            LIMIT 1
            """,
            (POLICY_VERSION,),
        ).fetchone()
        if template is None:
            raise AssessmentUnavailable("no active assessment template available for vi→en")
        return dict(template)

    def _check_idempotency(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        *,
        idempotency_key: UUID,
        operation: str,
    ) -> IdempotencyEntry | None:
        row = conn.execute(
            """
            SELECT operation, http_status, data_snapshot, policy_version,
                   request_fingerprint
            FROM assessment_idempotency_log
            WHERE user_id = %s AND idempotency_key = %s
            """,
            (str(actor.user_id), str(idempotency_key)),
        ).fetchone()
        if row is None:
            return None
        if row["operation"] != operation:
            raise AssessmentIdempotencyConflict("idempotency key reused for a different operation")
        return IdempotencyEntry(
            http_status=row["http_status"],
            data_snapshot=row["data_snapshot"],
            policy_version=row["policy_version"],
            request_fingerprint=row["request_fingerprint"],
        )

    def _log_idempotency(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        *,
        idempotency_key: UUID,
        operation: str,
        fingerprint: str,
        attempt_id: UUID | None,
        response_id: UUID | None,
        http_status: int,
        data_snapshot: dict[str, Any],
    ) -> None:
        data_snapshot = {**data_snapshot, "_fingerprint": fingerprint}
        conn.execute(
            """
            INSERT INTO assessment_idempotency_log (
                user_id, idempotency_key, operation, request_fingerprint,
                attempt_id, response_id, http_status, data_snapshot, policy_version
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s
            )
            ON CONFLICT (user_id, idempotency_key) DO NOTHING
            """,
            (
                str(actor.user_id),
                str(idempotency_key),
                operation,
                fingerprint,
                str(attempt_id) if attempt_id else None,
                str(response_id) if response_id else None,
                http_status,
                json.dumps(data_snapshot, default=str),
                POLICY_VERSION,
            ),
        )

    def _append_slots(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        attempt_id: UUID,
        template_id: UUID,
        slots: tuple[PolicySlot, ...],
        *,
        position_start: int,
    ) -> None:
        """Select items for the given slots and insert attempt_items snapshots."""
        candidates = conn.execute(
            """
            SELECT ai.id, ai.prompt_schema, ai.answer_schema,
                   ai.item_type, ai.difficulty_prior, ai.audio_asset_id,
                   ai.target_level_id, ai.bundle_kind, ai.slot_index,
                   level.code AS target_level_code
            FROM assessment_items ai
            JOIN assessment_templates at_ ON at_.id = ai.template_id
            JOIN proficiency_levels level ON level.id = ai.target_level_id
            JOIN proficiency_frameworks framework ON framework.id = level.framework_id
            JOIN source_records sr ON sr.id = ai.source_record_id
            JOIN data_sources ds ON ds.id = sr.source_id
            JOIN licenses lic ON lic.id = ds.license_id
            LEFT JOIN audio_assets aa ON aa.id = ai.audio_asset_id
                AND aa.language_code = 'en'
            LEFT JOIN source_records audio_sr ON audio_sr.id = aa.source_record_id
            LEFT JOIN data_sources audio_ds ON audio_ds.id = audio_sr.source_id
            LEFT JOIN licenses audio_lic ON audio_lic.id = audio_ds.license_id
            WHERE ai.template_id = %s
              AND ai.language_code = 'en'
              AND framework.code = 'CEFR'
              AND at_.status = 'active'
              AND sr.review_status = 'approved'
              AND sr.quality_score IS NOT NULL
              AND lic.usage_policy = 'allowed'
              AND (
                  ai.item_type <> 'listening_comprehension'
                  OR (
                      aa.id IS NOT NULL
                      AND audio_sr.review_status = 'approved'
                      AND audio_sr.quality_score IS NOT NULL
                      AND audio_lic.usage_policy = 'allowed'
                  )
              )
            ORDER BY ai.id
            """,
            (str(template_id),),
        ).fetchall()
        candidates_by_slot: dict[tuple[str, str, int, str], dict[str, Any]] = {}
        for candidate in candidates:
            key = (
                str(candidate["target_level_code"]),
                str(candidate["bundle_kind"]),
                int(candidate["slot_index"]),
                str(candidate["item_type"]),
            )
            candidates_by_slot.setdefault(key, dict(candidate))

        for i, slot in enumerate(slots):
            position = position_start + i
            item = candidates_by_slot.get(
                (
                    slot.band,
                    slot.bundle_kind.value,
                    slot.slot_index,
                    slot.domain.value,
                )
            )
            if item is None:
                raise AssessmentUnavailable(
                    f"no eligible item for {slot.band}/{slot.bundle_kind}/{slot.slot_index}"
                )
            level_id = item["target_level_id"]

            # Build public/private snapshots from the item's JSON schemas.
            prompt_schema = item["prompt_schema"]
            answer_schema = item["answer_schema"]

            options = answer_schema.get("options")
            correct_option_id = answer_schema.get("correct_option_id")
            if not isinstance(options, list) or len(options) != 4:
                raise AssessmentUnavailable("assessment item has invalid option count")
            if not all(
                isinstance(opt, dict)
                and isinstance(opt.get("id"), str)
                and isinstance(opt.get("text"), str)
                and opt["text"].strip()
                for opt in options
            ):
                raise AssessmentUnavailable("assessment item has invalid option identifiers")
            try:
                option_ids = [str(UUID(opt["id"])) for opt in options]
                correct_id = str(UUID(str(correct_option_id)))
            except (ValueError, TypeError, AttributeError) as exc:
                raise AssessmentUnavailable(
                    "assessment item has invalid option identifiers"
                ) from exc
            if len(set(option_ids)) != 4:
                raise AssessmentUnavailable("assessment item has duplicate option identifiers")
            if correct_id not in option_ids:
                raise AssessmentUnavailable("assessment item has no valid correct option")
            prompt = prompt_schema.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                raise AssessmentUnavailable("assessment item has an invalid prompt")

            # Public snapshot: safe presentation data only.
            options_public = [
                {"id": option_ids[index], "text": opt["text"]} for index, opt in enumerate(options)
            ]
            audio_url: str | None = None
            if slot.requires_audio and item.get("audio_asset_id"):
                audio_url = f"/assets/audio/{item['audio_asset_id']}"

            public_snap: dict[str, Any] = {
                "id": str(item["id"]),
                "domain": slot.domain.value,
                "skill": (
                    "listening" if slot.domain == Domain.LISTENING_COMPREHENSION else "recognition"
                ),
                "prompt": prompt_schema.get("prompt", ""),
                "textSnippet": prompt_schema.get("textSnippet"),
                "audioUrl": audio_url,
                "options": options_public,
                "allowSkip": True,
            }

            # Private snapshot: correct option id plus difficulty.
            private_snap: dict[str, Any] = {
                "correct_option_id": str(correct_option_id),
                "difficulty_prior": float(item["difficulty_prior"] or 0),
                "options": [
                    {"id": option_ids[index], "text": opt["text"]}
                    for index, opt in enumerate(options)
                ],
            }

            conn.execute(
                """
                INSERT INTO assessment_attempt_items (
                    id, attempt_id, user_id, template_id, item_id, position,
                    target_level_id, bundle_kind, domain, public_snapshot, private_snapshot
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb
                )
                """,
                (
                    str(uuid4()),
                    str(attempt_id),
                    str(actor.user_id),
                    str(template_id),
                    str(item["id"]),
                    position,
                    str(level_id),
                    slot.bundle_kind.value,
                    slot.domain.value,
                    json.dumps(public_snap),
                    json.dumps(private_snap),
                ),
            )

    def _rebuild_state(self, conn: Connection[dict[str, Any]], attempt_id: UUID) -> AttemptState:
        """Rebuild AttemptState from all persisted responses."""
        responses = conn.execute(
            """
            SELECT ar.correct, ar.answer_discriminator,
                   ai2.bundle_kind, ai2.domain,
                   pl.code AS band_code,
                   ai2.position
            FROM assessment_responses ar
            JOIN assessment_attempt_items ai2
                ON ai2.attempt_id = ar.attempt_id AND ai2.item_id = ar.item_id
            JOIN proficiency_levels pl ON pl.id = ai2.target_level_id
            WHERE ar.attempt_id = %s
            ORDER BY ai2.position
            """,
            (str(attempt_id),),
        ).fetchall()

        state = AttemptState()

        latest_position = responses[-1]["position"] if responses else None
        for resp in responses:
            band_code = cast(BandCode, str(resp["band_code"]).upper())
            state.current_band = band_code
            bundle = BundleKind(resp["bundle_kind"])
            state.current_bundle = bundle
            skipped = resp["answer_discriminator"] == "skipped"
            correct = resp["correct"] if not skipped else None

            outcome = (
                ResponseOutcome.SKIPPED
                if skipped
                else (ResponseOutcome.CORRECT if correct else ResponseOutcome.INCORRECT)
            )

            record_response(state, outcome, band=band_code, bundle_kind=bundle)
            # Reconstruct transitions for completed historical bundles, but leave
            # the newest bundle for submit_response to evaluate and append.
            if resp["position"] != latest_position and bundle_complete(
                state,
                band=band_code,
                bundle_kind=bundle,
            ):
                evaluate_transition(state)

        return state

    def _count_slots_in_bundle(
        self,
        conn: Connection[dict[str, Any]],
        attempt_id: UUID,
        band: BandCode,
        bundle: BundleKind,
    ) -> int:
        """Count submitted responses in the given band/bundle."""
        level_code = band
        row = conn.execute(
            """
            SELECT count(*) AS cnt
            FROM assessment_responses ar
            JOIN assessment_attempt_items ai2
                ON ai2.attempt_id = ar.attempt_id AND ai2.item_id = ar.item_id
            JOIN proficiency_levels pl ON pl.id = ai2.target_level_id
            WHERE ar.attempt_id = %s
              AND pl.code = %s
              AND ai2.bundle_kind = %s
            """,
            (str(attempt_id), level_code, bundle.value),
        ).fetchone()
        return int(row["cnt"]) if row else 0

    def _write_result(
        self,
        conn: Connection[dict[str, Any]],
        actor: AuthenticatedActor,
        attempt_id: UUID,
        template_id: UUID,
        state: AttemptState,
    ) -> None:
        """Write one immutable assessment_result row atomically."""
        from lingua_api.assessment.policy import BAND_ANCHORS, Domain, ResponseOutcome

        result_band = state.result_band
        assert result_band is not None

        # Reconstruct decisive domain outcomes from persisted responses.
        terminal_band = state.current_band
        domain_outcomes: dict[Domain, list[ResponseOutcome]] = {d: [] for d in Domain}

        responses = conn.execute(
            """
            SELECT ar.correct, ar.answer_discriminator,
                   ai2.bundle_kind, ai2.domain
            FROM assessment_responses ar
            JOIN assessment_attempt_items ai2
                ON ai2.attempt_id = ar.attempt_id AND ai2.item_id = ar.item_id
            JOIN proficiency_levels pl ON pl.id = ai2.target_level_id
            WHERE ar.attempt_id = %s AND pl.code = %s
            ORDER BY ai2.position
            """,
            (str(attempt_id), terminal_band),
        ).fetchall()

        band_state: BandState = getattr(state, terminal_band.lower())
        decisive_correct = band_state.decisive_correct
        decisive_evidence = band_state.decisive_evidence

        for resp in responses:
            dom = Domain(resp["domain"])
            skipped = resp["answer_discriminator"] == "skipped"
            if skipped:
                outcome = ResponseOutcome.SKIPPED
            elif resp["correct"]:
                outcome = ResponseOutcome.CORRECT
            else:
                outcome = ResponseOutcome.INCORRECT
            domain_outcomes[dom].append(outcome)

        factors = compute_confidence(
            decisive_evidence,
            decisive_correct,
            domain_outcomes=domain_outcomes,
        )
        skills = assessed_skills(domain_outcomes)

        # Resolve level ID.
        level_row = conn.execute(
            """
            SELECT l.id
            FROM proficiency_levels l
            JOIN proficiency_frameworks f ON f.id = l.framework_id
            WHERE f.code = 'CEFR' AND l.code = %s
            LIMIT 1
            """,
            (result_band,),
        ).fetchone()
        if level_row is None:
            raise AssessmentUnavailable(f"proficiency level {result_band} not found")

        private_diag = {
            "coverage": factors.coverage,
            "margin": factors.margin,
            "agreement": factors.agreement,
            "balance": factors.balance,
            "consistency": factors.consistency,
            "raw_confidence": factors.raw,
            "decisive_correct": decisive_correct,
            "decisive_evidence": decisive_evidence,
        }

        conn.execute(
            """
            INSERT INTO assessment_results (
                id, attempt_id, user_id, template_id,
                estimated_score, estimated_level_id,
                confidence, evidence_count, assessed_skills,
                method_version, framework_mapping,
                confidence_band, private_diagnostics
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, NULL,
                %s, %s::jsonb
            )
            """,
            (
                str(uuid4()),
                str(attempt_id),
                str(actor.user_id),
                str(template_id),
                BAND_ANCHORS[result_band],
                str(level_row["id"]),
                factors.capped,
                decisive_evidence,
                skills,
                POLICY_VERSION,
                factors.band,
                json.dumps(private_diag),
            ),
        )

    def _build_session(
        self,
        conn: Connection[dict[str, Any]],
        attempt: dict[str, Any],
    ) -> AssessmentSessionData:
        """Build the public AssessmentSessionData from database rows."""
        status = attempt["status"]
        current_pos = attempt.get("current_position") or 0
        answered_count = current_pos

        # Current item: next snapshot after current_position.
        current_item: AssessmentItemPublic | None = None
        if status == "in_progress":
            next_pos = current_pos + 1
            snap = conn.execute(
                """
                SELECT * FROM assessment_attempt_items
                WHERE attempt_id = %s AND position = %s
                """,
                (str(attempt["id"]), next_pos),
            ).fetchone()
            if snap is not None:
                pub = snap["public_snapshot"]
                current_item = AssessmentItemPublic(
                    id=UUID(pub["id"]),
                    domain=pub["domain"],
                    skill=pub["skill"],
                    prompt=pub["prompt"],
                    text_snippet=pub.get("textSnippet"),
                    audio_url=pub.get("audioUrl"),
                    options=pub["options"],
                    allow_skip=pub.get("allowSkip", True),
                )

        # Result for completed attempts.
        result: StartingLevelEstimateData | None = None
        if status == "completed":
            res_row = conn.execute(
                """
                SELECT r.confidence, r.evidence_count, r.assessed_skills,
                       r.method_version, r.estimated_at, r.confidence_band,
                       l.code AS level_code, l.label AS level_label,
                       f.code AS framework_code
                FROM assessment_results r
                JOIN proficiency_levels l ON l.id = r.estimated_level_id
                JOIN proficiency_frameworks f ON f.id = l.framework_id
                WHERE r.attempt_id = %s
                LIMIT 1
                """,
                (str(attempt["id"]),),
            ).fetchone()
            if res_row is not None:
                result = StartingLevelEstimateData(
                    level_framework_code=res_row["framework_code"],
                    level_code=res_row["level_code"],
                    level_label=res_row["level_label"],
                    confidence=float(res_row["confidence"]),
                    confidence_band=res_row["confidence_band"],
                    assessed_skills=list(res_row["assessed_skills"]),
                    evidence_count=int(res_row["evidence_count"]),
                    method_version=res_row["method_version"],
                    estimated_at=_to_utc(res_row["estimated_at"]),
                )

        completed_at: datetime | None = None
        if attempt.get("completed_at") is not None:
            completed_at = _to_utc(attempt["completed_at"])

        return AssessmentSessionData(
            id=UUID(str(attempt["id"])),
            language_profile_id=UUID(str(attempt["user_language_id"])),
            status=status,
            method_version=attempt["method_version"],
            progress=AssessmentProgressData(answered_count=answered_count),
            current_item=current_item,
            result=result,
            started_at=_to_utc(attempt["started_at"]),
            updated_at=_to_utc(attempt["updated_at"]),
            completed_at=completed_at,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _start_fingerprint(actor: AuthenticatedActor, language_profile_id: UUID) -> str:
    payload = json.dumps(
        {
            "operation": "start",
            "policy": POLICY_VERSION,
            "userId": str(actor.user_id),
            "languageProfileId": str(language_profile_id),
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _answer_fingerprint(
    actor: AuthenticatedActor,
    attempt_id: UUID,
    item_id: UUID,
    selected_option_id: UUID | None,
    skipped: bool,
    response_time_ms: int,
) -> str:
    payload = json.dumps(
        {
            "operation": "answer",
            "policy": POLICY_VERSION,
            "userId": str(actor.user_id),
            "attemptId": str(attempt_id),
            "itemId": str(item_id),
            "selectedOptionId": str(selected_option_id) if selected_option_id else None,
            "skipped": skipped,
            "responseTimeMs": response_time_ms,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _session_to_snapshot(session: AssessmentSessionData) -> dict[str, Any]:
    """Serialize a session to the idempotency log snapshot format."""
    item_dict: dict[str, Any] | None = None
    if session.current_item is not None:
        item = session.current_item
        item_dict = {
            "id": str(item.id),
            "domain": item.domain,
            "skill": item.skill,
            "prompt": item.prompt,
            "textSnippet": item.text_snippet,
            "audioUrl": item.audio_url,
            "options": item.options,
            "allowSkip": item.allow_skip,
        }

    result_dict: dict[str, Any] | None = None
    if session.result is not None:
        r = session.result
        result_dict = {
            "level": {
                "frameworkCode": r.level_framework_code,
                "code": r.level_code,
                "label": r.level_label,
            },
            "confidence": r.confidence,
            "confidenceBand": r.confidence_band,
            "assessedSkills": r.assessed_skills,
            "evidenceCount": r.evidence_count,
            "methodVersion": r.method_version,
            "estimatedAt": r.estimated_at.isoformat(),
        }

    return {
        "id": str(session.id),
        "languageProfileId": str(session.language_profile_id),
        "status": session.status,
        "methodVersion": session.method_version,
        "progress": {
            "answeredCount": session.progress.answered_count,
            "minimumItemCount": session.progress.minimum_item_count,
            "maximumItemCount": session.progress.maximum_item_count,
        },
        "currentItem": item_dict,
        "result": result_dict,
        "startedAt": session.started_at.isoformat(),
        "updatedAt": session.updated_at.isoformat(),
        "completedAt": session.completed_at.isoformat() if session.completed_at else None,
    }


def _session_from_snapshot(snapshot: dict[str, Any]) -> AssessmentSessionData:
    """Reconstruct a session from the idempotency log snapshot."""
    item: AssessmentItemPublic | None = None
    if snapshot.get("currentItem") is not None:
        ci = snapshot["currentItem"]
        item = AssessmentItemPublic(
            id=UUID(ci["id"]),
            domain=ci["domain"],
            skill=ci["skill"],
            prompt=ci["prompt"],
            text_snippet=ci.get("textSnippet"),
            audio_url=ci.get("audioUrl"),
            options=ci["options"],
            allow_skip=ci.get("allowSkip", True),
        )

    result: StartingLevelEstimateData | None = None
    if snapshot.get("result") is not None:
        r = snapshot["result"]
        result = StartingLevelEstimateData(
            level_framework_code=r["level"]["frameworkCode"],
            level_code=r["level"]["code"],
            level_label=r["level"]["label"],
            confidence=r["confidence"],
            confidence_band=r["confidenceBand"],
            assessed_skills=r["assessedSkills"],
            evidence_count=r["evidenceCount"],
            method_version=r["methodVersion"],
            estimated_at=datetime.fromisoformat(r["estimatedAt"]),
        )

    completed_at: datetime | None = None
    if snapshot.get("completedAt"):
        completed_at = datetime.fromisoformat(snapshot["completedAt"])

    return AssessmentSessionData(
        id=UUID(snapshot["id"]),
        language_profile_id=UUID(snapshot["languageProfileId"]),
        status=snapshot["status"],
        method_version=snapshot["methodVersion"],
        progress=AssessmentProgressData(
            answered_count=snapshot["progress"]["answeredCount"],
            minimum_item_count=snapshot["progress"]["minimumItemCount"],
            maximum_item_count=snapshot["progress"]["maximumItemCount"],
        ),
        current_item=item,
        result=result,
        started_at=datetime.fromisoformat(snapshot["startedAt"]),
        updated_at=datetime.fromisoformat(snapshot["updatedAt"]),
        completed_at=completed_at,
    )
