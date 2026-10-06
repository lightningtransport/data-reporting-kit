"""Safe, dependency-free client for Lightning's approved reporting Edge Function."""
from __future__ import annotations

import json
from datetime import date
from collections.abc import Callable, Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ALLOWED_PARAMETERS = frozenset({
    "metadata", "limit", "offset", "include_sensitive", "truck", "truck_number",
    "driver_id", "owner", "dispatch", "dispatcher", "insurance", "to_report",
    "period_from", "period_to", "out_from", "out_to", "return_from", "return_to",
    "transfer", "termination", "solo", "temporal_driver", "name", "first_name",
    "last_name", "state", "company", "min_experience", "max_experience",
    "hire_from", "hire_to", "ninox_id", "driver_name", "yard_location",
    "mechanic_status", "make", "min_odometer", "max_odometer", "min_model_year",
    "max_model_year", "physical_only", "on_road_at", "return_null",
    "store_from", "store_to", "product", "city", "trailer", "date_from", "date_to",
    "choice", "type_of_work", "ahs", "exceptions",
})


class ReportingApiError(RuntimeError):
    """A sanitized error returned by the reporting gateway."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


class ReportingService:
    """Calls the allowlisted Edge Function without exposing its agent credential."""

    def __init__(
        self,
        endpoint: str,
        agent_key: str,
        opener: Callable[[Request, int], Any] = urlopen,
    ) -> None:
        if not endpoint.startswith("https://"):
            raise ValueError("Reporting endpoint must use HTTPS")
        if not agent_key:
            raise ValueError("AGENT_REPORTING_KEY is required")
        self.endpoint = endpoint.rstrip("?")
        self.agent_key = agent_key
        self.opener = opener

    def catalog(self) -> dict[str, Any]:
        return self._get({"report": "catalog"})

    def metadata(self, report: str) -> dict[str, Any]:
        return self._get({"report": report, "metadata": "true"})

    def run_report(self, report: str, filters: Mapping[str, Any]) -> dict[str, Any]:
        allowed = ALLOWED_PARAMETERS
        if report in ("departures", "out_schedule"):
            allowed = frozenset({"out_from", "out_to", "include_sensitive", "limit", "offset"})
        for name, value in filters.items():
            if name not in allowed:
                raise ValueError(f"Unsupported reporting filter: {name}")
            if value is None or value == "":
                raise ValueError(f"Reporting filter cannot be blank: {name}")
        if report in ("departures", "out_schedule"):
            if ("out_from" in filters) != ("out_to" in filters):
                raise ValueError("out_from and out_to must be supplied together")
            if "out_from" in filters:
                try:
                    start = date.fromisoformat(str(filters["out_from"]))
                    end = date.fromisoformat(str(filters["out_to"]))
                except ValueError:
                    raise ValueError("Invalid departure date bounds") from None
                if start.isoformat() != filters["out_from"] or end.isoformat() != filters["out_to"]:
                    raise ValueError("Departure dates must use YYYY-MM-DD")
                if end < start or (end - start).days + 1 > 31:
                    raise ValueError("Departure period must be ordered and at most 31 inclusive days")
        return self._get({"report": report, **dict(filters)})

    def _get(self, parameters: Mapping[str, Any]) -> dict[str, Any]:
        query = urlencode({name: "true" if value is True else "false" if value is False else value
                           for name, value in parameters.items()}, doseq=False)
        request = Request(
            f"{self.endpoint}?{query}",
            headers={"x-agent-key": self.agent_key, "accept": "application/json"},
            method="GET",
        )
        try:
            with self.opener(request, timeout=20) as response:
                status = getattr(response, "status", 200)
                body = response.read()
        except HTTPError as error:
            status = error.code
            try:
                body = error.read()
            finally:
                error.close()
            if status != 503 or parameters.get("report") not in ("out_schedule", "departures"):
                raise ReportingApiError(status, self._message_for_status(status)) from None
        except URLError:
            raise ReportingApiError(503, "The reporting service is unavailable.") from None

        try:
            decoded = json.loads(body)
        except (TypeError, json.JSONDecodeError):
            raise ReportingApiError(502, "The reporting service returned an invalid response.") from None
        if not isinstance(decoded, dict):
            raise ReportingApiError(502, "The reporting service returned an invalid response.")
        if status >= 400:
            # Only the gateway's structured source-failure envelope is evidence.
            # Ordinary failures remain sanitized; never reinterpret failure as zero.
            is_incomplete = (status == 503 and parameters.get("report") in ("out_schedule", "departures")
                             and decoded.get("report") == parameters["report"]
                             and decoded.get("complete") is False and decoded.get("status") == "incomplete")
            if parameters.get("report") == "departures":
                reconciliation = decoded.get("reconciliation")
                is_incomplete = is_incomplete and isinstance(reconciliation, dict) and reconciliation.get("combined_distinct_total") is None
            if not is_incomplete:
                raise ReportingApiError(status, self._message_for_status(status))
        return decoded

    @staticmethod
    def _message_for_status(status: int) -> str:
        if status == 401:
            return "The reporting service authentication failed."
        if status == 403:
            return "The reporting service denied this request."
        if status == 400:
            return "The reporting request was invalid."
        if status == 416:
            return "The requested reporting page is outside the available range."
        return "The reporting service could not complete this request."
