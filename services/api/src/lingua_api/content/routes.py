"""FastAPI mapping for the frozen Content Reader operations."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Security
from pydantic.json_schema import SkipJsonSchema

from lingua_api.content.domain import (
    AttributionProjection,
    ConceptAnnotationProjection,
    ContentDetailProjection,
    ContentSegmentProjection,
    ContentSummaryProjection,
    ReaderSentenceProjection,
    ReadingProgressProjection,
)
from lingua_api.content.models import (
    AttributionDto,
    ConceptStatusDto,
    ContentDetailDto,
    ContentRecommendationsResponseDto,
    ContentResponseDto,
    ContentSegmentDto,
    ContentSegmentTypeDto,
    ContentSummaryDto,
    ContentTypeDto,
    CursorResponseMetaDto,
    ReaderContentLevelDto,
    ReaderSentenceDto,
    ReadingProgressDto,
    ResponseMetaDto,
    SentenceConceptAnnotationDto,
)
from lingua_api.content.service import ContentApplication
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import ErrorEnvelopeDto
from lingua_api.review.routes import queue_actor

router = APIRouter(prefix="/v1/content", tags=["Content"])
LIST_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    429: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
DETAIL_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}


@router.get(
    "/recommended",
    operation_id="listRecommendedContent",
    response_model=ContentRecommendationsResponseDto,
    responses=LIST_ERRORS,
)
def list_recommended_content(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(queue_actor)],
    language_profile_id: Annotated[
        UUID | SkipJsonSchema[None], Query(alias="languageProfileId")
    ] = None,
    cursor: Annotated[str | SkipJsonSchema[None], Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ContentRecommendationsResponseDto:
    application = cast(ContentApplication, request.app.state.content_application)
    page = application.list_recommended(
        actor=actor,
        language_profile_id=language_profile_id,
        cursor=cursor,
        limit=limit,
    )
    return ContentRecommendationsResponseDto(
        data=[_summary(item) for item in page.items],
        meta=CursorResponseMetaDto(
            request_id=request.state.request_id,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
            page_size=len(page.items),
        ),
    )


@router.get(
    "/{contentId}",
    operation_id="getContent",
    response_model=ContentResponseDto,
    responses=DETAIL_ERRORS,
)
def get_content(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(queue_actor)],
) -> ContentResponseDto:
    application = cast(ContentApplication, request.app.state.content_application)
    return ContentResponseDto(
        data=_detail(application.get_content(actor=actor, content_id=content_id)),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _summary(value: ContentSummaryProjection) -> ContentSummaryDto:
    return ContentSummaryDto(
        id=value.id,
        content_type=ContentTypeDto(value.content_type),
        title=value.title,
        subtitle=value.subtitle,
        excerpt=value.excerpt,
        target_language_code=value.target_language_code,
        difficulty_score=value.difficulty_score,
        difficulty_label=ReaderContentLevelDto(value.difficulty_label),
        known_concept_ratio=value.known_concept_ratio,
        estimated_minutes=value.estimated_minutes,
        fit_reason=value.fit_reason,
        is_saved=value.is_saved,
        reading_progress=_progress(value.reading_progress),
        attribution=_attribution(value.attribution),
    )


def _detail(value: ContentDetailProjection) -> ContentDetailDto:
    return ContentDetailDto(
        summary=_summary(value.summary),
        total_words=value.total_words,
        audio_url=value.audio_url,
        segments=[_segment(segment) for segment in value.segments],
    )


def _segment(value: ContentSegmentProjection) -> ContentSegmentDto:
    return ContentSegmentDto(
        id=value.id,
        order=value.order,
        segment_type=ContentSegmentTypeDto(value.segment_type),
        text=value.text,
        start_ms=value.start_ms,
        end_ms=value.end_ms,
        sentences=[_sentence(sentence) for sentence in value.sentences],
    )


def _sentence(value: ReaderSentenceProjection) -> ReaderSentenceDto:
    return ReaderSentenceDto(
        id=value.id,
        text=value.text,
        translation=value.translation,
        audio_url=value.audio_url,
        order=value.order,
        concepts=[_annotation(annotation) for annotation in value.concepts],
    )


def _annotation(value: ConceptAnnotationProjection) -> SentenceConceptAnnotationDto:
    return SentenceConceptAnnotationDto(
        concept_id=value.concept_id,
        canonical_form=value.canonical_form,
        start_offset=value.start_offset,
        end_offset=value.end_offset,
        status=ConceptStatusDto(value.status),
    )


def _progress(value: ReadingProgressProjection | None) -> ReadingProgressDto | None:
    if value is None:
        return None
    return ReadingProgressDto(
        content_id=value.content_id,
        current_segment_id=value.current_segment_id,
        furthest_segment_id=value.furthest_segment_id,
        progress_percent=value.progress_percent,
        is_completed=value.is_completed,
        started_at=value.started_at,
        last_opened_at=value.last_opened_at,
        completed_at=value.completed_at,
    )


def _attribution(value: AttributionProjection | None) -> AttributionDto | None:
    if value is None:
        return None
    return AttributionDto(
        source_name=value.source_name,
        license_code=value.license_code,
        attribution_text=value.attribution_text,
        source_url=value.source_url,
    )
