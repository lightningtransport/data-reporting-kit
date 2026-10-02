"""Vercel entrypoint: serves the reporting MCP server at /mcp as a stateless ASGI app."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from server import create_server  # noqa: E402

# Stateless JSON responses let any serverless instance answer any request.
app = create_server().http_app(path="/mcp", stateless_http=True, json_response=True)
