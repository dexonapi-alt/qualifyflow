## Current: cohesive managed-product workspace — 2026-11-17

Owner approved the major visual improvement and requested a focused final density/contrast correction. Implemented: compact real totals; one wide three-driver preview; two balanced attention/service sections; functional View all actions; collapsed team/recent activity; consistent16px spacing; #111111 primary ink/white canvas with gray for supporting text. ADR-0017 supersedes earlier shell freezes. Latest owner instruction resumed verification, overriding the older testing pause. No new milestone started in the final correction.

Shared role-oriented ProductSidebar/ProductHeader, ManagedOverview and managed-product.css replace feature-led navigation/duplicate operational company tabs. Header search/switching/register/request/account actions are real; native mobile drawer. Company administration keeps M1 tabs. New GET /api/v1/tenants/{id}/workspace aggregates current tenant/branch grants, drivers/current requirement reviews, assigned staff, current requests/decisions and review activity. Provisioning remains metadata-only; viewers do not receive file aggregates. No fake metrics/photos/activity or compliance claims.

Previously unrecorded slices now present: encrypted private local evidence storage, actual Windows Defender/ClamAV adapters and separate scan worker, requirement definitions/instances, immutable evidence/reviews/intake attachments; client-approved in-app request policy/recipients, exact approvals, durable publish/reply/history. Migrations 2c16a69f5206 ->1c534a4c5d58 ->aca16001 follow7422a7ea5d93; applied local development and isolated UI QA. No migration added for final UI correction. ADR0015/0016 and runbooks/security docs record boundaries. Source-only case restriction remains: no missing-requirement-only follow-up case yet.

Executed: production frontend build passed,5 frontend tests;43 existing backend tests plus3 new workspace tests passed separately; Ruff app passed. Browser36 page/viewport cases at375/768/1024/1440: zero axe violations, page overflow, failed API requests or page errors. Additional assertions passed: keyboard disclosure, reduced motion, native mobile Escape, account/sign-out and session401. Actual QA-only HTTP/worker journey exercised uploads, Defender scans, reviewed evidence, receipt routing and approved in-app publication. This is not full adversarial evidence/message coverage or milestone completion. Full older onboarding browser script still needs updated shell selectors and rerun. One existing Starlette/httpx deprecation warning.

Design/QA: docs/design/MANAGED_PRODUCT_EXPERIENCE.md and docs/design/managed-product/index.html/results.json. Historical captures are not exact same-fixture before/after evidence. Original four specifications unchanged. Synthetic data only, no remote push/public deploy/external outbound.

Next: review this composition; close private-evidence/correspondence adversarial/recovery coverage and full onboarding browser regression, then finish remaining M2/M3/M4 exit criteria. Provider/API management, external delivery/reminders/automation, S3/MinIO and production scanner provisioning remain pending. Do not call platform team/production-ready.

---

Earlier chronological notes (superseded where they conflict with the current entry):

# Implementation plan
Full initial review 2026-11-17: 01 lines 1–763, 02 lines 1–916, 03 lines 1–1209, 04 lines 1–1024. All read in bounded UTF-8 sections. Product/design/behavior/safety remain separate authorities. AC and SEC IDs drive verification.

## Architecture and dependency order
FastAPI modular monolith, SQLAlchemy 2 transactions, PostgreSQL/Alembic, React/TypeScript/Vite and semantic CSS. Separate Celery/Redis worker; transactional outbox retains pending delivery. Private S3/MinIO quarantine/evidence in M2. Local SMTP sink; production disabled. See ADRs.

| Milestone | Modules and migration plan | Exit evidence |
|---|---|---|
| M0 | Config, health, Compose, CI, design artifacts, migrations/test tools | Reproducible bootstrap, executed checks |
| M1 | auth, organizations, audit; 0001 users/sessions/tenants/branches/memberships/invites/assignments/audit/outbox | Company/branch/invite/assignment/activation through UI and API; two isolated tenants |
| M2 | drivers, qualification, documents; identities/engagement history/policy versions/requirements/immutable evidence/reviews | Correct driver links, private scanned evidence/access/version tests |
| M3 | screening_intake, exceptions; source/normalized item/batch/row/result/case/task/history | Mixed batch, safe review/attachment, replay/concurrency tests |
| M4 | approvals, notifications, portal requests; decisions/policy/template/message/delivery versions | Authorized exact-version decisions and safe recipient/delivery recovery |
| M5 | integrations, automation; connections/secret refs/mappings/events/runs/service keys/usage/rule versions/jobs | Actual signed simulator transport, scopes/rotation/replay/backoff/dry-run gates |
| M6 | reporting/exports/operations; export jobs/holds/retention | Load/restore/fault drills, security/privacy/legal review, pilot approvals |

Frontend: operations company/onboarding and client account/users first; then intake table, evidence comparison, driver file, exception timeline, approval requests, connection diagnostics and automation. Expose only functional routes.

Provider adapters implement config/test/pull/webhook/normalize/health, never eligibility. Tenant-bound secrets, mapping versions, cursors and durable dedupe from start. Local simulator first; commercial connectors require docs/contracts/credentials. Client API keys remain distinct from provider secrets. Approved endpoint catalog prevents SSRF.

Tests: pytest against isolated PostgreSQL and actual migrations; validation, role/tenant/branch attacks, state/replay/concurrency. Browser E2E uses real API/database; component tests for form failures/loading. Add storage/queue/adapter fault tests with each slice. CI: migrate, backend tests, TS/build, browser tests. No invented results.

External: Docker unavailable on PATH; PostgreSQL 18 tools available. Isolated cluster avoids existing databases. Production IdP/hosting/regions/contracts, legal policies, real mail/provider credentials, RPO/RTO/support owners remain unresolved; synthetic work proceeds.

## M2 execution split

M2a driver registry is implemented: migration27b7e811a6d9, private identities, scoped engagements, idempotency, state/history, transfer and reviewed correction. This does not satisfy all M2 exit criteria. M2b follows with versioned policies/requirements and private S3 quarantine, scan/retry/recovery, evidence versions and review/access. Duplicate investigation cases and controlled merge/archive remain tracked. Preserve ADR-0010/0011 visuals and ADR-0012 authorization boundary.

## Owner-directed M3 sequencing change

ADR-0013: proceed to M3 while M2 evidence/requirements remain unfinished; testing stopped by owner. Initial synchronous bounded metadata preview/confirmed receipt is implemented but unverified. No accepted attachment path exists until M2 prerequisites. Next dependencies: durable jobs/recovery, exception/task lifecycle, safe row correction/replay, simulator transport, reviewed matching and evidence association. Do not count initial receipts as full M3 exit evidence.

## M3/M4 continuation

ADR-0014: M3 durable metadata-to-exception routing and task/state/note workspace implemented; M4 exact-version employer administrative approval slice implemented. No exit verification because testing is stopped by owner. Sidebar exposes actual company-context modules. Next M4 versioned communication policy, approved recipient selection and in-app delivery lifecycle. Private evidence/requirements, simulator/transport, CSV correction/mapping, review/attachment, SLA/escalation and full regression evidence remain open. No milestone is complete from these slices alone.
