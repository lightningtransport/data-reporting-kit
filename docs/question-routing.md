# Question routing and analysis rules

Read `AGENTS.md` first. Use the smallest `agent-reporting` report that answers the question, then consult `?report=<name>&metadata=true` for the current runtime contract.

| User question | `agent-reporting` report | Required filters / analysis |
|---|---|---|
| Current truck facts or fleet list | `trucks` | Use current owner/dispatcher/mechanic fields only. The settlement-only 1/2/3 allocation rule does not filter or classify this source. |
| Who/trucks are returning or expected to return? | `driver_pay` + `returns` | Apply the same inclusive `return_from`/`return_to` range to both. In DriverPay exclude `Termination = Driver Changed` and `Transfer = Transfer To Other Truck`; calculate `tc` (non-solo rows), `ts` (solo rows), and `floor(tc / 2 + ts)`. Union distinct qualifying `Truck_Number` with distinct `returns.Truck`; report reconciliation and final unique count. For the operational UI, **link** https://lightning-settlement-dashboard.vercel.app/trucks-return. |
| Which returning trucks belong to a dispatcher or owner in a date frame? | `returns` (plus `driver_pay` for the universal return reconciliation) | Use inclusive `return_from` / `return_to`, exact `dispatcher` (`Dispatcher`) or `owner` (`Owner`) on stored Returns rows, paginate fully, and count distinct numeric `Truck`. Never use current `trucks` owner/dispatcher or settlement `shared_owner`. Disclose that a returns-row attribution is not automatically an attribution of all DriverPay/union trucks. |
| Historical assignment for a truck/driver | `driver_pay` | Anchor with `truck_number` or `driver_id`; review dates, transfers, and terminations. |
| Which trucks left in a historical period? | `driver_pay` | Filter `out_from`/`out_to` only; count distinct `Truck_Number`. |
| How many trucks are leaving this current week? | `driver_pay` + live Ninox `Schedule_Teams` | Use the same Monday–Sunday `Out Date` window for both sources. Union distinct truck numbers; report DriverPay-only, Schedule_Teams-only, overlap, and final total. Fetch Schedule_Teams immediately from its documented live JSON URL. For the planned-schedule UI, also **link** https://lightning-settlement-dashboard.vercel.app/out-schedule. |
| Which trucks returned historically? | `driver_pay` + `returns` | Use the universal two-source return rule for the requested `Return Date` period; disclose that `returns` is volatile and may not retain historical rows. Never silently substitute DriverPay alone. |
| Weekly headline gross/expense/net | `settlement_summary` | Supply `period_from` (and normally the same Tuesday in `period_to`) or a truck. An `owner` filter matches primary owner or `shared_owner`. |
| Full weekly expenses/components | `settlements` | Supply `period_from` or truck; use explicit period for owner/dispatch totals. An `owner` filter matches `Owner` or `shared_owner`. |
| Historic fuel transactions, gallons, or fuel spending | `fuel` | Anchor with `truck_number`, `store_from`, or `ninox_id`. An `owner` filter matches `owner` or `shared_owner`. Use `Adjusted SubTotal` when populated for adjusted-spend totals; calculate aggregate price per gallon as applicable spend ÷ gallons. For the operational UI, **link** https://lightning-settlement-dashboard.vercel.app/diesel. |
| HTML settlement/fleet dashboard or analytical history (trends, rankings) | `settlements` plus `fuel` (optional `settlement_summary` for headlines) | Use the Next.js app `apps/reporting-dashboard` and **link** https://lightning-settlement-dashboard.vercel.app. Dashboard fetches ≥12 months of `settlements` (paginate); other analytical HTML fetches ≥3 months. Fuel gallons for dashboard MPG use `store_from`/`store_to`; settlement fuel dollars use stored `Fuel Expenses`. Named date is UI focus only. Follow `docs/html-reporting.md`. |
| Current driver profile / hire date | `drivers` | Prefer exact `driver_id`; use `hire_from` / `hire_to` for Date of Hire ranges. Any `AGENT_API_KEY` can request the documented sensitive fields with `include_sensitive=true` unless its explicit `AGENT_ALLOW_SENSITIVE_<n>` control is set to `false`. |
| Planned teams/departures / Out Schedule UI | live Ninox `Schedule_Teams` (+ dashboard) | **Link** https://lightning-settlement-dashboard.vercel.app/out-schedule. Do not substitute DriverPay history for the planned list. |
| Exact trucks in yard/off duty/on road | unsupported | Supabase lacks `days_in_yard_` and numeric insurance-choice fields required by the Ninox definition. |

## Date rules

- Settlements: Tuesday `From` through the following Monday `To`. Use an exact Tuesday period anchor. Do not infer current cycle from `To Report` alone.
- HTML reports and analytical settlement/fleet-history answers: load at least three calendar months; the settlement dashboard loads at least twelve. The named date is toolbar/focus only. See `docs/html-reporting.md`.
- DriverPay departures: use only `Out Date` unless another date is explicitly requested.
- All returns: use only `Return Date`, with the same inclusive ISO bounds on both reports. The `returns` source is volatile; null means no stored date.
- A populated row does not prove financial completion; check the requested metric for null values.

## Cardinality and join rules

- `DriverPay` and `returns` are driver-row sources. For returns, first exclude DriverPay `Driver Changed` / `Transfer To Other Truck` rows and calculate `floor(tc / 2 + ts)`; then deduplicate the qualifying DriverPay/returns truck-number union.
- `settlements` is truck-or-bucket/week grain. Filter by `Truck` plus period for one row.
- `fuel` is transaction grain. Multiple rows can exist per truck/date; never count its rows as trucks or replace settlement totals with fuel transaction subtotals.
- In settlement, settlement-summary, and fuel owner-filtered reports, include a row when either its primary owner or `shared_owner` exactly matches the requested owner. `shared_owner` is supplemental attribution for trucks operated under `SOLO INC.` or `FLATBED INC.`; preserve it rather than overwriting the primary owner.
- Only in `settlements` and `settlement_summary`, Truck 1, 2, and 3 are non-physical owner-expense allocation buckets for Carlos, Jorge, and CDT. Each represents that owner's total `truck_loans` and `Insurance` not assigned to a specific physical truck. Include them in owner general totals, label them as non-physical, and exclude them from physical-truck counts/rankings.
- If the selected report does not contain a required attribute, retrieve it from related approved-report data before completing the answer. Use CDL as the driver key across `drivers` and `DriverPay`; use the truck-number field variants (`truck_number`, `Truck_Number`, `Truck`, `truck_no`, or `unit_number`) as the vehicle key after documented type/format normalization.
- Left-join historical rows to current `trucks`; history can contain retired/missing current-master numbers. Never use a name, Supabase `ID`, or `returns.Ninox_ID` as a surrogate key.
- `returns.CDL` is a sensitive exact driver key. Only associate a return with a driver when this CDL matches a verified CDL in related approved data; never use names, Supabase IDs, or `returns.Ninox_ID` as a substitute.

*Evidence: approved business rule confirmed 2026-09-11; `returns.CDL` physical column verified on 2026-09-11.*

## Pagination

For complete totals or lists, follow `next_offset` until `has_more=false`. `count` and `page_count` are the current page; `total_count` is the filtered total.

## Answer format

State source report/table, normalized filters, exact period, result and row/distinct count, `as_of`, source-freshness limitation, and material grain/null/bucket/join caveats.
