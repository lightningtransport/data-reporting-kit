---
name: itpros-supabase-reporting
description: Answer Lightning reports through the approved reporting APIs.
version: 0.9.8
author: Ibrain Ortega, Hermes Agent
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Supabase, Reporting, Lightning, Transport]
    related_skills: [supabase, agent-reporting-html, reporting-html-shadcn]
---

# Lightning reporting

Read repository `AGENTS.md` first. The canonical shared kit is `https://github.com/lightningtransport/data-reporting-kit`; its approved service-agent endpoint is `https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`. Approved AI service agents use `agent-reporting`; the personal JWT-based `reporting-query` flow remains available only to already-approved Supabase members.

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

1. Read `AGENTS.md`, `docs/agent-rules.md`, `docs/question-routing.md`, `docs/metric-definitions.md`, `docs/data-dictionary.md`, and `docs/html-reporting.md` when building HTML or analytical settlement/fleet history.
2. Call `catalog`, then report metadata when the current schema/rules are not loaded.
3. Choose the smallest report and exact filters. Settlement reports require an explicit period or truck; DriverPay requires truck, driver, `out_from`, or `return_from`; fuel requires `truck_number`, `store_from`, or `ninox_id`. HTML reports and analytical settlement/fleet-history answers must fetch at least three calendar months; the settlement dashboard fetches at least twelve months of `settlements`. The named date is UI focus only.
4. Run the helper and reconcile `fetched_count` with `total_count` when a complete answer is required.
5. Apply grain, date, join, allocation-bucket, stored-value, and sensitive-output rules. When a needed field is absent from the selected record, use approved-report relational fallback before finalizing: CDL is the unique driver key across `drivers` and `DriverPay`; truck number is the vehicle key across documented field variants. Never substitute names, Supabase IDs, or `returns.Ninox_ID`; `returns.CDL` is sensitive and may link a driver only after an exact match to a verified CDL in approved related data; otherwise report an unresolved driver link.
6. For a current-week “how many trucks are leaving” report, query `driver_pay` by the Monday–Sunday `out_from`/`out_to` range and fetch live Ninox Schedule_Teams from `https://lightningtransport.ninoxdb.com/share/p10ce94o8paa2q4a1z4nw0emznn2ubhriza6?locale=en&utcoffset=-240`. Filter its `Out Date` to the same range, validate it is a JSON array, normalize only truck-key format, and union distinct DriverPay `Truck_Number` with Schedule_Teams `Truck`. Do not substitute either source for the other or double-count overlapping trucks.
7. For every returning-trucks question/report, query both `driver_pay` and `returns` with the same inclusive `return_from`/`return_to` period. Exclude DriverPay rows where `Termination = Driver Changed` or `Transfer = Transfer To Other Truck`; let `tc` be remaining rows with `Solo_Driver_if_1 != 1` and `ts` remaining rows with `Solo_Driver_if_1 = 1`; calculate `floor(tc / 2 + ts)`. Union distinct qualifying DriverPay `Truck_Number` with distinct `returns.Truck`, normalizing only truck-key format. Report both-source, source-only, overlap, final union, `tc`, `ts`, and whether the formula agrees with distinct qualifying DriverPay trucks. Never use either source alone.
   For return-period dispatcher/owner questions, use `returns` with the same inclusive date frame plus exact, case-sensitive `dispatcher` (`Dispatcher`) or `owner` (`Owner`) on stored return rows. Paginate, then count distinct numeric `Truck`, not driver rows; do not substitute current `trucks` or settlement `shared_owner`. This filtered Returns attribution does not automatically apply to DriverPay-only trucks in the two-source union; disclose that limitation and retain separate reconciliation for total returns.
8. Answer with source, normalized filters, exact period, result and row/distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats. For the current-week departure union, include both-source, DriverPay-only, Schedule_Teams-only, and union counts.

## HTML reports

The reporting dashboard is [`apps/reporting-dashboard`](../../apps/reporting-dashboard) (Next.js + real shadcn/ui). Grok Bot and Cursor agents **link** the matching live URL and keep that app in sync from this repository. Do not generate a one-off HTML replacement or a native `<select multiple>` for Owner/team.

