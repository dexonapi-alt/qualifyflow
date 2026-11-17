# Foundation API and schema
OpenAPI is generated from running FastAPI at /docs and /openapi.json. No undocumented placeholder endpoints are counted as delivered.

| Group | Actual endpoints under /api/v1 | Authorization |
|---|---|---|
| Health | GET /health/live, /health/ready | Public; no sensitive metadata |
| Authentication | POST /auth/login, /auth/logout; GET /auth/me | Origin on login; session/CSRF for logout |
| Invitation recipient | POST /invitations/mfa-setup, /invitations/accept | Protected invitation bearer; origin; matching session+CSRF for existing account |
| Companies | GET/POST /tenants; GET /tenants/{id} | Current scope; creation service_admin only |
| Onboarding | POST /tenants/{id}/configuration, /review, /activate, /suspend | Service admin, version and explicit state guards |
| Branches | POST /tenants/{id}/branches | Whole-company administrative authority |
| Invites | GET/POST /tenants/{id}/invitations; POST /{invite_id}/resend or /revoke | Whole-company user administration; no raw token returned |
| Memberships | GET /tenants/{id}/memberships; POST /{membership_id}/change | Scoped administration, no self-change/last-admin orphan |
| Staff | GET /staff | Service admin metadata only |
| Assignments | GET/POST /tenants/{id}/operator-assignments; POST /{assignment_id}/end | Service administration; eligible MFA staff |
| Audit | GET /tenants/{id}/audit-events | Scoped whole-company audit grant |

Migration d117fea3fb4e: users, sessions, tenants, branches, memberships, operator_assignments, invitations, audit_events, outbox. Composite branch/tenant FKs, unique customer refs and per-company memberships/assignments. No driver or provider records yet.

Migration e2a40001: PostgreSQL function/trigger rejects audit updates/deletes. Application owner/superuser can still alter schema; production requires restricted runtime database roles and independently protected audit retention. No RLS completion claimed.

Mutations commit with audit and invitation outbox in a single PostgreSQL transaction. Company configuration is recorded before/after with version and rationale. Tenant first, then invitation, then outbox lock order serializes acceptance/resend/delivery. Responses whitelist fields; passwords/seeds/invitation hashes/encrypted payload never appear in administrative APIs. Error envelopes suppress raw validation inputs and database details, include correlation IDs.
