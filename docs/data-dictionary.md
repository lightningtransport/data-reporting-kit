# Data dictionary

**Live-schema verification:** 2026-09-10 against Supabase project `aaqquwhdglueqlnbifvn`. This inventory covers all eight current `public` tables and all 113 live columns. No PostgreSQL column comments exist in the live database, so definitions below are the reporting contract; fields explicitly marked **not established** must not be used for a business conclusion until their source-system owner defines them.

## Global conventions

- `ID` is the database surrogate key (`bigint` identity) for its own table. It is not a business truck number or Ninox ID.
- `organization_id` is the tenant key (`uuid`) to `organizations.id`. Every operational table is scoped by it.
- Current operational data is not historical data. Use the table whose grain and time model matches the question.
- Fields with spaces, punctuation, or capitalization must be quoted exactly in SQL/API field expressions.
- **PII** means the field is restricted and must not be returned in ordinary agent answers.

## `trucks` — current fleet master

**Grain:** one current row per physical vehicle. **Use for:** current fleet identity, current assignment, location, Samsara/connectivity, and mechanic state. **Do not use for:** historical ownership/dispatch or settlement attribution.

| Column (type) | Meaning / agent use |
|---|---|
| `ID` (bigint) | Database row identifier. |
| `truck_number` (numeric, unique) | Canonical physical-vehicle identifier; use to identify a current truck. Do not treat settlement accounting buckets `1`, `2`, or `3` as fleet vehicles. |
| `dispatcher` (text) | Current dispatcher/group assignment. |
| `insurance` (text) | Current truck insurance entity/label; not necessarily a monetary expense. |
| `vin` (text) | Vehicle Identification Number; sensitive vehicle identity. |
| `make` (text) | Vehicle manufacturer/make. |
| `model_year` (numeric) | Vehicle model year. |
| `license_plate` (text) | Current plate identifier; sensitive vehicle identity. |
| `odometer_miles` (numeric) | Current recorded odometer reading, not settlement-period driven miles. |
| `owner` (text) | Current owner assignment. |
| `last_known_address` (text) | Latest stored location/address; operationally sensitive. |
| `yard_location` (text) | Yard/location label for the current fleet record. |
| `samsara_last_connected_at` (timestamptz) | Timestamp of the last recorded Samsara connection. |
| `samsara_vehicle_id` (text) | Samsara vehicle-system identifier; use only after validating the source-system mapping. |
| `mechanic_status` (text) | Current mechanic/shop status. |
| `organization_id` (uuid) | Tenant/organization scope; foreign key to `organizations.id`. |

## `DriverPay` — driver assignment and pay-term history

**Grain:** one row per driver assignment, not one row per truck. A team commonly has two rows for the same `Truck_Number`. **Use for:** driver-to-truck history, departure/return events, and signed pay terms. **Sensitive:** contains PII; standard agent reporting returns only a selected non-contact subset.

| Column (type) | Meaning / agent use |
|---|---|
| `ID` (bigint) | Database row identifier. |
| `Truck_Number` (text) | Assigned truck identifier for this driver-assignment row. |
| `DriversDB_ID` (text) | Source driver identifier; match to `drivers.Ninox_ID` only after compatible type/value validation. |
| `Out Date` (date) | Assignment departure/out date; the sole date filter for “which trucks/drivers left?” |
| `Return Date` (date) | Assignment return date; the sole date filter for historical returns. |
| `Transfer` (text) | Source-system transfer indicator/status. Its value vocabulary is not established; do not infer a transfer event from a nonblank value alone. |
| `Transfer Date` (date) | Date recorded for a transfer event. |
| `Transfer Truck` (text) | Truck recorded as the transfer destination/source by the source system; direction is not established—do not infer it. |
| `Termination` (text) | Source-system termination indicator/status; value vocabulary is not established. |
| `Termination Date` (date) | Date recorded for a termination event. |
| `Solo_Driver_if_1` (numeric) | `1` identifies a solo assignment; other/null values do not establish team composition without checking companion rows. |
| `MoneyPerWeekSigned` (numeric) | Signed weekly pay amount for this assignment. |
| `MoneyPerDaysigned` (numeric) | Signed daily pay amount for this assignment. |
| `CPM` (numeric) | Signed cents/dollars-per-mile rate used only with the documented CPM threshold rule. |
| `Pay CPM after Miles` (numeric) | Driven-mile threshold above which CPM is added for the corresponding settlement week. |
| `Driver Name` (text) | Driver display name; PII. |
| `First Name` (text) | Driver given name; PII. |
| `Last Name` (text) | Driver family name; PII. |
| `E-mail` (text) | Driver email; PII, never return. |
| `Phone Number` (text) | Driver phone; PII, never return. |
| `CDL` (text) | Driver commercial-license value; sensitive, never return. |
| `State` (text) | State associated with the driver/license record; sensitive. |
| `owner` (text) | Historical owner context captured with this assignment record. |
| `Dispatch_Name_` (text) | Historical dispatch context captured with this assignment record. |
| `Samsara_ID` (text) | Source-system Samsara identifier; relationship target is not established, so do not use as a join key without validation. |
| `Temporal_Driver` (text) | Source-system temporary-driver marker/label; its semantics and value vocabulary are not established. |
| `organization_id` (uuid) | Tenant/organization scope. |

