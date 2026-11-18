import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Requirement, Evidence } from "./qualificationTypes";
import {
  requirementCue,
  priorityRequirements,
  responsibilityLabel,
} from "./requirementExperience";
import { EvidenceJourney } from "./EvidenceJourney";

const evidence: Evidence = {
  id: "e",
  revision: 1,
  version: 1,
  filename: "synthetic.pdf",
  status: "needs_review",
  byte_size: 100,
  uploaded_at: "2026-11-19T00:00:00Z",
  scanned_at: "2026-11-19T00:01:00Z",
  sha256: "synthetic",
  scanner: "synthetic",
  scan_error: null,
  can_download: true,
  review: null,
};
const requirement: Requirement = {
  id: "r",
  title: "Synthetic requirement",
  code: "SYN",
  category: "other",
  policy_revision: 1,
  engagement_id: "g",
  engagement_current: true,
  requires_expiry: false,
  status: "needs_review",
  follow_up_id: null,
  evidence: [evidence],
};

describe("truthful requirement guidance", () => {
  it("separates a scan wait and scan failure from a reviewable document", () => {
    expect(
      requirementCue(
        {
          ...requirement,
          evidence: [{ ...evidence, status: "quarantined", scanned_at: null }],
        },
        true,
      ),
    ).toMatchObject({ action: "View scan status", responsibility: null });
    expect(
      requirementCue(
        {
          ...requirement,
          evidence: [{ ...evidence, scan_error: "scanner_unavailable" }],
        },
        true,
      ),
    ).toMatchObject({ tone: "attention", action: "Inspect scan" });
    expect(requirementCue(requirement, true).action).toBe("Review evidence");
    expect(requirementCue(requirement, false).action).toBe("View evidence");
  });
  it("does not call requests for more evidence an active review", () => {
    expect(
      requirementCue(
        {
          ...requirement,
          evidence: [{ ...evidence, status: "needs_more_information" }],
        },
        true,
      ),
    ).toMatchObject({ tone: "pending", responsibility: "intake" });
    expect(
      requirementCue(
        { ...requirement, evidence: [{ ...evidence, status: "escalated" }] },
        true,
      ),
    ).toMatchObject({ tone: "attention", responsibility: "review" });
  });
  it("respects the server requirement state even if a newer version awaits scanning", () => {
    expect(
      requirementCue(
        {
          ...requirement,
          status: "verified",
          evidence: [{ ...evidence, status: "quarantined" }],
        },
        true,
      ),
    ).toMatchObject({ tone: "complete", responsibility: null });
    expect(
      requirementCue({ ...requirement, status: "expired" }, true).action,
    ).toBe("Update evidence");
  });
  it("prioritizes problems and missing evidence over completed work without mutating records", () => {
    const rows = [
      { ...requirement, id: "complete", status: "verified" },
      { ...requirement, id: "waiting" },
      { ...requirement, id: "missing", status: "missing", evidence: [] },
      { ...requirement, id: "expired", status: "expired" },
    ];
    expect(priorityRequirements(rows).map((r) => r.id)).toEqual([
      "expired",
      "missing",
      "waiting",
      "complete",
    ]);
    expect(rows[0].id).toBe("complete");
  });
  it("never fabricates responsibility from an unknown value", () => {
    expect(responsibilityLabel("service")).toBe("Service team");
    expect(responsibilityLabel("client")).toBe("Company team");
    expect(responsibilityLabel(undefined)).toBe("Not configured");
    expect(responsibilityLabel("specialist@example.com")).toBe(
      "Not configured",
    );
  });
  it("shows only recorded timestamps and labels a failed scan honestly", () => {
    const html = renderToStaticMarkup(
      <EvidenceJourney
        evidence={{ ...evidence, status: "quarantined", scanned_at: null }}
      />,
    );
    expect((html.match(/<time /g) || []).length).toBe(1);
    expect(html).toContain("No outcome recorded");
    const failed = renderToStaticMarkup(
      <EvidenceJourney
        evidence={{ ...evidence, scan_error: "scanner_unavailable" }}
      />,
    );
    expect(failed).toContain("Scan needs attention");
    expect(failed).toContain("is-blocked");
    expect(failed).not.toContain("compliance score");
  });
});
