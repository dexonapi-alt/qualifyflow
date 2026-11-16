# QUALIFYFLOW
## 04 — Security, Regulatory Validation, Reliability & Production Delivery

**Document status:** Production-intent architecture and release-control plan v1.0  
**Date:** 2026-11-17  
**Product:** QualifyFlow — multi-tenant driver qualification compliance platform  
**Audience:** Product owner, compliance/legal reviewers, application/security engineers, SRE/DevOps, operations leadership, QA, and Codex  
**Companion documents:**
- `01_QUALIFYFLOW_SOFTWARE_MASTER_PLAN.md` — product scope, modules, data architecture, milestones.
- `02_DESIGN_AND_MOTION_SYSTEM_v1.1.md` — user experience, visual identity, animation, accessibility details.
- `03_WORKFLOWS_AND_USER_JOURNEYS.md` — actors, commands, lifecycle states, transitions, and operational acceptance scenarios.

> **Critical boundary.** QualifyFlow is an independent, commercial-intent product inspired by a public Compliance Data Specialist job description. It is **not** CrewBloom's or its client's actual system. These plans do not certify regulatory compliance, authorize processing actual driver data, or constitute legal advice. No public-facing “FMCSA compliant,” “certified,” or driver eligibility claim may be made until jurisdiction, user responsibilities, rules, operational controls, and regulatory interpretations are independently reviewed. **Start with synthetic data, controlled development, and explicit release gates.**

> **Evidence status.** The legal topics and regulatory references below are a **research and approval inventory**, not a verified statement of every currently applicable requirement. Live source verification was not available while preparing this plan. The rules engine must default to *unconfigured / needs policy review* for a rule whose applicability, current text, effective date, or interpretation has not been confirmed.

---

# 1. Purpose, ownership and cross-document contract

## 1.1 Why Document 04 exists

Documents 01–03 describe what QualifyFlow does, how the interface behaves, and how people and providers move data through it. This document defines **the conditions under which it is safe, lawful, recoverable and supportable to run**.

It owns:

1. Regulatory and jurisdictional applicability research, legal sign-off and versioned policy catalog.
2. Privacy, sensitive driver information handling and lawful-purpose controls.
3. Threat modeling, authentication, authorization, tenant boundaries and security architecture.
4. Secure file ingestion, provider integrations, credentials, outbound communications and audit evidence.
5. Development, test, staging and production infrastructure; CI/CD; migration and deployment strategy.
6. Reliability, jobs, backups, restores, incident response, operational monitoring, and vendor management.
7. Tests, release gates, launch criteria, operational runbooks and ongoing governance.

It does **not** reimagine the visual design (02), redefine business status machines (03), or change feature ownership (01). When there is a conflict, stop and resolve it with an architectural decision record (ADR); do not silently pick the easier implementation.

## 1.2 Required product distinction

- **Evidence received:** a file, record or result arrived; not necessarily validated.
- **Identity matched:** the correct person and employer relationship was established with adequate evidence.
- **Evidence reviewed:** an authorized reviewer accepted its classification, scope, dates and quality.
- **Operational file status:** the app's configured checklist has a documented state.
- **Legal qualification/compliance determination:** a separate decision requiring validated applicable law and duly authorized responsibility.

These states must never collapse into one boolean called `compliant`.

## 1.3 Responsibility boundaries

| Party | Product responsibility (proposed) | Important limit |
|---|---|---|
| Platform operator | Operate secure multi-tenant software, integrity safeguards and infrastructure | Cannot declare an employer legally compliant by providing software alone |
| Managed compliance team | Carry out contracted intake, verification, exception processing and correspondence | May not take employer-reserved or legally restricted decisions without authority |
| Client employer | Supply facts, control authorized account administrators, make reserved decisions and fulfill legal duties | Outsourcing administration does not itself eliminate employer obligations |
| Background-screening provider | Supply contracted reports and provider metadata under valid authorization | Report availability does not automatically establish its relevance or legal usability |
| Legal/compliance reviewer | Approve applicable requirements, evidence treatment, wording and policy versions | Must be engaged before rules become operational compliance determinations |
| Engineering and security owners | Enforce technical controls and auditability | No code deploy should bypass policy approval or human review gates |

**Policy:** The contract of service, not a developer's assumptions, assigns who may review, accept, request information, communicate, escalate and approve decisions for each client and jurisdiction.

---

# 2. Regulatory research program — verify before coding rules

## 2.1 Applicability comes before requirements

Before implementing an enforceable DQF rule, answer:

- What exact operations are covered: interstate or intrastate, carrier, driver class, vehicle, and relevant exemptions?
- What U.S. federal and state jurisdictions apply, and which employer or client is legally responsible?
- Which documents are required, from whom, for which driver, at what point in the lifecycle?
- What rules are event-based, periodically reviewed, expiry-based, or retention-based?
- Which documents may be substituted, where permitted, or are subject to special exceptions?
- Which data may be received through an API and which require human or employer action?
- Is the client acting as a motor carrier, an employment-screening requester, or another regulated party?
- Does the service provider have explicit authority to access, process and communicate about the data?

**Do not assume a single universal DQF checklist is correct for every driver.** A rule engine requires an applicability engine.

## 2.2 Authoritative research inventory

The following are **primary source families to consult and verify**, not a claim that every source applies to all tenants:

| Area | Candidate primary source | Verification objective |
|---|---|---|
| Driver qualifications / DQF | U.S. eCFR **49 CFR Part 391**, especially applicable qualification-file provisions | Requirements, exceptions, responsible party, timing and retention |
| Controlled-substance and alcohol programs | Applicable provisions of **49 CFR Parts 382 and 40** | Distinguish safety compliance requirements from qualification-file artifacts; avoid conflating programs |
| Screening reports / consumer reporting | **Fair Credit Reporting Act (FCRA)** and applicable FTC/CFPB guidance; current federal statutes/regulations | Permissible purpose, notices, authorization, adverse action, accuracy/dispute obligations where applicable |
| Driving-record access | **Driver's Privacy Protection Act (DPPA)** and applicable state DMV requirements | Permitted access and redisclosure of motor vehicle records |
| Employment, disability, sensitive health information | Applicable EEOC/ADA/GINA rules and state law, when triggered | Restrict access/use and avoid discriminatory processing |
| State-specific employment and privacy rules | State statutes, regulator guidance, employer location and data-subject jurisdiction | State overlays, screening restrictions, notifications and retention |
| Philippines processing teams / vendors | Philippine **Data Privacy Act of 2012** and applicable NPC guidance, if relevant to processing arrangement | Cross-border data roles, security and breach duties; obtain legal assessment |
| Contractual and service commitments | Signed client MSA, data processing terms, provider contracts and approved SOPs | Who can do what, timelines, data use, breach notices and deletion responsibilities |

**Source-verification process:** use official current sources (eCFR, FMCSA, FTC, state regulators, NPC as applicable), capture the exact URL, version/effective date, relevant section and reviewer. Do not rely on undated blogs or a model's recollection as the controlling interpretation.

## 2.3 Regulatory research deliverable: rules register

Create a maintained `REGULATORY_RULES_REGISTER.md` and machine-readable policy store. Each candidate rule needs:

