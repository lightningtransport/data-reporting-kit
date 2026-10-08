# Data dictionary

The six prior reporting sources were verified against Supabase project `aaqquwhdglueqlnbifvn` on **2026-09-21**, with `returns` additions verified on **2026-09-25**: **111 physical columns** (`DriverPay` 26, `drivers` 17, `returns` 10, `settlements` 28, `trucks` 16, `fuel` 14). The 14 `Outside_Repairs` columns, types, nullability, and RLS were verified in production on **2026-09-28**, giving **125 verified columns across seven sources**. The `agent-reporting` function was deployed as version 114. The reporting system is single-organization. The authenticated catalog remains authoritative for each key's access.

The authenticated `agent-reporting` metadata routes are the runtime contract. Call `?report=catalog` for the complete catalog or `?report=<name>&metadata=true` for one report.

## Shared rules

- Supabase identity `ID` columns are generated import-row keys, not Ninox record IDs.
- `as_of` is request time, not source-sync time. These source tables do not expose a reliable sync timestamp.
- **Relational fallback rule (approved business rule, 2026-09-11):** If a report needs an attribute not carried by its primary record, search the related approved-report sources by their designated business key before finalizing. CDL is the unique driver key for matching `drivers` and `DriverPay`; truck number is the vehicle key for matching field variants such as `truck_number`, `Truck_Number`, `Truck`, `truck_no`, and `unit_number`.
- Historical text truck keys must be normalized before comparing them to numeric `trucks.truck_number`. Use a **left join** from history because retired/historical truck numbers may not exist in the current master. Do not replace an absent CDL or truck key with a name or a Supabase `ID`.
- `DriverPay.DriversDB_ID` is text and joins to `drivers.Ninox_ID::text`; it remains available for legacy source linkage but CDL is the designated driver key for fallback lookups.
- `returns.Ninox_ID` is a Returns source-record ID, not a driver ID. `returns.CDL` is now available as a sensitive exact driver key; use it only when it matches a related approved record's verified CDL.
- **Shared-owner attribution rule (approved business rule, 2026-09-21):** In `settlements` and `fuel`, an owner-filtered report includes rows where either the primary owner field or `shared_owner` exactly matches the requested owner. `shared_owner` identifies the underlying owner for a truck operating under `SOLO INC.` or `FLATBED INC.`; it supplements and never replaces the historical primary-owner value. Preserve both fields in the result and do not apply this rule to `trucks`, DriverPay, or returns.

## `trucks` — current fleet master

**Grain:** one current master row per unique `truck_number`. `ID` is the primary key; `truck_number` has a unique constraint. Use this table for current facts only.

The settlement-only Truck 1/2/3 owner-expense allocation rule does not apply to this table. `Out Of Services` is a dispatcher value, not a substitute for the approved [live off-duty source](off-duty-trucks.md). That external JSON source has nine fields (including millisecond `Days In Yard`) and is not a new Supabase table or physical-column addition. Fetch it fresh for current in-yard/off-duty/not-working questions; use its exact owner/dispatcher and distinct `truck_number`. All rows qualify regardless of Ready To Go or Outside/vendor location. The legacy insurance-choice formula remains unsupported because Supabase lacks `days_in_yard_` and numeric insurance-choice fields; this caveat does not block the current feed.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `truck_number` | numeric | no | Unique current truck-master number. Ninox `E.A / truck_`. |
| `dispatcher` | text | yes | Current group/dispatcher. Current values include Group 1, Group 2, CDT, Solo, Out Of Services. Ninox `E.YF`. |
| `insurance` | text | yes | Current truck insurance/provider category. Use exact stored values. Ninox `E.Y4`. |
| `vin` | text | yes | Sensitive VIN. Ninox `E.CG`. |
| `make` | text | yes | Truck make/model display value. Ninox `E.DG`. |
| `odometer_miles` | numeric | yes | Current recorded odometer in miles. Ninox `E.OF`. |
| `owner` | text | yes | Current owner/entity; never use for historical settlement attribution. Ninox `E.VF`. |
| `last_known_address` | text | yes | Sensitive Samsara-derived last known address. Ninox `E.PF`. |
| `model_year` | numeric | yes | Vehicle model year. Ninox `E.IJ`. |
| `license_plate` | text | yes | Sensitive plate value. Ninox `E.HJ`. |
| `yard_location` | text | yes | Current selected/derived location such as 301 Yard or a service vendor. Ninox `E.X1`. |
| `samsara_last_connected_at` | timestamptz | yes | Last Samsara connection/report timestamp. Ninox `E.SF`. |
| `samsara_vehicle_id` | text | yes | Sensitive Samsara vehicle ID. Ninox `E.BM`. |
| `mechanic_status` | text | yes | Literal current shop status; blank/null means none stored. Ninox `E.TA`. |
| `ID` | bigint | no | Supabase identity primary key. |
| `Ninox_ID` | numeric | yes | Ninox TrucksDB source-record ID; it is not the canonical `truck_number`, and its broader business semantics are not established. |

