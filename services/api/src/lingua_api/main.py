from __future__ import annotations

import logging
import os
from typing import Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from lingua_api.assessment.domain import (
    AssessmentIdempotencyConflict,
    AssessmentInvalidState,
    AssessmentNotFound,
    AssessmentUnavailable,
    AssessmentValidationError,
)
from lingua_api.assessment.router import router as assessment_router
from lingua_api.assessment.service import AssessmentApplication
from lingua_api.auth import (
    AccessTokenForbidden,
    AccessTokenInvalid,
    AccessTokenVerifier,
    AuthConfigurationError,
    SupabaseJwtVerifier,
)
from lingua_api.brain.cursor import InvalidBrainCursor
from lingua_api.brain.routes import router as brain_router
from lingua_api.brain.service import BrainApplication
from lingua_api.brain.store import BrainNotFound
from lingua_api.content.domain import ContentNotFound, InvalidContentCursor
from lingua_api.content.routes import router as content_router
from lingua_api.content.service import ContentApplication
from lingua_api.dictionary.cursor import InvalidDictionaryCursor
from lingua_api.dictionary.domain import DictionaryNotFound, DictionaryValidationError
from lingua_api.dictionary.routes import router as dictionary_router
from lingua_api.dictionary.service import DictionaryApplication
from lingua_api.memory.clock import Clock
from lingua_api.memory.domain import (
    AuthenticatedActor,
    IdempotencyConflict,
    MemoryItemInactive,
    MemoryItemNotFound,
)
from lingua_api.profile.domain import (
    ProfileConflict,
    ProfileForbidden,
    ProfileIdempotencyConflict,
    ProfileInvalidState,
    ProfileNotFound,
    ProfilePreconditionFailed,
    ProfileValidationError,
)
from lingua_api.profile.routes import router as profile_router
from lingua_api.profile.service import ProfileApplication
from lingua_api.reader.domain import ReaderMutationInFlight, ReaderValidationError
from lingua_api.reader.routes import router as reader_router
from lingua_api.reader.service import ReaderApplication
from lingua_api.review.domain import InvalidReviewCursor
from lingua_api.review.models import ErrorBodyDto, ErrorCodeDto, ErrorEnvelopeDto
from lingua_api.review.routes import router as review_router
from lingua_api.review.service import ReviewApplication
from lingua_api.today.domain import (
    TodayIdempotencyConflict,
    TodayInvalidState,
    TodayNotFound,
    TodayPlanUnavailable,
)
from lingua_api.today.routes import router as today_router
from lingua_api.today.service import TodayApplication

APP_VERSION = "0.1.0"
LOGGER = logging.getLogger("lingua_api.http")


class HealthResponse(BaseModel):
    service: Literal["lingua-api"] = "lingua-api"
    status: Literal["ok"] = "ok"
    version: str = APP_VERSION


class _MissingTokenVerifier:
    def verify(self, token: str) -> AuthenticatedActor:
        del token
        raise AuthConfigurationError("Supabase JWT verification is not configured")