| Field | Required content |
|---|---|
| `rule_id` | Stable identifier, no user-facing assumption embedded in key |
| `regime`, `jurisdiction` | Federal, state, contractual, customer-specific, etc. |
| `authority_url` and `citation` | Official primary source and precise provision |
| `source_version`, `effective_from`, `verified_at` | Evidence of currency |
| `applicability_conditions` | Driver, employer, circumstance, exemption, document scope |
| `operational_requirement` | Human-readable rule, necessary data, cadence, and authorized response |
| `evidence_type` | Expected artifact, report or recorded determination |
| `retention_policy_id` | Separate approved retention schedule |
| `interpretation_notes` | Explicit uncertainty; legal reviewer comments |
| `review_owner` and `approved_by` | Named responsible persons; segregation of duties |
| `status` | `draft`, `research_pending`, `review_pending`, `approved`, `suspended`, `retired` |
| `valid_from`, `valid_to` | Version interval, no retroactive mutation |

**No rule with status other than `approved` may generate a legal compliance status, irreversible restriction, or external conclusion.** Draft rules may be run in a clearly labeled sandbox/dry-run for research.

## 2.4 Example: safe evidence categories

Use illustrative document categories for schema/testing: driver qualification application information, licensing/driver record evidence, motor vehicle record reports, applicable medical qualification documentation, prior employment/safety-history records, review records, and client-defined supporting documents. **Do not encode exact universal deadlines, recurrence periods or required lists based on this sentence.** Different categories have different legal treatment, special applicability and retention.

A missing file is an **operational exception** when a client has configured a requirement. It is not automatically proof a driver is unlawful to employ or operate. Likewise, a file that is present and unexpired is not necessarily sufficient or valid.

## 2.5 Legal decision controls

- Route disputed interpretations, employment/eligibility decisions, adverse-action workflows and regulatory exceptions to the designated authorized reviewer.
- Require decision provenance: supporting evidence, rule version, employer, approver, reason, timestamp and any mandated notices.
- Never infer legal qualification from a model output, OCR confidence score or document name alone.
- Show explicit distinction between *Needs review*, *Operationally complete against selected checklist*, and a decision authorized by verified policy.
- Establish a legal change-monitoring owner and a review cadence before active client onboarding.

## 2.6 Verification and sign-off gate

Before real driver data or customer production use:

1. Obtain jurisdiction and service scope from the intended customer.
2. Complete the primary-source rules register for the agreed service.
3. Review interpretations with qualified U.S. compliance/legal counsel as appropriate and privacy counsel when cross-border processing is involved.
4. Approve document requirements, client SOPs, notifications, escalation, review rights and retention.
5. Test the same cases against known correct reviewer decisions and exception cases.
6. Version, sign, publish, monitor and support rollback of approved policy bundles.

---

# 3. Sensitive information and privacy-by-design

## 3.1 Data inventory and classification

Classify data before generating forms or API fields:

| Data class | Examples | Baseline treatment |
|---|---|---|
| Public/product | Public marketing copy, generic UX assets | Standard integrity controls |
| Internal operations | Queue metrics, internal comments without PII, system configuration | Role-limited, logged, controlled sharing |
| Sensitive personal | Name, address, date of birth, driver license number, identifiers, screening metadata | Purpose-bound access, encryption, minimized logs/exports |
| Restricted reports | Criminal/background reports, MVR details, medical-related evidence, other confidential artifacts | Strict role and purpose gating; field masking; protected storage; retention policy |
| Secrets | API keys, tokens, webhook signing keys, encryption keys, session credentials | Managed secret storage, strict access and rotation; never in client code/logs |
| Security/audit evidence | Access logs, changes, incident artifacts | Integrity, retention controls, restricted investigations |

**Design for the highest-sensitivity reasonable input**, but only collect fields whose lawful purpose is verified. Avoid SSNs, full license numbers and medical content in demo/seed data entirely.

## 3.2 Data map and records of processing

Document:

- Data source → controller/processor roles → data category → legal/contractual purpose.
- Collection/upload route → validator → working storage → final evidence store → notifications and exports.
- Regions and third-party processors where data can transit or be accessed.
- Retention policy, deletion mechanism, backup lifetime and legal holds.
- Role-by-role access; who can view original reports versus metadata only.
- Data subject requests, disputes, corrections and report-provider escalation handoff.

A tenant-specific record must carry a stable tenant scope and sufficient purpose/authority metadata. **A scope identifier alone is not proof of permission.**

## 3.3 Data minimization and confidentiality

- Prefer metadata-only queue previews; reveal full PII only in authorized review contexts.
- Mask restricted identifiers by default; log the reason for sensitive unmasking when warranted.
- Avoid sending complete screening reports or medical contents through email/SMS.
- Store only necessary provider payload fields; preserve originals only where the approved evidentiary and retention policy requires.
- Do not expose report content in URLs, analytics events, error trackers, support screenshots or browser storage.
- Private environments must use synthetic or properly de-identified datasets; redaction alone can be inadequate if identities remain re-identifiable.
- Enforce export policies and recipient verification; add watermarks and metadata to accountable exports when appropriate.

## 3.4 Rights, corrections and disputes

Implement a documented intake route for privacy rights requests and inaccurate/contested screening data; do not let an operator silently delete or alter source evidence that is subject to retention, dispute or legal-hold constraints.

- A request gets an owner, legal classification, due date, policy version and audit trail.
- Corrections are append-only/versioned where possible and preserve the source report distinction.
- Provider-originated disputed data may require a provider-side process; don't invent an in-product replacement for statutory dispute mechanisms.
- Delete/export requests proceed only after checking contractual/legal bases, identity, holds and backup consequences.

---

# 4. Threat model: protect the trust boundaries

## 4.1 Key trust boundaries

1. **Anonymous/public web → authenticated user session.**
2. **Client user → authorized tenant/branch/company.**
3. **Managed specialist → explicitly assigned client and action scope.**
4. **Application/API → database and private object storage.**
5. **Third-party provider/webhook → untrusted external payload → intake pipeline.**
6. **Queue/worker → scoped background execution.**
7. **Support/admin tooling → elevated actions and restricted evidence.**
8. **Notifications/export → external recipients and copies of data.**
9. **CI/CD or infrastructure provider → production secrets and data.**

## 4.2 Threat register (initial)

| Threat | Failure example | Required control | Verification |
|---|---|---|---|
| Cross-tenant record access | ABC changes `/drivers/{id}` to see XYZ's driver | Backend scoped authorization, ownership checks, RLS defense-in-depth | Direct object-reference attack test |
| Branch data bleed | Branch A member reads Branch B's file | Assignment model + explicit branch policies | Branch-scope matrix test |
| Wrong-person attachment | Same-name MVR auto-attaches to incorrect driver | Identifiers, confidence/evidence threshold, review queue; no name-only auto-accept | Duplicate-name test |
| Role escalation | Client viewer edits policies or approves own case | Server-side role/attribute checks, separate approver, step-up auth | Privilege escalation test |
| Credential leakage | API token appears in JavaScript bundle/log | Secret manager, server-side access, log redaction | Build/log inspection |
| Webhook replay/spoofing | Forged provider event accepted | Signed payload, timestamp tolerance, nonce/event ID, idempotency | Replayed/bad-signature tests |
| Import poisoning | CSV formulas, oversized payloads, malformed IDs | Parser quotas, schema checks, CSV injection safe export | Adversarial import suite |
| Malicious attachment | Uploaded PDF exploits preview or spreads malware | Quarantine, content inspection, sandboxed preview, malware scan | EICAR and parser fuzz tests where appropriate |
| Silent duplicate processing | Retries create two accepted reports or messages | Unique source keys, transactional outbox, dedupe | Retry/fault-injection tests |
| Audit tampering | Authorized operator overwrites a prior decision | Append-only events, immutable/signed sinks, segregated audit roles | Tamper attempt test |
| Insider overreach | Specialist exports all companies' data | Assignment-limited views, export controls, anomaly alerts | Access-review test |
| Dependency/supply-chain attack | Build uses compromised dependency | Lockfiles, provenance, SCA, least-privileged CI | Pipeline policy tests |
| Backup disclosure | Public bucket or unmanaged backup contains reports | Private storage, encryption, access reviews, restore controls | Storage policy tests |
| AI/data leakage | Report data submitted to external LLM service | No AI upload by default; approved DPA, purpose and opt-in review if ever added | Network/data-flow inspection |

