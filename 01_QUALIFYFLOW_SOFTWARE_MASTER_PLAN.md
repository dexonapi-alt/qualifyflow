# QUALIFYFLOW
## 01 — Software Master Plan

**Document status:** Product planning v1.0  
**Date:** 2026-11-16  
**Product category:** Multi-tenant driver qualification compliance operations platform  
**Intended audience:** Product owner, engineering team, prospective operations stakeholders, and implementation agents  
**Related planned documents:** `02_DESIGN_AND_MOTION_SYSTEM.md`, `03_WORKFLOWS_AND_USER_JOURNEYS.md`, `04_SECURITY_COMPLIANCE_AND_DELIVERY.md`

> **Scope and accuracy note:** This is a plan for an independent software product, inspired by the operational responsibilities in a Compliance Data Specialist job posting. It is not an implementation of CrewBloom's or any client's actual private platform. The posting informs our requirements; the precise business configuration, provider integrations, and applicable regulatory rules remain to be confirmed. This document specifies real working software, not a nonfunctional UI prototype. We must not label the product legally compliant or production-ready for sensitive driver data until the appropriate requirements, security controls, and operating procedures have been validated.

---

# 1. Executive product definition

## 1.1 Product in one sentence

**QualifyFlow is a secure, multi-tenant platform that lets compliance service providers and transportation employers organize driver qualification records, process background screening results, resolve exceptions, manage access and integrations, and automate repeatable administrative work—with clear accountability for each action.**

## 1.2 The business problem

A business may have dozens, hundreds, or thousands of drivers and a constant stream of new information: screening results, licenses, qualification documents, corrections, new hires, departures, expiring records, and requests for follow-up. Without reliable processes, teams risk:

- Attaching records to the wrong person, company, or requirement.
- Overlooking missing, expired, or incomplete items.
- Losing track of which party must review or approve an issue.
- Repeating uploads, checks, and client notifications manually.
- Applying one client's rules to another client.
- Lacking a traceable record of what changed, who handled it, and why.
- Accidentally exposing sensitive driver information across client boundaries.

**Our product addresses coordination and accuracy first, automation second.** It must make careful manual review possible, then automate safely where requirements and approvals are well defined.

## 1.3 Two product delivery models

| Model | Who performs routine record administration? | Role of client company |
|---|---|---|
| **Self-service SaaS** | The client company's own staff | Enter data, review records, resolve issues, administer their users |
| **Managed compliance operations** | Authorized specialists employed by the service provider | Provide inputs, review exceptions, approve decisions reserved for the employer, monitor progress |
| **Hybrid** | Responsibilities split by configured workflow | Client and service provider share tasks with explicitly defined ownership |

The same underlying platform powers all three modes. **Mode changes task ownership and access permissions, not the integrity of the underlying data.**

Important: outsourcing administrative work does not, by itself, remove an employer's statutory obligations or authorize the service provider to make restricted decisions.

## 1.4 Product goals

1. Make inbound screening and document intake accurate, traceable, and operationally efficient.
2. Make the relationship between **client company → relevant branch/location → driver → driver-company engagement → qualification requirement → document/evidence** explicit.
3. Support real company account provisioning, user invitations, role-based permissions, and onboarding.
4. Support real provider/API integration configuration—not just an illustrative settings page.
5. Provide actionable queues for missing information, review tasks, and exceptions.
6. Enable controlled, auditable notifications, approvals, and automation.
7. Provide a useful portal for client administrators without forcing them to perform every managed-service task.
8. Be maintainable by a small engineering team and extensible to new screening providers and regulatory rule sets.

## 1.5 Non-goals and boundaries

- We are **not** recreating CrewBloom's undisclosed internal software.
- We are **not** presenting unverified legal logic as authoritative DOT/FMCSA guidance.
- We are **not** automatically deciding a driver's legal eligibility from a report without approved policy and human oversight.
- We are **not** treating a report attached to a file as proof of full compliance.
- We are **not** building a generalized HR/payroll/fleet-management suite in the initial release.
- We are **not** using real driver's PII or medical/screening records in development or public demos.
- We are **not** promising universal external provider integration without provider documentation, contracts, credentials, and sandbox access.

---

# 2. What the job description establishes—and what we infer

## 2.1 Directly supported capabilities

The job description explicitly mentions these responsibilities:

- Move background screening results, driver records, and supporting data into a compliance platform; verify accuracy during transfer.
- Assign documents to the correct driver files and requirements.
- Flag missing, expired, incomplete, or potentially non-compliant items.
- Notify, correspond, escalate, and obtain approvals following each client's processes.
- Set up accounts, users, and APIs with client-specific configurations.
- Identify repeatable work and notification gaps; collaborate on automation.
- Maintain a managed, relatively hands-off service experience for clients.