## `drivers` — driver master

**Grain:** one current driver profile row. **Use for:** owner/admin-only profile lookup and validated linkage from `DriverPay`. **Do not use for:** ordinary reporting; it is heavily PII-restricted.

| Column (type) | Meaning / agent use |
|---|---|
| `ID` (bigint) | Database row identifier. |
| `Ninox_ID` (numeric) | Legacy/source driver identifier; validated linkage candidate for `DriverPay.DriversDB_ID`. |
| `FullName` (text) | Full driver display name; PII. |
| `First Name` / `Middle Name` / `Last Name` (text) | Driver name components; PII. |
| `E-mail` (text) | Driver email; PII. |
| `Phone Number` (text) | Driver phone; PII. |
| `Years Of Experience` (numeric) | Reported driver experience in years. |
| `DOB` (date) | Date of birth; highly sensitive PII. |
| `Company Name (This is NOT the Insurance)` (text) | Company-name value from the driver source record; explicitly not an insurance field. |
| `CDL` (text) | Commercial driver license value; sensitive. |
| `State` (text) | State associated with the profile/license record. |
| `CDL Expiration` (text) | Source CDL-expiration value. It is stored as text, so do not perform date arithmetic until normalized/validated. |
| `Gender` (text) | Sensitive personal profile attribute. |
| `Insurance` (text) | Insurance label/value associated with the driver profile. |
| `organization_id` (uuid) | Tenant/organization scope. |

## `returns` — current return-status list

**Grain:** current operational driver/team row; a team can have two rows for one `Truck`. **Use for:** current return/yard-status activity. **Do not use for:** historical return-event counts (use `DriverPay.Return Date`).

| Column (type) | Meaning / agent use |
|---|---|
| `ID` (bigint) | Database row identifier. |
| `Ninox_ID` (numeric) | Legacy/source record identifier; not established as a cross-table key. |
| `Insurance` (text) | Insurance label recorded on the return entry. |
| `Truck` (text) | Truck identifier on this return-status row. |
| `Driver Name` (text) | Driver display name; PII. |
| `Phone Number` (text) | Driver phone; PII, never return. |
| `Return Date` (text) | Free-text return date/status/note. Parse only recognized date prefixes for date-range filtering; preserve non-date statuses and blanks as status data. |
| `organization_id` (uuid) | Tenant/organization scope. |

## `settlements` — weekly truck financial records

**Grain:** one row per truck per Tuesday–Monday settlement period. **Use for:** period-specific gross, expenses, net, miles, driver pay, and expense categories. **Critical:** historical `Owner` and `Dispatch` belong to this settlement row; never replace them with current `trucks` values.

