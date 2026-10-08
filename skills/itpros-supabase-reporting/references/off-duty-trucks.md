# Live off-duty trucks — owner-approved Ninox source

## Approval and routing

**Evidence:** business-owner rule approved 2026-10-07; credential-free HTTP 200 JSON array and the nine-field row shape verified live on 2026-10-07. Every truck in this source is **not working, off duty, and not on the road**, including `Ready To Go` trucks and trucks at `Outside ` or vendor locations. The source's membership—not insurance, dispatcher, mechanic status, or physical location—defines this current operational list.

Exact approved source URL (preserve query parameters):

`https://lightningtransport.ninoxdb.com/share/jx7z6tkjcnxalvsui4icdnqjuszia04etdhi?locale=en&utcoffset=-240`

Route current “trucks in yard”, “off duty”, and “not working” questions to an immediate fresh fetch of this source. General yard synonyms mean the **full feed**; do not silently restrict to `301 Yard`. Apply a physical `yard_location` filter only when the user explicitly asks for physical location (for example, “physically at 301 Yard”). Such a subset is not the general off-duty total. Preserve raw location text; if trimming for an explicitly requested location comparison, disclose that normalization (`Outside ` has a trailing space).

This is an approved direct external source route, like the manual Schedule_Teams source, **not** a new `agent-reporting` report name, SQL query, Supabase table, dedicated MCP report, or Jev fast-path capability. Do not wait for an agent-key permission or fabricate an MCP tool for this credential-free share. Use an available bounded HTTP retrieval tool; if the client cannot fetch it, disclose that limitation.

The legacy Ninox **insurance-choice formula** remains unsupported: Supabase lacks `days_in_yard_` and numeric insurance-choice fields. The feed's literal `insurance` label and `Days In Yard` duration do not implement or reconstruct that formula. This limitation must never be used to refuse the newly approved current list.

## Fresh bounded retrieval and complete validation

1. Download the exact URL **immediately before each answer**; never reuse prior business rows or a cached snapshot. Send `Accept: application/json` without `x-agent-key`, Authorization, cookies, employee sessions, or other credentials. Keep a maximum 30-second overall deadline and 2 MiB response-body bound; read one extra byte to detect overflow. Reject redirects, non-2xx responses, non-JSON media types, timeouts, oversized or truncated bodies. Do not use a rendered page, preview excerpt, or truncated tool output as the complete feed.
2. Decode and parse the entire bounded body as strict JSON, rejecting duplicate object keys and non-finite numeric constants. Require a top-level array; inspect **every** row before filtering or counting. Reject an object envelope, HTML/login page, non-object row, missing required key, invalid field type, blank/invalid truck key, or schema drift. There is no documented pagination contract: one fully read array is the snapshot. Never invent cursors, persistent row IDs, or combine separate fetches into one snapshot.
3. Validate the nine keys and types below. Extra or changed keys require fresh schema verification before claiming a complete validated result; never silently drop malformed rows. Null descriptive values mean unknown, not an inferred status or owner. Record validation result, original row count, distinct truck count, and duplicate-truck/conflicting-attribute evidence. Identical truck numbers count once; conflicting rows must be disclosed and must not be arbitrarily assigned to an owner/dispatcher.
4. Apply only user-requested filters after full validation. Count distinct nonblank valid `truck_number` values, not rows, `Ninox_ID`, or Samsara IDs. Use source `owner` and `dispatcher` exactly (case-sensitive) for filters and attribution; do not replace them with current Supabase master values or expand settlement `shared_owner`. Preserve unresolved/blank attribution separately rather than guessing.
5. Use a calculation tool for arithmetic. `Days In Yard` is a duration in **milliseconds**: `days_in_yard = row["Days In Yard"] / 86400000`. Do not interpret it as an epoch/date or an already-converted number of days. Preserve fractional days; null means unknown. Do not infer a historical arrival date from it without a separately verified contract.

### Observed row schema

All nine exact keys must be present. The live verification observed populated values of the types below; nullable descriptive/duration/secondary-ID values may be accepted as unknown, never as zero or invented data. No upstream nullability guarantee is established.

| Exact key | Accepted value | Meaning / handling |
|---|---|---|
| `truck_number` | Positive finite integral JSON number, not boolean | Canonical truck identity; mandatory nonblank distinct-count key. Do not substitute secondary IDs. |
| `dispatcher` | String or null | Exact source dispatch/group label; null/blank attribution is unknown. |
| `insurance` | String or null | Literal provider/category label, not numeric insurance-choice evidence. |
| `owner` | String or null | Exact source owner/entity; no shared-owner expansion. |
| `yard_location` | String or null | Literal yard/outside/vendor location; not an off-duty exclusion. |
| `Samsara_Truck_ID` | String or null | Secondary vehicle identifier; minimize disclosure, not a count key. |
| `mechanic_status` | String or null | Literal shop status; even `Ready To Go` remains off duty by membership. |
| `Days In Yard` | Nonnegative finite JSON number or null, not boolean | Millisecond duration; divide by 86400000 with a tool. |
| `Ninox_ID` | Positive finite integral JSON number or null, not boolean | Source-record identifier, not a truck identity or pagination contract. |

## Current snapshot, not history or a fleet complement

This source answers current state at retrieval time, **not historical off-duty state**. A named past date cannot be reconstructed from today's feed. Do not manufacture a dated historical count, infer transitions from duration, or present yesterday's saved list as live.

Every included truck is not on the road under the owner-approved rule. The converse is **not** established: absence does not prove a truck is on the road, working, missing, or outside the fleet. Never compute on-road trucks as fleet minus this feed, or use this feed's complement as absence proof. Current working/on-road membership uses the independent [live on-road feed](on-road-trucks.md), never this feed's complement. The separate **historical or explicit-date assignment-overlap** metric remains `driver_pay?on_road_at=YYYY-MM-DD` (distinct trucks with `Out Date <= D` and `Return Date > D`, excluding null returns and return day). Disclose conflicting source evidence rather than silently combining the definitions.

## Answer evidence and failures

State the exact source URL, fetch-start and fetch-completion timestamps with timezone (UTC is suitable), current-snapshot scope, full-body/array validation and byte-bound status, original row and distinct-truck counts, requested filters, duplicate/conflict handling, and any duration conversion. Fetch timestamps are retrieval evidence, **not an upstream synchronization timestamp**; the feed exposes no reliable upstream-sync timestamp. Do not claim stronger source freshness or completeness beyond the successfully retrieved validated array.

A network, deadline, size, decode, HTTP, content-type, schema, or row-validation failure means **source unavailable/incomplete**, with result/count unknown or null—**not zero**. Do not silently substitute `trucks.dispatcher = Out Of Services`, mechanic status, insurance-choice logic, DriverPay history, a prior snapshot, or a partial array. A successfully fetched and completely validated empty array means zero trucks in this current source snapshot only, not proof of no off-duty trucks anywhere or historical absence.
