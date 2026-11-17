# Current design authority — ADR-0017

Owner BEST DESIGN.webp direction supersedes older shell freezes and header bans below. White continuous sidebar/canvas; selected navigation #2f63e3/white; pending#e9a0e8,working#9ff2a4,completed#6a90f7 with dark semantic labels. Primary ink#111111, secondary#595959, white surfaces. Canonical tokens.css, existing Inter/icons, reduced-motion support. Useful compact header, role-oriented navigation, real identities and scoped records. One wide short record preview, two balanced work sections, expandable supporting details,16px rhythm. No fake widgets/metrics/photos/legal outcomes. Current implementation: ProductChrome/ManagedOverview/managed-product.css. Read docs/design/MANAGED_PRODUCT_EXPERIENCE.md; historical guidance below applies only where consistent.

---

# Evidence in Motion

Document 02 v1.1 owns creative direction; current owner-authorized refinements are reconciled in docs/decisions/ADR-0007.md. Read design-system/qualifyflow/MASTER.md and docs/design/OVERVIEW_REGRESSION_CORRECTION.md before UI changes. Previous design reports are historical evidence, not competing instructions.

Continuous white working canvas, near-white navigation and charcoal text. No separate top app bar or giant company frame. Page title leads, then useful context, small breadcrumb, existing sections/actions/content. Cobalt marks brand, primary actions, focus and selected tabs. Navigation selection is a subtle neutral row. The sidebar contains brand, working navigation, a small local/synthetic indicator and an accessible account disclosure with real sign-out, also on phone. Semantic states always have readable labels. Cards are allowed for meaningful groups; tables remain row-based. No fake metrics, activity, progress, photos or future navigation.

Canonical runtime values: design-system/qualifyflow/tokens.css. Base rules: frontend/src/style.css; current shared visual layer: frontend/src/premium.css. Self-hosted Inter Variable (OFL license shipped), one 24-unit/1.5-stroke utility family. Work titles 25-28px, record titles 21-22px, sections 15-18px, body 13-14px. Body 400, controls 500, work/record titles 600. Operational surfaces are compact; expressive typography belongs to brand/onboarding moments.

Preserve tenant context, current authorization, real API operations and stale-read safeguards. Native forms retain linked errors, paste/autocomplete, disabled pending states and truthful persistence feedback. Functional motion 140-260ms, no loops or operational row staggers, reduced motion removes transitions. Test real states at 375/768/1024/1440, keyboard, contrast and reflow. M2 is next; do not invent M2-M6 screens.

Current Company Access: real Overview/Locations/People & access/Configuration plus permitted audit/service navigation. Overview uses open 7/5 Company information and Setup & access columns, plain ordinary values, one company status and one purposeful soft role category. Actions sit near access context. Never restore the rejected four summary cards or bordered value bubbles. Operational data uses actual semantic tables; narrow tables scroll in labeled focusable regions. See ADR-0006 for shared workspace reuse and ADR-0007 for the final Overview correction.

Latest visual-information extension: ADR-0009 and docs/design/VISUAL_INFORMATION_SYSTEM.md. Preserve sidebar ADR-0008. Readiness uses actual status without inferred percentages; company and email initials aid recognition, location summaries use authorized branches, audit retains raw facts. Keep plain company values and avoid generic metadata-card grids. M2 remains paused for review.

Current Overview composition: ADR-0010 / docs/design/OVERVIEW_WORKSPACE.md supersedes older open-column-only guidance. Three purposeful modules: larger company profile grouped into Organization/Primary contact/Service details; readiness/access/actions; actual scoped locations or true empty state. Plain values, no generic metadata cards. Sidebar and management tabs remain unchanged. Review before M2.

Final visual language: ADR-0011 / docs/design/FINAL_PRODUCT_POLISH.md extends the approved Overview. Meaningful utility symbols; original record-based spot illustrations only for real empty/search states; deterministic identity colors are non-semantic. Confirm forms only after resolved save/refresh, near the action, surviving reloads but clearing on navigation. Unknown readiness stays neutral. Freeze current layout/sidebar; M2 remains next after review.


M2 driver workspace extends the approved shell with capability-based company navigation, compact searchable roster, initials, labeled operational states, identity/current-engagement modules and real immutable history. See docs/design/M2_DRIVER_WORKSPACE.md and ADR-0012. Never imply legal eligibility or document readiness from engagement state.
