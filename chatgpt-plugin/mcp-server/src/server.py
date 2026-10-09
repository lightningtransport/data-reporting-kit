"""Remote MCP server for Lightning Transportation's approved reporting service.

Transport authentication is intentionally delegated to the OAuth-capable hosting
layer configured for the ChatGPT plugin. This process never accepts, logs, or
returns the upstream x-agent-key.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

from knowledge import KnowledgeBase
from reporting_service import ReportingApiError, ReportingService

REPOSITORY_URL = "https://github.com/lightningtransport/data-reporting-kit/blob/main"
DOCUMENT_PATHS = (
    "AGENTS.md",
    "docs/agent-rules.md",
    "docs/question-routing.md",
    "docs/metric-definitions.md",
    "docs/data-dictionary.md",
    "docs/agent-reporting.md",
    "docs/departures.md",
    "docs/on-road-trucks.md",
    "docs/off-duty-trucks.md",
    "docs/drivers-insurance.md",
    "api/openapi.yaml",
)


def load_knowledge(root: Path) -> KnowledgeBase:
    documents = {path: (root / path).read_text(encoding="utf-8") for path in DOCUMENT_PATHS}
    return KnowledgeBase(documents, REPOSITORY_URL)


def create_server() -> FastMCP:
    root = Path(os.environ.get("REPORTING_KNOWLEDGE_ROOT", Path(__file__).parents[3]))
    endpoint = os.environ.get(
        "AGENT_REPORTING_ENDPOINT",
        "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting",
    )
    service = ReportingService(endpoint, os.environ["AGENT_REPORTING_KEY"])
    knowledge = load_knowledge(root)
    mcp = FastMCP(
        name="Lightning Transportation Reporting",
        instructions=(
            "Use search then fetch to retrieve current reporting rules. Use catalog before "
            "discovering reports, metadata before unfamiliar reports, and run_report only for "
            "approved read-only gateway requests. Drivers Insurance/insured-driver lists, "
            "current on-road/working and off-duty questions "
            "use the approved credential-free direct shares documented in the knowledge base; "
            "these are not MCP reports. If the host cannot fetch a share, disclose unavailable "
            "evidence, never fall back to DriverPay for current status. Never request sensitive fields unless the "
            "user explicitly needs them. Cite fetched documentation and state report filters, "
            "period, row count, freshness, pagination, and material caveats. "
            "For leaving/departure totals use departures: the same Out Date window on "
            "DriverPay and live Schedule_Teams, distinct truck union, never source-count "
            "addition or assignment-row counts. out_schedule is the planned list only. "
            "Preserve reconciliation, truck_sets, period, status and complete; an "
            "incomplete source has no combined total. Do not apply return exclusions "
            "or the returning-trucks formula to departures. Confirm both reports in "
            "the authenticated catalog before use; repository support is not proof "
            "that an installed MCP client or deployed gateway is integrated."
        ),
    )

    @mcp.tool()
    def search(query: str) -> dict[str, Any]:
        """Search the canonical Lightning reporting knowledge base. Use fetch on each relevant result."""
        return knowledge.search(query)

    @mcp.tool()
    def fetch(id: str) -> dict[str, Any]:
        """Fetch a canonical reporting document by the ID returned from search."""
        return knowledge.fetch(id)

    @mcp.tool()
    def catalog(compact: bool = True) -> dict[str, Any]:
        """Discover authorized reports/global rules compactly; false opts into full catalog.

        Load selected report metadata before unfamiliar field/calculation use.
        """
        return service.catalog(compact=compact)

    @mcp.tool()
    def metadata(report: str) -> dict[str, Any]:
        """Return live table grain, fields, filters, calculation rules, and restrictions for one report."""
        return service.metadata(report)

    @mcp.tool()
    def run_report(report: str, filters: dict[str, Any]) -> dict[str, Any]:
        """Run one read-only, allowlisted report with exact documented filters and safe pagination."""
        return service.run_report(report, filters)

    return mcp


if __name__ == "__main__":
    try:
        create_server().run(
            transport="streamable-http",
            host="0.0.0.0",
            port=int(os.environ.get("PORT", "8000")),
        )
    except ReportingApiError as error:
        raise SystemExit(f"Reporting MCP startup failed: {error}") from error
