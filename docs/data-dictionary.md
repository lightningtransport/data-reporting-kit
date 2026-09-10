# Data dictionary

Live inventory captured from the Supabase `public` schema. All operational business tables use `organization_id` for tenancy and RLS filtering.

## `trucks` — current fleet master

One current row per vehicle. Use for current truck facts, current owner/dispatcher, mechanical status, and current location metadata—not historical settlement ownership.

| Key fields | Meaning |
|---|---|
| `truck_number` | Canonical truck identifier. |
| `dispatcher`, `owner`, `insurance` | Current assignment/entity/insurance. |
| `vin`, `make`, `model_year`, `license_plate` | Vehicle identity. |
| `odometer_miles`, `yard_location`, `samsara_last_connected_at`, `samsara_vehicle_id` | Operational/Samsara data. |
| `mechanic_status` | Current mechanic/shop status. |

## `DriverPay` — driver assignment and pay history

One row per driver assignment, so team trucks commonly have two rows. Use `Out Date` for departures and `Return Date` for returns. Do not count rows as trucks.

| Key fields | Meaning |
|---|---|
| `Truck_Number`, `DriversDB_ID` | Truck and driver linkage. |
| `Out Date`, `Return Date` | Departure and return dates. Filter one or the other according to the question; do not require both. |
| `Solo_Driver_if_1` | `1` identifies a solo assignment. |
| `MoneyPerWeekSigned`, `MoneyPerDaysigned`, `CPM`, `Pay CPM after Miles` | Pay terms. |
| `Transfer`, `Transfer Date`, `Transfer Truck`, `Termination`, `Termination Date` | Assignment changes. |
| `owner`, `Dispatch_Name_` | Historical owner and dispatch context for this record. |

Contains personal/contact/license data. It is not returned by the standard agent reporting endpoint.

## `drivers` — driver master

Current driver profiles. Match to `DriverPay.DriversDB_ID` using `Ninox_ID`. It contains contact, CDL, DOB, and other sensitive information and is restricted to direct organization owners/admins.

## `returns` — current return status

Operational list of teams/trucks that are returning or in yard status. A team can have two rows. `Return Date` may be a date, a date plus note, a status such as `Ready To Go`, or blank. Standard reports exclude phone numbers.

## `settlements` — weekly truck financial records

One row per truck per Tuesday–Monday settlement period. Use this table for weekly gross, expenses, net, miles, driver pay, and expense categories.

| Key fields | Meaning |
|---|---|
| `Truck`, `Dispatch`, `Owner` | Truck and period-specific ownership/dispatch. |
| `From`, `To` | Tuesday start and Monday end. |
| `Gross`, `Total Expenses`, `Net` | Primary financial totals. |
| `tonu` | Income included in Gross. |
| `To Report` | Current-cycle inclusion flag; apply for current-cycle reporting only. |
| `Gross_with_%_deduction_All`, `%AppliedSaved` | Gross after the company percentage calculation and the percentage. |
| `Driven_miles`, `Total Driver Pay`, `Fuel Expenses` | Operational and expense metrics. |

## Tenancy and access tables

- `organizations`: company/tenant identity.
- `user_memberships`: grants a Supabase Auth `user_id` a role in an `organization_id`. It is the immediate revocation point for reporting access.
