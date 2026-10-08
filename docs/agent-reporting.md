# `agent-reporting` API guide

`agent-reporting` is the active read-only service-to-service interface for approved AI agents.

## Authentication

```http
GET /functions/v1/agent-reporting?report=catalog&compact=true
x-agent-key: <assigned secret>
```

The key identifies an agent principal. The function is single-organization and authorizes requests by optional report allowlist, expiry, and sensitive-field permission. The function uses an internal Supabase admin credential; callers never receive it.

- `supabase/config.toml` sets `verify_jwt=false` only for this custom-key function and keeps `verify_jwt=true` for `reporting-query`.
- Never expose `x-agent-key` in browser/frontend code.
- Missing, expired, or invalid keys return `401`.
- A valid key whose explicit per-key report allowlist excludes a report, or whose matching `AGENT_ALLOW_SENSITIVE...` control is set to `false`, returns `403`. All `AGENT_API_KEY` / `AGENT_API_KEY_<number>` principals otherwise have full read access to approved reports and their explicit sensitive-field allowlists; confirm `outside_repairs` appears in the deployed catalog before use.

## Discover before querying

- `?report=catalog` returns all reports allowed for the key, global parameters, response semantics, business rules, and examples.
- `?report=catalog&compact=true` is optional lightweight discovery: identical permissions, global guardrails and response semantics, but report entries contain only source, grain, exact filters, required anchor (when applicable), and a metadata URL. `metadata_required=true` means load the selected report metadata before unfamiliar field/calculation use. `compact=false` or omission returns the unchanged full catalog; compact is rejected on data/metadata requests.
- `?report=<report>&metadata=true` returns exact physical fields, types, nullability, sensitive flags, Ninox mappings, filters, grain, joins, and calculations.

### Client defaults and output safety

The canonical ChatGPT MCP `catalog({})` and `ReportingService.catalog()` default
to `compact=true`; explicit `compact=false` requests the full catalog. The HTTP
API and plain portable-helper `catalog` retain their full defaults; prefer helper
`catalog --compact`, then selected `metadata`, for discovery.

Hermes wrappers exposing `get_reporting_catalog({})` must request compact at the
HTTP layer **before** the reporting-output size guard. A full response cannot be
summarized after a guard that has already rejected it. Do not disable or raise
output limits, truncate global rules, or bypass permissions. Full opt-in may still
exceed the host guard. This client-only change does not alter the Supabase
function/schema or automatically upgrade an installed wrapper; reload and verify
that wrapper separately. Selected metadata remains required before unfamiliar
fields, filters or calculations.

Supported data reports in this specification: `settlement_summary`, `settlements`, `driver_pay`, `drivers`, `returns`, `trucks`, `fuel`, `outside_repairs`, `out_schedule`, and `departures`. The live authenticated catalog is authoritative for deployed availability.

## Strict request behavior

Explicit reports reject:

- unknown or duplicate parameters;
- impossible dates and reversed ranges;
- invalid numbers, booleans, limits, and offsets;
- blank filter values, nonnumeric numeric identifiers, and `temporal_driver` values other than `Yes` or `No`;
- missing required history/financial anchors;
- fuel queries without `truck_number`, `store_from`, or `ninox_id`;
- outside-repair queries without `truck`, `trailer`, `date_from`, or `ninox_id`, or with `choice` other than `Truck`/`Trailer` or `ahs` other than `Yes`/`No`;

- unauthorized `include_sensitive=true` for a key explicitly restricted by `AGENT_ALLOW_SENSITIVE_<n>=false`.

Global data parameters are `report`, `limit` (1–1000), `offset` (0–100000), and `include_sensitive` (`true`/`false`). Metadata requests accept only `report` and `metadata=true`.

For `settlement_summary`, `settlements`, and `fuel`, an exact `owner` filter matches either the historical primary owner or `shared_owner`. `shared_owner` is supplemental attribution for a truck operated under `SOLO INC.` or `FLATBED INC.` and must be returned/disclosed alongside—not substituted for—the primary owner.

For `returns`, `owner` and `dispatcher` instead match the physical `Owner` and `Dispatcher` fields on each Returns row exactly (case-sensitive). Use inclusive `return_from` / `return_to` for the return-date frame; the API returns driver rows, so count distinct numeric `Truck` across all pages for a truck total. `shared_owner` and current `trucks` attribution do not apply. A filtered Returns count is not automatically a filtered two-source union count; retain the separate DriverPay reconciliation for total-return questions.

For `outside_repairs`, request `report=outside_repairs` with at least one anchor (`truck`, `trailer`, `date_from`, `ninox_id`); optional filters are `date_to`, `company`, `choice`, `type_of_work`, `ahs`, `owner`, and `exceptions`. `truck`/`ninox_id` are numeric identifiers; `trailer`, `company`, `owner`, and `exceptions` use stored text. `choice` is exactly `Truck` or `Trailer`; `ahs` is exactly `Yes` or `No`, with `No` including blank/null `AHS`. `type_of_work` accepts one complete category (at most 100 characters, no comma) and matches case-insensitively within comma-separated categories after trimming surrounding spaces, rather than matching the entire stored list. Date bounds are inclusive on service `Date`, not `created_at`. Responses project all 14 physical fields without sensitive opt-in. Pagination and authorization follow the standard explicit-report contract. Costs/owner/category attribution follow `docs/metric-definitions.md`; no GET filter on raw sensitive data is added.

