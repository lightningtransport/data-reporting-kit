-- Preserve the historical primary owner and expose the supplemental owner-attribution key.
-- No dependent database objects exist; recreating is required to insert a view column.
drop view reporting.settlement_summary;

create view reporting.settlement_summary as
select
  "ID" as settlement_id,
  "Truck" as truck,
  "Owner" as owner,
  shared_owner,
  "From" as period_from,
  "To" as period_to,
  "Gross" as gross,
  "Total Expenses" as total_expenses,
  "Net" as net,
  "Total Driver Pay" as total_driver_pay,
  "Fuel Expenses" as fuel_expenses,
  "Driven_miles" as driven_miles
from public.settlements;
