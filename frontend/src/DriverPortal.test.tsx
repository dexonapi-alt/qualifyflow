import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverPortal, driverRequestState } from "./DriverPortal";

describe("personal onboarding", () => {
  const item = {
    id: "synthetic",
    title: "Synthetic document",
    instructions: "Training only",
    status: "missing",
    submissions: [],
  };
  it("uses a focused driver surface without company navigation or review controls", () => {
    const html = renderToStaticMarkup(
      <DriverPortal
        user={{
          id: "synthetic",
          email: "synthetic@example.com",
          platform_role: null,
          driver_portal: true,
          company_access: false,
        }}
        onLogout={() => {}}
      />,
    );
    expect(html).toContain("My onboarding");
    expect(html).toContain("Sign out");
    expect(html).not.toContain("Main navigation");
    expect(html).not.toContain("Company workspace");
    expect(html).not.toContain("Record evidence review");
  });
  it("never treats receipt or a scan as evidence acceptance", () => {
    expect(driverRequestState(item)).toMatchObject({
      label: "Ready to upload",
      tone: "pending",
    });
    const submission = {
      id: "e",
      filename: "synthetic.png",
      revision: 1,
      status: "scanning",
      uploaded_at: "2026-11-19T00:00:00Z",
      can_download: false,
    };
    expect(
      driverRequestState({
        ...item,
        status: "needs_review",
        submissions: [submission],
      }),
    ).toMatchObject({ label: "Security check", tone: "working" });
    expect(
      driverRequestState({
        ...item,
        status: "needs_review",
        submissions: [{ ...submission, status: "needs_more_information" }],
      }),
    ).toMatchObject({ label: "Changes requested", tone: "pending" });
    expect(
      driverRequestState({
        ...item,
        status: "verified",
        submissions: [submission],
      }),
    ).toMatchObject({ label: "Evidence accepted", tone: "complete" });
  });
});