Each must have a corresponding functional capability in QualifyFlow.

## 2.2 Product assumptions to validate

The following are sensible **design assumptions**, not confirmed facts about the hiring company's software:

- One platform operator may serve multiple transportation companies.
- Each transportation company may have multiple locations, divisions, or branches.
- There are different platform roles for managed operations staff and client staff.
- Screening providers may deliver structured records, PDFs, file exports, or API/webhook events.
- Some client companies want self-service, others managed service, and some a hybrid.
- The provider's customer may be a carrier/employer that retains responsibility for certain qualification decisions.

Build these as configurable concepts, not one-off hard-coded assumptions.

---

# 3. Users, tenancy, and responsibility model

## 3.1 User personas

| Persona | What they need to accomplish | Primary interface |
|---|---|---|
| **Platform owner / super-admin** | Manage the SaaS service, product configurations, provider capabilities, and authorized operator accounts | Platform administration |
| **Service-provider administrator** | Onboard clients, assign specialists, configure service packages and workflows | Operations console |
| **Compliance Data Specialist** | Process reports, verify records, resolve exceptions, document actions, send approved follow-ups | Operations console |
| **Compliance team lead / reviewer** | Review difficult exceptions, oversee queues, manage escalations and quality | Operations console |
| **Client company administrator** | Manage company users, submit information, authorize configurations, review requests and reports | Client portal |
| **Client contributor** | Upload documents, update allowed driver details, respond to requests | Client portal |
| **Client read-only/auditor user** | View only explicitly authorized records and history | Client portal |
| **Driver / applicant (future, optional)** | Submit permitted personal documents or respond to requests through a limited secure flow | Separate driver portal, later |

**A driver profile is not inherently a login account.** Keep driver identities separate from authenticated platform users.

## 3.2 Multi-tenant model

- **Platform operator:** QualifyFlow company / service operator.
- **Client tenant:** An employer/carrier using the service.
- **Branch/location:** Optional organization unit under the tenant; not necessarily a separately billable client.
- **Driver identity:** A sensitive person record, linked to applicable client-company engagements, with authorization boundaries.
- **Assignments:** Authorized specialist-to-tenant relationships specifying who may service which client.

Never use only a visible customer name or branch name as an identifier. Every object has a stable ID. Drivers may have historical or concurrent company relationships; the data model must not assume one permanent employer.

## 3.3 Access-control principles

1. Deny access by default; evaluate permissions on the server for every read/write/action.
2. A client user may access only explicitly authorized data within their tenant and branch scope.
3. A service-provider specialist may access only tenants assigned to them, at the appropriate role level.
4. Platform super-admin access to sensitive data should be exceptional, scoped, logged, and justified—not an unrestricted convenience view.
5. Tenant context must be determined from authenticated authorization, never trusted from a user-supplied `tenant_id` alone.
6. High-impact changes and sensitive exports should have explicit authorization and audit events.
7. Use PostgreSQL Row Level Security where practical as defense-in-depth, alongside backend permission checks and tests.

## 3.4 Responsibility matrix—managed service example

| Activity | Managed specialist | Client administrator / authorized employer representative |
|---|---|---|
| Process incoming screening result | Processes and verifies | May view outcome / provide clarification |
| Attach documents and label requirement | Performs within approved scope | Can submit and review where permitted |
| Identify missing/expired records | Flags and assigns | Supplies missing evidence / approves next steps |
| Resolve data-entry mismatch | Resolves if authorized; escalates otherwise | Confirms disputed identity / employer-specific facts |
| Make employer-reserved driver decision | **Does not independently decide** | Authorized employer representative makes decision |
| Create new company account | Onboarding admin | Supplies company details / authorization |
| Invite client users | Supports within permissions | Approves/manages own users where authorized |
| Configure external API | Technical admin performs setup | Approves provider access and scope |
| Define notification procedures | Implements approved process | Defines or approves client communication policy |

Detailed task routing and SLAs belong in Document 03.

---

# 4. Product areas and functional requirements

## 4.1 A. Client onboarding and organization management — **core**

**Capabilities**

- Create a client-company tenant with legal/display name, internal client ID, service mode, status, designated contacts, and timezone.
- Add, edit, archive, and reassign branches/locations and organizational units.
- Store onboarding checklist, effective date, service scope, owner, and required configurations.
- Assign a service team and named primary specialist to a client.
- Configure who can perform intake, approve changes, receive alerts, and see reports.
- Suspend/deactivate tenants safely; no accidental data deletion.
- Preserve client configuration change history.

**Acceptance criteria**