## `DriverPay` — historical driver assignment/pay ledger

**Grain:** one driver assignment/pay record. Team trucks normally produce two rows, one per driver; a solo normally produces one row with `Solo_Driver_if_1 = 1`.

**Current on-road / working trucks (owner-approved 2026-10-08):** fetch `https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240` immediately before each answer, credential-free; follow [live on-road contract](on-road-trucks.md). This primary most-current source answers current/now/today operational status. Fully validate all seven keys and exact `Status=On The Road Working` within 30 seconds overall and 2 MiB; count distinct `truck_number`, use exact source owner/dispatcher/insurance, and state fetch-start/completion timestamps. Failure means unknown/null, never zero; no cached/DriverPay fallback, GPS movement claim or fleet/off-duty complement. Historical or explicit-date assignment overlap alone uses fully paginated `driver_pay?on_road_at=D` (Out Date <= D, Return Date > D; null returns and return day excluded).

**External on-road schema:** seven keys `truck_number` (numeric), `dispatcher`, `insurance`, `owner`, `Samsara_Truck_ID`, `Status` (strings), `Ninox_ID` (numeric); Status is exactly `On The Road Working`. This adds no Supabase physical columns.

Use the same inclusive `Out Date` frame on both DriverPay and Schedule_Teams for departure totals. For every returning-trucks question/report, apply the requested inclusive `Return Date` range to both DriverPay and `returns`. Exclude DriverPay rows where `Termination = Driver Changed` or `Transfer = Transfer To Other Truck`; let `tc` be remaining non-solo rows and `ts` remaining solo rows, with DriverPay formula count `floor(tc / 2 + ts)`. Build the DriverPay merge set from distinct `Truck_Number` values in those qualifying rows, union it with distinct `returns.Truck`, and deduplicate. For assignment overlap with a settlement week: `Out Date <= settlements.To` and (`Return Date` is null or `Return Date >= settlements.From`), then inspect transfers/terminations inside that period.

For a current-week departure total, DriverPay is one required source, not a complete substitute for Schedule_Teams: union its distinct `Truck_Number` departures with distinct live Schedule_Teams `Truck` records for the same Monday–Sunday `Out Date` window. Deduplicate by truck number and preserve a reconciliation of both-source, DriverPay-only, and Schedule_Teams-only trucks.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `Truck_Number` | text | yes | Actual truck number from Ninox `WD.IA / TruckNumber_`. |
| `Out Date` | date | yes | Actual work departure date; DriverPay is one of two required sources for departure totals. Ninox `WD.O`. |
| `Return Date` | date | yes | Historical return/rest/yard date; use alone for return questions. Ninox `WD.R`. |
| `Transfer` | text | yes | Transfer direction: To Other Truck or From Other Truck. Ninox `WD.I9`. |
| `DriversDB_ID` | text | yes | DriversDB ID; join to `drivers.Ninox_ID::text`. |
| `Termination` | text | yes | Early assignment-ending reason. Live values include Driver Changed/Fired; catalog also defines Early Broke Contract. Ninox `WD.LA`. |
| `Termination Date` | date | yes | Date this assignment ended for the termination reason. |
| `Transfer Date` | date | yes | Date of transfer. |
| `Transfer Truck` | text | yes | Destination for transfer-to; origin for transfer-from. |
| `Solo_Driver_if_1` | numeric | yes | `1` means solo. Null/other is not proof of exactly two rows; deduplicate trucks. Ninox `WD.PC`. |
| `MoneyPerWeekSigned` | numeric | yes | Fixed weekly salary. Ninox `WD.H6`. |
| `MoneyPerDaysigned` | numeric | yes | Stored daily rate; verified as weekly/7 in live rows. Ninox `WD.G6`. |
| `CPM` | numeric | yes | Per-mile rate above threshold. Ninox `WD.DA`. |
| `Pay CPM after Miles` | numeric | yes | Weekly mileage threshold. Ninox `WD.EA`. |
| `Driver Name` | text | yes | Driver display-name snapshot. |
| `First Name` | text | yes | First-name snapshot. |
| `Last Name` | text | yes | Last-name snapshot. |
| `E-mail` | text | yes | Sensitive email snapshot. |
| `Phone Number` | text | yes | Sensitive phone snapshot. |
| `CDL` | text | yes | Sensitive CDL snapshot. |
| `State` | text | yes | CDL issuing-state snapshot. |
| `owner` | text | yes | Historical assignment owner/entity. Ninox `WD.KB`. |
| `Samsara_ID` | text | yes | Sensitive Samsara vehicle ID. Ninox `WD.FB`. |
| `Dispatch_Name_` | text | yes | Historical assignment dispatch; history includes group labels and legacy names. Ninox `WD.ZA`. |
| `Temporal_Driver` | text | yes | Temporary-CDL indicator stored as Yes/No/null. Ninox `WD.UJ`. |
| `ID` | bigint | no | Supabase identity primary key; not Ninox DriverPay record ID. |

