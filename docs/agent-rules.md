# Mandatory reporting rules for AI agents

These rules govern every answer derived from Lightning Transportation data. If a user request conflicts with them, explain the limitation rather than silently changing the definition.

## 1. Source and access

- Use the authenticated `reporting-query` Edge Function and one of its four allowlisted reports: `fleet_status`, `current_returns`, `driver_assignments`, or `settlement_summary`.
- A `viewer` may use operational reports; `finance`, `owner`, and `admin` may also use settlement summaries. The API enforces this.
- The standard reporting endpoint deliberately omits driver phone, email, CDL, DOB, and other protected fields. Do not try to recover them from a different source.
- A missing or denied response is not evidence that the underlying business fact is false. State the access or coverage limitation.

## 2. Date windows

- **Settlement week:** Tuesday through the following Monday. A period is identified by `settlements.From` (Tuesday) and `settlements.To` (Monday).
- **“Last settlement week”:** the most recently completed Tuesday–Monday period with populated financial fields—not the current incomplete period and not merely the latest row.
- **Operational departures/returns:** use Monday–Sunday only when a user asks for a week without defining another interval.
- **Driver departures:** filter `DriverPay.Out Date` only. **Historical driver returns:** filter `DriverPay.Return Date` only. Do not require both dates to be populated.
- **Current returns:** use `returns`, whose `Return Date` is free text. Only date-like values can be ranged; status/note/blank values must be reported separately if material.

## 3. Table grain and counting

- `trucks` is one current row per vehicle. It is a current-state master, not a historical ledger.
- `settlements` is one row per truck and settlement period. Filter both truck and period before treating a row as a single truck settlement.
- `DriverPay` is one row per driver assignment. A team truck normally produces two rows; count distinct `Truck_Number` only when the request is for trucks, not drivers or assignments.
- `returns` is operational driver/team-row data and can also contain two rows for one team truck. Do not call its row count a truck count without deduplication.
- Use IDs for joins where available. Names are display values and can repeat or change.

## 4. Financial definitions and double-counting controls

- `settlements.Gross` is total income before company percentage and expenses.
- `settlements.tonu` is already included in `Gross`; never add it to Gross.
- `settlements.Total Expenses` is the full expense total; never add component columns such as fuel, tolls, insurance, or driver pay to it again.
- `settlements.Net` is the stored net. Its business definition is `Gross_with_%_deduction_All − Total Expenses`; do not recompute it from `Gross` unless the question explicitly asks for a reconciliation.
- Attribute historic financial results with `settlements.Owner` and `settlements.Dispatch` from that same period—not `trucks.owner` or `trucks.dispatcher`, which are current values.
- For owner-assignment expense handling, truck numbers **1, 2, and 3 are accounting buckets, not physical trucks**: `1 = Carlos`, `2 = Jorge`, `3 = CDT`. When owner-level settlement work requires truck-loan or insurance allocations for physical trucks that have no corresponding rows, aggregate those expenses in their assigned bucket while charging them to that owner’s general settlement. Do not include those bucket IDs as fleet vehicles.

## 5. Calculation rules

- Driver pay must be calculated per driver assignment. Do not split a team amount unless the requester supplies a split rule.
- When the corresponding settlement's `Driven_miles` exceeds `DriverPay.Pay CPM after Miles`, the CPM increment is `CPM × (Driven_miles − Pay CPM after Miles)` in addition to `MoneyPerWeekSigned`.
- Distinguish `Gross`, `Gross_with_%_deduction_All`, and `Net`; they are different stages of the settlement calculation.

## 6. Required answer shape

Every answer must include: **source report/table; filters; exact period; result and row/distinct count; API freshness (`as_of`); and caveats**. For an empty result, say whether it means “no matching rows” or “coverage cannot be established.”
