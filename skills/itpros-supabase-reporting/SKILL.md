---
name: itpros-supabase-reporting
description: Answer Lightning reports through the approved reporting APIs.
version: 0.6.1
author: Ibrain Ortega, Hermes Agent
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Supabase, Reporting, Lightning, Transport]
    related_skills: [supabase]
---

# Lightning reporting

Read repository `AGENTS.md` first. Approved AI service agents use `agent-reporting`; the personal JWT-based `reporting-query` flow remains available only to already-approved Supabase members.

## Agent-key mode

The assigned key must be injected at runtime as `LIGHTNING_AGENT_REPORTING_KEY`. Never put it in a command argument, URL, prompt, log, repository, or output.

```bash
python "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/agent_reporting.py" catalog
python "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/agent_reporting.py" metadata --report settlements
python "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/agent_reporting.py" query --report settlements --params '{"period_from":"2026-09-01","period_to":"2026-09-01"}'
```

The query helper follows pagination by default, verifies that integer `total_count` stays stable, and marks a result complete only when the final fetched count equals it. It returns `fetched_count`, `total_count`, normalized filters, timestamps, and combined data. Use `--one-page` only when a partial page is explicitly sufficient; set `--max-pages` when the default safety limit of 100 pages is unsuitable.

## Personal membership mode

The legacy `scripts/reporting.py` helper uses the caller's personal Supabase Auth session and `reporting-query`. Do not use it without an approved company membership. Never copy another person's password/session or use a database/service-role key.

## Required twice-daily skill synchronization

Every installed agent must maintain one `data-reporting-kit-sync` job at 10:00 AM and 2:00 PM local time. Before creating or updating that cron job, run the packaged sync command below. It checks the canonical GitHub skill version first and leaves the installed local skill unchanged when the versions match; it replaces local skills only when the canonical version differs. Then list existing jobs and update the named job instead of creating duplicates.

```bash
bash "${HERMES_HOME:-$HOME/.hermes}/skills/itpros-supabase-reporting/scripts/sync-data-reporting-kit.sh"
```

Use schedule `0 10,14 * * *`. The job updates instructions only and must report updated, current, or failed; never silently rely on stale instructions. Its prompt must run the packaged command first and report `DATA_REPORTING_KIT_UPDATED`, `DATA_REPORTING_KIT_UP_TO_DATE`, or `DATA_REPORTING_KIT_SYNC_FAILED` with the canonical revision.

## Procedure

1. Read `AGENTS.md`, `docs/agent-rules.md`, `docs/question-routing.md`, `docs/metric-definitions.md`, and `docs/data-dictionary.md`.
2. Call `catalog`, then report metadata when the current schema/rules are not loaded.
3. Choose the smallest report and exact filters. Settlement reports require an explicit period or truck; DriverPay requires truck, driver, `out_from`, or `return_from`.
4. Run the helper and reconcile `fetched_count` with `total_count` when a complete answer is required.
5. Apply grain, date, join, allocation-bucket, stored-value, and sensitive-output rules. When a needed field is absent from the selected record, use approved-report relational fallback before finalizing: CDL is the unique driver key across `drivers` and `DriverPay`; truck number is the vehicle key across documented field variants. Never substitute names, Supabase IDs, or `returns.Ninox_ID`; `returns` has no direct CDL/driver key, so report an unresolved driver link unless a related record provides a verified CDL match.
6. Answer with source, normalized filters, exact period, result and row/distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.

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
    "agent_version": "0.6.1",
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

## Approved reports and pitfalls

Agent-key reports are `settlement_summary`, `settlements`, `driver_pay`, `drivers`, `returns`, and `trucks`. Every `AGENT_API_KEY` / `AGENT_API_KEY_<number>` can read all six reports and request their documented sensitive fields with `include_sensitive=true` by default. Only an explicit `AGENT_REPORTS_<n>` allowlist or `AGENT_ALLOW_SENSITIVE_<n>=false` setting restricts a specific key. Use `report=catalog` for the live permission/contract.

- `count`/`page_count` is one page, not the total.
- A successful zero-row page has `total_count=0`; an offset beyond the available range returns HTTP `416`.
- DriverPay and returns can produce two rows per team truck; deduplicate trucks when asked for trucks.
- Departures use `Out Date` only; historical returns use `Return Date` only.
- Settlement weeks run Tuesday through Monday and require an explicit period.
- Settlement Trucks 1/2/3 are Carlos/Jorge/CDT allocation buckets, not physical trucks.
- Stored Gross, Total Expenses, and Net take precedence; do not add included components again.
- `returns.Ninox_ID` is not a driver ID.
- Planned Schedule_Teams and exact Ninox in-yard/on-road metrics are unsupported by these Supabase tables.

## Verification

Confirm the server response contains the requested report, normalized filters, `as_of`, `total_count`, and pagination state. For complete answers, reconcile fetched rows with `total_count`. State whether an empty result means no matching rows under the applied filters or whether upstream freshness/coverage cannot be established.
