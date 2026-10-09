---
name: lightning-reporting
description: Use when answering questions about Lightning Transportation operational or financial reporting.
---

# Lightning Transportation Reporting

## Current Drivers Insurance — approved direct source

For Drivers Insurance, insured-driver lists/counts, drivers with/under insurance, driver-insurance breakdowns or an individual's current insurance, fetch `https://lightningtransport.ninoxdb.com/share/x9f4rn221pibyhx3lwup2f8otfzfy8kijpk2?locale=en&utcoffset=-240` immediately before each answer, credential-free. Follow [live driver-insurance contract](../../../docs/drivers-insurance.md). Validate the complete array within 30 seconds overall and 2 MiB; default to all rows and exact Insurance labels, not a hard-coded insurer. The approved native/client `query_drivers_insurance` returns all required and optional Ninox keys when present in chat and Excel; omit absent keys and never invent values. The full public field set is `First Name`, `Last Name`, `Insurance`, `CDL Number`, `Gender`, `DOB`, `State`, `Hire of Date`, and `Years_of_Experience`. Treat DOB/CDL as sensitive; avoid unnecessary repetition outside the requested roster output. Preserve missing-CDL rows, disclose roster entries versus verified distinct CDL identity/duplicates, and never deduplicate by name. Failure is unknown/null, not zero; no cached/Supabase fallback. Current roster only: no historical coverage, premiums, policy validity or uninsured complement. This is direct-source guidance, not a new gateway/MCP report or Jev route.

1. Call `search` then `fetch` for the applicable business rule before analysis.
2. Call `catalog` before first use (compact by default; `compact=false` explicitly opts into full). Fetch selected `metadata` before unfamiliar fields, filters or calculations; compact routing summaries are not the field/calculation contract. Keep host output safety limits enabled.
3. Use `run_report` for gateway data. The explicit exception is approved credential-free direct external shares: current on-road/working trucks use `docs/on-road-trucks.md`; current yard/off-duty/not-working trucks use `docs/off-duty-trucks.md`; current Drivers Insurance and insured-driver lists use `docs/drivers-insurance.md`. Search/fetch those rules and immediately download the exact share with bounded complete validation using the host HTTP capability. This MCP exposes guidance, not a dedicated share report; if the host cannot fetch it, disclose unavailable evidence, never DriverPay/stale-cache/complement fallback. DriverPay `on_road_at` is historical/explicit-date assignment overlap only. Never ask for credentials or attempt direct Supabase/raw-table access.
4. Explicitly request a date window for settlement questions. The settlement week is Tuesday through Monday.
5. Stored `Gross`, `Total Expenses`, and `Net` are authoritative. `tonu` is already included in `Gross`; components are already included in `Total Expenses`.
6. Settlement Truck `1`, `2`, and `3` are owner-allocation buckets for Carlos, Jorge, and CDT—not physical trucks. Include them in matching owner totals but exclude them from physical-truck counts/rankings.
7. Fetch all pages when a complete answer is needed. `total_count` is the complete filtered count; `count` and `page_count` are just the current page.
8. Only set `include_sensitive=true` for an explicit user need. Do not repeat sensitive identifiers unnecessarily.
9. Every final answer states report/source, normalized filters, period, result, row or distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.

## Knowledge document selection

Never invent a document path from a report name or dashboard route. Use only exact
paths advertised by the current knowledge tool (or IDs returned by `search`),
including the `skills/` prefix for packaged skills. Fuel/diesel rules live in
`docs/question-routing.md`, `docs/data-dictionary.md`, and
`docs/metric-definitions.md`; `/diesel` is a dashboard route, not a document.
If a knowledge request is rejected, retry once with an exact approved relevant
path, preserving `offset` and `limit` when the tool supports them. Do not retry the
same rejected path, guess another filename, broaden the allowlist, or bypass the
tool. If the corrected request fails, disclose the unavailable guidance.

## Settlement numeric coverage

Read `docs/metric-definitions.md` and `docs/data-dictionary.md` via search/fetch.
Nullable components are unknown/unpopulated, not automatically zero, including
allocation buckets. Row completeness does not certify numeric coverage. Aggregate
valid populated numeric measures with exact decimal arithmetic; disclose populated/null
counts and partial coverage, and preserve nonempty all-null amounts as null. Missing
requested keys, malformed values, blanks, booleans and nonfinite numbers fail closed.
`From`/`To` are dates and labels/identifiers are not summable amounts. Never reconstruct
stored totals, force component reconciliation, or change the repaired native adapter/model.
Supabase `ID` is not a Ninox record ID; maintenance-side `Ninox_ID` is not an exposed
settlement-report field. Raw source record omission does not prove formula nullness.
Do not infer deployed importer behavior from a fuel importer or an ad-hoc run.
Preserve bucket financial rows, exact historical Owner OR shared_owner, inclusive From
bounds, stable IDs, pagination and audit controls. No production backfill is authorized.

## Provider versus gateway troubleshooting

A primary timeout plus backup generation failure is not proof of a reporting gateway outage.
Inspect actual tool envelopes; use authorized independent reporting checks before
attributing a gateway failure. Without such evidence, describe AI model service
unavailability and disclose unknown deployment/account health. Public status and
unrelated local credentials cannot establish deployed credits/quotas. Do not change
model identity, failover, native adapters/tools/skills or validation to hide failures.
Read [the shared evidence contract](../../../docs/agent-reporting.md#provider-versus-gateway-troubleshooting)
via the advertised search/fetch path. Provider billing/config access belongs to
an authorized operator; never ask users to paste secrets. Keep incident evidence private.

## Departure support and rollout

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](../../../docs/departures.md).

The prepared MCP client accepts paired `out_from`/`out_to` (at most 31 inclusive days); omitted bounds use the New York Monday–Sunday default. Preserve aggregate `reconciliation`, `truck_sets`, `period`, `status`, and `complete`, including null combined total on source failure. The installed eight-report local MCP and cached helper remain **not integrated** until the documented deployment, sync, allowlist/filter update, reload and installed-client smoke checks are complete.