def create_app(
    *,
    database_url: str | None = None,
    token_verifier: AccessTokenVerifier | None = None,
    clock: Clock | None = None,
    cursor_secret: bytes | None = None,
) -> FastAPI:
    application = FastAPI(
        title="LINGUA OS API",
        version=APP_VERSION,
        description="Core API foundation for the LINGUA OS MVP.",
    )
    resolved_database_url = database_url or os.getenv("DATABASE_URL")
    resolved_cursor_secret = cursor_secret or _cursor_secret_from_environment()
    application.state.token_verifier = token_verifier or _token_verifier_from_environment()
    application.state.review_application = (
        ReviewApplication(
            resolved_database_url,
            cursor_secret=resolved_cursor_secret,
            clock=clock,
        )
        if resolved_database_url is not None and resolved_cursor_secret is not None
        else None
    )
    application.state.content_application = (
        ContentApplication(resolved_database_url, cursor_secret=resolved_cursor_secret)
        if resolved_database_url is not None and resolved_cursor_secret is not None
        else None
    )
    application.state.brain_application = (
        BrainApplication(resolved_database_url, cursor_secret=resolved_cursor_secret)
        if resolved_database_url is not None and resolved_cursor_secret is not None
        else None
    )
    application.state.dictionary_application = (
        DictionaryApplication(resolved_database_url, cursor_secret=resolved_cursor_secret)
        if resolved_database_url is not None and resolved_cursor_secret is not None
        else None
    )
    application.state.reader_application = (
        ReaderApplication(resolved_database_url, clock=clock)
        if resolved_database_url is not None
        else None
    )
    application.state.today_application = (
        TodayApplication(resolved_database_url, clock=clock)
        if resolved_database_url is not None
        else None
    )
    application.state.profile_application = (
        ProfileApplication(resolved_database_url) if resolved_database_url is not None else None
    )
    application.state.assessment_application = (
        AssessmentApplication(resolved_database_url) if resolved_database_url is not None else None
    )

    @application.middleware("http")
    async def request_context(request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.state.request_id = uuid4()
        return await call_next(request)

    _register_error_handlers(application)
    application.include_router(profile_router)
    application.include_router(review_router)
    application.include_router(content_router)
    application.include_router(dictionary_router)
    application.include_router(reader_router)
    application.include_router(today_router)
    application.include_router(brain_router)
    application.include_router(assessment_router)

    @application.get("/health", response_model=HealthResponse, include_in_schema=False)
    async def health() -> HealthResponse:
        return HealthResponse()

    return application


def _register_error_handlers(application: FastAPI) -> None:
    @application.exception_handler(AccessTokenInvalid)
    async def unauthenticated(request: Request, error: AccessTokenInvalid) -> JSONResponse:
        del error
        return _error(request, 401, "UNAUTHENTICATED", "Authentication is required.")

    @application.exception_handler(AccessTokenForbidden)
    async def forbidden(request: Request, error: AccessTokenForbidden) -> JSONResponse:
        del error
        return _error(request, 403, "FORBIDDEN", "This action is not permitted.")

    @application.exception_handler(ProfileForbidden)
    async def profile_forbidden(request: Request, error: ProfileForbidden) -> JSONResponse:
        del error
        return _error(request, 403, "FORBIDDEN", "This action is not permitted.")

    @application.exception_handler(ProfileNotFound)
    async def profile_not_found(request: Request, error: ProfileNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested profile was not found.")

    @application.exception_handler(ProfilePreconditionFailed)
    async def profile_precondition(
        request: Request, error: ProfilePreconditionFailed
    ) -> JSONResponse:
        del error
        return _error(
            request,
            412,
            "PRECONDITION_FAILED",
            "The profile version precondition was not satisfied.",
        )

    @application.exception_handler(ProfileConflict)
    async def profile_conflict(request: Request, error: ProfileConflict) -> JSONResponse:
        del error
        return _error(request, 409, "CONFLICT", "The profile already exists.")

    @application.exception_handler(ProfileIdempotencyConflict)
    async def profile_idempotency_conflict(
        request: Request, error: ProfileIdempotencyConflict
    ) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used for another request.",
        )

    @application.exception_handler(ProfileInvalidState)
    async def profile_invalid_state(request: Request, error: ProfileInvalidState) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "INVALID_STATE_TRANSITION",
            "The learner profile is not ready for this action.",
        )

    @application.exception_handler(ProfileValidationError)
    async def profile_validation(request: Request, error: ProfileValidationError) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The profile request is invalid.")

    @application.exception_handler(MemoryItemNotFound)
    async def not_found(request: Request, error: MemoryItemNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested review item was not found.")

    @application.exception_handler(MemoryItemInactive)
    async def inactive(request: Request, error: MemoryItemInactive) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "INVALID_STATE_TRANSITION",
            "The review item cannot accept an answer in its current state.",
        )

    @application.exception_handler(IdempotencyConflict)
    async def idempotency_conflict(request: Request, error: IdempotencyConflict) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used for another request.",
        )

    @application.exception_handler(InvalidReviewCursor)
    async def invalid_cursor(request: Request, error: InvalidReviewCursor) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The review cursor is invalid.")

    @application.exception_handler(InvalidContentCursor)
    async def invalid_content_cursor(request: Request, error: InvalidContentCursor) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The content cursor is invalid.")

    @application.exception_handler(InvalidBrainCursor)
    async def invalid_brain_cursor(request: Request, error: InvalidBrainCursor) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The Brain request is invalid.")

    @application.exception_handler(InvalidDictionaryCursor)
    async def invalid_dictionary_cursor(
        request: Request, error: InvalidDictionaryCursor
    ) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The Dictionary cursor is invalid.")

    @application.exception_handler(DictionaryValidationError)
    async def invalid_dictionary_request(
        request: Request, error: DictionaryValidationError
    ) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The Dictionary request is invalid.")

    @application.exception_handler(DictionaryNotFound)
    async def dictionary_not_found(request: Request, error: DictionaryNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested concept was not found.")

    @application.exception_handler(BrainNotFound)
    async def brain_not_found(request: Request, error: BrainNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested Brain resource was not found.")

    @application.exception_handler(ContentNotFound)
    async def content_not_found(request: Request, error: ContentNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested content was not found.")

    @application.exception_handler(ReaderValidationError)
    async def invalid_reader_request(
        request: Request, error: ReaderValidationError
    ) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The Reader request is invalid.")

    @application.exception_handler(ReaderMutationInFlight)
    async def reader_mutation_in_flight(
        request: Request, error: ReaderMutationInFlight
    ) -> JSONResponse:
        del error
        return _error(request, 409, "CONFLICT", "The Reader mutation is still in progress.")

    @application.exception_handler(TodayNotFound)
    async def today_not_found(request: Request, error: TodayNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested Today plan was not found.")

    @application.exception_handler(TodayInvalidState)
    async def today_invalid_state(request: Request, error: TodayInvalidState) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "INVALID_STATE_TRANSITION",
            "The activity does not yet have authoritative completion proof.",
        )

    @application.exception_handler(TodayIdempotencyConflict)
    async def today_idempotency_conflict(
        request: Request, error: TodayIdempotencyConflict
    ) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used for another request.",
        )

    @application.exception_handler(TodayPlanUnavailable)
    async def today_unavailable(request: Request, error: TodayPlanUnavailable) -> JSONResponse:
        del error
        return _error(
            request,
            503,
            "SERVICE_UNAVAILABLE",
            "The Today plan is temporarily unavailable.",
        )

    @application.exception_handler(AssessmentNotFound)
    async def assessment_not_found(request: Request, error: AssessmentNotFound) -> JSONResponse:
        del error
        return _error(request, 404, "NOT_FOUND", "The requested assessment was not found.")

    @application.exception_handler(AssessmentInvalidState)
    async def assessment_invalid_state(
        request: Request, error: AssessmentInvalidState
    ) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "INVALID_STATE_TRANSITION",
            "The assessment is not in a state that allows this action.",
        )

    @application.exception_handler(AssessmentIdempotencyConflict)
    async def assessment_idempotency_conflict(
        request: Request, error: AssessmentIdempotencyConflict
    ) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used for another request.",
        )

    @application.exception_handler(AssessmentUnavailable)
    async def assessment_unavailable(
        request: Request, error: AssessmentUnavailable
    ) -> JSONResponse:
        del error
        return _error(
            request,
            503,
            "SERVICE_UNAVAILABLE",
            "The assessment service is temporarily unavailable.",
        )

    @application.exception_handler(AssessmentValidationError)
    async def assessment_validation(
        request: Request, error: AssessmentValidationError
    ) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The assessment request is invalid.")

    @application.exception_handler(RequestValidationError)
    async def validation(request: Request, error: RequestValidationError) -> JSONResponse:
        del error
        return _error(request, 422, "VALIDATION_ERROR", "The request is invalid.")

    @application.exception_handler(ValueError)
    async def invalid_transition(request: Request, error: ValueError) -> JSONResponse:
        del error
        return _error(
            request,
            409,
            "INVALID_STATE_TRANSITION",
            "The requested state transition is invalid.",
        )

    @application.exception_handler(Exception)
    async def internal(request: Request, error: Exception) -> JSONResponse:
        LOGGER.error(
            "API request failed requestId=%s errorType=%s",
            _request_id(request),
            type(error).__name__,
        )
        return _error(request, 500, "INTERNAL_ERROR", "An unexpected error occurred.")


def _error(request: Request, status: int, code: str, message: str) -> JSONResponse:
    envelope = ErrorEnvelopeDto(
        error=ErrorBodyDto(
            code=ErrorCodeDto(code), message=message, request_id=_request_id(request)
        )
    )
    return JSONResponse(status_code=status, content=envelope.model_dump(mode="json", by_alias=True))


def _request_id(request: Request) -> UUID:
    return getattr(request.state, "request_id", uuid4())


def _token_verifier_from_environment() -> AccessTokenVerifier:
    supabase_url = os.getenv("SUPABASE_URL")
    if supabase_url:
        return SupabaseJwtVerifier(supabase_url)
    return _MissingTokenVerifier()


def _cursor_secret_from_environment() -> bytes | None:
    value = os.getenv("REVIEW_CURSOR_SECRET")
    return value.encode() if value is not None else None


app = create_app()