**Driver-pay calculation:** per driver assignment, `MoneyPerWeekSigned + CPM × max(Driven_miles − Pay CPM after Miles, 0)` for the matching settlement week. Do not divide team pay unless explicitly instructed.

## `drivers` — current driver master

**Grain:** one current profile. `ID` is the Supabase primary key; `Ninox_ID` is the unique source/business key. The local Ninox catalog has no field-level DriversDB/Z definitions, so label-based meanings below must not be expanded beyond what is established.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `FullName` | text | yes | Current full display name. |
| `First Name` | text | yes | Current first name. |
| `Middle Name` | text | yes | Current middle name. |
| `Last Name` | text | yes | Current last name. |
| `E-mail` | text | yes | Sensitive current email. |
| `Phone Number` | text | yes | Sensitive current phone. |
| `Years Of Experience` | numeric | yes | Ninox-calculated experience; use stored value unless asked to recalculate. |
| `DOB` | date | yes | Sensitive date of birth; validate anomalies before compliance use. |
| `Company Name (This is NOT the Insurance)` | text | yes | Employer/company; explicitly not insurance. |
| `CDL` | text | yes | Sensitive CDL number. |
| `State` | text | yes | CDL issuing state. |
| `CDL Expiration` | text | yes | Sensitive expiration value stored as text; validate format before date arithmetic. |
| `Gender` | text | yes | Sensitive gender value as stored; returned when `include_sensitive=true`. All agent API keys are allowed by default unless their matching `AGENT_ALLOW_SENSITIVE_<n>` control is set to `false`. |
| `Insurance` | text | yes | Driver-associated insurance/category code; code expansion is not established. |
| `Ninox_ID` | numeric | yes | Unique DriversDB source ID; preferred join key. |
| `ID` | bigint | no | Supabase identity primary key. |
| `Date of Hire` | date | yes | Current driver hire date. Physical type/column verified; source-field mapping and any employment-policy semantics are not established. |

## `returns` — current expected-return list

**Grain:** one returning driver/truck row. Team trucks normally have two rows. This is volatile current operational data and is one required side of every returning-trucks result; never use it or DriverPay alone.

`Return Date` is a nullable PostgreSQL `date`, not a free-text status field. Filter with the same inclusive ISO dates used for DriverPay, union distinct `Truck` with the qualifying DriverPay truck set, and report the two-source reconciliation. For a return-frame dispatch/owner query, use exact `Dispatcher` and `Owner` on the return rows and count distinct `Truck` rather than driver rows; do not use current `trucks` or settlement `shared_owner` for row attribution. Supabase omits Ninox Returns fields `Solo`, `DriverDB_Id_saved`, and `Driver_id_Pay_`. *Evidence: business-owner field interpretation and live physical column types/nullability confirmed 2026-09-25.*

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `Insurance` | text | yes | Insurance category/code; use literal value. |
| `Truck` | numeric | yes | Returning truck number; distinct truck-count key. Ninox `S.A`. |
| `Driver Name` | text | yes | Driver display name. Ninox `S.B`. |
| `Phone Number` | text | yes | Sensitive phone. Ninox `S.E`. |
| `Return Date` | date | yes | Expected return date; null means no date stored. Ninox `S.H`. |
| `ID` | bigint | no | Supabase identity primary key. |
| `Ninox_ID` | numeric | yes | Returns source-record ID; **not** a driver ID. |
| `CDL` | text | yes | Sensitive commercial driver-license value. Use as an exact driver link only after confirming the same CDL in a related approved record. |
| `Dispatcher` | text | yes | Truck dispatcher stored on this return row; exact `dispatcher` filter, not current `trucks.dispatcher`. |
| `Owner` | text | yes | Truck owner stored on this return row; exact `owner` filter, not current `trucks.owner` or settlement `shared_owner`. |

