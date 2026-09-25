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
| Trucks currently out (open assignment) | Distinct `Truck_Number` where `Out Date` is present and `Return Date` is null. Use `driver_pay` with `return_null=true` and a lookback `out_from`. Not the exact Ninox in-yard/on-road formula. | `DriverPay` |
| Planned departures | Not available in these Supabase tables; use approved live Ninox Schedule_Teams source. | external |
| Exact in-yard/on-road count | Not available because Supabase lacks Ninox `days_in_yard_` and numeric insurance-choice fields. Prefer open-assignment count above when “currently out” is requested. | external |

## Fuel metrics

| Metric | Definition | Source |
|---|---|---|
| Fuel transaction count | Count fuel rows after the requested truck/date/product filters; each row is one historic transaction. | `fuel` |
| Adjusted fuel spend | Sum populated `Adjusted SubTotal` values for the explicit filtered transactions. Do not silently substitute `SubTotal` for null adjustments. | `fuel.Adjusted SubTotal` |
| Gallons | Sum `Gallons` for the explicit filtered transactions, reporting null/missing values where material. | `fuel.Gallons` |
| Aggregate price per gallon | Applicable aggregated spend ÷ aggregated gallons; do not average `Price_Per_Gallon` transaction values. | `fuel` |

## Driver pay

For each DriverPay assignment that overlaps the settlement week:

```text
MoneyPerWeekSigned + CPM × max(Driven_miles − Pay CPM after Miles, 0)
```

Calculate per driver assignment. Do not divide team pay unless the requester explicitly defines a split. Review transfer and termination dates that fall inside the period.
