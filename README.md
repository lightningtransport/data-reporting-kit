# Lightning Transportation Data Reporting Kit

Versioned, agent-readable instructions for answering business questions from Lightning Transportation's Supabase data.

## What this kit provides

- A safe question-to-report routing guide.
- A data dictionary based on the live Supabase schema.
- Metric definitions, time windows, joins, and double-counting guardrails.
- A Hermes skill and a portable HTTP API contract for other agent systems.
- Onboarding and offboarding procedures.

## Security model

- Each team member has an individual Supabase Auth account and a `user_memberships` record.
- Team members use the authenticated `reporting-query` Edge Function; they do **not** receive database passwords or service-role keys.
- The function checks active membership on every request, limits reports by role, and writes an audit record.
- Raw base tables remain protected by RLS. Removing a membership immediately stops API access, even if a JWT has not yet expired.
- This repository must remain private. Never commit `.env`, Supabase access tokens, database passwords, JWTs, or service-role keys.

## Roles

| Role | Intended use |
|---|---|
| `viewer` | Operational reports: fleet status, current returns, driver assignments without contact/license data. |
| `finance` | `viewer` reports plus settlement financial summaries. |
| `owner` | Direct read access to all company data for organization members. |
| `admin` | Direct read access to all company data and authorized provisioning work. |

## Quick start

1. Obtain a personal Supabase Auth session from the company onboarding flow.
2. Read `docs/question-routing.md` and `docs/metric-definitions.md`.
3. Call `https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/reporting-query` with your own JWT, following `api/openapi.yaml`.
4. For Hermes, install the private reporting skill and authenticate using its local password prompt; see `skills/itpros-supabase-reporting/SKILL.md`.

## Repository maintenance

- Update definitions through pull requests; do not change business rules silently.
- Review schema changes and reporting behavior together.
- Add a dated entry to `CHANGELOG.md` for every change that affects answers.
- Revoke access by following `docs/offboarding.md`.
