"""Authenticated HTTP adapters for the frozen Dictionary operations."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Body, Path, Query, Request, Response, Security
from pydantic import StringConstraints, ValidationError
from pydantic.json_schema import SkipJsonSchema

from lingua_api.brain.models import ConceptDetailDto
from lingua_api.brain.routes import brain_concept_detail_dto, brain_concept_summary_dto
from lingua_api.dictionary.domain import (
    DictionaryLemmaGroupProjection,
    DictionarySummaryProjection,
)
from lingua_api.dictionary.lookup import (
    MAX_LOOKUP_RESPONSE_BYTES,
    MAX_LOOKUP_TOTAL_SENSES,
    DictionaryLookupResultTooLarge,
    DictionaryLookupUnavailable,
    normalize_dictionary_surface,
)
from lingua_api.dictionary.lookup_models import (
    DictionaryLookupDataDto,
    DictionaryLookupRequestDto,
    DictionaryLookupResponseDto,
    DictionaryLookupResultDto,
)
from lingua_api.dictionary.models import (
    ConceptResponseDto,
    DictionaryLemmaGroupDto,
    DictionaryLinkedConceptDto,
    DictionarySearchResponseDto,
    DictionarySenseDto,
)
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
LOOKUP_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
    503: {"model": ErrorEnvelopeDto},
}


@router.get(
    "/concepts/{conceptId}",
    operation_id="getConcept",
    response_model=ConceptResponseDto,
    responses=DETAIL_ERRORS,
)
def get_concept(
    request: Request,
    response: Response,
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> ConceptResponseDto:
    application = cast(DictionaryApplication, request.app.state.dictionary_application)
    detail = application.get_concept(actor=actor, concept_id=concept_id)
    concept: ConceptDetailDto = brain_concept_detail_dto(detail).concept
    response.headers["Cache-Control"] = "private, no-store"
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
    response: Response,
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
    include_lemma_groups: Annotated[bool, Query(alias="includeLemmaGroups")] = False,
) -> DictionarySearchResponseDto:
    application = cast(DictionaryApplication, request.app.state.dictionary_application)
    page = application.search(
        actor=actor,
        query=query,
        language_code=language_code,
        cursor=cursor,
        limit=limit,
        include_lemma_groups=include_lemma_groups,
    )
    response.headers["Cache-Control"] = "private, no-store"
    return DictionarySearchResponseDto(
        data=[_summary(item) for item in page.items],
        meta=CursorResponseMetaDto(
            request_id=request.state.request_id,
            next_cursor=page.next_cursor,
            has_more=page.has_more,
            page_size=len(page.items),
        ),
        lemma_groups=(
            None
            if page.lemma_groups is None
            else [_lemma_group(item) for item in page.lemma_groups]
        ),
    )


@router.post(
    "/dictionary/lookup",
    operation_id="lookupDictionaryWord",
    response_model=DictionaryLookupResponseDto,
    responses=LOOKUP_ERRORS,
)
def lookup_dictionary_word(
    request: Request,
    response: Response,
    body: Annotated[DictionaryLookupRequestDto, Body()],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> DictionaryLookupResponseDto:
    del actor
    surface = body.surface
    normalized_surface = normalize_dictionary_surface(surface)
    provider = getattr(request.app.state, "dictionary_lookup_provider", None)
    if provider is None:
        raise DictionaryLookupUnavailable

    try:
        result = DictionaryLookupResultDto.model_validate(provider.lookup(normalized_surface))
    except ValidationError as error:
        raise DictionaryLookupUnavailable from error
    if (result.match_status == "found") != bool(result.entries):
        raise DictionaryLookupUnavailable
    if sum(len(entry.senses) for entry in result.entries) > MAX_LOOKUP_TOTAL_SENSES:
        raise DictionaryLookupResultTooLarge
    response_body = DictionaryLookupResponseDto(
        data=DictionaryLookupDataDto(
            surface=surface,
            match_status=result.match_status,
            entries=result.entries,
        ),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )
    if (
        len(response_body.model_dump_json(by_alias=True).encode("utf-8"))
        > MAX_LOOKUP_RESPONSE_BYTES
    ):
        raise DictionaryLookupResultTooLarge
    response.headers["Cache-Control"] = "private, no-store"
    return response_body


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


def _lemma_group(value: DictionaryLemmaGroupProjection) -> DictionaryLemmaGroupDto:
    return DictionaryLemmaGroupDto(
        lexeme_id=value.lexeme_id,
        lemma=value.lemma,
        part_of_speech=value.part_of_speech,
        matched_forms=list(value.matched_forms),
        senses=[
            DictionarySenseDto(
                sense_id=sense.id,
                sense_order=sense.order,
                definition=sense.definition,
                definition_language_code=sense.definition_language_code,
                translated_definition=sense.translated_definition,
                translation_language_code=sense.translation_language_code,
                concepts=[
                    DictionaryLinkedConceptDto(
                        **brain_concept_summary_dto(linked.item).model_dump(by_alias=False),
                        is_saved=linked.is_saved,
                    )
                    for linked in sense.concepts
                ],
            )
            for sense in value.senses
        ],
    )
