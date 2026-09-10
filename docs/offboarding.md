# Onboarding and offboarding

## Onboard a team member

1. Create or invite the person in Supabase Auth using their company email.
2. Obtain the Auth user UUID.
3. Insert one `public.user_memberships` row for the Lightning Transportation organization with the approved role (`viewer`, `finance`, `owner`, or `admin`).
4. Add the person to the GitHub team that can read this private repository.
5. Have the person authenticate from their own agent environment. Never copy another employee's session, password, refresh token, or service key.
6. Test `POST /functions/v1/reporting-query` with `report: fleet_status`; confirm an audit record is created.

## Offboard a team member

1. Delete their `public.user_memberships` row. The reporting function checks membership on every request, so this blocks new requests immediately.
2. In Supabase Auth, ban/delete the user and revoke their active sessions. Existing access JWTs remain valid only until their configured expiry, but the missing membership also denies the reporting endpoint now.
3. Remove the person from the GitHub Team/repository.
4. Revoke any third-party agent integration token they personally configured.
5. Review `public.agent_query_audit` for recent requests and preserve it under company retention policy.

## Provisioning SQL

Run only from an administrator-controlled environment after confirming the user UUID and organization ID.

```sql
insert into public.user_memberships (user_id, organization_id, role)
values ('AUTH_USER_UUID', '00000000-0000-0000-0000-000000000001', 'viewer');

-- Immediate reporting-access revocation
delete from public.user_memberships
where user_id = 'AUTH_USER_UUID'
  and organization_id = '00000000-0000-0000-0000-000000000001';
```
