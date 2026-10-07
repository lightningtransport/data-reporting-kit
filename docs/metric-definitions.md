# Metric definitions

Read `AGENTS.md` and the report metadata before calculating.

## Settlement metrics

| Metric | Definition | Source |
|---|---|---|
| Gross | Stored total settlement gross before percentage and expenses. Do not add `tonu`. | `settlements.Gross` |
| Additional/Compass income | Physical import field `tonu`; related Ninox concept is `Facturado Compass`. It is already included in Gross and must not be interpreted as a tonnage quantity. | `settlements.tonu` |
| Total expenses | Stored full settlement expense total. Do not add category columns or driver pay again. | `settlements.Total Expenses` |
| Net | Stored authoritative net. The intended formula is gross-after-percentage minus total expenses, but verified live rows contain rare exceptions and null-expense cases. | `settlements.Net` |
| Gross after percentage | `Gross × (%AppliedSaved / 100)` for eligible verified rows. Not Gross or Net. | `settlements.Gross_with_%_deduction_All` |
| Driven miles | Period mileage. | `settlements.Driven_miles` |
| Repairs (LTR) | Internal shop invoice expense. | `settlements.LTR Invoices` |
| External / road / outside repairs | Separate external-repair source, not `LTR Invoices`. See external repair metrics below; do not combine with settlement expenses without an explicit reconciliation rule. | `Outside_Repairs.Total Cost` |
| Tolls + PrePass | Sum of stored Tolls and PrePass only. Do not add BestPass into this pair. | `settlements.Tolls` + `settlements.PrePass` |
| Ave. RPM (dashboard) | Physical-truck stored Gross ÷ physical Driven_miles when miles > 0. Derived, not stored. | `settlements` |
| Ave. MPG (dashboard) | Physical Driven_miles ÷ `fuel.Gallons` for Store Dates in the focus settlement week(s). Hide when gallons are missing. Derived. | `settlements` + `fuel` |
| Physical trucks under $11,000 Gross | Count of distinct physical trucks (exclude 1/2/3) whose stored Gross in the selection is below 11000. C-level threshold. | `settlements.Gross` |
| Full Week / No Full Week | Not established. No matching column in `public.settlements`. Do not approximate. | unavailable |
| Other Deductions+Previous | Not established. Not `Otro` and not a YTD reconstruction. Do not approximate. | unavailable |
| Current reporting cycle | Select by an explicit Tuesday `From` period. `To Report` alone is unsafe because historical rows contain `Yes` and newer rows contain `true`. | `settlements.From` |

Settlement periods run Tuesday through Monday. Attribute historical owner/dispatch using the settlement row. For an owner-filtered settlement total, include rows where either `settlements.Owner` or `settlements.shared_owner` exactly matches the requested owner; preserve both values rather than replacing primary `Owner`.

### HTML and analytical history window

For HTML reports and analytical settlement/fleet-history answers, the query window is **at least three calendar months** ending today or at the user-named end date. The live Settlements dashboard query window is **at least twelve calendar months**. The named week or day selects the UI focus, not the only rows to load.

- `history_start` = three calendar months before the end date for non-dashboard HTML; twelve months for Settlements in `apps/reporting-dashboard`.
- Out Schedule and Trucks Return are current operational screens (live Schedule_Teams share and `returns`); they are not multi-month settlement history. When the user asks to see those reports, **link** https://lightning-settlement-dashboard.vercel.app/out-schedule or https://lightning-settlement-dashboard.vercel.app/trucks-return.
- Settlements: `period_from` = Tuesday on or before `history_start`; `period_to` = Tuesday of the latest included week (inclusive bounds on `From`).
- Fuel: `store_from` = `history_start`. Attribute fuel spend by stored `fuel.owner` and, for an owner-filtered total, include rows where `fuel.shared_owner` exactly matches the requested owner. Do not substitute current `trucks.owner`.
- Paginate until `has_more=false` before ranking or totaling.

A single-week headline that is not HTML and not a trend/ranking analysis still uses one explicit Tuesday–Monday period.

*Evidence: HTML reporting convention published 2026-09-15.*

### Owner-allocation buckets

Only in `settlements` and settlement-derived reports, `Truck` 1=Carlos, 2=Jorge, and 3=CDT. These are non-physical owner-expense allocation buckets. Each bucket holds that owner's total `truck_loans` and `Insurance` amounts that are not applied to a specific physical truck.

- Include bucket rows in the respective owner's general settlement totals.
- Exclude them from physical-truck counts and rankings.
- Display them as non-physical owner-expense allocation buckets and state whether they were included.

## Operational metrics

