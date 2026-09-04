"""Domain values and invariants for TASK-006E Profile lifecycle."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


class ProfileNotFound(RuntimeError):
    """An owned application or Language Profile resource does not exist."""


class ProfileForbidden(RuntimeError):
    """A valid actor cannot bootstrap or mutate the requested application identity."""


class ProfileConflict(RuntimeError):
    """A distinct command conflicts with an existing lifetime resource."""


class ProfilePreconditionFailed(RuntimeError):
    """A required strong If-Match value is missing, malformed, or stale."""


class ProfileIdempotencyConflict(RuntimeError):
    """An actor-scoped idempotency key was reused for another logical command."""


class ProfileInvalidState(RuntimeError):
    """The application profile is not ready for the requested lifecycle transition."""


class ProfileValidationError(RuntimeError):
    """A Profile command violates a frozen domain validation rule."""


class LearningGoal(StrEnum):
    COMMUNICATION = "communication"
    WORK = "work"
    TRAVEL = "travel"
    BASICS = "basics"
    ACADEMIC = "academic"


class LanguageProfileStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


@dataclass(frozen=True)
class ProficiencyLevel:
    id: UUID
    framework_code: str
    code: str
    label: str


@dataclass(frozen=True)
class StartingLevelEstimate:
    level: ProficiencyLevel
    confidence: float
    confidence_band: str
    assessed_skills: tuple[str, ...]
    evidence_count: int
    method_version: str
    estimated_at: datetime


@dataclass(frozen=True)
class LanguageProfileProjection:
    id: UUID
    user_id: UUID
    target_language_code: str
    native_language_code: str
    goal: str
    daily_minutes: int
    target_level: ProficiencyLevel | None
    starting_level_estimate: StartingLevelEstimate | None
    status: str
    created_at: datetime
    updated_at: datetime
    revision: int


@dataclass(frozen=True)
class LearnerProfileProjection:
    user_id: UUID
    display_name: str | None
    interface_language_code: str
    time_zone: str | None
    language_profiles: tuple[LanguageProfileProjection, ...]
    created_at: datetime
    updated_at: datetime
    revision: int


@dataclass(frozen=True)
class CreateLanguageProfile:
    target_language_code: str
    native_language_code: str
    goal: str
    daily_minutes: int
    self_estimated_level_code: str | None
    target_level_code: str | None


@dataclass(frozen=True)
class CreateLanguageProfileResult:
    profile: LanguageProfileProjection
    etag: str
    replayed: bool


def learner_profile_etag(actor_id: UUID, revision: int) -> str:
    return _etag("learner-profile", actor_id, revision)


def language_profile_etag(profile_id: UUID, revision: int) -> str:
    return _etag("language-profile", profile_id, revision)


def require_if_match(supplied: str | None, current: str) -> None:
    if supplied != current:
        raise ProfilePreconditionFailed("a current strong resource ETag is required")


def validate_time_zone(value: str) -> str:
    if not value or value != value.strip() or len(value) > 64:
        raise ProfileValidationError("timeZone must be a bounded trimmed IANA identifier")
    if value[0] in "+-" or value.upper().startswith("UTC+") or value.upper().startswith("UTC-"):
        raise ProfileValidationError("raw timezone offsets are not accepted")
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as error:
        raise ProfileValidationError("timeZone is not a recognized IANA identifier") from error
    return value


def validate_status_transition(current: str, requested: str) -> None:
    if requested == current:
        return
    allowed = {
        LanguageProfileStatus.ACTIVE: {
            LanguageProfileStatus.PAUSED,
            LanguageProfileStatus.ARCHIVED,
        },
        LanguageProfileStatus.PAUSED: {
            LanguageProfileStatus.ACTIVE,
            LanguageProfileStatus.ARCHIVED,
        },
        LanguageProfileStatus.ARCHIVED: {LanguageProfileStatus.ACTIVE},
    }
    try:
        current_status = LanguageProfileStatus(current)
        requested_status = LanguageProfileStatus(requested)
    except ValueError as error:
        raise ProfileValidationError("language profile status is invalid") from error
    if requested_status not in allowed[current_status]:
        raise ProfileValidationError("language profile status transition is not allowed")


def create_fingerprint(command: CreateLanguageProfile) -> str:
    canonical = {
        "dailyMinutes": command.daily_minutes,
        "goal": command.goal,
        "nativeLanguageCode": command.native_language_code,
        "operation": "create-language-profile-v1",
        "selfEstimatedLevelCode": command.self_estimated_level_code,
        "targetLanguageCode": command.target_language_code,
        "targetLevelCode": command.target_level_code,
    }
    payload = json.dumps(canonical, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _etag(kind: str, resource_id: UUID, revision: int) -> str:
    if revision < 1:
        raise ValueError("revision must be positive")
    opaque = hashlib.sha256(f"{kind}\0{resource_id}\0{revision}".encode()).hexdigest()
    return f'"{opaque}"'
