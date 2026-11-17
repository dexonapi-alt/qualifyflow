# Visual craft refinement

Historical iteration: current design rules and evidence are in [PREMIUM_PRODUCT_OVERHAUL.md](PREMIUM_PRODUCT_OVERHAUL.md) and ADR-0003.

2026-11-17. Focused follow-up to PRODUCT_UI_REFINEMENT.md, before M2. Existing navigation, workflows, backend services, authentication, authorization, API contracts and persisted operations are unchanged.

## Audit
The prior CSS named Inter but shipped no font assets. Rendering therefore depended on the computer's installed fonts and fallback metrics. Frequent 550–650 weights, uppercase micro-labels, pale-blue initials tiles, blue secondary actions and outlined status chips gave unrelated elements similar emphasis. The single-company summary had a rounded outer frame, tinted setup band and divided inner sections that competed with the actual account information.

Reviewed Document 02 §§3–6 and motion/accessibility rules; the actual local Stripe and Linear DESIGN.md references, particularly type roles, tabular data, neutral surfaces and secondary controls; UI UX Pro Max's typography-scale/font-loading guidance. Proprietary typography, gradients and dashboard layouts were not copied.

## Typography decision
Both fonts were rendered on the same real, synthetic client account with identical layout:

- [Inter study](visual-craft/font-study/inter.png)
- [Geist study](visual-craft/font-study/geist.png)

Selected **Inter Variable** for its open body text and familiar account/form rhythm. Geist's more compact geometric appearance was a viable alternative, retained only as a development dependency for repeatable comparison. This is a design judgment, not a universal readability claim.

Inter 5.3.0 is self-hosted from @fontsource-variable/inter; no Google Fonts/CDN request. Normal variable weight covers the interface with unicode subsets selected by the browser. The Latin WOFF2 asset is about 48KB. The build emits other normal-script subsets for international names; Geist is not imported into the application bundle. Both packages' actual LICENSE files were reviewed: SIL Open Font License 1.1. Inter's license is copied into public/fonts/OFL-Inter.txt and shipped in production output.

| Role | Size / weight | Treatment |
|---|---|---|
| Page titles | 24px phone / 26px desktop, 550–600 | Restrained tracking; no uppercase eyebrow above routine directory |
| Company identity | 21–22px, 550 | Main record anchor, no fabricated initials logo |
| Section titles | 14–18px, 500–550 | Short, factual labels |
| Body and account values | 13–14px, 400 | Natural reading rhythm, tabular numbers |
| Company rows / controls | 13–14px, 450 | Selected emphasis without blanket semibold |
| Navigation / secondary actions | 12–13px, 400–450 | Neutral by default |
| Metadata | 11–12px, 400 | Muted but contrast-tested; full identity available |
| Mobile auth inputs | 16px, 400 | Prevent tiny form text; paste/autocomplete preserved |

## Icon system
Keep the existing eight-glyph QualifyFlow line family on a 24-unit viewBox: one 1.5 stroke, round caps/joins, flex-centered baselines. Navigation is 18px, actions 16px, inline direction indicators 14px, consumed through shared tokens. The brand mark is a separate identity asset, not a utility icon.

Removed the decorative authentication shield tile, workspace QF/CO square, company initials tiles and unnecessary People/access icon. Remaining location, navigation, search and action icons communicate a task and stay neutral. No new icon-library dependency or mixed filled/outlined utility system.

## Color and component decisions
- White remains the working canvas. Neutral ink #252B37, muted #626B79, dividers #E6E8EC, sidebar #FAFAFA and table surface #F7F8FA form the base.
- Brand and primary action retain #265CFF. Explicit action/focus/brand, secondary, navigation-active and information roles are separate semantic tokens.
- Active navigation uses a neutral surface and a narrow brand marker; the label/current-page semantics remain explicit.
- Secondary buttons and inline actions use neutral text. Primary actions remain blue; danger actions remain red. No broad blue label treatment.
- Status labels use readable words with small semantic indicators, without repeated colored pill backgrounds/borders. Active is not presented as legal qualification.
- The company summary is now open record composition: identity, a compact ruled setup notice, profile/access facts and locations/actions. No outer summary card or tinted setup panel. Membership facts have a clear continuous separator.
- Editing forms retain a bounded neutral surface because their save scope is meaningful. Buttons use 5px radii, thin purposeful borders and subtle hover/focus feedback. Structural separators remain quieter than input boundaries.
- Sidebar account email truncates visually where needed with full text/title retained, avoiding awkward multi-line email fragmentation.

Existing context transitions and one-time evidence-art reveal remain. No loops or new motion dependency. Reduced motion still disables animations/transitions. No fake controls, metrics, activity or new modules.

## Before/after and inspection
[Open comparison gallery](visual-craft/index.html).

| Surface | Before | After |
|---|---|---|
| Client account | [1440px](visual-craft/before/client-one-1440.png) | [1440px](visual-craft/after/client-one-1440.png), [375px](visual-craft/after/client-one-375.png) |
| Operations | [1440px](visual-craft/before/operations-1440.png) | [1440px](visual-craft/after/operations-1440.png), [375px](visual-craft/after/operations-375.png) |
| Authentication | [1440px](visual-craft/before/login-1440.png) | [1440px](visual-craft/after/login-1440.png), [375px](visual-craft/after/login-375.png) |
| People/access | [1440px](visual-craft/before/people-1440.png) | [1440px](visual-craft/after/people-1440.png) |

Actual running application screenshots use the same dedicated synthetic QA database for both captures. Existing earlier E2E records were preserved. Desktop login/client/operations/people, phone client/operations and both font studies were opened and visually inspected. No user credentials, real company data or driver evidence appear in the captures.

## Executed checks
- 32 screen/viewport axe scans at 375/768/1024/1440: **zero violations, zero horizontal overflow**. Covers login, real login error, directory with long names, no search results, company detail, people, single-company and empty client.
- Keyboard focus order: email → password → authenticator code → sign in; visible focus on logged-in screens. Existing native button/confirmation behavior preserved.
- Reduced-motion checks: zero active animations. 200% CSS-zoom overflow checks passed. Desktop auth controls fit a 1440×800 viewport.
- Browser confirmed Inter Variable loaded. Raw matrix: [after/results.json](visual-craft/after/results.json).
- Measured token contrast: body 14.20:1, secondary 8.94:1, muted/table 5.07:1, primary action text 5.18:1, focus 5.18:1, input boundary 3.15:1. Text pairs exceed 4.5; control-boundary/focus pairs exceed 3. Decorative dividers are not treated as input boundaries.
- Backend regression **28 passed**; frontend **3 passed**; full real onboarding browser journey **1 passed**, including invitations/SMTP/MFA/client scope/activation/refresh.
- TypeScript/Vite production build passed: ~254KB JS / 78KB gzip, ~37KB CSS / 8KB gzip, local Inter font assets. No backend migration or service changes.

This is automated accessibility and visual inspection evidence, not a claim of complete WCAG certification or independent screen-reader assessment. Those broader release gates remain open.

## Changed implementation
frontend/src/main.tsx, UI.tsx, App.tsx and the visual-craft section of the shared style.css; canonical tokens; font dependencies/lockfile and distributed Inter license. Changes to App.tsx are presentation/copy/markup only. QA scripts add an output-directory option, actual font verification, contrast checks and a repeatable font study. Existing earlier screenshots are preserved.

**M2 remains the next milestone.** No M2–M6 feature was added or represented as implemented. The previous M1 hardening backlog and production gates remain tracked separately.