- Settlements: https://lightning-settlement-dashboard.vercel.app
- Out Schedule: https://lightning-settlement-dashboard.vercel.app/out-schedule
- Trucks Return: https://lightning-settlement-dashboard.vercel.app/trucks-return
- Diesel: https://lightning-settlement-dashboard.vercel.app/diesel

When the user asks to see Out Schedule, Trucks Return, or Diesel (planned departures / expected returns / fuel UI), **link that URL**. Do not generate one-off HTML.

Sibling skills: [`agent-reporting-html`](../agent-reporting-html/SKILL.md) and [`reporting-html-shadcn`](../reporting-html-shadcn/SKILL.md). Copy [`../reporting-html-shadcn/assets/report-ui.css`](../reporting-html-shadcn/assets/report-ui.css) only for other static reports (local skill-cache fallback: `$HERMES_HOME/cache/data-reporting-kit/skills/reporting-html-shadcn/assets/report-ui.css`). Do not invent one-off styles.

Every Settlements view must include the slim **Settlements** header, truck focus card under filters, **Summary**, weekly/monthly review modes, truck and owner rankings with Show all for the full physical selection, fuel spend by owner, a KPI strip, a closed **Technical details** evidence accordion, and the shared light minimal theme. Visible copy is English. Do not show Full Week or Other Deductions+Previous. Out Schedule, Trucks Return, and Diesel share the same shell and fixed **Tabs** navigation. Write other static candidates in the agent's workspace (`reports/candidates/`), not in this knowledge repository.

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

Agent-key reports are `settlement_summary`, `settlements`, `driver_pay`, `drivers`, `returns`, `trucks`, and `fuel`. Every `AGENT_API_KEY` / `AGENT_API_KEY_<number>` can read all seven reports and request their documented sensitive fields with `include_sensitive=true` by default. Only an explicit `AGENT_REPORTS_<n>` allowlist or `AGENT_ALLOW_SENSITIVE_<n>=false` setting restricts a specific key. Use `report=catalog` for the live permission/contract.

- `count`/`page_count` is one page, not the total.
- A successful zero-row page has `total_count=0`; an offset beyond the available range returns HTTP `416`.
- DriverPay and returns can produce two rows per team truck. For any returning-trucks request, apply the exclusion/formula rule and deduplicate the required two-source union; never answer from one source alone.
- Departures use `Out Date` only. Returns use the same inclusive `Return Date` range on both `driver_pay` and `returns`.
- For “how many trucks are leaving” in a current week, DriverPay and live Schedule_Teams are both required. Deduplicate their same-window truck union and disclose reconciliation counts.
- Settlement weeks run Tuesday through Monday and require an explicit period.
- For `settlement_summary`, `settlements`, and `fuel`, an `owner` filter includes rows where either the primary owner or `shared_owner` exactly matches. `shared_owner` is supplemental attribution for trucks operating under `SOLO INC.` or `FLATBED INC.`; preserve both values and do not use it for `trucks`, DriverPay, or returns.
- Only in `settlements` and settlement-derived reports, Trucks 1/2/3 are Carlos/Jorge/CDT non-physical owner-expense allocation buckets. Each holds that owner's total `truck_loans` and `Insurance` amounts not assigned to a specific physical truck; include it in the owner's general settlement total, label it as non-physical, and exclude it from physical-truck counts/rankings. Do not apply this rule to `trucks`, DriverPay, or returns.
- Stored Gross, Total Expenses, and Net take precedence; do not add included components again.
- Fuel is transaction-grain history: filter by `truck_number`, `store_from`, or `ninox_id`; use populated `Adjusted SubTotal` for adjusted-spend totals and calculate aggregate price per gallon as applicable spend divided by gallons.
- `returns.Ninox_ID` is not a driver ID.
- `returns.Truck` is numeric; `returns.Dispatcher` and `returns.Owner` are nullable, non-sensitive truck-dispatch/owner fields on the return row. Use exact `dispatcher` / `owner` filters within `return_from` / `return_to` and distinct `Truck` for return-row attribution. Do not pull current `trucks` for these values.
- Planned Schedule_Teams and exact Ninox in-yard/on-road metrics are unsupported by these Supabase tables.

## Verification

Confirm the server response contains the requested report, normalized filters, `as_of`, `total_count`, and pagination state. For complete answers, reconcile fetched rows with `total_count`. State whether an empty result means no matching rows under the applied filters or whether upstream freshness/coverage cannot be established.
