# M2 driver workspace — first vertical slice

2026-11-17. M2 is active following owner authorization. This slice implements the driver registry and employer engagement boundary; it does not complete private documents or qualification review.

## Design decisions

Preserve the approved typography, white canvas, sidebar, company tabs and Evidence in Motion system. Add Drivers only when the authenticated user's actual relationship grants driver access. A provisioning administrator does not acquire sensitive record access through company administration.

The roster uses compact, searchable, paginated records, initials, company references and labeled operational states. The record combines identity and current-engagement modules with a real engagement history table. Contextual sections expose authorized management, reviewed identity correction and restricted record history. The original driver empty-state SVG identifies the workflow without a fabricated preview or metric. Motion remains restrained and reduced-motion aware.

Names alone never merge records. Company references are unique within a tenant. Engagement status is explicitly operational, not a legal compliance determination. Transfers preserve the former engagement; corrections preserve before/after values in restricted append-only history. Technical audit details remain available in a disclosure rather than replacing the readable event timeline.

## Executed verification

- PostgreSQL migration, 43 backend tests and Ruff passed. Coverage includes tenant/branch denial, provisioning-only denial, wrong-driver attachment, revoked grants, immutable history, version conflicts, temporal guards and concurrent idempotent creation.
- Five frontend tests and production build passed; JS 282.38 KB / 84.29 KB gzip, CSS 75.04 KB / 13.86 KB gzip.
- Real M1-to-M2 browser journey passed: invitation/MFA/activation, driver registration, state change, transfer, correction, history, reload/search persistence and reduced motion.
- New driver matrix: 28 viewport/axe cases at 375, 768, 1024 and 1440px, zero violations or page overflow. Existing foundation matrix: 100 cases, zero violations/overflow.
- Actual rendered record, roster, registration and mobile history screenshots inspected. New-feature baseline had no driver interface; no fabricated before screenshot is supplied.

[Screenshot gallery](m2-drivers/index.html) · [Driver testing guide](../runbooks/m2-drivers.md)

## Remaining M2 work

Private S3 quarantine, malware-scanner integration and failure recovery, immutable evidence versions, document access/review, requirement/policy versions and full duplicate investigation are pending. No document upload, legal eligibility or provider connectivity is claimed. Formal assistive-technology certification and load benchmarking remain open.
