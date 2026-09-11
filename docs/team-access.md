# Team access

## Repository scope

This is a public, knowledge-only repository. It contains reporting instructions and Edge Function source but no Supabase business rows, API keys, passwords, JWTs, refresh tokens, database credentials, or service-role/secret keys. Public copies of documentation cannot be revoked after cloning.

## Approved AI service agents — active

Approved agents use `GET /functions/v1/agent-reporting` with an individually assigned `x-agent-key`.

- Each key can be bound to an organization, report allowlist, role label, expiry, and sensitive-field permission.
- The function scopes organization server-side and audits data requests by key identifier without storing the key value.
- Never share one key between independent agents. Never put a key in a browser, URL, prompt, repository, or log.
- Provision and test keys only through the approved Supabase secret workflow. Revocation is performed by removing the corresponding Edge Function secret.
- Agents start at `AGENTS.md`, then call `?report=catalog`.

## Individual employee access — paused

Personal Supabase Auth onboarding for `reporting-query` remains paused until approved company Auth email/subdomain/SMTP delivery is configured. Do not distribute a shared password, employee session, database key, or service credential as a workaround.

## Hermes knowledge installation

Anyone may read the public knowledge during this phase. An approved Hermes agent can install the skill bundle, but documentation access does not grant data access. Data calls still require an approved agent key or personal Auth membership.

```bash
hermes skills tap add lightningtransport/data-reporting-kit
hermes skills install lightningtransport/data-reporting-kit/skills/itpros-supabase-reporting --yes
```

Start a new session after installation. Follow `AGENTS.md`, `docs/agent-reporting.md`, `docs/data-dictionary.md`, `docs/question-routing.md`, `docs/metric-definitions.md`, and `api/openapi.yaml`.

## Future privacy change

Move the repository to a private GitHub organization/team before adding proprietary material that should not remain publicly copyable. Repository visibility and Supabase data authorization are separate controls.