Threat modeling should occur at architectural design, before integration onboarding, and after any feature that changes data access or external communication. Track threat owners and mitigations as deliverable issues rather than generic checklist language.

---

# 5. Identity, authorization, tenancy and administrative safety

## 5.1 Account and authentication architecture

- Use a maintained identity solution with secure session management. Keep authentication credentials distinct from driver records.
- Require verified invitation acceptance; invite tokens are single-use, short-lived, tenant-bound and never reusable as login tokens.
- Prefer MFA for provider personnel and all administrators. Require stronger/step-up authentication for key rotation, role changes, bulk export and high-risk actions.
- Set secure, HttpOnly, SameSite session cookies and appropriate CSRF controls when cookie-authenticated; manage OAuth/OIDC flows with state/nonce/PKCE as appropriate.
- Implement account lifecycle: invite, active, suspended, disabled, restored, offboarded; revocation must invalidate sessions/tokens.
- Support carefully designed support access, impersonation restrictions and break-glass procedures with dual control and audit.
- Consider SSO/SAML/SCIM when commercial customers require it; do not claim implementation before integration testing.

## 5.2 Authorization model

Use RBAC for broad capabilities and ABAC/relationship checks for actual authorization. Example roles (from Documents 01/03) include:

- Platform administrator (restricted platform configuration; **not** indiscriminate report viewing).
- Managed compliance specialist (assigned tenant and allowed actions).
- Managed reviewer/supervisor (review, approval scopes per client policy).
- Client administrator (user and company management within their tenant).
- Client reviewer/approver (approved decision type within tenant).
- Client viewer/submission user (read/upload only when permitted).
- Service account/integration identity (bounded scopes; no interactive login).

**Authorization check must consider:** actor, tenant, branch, driver/company engagement, assigned case, action, report sensitivity, purpose, policy, approval state, and expiry of the assignment. Enforce in backend services and every worker—not just API route decorators or hidden buttons.

## 5.3 Defense-in-depth implementation

- Every tenant-owned row has a validated tenant association and correct keys. Driver identity may be global/internal while employer relationships and evidence permissions are separately tenant-scoped.
- Use PostgreSQL row-level security (RLS) as an optional defense-in-depth layer with carefully controlled database roles and request-local tenant context; never rely on it as the only authorization mechanism.
- Scope storage objects and signed URLs to a requester and an approved action. Short TTL; no blanket public buckets.
- Clear tenant context in pooled connections and asynchronous workers; test that pooled clients cannot leak prior request scope.
- Persist audit context with actor ID, client ID, effective role, correlation ID and policy version.
- Fail closed on missing assignment, expired membership, unknown branch or indeterminate policy.
- Use 403/404 behavior consistently and avoid revealing the existence of other tenants' records through error messages, counts or search suggestions.

## 5.4 High-risk admin operations

For organization creation, user role changes, provider credential entry, external webhook registration, key rotation, bulk export and cross-client assignment:

- Require a server-side check of the permitted actor, scope and valid business request.
- Prompt for step-up auth or second approval according to risk policy.
- Audit before/after references (with sensitive values redacted), reason and initiator.
- Provide a safe retry path; never present “configured” solely because a form saved.
- Detect suspicious rapid changes and notify designated internal security/operations owners.

## 5.5 Permission acceptance matrix

| Attempt | Expected outcome |
|---|---|
| ABC client viewer requests XYZ evidence via ID guess | Denied, audited as suspicious if appropriate |
| ABC admin creates a user for ABC, within granted scope | Allowed, invitation remains pending until accepted |
| ABC admin assigns platform admin rights | Denied regardless of frontend behavior |
| Specialist assigned only ABC reads XYZ | Denied |
| Specialist loses ABC assignment while case is open | Subsequent access denied; reassignment workflow handles case |
| Service account receives broader scope than its connection | Denied |
| Suspended user retains old browser session | Server rejects privileged actions |
| Bulk job attempts another tenant due to stale context | Job fails closed, quarantines output, alerts |

---

# 6. Secure document ingestion and chain of custody

## 6.1 Untrusted upload pipeline

**Upload → quarantine → validate → scan → parse metadata → match → human review → approved evidence store.**

Do not serve uploaded files directly or treat the filename or MIME string as proof of type. Every uploaded object should have:

- Quota checks per account, tenant, upload route, file size and upload frequency.
- Allowlisted types based on actual parsed format; explicit strategy for PDF/images/CSV and any later DOC formats.
- Virus/malware scan with quarantine, alert and reject states; no “accepted” before required checks finish.
- Content hashing (e.g. SHA-256) for exact-duplicate detection and evidence integrity.
- Immutable original bytes and append-only document versions; verified corrections create a new version/reference.
- Safe rendering strategy with sandboxed viewer or sanitized preview artifacts; no active HTML or executable content.
- Private, encrypted-at-rest storage with a separate metadata index and access logs.
- Explicit scan/review status visible in operations console (Document 03), never falsely “ready.”

## 6.2 Trust and identity controls

A filename like `john_smith_mvr.pdf` is not sufficient to attach a file. The record must be matched against trusted provider identifiers, tenant/account context, date and relevant driver engagement, with uncertain cases routed for human resolution. Preserve provider origin and received-at timestamps.

## 6.3 File access policy

- Authorization happens before creating any download/view URL.
- Signed URLs expire quickly and should bind to an allowed resource and action where feasible.
- Use response headers preventing unintended indexing/caching of sensitive reports.
- Browser preview should display watermark/context when appropriate and log access for restricted files.
- Exports containing multiple records require explicit scope confirmation and a policy-checked purpose.

## 6.4 CSV import/export safety

- Normalize encodings, reject dangerous malformed rows and enforce schema/record quotas.
- Return per-row accepted/rejected statuses; never hide partial failures.
- Protect CSV exports against spreadsheet formula injection (`=`, `+`, `-`, `@` and similar risky prefixes), using an agreed safe escaping policy.
- Do not export fields beyond the user's approved scope; mask sensitive identifiers.
- Every import and export carries tenant, actor, source, timestamp, row counts and reproducible audit references.

---

# 7. API, webhook and integration security

## 7.1 Two directions, two security models

1. **Incoming from screening/data providers:** provider connection with verified source, report schema, allowed data and client mapping.
2. **Outbound access for client systems:** generated client service accounts, scopes, tokens and webhook delivery configured by authorized admins.

These are separate credential owners, consent paths, rate limits and incident surfaces. A successful client API token issuance is not a successful provider API connection.

## 7.2 Provider onboarding gate

A connection may become `active` only when all checks pass:

- Vendor account ownership and permission to process requested report products.
- Secure credentials stored in secret manager/encrypted vault, not database plaintext or frontend state.
- API endpoint, TLS/security requirements and environment verified.
- Correct tenant connection and mapping rules approved.
- Sandbox/connection test authenticated and validated a representative safe response, not just HTTP 200.
- Webhook verification and retry/replay contract tested when used.
- Data-transfer purpose, provider contract and field minimization checked.
- Owner and incident contact documented; rotation/expiry reminders configured.

