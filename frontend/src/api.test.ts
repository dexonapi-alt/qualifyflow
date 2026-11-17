import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("authenticated API contract", () => {
  it("sends same-origin cookies and the CSRF header on mutations", async () => {
    vi.stubGlobal("document", {
      cookie: "qf_csrf=protected-csrf; another=value",
    });
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "persisted" }) });
    vi.stubGlobal("fetch", fetch);
    expect(await api("/tenants", { display_name: "Synthetic" })).toEqual({
      id: "persisted",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/tenants",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRF-Token": "protected-csrf" }),
      }),
    );
  });
  it("retains safe server validation fields and correlation IDs for recovery", async () => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            message: "Check fields",
            fields: { timezone: "Unknown timezone" },
            correlation_id: "request-1",
          },
        }),
      }),
    );
    await expect(api("/tenants", {})).rejects.toMatchObject({
      message: "Check fields",
      fields: { timezone: "Unknown timezone" },
      reference: "request-1",
      status: 422,
    });
  });
  it("never resolves failed authorization as successful data", async () => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "Resource unavailable." } }),
      }),
    );
    await expect(api("/tenants/foreign")).rejects.toBeInstanceOf(ApiError);
  });
});
