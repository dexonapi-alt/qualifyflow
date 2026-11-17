# Product UI refinement

Historical iteration: current design rules and evidence are in [PREMIUM_PRODUCT_OVERHAUL.md](PREMIUM_PRODUCT_OVERHAUL.md) and ADR-0003.

2026-11-17. Scope: mature the implemented M1 account/organization interfaces before **M2**. No driver, screening, exception, integration or automation screens added. The original four specifications remain unchanged.

## Review and diagnosis
Reviewed Documents 01–04, especially 02 §§1.3, 4–9, 12–15; implementation context/status; all existing frontend components, styles, API types and tokens; actual local design references. The original implementation applied editorial scale to routine administration: 60–76px titles, oversized page gaps, sparse single-row company lists, repetitive explanatory headings, and an MFA label that did not clearly distinguish a setup key from a verification code.

The supplied login and administration references inform compact form proportions, navigation hierarchy, scan paths and table alignment. Their gradients, palettes, fictitious navigation, authentication options and company identity were not adopted.

## Decisions and updated patterns
| Surface / pattern | Refinement | Data and behavior |
|---|---|---|
| Login | Two-column desktop composition; pale-blue evidence-path illustration; 25px form title; full-width sign-in; mobile form-first layout | Existing email/password/TOTP endpoint and validation. No SSO/reset/passkey/Google controls |
| Invitation | Compact title, explicit setup-key instructions, six-digit code input/one-time-code autocomplete, linked help/error text | Existing invitation/MFA acceptance and single-use token controls |
| Shell | 232px sidebar (204/180 at intermediate sizes), 65px header, 28px work titles, 24–32px page gutters, persistent account/environment identity | Only Companies / Company access global navigation; existing scoped company tabs remain |
| Operations directory | Bounded row surface, aligned company/service/status/action columns, real search/filter/sort, no-result recovery and existing API pagination | Searches displayed/loaded authorized records; loaded count is explicit, never invented total. Load more uses existing offset/limit contract |
| Single-company client | Company identity/state followed by meaningful account setup notice, persisted metadata, role/scope, permitted branch list and contextual actions | GET company detail supplies actual role/branch scope; permissions continue determining actions. No invented readiness percentage or activity |
| Members | Aligned member/access/status/action columns and compact invite form | Existing membership/invitation operations, confirmation and audited revocation preserved |
| Configuration / branches / assignment / audit | Smaller section labels, tighter forms, aligned rules and consistent error/loading/empty treatments | Existing services, state transitions, rationale/version checks and audit untouched |
| Motion | 140ms feedback, 200ms controls, 260ms context reveal; one initial 600–800ms authentication graphic reveal | No loops, animation libraries or delayed controls; reduced-motion removes animations/transitions |

Each container has a boundary purpose: company directory/list, editable form, account state notice, or coherent single-company record. No metric wallpaper or repeated dashboard-card grids. Inline SVG icons and CSS/SVG art avoid downloaded imagery, fonts or dependencies.

## Tokens and typography
Runtime source: design-system/qualifyflow/tokens.css, consumed by frontend/src/style.css. White-first palette and signature #265CFF blue retained. Supporting tokens added/refined: sidebar #F8FAFD, table head #F5F7FB, authentication art #EDF3FF, ink #17202F, muted #5E6B7E; control radius 6px, panel radius 10px; restrained control/panel shadows. System font stack retained; no external font requests.

Operational titles 24–28px, section titles 18px, body/table 13–14px, labels 12–13px. Supporting metadata is smaller and secondary; names/status/action labels remain available. Mobile authentication inputs use 16px text and 44–46px targets. Long company names wrap rather than disappearing.

## Screenshots and visual inspection
[Open before/after comparison](ui-refinement/index.html).

| Screen | Before | After |
|---|---|---|
| Login | [1440px](ui-refinement/before/login-1440.png) | [1440px](ui-refinement/after/login-1440.png), [375px](ui-refinement/after/login-375.png) |
| Operations | [1440px](ui-refinement/before/operations-1440.png) | [1440px](ui-refinement/after/operations-1440.png), [375px](ui-refinement/after/operations-375.png) |
| Client, one company | [1440px](ui-refinement/before/client-one-1440.png) | [1440px](ui-refinement/after/client-one-1440.png), [375px](ui-refinement/after/client-one-375.png) |
| Client, no access | [1440px](ui-refinement/before/client-empty-1440.png) | [1440px](ui-refinement/after/client-empty-1440.png) |
| Company administration | [1440px](ui-refinement/before/company-detail-1440.png) | [1440px](ui-refinement/after/company-detail-1440.png) |
| People and access | [1440px](ui-refinement/before/people-1440.png) | [1440px](ui-refinement/after/people-1440.png) |

Captures include 375/768/1024/1440 widths, several companies, an exceptionally long name, a single-company client, no company access, real sign-in rejection, company configuration and member management. Additional after captures cover no search results and 200% CSS-zoom reflow. Screenshots contain only dedicated synthetic fixtures. Desktop login/directory/portal/people and phone login/directory/portal were opened and inspected visually, not merely generated. Detail selection differs between the initial baseline script and final script; the main login/directory/client comparisons use the same fixtures.

