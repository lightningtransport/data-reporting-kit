-- Read-only, role-scoped reporting access for authenticated team members.

create schema if not exists reporting;
revoke all on schema reporting from public, anon, authenticated;

alter table public.user_memberships
  drop constraint if exists user_memberships_role_check;
alter table public.user_memberships
  add constraint user_memberships_role_check
  check (role in ('viewer', 'finance', 'owner', 'admin'));

-- Keep raw PII and unrestricted ad-hoc reads limited to senior roles.
drop policy if exists members_read_driverpay on public."DriverPay";
create policy members_read_driverpay on public."DriverPay"
for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.organization_id = "DriverPay".organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

drop policy if exists members_read_drivers on public.drivers;
create policy members_read_drivers on public.drivers
for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.organization_id = drivers.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

drop policy if exists members_read_returns on public.returns;
create policy members_read_returns on public.returns
for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.organization_id = returns.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

drop policy if exists members_read_settlements on public.settlements;
create policy members_read_settlements on public.settlements
for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.organization_id = settlements.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('finance', 'owner', 'admin')
  )
);

drop policy if exists members_read_trucks on public.trucks;
create policy members_read_trucks on public.trucks
for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.organization_id = trucks.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

drop policy if exists members_read_organizations on public.organizations;
create policy members_read_organizations on public.organizations
for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists users_read_own_memberships on public.user_memberships;
create policy users_read_own_memberships on public.user_memberships
for select to authenticated
using (user_id = (select auth.uid()));

create index if not exists drivers_organization_id_idx on public.drivers (organization_id);
create index if not exists returns_organization_id_idx on public.returns (organization_id);
create index if not exists settlements_organization_id_idx on public.settlements (organization_id);
create index if not exists trucks_organization_id_idx on public.trucks (organization_id);

create table if not exists reporting.agent_query_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  user_id uuid,
  organization_id uuid,
  role text,
  report_name text not null,
  filters jsonb not null default '{}'::jsonb,
  row_count integer,
  outcome text not null check (outcome in ('success', 'denied', 'invalid')),
  created_at timestamptz not null default now()
);
alter table reporting.agent_query_audit enable row level security;
revoke all on table reporting.agent_query_audit from public, anon, authenticated;
create index if not exists agent_query_audit_created_at_idx
  on reporting.agent_query_audit (created_at desc);
create index if not exists agent_query_audit_user_id_idx
  on reporting.agent_query_audit (user_id, created_at desc);
