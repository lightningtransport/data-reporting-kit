"""Exercise real MCP tool registration/dispatch with synthetic HTTP responses."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from fastmcp import Client
import server
from reporting_service import ReportingService
from test_reporting_service import FakeResponse


class CatalogToolTests(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_schema_and_dispatch_support_compact_default_and_full_opt_in(self):
        captured = []
        payload = {"reports": {"trucks": {"source": "trucks"}},
                   "guidance": {"rule": "synthetic global rule"}, "metadata_required": True}

        def opener(request, timeout):
            captured.append(parse_qs(urlparse(request.full_url).query))
            return FakeResponse(200, payload)

        service = ReportingService("https://example.test/reporting", "test-only", opener)
        with patch.dict(os.environ, {"AGENT_REPORTING_KEY": "test-only"}), \
                patch.object(server, "ReportingService", return_value=service):
            mcp = server.create_server()
        async with Client(mcp) as client:
            tools = {tool.name: tool for tool in await client.list_tools()}
            schema = tools["catalog"].inputSchema
            self.assertEqual(schema["properties"].get("compact"),
                             {"default": True, "type": "boolean"})
            self.assertNotIn("compact", schema.get("required", []))
            for arguments, expected in (({}, "true"), ({"compact": True}, "true"),
                                        ({"compact": False}, "false")):
                result = await client.call_tool("catalog", arguments)
                self.assertEqual(result.data, payload)
                self.assertEqual(captured[-1], {"report": ["catalog"], "compact": [expected]})