Support `draft → testing → review_required → active`, plus `degraded`, `suspended`, `revoked`, as specified in Document 03. Update status from verified evidence, not optimistic UI events.

## 7.3 Incoming webhook handling

- Authenticate provider identity by validated signature or equivalent approved mechanism; if unsupported, use a documented compensating control and restrict that integration.
- Verify timestamp within an approved tolerance and reject replayed provider event IDs/signatures.
- Put signed raw payload and envelope into protected quarantine/durable intake before acknowledging accepted work.
- Preserve provider account ID, tenant mapping, event type, version and correlation ID.
- Use idempotency constraints scoped to connection + provider event/report ID.
- Process asynchronously with bounded attempts, exponential backoff and jitter. Quarantine poison messages for review.
- Acknowledge only after the accepted event is durably recorded (not necessarily fully processed); report downstream failure honestly.

## 7.4 Outbound client API and service accounts

- Default deny and explicit least-privilege scopes (`drivers:read`, `screening:submit`, etc. only as actually implemented).
- Short-lived access tokens if supported, with refresh/rotation; safely revocable hashed/managed credentials.
- Per-tenant/user/service rate limits, input validation and monitoring.
- Prevent mass assignment of tenant IDs or role fields; derive allowed scope server side.
- Stable API versioning, deprecation schedules and field-level data minimization.
- Tenant-specific webhook subscriptions, egress allowlists where appropriate, secret verification, signed event envelopes and delivery logs.

## 7.5 Data mapping and provenance

Maintain versioned, testable mappings between provider product types/fields and internal evidence categories. Every transformed field should carry enough provenance to trace **provider source → original value → transform/mapping version → destination → reviewer decision**.

A malformed value is a data-quality exception; **never silently convert it into an apparently valid regulatory conclusion**.

## 7.6 Vendor and provider failures

| Condition | Safe behavior |
|---|---|
| `401` / revoked provider key | Mark degraded, stop dependent jobs, alert authorized integration owner; do not retry endlessly |
| `429` | Honor retry metadata/backoff, bounded queue, preserve sequence where required |
| `5xx` / timeout | Retry with idempotency, DLQ after threshold, expose run state |
| Schema changes | Quarantine unknown/invalid fields, identify mapping version, block unsafe publication |
| Duplicate result | Record duplicate occurrence and source lineage, avoid duplicate accepted evidence |
| Wrong tenant/provider mapping | Reject/quarantine immediately, incident review if exposure occurred |
| Unauthorized outbound recipient | Do not send; create approval/recipient validation task |

---

# 8. Notification safety, approvals and communications

## 8.1 Client-specific communication contract

Do not send messages solely because a record enters a generic `expired` or `missing` state. Each outgoing communication needs:

- Client-owned approved policy/template and allowed event type.
- Explicit recipient selection and verified address, role and channel.
- Applicable privacy, consent, contractual or legal basis for the communication.
- Human approval when required by the case, client process or sensitive content.
- Minimal detail in message body; secure portal link for restricted report content.
- Idempotency keys and delivery provider confirmation; draft/queued/sent/delivered/failed states must be truthful.
- Template version, initiating evidence, sender identity, policy version and outcome in the audit trail.

## 8.2 Avoid irreversible notification mistakes

An automated reminder is generally more appropriate than an automated employment disqualification. Keep sensitive, ambiguous or legally significant notices behind verified policy and accountable approver gates.

Protect against a missing or wrongly mapped company contact: block sending, quarantine the notification, and route a corrective task rather than guessing a recipient.

## 8.3 Communication acceptance tests

- Notification for ABC cannot be sent to XYZ users through a stale cached recipient.
- Duplicate provider event produces only one authorized message under an idempotent policy.
- “Sent” requires a real messaging provider response; “delivered” requires provider delivery evidence.
- Recipient updates or revoked permission invalidate queued unapproved messages when policy requires.
- Sensitive evidence is never attached to external email by default.
- Replayed automation jobs do not send duplicate reminders without documented intention.


---

# 9. Reference infrastructure and environment architecture

## 9.1 Architectural principle

Follow Document 01: **modular monolith + separate workers**, not premature microservices. Use one coherent authentication/authorization layer and clearly bounded application modules. Only split services when observable scale, availability or organizational constraints justify it.

### Baseline deployment components

| Component | Preferred implementation pattern | Security and operations concerns |
|---|---|---|
| Web app | React/TypeScript built as static or server-delivered frontend | CSP, trusted origin, no secrets, versioned assets |
| API | FastAPI Python application | Authentication, authorization, input validation, rate limits, request logging |
| Database | Managed PostgreSQL | Private network, encrypted connections, restricted roles, backups/PITR |
| Background jobs | Redis-backed queue plus dedicated Python workers/scheduler | Tenant-context isolation, retry/DLQ, heartbeat, job ownership |
| Document store | Private S3-compatible object storage or managed equivalent | Encryption, quarantine bucket/prefix, signed access, lifecycle controls |
| Secrets | Managed secret service | Credential isolation, rotation, no credentials in source or logs |
| Identity | Reputable OIDC-compatible identity layer or securely implemented auth service | MFA, invitation and recovery lifecycle, session revocation |
| Email/notifications | Approved transactional messaging provider | Deliverability, recipient controls, webhook verification, privacy |
| Observability | Centralized metrics, structured logs, traces and alert routing | PII redaction, retention, account access, incident response |
| Edge | HTTPS, load balancing, WAF/rate-limits as needed | Security headers, abuse protection, availability |

**Frontend hosting note:** Vercel may be suitable for the web application, but QualifyFlow requires a secure persistent backend, workers, database and private object storage. A static frontend deployment does **not** host scheduled processing, secure private driver reports, or the entire operational system by itself. Select backend providers using data residency, privacy contracts, security assurances and cost, not only free-tier convenience.

## 9.2 Environment isolation

Maintain at least:

- `local`: synthetic fixtures and development-only credentials.
- `test/CI`: disposable databases and synthetic test data; no live provider tokens.
- `staging`: production-like infrastructure, sandbox provider connectors, masked synthetic data, controlled testers.
- `production`: only approved clients/data and tightly restricted administrators.

All environments use separate credentials, buckets, databases, callback/webhook URLs, and external integration identities. Do not copy production driver files into test or developer laptops.

## 9.3 Network and platform controls

- Private database network exposure; no publicly accessible PostgreSQL admin endpoint.
- TLS from browser to API and between service components where required by platform/threat model.
- Restrict worker and API access to secrets and storage resources they actually need.
- Separate quarantine/upload write permissions from reviewed-evidence read permissions.
- Outbound egress controls for approved providers where viable.
- Firewall/WAF and API rate limiting with clear error handling; audit changes to allowlists.
- Reproducible image builds and pinned deployment manifests; avoid mutable “latest” images in production.
- Document infrastructure as code and changes in version control; apply with reviewed change plans.

## 9.4 Example environment variables (names, not secrets)

```dotenv
# Values are examples of configuration keys only; never commit real values.
APP_ENV=staging
PUBLIC_APP_ORIGIN=https://staging.example.invalid
API_BASE_URL=https://api-staging.example.invalid
DATABASE_URL=<managed-secret-reference>
REDIS_URL=<managed-secret-reference>
OBJECT_STORE_BUCKET=<environment-specific-private-bucket>
OIDC_ISSUER=<approved-identity-provider>
SECRET_MANAGER_PREFIX=<environment-specific-prefix>
LOG_PII_REDACTION=true
AUTOMATION_SAFE_MODE=true
REGULATORY_RULESET_STATUS=unapproved
```