## `settlements` — weekly financial ledger

**Grain:** one truck identifier or owner bucket per Tuesday–Monday period. `(Truck, From, To)` is unique in verified live data. Attribute history using this row's `Owner` and `Dispatch`, never current truck-master values.

**Owner-expense allocation buckets (settlements only):** `Truck` 1=Carlos, 2=Jorge, 3=CDT. They are non-physical trucks. Each bucket holds its owner's total `truck_loans` and `Insurance` amounts that are not applied to a specific physical truck. Include these rows in the respective owner's general settlement totals, display them as non-physical owner-expense allocation buckets, and exclude them from physical-truck counts/rankings. Do not apply this classification to `trucks`, DriverPay, or returns.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `Truck` | text | yes | Physical truck number or settlement-only non-physical owner-expense allocation bucket. Ninox `DE.K`. |
| `truck_insurance` | text | yes | Period-specific truck insurance category/code. |
| `Dispatch` | text | yes | Historical dispatch value for this period. Ninox `DE.X3`. |
| `Owner` | text | yes | Historical owner/entity for this period. |
| `Gross` | numeric | yes | Stored total gross before percentage/expenses. Ninox `DE.L4`. |
| `tonu` | numeric | yes | Imported physical name for additional/Compass income already included in Gross; do not treat as tonnage quantity or add again. Related Ninox concept `DE.M1 / Facturado Compass`. |
| `Total Expenses` | numeric | yes | Stored full expense total; components and driver pay are already included. Ninox `DE.Z4`. |
| `Net` | numeric | yes | Stored authoritative net. Intended subtraction has rare live exceptions. Ninox `DE.A5`. |
| `From` | date | yes | Tuesday period start. Ninox `DE.L`. |
| `To` | date | yes | Following Monday period end. |
| `truck_loans` | numeric | yes | Truck loan/dealer-payment expense. For settlement buckets 1/2/3, this is part of the owner's total unassigned truck-loan amount. Ninox `DE.Q3`. |
| `Otro` | numeric | yes | Uncategorized expense component. |
| `LTR Invoices` | numeric | yes | Internal Lightning Trucks Repairs invoice expense. |
| `Tolls` | numeric | yes | Toll expense component. |
| `BestPass` | numeric | yes | BestPass expense component. |
| `Insurance` | numeric | yes | Insurance expense component. For settlement buckets 1/2/3, this is part of the owner's total unassigned insurance amount. |
| `CabCards` | numeric | yes | Cab-card expense component. |
| `Trailer Rentals` | numeric | yes | Trailer-rental expense component. |
| `samsara` | numeric | yes | Samsara expense component. |
| `PrePass` | numeric | yes | PrePass expense component. |
| `Total Driver Pay` | numeric | yes | Total driver-pay expense for the truck/week. Ninox `DE.L3`. |
| `Fuel Expenses` | numeric | yes | Fuel expense component. |
| `To Report` | text | yes | Mixed historical import flag. Do not infer current period from this field alone. |
| `%AppliedSaved` | numeric | yes | Company percentage applied to Gross. Ninox `DE.T2`. |
| `Gross_with_%_deduction_All` | numeric | yes | Gross after percentage; verified formula `Gross × (%AppliedSaved/100)` for eligible live rows. Ninox `DE.G8`. |
| `Driven_miles` | numeric | yes | Miles driven in the period. Ninox `DE.S5`. |
| `ID` | bigint | no | Supabase identity primary key. |
| `shared_owner` | text | yes | Supplemental underlying owner for a truck operating under `SOLO INC.` or `FLATBED INC.`. An owner-filtered settlement query includes a row when either `Owner` or `shared_owner` exactly matches; retain both values. |

Use stored `Gross`, `Total Expenses`, and `Net`. Do not add `tonu` to Gross or expense components to Total Expenses. Require an explicit period; historical `To Report=Yes` rows make the flag unsafe as a current-cycle selector.

