-- Allow backend Edge Functions using the service-role/secret-key role to append audit events.
-- Client roles retain no table grants and the restrictive authenticated policy remains unchanged.
grant insert on table public.agent_query_audit to service_role;
grant usage, select on sequence public.agent_query_audit_id_seq to service_role;