| Column (type) | Meaning / agent use |
|---|---|
| `ID` (bigint) | Database row identifier. |
| `Truck` (text) | Settlement truck/accounting-bucket identifier for this period. |
| `truck_insurance` (text) | Truck-insurance label captured with this settlement row; not a monetary expense column. |
| `Dispatch` (text) | Dispatch/group attribution for this period. |
| `Owner` (text) | Owner attribution for this period. |
| `From` (date) | Settlement-period Tuesday start. |
| `To` (date) | Settlement-period Monday end. |
| `Gross` (numeric) | Total settlement income before company percentage and expenses. |
| `tonu` (numeric) | Tonnage income already included in `Gross`; never add it to Gross. |
| `%AppliedSaved` (numeric) | Applied company-percentage value for the row; do not assume its scale (for example, 0.15 vs 15) without a validated calculation context. |
| `Gross_with_%_deduction_All` (numeric) | Gross after the applicable company percentage; distinct from Gross and Net. |
| `Total Expenses` (numeric) | Full settlement expense total; do not add component expense columns to it again. |
| `Net` (numeric) | Stored net, defined as `Gross_with_%_deduction_All − Total Expenses`. |
| `Driven_miles` (numeric) | Miles driven in this settlement period; use for documented CPM calculation. |
| `Total Driver Pay` (numeric) | Total driver-pay expense for this settlement row. |
| `Fuel Expenses` (numeric) | Fuel component of settlement expenses; do not add it to `Total Expenses`. |
| `truck_loans` (numeric) | Truck-loan expense component; do not add it to `Total Expenses`. Apply the documented owner-assignment bucket rule when required. |
| `Otro` (numeric) | “Other” expense component; do not add it to `Total Expenses`. |
| `LTR Invoices` (numeric) | LTR-invoice expense component; do not add it to `Total Expenses`. |
| `Tolls` (numeric) | Toll expense component; do not add it to `Total Expenses`. |
| `BestPass` (numeric) | BestPass expense component; do not add it to `Total Expenses`. |
| `Insurance` (numeric) | Insurance expense component; do not add it to `Total Expenses`. Apply the documented owner-assignment bucket rule when required. |
| `CabCards` (numeric) | Cab-card expense component; do not add it to `Total Expenses`. |
| `Trailer Rentals` (numeric) | Trailer-rental expense component; do not add it to `Total Expenses`. |
| `samsara` (numeric) | Samsara expense component; do not add it to `Total Expenses`. |
| `PrePass` (numeric) | PrePass expense component; do not add it to `Total Expenses`. |
| `To Report` (text) | Current-cycle inclusion flag. Use only for current-cycle reporting; the API recognizes `Yes`, `true`, and `TRUE` when no settlement period is supplied. |
| `organization_id` (uuid) | Tenant/organization scope. |

## `organizations` — tenant master

**Grain:** one row per organization/tenant. This database currently has one organization.

| Column (type) | Meaning / agent use |
|---|---|
| `id` (uuid) | Canonical organization identifier; target of every operational `organization_id` foreign key. |
| `name` (text, unique) | Organization display/name value. |
| `created_at` (timestamptz) | Organization-record creation timestamp. |

## `user_memberships` — reporting authorization

**Grain:** one role assignment per `(user_id, organization_id)` pair. This is the immediate reporting-access revocation point.

| Column (type) | Meaning / agent use |
|---|---|
| `user_id` (uuid) | Supabase Auth user UUID; part of the composite primary key. |
| `organization_id` (uuid) | Organization UUID; part of the composite primary key. |
| `role` (text) | Approved role: `viewer`, `finance`, `owner`, or `admin`. Determines reporting authorization. |
| `created_at` (timestamptz) | Membership-record creation timestamp. |

## `agent_query_audit` — reporting request audit log

**Grain:** one reporting API request attempt. This table is private; client roles cannot read it. **Do not use it for business reporting.**

| Column (type) | Meaning / agent use |
|---|---|
| `id` (bigint) | Immutable database identity generated for the audit row. |
| `request_id` (uuid) | Correlation ID returned by the reporting API for this request. |
| `user_id` (uuid, nullable) | Authenticated caller UUID when available. |
| `organization_id` (uuid, nullable) | Caller organization UUID when membership was resolved. |
| `role` (text, nullable) | Caller role when membership was resolved. |
| `report_name` (text) | Requested allowlisted report name. |
| `filters` (jsonb) | Request filter object as received by the endpoint. |
| `row_count` (integer, nullable) | Number of rows returned for a successful request. |
| `outcome` (text) | `success`, `denied`, or `invalid` request outcome. |
| `created_at` (timestamptz) | Audit-event timestamp. |

## Approved API projections

The API does **not** expose every physical column. `fleet_status` returns selected current truck fields; `current_returns` excludes phone numbers; `driver_assignments` excludes contact/license fields; `settlement_summary` returns the core settlement fields. See `api/openapi.yaml` for accepted filters and `docs/question-routing.md` for when to use each report.
