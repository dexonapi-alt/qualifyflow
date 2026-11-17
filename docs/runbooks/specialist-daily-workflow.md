# Compliance specialist daily workflow

This is the local synthetic-data workflow, not a production-readiness certification. Verification resumed under later owner direction: scoped workspace/browser checks and a synthetic HTTP/worker/Defender journey have passed; full adversarial, recovery and milestone exit coverage remains incomplete. [Open the employee view](employee-view.md) for saved local accounts, MFA and the required company assignment.

Open http://localhost:5173 and use an existing invited account. See [manual sign-in and MFA guidance](manual-testing.md). A service administrator provisions companies; that role alone does not grant access to driver files. Specialists/reviewers need an actual client assignment; company users need an active membership.

## One destination per job

| Destination | Use it for |
|---|---|
| Company access / Companies | Company setup, locations, invitations, memberships, configuration and audit |
| Drivers | Register/search drivers and maintain employer engagements |
| Requirements | Authorized company-wide configuration of versioned client requirements |
| Review queue (clients: Driver files) | Current-engagement requirements with missing evidence, explicit expiry passed or review outstanding |
| Screening inbox | Receive CSV metadata, inspect per-row outcomes and open the matching driver file |
| Cases | Claim source issues, review context, request clarification, add notes and manage follow-up |
| Decisions | Employer decisions on exact-version administrative resolutions |
| Client requests (clients: Requests) | Approved in-app requests, client process/recipient settings and client responses |

Only permitted destinations appear after selecting a company. Operational pages have their own title; they are no longer duplicated as Company access tabs. Sidebar/browser navigation preserves company and supported record context using opaque identifiers. Company tabs remain administrative sections.

## Before the specialist starts

1. A provisioning administrator creates/configures the synthetic company and invites its administrator. Assign actual existing specialist/reviewer staff through the working service-assignment flow.
2. A company administrator or assigned whole-company reviewer opens Requirements. Create each operational requirement from the client's documented process, with category, stable code and applicability basis. Configure an expiry-date requirement only when the process calls for an explicit date. No DOT/FMCSA checklist or renewal duration is assumed.
3. A current whole-company employer administrator opens Client correspondence → Client process. Approve the intended in-app recipient and instructions. The recipient must be an active whole-company employer administrator in this slice. No generic fallback address is used.

## Receive and verify work

1. Register the synthetic driver under Drivers using a trusted company reference and the correct engagement/location. Similar names do not merge records.
2. In Screening intake, choose New metadata receipt. Select a UTF-8 CSV from the spreadsheet or enter its data, then preview. The form shows the required columns and actual company reference. Invalid rows are explicit; preview creates no driver or attachment.
3. Confirm the receipt. Source text and raw/normalized row snapshots persist encrypted. The background job routes per-row issues into Exceptions. Refresh the receipt for actual processing state.
4. For a valid source, choose Open driver file. The server looks up an exact scoped reference; it does not guess from the name. If no driver exists, investigate/register the correct driver before proceeding. Existing reviewed historical links remain traceable.
5. In Qualification file, assign the matching configured requirement to the correct employer engagement. The incoming source category guides the choice; the backend enforces the source/driver/requirement/location boundary.

## Add and review evidence

1. Select a synthetic PDF, PNG or JPEG, up to 2 MiB. Upload creates a new private evidence version; it never overwrites earlier bytes or reviews. Local quotas also bound pending scans and total versions.
2. The object is encrypted and quarantined. A dedicated worker invokes Microsoft Defender on Windows or the configured internal ClamAV service elsewhere. A real scanner must clear the file before review or download. Scanner failure stays visible and blocks both actions; authorized users can retry.
3. Download the authorized copy and inspect it using an appropriate local viewer. No untrusted inline browser preview is introduced. Compare driver identity, employer engagement, requirement category, completeness and explicit dates.
4. An authorized specialist/reviewer/company administrator records accepted evidence, more information required, rejection or escalation, with findings. Acceptance requires affirmative identity/category/completeness checks and an expiry date when configured.
5. The review preserves reviewer/time, checksum, source, policy revision and prior versions. For an intake-linked file, accepted evidence creates a traceable source-to-requirement attachment. It does not certify legal eligibility or automatically close an exception. New evidence/review invalidates older related case-version approvals.
6. File review lists missing evidence, recorded expiry passed and outstanding review for current engagements. Historical engagement files remain accessible only within actual scope. Unknown regulatory applicability remains unverified.

## Follow the client's process

1. Open the exception and choose Assign to me, then move it into review with rationale. The source, owner, state and event history remain visible.
2. If clarification is needed, use Ask the client to draft a request. The approved client instructions and recipient are bound to the immutable text. The request is pending approval, not sent.
3. A current employer administrator reviews the exact text/recipient in Client correspondence and approves it. The worker rechecks current sender/approver/recipient grants, client process and case version before publishing to the private portal. Changes suppress the request; there is no silent retargeting.
4. The intended client opens/responds in the portal. The response is preserved, and an awaiting-client case returns to review. Supporting files still go through the driver file and scanner; a reply does not accept evidence.
5. Once the operational issue is addressed, the owner proposes administrative resolution with a verified basis and explicit approval expiry. An employer administrator decides in Approvals. Authorized reviewers can resolve/close using the exact unexpired approved case version. Notes, evidence changes and new responses invalidate stale approvals.

## What is not finished

Real/commercial provider/API connection setup, service keys, signed provider webhooks and simulator transport remain M5 work. Corrected-row replay/mapping and controlled wrong-assignment correction remain open. External email delivery, multi-recipient policies, scheduled reminders/escalation, SLA calendars, automation rules, reporting/load/restore/release hardening and full staff administration remain tracked. Production S3 storage and scanner operations are not verified. Current executed checks and exact limits are in IMPLEMENTATION_STATUS and the managed-product design reports; do not use real driver PII or call this team-ready for production.