The `REGULATORY_RULESET_STATUS` flag is illustrative: a flag does **not** substitute for signed, versioned policy approvals checked by backend logic.

---

# 10. Application security engineering and secure SDLC

## 10.1 Baseline secure development practices

- Align implementation review with current **OWASP ASVS** and **OWASP API Security Top 10** guidance, verifying versions before adopting as normative requirements.
- Use parameterized SQL/ORM, explicit Pydantic validation and typed frontend API contracts.
- Secure authentication redirects, cross-origin settings, CSRF protections and session storage.
- Enforce content security policy, frame and MIME protections compatible with approved document-viewing approaches.
- Avoid executable user content, unsafe HTML rendering, deserialization of untrusted objects, and unchecked archive extraction.
- Apply resource quotas to uploads, batch files, queries, report generation and export jobs.
- Audit security-affecting changes; maintain dependency owners and a vulnerability response channel.
- Do not hardcode secrets; check repository history and CI artifacts for accidental disclosure.

## 10.2 CI/CD minimum pipeline

1. **PR checks:** formatting, linting, typing, unit tests, contract/schema checks, migration validation and test coverage report.
2. **Security checks:** dependency scanning/SCA, secret scanning, SAST, container/IaC scans when applicable, license review.
3. **Integration tests:** isolated PostgreSQL/Redis/object store with synthetic documents; provider sandbox stubs or authorized sandbox endpoints.
4. **Authorization tests:** tenant ID tampering, scope escalation, branch access and cross-job leakage.
5. **Build provenance:** locked dependencies, signed or traceable artifacts, SBOM where practical, immutable image digests.
6. **Staging deploy:** migration preflight, smoke tests, accessibility/performance checks, secure headers and file preview.
7. **Release approval:** engineering owner, security owner and compliance owner where rules/real data are affected.
8. **Production rollout:** gradual or guarded, monitored, with rollback method validated.

**No green build = no release.** A green build is necessary but not sufficient for legal or security approval.

## 10.3 Database migrations and compatibility

Use Alembic (matching FastAPI/PostgreSQL) with a reviewed migration path.

- Prefer **expand → migrate → contract** for breaking schema changes.
- Avoid irreversible destructive migrations in the same release as new client functionality.
- Keep migration checks idempotent and visibility into lock time/impact.
- Back up and perform a restore check before high-risk migration windows.
- Use unique constraints for provider event IDs, evidence version links and authorized tenant mappings.
- Guard policy version changes separately from business schema migrations.
- Treat a migration that changes access scope, retention or event status as a high-risk change requiring explicit review.

## 10.4 Feature flags and safe modes

- Per-environment controls for integrations, automations, bulk imports, export, communication delivery and policy evaluation.
- An **automation safe mode** can stop all external actions while retaining queued evidence and audit trails.
- A policy publication feature flag cannot bypass legal approval.
- Flags themselves have ownership, expiration/review date, logs and tested rollback behavior.

---

# 11. Reliability, concurrency and operational correctness

## 11.1 Service-level indicators (SLIs)

Measure at least:

- API availability and p50/p95/p99 latency by critical route.
- Screening intake success/failure, received-to-reviewed time, and queue age.
- Wrong-match incidents and corrected attachments (priority quality indicators).
- Provider connection health, retry count, rate-limit events and schema failures.
- Automation run completion, duplicate prevention and job duration.
- Notification delivery/rejection, bounced or invalid recipient rate.
- Restore-test success, backup age and effective recovery point.
- Authorization denials, suspicious cross-tenant attempts, report export anomalies.

Do not display fabricated “99.9% accuracy” or compliance coverage; define measurement and denominator first.

## 11.2 Initial nonbinding engineering targets

These are **proposed targets for evaluation**, not achieved SLAs or customer promises:

| Metric | Planning target | Validation requirement |
|---|---|---|
| API availability | 99.9% monthly for agreed core routes | Capacity tests, monitoring and contract review |
| Read latency | p95 below ~500 ms on ordinary record views under defined load | Benchmark with realistic tenant/data mix |
| Intake durability | No acknowledged accepted event lost | Durable-ack and fault-injection tests |
| Record matching | Zero automatic cross-tenant attachments | Security and scenario regression suite; incident process |
| Critical alert visibility | Detect owner-visible failure within ~5 min | Alert routing drill and after-hours policy |
| Recovery point objective | Candidate **RPO ≤ 15 minutes** | Verified backup/PITR and system architecture |
| Recovery time objective | Candidate **RTO ≤ 4 hours** | Actual restore drill, dependencies and operations capability |

Owners must revisit these targets for real client contracts and budget. **An untested RPO/RTO is only a proposal.**

## 11.3 Idempotency and atomicity

- Use transactionally consistent state transitions for accepted report + document association + audit event.
- Use transactional outbox for externally sent notifications/events when appropriate; never send first and then *hope* the database commit succeeds.
- Provider event IDs alone may not be globally unique; keys must include connection/tenant/provider scope.
- Reconciliation jobs compare accepted results with provider source IDs and quarantine mismatches.
- Protect against simultaneous reviewers with optimistic locking/version tokens and conflict messages.
- Preserve original event and outcome history; no “exactly once” claim unless the end-to-end guarantees are actually demonstrated.

## 11.4 Queue, worker and scheduler strategy

- Persist a scoped job envelope with tenant, actor/service principal, purpose, policy/mapping version, attempt count and correlation ID.
- Explicitly re-evaluate permission and active policy at processing time for sensitive actions.
- Bound retries, exponential backoff/jitter, deadline handling, DLQs and manual replay permissions.
- Use leases/heartbeats to recover worker crashes and avoid indefinite `processing` states.
- Prioritize user-facing intake/review over lower-priority scheduled bulk analytics if workloads compete.
- Deduplicate scheduled reminders and ensure only one active run per relevant rule/scope/window when needed.
- Do not let one high-volume tenant starve other tenants; establish fair-use quotas and queue partitions by need.

## 11.5 Graceful degradation

| Failure | User-visible behavior |
|---|---|
| Screening provider offline | Show degraded connection, queue retry and existing validated records; no false import success |
| Document preview unavailable | Preserve document and review state; offer controlled retry; do not accept blindly |
| Notification provider unavailable | Keep approval and queued message, show unsent state, retry within policy |
| Automation service paused | Manual intake/review remains functional, clearly show jobs suspended |
| Database unavailable | Fail closed for writes and sensitive reads; clear service status, no optimistic success |
| Object store unavailable | Reject new upload or mark upload pending with truthful status; do not create reviewed record |
| Policy rules unapproved | Continue non-regulatory administrative actions; disable legal-status determination |

---

# 12. Backups, restore, retention, deletion and legal holds

## 12.1 Backup coverage

Back up or reconstruct:

- PostgreSQL data and schema with suitable point-in-time recovery.
- Private document objects, versions, integrity hashes and relevant storage lifecycle metadata.
- Secrets/configuration references and rotation procedure (avoid insecure plaintext secret backup).
- Audit and message delivery logs required for recovery and evidentiary needs.
- Infrastructure-as-code, container images/manifests and validated migration revisions.

Protect backup identities from the primary application account. Apply immutability/versioning where appropriate and test recovery using restricted access.

## 12.2 Restore drill

Run documented restore exercises to isolated environments:

1. Declare assumed incident and recovery point.
2. Restore database and object store versions consistent with that point.
3. Reconcile document hashes, evidence links and provider event IDs.
4. Verify tenant isolation, role memberships, active integrations and secrets restoration strategy.
5. Replay safe queued jobs or reconcile provider histories without duplicate messages.
6. Validate audit continuity, client-visible statuses and application functionality.
7. Record actual RPO, RTO, missing dependencies and corrective tasks.

