# Synthetic onboarding and access operations
Owner: local developer/service administrator. Prerequisites: isolated database/migrations, local API/frontend/SMTP sink, explicitly provisioned MFA service admin and specialist. No production recipients or driver records.

1. Create company using legal/display name, unique customer reference, mode, timezone, region, contact/effective date. Verify draft persists after returning to company list.
2. Add branches. Same display name in another company is distinct. Never substitute a name for its ID.
3. Save responsibility policy reference/intake/review owners and integration prerequisite. It is a synthetic administrative reference, not legal policy approval. Required integration intentionally blocks activation until M5 verification exists.
4. Assign eligible specialist for managed/hybrid mode. Current implementation has no driver/intake tasks yet, so no task handoff is implied. End assignment immediately removes subsequent company access.
5. Invite whole-company administrator; invitation is queued, not active access. Run local worker, inspect SMTP sink. Recipient opens fragment link, sets password/MFA and accepts. Existing users sign in as exact invited account first.
6. Review readiness and configuration, enter rationale, then activate with a separate explicit command. Version conflict means refresh; do not retry blind writes. Missing prerequisites remain visible.
7. Client signs in and sees only authorized company/branches. Client admins manage permitted invitations/memberships; no platform-role assignment.
8. Revoke membership or assignment with reason; API denies subsequent access despite cached UI. Keep a second active company admin before revoking the last one. Ordinary account disable administration and recovery remain backlog.

Failure/recovery: send_failed persists and is retried within bounded backoff; resend rotates token and cancels unsent old outbox entries; expired/revoked/used invitation rejected. Failed invite never deletes company. Suspended company blocks new invitations/writes; read-only history retained. Reactivation rechecks prerequisites. No hard deletion.

Postconditions: actual tenant/branch/grant state and immutable audit history; current permission checks; SMTP status never called delivered/read. Rollback uses explicit suspension/revocation and preserves evidence/history. Real-customer communication requires separately approved policy and production readiness gates.
