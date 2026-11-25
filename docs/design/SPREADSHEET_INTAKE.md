# Guided spreadsheet intake

2026-11-19 — M3 continuation, ADR-0027.

The existing inbox accepted only canonical five-column CSV. The new entry is **Screening inbox → Import spreadsheet**: choose a CSV/XLSX, inspect it, connect columns, preview outcomes, then confirm receipt. Location and selected company stay explicit. Real row states and preserved source context replace implicit assumptions; no fabricated processing progress or auto-acceptance appears.

The current shell, typography, semantic colors and native detail panel remain. A compact step indicator reflects local UI stages, not compliance completion. Desktop mapping uses two aligned columns; mobile stacks controls. A source-review panel retains the receipt underneath, offers a linked correction, searches actual authorized drivers and records a reviewed reference/engagement match. Initials come from real records. Ordinary metadata is plain text. Repeatable records remain tables with horizontal scrolling on narrow screens.

Visual review caught a shared definition-list grid colliding with grouped source facts; it was explicitly overridden. The initial mapping was also tightened from a tall single-column form. These were rendered-image findings despite passing automated accessibility checks.

Evidence: `spreadsheet-intake/receipt-list-*.png`, `column-mapping-*.png`, `mapped-preview-*.png`, `source-review-*.png`, `reviewed-match-*.png`, and `results.json`. The receipt-list capture is the current entry state, not a claim of a pre-change baseline screenshot. Earlier canonical intake screenshots remain in prior design-review directories. Final captures cover 375, 768, 1024 and 1440px. Desktop mapping and mobile/desktop inspector screenshots were inspected visually; final browser checks include 20 axe/reflow scans, actual CSV import/correction/matching/open-file navigation, real Defender-cleared XLSX inspection, keyboard dismissal/focus and reduced-motion mode. No full screen-reader certification claim.

Implementation limits: metadata only, 100 selected-sheet rows, no arbitrary mapping transforms or user creation, scan outage fails closed. Original-workbook downloads and mapping templates remain absent. Authentication, personal driver workspace and business decision authority are unchanged.
