#!/usr/bin/env python3
"""Idempotently sync Ninox Daily Fuel (table ME) into Supabase public.fuel.

The script is safe by default: without --apply it validates and reports only.
For writes, it requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service
role key must be stored in the environment, never in this file.

Confirmed mapping:
    public.fuel."Unit"                <- ME.F  (Unit / truck number)
    public.fuel."Store Date"          <- ME.Z
    public.fuel."Product"             <- ME.L4
    public.fuel."SubTotal"            <- ME.G3
    public.fuel."Adjusted SubTotal"   <- ME.A3
    public.fuel."Gallons"             <- ME.V4
    public.fuel."City"                <- ME.N3
    public.fuel."State"               <- ME.O3
    public.fuel."Price_Per_Gallon"    <- ME.I5
    public.fuel."owner"               <- ME.R4
    public.fuel."Ninox_ID"            <- ME.Id (the record's top-level id)

Ninox field IDs are resolved against the live ME schema on every run. This
prevents a silent import into the wrong destination if Ninox field captions
change or a field ID is repurposed.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from decimal import Decimal, InvalidOperation
from typing import Any

NINOX_BASE_URL = "https://lightningtransport.ninoxdb.com/85Qr2bLduF54cjRuY/api/v1"
NINOX_DATABASE_ID = "r0ngbzy641gc"
NINOX_TABLE_ID = "ME"
DEFAULT_PAGE_SIZE = 100
DEFAULT_BATCH_SIZE = 500

# destination column: Ninox physical field ID (Id is handled from record["id"])
FIELD_MAPPING = {
    "Unit": "F",
    "Store Date": "Z",
    "Product": "L4",
    "SubTotal": "G3",
    "Adjusted SubTotal": "A3",
    "Gallons": "V4",
    "City": "N3",
    "State": "O3",
    "Price_Per_Gallon": "I5",
    "owner": "R4",
}
NUMERIC_COLUMNS = {
    "Unit",
    "SubTotal",
    "Adjusted SubTotal",
    "Gallons",
    "Price_Per_Gallon",
    "Ninox_ID",
}
DATE_COLUMNS = {"Store Date"}


class SyncError(RuntimeError):
    """A sync error that should stop the run without partial retries."""


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SyncError(f"{name} is not configured")
    return value


def request_json(request: urllib.request.Request, *, attempts: int = 5) -> Any:
    """Send JSON request with bounded retry for transient failures and 429s."""
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read()
                return json.loads(raw, parse_float=Decimal) if raw else None
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < attempts - 1:
                retry_after = error.headers.get("Retry-After")
                time.sleep(float(retry_after) if retry_after else min(2**attempt, 30))
                continue
            if 500 <= error.code < 600 and attempt < attempts - 1:
                time.sleep(min(2**attempt, 30))
                continue
            body = error.read(1000).decode("utf-8", "replace")
            raise SyncError(f"HTTP {error.code}: {body}") from error
        except urllib.error.URLError as error:
            if attempt < attempts - 1:
                time.sleep(min(2**attempt, 30))
                continue
            raise SyncError(f"Network error: {error.reason}") from error
    raise SyncError("Request exhausted retries")


def ninox_get(path: str) -> Any:
    token = require_env("NINOX_API_KEY")
    request = urllib.request.Request(
        NINOX_BASE_URL + path,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    return request_json(request)


def get_field_names_by_id() -> dict[str, str]:
    table = ninox_get(f"/databases/{NINOX_DATABASE_ID}/tables/{NINOX_TABLE_ID}")
    if not isinstance(table, dict) or table.get("id") != NINOX_TABLE_ID:
        raise SyncError("Unexpected Ninox table schema response for ME")
    fields = table.get("fields")
    if not isinstance(fields, list):
        raise SyncError("Ninox ME schema did not include a fields list")
    result = {field.get("id"): field.get("name") for field in fields if isinstance(field, dict)}
    missing = {field_id for field_id in FIELD_MAPPING.values() if field_id not in result}
    if missing:
        raise SyncError(f"Mapped Ninox field IDs are missing from ME: {sorted(missing)}")
    return result


def iter_ninox_records(
    page_size: int, max_pages: int | None, after_id: int | None
) -> Iterator[dict[str, Any]]:
    # Ninox pagination is zero-based. sinceId is a server-side filter: Id > after_id.
    page = 0
    while max_pages is None or page < max_pages:
        parameters: dict[str, int] = {"perPage": page_size, "page": page}
        if after_id is not None:
            parameters["sinceId"] = after_id
        query = urllib.parse.urlencode(parameters)
        records = ninox_get(
            f"/databases/{NINOX_DATABASE_ID}/tables/{NINOX_TABLE_ID}/records?{query}"
        )
        if not isinstance(records, list):
            raise SyncError(f"Unexpected Ninox records response on page {page}")
        for record in records:
            if not isinstance(record, dict):
                raise SyncError(f"Unexpected non-object record on Ninox page {page}")
            yield record
        if len(records) < page_size:
            return
        page += 1


def normalize_number(value: Any, *, field: str, record_id: Any) -> int | float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise SyncError(f"Ninox record {record_id}: {field} is boolean, not numeric")
    # Ninox number fields are JSON numbers. No currency or locale convention
    # is established: do not guess by stripping separators/symbols.
    text = str(value).strip()
    if not re.fullmatch(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?", text):
        raise SyncError(f"Ninox record {record_id}: invalid numeric {field}={value!r}")
    try:
        decimal_value = Decimal(text)
    except (InvalidOperation, ValueError) as error:
        raise SyncError(f"Ninox record {record_id}: invalid numeric {field}={value!r}") from error
    if not decimal_value.is_finite():
        raise SyncError(f"Ninox record {record_id}: non-finite numeric {field}")
    float_value = float(decimal_value)
    if not math.isfinite(float_value) or (decimal_value != 0 and float_value == 0):
        raise SyncError(f"Ninox record {record_id}: out-of-range numeric {field}")
    if decimal_value == decimal_value.to_integral_value():
        return int(decimal_value)
    if Decimal(str(float_value)) != decimal_value:
        raise SyncError(f"Ninox record {record_id}: precision-changing numeric {field}")
    return float_value


def normalize_date(value: Any, *, field: str, record_id: Any) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or len(value) != 10 or value[4] != "-" or value[7] != "-":
        raise SyncError(f"Ninox record {record_id}: invalid ISO date {field}={value!r}")
    return value


def transform(record: dict[str, Any], field_names_by_id: dict[str, str]) -> dict[str, Any]:
    record_id = record.get("id")
    ninox_id = normalize_number(record_id, field="Id", record_id=record_id)
    if ninox_id is None:
        raise SyncError("Ninox record without top-level id")

    source_fields = record.get("fields")
    if not isinstance(source_fields, dict):
        raise SyncError(f"Ninox record {record_id}: missing fields object")

    row: dict[str, Any] = {"Ninox_ID": ninox_id}
    for destination, field_id in FIELD_MAPPING.items():
        field_name = field_names_by_id[field_id]
        if destination in NUMERIC_COLUMNS and field_name not in source_fields:
            raise SyncError(f"Ninox record {record_id}: missing numeric source field {field_id}")
        value = source_fields.get(field_name)
        if destination in NUMERIC_COLUMNS:
            row[destination] = normalize_number(value, field=field_id, record_id=record_id)
        elif destination in DATE_COLUMNS:
            row[destination] = normalize_date(value, field=field_id, record_id=record_id)
        elif value is None:
            row[destination] = None
        elif isinstance(value, str):
            row[destination] = value
        else:
            row[destination] = str(value)
    return row


def batches(rows: list[dict[str, Any]], size: int) -> Iterator[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def get_supabase_max_ninox_id(supabase_url: str, service_role_key: str) -> int:
    """Read the committed append-only cursor from Supabase."""
    endpoint = (
        supabase_url.rstrip("/")
        + "/rest/v1/fuel?select=Ninox_ID&Ninox_ID=not.is.null"
        + "&order=Ninox_ID.desc&limit=1"
    )
    request = urllib.request.Request(
        endpoint,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Accept": "application/json",
        },
    )
    rows = request_json(request)
    if not isinstance(rows, list) or len(rows) != 1 or "Ninox_ID" not in rows[0]:
        raise SyncError("Supabase fuel table has no maximum Ninox_ID")
    maximum = normalize_number(rows[0]["Ninox_ID"], field="Ninox_ID", record_id="Supabase")
    if maximum is None or not isinstance(maximum, int):
        raise SyncError("Supabase maximum Ninox_ID is not an integer")
    return maximum


def verify_supabase_batch(
    expected_rows: list[dict[str, Any]], supabase_url: str, service_role_key: str
) -> None:
    """Read back one written batch and compare every mapped field exactly."""
    ids = ",".join(str(row["Ninox_ID"]) for row in expected_rows)
    parameters = urllib.parse.urlencode(
        {
            "select": ",".join(["Ninox_ID", *FIELD_MAPPING.keys()]),
            "Ninox_ID": f"in.({ids})",
        }
    )
    request = urllib.request.Request(
        supabase_url.rstrip("/") + "/rest/v1/fuel?" + parameters,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Accept": "application/json",
        },
    )
    actual_rows = request_json(request)
    if not isinstance(actual_rows, list) or len(actual_rows) != len(expected_rows):
        actual_count = len(actual_rows) if isinstance(actual_rows, list) else "invalid response"
        raise SyncError(
            f"Supabase read-back returned {actual_count} rows; expected {len(expected_rows)}"
        )
    actual_by_id = {
        normalize_number(row.get("Ninox_ID"), field="Ninox_ID", record_id="Supabase"): row
        for row in actual_rows
    }
    for expected in expected_rows:
        row_id = expected["Ninox_ID"]
        actual = actual_by_id.get(row_id)
        if actual is None:
            raise SyncError(f"Supabase read-back is missing Ninox_ID {row_id}")
        for column, expected_value in expected.items():
            actual_value = actual.get(column)
            if column in NUMERIC_COLUMNS:
                actual_value = normalize_number(actual_value, field=column, record_id=row_id)
            elif column in DATE_COLUMNS:
                actual_value = normalize_date(actual_value, field=column, record_id=row_id)
            elif actual_value is not None and not isinstance(actual_value, str):
                actual_value = str(actual_value)
            if actual_value != expected_value:
                raise SyncError(
                    f"Supabase read-back mismatch for Ninox_ID {row_id}, {column}: "
                    f"expected {expected_value!r}, got {actual_value!r}"
                )


def supabase_upsert(rows: list[dict[str, Any]], supabase_url: str, service_role_key: str) -> None:
    endpoint = supabase_url.rstrip("/") + "/rest/v1/fuel?on_conflict=Ninox_ID"
    payload = json.dumps(rows, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    request_json(request)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="write batches to Supabase")
    mode.add_argument("--dry-run", action="store_true", help="validate and report only (the default)")
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--max-pages", type=int, help="limit Ninox pages; useful for a safe test")
    parser.add_argument("--full", action="store_true", help="scan all ME records instead of only IDs newer than Supabase")
    parser.add_argument("--after-id", type=int, help="override the Supabase cursor; intended for dry-run testing")
    args = parser.parse_args()
    if args.full and args.after_id is not None:
        raise SystemExit("--full and --after-id cannot be used together")
    if not 1 <= args.page_size <= 100:
        raise SystemExit("--page-size must be between 1 and 100")
    if not 1 <= args.batch_size <= 1000:
        raise SystemExit("--batch-size must be between 1 and 1000")
    if args.max_pages is not None and args.max_pages < 1:
        raise SystemExit("--max-pages must be at least 1")

    try:
        # The normal append-only path reads one Supabase value, then asks Ninox
        # to return only ME records whose Id is greater than that value.
        supabase_url: str | None = None
        service_role_key: str | None = None
        after_id: int | None = None
        if not args.full:
            if args.after_id is not None:
                after_id = args.after_id
            else:
                supabase_url = require_env("SUPABASE_URL")
                service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
                after_id = get_supabase_max_ninox_id(supabase_url, service_role_key)

        field_names_by_id = get_field_names_by_id()
        transformed: list[dict[str, Any]] = []
        seen_ids: set[int | float] = set()
        for record in iter_ninox_records(args.page_size, args.max_pages, after_id):
            row = transform(record, field_names_by_id)
            ninox_id = row["Ninox_ID"]
            if ninox_id in seen_ids:
                raise SyncError(f"Duplicate Ninox record id in source: {ninox_id}")
            seen_ids.add(ninox_id)
            transformed.append(row)

        print(json.dumps({
            "mode": "apply" if args.apply else "dry-run",
            "ninox_table": NINOX_TABLE_ID,
            "after_ninox_id": after_id,
            "records_validated": len(transformed),
            "ninox_id_min": min(seen_ids) if seen_ids else None,
            "ninox_id_max": max(seen_ids) if seen_ids else None,
            "batches": (len(transformed) + args.batch_size - 1) // args.batch_size,
        }))

        if not args.apply or not transformed:
            return 0

        if supabase_url is None:
            supabase_url = require_env("SUPABASE_URL")
        if service_role_key is None:
            service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
        completed = 0
        for number, batch in enumerate(batches(transformed, args.batch_size), start=1):
            supabase_upsert(batch, supabase_url, service_role_key)
            verify_supabase_batch(batch, supabase_url, service_role_key)
            completed += len(batch)
            print(json.dumps({"batch": number, "upserted": len(batch), "verified": len(batch), "completed": completed}))
        print(json.dumps({"status": "complete", "upserted": completed}))
        return 0
    except SyncError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
