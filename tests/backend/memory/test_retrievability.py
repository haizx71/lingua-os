from __future__ import annotations

import math
import random
from datetime import UTC, datetime, timedelta
from importlib.metadata import version as distribution_version
from uuid import uuid4

from fsrs import Card, Scheduler, State


def _reference_retrievability(*, stability: float, elapsed_days: int, weight_20: float) -> float:
    decay = -weight_20
    factor = 0.9 ** (1 / decay) - 1
    return float((1 + factor * elapsed_days / stability) ** decay)


def _review_card(*, stability: float, reviewed_at: datetime) -> Card:
    return Card(
        card_id=uuid4().int,
        state=State.Review,
        step=None,
        stability=stability,
        difficulty=5.0,
        due=reviewed_at + timedelta(days=1),
        last_review=reviewed_at,
    )


def test_pinned_pyfsrs_retrievability_equation_across_valid_parameter_space() -> None:
    assert distribution_version("fsrs") == "6.3.2"
    generator = random.Random(632)
    now = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)

    for _ in range(1_000):
        stability = 10 ** generator.uniform(-3, 4)
        elapsed_days = generator.randint(0, 10_000)
        weight_20 = generator.uniform(0.1, 0.8)
        parameters = list(Scheduler().parameters)
        parameters[20] = weight_20
        scheduler = Scheduler(parameters=parameters, enable_fuzzing=False)
        card = _review_card(
            stability=stability,
            reviewed_at=now - timedelta(days=elapsed_days),
        )

        actual = scheduler.get_card_retrievability(card, current_datetime=now)
        expected = _reference_retrievability(
            stability=stability,
            elapsed_days=elapsed_days,
            weight_20=weight_20,
        )

        assert 0 <= actual <= 1
        assert math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-12)


def test_pyfsrs_uses_integer_elapsed_days_and_clamps_future_reviews() -> None:
    scheduler = Scheduler(enable_fuzzing=False)
    now = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)
    reviewed_at = now - timedelta(days=4, hours=23, minutes=59)
    card = _review_card(stability=8.0, reviewed_at=reviewed_at)

    actual = scheduler.get_card_retrievability(card, current_datetime=now)
    four_days = _reference_retrievability(
        stability=8.0,
        elapsed_days=4,
        weight_20=scheduler.parameters[20],
    )
    five_days = _reference_retrievability(
        stability=8.0,
        elapsed_days=5,
        weight_20=scheduler.parameters[20],
    )

    assert actual == four_days
    assert actual != five_days

    future_card = _review_card(stability=8.0, reviewed_at=now + timedelta(seconds=1))
    assert scheduler.get_card_retrievability(future_card, current_datetime=now) == 1


def test_pyfsrs_new_card_retrievability_is_zero() -> None:
    now = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)
    card = Card(card_id=uuid4().int, due=now)

    assert (
        Scheduler(enable_fuzzing=False).get_card_retrievability(
            card,
            current_datetime=now,
        )
        == 0
    )
