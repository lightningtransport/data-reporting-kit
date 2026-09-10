# Lightning Transportation Data Reporting Kit

Versioned, agent-readable instructions for answering business questions from Lightning Transportation's Supabase data.

## Start here

All human and AI users must read [`AGENTS.md`](AGENTS.md) first. It points to the canonical routing rules, metric definitions, complete data dictionary, and API contract.

## What this kit provides

- A mandatory agent rulebook for source selection, aggregation, dates, confidentiality, and answer evidence.
- A live-schema-verified, column-by-column data dictionary for every current public table.
- Metric definitions, time windows, joins, cardinality, and double-counting guardrails.
- A Hermes skill and a portable HTTP API contract for other agent systems.
- Onboarding and offboarding procedures.

## Security model

- Each team member has an individual Supabase Auth account and a `user_memberships` record.
- Team members use the authenticated `reporting-query` Edge Function; they do **not** receive database passwords or service-role keys.
- The function checks active membership on every request, limits reports by role, and writes an audit record.
- Raw base tables remain protected by RLS. Removing a membership immediately stops API access, even if a JWT has not yet expired.
- Individual Supabase Auth provisioning is currently paused until the company Auth subdomain/SMTP setup is complete; do not use shared credentials as a temporary workaround.
- This is a public knowledge-only repository for testing. It contains no database data or secrets. Never commit `.env`, Supabase access tokens, database passwords, JWTs, refresh tokens, or service-role keys.

## Roles

| Role | Intended use |
|---|---|
| `viewer` | Operational reports: fleet status, current returns, driver assignments without contact/license data. |
| `finance` | `viewer` reports plus settlement financial summaries. |
| `owner` | Direct read access to all company data for organization members. |
| `admin` | Direct read access to all company data and authorized provisioning work. |

## Quick start

1. Read [`AGENTS.md`](AGENTS.md), then the routing guide and metric definitions it requires.
2. During the public knowledge-test phase, use the repository to understand the reporting contract only. Individual Supabase Auth provisioning and live team API access are intentionally paused pending company Auth email/SMTP setup.
3. Once provisioned, obtain a personal Supabase Auth session and call `https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/reporting-query` with your own JWT, following `api/openapi.yaml`.
4. For Hermes, install the reporting skill and authenticate with the local password prompt; see `skills/itpros-supabase-reporting/SKILL.md`.

## Repository maintenance

- Follow [`docs/knowledge-maintenance.md`](docs/knowledge-maintenance.md): verified learning that changes an answer must be documented, validated, added to the changelog, and pushed in the same work cycle.
- Update definitions through pull requests; do not change business rules silently.
- Review schema changes and reporting behavior together.
- Add a dated entry to `CHANGELOG.md` for every change that affects answers.
- Revoke access by following `docs/offboarding.md`.
