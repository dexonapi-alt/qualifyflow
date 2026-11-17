# Managed product experience — 17 November 2026

This is the current product direction (ADR-0017), superseding earlier frozen-sidebar, lavender-surface, and sign-out-only-header instructions. Original specifications remain untouched. M2–M4 are partial engineering slices, not completed milestones.

## Reference and critique

Visually inspected the owner's `C:/Users/dexon/Downloads/BEST DESIGN.webp`. Its strength is the relationship between a compact summary strip, one wide record preview and two supporting sections, unified white navigation/header, confident black type, small deliberate status colors and recognizable people. Its project statistics, calendar, notes and photos have no direct QualifyFlow equivalent and were not copied.

The earlier interface separated backend features into competing pages, mixed operational destinations into company settings, and communicated responsibility largely through paragraphs. The initial new overview still displayed too much supporting information at once. The owner's final correction asks for consistent spacing, short previews and progressive disclosure, with gray reserved for secondary information.

## Implemented composition

- White role-oriented sidebar: client Overview/Drivers/Driver files/Requests/Decisions; specialist My work/Drivers/Screening inbox/Review queue/Cases/Client requests/Decisions. Only actual grants show destinations. Company settings stays administrative; expert client tools use a disclosure.
- Useful compact header: actual company context/switching, scoped driver search, real requests, driver registration and authenticated account menu. Mobile uses a native modal navigation drawer. Search and account labels remain accessible.
- Real scoped summary strip, followed by a **full-width three-driver preview** with View all. Counts reflect database records, not preview length.
- **Two equal desktop sections** below: attention and service activity. Attention previews two actionable records; service activity previews three cases. View all leads to real records. Attention distinguishes Requests and Decisions instead of misdirecting both to one list.
- Team identities and recorded review activity are grouped in **Team & recent progress**, collapsed initially and keyboard expandable. No hidden fake metrics, photos, calendar events or synthetic production activity.
- A shared 16px section gap, compact panel headers/rows, 8px panel corners, restrained neutral borders and no panel shadows. Details stack on mobile; primary actions remain reachable.

## Visual semantics

Canonical tokens live in `design-system/qualifyflow/tokens.css`: main ink **#111111**, secondary text **#595959**, white working surfaces, selected navigation/action cobalt **#2f63e3**. Pending **#e9a0e8**, work in progress **#9ff2a4**, completed review/action **#6a90f7** use dark readable labels. Expiry/errors retain distinct warning/error semantics. A completed review never means legally qualified.

Keep self-hosted Inter, existing icon family and Evidence in Motion timings. Gray identifies dates, reference IDs, explanations and supporting metadata; record names, section titles, navigation and actions use strong ink. No broad tinted backgrounds. Initials derive from actual names/emails; no unrelated faces.

## Connected behavior and data boundaries

`GET /api/v1/tenants/{tenant_id}/workspace` returns current permitted driver records, current requirement review counts, actual assigned staff, current actionable requests/decisions and recorded reviews. Provisioning-only users receive metadata, no driver totals. Viewer records omit protected file aggregates. Branch scope and current memberships apply. Three new backend tests cover these boundaries and revocation.

Actual driver registration opens its record/file; source-review cases link to the correct file context; requests and approvals use existing audited operations. Missing requirements do not invent progress percentages. Unassigned work is explicitly unassigned. Evidence review totals count recorded reviews, not compliance outcomes.

## Executed verification

- Production frontend build passed; five frontend unit tests passed.
- Existing 43 PostgreSQL backend regressions passed; three new workspace authorization/aggregate tests passed separately. Ruff app check passed. One pre-existing Starlette/httpx deprecation warning remains.
- `frontend/scripts/product-review.mjs`: **36 actual page/viewport checks**, covering client overview, drivers, requests, decisions, company settings, specialist overview, file queue, cases and screening inbox at **375/768/1024/1440px**. **Zero axe violations, page overflows, failed API requests or page errors** in the final run.
- Browser assertions also passed for keyboard opening team/activity details, reduced-motion animation removal, native mobile drawer Escape, keyboard account disclosure, actual logout and subsequent `/auth/me` 401.
- Inspected actual desktop/mobile overview screenshots and specialist overview, not just CSS. Gallery: [managed-product/index.html](managed-product/index.html); machine results: [results.json](managed-product/results.json). Earlier failed runs surfaced and corrected invalid search ARIA, unnamed/mismatched mobile account control and heading-order issues; they are not counted as passes.
- Synthetic QA HTTP/worker journey created drivers, assigned requirements, uploaded test PDFs, ran actual Windows Defender scans, recorded evidence reviews, routed CSV cases and published an approved in-app client request. Fixtures are confined to `qualifyflow_ui_test`; no fabricated production metrics or outbound messages. Scanner-unavailable/hostile-file and complete correspondence adversarial regression coverage remain incomplete.

## Limits and comparison provenance

Historical pre-change screenshots remain in `overview-workspace/before`, `final-product-polish/before` and other dated galleries. These are historical baselines, not exact same-fixture captures. The owner's current screenshot was also inspected. This iteration's first intermediate screenshots were overwritten by final captures; no exact same-state before/after pair is claimed.

The old full M1 onboarding browser script still expects the previous shell; it was not rerun successfully in this iteration. The actual QA workflow and new browser navigation checks do not replace that remaining regression work. No production-readiness claim, visual performance benchmark or full screen-reader certification is made.

Remaining product work: requirement-only follow-up cases (currently a case requires an intake source), provider/API setup, recipient delivery beyond the authenticated portal, reminders/escalations/automation, S3/MinIO production storage/scanner provisioning, exhaustive private-evidence/message security/recovery tests and full milestone exit criteria. No new milestone was begun during the final composition correction.
