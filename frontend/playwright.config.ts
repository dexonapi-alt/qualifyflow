import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.QF_E2E_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
  },
  reporter: "list",
  timeout: 60000,
});
