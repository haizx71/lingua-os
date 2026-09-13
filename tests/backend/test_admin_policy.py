from __future__ import annotations

import uuid

import pytest
from lingua_api.admin.authorization import AdminActorPolicy, AdminForbidden
from lingua_api.admin.domain import AdminValidationError, segment_english_text
from lingua_api.memory.domain import AuthenticatedActor


def test_admin_allowlist_accepts_only_exact_configured_actor_uuid() -> None:
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    policy = AdminActorPolicy.from_environment_value(f" {owner_id}, {uuid.uuid4()} ")

    policy.require(AuthenticatedActor(owner_id))
    with pytest.raises(AdminForbidden):
        policy.require(AuthenticatedActor(other_id))


@pytest.mark.parametrize("value", [None, "", "not-a-uuid", f"{uuid.uuid4()},broken"])
def test_admin_allowlist_missing_or_invalid_configuration_fails_closed(value: str | None) -> None:
    policy = AdminActorPolicy.from_environment_value(value)

    with pytest.raises(AdminForbidden):
        policy.require(AuthenticatedActor(uuid.uuid4()))


def test_sentence_segmentation_is_deterministic_unicode_preserving_and_ordered() -> None:
    body = "Hello world! “Café is open.” Is it ready? Yes… still one segment."

    first = segment_english_text(body)
    second = segment_english_text(body)

    assert first == second
    assert first == (
        "Hello world!",
        "“Café is open.”",
        "Is it ready?",
        "Yes… still one segment.",
    )


def test_sentence_segmentation_rejects_empty_content() -> None:
    with pytest.raises(AdminValidationError):
        segment_english_text(" \n\t ")
