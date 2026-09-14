"""Safe, dependency-free client for Lightning's approved reporting Edge Function."""
from __future__ import annotations

import json
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
    "max_model_year",
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
        for name, value in filters.items():
            if name not in ALLOWED_PARAMETERS:
                raise ValueError(f"Unsupported reporting filter: {name}")
            if value is None or value == "":
                raise ValueError(f"Reporting filter cannot be blank: {name}")
        return self._get({"report": report, **dict(filters)})

    def _get(self, parameters: Mapping[str, Any]) -> dict[str, Any]:
        query = urlencode(parameters, doseq=False)
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
            raise ReportingApiError(error.code, self._message_for_status(error.code)) from None
        except URLError:
            raise ReportingApiError(503, "The reporting service is unavailable.") from None

        if status >= 400:
            raise ReportingApiError(status, self._message_for_status(status))
        try:
            decoded = json.loads(body)
        except (TypeError, json.JSONDecodeError):
            raise ReportingApiError(502, "The reporting service returned an invalid response.") from None
        if not isinstance(decoded, dict):
            raise ReportingApiError(502, "The reporting service returned an invalid response.")
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
