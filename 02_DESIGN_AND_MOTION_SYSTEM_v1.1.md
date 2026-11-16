# QUALIFYFLOW
## 02 — Theme, Visual Identity & Motion Design System

**Document status:** Design specification v1.1 — Codex reference integration clarified  
**Date:** 2026-11-17  
**Product:** QualifyFlow — Managed Driver Qualification & Compliance Platform  
**Audience:** Product design, frontend engineering, Codex agents, and design QA  
**Depends on:** `01_QUALIFYFLOW_SOFTWARE_MASTER_PLAN.md`  
**Related planned documents:** `03_WORKFLOWS_AND_USER_JOURNEYS.md`, `04_SECURITY_COMPLIANCE_AND_DELIVERY.md`

> **Design mandate:** Build a recognizable, exceptionally well-directed product—not a generic AI-generated SaaS dashboard. Translate the strengths of premium motion-graphics films and minimalist editorial presentations into a usable enterprise workflow system: bold hierarchy, deliberate white space, meaningful movement, strong typography, and sharply focused visual moments. **Operational accuracy, clarity, accessibility, privacy, and speed take priority over spectacle.**
>
> **Scope:** This document owns visual identity, experience principles, layout conventions, motion, interaction styling, data presentation, responsive behavior, design tokens, and implementation/QA standards. It does **not** redefine the business model, database, permissions, regulatory rules, state machines, or release policies. Those belong to Documents 01, 03, and 04.

---

# 1. Creative direction: Evidence in Motion

## 1.1 What we want people to feel

QualifyFlow should feel like a **premium operational instrument**: calm, trustworthy, modern, precise, and quietly powerful. Think the restraint of a well-designed editorial publication, the hierarchy of a world-class keynote, and the choreography of high-end kinetic typography—adapted for someone processing sensitive records all day.

The visual idea is **Evidence in Motion**:

- **Evidence:** Every number, status, document, link, and decision has provenance and context.
- **Focus:** At any moment, one action or question is visually dominant.
- **Flow:** The interface visibly connects source material, verification, decisions, and outcomes.
- **Control:** The user knows what is happening, what is reversible, what is pending, and what requires human judgment.
- **Restraint:** Empty space, stillness, and typography carry meaning; not every surface needs decoration or animation.

**Tagline for internal creative alignment:** *Clarity for every record. Confidence in every action.* This is a proposed direction, not approved marketing copy.

## 1.2 What we explicitly reject

Do not build a generic dashboard characterized by:

- Four equal KPI cards across the top and six more cards underneath, regardless of user task.
- Repeated 2×2 grids of rounded rectangles for every section.
- Giant padded containers surrounding a sentence that could stand on its own.
- An interchangeable sidebar-plus-cards layout on every page.
- Tiny gray labels, gradient blobs, arbitrary icons, AI-style purple/blue glows, and excessive glassmorphism.
- Decorative line charts with invented or unhelpful metrics.
- Every row opening a modal; every action hidden in an ellipsis menu.
- Hero animations playing every time a user visits a working queue.
- Floating 3D objects obscuring document details or active controls.
- Automated transitions that make a user wait to process a record.
- Long paragraphs explaining the interface when the user's task can be shown directly.
- Shimmering skeletons, random counters, particles, or animated compliance percentages for appearance alone.

**Rule:** No component is justified merely because it is popular in a component library. Every container, icon, line, movement, and visual must solve an information or interaction problem.

## 1.3 The guiding contrast

| Presentation / brand moment | Operational / work moment |
|---|---|
| Dramatic scale, cinematic transition, oversize type | Stable spatial layout, quick scanning, clear controls |
| One clear headline, large negative space | Purposeful information density and aligned columns |
| Morphing shapes or shared-element choreography | Subtle state transitions without unnecessary delays |
| Motion expresses the story | Motion confirms the system's state |
| High-end editorial atmosphere | Auditability, exact labels, and user control |

**Never copy a promotional reel into the work console.** Borrow the direction and discipline, not the constant visual stimulation.

---

# 2. Design references and Codex skill integration

## 2.1 What the two design resources actually are

The product owner supplied reference descriptions for both resources. **Their capabilities are now understood, but their actual installed repository files still must be located and read by Codex before use.** A README description is not proof that a particular `DESIGN.md`, command, script, or asset is available at a specific local path.

**`awesome-design-md` is a curated collection of design references, not a single mandatory theme.** It contains site-derived `DESIGN.md` files describing visual atmosphere, semantic colors, typography, components, layout, depth, responsive behavior, and do/don't rules, sometimes paired with `preview.html` and `preview-dark.html`. A project-level `DESIGN.md` defines *how the product should look*; `AGENTS.md` defines *how the coding agent should work*. We may study individual entries for composition and implementation insight, **not paste another company's identity into QualifyFlow**.

**`ui-ux-pro-max-skill` is a design-intelligence workflow that supports Codex CLI, not only Claude Code.** Its published documentation describes industry/style/typography/UX lookups; generated design-system recommendations; stack-specific React guidance; design-token exports; responsive and accessibility checks; and hierarchical master-plus-page overrides. It explicitly documents a Codex installer command (`uipro init --ai codex`) for setups where the skill is not already present. **No installation is required if the usable skill files are already in this repository.** The agent must not install or update dependencies merely to follow this plan without confirming the need and the product owner's approval.

**Codex must, before designing screens:**

1. Locate the actual repository directories/files for `awesome-design-md` and `ui-ux-pro-max-skill`. Inspect their `README`, `SKILL.md`, `DESIGN.md` references, and relevant scripts. Do not assume Claude-only directory paths or that `uipro` is already on `PATH`.
2. For `awesome-design-md`, selectively study **design principles** relevant to our direction: e.g., Apple for white-space discipline, Vercel for typographic precision, IBM for operational information architecture, Linear for interaction density, and WIRED for editorial hierarchy **if those entries are actually present**. Do not merge full borrowed palettes, proprietary typography, or layouts.
3. For UI UX Pro Max, retrieve guidance for **B2B multi-tenant enterprise software, records/document review, permissions, accessible forms, dense tables, and restrained functional motion**. Use available React/TypeScript-specific rules, responsive, accessibility, and UX anti-pattern checks. The library's own generated color/style recommendation is a **candidate to critique**, not permission to replace QualifyFlow's brand.
4. Capture adopted rules, rejected recommendations, provenance, and reasons in `DESIGN_REFERENCES_AND_DECISIONS.md`. Include the actual local source paths or commands used and any compatibility caveats.
5. Inspect the source of third-party scripts before executing them. Prefer local/offline reference data if available; do not import scripts, fonts, imagery, external design tokens, or new dependencies without review.

