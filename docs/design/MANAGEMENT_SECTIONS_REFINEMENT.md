# Management sections and Overview refinement

Overview card composition was rejected and superseded by [OVERVIEW_REGRESSION_CORRECTION.md](OVERVIEW_REGRESSION_CORRECTION.md) / ADR-0007. Working management navigation and tables remain implemented; the card discussion below is historical.

2026-11-17. Existing M1 only. Current shell/font/palette/motion foundation preserved. No backend business rule, authentication/MFA control, API contract or database migration changed.

## Reference review and mapping

Visually inspected the supplied current/reference annotations, GAPSS.png and the subsequent good.png/concept.png steering. The missing layer was meaningful management navigation. The intermediate tabbed implementation resolved that but left four single-value fields stretched across long metadata rows. The final correction groups these into a compact 2×2 summary and separates details, setup context and actual actions beneath it. Repeatable records use tables; the account summary does not pretend to be a user-management table.

Revisited Document 01 account/organization requirements, Document 03 J01/J02 and Document 02 onboarding/permission principles; inspected actual API authorization and returned data. Company detail already returns authorized branch scope and configuration. Member/invitation endpoints require users:manage. Detailed readiness is returned only to service administrators. Those ownership boundaries determine visible sections and controls; no backend rule was weakened to suit the design.

## Implemented structure

Page title → breadcrumb → working company section navigation → compact company identity/status → section-specific content/actions.

| Section | Actual function | Permission/data boundary |
|---|---|---|
| Overview | 2×2 service/date/role/scope summary; compact company details; setup context; View configuration / View locations / Manage users or Manage setup | Current persisted company/membership values; no invented statistics or completion ratio |
| Locations | Semantic location/reference/status table; real name/reference search and clear recovery; existing branch creation form | GET detail's already-filtered branches; writes only for whole-company managers and writable state |
| People & access | Semantic member role/scope/status/action table, real invitation form and recipient/expiry/status/action history table | Existing whole-company users:manage condition; original invite/revoke/resend/membership handlers retained |
| Configuration | Legal/reference/service/contact/region/timezone/date/policy/owner/version fields; existing save/review/activate/suspend controls for service admin | Client roles read only; no service-only controls rendered to them |
| Audit history | Event/time/reference table with real returned audit data | Existing company-wide manager/reviewer authorization; no fabricated activity |
| Service assignment | Existing staff assignment/end workflow | Service-admin-only; unchanged backend operations |

The duplicate SingleCompany component was removed. Single-company clients now embed the same CompanyWorkspace used by other company administration, with one detail fetch/state ownership boundary. Readiness remains real and restricted. Asynchronous people/service/audit navigation has truthful loading feedback rather than flashing an empty list. Same-company location search survives tab changes; company changes remount and clear the prior context.

Overview's four grouped facts are a semantic definition list, with compact value surfaces and bounded content-driven width. Company details use a small aligned key-value list, setup status names the actual activation owner and exposes returned blockers only to authorized staff, and Quick actions navigate to real sections. No charts, fake counters, stock avatars, unavailable tabs or decorative modules.

Tables have explicit column headers/captions, stable IDs, text state labels and existing actions. Narrow screens retain columns using contained horizontal scrolling in labeled focusable regions; the main document does not overflow. Location search is explicitly over the returned authorized records, not an invented global index. Member/invitation/audit search, pagination or bulk controls are not fabricated.

## Changed files

- frontend/src/App.tsx: shared embedded company workspace, real secondary navigation, compact summary, configuration details, location search, semantic member/invitation/audit tables and loading presentation. Existing mutation payloads/transactions remain in the backend services.
- frontend/src/premium.css: component-only summary/section/table rules. Canonical palette, typography family, sidebar and motion are preserved.
- frontend/scripts/ui-review.mjs: actual section navigation/scope/search/empty/operational-history screenshots and checks, retaining sidebar/logout coverage.
- frontend/e2e/onboarding.spec.ts: real client navigation and invite/create/refresh/revoke coverage; updated visible Locations label.
- backend/scripts/seed_ui_qa.py: dedicated synthetic no-locations account/tenant; script still refuses any database other than qualifyflow_ui_test. Secrets remain ignored in .local.

No new endpoint or migration. ADR-0006 records the shared navigation and summary choice. Current DESIGN.md/MASTER and implementation handoff point here; older galleries remain historical.

## Browser evidence and verification

[Open comparison and sections gallery](management-sections/index.html). Before is the original broad account overview, intermediate is the first tabbed row-summary state, final is the grouped summary with real management tables. Screenshots use persisted synthetic records and the actual API, not mocked response data. Repeated end-to-end tests can grow synthetic directory/invitation history; no counts were fabricated or records erased.

The visual matrix includes the five test-account states, true zero-location state, long branch viewer, client/admin overview, scoped location search/recovery, client member/invitation form, read-only client configuration, populated operational invitation/audit tables, real pending/error/loading, account-menu keyboard/logout/session rejection, reduced motion, contrast and 200% CSS reflow. Widths: 375/768/1024/1440. Raw executed evidence is [after/results.json](management-sections/after/results.json).

The expanded real browser journey creates a company/branch and responsibilities, rejects premature readiness, assigns a specialist, delivers a local invitation, enrolls MFA and accepts it, navigates client Locations, creates a viewer invitation as the client administrator, refreshes to prove persistence, revokes it, verifies read-only Configuration and returns to Overview. Service administration then reviews/activates and refreshes the actual persisted account. No unapproved external communication is sent; the test uses synthetic example.com recipients and local SMTP.

Initial verification exposed two harness issues: a case-sensitive Revoke locator and a backend unit-test process inheriting the QA app origin. Both were corrected in the tests/command environment; authentication/origin enforcement was not weakened. Final executed counts and visual inspection results are recorded in the status/context and appended here when verified.

Existing full M1 recovery/session/administration, infrastructure/production gates and manual assistive-technology certification remain open. M2 remains next; no later module was implemented.

## Executed management-section baseline
28 backend tests passed, 3 frontend tests passed, production build passed, expanded browser journey passed including client invitation refresh/revocation, and 96 visual/axe viewport cases passed with no violations/overflow. The subsequent focused Overview correction has its own complete final evidence and gallery; do not restore the rejected 2x2 cards.
