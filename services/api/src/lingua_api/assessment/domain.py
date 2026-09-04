"""Assessment domain errors and value types for TASK-016."""

from __future__ import annotations


class AssessmentNotFound(RuntimeError):
    """An owned assessment resource does not exist."""


class AssessmentForbidden(RuntimeError):
    """The actor does not own the referenced resource."""


class AssessmentInvalidState(RuntimeError):
    """The assessment is not in a state that allows the requested mutation."""


class AssessmentIdempotencyConflict(RuntimeError):
    """The idempotency key was reused for a different logical command."""


class AssessmentUnavailable(RuntimeError):
    """Required question bank or audio dependency is not available."""


class AssessmentValidationError(RuntimeError):
    """A request violates a frozen domain validation rule."""
