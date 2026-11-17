# Action-led Company Overview

2026-11-17. Implements the owner's approval of the three-module recommendation. Scope: Overview composition only; sidebar, title/breadcrumb/tabs, management tabs, authentication and backend contracts preserved. ADR-0010 supersedes the older open-column instruction for this surface.

## What changed and why

The previous screenshot gave company facts, readiness and access similar row-based treatment. The new structure gives each area a task and an appropriate presentation:

- Company profile: white bounded module with monogram, actual company identity/status/reference and working View configuration control. Organization, Primary contact and Service details are grouped by meaning; labels sit above plain values. Contact initials come from the actual email. No nested value bubbles or four generic metadata cards.
- Account readiness: distinct state surface with activation ownership, actual role/scope nearby and the authorized next action. Pending clients who can manage the account are told that user/location setup can continue while service activation is pending. Suspended/closed accounts do not get misleading setup encouragement. Existing service-admin-only blockers remain restricted.
- Locations: independent compact module showing up to two actual authorized locations, references and statuses. Count explicitly means locations in your scope. Existing management route supplies the complete list/search/create actions. True empty state reuses the original lightweight organization motif, plus the working location-management action.

Desktop uses proportional columns with readiness and locations stacked at right; profile has content-driven height. Narrow screens stack the modules. Typography, palette, sidebar and motion vocabulary remain. Short Overview continuity reveal is disabled under reduced motion. No fake percentages, staff, photos, counters or dashboard metrics.

## Implementation and authority

frontend/src/CompanyOverview.tsx replaces the old inline CompanySummary. App.tsx uses it for the existing shared workspace and avoids duplicate identity above the Overview profile. overview-workspace.css is a scoped composition layer imported by main.tsx. Existing ReadinessSignal/IdentityMark/LocationEmpty and semantic tokens are reused. No token palette change or new dependency.

Relevant sources: Document01 company/access requirements; Document03 J01/J02 current account/branch scope and state transitions; Document04 current authorization and accessibility; Document02 meaningful component boundaries, operational typography, state clarity and reduced motion. Existing local Linear reference and UI UX Pro Max state/variant guidance inform restrained boundaries and feedback, not another theme.

The first browser journey caught duplicate company headings in Operations. The profile now has a contextual Company profile heading there. The journey's exact client identity assertion was updated to the new profile location, retaining the same expected persisted company name. Visual inspection caught inherited dl spacing rules; scoped overrides restore intended grouping/alignment. Neither correction changed business behavior.

## Verification

[Before/after gallery](overview-workspace/index.html); raw browser evidence in overview-workspace/after/results.json. Actual screenshots captured before edits and after at375/768/1024/1440; desktop, phone, tablet and long identity renders inspected. New client Overview identity/status is shown once; other tabs keep their previous compact header.

Executed: 28 backend tests passed (existing Starlette/httpx deprecation warning), 3 frontend API tests passed, production TypeScript/Vite build passed, full persisted onboarding browser journey passed (16.8s;18.4s total). Actual company/branch/configuration/assignment, local SMTP delivery, MFA invitation acceptance, client invitation refresh/revoke, activation and reload remain verified. Browser tests additionally verify module count, scoped preview count against actual API records and keyboard configuration/location actions. Existing viewport/axe, long names, loading/errors/empty states, scoped viewer, section navigation, account keyboard/logout/revoked-cookie denial, reduced-motion and reflow checks retained.

Build JS264.77KB/80.25KB gzip;CSS67.57KB/12.61KB gzip. No new image/font/animation dependency. Build initially hit the sandbox's Vite configuration-read restriction; the authorized retry outside sandbox passed. This is not a load benchmark or full manual screen-reader certification.

No original specification, endpoint, migration, backend service, authentication/MFA, authorization or tenant boundary changed. Earlier M0/M1 hardening remains open. Stop here for design review; M2 is not started.

Final expanded browser matrix: **96 viewport/axe cases passed**, zero violations/overflow. Both whole-company administrator and branch-scoped viewer passed direct keyboard configuration and location actions plus count/preview equality against the authorized API response. Raw results saved after the final checks.
