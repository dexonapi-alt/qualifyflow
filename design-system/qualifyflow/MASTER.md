# Current design authority — ADR-0017

Owner BEST DESIGN.webp direction supersedes older shell freezes and header bans below. White continuous sidebar/canvas; selected navigation #2f63e3/white; pending#e9a0e8,working#9ff2a4,completed#6a90f7 with dark semantic labels. Primary ink#111111, secondary#595959, white surfaces. Canonical tokens.css, existing Inter/icons, reduced-motion support. Useful compact header, role-oriented navigation, real identities and scoped records. One wide short record preview, two balanced work sections, expandable supporting details,16px rhythm. No fake widgets/metrics/photos/legal outcomes. Current implementation: ProductChrome/ManagedOverview/managed-product.css. Read docs/design/MANAGED_PRODUCT_EXPERIENCE.md; historical guidance below applies only where consistent.

---

# QualifyFlow design system

Current direction: Document 02 v1.1 plus the final product-owner correction recorded in ADR-0007. Read docs/design/OVERVIEW_REGRESSION_CORRECTION.md and overview-correction/index.html. Earlier galleries/reports are historical, not competing rules.

## Foundation

Canonical values live in tokens.css. Continuous white working canvas and near-white navigation, #FAFBFC neutral support, charcoal #181C25, muted #586273, divider #E5E8EE. Cobalt #265CFF identifies primary actions, selected tabs and focus. Navigation selection uses a quiet neutral surface with aria-current. Semantic state text and dots use small accurate amber/green/red accents. No broad lavender or blue-gray panels; legacy supporting token names resolve to restrained neutral/blue values. State never implies legal qualification.

Retain self-hosted licensed Inter Variable and tabular numbers. Body regular, controls/primary values 500, work and record headings 600. Sections 500-600 as appropriate. Work titles 25-28px, record headings 21-22px, sections 14-18px, body/data 13-14px, metadata 11-12px. No excessive uppercase labels/tracking. Utility icons share 24-unit viewBox/1.5 stroke with rounded caps/joins, 18/16/14px navigation/action/inline sizes. No fabricated photos or decorative icon tiles.

Controls 7px radius, bounded records 10px; elevation is minimal. Color/property feedback uses 140-260ms timing. No list-row staggers or perpetual motion. Reduced motion removes transitions/animations/pressed transforms. The existing login evidence-path illustration reveals once, disappears on phone, and is not a reason to enlarge routine screens.

## Composition and behavior

- Brand/divider/working navigation in the sidebar; no repeated workspace descriptors and no standalone top bar. Main starts with title, useful context and a small breadcrumb, followed by existing section navigation/actions/content. Operations/client surface identity and selected company context remain distinct in breadcrumbs.
- Single-company portal has no outer card/frame or forced height: identity and real configuration/user actions; compact account notice; unboxed service/date/role metadata; ruled details/location columns; small exact access-scope footer. Manage users is primary only when authorized, and Manage locations opens the real branches section. No separate oversized access or summary cards.
- Operations directory remains a continuous white row surface with working loaded-record search/filter/sort, explicit loaded count and API offset pagination. No invented totals, bulk controls or context menus. Company/member/branch/history lists retain their actual state and actions.
- Existing contextual company navigation and editing forms use consistent boundaries. Distinguish primary/secondary/quiet/destructive actions. Native forms preserve field help, error focus, paste/autocomplete and pending disabled controls. No success before confirmed persistence.
- Native account disclosure reveals the full long email and actual Sign out by keyboard above content. It stays reachable on phone, supports Escape/focus return and preserves real session revocation. Compact Local / Synthetic data indicator remains visible. Current permission-driven rendering and stale-response guards remain. Detailed readiness items remain restricted to service administrators by existing API behavior.

## Responsive/accessibility contract

