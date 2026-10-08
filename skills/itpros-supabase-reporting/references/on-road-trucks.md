# Live on-road / working trucks — owner-approved Ninox source

## Approval and source selection

**Evidence:** business-owner instruction approved 2026-10-08; credential-free HTTP 200 `application/json`, no redirects, complete JSON array and seven-key row schema verified live 2026-10-08 at 15:09:09Z. No observed count is a durable fact.

Exact approved URL (preserve all query parameters):

`https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240`

For **current**, **now**, or **today** questions about trucks on the road, on-road trucks, trucks working, or trucks currently working, this is the primary **most current** operational source. Fetch it immediately before every answer, even when DriverPay or truck-master rows have already been retrieved. Source membership with exact `Status = On The Road Working` defines working/on-road state. It is **not GPS evidence of movement**, driving speed, location, utilization or miles. Do not infer movement from Samsara IDs.

This is an approved credential-free direct external source, not a new Supabase table, `agent-reporting` report name, dedicated MCP report or gateway request. Use a bounded HTTP tool; if the host cannot fetch it, disclose unavailable evidence. The packaged Jev `ask` current on-road route is disabled until it has a deterministic live-source transport: its fallback has no answer/total and must continue through this direct route, never DriverPay.

## Fresh bounded retrieval and full validation

1. Download the exact URL **immediately before each answer**; no cached or prior snapshot, conditional reuse, saved business rows, or fallback. Send only `Accept: application/json`, no credentials: no `x-agent-key`, Authorization, cookies, Supabase key or employee session. Reject redirects and non-2xx status. Enforce a **30-second overall deadline** (connection, headers, complete body, decode, parse and validation) and **2 MiB** response-body bound; detect overflow before accepting a body. Cancel stalled/oversized reads. Reject missing/non-JSON content type, HTML/login content, decode errors, truncated output or body, invalid JSON, duplicate object keys (including escaped equivalents), and non-finite numbers. A rendered page or tool preview is not the complete array.
2. Require a top-level array of objects and validate **every row before filtering or counting**. Require exactly the seven keys and accepted types below. Missing/extra keys, invalid values or a changed status are schema drift, not rows to silently omit. One fully retrieved array is the snapshot; no pagination, cursor, cross-fetch union or persistent row-identity contract is established.
3. Count distinct valid nonblank `truck_number`, not rows, `Ninox_ID` or Samsara IDs. Retain original row count and duplicate-truck count. Disclose conflicting attributes for repeated truck numbers; never arbitrarily assign a conflicting truck to an owner/dispatcher. Use the source's **exact case-sensitive** `owner`, `dispatcher`, and `insurance` strings for requested filters and grouping. No current-master substitution, settlement `shared_owner` expansion or guessed blank attribution. Apply only requested filters after validating the complete array; keep unfiltered and filtered row/distinct evidence separate.

### Seven exact keys

| Key | Required accepted value | Handling |
|---|---|---|
| `truck_number` | Positive finite integral JSON number, not boolean | Canonical distinct-truck key; reject blank/null/string keys. |
| `dispatcher` | String | Exact source dispatcher; blank is unresolved, not guessed. |
| `insurance` | String | Literal source label, not numeric insurance-choice logic. |
| `owner` | String | Exact source owner; no shared-owner expansion. |
| `Samsara_Truck_ID` | String | Secondary identifier; minimize disclosure, never count/join by it instead of truck number. |
| `Status` | String exactly `On The Road Working` | Current membership rule; not GPS movement. |
| `Ninox_ID` | Positive finite integral JSON number, not boolean | Source-record ID, not truck identity or pagination identity. |

The verified schema has no established nullable-field contract. Reject null/type drift pending verification; blank descriptive strings remain unresolved attribution, not invented values. JavaScript clients reject unsafe integers to avoid lossy identity conversion.

## Historical assignment overlap is a separate metric

Retain `driver_pay?on_road_at=YYYY-MM-DD` **only for historical or explicit-date assignment overlap**. Count distinct nonblank `Truck_Number` with `Out Date <= D` and `Return Date > D`, excluding null returns and the return day, after complete pagination. No lookback cutoff, return-union, transfer/termination exclusions or `return_null` shortcut. Preserve historical row owner/dispatch. Label it **dated DriverPay assignment overlap**, not most-current working status. An explicit calendar date asks for this dated metric (even if it happens to equal today's date); explicit current-status wording still asks for the live snapshot. Explain the distinction if both are requested.

Today's share cannot reconstruct a past status or future state. Never use DriverPay as a current-source failure fallback. The independent [off-duty contract](off-duty-trucks.md) remains a separate feed: neither list is a verified exhaustive fleet partition. Never compute working trucks as fleet minus off-duty, off-duty as fleet minus working, or infer the opposite state from absence. Disclose conflicting source evidence rather than silently reconciling different snapshots/definitions. The legacy Ninox insurance-choice formula remains unsupported and is not reconstructed by this share.

## Evidence and failure semantics

State exact source URL, fetch-start and fetch-completion timestamps with timezone, `as_of` (retrieval completion), current-snapshot scope, requested exact filters, original row count, distinct count, duplicate/conflict handling, and complete body/schema validation under the byte/time bounds. Fetch time is **not upstream synchronization time**; the feed provides no reliable source-updated timestamp.

Any network, deadline, size, status, content-type, decode, JSON or row/schema failure means unavailable/incomplete evidence and **unknown/null count, never zero**. Do not substitute partial rows, stale cache, DriverPay, truck-master status, Schedule_Teams, off-duty complement, insurance or GPS. A successfully fetched and fully validated empty array means **zero** trucks in that retrieved current source snapshot only, not historical/global absence proof.
