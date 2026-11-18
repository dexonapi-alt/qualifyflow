import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverProfile } from "./DriverProfile";
import type { DriverDetail } from "./api";

describe("driver profile authority", () => {
  it("shows a personal identity without exposing file actions or invented progress to a viewer", () => {
    const record: DriverDetail = {
      id: "synthetic-driver",
      reference: "SYNTHETIC-VIEWER",
      first_name: "Synthetic",
      last_name: "Viewer",
      version: 1,
      created_at: "2026-11-19T00:00:00Z",
      engagements: [],
      history: null,
      history_total: null,
      access: {
        role: "client_viewer",
        branch_id: null,
        can_write: false,
        can_correct: false,
        can_history: false,
        can_transfer: false,
        can_rehire: false,
      },
    };
    const markup = renderToStaticMarkup(
      <DriverProfile
        record={record}
        companyName="Synthetic Company"
        path="/unused"
        onFile={() => {
          throw new Error("Unexpected file action");
        }}
        onManage={() => {
          throw new Error("Unexpected management action");
        }}
        onHistory={() => {
          throw new Error("Unexpected history action");
        }}
        onRefresh={() => {}}
      />,
    );
    expect(markup).toContain("Synthetic Viewer");
    expect(markup).toContain("Evidence details are restricted");
    expect(markup).not.toContain("<progress");
    expect(markup).not.toContain("Open qualification file");
    expect(markup).not.toContain("Manage engagement");
    expect(markup).not.toContain("View history");
  });
});
