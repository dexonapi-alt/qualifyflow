# Premium product overhaul

Historical iteration: the current owner correction and screenshots are in [FINAL_VISUAL_DIRECTION.md](FINAL_VISUAL_DIRECTION.md) and ADR-0004.

2026-11-17. A visual foundation pass on the implemented M1 product. M2 is the next engineering milestone and was not started. No backend domain behavior, endpoint, authorization, authentication, database schema or migration changed.

## Audit and reference decisions

Both owner-supplied images were visually inspected: `dribble-dashboard-man-steal.jpg` (settings/user administration) and `another-reference.png` (healthcare workspace). The former uses quiet navigation, a continuous alignment grid, compact tabs/filters, varied but consistent type weight and subtle status surfaces. The latter establishes a cool surrounding canvas, white task surfaces, pastel context bands, comfortable shape proportions and an approachable identity area. Their decorative outer framing is presentation treatment, not a reason to waste application viewport space.

The prior QualifyFlow iteration had good authorization/data structure but flattened identity, status, profile and access onto the same white field. Navigation was utilitarian; low surface contrast and under-grouped account information made the product feel sparse. Earlier broad restrictions on cards/status surfaces became counterproductive. ADR-0003 reconciles the latest owner direction without editing the original specifications.

| Observed principle | Application in QualifyFlow | Deliberately excluded |
|---|---|---|
| Soft surrounding canvas supports crisp working surfaces | Cool near-white workspace, slightly deeper navigation, white record/editing groups | Giant blue outer backdrop, copy of either brand |
| Pastels group information by role | Lavender account facts, blue-gray access context | Randomly colored icons/cards; decorative operational numbers |
| Calm, contemporary typography with clear weight contrast | Existing licensed Inter Variable, lighter body/labels, focused record headings, tabular dates | Proprietary reference typefaces, excessive semibold/uppercase |
| Administrative rhythm is carried by alignment | Existing search/status/sort controls, shared member/status/action grids, compact working tabs | Placeholder tabs, inert menus, bulk actions without APIs |
| Human identity is visible and understandable | Signed-in initial/email plus keyboard-expandable full identity | Stock avatars pretending to be actual users |
| Depth helps separate tasks | Low shadows and 12–16px group radii; continuous operational lists | Repeated metric-card grids, excessive borders/glows |

Revisited Document 02, the relevant personas/account requirements in 01, onboarding/invitation/portal behavior in 03 and accessibility/release requirements in 04. Local resource review included `awesome-design-md/design-md/linear.app/DESIGN.md` for type/density and `awesome-design-md/design-md/mercury/DESIGN.md` for restrained cool surfaces and lighter typography. These references include marketing analysis, so their giant display scales and proprietary palettes were not imported. UI UX Pro Max's local design-system skill/token-architecture guidance and offline `search.py 'enterprise settings tables accessible density surface hierarchy' --domain ux -n 3` informed semantic tokens, responsive lists and heading order. No dependencies, font CDNs, UI libraries or animation libraries were added.

## Implemented foundation

Canonical colors: canvas-soft #F4F4FA, sidebar #F0F0F7, white #FFFFFF, ink #232535, muted #656879, border #E5E5EE. Account context #EEEDF9; access context #EDF1F8. Cobalt #265CFF retains brand/primary/focus meaning. Actual statuses use semantic text plus dot and a light tint; warning surfaces remain distinct from lavender context. Input boundaries retain #8792A2.

Work titles 25–28px; company identities 23–24px; sections 15–18px; body/data 13–14px; metadata 11–12px. Body 400, labels 450, controls around 480 and headings 500–560. One existing 24-unit/1.5-stroke icon family now includes a matching clock for pending setup. The check-bearing shield is not used to imply a draft account has passed review.

Control radius 9px; meaningful panels 16px; contextual notices 12px. The old craft override block was removed from style.css and replaced with one named premium.css shared layer. Tokens remain imported from the canonical design-system file; base responsive/form semantics remain in style.css. Current rules are synchronized in DESIGN.md and MASTER.md. Earlier reports remain historical.

## Working screens

- **Login/invitation:** White focused authentication form on a cool surrounding field; existing evidence-path graphic retained on desktop, form-first mobile. Existing email/password/TOTP, invitation acceptance, error summary and pending controls preserved. No new authentication methods or reset links.
- **Application shell:** 224px desktop navigation (200/180px intermediate), 68px compact context header (54px phone), 36/24/16px main gutters. Rounded white selected navigation on a soft rail; visible workspace/surface identity and real sign-out. Native account disclosure shows full long email by keyboard. Disclosure layers above the work content.
- **Client account:** Identity/status followed by a single lavender summary of persisted service mode, effective date and current role. Setup notice names the actual service-administrator responsibility; detailed readiness items remain in the service-admin configuration view because the API deliberately omits them for clients. No guessed completion ratio. White profile/location groups and blue-gray membership scope/action area. A branch viewer sees only returned branches and no Manage users/locations actions. The profile does not stretch into a giant empty panel.
- **Operations:** Existing company directory remains an aligned continuous list with working loaded-record search/filter/sort and API pagination. Configuration, branches, people, assignment and history keep their actual controls, state rules and permission gates. Information and editing groups share quiet white surfaces; existing tab navigation is refined, not expanded with fake modules.
- **Motion:** Existing one-time evidence-path reveal, context continuity and 140–260ms functional feedback retained. No loops or row entrance delays. Reduced motion removes transitions/animation and pressed transforms.

