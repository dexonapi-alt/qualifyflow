# Final visual direction correction

Historical iteration: current shell hierarchy and account controls are documented in [SHELL_COMPOSITION_CORRECTION.md](SHELL_COMPOSITION_CORRECTION.md) and ADR-0005.

2026-11-17. Applied to the working M1 login, shell, Client Portal and Operations Console. No backend logic, authentication, permissions, API contracts, migrations or business transitions changed. M2 remains next.

## Specific critique before editing

The supplied current-product screenshot and settings reference were visually inspected alongside both critique images. The prior application spread lavender across the sidebar, workspace and account summary, then added white setup/profile/location groups and a blue-gray access block. Those large horizontal surfaces carried similar weight. Small management text links competed poorly with descriptive account content, and the arrangement pushed useful actions below the viewport. Typography was tidy but insufficiently differentiated. Passing accessibility tests did not resolve those composition problems.

The settings reference concentrates attention on working controls and aligned records. Its white interior is the relevant principle; the saturated blue outer presentation frame is not an application background. We adopt clear primary/secondary actions, compact functional groups and sharper type contrast without copying its brand, content, arbitrary navigation or fake modules.

## Implemented decisions

| Area | Before | Corrected implementation |
|---|---|---|
| Color distribution | Broad gray-lavender canvas/rail and tinted summary/access blocks | White rail/header/record surfaces, #FAFBFC neutral surroundings, #181C25 charcoal; no lavender wash |
| Main account composition | Stacked identity, summary strip, notice and three panels | One coherent account record with compact toolbar, inline metadata and ruled working sections |
| Action priority | View configuration / Manage users separated as small contextual links | Manage users in cobalt beside a bounded View configuration action; explicit Manage locations button beside actual location rows |
| Account setup | Large notice with a separate activation-owner area | Compact amber notice explains service-administrator responsibility; warning remains secondary to actions |
| Scope | Large blue-gray access card | Small exact branch/company scope footer; role in ordinary metadata |
| Typography | Many similar muted medium weights | 600 work/record anchors, 500 control/primary-value emphasis, regular content and clearly secondary metadata |
| Navigation | Rounded white selected pill on lavender | Blue selected text/icon on a restrained light-blue state; white rail and readable one-line labels |
| Lists and forms | Soft panels and subtle links | Crisp boundaries, compact controls, selected-tab underline, existing aligned company/member lists and truthful loading/error states |

Canonical tokens remain design-system/qualifyflow/tokens.css. Controls use 7px radius; record groups 10px. The existing shared premium.css layer was edited; no extra theme layer or dependency was added. App.tsx changes only SingleCompany presentation: its real loading/cleanup guard, role condition and API call are preserved. Manage users still opens people; configuration and location actions still open the existing company sections. A branch viewer receives no management actions. The existing account disclosure still reveals full long email with keyboard access and proper stacking.

Document 02 §§3–6, 8.6–8.7, 12–13 were re-read against the implementation. Existing initial full specification review and product/workflow/security boundaries remain in force. Revisited canonical tokens, components, context, design-system skill state/variant guidance and local Stripe design analysis. Adopted state feedback and white-surface/control discipline; rejected marketing gradients/proprietary fonts, forced loading effects and the reference's presentation frame. ADR-0004 records supersession of the previous derived direction.

## Rendered evidence

[Before/after gallery](final-direction/index.html). The before captures precede edits; after captures are actual browser output from the isolated synthetic test app. Prior galleries remain unchanged. Directory totals may grow because browser onboarding persists additional synthetic test companies; no history was deleted or values fabricated.

- [Client desktop](final-direction/after/client-one-1440.png) and [phone](final-direction/after/client-one-375.png)
- [Operations](final-direction/after/operations-1440.png), [people](final-direction/after/people-1440.png)
- [Tablet company](final-direction/after/company-detail-768.png), [long branch-scoped identity](final-direction/after/client-long-identity-375.png)
- [Login](final-direction/after/login-1440.png), [pending sign-in](final-direction/after/login-pending-1440.png), [rejected sign-in](final-direction/after/login-error-375.png)

Desktop/phone company, operations and people captures were opened and inspected, including whether the management actions precede supporting data and whether the account fits comfortably at desktop widths. Further viewport, loading, empty, long-name, keyboard and reduced-motion evidence is in [results.json](final-direction/after/results.json). No interface is claimed complete merely from token or automated-test results.

## Verification and limits

Executed: **28 backend tests passed**, **3 frontend tests passed**, **1 full browser onboarding regression passed** (14.6s; 16.5s total), and **TypeScript/Vite production build passed**. **48 axe/viewport cases passed with zero violations and no horizontal overflow**. Existing Starlette/httpx deprecation warning remains. Final formatting check passed.

Browser-measured contrast: body 17.05:1, secondary 8.59:1, muted/table 5.74:1, primary text/focus 5.18:1, input boundary 3.15:1. Loaded-font verification confirms self-hosted Inter. Keyboard order/focus and account disclosure passed; reduced motion has zero running animations; four account states at 200% CSS zoom have no horizontal overflow. Final JS 255.18KB/78.31KB gzip; CSS 45.67KB/9.18KB gzip. No new runtime dependencies. QA covers 375/768/1024/1440 widths; real empty/single/several records; draft/active/suspended states; long names/email; real rejected and pending login; a held detail request that then reaches the actual API; search/filter/sort; branch-viewer actions; account-disclosure keyboard/visibility; 200% CSS reflow; and reduced motion. No mocked success responses.

Full M1 browser regression exercises company/branch persistence, responsibilities, rejection of premature readiness, specialist assignment, actual local SMTP invitation, MFA acceptance, scoped login, activation and refresh. The development app/database remain separate from the test app on 5174/API 8001/qualifyflow_ui_test. No new endpoints or migrations.

Manual screen-reader certification, full M1 recovery/session administration, Redis/Compose/remote CI and production gates remain open as previously tracked. This visual task does not claim full M1/product completion or authorize M2 work.