## Verification and practical limits
Source-controlled QA driver: frontend/scripts/ui-review.mjs. Isolated database: qualifyflow_ui_test; API 8001, browser frontend 5174. Local manual-testing app/database remain separate. Backend fixtures are test-only, not a product bootstrap bypass. Generated QA credentials stay in ignored .local files.

The visual matrix runs axe scans and horizontal-overflow checks, verifies company search/status/sort/no-result recovery, keyboard focus order, reduced-motion zero-animation state and 200% CSS reflow. Raw evidence: [after/results.json](ui-refinement/after/results.json). Authentication form fits a 1440×800 viewport. This does not claim complete WCAG certification or replace manual screen-reader testing.

Backend regression: **28 passed**, with existing Starlette/httpx deprecation warning. Frontend API tests: **3 passed**; TypeScript/Vite production build passed (~254.7KB JS / 78.3KB gzip; ~23.2KB CSS / 5.4KB gzip). Full real browser onboarding regression: **1 passed**, covering create/persist company and branch, readiness guard, specialist assignment, actual SMTP invitation, MFA acceptance, scoped client portal, review/activation and refresh. Test selectors changed only where visible labels and single-company composition changed; permission/workflow expectations retained. **32 axe/viewport cases: zero violations and no horizontal overflow**, plus passing search/filter/sort/no-result checks, email → password → code → sign-in focus order, visible keyboard focus, zero active reduced-motion animations, 200% CSS-zoom overflow checks and desktop auth viewport fit. No backend domain services, endpoints, permissions or migrations changed for this visual pass.

## Resources and provenance
- awesome-design-md/design-md/linear.app/DESIGN.md: interaction density, typographic discipline. Rejected dark palette/lavender/proprietary fonts.
- awesome-design-md/design-md/stripe/DESIGN.md: field hierarchy and surface discipline. Rejected gradient mesh/brand tokens/proprietary type.
- Existing IBM/Vercel review remains useful for quiet rules and aligned data.
- UI UX Pro Max local design-system SKILL.md plus existing reviewed search/core sources. Offline queries: `enterprise dense tables search empty states` and `authentication form labels focus motion reduced` under ux. Adopted meaningful empty/no-result states, responsive table handling, explicit labels, paste/autocomplete and reduced motion. Did not add unimplemented authentication methods suggested by the generic reference.

## Remaining improvements and next milestone
**M2 remains the next engineering milestone**: tenant-private driver identities/engagements and secure versioned evidence. Existing M1 recovery/administration and production-hardening backlog remains documented; this task does not silently declare those capabilities complete. Later modules should reuse the refined density, tokens, form semantics and permission-driven navigation. Future scale work: server-side directory search/cursor pagination, richer permission-scoped table filters and policy-driven task summaries as their actual backend data arrives. No invented controls added in anticipation.

Latest design-focused extension: [Visual information system](VISUAL_INFORMATION_SYSTEM.md) and ADR-0009; preserves the current sidebar and M1 functionality. Review current [gallery](visual-information/index.html) before M2.

Current approved Overview: [Action-led company workspace](OVERVIEW_WORKSPACE.md), ADR-0010 and [comparison gallery](overview-workspace/index.html). Supersedes the open-column composition only; sidebar and operational management tabs retained.

Latest focused finishing pass: [Final product polish](FINAL_PRODUCT_POLISH.md), ADR-0011 and [comparison gallery](final-product-polish/index.html). Approved Overview/sidebar retained; icon meaning, original empty states, identity cues and confirmed near-action feedback verified.


## Current managed-product direction — 2026-11-17

ADR-0017 and [MANAGED_PRODUCT_EXPERIENCE.md](MANAGED_PRODUCT_EXPERIENCE.md) record the role-oriented shell and final compact overview/contrast correction. [Actual screenshot gallery](managed-product/index.html).36 page/viewport cases passed with zero axe violations/overflow/API failures/page errors; keyboard/reduced-motion/logout assertions passed.43 existing backend +3 workspace tests,5 frontend tests and build passed. Full older M1 browser regression and private-evidence/message adversarial matrices remain pending. Historical galleries are not same-fixture before/after pairs. No new milestone begun in the final design correction.

### Compact account status
[ACCOUNT_STATUS_POPOVER.md](ACCOUNT_STATUS_POPOVER.md): wide draft notice removed; header disclosure retains actual state/ownership and View account. Desktop/mobile visually inspected;4 viewport browser/axe checks,5 frontend tests and build passed. No backend change.

### Ownership and next steps
[NEXT_ACTION_GUIDANCE.md](NEXT_ACTION_GUIDANCE.md): remove duplicate desktop CTA; prioritize setup for draft accounts; actual-role driver next actions; preserve administrator-only activation prerequisites.9 frontend tests and4 viewport browser/axe checks passed.

### Compact driver preview
Per-row explanatory prose and footer removed; status and View file remain. Queue navigation retained.6 viewport checks,9 frontend tests and build passed. [Employee walkthrough](../runbooks/employee-view.md) includes actual role sign-in and assignment requirements.
