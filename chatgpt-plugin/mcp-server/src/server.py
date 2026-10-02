"""Remote MCP server for Lightning Transportation's approved reporting service.

ChatGPT users sign in with Google through FastMCP's OAuth proxy, and only
workspace identities allowed by `AccessPolicy` reach the tools. This process
never accepts, logs, or returns the upstream x-agent-key.
"""
from __future__ import annotations

import os
from functools import cache
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext
from mcp import McpError
from mcp.types import ErrorData

from access import AccessDenied, AccessPolicy, parse_list
from knowledge import KnowledgeBase, load_documents
from reporting_service import ReportingApiError, ReportingService

REPOSITORY_URL = "https://github.com/lightningtransport/data-reporting-kit/blob/main"
RAW_REPOSITORY_URL = "https://raw.githubusercontent.com/lightningtransport/data-reporting-kit/main"
DOCUMENT_PATHS = (
    "AGENTS.md",
    "docs/agent-rules.md",
    "docs/question-routing.md",
    "docs/metric-definitions.md",
    "docs/data-dictionary.md",
    "docs/agent-reporting.md",
    "api/openapi.yaml",
)
# ChatGPT's connector OAuth callback; override only to test with another MCP client.
DEFAULT_CLIENT_REDIRECT_URIS = "https://chatgpt.com/connector_platform_oauth_redirect,https://chat.openai.com/connector_platform_oauth_redirect"
INSTRUCTIONS = (
    "Use search then fetch to retrieve current reporting rules. Use catalog before "
    "discovering reports, metadata before unfamiliar reports, and run_report only for "
    "approved read-only reporting requests. Never request sensitive fields unless the "
    "user explicitly needs them. Cite fetched documentation and state report filters, "
    "period, row count, freshness, pagination, and material caveats."
)


def load_knowledge(root: Path | None) -> KnowledgeBase:
    return KnowledgeBase(load_documents(DOCUMENT_PATHS, root, RAW_REPOSITORY_URL), REPOSITORY_URL)


def public_base_url() -> str:
    explicit = os.environ.get("PUBLIC_BASE_URL")
    if explicit:
        return explicit.rstrip("/")
    vercel_host = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL")
    if vercel_host:
        return f"https://{vercel_host}"
    raise RuntimeError("PUBLIC_BASE_URL is required when Google sign-in is enabled")


def create_auth():
    """Google sign-in for ChatGPT, with client registrations kept in encrypted Redis."""
    from cryptography.fernet import Fernet
    from fastmcp.server.auth.providers.google import GoogleProvider
    from key_value.aio.stores.redis import RedisStore
    from key_value.aio.wrappers.encryption import FernetEncryptionWrapper

    # Serverless instances do not share memory, so OAuth state must live in Redis.
    storage = FernetEncryptionWrapper(
        RedisStore(url=os.environ["REDIS_URL"]),
        fernet=Fernet(os.environ["STORAGE_ENCRYPTION_KEY"]),
    )
    return GoogleProvider(
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        base_url=public_base_url(),
        required_scopes=["openid", "https://www.googleapis.com/auth/userinfo.email"],
        allowed_client_redirect_uris=sorted(
            parse_list(os.environ.get("ALLOWED_CLIENT_REDIRECT_URIS", DEFAULT_CLIENT_REDIRECT_URIS))
        ),
        client_storage=storage,
        jwt_signing_key=os.environ["JWT_SIGNING_KEY"],
        extra_authorize_params={"prompt": "select_account"},
    )


class WorkspaceAccessMiddleware(Middleware):
    """Reject every MCP request from a Google identity outside the approved workspace."""

    def __init__(self, policy: AccessPolicy) -> None:
        self.policy = policy

    async def on_request(self, context: MiddlewareContext, call_next):
        token = get_access_token()
        try:
            self.policy.authorize(token.claims if token else None)
        except AccessDenied as denied:
            raise McpError(ErrorData(code=-32001, message=str(denied))) from None
        return await call_next(context)


def create_server() -> FastMCP:
    configured_root = os.environ.get("REPORTING_KNOWLEDGE_ROOT")
    root = Path(configured_root) if configured_root else Path(__file__).resolve().parents[3]
    endpoint = os.environ.get(
        "AGENT_REPORTING_ENDPOINT",
        "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting",
    )
    service = ReportingService(endpoint, os.environ["AGENT_REPORTING_KEY"])

    if os.environ.get("GOOGLE_CLIENT_ID"):
        auth = create_auth()
        middleware = [WorkspaceAccessMiddleware(AccessPolicy(
            parse_list(os.environ.get("ALLOWED_EMAIL_DOMAINS")),
            parse_list(os.environ.get("ALLOWED_EMAILS")),
        ))]
    elif os.environ.get("MCP_ALLOW_UNAUTHENTICATED") == "1" and not os.environ.get("VERCEL"):
        auth, middleware = None, []
    else:
        raise RuntimeError("GOOGLE_CLIENT_ID is required; set MCP_ALLOW_UNAUTHENTICATED=1 only for local testing")

    mcp = FastMCP(name="Lightning Transportation Reporting", instructions=INSTRUCTIONS, auth=auth, middleware=middleware)

    # Loaded on first use so a cold start does not wait on GitHub before the OAuth handshake.
    @cache
    def knowledge() -> KnowledgeBase:
        return load_knowledge(root)

    @mcp.tool(annotations={"readOnlyHint": True})
    def search(query: str) -> dict[str, Any]:
        """Search the canonical Lightning reporting knowledge base. Use fetch on each relevant result."""
        return knowledge().search(query)

    @mcp.tool(annotations={"readOnlyHint": True})
    def fetch(id: str) -> dict[str, Any]:
        """Fetch a canonical reporting document by the ID returned from search."""
        return knowledge().fetch(id)

    @mcp.tool(annotations={"readOnlyHint": True})
    def catalog() -> dict[str, Any]:
        """List reports and global request rules authorized for this service principal."""
        return service.catalog()

    @mcp.tool(annotations={"readOnlyHint": True})
    def metadata(report: str) -> dict[str, Any]:
        """Return live table grain, fields, filters, calculation rules, and restrictions for one report."""
        return service.metadata(report)

    @mcp.tool(annotations={"readOnlyHint": True})
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
