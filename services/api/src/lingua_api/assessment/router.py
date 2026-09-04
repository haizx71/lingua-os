"""FastAPI transport mapping for the three frozen Assessment operations.

Maps exactly: startStartingLevelAssessment, getStartingLevelAssessment,
submitStartingLevelResponse.

Public DTO allowlist only — no answer key, scoring diagnostics, or raw rows.
"""

from __future__ import annotations

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Header, Path, Request, Security, status
from pydantic import BaseModel, ConfigDict, Field

from lingua_api.assessment.service import AssessmentApplication
from lingua_api.assessment.store import (
    AssessmentItemPublic,
    AssessmentSessionData,
    StartingLevelEstimateData,
)
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.review.models import ErrorEnvelopeDto
from lingua_api.review.routes import authenticated_actor

router = APIRouter(prefix="/v1/assessments", tags=["Assessment"])

ASSESSMENT_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelopeDto},
    403: {"model": ErrorEnvelopeDto},
    404: {"model": ErrorEnvelopeDto},
    409: {"model": ErrorEnvelopeDto},
    422: {"model": ErrorEnvelopeDto},
    500: {"model": ErrorEnvelopeDto},
    503: {"model": ErrorEnvelopeDto},
}


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        populate_by_name=True,
        serialize_by_alias=True,
    )


# ---------------------------------------------------------------------------
# Request DTOs
# ---------------------------------------------------------------------------


class StartAssessmentRequestDto(ApiModel):
    language_profile_id: UUID


class SubmitSelectedAnswerDto(ApiModel):
    item_id: UUID
    selected_option_id: UUID
    response_time_ms: int = Field(ge=0, le=3_600_000)


class SubmitSkippedAnswerDto(ApiModel):
    item_id: UUID
    skipped: bool = True
    response_time_ms: int = Field(ge=0, le=3_600_000)


# ---------------------------------------------------------------------------
# Response DTOs
# ---------------------------------------------------------------------------


class AssessmentOptionDto(ApiModel):
    id: UUID
    text: str


class AssessmentItemDto(ApiModel):
    id: UUID
    skill: str
    domain: str
    prompt: str
    text_snippet: str | None = None
    audio_url: str | None = None
    options: list[AssessmentOptionDto]
    allow_skip: bool


class AssessmentProgressDto(ApiModel):
    answered_count: int
    minimum_item_count: int
    maximum_item_count: int


class StartingLevelBandDto(ApiModel):
    framework_code: str
    code: str
    label: str


class StartingLevelEstimateDto(ApiModel):
    level: StartingLevelBandDto
    confidence: float
    confidence_band: str
    assessed_skills: list[str]
    evidence_count: int
    method_version: str
    estimated_at: str


class AssessmentSessionDto(ApiModel):
    id: UUID
    language_profile_id: UUID
    status: str
    method_version: str
    progress: AssessmentProgressDto
    current_item: AssessmentItemDto | None
    result: StartingLevelEstimateDto | None
    started_at: str
    updated_at: str
    completed_at: str | None


class ResponseMetaDto(ApiModel):
    request_id: UUID


class AssessmentSessionResponseDto(ApiModel):
    data: AssessmentSessionDto
    meta: ResponseMetaDto


# ---------------------------------------------------------------------------
# Mapping helpers
# ---------------------------------------------------------------------------


def _item_dto(item: AssessmentItemPublic) -> AssessmentItemDto:
    return AssessmentItemDto(
        id=item.id,
        skill=item.skill,
        domain=item.domain,
        prompt=item.prompt,
        text_snippet=item.text_snippet,
        audio_url=item.audio_url,
        options=[AssessmentOptionDto(id=UUID(o["id"]), text=o["text"]) for o in item.options],
        allow_skip=item.allow_skip,
    )


def _result_dto(result: StartingLevelEstimateData) -> StartingLevelEstimateDto:
    return StartingLevelEstimateDto(
        level=StartingLevelBandDto(
            framework_code=result.level_framework_code,
            code=result.level_code,
            label=result.level_label,
        ),
        confidence=result.confidence,
        confidence_band=result.confidence_band,
        assessed_skills=result.assessed_skills,
        evidence_count=result.evidence_count,
        method_version=result.method_version,
        estimated_at=result.estimated_at.isoformat(),
    )