**Critical distinction:** The repository descriptions supplied by the owner explain what these tools *can* do. Codex still needs to confirm what is actually installed, what it can run, and what assets the local checkout contains.

## 2.2 Precedence for design decisions

1. Security, privacy, correctness, accessibility, and verified business constraints.
2. QualifyFlow's product architecture and responsibilities from Document 01.
3. This document's distinctive brand, editorial, motion, and interaction system.
4. Relevant techniques from the inspected project-local design resources.
5. Existing framework/library defaults only when they genuinely fit.

The goal is not “use the design skills to produce more polished generic dashboards.” It is **use the skills to execute a specific, opinionated art direction with high-quality UX engineering**.

## 2.3 Reference quality without visual copying

Useful creative references: premium Apple-style typography presentations, Swiss editorial composition, restrained enterprise products, sophisticated motion-graphics title sequences, thoughtful data-table software. Study attributes such as composition, timing, typography, contrast, and transition logic; do not clone another product's proprietary branding or UI.

## 2.4 Codex-readable design handoff artifacts

Document 02 remains the **creative specification**. To make it practical and persistent for coding agents, generate these derivative artifacts during frontend foundation work:

| Artifact | Purpose | Authority |
|---|---|---|
| Root `DESIGN.md` | Concise, agent-readable QualifyFlow visual identity, tokens, spacing, typography, motion, and anti-patterns | Derived from this document; must not conflict |
| `design-system/qualifyflow/MASTER.md` | Canonical detailed design-system implementation rules and component states | This document + verified UX constraints |
| `design-system/qualifyflow/tokens.css` and/or `tokens.json` | Actual semantic tokens consumed by code, not just examples | Verified for contrast and runtime behavior |
| `design-system/qualifyflow/preview.html` | Static visual reference showing real type, color, controls, tables, statuses, and accessible interaction states | Must correspond to live CSS tokens |
| `design-system/qualifyflow/pages/*.md` | Sparse, page-specific overrides only when a surface genuinely differs | May override Master layout patterns, never privacy/security rules |
| `DESIGN_REFERENCES_AND_DECISIONS.md` | Traceability: inspected resources, selected guidance, rejections, and why | Documentary record, not override |

These names are recommended output conventions, **not a requirement to run the UI UX Pro Max generator**. If it is available and helpful, Codex may use its master/override and CSS-token export features, reviewing and adapting the generated files. If it is not installed, Codex can author these artifacts directly. Do not create competing sources of truth: resolve any divergence against Document 02 and keep the implementation tokens synchronized.

**Screen-specific guidance (examples):**

- `pages/screening-intake.md`: dense information hierarchy, keyboard review, sticky tenant context, no ceremonial animation.
- `pages/verification-workspace.md`: document/image and structured record side by side, identity proof visible, action-state integrity.
- `pages/client-onboarding.md`: editorial welcome where useful, then straightforward forms, real permissions, and accurate progress.
- `pages/integrations.md`: connection state, credential-safety affordances, sync history, failure details, and explicit test outcomes.
- `pages/client-portal.md`: approachable, accessible document submissions and action-required notices rather than dashboard vanity metrics.

### Example search workflow when the skill scripts exist

Codex should resolve the **actual installed script path first**, then adapt the following query types to the installed version. These are illustrative, not commands that are known to work in this environment:

```bash
python3 PATH_TO_SKILL/scripts/search.py "B2B compliance operations SaaS" --design-system -p "QualifyFlow"
python3 PATH_TO_SKILL/scripts/search.py "error summary validation" --domain ux
python3 PATH_TO_SKILL/scripts/search.py "permissions and enterprise tables" --stack react
```

Compare returned recommendations with the brand tokens and screen-specific interaction goals here. **Reject default card grids, novelty gradients, decorative charts, excessive effects, and any guidance that compromises precision or task speed.**

---

# 3. Brand system

## 3.1 Brand personality

**Primary:** Precise, authoritative, human, confident, composed.  
**Secondary:** Contemporary, intelligently technical, quietly expressive.  
**Avoid:** Playful-for-the-sake-of-playful, childish, alarming, bureaucratically cold, nightclub neon, crypto-dashboard aesthetics.

The user may have learned motion design through a pink-themed educational video, but **QualifyFlow is not a pink-themed first-aid video**. We transfer its **visual discipline**—impact, sequencing, negative space, choreography—not its subject-specific color palette or decoration.

## 3.2 Color philosophy

**Default product theme: light.** A white or warm-white canvas with dark ink typography and disciplined electric-blue emphasis.

Use a small number of semantic colors. Blue is for brand, focus, selected state, primary action, or meaningful interactive emphasis—not for decorating every number. Red, amber, and green indicate specific operational meanings, with accessible text labels. Compliance/legal status must not be inferred from color alone.

### Proposed base palette

| Token | Proposed hex | Use |
|---|---|---|
| `canvas` | `#FFFFFF` | Main surfaces and editorial pages |
| `canvas-soft` | `#F8FAFD` | Subtle shell / alternate background |
| `surface` | `#FFFFFF` | Inputs, panels, overlays when required |
| `ink` | `#12151B` | Primary typography |
| `ink-strong` | `#080B11` | Oversized display type |
| `text-muted` | `#5B6574` | Secondary content; verify contrast |
| `border` | `#DFE5EE` | Quiet structural separation |
| `border-strong` | `#B8C2D0` | Higher-emphasis boundaries |
| `blue-600` | `#265CFF` | Signature action blue; text usage must pass contrast checks |
| `blue-700` | `#1741C8` | High-contrast interactive blue |
| `blue-050` | `#EEF3FF` | Subtle selected surface |
| `blue-100` | `#DAE5FF` | Focused section and detail accent |
| `neutral-900` | `#17202C` | Alternate contrast surface |
| `success-700` | `#027A48` | Verified/complete action, only where accurate |
| `warning-800` | `#865900` | Needs attention / pending review |
| `danger-700` | `#B42318` | Error, destructive action, urgent flag |
| `info-700` | `#175CD3` | Informational and in-progress states |

