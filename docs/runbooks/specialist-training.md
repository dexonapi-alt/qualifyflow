# Compliance Data Specialist: practical training

This guide follows the supplied job description and the actual implementation inspected on17 November2026. Training uses synthetic data only. It is an operational walkthrough, not a regulatory checklist, legal determination or production-readiness certification. No application permissions were changed to write this guide.

## 1. Stay in the specialist role for daily processing

Your role is to turn received records into accurate, traceable driver-file evidence, investigate exceptions and coordinate authorized follow-up. The employer supplies its process and retains its decisions. Your service team performs authorized administration and review; the system must record rather than invent who is responsible.

The current specialist can register drivers, receive metadata, assign existing client requirements, upload/review evidence, work assigned cases and draft approved-process client requests. Creating the requirement catalog requires a whole-company client administrator or authorized reviewer. General company provisioning/activation requires service administration. The JD can include delegated setup work, but the current app does not give the ordinary specialist every setup/API permission. Do not solve that by sharing passwords or weakening roles.

## 2. One-time catalog setup: your present blocker

Use a separate browser profile or a private session, leaving the specialist signed in in the original browser. Two ordinary tabs share a session.

1. Open http://localhost:5173.
2. Sign in as `sandbox-admin@example.com`, the company account you accepted by invitation. Use the password you chose at acceptance and the six-digit code from that account's enrolled authenticator. The long setup key is not the code. `demo_code.py admin` and `demo_code.py specialist` generate codes only for the two demo staff accounts, not this invited company account.
3. Select Invitation test company, customer reference `LOCAL-INVITE-TEST`. Open **Requirements** in the sidebar. This is distinct from Company settings → Configuration, which records account responsibility/activation metadata.
4. Expand **Create a requirement or new revision**. For this training only, enter:

   | Field | Training value |
   |---|---|
   | Stable requirement code | `SYN_BG_SCREENING` |
   | Requirement name | `Synthetic background screening report` |
   | Evidence category | `background screening` |
   | Mandatory expiry date | `No mandatory expiry date` |
   | Client process and applicability basis | `Synthetic training exercise only. Review identity, category and completeness; no real screening or eligibility decision.` |

5. Click **Save requirement revision**. This creates a catalog definition, not a requirement on every driver. In real work the employer's approved process determines required documents, scope and expiry rules; do not substitute this example.
6. If client correspondence will be practiced, the current employer administrator must also approve the exact recipient and instructions under **Requests → client process** before a specialist can draft/publish that workflow. Each request still requires exact content/recipient approval.
7. Return to the original specialist browser and refresh. If signing in again: use `demo-specialist@example.com`, its password from Git-ignored `.local/LOCAL_LOGIN.md`, and:

   ```powershell
   .\backend\.venv\Scripts\python.exe backend/scripts/demo_code.py specialist
   ```

If the invited company's password/authenticator is unavailable, do not try the demo staff password or reuse another user's MFA. Account recovery UI is not implemented. An administrator can manage invitations through the authorized flow; there is no automatic recovery bypass.

## 3. What spreadsheet work means

Yes: the JD explicitly emphasizes transferring screening results, driver records and supporting data with integrity checks. Spreadsheets can be source manifests, reconciliation tools or a client's manual handoff. The specialist must preserve provenance and verify what each row means; copying cells is only part of the work.

For an external spreadsheet/report handoff:

1. Confirm the sender/source and intended company using the client's approved process.
2. Preserve the original source in an approved restricted location. Work on a copy; do not rewrite the source to hide an error.
3. Identify the actual company reference, driver reference, report category/reference and report date. Match drivers using reliable identifiers and the correct employer engagement, never a name alone.
4. Keep identifiers as text to preserve leading zeros. Check required cells, duplicates, dates, company/location scope, report-to-driver correspondence and missing supporting documents. Do not guess missing values or change a date merely to make validation pass.
5. Separate good rows from unresolved rows for investigation. Record source/row references and the discrepancy without spreading unnecessary PII through trackers or messages.
6. In the current app, export/map a copy to the exact UTF-8 CSV schema below. Native `.xlsx` import and arbitrary column mapping are not implemented.
7. Reconcile the received rows, persisted receipts, file evidence and exceptions. Receipt processing is not evidence acceptance; accepted evidence is not a legal eligibility decision.