def _session_dto(session: AssessmentSessionData) -> AssessmentSessionDto:
    return AssessmentSessionDto(
        id=session.id,
        language_profile_id=session.language_profile_id,
        status=session.status,
        method_version=session.method_version,
        progress=AssessmentProgressDto(
            answered_count=session.progress.answered_count,
            minimum_item_count=session.progress.minimum_item_count,
            maximum_item_count=session.progress.maximum_item_count,
        ),
        current_item=_item_dto(session.current_item) if session.current_item else None,
        result=_result_dto(session.result) if session.result else None,
        started_at=session.started_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
    )


def _response(request: Request, session: AssessmentSessionData) -> AssessmentSessionResponseDto:
    return AssessmentSessionResponseDto(
        data=_session_dto(session),
        meta=ResponseMetaDto(request_id=getattr(request.state, "request_id", UUID(int=0))),
    )


def _get_app(request: Request) -> AssessmentApplication:
    app = getattr(request.app.state, "assessment_application", None)
    if app is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="Assessment service is not configured")
    return cast(AssessmentApplication, app)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=AssessmentSessionResponseDto,
    responses={
        200: {"model": AssessmentSessionResponseDto, "description": "Existing session resumed."},
        201: {"model": AssessmentSessionResponseDto, "description": "New session created."},
        **ASSESSMENT_ERROR_RESPONSES,
    },
    summary="Start or resume a bounded Starting Level Estimate",
    operation_id="startStartingLevelAssessment",
)
async def start_assessment(
    request: Request,
    body: StartAssessmentRequestDto,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    actor: Annotated[AuthenticatedActor, Security(authenticated_actor)],
) -> Any:
    from fastapi.responses import JSONResponse

    app = _get_app(request)
    result = app.start_or_resume(
        actor,
        language_profile_id=body.language_profile_id,
        idempotency_key=idempotency_key,
    )
    resp_dto = _response(request, result.session)
    http_status = 201 if result.created else 200
    return JSONResponse(
        status_code=http_status,
        content=resp_dto.model_dump(mode="json", by_alias=True),
    )


@router.get(
    "/{assessmentId}",
    response_model=AssessmentSessionResponseDto,
    responses=ASSESSMENT_ERROR_RESPONSES,
    summary="Resume owned assessment state or retrieve its estimate",
    operation_id="getStartingLevelAssessment",
)
async def get_assessment(
    request: Request,
    assessment_id: Annotated[UUID, Path(alias="assessmentId")],
    actor: Annotated[Any, Security(authenticated_actor)],
) -> AssessmentSessionResponseDto:
    app = _get_app(request)
    session = app.get_session(actor, attempt_id=assessment_id)
    return _response(request, session)


@router.post(
    "/{assessmentId}/responses",
    response_model=AssessmentSessionResponseDto,
    responses=ASSESSMENT_ERROR_RESPONSES,
    summary="Submit one answer or deliberate skip",
    operation_id="submitStartingLevelResponse",
)
async def submit_response(
    request: Request,
    assessment_id: Annotated[UUID, Path(alias="assessmentId")],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    actor: Annotated[Any, Security(authenticated_actor)],
) -> Any:
    import json as _json

    from fastapi import HTTPException
    from fastapi.responses import JSONResponse

    body_bytes = await request.body()
    try:
        body_data = _json.loads(body_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid JSON body") from exc

    if not isinstance(body_data, dict):
        raise HTTPException(status_code=422, detail="Body must be a JSON object")

    # Enforce exclusive answer forms.
    has_selected = "selectedOptionId" in body_data
    has_skipped = body_data.get("skipped") is True

    if has_selected and has_skipped:
        raise HTTPException(
            status_code=422,
            detail="selectedOptionId and skipped are mutually exclusive",
        )
    if not has_selected and not has_skipped:
        raise HTTPException(
            status_code=422, detail="Either selectedOptionId or skipped=true is required"
        )

    try:
        item_id = UUID(body_data["itemId"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="itemId must be a UUID") from exc

    response_time_ms = body_data.get("responseTimeMs", 0)
    if not isinstance(response_time_ms, int) or not (0 <= response_time_ms <= 3_600_000):
        raise HTTPException(status_code=422, detail="responseTimeMs is out of range")

    selected_option_id: UUID | None = None
    if has_selected:
        try:
            selected_option_id = UUID(body_data["selectedOptionId"])
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="selectedOptionId must be a UUID") from exc

    app = _get_app(request)
    session = app.submit_response(
        actor,
        attempt_id=assessment_id,
        item_id=item_id,
        selected_option_id=selected_option_id,
        skipped=has_skipped,
        response_time_ms=response_time_ms,
        idempotency_key=idempotency_key,
    )
    resp_dto = _response(request, session)
    return JSONResponse(
        status_code=200,
        content=resp_dto.model_dump(mode="json", by_alias=True),
    )
