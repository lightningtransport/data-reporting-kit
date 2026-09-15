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
            "approved read-only reporting requests. Never request sensitive fields unless the "
            "user explicitly needs them. Cite fetched documentation and state report filters, "
            "period, row count, freshness, pagination, and material caveats."
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
    def catalog() -> dict[str, Any]:
        """List reports and global request rules authorized for this service principal."""
        return service.catalog()

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