**Contrast requirement:** Verify actual foreground/background pairs using WCAG AA contrast testing before shipping; these are proposed tokens, not a declaration that every pairing passes. Use darker alternatives for small blue text if necessary. The token names and semantics matter more than preserving exact hexadecimal values.

### Color distribution

- Roughly 80–90% visual field: white, off-white, ink, muted lines.
- Primary blue appears as a purposeful point of attention: one critical number, action, focus marker, or connecting line.
- Semantic status colors appear only when they carry actual state.
- Do not plaster blue pills over every heading, nor use blue as the default color of every KPI.

## 3.3 Optional dark mode

Dark mode is not the initial default and should not delay the usable light experience. If added, build it with real semantic tokens and accessible contrast—not inverted screenshots. The operations console should preserve the same hierarchy and meaning in both themes.

## 3.4 Logo and icon principles

- A conceptual mark might combine a **document/evidence edge**, **checked connection**, and **directional flow**; explore designs rather than deciding from a prompt alone.
- Use a wordmark with generous spacing. Avoid generic shield-with-check as the entire brand identity without exploration.
- Icons must be consistent in stroke, geometry, and optical weight. Lucide-style icons can serve product utility, but are not mandatory for every label.
- The primary identity is typography, composition, and product behavior—not an illustrated mascot.
- Icons are secondary cues; important actions always have readable text labels.

---

# 4. Typography as the primary visual material

## 4.1 Typographic approach

Our original inspiration was high-impact kinetic type: a few memorable words, carefully timed, with strong scale differences. On the web app, apply that to **page titles, state changes, onboarding milestones, empty states, and a small number of signature transitions**.

For operational content, use highly readable typography. Never turn records, dates, identifiers, or exception reasons into oversized artistic text when density and scanning matter more.

### Recommended font strategy

- **Display:** a contemporary, confidently weighted sans such as *Geist* or *Space Grotesk*, subject to actual licensing and availability.
- **UI/body:** *Inter*, *Geist*, or a similar highly legible sans with a full numeric set.
- **Data and identifiers:** tabular numerals; a restrained monospaced variant for correlation IDs, API keys, timestamps, and hashes where useful.
- Prefer self-hosted, licensed font assets or a reliable system stack. Do not load numerous weights or families for visual novelty.

### Type scale: starting points

| Role | Desktop size/line-height | Mobile size/line-height | Notes |
|---|---|---|---|
| Brand hero | `clamp(3.5rem, 7vw, 7.5rem)` / `0.95–1.03` | `clamp(2.7rem, 11vw, 4.2rem)` | Marketing/intro only |
| Page hero | `clamp(2.5rem, 4.5vw, 4.75rem)` / `1.0–1.08` | `2.2–3rem` | One main focal statement |
| Work-page title | `2–2.75rem` / `1.1–1.18` | `1.65–2.1rem` | Consistent page orientation |
| Section title | `1.25–1.625rem` / `1.25` | `1.125–1.375rem` | Functional grouping |
| Body | `0.9375–1rem` / `1.45–1.6` | `1rem` | Avoid tiny enterprise UI |
| Table/body compact | `0.875–0.9375rem` / `1.35–1.5` | `0.9375rem` | Dense but readable |
| Label/meta | `0.75–0.8125rem` / `1.4` | `0.8125rem` | Do not put essential data here |

Use weight, scale, spacing, alignment, and white space first. Avoid solving every hierarchy problem by adding a colored border or a card.

## 4.2 Typesetting rules

- Headlines should be **short, meaningful, and factual**: “18 reports need review,” not “Your compliance operations reimagined.”
- Use sentence case for most operational headings; all caps only for rare short eyebrow labels.
- Keep text width around `55–75ch` for paragraphs; shorter for key points.
- Use compact `ch`-limited form help text and readable line height.
- Use tabular numerals in tables, statuses, dates, and metrics.
- Do not clip names, key document statuses, or record counts purely for aesthetics. Provide truncation + reliable reveal for long IDs.
- Place button verbs first: “Review report,” “Approve request,” “Retry import,” “Invite user.”
- Avoid unexplained acronyms when showing information to client admins; offer inline definitions where useful.

---

# 5. Negative space and information density

## 5.1 White space is not emptiness to fill

White space gives emphasis, creates grouping, and controls cognitive load. In a product, it should clarify tasks rather than waste the specialist's screen.

A full-width page with one oversized phrase can be right for a first-use onboarding moment; the same sparse composition is wrong for a 300-record intake queue. **Use deliberate contrast between cinematic moments and working density.**

## 5.2 Layout density modes

- **Editorial / spacious:** Marketing home, product overview, guided onboarding, selected success milestones.
- **Balanced:** Client portal overview, driver profile, company settings, integration detail.
- **Operational / compact:** Intake queue, exception queue, bulk review, audit history, provider logs.

In each mode, alignment, typographic hierarchy, and edge-to-edge grouping matter more than rounded boxes.

## 5.3 Practical spacing system

Use a base 4px rhythm with purposeful 8px multiples: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.

- Shell gutter: mobile `16–20px`, tablet `24–32px`, wide desktop `40–64px`.
- Work surfaces: dense table cell padding may be `10–16px` vertically and `12–20px` horizontally.
- Page top/bottom breathing room: more generous for editorial views, tighter in task-heavy flows.
- Major groups separated by white space or a hairline divider; don't automatically add a background container.
- Align edges of titles, table labels, action rows, and details to a consistent grid.

## 5.4 Container rule

**A container is allowed only if it gives information a real boundary** (form, comparison, inspector, upload zone, notification, dialog, or isolated action). Not every item needs a card. Prefer open canvas, ruled rows, aligned columns, and typographic grouping when those communicate structure better.

---

# 6. Layout grammar and responsive grid

## 6.1 Overall shell

Desktop target: a restrained application shell with a clearly labeled navigation rail, a contextual top bar, and a main canvas. The shell should **disappear visually** behind the actual work.

- Navigation: narrow, consistent, quietly branded; avoid enormous padded sidebar sections.
- Current client context: prominent and persistent enough to prevent wrong-tenant work.
- Page title: strong, usually left aligned, with one primary action and clear secondary actions.
- Contextual breadcrumbs: only where they reduce ambiguity.
- Work area: allow large forms, tables, and document viewer to use the available horizontal space.
- Sticky action/footer zones only where they prevent loss of key actions; never obscure content.

