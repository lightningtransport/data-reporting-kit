"""Synthetic transport fixtures only; these tests do not claim live deployment."""
import json
import sys
import unittest
from io import BytesIO
from urllib.error import HTTPError
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from reporting_service import ReportingService
from test_reporting_service import FakeResponse


class DepartureSupportTests(unittest.TestCase):
    def test_departures_rejects_return_filters_before_network(self):
        calls = []
        service = ReportingService("https://example.test/reporting", "test-only", lambda *a, **k: calls.append(a))
        with self.assertRaisesRegex(ValueError, "Unsupported.*return_from"):
            service.run_report("departures", {"return_from": "2026-10-05"})
        self.assertEqual(calls, [])

    def test_departures_preserves_reconciliation_and_incomplete_status(self):
        payload = {"report": "departures", "complete": False, "status": "incomplete",
                   "period": {"out_from": "2026-10-05", "out_to": "2026-10-11"},
                   "reconciliation": {"combined_distinct_total": None},
                   "truck_sets": {"combined": None}}
        captured = []
        def opener(request, timeout):
            captured.append(parse_qs(urlparse(request.full_url).query))
            return FakeResponse(200, payload)
        service = ReportingService("https://example.test/reporting", "test-only", opener)
        self.assertEqual(service.run_report("departures", {}), payload)
        self.assertEqual(captured, [{"report": ["departures"]}])

    def test_http_503_retains_only_structured_departure_failure_evidence(self):
        payload = {"report": "departures", "complete": False, "status": "incomplete",
                   "reconciliation": {"combined_distinct_total": None}, "source_status": {}}
        for raises in (False, True):
            def opener(request, timeout):
                if raises:
                    raise HTTPError(request.full_url, 503, "Unavailable", {}, BytesIO(json.dumps(payload).encode()))
                return FakeResponse(503, payload)
            service = ReportingService("https://example.test/reporting", "test-only", opener)
            with self.subTest(raises=raises):
                self.assertEqual(service.run_report("departures", {}), payload)

    def test_new_reports_accept_paired_bounds_and_lowercase_booleans(self):
        for report in ("departures", "out_schedule"):
            captured = []
            def opener(request, timeout):
                captured.append(parse_qs(urlparse(request.full_url).query))
                return FakeResponse(200, {"report": report})
            service = ReportingService("https://example.test/reporting", "test-only", opener)
            service.run_report(report, {"out_from": "2026-10-05", "out_to": "2026-10-11", "include_sensitive": False})
            self.assertEqual(captured[0]["include_sensitive"], ["false"])

    def test_new_reports_reject_invalid_period_before_network(self):
        for report in ("departures", "out_schedule"):
            for filters in ({"out_from": "2026-10-05"}, {"out_to": "2026-10-11"},
                            {"out_from": "2026-10-11", "out_to": "2026-10-05"},
                            {"out_from": "2026-02-30", "out_to": "2026-03-01"},
                            {"out_from": "2026-09-01", "out_to": "2026-10-02"}):
                calls = []
                service = ReportingService("https://example.test/reporting", "test-only", lambda *a, **k: calls.append(a))
                with self.subTest(report=report, filters=filters), self.assertRaises(ValueError):
                    service.run_report(report, filters)
                self.assertEqual(calls, [])
