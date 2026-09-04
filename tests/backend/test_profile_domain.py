from __future__ import annotations

import uuid

import pytest
from lingua_api.profile.domain import (
    CreateLanguageProfile,
    ProfilePreconditionFailed,
    ProfileValidationError,
    create_fingerprint,
    language_profile_etag,
    learner_profile_etag,
    require_if_match,
    validate_status_transition,
    validate_time_zone,
)


def test_profile_etags_are_strong_opaque_resource_specific_and_revision_backed() -> None:
    actor_id = uuid.uuid4()
    profile_id = uuid.uuid4()

    first_me = learner_profile_etag(actor_id, 1)
    second_me = learner_profile_etag(actor_id, 2)
    language = language_profile_etag(profile_id, 1)

    assert first_me.startswith('"') and first_me.endswith('"')
    assert first_me != second_me
    assert first_me != language
    require_if_match(first_me, first_me)


@pytest.mark.parametrize(
    "value",
    [None, "", "*", 'W/"etag"', '"etag", "other"', "etag", '"stale"'],
)
def test_profile_if_match_rejects_missing_weak_wildcard_multiple_malformed_and_stale(
    value: str | None,
) -> None:
    with pytest.raises(ProfilePreconditionFailed):
        require_if_match(value, learner_profile_etag(uuid.uuid4(), 1))


@pytest.mark.parametrize("value", ["Asia/Ho_Chi_Minh", "Europe/Paris", "Etc/UTC"])
def test_profile_timezone_accepts_recognized_iana_identifiers(value: str) -> None:
    assert validate_time_zone(value) == value


@pytest.mark.parametrize(
    "value",
    ["+07:00", "UTC+7", "Mars/Olympus", " Asia/Ho_Chi_Minh ", "", "x" * 65],
)
def test_profile_timezone_rejects_offsets_unknown_untrimmed_and_out_of_bounds(value: str) -> None:
    with pytest.raises(ProfileValidationError):
        validate_time_zone(value)


def test_profile_create_fingerprint_is_stable_and_changes_with_logical_payload() -> None:
    first = CreateLanguageProfile("en", "vi", "communication", 20, "A1", "B1")
    same = CreateLanguageProfile("en", "vi", "communication", 20, "A1", "B1")
    changed = CreateLanguageProfile("en", "vi", "travel", 20, "A1", "B1")

    assert create_fingerprint(first) == create_fingerprint(same)
    assert create_fingerprint(first) != create_fingerprint(changed)


@pytest.mark.parametrize(
    ("current", "requested"),
    [
        ("active", "active"),
        ("active", "paused"),
        ("paused", "active"),
        ("active", "archived"),
        ("paused", "archived"),
        ("archived", "active"),
    ],
)
def test_profile_status_allows_only_frozen_lifecycle(current: str, requested: str) -> None:
    validate_status_transition(current, requested)


@pytest.mark.parametrize(
    ("current", "requested"),
    [("archived", "paused"), ("archived", "archived"), ("paused", "paused")],
)
def test_profile_status_rejects_unapproved_transitions(current: str, requested: str) -> None:
    if current == requested:
        # Reapplying a current value is a semantic no-op and remains valid.
        validate_status_transition(current, requested)
    else:
        with pytest.raises(ProfileValidationError):
            validate_status_transition(current, requested)