| Metric | Definition | Source |
|---|---|---|
| Fleet count | Distinct `truck_number`; do not use the settlement-only 1/2/3 allocation-bucket rule to filter `trucks`. | `trucks` |
| Trucks leaving | Distinct `Truck_Number` filtered by `Out Date` only. | `DriverPay` |
| Current-week trucks leaving | Union of distinct DriverPay `Truck_Number` and distinct live Ninox Schedule_Teams `Truck` filtered by their respective `Out Date` in the same Monday–Sunday period. Report source counts, overlap, source-only counts, and the deduplicated union. | `DriverPay` + live Schedule_Teams |
| Returning trucks (all questions/reports) | For the same inclusive `Return Date` period, exclude DriverPay rows with `Termination = Driver Changed` or `Transfer = Transfer To Other Truck`. Let `tc` be remaining non-solo rows and `ts` remaining solo rows; DriverPay formula count = `floor(tc / 2 + ts)`. Union distinct qualifying `DriverPay.Truck_Number` with distinct `returns.Truck`, normalize only truck-key format, and count each truck once. Report source counts, overlap/source-only counts, union, `tc`, `ts`, and formula-vs-distinct reconciliation. | `DriverPay` + `returns` |
| Returning trucks by return-row owner or dispatcher | Apply the same inclusive `return_from`/`return_to` dates and an exact `owner` (`Owner`) or `dispatcher` (`Dispatcher`) filter on Returns rows. Count distinct numeric `Truck`, never driver rows. This attribution is specific to Returns; it is not automatically a filtered union total. Preserve the separate two-source return reconciliation for total-trucks questions. | `returns` (plus `DriverPay` for reconciliation) |
| Current fleet assignment | Current owner/dispatcher/mechanic metadata, not history. | `trucks` |
| Trucks on road on date D | Distinct nonblank `Truck_Number` where `Out Date <= D` and `Return Date > D`. Query `driver_pay` with `on_road_at=D`, paginate all rows; null returns and the return date do not qualify. For “now” use America/New_York today. No lookback or returns union. | `DriverPay` |
| Open assignments (different metric) | `Out Date` present and `Return Date` null via `return_null=true`. Do not label this the on-road count. | `DriverPay` |
| Planned departures | External live Ninox Schedule_Teams; prepared `out_schedule` gateway path requires deployed catalog/client verification. Not a physical Supabase table. | external |
| Current in-yard / off-duty / not-working trucks | Distinct valid nonblank `truck_number` in an immediately fetched, fully validated bounded [live Ninox JSON array](off-duty-trucks.md). Every row qualifies, including Ready To Go and Outside/vendor locations. General yard synonyms use the full feed; physical location only when explicitly asked. Exact source owner/dispatcher; current snapshot only, no history/complement/absence proof; failure means unknown, not zero. | approved external source |
| Off-duty days in yard | `Days In Yard / 86400000` using a calculation tool; source duration is milliseconds, not epoch time or days. Preserve fractional days and unknown/null values. | live off-duty source |
| Legacy Ninox insurance-choice formula | Unsupported because Supabase lacks Ninox `days_in_yard_` and numeric insurance-choice fields. This does not block the approved current off-duty feed or redefine the DriverPay on-road metric. | external formula |

## Fuel metrics

| Metric | Definition | Source |
|---|---|---|
| Fuel transaction count | Count fuel rows after the requested truck/date/product filters; each row is one historic transaction. | `fuel` |
| Adjusted fuel spend | Sum populated `Adjusted SubTotal` values for the explicit filtered transactions. Do not silently substitute `SubTotal` for null adjustments. | `fuel.Adjusted SubTotal` |
| Gallons | Sum `Gallons` for the explicit filtered transactions, reporting null/missing values where material. | `fuel.Gallons` |
| Aggregate price per gallon | Applicable aggregated spend ÷ aggregated gallons; do not average `Price_Per_Gallon` transaction values. | `fuel` |

## Outside repair metrics

One `public."Outside_Repairs"` row represents one external repair. Use inclusive service `Date` for date filtering; `created_at` is row creation, not service date. `Total Cost` already includes parts and labor. Paginate fully before aggregating; count rows as repairs, not distinct trucks.

| Metric | Definition | Source |
|---|---|---|
| Overall external repair cost | Sum populated `Total Cost` once per matching repair, including records with no truck. Report missing costs separately rather than treating unknown amounts as zero. | `Outside_Repairs.Total Cost` |
| Truck-attributed repair cost | Sum full cost only where `Choice=Truck` and `Truck` exists; for truck/owner breakdowns omit truckless rows. Do not allocate trailer costs to an accompanying truck. | `Outside_Repairs.Choice`, `Truck`, `owner` |
| Trailer-attributed repair cost | Sum full cost where `Choice=Trailer` and `Trailer` exists; do not attribute it to `Truck`. | `Outside_Repairs.Choice`, `Trailer` |
| AHS classification | Blank/null `AHS` means No; use exact Yes/No filter values. | `Outside_Repairs.AHS` |
| Work-category cost | Split comma-separated `Type of Work` categories and match each category independently. A repair may count in multiple categories; category totals overlap and cannot be summed to derive overall cost. | `Outside_Repairs.Type of Work`, `Total Cost` |

The `outside_repairs` API accepts `truck`, `trailer`, `date_from`, `date_to`, `company`, `choice`, `type_of_work`, `ahs`, `owner`, `ninox_id`, and `exceptions`; at least `truck`, `trailer`, `date_from`, or `ninox_id` is required. An `owner` filter matches stored repair `owner` only, never settlement `shared_owner`.

## Driver pay

For each DriverPay assignment that overlaps the settlement week:

```text
MoneyPerWeekSigned + CPM × max(Driven_miles − Pay CPM after Miles, 0)
```

Calculate per driver assignment. Do not divide team pay unless the requester explicitly defines a split. Review transfer and termination dates that fall inside the period.

## Governed departure totals (prepared schema 3.8.0)

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](departures.md).

Preserve `reconciliation`, `truck_sets`, `period`, `status`, and `complete`; source failure means `complete=false`, `status=incomplete`, and `combined_distinct_total=null`. Both optional date bounds must be supplied together (maximum 31 inclusive days); omitting both defaults to Monday–Sunday in America/New_York. Repository preparation does not remove the installed-client **not integrated** limitation.
