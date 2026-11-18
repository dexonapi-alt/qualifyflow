# Driver identity: glide into focus

Latest refinement (ADR0024): no visible X. The centered card stays open over its own footprint, the invisible original footprint and their small travel corridor. Leaving initiates automatic return; reentry cancels/reverses it. Mouse opening uses this behavior; keyboard/touch retain Escape/tap-outside and a keyboard-only Return action. Content remains fully opaque. Final checks include16 frontend tests, geometric retention tests and actual pointer-retention/return/reentry assertions in the browser runner. Earlier explicit-close wording below is historical where inconsistent.

The owner requested a card that travels into the center while preserving the rest of the page. The centered card remains fully opaque throughout, and the surrounding content stays mounted and visible at full opacity. A transparent backdrop applies a light blur, without a tint or fade.

DriverIdentityFocus preserves the source footprint and measures its rectangle. A native dialog presents the same authorized identity/actions at the viewport center. Motion animates translation/scale between those positions; close reverses the path. Profile color tokens are shared so mint cover, initials and metadata remain consistent when rendered in the dialog portal.

Desktop hover has160ms intent before opening. Focused source controls cancel pending hover. The view stays open until explicit dismissal, so moving from the original card position to its centered position cannot cause hover-out flicker. Expand is also directly available to keyboard/touch. Keyboard focus remains in the dialog, Escape/close/backdrop dismiss, and source focus and scroll styles are restored afterward. Reduced motion skips spatial movement. Actual file/engagement actions remain functional.

Verification: frontend10 tests and production build passed; full onboarding/driver Playwright journey1 passed. The targeted browser runner samples intermediate positions and asserts both card/background opacity remain1. Five axe/overflow checks cover375/768/1024/1440 and reduced motion; keyboard wrapping, Escape/backdrop/button dismissal, focus return, touch and actual file navigation passed. Desktop/mobile screenshots visually inspected. Build retains the documented Motion-related chunk-size warning; no runtime performance certification is implied.

[Centered desktop](profile-center/centered-1440.png) · [Centered touch](profile-center/centered-375.png) · [Resting](profile-center/resting-1440.png) · [Results](profile-center/results.json)

Runner: `frontend/scripts/profile-center-review.mjs`. ADR0023 supersedes the historical local-hover profile assertions from interaction-review.mjs. Shared panel/row/navigation feedback from that iteration remains unchanged. Original numbered specifications and backend behavior are untouched.
