"""Fail-closed server-side owner authorization."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from lingua_api.memory.domain import AuthenticatedActor


class AdminForbidden(RuntimeError):
    """The authenticated actor is not in a valid owner allowlist."""


@dataclass(frozen=True)
class AdminActorPolicy:
    allowed_actor_ids: frozenset[UUID]
    configuration_valid: bool

    @classmethod
    def from_environment_value(cls, value: str | None) -> AdminActorPolicy:
        if value is None or not value.strip():
            return cls(frozenset(), False)
        parsed: set[UUID] = set()
        try:
            for candidate in value.split(","):
                normalized = candidate.strip()
                if not normalized:
                    raise ValueError("empty owner identifier")
                parsed.add(UUID(normalized))
        except ValueError:
            return cls(frozenset(), False)
        return cls(frozenset(parsed), bool(parsed))

    def require(self, actor: AuthenticatedActor) -> None:
        if not self.configuration_valid or actor.id not in self.allowed_actor_ids:
            raise AdminForbidden("actor is not authorized for owner administration")
