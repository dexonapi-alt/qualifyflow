# Visual information system

2026-11-17. Focused design iteration on existing M1 Company Overview, people, locations and audit. Sidebar, authentication, permissions, API contracts, migrations and business rules preserved. M2 remains paused pending review.

## Audit and reference interpretation

The supplied current screenshot has clear navigation but gives company facts, activation responsibility and permissions nearly identical text treatment. The healthcare reference differentiates information through identity, semantic surfaces and visual rhythm. Its charts and portraits are justified by its own data; importing those into QualifyFlow would invent information.

Adopt recognition cues, a distinct readiness focal point, scoped action modules and identity-based table scanning. Retain crisp white canvas, current Inter typography, cobalt actions, compact facts and real operational tables. No broad lavender wash, generic 2x2 metadata cards, value bubbles, fake progress, photos, compliance score or future modules.

Revisited the four authoritative specifications, current context/traceability/ADRs, DESIGN/MASTER/tokens, actual routes/components, awesome-design-md/design-md/linear.app/DESIGN.md, and UI UX Pro Max's design-system/SKILL.md and states-and-variants reference. Adopted semantic token aliases and state/focus discipline. Rejected Linear's marketing dark palette/proprietary type and the reference's unrelated healthcare metrics. No new dependency or external asset.

## Implemented patterns

- IdentityMark: compact initials from a company name or actual email. Decorative and hidden from assistive technology because adjacent text supplies identity. No invented human names or photos.
- ReadinessSignal: clock/check/shield, explicit state text and semantic amber/mint/alert surface, driven by persisted account status. No inferred completed steps or percentage. Existing service-admin prerequisite list remains conditional and unchanged.
- Overview: readable company facts in the left column; readiness/access/action hierarchy at right. One compact company status remains in the identity area. Authorized branch count is a working keyboard-operable link to Locations, verified against the backend scope. Ordinary dates and legal names remain plain text.
- People: generated initials, actual email, role category and scope, existing state/action columns. Invitations remain separate from accepted memberships. Existing invite/revoke/resend handlers retained.
- Locations: branch symbol on real records; original lightweight organization-connection SVG for the true empty state. It is decorative, not a map or represented location. Existing search, scope, Add branch and permissions retained.
- AuditAction: category icon and readable known event label, with the exact raw event code below. Table remains chronological from the API; timestamps explicitly show UTC with machine-readable original time. Expandable actor, target, correlation and event identifiers preserve diagnostic precision. No actor name lookup or inference.
- Motion: one 200ms opacity/3px continuity reveal on Overview, no operational row stagger or loop. Existing hover/focus interactions remain immediate; reduced motion disables the reveal.

Source: frontend/src/VisualInformation.tsx, visual-information.css, App.tsx, main.tsx; canonical design-system/qualifyflow/tokens.css. QA script adds truthful readiness/scope and keyboard location-action checks. No new endpoint, migration, background job or backend implementation.

## Verification and rendered review

[Before/after gallery](visual-information/index.html) and [raw results](visual-information/after/results.json). Baseline captured from the actual app before this iteration. Final screenshots at 375, 768, 1024 and 1440. Opened actual desktop/phone Overview, tablet layouts, long-name branch viewer, people, empty locations and populated audit. The audit inspection exposed overly technical fallback labels; mapped the actual activate/review/assignment events and made UTC/full references explicit, then reran the matrix.

Executed: 28 backend tests passed (one pre-existing Starlette/httpx deprecation warning); 3 frontend tests passed; production TypeScript/Vite build passed; real onboarding browser journey passed (22.8s, 28.5s total). Includes actual PostgreSQL persistence, local SMTP, MFA invitation acceptance, client invitation refresh/revoke and service activation.

Final browser matrix: 96 axe/viewport cases, zero violations and no document overflow. Real empty/single/multi-record states, draft/active/suspended accounts, delayed/error/loading screens, long identities, scoped locations, existing search/filters, management navigation, keyboard focus/account menu/sign-out, revoked-cookie HTTP401, reduced motion and 200% CSS reflow passed. New checks compare location count to the authorized API response and activate its link by keyboard. Readiness contains no fabricated percentage. Current token contrast checks passed; new real surfaces also scanned by axe.

Final build: JS262.61KB /79.86KB gzip; CSS62.70KB /11.88KB gzip. No heavier image/motion library or network font. This is build-size evidence, not a load-performance benchmark or full manual screen-reader certification.

## Deferred asset/workflow contracts

Evidence previews must eventually show real private thumbnails only after authorization/quarantine, type/version/review metadata and safe loading/error behavior; no dummy preview component is exposed now. Workflow progress needs a backend-owned set of stages and actual completion facts before a stepper/progress bar is used. Rich organization/evidence illustrations can be explored later using original artwork; this pass uses only a small original connection motif tied to the empty location explanation.

Review this iteration before M2. Existing M0/M1 recovery, Redis/Compose execution and production security/privacy release gates remain open. No legal readiness, third-party integration or production deployment claims.
