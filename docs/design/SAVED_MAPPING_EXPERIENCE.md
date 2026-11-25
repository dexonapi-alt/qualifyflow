# Saved mapping experience

2026-11-19 — ADR-0028, extending guided spreadsheet intake.

The new flow removes repeated column selection from recurring handoffs without concealing source review. Expand **Original file & column mapping → Save this column mapping** on a recorded receipt. Name the mapping and explain its suitability; save as new or append a revision to an existing mapping in the same location. Confirmation appears only after the persisted response.

During a later import, a shallow neutral module offers actual saved mappings for the selected company/location. Apply is disabled when header names/order differ. Native selects, manual fallback, visible explanations, refresh and an expandable retirement form retain keyboard access and the current Inter/cobalt/white visual language. No sidebar changes or decorative widgets. Current column controls remain visible for verification, and row preview remains mandatory in the UI. Retirement is hidden from contributors and independently forbidden by the API.

Historical receipt provenance shows the original template name/version and expandable opaque revision reference. Ordinary metadata stays text, grouped definitions keep strong alignment, and mobile controls stack. Small utility icons retain their dimensions on narrow screens. The library adds no new motion; existing reduced-motion behavior remains.

Comparison: the previous mapping-only stage is preserved in `spreadsheet-intake/column-mapping-*.png`. Fresh rendered evidence lives in `mapping-templates/`: save-from-receipt, mapping reuse, incompatible layout, and retired-import rejection at 375/768/1024/1440. Machine-readable accessibility/reflow findings are in `results.json`. Desktop reuse and mobile mismatch screenshots were inspected visually. Earlier full-page capture focus/scroll artifacts were corrected in the capture helper rather than treated as product layout defects.

Verification and exact remaining gates are recorded in CURRENT_CONTEXT. Automated axe/reflow checks are targeted evidence, not independent accessibility certification. Native XLSX scan/row limits and metadata-only boundaries remain from ADR-0027; saved mappings do not create drivers, upload reports or accept evidence.
