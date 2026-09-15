# Mandatory reporting rules for AI agents

These rules govern every Lightning Transportation answer.

## 1. Source and access

- Approved service agents use `agent-reporting`; approved personal members use `reporting-query`.
- This is a single-organization reporting system. Never introduce tenant filters or organization-scoping fields without an approved schema and access-model change.
- Default projections omit sensitive driver and vehicle fields. Use `include_sensitive=true` only for an explicit need. All agent API keys are allowed by default; a matching `AGENT_ALLOW_SENSITIVE_<n>=false` setting is the opt-out restriction.
- Never seek a bypass when access is denied.

## 2. Dates

- Settlement week is Tuesday `From` through following Monday `To`.
- “Last settlement week” means the latest completed Tuesday–Monday period with the requested financial fields populated.
- Select settlement cycles by explicit period, not `To Report` alone.
- HTML reports and analytical settlement/fleet-history answers (trends, rankings) must load at least three calendar months ending today or at the user-named end date. The live settlement dashboard loads at least twelve calendar months of `settlements`. The named week or day is UI focus, not the sole query window. See `docs/html-reporting.md`.
- Departures use `DriverPay.Out Date` only; historical returns use `DriverPay.Return Date` only.
- A current-week “how many trucks are leaving” total is a union, not a single-source count: use distinct DriverPay trucks whose `Out Date` is in the Monday–Sunday window plus distinct live Ninox Schedule_Teams trucks whose `Out Date` is in that same window, then deduplicate by truck number. State source totals, overlap, source-only counts, and the union total.
- `returns.Return Date` is a nullable PostgreSQL date. Null means no date stored, not a free-text status.

## 3. Grain, counting, and joins

- `trucks` is current state. The settlement-only 1/2/3 allocation-bucket rule must not be applied to this table.
- `settlements` is one truck-or-bucket/week row.
- `DriverPay` and `returns` can have two driver rows per team truck. Deduplicate truck identifiers for truck counts.
- Schedule_Teams is a volatile planned-departure source, not a replacement for DriverPay history. Its live JSON must be fetched immediately before a current-week departure-union report.
- `fuel` is one historic transaction per row. Do not count rows as trucks or use transaction subtotals as a replacement for weekly settlement totals.
- When an attribute needed for a report is missing from the primary record, perform an approved-report relational fallback before finalizing: use CDL as the unique driver key across `drivers` and `DriverPay`, and use truck number across documented vehicle-field variants (for example, `truck_number`, `Truck_Number`, `Truck`, `truck_no`, and `unit_number`). Normalize only the key's documented type/format; do not alter its business value.
- Use left joins from historical data to current `trucks`. A missing current-master match does not invalidate history.
- Never substitute a driver or vehicle name, a Supabase `ID`, or `returns.Ninox_ID` for the designated key. `returns.CDL` is a sensitive exact driver key; use it only when it matches a verified CDL in a related approved record.

*Evidence: approved business rule confirmed 2026-09-11; `returns.CDL` physical column verified on 2026-09-11.*

## 4. Financial controls

- Use stored `Gross`; `tonu` is an additional/Compass income component already included in it.
- Use stored `Total Expenses`; do not add expense components or driver pay again.
- Use stored `Net`. Treat `Gross_with_%_deduction_All − Total Expenses` as the intended formula, not a universal replacement for stored Net.
- Attribute historical owner/dispatch from settlements, not current trucks.
- For fuel analysis, use `Adjusted SubTotal` only when it is populated; report nulls rather than silently substituting `SubTotal`. Aggregate price per gallon is applicable spend divided by gallons, not an average of transaction rates.
- Only in `settlements` and settlement-derived reports, Truck 1=Carlos, 2=Jorge, 3=CDT are non-physical owner-expense allocation buckets. Each holds its owner's total `truck_loans` and `Insurance` that are not assigned to a specific physical truck. Include it in that owner's general settlement total, label it as a non-physical owner-expense allocation bucket, and exclude it from physical-truck counts/rankings. Do not apply this rule to `trucks`, DriverPay, or returns.

## 5. Pagination and completeness

- `count`/`page_count` is the current page. Use `total_count` and follow `next_offset` until `has_more=false` for complete answers.
- A successful empty page has `total_count = 0`; an offset beyond the available range returns HTTP 416.
- An empty result is not proof of current upstream completeness because source-sync timestamps are unavailable.

## 6. Answer evidence

Every answer states source, normalized filters, exact period, result, row/distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.

## 7. HTML reports

The settlement dashboard is `apps/reporting-dashboard` (Next.js + real shadcn/ui). Grok Bot and Cursor agents link https://lightning-settlement-dashboard.vercel.app and do not generate one-off HTML replacements. Required sections: slim **Liquidaciones** header, truck focus card under filters, **Resumen** from `settlements`, weekly/monthly review, truck and owner rankings (preview + Ver más for the full physical-truck selection), fuel spend by owner, KPI strip, closed **Datos técnicos** evidence accordion. Owner/equipo uses a shadcn Popover + Command multi-select, not a native multi `<select>`. Historical dispatch uses `settlements.Dispatch`. Do not show Full Week or Other Deductions+Previous. Visible copy is Spanish operational wording; kit evidence stays in the accordion.
