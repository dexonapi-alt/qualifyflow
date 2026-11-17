# Shell composition correction

2026-11-17. Focused correction of hierarchy, navigation and framing. No new fonts, color palette, imagery, product modules, backend changes, API contracts or migrations.

## Review before editing

Visually inspected the annotated current screenshot, Quixera reference and both composition critiques. The relevant difference was structural: QualifyFlow placed context/sign-out in a separate horizontal bar, repeated workspace labels in the sidebar, then put the company inside one large frame. This produced three assembled regions. The reference places page title/context/breadcrumb above actual section navigation and work within a continuous canvas. Its blue outer presentation frame is excluded.

Re-read Document 02 §6 and accessibility requirements, inspected actual App/shared styles/current tokens and persistent implementation context. Current owner instructions take precedence over the earlier top-bar proposal; ADR-0005 records that exception. Earlier full specification review and workflow/security boundaries remain in force. This pass applies the existing design-system navigation/focus/state principles without another design exploration.

## Changes

- Removed the top app bar from the DOM, including its reserved height. Root pages now begin with title, useful subtitle where applicable, and compact breadcrumb. Selected-company pages use title, actual company context, breadcrumb and existing functional company tabs.
- Removed Company workspace / Client account / Workspace sidebar repetition. Brand and a subtle divider lead directly into working navigation. No unavailable modules or decorative workspace switcher added.
- Neutral selected rows retain aria-current, readable icons, hover and visible keyboard focus. Blue remains an action/tab accent rather than styling navigation as a primary button.
- The existing account disclosure contains the actual Sign out operation. On phone it remains visible as Account beside the brand; it is not hidden with the old desktop footer. Native keyboard opening, Tab to action, Escape dismissal/focus return and session invalidation are exercised.
- Consolidated environment copy to Local · Synthetic data near the account area. Removed the redundant page footer. The local/synthetic distinction remains visible on phone and desktop.
- Removed the company overview's outer border, background, shadow and padding. Identity/actions, compact setup notice, metadata, details, locations and exact access scope now sit directly in the workspace with light rules. No forced equal-height panels; controls and role conditions are preserved.
- Reused current fonts, colors and real data. Root/main and sidebar responsive placement are adjusted; backend/domain services, authentication/MFA, invitations, company/branch/member operations, status rules and audit APIs are unchanged.

Runtime files: frontend/src/App.tsx and frontend/src/premium.css. QA changes: frontend/scripts/ui-review.mjs. Canonical palette tokens were not changed in this task. New reusable WorkspaceBreadcrumb shares actual root/company navigation. Account logout calls the same API and preserves error reporting.

## Before/after and rendered inspection

[Open comparison gallery](shell-composition/index.html).

| View | Before | After |
|---|---|---|
| Client desktop | [1440](shell-composition/before/client-one-1440.png) | [1440](shell-composition/after/client-one-1440.png) |
| Client phone | [375](shell-composition/before/client-one-375.png) | [375](shell-composition/after/client-one-375.png) |
| Operations | [1440](shell-composition/before/operations-1440.png) | [1440](shell-composition/after/operations-1440.png), [768](shell-composition/after/operations-768.png) |
| People | [1440](shell-composition/before/people-1440.png) | [1440](shell-composition/after/people-1440.png) |
| Account menu | — | [Phone](shell-composition/after/account-menu-client-375.png), [desktop](shell-composition/after/account-menu-client-1440.png) |

Captures are actual browser output against the isolated synthetic database/API. Directory totals may grow between captures because real end-to-end tests persist additional synthetic companies. No mock rows or fabricated totals were added. Desktop/phone company, phone account popover, people and tablet operations were opened and visually inspected: title leads the work, breadcrumb is secondary, the top bar and frame are absent, and mobile sign-out remains visible when the disclosure is open.

## Executed verification

Raw evidence: [after/results.json](shell-composition/after/results.json). **56 axe/viewport cases passed, zero violations and zero horizontal overflow**, at 375/768/1024/1440px. The matrix includes eight additional open-account-menu scans for operations/client accounts, plus existing loading/error/empty/long/scoped records. Four explicit composition checks pass for each test account: no app-bar element, title above breadcrumb, no redundant sidebar labels, no company outer border/padding.

Keyboard account tests passed for operations admin, company admin, empty-access and branch-viewer accounts: open with Enter, focus Sign out with Tab, close/restore focus with Escape, perform real logout, then confirm the previous session cookie receives HTTP 401 and reload stays signed out. Account-menu occlusion and full long-email checks remain in the suite. Reduced-motion, 200% CSS reflow, login focus order and existing directory filters/sort pass.

Frontend **3 tests passed**, TypeScript/Vite production build passed. The **full real onboarding browser regression passed** (14.9s; 16.7s total), covering actual local SMTP, MFA, company/branch persistence, specialist assignment, readiness rejection, activation and refresh. Production build: JS 254.98KB/78.32KB gzip, CSS 48.71KB/9.69KB gzip. No formal manual screen-reader certification is claimed. Existing M0/M1 hardening and release limits remain open.

M2 remains next. Future modules should use this title/context/breadcrumb/content shell, working section navigation and sidebar account pattern; they must not restore the redundant header or wrap the whole work area in a giant card.