- An authorized service admin can create a new client without writing database scripts.
- New tenant records are inaccessible to every other client by default.
- Branches are children of their legal/company tenant, unless explicitly modeled otherwise.
- Client onboarding cannot be marked complete while mandatory configuration prerequisites are missing.

## 4.2 B. Identity, accounts, invitations, and roles — **core**

**Capabilities**

- Real authentication and password reset (or a trusted identity provider); MFA for privileged roles.
- Email invitations with expiry, resend, revoke, and single-use acceptance.
- Client admins can manage users only within their permitted organization scope.
- Platform/admin roles, specialist roles, reviewer roles, and narrowly scoped client roles.
- Branch-specific or organization-wide user grants where required.
- Deactivate access, revoke sessions, rotate credentials, and review membership history.
- Log permission changes and sensitive user-administration actions.

**Acceptance criteria**

- An authenticated user cannot escalate their own permissions via UI or API manipulation.
- Tenant A credentials cannot reveal Tenant B drivers or files, even when using known record IDs.
- Revoked users lose access promptly, without deleting their prior audit footprint.

## 4.3 C. Driver registry and employer relationships — **core**

**Capabilities**

- Create, find, update, and archive driver profiles with minimal necessary personal data.
- Model driver-to-client-company engagement, branch, employment status, and relevant dates.
- Avoid duplicates through trusted identifiers plus manual review when ambiguous.
- Support reassignment or historical employment links without overwriting history.
- Show a driver profile's current requirements, evidence, incoming reports, exceptions, and action history.
- Handle identity corrections as reviewed changes with audit history.

**Acceptance criteria**

- A driver with a similar name cannot be silently matched to the wrong file.
- Current and historical company associations remain interpretable after transfers.
- Authorized users can answer: “Which employer and requirement does this record belong to?”

## 4.4 D. Screening intake and matching — **highest day-to-day priority**

**Capabilities**

- Intake from manual upload, CSV/batch import, configured provider API, webhook, and internal manual entry.
- Inbound inbox/queue with source, arrival timestamp, provider reference, correlation ID, and processing status.
- Identify intended tenant and driver using verified identifiers and contextual evidence.
- Validate document type, expected schema, important dates, completeness, duplication, and allowed file type.
- Put unmatched, ambiguous, or incomplete items into a review queue; do not auto-attach by name alone.
- Provide side-by-side comparison of incoming data and existing driver/profile data.
- Make reviewed decisions: attach, reject, request information, reassign with authorization, or escalate.
- Preserve raw source and parsed/normalized form separately for traceability.
- Batch operations with per-item result, rejection reason, and safe retry.

**Acceptance criteria**

- Duplicate webhook or batch submissions are idempotent; do not create duplicate accepted results.
- Failed items are visible and recoverable; one bad file does not silently discard an entire batch.
- Every accepted attachment has a source, driver link, requirement link, decision-maker, and timestamp.
- Every uncertain match requires an authorized review before it affects a driver's qualification file.

## 4.5 E. Qualification requirements and document management — **core**

**Capabilities**

- Configure requirement templates, applicability conditions, document types, and review rules.
- Maintain per-driver requirement instances with expected evidence and due/expiry dates when applicable.
- Upload, classify, view securely, version, replace, and annotate documents without destroying evidence history.
- Track statuses such as `missing`, `submitted`, `needs_review`, `verified`, `expired`, `rejected`, and `not_applicable` **as operational states, not legal conclusions**.
- Store provenance, verification notes, reviewer, timestamps, and policy/rule version associated with review.
- Flag mismatched names, missing pages, invalid date patterns, or missing metadata for review.
- Make file search/filtering fast enough for specialist queues.
- Apply per-document retention/hold policies only after legal review.

**Acceptance criteria**

- Files cannot be accessed across tenants or through a leaked guessable public URL.
- Replacing a document records a new version rather than erasing the earlier decision history.
- The system can explain why an item is flagged and which configured rule generated the flag.

## 4.6 F. Exceptions, tasks, approvals, and follow-ups — **core**

**Capabilities**

- Create an exception from validation failure, missing record, expiration, unresolved match, provider error, or manual specialist action.
- Assign severity/priority, tenant, driver, relevant requirement, owner, deadline, and reason.
- Track `open → in_review → awaiting_client → resolved / closed` with explicit transition rules.
- Support client-specific escalation, approval routing, comments, and attachments.
- Allow manual override only by authorized roles, with reason and review trail.
- Differentiate administrative resolution from legal qualification decisions.
- Show staff queues by client, due date, exception type, and assignee.

**Acceptance criteria**

- An exception has exactly one current state, a visible owner or unassigned queue, and full transition history.
- Client-specific approval requirements cannot be bypassed by a general operator account.
- Closing an exception does not silently alter underlying source evidence.

## 4.7 G. Notifications and client communications — **core**

