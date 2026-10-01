from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from lingua_api.today.domain import ContentCandidate, ReviewCandidate, TodayContext
from lingua_api.today.policy import TODAY_HEURISTIC_V1, TODAY_HEURISTIC_V2, build_today_decision

AS_OF = datetime(2026, 9, 1, 1, 0, tzinfo=UTC)


def _uuid(value: int) -> UUID:
    return UUID(f"00000000-0000-4000-8000-{value:012d}")


def _review(value: int, *, minutes_overdue: int | None = None) -> ReviewCandidate:
    overdue = value if minutes_overdue is None else minutes_overdue
    return ReviewCandidate(
        review_item_id=_uuid(value),
        concept_id=_uuid(1000 + value),
        due_at=AS_OF - timedelta(minutes=overdue),
    )


def _content(
    value: int,
    *,
    minutes: int = 10,
    unseen: int = 0,
    unfinished: bool = False,
    saved: bool = False,
    completed: bool = False,
    audio: bool = False,
    weak_listening: bool = False,
    remediation_status: Literal["weak", "forgotten"] | None = None,
    recent: bool = False,
    rank: int | None = None,
) -> ContentCandidate:
    return ContentCandidate(
        content_id=_uuid(2000 + value),
        title=f"Content {value}",
        estimated_minutes=minutes,
        source_rank=value if rank is None else rank,
        unseen_concept_count=unseen,
        is_unfinished=unfinished,
        is_saved=saved,
        is_completed=completed,
        has_audio=audio,
        weak_listening=weak_listening,
        remediation_status=remediation_status,
        recently_exposed=recent,
        last_opened_at=AS_OF - timedelta(hours=value) if unfinished else None,
        saved_at=AS_OF - timedelta(hours=value) if saved else None,
    )


def _context(minutes: int = 25) -> TodayContext:
    return TodayContext(target_minutes=minutes, as_of=AS_OF)


def test_policy_constants_are_frozen_under_one_version() -> None:
    assert TODAY_HEURISTIC_V1.version == "today-heuristic-v1"
    assert TODAY_HEURISTIC_V1.content_reserve_minutes == 8
    assert TODAY_HEURISTIC_V1.max_new_unseen_concepts == 4
    assert TODAY_HEURISTIC_V1.recent_exposure_window_hours == 48
    assert replace(TODAY_HEURISTIC_V1, version=TODAY_HEURISTIC_V2.version) == TODAY_HEURISTIC_V2


def test_new_learner_uses_easiest_eligible_content_and_underfills() -> None:
    decision = build_today_decision(
        _context(),
        (),
        (_content(1, unseen=4, rank=0), _content(2, unseen=8, rank=1)),
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("read", 10)
    ]
    assert decision.activities[0].content_id == _uuid(2001)
    assert decision.activities[0].reason_codes == ("CONTENT_FIT", "NEW_CONCEPT_BUDGET")
    assert decision.unused_minutes == 15


def test_five_due_reviews_continue_then_saved_matches_calibration() -> None:
    decision = build_today_decision(
        _context(),
        tuple(_review(value) for value in range(1, 6)),
        (_content(1, unfinished=True), _content(2, minutes=8, saved=True)),
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("review", 5),
        ("read", 10),
        ("read", 8),
    ]
    assert decision.activities[0].review_item_ids == tuple(
        _uuid(value) for value in range(5, 0, -1)
    )
    assert decision.unused_minutes == 2


def test_large_review_backlog_preserves_eight_minute_content_reserve() -> None:
    decision = build_today_decision(
        _context(),
        tuple(_review(value) for value in range(1, 51)),
        (_content(1, minutes=8, unfinished=True),),
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("review", 17),
        ("read", 8),
    ]
    assert decision.activities[0].target_count == 17
    assert decision.unused_minutes == 0


def test_review_consumes_unused_reserve_when_no_content_is_eligible() -> None:
    decision = build_today_decision(
        _context(),
        tuple(_review(value) for value in range(1, 51)),
        (_content(1, unseen=5),),
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("review", 25)
    ]


