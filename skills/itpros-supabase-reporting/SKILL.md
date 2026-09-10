---
name: itpros-supabase-reporting
description: Answer Lightning reports through the approved reporting API.
version: 0.1.0
author: Ibrain Ortega, Hermes Agent
license: Proprietary
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Supabase, Reporting, Lightning, Transport]
    related_skills: [supabase]
---

# Lightning reporting

Answer Lightning Transportation data questions with the authenticated `reporting-query` Edge Function. Use only the caller's personal Supabase Auth session; never use a service-role key, database password, or another employee's token.

## When to Use

- Requests about fleet status, returns, driver assignment history, or settlement summaries.
- Do not use for writes, provisioning, schema changes, or direct access to protected driver PII.

## Procedure

1. Read `docs/question-routing.md` and `docs/data-dictionary.md` from the Data Reporting Kit repository. Completion: the report type, filters, period, and metric are unambiguous.
2. Call `POST /functions/v1/reporting-query` with a personal bearer JWT and an allowlisted report name. Completion: a response returns `data`, `row_count`, and `as_of`.
3. Validate date windows, type conversions, and driver/truck cardinality according to the routing guide. Completion: the result uses the stated business definition.
4. Respond with the source report, filters, exact period, result, freshness, and material caveats. Completion: no raw PII or secret appears in the response.

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