**Capabilities**

- Client-configurable, approved communication rules: recipients, channels, triggers, cadence, escalation path, and templates.
- In-app notification center for operators and clients.
- Outbound email service; other channels only after integration and consent requirements are understood.
- Template variables with safe escaping and controlled PII exposure.
- Draft/approval mode for high-sensitivity notices; automated mode only for approved categories.
- Delivery history, correlation to task/exception, send failures, retries, and suppression rules.
- Avoid duplicate notifications through idempotency and notification windows.

**Acceptance criteria**

- Wrong-tenant recipients cannot be selected or sent sensitive driver data.
- A failed notification is visible and actionable; it is not reported as delivered.
- The system records the approved rule/template version used for each send.

## 4.8 H. Integration and API management — **core, not a decorative feature**

**Capabilities**

- Provider integration catalog with a clear distinction between **available connector**, **configured connection**, **verified sandbox**, and **active production connection**.
- Create a client-scoped connection with endpoint/environment, provider account reference, authorized scopes, credential secret reference, mapping config, and synchronization options.
- Securely save and rotate provider credentials; mask secret values in UI and logs.
- Test connection with an actual provider endpoint where legitimate sandbox credentials exist.
- Receive authenticated/signed webhook events; validate signatures and replay protection.
- Map incoming fields to canonical screening/document models, with transformation previews and validation outcomes.
- Inbound/outbound status, job/run history, per-record errors, retries/backoff, rate-limit handling, dead-letter review.
- Idempotent writes and stable external IDs for provider and driver records.
- API keys/service accounts for supported customer integrations, with scopes, rotation, revocation, and usage logs.
- Documented developer API and webhook contracts for external client systems.

**Initial integration strategy**

1. Ship a **functional generic provider simulator and local sandbox API** that exercises the real adapter contract.
2. Build one adapter against a real third-party provider's **legitimate sandbox**, after documentation/access are obtained.
3. Treat additional providers as separate adapters with explicit mapping tests and operational runbooks.

**Acceptance criteria**

- Client A's connection cannot be used to write to Client B's records.
- A connection test reports actual outcome, not “Connected” just because an API key was saved.
- A malformed or duplicate webhook cannot corrupt or duplicate accepted driver records.
- An operator can locate, understand, and retry failed sync runs without editing source code.

## 4.9 I. Automation and scheduling — **core infrastructure, phased capabilities**

**Capabilities**

- Background job execution for recurring expiration review, intake processing, retries, and notification delivery.
- Rule triggers (`document_submitted`, `requirement_missing`, `expires_soon`, `provider_import_failed`, `approval_due`, etc.).
- Client- and policy-scoped workflow configuration with preview/test modes.
- Explicit human-review gates where outcome affects eligibility or involves ambiguity.
- Dry runs, rate limits, deduplication, idempotency keys, dead-letter queue, and safe replay.
- Audit which rules executed, which objects were affected, and why.
- Graceful disable/pause per tenant or integration.

**Acceptance criteria**

- Re-running a failed job does not send duplicate customer notices or create duplicate files.
- Automation cannot bypass tenancy, role policy, or required approval.
- Critical failures create actionable operations tasks or alerts.

## 4.10 J. Operations and client reporting — **core**

**Operations console:** intake backlog; unassigned exceptions; approaching deadlines; processing throughput; failed connections; active onboarding; assigned clients.  
**Client portal:** records needing attention; driver-by-driver requirement summary; requested submissions/approvals; notification and action history; permission-scoped export.  
**Reports:** exception aging, processing volumes, completeness-by-configured-rule, overdue follow-ups, and integration performance.

Show operational measures with precise definitions. Avoid a universal “compliance percentage” that incorrectly implies legal qualification.

## 4.11 K. Audit history and evidence — **core foundation**

Every important mutation should be attributable to an actor (person or system), authorized tenant, action, affected entity, timestamp, previous/new state when appropriate, reason, and correlation ID. Protect audit data against ordinary user edits/deletes. Support retention controls and review/export subject to authorization.

---

# 5. Core data model (conceptual)

The first migration design should support these domain entities. This is not yet a final physical schema.

