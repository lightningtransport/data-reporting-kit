-- Satisfy RLS policy coverage without exposing audit records to any client role.
create index if not exists user_memberships_organization_id_idx
  on public.user_memberships (organization_id);

drop policy if exists no_client_access_to_agent_query_audit on public.agent_query_audit;
create policy no_client_access_to_agent_query_audit
  on public.agent_query_audit
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);