def test_weak_unfinished_reader_and_distinct_audio_match_calibration() -> None:
    decision = build_today_decision(
        _context(),
        (),
        (
            _content(1, minutes=9, unfinished=True),
            _content(2, minutes=5, audio=True, weak_listening=True),
        ),
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("read", 9),
        ("listen", 5),
    ]
    assert decision.activities[1].reason_codes == ("WEAK_LISTENING", "CONTENT_FIT")


def test_saved_not_started_precedes_one_recommended_new_item() -> None:
    decision = build_today_decision(
        _context(),
        (),
        (
            _content(1, unseen=3, rank=0),
            _content(2, unseen=7, rank=1),
            _content(3, minutes=7, saved=True, rank=2),
        ),
    )

    assert [item.content_id for item in decision.activities] == [_uuid(2003), _uuid(2001)]
    assert sum(item.estimated_minutes for item in decision.activities) == 17


def test_everything_complete_returns_empty_completed_decision() -> None:
    decision = build_today_decision(_context(), (), (_content(1, completed=True),))

    assert decision.activities == ()
    assert decision.status == "completed"
    assert decision.unused_minutes == 25


def test_continue_reader_is_not_blocked_by_new_unseen_cap_or_recent_window() -> None:
    decision = build_today_decision(
        _context(10),
        (),
        (_content(1, unseen=20, unfinished=True, recent=True),),
    )

    assert [item.content_id for item in decision.activities] == [_uuid(2001)]
    assert "NEW_CONCEPT_BUDGET" not in decision.activities[0].reason_codes
    assert "RECENT_EXPOSURE" not in decision.activities[0].reason_codes


def test_recent_exposure_reason_is_scoped_to_recommended_new_content() -> None:
    decision = build_today_decision(
        _context(10),
        (),
        (_content(1, unseen=2, recent=True),),
    )

    assert decision.activities[0].reason_codes == (
        "CONTENT_FIT",
        "RECENT_EXPOSURE",
        "NEW_CONCEPT_BUDGET",
    )


def test_review_order_is_due_at_then_review_item_id() -> None:
    same_due = AS_OF - timedelta(days=1)
    reviews = (
        ReviewCandidate(_uuid(3), _uuid(1003), same_due),
        ReviewCandidate(_uuid(1), _uuid(1001), same_due),
        ReviewCandidate(_uuid(2), _uuid(1002), AS_OF - timedelta(days=2)),
    )

    decision = build_today_decision(_context(5), reviews, ())

    assert decision.activities[0].review_item_ids == (_uuid(2), _uuid(1), _uuid(3))


def test_same_input_is_deterministic_and_never_generates_learn() -> None:
    inputs = (
        _context(),
        (_review(1), _review(2)),
        (_content(2), _content(1), _content(3, audio=True, weak_listening=True)),
    )

    first = build_today_decision(*inputs)
    second = build_today_decision(*inputs)

    assert first == second
    assert {item.activity_type for item in first.activities} <= {"review", "read", "listen"}
    assert all(
        item.diagnostics is not None and item.diagnostics["policyVersion"] == "today-heuristic-v1"
        for item in first.activities
    )


def test_budget_is_never_exceeded_and_atomic_content_below_five_minutes_is_not_packed() -> None:
    decision = build_today_decision(
        _context(7),
        (_review(1), _review(2), _review(3)),
        (_content(1, minutes=10, unfinished=True),),
    )

    assert sum(item.estimated_minutes for item in decision.activities) <= 7
    assert [item.activity_type for item in decision.activities] == ["review"]


def test_v2_treats_forgotten_and_weak_as_remediation_before_new_content() -> None:
    decision = build_today_decision(
        _context(20),
        (),
        (
            _content(1, remediation_status="weak", rank=0),
            _content(2, remediation_status="forgotten", rank=3),
            _content(3, remediation_status="forgotten", rank=1),
            _content(4, unseen=1, rank=0),
        ),
        policy=TODAY_HEURISTIC_V2,
    )

    assert [item.content_id for item in decision.activities] == [_uuid(2003)]
    assert decision.activities[0].reason_codes[:2] == (
        "FORGOTTEN_REMEDIATION",
        "CONTENT_FIT",
    )

    weak_before_new = build_today_decision(
        _context(20),
        (),
        (
            _content(1, remediation_status="weak", rank=3),
            _content(2, unseen=1, rank=0),
        ),
        policy=TODAY_HEURISTIC_V2,
    )
    assert [item.content_id for item in weak_before_new.activities] == [_uuid(2001)]
    assert weak_before_new.activities[0].reason_codes[:2] == (
        "WEAK_REMEDIATION",
        "CONTENT_FIT",
    )