### Settlement numeric coverage

All listed expense components remain nullable numeric measures; `From`/`To` remain
date-only fields. Null is unknown/unpopulated, not automatically zero or not applicable,
including allocation buckets. Keep row completeness separate from populated numeric
coverage; follow [settlement numeric coverage](metric-definitions.md#settlement-numeric-coverage).

### Settlement source verification

**Evidence verified 2026-10-08:** authenticated reporting/source inspection and isolated
fixtures. The evaluated Facturacion export can omit these keys on allocation-bucket
records while returning numbers, including explicit zeros, on physical-truck records.
This is current export evidence, not proof of original historical values or zero semantics.

| Export component | Verified DE export expression | Source type |
|---|---|---|
| `Otro` | `DE.D1` | number |
| `LTR Invoices` | `DE.Q1` | number |
| `Tolls` | `DE.W1` | number |
| `BestPass` | `DE.E4` | number |
| `CabCards` | `DE.F` | formula |
| `Trailer Rentals` | `DE.T1` | formula |
| `samsara` | `DE.U1` / GPS Samsara | formula |
| `PrePass` | `DE.V1` | formula |

These are verified export expressions, not proof of a deployed importer's mappings.
Ordinary Ninox REST records may omit formula fields even when their evaluated values
are populated. Therefore **raw REST record omission** alone cannot prove formula nullness;
an authorized maintainer must inspect the actual view and evaluate its expressions.
Preserve absent fields, explicit null, blank, zero and formula-produced values separately.

Supabase settlement `ID` is a generated row identity, not a Ninox record ID. The separate
maintenance-side `Ninox_ID`, where populated, must match the source record's top-level
`id`; it is **not exposed by the settlement report**. Do not request it as an unsupported
API field, guess it from `ID`, or replace stable gateway IDs. A missing source identity
remains unresolved until a unique source-backed match is verified by authorized maintenance.

An executed **ad-hoc** settlement import was verified, but a **scheduled Supabase settlement importer was not located** in the inspected systems. Its current writer/revision and
period-by-period provenance remain unresolved. Do not certify deployed idempotence or
infer its rules from the separately tracked fuel importer. Source-record generation,
reporting deployments and instruction-sync jobs are not proof of settlement import.

A future maintenance fix must first establish the actual writer, authoritative mappings
and source identity; exercise isolated duplicate/number/state fixtures and a nonmutating
dry-run. Any production identity or financial replacement requires **separate approval**
of exact source-backed row/old/new values, protected stable IDs and cardinality, backup
and exact readback. Preserve existing chat/audit evidence. Reporting agents must use
the approved gateway, not seek raw-table or private Ninox access to bypass these limits.

## `fuel` — historic fuel transactions

**Grain:** one fuel transaction row. Multiple rows can exist per truck and `Store Date`; do not count these rows as trucks or substitute their subtotals for weekly settlement totals.

Use `Unit` as the numeric historic truck identifier. For a current-truck lookup, normalize only numeric representation and left-join to `trucks.truck_number`; historical fuel can exist without a current-master truck. `created_at` is a Supabase row timestamp, not proof of Ninox source freshness.

`Gallons` and `Adjusted SubTotal` must be present in the requested numeric projection as JSON numbers or permitted nulls. Null is unknown, not zero; an absent projected key is schema drift. Report populated/null counts and numeric coverage independently of fully reconciled pagination. `[owner, shared_owner]` groups are disjoint pairs, not a financial allocation. See the versioned [fuel numeric clarification](metric-definitions.md#fuel-numeric-contract--clarification-10) for native-client and importer validation rules. The canonical importer is `scripts/importers/ninox_to_supabase_fuel.py`; it stops on omitted numeric source keys until sparse omission semantics are documented, rejects ambiguous formatting and precision/range loss, and does not change the source mapping or financial values.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `id` | bigint | no | Supabase identity primary key for this transaction. |
| `created_at` | timestamptz | no | Supabase row-creation timestamp; not a source-sync timestamp. |
| `Unit` | numeric | yes | Historic fuel transaction truck number. |
| `Store Date` | date | yes | Transaction store date. Use inclusive `store_from` / `store_to` filters. |
| `Product` | text | yes | Stored product description. |
| `SubTotal` | numeric | yes | Stored pre-adjustment transaction subtotal. |
| `Adjusted SubTotal` | numeric | yes | Stored adjusted transaction subtotal. Use it for adjusted-spend totals only when populated; otherwise report the null rather than silently substituting `SubTotal`. |
| `Gallons` | numeric | yes | Gallons purchased in this transaction. |
| `City` | text | yes | Transaction city. |
| `State` | text | yes | Transaction state/province as stored. |
| `Price_Per_Gallon` | numeric | yes | Stored transaction price per gallon. For aggregates, divide applicable total spend by total gallons instead of averaging this field. |
| `owner` | text | yes | Historical owner/entity stored on this transaction; not necessarily current truck ownership. |
| `Ninox_ID` | numeric | yes | Fuel source-record identifier when populated; not a driver ID. |
| `shared_owner` | text | yes | Supplemental underlying owner for a truck operating under `SOLO INC.` or `FLATBED INC.`. An owner-filtered fuel query includes a row when either `owner` or `shared_owner` exactly matches; retain both values. |

## `Outside_Repairs` — external/road repair records

**Grain:** one road/outside/not-company-shop repair record per row; not an internal Lightning shop invoice. `id` is the row identifier, `Ninox_ID` is a source-record identifier, and neither is a truck/driver ID. Use service `Date` for inclusive reporting periods, not `created_at`. Cost is parts plus labor already combined in `Total Cost`; do not add components again. Physical types and database nullability were verified against production on 2026-09-28; a nullable column can still have no nulls in current rows.

| Column | Type | Null? | Meaning / safe use |
|---|---|---:|---|
| `id` | bigint | no | Row identity for stable pagination; not a business vehicle key. |
| `created_at` | timestamptz | no | Record creation timestamp, not service date or a reliable source-sync timestamp. |
| `Status` | text | yes | Stored status; observed current value Done. |
| `Truck` | numeric | yes | Truck number recorded with repair; may be absent and may accompany a trailer repair without receiving the cost. |
| `Trailer` | text | yes | Trailer identifier; full cost is attributed here when `Choice=Trailer`. |
| `Date` | date | yes | Service date; use inclusive `date_from` / `date_to`. |
| `Repair Company` | text | yes | External repair vendor; exact `company` filter. |
| `Choice` | text | yes | `Truck` attributes full cost to Truck; `Trailer` attributes full cost to Trailer, not accompanying Truck. Other values are not defined. |
| `Type of Work` | text | yes | Comma-separated work categories; a row can match multiple category queries. |
| `Total Cost` | numeric | yes | Full repair cost including parts and labor; count once per repair in overall totals. |
| `AHS` | text | yes | After-hours indicator: Yes means after-hours; No or blank/null means No. |
| `owner` | text | yes | Stored repair owner; not settlement `shared_owner` or current truck master owner. Exclude truckless records from truck/owner breakdowns, but not overall totals. |
| `Ninox_ID` | numeric | yes | Source-record identifier; exact `ninox_id` filter. |
| `Exceptions` | text | yes | Stored special-circumstance text when no Truck is present; not every truckless record has one. Business vocabulary is not established; exact `exceptions` filter. |

For all-repairs totals, include truckless rows. For truck or truck-owner breakdowns, exclude truckless rows, and never attach `Choice=Trailer` cost to an accompanying truck. Category totals may overlap, so do not add them to derive overall repair cost. The `type_of_work` API filter takes one complete category at most 100 characters, without a comma; matching is case-insensitive after trimming surrounding category spaces. API anchors: `truck`, `trailer`, `date_from`, or `ninox_id`; other supported filters are `date_to`, `company`, `choice`, `type_of_work`, `ahs`, `owner`, and `exceptions`. Never substitute `settlements.LTR Invoices` for this report.

## Governed departure totals (prepared schema 3.8.0)

Departure totals use the same inclusive `Out Date` window on **both** DriverPay and live Ninox Schedule_Teams. Normalize only truck-key format, union distinct nonblank trucks, and report source, overlap, source-only, and combined counts. Never add source counts, count assignment/driver rows, apply return exclusions, or use the returning-trucks formula. Use `departures` only after the deployed authenticated catalog confirms it; `out_schedule` is the planned list, not a combined total. See [departure contract](departures.md).

Preserve `reconciliation`, `truck_sets`, `period`, `status`, and `complete`; source failure means `complete=false`, `status=incomplete`, and `combined_distinct_total=null`. Both optional date bounds must be supplied together (maximum 31 inclusive days); omitting both defaults to Monday–Sunday in America/New_York. Repository preparation does not remove the installed-client **not integrated** limitation.
