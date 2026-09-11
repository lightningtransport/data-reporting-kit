# Question routing and analysis rules

Read `AGENTS.md` first. Use the smallest `agent-reporting` report that answers the question, then consult `?report=<name>&metadata=true` for the current runtime contract.

| User question | `agent-reporting` report | Required filters / analysis |
|---|---|---|
| Current truck facts or fleet list | `trucks` | Use current owner/dispatcher/mechanic fields only. Set `physical_only=true` for physical-fleet counts. |
| Who/trucks are expected to return? | `returns` | Inclusive `return_from`/`return_to`. Count distinct `Truck` for trucks; rows represent drivers. |
| Historical assignment for a truck/driver | `driver_pay` | Anchor with `truck_number` or `driver_id`; review dates, transfers, and terminations. |
| Which trucks left in a period? | `driver_pay` | Filter `out_from`/`out_to` only; count distinct `Truck_Number`. |
| Which trucks returned historically? | `driver_pay` | Filter `return_from`/`return_to` only; count distinct `Truck_Number`. |
| Weekly headline gross/expense/net | `settlement_summary` | Supply `period_from` (and normally the same Tuesday in `period_to`) or a truck. |
| Full weekly expenses/components | `settlements` | Supply `period_from` or truck; use explicit period for owner/dispatch totals. |
| Current driver profile | `drivers` | Prefer exact `driver_id`; use name only for discovery. Sensitive fields require explicit user need and authorized key. |
| Planned teams/departures | unsupported | Requires live Ninox Schedule_Teams; do not substitute DriverPay history. |
| Exact trucks in yard/off duty/on road | unsupported | Supabase lacks `days_in_yard_` and numeric insurance-choice fields required by the Ninox definition. |

## Date rules

- Settlements: Tuesday `From` through the following Monday `To`. Use an exact Tuesday period anchor. Do not infer current cycle from `To Report` alone.
- DriverPay departures: use only `Out Date` unless another date is explicitly requested.
- DriverPay historical returns: use only `Return Date` unless another date is explicitly requested.
- Current expected returns: use nullable `returns.Return Date` directly as an ISO date.
- A populated row does not prove financial completion; check the requested metric for null values.

## Cardinality and join rules

- `DriverPay` and `returns` are driver-row sources. Deduplicate truck identifiers for truck counts.
- `settlements` is truck-or-bucket/week grain. Filter by `Truck` plus period for one row.
- Settlement Trucks 1, 2, and 3 are Carlos/Jorge/CDT allocation buckets. Include them in owner general totals; exclude them from physical-truck rankings.
- Normalize `DriverPay.DriversDB_ID` text against `drivers.Ninox_ID` numeric.
- `returns.Ninox_ID` is not a driver join key.
- Left-join historical rows to current `trucks`; history can contain retired/missing current-master numbers.

## Pagination

For complete totals or lists, follow `next_offset` until `has_more=false`. `count` and `page_count` are the current page; `total_count` is the filtered total.

## Answer format

State source report/table, normalized filters, exact period, result and row/distinct count, `as_of`, source-freshness limitation, and material grain/null/bucket/join caveats.