A “backup successful” status is **not** equivalent to a successful restore.

## 12.3 Retention policy architecture

Create a policy table keyed by jurisdiction, record type, company/contract, event triggers, approved retention rule version, active legal hold and disposition method. Dates cannot be hard-coded from guessed regulatory knowledge.

Maintain distinction between:

- Operational record state (active, superseded, corrected, archived).
- Evidence retention duty and event that starts the clock.
- Legal hold and dispute preservation.
- Client contract end and export/offboarding obligations.
- Backup copy expiration and deletion delay.
- Audit-event retention, which may differ from document retention.

## 12.4 Deletion and offboarding

- Verify authority before delete or offboarding action.
- Export eligible client data using scoped, encrypted delivery and access expiry.
- Suspend integrations, revoke tokens and disable users promptly according to contract.
- Review legal holds and retention schedule before deleting individual evidence.
- Produce a deletion/disposition manifest without exposing retained restricted content to unauthorized recipients.
- Document residual copies in backups and their deletion schedule.
- Verify another tenant is never impacted by a client purge.

---

# 13. Incident response, abuse handling and business continuity

## 13.1 Incident categories

- **Security:** credential leakage, unauthorized access, malware, suspicious export, compromised host.
- **Privacy:** wrong-company report exposure, PII sent to incorrect recipient, inappropriate report collection.
- **Data integrity:** incorrect driver match, lost accepted report, corrupted evidence chain, duplicate legal notices.
- **Operational availability:** provider outage, database/storage failure, stalled queue, deployment regression.
- **Compliance/policy:** unauthorized determination, outdated rule bundle, prohibited action or missed approved notification workflow.

## 13.2 Severity model (proposed)

| Severity | Examples | Response posture |
|---|---|---|
| SEV-1 | Confirmed cross-tenant restricted-data disclosure, active credential compromise, widespread inability to safely process records | Stop affected automation/integration, incident command, immediate containment, legal/privacy escalation |
| SEV-2 | Major provider/import failure, material data integrity issue without confirmed broad disclosure | On-call escalation, remediation and incident log, customer communication per contract |
| SEV-3 | Degraded noncritical component or isolated recoverable workflow failure | Owned support ticket, monitored repair, status update |
| SEV-4 | Cosmetic defect or minor non-security improvement | Normal backlog |

Set notification and reporting timelines based on **verified applicable law and contracts**, not one global generic deadline. Legal counsel determines regulated breach, reportability and affected parties.

## 13.3 First-response playbook

1. **Detect:** alarm, specialist report, customer complaint or provider notice.
2. **Triage:** affected tenants, data classes, actions, timeline and confidence; assign severity and incident commander.
3. **Contain:** suspend compromised accounts/API keys, pause automation, isolate affected connector and restrict exports as needed.
4. **Preserve evidence:** immutable logs, hashes, affected event IDs and configuration snapshots; follow authorized evidence handling.
5. **Assess and notify:** legal/security/compliance leads review reporting and customer contractual obligations.
6. **Remediate:** reverse unsafe attachment references through versioned correction, rotate credentials, patch code/config, restore from trusted source.
7. **Recover:** staged rollout, reconciliation and careful release of paused jobs.
8. **Review:** postmortem with timeline, root cause, control gap, corrective actions, dates and owners.

### Specific playbook: wrong-company document attachment

- Suspend direct access/download to affected evidence immediately.
- Capture event IDs, request logs, recipient/access history and original file hash.
- Identify whether actual exposure occurred; involve security/privacy owner.
- Quarantine attachment relationship; do not erase source or audit history.
- Re-verify intended tenant/driver via authorized source identifiers.
- Publish corrected association and reviewer note only after approval.
- Determine customer/regulator notification obligations using applicable verified requirements.
- Add a permanent cross-tenant regression test and matching-rule root-cause fix.

## 13.4 Business continuity

- Define on-call rotation and alternate contacts for service provider and key vendors.
- Keep an approved manual intake/review plan for outages, with chain-of-custody tracking and later reconciliation.
- Prioritize preventing unauthorized disclosure or wrong qualification records over continuing automated throughput at all costs.
- Test failover/recovery windows and employee access from alternative working locations under secure-device policies.

---

# 14. Observability, operations console and runbooks

## 14.1 Operational metrics and traces

Every material intake/notification/integration/approval action should have:

`timestamp`, `event_id`, `correlation_id`, `actor/service_id`, `tenant_id`, `resource_reference`, `action`, `state_before`, `state_after`, `policy_version`, `outcome`, `error_code` and safe timing metrics.

Do **not** log full names, DOBs, license numbers, medical details, original PDF payloads, credentials or screening result bodies merely for debugging. Use opaque IDs and carefully approved redaction. Diagnostic access itself is permissioned and audited.

## 14.2 Core dashboards and alerts

These are **operational instrument panels**, not generic KPI-decoration cards. Follow Document 02's typography, quiet motion and information density guidance.

- Intake: queue age, unmatched/mismatched items, pending review, provider failures.
- Integrations: health by connection, last success, rejected signature attempts, credential rotation due.
- Notifications: approved but queued, failed delivery, invalid recipient, suspected duplicates.
- Document storage: scan backlog, quarantine count, signed URL errors, missing object references.
- Security: role changes, unusual exports, denied cross-tenant attempts, elevated access.
- Platform: API errors, latency, database saturation, worker heartbeats, backup freshness.
- Quality: misattachment events, corrected records, human decision reversals, audit incompleteness.

Operational dashboards must clearly distinguish zero, unknown, delayed, and unavailable measurements.

## 14.3 Mandatory runbooks

1. Provider connection degraded / credential revoked.
2. Webhook signature failure or replay spike.
3. Batch CSV partially accepted / mapping schema changed.
4. Misattached or misclassified driver evidence.
5. Unauthorized access or cross-tenant exposure.
6. Notification sent to wrong recipient.
7. Queued jobs stuck / duplicate attempts.
8. Secret rotation and emergency revocation.
9. Database restore and object-store consistency.
10. Tenant offboarding, export and deletion hold.
11. Regulatory rule update and policy rollback.
12. Production deployment rollback and migration recovery.

Each runbook must contain preconditions, owner, access needed, command/action procedure, safety checks, rollback, customer communication trigger and postcondition verification.

---

# 15. Test program — prove the business and security contracts

## 15.1 Test pyramid

- **Unit:** domain validations, applicability predicates, state guards, mapping transformations, redaction, safe date handling.
- **Contract:** API schemas, provider adapters, event signatures, idempotency, notification templates.
- **Integration:** PostgreSQL transactions/RLS, identity memberships, file storage, queues, provider sandbox and email provider simulator.
- **End-to-end:** operations and client portal journeys with real backend persistence and browser accessibility.
- **Security:** attack-focused testing, privilege boundaries, session expiry, secret abuse, report access.
- **Performance/reliability:** realistic batch imports, concurrent reviews, provider throttling, worker crashes, recovery drills.
- **Regulatory acceptance:** reviewer-approved synthetic cases for each active verified rule and edge condition.

## 15.2 Required test matrix

