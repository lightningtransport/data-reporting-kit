# Question routing and analysis rules

Use the smallest approved report that answers the question. Never substitute a similar-looking metric.

| User question | Report | Required filters / analysis |
|---|---|---|
| “What is the current fleet status?” | `fleet_status` | Optional truck, owner, dispatcher, or mechanic-status filters. Current facts only. |
| “Who is returning this week?” | `current_returns` | Filter only parseable return dates in the requested range. Report status/blank records separately. Deduplicate trucks only when the question asks for truck count. |
| “Who is assigned to truck 123?” | `driver_assignments` | Filter `truck_number`; use relevant `out_from`/`out_to` window for historical context. A team has two rows. |
| “What did we gross/net last settlement week?” | `settlement_summary` | Use Tuesday–Monday. “Last week” means the most recently completed Tuesday–Monday period unless specified. |
| “Gross or net by owner/dispatch?” | `settlement_summary` | Supply the completed settlement period and group by owner/dispatch in analysis. Do not use current `trucks.owner` for historical settlement attribution. |
| “Which trucks left?” | `driver_assignments` | Filter `Out Date` only. Count distinct `Truck_Number` when asked for trucks. |
| “Which trucks returned?” | `driver_assignments` or `current_returns` | Historical answer: `Return Date` only in `DriverPay`. Current operational list: `returns`. |

## Date rules

- Settlement reporting: Tuesday through the following Monday.
- Departure and return weekly reporting: Monday through Sunday unless the requester specifies another interval.
- Do not call a settlement period complete merely because rows exist. Financial fields must be populated.

## Cardinality rules

- `DriverPay` is driver-level. A two-driver team creates two rows for one truck.
- `returns` can also contain two driver rows for one team truck.
- `settlements` is truck-week level; filter by both truck and period for a single settlement.
- Prefer IDs over names for joins. Names are display values and may be duplicated.

## Answer format

Every answer must name: source report/table, filters, exact period, total/row count as applicable, data freshness, and material caveats.
