import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IdentityMark, ReadinessSignal } from "./VisualInformation";

describe("truthful visual information", () => {
  it("distinguishes waiting, suspension and unavailable states without inventing progress", () => {
    const pending = renderToStaticMarkup(<ReadinessSignal status="draft" />);
    const suspended = renderToStaticMarkup(
      <ReadinessSignal status="suspended" />,
    );
    const unavailable = renderToStaticMarkup(
      <ReadinessSignal status="unknown" />,
    );
    expect(pending).toContain("Pending service activation");
    expect(suspended).toContain("Access suspended");
    expect(unavailable).toContain("is-neutral");
    expect(unavailable).not.toContain("is-active");
    expect(unavailable).not.toContain("is-paused");
    for (const markup of [pending, suspended, unavailable]) {
      expect(markup).not.toMatch(/\d+\s*%|legally compliant/i);
    }
  });

  it("keeps identity cues deterministic and decorative without inventing a person", () => {
    const person = renderToStaticMarkup(
      <IdentityMark value="alex.morgan@example.com" />,
    );
    expect(person).toContain("AM");
    expect(person).toContain('aria-hidden="true"');
    expect(
      renderToStaticMarkup(<IdentityMark value="alex.morgan@example.com" />),
    ).toBe(person);
    expect(person).not.toContain("img");
    expect(
      renderToStaticMarkup(<IdentityMark value="Alex Morgan" organization />),
    ).toContain("organization-mark");
  });
});
