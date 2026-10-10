"""Versioned owner-only Admin content HTTP boundary."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Security, status

from lingua_api.admin.authorization import AdminActorPolicy
from lingua_api.admin.domain import (
    AdminCatalogConceptProjection,
    AdminContentProjection,
    AdminContentValidationProjection,
    AdminVietnameseTranslationSourceProjection,
)
from lingua_api.admin.models import (
    AdminCatalogConceptDto,
    AdminConceptSearchResponseDto,
    AdminConceptTypeDto,
    AdminContentDto,
    AdminContentListResponseDto,
    AdminContentResponseDto,
    AdminContentStatusDto,
    AdminContentValidationDto,
    AdminContentValidationResponseDto,
    AdminOccurrenceRoleDto,
    AdminSentenceConceptDto,
    AdminSentencePreviewDto,
    AdminVietnameseTranslationSourceDto,
    CreateAdminContentRequestDto,
    PutAdminSentenceConceptRequestDto,
    PutAdminVietnameseTranslationsRequestDto,
    ReaderContentLevelDto,
    ResponseMetaDto,
    UpdateAdminContentRequestDto,
    ValidationIssueDto,
)
from lingua_api.admin.service import AdminContentApplication
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import ErrorEnvelopeDto
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/admin", tags=["Admin"])
COMMON_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
DETAIL_ERRORS = {**COMMON_ERRORS, 404: {"model": ErrorEnvelopeDto}}
MUTATION_ERRORS = {
    **DETAIL_ERRORS,
    409: {"model": ErrorEnvelopeDto},
}


def admin_actor(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> AuthenticatedActor:
    policy = cast(AdminActorPolicy, request.app.state.admin_actor_policy)
    policy.require(actor)
    return actor


@router.get(
    "/concepts/search",
    operation_id="searchAdminConcepts",
    response_model=AdminConceptSearchResponseDto,
    responses=COMMON_ERRORS,
)
def search_admin_concepts(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
    query: Annotated[str, Query(min_length=1, max_length=120)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> AdminConceptSearchResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return AdminConceptSearchResponseDto(
        data=[_catalog_concept(item) for item in application.search_concepts(query, limit=limit)],
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.get(
    "/content",
    operation_id="listAdminContent",
    response_model=AdminContentListResponseDto,
    responses=COMMON_ERRORS,
)
def list_admin_content(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentListResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return AdminContentListResponseDto(
        data=[_content(item) for item in application.list_content()],
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.post(
    "/content",
    operation_id="createAdminContent",
    response_model=AdminContentResponseDto,
    status_code=status.HTTP_201_CREATED,
    responses={**COMMON_ERRORS, 409: {"model": ErrorEnvelopeDto}},
)
def create_admin_content(
    request: Request,
    body: CreateAdminContentRequestDto,
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    values = {
        "title": body.title,
        "body": body.body,
        "level": body.level.value,
        "author_name": body.author_name,
        "source_name": body.source_name,
        "source_version": body.source_version,
        "attribution_text": body.attribution_text,
        "rights_statement": body.rights_statement,
    }
    return _response(request, application.create_content(values))


@router.get(
    "/content/{contentId}",
    operation_id="getAdminContent",
    response_model=AdminContentResponseDto,
    responses=DETAIL_ERRORS,
)
def get_admin_content(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return _response(request, application.get_content(content_id))


@router.patch(
    "/content/{contentId}",
    operation_id="updateAdminContent",
    response_model=AdminContentResponseDto,
    responses=MUTATION_ERRORS,
)
def update_admin_content(
    request: Request,
    body: UpdateAdminContentRequestDto,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    updates = {
        key: value.value if isinstance(value, ReaderContentLevelDto) else value
        for key, value in body.model_dump(exclude_none=True).items()
    }
    return _response(request, application.update_content(content_id, updates))


@router.put(
    "/content/{contentId}/translations/vi",
    operation_id="putAdminVietnameseTranslations",
    response_model=AdminContentResponseDto,
    responses=MUTATION_ERRORS,
)
def put_admin_vietnamese_translations(
    request: Request,
    body: PutAdminVietnameseTranslationsRequestDto,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    source = (
        None
        if body.source is None
        else {
            "author_name": body.source.author_name,
            "source_name": body.source.source_name,
            "source_version": body.source.source_version,
            "attribution_text": body.source.attribution_text,
            "rights_statement": body.source.rights_statement,
        }
    )
    entries = [(entry.ordinal, entry.source_text, entry.translation_text) for entry in body.entries]
    return _response(request, application.put_vietnamese_translations(content_id, entries, source))


@router.post(
    "/content/{contentId}/validate",
    operation_id="validateAdminContent",
    response_model=AdminContentValidationResponseDto,
    responses=MUTATION_ERRORS,
)
def validate_admin_content(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentValidationResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    value = application.validate_content(content_id)
    return AdminContentValidationResponseDto(
        data=_validation(value), meta=ResponseMetaDto(request_id=request.state.request_id)
    )


@router.post(
    "/content/{contentId}/publish",
    operation_id="publishAdminContent",
    response_model=AdminContentResponseDto,
    responses=MUTATION_ERRORS,
)
def publish_admin_content(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return _response(request, application.publish_content(content_id))


@router.post(
    "/content/{contentId}/retire",
    operation_id="retireAdminContent",
    response_model=AdminContentResponseDto,
    responses=MUTATION_ERRORS,
)
def retire_admin_content(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return _response(request, application.retire_content(content_id))


@router.put(
    "/content/{contentId}/sentences/{sentenceId}/concepts/{conceptId}",
    operation_id="putAdminSentenceConcept",
    response_model=AdminContentResponseDto,
    responses=MUTATION_ERRORS,
)
def put_admin_sentence_concept(
    request: Request,
    body: PutAdminSentenceConceptRequestDto,
    content_id: Annotated[UUID, Path(alias="contentId")],
    sentence_id: Annotated[UUID, Path(alias="sentenceId")],
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return _response(
        request,
        application.put_sentence_concept(
            content_id,
            sentence_id,
            concept_id,
            start_offset=body.start_offset,
            end_offset=body.end_offset,
            occurrence_role=body.occurrence_role.value,
        ),
    )


@router.delete(
    "/content/{contentId}/sentences/{sentenceId}/concepts/{conceptId}",
    operation_id="deleteAdminSentenceConcept",
    response_model=AdminContentResponseDto,
    responses=MUTATION_ERRORS,
)
def delete_admin_sentence_concept(
    request: Request,
    content_id: Annotated[UUID, Path(alias="contentId")],
    sentence_id: Annotated[UUID, Path(alias="sentenceId")],
    concept_id: Annotated[UUID, Path(alias="conceptId")],
    actor: Annotated[AuthenticatedActor, Security(admin_actor)],
    start_offset: Annotated[int, Query(alias="startOffset", ge=0)],
    end_offset: Annotated[int, Query(alias="endOffset", ge=1)],
) -> AdminContentResponseDto:
    del actor
    application = cast(AdminContentApplication, request.app.state.admin_content_application)
    return _response(
        request,
        application.delete_sentence_concept(
            content_id,
            sentence_id,
            concept_id,
            start_offset=start_offset,
            end_offset=end_offset,
        ),
    )


def _response(request: Request, value: AdminContentProjection) -> AdminContentResponseDto:
    return AdminContentResponseDto(
        data=_content(value), meta=ResponseMetaDto(request_id=request.state.request_id)
    )


def _content(value: AdminContentProjection) -> AdminContentDto:
    return AdminContentDto(
        id=value.id,
        title=value.title,
        body=value.body,
        language_code="en",
        content_type="article",
        level=ReaderContentLevelDto(value.level),
        status=AdminContentStatusDto(value.status),
        author_name=value.author_name,
        source_name=value.source_name,
        source_version=value.source_version,
        license_code="LINGUA-FIRST-PARTY",
        attribution_text=value.attribution_text,
        rights_statement=value.rights_statement,
        source_record_key=value.source_record_key,
        raw_hash=value.raw_hash,
        sentences=[
            AdminSentencePreviewDto(
                id=sentence.id,
                order=sentence.order,
                text=sentence.text,
                translation_vi=sentence.translation_vi,
                concept_count=sentence.concept_count,
                concepts=[
                    AdminSentenceConceptDto(
                        concept=_catalog_concept(occurrence.concept),
                        start_offset=occurrence.start_offset,
                        end_offset=occurrence.end_offset,
                        occurrence_role=AdminOccurrenceRoleDto(occurrence.occurrence_role),
                        surface_text=occurrence.surface_text,
                    )
                    for occurrence in sentence.concepts
                ],
            )
            for sentence in value.sentences
        ],
        translation_source=(
            None
            if value.translation_source is None
            else _translation_source(value.translation_source)
        ),
        published_at=value.published_at,
        created_at=value.created_at,
        updated_at=value.updated_at,
    )


def _validation(value: AdminContentValidationProjection) -> AdminContentValidationDto:
    return AdminContentValidationDto(
        content=_content(value.content),
        is_valid=value.is_valid,
        issues=[
            ValidationIssueDto(field=issue.field, reason=issue.reason) for issue in value.issues
        ],
    )


def _catalog_concept(value: AdminCatalogConceptProjection) -> AdminCatalogConceptDto:
    return AdminCatalogConceptDto(
        id=value.id,
        concept_type=AdminConceptTypeDto(value.concept_type),
        canonical_form=value.canonical_form,
        part_of_speech=value.part_of_speech,
        definition=value.definition,
    )


def _translation_source(
    value: AdminVietnameseTranslationSourceProjection,
) -> AdminVietnameseTranslationSourceDto:
    return AdminVietnameseTranslationSourceDto(
        target_language_code="vi",
        author_name=value.author_name,
        source_name=value.source_name,
        source_version=value.source_version,
        license_code="LINGUA-FIRST-PARTY",
        attribution_text=value.attribution_text,
        rights_statement=value.rights_statement,
        source_record_key=value.source_record_key,
        raw_hash=value.raw_hash,
    )