| Entity | Purpose / important relationships |
|---|---|
| `tenants` | Client companies with service mode, status, configuration |
| `branches` | Optional tenant-owned locations/divisions |
| `users` | Authenticated platform users (not driver identities) |
| `memberships` / `role_grants` | User roles, tenant/branch scope, permissions |
| `operator_assignments` | Which service staff may serve which client |
| `driver_identities` | Protected personal identity records |
| `driver_engagements` | Driver association with a client, branch, relevant dates, status |
| `qualification_policy_versions` | Versioned requirements and client applicability configuration |
| `requirement_instances` | Requirements applicable to a particular driver engagement |
| `documents` / `document_versions` | Metadata, immutable uploaded evidence references, review history |
| `screening_providers` | Catalog of supported external providers |
| `provider_connections` | Tenant-scoped, environment-specific connection configuration |
| `integration_runs` / `integration_events` | External imports, webhook events, errors, retries |
| `intake_items` | Incoming report/file, source, matching and validation state |
| `screening_results` | Normalized provider outcomes with links to source/evidence |
| `document_reviews` | Specialist review outcomes, rationale, policy version |
| `exceptions` / `tasks` | Actionable failures, missing items, escalations, assignments |
| `approval_requests` | Controlled client/provider review decisions |
| `notification_policies` / `messages` | Approved communication rules and delivery history |
| `automation_rules` / `job_runs` | Scheduled/event-driven actions and execution evidence |
| `audit_events` | Append-oriented user/system activity and security audit |
| `export_jobs` | Sensitive data export requests, progress, authorization and trace |

## 5.1 Modeling rules

- Every tenant-owned data row is tenant-scoped, either directly or via a provably authorized relation; design queries and indexes accordingly.
- Distinguish **person identity** from **employer engagement** and from **a particular incoming screening report**.
- Distinguish **requirement definition**, **requirement applicable to this driver**, **document evidence**, and **review decision**.
- Preserve raw source, normalized record, and attached document as separate concepts.
- Preserve historical versions instead of overwriting evidence in place.
- Use UUIDs or comparable non-guessable identifiers for external/public references; never use identifiers as a substitute for authorization.
- Avoid storing unneeded high-risk identifiers; where necessary, segregate and encrypt them.
- Support branch hierarchy without silently creating a new tenant for each branch.
- Keep transaction boundaries explicit for attach/update/audit state changes.

## 5.2 Example entity relationships

```text
Platform operator
  ├── Service team / operator assignments
  └── Client tenants
       ├── Branches
       ├── User memberships and roles
       ├── Provider connections
       ├── Driver engagements ── Driver identities
       │     ├── Requirement instances ── Policy version
       │     │     └── Evidence documents ── Document versions
       │     ├── Screening results ── Intake item / source event
       │     └── Exceptions / tasks / reviews
       ├── Notification policies / messages
       └── Automation runs / audit events
```

---

# 6. Proposed technical architecture

## 6.1 Architectural strategy

**Start as a modular monolith with an independent background worker**, not premature microservices. Keep hard boundaries between domains so they can be separated later if scale or team ownership demands it.

```text
Browser (operations console + client portal)
        │ HTTPS, authenticated requests
        ▼
React + TypeScript application
        │ REST/typed API client
        ▼
FastAPI backend (modular monolith)
  ├─ Identity / memberships / authorization
  ├─ Client onboarding and branches
  ├─ Driver registry / qualification documents
  ├─ Screening intake / matching / exception queue
  ├─ Provider integration configuration / APIs
  ├─ Notifications / automation / reporting
  └─ Audit and reporting services
        │               │               │
        ▼               ▼               ▼
PostgreSQL         Private object     Redis / durable
transactional DB  storage            job queue + worker
                        ▲                    │
                        └─ uploaded files    └─ scheduled jobs, retries

External screening providers -> authenticated webhook / polling adapters
Outbound notifications      -> approved email provider
```

## 6.2 Chosen baseline stack

| Layer | Initial choice | Reason |
|---|---|---|
| Web frontend | React + TypeScript | Familiar stack; scalable components and typed data access |
| UI tooling | Accessible component primitives + Tailwind or scoped CSS | Design system can be expressive without inheriting generic dashboard styling |
| API | FastAPI + Python | Integrations, validation, operational scripting |
| Data access | SQLAlchemy 2 / Alembic | Explicit models, transactional operations, migrations |
| Database | PostgreSQL | Strong relational integrity, tenant scoping, indexes, transactions |
| Queue/worker | Redis + RQ/Celery or equivalent | Retriable intake, scheduled checks, notification jobs |
| Documents | Private S3-compatible object storage | Secure file storage outside application server filesystem |
| Identity | Trusted auth provider or carefully implemented standard auth | MFA, sessions, invite lifecycle, security maintenance |
| Email | Transactional email provider | Invite links and approved operational notifications |
| Observability | Structured logs, error tracking, metrics, tracing | Explain failed imports and timeouts |
| Development | Docker Compose, pytest, TypeScript tests | Reproducible local environment and automated validation |
| Hosting candidate | GCP Cloud Run + Cloud SQL + private object storage | Matches engineering experience; final cloud choice remains an ADR |

