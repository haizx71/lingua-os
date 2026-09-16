"""Read-only evidence projections for Progress v1."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from lingua_api.brain.domain import ProficiencyLevelProjection
from lingua_api.competence.domain import CompetenceProjection


@dataclass(frozen=True)
class StartingLevelProjection:
    level: ProficiencyLevelProjection
    confidence: float
    confidence_band: str
    assessed_skills: tuple[str, ...]
    evidence_count: int
    method_version: str
    estimated_at: datetime


@dataclass(frozen=True)
class ProgressDayProjection:
    date: date
    minutes: int
    activities_completed: int
    goal_met: bool
    concepts_exposed: int
    concepts_strengthened: int


@dataclass(frozen=True)
class RetentionPointProjection:
    date: date
    successful_review_ratio: float
    reviewed_count: int


@dataclass(frozen=True)
class ProgressOverviewProjection:
    language_profile_id: UUID
    window_start: date
    window_end: date
    starting_level_estimate: StartingLevelProjection | None
    memory_health: float
    competence: CompetenceProjection
    successful_learning_days: int
    target_learning_days: int
    concepts_exposed: int
    concepts_strengthened: int
    total_minutes: int
    daily_activity: tuple[ProgressDayProjection, ...]
    retention_trend: tuple[RetentionPointProjection, ...]
    calculated_at: datetime
