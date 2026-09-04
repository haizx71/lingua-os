"""FastAPI transport mapping for the five frozen Profile operations."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Header, Path, Request, Response, Security, status

from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.profile.domain import (
    CreateLanguageProfile,
    LanguageProfileProjection,
    LearnerProfileProjection,
    ProficiencyLevel,
    StartingLevelEstimate,
    language_profile_etag,
)
from lingua_api.profile.models import (
    CompetenceDimensionDto,
    ConfidenceBandDto,
    CreateLanguageProfileRequestDto,
    LanguageProfileDto,
    LanguageProfileResponseDto,
    LanguageProfilesResponseDto,
    LanguageProfileStatusDto,
    LearningGoalDto,
    MeProfileDto,
    MeResponseDto,
    ProficiencyLevelDto,
    ResponseMetaDto,
    StartingLevelEstimateDto,
    UpdateLanguageProfileRequestDto,
    UpdateMeRequestDto,
)
from lingua_api.profile.service import ProfileApplication
from lingua_api.review.models import ErrorEnvelopeDto
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/me", tags=["Profile"])

ETAG_HEADER = {"description": "Strong opaque resource version.", "schema": {"type": "string"}}
IF_MATCH_PARAMETER = {
    "name": "If-Match",
    "in": "header",
    "required": True,
    "schema": {"type": "string"},
    "description": "Current strong opaque resource ETag.",
}

GET_ME_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "headers": {
            "ETag": ETAG_HEADER,
            "Cache-Control": {
                "description": "Authenticated bootstrap responses are never stored.",
                "schema": {"type": "string", "const": "private, no-store"},
            },
        }
    },
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
PATCH_ME_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {"headers": {"ETag": ETAG_HEADER}},
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    412: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
LIST_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
CREATE_RESPONSES: dict[int | str, dict[str, Any]] = {
    201: {"headers": {"ETag": ETAG_HEADER}},
    401: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    409: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}
PATCH_LANGUAGE_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {"headers": {"ETag": ETAG_HEADER}},
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    412: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
}


@router.get(
    "",
    operation_id="getMe",
    response_model=MeResponseDto,
    responses=GET_ME_RESPONSES,
)
def get_me(
    request: Request,
    response: Response,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> MeResponseDto:
    application = cast(ProfileApplication, request.app.state.profile_application)
    projection, etag = application.bootstrap_me(actor)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-store"
    return MeResponseDto(
        data=_me(projection, actor.email),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.patch(
    "",
    operation_id="updateMe",
    response_model=MeResponseDto,
    responses=PATCH_ME_RESPONSES,
    openapi_extra={"parameters": [IF_MATCH_PARAMETER]},
)
def update_me(
    request: Request,
    response: Response,
    body: UpdateMeRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> MeResponseDto:
    application = cast(ProfileApplication, request.app.state.profile_application)
    projection, etag = application.update_me(
        actor,
        if_match=_if_match(request),
        changes=_changes(body),
    )
    response.headers["ETag"] = etag
    return MeResponseDto(
        data=_me(projection, actor.email),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.get(
    "/languages",
    operation_id="listMyLanguageProfiles",
    response_model=LanguageProfilesResponseDto,
    responses=LIST_RESPONSES,
)
def list_languages(
    request: Request,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> LanguageProfilesResponseDto:
    application = cast(ProfileApplication, request.app.state.profile_application)
    return LanguageProfilesResponseDto(
        data=[_language(item) for item in application.list_languages(actor)],
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.post(
    "/languages",
    operation_id="createMyLanguageProfile",
    status_code=status.HTTP_201_CREATED,
    response_model=LanguageProfileResponseDto,
    responses=CREATE_RESPONSES,
)
def create_language(
    request: Request,
    response: Response,
    body: CreateLanguageProfileRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> LanguageProfileResponseDto:
    application = cast(ProfileApplication, request.app.state.profile_application)
    result = application.create_language(
        actor,
        idempotency_key=idempotency_key,
        command=CreateLanguageProfile(
            target_language_code=body.target_language_code,
            native_language_code=body.native_language_code,
            goal=body.goal.value,
            daily_minutes=body.daily_minutes,
            self_estimated_level_code=body.self_estimated_level_code,
            target_level_code=body.target_level_code,
        ),
    )
    response.headers["ETag"] = result.etag
    return LanguageProfileResponseDto(
        data=_language(result.profile),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


@router.patch(
    "/languages/{languageProfileId}",
    operation_id="updateMyLanguageProfile",
    response_model=LanguageProfileResponseDto,
    responses=PATCH_LANGUAGE_RESPONSES,
    openapi_extra={"parameters": [IF_MATCH_PARAMETER]},
)
def update_language(
    request: Request,
    response: Response,
    body: UpdateLanguageProfileRequestDto,
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
    language_profile_id: Annotated[UUID, Path(alias="languageProfileId")],
) -> LanguageProfileResponseDto:
    application = cast(ProfileApplication, request.app.state.profile_application)
    projection, etag = application.update_language(
        actor,
        profile_id=language_profile_id,
        if_match=_if_match(request),
        changes=_changes(body),
    )
    response.headers["ETag"] = etag
    return LanguageProfileResponseDto(
        data=_language(projection),
        meta=ResponseMetaDto(request_id=request.state.request_id),
    )


def _changes(model: UpdateMeRequestDto | UpdateLanguageProfileRequestDto) -> dict[str, object]:
    changes: dict[str, object] = {}
    for name in model.model_fields_set:
        value = getattr(model, name)
        changes[name] = value.value if isinstance(value, StrEnum) else value
    return changes


def _if_match(request: Request) -> str | None:
    values = request.headers.getlist("if-match")
    if len(values) != 1 or "," in values[0]:
        return None
    return values[0]


def _me(projection: LearnerProfileProjection, email: str | None) -> MeProfileDto:
    return MeProfileDto(
        id=projection.user_id,
        email=email,
        display_name=projection.display_name,
        interface_language_code=projection.interface_language_code,
        time_zone=projection.time_zone,
        language_profiles=[_language(item) for item in projection.language_profiles],
        created_at=projection.created_at,
        updated_at=projection.updated_at,
    )


def _language(projection: LanguageProfileProjection) -> LanguageProfileDto:
    return LanguageProfileDto(
        id=projection.id,
        etag=language_profile_etag(projection.id, projection.revision),
        target_language_code=projection.target_language_code,
        native_language_code=projection.native_language_code,
        goal=LearningGoalDto(projection.goal),
        daily_minutes=projection.daily_minutes,
        target_level=_level(projection.target_level),
        starting_level_estimate=_estimate(projection.starting_level_estimate),
        status=LanguageProfileStatusDto(projection.status),
        created_at=projection.created_at,
        updated_at=projection.updated_at,
    )


def _level(value: ProficiencyLevel | None) -> ProficiencyLevelDto | None:
    if value is None:
        return None
    return ProficiencyLevelDto(
        framework_code=value.framework_code,
        code=value.code,
        label=value.label,
    )


def _estimate(value: StartingLevelEstimate | None) -> StartingLevelEstimateDto | None:
    if value is None:
        return None
    return StartingLevelEstimateDto(
        level=cast(ProficiencyLevelDto, _level(value.level)),
        confidence=value.confidence,
        confidence_band=ConfidenceBandDto(value.confidence_band),
        assessed_skills=[CompetenceDimensionDto(item) for item in value.assessed_skills],
        evidence_count=value.evidence_count,
        method_version=value.method_version,
        estimated_at=value.estimated_at,
    )
