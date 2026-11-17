# Test QualifyFlow locally

This guide covers account and organization onboarding. Use fictional companies, people and email addresses. Driver records, private scanned evidence, metadata intake, cases, administrative decisions and approved in-app requests now have implemented slices; provider integrations, client API keys and automation remain pending. For employee sign-in, actual staff assignments and the current navigation, start with [Open the employee operations view](employee-view.md). Older branch/company labels in this onboarding walkthrough refer to the corresponding Company settings sections.

## Open the app and sign in

- Application: http://localhost:5173 — use **localhost**, because mutation requests validate that origin.
- Local invitation inbox: http://localhost:8025 — refresh after inviting a user. Nothing is sent to real inboxes.
- The inbox receives invitations; it does not create accounts. Create invitations in **Company → People & access → Invite user**. Only current-database invitations appear; automated-test links are excluded and unusable links are disabled.
- API reference: http://127.0.0.1:8000/docs — browser UI handles session/CSRF; direct API mutations also need those controls.
- Your local admin/specialist credentials: `.local/LOCAL_LOGIN.md` in the repository. This file is ignored by Git. It contains generated passwords and authenticator setup keys, not production credentials.

Use `demo-admin@example.com` and its saved password. For the authenticator code, either add the saved setup key to an authenticator (time-based, 6 digits, 30 seconds), or run this command in PowerShell from the project root:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/demo_code.py admin
```

Enter the printed six-digit value in **Authenticator code (if enrolled)**, then **Sign in**. A code cannot be reused after successful sign-in; wait for the next 30-second code when signing in again. Five failed attempts temporarily lock the account for 15 minutes. Password/MFA recovery UI is not implemented yet.

## Full managed-company onboarding walkthrough

1. Select **Create company**. Example fictional values:
   - Legal company name: `Sandbox Carrier LLC`
   - Display name: `Sandbox Carrier`
   - Customer reference: `SANDBOX-001` (uppercase, unique; change for another run)
   - Service mode: **Managed service**
   - IANA timezone: `America/Chicago`
   - Region: `Synthetic US test`
   - Primary contact: `sandbox-contact@example.com`
   - Service effective date: choose a date.
2. Select **Create draft company**. The state should be **draft**. Return to Companies and reopen it to check persistence.
3. Under **Branches**, add `Main` with reference `MAIN`.
4. Under **Configuration**, enter policy reference `SYNTHETIC-SOP-1`, select **Service team** for both responsibilities, and leave integration prerequisite **Not required for this onboarding**. Enter a rationale and **Save responsibilities**. This synthetic policy reference is administrative test metadata, not legal approval.
5. Try **Review configuration** now with a rationale: it should explain that administrator acceptance and specialist assignment are missing.
6. Under **Service assignment**, select `demo-specialist@example.com`, scope **Whole company**, add a rationale and **Assign specialist**.
7. Under **People & access**, invite `sandbox-admin@example.com` as **Company administrator**, scope **Whole company**. Choose a new fictional email for each new account.
8. Open http://localhost:8025 and refresh. The local dispatcher polls the development outbox every two seconds; open the newest message for your invitee.
9. Copy its invitation link and open it in a **private/incognito window**. Keep the original admin session open. Select **Set up administrator authenticator**, add its setup key to an authenticator, enter a new 12+ character password and current authenticator verification code, then **Accept invitation**.
10. Continue to sign in as `sandbox-admin@example.com` using the password/code you just set. This window should show **Client portal**, with only that company and no Create company control.
11. In the original operations/admin window, open **Configuration**, enter a state change rationale and **Review configuration**. Once ready_for_review, enter another rationale and **Activate company**. State should become **active**.
12. Refresh, reopen the company, and confirm its state, branches and memberships persist. Inspect **Audit history** for the actual creation/configuration/assignment/invitation/activation events.

The specialist account uses the separate credentials in `.local/LOCAL_LOGIN.md`. To get its current code, replace `admin` with `specialist` in the command above. Use another browser profile/private session to test it. It should see only assigned companies and limited administration controls.

## Useful failure checks

- Use the same customer reference twice: the duplicate must fail.
- Invite a viewer and a branch-scoped user: they must not gain company administration authority.
- Revoke an unaccepted invitation, then try its original link: acceptance must fail.
- Resend an invitation: its previous link must stop working.
- End the specialist assignment, then refresh the specialist's company view: access must be denied.
- Revoke an accepted contributor/viewer membership, then refresh its session: access must be denied.
- Attempt to revoke the last active company administrator: the server must block it.
- Suspend an active company with a rationale: new invitations/writes must be blocked while history remains available. Reactivation rechecks prerequisites.
- Mark an integration as required: onboarding must remain blocked because the integration-verification workflow has not been implemented.

## If services are stopped

The isolated PostgreSQL database uses 127.0.0.1:55432. Do not reset/delete it to restart. See local-development.md for PostgreSQL startup if needed. After the first setup, run these in separate terminals:

```powershell
# Terminal 1, from repository root
Set-Location backend
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2, from repository root
Set-Location backend
.\.venv\Scripts\python.exe scripts/local_mail_sink.py --dispatch
```

```powershell
# Terminal 3, from repository root
Set-Location frontend
npm.cmd run dev
```

These commands use the normal development database in .env. Do not set DATABASE_URL to an automated-test database for manual testing. The SMTP sink never forwards mail; its web inbox is bound to loopback. Docker/Redis/Celery are not needed for this native manual onboarding flow; actual Redis/Celery execution remains unverified.
