# Current permission model
Active account/unexpired opaque session, MFA if enrolled, origin and CSRF on mutations. Reload current grants, never embed permanent roles in sessions.

| Grant | Current abilities | Limits |
|---|---|---|
| service_admin | Provision organizational metadata/configuration/branches/users/assignments/audit | No implicit driver/document access |
| specialist assignment | Assigned company metadata/scoped branches | Current dates/status, no unassigned company |
| client_admin | Metadata/branches/users/audit | Whole-company grant for administration; MFA to activate; no platform roles |
| contributor/viewer | Metadata and allowed branches | No administration |
| reviewer | Metadata/audit if whole-company | Employer-reserved approvals not yet implemented |

Separate memberships and staff assignments; composite keys prevent foreign-tenant branch grants. No self-promotion; preserve last company admin. Domain services enforce tenant locks/version checks. PostgreSQL trigger rejects audit updates/deletes; production needs segregated database roles and protected sink.

Pending: configurable granular permissions/approval policies, recent-MFA step-up, recovery, idle timeout, account disable administration UI and later resource permissions. Current capability catalog is initial RBAC, not full authorization completion.
