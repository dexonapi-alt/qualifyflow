# Connected driver experience

The profile previously showed useful progress but left users to translate status labels into a next action. Activity was a separate summary, and opening a requirement moved away from the personal workspace. ADR-0025 addresses this through the working driver journey.

## Product decisions

- One next useful step, derived from actual requirement and evidence state. Security processing, missing evidence, findings and review are distinct.
- Saved intake/review responsibility is shown beside work. It is not a named assignment or a claim that someone is actively handling a record.
- Requirement details open in a side panel with the existing real upload, scan, review and follow-up controls. The profile remains mounted; confirmed file responses update progress, next action and activity together.
- Recorded events show real identities where supplied, otherwise document identity. A detail panel reveals exact context; raw record details remain available.
- Receipt, security scan and review appear as an evidence processing history with recorded timestamps. No invented progress, legal score or completed stage.
- Empty, restricted, loading, failed and completed states retain their different meanings. Scan refresh failures are visible and retryable.

## Shared implementation

`DetailPanel.tsx` supplies native modal semantics, explicit keyboard wrapping, Escape/backdrop dismissal, focus return, scroll preservation and reduced-motion entry. `requirementExperience.ts` owns guidance/priority and unknown-responsibility wording. `qualificationTypes.ts` shares the existing API shape. `EvidenceJourney.tsx` and `DriverActivity.tsx` present real state. `driver-experience.css` extends current typography, spacing and semantic colors without replacing the design system. No dependency added.

QualificationFile supports an optional requirement filter and an onChanged callback. Its standalone route, historical evidence, source-linked intake context, permission checks and exact requirement navigation remain. Review confirmation now lives outside the form that disappears after a recorded outcome.

## Verification

Before capture: [1440px](driver-experience/before-1440.png). The real upload/scan/review journey passed13 screenshot/axe/reflow checks, keyboard wrapping/focus return, reduced motion, failed upload and summary recovery, and full-file handoff.22 frontend tests passed at that iteration; the current combined frontend suite has24 passing tests. Existing onboarding regression passed before the personal-driver extension. Runner: `frontend/scripts/driver-experience-review.mjs`.

## Limits and remaining work

No assigned person is shown without backend data. Upload events do not expose an uploader identity in the existing file response, so none is inferred. Company responsibility is a team-level configuration. Driver history and evidence activity have separate backend sources; this is a bounded preview, not a new exhaustive audit feed. The inspector pattern is reusable but other request/case queues are not all migrated in this iteration. Milestones and production gates remain open; no legal eligibility determination is introduced. Existing build chunk-size warning remains tracked separately.
