"""Authenticated HTTP adapters for the frozen Dictionary operations."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Security
from pydantic import StringConstraints
from pydantic.json_schema import SkipJsonSchema

from lingua_api.brain.models import ConceptDetailDto
from lingua_api.brain.routes import brain_concept_detail_dto
from lingua_api.dictionary.domain import DictionarySummaryProjection
from lingua_api.dictionary.models import ConceptResponseDto, DictionarySearchResponseDto
from lingua_api.dictionary.service import DictionaryApplication
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

router = APIRouter(prefix="/v1", tags=["Concepts"])
DETAIL_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
SEARCH_ERRORS: dict[int | str, dict[str, Any]] = {
    **DETAIL_ERRORS,
    429: {"model": ErrorEnvelopeDto},
}


@router.get(
    "/concepts/{conceptId}",
    operation_id="getConcept",
    response_model=ConceptResponseDto,
    responses=DETAIL_ERRORS,
)
def get_concept(
    request: Request,
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> ConceptResponseDto:
    application = cast(DictionaryApplication, request.app.state.dictionary_application)
    detail = application.get_concept(actor=actor, concept_id=concept_id)
    concept: ConceptDetailDto = brain_concept_detail_dto(detail).concept
    return ConceptResponseDto(
        data=concept,
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.get(
    "/dictionary/search",
    operation_id="searchDictionary",
    response_model=DictionarySearchResponseDto,
    responses=SEARCH_ERRORS,
)
def search_dictionary(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    query: Annotated[str, Query(min_length=1, max_length=120)],
    language_code: Annotated[
        Annotated[str, StringConstraints(pattern=r"^[a-z]{2,3}(?:-[A-Z]{2})?$")]
        | SkipJsonSchema[None],
        Query(alias="languageCode"),
    ] = None,
    cursor: Annotated[
        Annotated[str, StringConstraints(max_length=512)] | SkipJsonSchema[None], Query()
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> DictionarySearchResponseDto:
    application = cast(DictionaryApplication, request.app.state.dictionary_application)
    page = application.search(
        actor=actor,
        query=query,
        language_code=language_code,
        cursor=cursor,
        limit=limit,
    )
    return DictionarySearchResponseDto(
        data=[_summary(item) for item in page.items],
        meta=CursorResponseMetaDto(
            request_id=request.state.request_id,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
            page_size=len(page.items),
        ),
    )


def _summary(value: DictionarySummaryProjection) -> ConceptSummaryDto:
    level = value.level
    return ConceptSummaryDto(
        id=value.id,
        canonical_form=value.canonical_form,
        part_of_speech=value.part_of_speech,
        level=(
            None
            if level is None
            else ProficiencyLevelDto(
                framework_code=level.framework_code,
                code=level.code,
                label=level.label,
            )
        ),
        status=ConceptStatusDto(value.status.value),
        is_due=value.is_due,
    )
