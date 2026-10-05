-- The view was recreated after the original application grant. Restore the
-- read-only service principal access required by agent-reporting.
grant usage on schema reporting to service_role;
grant select on reporting.settlement_summary to service_role;
