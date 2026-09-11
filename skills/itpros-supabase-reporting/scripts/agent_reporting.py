#!/usr/bin/env python3
"""Read-only helper for the Lightning agent-reporting Edge Function."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

ENDPOINT = "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"
KEY_ENV = "LIGHTNING_AGENT_REPORTING_KEY"


def encode_params(params: dict[str, Any]) -> str:
    normalized = {
        key: ("true" if value is True else "false" if value is False else value)
        for key, value in params.items()
    }
    return urllib.parse.urlencode(normalized)


def request(params: dict[str, Any]) -> dict[str, Any]:
    key = os.environ.get(KEY_ENV)
    if not key:
        raise SystemExit(f"{KEY_ENV} is not configured")
    url = f"{ENDPOINT}?{encode_params(params)}"
    req = urllib.request.Request(
        url,
        headers={"x-agent-key": key, "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        try:
            payload = json.load(exc)
        except Exception:
            payload = {"error": f"HTTP {exc.code}"}
        raise SystemExit(json.dumps(payload, ensure_ascii=False)) from None
    except urllib.error.URLError as exc:
        raise SystemExit(f"agent-reporting request failed: {exc.reason}") from None


def parse_params(raw: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"--params must be valid JSON: {exc}") from None
    if not isinstance(value, dict):
        raise SystemExit("--params must be a JSON object")
    for key, item in value.items():
        if not isinstance(key, str) or not isinstance(item, (str, int, float, bool)) or item is None:
            raise SystemExit("--params values must be strings, numbers, or booleans")
    return value


def run_catalog(_: argparse.Namespace) -> None:
    print(json.dumps(request({"report": "catalog"}), ensure_ascii=False, indent=2))


def run_metadata(args: argparse.Namespace) -> None:
    print(json.dumps(request({"report": args.report, "metadata": "true"}), ensure_ascii=False, indent=2))


def collect_query(args: argparse.Namespace) -> dict[str, Any]:
    filters = parse_params(args.params)
    forbidden = {"report", "metadata", "offset"}.intersection(filters)
    if forbidden:
        raise SystemExit(f"--params must not contain: {', '.join(sorted(forbidden))}")
    offset = 0
    pages: list[dict[str, Any]] = []
    combined: list[dict[str, Any]] = []
    seen_identities: set[tuple[str, Any]] = set()
    expected_total: int | None = None
    expected_filters: dict[str, Any] | None = None
    expected_source: Any = None
    final_page = False
    if args.max_pages < 1:
        raise SystemExit("--max-pages must be at least 1")
    while True:
        payload = request({"report": args.report, **filters, "offset": offset})
        pages.append(payload)
        if payload.get("report") != args.report:
            raise SystemExit("agent-reporting report changed between pages")
        response_offset = payload.get("offset")
        if isinstance(response_offset, bool) or response_offset != offset:
            raise SystemExit("agent-reporting returned an unexpected page offset")
        response_filters = payload.get("filters")
        if not isinstance(response_filters, dict):
            raise SystemExit("agent-reporting returned invalid normalized filters")
        if expected_filters is None:
            expected_filters = response_filters
            expected_source = payload.get("source")
        elif response_filters != expected_filters or payload.get("source") != expected_source:
            raise SystemExit("agent-reporting query identity changed between pages")
        total_count = payload.get("total_count")
        if isinstance(total_count, bool) or not isinstance(total_count, int) or total_count < 0:
            raise SystemExit("agent-reporting returned an invalid total_count")
        if expected_total is None:
            expected_total = total_count
        elif total_count != expected_total:
            raise SystemExit("agent-reporting total_count changed between pages")
        rows = payload.get("data")
        if not isinstance(rows, list):
            raise SystemExit("agent-reporting returned an invalid data response")
        page_count = payload.get("page_count")
        count_alias = payload.get("count")
        if (
            isinstance(page_count, bool)
            or not isinstance(page_count, int)
            or page_count != len(rows)
            or count_alias != page_count
        ):
            raise SystemExit("agent-reporting page count does not match returned rows")
        identity_field = "settlement_id" if args.report == "settlement_summary" else "ID"
        for row in rows:
            if not isinstance(row, dict):
                raise SystemExit("agent-reporting row must be an object")
            identity_value = row.get(identity_field)
            if (
                identity_value is None
                or isinstance(identity_value, bool)
                or not isinstance(identity_value, (str, int, float))
            ):
                raise SystemExit(f"agent-reporting row is missing a valid {identity_field}")
            identity = (identity_field, identity_value)
            if identity in seen_identities:
                raise SystemExit("agent-reporting repeated a row identity across pages")
            seen_identities.add(identity)
        combined.extend(rows)
        has_more = payload.get("has_more")
        if not isinstance(has_more, bool):
            raise SystemExit("agent-reporting returned an invalid has_more value")
        if not has_more:
            if payload.get("next_offset") is not None:
                raise SystemExit("agent-reporting final page returned a next_offset")
            final_page = True
            break
        if args.one_page:
            break
        if len(pages) >= args.max_pages:
            raise SystemExit("pagination maximum page count exceeded")
        next_offset = payload.get("next_offset")
        expected_next_offset = offset + len(rows)
        if (
            not rows
            or isinstance(next_offset, bool)
            or not isinstance(next_offset, int)
            or next_offset != expected_next_offset
        ):
            raise SystemExit("agent-reporting returned an invalid pagination cursor")
        offset = next_offset
    assert expected_total is not None
    complete = final_page and len(combined) == expected_total
    if final_page and not complete:
        raise SystemExit(
            f"pagination reconciliation failed: fetched {len(combined)} rows but total_count is {expected_total}"
        )
    first = pages[0]
    last = pages[-1]
    return {
        "schema_version": first.get("schema_version"),
        "report": first.get("report"),
        "source": first.get("source"),
        "filters": expected_filters,
        "sort": first.get("sort"),
        "pages_fetched": len(pages),
        "fetched_count": len(combined),
        "total_count": expected_total,
        "complete": complete,
        "as_of_first_page": first.get("as_of"),
        "as_of_last_page": last.get("as_of"),
        "source_freshness": first.get("source_freshness"),
        "sensitive_fields_included": first.get("sensitive_fields_included"),
        "data": combined,
    }


def run_query(args: argparse.Namespace) -> None:
    result = collect_query(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(required=True)
    command = sub.add_parser("catalog")
    command.set_defaults(func=run_catalog)
    command = sub.add_parser("metadata")
    command.add_argument("--report", required=True, choices=["settlement_summary", "settlements", "driver_pay", "drivers", "returns", "trucks"])
    command.set_defaults(func=run_metadata)
    command = sub.add_parser("query")
    command.add_argument("--report", required=True, choices=["settlement_summary", "settlements", "driver_pay", "drivers", "returns", "trucks"])
    command.add_argument("--params", default="{}")
    command.add_argument("--one-page", action="store_true")
    command.add_argument("--max-pages", type=int, default=100)
    command.set_defaults(func=run_query)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
