# Intake processing, exceptions and employer approvals

## Where the new sidebar destinations appear

Open http://localhost:5173. Select a company or use the existing single-company portal. The sidebar now exposes Company access/Companies, Drivers, Screening intake, Exceptions and Approvals according to actual current grants. A provisioning-only administrator cannot access sensitive driver/intake/case data; use an existing client administrator account or an explicitly assigned specialist/reviewer. Read-only driver users see Drivers without the writable intake/case destinations.

The shortcuts retain selected company context and open real existing workspaces. Company administration tabs remain available. No future reporting, integrations or documents link is fabricated. On narrow layouts the primary destinations use a horizontally scrollable navigation row.

## Process a synthetic metadata receipt

Follow [the metadata intake guide](m3-intake.md). Confirming a receipt atomically queues a durable processing job. Refresh processing to see queued, processing, completed, blocked, retry or dead-letter state. Completion means exception routing completed; it never means document attachment or legal compliance.

The local worker runs `backend/.venv/Scripts/python.exe -m app.screening_intake.worker` from backend with the intended development DATABASE_URL. It polls the same durable handler registered as `qualifyflow.intake` in Celery. Production Celery beat polls through Redis every five seconds. No Redis or production queue availability is claimed. Do not run a QA database worker against the development database accidentally.

Jobs use bounded attempts, backoff/jitter and expiring leases. Current actor, membership/assignment, branch and tenant state are rechecked at execution. Failed or policy-blocked jobs can be requeued from the receipt by a currently authorized actor. One exception per source row prevents replay from duplicating cases. Original receipt/row snapshots remain immutable. Existing receipts receive queued jobs through migration7422a7ea5d93.

## Work an exception

1. Open Exceptions. Filter actual cases by state and choose Review case.
2. Inspect the source references, reason and owner. Unassigned means a real unassigned queue, not a fictional specialist assignment.
3. Choose Assign to me, enter a rationale, then move the assigned case to in review.
4. Record review notes. Current versions are required; refresh after conflicts. Notes and transitions preserve an encrypted event history.
5. Awaiting client is an operational follow-up state only; it does not send a message. No deadline is invented.
6. For a non-policy-blocker case, propose an administrative resolution with verified context and an explicit future expiry. This creates an employer approval request.

Whole-company review authority is required for resolution, closure, cancellation and reopening. Notes or intervening changes invalidate older approval versions. Source snapshots and driver status remain unchanged. Missing M2 evidence/requirement controls cannot be resolved or overridden through administrative approval. Reassignment beyond self-claim, escalation automation, complete event pagination and configured SLA routing remain pending.

## Decide an employer approval

Open Approvals as a current whole-company employer client administrator. Inspect the exact proposal and source case; choose approve, reject or needs information with a reason. Staff reviewers may request approval but do not inherit employer decision authority. Decisions are immutable records.

Approved decisions authorize only administrative resolution of the exact current case version until expiry. Return to the case and resolve with a rationale; authorized reviewers can then close it. Notes or other version changes require a fresh approval. Expired/pending requests may be withdrawn by the requester or authorized reviewer so the case can return to review. Rejected or needs-information decisions return the case to review without granting resolution authority.

M4 is partial: configurable client communication policies/templates, in-app inbox, actual recipient-bound delivery, external email authorization/outbox and correspondence lifecycle remain pending. No external message is sent by this slice.

## Verification status

New M3/M4 work is unverified. Owner requested stopping tests; no test suite, production build, browser automation, screenshot capture or accessibility run was executed for these changes. Formatting, migration generation/review/application and service startup are implementation operations, not passing test evidence. Earlier M2 passes do not verify this tree. M2, M3 and M4 remain incomplete.
