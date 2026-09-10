# Metric definitions

## Settlement metrics

| Metric | Definition | Source |
|---|---|---|
| Gross | Total settlement income before company percentage and expenses. | `settlements.Gross` |
| Total expenses | Full settlement expense total. Do not add individual categories again. | `settlements.Total Expenses` |
| Net | `Gross_with_%_deduction_All − Total Expenses`. | `settlements.Net` |
| Gross after percentage | Gross after `%AppliedSaved` is applied. It is not the same as Gross or Net. | `settlements.Gross_with_%_deduction_All` |
| Tonnage income | Income included in Gross along with loads. | `settlements.tonu` |
| Current reporting scope | Latest active cycle only. | `settlements.To Report` = `Yes` / `true` |

For settlement totals, use `From` as the Tuesday beginning of the reporting week and `To` as the following Monday. Attribute a historical settlement by its own `Owner` and `Dispatch` fields, never by current truck-master values.

## Operational metrics

| Metric | Definition | Source |
|---|---|---|
| Trucks leaving | Distinct `DriverPay.Truck_Number` with `Out Date` in range. | `DriverPay` |
| Trucks returning | Distinct `DriverPay.Truck_Number` with `Return Date` in range. | `DriverPay` |
| Current returns | Current operational return/status list; dates require parsing. | `returns` |
| Current fleet assignment | Current owner/dispatcher/mechanic/fleet metadata. | `trucks` |

## Driver pay calculation

Start with `MoneyPerWeekSigned`. If `Driven_miles` exceeds `Pay CPM after Miles` in the corresponding settlement week, add:

```text
CPM × (Driven_miles − Pay CPM after Miles)
```

Calculate each driver's assignment separately. Do not divide team pay unless the requester explicitly defines a split.
