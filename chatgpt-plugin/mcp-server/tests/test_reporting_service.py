from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from reporting_service import ReportingApiError, ReportingService


class FakeResponse:
    def __init__(self, status: int, payload: object):
        self.status = status
        self._payload = payload

    def read(self) -> bytes:
        return json.dumps(self._payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class ReportingServiceTests(unittest.TestCase):
 def test_catalog_request_keeps_agent_key_out_of_url_and_returns_payload(self):
    captured: dict[str, object] = {}

    def open_request(request, timeout):
        captured["url"] = request.full_url
        captured["key"] = request.get_header("X-agent-key")
        captured["timeout"] = timeout
        return FakeResponse(200, {"reports": {"trucks": {}}})

    service = ReportingService("https://example.supabase.co/functions/v1/agent-reporting", "secret-key", open_request)

    self.assertEqual(service.catalog(), {"reports": {"trucks": {}}})
    self.assertEqual(captured, {
        "url": "https://example.supabase.co/functions/v1/agent-reporting?report=catalog&compact=true",
        "key": "secret-key",
        "timeout": 20,
    })


 def test_catalog_explicit_false_requests_full_contract_without_truncation(self):
    captured = []
    payload = {"reports": {"trucks": {"fields": {"truck_number": "number"}}},
               "guidance": {"rule": "synthetic global rule"}, "padding": "x" * 60000}

    def open_request(request, timeout):
        captured.append(parse_qs(urlparse(request.full_url).query))
        return FakeResponse(200, payload)

    service = ReportingService("https://example.test/reporting", "test-only", open_request)
    self.assertEqual(service.catalog(compact=False), payload)
    self.assertEqual(captured, [{"report": ["catalog"], "compact": ["false"]}])


 def test_catalog_explicit_true_preserves_permissions_and_global_rules(self):
    captured = []
    payload = {"principal": {"allowed_reports": ["trucks"]},
               "reports": {"trucks": {"metadata_url": "?report=trucks&metadata=true"}},
               "guidance": {"rule": "synthetic global rule"}, "metadata_required": True}

    def open_request(request, timeout):
        captured.append(parse_qs(urlparse(request.full_url).query))
        return FakeResponse(200, payload)

    service = ReportingService("https://example.test/reporting", "test-only", open_request)
    self.assertEqual(service.catalog(compact=True), payload)
    self.assertEqual(captured, [{"report": ["catalog"], "compact": ["true"]}])


 def test_selected_metadata_does_not_send_catalog_only_compact_parameter(self):
    captured = []
    payload = {"report": "trucks", "fields": {"truck_number": {"type": "number"}}}

    def open_request(request, timeout):
        captured.append(parse_qs(urlparse(request.full_url).query))
        return FakeResponse(200, payload)

    service = ReportingService("https://example.test/reporting", "test-only", open_request)
    self.assertEqual(service.metadata("trucks"), payload)
    self.assertEqual(captured, [{"report": ["trucks"], "metadata": ["true"]}])


 def test_data_filters_reject_catalog_only_compact_before_network(self):
    calls = []
    service = ReportingService("https://example.test/reporting", "test-only", lambda *a, **k: calls.append(a))
    with self.assertRaisesRegex(ValueError, "Unsupported reporting filter: compact"):
        service.run_report("trucks", {"compact": True})
    self.assertEqual(calls, [])


 def test_run_report_serializes_only_allowed_values_and_returns_evidence(self):
    captured: dict[str, object] = {}

    def open_request(request, timeout):
        captured["url"] = request.full_url
        return FakeResponse(200, {"report": "settlements", "total_count": 2, "data": []})

    service = ReportingService("https://example.supabase.co/functions/v1/agent-reporting", "secret-key", open_request)
    result = service.run_report("settlements", {"period_from": "2026-09-01", "period_to": "2026-09-07", "limit": 25})

    self.assertEqual(result["report"], "settlements")
    query = parse_qs(urlparse(captured["url"]).query)
    self.assertEqual(query, {"report": ["settlements"], "period_from": ["2026-09-01"], "period_to": ["2026-09-07"], "limit": ["25"]})


 def test_run_report_rejects_unapproved_query_parameter_before_network_call(self):
    service = ReportingService("https://example.supabase.co/functions/v1/agent-reporting", "secret-key", lambda *_: None)

    with self.assertRaisesRegex(ValueError, "Unsupported reporting filter: drop_table"):
        service.run_report("trucks", {"drop_table": "true"})


 def test_upstream_error_is_sanitized_without_exposing_response_body(self):
    def open_request(_request, timeout):
        return FakeResponse(403, {"error": "internal role details must not be exposed"})

    service = ReportingService("https://example.supabase.co/functions/v1/agent-reporting", "secret-key", open_request)

    with self.assertRaises(ReportingApiError) as context:
        service.catalog()
    self.assertEqual(context.exception.status, 403)
    self.assertEqual(str(context.exception), "The reporting service denied this request.")
