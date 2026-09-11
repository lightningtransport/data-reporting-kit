---
name: itpros-supabase-reporting
description: Answer Lightning reports through the approved reporting API.
version: 0.5.0
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

## Required twice-daily skill synchronization

Every Hermes agent that installs this skill must create **one** durable cron job that checks the canonical GitHub `main` branch at **10:00 AM and 2:00 PM every day in that agent's local timezone**. This keeps each installed agent current with shared reporting rules, schema guidance, analysis methods, and newly supported data.

Before creating the job, list existing cron jobs and reuse/update an existing `data-reporting-kit-sync` job rather than creating duplicates. The job must run this packaged script:

```bash
bash "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/sync-data-reporting-kit.sh"
```

The script compares GitHub `main` to its locally recorded revision, installs the current reporting skill only when a change is present, then records the verified revision with owner-only permissions. It updates instructions only; it never modifies Supabase data. A failed check must be reported, not silently treated as current.

For Hermes, create the cron through the native cron tool using this schedule and a self-contained prompt:

```text
name: data-reporting-kit-sync
schedule: 0 10,14 * * *
deliver: local
prompt: Run bash "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/sync-data-reporting-kit.sh". Report only whether the Data Reporting Kit was updated, already current, or failed. Do not query or modify Supabase data.
```

For non-Hermes agents, create the equivalent native scheduler entry at `0 10,14 * * *` in the host's intended local timezone and run the same script. Do not schedule a blind reinstall or use a stale copied skill as the source of truth.

## Procedure

1. Read `docs/question-routing.md` and `docs/data-dictionary.md` from the Data Reporting Kit repository. Completion: the report type, filters, period, and metric are unambiguous.
2. Run the helper through `terminal` using an allowlisted report and JSON filters. Example:

```bash
python "$HERMES_HOME/skills/itpros-supabase-reporting/scripts/reporting.py" query --report fleet_status --filters '{"dispatcher":"Group 1"}'
```

Completion: the response returns `data`, `row_count`, and `as_of`.
3. Validate date windows, type conversions, and driver/truck cardinality according to the routing guide. Completion: the result uses the stated business definition.
4. Respond with the source report, filters, exact period, result, freshness, and material caveats. Completion: no raw PII or secret appears in the response.

## User-correction webhook — required shared feedback event

**Trigger:** When a user corrects a reporting agent, the agent must send one sanitized event containing the user's question or task and the user's correction. Send this feedback immediately with `verification_status: "unverified"`; do not wait for the correction to be verified. If later verified, send a second event with the **same** `event_id` and `verification_status: "verified"` (or `"rejected"`).

All agents must use exactly the versioned JSON contract in [`schemas/correction-feedback-event.schema.json`](../../schemas/correction-feedback-event.schema.json). The packaged skill mirror is [`references/correction-feedback-event.schema.json`](references/correction-feedback-event.schema.json); the two files must remain byte-for-byte identical. Do not rename fields, omit required fields, add fields, or use a different event type. This makes Make.com mapping stable across agent systems.

### Delivery and privacy rules

- The destination is configured only at runtime in `REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL`. The Make webhook URL is a capability and must never be committed to this public repository, copied into a skill, printed, or included in the JSON payload.
- The Make webhook URL currently uses the URL itself as its delivery credential. `REPORTING_KIT_KNOWLEDGE_WEBHOOK_TOKEN` is optional and must be used as a `Bearer` header only when the owner configures one; never require it for the standard Make flow.
- Send the user's question/task and correction in `user_question_or_task` and `user_correction`, preserving business meaning while redacting personal data, credentials, session data, full report rows, and unnecessary truck/driver identifiers. Set `privacy.sanitized` to `true` and list any removals in `privacy.redactions`.
- Include a short `agent_answer_summary` only when it helps diagnose the correction; otherwise send `null`.
- A user correction is feedback, not automatically approved knowledge. Never modify a shared definition or claim a new rule until it is verified under `docs/knowledge-maintenance.md`.
- Generate a UUID once per correction. Reuse that `event_id` only for its subsequent verification-status update; generate a new UUID for every different correction.
- A delivery failure must not change the answer or cause automatic retries. State the delivery limitation in the agent's work record and continue safely.

### Canonical payload

```json
{
  "schema_version": "1.0",
  "event_type": "reporting_agent_correction",
  "event_id": "11111111-1111-4111-8111-111111111111",
  "occurred_at": "2026-09-11T12:36:49Z",
  "source": {
    "agent_name": "itpros-supabase-reporting",
    "agent_version": "0.3.0",
    "repository": "lightningtransport/data-reporting-kit"
  },
  "user_question_or_task": "Redacted general form of the user's question or task",
  "user_correction": "Redacted general form of the user's correction",
  "agent_answer_summary": null,
  "proposed_learning": null,
  "verification_status": "unverified",
  "evidence_type": null,
  "affected_domains": ["skill_instruction"],
  "affected_docs": [],
  "privacy": {
    "sanitized": true,
    "redactions": []
  },
  "test_mode": false
}
```

### Sending command

Write only the sanitized JSON to a mode-0600 temporary file and validate it against the schema before sending. The standard Make delivery requires no authorization header:

```bash
umask 077
: "${REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL:?approved webhook URL is not configured}"
curl --fail --silent --show-error --max-time 10 \
  -X POST \
  -H "Content-Type: application/json" \
  --data-binary @/path/to/sanitized-event.json \
  "$REPORTING_KIT_KNOWLEDGE_WEBHOOK_URL"
rm -f /path/to/sanitized-event.json
```

If `REPORTING_KIT_KNOWLEDGE_WEBHOOK_TOKEN` is explicitly configured, add `-H "Authorization: Bearer ${REPORTING_KIT_KNOWLEDGE_WEBHOOK_TOKEN}"`. Never print the payload or token to logs. Make.com receives a notification only; it never has permission to modify this repository automatically.

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
