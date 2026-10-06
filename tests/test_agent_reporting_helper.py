from __future__ import annotations

import argparse
import importlib.util
import pathlib
import unittest
import io
import json
import urllib.error
from unittest import mock

MODULE_PATH = pathlib.Path(__file__).parents[1] / "skills/itpros-supabase-reporting/scripts/agent_reporting.py"
spec = importlib.util.spec_from_file_location("agent_reporting", MODULE_PATH)
assert spec and spec.loader
agent_reporting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_reporting)


def args(*, one_page: bool = False, max_pages: int = 100, report: str = "trucks") -> argparse.Namespace:
    return argparse.Namespace(
        report=report,
        params='{"physical_only": true, "include_sensitive": false}',
        one_page=one_page,
        max_pages=max_pages,
    )


def page(
    ids: list[int],
    *,
    total: int,
    offset: int,
    has_more: bool,
    next_offset: int | None,
    report: str = "trucks",
    filters: dict[str, str] | None = None,
    source: str = "public.trucks",
    identity_field: str = "ID",
) -> dict:
    rows = [{identity_field: value} for value in ids]
    return {
        "report": report,
        "source": source,
        "filters": filters if filters is not None else {"physical_only": "true"},
        "offset": offset,
        "count": len(rows),
        "page_count": len(rows),
        "total_count": total,
        "has_more": has_more,
        "next_offset": next_offset,
        "data": rows,
    }


