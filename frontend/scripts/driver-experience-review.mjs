import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const root = resolve(".."),
  base = "http://localhost:5174";
const accounts = JSON.parse(
  readFileSync(resolve(root, ".local/ui-qa-accounts.json"), "utf8"),
);
const fixture = JSON.parse(
  readFileSync(resolve(root, ".local/product-review-context.json"), "utf8"),
);
const out = resolve(root, "docs/design/driver-experience");
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
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
  await page
    .getByRole("heading", { name: "Your company, at a glance.", exact: true })
    .waitFor();
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({
        company: fixture.company_id,
        view: "drivers",
        driver: fixture.drivers[1],
      }),
  );
  await page
    .getByRole("button", { name: "Driver profile", exact: true })
    .click();
  await page.locator(".driver-onboarding-tasks li").first().waitFor();
  await page.mouse.move(1, 1);
  await page.evaluate(async () => {
    await document.fonts.ready;
    scrollTo(0, 0);
    document.activeElement?.blur();
  });
  await page.screenshot({
    path: resolve(
      out,
      process.argv[2] === "before" ? "before-1440.png" : "after-1440.png",
    ),
    fullPage: true,
  });

  if (process.argv[2] !== "before") {
    const scans = [];
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function capture(name) {
      await page.mouse.move(1, 1);
      if (await page.locator(".profile-center-dialog[open]").count()) {
        await page.keyboard.press("Escape");
        await page
          .locator(".profile-center-dialog")
          .waitFor({ state: "detached" });
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
        scrollTo(0, 0);
        document.activeElement?.blur();
      });
      await page.screenshot({
        path: resolve(out, name + ".png"),
        fullPage: !(await page.locator("dialog[open]").count()),
      });
      const a = await new AxeBuilder({ page }).analyze();
      scans.push({
        name,
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        violations: a.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
    }
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await capture("profile-" + width);
    }
    const origin = page.locator(".driver-next-action button");
    await origin.click();
    const panel = page.getByRole("dialog");
    await panel.locator(".requirement-record").waitFor();
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      await capture("requirement-" + width);
    }
    await panel
      .getByRole("button", { name: "Close details", exact: true })
      .focus();
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      assert(
        await panel.evaluate((n) => n.contains(document.activeElement)),
        "Panel must contain keyboard focus",
      );
    }
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    assert(
      await origin.evaluate((n) => n === document.activeElement),
      "Restore exact triggering control",
    );
    await page.locator(".activity-event").first().click();
    await page
      .getByRole("heading", { name: "Recorded activity", exact: true })
      .waitFor();
    await capture("activity-1440");
    await page.keyboard.press("Escape");
    if (process.argv[2] !== "screens") {
    const csrf = (await context.cookies()).find(
      (c) => c.name === "qf_csrf",
    )?.value;
    async function post(path, data) {
      const r = await context.request.post(base + "/api/v1" + path, {
        data,
        headers: { Origin: base, "X-CSRF-Token": csrf },
      });
      assert(r.ok(), `Synthetic fixture ${r.status()}`);
      return r.json();
    }
    const driverBase = `/tenants/${fixture.company_id}/drivers`;
    const reference = "UX-" + Date.now();
    const original = await (
      await context.request.get(
        base + "/api/v1" + driverBase + "/" + fixture.drivers[1],
      )
    ).json();
    const driver = await post(driverBase, {
      command_id: randomUUID(),
      reference,
      first_name: "Alexandria Catherine",
      last_name: "Montgomery-Reynolds Synthetic UX",
      branch_id: original.engagements.find((e) => !e.end_date).branch_id,
      start_date: "2026-11-19",
    });
    await page.goto(
      base +
        "/#" +
        new URLSearchParams({
          company: fixture.company_id,
          view: "drivers",
          driver: driver.id,
        }),
    );
    await page
      .getByRole("button", { name: "Driver profile", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "A clear starting point", exact: true })
      .waitFor();
    await capture("empty-1440");
    assert.equal(await page.getByRole("progressbar").count(), 0);
    const catalog = await (
      await context.request.get(
        base + "/api/v1/tenants/" + fixture.company_id + "/requirements",
      )
    ).json();
    const definition = catalog.items.find((d) => !d.requires_expiry);
    assert(definition);
    await post(driverBase + "/" + driver.id + "/file/requirements", {
      definition_id: definition.id,
      engagement_id: driver.engagements[0].id,
    });
    await page
      .getByRole("button", { name: "Refresh driver profile", exact: true })
      .click();
    await page.locator(".driver-next-action button").click();
    await panel.locator("input[type=file]").waitFor();
    const filePath = driverBase + "/" + driver.id + "/file";
    const failPattern =
      "**/drivers/" + driver.id + "/file/requirements/*/evidence";
    await page.route(failPattern, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            message: "Synthetic upload unavailable. Retry the same file.",
          },
        }),
      }),
    );
    await panel
      .locator("input[type=file]")
      .setInputFiles({
        name: "synthetic-ux-training.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    await panel
      .getByRole("button", { name: "Upload for scanning", exact: true })
      .click();
    await panel
      .getByRole("alert")
      .filter({ hasText: "Synthetic upload unavailable" })
      .waitFor();
    assert.equal(
      await panel.locator(".action-confirmation").count(),
      0,
      "No fabricated upload success",
    );
    await capture("upload-error-1440");
    await page.unroute(failPattern);
    await panel
      .getByRole("button", { name: "Upload for scanning", exact: true })
      .click();
    await panel
      .getByRole("status")
      .filter({ hasText: "Evidence received privately" })
      .waitFor();
    await panel.locator(".evidence-journey").waitFor();
    assert.equal(await panel.locator("input[type=file]").inputValue(), "", "Successful upload clears the chooser so the same file can be selected as a new version");
    const scanDeadline = Date.now() + 45000;
    while (
      Date.now() < scanDeadline &&
      !(await panel
        .getByText("Review evidence version 1", { exact: true })
        .count())
    )
      await page.waitForTimeout(800);
    await panel.getByText("Review evidence version 1", { exact: true }).click();
    await panel
      .getByLabel("Review outcome", { exact: true })
      .selectOption("verified_evidence");
    for (const name of [
      "Driver identity and employer engagement agree",
      "Evidence matches this requirement category",
      "Evidence is readable and complete",
    ])
      await panel.getByLabel(name, { exact: true }).check();
    await panel
      .getByLabel("Review findings and verified basis", { exact: true })
      .fill(
        "Verified synthetic training identity, category and completeness. No legal eligibility determination.",
      );
    await panel
      .getByRole("button", { name: "Record evidence review", exact: true })
      .click();
    await panel
      .getByRole("status")
      .filter({ hasText: "Evidence review recorded" })
      .waitFor();
    await capture("review-recorded-1440");
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("progressbar").getAttribute("value"),
      "1",
    );
    assert.equal(await page.locator(".driver-next-action").count(), 0);
    await page
      .locator(".activity-event")
      .filter({ hasText: "Evidence review accepted" })
      .first()
      .waitFor();
    await capture("complete-1440");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const task = page.locator(".driver-onboarding-tasks details").first();
    await task.locator("summary").click();
    await task
      .getByRole("button", { name: "View requirement", exact: true })
      .click();
    assert.equal(
      await panel
        .locator(".work-detail-surface")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await panel
      .getByRole("button", {
        name: "Open full qualification file",
        exact: true,
      })
      .click();
    await page.waitForFunction(() =>
      document.activeElement?.id.startsWith("file-requirement-"),
    );
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page
      .getByRole("button", { name: "Driver profile", exact: true })
      .click();
    const failSummary = "**/drivers/" + driver.id + "/file";
    await page.route(failSummary, (route) => route.abort());
    await page
      .getByRole("button", { name: "Refresh driver profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Retry evidence summary", exact: true })
      .waitFor();
    assert.equal(await page.locator(".driver-next-action").count(), 0);
    await page.unroute(failSummary);
    await page
      .getByRole("button", { name: "Retry evidence summary", exact: true })
      .click();
    await page.getByRole("progressbar").waitFor();
    writeFileSync(
      resolve(out, "results.json"),
      JSON.stringify(
        {
          scans,
          errors,
          keyboard: true,
          focusRestoration: true,
          actualUploadScanReview: true,
          failedUploadNoSuccess: true,
          summaryRecovery: true,
          reducedMotion: true,
          fullFileNavigation: true,
          syntheticDriver: driver.id,
        },
        null,
        2,
      ),
    );
    assert(
      scans.every((s) => !s.overflow && !s.violations.length),
      JSON.stringify(scans.filter((s) => s.overflow || s.violations.length)),
    );
    assert.equal(errors.length, 0);
    console.log(
      "Connected driver journey passed: responsive/axe checks, real upload-scan-review, failure recovery, focus, reduced motion and full-file handoff.",
    );
    }
  }
} catch (error) {
  await page.screenshot({
    path: resolve(out, "failure.png"),
    fullPage: true,
    mask: [page.locator("input")],
  });
  throw error;
} finally {
  await browser.close();
}
