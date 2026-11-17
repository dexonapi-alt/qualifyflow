# Current verification additions — 2026-11-17

Older rows below retain historical scope; this table supersedes their stale paused-testing/pending statements only for the slices specified.

| Requirement | Implementation | Evidence | Limit |
|---|---|---|---|
| 02 Evidence in Motion/accessibility; 03 role-oriented journeys | ProductChrome/ManagedOverview, canonical tokens, real goal-oriented routes |36 browser viewport checks, zero axe/overflow/API/page errors; keyboard/reduced motion/logout assertions; actual screenshots |not full screen-reader/performance certification |
| 01 tenant/role architecture;04 isolation |workspace endpoint current grant/branch aggregates |3 new PostgreSQL tests: branch/revoke/cross-tenant;viewer file omission;provisioning metadata-only |all current totals follow scope;no production readiness claim |
| 01 qualification/documents;03 evidence review;04 secure documents |documents private storage/scanner/review, versioned requirements and immutable attachment records;2c16a69f5206,aca16001 |actual QA HTTP upload + Defender scan + accepted review journey;existing43 regressions pass |hostile-file/recovery/adversarial matrix incomplete;S3/ClamAV deployment unverified |
| 01 managed service;03 approved correspondence;04 current authorization |correspondence policy/messages/events/publish/reply;1c534a4c5d58 |actual QA approved in-app publish + client browser requests/decisions |external delivery/reminders pending;negative/revocation/concurrency matrix incomplete |
| 01 screening/exceptions/approvals;03 source provenance |durable source routing and current-version decisions |QA mixed source/case/approval journey,actual case/intake browser pages |provider API/mapping/correction and full lifecycle regression incomplete |

No M2/M3/M4 milestone exit asserted. Full original specs unchanged. Details: docs/design/MANAGED_PRODUCT_EXPERIENCE.md.

---

# Requirements traceability
Planned means unimplemented; partial does not satisfy milestone exit.