class AgentReportingHelperTests(unittest.TestCase):
    def test_departures_preserves_aggregate_and_source_failure(self) -> None:
        for complete in (True, False):
            payload = {
                "schema_version": "3.8.0", "report": "departures",
                "status": "complete" if complete else "incomplete", "complete": complete,
                "period": {"out_from": "2026-10-05", "out_to": "2026-10-11", "time_zone": "America/New_York"},
                "reconciliation": {"combined_distinct_total": 2 if complete else None},
                "truck_sets": {"combined": ["101", "102"] if complete else None},
                "data": [], "total_count": 0,
            }
            with self.subTest(complete=complete), mock.patch.object(agent_reporting, "request", return_value=payload) as request:
                result = agent_reporting.collect_query(args(report="departures"))
            self.assertEqual(result, payload)
            request.assert_called_once_with({"report": "departures", "physical_only": True,
                                             "include_sensitive": False})

    def test_out_schedule_preserves_idless_duplicate_snapshot_rows(self) -> None:
        payload = {**page([], total=2, offset=0, has_more=False, next_offset=None,
                          report="out_schedule", source="live Ninox Schedule_Teams approved share"),
                   "data": [{"Truck": 101, "Out Date": "2026-10-05"}] * 2,
                   "count": 2, "page_count": 2, "complete": True, "status": "complete"}
        with mock.patch.object(agent_reporting, "request", return_value=payload) as request:
            result = agent_reporting.collect_query(args(report="out_schedule"))
        self.assertEqual(result, payload)
        request.assert_called_once_with({"report": "out_schedule", "limit": 1000,
                                         "physical_only": True, "include_sensitive": False})

    def test_out_schedule_does_not_invent_stable_row_identity_across_snapshots(self) -> None:
        payload = {**page([], total=2, offset=0, has_more=True, next_offset=1,
                          report="out_schedule", source="live Ninox Schedule_Teams approved share"),
                   "data": [{"Truck": 101}], "count": 1, "page_count": 1,
                   "complete": True, "status": "complete"}
        with mock.patch.object(agent_reporting, "request", return_value=payload):
            with self.assertRaisesRegex(SystemExit, "snapshot"):
                agent_reporting.collect_query(args(report="out_schedule"))
            self.assertEqual(agent_reporting.collect_query(args(report="out_schedule", one_page=True)), payload)

    def test_http_503_request_preserves_incomplete_envelope(self) -> None:
        payload = {"report": "departures", "status": "incomplete", "complete": False,
                   "reconciliation": {"combined_distinct_total": None}}
        error = urllib.error.HTTPError("https://example.test", 503, "Unavailable", {},
                                       io.BytesIO(json.dumps(payload).encode()))
        with mock.patch.dict(agent_reporting.os.environ, {agent_reporting.KEY_ENV: "synthetic-test-only"}), \
             mock.patch.object(agent_reporting.urllib.request, "urlopen", side_effect=error):
            self.assertEqual(agent_reporting.request({"report": "departures"}), payload)
        error.close()

    def test_cli_accepts_departure_reports(self) -> None:
        for report in ("departures", "out_schedule"):
            for command in (["metadata", "--report", report], ["query", "--report", report]):
                with self.subTest(command=command), mock.patch("sys.argv", ["agent_reporting.py", *command]), \
                     mock.patch.object(agent_reporting, "request", return_value={}) as request, \
                     mock.patch.object(agent_reporting, "collect_query", return_value={}), mock.patch("builtins.print"):
                    agent_reporting.main()

    def test_cli_compact_catalog_sends_compact_true(self) -> None:
        with mock.patch("sys.argv", ["agent_reporting.py", "catalog", "--compact"]), \
             mock.patch.object(agent_reporting, "request", return_value={"report": "catalog"}) as request, \
             mock.patch("builtins.print"), mock.patch("sys.stderr", new_callable=io.StringIO):
            try:
                agent_reporting.main()
            except SystemExit as exc:
                self.fail(f"catalog --compact must be accepted (exit {exc.code})")
        request.assert_called_once_with({"report": "catalog", "compact": True})

    def test_json_booleans_are_lowercase_query_values(self) -> None:
        self.assertEqual(
            agent_reporting.encode_params({"enabled": True, "disabled": False, "limit": 10}),
            "enabled=true&disabled=false&limit=10",
        )

    def test_full_collection_requests_1000_rows_on_every_stable_id_page(self) -> None:
        for report, identity_field in (
            ("settlement_summary", "settlement_id"), ("settlements", "ID"),
            ("driver_pay", "ID"), ("drivers", "ID"), ("returns", "ID"),
            ("trucks", "ID"), ("fuel", "id"), ("outside_repairs", "id"),
        ):
            pages = [
                page([1], total=2, offset=0, has_more=True, next_offset=1,
                     report=report, identity_field=identity_field),
                page([2], total=2, offset=1, has_more=False, next_offset=None,
                     report=report, identity_field=identity_field),
            ]
            with self.subTest(report=report), mock.patch.object(agent_reporting, "request", side_effect=pages) as request:
                result = agent_reporting.collect_query(args(report=report))
                self.assertEqual(request.call_args_list, [
                    mock.call({"report": report, "physical_only": True,
                               "include_sensitive": False, "limit": 1000, "offset": offset})
                    for offset in (0, 1)
                ])
                self.assertTrue(result["complete"])
                self.assertEqual(result["data"], pages[0]["data"] + pages[1]["data"])

    def test_explicit_limit_is_preserved_on_every_page(self) -> None:
        for limit in (1, 100, "250", 0):
            query_args = args()
            query_args.params = json.dumps({"limit": limit, "include_sensitive": False})
            pages = [
                page([1], total=2, offset=0, has_more=True, next_offset=1),
                page([2], total=2, offset=1, has_more=False, next_offset=None),
            ]
            with self.subTest(limit=limit), mock.patch.object(agent_reporting, "request", side_effect=pages) as request:
                agent_reporting.collect_query(query_args)
                self.assertEqual(request.call_args_list, [
                    mock.call({"report": "trucks", "limit": limit,
                               "include_sensitive": False, "offset": offset})
                    for offset in (0, 1)
                ])

    def test_one_page_leaves_default_limit_to_api(self) -> None:
        response = page([1], total=2, offset=0, has_more=True, next_offset=1)
        with mock.patch.object(agent_reporting, "request", return_value=response) as request:
            result = agent_reporting.collect_query(args(one_page=True))
        request.assert_called_once_with({"report": "trucks", "physical_only": True,
                                         "include_sensitive": False, "offset": 0})
        self.assertFalse(result["complete"])

    def test_one_page_preserves_explicit_limit(self) -> None:
        query_args = args(one_page=True)
        query_args.params = '{"limit": 25}'
        response = page([1], total=2, offset=0, has_more=True, next_offset=1)
        with mock.patch.object(agent_reporting, "request", return_value=response) as request:
            agent_reporting.collect_query(query_args)
        request.assert_called_once_with({"report": "trucks", "limit": 25, "offset": 0})

    def test_cli_catalog_is_full_by_default(self) -> None:
        with mock.patch("sys.argv", ["agent_reporting.py", "catalog"]), \
             mock.patch.object(agent_reporting, "request", return_value={}) as request, \
             mock.patch("builtins.print"):
            agent_reporting.main()
        request.assert_called_once_with({"report": "catalog"})

    def test_compact_catalog_encodes_true_in_request_url(self) -> None:
        with mock.patch.dict(agent_reporting.os.environ, {agent_reporting.KEY_ENV: "synthetic-test-only"}), \
             mock.patch.object(agent_reporting.urllib.request, "urlopen", return_value=io.StringIO('{}')) as urlopen:
            agent_reporting.request({"report": "catalog", "compact": True})
        self.assertEqual(urlopen.call_args.args[0].full_url,
                         f"{agent_reporting.ENDPOINT}?report=catalog&compact=true")

    def test_complete_pagination_reconciles_stable_total(self) -> None:
        pages = [
            page([1], total=2, offset=0, has_more=True, next_offset=1),
            page([2], total=2, offset=1, has_more=False, next_offset=None),
        ]
        with mock.patch.object(agent_reporting, "request", side_effect=pages):
            result = agent_reporting.collect_query(args())
        self.assertTrue(result["complete"])
        self.assertEqual(result["fetched_count"], result["total_count"])
        self.assertEqual(result["pages_fetched"], 2)

    def test_total_count_must_be_integer_and_stable(self) -> None:
        invalid_cases = [
            [{**page([], total=0, offset=0, has_more=False, next_offset=None), "total_count": None}],
            [
                page([1], total=2, offset=0, has_more=True, next_offset=1),
                page([2], total=3, offset=1, has_more=False, next_offset=None),
            ],
        ]
        for pages in invalid_cases:
            with self.subTest(pages=pages), mock.patch.object(agent_reporting, "request", side_effect=pages):
                with self.assertRaises(SystemExit):
                    agent_reporting.collect_query(args())

    def test_final_page_count_must_reconcile(self) -> None:
        response = page([1], total=2, offset=0, has_more=False, next_offset=None)
        with mock.patch.object(agent_reporting, "request", return_value=response):
            with self.assertRaises(SystemExit):
                agent_reporting.collect_query(args())

    def test_one_page_is_never_marked_complete_when_more_exists(self) -> None:
        response = page([1], total=2, offset=0, has_more=True, next_offset=1)
        with mock.patch.object(agent_reporting, "request", return_value=response):
            result = agent_reporting.collect_query(args(one_page=True))
        self.assertFalse(result["complete"])

    def test_max_pages_is_configurable_and_enforced(self) -> None:
        response = page([1], total=2, offset=0, has_more=True, next_offset=1)
        with mock.patch.object(agent_reporting, "request", return_value=response):
            with self.assertRaisesRegex(SystemExit, "maximum page count"):
                agent_reporting.collect_query(args(max_pages=1))

    def test_replayed_or_overlapping_identity_is_rejected(self) -> None:
        pages = [
            page([1], total=2, offset=0, has_more=True, next_offset=1),
            page([1], total=2, offset=1, has_more=False, next_offset=None),
        ]
        with mock.patch.object(agent_reporting, "request", side_effect=pages):
            with self.assertRaisesRegex(SystemExit, "repeated a row identity"):
                agent_reporting.collect_query(args())

    def test_report_filter_source_offset_and_cursor_continuity_are_enforced(self) -> None:
        invalid_second_pages = [
            page([2], total=2, offset=1, has_more=False, next_offset=None, report="drivers"),
            page([2], total=2, offset=1, has_more=False, next_offset=None, filters={"physical_only": "false"}),
            page([2], total=2, offset=1, has_more=False, next_offset=None, source="public.other"),
            page([2], total=2, offset=2, has_more=False, next_offset=None),
        ]
        first = page([1], total=2, offset=0, has_more=True, next_offset=1)
        for second in invalid_second_pages:
            with self.subTest(second=second), mock.patch.object(agent_reporting, "request", side_effect=[first, second]):
                with self.assertRaises(SystemExit):
                    agent_reporting.collect_query(args())

        bad_cursor = page([1], total=2, offset=0, has_more=True, next_offset=2)
        with mock.patch.object(agent_reporting, "request", return_value=bad_cursor):
            with self.assertRaisesRegex(SystemExit, "pagination cursor"):
                agent_reporting.collect_query(args())

    def test_page_count_and_identity_are_required(self) -> None:
        invalid = [
            {**page([1], total=1, offset=0, has_more=False, next_offset=None), "page_count": 2},
            {**page([1], total=1, offset=0, has_more=False, next_offset=None), "data": [{}]},
        ]
        for response in invalid:
            with self.subTest(response=response), mock.patch.object(agent_reporting, "request", return_value=response):
                with self.assertRaises(SystemExit):
                    agent_reporting.collect_query(args())


    def test_outside_repairs_lowercase_id_reconciles_pages(self) -> None:
        pages = [
            page([101], total=2, offset=0, has_more=True, next_offset=1,
                 report="outside_repairs", source='public."Outside_Repairs"', identity_field="id"),
            page([102], total=2, offset=1, has_more=False, next_offset=None,
                 report="outside_repairs", source='public."Outside_Repairs"', identity_field="id"),
        ]
        with mock.patch.object(agent_reporting, "request", side_effect=pages):
            result = agent_reporting.collect_query(args(report="outside_repairs"))
        self.assertTrue(result["complete"])
        self.assertEqual([row["id"] for row in result["data"]], [101, 102])

    def test_outside_repairs_rejects_replayed_lowercase_id(self) -> None:
        pages = [
            page([101], total=2, offset=0, has_more=True, next_offset=1,
                 report="outside_repairs", source='public."Outside_Repairs"', identity_field="id"),
            page([101], total=2, offset=1, has_more=False, next_offset=None,
                 report="outside_repairs", source='public."Outside_Repairs"', identity_field="id"),
        ]
        with mock.patch.object(agent_reporting, "request", side_effect=pages):
            with self.assertRaisesRegex(SystemExit, "repeated a row identity"):
                agent_reporting.collect_query(args(report="outside_repairs"))

    def test_outside_repairs_missing_lowercase_id_is_rejected(self) -> None:
        response = page([101], total=1, offset=0, has_more=False, next_offset=None,
                        report="outside_repairs", source='public."Outside_Repairs"')
        with mock.patch.object(agent_reporting, "request", return_value=response):
            with self.assertRaisesRegex(SystemExit, "valid id"):
                agent_reporting.collect_query(args(report="outside_repairs"))

    def test_cli_accepts_outside_repairs_for_metadata_and_query(self) -> None:
        for command in (["metadata", "--report", "outside_repairs"],
                        ["query", "--report", "outside_repairs", "--params", '{"truck": 123}']):
            with self.subTest(command=command), mock.patch("sys.argv", ["agent_reporting.py", *command]), \
                 mock.patch.object(agent_reporting, "request", return_value={"report": "outside_repairs"}) as request, \
                 mock.patch.object(agent_reporting, "collect_query", return_value={"report": "outside_repairs"}) as collect, \
                 mock.patch("builtins.print"):
                agent_reporting.main()
                if command[0] == "metadata":
                    request.assert_called_once_with({"report": "outside_repairs", "metadata": "true"})
                else:
                    self.assertEqual(collect.call_args.args[0].report, "outside_repairs")


if __name__ == "__main__":
    unittest.main()
