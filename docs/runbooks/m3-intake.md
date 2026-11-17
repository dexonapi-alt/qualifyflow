# M3 structured metadata intake — initial implementation

This slice is implemented but unverified: the owner requested stopping tests before M3 began. Do not consider it a release-ready intake system.

Open the existing synthetic company in the Client Portal or assigned Operations workspace. Users with a current writable driver relationship can choose **Screening intake**. Provisioning authority alone does not expose this destination. Viewers are not granted screening access by this initial slice.

Choose **New metadata receipt**, select your authorized location, then paste CSV with the exact header:

```csv
client_ref,external_driver_ref,report_type,external_report_ref,reported_at
YOUR-COMPANY-REFERENCE,YOUR-SYNTHETIC-DRIVER-REFERENCE,motor_vehicle_record,SYNTHETIC-REPORT-001,2026-11-17
```

Replace the first two values with actual references in your synthetic company. Allowed report categories: motor_vehicle_record, employment_verification, background_screening. This is a documented local synthetic metadata schema, not a commercial provider integration.

Preview does not save anything. It validates column count/order, required values, dates, company binding and bounded rows; it suggests a current engagement only from an exact company driver reference within scope. No name-based matching occurs.

**Confirm metadata receipt** persists the original encrypted source, encrypted raw/normalized rows, validation outcomes and provenance. Reopening a receipt shows persisted row outcomes. This does not create a driver, screening result, file, qualification attachment or legal decision. Valid reference suggestions remain blocked_by_policy because requirement/evidence review is not implemented. Invalid and unmatched rows remain explicit; source duplicates do not silently replace earlier receipts. No source file is uploaded or scanned here.

Limits: 100 rows, 64 KB UTF-8, 200 characters per field. Spreadsheet formula prefixes are rejected. No document bytes, images, PDFs, archives or real PII. There is no export or correction/retry interface yet.

API: POST `/api/v1/tenants/{id}/intake-batches/preview`; POST `/intake-batches` with a stable command UUID; GET paginated `/intake-batches`; GET `/intake-batches/{batch_id}`. Migration42fde403280e follows27b7e811a6d9. Receipts and row snapshots are append-only.

Remaining M3: durable worker processing, provider sandbox/transport, CSV mapping and corrected-row replay, reviewed matching/attachment after M2 prerequisites, exceptions/tasks and lifecycle, operational diagnostics and regression/security/browser verification. No tests were executed for this new slice.


Continuation: durable case routing, processing/retry controls, Exceptions and first M4 Approvals are now implemented but unverified. See [the workspaces guide](m3-m4-workspaces.md). The earlier pending list above describes the initial receipt slice; full provider/mapping/review and communication work remains pending.
