# Onboarding and offboarding

## Approved AI service agent

### Onboard

1. Assign one new sequential `AGENT_API_KEY_<n>` secret; never reuse another agent's value.
2. Optionally set matching controls: `AGENT_ORGANIZATION_ID_<n>`, `AGENT_REPORTS_<n>`, `AGENT_ROLE_<n>`, `AGENT_EXPIRES_AT_<n>`, and `AGENT_ALLOW_SENSITIVE_<n>`.
3. By default, the key has full read access to all six approved reports and their explicit sensitive-field allowlists. Set `AGENT_ALLOW_SENSITIVE_<n>=false` only when a particular key needs to be restricted.
4. Give the key once through an approved private channel; never commit or log it.
5. Test `report=catalog`, one allowed data query, one disallowed/sensitive query, and an invalid key.
6. Confirm `public.agent_query_audit` contains the authorized data request under the key identifier and no secret value.

### Offboard or rotate

1. Remove the exact `AGENT_API_KEY_<n>` secret and its matching control secrets.
2. Confirm the old key returns `401` and another active key still works.
3. Review recent `agent_query_audit` entries for that key identifier.
4. Remove any agent-local copy, scheduler, or integration credential.
5. Issue a new sequential key rather than restoring the revoked value when rotating.

## Individual Supabase Auth member

Personal onboarding is paused until approved Auth email/SMTP delivery is configured.

### Onboard when enabled

1. Invite the person in Supabase Auth using their company email.
2. Insert one `public.user_memberships` row with the approved role (`viewer`, `finance`, `owner`, or `admin`).
3. Have the person authenticate from their own environment. Never copy another employee's session, password, refresh token, or service key.
4. Test `POST /functions/v1/reporting-query` and confirm an audit record.

### Offboard

1. Delete the `user_memberships` row to block new reporting requests immediately.
2. Ban/delete the Auth user and revoke active sessions.
3. Revoke personally configured integrations.
4. Review `agent_query_audit` under the retention policy.

## Membership SQL

Run only from an administrator-controlled environment after confirming the user and organization UUIDs.

```sql
insert into public.user_memberships (user_id, organization_id, role)
values ('AUTH_USER_UUID', 'ORGANIZATION_UUID', 'viewer');

delete from public.user_memberships
where user_id = 'AUTH_USER_UUID'
  and organization_id = 'ORGANIZATION_UUID';
```
