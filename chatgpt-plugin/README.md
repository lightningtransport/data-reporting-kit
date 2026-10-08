# Lightning Reporting ChatGPT Plugin

Current operational on-road/working and yard/off-duty questions use the explicitly approved credential-free [on-road](../docs/on-road-trucks.md) and [off-duty](../docs/off-duty-trucks.md) direct source contracts. Both documents are registered for MCP search/fetch. The MCP server publishes guidance, not a dedicated live-share data tool: the host must immediately fetch the exact share with complete bounded validation, or disclose unavailable evidence. DriverPay on_road_at is historical/explicit-date assignment overlap only, never a current-source failure fallback; no cached result, GPS movement claim or fleet complement.

This directory packages the two parts of an OpenAI ChatGPT plugin:

- `skills/lightning-reporting/SKILL.md`: the reusable operating rules.
- `mcp-server/`: a remote, read-only MCP server that retrieves the canonical repository docs and proxies only the approved `agent-reporting` Edge Function.

## Security model

The server is deliberately a narrow gateway:

- It exposes document retrieval plus report catalog, metadata, and approved reporting calls—never raw Supabase tables or SQL.
- `AGENT_REPORTING_KEY` is a server-only deployment secret. Do not add it to a ChatGPT action, browser app, repository, prompt, or URL.
- Configure the hosted MCP endpoint with OAuth through the ChatGPT plugin connection. Restrict plugin access to authorized workspace users and issue a least-privilege agent-reporting key for this connector.
- The connector is read-only. Do not add mutation tools without a separate approval and threat-model review.

## Local verification

```bash
cd mcp-server
uv run --frozen python -m unittest discover -s tests -v
uv run --frozen python src/server.py
```

Set `AGENT_REPORTING_KEY` through your shell or deployment-secret manager before starting the server. The service exposes streamable HTTP on `PORT` (default `8000`).

## Compact-first catalog discovery

`ReportingService.catalog()` and the MCP `catalog({})` tool request
`?report=catalog&compact=true` by default. `catalog({"compact": false})` (Python:
`service.catalog(compact=False)`) explicitly requests the full catalog. The HTTP
API and portable helper retain their full defaults; use helper `catalog --compact`
for discovery. Both modes preserve the server-authorized report list and global
rules; clients return the envelope unchanged, not a locally truncated dictionary.

Fetch selected report `metadata` before unfamiliar fields, filters or calculations;
compact routing summaries are not the field/calculation contract.

Hermes wrappers exposing `get_reporting_catalog({})` must request `compact=true`
at the HTTP layer **before** their reporting-output size guard runs. Reducing or
summarizing a full response after that guard cannot fix “Reporting output exceeds
model safety limit; narrow the request”. Keep the output limit enabled; do not
raise or disable it, strip global rules, or bypass permissions. Full mode is an
explicit opt-in and can still exceed a host's guard. Update/reload and smoke-test
the actual wrapper separately; this repository change does not update installed
Hermes integrations automatically.

## Deployment and ChatGPT connection

1. Deploy `mcp-server/Dockerfile` from the repository root to a public HTTPS host.
2. Set `AGENT_REPORTING_KEY` as a host-managed secret. Set `AGENT_REPORTING_ENDPOINT` only if the Edge Function endpoint changes.
3. Protect the public MCP URL with an OAuth authorization server supported by OpenAI's plugin connection flow; do not use a shared bearer secret for ChatGPT users.
4. In the ChatGPT workspace Plugin directory, create a private plugin, add this `SKILL.md`, then add the hosted remote MCP app. Connect and test it with an authorized workspace account.
5. Verify `search`/`fetch` citations, a catalog call, metadata retrieval, an authorized report, invalid-filter rejection, sensitive-data restriction, and audit records before workspace publication.

The precise ChatGPT publishing UI is administered by OpenAI and may change; follow the current [OpenAI plugin quickstart](https://platform.openai.com/plugins/quickstart) and [MCP guide](https://platform.openai.com/docs/mcp) when connecting the deployed endpoint.

## Departure support and rollout

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](../docs/departures.md).

The prepared MCP client accepts paired `out_from`/`out_to` (at most 31 inclusive days); omitted bounds use the New York Monday–Sunday default. Preserve aggregate `reconciliation`, `truck_sets`, `period`, `status`, and `complete`, including null combined total on source failure. The installed eight-report local MCP and cached helper remain **not integrated** until the documented deployment, sync, allowlist/filter update, reload and installed-client smoke checks are complete.
