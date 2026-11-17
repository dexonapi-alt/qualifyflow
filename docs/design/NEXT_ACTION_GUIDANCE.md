# Ownership and next-action guidance

17 November2026. Focused follow-up to the approved managed-product shell. No new milestone, backend rule, API or migration.

## Changes

- Header Add driver is the sole general desktop registration action. The duplicate overview-heading action is removed. Active populated workspaces retain a mobile-only registration action because the narrow toolbar hides its primary button; the first-driver empty state retains its specific onboarding action.
- Draft/configuring/ready-for-review overview headings instead offer View account setup. This opens the actual company administration page without restoring the rejected wide banner.
- Driver rows show Status & next step, with a short explanation and labeled file action. Zero assigned requirements now reads Requirements needed. Instructions distinguish recorded client/service intake and review responsibility, actual operator/viewer access, ended engagement, missing/expired evidence, pending scan/review and accepted evidence. Unknown ownership never implies an assigned specialist is handling it. No legal eligibility or invented completion.
- Current server-provided activation blockers appear in the administrator-only metadata overview and header setup disclosure. The server already restricts these to service administrators. Other users do not receive or display this private checklist; they see the existing activation-owner explanation and View account action. An empty client blocker array is not interpreted as ready for activation.
- Actual case states now drive the service-row accent: waiting pink, assigned/in-review green, otherwise neutral. Existing recorded review history remains available on expansion. No activity or timeline events fabricated.

## Verification

Production build passed;9 frontend tests passed, including4 next-step tests for unknown ownership, client/service responsibility, viewer/ended engagement and evidence state precedence. Browser script next-action-review.mjs passed375/768/1024/1440px with no axe violations, overflow, failed API requests or page errors. Verified a single visible general desktop Add driver action, real driver-file navigation, and administrator-only blocker visibility. Actual synthetic record created through QA API only. Desktop/mobile screenshots visually inspected.

An initial browser check caught a visible-action/accessibility-name mismatch; corrected labels to include the visible action. A later script timeout selected the hidden header checklist rather than the visible administrator checklist; selector corrected and run passed. No test bypass or authorization change. Historical broader backend tests were not rerun for this frontend-only change.

- [Client desktop](next-action/client-next-step-1440.png)
- [Client mobile](next-action/client-next-step-375.png)
- [Administrator blockers](next-action/administrator-blockers-1440.png)
- [Browser results](next-action/results.json)

Remaining: exhaustive evidence/message recovery/security regressions and the older complete onboarding browser journey. Source-only follow-up cases and production/provider capabilities remain as previously documented.

## Owner's compact-table correction
Removed the next-step prose from rows and removed the entire overview table footer. Status and functional labeled file actions remain. Operational/legal explanation stays inside the actual qualification file; queue access stays in client Driver files / employee Review queue navigation.6 current browser viewport checks (4 client +2 employee),9 frontend tests and build passed. Actual employee captures linked from [employee walkthrough](../runbooks/employee-view.md). No permissions added; development specialist still requires explicit assignment.
