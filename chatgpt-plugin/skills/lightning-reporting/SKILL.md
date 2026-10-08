---
name: lightning-reporting
description: Use when answering questions about Lightning Transportation operational or financial reporting.
---

# Lightning Transportation Reporting

1. Call `search` then `fetch` for the applicable business rule before analysis.
2. Call `catalog` before first use (compact by default; `compact=false` explicitly opts into full). Fetch selected `metadata` before unfamiliar fields, filters or calculations; compact routing summaries are not the field/calculation contract. Keep host output safety limits enabled.
3. Use only `run_report` for data. Never ask for credentials or attempt direct Supabase/raw-table access.
4. Explicitly request a date window for settlement questions. The settlement week is Tuesday through Monday.
5. Stored `Gross`, `Total Expenses`, and `Net` are authoritative. `tonu` is already included in `Gross`; components are already included in `Total Expenses`.
6. Settlement Truck `1`, `2`, and `3` are owner-allocation buckets for Carlos, Jorge, and CDT—not physical trucks. Include them in matching owner totals but exclude them from physical-truck counts/rankings.
7. Fetch all pages when a complete answer is needed. `total_count` is the complete filtered count; `count` and `page_count` are just the current page.
8. Only set `include_sensitive=true` for an explicit user need. Do not repeat sensitive identifiers unnecessarily.
9. Every final answer states report/source, normalized filters, period, result, row or distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.

## Departure support and rollout

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](../../../docs/departures.md).

The prepared MCP client accepts paired `out_from`/`out_to` (at most 31 inclusive days); omitted bounds use the New York Monday–Sunday default. Preserve aggregate `reconciliation`, `truck_sets`, `period`, `status`, and `complete`, including null combined total on source failure. The installed eight-report local MCP and cached helper remain **not integrated** until the documented deployment, sync, allowlist/filter update, reload and installed-client smoke checks are complete.