def test_v2_remediation_does_not_bypass_new_content_unseen_cap() -> None:
    decision = build_today_decision(
        _context(),
        (),
        (_content(1, unseen=5, remediation_status="weak"),),
        policy=TODAY_HEURISTIC_V2,
    )

    assert decision.activities == ()
    assert decision.status == "completed"


def test_v2_remediation_articles_still_share_one_new_content_slot() -> None:
    decision = build_today_decision(
        _context(),
        (),
        (
            _content(1, unseen=4, remediation_status="weak", rank=0),
            _content(2, unseen=4, remediation_status="forgotten", rank=1),
        ),
        policy=TODAY_HEURISTIC_V2,
    )

    assert [item.content_id for item in decision.activities] == [_uuid(2002)]
    assert decision.activities[0].reason_codes[:2] == (
        "FORGOTTEN_REMEDIATION",
        "CONTENT_FIT",
    )


def test_v2_saved_and_unfinished_remediation_keep_their_newness_exceptions() -> None:
    decision = build_today_decision(
        _context(),
        (),
        (
            _content(1, unseen=5, remediation_status="weak", saved=True),
            _content(2, unseen=5, remediation_status="forgotten", unfinished=True),
        ),
        policy=TODAY_HEURISTIC_V2,
    )

    assert [item.content_id for item in decision.activities] == [_uuid(2002), _uuid(2001)]
    assert all("NEW_CONCEPT_BUDGET" not in item.reason_codes for item in decision.activities)


def test_v2_15_minutes_and_twenty_due_items_do_not_spend_reserve_on_new_content() -> None:
    decision = build_today_decision(
        _context(15),
        tuple(_review(value) for value in range(1, 21)),
        (_content(1, minutes=8, unseen=1),),
        policy=TODAY_HEURISTIC_V2,
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("review", 15),
    ]
    assert decision.activities[0].target_count == 15
    assert decision.activities[0].review_item_ids == tuple(
        _uuid(value) for value in range(20, 5, -1)
    )
    assert decision.unused_minutes == 0


def test_v2_familiar_content_uses_only_its_eight_minute_reserve_and_replays_policy_version() -> (
    None
):
    decision = build_today_decision(
        _context(15),
        tuple(_review(value) for value in range(1, 21)),
        (
            _content(1, minutes=10, saved=True),
            _content(2, minutes=10, unseen=1),
        ),
        policy=TODAY_HEURISTIC_V2,
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("review", 7),
        ("read", 8),
    ]
    assert decision.activities[1].content_id == _uuid(2001)
    assert decision.activities[1].diagnostics is not None
    assert decision.activities[1].diagnostics["policyVersion"] == "today-heuristic-v2"
    assert decision.unused_minutes == 0


def test_v2_non_due_remediation_within_new_content_cap_can_use_reserve() -> None:
    decision = build_today_decision(
        _context(15),
        tuple(_review(value) for value in range(1, 21)),
        (
            _content(1, minutes=5, unseen=4, remediation_status="weak"),
            _content(2, minutes=5, unseen=4, remediation_status="forgotten"),
        ),
        policy=TODAY_HEURISTIC_V2,
    )

    assert [(item.activity_type, item.estimated_minutes) for item in decision.activities] == [
        ("review", 10),
        ("read", 5),
    ]
    assert decision.activities[1].reason_codes[:2] == (
        "FORGOTTEN_REMEDIATION",
        "CONTENT_FIT",
    )
    assert decision.activities[1].content_id == _uuid(2002)
    assert decision.unused_minutes == 0
