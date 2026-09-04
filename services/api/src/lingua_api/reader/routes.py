"""FastAPI mapping for the frozen Reader mutation operations."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Header, Path, Request, Security
from pydantic import Field
from pydantic.json_schema import SkipJsonSchema

from lingua_api.content.models import ReadingProgressDto, ResponseMetaDto
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.reader.domain import ExposureCommand, ExposureResult, ReaderExposureType
from lingua_api.reader.models import (
    LibraryMutationResponseDto,
    LibraryMutationResultDto,
    ReaderAnalysisDto,
    ReaderAnalyzeResponseDto,
    ReaderExposureRequestDto,
    ReaderExposureResponseDto,
    ReaderExposureResultDto,
    ReaderLookupExposureRequestDto,
    ReaderSegmentDto,
    ReaderSentenceDto,
    ReadingProgressResponseDto,
    SaveSentenceRequestDto,
    SentenceConceptAnnotationDto,
    UpdateReaderProgressRequestDto,
)
from lingua_api.reader.service import ReaderApplication
from lingua_api.review.models import ApiModel, ErrorEnvelopeDto
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/reader", tags=["Reader"])
ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    409: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
EXPOSURE_ERRORS: dict[int | str, dict[str, Any]] = {
    **ERRORS,
    429: {"model": ErrorEnvelopeDto},
}


class ReaderAnalyzeRequestDto(ApiModel):
    title: str | SkipJsonSchema[None] = Field(
        default=None, max_length=300, exclude_if=lambda v: v is None
    )
    text: str = Field(min_length=1, max_length=20000)
    target_language_code: str
    translation_language_code: str


@router.post(
    "/analyze",
    operation_id="analyzeReaderText",
    response_model=ReaderAnalyzeResponseDto,
    responses={**ERRORS, 429: {"model": ErrorEnvelopeDto}, 503: {"model": ErrorEnvelopeDto}},
)
def analyze_reader_text(
    request: Request,
    body: ReaderAnalyzeRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> ReaderAnalyzeResponseDto:
    application = cast(ReaderApplication, request.app.state.reader_application)
    result = application.analyze(
        actor=actor,
        title=body.title,
        text=body.text,
        target_language_code=body.target_language_code,
        translation_language_code=body.translation_language_code,
    )
    return ReaderAnalyzeResponseDto(
        data=ReaderAnalysisDto(
            analysis_id=result.analysis_id,
            target_language_code=result.target_language_code,
            translation_language_code=result.translation_language_code,
            analyzed_at=result.analyzed_at,
            segments=[
                ReaderSegmentDto(
                    id=segment.id,
                    order=segment.order,
                    text=segment.text,
                    sentences=[
                        ReaderSentenceDto(
                            id=sentence.id,
                            text=sentence.text,
                            order=sentence.order,
                            concepts=[
                                SentenceConceptAnnotationDto(
                                    concept_id=annotation.concept_id,
                                    canonical_form=annotation.canonical_form,
                                    start_offset=annotation.start_offset_utf16,
                                    end_offset=annotation.end_offset_utf16,
                                    status=annotation.status,  # type: ignore[arg-type]
                                )
                                for annotation in sentence.concepts
                            ],
                        )
                        for sentence in segment.sentences
                    ],
                )
                for segment in result.segments
            ],
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.post(
    "/exposures",
    operation_id="recordReaderExposure",
    response_model=ReaderExposureResponseDto,
    responses=EXPOSURE_ERRORS,
)
def record_reader_exposure(
    request: Request,
    body: ReaderExposureRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> ReaderExposureResponseDto:
    lookup = body if isinstance(body, ReaderLookupExposureRequestDto) else None
    application = cast(ReaderApplication, request.app.state.reader_application)
    result = application.record_exposure(
        actor=actor,
        idempotency_key=idempotency_key,
        command=ExposureCommand(
            language_profile_id=body.language_profile_id,
            content_id=body.content_id,
            segment_id=body.segment_id,
            exposure_type=ReaderExposureType(body.exposure_type),
            occurred_at=body.occurred_at,
            sentence_id=None if lookup is None else lookup.sentence_id,
            start_offset=None if lookup is None else lookup.start_offset,
            end_offset=None if lookup is None else lookup.end_offset,
        ),
    )
    return ReaderExposureResponseDto(
        data=_exposure(result), meta=ResponseMetaDto(request_id=request.state.request_id)
    )


@router.put(
    "/progress/{contentId}",
    operation_id="updateReaderProgress",
    response_model=ReadingProgressResponseDto,
    responses=ERRORS,
)
def update_reader_progress(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    body: UpdateReaderProgressRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> ReadingProgressResponseDto:
    application = cast(ReaderApplication, request.app.state.reader_application)
    result = application.update_progress(
        actor=actor,
        language_profile_id=body.language_profile_id,
        content_id=content_id,
        current_segment_id=body.current_segment_id,
        is_completed=body.is_completed,
        idempotency_key=idempotency_key,
    )
    return ReadingProgressResponseDto(
        data=ReadingProgressDto(
            content_id=result.content_id,
            current_segment_id=result.current_segment_id,
            furthest_segment_id=result.furthest_segment_id,
            progress_percent=result.progress_percent,
            is_completed=result.is_completed,
            started_at=result.started_at,
            last_opened_at=result.last_opened_at,
            completed_at=result.completed_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.post(
    "/save-sentence",
    operation_id="saveReaderSentence",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
)
def save_reader_sentence(
    request: Request,
    body: SaveSentenceRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> LibraryMutationResponseDto:
    application = cast(ReaderApplication, request.app.state.reader_application)
    result = application.save_sentence(
        actor=actor,
        sentence_id=body.sentence_id,
        idempotency_key=idempotency_key,
    )
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.sentence_id,
            item_type="sentence",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _exposure(value: ExposureResult) -> ReaderExposureResultDto:
    return ReaderExposureResultDto(
        exposure_id=value.exposure_id,
        content_id=value.content_id,
        segment_id=value.segment_id,
        exposure_type=value.exposure_type.value,
        accepted_concept_count=value.accepted_concept_count,
        occurred_at=value.occurred_at,
        recorded_at=value.recorded_at,
    )
