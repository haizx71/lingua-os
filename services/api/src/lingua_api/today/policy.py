"""Pure, versioned `today-heuristic-v1` allocation policy."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from lingua_api.today.domain import (
    ContentCandidate,
    ReviewCandidate,
    TodayActivityDecision,
    TodayContext,
    TodayDecision,
)


@dataclass(frozen=True)
class TodayPolicy:
    version: str = "today-heuristic-v1"
    review_minutes_per_item: int = 1
    content_block_min_minutes: int = 5
    content_block_max_minutes: int = 10
    content_reserve_minutes: int = 8
    listening_block_minutes: int = 5
    max_read_activities: int = 2
    max_listen_activities: int = 1
    max_new_content: int = 1
    max_new_unseen_concepts: int = 4
    recent_exposure_window_hours: int = 48
    review_candidate_limit_max: int = 181
    competence_candidate_limit: int = 50
    content_candidate_limit: int = 20


TODAY_HEURISTIC_V1 = TodayPolicy(
    version="today-heuristic-v1",
    review_minutes_per_item=1,
    content_block_min_minutes=5,
    content_block_max_minutes=10,
    content_reserve_minutes=8,
    listening_block_minutes=5,
    max_read_activities=2,
    max_listen_activities=1,
    max_new_content=1,
    max_new_unseen_concepts=4,
    recent_exposure_window_hours=48,
    review_candidate_limit_max=181,
    competence_candidate_limit=50,
    content_candidate_limit=20,
)
TODAY_HEURISTIC_V2 = TodayPolicy(
    version="today-heuristic-v2",
    review_minutes_per_item=1,
    content_block_min_minutes=5,
    content_block_max_minutes=10,
    content_reserve_minutes=8,
    listening_block_minutes=5,
    max_read_activities=2,
    max_listen_activities=1,
    max_new_content=1,
    max_new_unseen_concepts=4,
    recent_exposure_window_hours=48,
    review_candidate_limit_max=181,
    competence_candidate_limit=50,
    content_candidate_limit=20,
)


def build_today_decision(
    context: TodayContext,
    reviews: tuple[ReviewCandidate, ...],
    content: tuple[ContentCandidate, ...],
    *,
    policy: TodayPolicy = TODAY_HEURISTIC_V1,
) -> TodayDecision:
    """Rank bounded authoritative candidates and pack one learner-local session."""
    if context.target_minutes < 5 or context.target_minutes > 180:
        raise ValueError("target minutes must be between 5 and 180")
    if context.as_of.tzinfo is None:
        raise ValueError("asOf must be timezone-aware")

    ordered_reviews = tuple(sorted(reviews, key=lambda item: (item.due_at, item.review_item_id)))
    due_concepts = {item.concept_id for item in ordered_reviews}
    eligible_content = tuple(
        sorted(
            (item for item in content if _eligible_content(item, policy)),
            key=lambda item: _content_order(
                item, remediation_first=policy.version == TODAY_HEURISTIC_V2.version
            ),
        )
    )

    activities: list[TodayActivityDecision] = []
    remaining = context.target_minutes
    if ordered_reviews:
        if context.target_minutes >= 15:
            if policy.version == TODAY_HEURISTIC_V2.version:
                reserve = _v2_content_reserve(eligible_content, remaining, policy)
            else:
                reserve = (
                    policy.content_reserve_minutes
                    if _has_packable_content(eligible_content, remaining, policy)
                    else 0
                )
        else:
            reserve = 0
        review_capacity = max(0, remaining - reserve)
        selected = ordered_reviews[: review_capacity // policy.review_minutes_per_item]
        if selected:
            review_minutes = len(selected) * policy.review_minutes_per_item
            activities.append(_review_activity(selected, context, policy))
            remaining -= review_minutes

    read_count = 0
    listen_count = 0
    new_count = 0
    selected_content: set[UUID] = set()
    for candidate in eligible_content:
        if remaining < policy.content_block_min_minutes or len(selected_content) >= 3:
            break
        if candidate.content_id in selected_content:
            continue
        is_new = _is_new(candidate)
        if is_new and new_count >= policy.max_new_content:
            continue
        weakness = _weakness(candidate, due_concepts)
        use_listen = candidate.has_audio and weakness == "WEAK_LISTENING"
        if use_listen and listen_count >= policy.max_listen_activities:
            continue
        if not use_listen and read_count >= policy.max_read_activities:
            continue
        minutes = _content_minutes(candidate, use_listen, remaining, policy)
        if minutes is None:
            continue

        reason_codes = (
            _v2_content_reasons(candidate, weakness, is_new)
            if policy.version == TODAY_HEURISTIC_V2.version
            else _content_reasons(candidate, weakness, is_new)
        )
        source = _candidate_source(candidate)
        activity_type: Literal["read", "listen"] = "listen" if use_listen else "read"
        activities.append(
            TodayActivityDecision(
                activity_type=activity_type,
                title=("Luyện nghe" if use_listen else "Đọc tiếp") + f": {candidate.title}",
                description=(
                    "Luyện nghe với nội dung phù hợp hiện tại."
                    if use_listen
                    else "Đọc một khối nội dung phù hợp với hồ sơ học hiện tại."
                ),
                estimated_minutes=minutes,
                reason_codes=reason_codes,
                reason_text=_reason_text(reason_codes),
                target_count=1,
                content_id=candidate.content_id,
                concept_id=(
                    candidate.reinforcement_concept_ids[0]
                    if candidate.reinforcement_concept_ids
                    else None
                ),
                diagnostics={
                    "policyVersion": policy.version,
                    "asOf": context.as_of.isoformat(),
                    "candidateSource": source,
                    "sourceIdentity": str(candidate.content_id),
                    "sourceRank": candidate.source_rank,
                    "eligibility": "ELIGIBLE",
                    "priorityTier": _priority_tier(candidate, weakness),
                    "allocationReason": activity_type.upper(),
                    "estimatedCost": minutes,
                    "deduplicationKey": f"{activity_type}:{candidate.content_id}",
                    "noveltyCount": candidate.unseen_concept_count if is_new else 0,
                },
            )
        )
        selected_content.add(candidate.content_id)
        remaining -= minutes
        if use_listen:
            listen_count += 1
        else:
            read_count += 1
        if is_new:
            new_count += 1

    return TodayDecision(
        status="completed" if not activities else "active",
        activities=tuple(activities),
        unused_minutes=remaining,
    )


def _eligible_content(candidate: ContentCandidate, policy: TodayPolicy) -> bool:
    if candidate.is_completed:
        return False
    return not (
        _is_new(candidate) and candidate.unseen_concept_count > policy.max_new_unseen_concepts
    )


def _content_order(
    candidate: ContentCandidate, *, remediation_first: bool = False
) -> tuple[object, ...]:
    if candidate.is_unfinished:
        return (0, _descending_time(candidate.last_opened_at), candidate.content_id)
    if candidate.is_saved:
        return (1, _descending_time(candidate.saved_at), candidate.content_id)
    if remediation_first:
        if candidate.remediation_status == "forgotten":
            return (2, 0, candidate.source_rank, candidate.content_id)
        if candidate.remediation_status == "weak":
            return (2, 1, candidate.source_rank, candidate.content_id)
        if candidate.recently_exposed:
            return (2, 2, candidate.source_rank, candidate.content_id)
        return (2, 3, candidate.source_rank, candidate.content_id)
    if candidate.forgotten:
        boost = 0
    elif _has_weakness(candidate):
        boost = 1
    elif candidate.recently_exposed:
        boost = 2
    else:
        boost = 3
    return (2, boost, candidate.source_rank, candidate.content_id)


def _descending_time(value: datetime | None) -> float:
    return -(value.timestamp() if value is not None else 0.0)


def _has_packable_content(
    candidates: tuple[ContentCandidate, ...], remaining: int, policy: TodayPolicy
) -> bool:
    return bool(candidates) and remaining >= policy.content_block_min_minutes


def _is_new(candidate: ContentCandidate) -> bool:
    return not candidate.is_unfinished and not candidate.is_saved


def _content_minutes(
    candidate: ContentCandidate,
    use_listen: bool,
    remaining: int,
    policy: TodayPolicy,
) -> int | None:
    minutes = (
        policy.listening_block_minutes
        if use_listen
        else min(
            policy.content_block_max_minutes,
            max(policy.content_block_min_minutes, candidate.estimated_minutes),
        )
    )
    minutes = min(minutes, remaining)
    return minutes if minutes >= policy.content_block_min_minutes else None


def _v2_content_reserve(
    candidates: tuple[ContentCandidate, ...],
    remaining: int,
    policy: TodayPolicy,
) -> int:
    reserve_limit = min(policy.content_reserve_minutes, remaining)
    if reserve_limit < policy.content_block_min_minutes:
        return 0

    reserved = 0
    read_count = 0
    listen_count = 0
    new_count = 0
    for candidate in candidates:
        is_new = _is_new(candidate)
        if is_new and (candidate.remediation_status is None or new_count >= policy.max_new_content):
            continue
        weakness = _weakness(candidate, set())
        use_listen = candidate.has_audio and weakness == "WEAK_LISTENING"
        if use_listen and listen_count >= policy.max_listen_activities:
            continue
        if not use_listen and read_count >= policy.max_read_activities:
            continue
        minutes = _content_minutes(candidate, use_listen, reserve_limit - reserved, policy)
        if minutes is None:
            continue
        reserved += minutes
        if is_new:
            new_count += 1
        if use_listen:
            listen_count += 1
        else:
            read_count += 1
        if reserved >= reserve_limit:
            break
    return reserved


def _v2_content_reasons(
    candidate: ContentCandidate,
    weakness: str | None,
    is_new: bool,
) -> tuple[str, ...]:
    reasons: list[str] = []
    if candidate.remediation_status == "forgotten":
        reasons.append("FORGOTTEN_REMEDIATION")
    elif candidate.remediation_status == "weak":
        reasons.append("WEAK_REMEDIATION")
    reasons.append("CONTENT_FIT")
    if weakness is not None:
        reasons.append(weakness)
    if is_new and candidate.recently_exposed:
        reasons.append("RECENT_EXPOSURE")
    if is_new and weakness is None:
        reasons.append("NEW_CONCEPT_BUDGET")
    return tuple(reasons)


def _review_activity(
    selected: tuple[ReviewCandidate, ...], context: TodayContext, policy: TodayPolicy
) -> TodayActivityDecision:
    first = selected[0]
    count = len(selected)
    return TodayActivityDecision(
        activity_type="review",
        title="Ôn tập đến hạn",
        description=f"Ôn {count} mục theo thứ tự của Smart Review.",
        estimated_minutes=count * policy.review_minutes_per_item,
        reason_codes=("FSRS_DUE",),
        reason_text="Các mục này đã đến hạn theo lịch ôn tập.",
        target_count=count,
        review_item_ids=tuple(item.review_item_id for item in selected),
        concept_id=first.concept_id,
        diagnostics={
            "policyVersion": policy.version,
            "asOf": context.as_of.isoformat(),
            "candidateSource": "review_queue",
            "sourceIdentity": str(first.review_item_id),
            "sourceRank": 0,
            "eligibility": "ELIGIBLE",
            "priorityTier": "DUE_REVIEW",
            "allocationReason": "FSRS_DUE",
            "estimatedCost": count,
            "deduplicationKey": "review:daily",
            "noveltyCount": 0,
        },
    )


def _weakness(candidate: ContentCandidate, due_concepts: set[UUID]) -> str | None:
    if (
        candidate.reinforcement_concept_ids
        and set(candidate.reinforcement_concept_ids) <= due_concepts
    ):
        return None
    if candidate.weak_listening:
        return "WEAK_LISTENING"
    if candidate.weak_recognition or candidate.forgotten:
        return "WEAK_RECOGNITION"
    if candidate.low_production_evidence:
        return "LOW_PRODUCTION_EVIDENCE"
    return None


def _has_weakness(candidate: ContentCandidate) -> bool:
    return (
        candidate.weak_recognition or candidate.weak_listening or candidate.low_production_evidence
    )


def _content_reasons(
    candidate: ContentCandidate, weakness: str | None, is_new: bool
) -> tuple[str, ...]:
    reasons: list[str] = []
    if weakness is not None:
        reasons.append(weakness)
    reasons.append("CONTENT_FIT")
    if is_new and candidate.recently_exposed:
        reasons.append("RECENT_EXPOSURE")
    if is_new and weakness is None:
        reasons.append("NEW_CONCEPT_BUDGET")
    return tuple(reasons)


def _reason_text(reason_codes: tuple[str, ...]) -> str:
    if "FORGOTTEN_REMEDIATION" in reason_codes:
        return "Nội dung giúp ôn lại khái niệm đã quên."
    if "WEAK_REMEDIATION" in reason_codes:
        return "Nội dung giúp củng cố khái niệm đang suy giảm."
    if "WEAK_LISTENING" in reason_codes:
        return "Nội dung phù hợp và củng cố kỹ năng nghe đang yếu."
    if "WEAK_RECOGNITION" in reason_codes:
        return "Nội dung phù hợp và củng cố khái niệm cần ôn lại."
    if "LOW_PRODUCTION_EVIDENCE" in reason_codes:
        return "Nội dung phù hợp với tín hiệu thực hành hiện có."
    if "RECENT_EXPOSURE" in reason_codes:
        return "Nội dung phù hợp và nối tiếp tiếp xúc gần đây."
    return "Nội dung phù hợp với hồ sơ học hiện tại."


def _candidate_source(candidate: ContentCandidate) -> str:
    if candidate.is_unfinished:
        return "reader_progress"
    if candidate.is_saved:
        return "library_saved"
    return "content_recommended"


def _priority_tier(candidate: ContentCandidate, weakness: str | None) -> str:
    if candidate.is_unfinished:
        return "CONTINUE_READER"
    if candidate.is_saved:
        return "SAVED_NOT_STARTED"
    if candidate.remediation_status == "forgotten":
        return "FORGOTTEN_REMEDIATION"
    if candidate.remediation_status == "weak":
        return "WEAK_REMEDIATION"
    if candidate.forgotten:
        return "FORGOTTEN_REINFORCEMENT"
    if weakness is not None:
        return "WEAK_REINFORCEMENT"
    if candidate.recently_exposed:
        return "RECENT_REPETITION"
    return "RECOMMENDED_NEW"
