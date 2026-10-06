# Lightning Transportation Data Reporting Kit

Versioned, agent-readable instructions and source for the active Lightning Supabase reporting interfaces.

## Start here

Every agent must read [`AGENTS.md`](AGENTS.md). The runtime contract is available from the authenticated `agent-reporting` catalog route.

Grok Bot and Cursor agents: the reporting dashboard lives in [`apps/reporting-dashboard`](apps/reporting-dashboard). Link [https://lightning-settlement-dashboard.vercel.app](https://lightning-settlement-dashboard.vercel.app) for Settlements, `/out-schedule` for Out Schedule, `/trucks-return` for Trucks Return, and `/diesel` for Diesel; do not generate a replacement one-off HTML file. Conventions: [`docs/html-reporting.md`](docs/html-reporting.md). Copy [`skills/reporting-html-shadcn/assets/report-ui.css`](skills/reporting-html-shadcn/assets/report-ui.css) only for other static reports that are not this dashboard.

## What this kit provides

- Data dictionary for DriverPay, drivers, returns, settlements, trucks, fuel, and `Outside_Repairs` (125 live-verified physical columns), including shared-owner attribution for settlement and fuel reporting.
- Question routing, metric definitions, Ninox mappings, joins, date windows, allocation-bucket rules, and double-counting guardrails.
- Source and OpenAPI contract for the custom-key `agent-reporting` Edge Function.
- Source for the separate membership/JWT `reporting-query` Edge Function.
- A portable Hermes reporting skill, correction-feedback contract, and access lifecycle guidance.
- A Next.js + shadcn/ui reporting dashboard (`apps/reporting-dashboard`) for Grok Bot / Cursor agents, with Settlements (weekly/monthly review, rankings, fuel-by-owner, KPIs), Out Schedule, Trucks Return, Diesel, fixed Tabs navigation, and evidence footers.
- A private ChatGPT Plugin package: reusable reporting skill plus remote, read-only MCP connector; see [`docs/chatgpt-plugin.md`](docs/chatgpt-plugin.md).

## Active interfaces

### `agent-reporting` — approved AI service accounts

- `GET https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`
- Custom `x-agent-key` authentication; never place the key in a URL, browser, prompt, log, or repository.
- Single-organization access, optional per-key report allowlist/expiry, full read access to approved reports and their documented sensitive fields by default, explicit column selection, strict filters, stable pagination, and request audit. Set `AGENT_ALLOW_SENSITIVE_<n>=false` only to restrict a particular key. Road/outside/not-company-shop repairs route to `outside_repairs`, not internal-shop `LTR Invoices`; confirm the deployed catalog includes the report for your assigned key before querying.
- Discover with `?report=catalog`; see `docs/agent-reporting.md` and `api/openapi.yaml`.

### `reporting-query` — individual Supabase Auth memberships

- JWT-verified, membership/role-scoped reporting.
- Individual onboarding remains paused until approved company Auth email/SMTP delivery is ready. Do not use shared credentials as a workaround.

## Data safety

Raw public tables remain protected by RLS. This public knowledge repository contains no business rows, passwords, API keys, JWTs, refresh tokens, database credentials, or service-role/secret keys.

## Local validation

```bash
uv run --with pyyaml --with jsonschema python -m unittest discover -s tests
python3 -m unittest discover -s chatgpt-plugin/mcp-server/tests
uv run --with openapi-spec-validator python -m openapi_spec_validator api/openapi.yaml
git diff --check
```

`tests/test_departure_contract.py` validates synthetic schema envelopes, failure/null-total constraints, document links and the feedback-schema mirror. No tests pin live departure counts: the share is volatile. The installed-client checklist is separate from repository tests.

## Maintenance

- Follow [`docs/knowledge-maintenance.md`](docs/knowledge-maintenance.md); user corrections use the versioned sanitized event contract and are not approved rules until verified.
- Installed agents keep one twice-daily `data-reporting-kit-sync` job so updated rules reach local skill bundles.
- Change definitions through reviewed commits; do not change business rules silently.
- Inspect live schemas and deployed function source together.
- Add a dated changelog entry for every answer-affecting change.
- Run contract/security tests before deployment and verify the deployed source afterward.
- Follow `docs/offboarding.md` to revoke access.

## Prepared departures contract — schema 3.8.0

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](docs/departures.md).

The packaged helper and ChatGPT MCP source are prepared; installed clients remain **not integrated** until deployed and verified. See [client rollout checklist](docs/departures.md#client-rollout--still-not-integrated-until-verified). No deployment, installed-runtime modification, credential or operational-row publication is implied.