## Screenshots and rendered review

[Open before/after gallery](premium-overhaul/index.html). Captures are real browser output using an isolated synthetic PostgreSQL dataset/API/frontend, not API-response mockups. Directory counts can grow between captures because end-to-end runs intentionally persist additional synthetic companies; no counts were fabricated or history deleted.

| Surface | Before | Final |
|---|---|---|
| Login | [1440](premium-overhaul/before/login-1440.png) | [1440](premium-overhaul/after/login-1440.png), [375](premium-overhaul/after/login-375.png) |
| Operations | [1440](premium-overhaul/before/operations-1440.png) | [1440](premium-overhaul/after/operations-1440.png), [375](premium-overhaul/after/operations-375.png) |
| Client company | [1440](premium-overhaul/before/client-one-1440.png) | [1440](premium-overhaul/after/client-one-1440.png), [375](premium-overhaul/after/client-one-375.png) |
| People/access | [1440](premium-overhaul/before/people-1440.png) | [1440](premium-overhaul/after/people-1440.png) |
| Pending setup | — | [Service-admin prerequisites](premium-overhaul/after/company-detail-1440.png) |
| Long identity | — | [Phone](premium-overhaul/after/client-long-identity-375.png), [account disclosure](premium-overhaul/after/account-disclosure-1440.png) |

Desktop and phone login/client/operations, tablet company configuration, people, long-name/branch-viewer state and the account disclosure were opened and inspected visually. That inspection caught an unnecessary stretched profile and an obscured popover; both were corrected. Accessibility tests caught a new account-summary accessible-name mismatch; the native content name was restored and the checks rerun.

## QA and evidence

Raw final results: [after/results.json](premium-overhaul/after/results.json). Test driver: frontend/scripts/ui-review.mjs. The expanded suite covers login, pending login, real rejected login, operations, no results, active company, draft configuration, people, delayed client detail, single company, empty account and long name/email with branch-scoped viewer. Every screen is checked at 375/768/1024/1440px. Loading uses temporarily held requests that subsequently reach the actual backend; no fabricated response/success.

Full browser onboarding covers actual company/branch creation, configuration, rejection of premature review, service assignment, invitation SMTP capture, MFA setup/acceptance, scoped client login, review/activation and persisted refresh. The manual-development app (5173/API 8000/development DB) stays separate from test app (5174/API 8001/qualifyflow_ui_test). New long-identity fixtures are guarded to that exact test DB, with secrets only in ignored .local files.

Final executed: **28 backend tests passed**, **3 frontend tests passed**, **1 full real browser onboarding journey passed** (15.0s; total 16.6s), **TypeScript/Vite build passed**. **48 axe/viewport cases: zero violations and zero horizontal overflow.** Existing backend Starlette/httpx deprecation warning remains. Further evidence is recorded in IMPLEMENTATION_STATUS and CURRENT_CONTEXT. Browser-measured contrast: primary body 15.14:1, secondary 8.59:1, muted/table 5.07:1, primary button text and focus 5.18:1, input boundary 3.15:1. Axe also checks rendered text on actual supporting surfaces. Keyboard checks cover sign-in order, visible workspace focus, full account disclosure. Reduced-motion checks find no running animations; 200% CSS-zoom reflow checks have no horizontal overflow.

Production build uses the existing self-hosted normal Inter subsets (Latin ~48.3KB); no new runtime dependency. Final JS 255.18KB/78.35KB gzip; CSS 43.26KB/8.94KB gzip. No formal WCAG certification or complete manual screen-reader review is claimed. Existing M0/M1 hardening, Redis/Compose/remote CI and production readiness gates remain open.

## Change map and next milestone

Runtime: frontend/src/{App.tsx,UI.tsx,main.tsx,style.css,premium.css}, design-system/qualifyflow/tokens.css. QA: frontend/scripts/ui-review.mjs and backend/scripts/seed_ui_qa.py (test fixtures only). Documentation: this report/gallery, DESIGN.md, MASTER.md, design reference decisions, ADR-0003 and persistent implementation records. No endpoint or migration added.

M2 remains next: tenant-private driver identities/engagements and secure versioned evidence. Future data-heavy modules should reuse these type/surface/row/form patterns while adding only real backend-backed functionality. Server-side directory search, richer selection/pagination and manual assistive-technology coverage remain future improvements, not hidden in this visual completion claim.
