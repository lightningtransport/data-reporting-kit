# ChatGPT plugin deployment

The `chatgpt-plugin/` package makes this repository usable from standard ChatGPT conversations through a private workspace plugin and a remote MCP service.

## Components

- The ChatGPT skill (`chatgpt-plugin/skills/lightning-reporting/SKILL.md`) contains the minimum non-negotiable reporting instructions, including the ≥3-month window for HTML/analytical settlement history.
- The MCP server supplies the `search` and `fetch` tools required for ChatGPT company-knowledge and deep-research compatibility, plus `catalog`, `metadata`, and `run_report` for governed reporting access.
- The existing `agent-reporting` Edge Function remains the only data gateway. The MCP server does not query Supabase tables directly.

## Required hosting controls

1. Host the MCP server behind HTTPS and an OAuth authorization server compatible with ChatGPT plugins. Associate each ChatGPT user with a workspace identity and revoke access centrally when employment/access changes.
2. Store `AGENT_REPORTING_KEY` only in the host's secret manager. Create a dedicated, least-privilege `agent-reporting` principal for this connector. Never place the key in the plugin, MCP tool results, logs, GitHub, or a ChatGPT prompt.
3. Restrict the plugin to approved users. Keep all exposed MCP tools read-only.
4. Monitor `public.agent_query_audit`, including principal, report, normalized filters, sensitivity flag, outcome, and count. A report response must fail closed if the upstream audit write fails.

## ChatGPT validation checklist

- `search` returns repository URLs, then `fetch` returns the authoritative document and produces citations.
- `catalog` returns only the dedicated connector principal's allowed reports.
- `metadata` is called before an unfamiliar report is queried.
- `run_report` rejects an unsupported filter before it reaches Supabase.
- Authorized and denied report calls leave correct audit rows.
- An explicit sensitive-data request is denied or minimized according to the connector principal's policy.
- A multi-page result is not summarized as complete until `has_more` is false.

Follow the current OpenAI [plugin quickstart](https://platform.openai.com/plugins/quickstart), [MCP server guide](https://platform.openai.com/plugins/build/mcp-server), and [authentication guide](https://platform.openai.com/plugins/build/auth) while connecting the deployed endpoint. Keep screenshots, OAuth client secrets, and service credentials outside this repository.
