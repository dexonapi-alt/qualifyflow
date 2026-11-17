# Initial threat model
Risks: cross-tenant IDOR/branch escalation, platform-wide report access, invite replay/takeover, revoked sessions retaining access, secret leaks, concurrent updates, lost delivery.

Controls: tenant predicates, relationship authorization, branch checks, role allowlists, hashed single-use invites with authenticated existing-account acceptance, opaque sessions/CSRF/origin/TOTP/encrypted seeds, atomic audit/outbox. Test direct API attacks. Later: RLS/nonowner DB role, distributed rate limits, recovery, scan/private storage, webhook replay, recipients, vault, restore/independent reviews. Synthetic only; not production-ready.
