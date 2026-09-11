from __future__ import annotations

import argparse
import importlib.util
import pathlib
import unittest
from unittest import mock

MODULE_PATH = pathlib.Path(__file__).parents[1] / "skills/itpros-supabase-reporting/scripts/agent_reporting.py"
spec = importlib.util.spec_from_file_location("agent_reporting", MODULE_PATH)
assert spec and spec.loader
agent_reporting = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_reporting)


def args(*, one_page: bool = False, max_pages: int = 100) -> argparse.Namespace:
    return argparse.Namespace(
        report="trucks",
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
) -> dict:
    rows = [{"ID": value} for value in ids]
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
    def test_json_booleans_are_lowercase_query_values(self) -> None:
        self.assertEqual(
            agent_reporting.encode_params({"enabled": True, "disabled": False, "limit": 10}),
            "enabled=true&disabled=false&limit=10",
        )

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


if __name__ == "__main__":
    unittest.main()
