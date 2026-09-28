# `agent-reporting` API guide

`agent-reporting` is the active read-only service-to-service interface for approved AI agents.

## Authentication

```http
GET /functions/v1/agent-reporting?report=catalog
x-agent-key: <assigned secret>
```

The key identifies an agent principal. The function is single-organization and authorizes requests by optional report allowlist, expiry, and sensitive-field permission. The function uses an internal Supabase admin credential; callers never receive it.

- `supabase/config.toml` sets `verify_jwt=false` only for this custom-key function and keeps `verify_jwt=true` for `reporting-query`.
- Never expose `x-agent-key` in browser/frontend code.
- Missing, expired, or invalid keys return `401`.
- A valid key whose explicit per-key report allowlist excludes a report, or whose matching `AGENT_ALLOW_SENSITIVE...` control is set to `false`, returns `403`. All `AGENT_API_KEY` / `AGENT_API_KEY_<number>` principals otherwise have full read access to approved reports and their explicit sensitive-field allowlists; confirm `outside_repairs` appears in the deployed catalog before use.

## Discover before querying

- `?report=catalog` returns all reports allowed for the key, global parameters, response semantics, business rules, and examples.
- `?report=<report>&metadata=true` returns exact physical fields, types, nullability, sensitive flags, Ninox mappings, filters, grain, joins, and calculations.

Supported data reports in this specification: `settlement_summary`, `settlements`, `driver_pay`, `drivers`, `returns`, `trucks`, `fuel`, and `outside_repairs`. The live authenticated catalog is authoritative for deployed availability.

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

**On-road trucks:** `?report=driver_pay&on_road_at=YYYY-MM-DD` filters `Out Date <= date` and `Return Date > date`. Paginate until complete and count distinct nonblank `Truck_Number` (team rows duplicate trucks); for “now” use the America/New_York date. Null returns and the return day are excluded. Do not use `return_null`, an arbitrary lookback, or the returning-trucks union for this metric.

Returning-trucks questions/reports require two complete requests with the same inclusive `return_from`/`return_to`: `driver_pay` and `returns`. Exclude DriverPay rows whose `Termination` is `Driver Changed` or whose `Transfer` is `Transfer To Other Truck`. Let `tc` be the remaining non-solo rows and `ts` the remaining solo rows; the DriverPay formula count is `floor(tc / 2 + ts)`. Union distinct qualifying `Truck_Number` values with distinct `returns.Truck` values, normalize only truck-key format, and deduplicate. The API returns source rows; the caller performs this governed reconciliation and reports source/overlap/source-only/union counts plus formula-vs-distinct agreement.

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

## Legacy compatibility

A request that omits `report` remains the legacy `settlement_summary` call only when the key allows `settlement_summary`, and preserves its exact successful top-level response shape:

```json
{"count": 0, "data": []}
```

New agents must always send an explicit report and use the strict/paginated contract.

## Audit and access

Each authorized data request records request ID, configured principal role in `role`, agent-key identifier and principal role as distinct JSON fields, applied filters, `include_sensitive`, limit, offset, row count, outcome, and time in `public.agent_query_audit`. The key value is never stored. Authorized data is returned only after the audit insert succeeds; audit failure returns `500`. Upstream query failures are sanitized to `500` responses.
