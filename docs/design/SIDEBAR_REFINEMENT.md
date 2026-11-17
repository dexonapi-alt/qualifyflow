# Sidebar refinement only

2026-11-17. Main application content and its current Overview/management sections are preserved. No backend/API/authentication/MFA/tenant/business-rule change, new route, dependency, font or palette.

## Exact comparison and diagnosis

Visually inspected the supplied current sidebar, desired Quixera crop and both gap/aim illustrations. The existing brand tile and 21px heavy wordmark dominated a small navigation area. The isolated selected row included a count without enough meaning, and the bottom account identity was clipped. The reference's strength is a quiet brand, coherent navigation rhythm and a compact profile/utility region—not its number of unimplemented destinations.

Revisited Document 02 logo/icon/navigation/accessibility guidance, the actual sidebar/Brand/shared CSS/tokens and live routes. Existing local Linear typography/navigation analysis and design-system state/variant guidance were reviewed for consistency, not copied palettes or proprietary fonts. No design resource was installed again.

## Implemented composition

- **Brand:** Sidebar-only typeset QualifyFlow wordmark, 18px/600 with a lighter Flow segment and a small cobalt terminal. No separate icon container. The original default Brand remains on login/invitation surfaces.
- **Top/group rhythm:** Existing 224px desktop rail retained (existing intermediate widths unchanged). 16px outer inset, 8px inner optical inset, quiet divider and one structural Workspace caption. Navigation text and caption align on the same text column; icons share a 16px monochrome treatment.
- **Navigation:** 36px compact desktop rows, 5px radius, quiet neutral selected surface, visible focus and existing hover feedback. Phone rows retain touch-friendly sizing. Loaded-company badge removed from the rail; directory loaded counts and real navigation remain. No Dashboard, Settings, Support or future modules invented.
- **Account area:** One divider, small initials derived from the email, full actual address and secondary role, uniform chevron. Long addresses use the footer's full text width rather than a narrow clipped identity column. No display name is fabricated. Client accounts retain Company member as their actual general account category; selected-company permissions remain in the main workspace. Staff roles use authenticated platform_role.
- **Utilities/safety:** Actual sign-out remains in the native account disclosure. Local · Synthetic data sits quietly underneath the profile instead of looking like a separate debug panel. Mobile keeps the existing Account trigger, environment cue, full identity disclosure and real sign-out.

The main workspace markup, Overview layout, tab hierarchy, field styles, company actions and sidebar column width were not redesigned. Sidebar styling is scoped; Brand's new wordmark option is used only in the sidebar. No fake destinations or structural filler occupy the deliberately open middle of the rail.

## Sources changed

frontend/src/App.tsx: sidebar Brand variant, structural caption, removal of count, actual email/role/initials/chevron and footer order; existing navigation/logout handlers preserved.

frontend/src/UI.tsx: optional wordmark-only Brand variant, with default authentication branding preserved.

frontend/src/premium.css: sidebar-scoped spacing/typography/navigation/footer/responsive rules and account chevron. Existing main-workspace rules/tokens remain unchanged.

frontend/scripts/ui-review.mjs: sidebar-only crops plus no-tile/no-count, authenticated identity equality/wrapping/no-clipping checks. Existing workflow/permission/logout tests remain.

## Browser review

[Before/after gallery](sidebar-refinement/index.html). Baseline full-page captures precede edits. Final renders include dedicated sidebar crops at 375/768/1024/1440 for operations, client and long-identity states. Full-page comparisons also demonstrate that main content remains the same working composition. Directory counts can grow from actual synthetic E2E runs; no totals or user identities are invented.

Desktop client/staff rails, 768px long identity, phone navigation/menu and full-page client renders were opened and visually inspected. The first long-email render still fragmented into too many narrow lines; the final long-address footer variant uses its full available width. Brand/navigation/profile alignment, selected-row restraint, divider rhythm and account accessibility were reviewed against the reference.

Final executed tests and counts are appended after verification and recorded in the implementation status. Raw evidence: [after/results.json](sidebar-refinement/after/results.json). Existing coverage includes main navigation, full account email, keyboard disclosure/Escape/Tab/sign-out, old-session HTTP401, reload persistence, scope, all management sections, reduced motion and 200% CSS reflow.

No formal manual screen-reader certification or production readiness is claimed. Earlier M0/M1 hardening remains tracked. M2 was not started.

Verification finalized: existing sidebar/management browser matrix passed 96 viewport/axe cases with zero violations/overflow. Build and 3 frontend tests passed; real onboarding journey passed. This sidebar is also preserved and regression-tested in the subsequent visual-information iteration (28 backend tests, 3 frontend, 1 full browser journey and final96-case matrix). See VISUAL_INFORMATION_SYSTEM.md for current runtime evidence. M2 remains paused for review.
