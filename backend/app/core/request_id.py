"""Per-request identifier propagation.

A pure-ASGI middleware stamps every HTTP request with a random request id,
exposes it to the application through a ContextVar (provenance events record
it so log lines and audit rows can be correlated), and echoes it back in the
``X-Request-ID`` response header. Being pure ASGI (no ``BaseHTTPMiddleware``)
guarantees the endpoint runs in the same context, so the value is always
visible and can never interleave between concurrent requests.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return _request_id.get()


class RequestIDMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        token = _request_id.set(request_id)

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append("X-Request-ID", request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_header)
        finally:
            _request_id.reset(token)
