#!/usr/bin/env python3
"""Live contract smoke tests. Reads TEST_AGENT_KEY and never prints it or data rows."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting"
KEY = os.environ.get("TEST_AGENT_KEY")
RESTRICTED_KEY = os.environ.get("TEST_RESTRICTED_AGENT_KEY")
INVALID_CONFIG_KEY = os.environ.get("TEST_INVALID_CONFIG_AGENT_KEY")
if not KEY or not RESTRICTED_KEY or not INVALID_CONFIG_KEY:
    raise SystemExit("TEST_AGENT_KEY, TEST_RESTRICTED_AGENT_KEY, and TEST_INVALID_CONFIG_AGENT_KEY are required")


def call(params: list[tuple[str, str]], key: str = KEY) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{ENDPOINT}?{urllib.parse.urlencode(params)}",
        headers={"x-agent-key": key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as exc:
        return exc.code, json.load(exc)


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


checks: list[str] = []
status, body = call([("report", "catalog")], "definitely-invalid-test-key")
check(status == 401, "invalid key must return 401")
checks.append("invalid-key=401")

status, body = call([("report", "catalog")], INVALID_CONFIG_KEY)
check(status == 500 and body.get("error") == "Unable to process reporting request", "unexpected server errors must be sanitized")
check("organization" not in json.dumps(body).lower(), "server error leaked organization/configuration detail")
checks.append("server-error=sanitized-500")

status, catalog = call([("report", "catalog")])
check(status == 200 and catalog.get("schema_version") == "2.0.0", "catalog contract failed")
check(set(catalog.get("reports", {})) == {"settlement_summary", "settlements", "driver_pay", "drivers", "returns", "trucks"}, "catalog reports differ")
check(catalog.get("principal", {}).get("sensitive_access") is True, "default agent key should have sensitive access")
checks.append("catalog=all-reports-sensitive-enabled")

status, restricted_catalog = call([("report", "catalog")], RESTRICTED_KEY)
check(status == 200 and set(restricted_catalog.get("reports", {})) == {"drivers", "trucks"}, "restricted catalog leaked unauthorized reports")
check(restricted_catalog.get("principal", {}).get("sensitive_access") is False, "explicit sensitive restriction was not applied")
status, _ = call([("limit", "1")], RESTRICTED_KEY)
check(status == 403, "restricted key bypassed settlement authorization through legacy route")
status, _ = call([("report", "settlements"), ("period_from", "2026-09-01")], RESTRICTED_KEY)
check(status == 403, "restricted key accessed an unauthorized explicit report")
status, _ = call([("report", "trucks"), ("physical_only", "true"), ("limit", "1")], RESTRICTED_KEY)
check(status == 200, "restricted key could not access its allowed report")
checks.append("restricted-key-authorization=enforced")

status, metadata = call([("report", "settlements"), ("metadata", "true")])
check(status == 200 and len(metadata.get("fields", {})) == 28, "settlement metadata coverage failed")
check("1 is Carlos" in json.dumps(metadata), "owner bucket metadata missing")
checks.append("metadata=28-fields")

for label, params in [
    ("unknown-filter", [("report", "trucks"), ("disptach", "Group 1")]),
    ("duplicate-filter", [("report", "returns"), ("truck", "1"), ("truck", "2")]),
    ("blank-filter", [("report", "drivers"), ("name", "   ")]),
    ("invalid-driver-id", [("report", "drivers"), ("driver_id", "abc")]),
    ("invalid-returns-id", [("report", "returns"), ("ninox_id", "abc")]),
    ("invalid-truck-number", [("report", "trucks"), ("truck_number", "12x")]),
    ("invalid-temporal-driver", [("report", "driver_pay"), ("out_from", "2026-09-01"), ("temporal_driver", "Maybe")]),
    ("impossible-date", [("report", "returns"), ("return_from", "2026-99-99")]),
    ("reversed-range", [("report", "returns"), ("return_from", "2026-09-20"), ("return_to", "2026-09-01")]),
]:
    status, _ = call(params)
    check(status == 400, f"{label} must return 400")
    checks.append(f"{label}=400")

status, sensitive_drivers = call([("report", "drivers"), ("driver_id", "3"), ("include_sensitive", "true")])
expected_driver_fields = {"FullName", "First Name", "Middle Name", "Last Name", "E-mail", "Phone Number", "Years Of Experience", "DOB", "Company Name (This is NOT the Insurance)", "CDL", "State", "CDL Expiration", "Gender", "Insurance", "Ninox_ID", "ID", "organization_id"}
check(status == 200 and sensitive_drivers.get("total_count") == 1 and all(set(row) == expected_driver_fields for row in sensitive_drivers.get("data", [])), "default agent key did not receive the complete drivers projection")
status, _ = call([("report", "drivers"), ("driver_id", "3"), ("include_sensitive", "true")], RESTRICTED_KEY)
check(status == 403, "explicit AGENT_ALLOW_SENSITIVE=false restriction was bypassed")
checks.append("drivers-sensitive-default-enabled-restriction-enforced")

status, trucks = call([("report", "trucks"), ("physical_only", "true"), ("limit", "2")])
check(status == 200, "trucks query failed")
check(trucks.get("page_count") == 2 and trucks.get("total_count", 0) > 2 and trucks.get("has_more") is True and trucks.get("next_offset") == 2, "trucks pagination failed")
check(all(str(row.get("truck_number")) not in {"1", "2", "3"} for row in trucks.get("data", [])), "physical_only returned a bucket")
status, trucks2 = call([("report", "trucks"), ("physical_only", "true"), ("limit", "2"), ("offset", "2")])
truck_rows = trucks.get("data")
truck_rows2 = trucks2.get("data")
check(isinstance(truck_rows, list) and isinstance(truck_rows2, list) and bool(truck_rows2), "next page did not return rows")
assert isinstance(truck_rows, list) and isinstance(truck_rows2, list) and truck_rows2
check(truck_rows[-1].get("ID") != truck_rows2[0].get("ID"), "next page is unstable/duplicated")
status, empty_page = call([("report", "trucks"), ("physical_only", "true"), ("offset", "1000")])
check(status == 416 and "offset" in empty_page.get("error", "").lower(), "past-end pagination must return 416")
checks.append("pagination=stable-past-end-416")

status, settlements = call([("report", "settlements"), ("period_from", "2026-09-01"), ("period_to", "2026-09-01"), ("limit", "1000")])
check(status == 200, "settlements exact-period query failed")
check(all(row.get("From") == "2026-09-01" for row in settlements.get("data", [])), "settlements range filter not applied")
checks.append("settlements-filter=accepted")

status, summary = call([("report", "settlement_summary"), ("period_from", "2026-09-01"), ("period_to", "2026-09-01"), ("limit", "1000")])
check(status == 200 and summary.get("total_count") == settlements.get("total_count"), "settlement_summary exact-period query failed")
summary_fields = {"settlement_id", "organization_id", "truck", "owner", "period_from", "period_to", "gross", "total_expenses", "net", "total_driver_pay", "fuel_expenses", "driven_miles"}
check(all(set(row) == summary_fields for row in summary.get("data", [])), "settlement_summary projection differs from contract")
checks.append("settlement-summary=accepted-exact-projection")

status, returns = call([("report", "returns"), ("return_from", "2026-09-10"), ("return_to", "2026-12-31"), ("limit", "1000")])
check(status == 200, "returns date query failed")
check(all("Phone Number" not in row for row in returns.get("data", [])), "returns default exposed phone")
checks.append("returns=accepted-no-sensitive")

status, drivers = call([("report", "drivers"), ("driver_id", "3")])
check(status == 200 and drivers.get("total_count") == 1, "drivers exact-ID query failed")
check(all(not {"E-mail", "Phone Number", "DOB", "CDL", "CDL Expiration", "Gender"}.intersection(row) for row in drivers.get("data", [])), "drivers default exposed sensitive fields")
checks.append("drivers=accepted-no-sensitive")

status, driver_pay = call([("report", "driver_pay"), ("out_from", "2026-09-01"), ("out_to", "2026-09-07"), ("limit", "1000")])
check(status == 200, "DriverPay range query failed")
check(all("2026-09-01" <= row.get("Out Date", "") <= "2026-09-07" for row in driver_pay.get("data", [])), "DriverPay lower/upper bounds not both applied")
checks.append("driverpay-range=accepted")

status, non_solo = call([("report", "driver_pay"), ("out_from", "2025-01-01"), ("solo", "false"), ("limit", "1")])
check(status == 200, "solo=false query failed")
check(all(row.get("Solo_Driver_if_1") != 1 for row in non_solo.get("data", [])), "solo=false returned solo row")
checks.append("solo-false=null-safe")

status, legacy = call([("limit", "1")])
check(status == 200 and set(legacy) == {"count", "data"} and isinstance(legacy.get("count"), int) and legacy["count"] <= 1, "legacy response shape changed")
checks.append("legacy-shape=preserved")

print("LIVE_AGENT_REPORTING_SMOKE_OK " + " ".join(checks))
