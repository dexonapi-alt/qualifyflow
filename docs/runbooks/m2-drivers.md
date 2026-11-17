# Test the driver workspace

Open http://localhost:5173 and sign in using your existing synthetic account. Follow [the manual testing guide](manual-testing.md) for invitations and MFA; use the current six-digit authenticator code, not the enrollment secret.

1. Open Company access, select the company and choose Drivers. This destination appears only for an actual client membership or assigned staff driver grant. Provisioning administration alone does not grant access.
2. Register a synthetic driver with a unique uppercase company reference, first/last name, start date and an authorized location. Do not enter real driver PII. Same-name records remain separate; reference conflicts require investigation.
3. Search by reference or name and filter operational state. Open the persisted record; refresh or reload to confirm persistence.
4. Under Manage engagement, apply an allowed operational transition with a reason. Active does not mean legally compliant. Future activation before the start date and future completion dates are rejected.
5. With whole-company correction authority, transfer to another real company location. Use an effective date that has occurred. The former engagement remains visible and a new one is created. After an engagement ends, authorized whole-company writers can create a new engagement through the rehire flow.
6. Under Identity correction, provide the verified basis and reason. The previous identity is preserved in restricted history. Open Record history to inspect actor, timestamp, reason and change details; load older events when available.

Client administrators/contributors and assigned specialists/reviewers can write within their actual scope; viewers read only. Whole-company client administrators and assigned reviewers can correct/transfer and access full history. Backend checks current grants on every request. Revoked membership, another tenant, another branch or a wrong-driver engagement cannot be used to bypass the boundary.

Private documents and qualification requirements are the next M2 slice; there are no pretend upload controls. Continue using synthetic records only. Existing M1 company, location, invitation, MFA and account-menu logout behavior remains available.

## API and persistence

Migration: `27b7e811a6d9`, parent `e2a40001`. Tables: driver identities, engagements, history and command receipts. Apply through the normal Alembic upgrade command; do not reset existing data.

Under `/api/v1/tenants/{tenant_id}/drivers`: GET roster, POST registration, POST `/search`, GET `/{driver_id}`, GET `/{driver_id}/history`, POST `/{driver_id}/corrections`, POST `/{driver_id}/engagements`, and POST `/{driver_id}/engagements/{engagement_id}/state` or `/transfer`. Search terms travel in an authenticated body, not query URLs. Creation requires a stable command UUID; changed payload under the same command is rejected.

Local development runs on PostgreSQL port 55432. Browser QA uses the separate `qualifyflow_ui_test` database and ports 5174/8001. Credentials remain in ignored local files. Never run test seeding against the development or production database.