**Deployment architecture is a proposal, not a requirement imposed by the hiring company.** Avoid storing uploaded reports in publicly accessible object buckets. Do not expose Redis or PostgreSQL directly to the internet.

## 6.3 Module boundaries

Suggested backend packages:

```text
app/
  auth/
  organizations/
  drivers/
  qualification/
  documents/
  screening_intake/
  exceptions/
  approvals/
  integrations/
    provider_adapters/
  notifications/
  automations/
  audit/
  reporting/
  shared/
```

Separate domain services from API routes and database persistence. Use typed schemas for input, command validation, and output. Keep policy and external provider transforms versionable and testable.

## 6.4 API design principles

- Version REST endpoints under `/api/v1`.
- Derive tenant access from the authenticated session and approved context switch; validate every resource relation.
- Require idempotency on externally retried writes (webhook, batch import, provider sync).
- Provide consistent pagination, filtering, error codes, and a correlation ID.
- Use explicit state-change operations (approve, resolve, attach, reject) instead of unrestricted document updates.
- Expose integration health, recent sync runs, and actionable errors to authorized administrators.
- Document API endpoints with OpenAPI, examples, permission rules, and versioning expectations.
- Use secure direct-to-object-store uploads with server-issued short-lived authorization where appropriate.

## 6.5 Reliability and correctness principles

- Prioritize data correctness over optimistic automation.
- Queue and retry transient provider failures; never silently lose failed work.
- Partial batch success must produce a per-record result and a clear recovery path.
- Operations must be resumable after worker restarts and network failure.
- Only permit terminal status transitions via authenticated, audited operations.
- Make customer notification delivery observable, retryable, and deduplicated.
- Use integration test fixtures for out-of-order events, duplicates, stale reports, and wrong-tenant IDs.

---

# 7. Security, privacy, and regulatory baseline

This document establishes architectural requirements; Document 04 will define detailed security controls, legal-rule verification, QA, release gates, and operations.

## 7.1 Minimum design requirements

- TLS everywhere, encrypted backups, encryption at rest for data and document objects.
- Least-privilege role design and tenant isolation verified through automated tests.
- No sensitive tokens or driver PII in URLs, source control, analytics payloads, error logs, or public demos.
- Secret manager / encrypted secret references for provider API keys; rotation and revocation.
- Private file storage with scoped, short-lived access; file-type checking and malware scanning.
- Sensitive document download/export authorization, rate limiting, and auditing.
- MFA for privileged/admin users, secure session handling, and account recovery.
- Retention/hold/deletion rules per verified document class; support legal review before destructive changes.
- Incident response procedures, regular backups, restore verification, and monitoring.
- Use synthetic driver data during development and demonstrations.

## 7.2 Legal/compliance caution

The job posting mentions **DOT/FMCSA Driver Qualification Files and 49 CFR Part 391** as preferred knowledge. The actual required evidence, exceptions, renewal timelines, retention periods, and employer obligations can vary by applicable regulation, driver and vehicle context, and current rules. Before enabling production claims or automatic legal classifications:

1. Verify authoritative regulations and agency guidance applicable to the target customers.
2. Have the requirements and review logic assessed by appropriately qualified compliance/legal stakeholders.
3. Version the rule set, effective dates, exceptions, and review history.
4. Distinguish **operational document status** from **regulatory determination**.
5. Preserve the ability for authorized humans to review and override a rule with documented rationale.

Also assess obligations around background screening and personal data handling (including any applicable FCRA, state privacy, contractual, and data security requirements) with qualified professionals before actual service delivery.

---

# 8. Operating experiences and navigation (functional, not visual design)

**Two distinct product surfaces** share the same API and authorization model:

### Operations console

- Assigned clients
- Screening intake queue
- Driver lookup
- Qualification files and reviews
- Exceptions / approvals / follow-ups
- Company onboarding / branches
- Integration settings and sync diagnostics
- Notification rules and delivery log
- Audit trail / reporting

### Client portal

- Driver roster / current record requests
- Qualification document submissions and authorized review
- Requests awaiting client action
- Approvals reserved for client-authorized representatives
- Company users and access (if permitted)
- Account / integration authorization settings
- Reports and communication history

Avoid building a third redundant portal unless a separate driver-facing experience demonstrates real business value.

The visual system, motion language, typography, and editorial composition principles are defined **only in Document 02**. Document 01 requires usability and accessibility but does not prescribe card layouts, dashboards, or colors.

---

# 9. Implementation strategy: production-intent vertical slices

We should not implement eleven disconnected screens and call it a product. Each slice must work end-to-end, include permission checks, auditability, error handling, and tests.

## Milestone 0 — Domain validation and foundations

