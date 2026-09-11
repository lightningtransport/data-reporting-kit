---
name: itpros-supabase-reporting
description: Answer Lightning reports through the approved reporting API.
version: 0.3.0
author: Ibrain Ortega, Hermes Agent
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Supabase, Reporting, Lightning, Transport]
    related_skills: [supabase]
---

# Lightning reporting

Answer Lightning Transportation data questions with the authenticated `reporting-query` Edge Function. The helper saves only the caller's refreshable Supabase session in the active Hermes profile with owner-only file permissions. Never use a service-role key, database password, or another employee's token.

## When to Use

- Requests about fleet status, returns, driver assignment history, or settlement summaries.
- Do not use for writes, provisioning, schema changes, or direct access to protected driver PII.

## Authenticate

Use `terminal` to run the installed script. It prompts locally for the caller's Supabase password without printing it:

```bash
python "$HERMES_HOME/skills/itpros-supabase-reporting/scripts/reporting.py" login --email YOUR_COMPANY_EMAIL
```

For the default profile, substitute `${HERMES_HOME:-$HOME/.hermes}` if `HERMES_HOME` is unset. The script stores the refreshable session at `$HERMES_HOME/reporting/lightning-session.json`, mode `0600`.

## Procedure

1. Read `docs/question-routing.md` and `docs/data-dictionary.md` from the Data Reporting Kit repository. Completion: the report type, filters, period, and metric are unambiguous.
2. Run the helper through `terminal` using an allowlisted report and JSON filters. Example:

```bash
python "$HERMES_HOME/skills/itpros-supabase-reporting/scripts/reporting.py" query --report fleet_status --filters '{"dispatcher":"Group 1"}'
```

Completion: the response returns `data`, `row_count`, and `as_of`.
3. Validate date windows, type conversions, and driver/truck cardinality according to the routing guide. Completion: the result uses the stated business definition.
4. Respond with the source report, filters, exact period, result, freshness, and material caveats. Completion: no raw PII or secret appears in the response.

## Verified correction feedback webhook

When a user corrects an agent and the correction is verified against the live schema, approved business rules, a reproducible report, or a demonstrated agent failure, report the **sanitized knowledge change** to the approved team webhook so other agents can receive the same update.

This is conditional and privacy-first:

- Send only when `REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL` is explicitly configured by the repository owner. Never invent, discover, or substitute a webhook URL.
- If the variable is absent, do not send a request; update the repository through `docs/knowledge-maintenance.md` instead.
- Do not include raw driver/customer data, names, phone numbers, emails, license/CDL values, credentials, tokens, session data, full report rows, or the user's identity. Redact truck/driver identifiers when they are not necessary to express the general rule.
- Send only the minimum generalizable correction, not the entire conversation. A user disagreement that has not been verified is not knowledge and must not be sent as a correction.
- Use an approved authentication header from `REPORTING_KIT_KNOWLEDGE_WEBHOOK_TOKEN`; never put the token in the JSON body, logs, or a Git commit. Do not send if the URL is configured but authentication is missing.
- A webhook delivery failure must not change the answer or trigger retries that could duplicate sensitive data. Record the failure locally and continue with the verified answer.

### Event contract

POST JSON to the configured URL with:

`impact` must be one of `routing`, `metric`, `schema`, `security`, or `api`. `evidence_type` must be one of `live_schema`, `approved_business_rule`, `reproducible_report`, or `observed_failure`.

```json
{
  "event": "reporting_knowledge_correction",
  "schema_version": "1",
  "source": "itpros-supabase-reporting",
  "question_summary": "Redacted, general form of the user's question",
  "correction": "The verified rule that future agents must apply",
  "impact": "metric",
  "evidence_type": "approved_business_rule",
  "affected_docs": ["docs/agent-rules.md"],
  "verified_at": "2026-09-10T00:00:00Z"
}
```

Send the sanitized JSON with a short timeout and no automatic retry. For example, after writing only the sanitized payload to a mode-0600 temporary file:

```bash
umask 077
: "${REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL:?approved webhook URL is not configured}"
: "${REPORTING_KIT_KNOWLEDGE_WEBHOOK_TOKEN:?approved webhook token is not configured}"
curl --fail --silent --show-error --max-time 10 \
  -X POST \
  -H "Authorization: Bearer ${REPORTING_KIT_KNOWLEDGE_WEBHOOK_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @/path/to/sanitized-event.json \
  "$REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL"
rm -f /path/to/sanitized-event.json
```

Never print the token or payload containing user-derived text to logs. A successful webhook only distributes a candidate update; a maintainer must review it and commit the corresponding repository change. Never treat a webhook as permission to modify the repository automatically.

## Approved reports

- `fleet_status` — all reporting roles.
- `current_returns` — all reporting roles; no phone numbers.
- `driver_assignments` — all reporting roles; no contact/license fields.
- `settlement_summary` — `finance`, `owner`, or `admin` only.

## Pitfalls

- DriverPay and returns may produce two rows per team truck; count distinct trucks only when asked for trucks.
- Filter departures by `Out Date` only and historical returns by `Return Date` only.
- Settlement weeks run Tuesday through Monday.
- A request denied after offboarding is expected. Do not seek a bypass or alternate credential.

## Verification

Confirm the function response contains the requested report, filters, `as_of` timestamp, and `row_count`. State whether an empty result means no matching records or incomplete data coverage.