| ID | Scenario | Required acceptance outcome |
|---|---|---|
| SEC-01 | Cross-tenant driver URL guessing | Always denied; no report content or existence leak |
| SEC-02 | Different branches within same tenant | Scope enforced for configured branch roles |
| SEC-03 | Specialist unassigned mid-review | Access revoked; case reassignment preserved |
| SEC-04 | Client viewer changes role in request body | Ignored/denied; audit as appropriate |
| SEC-05 | Expired invitation accepted | Denied, no user created/activated |
| SEC-06 | Revoked token reused | Denied; no data access |
| SEC-07 | Platform admin attempts restricted report read | Denied absent explicit purpose/authorized grant |
| SEC-08 | Document served with forged tenant parameter | Denied by backend and storage access checks |
| SEC-09 | Signed URL used after expiry | Rejected |
| DOC-01 | Unsupported/malicious file uploaded | Quarantined/rejected before review |
| DOC-02 | Same-name drivers in different employers | No name-only auto-attachment |
| DOC-03 | File correction after review | New version, original and audit intact |
| DOC-04 | Large file or CSV batch exceeds quota | Predictable rejection, no partial unsafe writes |
| DOC-05 | CSV formula injection payload | Safe export escaping |
| INT-01 | Provider credential revoked | Degraded state; bounded retry; owner notified |
| INT-02 | Valid signed webhook delivered twice | One accepted event, correct duplicate history |
| INT-03 | Forged signature or stale timestamp | Rejected before downstream processing |
| INT-04 | Provider changes schema unexpectedly | Quarantine/exception, no misleading success |
| INT-05 | 429 with retry-after | Rate-aware retry; no dropped acknowledged result |
| INT-06 | Wrong connection-to-tenant configuration | Intake blocked, quarantined and audited |
| OPS-01 | Two reviewers accept same item simultaneously | One authorized commit; other gets conflict/reload |
| OPS-02 | Worker dies after durable receipt | Event reprocessed safely without double acceptance |
| OPS-03 | Notification requested before approval | Remains gated; no external send |
| OPS-04 | Message recipient belongs to other tenant | Blocked and logged |
| OPS-05 | Messaging API times out after provider acceptance | Reconciled; no unsafe blind duplicate send |
| OPS-06 | Rule published without reviewer approval | Cannot produce active compliance conclusions |
| OPS-07 | Automation replays a past event | No unintended repeated notification or action |
| REG-01 | Inapplicable driver rule | Not treated as missing/non-compliant |
| REG-02 | Rule effective date changed | Correct version applied; historical decision traceable |
| REG-03 | Unverified rule | No legal determination; review state exposed |
| PRIV-01 | Bulk export by unauthorized user | Blocked, rate monitored and auditable |
| PRIV-02 | User data deletion under active legal hold | Held, documented; not silently erased |
| OPS-08 | Tenant offboarding | Tokens revoked, data handled per approved policy, other tenants unaffected |
| DR-01 | Database restore drill | Proven measured RPO/RTO, restored evidence relationships |
| DR-02 | Object-store partial restore | Hash validation finds mismatch; no false intact status |
| DEP-01 | Broken migration during rollout | Release blocked/rolled back by documented method |
| DEP-02 | Secrets absent from production | Safe failure, clear alert; no fallback to test secrets |
| UX-01 | Reduced motion, keyboard/screen reader paths | Critical reviews and approvals fully operable |
| UX-02 | Long IDs, multilingual names, zoom | No loss of action labels or evidence context |

## 15.3 Test data strategy

Create a synthetic multi-tenant corpus with:

- Identical names across different client companies.
- Shared driver identity with different historical employer engagements.
- Null identifiers, changed names, malformed dates and conflicting provider IDs.
- Approved and unapproved rule versions, exceptions, branches and permission differences.
- Multiple report product types and fake document content.
- Time zone/DST boundaries, leap dates, delayed webhooks, large queues and failed retries.
- Explicitly synthetic PII formats that cannot be mistaken for real driver information.

Do not use private reports, real license numbers or customer screening results in demos, CI, screenshot fixtures or public documentation.

## 15.4 Performance and load acceptance

Use agreed target datasets and record results. Suggested starting benchmark runs: 10, 100 and 1,000 concurrent queue operations or appropriately scaled workload levels, with tenants ranging from small to large. Select actual load numbers from expected customer use; don't label arbitrary results “enterprise scale.” Measure throughput, latency, database lock contention, storage costs, queue fairness and data correctness under retries.

## 15.5 Independent review

Before external real-data trials, obtain an application security assessment/pentest appropriate to the threat profile, privacy review, and verified regulatory acceptance review. Keep findings, remediation and evidence of retest.

---

# 16. Accessibility and responsible motion delivery

Document 02 owns typography, reduced-motion styling and cinematic/editorial interaction design. This document defines **release criteria**:

- Critical tasks (intake, file view, match, exception, approve, notify, onboarding and integration setup) must work with keyboard and assistive technology.
- Labels and errors must identify what failed, where, and how to recover; never rely on color alone.
- Status updates should use accessible live regions without noisy announcements.
- Dynamic motion cannot obscure an emergency alert, change data meaning, or race user confirmation.
- Respect `prefers-reduced-motion` and disable unnecessary camera-like transitions in operational flows.
- Test viewport 375/768/1024/1440px, 200%+ zoom and real dense data, not only empty-state screenshots.
- Use **WCAG 2.2 AA** as a proposed accessibility evaluation target, verifying current contractual standards where needed.

Security-relevant confirmation (e.g. consent, elevation, wrong-tenant risk) must not be made easier to skip through animation or visual decoration.

---

# 17. Vendor procurement, cost and commercial operations

## 17.1 Third-party selection checklist

For identity provider, storage host, database vendor, transactional messaging, monitoring, malware scanning and future screening APIs, document:

- Product purpose, data categories and geographic data flow.
- Contract/DPA/subprocessor obligations; jurisdiction and permitted use.
- Security assurances appropriate to risk (e.g., relevant independent attestations, not assumed certifications).
- Retention/deletion behavior and incident notification commitments.
- API limits, webhook support, sandbox fidelity, versioning, SLAs, and support process.
- Credential lifecycle, outage behavior, service termination/export path.
- Pricing units: active drivers, storage GB, document processing, emails, API calls, worker compute, observability and support.
- Exit strategy and vendor-lock-in mitigation.

## 17.2 Cost model

Track fixed and usage-sensitive costs per tenant. Candidate variables include:

`monthly cost = fixed platform + DB/storage + bandwidth + workers + mail/SMS + malware scanning + API provider charges + monitoring + human specialist time`.

The business pricing model for self-service versus managed-service subscriptions belongs to product/commercial decisions (Document 01). **Managed work cannot be priced as though all exceptions are automatic.** Forecast manual review, support, regulatory review and incident costs.

## 17.3 Liability and disclosure boundaries

Obtain legal review of customer terms, role assignment, warranties, professional services promises, security exhibits, subprocessor notices, privacy disclosures, service-level terms, audit rights, data portability and termination. Do not use the word “certified” or promise “hands-off legal compliance” without carefully documented and approved scope.

---

# 18. Delivery milestones and evidence required

These milestones extend Document 01's implementation sequence; they are **security/compliance gates**, not a competing feature roadmap.

