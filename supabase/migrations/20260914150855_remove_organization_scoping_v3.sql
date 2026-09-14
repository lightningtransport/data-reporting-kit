-- Remove the retired organization-scoping model from the reporting database.
set lock_timeout = '5s';

-- Rebuild the dependent view without organization_id and retain its application grant.
drop view if exists reporting.settlement_summary;
create view reporting.settlement_summary as
select
  "ID" as settlement_id,
  "Truck" as truck,
  "Owner" as owner,
  "From" as period_from,
  "To" as period_to,
  "Gross" as gross,
  "Total Expenses" as total_expenses,
  "Net" as net,
  "Total Driver Pay" as total_driver_pay,
  "Fuel Expenses" as fuel_expenses,
  "Driven_miles" as driven_miles
from public.settlements;
grant select on reporting.settlement_summary to service_role;

-- These policies referenced organization_id.
drop policy if exists "members_read_driverpay" on public."DriverPay";
drop policy if exists "members_read_drivers" on public.drivers;
drop policy if exists "members_read_returns" on public.returns;
drop policy if exists "members_read_settlements" on public.settlements;
drop policy if exists "members_read_trucks" on public.trucks;
drop policy if exists "members_read_organizations" on public.organizations;

alter table public."DriverPay" drop column if exists organization_id;
alter table public.agent_query_audit drop column if exists organization_id;
alter table public.drivers drop column if exists organization_id;
alter table public.returns drop column if exists organization_id;
alter table public.settlements drop column if exists organization_id;
alter table public.trucks drop column if exists organization_id;

alter table public.user_memberships
  drop constraint if exists user_memberships_pkey,
  drop column if exists organization_id,
  add constraint user_memberships_pkey primary key (user_id);

drop table if exists public.organizations;
