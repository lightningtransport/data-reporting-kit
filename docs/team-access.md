# Team access — public knowledge-test phase

## Current test scope: instructions only

This public repository lets any Hermes or other agent system read the same data dictionary, metric definitions, approved filters, and reporting guardrails. It contains **no Supabase business records, secrets, access tokens, or service-role credentials**.

Supabase user provisioning and team API access remain intentionally paused until company Auth email delivery is configured with the approved subdomain/SMTP setup. Do not distribute a shared Supabase password, service-role key, database password, JWT, or refresh token as a workaround.

## Hermes installation

After being granted access to this private GitHub repository, each team member runs:

```bash
hermes skills tap add lightningtransport/data-reporting-kit
hermes skills install lightningtransport/data-reporting-kit/skills/itpros-supabase-reporting --yes
```

Then start a new Hermes session so the installed skill is available. The reporting helper will remain unusable until that person has an individual Supabase Auth account and assigned role.

## Other agent systems

Clone or read the same private repository using the employee's own GitHub account. Use:

- `docs/data-dictionary.md`
- `docs/question-routing.md`
- `docs/metric-definitions.md`
- `api/openapi.yaml` (documentation only until individual Auth is enabled)

## Public test access

Anyone may read and install the knowledge skill during this test phase. Public content cannot be revoked from a person who has already cloned or copied it. Move the repository back to private before adding proprietary definitions or enabling team data access.

- To end public testing, change the repository visibility back to private and remove any previously granted collaborators.
- When the company moves the repository into a GitHub Organization, use a private repository plus a GitHub Team for centralized onboarding/offboarding.
