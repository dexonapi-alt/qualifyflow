import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
const root = resolve(".."),
  base = "http://localhost:5174";
const accounts = JSON.parse(
  readFileSync(resolve(root, ".local/ui-qa-accounts.json"), "utf8"),
);
const provider = JSON.parse(
  readFileSync(resolve(root, ".local/provider-simulator.json"), "utf8"),
);
const out = resolve(root, "docs/design/milestone-resumption");
mkdirSync(out, { recursive: true });
function totp(secret) {
  let bits = "";
  for (const c of secret)
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest(),
    o = hash[19] & 15;
  return ((hash.readUInt32BE(o) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const browser = await chromium.launch();
const ctx = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  }),
  page = await ctx.newPage();
page.setDefaultTimeout(20000);
const failures = [],
  results = [];
page.on("pageerror", (e) => failures.push(e.message));
try {
  await page.goto(base);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(accounts.client.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(accounts.client.password);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totp(accounts.client.secret));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator(".product").waitFor();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page
    .getByRole("heading", { name: "Provider connections", exact: true })
    .waitFor();
  await page
    .getByText("Loading provider connections…", { exact: true })
    .waitFor({ state: "hidden" });

  let manage = page.getByRole("button", {
    name: "Manage connection",
    exact: true,
  });
  if (!(await manage.count())) {
    await page
      .getByText("Configure local provider access", { exact: true })
      .click();
    await page
      .getByLabel("Provider account reference", { exact: true })
      .fill(provider.account_ref);
    await page
      .getByLabel("Provider access credential", { exact: true })
      .fill(provider.credential);
    await page
      .getByLabel("Provider access authorization rationale", { exact: true })
      .fill(
        "Authorize local synthetic provider for the isolated UI QA company.",
      );
    await page
      .getByRole("button", { name: "Save provider connection", exact: true })
      .click();
    await page.getByRole("button", { name: "Hide key", exact: true }).click();
  }
  await manage.first().click();
  const testedVersion = await page
    .locator(".connection-detail")
    .getAttribute("data-version");
  await page
    .getByLabel("Connection test rationale", { exact: true })
    .fill("Verify the actual separate localhost provider transport.");
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await page.waitForFunction((v) => {
    const e = document.querySelector(".connection-detail");
    return e && e.getAttribute("data-version") !== v;
  }, testedVersion);
  await page
    .getByRole("button", { name: "Queue provider pull", exact: true })
    .waitFor();
  await page
    .getByText("Create a synthetic provider record", { exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Create synthetic provider record",
    exact: true,
  });
  await form
    .getByLabel("Exact company driver reference", { exact: true })
    .fill("PRODUCT-001");
  await form
    .getByLabel("Synthetic report reference", { exact: true })
    .fill("SYN-UI-PROVIDER-" + Date.now());
  await form
    .getByLabel("Provider reported date", { exact: true })
    .fill("2026-11-18");
  await form
    .getByLabel("Simulation rationale", { exact: true })
    .fill(
      "Create metadata at the separate synthetic provider for UI verification.",
    );
  const priorVersion = await page
    .locator(".connection-detail")
    .getAttribute("data-version");
  await form
    .getByRole("button", {
      name: "Create synthetic provider record",
      exact: true,
    })
    .click();
  await page.waitForFunction((v) => {
    const e = document.querySelector(".connection-detail");
    return e && e.getAttribute("data-version") !== v;
  }, priorVersion);
  await page.locator(".connection-detail").waitFor();
  await page
    .getByLabel("Pull rationale", { exact: true })
    .fill("Receive the synthetic provider source through the durable worker.");
  const queuedPullResponse = page.waitForResponse(
    (r) => r.url().endsWith("/pull-jobs") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Queue provider pull", exact: true })
    .click();
  const queuedPull = await (await queuedPullResponse).json();
  assert(queuedPull.id, "Pull request must return its durable job");
  for (let i = 0; i < 12; i++) {
    await page
      .getByRole("button", { name: "Refresh connections", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Provider pull jobs", exact: true })
      .waitFor();
    if (
      (
        await page.locator(`[data-provider-job="${queuedPull.id}"]`).innerText()
      ).includes("completed")
    )
      break;
    await page.waitForTimeout(1000);
  }
  assert.match(
    await page.locator(`[data-provider-job="${queuedPull.id}"]`).innerText(),
    /completed/,
  );
  // Keep operational details collapsed for primary screenshot; no credentials captured.
  const detail = page.locator(".connection-create[open]");
  for (const item of await detail.all()) await item.locator("summary").click();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: resolve(out, `connections-${width}.png`),
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page }).analyze();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    results.push({
      width,
      overflow,
      violations: scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Tab");
  assert(await page.evaluate(() => document.activeElement !== document.body));

  await page.setViewportSize({ width: 1440, height: 960 });
  await page
    .getByRole("button", { name: "Refresh connections", exact: true })
    .click();
  await page.locator(".connection-detail").waitFor();
  await page.getByText(/Scheduled metadata pulls/).click();
  const schedule = page.getByRole("form", {
    name: "Review or save pull schedule",
    exact: true,
  });
  await schedule
    .getByLabel("Future provider pulls", { exact: true })
    .selectOption("true");
  await schedule
    .getByLabel("Schedule approval rationale", { exact: true })
    .fill(
      "Preview the local synthetic schedule without enabling background imports.",
    );
  await schedule
    .getByRole("button", { name: "Review or save pull schedule", exact: true })
    .click();
  await page.getByText(/Preview: queue metadata pull/).waitFor();
  await schedule
    .getByLabel("Future provider pulls", { exact: true })
    .selectOption("false");
  await schedule
    .getByLabel("Schedule operation", { exact: true })
    .selectOption("false");
  await schedule
    .getByLabel("Schedule approval rationale", { exact: true })
    .fill(
      "Keep synthetic scheduled pulls paused after the browser verification.",
    );
  await schedule
    .getByRole("button", { name: "Review or save pull schedule", exact: true })
    .click();
  await page.getByText(/Scheduled metadata pulls.*Paused/).waitFor();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page
    .getByRole("heading", { name: "Configured evidence", exact: true })
    .waitFor();
  await page.getByText("Export configured evidence", { exact: true }).click();
  await page
    .getByLabel("Export purpose", { exact: true })
    .fill(
      "Verify permission-scoped synthetic evidence report through the actual worker.",
    );
  const queuedExportResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/reports/exports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Request scoped CSV export", exact: true })
    .click();
  const queuedExport = await (await queuedExportResponse).json();
  assert(queuedExport.id, "Export request must return its durable job");
  let download;
  for (let i = 0; i < 15; i++) {
    await page
      .getByRole("button", { name: "Refresh report", exact: true })
      .click();
    const links = page
      .locator(`[data-export-job="${queuedExport.id}"]`)
      .getByRole("link", { name: "Download CSV", exact: true });
    if (await links.count()) {
      download = links.first();
      break;
    }
    await page.waitForTimeout(700);
  }
  assert(download, "Export worker did not complete");
  const downloading = page.waitForEvent("download");
  await download.click();
  const artifact = await downloading;
  const csv = readFileSync(await artifact.path(), "utf8");
  assert.match(csv, /legal applicability unverified/);
  assert.match(csv, /driver_reference/);
  await page.getByText("Export configured evidence", { exact: true }).click();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => {
      scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: resolve(out, `reports-${width}.png`),
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page }).analyze();
    results.push({
      screen: "reports",
      width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      violations: scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
  const fixture = JSON.parse(
    readFileSync(resolve(root, ".local/product-review-context.json"), "utf8"),
  );
  let target;
  for (const driver of fixture.drivers) {
    const res = await ctx.request.get(
      `${base}/api/v1/tenants/${fixture.company_id}/drivers/${driver}/file`,
    );
    assert(res.ok());
    const file = await res.json();
    if (file.items.some((r) => r.status !== "verified")) {
      target = driver;
      break;
    }
  }
  assert(target, "Fixture must contain a real unverified requirement");
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({
        company: fixture.company_id,
        view: "drivers",
        driver: target,
      }),
  );
  const follow = page
    .locator("details")
    .filter({
      has: page.getByText("Follow up on this requirement", { exact: true }),
    })
    .first();
  await follow.locator("summary").click();
  if (
    await follow.getByLabel("What needs follow-up?", { exact: true }).count()
  ) {
    await follow
      .getByLabel("What needs follow-up?", { exact: true })
      .fill(
        "The configured synthetic requirement has no accepted evidence; investigate through the approved process.",
      );
    await follow
      .getByRole("button", { name: "Open follow-up case", exact: true })
      .click();
  }
  await page
    .getByRole("link", { name: "Open follow-up case", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Driver requirement", exact: true })
    .waitFor();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => {
      scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: resolve(out, `requirement-case-${width}.png`),
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page }).analyze();
    results.push({
      screen: "requirement-case",
      width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      violations: scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }

  writeFileSync(
    resolve(out, "results.json"),
    JSON.stringify(
      {
        results,
        failures,
        providerJob:
          "completed through actual separate HTTP simulator and worker",
      },
      null,
      2,
    ),
  );
  assert(results.every((r) => !r.overflow && !r.violations.length));
  assert(!failures.length);
  console.log(
    "Provider, schedule, private export and requirement-case browser journeys passed; twelve responsive accessibility captures.",
  );
} catch (error) {
  await page.evaluate(() => {
    scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true });
  console.log(
    "Visible errors:",
    await page.getByRole("alert").allTextContents(),
  );
  throw error;
} finally {
  await browser.close();
}
