# QualifyFlow engineering
- Read all four numbered specifications fully before app changes. Never alter them. 01 owns product/architecture, 02 v1.1 visuals/interaction, 03 behavior/state machines, 04 safety/reliability/release.
- Read docs/implementation/{IMPLEMENTATION_STATUS,CURRENT_CONTEXT,REQUIREMENTS_TRACEABILITY}.md and ADRs. Re-read relevant sections before each feature; revisit all four at milestone boundaries.
- Keep modular FastAPI monolith, separate worker, PostgreSQL/Alembic, React/TypeScript. Explain conflicts/deviations in an ADR.
- Enforce authorization in services using current tenant/branch memberships or explicit staff assignments. Platform provisioning authority never implies sensitive report access. Fail closed.
- Build persisted, audited vertical slices with recovery and meaningful tests. No disconnected controls, fabricated success or name-only matching.
- Follow DESIGN.md and design-system/qualifyflow/MASTER.md and canonical tokens. Prioritize accessibility, speed and reduced motion.
- Synthetic data only. No unapproved legal decisions, public deployment, remote push or real outbound messages.
- Update status, traceability, backlog and CURRENT_CONTEXT after significant work. Record executed tests and exact limitations. Never claim completion without exit evidence.
