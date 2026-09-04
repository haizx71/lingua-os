"""Transaction-owning Reader application service."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID, uuid4, uuid5

from psycopg import Connection

from lingua_api.brain.store import PostgresBrainStore
from lingua_api.competence.service import CompetenceEngine
from lingua_api.content.domain import ReadingProgressProjection
from lingua_api.memory.clock import Clock, SystemClock
from lingua_api.memory.domain import AuthenticatedActor, IdempotencyConflict
from lingua_api.reader.analyze_policy import analyze_transient_text
from lingua_api.reader.analyze_store import PostgresReaderAnalyzeStore
from lingua_api.reader.domain import (
    AnalyzeAnnotationResult,
    AnalyzeResult,
    AnalyzeSegmentResult,
    AnalyzeSentenceResult,
    ExposureCommand,
    ExposureResult,
    ReaderMutationInFlight,
    ReaderValidationError,
    SaveSentenceResult,
)
from lingua_api.reader.store import PostgresReaderStore


class ReaderApplication:
    def __init__(
        self,
        database_url: str,
        *,
        clock: Clock | None = None,
        competence: CompetenceEngine | None = None,
    ) -> None:
        self._clock = clock or SystemClock()
        self._store = PostgresReaderStore(database_url)
        self._competence = competence or CompetenceEngine()
        self._brain_store = PostgresBrainStore(database_url)

    def analyze(
        self,
        *,
        actor: AuthenticatedActor,
        title: str | None,
        text: str,
        target_language_code: str,
        translation_language_code: str,
    ) -> AnalyzeResult:
        if target_language_code != "en" or translation_language_code != "vi":
            raise ReaderValidationError("TASK-008A Analyze supports only the vi-to-en MVP")
        with self._brain_store.snapshot(actor=actor) as snapshot:
            profile_id = self._brain_store.resolve_profile(snapshot, None)
            candidates = PostgresReaderAnalyzeStore.load_candidates(snapshot, text=text)
            concept_ids = tuple(sorted({candidate.concept_id for candidate in candidates}))
            statuses = PostgresReaderAnalyzeStore.load_statuses(
                snapshot, profile_id=profile_id, concept_ids=concept_ids
            )
        policy_segments = analyze_transient_text(text, candidates)
        analysis_id = uuid5(
            UUID("d6f12c7b-2e2c-5b47-8f35-2a6e7d9e2c11"),
            "|".join(
                (
                    str(actor.id),
                    target_language_code,
                    translation_language_code,
                    title or "",
                    text,
                )
            ),
        )
        segments: list[AnalyzeSegmentResult] = []
        for segment_index, segment in enumerate(policy_segments):
            sentences: list[AnalyzeSentenceResult] = []
            for sentence_index, sentence in enumerate(segment.sentences):
                annotations = tuple(
                    AnalyzeAnnotationResult(
                        concept_id=annotation.concept_id,
                        canonical_form=annotation.canonical_form,
                        start_index=annotation.start_index,
                        end_index=annotation.end_index,
                        start_offset_utf16=annotation.start_offset_utf16,
                        end_offset_utf16=annotation.end_offset_utf16,
                        status=statuses.get(annotation.concept_id, "unseen"),
                    )
                    for annotation in sentence.annotations
                )
                sentences.append(
                    AnalyzeSentenceResult(
                        id=uuid5(
                            analysis_id,
                            f"sentence:{segment_index}:{sentence_index}:{sentence.text}",
                        ),
                        text=sentence.text,
                        order=sentence_index,
                        concepts=annotations,
                    )
                )
            segments.append(
                AnalyzeSegmentResult(
                    id=uuid5(analysis_id, f"segment:{segment_index}:{segment.text}"),
                    text=segment.text,
                    order=segment_index,
                    sentences=tuple(sentences),
                )
            )
        return AnalyzeResult(
            analysis_id=analysis_id,
            target_language_code=target_language_code,
            translation_language_code=translation_language_code,
            segments=tuple(segments),
            analyzed_at=_utc(self._clock.now()),
        )

    def save_sentence(
        self,
        *,
        actor: AuthenticatedActor,
        sentence_id: UUID,
        idempotency_key: UUID,
    ) -> SaveSentenceResult:
        at = _utc(self._clock.now())
        fingerprint = _fingerprint("save_sentence", {"sentenceId": str(sentence_id)})
        with self._store.connect() as connection, connection.transaction():
            self._claim_idempotency(connection, actor=actor, key=idempotency_key)
            stored = self._store.find_mutation(connection, actor=actor, key=idempotency_key)
            if stored is not None:
                operation, previous_fingerprint, snapshot = stored
                self._require_replay(operation, "save_sentence", previous_fingerprint, fingerprint)
                return _save_result(snapshot)
            result = self._store.save_sentence(
                connection, actor=actor, sentence_id=sentence_id, at=at
            )
            snapshot = _save_snapshot(result)
            self._store.store_mutation(
                connection,
                actor=actor,
                key=idempotency_key,
                operation_type="save_sentence",
                fingerprint=fingerprint,
                resource_id=sentence_id,
                snapshot=snapshot,
                completed_at=at,
            )
            return result

    def update_progress(
        self,
        *,
        actor: AuthenticatedActor,
        language_profile_id: UUID,
        content_id: UUID,
        current_segment_id: UUID,
        is_completed: bool,
        idempotency_key: UUID,
    ) -> ReadingProgressProjection:
        at = _utc(self._clock.now())
        fingerprint = _fingerprint(
            "progress",
            {
                "languageProfileId": str(language_profile_id),
                "contentId": str(content_id),
                "currentSegmentId": str(current_segment_id),
                "isCompleted": is_completed,
            },
        )
        with self._store.connect() as connection, connection.transaction():
            self._claim_idempotency(connection, actor=actor, key=idempotency_key)
            stored = self._store.find_mutation(connection, actor=actor, key=idempotency_key)
            if stored is not None:
                operation, previous_fingerprint, snapshot = stored
                self._require_replay(operation, "progress", previous_fingerprint, fingerprint)
                return _progress_result(snapshot)
            self._store.lock_progress_resource(connection, actor=actor, content_id=content_id)
            current_order, segment_count, language_code = self._store.resolve_progress_target(
                connection,
                actor=actor,
                language_profile_id=language_profile_id,
                content_id=content_id,
                segment_id=current_segment_id,
            )
            if is_completed and current_order != segment_count - 1:
                raise ValueError("Reader completion requires the final segment")
            result = self._store.write_progress(
                connection,
                actor=actor,
                language_profile_id=language_profile_id,
                content_id=content_id,
                current_segment_id=current_segment_id,
                current_order=current_order,
                segment_count=segment_count,
                language_code=language_code,
                is_completed=is_completed,
                at=at,
            )
            snapshot = _progress_snapshot(result)
            self._store.store_mutation(
                connection,
                actor=actor,
                key=idempotency_key,
                operation_type="progress",
                fingerprint=fingerprint,
                resource_id=content_id,
                snapshot=snapshot,
                completed_at=at,
            )
            return result

    def record_exposure(
        self,
        *,
        actor: AuthenticatedActor,
        command: ExposureCommand,
        idempotency_key: UUID,
    ) -> ExposureResult:
        recorded_at = _utc(self._clock.now())
        normalized_requested_at = None if command.occurred_at is None else _utc(command.occurred_at)
        fingerprint = _fingerprint(
            "exposure",
            {
                "languageProfileId": str(command.language_profile_id),
                "contentId": str(command.content_id),
                "segmentId": str(command.segment_id),
                "exposureType": command.exposure_type.value,
                "sentenceId": None if command.sentence_id is None else str(command.sentence_id),
                "startOffset": command.start_offset,
                "endOffset": command.end_offset,
                "occurredAt": (
                    None if normalized_requested_at is None else normalized_requested_at.isoformat()
                ),
            },
        )
        with self._store.connect() as connection, connection.transaction():
            self._claim_idempotency(connection, actor=actor, key=idempotency_key)
            stored = self._store.find_exposure(connection, actor=actor, key=idempotency_key)
            if stored is not None:
                previous_fingerprint, snapshot = stored
                if previous_fingerprint != fingerprint:
                    raise IdempotencyConflict("Reader exposure idempotency key was reused")
                return _exposure_result(snapshot)
            published_at, concepts, language_code = self._store.resolve_exposure(
                connection, actor=actor, command=command
            )
            occurred_at = normalized_requested_at or recorded_at
            if occurred_at < published_at:
                raise ReaderValidationError("occurredAt predates content publication")
            if occurred_at > recorded_at + timedelta(minutes=5):
                raise ReaderValidationError("occurredAt is too far in the future")
            exposure_id = uuid4()
            result = ExposureResult(
                exposure_id=exposure_id,
                content_id=command.content_id,
                segment_id=command.segment_id,
                exposure_type=command.exposure_type,
                accepted_concept_count=len(concepts),
                occurred_at=occurred_at,
                recorded_at=recorded_at,
            )
            self._store.insert_exposure(
                connection,
                actor=actor,
                command=command,
                exposure_id=exposure_id,
                key=idempotency_key,
                fingerprint=fingerprint,
                concepts=concepts,
                occurred_at=occurred_at,
                recorded_at=recorded_at,
                snapshot=_exposure_snapshot(result),
                language_code=language_code,
            )
            for concept_id in concepts:
                self._competence.apply_reader_passive_exposure(
                    connection,
                    actor=actor,
                    exposure_event_id=exposure_id,
                    concept_id=concept_id,
                    ingested_at=recorded_at,
                )
            return result

    def _claim_idempotency(
        self,
        connection: Connection[tuple[object, ...]],
        *,
        actor: AuthenticatedActor,
        key: UUID,
    ) -> None:
        if not self._store.try_lock_idempotency(connection, actor=actor, key=key):
            raise ReaderMutationInFlight("Reader mutation with this key is in flight")

    @staticmethod
    def _require_replay(
        operation: str,
        expected_operation: str,
        previous_fingerprint: str,
        fingerprint: str,
    ) -> None:
        if operation != expected_operation or previous_fingerprint != fingerprint:
            raise IdempotencyConflict("Reader idempotency key was reused")


def _fingerprint(operation: str, payload: dict[str, object]) -> str:
    logical = {"operation": operation, "payload": payload, "version": 1}
    return hashlib.sha256(
        json.dumps(logical, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _save_snapshot(result: SaveSentenceResult) -> dict[str, object]:
    return {
        "id": str(result.sentence_id),
        "itemType": "sentence",
        "isSaved": result.is_saved,
        "savedAt": result.saved_at.isoformat(),
    }


def _save_result(snapshot: dict[str, object]) -> SaveSentenceResult:
    return SaveSentenceResult(
        sentence_id=UUID(str(snapshot["id"])),
        is_saved=bool(snapshot["isSaved"]),
        saved_at=datetime.fromisoformat(str(snapshot["savedAt"])),
    )


def _progress_snapshot(result: ReadingProgressProjection) -> dict[str, object]:
    return {
        "contentId": str(result.content_id),
        "currentSegmentId": str(result.current_segment_id),
        "furthestSegmentId": str(result.furthest_segment_id),
        "progressPercent": result.progress_percent,
        "isCompleted": result.is_completed,
        "startedAt": result.started_at.isoformat(),
        "lastOpenedAt": result.last_opened_at.isoformat(),
        "completedAt": None if result.completed_at is None else result.completed_at.isoformat(),
    }


def _progress_result(snapshot: dict[str, object]) -> ReadingProgressProjection:
    completed = snapshot.get("completedAt")
    return ReadingProgressProjection(
        content_id=UUID(str(snapshot["contentId"])),
        current_segment_id=UUID(str(snapshot["currentSegmentId"])),
        furthest_segment_id=UUID(str(snapshot["furthestSegmentId"])),
        progress_percent=int(cast(int, snapshot["progressPercent"])),
        is_completed=bool(snapshot["isCompleted"]),
        started_at=datetime.fromisoformat(str(snapshot["startedAt"])),
        last_opened_at=datetime.fromisoformat(str(snapshot["lastOpenedAt"])),
        completed_at=None if completed is None else datetime.fromisoformat(str(completed)),
    )


def _exposure_snapshot(result: ExposureResult) -> dict[str, object]:
    return {
        "exposureId": str(result.exposure_id),
        "contentId": str(result.content_id),
        "segmentId": str(result.segment_id),
        "exposureType": result.exposure_type.value,
        "acceptedConceptCount": result.accepted_concept_count,
        "occurredAt": result.occurred_at.isoformat(),
        "recordedAt": result.recorded_at.isoformat(),
    }


def _exposure_result(snapshot: dict[str, object]) -> ExposureResult:
    from lingua_api.reader.domain import ReaderExposureType

    return ExposureResult(
        exposure_id=UUID(str(snapshot["exposureId"])),
        content_id=UUID(str(snapshot["contentId"])),
        segment_id=UUID(str(snapshot["segmentId"])),
        exposure_type=ReaderExposureType(str(snapshot["exposureType"])),
        accepted_concept_count=int(cast(int, snapshot["acceptedConceptCount"])),
        occurred_at=datetime.fromisoformat(str(snapshot["occurredAt"])),
        recorded_at=datetime.fromisoformat(str(snapshot["recordedAt"])),
    )


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ReaderValidationError("timestamp must include an offset")
    return value.astimezone(UTC)
