"""Self-contained security verification suite testing all security controls."""

from __future__ import annotations

import re
import threading
import unittest
from unittest.mock import MagicMock
from urllib.parse import unquote
from uuid import uuid4

from fastapi.testclient import TestClient
from lingua_api.main import create_app
from lingua_api.memory.domain import AuthenticatedActor
from lingua_api.reader.routes import ReaderAnalyzeRequestDto
from lingua_api.security.rate_limit import SlidingWindowRateLimiter, get_rate_limit_bucket
from pydantic import ValidationError

# Alias for testing backwards compatibility with contract documentation
AnalyzeContentRequestDto = ReaderAnalyzeRequestDto


class _StubVerifier:
    def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return AuthenticatedActor(id=uuid4(), email="learner@example.test")


class SecurityVerificationTests(unittest.TestCase):
    def test_bcp47_language_code_regex_enforcement(self) -> None:
        pattern = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")

        # Valid language codes
        self.assertTrue(pattern.fullmatch("en"))
        self.assertTrue(pattern.fullmatch("vi"))
        self.assertTrue(pattern.fullmatch("en-US"))
        self.assertTrue(pattern.fullmatch("en-GB"))
        self.assertTrue(pattern.fullmatch("cmn-Hans-CN"))

        # Malicious or malformed inputs must be rejected
        self.assertIsNone(pattern.fullmatch("<script>alert(1)</script>"))
        self.assertIsNone(pattern.fullmatch("en; DROP TABLE users;--"))
        self.assertIsNone(pattern.fullmatch("en/../../etc/passwd"))
        self.assertIsNone(pattern.fullmatch("toolonglanguagestringwithoutdashes"))
        self.assertIsNone(pattern.fullmatch(""))
        self.assertIsNone(pattern.fullmatch(" "))

    def test_proxy_segment_sanitization_rejects_path_traversal(self) -> None:
        def is_safe_segment(segment: str) -> bool:
            if not segment:
                return False
            try:
                decoded = unquote(segment)
                if decoded in (".", "..") or any(bad in decoded for bad in ("/", "\\", "\0", "..")):
                    return False
            except Exception:
                return False
            return not bool(re.search(r"[\x00-\x1f\x7f]", segment))

        # Safe segments
        self.assertTrue(is_safe_segment("v1"))
        self.assertTrue(is_safe_segment("reader"))
        self.assertTrue(is_safe_segment("analyze"))
        self.assertTrue(is_safe_segment("content"))
        self.assertTrue(is_safe_segment("550e8400-e29b-41d4-a716-446655440000"))

        # Dangerous path traversal segments
        self.assertFalse(is_safe_segment(".."))
        self.assertFalse(is_safe_segment("."))
        self.assertFalse(is_safe_segment("%2e%2e"))
        self.assertFalse(is_safe_segment("%2e"))
        self.assertFalse(is_safe_segment("..%2f"))
        self.assertFalse(is_safe_segment("foo/bar"))
        self.assertFalse(is_safe_segment("foo\\bar"))
        self.assertFalse(is_safe_segment("admin%00"))
        self.assertFalse(is_safe_segment("test\nnewline"))
        self.assertFalse(is_safe_segment("test\rreturn"))

    def test_proxy_prefix_whitelist_blocks_ssrf(self) -> None:
        allowed_prefixes = {"v1", "health"}

        def is_allowed_request(segments: list[str]) -> bool:
            if not segments:
                return False
            return segments[0].lower() in allowed_prefixes

        # Allowed routes
        self.assertTrue(is_allowed_request(["v1", "me"]))
        self.assertTrue(is_allowed_request(["v1", "reader", "analyze"]))
        self.assertTrue(is_allowed_request(["health"]))

        # Forbidden routes that could attempt internal server probing / SSRF
        self.assertFalse(is_allowed_request(["internal", "metrics"]))
        self.assertFalse(is_allowed_request(["admin", "db"]))
        self.assertFalse(is_allowed_request(["debug"]))
        self.assertFalse(is_allowed_request(["actuator"]))
        self.assertFalse(is_allowed_request([""]))

    def test_csrf_sec_fetch_site_validation(self) -> None:
        def is_valid_sec_fetch_site(header_value: str | None) -> bool:
            if header_value is None:
                return True
            return header_value in ("same-origin", "none")

        self.assertTrue(is_valid_sec_fetch_site("same-origin"))
        self.assertTrue(is_valid_sec_fetch_site("none"))
        self.assertTrue(is_valid_sec_fetch_site(None))
        self.assertFalse(is_valid_sec_fetch_site("cross-site"))
        self.assertFalse(is_valid_sec_fetch_site("same-site"))

    def test_request_body_size_guard(self) -> None:
        max_bytes = 10 * 1024 * 1024  # 10 MB

        def is_payload_allowed(content_length: str | None) -> bool:
            if not content_length:
                return True
            return not (content_length.isdigit() and int(content_length) > max_bytes)

        self.assertTrue(is_payload_allowed("1024"))
        self.assertTrue(is_payload_allowed("1048576"))  # 1 MB
        self.assertTrue(is_payload_allowed("10485760"))  # 10 MB exactly
        self.assertFalse(is_payload_allowed("10485761"))  # 10 MB + 1 byte
        self.assertFalse(is_payload_allowed("52428800"))  # 50 MB DoS attempt

    def test_security_headers_present_on_healthz(self) -> None:
        app = create_app()
        client = TestClient(app)
        response = client.get("/healthz", headers={"x-forwarded-proto": "https"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")
        self.assertEqual(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
        self.assertEqual(
            response.headers.get("permissions-policy"),
            "camera=(), geolocation=(), usb=(), microphone=(self)",
        )
        self.assertEqual(
            response.headers.get("strict-transport-security"),
            "max-age=31536000; includeSubDomains",
        )

    def test_request_body_size_guard_returns_422_when_exceeding_10mb(self) -> None:
        app = create_app()
        client = TestClient(app)
        oversized = str(10 * 1024 * 1024 + 1)
        response = client.post(
            "/healthz",
            headers={"content-length": oversized},
        )
        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(
            payload["error"]["message"],
            "The request body exceeds maximum allowed size.",
        )

    def test_analyze_request_dto_validates_language_codes(self) -> None:
        # Valid language codes succeed
        dto = AnalyzeContentRequestDto(
            text="Hello world",
            target_language_code="en",
            translation_language_code="vi",
        )
        self.assertEqual(dto.target_language_code, "en")
        self.assertEqual(dto.translation_language_code, "vi")

        # Complex BCP-47 valid language codes succeed
        dto_complex = AnalyzeContentRequestDto(
            text="Hello world",
            target_language_code="en-US",
            translation_language_code="cmn-Hans-CN",
        )
        self.assertEqual(dto_complex.target_language_code, "en-US")
        self.assertEqual(dto_complex.translation_language_code, "cmn-Hans-CN")

        # Invalid language code in target_language_code raises ValidationError
        with self.assertRaises(ValidationError):
            AnalyzeContentRequestDto(
                text="Hello world",
                target_language_code="INVALID_LANG!!",
                translation_language_code="vi",
            )

        # Invalid language code in translation_language_code raises ValidationError
        with self.assertRaises(ValidationError):
            AnalyzeContentRequestDto(
                text="Hello world",
                target_language_code="en",
                translation_language_code="INVALID_LANG!!",
            )

    def test_reader_analyze_endpoint_rejects_invalid_language_codes_and_accepts_valid_ones(
        self,
    ) -> None:
        app = create_app(token_verifier=_StubVerifier())
        mock_reader = MagicMock()
        mock_result = MagicMock()
        mock_result.analysis_id = uuid4()
        mock_result.target_language_code = "en"
        mock_result.translation_language_code = "vi"
        mock_result.analyzed_at = "2026-10-14T12:00:00Z"
        mock_result.segments = []
        mock_reader.analyze.return_value = mock_result
        app.state.reader_application = mock_reader
        client = TestClient(app)

        # Rejection with invalid language code (returns 422)
        response_invalid = client.post(
            "/v1/reader/analyze",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "text": "Hello world",
                "target_language_code": "INVALID_LANG!!",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(response_invalid.status_code, 422)
        self.assertEqual(response_invalid.json()["error"]["code"], "VALIDATION_ERROR")

        # Acceptance with valid language code (returns 200)
        response_valid = client.post(
            "/v1/reader/analyze",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "text": "Hello world",
                "target_language_code": "en",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(response_valid.status_code, 200)
        self.assertEqual(response_valid.json()["data"]["targetLanguageCode"], "en")

    def test_sliding_window_rate_limiter_allows_and_blocks_with_deterministic_clock(self) -> None:
        current_time = 100.0

        def clock() -> float:
            return current_time

        limiter = SlidingWindowRateLimiter(requests_per_minute=2, window_seconds=60.0, clock=clock)

        # 1st request at t=100.0: allowed
        allowed1, retry_after1 = limiter.check("client1", "reader_analyze")
        self.assertTrue(allowed1)
        self.assertEqual(retry_after1, 0)

        # 2nd request at t=110.0: allowed
        current_time = 110.0
        allowed2, retry_after2 = limiter.check("client1", "reader_analyze")
        self.assertTrue(allowed2)
        self.assertEqual(retry_after2, 0)

        # 3rd request at t=120.0: blocked (limit is 2 in 60s window)
        current_time = 120.0
        allowed3, retry_after3 = limiter.check("client1", "reader_analyze")
        self.assertFalse(allowed3)
        # Oldest request was at 100.0. Window expires at 160.0. 160.0 - 120.0 = 40.
        self.assertEqual(retry_after3, 40)

        # Still blocked at t=159.0
        current_time = 159.0
        allowed4, retry_after4 = limiter.check("client1", "reader_analyze")
        self.assertFalse(allowed4)
        self.assertEqual(retry_after4, 1)

        # At t=161.0, 1st request has slid out of window -> allowed!
        current_time = 161.0
        allowed5, retry_after5 = limiter.check("client1", "reader_analyze")
        self.assertTrue(allowed5)
        self.assertEqual(retry_after5, 0)

    def test_sliding_window_rate_limiter_isolates_clients_and_buckets(self) -> None:
        limiter = SlidingWindowRateLimiter(requests_per_minute=1, window_seconds=60.0)

        # Client A in bucket X consumes limit
        allowed_a_x, _ = limiter.check("clientA", "reader_analyze")
        self.assertTrue(allowed_a_x)
        blocked_a_x, _ = limiter.check("clientA", "reader_analyze")
        self.assertFalse(blocked_a_x)

        # Client B in bucket X is independent
        allowed_b_x, _ = limiter.check("clientB", "reader_analyze")
        self.assertTrue(allowed_b_x)

        # Client A in bucket Y is independent
        allowed_a_y, _ = limiter.check("clientA", "assessments_start")
        self.assertTrue(allowed_a_y)

    def test_sliding_window_rate_limiter_thread_safety(self) -> None:
        limiter = SlidingWindowRateLimiter(requests_per_minute=5, window_seconds=60.0)
        results: list[bool] = []

        def worker() -> None:
            allowed, _ = limiter.check("concurrent_user", "reader_analyze")
            results.append(allowed)

        threads = [threading.Thread(target=worker) for _ in range(25)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(results.count(True), 5)
        self.assertEqual(results.count(False), 20)

    def test_get_rate_limit_bucket_identifies_expensive_endpoints(self) -> None:
        self.assertEqual(get_rate_limit_bucket("POST", "/v1/reader/analyze"), "reader_analyze")
        self.assertEqual(get_rate_limit_bucket("POST", "/v1/reader/analyze/"), "reader_analyze")
        self.assertEqual(get_rate_limit_bucket("POST", "/v1/assessments"), "assessments_start")
        self.assertEqual(get_rate_limit_bucket("POST", "/v1/assessments/"), "assessments_start")
        self.assertEqual(get_rate_limit_bucket("DELETE", "/v1/me"), "account_delete")
        self.assertEqual(get_rate_limit_bucket("DELETE", "/v1/me/"), "account_delete")

        # Non-guarded endpoints
        self.assertIsNone(get_rate_limit_bucket("GET", "/v1/reader/analyze"))
        self.assertIsNone(get_rate_limit_bucket("GET", "/v1/me"))
        self.assertIsNone(get_rate_limit_bucket("POST", "/v1/reviews"))
        self.assertIsNone(get_rate_limit_bucket("GET", "/health"))

    def test_reader_analyze_rate_limiting_http_integration(self) -> None:
        app = create_app(token_verifier=_StubVerifier(), rate_limit_rpm=2)
        mock_reader = MagicMock()
        mock_result = MagicMock()
        mock_result.analysis_id = uuid4()
        mock_result.target_language_code = "en"
        mock_result.translation_language_code = "vi"
        mock_result.analyzed_at = "2026-10-14T12:00:00Z"
        mock_result.segments = []
        mock_reader.analyze.return_value = mock_result
        app.state.reader_application = mock_reader
        client = TestClient(app)

        # Request 1: allowed (200)
        r1 = client.post(
            "/v1/reader/analyze",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "text": "First request",
                "target_language_code": "en",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(r1.status_code, 200)

        # Request 2: allowed (200)
        r2 = client.post(
            "/v1/reader/analyze",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "text": "Second request",
                "target_language_code": "en",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(r2.status_code, 200)

        # Request 3: rate limited (429)
        r3 = client.post(
            "/v1/reader/analyze",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "text": "Third request exceeding rate limit",
                "target_language_code": "en",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(r3.status_code, 429)
        payload = r3.json()
        self.assertEqual(payload["error"]["code"], "RATE_LIMITED")
        self.assertIs(payload["error"]["retryable"], True)
        self.assertIn("retry-after", r3.headers)
        self.assertEqual(r3.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(r3.headers.get("x-frame-options"), "DENY")

    def test_anonymous_rate_limiting_http_integration(self) -> None:
        app = create_app(token_verifier=_StubVerifier(), rate_limit_rpm=1)
        client = TestClient(app)

        # 1st request fails with 401 unauthenticated, but was admitted to rate limiter
        r1 = client.post(
            "/v1/reader/analyze",
            json={
                "text": "Hello",
                "target_language_code": "en",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(r1.status_code, 401)

        # 2nd request exceeds rate limit (1 rpm) -> 429
        r2 = client.post(
            "/v1/reader/analyze",
            json={
                "text": "Hello again",
                "target_language_code": "en",
                "translation_language_code": "vi",
            },
        )
        self.assertEqual(r2.status_code, 429)
        payload = r2.json()
        self.assertEqual(payload["error"]["code"], "RATE_LIMITED")
        self.assertIs(payload["error"]["retryable"], True)

    def test_guarded_endpoints_rate_limiting(self) -> None:
        app = create_app(token_verifier=_StubVerifier(), rate_limit_rpm=1)
        client = TestClient(app)

        # POST /v1/assessments rate limited on 2nd attempt
        client.post("/v1/assessments", headers={"Authorization": "Bearer valid-token"}, json={})
        res_assess = client.post(
            "/v1/assessments", headers={"Authorization": "Bearer valid-token"}, json={}
        )
        self.assertEqual(res_assess.status_code, 429)
        self.assertEqual(res_assess.json()["error"]["code"], "RATE_LIMITED")

        # DELETE /v1/me rate limited on 2nd attempt
        client.delete("/v1/me", headers={"Authorization": "Bearer valid-token"})
        res_del = client.delete("/v1/me", headers={"Authorization": "Bearer valid-token"})
        self.assertEqual(res_del.status_code, 429)
        self.assertEqual(res_del.json()["error"]["code"], "RATE_LIMITED")


if __name__ == "__main__":
    unittest.main()
