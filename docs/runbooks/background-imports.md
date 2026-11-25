# Background spreadsheet imports

2026-11-20. Local synthetic operation only. Owner: authorized intake specialist/reviewer; runtime recovery: service administrator. ADR-0030 owns boundaries. This does not complete the postponed specialist training exercise.

## Normal flow

1. Sign in to the correct company and open **Screening inbox → Background imports**.
2. Choose the actual intake location and CSV/values-only XLSX file. Optional worksheet name selects a known sheet initially; otherwise the first sheet is inspected. Select another actual worksheet after inspection where available.
3. Queue the private file. The acknowledgement means the encrypted source exists; rows are not recorded yet. A separate worker performs inspection. You can leave and reopen it from Recent uploads.
4. Once inspection finishes, map the five canonical fields or explicitly apply a compatible saved mapping. Preserve identifiers as text. Choose **Validate mapped rows in background**.
5. Review paginated row outcomes and counts. Changing columns requires validation again before confirmation. Invalid metadata is preserved for correction; uncertain identifiers are not silently matched.
6. Choose **Confirm receipt processing**. Progress increases only when actual receipt parts commit. Final outcomes may differ from preview because current data/permissions are rechecked.
7. Open recorded parts for individual/bulk corrections, reviewed driver matching and the existing evidence upload/scan/review flow. Part ranges refer to source data records, excluding the header; local receipt numbering begins at1.

## Worker and recovery

From `backend`, using the existing private local environment:

```powershell
.\.venv\Scripts\python.exe -m app.screening_intake.import_worker
```

This dedicated worker polls every2 seconds and handles one phase/part per sweep. Celery also registers `qualifyflow.spreadsheet_imports`; production provisioning is not approved. Ensure only the intended environment/database is selected. Never paste encryption keys or credentials into logs, issue bodies or screenshots.

- **Queued with no progress:** verify this separate worker is running and the database is reachable. Refresh actual status; do not mark the import complete manually.
- **Retryable failure:** use **Retry interrupted phase** when the UI offers it. It resumes the unrecorded part, preserving earlier receipts. Attempts are bounded; after the limit, escalate rather than resetting counters.
- **Worker stopped mid-phase:** after its five-minute lease expires, a worker may reclaim it. Do not alter the cursor or create replacement part rows by hand.
- **Scanner unavailable/not cleared:** keep the source private and restore the actual scanner. Retry if offered; never substitute a clean-scan flag.
- **Changed/retired mapping after some parts recorded:** retain those parts. Remaining processing stops. Reconfiguration after confirmation is blocked. Review the remaining source work and start a new authorized import where necessary; existing duplicate protections remain active.
- **Uploader access revoked/location changed/company restricted:** processing fails closed, including after a scan. Restore access only through authorized membership/assignment workflows or submit a newly authorized handoff; do not patch the job's actor.
- **Unreadable source/integrity failure:** preserve its opaque reference and escalate for key/storage investigation. No unsafe automatic retry is offered. Do not overwrite or delete immutable source records.
- **Stop remaining processing:** cancels future work/invalidates the current lease. It does not erase the original source or any already-committed receipt. Stop/retry actions are audited. Reopen the actual parts before deciding subsequent work.

Rollback is operational stop/preserve/investigate, not destructive data reset. Notify the authorized client contact through their approved existing process when the handoff needs correction; no external message is sent automatically by this importer. Verify actual job state, recorded-row count, part links and row outcomes after recovery.

## Bounds and remaining work

2MB raw CSV/XLSX,1,000 selected-sheet data rows,32 columns/five worksheets,128 archive entries,8MB expanded XLSX,1.5MB mapped canonical metadata. Parts contain at most50 rows and bounded canonical bytes. Twenty background sources/company is the local synthetic quota. Original private sources are retained; no public download or production retention/deletion claim is implemented. Transformations, corrected-CSV reupload, reviewed reassignment, larger quotas and independently measured scale/release evidence remain pending.