### Desktop conceptual wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ QualifyFlow  /  Operations       Client: ABC Trucking     Search  User       │
├──────────────┬───────────────────────────────────────────────────────────────┤
│              │  Screening intake                                           │
│ Navigation   │  18 NEED REVIEW                  [Import records] [Filters]   │
│              │  ───────────────────────────────────────────────────────────  │
│ Assigned     │  Status / Provider / Received / Driver / Company / Reason     │
│ clients      │  ───────────────────────────────────────────────────────────  │
│ Intake       │  Open       ...                                                │
│ Drivers      │  Selected   ...            [Review details →]                │
│ Exceptions   │  Open       ...                                                │
│ Integrations │  ...                                                          │
└──────────────┴───────────────────────────────────────────────────────────────┘
```

This is a functional diagram, **not permission to copy a generic dashboard layout**. The task content should dominate the page.

## 6.2 Navigation and orientation

- Operations console and client portal must be perceptibly different in title, navigation labels, and available tasks, while sharing brand tokens.
- Use a clear client context label and branch scope when actions affect sensitive tenant data.
- Treat switching companies as a **high-salience context change**: show the destination, clear stale selections, and avoid accidentally carrying a prior tenant's record into the new context.
- Support command/search navigation for experienced operators, with accessible alternatives.
- Keep frequent actions near the data they affect; don't bury every action in a general settings screen.

## 6.3 Responsive principles

- **Desktop**: primary specialist work experience with wide tables and side-by-side document verification.
- **Tablet**: adapt review panels to stacked or collapsible layouts; avoid tiny two-column forms.
- **Phone**: client-facing submissions/approvals and limited specialist triage; choose simplified record lists and detail screens rather than shrinking desktop tables to unreadable widths.
- Support touch targets of at least `44×44px` when feasible (and WCAG 2.2 target-size requirements where applicable).
- Every action reachable by touch must also be keyboard accessible on desktop.
- Preserve exact record identity, tenant context, state, and critical actions on smaller viewports.

Reference breakpoints for implementation, not hard-coded universal truth: `640px`, `768px`, `1024px`, `1280px`, `1536px`. Use **container queries** for internal layouts when it improves robustness.

---

# 7. Cinematic motion, adapted for real software

## 7.1 The motion brief

We want motion that feels **directed**: kinetic typography, layered reveal, zoom, shape morph, and camera-like continuity where meaningful. We don't want CSS elements randomly springing in on every render.

Core principle from the performance-task project: **Every moment earns its moment.** In QualifyFlow, that means a moment of visual emphasis for important transitions—while most daily tasks remain steady, direct, and fast.

### Two motion modes

**A. Signature motion** — restrained use in product introduction, first-run onboarding, major section change, completion of a meaningful setup, or a narrated product tour.

**B. Functional motion** — small, predictable, input-driven visual feedback in forms, queues, inspectors, document loading, filtering, selections, and approval states.

The interface must work and remain understandable with all decorative motion turned off.

## 7.2 Motion values

1. **Cause and effect:** An animation must explain *what changed and why*.
2. **Continuity:** Preserve spatial relationships between source and destination.
3. **Focus:** Movement should guide attention to the next action or critical state.
4. **Rhythm:** Fast event → controlled settling → readable hold; avoid perpetual activity.
5. **Restraint:** Keep still things still. A great transition often ends in silence.
6. **Determinism:** Avoid random motion that changes each visit or makes QA unpredictable.
7. **Respect user control:** No forced delay before a user can continue working.

## 7.3 Motion timing tokens — initial proposal

| Motion class | Typical duration | Usage |
|---|---:|---|
| Immediate acknowledgement | `80–120ms` | Pressed/focused state where appropriate |
| Micro-transition | `120–180ms` | Checkbox, chip selection, icon state |
| Functional UI | `160–240ms` | Row expansion, popover, inline panel |
| Panel / contextual transition | `220–360ms` | Inspector open/close, drawer movement |
| Significant view transition | `300–480ms` | Optional shared-element / page reveal |
| Signature editorial sequence | `500–1100ms` | Onboarding/key completion; skippable/nonblocking |

Use smooth easing, e.g. `cubic-bezier(0.22,1,0.36,1)` for a clean deceleration, or stable ease-in-out for reversible interactions. Do not use bouncy springs on compliance approvals, rejected documents, or urgent states.

For repeated list items, stagger only when revealing an **editorial** collection; stagger across large operational tables is wasteful and should be disabled. Never delay screen-reader availability while animation runs.

## 7.4 Signature movement vocabulary

**Kinetic typography:** Oversized words or numbers can emerge from a mask, split along a line, or settle into a working-scale heading. Best for a product intro or high-level milestone, not for every table filter.

**Morphing geometry:** A simple line, circle, document edge, or blue focus mark can transform into another structural element. Use consistent direction and small object count. Avoid noisy blob morphs.

**Camera-like continuity:** A smooth pan/scale or shared-element transfer can communicate moving from intake row to record review. Keep the focus anchor visible and reversible; no nausea-inducing zoom tunnels.

**Depth/parallax:** Subtle depth may be used on the public landing page or onboarding. Avoid parallax within record lists, document viewers, and tables.

**Fluid color changes:** Consider background/tint shifts only for specific scene transitions or contextual focus. Never flash red for ordinary alerts or animate multiple competing surface colors.

**Rhythm and holds:** A bold number may land quickly and then hold long enough to read. Silence and stillness are valid design decisions.

## 7.5 Interaction choreography examples

### Example A — Import completion

1. User submits a batch: progress appears immediately with real state, no fabricated percentage.
2. Finished result holds a stable summary: “182 received · 169 accepted · 13 need review” (only if actual counts exist).
3. One blue line or number receives a short `160–240ms` emphasis.
4. Action appears clearly: **Review 13 exceptions**.
5. The user can open the review queue immediately; animation never blocks interaction.

### Example B — Intake row to verification view

1. Row highlights on keyboard focus/selection.
2. Detail inspector expands from the selection edge or navigates to a stable review page.
3. Incoming evidence and current driver record enter in a purposeful order, not simultaneous floating cards.
4. Primary review action stays anchored and clearly labeled.
5. Returning preserves filter, scroll position, and selected item where safe.

### Example C — Client account created

1. The account creation operation confirms success with a clear, persistent result.
2. A minimal editorial reveal shows the company name and the next required setup step.
3. **Invite administrator** becomes visually dominant.
4. The experience is skippable and must never imply onboarding is complete if configuration remains unfinished.

### Example D — Critical review warning

1. Show a stable, high-contrast warning with exact reason and next step.
2. Do **not** animate the message aggressively or hide it behind a toast.
3. Keep the warning available until acknowledged/resolved, with a textual status and accessible alert semantics.

## 7.6 Motion sound and “white noise” clarification

Our earlier creative direction used **negative/white space**, satisfying airy transitions, and subtle sound-design cues in video. They are different design tools:

- **White space:** open visual canvas for hierarchy and rhythm. Core product principle.
- **White-noise texture / airy whoosh:** a video sound-design technique. **Not a default sound layer in an enterprise compliance application.**
- **Subtle grain/noise texture:** optionally for decorative editorial backgrounds, never over text or evidence.

Default product UI is **silent**. No autoplay music, atmospheric noise, or sound effects on normal notifications. Optional, user-controlled sound may be tested only for a guided product tour, with a silent default, captions, volume control, and reduced-motion considerations.

## 7.7 Reduced motion and performance

- Respect `prefers-reduced-motion: reduce` and provide near-instant changes without losing status communication.
- Minimize animation of `width`, `height`, `top`, `left`, or expensive filters on dense views. Favor `transform`/`opacity` when safe.
- Keep heavy 3D/Canvas/WebGL effects off the critical transaction path.
- Aim for smooth 60 FPS on capable hardware, but **never treat animation frame rate as an excuse to stall input, typing, scrolling, or API work**.
- Avoid scroll-jacking, auto-scrolling content after user interaction, full-page animated route delays, and indefinite motion.
- Clean up observers, listeners, and animation frames after route changes.
- Use motion only after real application state is known; animation must not manufacture data certainty.

---

# 8. Screen-specific visual concepts

This section defines **design intent** by task. Document 03 will own exact state transitions and workflow steps.

## 8.1 Sign-in and environment awareness

- Large, unmistakable “QualifyFlow” identity with a clean near-white field and restrained blue accent.
- One form, one clear CTA, concise help/error treatment.
- Clearly label production vs staging/sandbox when relevant.
- No giant slideshow explaining compliance to a returning specialist.
- Security controls (MFA, session warning) are clear and nondecorative.

## 8.2 Operations home — “What needs attention?”

Not a vanity dashboard. Primary questions:

- What arrived that still needs verification?
- What is overdue or blocked by clients?
- Which high-priority exceptions need human review?
- Which imports or integrations failed?

**Editorial composition:** One dominant actionable count or statement; beneath it, a ranked **work queue** with owner, time, tenant, and reason. Supporting operational measures are small and legible, not a wallpaper of four giant KPI cards.

Example headline: **“18 reports need review.”** Under it: a direct **Open intake queue** action, the actual list, and secondary exception/integration signals.

## 8.3 Screening intake — expert workstation

- Large but controlled title, meaningful current filters, and stable table headers.
- Table is the hero: client, driver candidate, source/provider, report type, received time, status, mismatch reason, assigned operator.
- Support search, date range, keyboard navigation, saved filters, bulk selection with honest per-row constraints.
- Selected item can open a two-column verification workspace: **incoming source evidence** versus **existing driver identity/engagement**.
- Highlight differences using accessible text and quiet colored indicators; don't turn discrepancies into a rainbow heatmap.
- Preserve received/processed timestamps and exact source identifiers; metadata should be available without overwhelming the primary view.
- Use a sticky action summary for high-risk operations; no invisible auto-attachment.

### Intake page conceptual composition

```text
SCREENING INTAKE                                        [Import] [New filter]
18 need review          6 unmatched         2 provider failures
──────────────────────────────────────────────────────────────────────────────
[ Search drivers or report IDs... ]  Client ▼  Status ▼  Received ▼
──────────────────────────────────────────────────────────────────────────────
Driver / report      Client        Source      Received         Status
John S. / MVR        ABC Trucking  Provider A  Nov 16, 09:12   Needs review
Unknown / MVR        XYZ Logistics Provider B  Nov 16, 09:21   Unmatched
...
```

The small summary is a text/number hierarchy, not three large cards by default. In the final product, use actual data, appropriate truncation, and clear table semantics.

## 8.4 Document verification — evidence first

- A document viewer occupies enough space to read the file without artificial zoom limitations.
- Source document and structured record are spatially related but visually separate.
- Show the current driver/company context persistently to prevent attachment to the wrong tenant.
- Put status, provenance, version, matching evidence, and missing fields near the review decision.
- Actions: **Attach to driver**, **Request correction**, **Escalate**, **Reject** as permitted by workflow. Use clear confirmation on consequential actions.
- Document previews should not expose sensitive contents in overview thumbnails unnecessarily.
- Loading and download errors need useful recovery paths.

## 8.5 Driver detail — one identity, multiple layers of evidence

Design as a strong editorial record header plus organized, dense sections:

- Person identity (minimum data needed for the current task)
- Current client-company engagement and branch
- Qualification requirements and attached evidence
- Screening results
- Open exceptions and approvals
- Activity/audit history

Use tabs or section anchors where they improve scanning. Avoid six giant unrelated dashboard cards. Show operational status, not a deceptive “fully compliant” green shield unless verified by approved requirements and appropriate reviewer.

## 8.6 Client company and branch onboarding

This is a valid place for stronger editorial pacing: company name as a large typographic anchor, short segmented setup steps, and gentle progress transitions.

Show the configuration sequence as a process rather than a grid of cards: **Company → Branches → Service mode → Admin users → Permissions → Integrations → Review**.

Persist drafts, allow returning later, and show actual incomplete requirements. The **Review configuration** screen is a summary of what will change, not a celebratory success slide.

## 8.7 Users and permissions

- Prefer structured role matrix or permission comparison over decorative avatar cards.
- Clearly distinguish platform operators, client users, and drivers.
- Show where a permission applies: client/branch scope, specific role, validity or status.
- Dangerous changes need explicit context and confirmation.
- An invitation is not “active access” until accepted and authorized.
- Visually label pending, expired, revoked, and active invitations.

## 8.8 API connection setup and integration diagnostics

This must feel like a real systems engineering product, not a fake form with a green “Connected” badge.

Recommended visual composition:

1. Provider name and capability summary at the top.
2. Connection/environment status that differentiates **Not configured**, **Saved**, **Testing**, **Sandbox verified**, **Production active**, **Failed**, or **Disabled**.
3. Form for approved scopes, tenant binding, credentials, callbacks/webhooks.
4. Clear **Test connection** action with actual outcome, time, and correlation ID.
5. Recent sync runs with records received/accepted/review-needed/failed and details.
6. Mapping diagnostics with source vs canonical fields and test fixtures.

Secret inputs stay masked; never display full secrets in UI, logs, screenshots, or animation previews. Do not use green solely because a key was saved.

## 8.9 Exception handling and approvals

Visualize the exception as an actionable case:

**What happened? → Why it matters? → Who owns the next action? → What is allowed next?**

- Exact reason, source, created time, current owner, due date, evidence links.
- Timeline of changes presented as a concise ordered event history, not an enormous decorative stepper.
- Client-approved routing and required sign-offs visible before action.
- Make “Awaiting client” and “Needs internal review” distinct.
- Destructive actions and manual overrides require rationale and focused confirmations.
- Keep histories available, even after resolution.

## 8.10 Notification center and communication composer

- Group by actionable event and recipient responsibility, not by random colorful alert card.
- Templates display actual audience, channel, and approved content version.
- Reveal the relevant driver/company identifier safely and avoid exposing unnecessary PII.
- Draft, schedule, send, retry, suppress, and failure outcomes have distinct statuses.
- Show who approved a template or one-off message and when, where required.
- Avoid spamming users with animated bell icons for background events.

## 8.11 Automation builder

Product should visually communicate **trigger → conditions → actions → approval gate**, with test/dry-run feedback. Not a huge node canvas for every small rule.

Start with a guided, readable flow. A graph view may be an optional advanced mode for genuinely complex dependencies. Always provide a text/list equivalent, error states, and a visible audit/run history.

## 8.12 Audit and reporting

- Quiet, readable chronological history or compact table with clear date/time and actor.
- Stable links to source events and prior/new values where access permits.
- Exports and audits must be permission scoped.
- Charts only for valid time trends, distribution, throughput, and aging—not aesthetic filler.
- Do not use unsupported “compliance score” gamification.

## 8.13 Client portal — calm and understandable

The client administrator does not need the same dense operational console as the specialist.

- Start with **requests requiring your action**: missing submissions, approvals, requested clarifications.
- Use plain language, larger targets, and fewer professional abbreviations.
- Show clear next step and deadline without fear-driven design.
- Provide easy driver lookup, authorized documents, current requests, and account/users access.
- Allow an administrator to trust the managed service without making them perform the specialist's work.

---

# 9. Core component system: bespoke composition with reliable primitives

Use accessible, tested primitives for behavior; style them to our design system. Do not let library defaults dictate the aesthetic. A component may be reusable without becoming a generic rectangular card.

## 9.1 Minimum component inventory

- `ProductShell`, `ClientContextSwitch`, `WorkPageHeading`, `EditorialHeadline`
- `MetricStatement`, `ActionQueue`, `DataTable`, `FilterBar`, `BatchActionBar`
- `VerificationWorkspace`, `DocumentViewer`, `ComparisonField`, `EvidenceSource`
- `RecordStateLabel`, `ExceptionBanner`, `ApprovalSummary`, `AuditTimeline`
- `ClientOnboardingStepper`, `UserInviteForm`, `RoleMatrix`
- `IntegrationConnectionForm`, `ConnectionTestResult`, `SyncRunLog`
- `NotificationComposer`, `MessageHistory`, `AutomationRuleSummary`
- `EmptyState`, `ErrorState`, `LoadingState`, `Toast`, `Dialog`, `Drawer`
- `SignatureTitleReveal`, `SharedContextTransition`, `FocusUnderline` (only where warranted)

Names are suggestions. The component contract should explain what each component **means**, which states it supports, and when it should not be used.

## 9.2 Component behavior quality bar

Every interactive component must have states for:

- Default, hover where meaningful, keyboard focus visible, pressed/active.
- Loading or pending, disabled with a comprehensible reason, error, success.
- Empty/unavailable data.
- Permission denied and stale/out-of-date state when relevant.

Components must be controllable by keyboard and screen reader. Never use a pretty button with no backend action. Avoid design-only affordances that mimic working features.

## 9.3 Tables and forms

- Tables need real sorting, pagination/virtualization where justified, meaningful sticky headers, and row identity.
- Dense view must preserve alignment; truncate carefully and provide full values on focus/inspect.
- Forms need explicit labels, field-level help/error, required status, input constraints, and a safe save/cancel path.
- Validate consistently in client and server; show specific errors rather than generic toasts.
- Confirmation dialogs are reserved for materially consequential or irreversible actions—not every routine click.
- Multi-step setups preserve data on back navigation and distinguish draft from committed changes.

## 9.4 Empty states and error states

An empty state should answer: **What is missing? Why? What can I do now?**

Example: “No screening results are waiting.” Secondary text may say when the last sync completed, if known. Action: **View recent imports**.

Errors should identify the failed operation and recovery step, ideally with a correlation/reference ID. Never hide a failed import behind a friendly celebratory animation.

---

# 10. Data visualization standards

QualifyFlow is a data-centric product. Design charts with the same rigor as record workflows.

**Allowed when useful:** intake volume over time, exception aging, processing time distribution, sync error rate, assignment load, repeat failure types.

**Usually not useful:** donut charts of decorative “quality,” empty progress rings, fake percentage gauges, redundant KPI cards, mood-based charts, animation-first status graphics.

Rules:

1. A chart answers a specific operational question.
2. Units, window, filters, sample sizes, and definitions are visible.
3. Never invent values or truncate context to make performance look better.
4. Distinguish counts from percentages and activity from quality.
5. Provide accessible labels, tooltip details, and a table alternative for important values.
6. Use monotone/consistent color scales and preserve semantic state colors.
7. Chart motion should be minimal: initial subtle reveal at most, with reduced-motion fallback and no prolonged animated counting.
8. When data is insufficient, say so instead of making an attractive chart.

---

# 11. Content design, microcopy, and trust language

The interface is operational software. Words must be specific, brief, and defensible.

## 11.1 Preferred patterns

| Avoid | Prefer |
|---|---|
| “Everything is compliant!” | “All configured required documents have been reviewed” (only when true) |
| “AI successfully matched your driver!” | “Match suggested; review required” if confidence is not sufficient |
| “There was an error” | “Connection test failed: provider authorization rejected” when supported |
| “Submit” on every form | “Invite user,” “Attach report,” “Approve request” |
| “100% accuracy” | Real counts and defined validation outcomes |
| “Done!” after saving credentials | “Connection saved. Not yet tested.” |
| “Driver not compliant” as generic status | “Missing evidence” / “Needs compliance review” when no legal determination is made |

## 11.2 Human tone without casualizing sensitive work

- Clear and direct, not robotic or overenthusiastic.
- No unnecessary congratulatory copy for routine record entry.
- No emoji in compliance exceptions, client alerts, or security warnings.
- No marketing language inside a review task.
- Attribute actions: “Reviewed by Jamie on Nov 16 at 09:14” rather than “Verified by system” unless the actor is truly automated and evidenced.
- Explain why a suggestion occurred and allow the user to inspect its inputs.

---

# 12. Accessibility and inclusive interaction

**Accessibility is a design constraint, not a post-launch cosmetic pass.** Target WCAG 2.2 AA for core experiences, with manual review in addition to automated checks.

Requirements:

- All controls operable by keyboard; logical tab order and visible focus indication.
- Semantic headings, forms, buttons, links, dialog labeling, and meaningful tables.
- Screen readers can distinguish tenant context, report type, driver identity, current status, and next action.
- Dynamic updates announced politely as appropriate, not flooded into a live region.
- Error messages tied to fields and summarized where helpful.
- Contrast checked for every text-size/token pair and meaningful UI boundary.
- Color is never the only indicator of missing, expired, rejected, verified, or waiting states.
- Touch targets and spacing tested on smaller screens.
- Text remains usable at 200% zoom/reflow where applicable.
- Animation respects reduced motion; no indispensable content in moving imagery alone.
- Tooltips are not the only way to discover instructions or reasons.
- Support readable dates/timezones; avoid confusing relative dates without an absolute timestamp.
- Never prevent copy/paste in fields without a defensible security requirement.

---

# 13. Performance, security, and confidentiality implications of design

Visual polish cannot compromise sensitive workflows.

- Avoid large video backgrounds, heavy WebGL, continuously animating canvas scenes, or unnecessary font downloads in the authenticated app.
- Lazy-load document previews and noncritical marketing animation bundles.
- Never load documents from public permanent URLs; use authorized, time-limited access.
- Avoid embedding sensitive data in CSS class names, client-side analytics labels, URLs, page titles, unredacted telemetry, or shareable motion preview captures.
- Build redacted synthetic records for design review, Storybook, screenshot tests, and motion demos.
- Prevent previous-tenant data from flashing briefly during client switches, route transitions, or optimistic cache updates.
- Show true loading states; never render stale data as if it belongs to the newly selected client.
- Do not animate a success state until the backend has confirmed the operation; if optimistic UI is necessary, show pending and rollback states honestly.
- Don't make security-sensitive confirmations auto-dismiss without sufficient read time.
- Respect sessions, idle timeouts, and document-view permissions during transitions.

### Performance budgets: initial targets to measure

- Initial console route should become usable quickly on an ordinary business laptop and stable connection; define exact performance targets after baseline measurement.
- Interactive motion should not block clicks or typing; long main-thread tasks are defects.
- Critical operations should respond visually to the user's action within roughly `100ms` with a real pending state even when server work is longer.
- Prefer server-backed pagination/filtering and virtualization where volume justifies it.
- Audit CSS/JS bundle, animation libraries, font weight count, and preview rendering costs before shipping.
- No autoplay media in everyday work views.

---

# 14. Implementation plan for Codex

## 14.1 Before writing components

1. Read Document 01 and this entire Document 02.
2. Locate and inspect the real `awesome-design-md` references and Codex-compatible `ui-ux-pro-max-skill` resources; record which entries were actually used and why. Never claim to have executed unavailable scripts.
3. Inspect the existing codebase, frontend framework, routing, styling, asset pipeline, accessibility library, animation dependencies, and available tests.
4. Create the root `DESIGN.md` and the single-source-of-truth `design-system/qualifyflow/MASTER.md`; produce reviewed tokens and preview artifacts rather than adopting a generated palette blindly.
5. Produce a **design inventory** of actual application surfaces and user tasks.
6. Create three distinct composition explorations (static layouts) for: Operations Home, Screening Intake, and Client Portal Home. Each must satisfy this design spec without defaulting to the same grid of cards.
7. Obtain design approval or follow existing approved direction before applying a new visual language across the product.

## 14.2 Build order

**Foundation:** color/type/spacing tokens, app shell, navigation, tenant context, labels, forms, table, focus/error states.

**Workstation:** screening intake, verification workspace, document viewer, exception history, batch processing feedback.

**Account management:** client onboarding, branch management, invitations, role matrix, provider connections and sync logs.

**Client portal:** action requests, document upload, approval path, user settings, simple status overview.

**Signature visuals:** onboarding typographic treatment, restrained page transitions, product marketing intro—after the core workflows are usable.

**QA:** visual regression, a11y, responsive, performance, motion reduction, and product semantics.

## 14.3 Recommended technical approach

- Use React + TypeScript and a token-first styling system (Tailwind CSS with CSS variables or CSS Modules as the repo justifies).
- Build accessible interaction behavior with well-tested primitives where appropriate; provide bespoke visual styling on top.
- For animation, prefer CSS transitions for basic states. Use a frame-stable declarative animation library (e.g. Motion for React/Framer Motion) only where composition choreography or shared-element behavior genuinely needs it.
- Prefer SVG for precise vector geometry/morphing; Canvas/Three.js only for selective noncritical scenes.
- Avoid adding many animation libraries; one consistent motion layer is easier to maintain and QA.
- Keep product state under typed, tested application data flow, not in animation components.
- Treat any external design skill recommendations as implementation references, not authority to introduce unreviewed dependencies or copy UI templates.

### Example foundation CSS tokens

```css
:root {
  --qf-canvas: #ffffff;
  --qf-canvas-soft: #f8fafd;
  --qf-surface: #ffffff;
  --qf-ink: #12151b;
  --qf-muted: #5b6574;
  --qf-border: #dfe5ee;
  --qf-blue: #265cff;
  --qf-blue-accessible-text: #1741c8;
  --qf-blue-soft: #eef3ff;
  --qf-success: #027a48;
  --qf-warning: #865900;
  --qf-danger: #b42318;

  --qf-space-1: 4px;
  --qf-space-2: 8px;
  --qf-space-3: 12px;
  --qf-space-4: 16px;
  --qf-space-6: 24px;
  --qf-space-8: 32px;
  --qf-space-12: 48px;
  --qf-space-16: 64px;

  --qf-radius-control: 8px;
  --qf-radius-panel: 12px;
  --qf-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --qf-motion-fast: 140ms;
  --qf-motion-ui: 220ms;
  --qf-motion-view: 340ms;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --qf-motion-fast: 0ms;
    --qf-motion-ui: 0ms;
    --qf-motion-view: 0ms;
  }
}
```

These tokens are a starting proposal. Verify contrast, branding, and legibility in implemented components. A CSS token file alone does not make a design system.

## 14.4 Design implementation contract

Before marking a screen complete, Codex must show:

- What task the page serves and who the user is.
- What visual element is intentionally dominant and why.
- Why each container exists (if any).
- How keyboard, screen reader, mobile, loading/error, and reduced-motion states behave.
- Which data is real, synthetic, pending, or unavailable.
- Screenshots at desktop, tablet, and phone widths where relevant.
- Evidence that the page calls actual product actions rather than placeholder controls.
- Confirmation that any page-specific `pages/*.md` override stays consistent with the canonical design tokens and current Master.
- Proof of no cross-tenant data leakage during transitions.
- Proof that any movement guides attention rather than delaying the task.

---

# 15. Design review and anti-slop acceptance checklist

Use this list as a release gate, not merely design inspiration.

### Hierarchy and composition

- [ ] One clearly dominant information/action priority per screen.
- [ ] Editorial rhythm and intentional negative space; no space-filling decoration.
- [ ] Typography is properly scaled and the most important content is readable at a glance.
- [ ] No repeated 2×2 card grids unless directly justified by comparison or task.
- [ ] No indiscriminate rounded rectangle around every idea.
- [ ] Page compositions vary by user need without destroying global consistency.

### Operational usability

- [ ] Most common task can be found and started immediately.
- [ ] Tables, record viewers, and review actions are accurate and readable.
- [ ] Tenant context and driver identity cannot be mistaken.
- [ ] Errors, pending actions, and incomplete records are explicit.
- [ ] Dense views prioritize workflow speed over cinematic effects.
- [ ] Client portal emphasizes requests requiring action, not vanity charts.

### Motion direction

- [ ] Motion exists for a specific reason and has an understandable start/end state.
- [ ] Motion is not on a perpetual loop in work areas.
- [ ] Reduced-motion experience preserves meaning.
- [ ] No autoplay sound, music, or white-noise beds in the app.
- [ ] No animations that delay processing, hide urgent messages, or alter the user's understanding of confirmed status.

### Accessibility / safety

- [ ] WCAG AA contrast and keyboard focus checked.
- [ ] Color never communicates state on its own.
- [ ] Core screens tested by keyboard and representative screen reader use.
- [ ] Mobile/tablet layouts preserve important identity, context, and actions.
- [ ] No secrets or sensitive driver data exposed in screenshots, analytics, or previews.

### Product completeness

- [ ] UI controls map to working, authorized backend operations.
- [ ] No fake API status, fake progress, fake data, or misleading compliance claims.
- [ ] Empty, error, no-permission, and stale states have been designed and tested.
- [ ] Core flow passed visual regression, accessibility, and performance review.

---

# 16. Design quality scorecard

Codex may evaluate each major surface using this qualitative rubric, with examples and screenshots rather than arbitrary self-awarded 10/10s.

| Axis | Strong outcome | Weak outcome |
|---|---|---|
| Visual identity | Recognizable by typography, rhythm, color restraint | Could be any SaaS template |
| Hierarchy | Main task and next action obvious | Everything has equal visual weight |
| Density | Right amount of data for the role | Sparse where work needs detail; cramped where focus matters |
| Motion | Directs attention, confirms state | Constant entrance animations, delayed interactions |
| Data integrity communication | Sources, status, and ambiguity explicit | “Compliant” badges with no evidence |
| Navigation | Clear client context and mental model | Hidden task routes; ambiguous tenant switching |
| Accessibility | Keyboard, screen reader, contrast, reduced motion | Beautiful but unusable interaction |
| Engineering | Reusable tokens, tested primitives, real actions | Screenshots with dead buttons and fake status |

---

# 17. Handoff contracts with the other planning files

**From Document 01:** Adopt the product personas, two product surfaces, feature modules, multi-tenancy, security baseline, and technical stack. This document controls how those capabilities look and interact, not whether they exist.

**To Document 03:** Provide interface patterns for exact workflows, including screening intake, identity matching, document review, account creation, user invitation, provider API setup, notification approval, exception resolution, and automation. Document 03 must specify decisions, states, conditions, permissions, and failures; those details should not be guessed from animation mockups.

**To Document 04:** Provide accessible visual and motion standards, privacy-safe capture/telemetry, and design QA gates. Document 04 will own compliance research, threat modeling, infra, disaster recovery, operational procedures, and legal/security release approval.

---

# 18. Final creative and engineering directive

We are not making a dashboard that happens to be white. We are making **a serious operations product with the visual intelligence of premium editorial motion design**.

The cinematic inspiration should be visible in the courage to use one dominant headline, the rhythm of transitions, the clarity of relationships, and the refusal to clutter the interface. The enterprise credibility should be visible in precise data tables, evidence-centered review, well-labeled permissions, honest connection states, accessible controls, and quiet responsiveness.

**Three rules to remember:**

1. **Show the evidence, not the decoration.**
2. **Move the user's attention, not everything on the screen.**
3. **Design for the task first; make its execution unmistakably beautiful.**

**Definition of completion:** A distinctive, implemented, accessible, responsive design system applied consistently to real functional product surfaces—with polished but restrained motion, no fake interface elements, and no obstruction to accurate compliance operations.
