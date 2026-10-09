# Question routing and analysis rules

For supported plain company-wide count/total questions, the optional client `ask` fast path can replace model planning. It never changes the report or metric definitions below; ambiguous, scoped and complex questions fall back. See [Jev fast-path contract](jev-fast-reporting.md).

Read `AGENTS.md` first. Use the smallest `agent-reporting` report that answers the question, use `?report=catalog&compact=true` for lightweight permission/routing discovery, then consult `?report=<name>&metadata=true` for the current runtime contract when its schema/rules are not already loaded.

| User question | `agent-reporting` report | Required filters / analysis |
|---|---|---|
| Current truck facts or fleet list | `trucks` | Use current owner/dispatcher/mechanic fields only. The settlement-only 1/2/3 allocation rule does not filter or classify this source. |
| Who/trucks are returning or expected to return? | `driver_pay` + `returns` | Apply the same inclusive `return_from`/`return_to` range to both. In DriverPay exclude `Termination = Driver Changed` and `Transfer = Transfer To Other Truck`; calculate `tc` (non-solo rows), `ts` (solo rows), and `floor(tc / 2 + ts)`. Union distinct qualifying `Truck_Number` with distinct `returns.Truck`; report reconciliation and final unique count. For the operational UI, **link** https://lightning-settlement-dashboard.vercel.app/trucks-return. |
| Which returning trucks belong to a dispatcher or owner in a date frame? | `returns` (plus `driver_pay` for the universal return reconciliation) | Use inclusive `return_from` / `return_to`, exact `dispatcher` (`Dispatcher`) or `owner` (`Owner`) on stored Returns rows, paginate fully, and count distinct numeric `Truck`. Never use current `trucks` owner/dispatcher or settlement `shared_owner`. Disclose that a returns-row attribution is not automatically an attribution of all DriverPay/union trucks. |
| Historical assignment for a truck/driver | `driver_pay` | Anchor with `truck_number` or `driver_id`; review dates, transfers, and terminations. |
| Which trucks left in a historical period? | `driver_pay` | Filter `out_from`/`out_to` only; count distinct `Truck_Number`. |
| How many trucks are leaving this current week? | `departures` when deployed; otherwise approved `driver_pay` + live Ninox `Schedule_Teams` | Use the same Monday–Sunday `Out Date` window for both sources. Union distinct truck numbers; report DriverPay-only, Schedule_Teams-only, overlap, and final total. Fetch Schedule_Teams immediately from its documented live JSON URL. For the planned-schedule UI, also **link** https://lightning-settlement-dashboard.vercel.app/out-schedule. |
| Which trucks returned historically? | `driver_pay` + `returns` | Use the universal two-source return rule for the requested `Return Date` period; disclose that `returns` is volatile and may not retain historical rows. Never silently substitute DriverPay alone. |
| Weekly headline gross/expense/net | `settlement_summary` | Supply `period_from` (and normally the same Tuesday in `period_to`) or a truck. An `owner` filter matches primary owner or `shared_owner`. |
| Full weekly expenses/components | `settlements` | Supply `period_from` or truck; use explicit period for owner/dispatch totals. An `owner` filter matches `Owner` or `shared_owner`. |
| Historic fuel transactions, gallons, or fuel spending | `fuel` | Anchor with `truck_number`, `store_from`, or `ninox_id`. An `owner` filter matches `owner` or `shared_owner`. Use `Adjusted SubTotal` when populated for adjusted-spend totals; calculate aggregate price per gallon as applicable spend ÷ gallons. For the operational UI, **link** https://lightning-settlement-dashboard.vercel.app/diesel. |
| Road/outside/not-company-shop repairs, vendor costs, truck or trailer external repair expenses, AHS, exceptions, or external work categories | `outside_repairs` (`public."Outside_Repairs"`) | Anchor with `truck`, `trailer`, `date_from`, or `ninox_id`; use inclusive service `Date`, not `created_at`. Sum `Total Cost` (parts + labor) once per repair. `Choice=Truck` assigns full cost to `Truck`; `Choice=Trailer` assigns full cost to `Trailer`, not an accompanying truck. Include truckless rows in overall totals, not truck/owner breakdowns. Split comma-separated `Type of Work` categories (overlapping totals); blank `AHS` means No. No existing dashboard route is implied. |
| HTML settlement/fleet dashboard or analytical history (trends, rankings) | `settlements` plus `fuel` (optional `settlement_summary` for headlines) | Use the Next.js app `apps/reporting-dashboard` and **link** https://lightning-settlement-dashboard.vercel.app. Dashboard fetches ≥12 months of `settlements` (paginate); other analytical HTML fetches ≥3 months. Fuel gallons for dashboard MPG use `store_from`/`store_to`; settlement fuel dollars use stored `Fuel Expenses`. Named date is UI focus only. Follow `docs/html-reporting.md`. |
| Drivers Insurance / drivers with or under insurance / insured roster / active on insurance / all insurance driver data / insured-driver list or count / insurance breakdown | Native/client `query_drivers_insurance` where installed; otherwise approved live Ninox GET, not an agent-reporting report | Fetch `https://lightningtransport.ninoxdb.com/share/x9f4rn221pibyhx3lwup2f8otfzfy8kijpk2?locale=en&utcoffset=-240` immediately before each answer; validate the complete bounded array and follow [driver-insurance contract](drivers-insurance.md). All rows by default; exact Insurance filters only when requested. Report roster rows and CDL identity coverage separately, retaining missing-CDL rows. Return all approved public keys when present: `First Name`, `Last Name`, `Insurance`, `CDL Number`, `Gender`, `DOB`, `State`, `Hire of Date`, `Years_of_Experience`; omit absent keys and never invent values. Do not substitute agent-reporting `drivers` or invent CDL/State/hire from other reports; Ninox `Hire of Date` is not Supabase `Date of Hire`. No cached/Supabase fallback, history, policy-validity or uninsured complement. |
| Current driver profile / hire date | `drivers` | Prefer exact `driver_id`; use `hire_from` / `hire_to` for Date of Hire ranges. Any `AGENT_API_KEY` can request the documented sensitive fields with `include_sensitive=true` unless its explicit `AGENT_ALLOW_SENSITIVE_<n>` control is set to `false`. |
| Planned teams/departures / Out Schedule UI | `out_schedule` when deployed; otherwise approved live Ninox `Schedule_Teams` (+ dashboard) | **Link** https://lightning-settlement-dashboard.vercel.app/out-schedule. Do not substitute DriverPay history for the planned list. |
| Current/now/today trucks on road or working | Approved live Ninox external JSON source, not an agent-reporting report | **Current on-road / working trucks (owner-approved 2026-10-08):** fetch `https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240` immediately before each answer, credential-free; follow [live on-road contract](on-road-trucks.md). This primary most-current source answers current/now/today operational status. Fully validate all seven keys and exact `Status=On The Road Working` within 30 seconds overall and 2 MiB; count distinct `truck_number`, use exact source owner/dispatcher/insurance, and state fetch-start/completion timestamps. Failure means unknown/null, never zero; no cached/DriverPay fallback, GPS movement claim or fleet/off-duty complement. Historical or explicit-date assignment overlap alone uses fully paginated `driver_pay?on_road_at=D` (Out Date <= D, Return Date > D; null returns and return day excluded). |
| Historical or explicit-date assignment overlap | `driver_pay?on_road_at=YYYY-MM-DD` | Fully paginate; distinct Truck_Number with Out Date <= D and Return Date > D; exclude null returns and return day. Dated assignment evidence, not current operational status. |
| Current trucks in yard / off duty / not working | Approved live Ninox external JSON source (not an agent-reporting report name) | Fetch `https://lightningtransport.ninoxdb.com/share/jx7z6tkjcnxalvsui4icdnqjuszia04etdhi?locale=en&utcoffset=-240` immediately, credential-free, and validate the complete bounded array. Every row is off duty/not on road, even `Ready To Go` and Outside/vendor locations. General yard synonyms mean the full feed; physical location only when explicitly asked. Count distinct `truck_number`, use exact source owner/dispatcher, and disclose retrieval timestamps. Current snapshot only; no history, complement or absence proof. Failure is unknown, not zero. See [off-duty source contract](off-duty-trucks.md). |
| Legacy Ninox insurance-choice formula | unsupported | Supabase lacks `days_in_yard_` and numeric insurance-choice fields. This formula limitation does not block the approved current off-duty feed and must not be conflated with historical DriverPay assignment overlap or current live working membership. |

