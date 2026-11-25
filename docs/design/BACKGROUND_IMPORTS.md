# Background import workspace

2026-11-20 — ADR-0030.

Entry: **Screening inbox → Background imports**. Keep the small guided importer intact. The new workspace provides a private upload form, real recent-job list, source identity, durable stage/progress, contextual mapping, paginated preview and links to recorded receipt parts. Users may leave and reopen an import from the saved list.

Progress counts committed metadata rows only. Before inspection determines the row count, the total remains unknown; there is no fabricated percentage or loading delay. Stage labels distinguish waiting for user input from queued/working phases. Confirmed metadata can include invalid/duplicate outcomes, so completion never implies accepted evidence or qualification. Retry and stop controls reflect actual server capabilities. A contributor cannot control someone else's upload.

Mapping reuses existing native controls/library and current typography, neutral surfaces and cobalt actions. Once validation finishes, the editor collapses to a compact mapping summary so row results lead. **Change column mapping** reopens it; unsaved changes disable confirmation until revalidated or explicitly discarded with **Keep validated mapping**. A real worksheet selector is shown only for actual inspected worksheets.

Receipt parts show source data-row ranges. Local receipt rows begin at1; the link preserves the original ordered source and offsets. Original SHA-256, file name, worksheet and mapping remain available through provenance. Part links open existing review/correction workflows; they never substitute static mockups for records.

Visual QA fixed a skipped heading level, mobile filename proportions, error-token use and the initial overlong validated-mapping editor. Existing shell/sidebar/fonts/motion stay intact. Table regions scroll within the page on narrow screens, controls remain keyboard reachable and reduced motion uses the established behavior. Reopening the screening inbox refreshes newly recorded receipts.

Evidence: `background-imports/` holds upload, mapping, validated-preview, completed, recorded-part, canceled and error captures at375/768/1024/1440. `results.json` records28 zero-axe/overflow cases and no page errors from the final real-worker journey. The journey used actual XLSX/Defender scanning,125 rows, cross-part duplication, invalid date metadata, paginated preview, confirmation, three committed receipts, reentry/provenance, keyboard cancellation, reduced motion and a1001-row rejection. Final screenshots were visually inspected. Earlier guided-import screenshots remain the historical baseline; these captures are actual states rather than a claimed pre-feature screenshot.

Exact backend/build evidence and limits are in CURRENT_CONTEXT. These targeted checks are not independent accessibility certification, production load testing or regulatory acceptance.
