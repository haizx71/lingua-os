"""FastAPI transport mapping for the two authoritative Review operations."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Header, Path, Query, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic.json_schema import SkipJsonSchema

from lingua_api.auth import AccessTokenForbidden, AccessTokenInvalid, AccessTokenVerifier
from lingua_api.competence.domain import CompetenceProjection, CompetenceScoreProjection
from lingua_api.memory.domain import (
    AuthenticatedActor,
    ReviewExerciseMode,
    ReviewRating,
    ReviewSubmission,
)
from lingua_api.review.domain import (
    DueReviewProjection,
)
from lingua_api.review.models import (
    CompetenceScoreDto,
    CompetenceSignalsDto,
    ConceptStatusDto,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    ErrorEnvelopeDto,
    MemorySnapshotDto,
    MemoryStateDto,
    ProficiencyLevelDto,
    ResponseMetaDto,
    ReviewAnswerRequestDto,
    ReviewAnswerResponseDto,
    ReviewAnswerResultDto,
    ReviewExerciseModeDto,
    ReviewPromptDto,
    ReviewQueueItemDto,
    ReviewQueueResponseDto,
)
from lingua_api.review.service import ReviewApplication

router = APIRouter(prefix="/v1/review", tags=["Review"])
bearer = HTTPBearer(scheme_name="bearerAuth", bearerFormat="JWT", auto_error=False)

QUEUE_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto, "description": "Missing or invalid bearer token."},
    404: {"model": ErrorEnvelopeDto, "description": "Application profile not found."},
    422: {"model": ErrorEnvelopeDto, "description": "Invalid cursor or query parameters."},
    429: {"model": ErrorEnvelopeDto, "description": "Rate limit exceeded."},
    500: {"model": ErrorEnvelopeDto, "description": "Unexpected server failure."},
}
ANSWER_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto, "description": "Missing or invalid bearer token."},
    403: {"model": ErrorEnvelopeDto, "description": "Authenticated actor is not allowed."},
    404: {"model": ErrorEnvelopeDto, "description": "Review item was not found."},
    409: {"model": ErrorEnvelopeDto, "description": "Invalid state or idempotency conflict."},
    422: {"model": ErrorEnvelopeDto, "description": "Request validation failed."},
    500: {"model": ErrorEnvelopeDto, "description": "Unexpected server failure."},
}


def authenticated_actor(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
) -> AuthenticatedActor:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AccessTokenInvalid("bearer credential is required")
    verifier = cast(AccessTokenVerifier, request.app.state.token_verifier)
    return verifier.verify(credentials.credentials)


def queue_actor(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
) -> AuthenticatedActor:
    try:
        return authenticated_actor(request, credentials)
    except AccessTokenForbidden as error:
        # The queue contract has no 403 response; non-learner credentials are invalid here.
        raise AccessTokenInvalid("learner bearer credential is required") from error


@router.get(
    "/queue",
    operation_id="listReviewQueue",
    response_model=ReviewQueueResponseDto,
    responses=QUEUE_RESPONSES,
)
def list_review_queue(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(queue_actor)],
    cursor: Annotated[str | SkipJsonSchema[None], Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    language_profile_id: Annotated[
        UUID | SkipJsonSchema[None], Query(alias="languageProfileId")
    ] = None,
) -> ReviewQueueResponseDto:
    application = cast(ReviewApplication, request.app.state.review_application)
    page = application.list_queue(
        actor=actor,
        language_profile_id=language_profile_id,
        cursor=cursor,
        limit=limit,
    )
    items = [_queue_item(item) for item in page.items]
    return ReviewQueueResponseDto(
        data=items,
        meta=CursorResponseMetaDto(
            request_id=request.state.request_id,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
            page_size=len(items),
        ),
    )


@router.post(
    "/{reviewItemId}/answer",
    operation_id="answerReviewItem",
    response_model=ReviewAnswerResponseDto,
    responses=ANSWER_RESPONSES,
)
def answer_review_item(
    request: Request,
    review_item_id: Annotated[UUID, Path(alias="reviewItemId")],
    body: ReviewAnswerRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> ReviewAnswerResponseDto:
    application = cast(ReviewApplication, request.app.state.review_application)
    projection = application.answer(
        actor=actor,
        review_item_id=review_item_id,
        exercise_mode=(
            ReviewExerciseMode(body.exercise_mode.value)
            if body.exercise_mode is not None
            else ReviewExerciseMode.SELF_RECALL
        ),
        validate_exercise_mode=body.exercise_mode is not None,
        submission=ReviewSubmission(
            idempotency_key=idempotency_key,
            rating=ReviewRating(body.rating.value),
            response_time_ms=body.response_time_ms,
            correct=body.correct,
            response_text=body.response_text,
            selected_option_id=body.selected_option_id,
        ),
    )
    return ReviewAnswerResponseDto(
        data=ReviewAnswerResultDto(
            review_item_id=projection.review_item_id,
            memory=MemorySnapshotDto(
                state=MemoryStateDto(projection.memory.state.value),
                due_at=projection.memory.due_at,
                last_reviewed_at=projection.memory.last_review_at,
                is_due=False,
            ),
            competence=_competence(projection.competence),
            remaining_due_count=projection.remaining_due_count,
            feedback=projection.feedback,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _queue_item(item: DueReviewProjection) -> ReviewQueueItemDto:
    level = None
    if (
        item.framework_code is not None
        and item.level_code is not None
        and item.level_label is not None
    ):
        level = ProficiencyLevelDto(
            framework_code=item.framework_code,
            code=item.level_code,
            label=item.level_label,
        )

    concept_fields: dict[str, object] = {
        "id": item.concept_id,
        "canonical_form": item.canonical_form,
        "level": level,
        "status": ConceptStatusDto(item.concept_status),
        "is_due": True,
    }
    if item.part_of_speech is not None:
        concept_fields["part_of_speech"] = item.part_of_speech
    prompt_fields: dict[str, str] = {"prompt_text": item.prompt_text}
    if item.context_sentence is not None:
        prompt_fields["context_sentence"] = item.context_sentence
    if item.translation is not None:
        prompt_fields["translation"] = item.translation
    if item.audio_url is not None:
        prompt_fields["audio_url"] = item.audio_url

    return ReviewQueueItemDto(
        review_item_id=item.review_item_id,
        concept=ConceptSummaryDto.model_validate(concept_fields),
        exercise_mode=ReviewExerciseModeDto(item.exercise_mode.value),
        prompt=ReviewPromptDto.model_validate(prompt_fields),
        memory=MemorySnapshotDto(
            state=MemoryStateDto(item.memory_state.value),
            due_at=item.due_at,
            last_reviewed_at=item.last_review_at,
            is_due=True,
        ),
        competence=_competence(item.competence),
    )


def _competence(projection: CompetenceProjection) -> CompetenceSignalsDto:
    return CompetenceSignalsDto(
        recognition=_score(projection.recognition),
        listening=_score(projection.listening),
        production=_score(projection.production),
    )


def _score(projection: CompetenceScoreProjection) -> CompetenceScoreDto:
    return CompetenceScoreDto(
        score=projection.score,
        confidence=projection.confidence,
        evidence_count=projection.evidence_count,
        updated_at=projection.updated_at,
    )