## Fuel / diesel knowledge routing and rejected-path recovery

The Spanish question “reporte de petroleo dividido por companias” (also
“reporte de petróleo dividido por compañías”, diesel/combustible by company)
routes to the `fuel` report. Read these existing approved documents:
`docs/question-routing.md`, `docs/data-dictionary.md`, and
`docs/metric-definitions.md`, then fetch live `fuel` metadata for unfamiliar rules.
The dashboard `/diesel` is **not a knowledge-document path**; there is no
`docs/diesel.md` document. Never derive knowledge filenames from UI routes.

For the recorded rejected request, the safe one-time recovery is:

```json
{"document": "docs/question-routing.md", "offset": 0, "limit": 16000}
```

Select this path only when the caller's tool advertises it as approved. Retry once,
preserving `offset` and `limit`; if it fails again, disclose the limitation rather
than bypassing the tool. A tool that uses document aliases or search IDs must use
its own advertised identifier instead; do not add unsupported offset/limit fields.
This is a client knowledge-routing correction, not a permission or schema change.

For a company breakdown, `fuel` has no `company` field or filter. Explain that the
available historical entity attribution is `owner`; confirm whether that is the
requested meaning if it is unclear (do not invent supplier/company data). If no
period is supplied or established in the conversation, ask for the date period
before running numerical totals. Query inclusive `store_from` / `store_to`, use
verified exact stored `Product` values for diesel (not substring guesses that can
include additives/oil), and paginate completely before totals. Retain rows with a
blank owner as unattributed instead of dropping them. Preserve `shared_owner`;
owner-filtered queries match either field and can overlap. Do not add overlapping
owner-filtered totals into a company-wide total. A primary-`owner` breakdown counts
each transaction once; an underlying-owner allocation requires an explicit rule.
Use populated `Adjusted SubTotal`, report missing amounts/gallons, and calculate
applicable aggregate spend divided by gallons, not the mean transaction rate.
For the UI, link https://lightning-settlement-dashboard.vercel.app/diesel.

