-- Keep audit data private through RLS and revoked grants while making it writable by the Edge Function through the Data API.
alter table reporting.agent_query_audit set schema public;
alter table public.agent_query_audit enable row level security;
revoke all on table public.agent_query_audit from public, anon, authenticated;
