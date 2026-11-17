## Latest: compact driver preview and employee access

Removed per-row explanatory sentence and full driver-panel footer. Keep status and labeled file action; review queue remains client Driver files / employee Review queue navigation. File-level administrative/legal context remains in QualificationFile, not the overview table. Frontend build and9 unit tests passed. Actual browser checks:4 client widths375/768/1024/1440 plus employee375/1440, zero axe/overflow/API/page errors; real file navigation and restricted activation checks passed. Desktop client/employee captures visually inspected. No backend/API/migration change.

Employee walkthrough: docs/runbooks/employee-view.md. Both local demo-admin@example.com/service_admin and demo-specialist@example.com/specialist confirmed active by read-only development query; specialist has no assignment. Do not silently grant access. User must use service administrator Company settings > Service assignment flow for their chosen synthetic company, then sign in as specialist with private .local/LOCAL_LOGIN.md credentials and demo_code.py specialist MFA. QA employee screenshots use actual isolated QA assignments, not development/demo data. Updated stale manual/daily workflow intros/navigation. Next milestones unchanged.

## Latest: ownership and next-action guidance

Frontend-only correction: remove duplicate desktop heading Add driver; draft/configuring/review accounts prioritize View account setup; row-level Status & next step follows actual file state, current role and recorded intake/review owner; ended/viewer paths avoid upload instructions. Admin-only activation blocker list reuses existing restricted detail data; client empty list never means ready. Actual service case states distinguish waiting vs active work accents. No API/migration/security change. Build and9 frontend tests passed;4 browser viewports passed axe/overflow/API/page checks plus real file navigation, no duplicate CTA and admin-checklist privacy. See docs/design/NEXT_ACTION_GUIDANCE.md. No new milestone.

## Latest focused refinement: account status

Removed the overview's full-width draft banner. Actual non-active status now opens a compact, closable header disclosure with activation ownership and the existing View account action; native keyboard/Escape focus return and mobile layout. Active accounts omit it. No backend/API/migration change. Build and5 frontend tests passed;4 viewport browser/axe checks passed with no overflow/API/page errors, including close/navigation/reload and active-state assertions. Initial npm --prefix test attempt hit sandbox directory access; rerun from frontend outside sandbox passed. See docs/design/ACCOUNT_STATUS_POPOVER.md and account-status screenshots/results. No new milestone begun.

## Current: cohesive managed-product workspace — 2026-11-17

Owner approved the major visual improvement and requested a focused final density/contrast correction. Implemented: compact real totals; one wide three-driver preview; two balanced attention/service sections; functional View all actions; collapsed team/recent activity; consistent16px spacing; #111111 primary ink/white canvas with gray for supporting text. ADR-0017 supersedes earlier shell freezes. Latest owner instruction resumed verification, overriding the older testing pause. No new milestone started in the final correction.

Shared role-oriented ProductSidebar/ProductHeader, ManagedOverview and managed-product.css replace feature-led navigation/duplicate operational company tabs. Header search/switching/register/request/account actions are real; native mobile drawer. Company administration keeps M1 tabs. New GET /api/v1/tenants/{id}/workspace aggregates current tenant/branch grants, drivers/current requirement reviews, assigned staff, current requests/decisions and review activity. Provisioning remains metadata-only; viewers do not receive file aggregates. No fake metrics/photos/activity or compliance claims.

Previously unrecorded slices now present: encrypted private local evidence storage, actual Windows Defender/ClamAV adapters and separate scan worker, requirement definitions/instances, immutable evidence/reviews/intake attachments; client-approved in-app request policy/recipients, exact approvals, durable publish/reply/history. Migrations 2c16a69f5206 ->1c534a4c5d58 ->aca16001 follow7422a7ea5d93; applied local development and isolated UI QA. No migration added for final UI correction. ADR0015/0016 and runbooks/security docs record boundaries. Source-only case restriction remains: no missing-requirement-only follow-up case yet.

Executed: production frontend build passed,5 frontend tests;43 existing backend tests plus3 new workspace tests passed separately; Ruff app passed. Browser36 page/viewport cases at375/768/1024/1440: zero axe violations, page overflow, failed API requests or page errors. Additional assertions passed: keyboard disclosure, reduced motion, native mobile Escape, account/sign-out and session401. Actual QA-only HTTP/worker journey exercised uploads, Defender scans, reviewed evidence, receipt routing and approved in-app publication. This is not full adversarial evidence/message coverage or milestone completion. Full older onboarding browser script still needs updated shell selectors and rerun. One existing Starlette/httpx deprecation warning.

Design/QA: docs/design/MANAGED_PRODUCT_EXPERIENCE.md and docs/design/managed-product/index.html/results.json. Historical captures are not exact same-fixture before/after evidence. Original four specifications unchanged. Synthetic data only, no remote push/public deploy/external outbound.