## 4. Practice one real intake-to-file flow

### Prepare the driver

In the specialist window select the assigned company. Open **Drivers** and search for the company driver reference `TEST`. Use the existing driver if correct. Register a new synthetic driver only if no matching record exists; use its actual company reference in the CSV. Confirm the current engagement/location before attaching anything.

### Receive the spreadsheet metadata

Open **Screening inbox → New metadata receipt**. Select the correct intake location. Use Whole company only when that is the intended scope, not to work around a branch restriction.

Choose the [training CSV](../examples/specialist-training-intake.csv), or paste:

```csv
client_ref,external_driver_ref,report_type,external_report_ref,reported_at
LOCAL-INVITE-TEST,TEST,background_screening,SYN-BG-TRAINING-001,2026-11-17
```

These exact company/driver values come from the owner's synthetic example. Replace them if your actual records differ. Use a new report reference for a distinct training report; do not rename an actual duplicate to bypass detection. Use the report's actual recorded date in real operations.

Current CSV rules:

- Exact five headers in that order; no extra name, result or SSN columns.
- Maximum100 data rows,64KB UTF-8 and200 characters per field.
- All five fields required; dates `YYYY-MM-DD`.
- Categories: `motor_vehicle_record`, `employment_verification`, `background_screening`.
- Formula-leading values are rejected; this is metadata ingestion, not a spreadsheet execution environment.

Choose **Preview rows**, inspect every row and then **Confirm metadata receipt** when correct. Preview alone does not save. Refresh processing until the actual worker state is available. Processing routes follow-up cases; it does not create drivers, invent screening results or accept the report. Invalid/unmatched/duplicate states require investigation. Do not repeatedly confirm a stuck job; inspect the actual error/recovery controls.

### Attach the supporting report

From the received matching row use **Open driver file**. This preserves the intake report context; uploading from an unrelated driver screen would not establish that source link automatically.

1. Expand **Assign a client requirement**.
2. Choose the synthetic requirement and the correct **Employer engagement**; click **Assign requirement**.
3. Create a simple training-only PDF locally containing `SYNTHETIC TRAINING ONLY`, company reference `LOCAL-INVITE-TEST`, driver reference `TEST`, report reference `SYN-BG-TRAINING-001` and no real screening findings. This is a training document, not a provider report.
4. Under that requirement select **Add evidence version**, then confirm the private upload. Supported files are PDF/PNG/JPEG, maximum2MiB. A CSV receipt does not upload this document for you.
5. Wait for the actual scan. Use **Refresh file**. Failed/unavailable scanning is a blocker, not an invitation to accept anyway.
6. Once cleared, inspect the authenticated download. Check identity, exact company/engagement, category, completeness and explicit expiry when required.
7. Record the appropriate review outcome and findings. Affirm the review checks only after doing them. Accepted evidence preserves source linkage and immutable history; do not describe it as legal qualification or automatically close the case.

### Manual document entry without a spreadsheet

If the client provides only a document, open the exact driver/engagement directly, assign an existing agreed requirement, upload a new evidence version, wait for scan and record the review. That creates file evidence/history but not an intake CSV receipt. If you need a source-row link, start from the corresponding actual intake row. Do not invent a spreadsheet or provider result just to populate the interface.

## 5. Exceptions, follow-ups and decisions

1. Open **Cases** for source-related issues. Read the immutable incoming context before acting.
2. Claim an appropriate case with **Assign to me**, move it into review using the available transition and record a factual rationale.
3. Describe the discrepancy: source reference, expected fact, observed fact, impact and needed correction. Do not silently move evidence to another driver or edit source history.
4. If clarification is needed, use **Ask the client** from the in-review case. The approved client process and recipient must exist first.
5. A current employer administrator approves the exact request in the client **Requests** view. The worker rechecks scope/process/case version and publishes **in-app**. This is not an external email system; approved, queued, portal-available, opened and replied are different events.
6. The intended client replies through its account. Review the response, retain the history and process any new evidence through upload/scan/review. A reply is not evidence acceptance.
7. For the supported administrative resolution flow, propose a specific resolution with rationale and approval expiry. The employer decides. Resolve/close only with the current exact approved case version and permitted controls. New notes/evidence/responses can invalidate old approvals.

