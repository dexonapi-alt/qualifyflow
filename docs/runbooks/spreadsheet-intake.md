> For handoffs above the small-import limit, use [background imports](background-imports.md): up to 2 MB / 1,000 rows with durable worker processing and explicit preview confirmation. The small flow below remains supported.

# Import and review a client spreadsheet

Use synthetic records in this local build. Stay signed in with an authorized specialist/reviewer or company administrator account; no special provisioning authority grants driver access.

1. Open the correct company → Screening inbox → Import spreadsheet.
2. Select the actual intake location. Choose UTF-8 CSV or values-only XLSX. Keep driver/report identifiers as text so leading zeros survive. Use the existing report categories and ISO dates (or Excel date cells).
3. Inspect the spreadsheet. Select the intended worksheet if there is more than one.
4. Map company reference, driver reference, report type, report reference and reported date. Company reference may explicitly use the selected company; other fields must use distinct source columns.
5. Preview mapped rows. Confirming preserves all outcomes, including errors; it does not upload reports or accept evidence.
6. Open Review source row. For incorrect unused metadata, expand Correct source metadata, enter verified changes and a factual basis, then record the replacement. Follow the new receipt; the original remains history.
7. Search actual drivers. Compare the stable driver reference and employer engagement against the source. Similar names are insufficient. Type the verified reference and record the verification basis before confirming the match.
8. Open driver file, assign the existing client requirement as needed, upload the real synthetic supporting document, wait for the actual scan, and record the authorized review outcome. Imported metadata alone completes none of these steps.

Download row errors produces a private, audited CSV of invalid/unmatched/duplicate outcomes. Do not treat an exported error file as an approved corrected source without reviewing its values. Duplicate rows require investigation of the original receipt; they cannot be renamed through correction. Reviewed or used rows require escalation rather than silent relabeling.

Limits: CSV 64 KB; XLSX 256 KB compressed / 2 MB expanded, five sheets, 32 columns, 100 selected-sheet data rows. Formula/macros/external links/embedded files and arbitrary XLS workbooks are unsupported. XLSX inspection fails closed when real antivirus is unavailable. The local synthetic workspace permits 100 mapped imports/company. The original fixed CSV entry remains available for compatible integrations. There is no automatic driver creation or legal eligibility determination.


## Reuse a recurring client layout

After recording a mapped spreadsheet receipt, expand **Original file & column mapping** and **Save this column mapping**. Enter a descriptive mapping name and verification basis. Choose a new mapping or a new revision of an existing mapping in the same intake location. Only authorized administrators, specialists and reviewers may manage mappings.

For the next handoff, inspect the file, choose **Saved mapping**, then **Apply mapping**. Confirm the displayed source columns/sample values and preview rows before recording. Selecting a mapping does not apply it automatically. Different header names or column order disable Apply; map manually and save a reviewed new revision from the resulting receipt instead. There are no arbitrary transformations or automatic category conversions.

To stop using a layout, expand **Retire this mapping**, record the reason and confirm. Existing receipts remain unchanged. If another user changes or retires a mapping during your import, reload/review it or choose **Use manual mapping**, then preview again. Never reinterpret a conflict as a successful import. Historical receipts retain their exact saved mapping revision; future revisions do not alter past data.


## Correct several source rows

1. Open the original receipt and select up to25 editable source rows. Already matched, attached, duplicate and superseded rows are unavailable for new correction; investigate their current records instead.
2. Choose **Correct selected rows**, correct only verified metadata, remove unwanted selections, and provide a factual basis covering the changes.
3. Choose **Preview corrections**. Ready means metadata can receive a linked replacement; it does not mean a driver/document is approved. Blocked rows show their actual errors. Unchanged rows require no replacement.
4. Choose **Record corrections**. Valid rows create replacement receipts; ordinary row errors remain intact and visible. Scope/permission failures stop the operation. Source rows and original files are preserved.
5. Open a successful replacement to verify the driver/engagement match and continue the existing evidence process. Return to the original receipt to correct only the remaining failed rows in a new run.
6. Expand **Recent correction runs** to inspect saved actor, basis, attempted values and outcomes. A repeated command returns its recorded run rather than repeating successful writes. If a confirmation response is lost, reopen the receipt/history before starting a new operation.

The local synthetic bound is100 runs/company,25 rows/run; history shows the latest20 runs per source receipt. Bulk correction currently uses the in-app editor/API, not corrected-CSV upload, cross-receipt changes or bulk evidence acceptance. Successful replacements still need their own authorized matching and evidence review.
