import { describe, expect, it } from "vitest";
import { driverNextStep } from "./driverNextStep";

const noRequirements = {
  assigned: 0,
  reviewed: 0,
  missing: 0,
  expired: 0,
  awaiting_review: 0,
};
const client = {
  ended: false,
  file: noRequirements,
  operational: false,
  role: "client_admin",
};
describe("truthful next-step guidance", () => {
  it("does not imply a service assignment when ownership is unknown", () => {
    const next = driverNextStep(client);
    expect(next.detail).toContain("company administrator");
    expect(next.action).toBe("View file");
    expect(next.state).toBe("requirements_needed");
  });
  it("follows recorded responsibility without claiming work is underway", () => {
    const service = driverNextStep({ ...client, intakeOwner: "service" });
    expect(service.detail).toBe(
      "Your service team needs to assign requirements.",
    );
    expect(service.action).toBe("View file");
    expect(driverNextStep({ ...client, intakeOwner: "client" }).action).toBe(
      "Set up file",
    );
    expect(driverNextStep({ ...client, operational: true }).action).toBe(
      "Set up file",
    );
  });
  it("does not direct a viewer or ended engagement into upload work", () => {
    expect(
      driverNextStep({ ...client, file: null, role: "client_viewer" }).action,
    ).toBe("View record");
    expect(
      driverNextStep({ ...client, ended: true, intakeOwner: "client" }).action,
    ).toBe("View record");
  });
  it("distinguishes expired evidence, pending review and completed requirements", () => {
    const file = { ...noRequirements, assigned: 2, reviewed: 2 };
    expect(
      driverNextStep({
        ...client,
        file: { ...file, expired: 1 },
        intakeOwner: "client",
      }).action,
    ).toBe("Update evidence");
    expect(
      driverNextStep({
        ...client,
        file: { ...file, awaiting_review: 1 },
        reviewOwner: "service",
      }).detail,
    ).toContain("scan or service review");
    expect(driverNextStep({ ...client, file }).state).toBe("review_complete");
    expect(driverNextStep({ ...client, file }).detail).not.toMatch(
      /qualified|compliant/,
    );
  });
});
