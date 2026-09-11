# Mandatory reporting rules for AI agents

These rules govern every Lightning Transportation answer.

## 1. Source and access

- Approved service agents use `agent-reporting`; approved personal members use `reporting-query`.
- Organization scope is server-enforced. Never send or accept a caller-selected `organization_id`.
- Default projections omit sensitive driver and vehicle fields. Request sensitive fields only for an explicit need and authorized key.
- Never seek a bypass when access is denied.

## 2. Dates

- Settlement week is Tuesday `From` through following Monday `To`.
- “Last settlement week” means the latest completed Tuesday–Monday period with the requested financial fields populated.
- Select settlement cycles by explicit period, not `To Report` alone.
- Departures use `DriverPay.Out Date` only; historical returns use `DriverPay.Return Date` only.
- `returns.Return Date` is a nullable PostgreSQL date. Null means no date stored, not a free-text status.

## 3. Grain, counting, and joins

- `trucks` is current state and includes synthetic allocation rows 1/2/3.
- `settlements` is one truck-or-bucket/week row.
- `DriverPay` and `returns` can have two driver rows per team truck. Deduplicate truck identifiers for truck counts.
- Normalize DriverPay text driver IDs to numeric `drivers.Ninox_ID`; never join `returns.Ninox_ID` to drivers.
- Use left joins from historical data to current trucks.

## 4. Financial controls

- Use stored `Gross`; `tonu` is an additional/Compass income component already included in it.
- Use stored `Total Expenses`; do not add expense components or driver pay again.
- Use stored `Net`. Treat `Gross_with_%_deduction_All − Total Expenses` as the intended formula, not a universal replacement for stored Net.
- Attribute historical owner/dispatch from settlements, not current trucks.
- Truck 1=Carlos, 2=Jorge, 3=CDT allocation buckets. Include them in owner general settlement totals and exclude them from physical-fleet metrics.

## 5. Pagination and completeness

- `count`/`page_count` is the current page. Use `total_count` and follow `next_offset` until `has_more=false` for complete answers.
- A successful empty page has `total_count = 0`; an offset beyond the available range returns HTTP 416.
- An empty result is not proof of current upstream completeness because source-sync timestamps are unavailable.

## 6. Answer evidence

Every answer states source, normalized filters, exact period, result, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.
