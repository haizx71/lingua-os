"""FastAPI routes for Library operations."""

from __future__ import annotations

from typing import Annotated, Any, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Security

from lingua_api.content.models import (
    AttributionDto,
    ContentSummaryDto,
    ContentTypeDto,
    ReaderContentLevelDto,
    ReaderSentenceDto,
    ReadingProgressDto,
    SentenceConceptAnnotationDto,
)
from lingua_api.content.models import (
    ConceptStatusDto as ContentConceptStatusDto,
)
from lingua_api.library.domain import (
    SavedConceptItem,
    SavedContentItem,
    SavedSentenceItem,
)
from lingua_api.library.models import (
    LibraryItemDto,
    LibraryItemsResponseDto,
    LibraryMutationResponseDto,
    LibraryMutationResultDto,
    SavedConceptItemDto,
    SavedContentItemDto,
    SavedSentenceItemDto,
)
from lingua_api.library.service import LibraryApplication
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import (
    ConceptStatusDto,
    ConceptSummaryDto,
    CursorResponseMetaDto,
    ErrorEnvelopeDto,
    ProficiencyLevelDto,
    ResponseMetaDto,
)
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/library", tags=["Library"])

ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}


@router.get(
    "/items",
    operation_id="listLibraryItems",
    response_model=LibraryItemsResponseDto,
    responses=ERRORS,
    summary="List saved content, sentences, or concepts",
)
async def list_library_items(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    item_type: Annotated[
        Literal["content", "sentence", "concept"] | None, Query(alias="itemType")
    ] = None,
    query: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LibraryItemsResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    page = application.list_items(
        actor=actor,
        item_type=item_type,
        query=query,
        cursor=cursor,
        limit=limit,
    )
    dtos: list[LibraryItemDto] = []
    for item in page.items:
        if isinstance(item, SavedConceptItem):
            level_dto = (
                ProficiencyLevelDto(framework_code="CEFR", code=item.level, label=item.level)
                if item.level is not None
                else None
            )
            c_kwargs: dict[str, Any] = {
                "id": item.concept_id,
                "canonical_form": item.canonical_form,
                "part_of_speech": item.part_of_speech,
                "status": ConceptStatusDto(item.status),
                "is_due": item.is_due,
            }
            if level_dto is not None:
                c_kwargs["level"] = level_dto
            if item.ipa is not None:
                c_kwargs["ipa"] = item.ipa
            if item.audio_url is not None:
                c_kwargs["audio_url"] = item.audio_url

            dtos.append(
                SavedConceptItemDto(
                    item_type="concept",
                    saved_at=item.saved_at,
                    concept=ConceptSummaryDto(**c_kwargs),
                )
            )
        elif isinstance(item, SavedContentItem):
            progress_dto = (
                ReadingProgressDto(
                    content_id=item.content_id,
                    current_segment_id=item.reading_progress.current_segment_id,
                    furthest_segment_id=item.reading_progress.furthest_segment_id,
                    progress_percent=item.reading_progress.progress_percent,
                    is_completed=item.reading_progress.is_completed,
                    started_at=item.reading_progress.started_at,
                    last_opened_at=item.reading_progress.last_opened_at,
                    completed_at=item.reading_progress.completed_at,
                )
                if item.reading_progress is not None
                else None
            )
            attribution_dto = (
                AttributionDto(
                    source_name=item.attribution.source_name,
                    license_code=item.attribution.license_code,
                    attribution_text=item.attribution.attribution_text,
                    source_url=item.attribution.source_url,
                )
                if item.attribution is not None
                else None
            )
            cnt_kwargs: dict[str, Any] = {
                "id": item.content_id,
                "content_type": ContentTypeDto(item.content_type),
                "title": item.title,
                "target_language_code": item.target_language_code,
                "difficulty_score": item.difficulty_score,
                "known_concept_ratio": item.known_concept_ratio,
                "estimated_minutes": item.estimated_minutes,
                "is_saved": True,
            }
            if item.subtitle is not None:
                cnt_kwargs["subtitle"] = item.subtitle
            if item.excerpt is not None:
                cnt_kwargs["excerpt"] = item.excerpt
            if item.difficulty_label is not None:
                cnt_kwargs["difficulty_label"] = ReaderContentLevelDto(item.difficulty_label)
            if item.cover_image_url is not None:
                cnt_kwargs["cover_image_url"] = item.cover_image_url
            if item.fit_reason is not None:
                cnt_kwargs["fit_reason"] = item.fit_reason
            if progress_dto is not None:
                cnt_kwargs["reading_progress"] = progress_dto
            if attribution_dto is not None:
                cnt_kwargs["attribution"] = attribution_dto

            dtos.append(
                SavedContentItemDto(
                    item_type="content",
                    saved_at=item.saved_at,
                    content=ContentSummaryDto(**cnt_kwargs),
                )
            )
        elif isinstance(item, SavedSentenceItem):
            concepts_dto = [
                SentenceConceptAnnotationDto(
                    concept_id=c.concept_id,
                    canonical_form=c.canonical_form,
                    start_offset=c.start_offset_utf16,
                    end_offset=c.end_offset_utf16,
                    status=ContentConceptStatusDto(c.status),
                )
                for c in item.concepts
            ]
            snt_kwargs: dict[str, Any] = {
                "id": item.sentence_id,
                "text": item.text,
                "order": item.order,
                "concepts": concepts_dto,
            }
            if item.translation is not None:
                snt_kwargs["translation"] = item.translation
            if item.audio_url is not None:
                snt_kwargs["audio_url"] = item.audio_url

            dtos.append(
                SavedSentenceItemDto(
                    item_type="sentence",
                    saved_at=item.saved_at,
                    sentence=ReaderSentenceDto(**snt_kwargs),
                )
            )

    return LibraryItemsResponseDto(
        data=dtos,
        meta=CursorResponseMetaDto(
            request_id=request.state.request_id,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
            page_size=len(page.items),
        ),
    )


@router.put(
    "/concepts/{conceptId}",
    operation_id="saveConceptToLibrary",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
    summary="Idempotently save a concept",
)
async def save_concept_to_library(
    request: Request,
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LibraryMutationResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    result = application.save_concept(actor=actor, concept_id=concept_id)
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.id,
            item_type="concept",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.delete(
    "/concepts/{conceptId}",
    operation_id="removeConceptFromLibrary",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
    summary="Idempotently remove a saved concept",
)
async def remove_concept_from_library(
    request: Request,
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LibraryMutationResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    result = application.unsave_concept(actor=actor, concept_id=concept_id)
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.id,
            item_type="concept",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.put(
    "/content/{contentId}",
    operation_id="saveContentToLibrary",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
    summary="Idempotently save published content",
)
async def save_content_to_library(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LibraryMutationResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    result = application.save_content(actor=actor, content_id=content_id)
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.id,
            item_type="content",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.delete(
    "/content/{contentId}",
    operation_id="removeContentFromLibrary",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
    summary="Idempotently remove saved content",
)
async def remove_content_from_library(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LibraryMutationResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    result = application.unsave_content(actor=actor, content_id=content_id)
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.id,
            item_type="content",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.put(
    "/sentences/{sentenceId}",
    operation_id="saveSentenceToLibrary",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
    summary="Idempotently save an existing sentence",
)
async def save_sentence_to_library(
    request: Request,
    sentence_id: Annotated[UUID, Path(alias="sentenceId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LibraryMutationResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    result = application.save_sentence(actor=actor, sentence_id=sentence_id)
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.id,
            item_type="sentence",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.delete(
    "/sentences/{sentenceId}",
    operation_id="removeSentenceFromLibrary",
    response_model=LibraryMutationResponseDto,
    responses=ERRORS,
    summary="Idempotently remove a saved sentence",
)
async def remove_sentence_from_library(
    request: Request,
    sentence_id: Annotated[UUID, Path(alias="sentenceId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LibraryMutationResponseDto:
    application = cast(LibraryApplication, request.app.state.library_application)
    result = application.unsave_sentence(actor=actor, sentence_id=sentence_id)
    return LibraryMutationResponseDto(
        data=LibraryMutationResultDto(
            id=result.id,
            item_type="sentence",
            is_saved=result.is_saved,
            saved_at=result.saved_at,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )
