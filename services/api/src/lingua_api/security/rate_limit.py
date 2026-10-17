"""Sliding-window rate limiter for high-cost API endpoints."""

from __future__ import annotations

import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from lingua_api.review.models import ApiModel, ErrorBodyDto, ErrorCodeDto

ErrorCode = ErrorCodeDto

GUARDED_ROUTES: dict[tuple[str, str], str] = {
    ("POST", "/v1/reader/analyze"): "reader_analyze",
    ("POST", "/v1/assessments"): "assessments_start",
    ("DELETE", "/v1/me"): "account_delete",
}


def get_rate_limit_bucket(method: str, path: str) -> str | None:
    """Identify the rate limit bucket for an incoming HTTP method and path."""
    normalized_path = path.rstrip("/") or "/"
    return GUARDED_ROUTES.get((method.upper(), normalized_path))


class RateLimitErrorBodyDto(ErrorBodyDto):
    """Specialized error body adding explicit retryable field for rate limiting."""

    retryable: bool = True


class RateLimitErrorEnvelopeDto(ApiModel):
    """Specialized error envelope preserving RateLimitErrorBodyDto fields."""

    error: RateLimitErrorBodyDto


class SlidingWindowRateLimiter:
    """Thread-safe sliding-window rate limiter tracking requests per (client_key, bucket)."""

    def __init__(
        self,
        requests_per_minute: int = 600,
        window_seconds: float = 60.0,
        *,
        clock: Callable[[], float] | None = None,
        bucket_limits: dict[str, int] | None = None,
    ) -> None:
        self._requests_per_minute = max(0, requests_per_minute)
        self._window_seconds = window_seconds
        self._clock = clock or time.monotonic
        self._bucket_limits = dict(bucket_limits) if bucket_limits else {}
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, client_key: str, bucket_name: str) -> tuple[bool, int]:
        """Check if request is allowed under sliding window.

        Returns (allowed, retry_after_seconds).
        If allowed is True, retry_after_seconds is 0.
        If allowed is False, retry_after_seconds is >= 1.
        """
        limit = self._bucket_limits.get(bucket_name, self._requests_per_minute)
        if limit <= 0:
            return False, math.ceil(self._window_seconds)

        with self._lock:
            now = self._clock()
            cutoff = now - self._window_seconds
            history = self._requests[(client_key, bucket_name)]

            while history and history[0] <= cutoff:
                history.popleft()

            if len(history) < limit:
                history.append(now)
                return True, 0

            oldest = history[0]
            retry_after = max(1, math.ceil(oldest + self._window_seconds - now))
            return False, retry_after

    def reset(self) -> None:
        """Reset all tracked request history."""
        with self._lock:
            self._requests.clear()
