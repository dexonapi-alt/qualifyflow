# Compact account status — 17 November 2026

Owner's draf.png shows the wide yellow draft notice interrupting the overview. Removed that banner rather than treating an administrator-owned activation as a client task.

The shared header now presents the actual non-active company status in a small native disclosure. Desktop shows the status label and clock; mobile retains a labeled icon. Opening it reveals a white floating panel, restrained pending status, actual activation responsibility and the existing View account route. Close button and Escape return focus to the trigger. The status remains discoverable after closing/reloading; dismissal never changes the backend state. Switching company/status remounts the disclosure. Active companies show no setup control. Suspended/closed/offboarding states retain an alert treatment rather than a pending category.

No fabricated notification, notification count, activation progress, client assignment or new backend behavior. Company metadata supplies the current state; service administrators receive configuration-review guidance, other users are told who handles activation. Existing company settings enforce all permissions.

Files: frontend/src/App.tsx (pass status through workspace context), ProductChrome.tsx (header disclosure), ManagedOverview.tsx (remove banner), managed-product.css (responsive control/popover).

Verification: production frontend build passed. scripts/account-status-review.mjs passed at375/768/1024/1440 with no axe violations, page overflow, API failures or browser errors. Actual browser assertions covered keyboard opening, Escape/focus return, explicit close, View account navigation, reload persistence and absence for an active company. Open/closed screenshots saved in account-status/; desktop and phone open screenshots visually inspected. No backend/API/migration change. Earlier broader test results are historical, not a new full onboarding pass.

- [Desktop closed](account-status/draft-closed-1440.png)
- [Desktop open](account-status/draft-open-1440.png)
- [Mobile open](account-status/draft-open-375.png)
- [Machine results](account-status/results.json)