Requirement-only follow-up is now available: open the actual Qualification file, expand **Follow up on this requirement**, record the reason and open the resulting case. It preserves the real requirement/engagement origin without inventing intake. Claim the case before drafting a client request. Approved recipient policy, employer communication approval and evidence-review gates still apply.

## 6. A normal specialist day

| Stage | What you do | Evidence of completion |
|---|---|---|
| Start | Open My work, Review queue and assigned cases; identify waiting information, expired evidence and pending review | Actual priorities/owners/states, not an invented deadline |
| Receive | Register the approved handoff/source; reconcile spreadsheet rows and supporting documents | Receipt/source references and discrepancies |
| Process | Exact driver/engagement matching, assign requirements, upload/scan/review evidence | Preserved versions, review findings and links |
| Follow up | Work cases and approved client requests; escalate uncertainty through the client's process | Case/message history and current decisions |
| Quality check | Reconcile counts, sample/check mappings, inspect duplicates and confirm persistence | Known unresolved items and corrected work trace |
| Handoff | Leave the next owner a factual summary, next action and source/record references | Another person can continue without guessing |
| Improve | Collect repeated errors and notification gaps for Product/Development | Reproducible issue, frequency, impact and proposed safe rule |

Track actual throughput, accuracy/rework and turnaround only when your employer defines and measures them. No targets or dashboard productivity totals are assumed here.

## 7. The rest of the supplied job description

| JD responsibility | Specialist practice | Current platform boundary |
|---|---|---|
| Data transfer and integrity | Reconcile source spreadsheets/reports against exact records and check totals | CSV metadata + separate evidence; no arbitrary workbook/provider import |
| Correct document assignment | Confirm tenant, driver identifier, engagement, requirement/category and source | Private versioned file/review workflow |
| Missing/expired/incomplete items | Review flags, investigate, record findings and request correction | Review queue/cases; direct requirement-only request remains missing |
| Client communication | Clear factual requests, correct recipient, approvals and escalation process | Approved in-app requests; external delivery/reminders pending |
| Account/user setup | Carry out documented setup under delegated authority | Service admin/client admin flows; not every setup privilege belongs to specialist |
| API setup | Gather provider/client requirements, document credentials/scopes securely, coordinate technical validation | Provider connections/service keys/webhooks not implemented; do not claim connected |
| Process improvement | Identify repeated failure patterns and propose specific automations | Document recommendations; no completed automation/rule builder yet |
| Jira/Slack/Confluence/Salesforce | Use only approved external tools for work tracking, handoffs and SOPs, with minimum necessary data | No connector sync implied; actual app remains record authority for its mutations |
| Confidentiality | Approved storage/access, correct recipient, no unnecessary PII copies or screenshots | Synthetic-only local environment; production release controls unfinished |

## 8. Good working notes

Prefer: `Report SYN-BG-TRAINING-001 references TEST; received document references another driver. No attachment accepted. Request correct report through the approved recipient process.`

Avoid: `Fixed it`, unexplained rejection, guessed matching, claims of approval before approval, or full sensitive report contents pasted into general chat.

For an improvement ticket: include the workflow, expected vs observed behavior, safe record/correlation reference, frequency/impact, recovery used and a proposed rule. Do not include passwords, MFA keys or unredacted driver PII.

## 9. What counts as done

Received ≠ validated. Uploaded ≠ scanned. Scanned ≠ reviewed. Reviewed evidence ≠ employer decision. Portal publication ≠ read or answered. Resolved case ≠ legally eligible driver. Each state must correspond to the action actually performed and its retained evidence.

Start with Sections2–4 for one synthetic driver/report. Then practice an unmatched row and an approved information request. Broad production readiness, legal applicability, complete adverse-action handling, external delivery, commercial-provider/client API setup and exhaustive recovery/security verification remain outside this implemented training slice.


Local provider connections and scoped configured-evidence reports are now available within their current permissions; see [provider sandbox runbook](provider-sandbox.md). This does not grant an ordinary specialist configuration or export authority. The owner's first hands-on training exercise remains pending.
