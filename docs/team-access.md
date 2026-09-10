# Team access — current phase

## Phase 1: Instructions only

The repository is shared with approved team members so their agents use the same data dictionary, metric definitions, approved filters, and reporting guardrails.

Supabase user provisioning and team API access are intentionally paused until company Auth email delivery is configured with the approved subdomain/SMTP setup. Do not distribute a shared Supabase password, service-role key, database password, JWT, or refresh token as a workaround.

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

## Grant and revoke instructions access

- Grant: invite the employee's GitHub username as a repository collaborator with **Read** access.
- Revoke: remove that collaborator from `lightningtransport/data-reporting-kit`.
- When the company moves the repository into a GitHub Organization, replace individual collaborators with a GitHub Team for centralized offboarding.