375/768/1024/1440 layouts preserve identity, state and authorized actions. Stack record actions and columns on phone; wrap long names and preserve full values. Phone important controls use 44px targets. Test keyboard order/focus, contrast, pending/error/empty states, real long/branch-scoped records, 200% CSS reflow and reduced motion. Input/focus boundaries must meet 3:1; normal text 4.5:1 on actual surfaces. Do not equate automated axe results with full assistive-technology certification.

Future selection, menus, bulk operations and server-side filtering require actual corresponding APIs/workflows; no preview controls in the product. Existing M0/M1 hardening remains tracked and M2 is next.

## Current company information architecture

One shared CompanyWorkspace supplies the single-company portal and selected-company management. Navigation is Overview, Locations, permission-gated People & access, Configuration, plus actual permitted audit/service sections. Company identity/status is compact below navigation, subordinate to the main page title. Async section reads have loading feedback and preserve existing stale-read cleanup.

Overview is an open 7/5 Company information / Setup & access composition, naturally stacked on mobile. Ordinary date/scope/company values are plain text. One company status indicator in identity; a soft role badge represents actual category only. Activation context is descriptive text. Existing actions remain beside access context, not a separate bottom-of-page action collection. No 2x2 metadata cards, nested value boxes, fabricated metrics or filler.

Locations uses actual scoped branches with loaded-record search; Add branch remains manager/writable-only. Members and invitations have semantic columns and real handlers; audit uses actual timestamps, event, actor/target identifiers and correlation reference. Expandable IDs reveal full actor/target values. Unknown names are not invented. Narrow operational tables scroll within labeled keyboard-focusable regions. Client Configuration is read-only; service-admin controls and detailed readiness retain the existing API boundary. No new backend/API rules or palette/font/sidebar change is implied.

## Visual information extension (ADR-0009)
Shared IdentityMark derives initials from supplied name/email; never fabricate photos or display names. ReadinessSignal uses persisted account status, with no inferred completed steps or percentages. Distinct semantic readiness and actionable scoped-location surfaces are permitted; they do not restore generic metadata cards. People retain real table semantics/actions. AuditAction adds readable labels alongside exact event codes, UTC time and expandable full actor/target/correlation/event identifiers. Existing sidebar (ADR-0008), fonts, shell and APIs remain. See VISUAL_INFORMATION_SYSTEM.md and visual-information/index.html for verified renders. Document previews and workflow progress require actual authorized evidence/stage contracts before exposure.

## Action-led Overview (ADR-0010)
Owner-approved three-module composition supersedes the older open-column Overview restriction. Company profile owns client identity/status, grouped organization/contact/service facts and configuration link. Readiness owns honest account state, actual role/scope and authorized next actions. Locations previews at most two scoped backend records with exact reference/status/count and an action to the full working section. Desktop proportional columns; mobile stack. Ordinary values are never fake inputs or separate metadata cards. Keep existing sidebar, tabs, type/palette and truthful-state contracts. Runtime: CompanyOverview.tsx / overview-workspace.css; evidence: OVERVIEW_WORKSPACE.md and gallery. M2 remains paused.

## Final visual-language contract (ADR-0011)
Retain the existing 24-unit/1.5-stroke family. Location symbols denote branch records; connected branches denote structure; service denotes operational arrangement; access key denotes permission context; pause denotes suspension; info denotes neutral/unavailable. Original spot variants share record geometry and restrained accents. SVGs/initials are decorative beside real labels. Stable supporting identity colors never mean role or status. Form feedback appears only after save plus refresh; parent-owned message/path survives remounts, pending/errors suppress success, and navigation clears it. Existing error focus/native controls/reduced motion remain. See FINAL_PRODUCT_POLISH.md and final-product-polish/index.html; no new production dependency or M2 module.


M2 driver workspace extends the approved shell with capability-based company navigation, compact searchable roster, initials, labeled operational states, identity/current-engagement modules and real immutable history. See docs/design/M2_DRIVER_WORKSPACE.md and ADR-0012. Never imply legal eligibility or document readiness from engagement state.