*Evidence: rejected non-existent path reported 2026-10-08; approved recovery paths
confirmed against the supplied tool allowlist and canonical files; fuel fields,
filters and calculation rules checked against authenticated schema 3.8.2 metadata.
The affected third-party `get_reporting_knowledge` implementation is not in this
repository; publication/sync does not prove that user's runtime has reloaded.*

## Settlement numeric coverage

Expense-breakdown questions route to `settlements` with explicit period/owner scope and complete pagination. Read [numeric coverage](metric-definitions.md#settlement-numeric-coverage) and [source verification](data-dictionary.md#settlement-source-verification). Return partial populated sums with coverage, not fabricated zero components; an all-null component is unknown. `From`/`To` select dates and are not numeric measures. Analysis/aggregation options belong to the client, not undocumented gateway GET parameters. Do not switch the model/provider or undo a repaired client adapter to mask source omissions. A source/import investigation is an authorized maintenance task, not permission for reporting agents to bypass the gateway or infer settlement mappings from the fuel importer.

## Date rules

- Settlements: Tuesday `From` through the following Monday `To`. Use an exact Tuesday period anchor. Do not infer current cycle from `To Report` alone.
- HTML reports and analytical settlement/fleet-history answers: load at least three calendar months; the settlement dashboard loads at least twelve. The named date is toolbar/focus only. See `docs/html-reporting.md`.
- Departure totals: use the same `Out Date` frame on DriverPay and Schedule_Teams, never DriverPay alone. Other date semantics require an explicit separate request.
- All returns: use only `Return Date`, with the same inclusive ISO bounds on both reports. The `returns` source is volatile; null means no stored date.
- A populated row does not prove financial completion; check the requested metric for null values.

## Cardinality and join rules

- `DriverPay` and `returns` are driver-row sources. For returns, first exclude DriverPay `Driver Changed` / `Transfer To Other Truck` rows and calculate `floor(tc / 2 + ts)`; then deduplicate the qualifying DriverPay/returns truck-number union.
- `settlements` is truck-or-bucket/week grain. Filter by `Truck` plus period for one row.
- `fuel` is transaction grain. Multiple rows can exist per truck/date; never count its rows as trucks or replace settlement totals with fuel transaction subtotals.
- `Outside_Repairs` is external-repair record grain. A truck may appear on a trailer repair record; only `Choice` determines cost attribution. For truck/owner cost breakdowns, exclude truckless records even though overall totals include them; category membership can overlap. Do not substitute `settlements.LTR Invoices` for external repairs.
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

## Governed departure totals (prepared schema 3.8.0)

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](departures.md).

Preserve `reconciliation`, `truck_sets`, `period`, `status`, and `complete`; source failure means `complete=false`, `status=incomplete`, and `combined_distinct_total=null`. Both optional date bounds must be supplied together (maximum 31 inclusive days); omitting both defaults to Monday–Sunday in America/New_York. Repository preparation does not remove the installed-client **not integrated** limitation.