**Deliverables**
- Requirements traceability matrix from JD to product capability.
- Explicit assumptions and unresolved compliance-rule questions.
- Architecture decision records (ADR) for hosting, identity, storage, tenant authorization, queue.
- Repository structure, local Docker Compose, CI checks, migrations, seed data.
- Synthetic organizations, drivers, and provider event fixtures.

**Exit:** clean bootstrap, automated tests run, and environment can be recreated by a new developer.

## Milestone 1 — Tenant onboarding + accounts + permissions

**Deliverables**
- Platform admin creates company and branch.
- Client admin invited, accepts account, manages authorized users.
- Specialist assigned to client.
- Backend RBAC / tenant isolation and audit events.

**Exit:** two client companies can coexist with tested cross-tenant access denial.

## Milestone 2 — Driver registry + document management

**Deliverables**
- Create drivers and employer engagements.
- Upload private document, classify it, attach a requirement and version.
- Review statuses and audit history.
- File access security and lifecycle handling.

**Exit:** an authorized user can add evidence to the right driver while an unauthorized user cannot read or download it.

## Milestone 3 — Real screening intake + exception lifecycle

**Deliverables**
- Manual and CSV intake with validation.
- Generic screening-provider sandbox adapter and inbound webhook/API intake.
- Match/review/attach/reject flow.
- Durable exception/task creation and resolution.
- Idempotent processing, per-item errors, safe reprocessing.

**Exit:** a mixed batch with valid, ambiguous, and invalid records results in correct attachments and visible actionable exceptions; retries are safe.

## Milestone 4 — Client communication + approval routing

**Deliverables**
- Client-specific notification templates and recipient configuration.
- In-app queue, transactional email, delivery logs.
- Review/approval requests and human sign-off where required.
- Missing/expired item follow-up lifecycle.

**Exit:** the platform can create an exception, route it to the right stakeholder, capture a decision, notify approved recipients, and audit the result.

## Milestone 5 — Integration management + repeatable automation

**Deliverables**
- Admin UI for provider connections, credential references, and connection tests.
- Verified provider adapter in sandbox, plus generic adapter contract.
- Scheduled sync/check worker, retries/backoff, dead letters, run logs.
- Tenant-specific automation with dry run, pause, manual approval where appropriate.

**Exit:** a configured provider can deliver a new record through an actual sandbox path and an authorized operator can troubleshoot a failure from the console.

## Milestone 6 — Commercial/operational hardening

**Deliverables**
- Load and concurrency testing; observability and operational alerts.
- Backup/restore drills and incident response procedures.
- Security review, dependency review, penetration test as appropriate.
- Retention/access/export policies; compliance-rule review and sign-off.
- Support runbooks, training, client onboarding documentation.
- Pilot rollout and defined support responsibilities.

**Exit:** approved pilot-ready release for a constrained use case, with explicit legal/security signoffs and rollback plan. Not an automatic declaration of certification.

---

# 10. Quality attributes and acceptance targets

Actual SLAs and scale targets must be set with pilot customers. Until then, use these design requirements rather than inventing contractual metrics.

| Quality | Required behavior | How to verify |
|---|---|---|
| Correctness | Never silently attach ambiguous incoming records | Matching tests; manual-review queue tests |
| Tenant isolation | No cross-tenant data access through API, files, exports, or job processing | Authorization regression and adversarial tests |
| Auditing | Important mutations are attributable and reconstructable | Audit fixture assertions and review exports |
| Reliability | Failed ingestion or messages remain visible and retryable | Worker crash/retry tests, error injection |
| Security | Secrets and sensitive data protected in transit, storage and logs | Threat model, scanning, access tests |
| Performance | Routine lookups and queues remain usable at target client scale | Synthetic load tests and indexed query inspection |
| Accessibility | Keyboard, screen reader and readable-status support | Automated + manual accessibility review |
| Operability | Staff can identify failed connections/jobs without developers | Support-playbook exercise |
| Maintainability | Providers, policy rules and workflow actions extend without rewrites | Adapter contract tests, module ownership |
| Portability | Local + staging environments are reproducible | CI bootstrap and migration rehearsals |

**Core test suites:** unit tests, API integration tests, role/tenant security tests, import parser fixtures, provider adapter contract tests, end-to-end user journeys, document download tests, job retry/idempotency tests, and database migration tests.

---

# 11. Product success metrics (definitions first)

Track metrics only where collection is safe, relevant, and accurately defined:

- **Intake volume:** reports received by source, tenant, and date.
- **First-pass matching rate:** percentage matched to a driver without human correction; not inherently a quality score on its own.
- **Processing cycle time:** received → accepted/rejected/reviewed, excluding or separately identifying client-wait time.
- **Exception backlog and aging:** count of open issues by reason and responsible party.
- **Rework rate:** reports requiring correction or reassignment after initial processing.
- **Duplicate import prevention:** idempotent retries recognized vs duplicates created.
- **Notification reliability:** attempted, delivered, failed, suppressed; not just “sent.”
- **Integration health:** successful syncs, retry counts, provider failure categories.
- **Client workload:** which tasks are handled by specialists vs client administrators.
- **Audit completeness:** percentage of material state changes with required actor and rationale fields.

