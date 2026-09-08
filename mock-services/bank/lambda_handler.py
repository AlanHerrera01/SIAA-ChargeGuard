"""AWS Lambda handler for ChargeGuard Mock Bank API."""

import os
from pathlib import Path
from starlette.types import ASGIApp, Receive, Scope, Send
from mangum import Mangum

from api import create_app


class StripPrefixMiddleware:
    def __init__(self, app: ASGIApp, prefix: str) -> None:
        self.app = app
        self.prefix = prefix.rstrip("/")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path == self.prefix:
                scope["path"] = "/"
            elif path.startswith(self.prefix + "/"):
                scope["path"] = path[len(self.prefix) :]
            raw_path = scope.get("raw_path")
            if raw_path:
                prefix_bytes = self.prefix.encode("ascii")
                if raw_path == prefix_bytes:
                    scope["raw_path"] = b"/"
                elif raw_path.startswith(prefix_bytes + b"/"):
                    scope["raw_path"] = raw_path[len(prefix_bytes) :]
        await self.app(scope, receive, send)


dataset_dir = Path(os.getenv("DATASET_DIR", "./datasets"))
app = create_app(dataset_dir=dataset_dir)
app.add_middleware(StripPrefixMiddleware, prefix="/mock/bank")

handler = Mangum(app)
