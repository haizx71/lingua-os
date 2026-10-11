"""Route-specific raw request bounds for Reader dictionary lookup."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID, uuid4

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from lingua_api.dictionary.lookup import LOOKUP_PATH, MAX_LOOKUP_REQUEST_BYTES


class DictionaryLookupRequestBodyLimitMiddleware:
    """Count lookup body bytes before FastAPI parses JSON or runs dependencies."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope.get("type") != "http"
            or scope.get("method") != "POST"
            or scope.get("path") != LOOKUP_PATH
        ):
            await self.app(scope, receive, send)
            return

        try:
            declared_length = self._declared_length(scope.get("headers", ()))
        except ValueError:
            await self._reject(scope, receive, send)
            return
        if declared_length is not None and declared_length > MAX_LOOKUP_REQUEST_BYTES:
            await self._reject(scope, receive, send)
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                await self._reject(scope, receive, send)
                return

            chunk = message.get("body", b"")
            if len(body) + len(chunk) > MAX_LOOKUP_REQUEST_BYTES:
                await self._reject(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        if declared_length is not None and len(body) != declared_length:
            await self._reject(scope, receive, send)
            return

        replayed = False

        async def replay_receive() -> Message:
            nonlocal replayed
            if replayed:
                return await receive()
            replayed = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay_receive, send)

    @staticmethod
    def _declared_length(headers: Sequence[tuple[bytes, bytes]]) -> int | None:
        lengths = [value for name, value in headers if name.lower() == b"content-length"]
        has_transfer_encoding = any(
            name.lower() == b"transfer-encoding" for name, _value in headers
        )
        if len(lengths) > 1 or (lengths and has_transfer_encoding):
            raise ValueError("ambiguous request framing")
        if not lengths:
            return None

        raw_length = lengths[0].strip()
        if not raw_length or not raw_length.isdigit():
            raise ValueError("invalid content length")
        normalized = raw_length.lstrip(b"0") or b"0"
        if len(normalized) > len(str(MAX_LOOKUP_REQUEST_BYTES)):
            return MAX_LOOKUP_REQUEST_BYTES + 1
        return int(normalized)

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send) -> None:
        state = scope.get("state")
        request_id = state.get("request_id") if isinstance(state, dict) else None
        if not isinstance(request_id, UUID):
            request_id = uuid4()
        response = JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "The request is invalid.",
                    "requestId": str(request_id),
                }
            },
            headers={"Cache-Control": "private, no-store"},
        )
        await response(scope, receive, send)
