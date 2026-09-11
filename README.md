# Lightning Transportation Data Reporting Kit

Versioned, agent-readable instructions and source for the active Lightning Supabase reporting interfaces.

## Start here

Every agent must read [`AGENTS.md`](AGENTS.md). The runtime contract is available from the authenticated `agent-reporting` catalog route.

## What this kit provides

- Complete 96-column data dictionary for DriverPay, drivers, returns, settlements, and trucks.
- Question routing, metric definitions, Ninox mappings, joins, date windows, allocation-bucket rules, and double-counting guardrails.
- Source and OpenAPI contract for the custom-key `agent-reporting` Edge Function.
- Source for the separate membership/JWT `reporting-query` Edge Function.
- A portable Hermes reporting skill, correction-feedback contract, and access lifecycle guidance.

## Active interfaces

### `agent-reporting` — approved AI service accounts

- `GET https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`
- Custom `x-agent-key` authentication; never place the key in a URL, browser, prompt, log, or repository.
- Server-enforced organization scope, optional per-key report allowlist/expiry, full read access to all six reports and their documented sensitive fields by default, explicit column selection, strict filters, stable pagination, and request audit. Set `AGENT_ALLOW_SENSITIVE_<n>=false` only to restrict a particular key.
- Discover with `?report=catalog`; see `docs/agent-reporting.md` and `api/openapi.yaml`.

### `reporting-query` — individual Supabase Auth memberships

- JWT-verified, membership/role-scoped reporting.
- Individual onboarding remains paused until approved company Auth email/SMTP delivery is ready. Do not use shared credentials as a workaround.

## Data safety

Raw public tables remain protected by RLS. This public knowledge repository contains no business rows, passwords, API keys, JWTs, refresh tokens, database credentials, or service-role/secret keys.

## Maintenance

- Follow [`docs/knowledge-maintenance.md`](docs/knowledge-maintenance.md); user corrections use the versioned sanitized event contract and are not approved rules until verified.
- Installed agents keep one twice-daily `data-reporting-kit-sync` job so updated rules reach local skill bundles.
- Change definitions through reviewed commits; do not change business rules silently.
- Inspect live schemas and deployed function source together.
- Add a dated changelog entry for every answer-affecting change.
- Run contract/security tests before deployment and verify the deployed source afterward.
- Follow `docs/offboarding.md` to revoke access.
