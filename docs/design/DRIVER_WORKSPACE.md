# Personal driver onboarding

The driver is now an authenticated participant through an explicitly invited employer engagement. The company/specialist driver profile remains a separate operational view. ADR-0026 records the access and data decisions.

## Experience

- Sidebar-free My onboarding, compact account/sign-out header and a clear current company identity. Existing authorized company users can switch between their personal and company workspaces.
- No shared requests: an honest You're connected state without invented progress.
- Shared requests: staff-written instructions, specific upload controls, own submission/version history and meaningful processing labels.
- Received/scanning, awaiting review, changes requested and accepted evidence remain distinct. Company decisions are not inferred from document acceptance.
- Failed uploads retain the selection and do not claim success. Scan waits refresh from real state; other review updates are fetched with Refresh/reload.
- Company contact uses the real configured contact. No fake chat, notifications, photos or metrics.

The established Inter/cobalt/pink-pending/green-processing/blue-completed system is retained. Mint identity and differently structured document requests provide visual continuity with the operational product. Native forms/disclosures, 44px important phone controls, keyboard access and reduced motion remain. No new dependency.

## Connected operation

Company administrator: Drivers → Driver profile → Driver self-service → Invite this driver. Invitations are queued through the local outbox. Administrators can revoke personal access with a reason. Expired invitations can be replaced; pending invitations can be revoked and issued again.

Authorized staff: Qualification file → Request this document from the driver. Enter driver-safe instructions and explicitly show the request. Updates create immutable revisions with version conflict protection. Internal review notes are not automatically published to the driver.

Driver: accept invitation → establish an account or sign in to the invited existing account → My onboarding → upload. Receipt, private storage, security scanning, version history and specialist review are the same working pipeline used by the company. Staff see real uploader identity and driver-origin provenance. A specialist can update driver instructions after recording a request for more information; a replacement remains a new evidence version.

## Verification

The actual browser journey passed local invitation delivery/acceptance, personal login, empty/requested/submitted/correction/accepted states, real antivirus processing, assigned-specialist review, company visibility, failed-upload retry, revocation and logout. Twenty screenshot/axe/reflow checks cover these states at375/768/1024/1440; no violations or page overflow were recorded. Desktop/mobile captures were visually inspected. New backend tests exercise role separation, other-driver/tenant denial, hidden requests, staff-file privacy, scanner gates, self-review denial, expiry, existing-account authentication, single use, revoke/version handling, ended engagements and mid-scan revocation. Full backend78 passed before the last added append-only test; personal module8 passed and the corrected immutable-assignment assertion passed separately. Frontend24 tests, Ruff app/tests, production build and existing onboarding/driver Playwright1 passed(1.2m). The current build retains its known chunk-size warning (~549kB/164kB gzip). Existing-account acceptance is covered by backend tests; the full personal browser journey uses new-account acceptance.

[Desktop request](driver-portal/document-request-1440.png) · [Phone correction](driver-portal/changes-requested-375.png) · [Accepted evidence](driver-portal/evidence-accepted-1440.png) · [Browser results](driver-portal/results.json).

## Exact limits

Local synthetic delivery/storage only; no production readiness claim. Requests must be explicitly shared, and personal access must be explicitly invited. There is no automatic driver requirement assignment, employer decision, social account, real-time push, personal photo upload, e-signature, independent driver registration or new password-reset system. Driver access does not follow an employer/location transfer automatically. Internal review findings stay internal; separate driver-safe instructions carry correction requests. Download is limited to the current user's own scanned submissions. Previously accepted evidence can remain authoritative while a newer version is processed, following the existing backend policy. Existing release, provider, retention and operational-hardening gates remain open.
