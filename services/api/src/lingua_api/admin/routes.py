"""Versioned owner-only Admin content HTTP boundary."""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Path, Request, Security, status

from lingua_api.admin.authorization import AdminActorPolicy
from lingua_api.admin.domain import AdminContentProjection, AdminContentValidationProjection
from lingua_api.admin.models import (
    AdminContentDto,
    AdminContentListResponseDto,
    AdminContentResponseDto,
    AdminContentStatusDto,
    AdminContentValidationDto,
    AdminContentValidationResponseDto,
    AdminSentencePreviewDto,
    CreateAdminContentRequestDto,
    ReaderContentLevelDto,
    ResponseMetaDto,
    UpdateAdminContentRequestDto,
    ValidationIssueDto,
)
from lingua_api.admin.service import AdminContentApplication
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import ErrorEnvelopeDto
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/admin/content", tags=["Admin"])
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
    "",
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
    "",
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
    "/{contentId}",
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
    "/{contentId}",
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


@router.post(
    "/{contentId}/validate",
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
    "/{contentId}/publish",
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
    "/{contentId}/retire",
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
                concept_count=sentence.concept_count,
            )
            for sentence in value.sentences
        ],
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