Next: review this composition; close private-evidence/correspondence adversarial/recovery coverage and full onboarding browser regression, then finish remaining M2/M3/M4 exit criteria. Provider/API management, external delivery/reminders/automation, S3/MinIO and production scanner provisioning remain pending. Do not call platform team/production-ready.

---

Earlier chronological notes (superseded where they conflict with the current entry):

# Latest: M3 durable cases; M4 approvals started

Implemented but unverified: durable metadata job routing/recovery, exception task/state/note/history workspace and exact-version employer administrative approvals; real contextual sidebar destinations. Next M4 communication policies/recipients/in-app lifecycle. M3 provider/correction/review and M2 private evidence remain pending. Owner stopped testing; no milestone exit asserted. See ADR-0014 and CURRENT_CONTEXT; older entries below are historical.

# Current direction: M3 initial intake receipt slice

Owner stopped testing and advanced to M3 before M2 completion. Structured metadata CSV preview/confirmed encrypted receipts/list/detail are implemented but unverified. No new test pass is claimed. Next: durable worker, exception lifecycle, provider simulator and safe correction/retry; reviewed attachment depends on pending M2 private evidence/requirements. ADR-0013 governs this sequencing change. Earlier entries below are historical.

# Current M2 progress

Driver identity/engagement/search/history/transfers/rehire/reviewed correction slice implemented and tested; see ADR-0012. M2 remains partial. Next: policy/requirements and private uploads/quarantine/scanner/recovery/evidence versions/review. Full duplicate investigation and merge/archive workflows remain pending. Older paused/not-started statements below are historical and superseded by owner authorization.

# Feature backlog

Latest management sections and focused Overview correction verified: OVERVIEW_REGRESSION_CORRECTION.md / ADR-0006-0007. Preserve working tabs/tables, open information/access columns and sidebar. Rejected metadata cards are historical. M2 remains next, not started.

Latest shell correction complete: title/context/breadcrumb leads direct work; no top bar, repeated sidebar labels or giant record frame; real logout in accessible desktop/mobile account disclosure. See SHELL_COMPOSITION_CORRECTION.md / ADR-0005. M2 remains next.

Latest visual direction corrected and verified: FINAL_VISUAL_DIRECTION.md / ADR-0004. White task surfaces and compact action-led records supersede the lavender iteration. M2 remains next; no new business scope added.
All 01 §4 A–K retained.
Product UI maturity pass completed and verified; see docs/design/PRODUCT_UI_REFINEMENT.md. User-directed next milestone: M2. Existing M1 completion/security-hardening items below remain tracked without expanding this visual task.
Status: company onboarding/invitation/MFA/assignment/activation slice verified; broader M0/M1 open work below remains. See IMPLEMENTATION_STATUS for exact test evidence.
- M0: bootstrap/config/health/Compose/CI/design previews/tests.
- M1: company drafts/config/readiness/activation/suspension, branches, login/MFA/recovery, invitations/resend/revoke/accept, roles/revocation, assignments/handoff, audit and both interfaces.
- M2: driver identity/engagement/search/history/duplicates/corrections, versioned policies/requirements, private uploads/quarantine/scan/access/version/review.
- M3: manual/CSV/API/webhook/scheduled intake, canonical raw/normalized provenance/validation/matching/review, per-row recovery, exception lifecycle/notes/escalation/reopening, concurrency/idempotency.
- M4: exact-version employer-authorized approvals, client policies/templates/recipients, drafts/gates/delivery/reconciliation/retry/manual follow-up, portal request fulfillment.
- M5: actual provider simulator/adapter contract, setup/test/activation/suspension/rotation/mapping/cursors/runs/replay/429 handling; scoped client API keys/usage/rotation/revoke; versioned automation/dry-run/schedules/gates/leases/DLQ.
- M6: reports/scoped exports, monitoring/alerts, retention/holds/privacy disputes/offboarding, restore/load/security drills, rollout/rollback, independent reviews and pilot signoffs.

External: approved jurisdictions/SOPs/legal rules, provider contracts/credentials, production IdP/hosting/residency/budget, real communications authorization, support/RPO/RTO owners. Synthetic work continues independently.

Visual information iteration verified (ADR-0009 / VISUAL_INFORMATION_SYSTEM.md). Review before M2; no driver/evidence implementation started. Future visual assets require real data/stage contracts. Sidebar refinement retained (ADR-0008).

Approved action-led Overview implemented/verified: ADR-0010 / OVERVIEW_WORKSPACE.md, profile/readiness/scoped locations. Review before M2; no new engineering milestone started.

Final pre-M2 visual polish verified: ADR-0011 / FINAL_PRODUCT_POLISH.md. Icon semantics, original empty-state family, deterministic identities, honest readiness and confirmed near-action feedback completed for existing M1 screens. Review before M2; driver/evidence and earlier M1 hardening backlog unchanged.