**Current on-road / working trucks (owner-approved 2026-10-08):** fetch `https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240` immediately before each answer, credential-free; follow [live on-road contract](on-road-trucks.md). This primary most-current source answers current/now/today operational status. Fully validate all seven keys and exact `Status=On The Road Working` within 30 seconds overall and 2 MiB; count distinct `truck_number`, use exact source owner/dispatcher/insurance, and state fetch-start/completion timestamps. Failure means unknown/null, never zero; no cached/DriverPay fallback, GPS movement claim or fleet/off-duty complement. Historical or explicit-date assignment overlap alone uses fully paginated `driver_pay?on_road_at=D` (Out Date <= D, Return Date > D; null returns and return day excluded).

Returning-trucks questions/reports require two complete requests with the same inclusive `return_from`/`return_to`: `driver_pay` and `returns`. Exclude DriverPay rows whose `Termination` is `Driver Changed` or whose `Transfer` is `Transfer To Other Truck`. Let `tc` be the remaining non-solo rows and `ts` the remaining solo rows; the DriverPay formula count is `floor(tc / 2 + ts)`. Union distinct qualifying `Truck_Number` values with distinct `returns.Truck` values, normalize only truck-key format, and deduplicate. The API returns source rows; the caller performs this governed reconciliation and reports source/overlap/source-only/union counts plus formula-vs-distinct agreement.

## Prepared departure reports — schema 3.8.0

`out_schedule` returns the live planned Schedule_Teams list; `departures` reconciles distinct DriverPay and Schedule_Teams trucks for the same inclusive `Out Date` frame. Never use one source alone, add counts, count assignment rows, or apply return exclusions/formula. Both `out_from` and `out_to` are optional but must be supplied together (valid ordered dates, maximum 31 inclusive days); omitting both selects Monday–Sunday in America/New_York. See [departure contract and client rollout](departures.md).

The aggregate retains `reconciliation` (source counts, source-only counts, overlap, combined distinct total), `truck_sets`, `period`, `status`, and `complete`. Any source failure makes the combined total null and `complete=false`/`status=incomplete`; ending pagination does not repair source failure. Confirm the deployed catalog and installed client before use: repository support is prepared, **not integrated** in existing installed eight-report MCP/cached-helper clients until verified.

## Approved direct off-duty source (not a report name)

Current in-yard/off-duty/not-working questions use the credential-free [live Ninox source contract](off-duty-trucks.md), downloaded immediately before reporting with complete bounded JSON validation. Every row is off duty/not on road regardless of Ready To Go or Outside/vendor location; general yard synonyms use the full feed, physical location only if explicitly requested. Count distinct `truck_number` with exact source owner/dispatcher and retrieval timestamp evidence. This is a current snapshot, not history or a fleet complement; failure is unknown, not zero. Do not send this share an agent key, invent a report name, or claim a dedicated MCP/fast-path implementation. The legacy insurance-choice formula remains unsupported and separate.

## Pagination and evidence

Explicit data responses include:

```json
{
  "report": "trucks",
  "filters": {"physical_only": "true"},
  "offset": 0,
  "limit": 100,
  "count": 100,
  "page_count": 100,
  "total_count": 166,
  "has_more": true,
  "next_offset": 100,
  "as_of": "...",
  "source_freshness": "unknown: source tables do not expose a sync timestamp",
  "data": []
}
```

`count` is a compatibility alias for `page_count`, not the full total. Follow `next_offset` until `has_more=false` when all rows are required. A successful zero-row page has `total_count=0`; an offset beyond the available range returns HTTP `416`. If the upstream exact count is absent, the API returns `500` rather than substituting the page count.

The packaged helper requests 1000 rows per page for full stable-ID collection unless an explicit `limit` is supplied. `--one-page` retains the API default of 100; direct API requests also retain their default of 100. Exact-count drift, duplicate identity, cursor, normalized-filter and complete-fetch reconciliation checks remain mandatory. Out Schedule remains one live bounded snapshot, and departure source completeness is not replaced by pagination completeness.

## Legacy compatibility

A request that omits `report` remains the legacy `settlement_summary` call only when the key allows `settlement_summary`, and preserves its exact successful top-level response shape:

```json
{"count": 0, "data": []}
```

New agents must always send an explicit report and use the strict/paginated contract.

## Audit and access

Each authorized data request records request ID, configured principal role in `role`, agent-key identifier and principal role as distinct JSON fields, applied filters, `include_sensitive`, limit, offset, row count, outcome, and time in `public.agent_query_audit`. The key value is never stored. Authorized data is returned only after the audit insert succeeds; audit failure returns `500`. Upstream query failures are sanitized to `500` responses.