| Gate | Works delivered | Evidence required to pass |
|---|---|---|
| G0 — Scope & data classification | Business service mode, legal assumptions, data inventory, initial threat model | Signed decisions and explicit synthetic-only boundary |
| G1 — Secure foundations | Auth, tenant/RBAC/ABAC, audit, environments, private storage, CI | Passing cross-tenant and permission tests |
| G2 — Onboarding & document safety | Real companies, branches, invites, roles, quarantine/upload/view | Tested access, malware workflow, data integrity |
| G3 — Intake & review correctness | Provider/mock and manual/CSV intake, matching, exception and approval state | End-to-end verified synthetic journeys and replay safety |
| G4 — Provider/API & communications | Real sandbox credential setup, signed webhooks, client API keys, notifications | Verified sandbox integration, secrets controls, messaging evidence |
| G5 — Regulatory/policy approval | Applicable policies researched, reviewed, versioned, tested | Approved rules register and jurisdiction/customer-specific sign-off |
| G6 — Operational resilience | Observability, runbooks, backups, restore, incident exercises, secure rollout | Recorded restore drill, load test, security review, release evidence |
| G7 — Controlled pilot | Explicitly authorized limited customer trial with restricted access | Trial agreement, data processing terms, support and risk sign-off |
| G8 — General availability | Stable customer onboarding, lifecycle operations and ongoing change control | All blocking defects resolved, signed launch checklist and owner acceptance |

**Gate rule:** Failure at any relevant gate blocks the next higher-risk data exposure, even if the UI or happy-path demo works. Feature coding may continue in synthetic staging while legal/security review proceeds.

## 18.1 Release checklist — no real data without these

- [ ] Product and client/operator roles documented and contractually assigned.
- [ ] Data inventory/classification, permitted purpose and processing locations approved.
- [ ] Current applicable legal/regulatory rules and review owners recorded; no invented universal requirements.
- [ ] Tenant/branch authorization test suite passes, including workers, signed URLs and export.
- [ ] MFA/admin protections, key/secret rotation and access review procedures active.
- [ ] Upload quarantine/malware scanning and safe preview operational.
- [ ] Provider authentication, webhook signature, dedupe and mapping validation tested.
- [ ] Sensitive external messages/approvals use client-approved templates and recipients.
- [ ] Audit events complete and protected; alerting and runbooks tested.
- [ ] Backups and **restore drill** succeed with documented RPO/RTO.
- [ ] Security assessment and relevant remediation accepted.
- [ ] Regulatory claims, notices and employer decision responsibilities legally reviewed.
- [ ] Staging and production are separate; no live data in demo/test assets.
- [ ] Production deployment/rollback exercised and on-call owners assigned.
- [ ] Data retention, deletion/hold, breach response and customer offboarding procedures approved.
- [ ] Customer pilot acceptance and business/legal sign-off recorded.

---

# 19. Codex implementation handoff and repository artifacts

## 19.1 Suggested implementation order for engineering agents

1. Read Documents 01–04 in full and inventory assumptions/contradictions.
2. Create `docs/decisions/` for ADRs, `docs/security/` for threat model and policies, `docs/compliance/` for the rules research register, and `docs/runbooks/` for recovery actions.
3. Define and test an authorization primitive used by APIs, storage and job handlers; write tenant-leak regression tests **before** adding CRUD screens.
4. Implement user/company onboarding, invitation and assignment controls from Document 03.
5. Add secure document intake and evidence-version storage, then screening/provider data intake and review.
6. Add signed sandbox integrations and scoped client API setup; prove secret rotation and idempotent retry.
7. Add notification, automation and approval controls backed by the real lifecycle states in Document 03.
8. Add metrics, incident hooks, backups, restore exercises and end-to-end tests before any real-data pilot.
9. Introduce regulatory rule evaluation **only** through the reviewed catalog, applicability checks and approvals.
10. Apply Document 02 design with separate cinematic moments and efficient daily operations, then verify accessibility and performance.

## 19.2 Repository deliverables

Proposed files (paths are suggestions; adapt to existing structure without creating duplicate sources of truth):

```text
docs/
  architecture/
    system-overview.md
    data-flow-map.md
    deployment-topology.md
  decisions/
    ADR-0001-multi-tenant-auth-boundary.md
    ADR-0002-private-evidence-storage.md
    ADR-0003-integration-adapter-model.md
  compliance/
    REGULATORY_RULES_REGISTER.md
    applicability-matrix.md
    policy-approval-procedure.md
    retention-and-hold-matrix.md
  security/
    data-inventory.md
    threat-model.md
    roles-and-permissions.md
    access-review-runbook.md
    incident-response.md
    privacy-and-subprocessors.md
  runbooks/
    provider-degraded.md
    webhook-replay.md
    wrong-tenant-attachment.md
    notification-misdelivery.md
    database-restore.md
    tenant-offboarding.md
    deployment-rollback.md
  qa/
    release-gates.md
    security-test-matrix.md
    synthetic-test-dataset.md
    load-test-results.md
  operations/
    sla-sli-proposal.md
    monitoring-and-alerts.md
    customer-onboarding-checklist.md
```

## 19.3 Deliverable acceptance format

Every significant Codex implementation task must report:

- Feature behavior implemented and corresponding Document 01 requirement / Document 03 journey.
- Security scope and threat(s) considered under Document 04.
- Actual endpoints, migrations, stored objects and event-state changes.
- Automated tests executed with pass/fail results; **not** “should work.”
- Failure paths verified, including recovery and audit output.
- Any law, service contract, provider API or security control still **unverified**.
- Real integration status labeled `mock`, `sandbox_verified`, `limited_pilot`, or `production_verified`.
- Impact on documentation/ADR/visual design and backward compatibility.

A generated UI, a green TypeScript build, or an example curl response does **not** complete a business workflow. It must work through the authenticated backend and real persistence, and its security behavior must be demonstrably correct.

---

# 20. Open decisions, dependencies and blockers

Before production execution, the product owner must resolve:

| Decision | Why it matters | Default until resolved |
|---|---|---|
| Actual customer segment and jurisdiction | Changes required documents, policies and contracts | Use fictional U.S. examples; no legal claims |
| Service mode and responsible approvers | Determines who performs checks and reserved decisions | Explicit manual approval, no inferred employer authority |
| Regulations and rule interpretations | Statuses/retention depend on precise applicability | Unapproved regulatory engine; no legal qualification decision |
| Screening provider selection and API terms | Real schema, credentials and permissible use | Use controlled mock/sandbox only |
| Data processing roles and regions | Cross-border privacy, hosting, access and vendor selection | Synthetic-only data; no real ingestion |
| Identity provider choice and SSO requirements | Session/MFA/support architecture | Adopt a maintained identity baseline |
| Hosting provider and cost envelope | Region, availability, backup, private worker capability | Comparison/ADR before production |
| Sensitive report visibility per role | PII minimization and customer trust | Restrict by default, explicit approval |
| Authorized communication templates and channels | Misdelivery and contractual risk | No automatic external messaging |
| Evidence retention/disposition | Legal holds, audit integrity and deletion | Preserve synthetic test history; do not guess real retention |
| Final RPO/RTO and support hours | Commercial commitments and reliability architecture | Planning targets only; no SLA promises |
| First real customer onboarding criteria | Determines pilot scope and contractual readiness | No production PII until G0–G7 release gates pass |

---

# 21. Final product quality contract

**QualifyFlow is a real product only when its safety, accuracy and operations hold up under failure.**

An authorized administrator must actually be able to create a client account, invite users, assign the correct access, configure a provider integration and verify its connection. An authorized specialist must be able to receive a result, establish the right employer and driver, quarantine uncertainty, attach reviewed evidence, manage an exception, coordinate an authorized decision and track a notification. The system must preserve source evidence and audit history, avoid cross-tenant disclosure, recover from retries and outages, and explain its own state honestly.

**A technically working workflow is not automatically a legally compliant workflow.** Regulatory claims and customer production processing require the validation and approval gates above.

**Operating principle:** *Build the real capabilities. Verify the rules. Protect the people. Make every important action traceable. Ship only what we can operate safely.*
