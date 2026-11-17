# Overview regression correction

2026-11-17. Focused response to the rejected metadata-card iteration. The current page title, breadcrumb, working tabs, sidebar, type, palette, authentication and authorization remain intact. No M2 work.

## Diagnosis and scope

Visually inspected downgrade-current-site.png and the Quixera reference, the actual rendered summary captures and source. Inspected Git status before editing. The rejected version grouped four ordinary values into oversized rectangular cards, enclosed the values again, repeated Draft in the identity and Setup sections, and placed real actions below a tall summary. The 800px summary constraint left an unbalanced empty right area. Passing automation was insufficient to resolve those visual problems.

Selectively reused the successful open key-value patterns from preceding iterations, retaining all new working tabs and semantic management tables. No destructive reset, source-document replacement or sidebar redesign. ADR-0007 supersedes the card paragraph of ADR-0006; the navigation/table decision remains valid.

## Correction

- Removed the four summary-card elements and nested value-box elements. Ordinary dates, scope and company values are plain text.
- Replaced the stacked summary/details/actions blocks with Company information and Setup & access columns at a 7/5 proportion, using existing whitespace and subtle dividers. Heights follow content; neither section is stretched to fill a card.
- Company information includes actual legal name, primary contact, effective date, timezone and region. Customer reference and service mode remain in compact company identity above the section.
- Setup & access identifies activation context and the real service-administrator responsibility, membership role and scope. The exact status pill occurs once in company identity. Pending activation text and a soft role category badge carry distinct meanings; no fake inputs or counters.
- Authorized actions are adjacent to access context: Manage users or Manage setup, View locations and appropriate Configuration access. They navigate to existing sections. No unsupported operation is introduced.
- Phone/tablet narrow layouts stack naturally. The title/breadcrumb/tabs and existing sidebar/account controls are preserved.
- Locations, members and invitations retain real operational tables and existing actions. Audit now includes actor and target identifiers already present in GET audit-events, alongside actual event/timestamp/reference fields. Expandable IDs reveal their full values by keyboard; absent data is labeled Not recorded. No names, users or activity were fabricated.

Runtime changes: CompanySummary presentation and existing audit response typing/columns in frontend/src/App.tsx; Overview/audit component rules in frontend/src/premium.css. No sidebar rules or canonical palette tokens changed for this correction. QA checks now explicitly reject summary-grid/summary-value elements, require two Overview sections and check that the client Overview contains one status indicator.

## Visual evidence

[Open before/after gallery](overview-correction/index.html). Before captures were taken before editing, at the same 375/768/1024/1440 widths. After images are actual browser output using persisted synthetic data and the existing API. Baseline cards are preserved as review evidence, not current design guidance.

- [Before desktop](overview-correction/before/client-one-1440.png) / [after desktop](overview-correction/after/client-one-1440.png)
- [Before phone](overview-correction/before/client-one-375.png) / [after phone](overview-correction/after/client-one-375.png)
- [1024px](overview-correction/after/client-one-1024.png), [768px](overview-correction/after/client-one-768.png)
- [Audit with real actor/target fields](overview-correction/after/operations-audit-1440.png)

Desktop 1440/1024, phone Overview and populated audit captures were opened and visually inspected. The nested boxes and duplicate status are absent, both columns hold related information, management actions are visible beside access context, and the current tabs remain unchanged. No additional decorative elements were added to occupy unused viewport height.

## Verification

Raw results: [after/results.json](overview-correction/after/results.json). Final matrix covers 96 screen/viewport cases at 375/768/1024/1440, including the management tabs, real empty Locations, long/scoped records, actual populated invitation/audit data, loading/error states, account-menu keyboard/logout/session rejection, reduced motion and 200% CSS reflow. **Final: all 96 axe/viewport cases passed with zero violations and zero document horizontal overflow.** Explicit assertions reject the removed metadata-card/value elements, require the two Overview information sections, and confirm one client account-state indicator. Existing keyboard section navigation, scope checks, location search/recovery, sidebar/logout and prior-session HTTP401 tests passed.

**3 frontend tests passed; TypeScript/Vite production build passed; expanded real onboarding browser journey 1 passed** (18.6s; 20.3s total). Existing backend regression was also executed during the preceding management-section implementation: 28 passed with one existing Starlette/httpx deprecation warning; no backend domain code changed. Final build JS258.15KB/78.84KB gzip and CSS55.55KB/10.75KB gzip. Browser contrast pairs and font/motion/reflow evidence are retained in results.json.

The expanded actual browser journey includes company/branch creation and persistence, readiness rejection, staff assignment, local SMTP/MFA invitation acceptance, client section navigation, client-created invitation persistence/revocation, readonly client Configuration, service-admin review/activation and refresh. No unapproved external delivery is performed.

Backend rules/contracts/migrations are unchanged. Existing M0/M1 recovery/infrastructure/production limitations and full manual assistive-technology certification remain open. This is not full M1/product completion. Stop after the correction; M2 remains next.