| Requirement / source | Module / interface | Database | Test evidence | Status |
|---|---|---|---|---|
| 01 §4.1; 03 J01 AC001–003 | organizations service; /tenants, branches, configuration, review/activate/suspend; CompanyWorkspace | tenants, branches | test_foundation health/persistence, validation, branch isolation, activation; Playwright onboarding | verified onboarding slice; edit/archive/offboarding pending |
| 01 §4.2; 03 J02 AC004; 04 SEC04–06 | auth service; /auth/*, invitations, memberships | users, sessions, invites, memberships | test_foundation invite/replay/takeover/CSRF; test_recovery concurrency/lockout/revoke; test_totp; browser | verified invite/login slice; recovery/full account admin pending |
| 01 §3.3; 03 J03 AC006 | organizations / operator-assignments and end | operator assignments | test_foundation assignment revocation; browser managed assignment | verified metadata scope; task handoff pending with task modules |
| 01 §3.3; 03 §3.1; 04 SEC01–03,07 | shared.authorization / current implemented routes | scope relationships | test_foundation cross-tenant/viewer/branch/platform-denial; test_recovery revoke/disable | verified current metadata boundary; driver/file/worker/export tests later |
| 01 §4.3; 03 J06 AC016–017; 04 tenant/branch isolation | drivers service; /tenants/{id}/drivers, search/detail/history/corrections/engagements/state/transfer; Drivers workspace | driver identities/engagements/history/command receipts; 27b7e811a6d9 | test_drivers, test_driver_guards; real driver-journey browser + 28 axe/viewport cases | verified registry slice; full duplicate investigation and evidence pending |
| 01 §4.5; 03 J07,J11 AC020; 04 DOC01–04 SEC08–09 | qualification/documents / upload/review/access | requirements/policy/evidence versions | pending | M2 |
| 01 §4.4; 03 J08–10 AC011,013–019; 04 §6.4 | screening_intake; intake-batches preview/receipt/list/detail; IntakeWorkspace | intake_batches/items; encrypted raw+normalized source; 42fde403280e | not executed: owner stopped tests | partial, unverified metadata receipt slice; workers/provider/review/results/exceptions pending |
| 01 §4.6; 03 J12 AC022–024; 04 §11.4 | exceptions queue/state/notes; durable metadata case routing; /exceptions and intake retry | intake_jobs, exception_cases/tasks/events; 7422a7ea5d93 | not executed: owner stopped tests | partial/unverified; reassignment/escalation/SLA and full history pagination pending |
| 01 §4.6; 03 J13,J16 AC023–024,029 | case approvals propose/decide/withdraw; Approvals workspace; employer current membership | approval_requests/decisions; exact case versions; 7422a7ea5d93 | not executed: owner stopped tests | partial/unverified administrative approvals; broader client requests and policies pending |
| 01 §4.7; 03 J14 AC025–026; 04 OPS03–05 | notifications / compose/delivery | policy/template/messages | pending | M4 |
| 01 §4.8; 03 J04,J17 AC007–013; 04 INT01–06 | integrations / connection/mapping/runs | secrets refs/connections/events | pending | M5 |
| 01 §4.8; 03 J05; 04 §7.4 | integrations / service accounts | hashed keys/scopes/usage | pending | M5 |
| 01 §4.9; 03 J15 AC027–028; 04 OPS02,07 | automation / dry-run/scheduler/worker | rules/jobs/outbox | pending | M5 |
| 01 §4.11; 03 §3; 04 §14 | audit.service, /audit-events; migration e2a40001 | audit events | test_foundation atomic persistence; test_audit database tamper denial | verified mutation audit slice; denied-action events/external sink pending |
| 01 §4.10; 03 J18–19 AC030–031; 04 PRIV01–02 OPS08 | reports / scoped exports/offboarding | exports/holds/retention | pending | M6 |
| 02 §3–9,12–15; 04 UX01–02 | frontend Forms/UI/CompanyWorkspace/SingleCompany + canonical tokens | n/a | 3 API-contract tests; full onboarding browser journey; 32 axe/overflow cases at 375/768/1024/1440; keyboard order/focus, reduced motion, 200% CSS reflow, directory search/filter/sort; visual before/after inspection | product refinement verified for current screens; full manual assistive-technology certification pending; see PRODUCT_UI_REFINEMENT.md |
| 02 §§3–5,9,12; visual-craft user direction | self-hosted Inter, UI utility icons, canonical semantic tokens and shared visual layer | n/a | actual Inter/Geist comparison; loaded-font/contrast verification; 32 axe/overflow cases and unchanged full onboarding regression | visual craft verified; see VISUAL_CRAFT_REFINEMENT.md; no new business scope |
| 01 §7.2; 03 AC021; 04 §2 REG01–03 | no legal decisions without approval | policy versions later | synthetic-only | boundary |
| 04 §9–18 DR01–02 DEP01–02 | CI/infra/runbooks | n/a | pending | M6 |

| 02 ??3-9,12-15; premium-overhaul owner direction; 03 J01/J02/J16; 04 ?16 | canonical surfaces/tokens; premium.css; actual App/UI components | existing tenant/membership data only | 28 backend, 3 frontend, 1 full onboarding browser pass; 48 axe/overflow cases; actual pending/error/loading/long identities; keyboard disclosure and occlusion check; reduced motion/reflow/contrast | visual foundation verified; no endpoint/migration; see PREMIUM_PRODUCT_OVERHAUL.md and ADR-0003; M2 next |

| 02 ??3-6,8.6-8.7,12-13; final visual-direction owner correction | App SingleCompany, premium.css, canonical tokens | existing company/membership/branch records only | 28 backend, 3 frontend, 1 full onboarding, 48 axe/viewport cases; keyboard/motion/reflow/contrast and rendered desktop/tablet/phone review | final correction verified; FINAL_VISUAL_DIRECTION.md / ADR-0004; no endpoint/migration; M2 next |

| 02 ?6/?12; precise shell-composition owner instruction | App WorkspaceBreadcrumb/sidebar account controls; premium.css | unchanged session/tenant/membership entities | 3 frontend, full onboarding browser pass; 56 axe/viewport cases; 4 account-type composition and keyboard/logout/old-cookie401/reload checks | verified shell foundation; SHELL_COMPOSITION_CORRECTION.md / ADR-0005; M2 next |

| 01 ?4.1-4.2; 03 J01/J02; 02 ?8.6-8.7/?12; management/Overview owner corrections | shared embedded CompanyWorkspace, CompanySummary, location/member/invitation/audit tables; real section navigation | existing tenants/branches/memberships/invitations/audit; no schema changes | 28 backend, 3 frontend, expanded real onboarding/client invite refresh-revoke pass; 96 axe/viewport cases; no-card/no-duplicate-state/scope/navigation/empty/loading/search/logout checks | management sections and focused Overview correction verified; ADR-0006-0007; M2 next |

| 02 sections3/8.6-8.7/8.12/9-13; 01 company/access/audit; 03 J01/J02/J18; 04 UX01-02; visual-information owner direction | IdentityMark/ReadinessSignal/AuditAction/LocationEmpty, CompanySummary and existing operational tables; canonical tokens | existing authorized tenants/branches/members/invites/audit only | 28 backend,3 frontend,1 real onboarding,96 axe/viewport passes; real API scope count + keyboard action; rendered review | verified design iteration; ADR-0009; M2 paused pending review |

| Owner-approved action-led Overview; 01 company/access; 03 J01/J02; 02 components/accessibility; 04 UX01-02 | CompanyOverview, scoped composition CSS, existing config/location actions | existing authorized company/branch/scope data only | backend28/frontend3/E2E1/build;96 axe/viewport passes; direct keyboard actions and API preview scope; visual renders | verified focused design; ADR-0010; M2 paused |

| Final visual language owner approval; 02 icons/components/empty states/motion/accessibility; 03 truthful command outcomes/J01-J03; 04 UX01-02/current grants | UI, EmptyState, VisualInformation, Forms/App feedback, canonical avatar tokens | existing company/branch/membership/invitation/assignment state; no schema change | backend28/frontend5/E2E1/build;100 axe/viewport cases; confirmed write/error/stale-feedback assertions; visual review | verified focused polish; ADR-0011; M2 awaits review |

Focused account-status refinement:02 status/accessibility and03 activation responsibility remain actual-state driven. Header native disclosure replaces wide overview banner;4 viewport axe/browser checks,5 frontend tests and production build passed. No server or migration change. See ACCOUNT_STATUS_POPOVER.md.

02 hierarchy/accessibility +03 ownership/activation: NEXT_ACTION_GUIDANCE.md records row next steps and actual-role activation blockers.9 frontend tests and4 browser viewport checks passed; no new server/migration change. Historical backend46 pass not rerun for this UI-only refinement.

02 compact record presentation: removed overview row prose/footer; preserve detailed file semantics and real queue navigation.6 browser viewport checks/axe,9 frontend tests/build passed.03 employee permissions unchanged; employee walkthrough requires existing audited staff assignment, never role-preview bypass.
