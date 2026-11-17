# Open the employee operations view

For complete role training, spreadsheet/manual flows and a one-driver exercise, see [specialist training](specialist-training.md).

Use http://localhost:5173 with synthetic records only. The app renders the current user's actual permissions; there is no client-to-staff visual toggle that bypasses authorization.

## Accounts

Saved local credentials and authenticator setup keys are in the Git-ignored `.local/LOCAL_LOGIN.md`. Do not copy that file into tracked documentation or reuse these credentials elsewhere.

- `demo-admin@example.com`: service administration, company provisioning, configuration, staff assignments and activation. Provisioning authority does not grant sensitive driver-file access.
- `demo-specialist@example.com`: compliance specialist. Operational access requires an active assignment to the selected company.

Both accounts were confirmed active in the development database. The specialist currently has **no company assignment**. No permission was silently added for this visual change.

## Assign the specialist to your synthetic company

1. Open the profile menu and Sign out, or use another browser profile/private window.
2. Sign in as `demo-admin@example.com`, using its saved password. Generate a current local MFA code from the project root:

   ```powershell
   .\backend\.venv\Scripts\python.exe backend/scripts/demo_code.py admin
   ```

3. Select your synthetic company in the directory. Open **Company settings → Service assignment**. This tab is available to the service administrator.
4. Select `demo-specialist@example.com` under Eligible specialist, choose the appropriate scope (Whole company for a company-wide local walkthrough), enter a truthful assignment rationale, and click Assign specialist. This is the normal persisted, audited authorization flow.
5. Sign out or use a separate browser profile. Sign in as `demo-specialist@example.com` using its saved password and a current code:

   ```powershell
   .\backend\.venv\Scripts\python.exe backend/scripts/demo_code.py specialist
   ```

   Codes cannot be replayed after a successful sign-in. Use the next code if signing in again within the same30-second window.

6. Select the assigned company. The employee sidebar shows **My work, Drivers, Screening inbox, Review queue, Cases, Client requests and Decisions**, subject to actual scope. **All clients** returns to the assigned-company list. Company settings remains an administrative area with only permitted controls.

## What to review

- **My work**: actual assigned actions, driver files, case ownership, service team and recorded reviews. Empty queues remain empty; nothing is fabricated for the dashboard.
- **Screening inbox**: receive and inspect real synthetic CSV metadata receipts; durable processing routes source issues into cases.
- **Review queue**: find missing, expired or pending-review requirements and open the correct private driver file.
- **Cases**: claim/review source issues, record notes and request clarification or employer approval.
- **Client requests**: approved in-app information requests and replies following the company's recorded process. Publication needs current employer approval and worker processing.
- **Decisions**: inspect requests; employer decisions remain with current authorized client administrators.

See [specialist daily workflow](specialist-daily-workflow.md) for the supported operational sequence. Provider/API setup, external correspondence/reminders, production operations and full milestone/security exit criteria remain incomplete. Do not use real driver PII.

## Actual visual preview

The following captures use the isolated QA database, with real synthetic assignments and records, rather than granting the development specialist access automatically:

- [Employee desktop](../design/next-action/employee-workspace-1440.png)
- [Employee mobile](../design/next-action/employee-workspace-375.png)
