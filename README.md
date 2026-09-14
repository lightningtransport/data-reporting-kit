# Lightning Transportation Data Reporting Kit

Versioned, agent-readable instructions and source for the active Lightning Supabase reporting interfaces.

## Start here

Every agent must read [`AGENTS.md`](AGENTS.md). The runtime contract is available from the authenticated `agent-reporting` catalog route.

## What this kit provides

- Complete 99-column data dictionary for DriverPay, drivers, returns, settlements, and trucks.
- Question routing, metric definitions, Ninox mappings, joins, date windows, allocation-bucket rules, and double-counting guardrails.
- Source and OpenAPI contract for the custom-key `agent-reporting` Edge Function.
- Source for the separate membership/JWT `reporting-query` Edge Function.
- A portable Hermes reporting skill, correction-feedback contract, and access lifecycle guidance.
- A private ChatGPT Plugin package: reusable reporting skill plus remote, read-only MCP connector; see [`docs/chatgpt-plugin.md`](docs/chatgpt-plugin.md).
- A TypeScript Streamable HTTP MCP server with focused fleet/reporting tools; see [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md), [`docs/MCP_TOOLS.md`](docs/MCP_TOOLS.md), and [`docs/CHATGPT_PLUGIN_SETUP.md`](docs/CHATGPT_PLUGIN_SETUP.md).

## Active interfaces

### `agent-reporting` — approved AI service accounts

- `GET https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`
- Custom `x-agent-key` authentication; never place the key in a URL, browser, prompt, log, or repository.
- Single-organization access, optional per-key report allowlist/expiry, full read access to all six reports and their documented sensitive fields by default, explicit column selection, strict filters, stable pagination, and request audit. Set `AGENT_ALLOW_SENSITIVE_<n>=false` only to restrict a particular key.
- Discover with `?report=catalog`; see `docs/agent-reporting.md` and `api/openapi.yaml`.

### `reporting-query` — individual Supabase Auth memberships

- JWT-verified, membership/role-scoped reporting.
- Individual onboarding remains paused until approved company Auth email/SMTP delivery is ready. Do not use shared credentials as a workaround.

## Data safety

Raw public tables remain protected by RLS. This public knowledge repository contains no business rows, passwords, API keys, JWTs, refresh tokens, database credentials, or service-role/secret keys.

## Lightning MCP server

The plugin server runs as a read-only gateway:

```text
ChatGPT → MCP /mcp → agent-reporting Edge Function → approved reporting sources
```

It never accepts SQL and never connects directly to Supabase tables. The current contract supports trucks, driver assignments, drivers, returns, and settlements. Work orders, parts, bays, repair history, and downtime duration are not documented and are returned as `BLOCKED_BY_DATA`.

```bash
cd chatgpt-plugin/mcp-server
npm install
npm run build
AGENT_REPORTING_KEY=... npm run dev
```

Production requires OAuth configuration; see [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Maintenance

- Follow [`docs/knowledge-maintenance.md`](docs/knowledge-maintenance.md); user corrections use the versioned sanitized event contract and are not approved rules until verified.
- Installed agents keep one twice-daily `data-reporting-kit-sync` job so updated rules reach local skill bundles.
- Change definitions through reviewed commits; do not change business rules silently.
- Inspect live schemas and deployed function source together.
- Add a dated changelog entry for every answer-affecting change.
- Run contract/security tests before deployment and verify the deployed source afterward.
- Follow `docs/offboarding.md` to revoke access.
