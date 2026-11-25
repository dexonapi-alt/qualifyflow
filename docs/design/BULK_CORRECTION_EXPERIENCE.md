# Bulk source correction

2026-11-19 — ADR-0029.

The existing receipt table gains compact, labeled selection controls for authorized correction roles. Select individual editable rows or up to the first 25; matched, attached, duplicate and superseded rows remain unavailable for new editing. Selection is bounded and contextual. No shell/navigation/font change is introduced.

**Correct selected rows** opens the existing native inspector. Each source row has aligned editable metadata fields and a remove action, followed by a shared verified correction basis. Preview shows row-specific ready/blocked/unchanged results before confirmation. Actual confirmation shows recorded replacement counts, the real actor/basis, individual failure reasons and links to each replacement. A failed row does not erase successful corrections. Matching/evidence review remain distinct next steps.

Expandable recent-run history keeps attempted values and outcomes available after closing/reloading. A failed row can be selected again for a new attempt; repeating the original command replays its existing run. History is limited to the latest20 entries for a receipt. This is not an error-CSV reupload facility.

Rendered inspection found a native textarea fallback inside the portal and excessive selection-column width. The textarea now uses existing control typography, border, radius and focus conventions; selection gets 44px label targets and a measured column. Preview screenshots explicitly scroll the inspector to the result section at each width rather than presenting an unrelated editor position.

Evidence: `bulk-corrections/receipt-before-*.png` captures the original receipt before correction (not a pre-feature baseline); editor/mixed-preview/recorded-outcomes/persisted-history captures show the connected flow at375/768/1024/1440. `results.json` records targeted axe/reflow findings. Existing guided-intake screenshots remain the prior visual baseline. No fabricated records, avatars or completion metrics were added.

See CURRENT_CONTEXT for executed tests and exact limitations. Automated accessibility checks are not independent screen-reader certification. Original files, immutable source rows and the explicit match/scan/review workflow are preserved.
