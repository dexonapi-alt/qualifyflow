# Interaction refinement

The driver's identity receives the strongest emphasis: gentle desktop hover enlargement and elevation, with a very light blur on adjacent profile context. It returns to rest when the pointer leaves. The profile retains normal document flow, so neighboring content does not shift.

The surrounding strategy is deliberately quieter:

- **Recognition:** profile identity lift, supporting mint border and restrained shadow.
- **Inspection:** operational rows highlight on hover and keyboard focus, without moving or implying whole-row click behavior.
- **Discovery:** existing navigation changes color smoothly; action arrows move2px in the direction of navigation; disclosures gain a quiet hover surface.
- **Reading and input:** an expanded requirement or focused control disables contextual blur. Header/navigation remain crisp and fully usable. No overlay intercepts a click.
- **Access:** touch has no hover-dependent operation; reduced motion removes these transitions, transforms and filters. Existing keyboard focus indicators remain visible.

Canonical tokens add focus scale1.018, context blur0.65px, focus shadow, interaction surface and hover borders. Existing140/200/260ms timing/easing is reused. No dependency, backend, API, authentication or permission change.

Verification: frontend10 tests and production build passed; full persisted onboarding/driver Playwright regression1 passed. `frontend/scripts/interaction-review.mjs` checks actual hover, stable layout, keyboard focus, expanded-content protection, reduced motion,375px touch and768/1024/1440 desktop/tablet behavior, overview panel feedback and real file navigation. Six targeted axe/overflow checks passed, with zero page errors. Resting/hover, overview and touch screenshots were visually inspected. These are targeted checks, not a full assistive-technology or performance certification.

[Resting profile](interaction-polish/profile-resting-1440.png) · [Hover focus](interaction-polish/profile-hover-1440.png) · [Overview feedback](interaction-polish/overview-feedback-1440.png) · [Touch](interaction-polish/touch-375.png) · [Results](interaction-polish/results.json)