Do not optimize only for higher automation or faster acceptance if doing so increases wrongful record matches or unreviewed decisions.

---

# 12. Product decisions to make before coding certain features

| Decision | Current proposal | Needs confirmation from |
|---|---|---|
| Primary buyers | Compliance service providers and/or transportation employers | Product discovery |
| Service models | Self-service, managed, hybrid per tenant | Pilot customer needs |
| Tenant hierarchy | Company + optional branches | Real organization examples |
| Driver identity | Separate identity from employment engagement | Legal/privacy and data model review |
| Authentication | Managed identity provider with MFA | Security architecture |
| First external provider | Generic functional sandbox, then contracted real sandbox | Provider access and docs |
| First document categories | Configurable generic evidence types, then verified DQF rules | Compliance reviewer |
| Data retention | Per-class configurable policy, default protect/no destructive purge | Legal and client contracts |
| Where to host | GCP-oriented modular architecture candidate | Costs, residency, contracts |
| Notifications | In-app + transactional email; other channels later | Client approval and consent |
| Rule engine | Versioned, human-review-aware rules rather than hardcoded final eligibility | Compliance owner |
| Billing | Keep service-mode/billing fields ready; build invoicing only after pilot demand | Commercial planning |

---

# 13. Requirements traceability to the original job description

| Job-description responsibility | QualifyFlow product capability |
|---|---|
| Move screening results and supporting data | Screening intake, batch import, provider adapters, review queue |
| Verify data integrity | Matching rules, required-field validation, audit and reconciliation |
| Assign documents to driver files and requirements | Driver engagement, requirement instance, document classification/versioning |
| Flag missing, expired, incomplete, non-compliant items | Requirements engine, operational flags, exception queue, human review |
| Correspond and escalate following client processes | Tenant-scoped communication rules, assignments, approval routing, delivery log |
| Set up accounts, users, APIs | Tenant onboarding, invitations, RBAC, integration management, sandbox tests |
| Identify repetitive tasks and notification gaps | Operations analytics, exception trends, automation suggestion backlog |
| Partner with Product/Development to automate | Versioned automation rules, worker execution, QA and operations review |
| Maintain confidentiality | Least privilege, tenant isolation, private document storage, protected audit |
| Process high-volume repetitive work consistently | Batch validation, partial results, retries, queues, measurable throughput |

---

# 14. Document split: avoid mixing planning contexts

This is **File 01: Software Master Plan**—the product's *what*, *why*, *who*, *major capabilities*, and *architecture*.

### File 02 — Theme, Visual Identity & Motion Design

Owns: editorial white-space philosophy, visual hierarchy, typography, color system, kinetic/motion principles, transitions, sound/interaction rhythm, layouts by product surface, accessibility, component styling, and explicit anti-patterns (no generic AI dashboard/card spam).

### File 03 — Workflows & User Journeys

Owns: granular onboarding, driver registration, report intake, matching, document review, missing/expired exception handling, approvals, notification timelines, API setup, retries, automation, permissions by action, happy paths, failure paths, state machines, and sequence diagrams.

### File 04 — Security, Regulatory Research, QA & Delivery

Owns: verified rule sources and legal review process; DQF applicability and document/retention rule definitions; PII threat model; detailed access control/security controls; data protection; infrastructure and CI/CD; testing strategy; observability; incident response; release checklist; pilot readiness; roadmap estimates and runbooks.

**Rule:** Do not move detailed workflows, graphic art direction, or unverified regulatory rule tables into File 01. Refer to the dedicated document instead.

---

# 15. Definition of “real product”—our engineering contract

QualifyFlow is **not complete** because a dashboard renders, a sidebar has eleven entries, or an animation looks impressive.

A feature is complete only when:

1. An authorized user can perform its real action through the application.
2. The backend checks authorization and validates inputs.
3. Data persists correctly and remains tenant-isolated.
4. Failure cases produce actionable errors and safe recovery.
5. Sensitive actions are audited with sufficient context.
6. Automated tests cover business rules and security boundaries.
7. Documentation explains user intent, permissions, and operational behavior.
8. The production build has been exercised with realistic synthetic data.
9. External integrations are identified accurately as mock, sandbox-verified, or live.
10. The feature does not assert regulatory conclusions without validated policies and approval.

**Product principle:** *Make the operations work reliably; make the software elegant; make every important decision traceable.*
