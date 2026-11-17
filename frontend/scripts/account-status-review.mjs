import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const root = resolve(".."),
  base = "http://localhost:5174";
const output = resolve(root, "docs/design/account-status");
mkdirSync(output, { recursive: true });
const accounts = JSON.parse(
  readFileSync(resolve(root, ".local/ui-qa-accounts.json"), "utf8"),
);
const fixture = JSON.parse(
  readFileSync(resolve(root, ".local/product-review-context.json"), "utf8"),
);
const browser = await chromium.launch();
const results = [],
  failures = [],
  errors = [];
function totp(secret) {
  let bits = "";
  for (const c of secret)
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest(),
    offset = hash[19] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function login(key) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    errors.push({ role: key, message: error.message }),
  );
  page.on("response", (response) => {
    if (
      response.url().includes("/api/") &&
      response.status() >= 400 &&
      !response.url().includes("/auth/me")
    )
      failures.push({
        role: key,
        status: response.status(),
        path: new URL(response.url()).pathname,
      });
  });
  await page.goto(base);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(accounts[key].email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(accounts[key].password);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totp(accounts[key].secret));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator(".product").waitFor();
  return { context, page };
}
async function captures(page, name) {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(1, 1);
    await page.screenshot({
      path: resolve(output, `${name}-${width}.png`),
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page }).analyze();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    results.push({
      name,
      width,
      overflow,
      violations: scan.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
}
async function nav(page, title, administration = false) {
  if (page.viewportSize().width <= 760)
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  const region = page.locator("#workspace-navigation");
  const target = region.getByRole("button", { name: title, exact: true });
  if (
    !(await target.isVisible()) &&
    (await region.locator(".workspace-tools").count())
  )
    await region.locator(".workspace-tools summary").click();
  await target.click();
}
try {
  const { page, context } = await login("no_locations");
  await page
    .getByRole("heading", { name: "Your company, at a glance.", exact: true })
    .waitFor();
  assert.equal(await page.locator(".account-context-note").count(), 0);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    const control = page.locator(".account-status > summary");
    await control.focus();
    await page.keyboard.press("Enter");
    await page
      .getByText(
        "Your service administrator handles configuration and activation.",
        { exact: false },
      )
      .waitFor();
    const scan = await new AxeBuilder({ page }).analyze();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.deepEqual(
      scan.violations.map((v) => v.id),
      [],
    );
    assert.equal(overflow, false);
    await page.screenshot({
      path: resolve(output, `draft-open-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(".account-status").getAttribute("open"),
      null,
    );
    assert.equal(
      await control.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.screenshot({
      path: resolve(output, `draft-closed-${width}.png`),
      fullPage: true,
    });
    results.push({ width, violations: [], overflow });
  }
  await page.locator(".account-status > summary").click();
  await page
    .getByRole("button", { name: "Close account status", exact: true })
    .click();
  assert.equal(
    await page.locator(".account-status").getAttribute("open"),
    null,
  );
  await page.locator(".account-status > summary").click();
  await page.getByRole("button", { name: "View account", exact: true }).click();
  await page.getByRole("navigation", { name: "Company sections" }).waitFor();
  assert.equal(
    await page.locator(".account-status").getAttribute("open"),
    null,
  );
  await page.reload();
  await page.getByRole("navigation", { name: "Company sections" }).waitFor();
  assert.equal(await page.locator(".account-status").count(), 1);
  await context.close();
  const active = await login("client");
  await active.page
    .getByRole("heading", { name: "Your company, at a glance.", exact: true })
    .waitFor();
  assert.equal(await active.page.locator(".account-status").count(), 0);
  await active.context.close();
  assert.deepEqual(failures, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      viewports: results.length,
      violations: 0,
      overflow: 0,
      closeEscapeFocusRouteReloadAndActiveState: "passed",
    }),
  );
} finally {
  writeFileSync(
    resolve(output, "results.json"),
    JSON.stringify({ results, failures, errors }, null, 2),
  );
  await browser.close();
}
