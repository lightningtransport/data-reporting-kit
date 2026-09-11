# Team access — public knowledge-test phase

## Current test scope: instructions only

This public repository lets any Hermes or other agent system read the same data dictionary, metric definitions, approved filters, and reporting guardrails. It contains **no Supabase business records, secrets, access tokens, or service-role credentials**.

### GitHub write-access policy

- Public visibility grants **read access only**. It does not grant permission to change this repository.
- Only the repository-owning `lightningtransport` GitHub account may hold `admin`, `maintain`, or `write`/push access.
- Every other collaborator must have the `read` role only. Do not grant `triage`, `maintain`, or `admin` as a workaround.
- Do not leave pending collaborator invitations or write-capable deploy keys. Re-check direct collaborators, invitations, deploy keys, GitHub App installations, and branch-protection settings whenever access changes.

Supabase user provisioning and team API access remain intentionally paused until company Auth email delivery is configured with the approved subdomain/SMTP setup. Do not distribute a shared Supabase password, service-role key, database password, JWT, or refresh token as a workaround.

## Hermes installation

During the current public knowledge-test phase, anyone may read this repository and install the skill. When the repository returns to private, only approved GitHub collaborators/team members may do so.

Use the canonical repository copy rather than the Skills Hub lookup:

```bash
git clone --depth 1 https://github.com/lightningtransport/data-reporting-kit.git /tmp/data-reporting-kit
bash /tmp/data-reporting-kit/skills/itpros-supabase-reporting/scripts/sync-data-reporting-kit.sh
rm -rf /tmp/data-reporting-kit
```

The synchronization script installs the full skill bundle, including references and helper scripts, under the active `${HERMES_HOME:-$HOME/.hermes}` profile. Then start a new Hermes session so the installed skill is available. The reporting helper will remain unusable until that person has an individual Supabase Auth account and assigned role.

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
