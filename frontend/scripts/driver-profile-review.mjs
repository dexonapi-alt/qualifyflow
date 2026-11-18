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
const out = resolve(root, "docs/design/driver-profile");
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

const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  }),
  page = await context.newPage();
page.setDefaultTimeout(20000);
const results = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function capture(name) {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.activeElement?.blur();
    });
    await page.screenshot({
      path: resolve(out, `${name}-${width}.png`),
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
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
}
async function profile(driver) {
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({
        company: fixture.company_id,
        view: "drivers",
        driver,
      }),
  );
  await page.getByRole("navigation", { name: "Driver sections" }).waitFor();
  await page
    .getByRole("button", { name: "Driver profile", exact: true })
    .click();
  await page.locator(".driver-profile-layout").waitFor();
  await page.getByText(/Loading this driver/).waitFor({ state: "hidden" });
}
async function post(path, data) {
  const csrf = (await context.cookies()).find(
    (c) => c.name === "qf_csrf",
  )?.value;
  const res = await context.request.post(base + "/api/v1" + path, {
    data,
    headers: { Origin: base, "X-CSRF-Token": csrf },
  });
  assert(res.ok(), `${path}: ${res.status()}`);
  return res.json();
}
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
  await profile(fixture.drivers[1]);
  assert(await page.locator(".driver-onboarding-tasks li").count());
  await capture("profile");
  const task = page.locator(".driver-onboarding-tasks details").first();
  await task.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert((await task.getAttribute("open")) !== null);
  await task
    .getByRole("button", { name: "View requirement", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", {name:"Open full qualification file", exact:true}).click();
  await page.waitForFunction(() =>
    document.activeElement?.id.startsWith("file-requirement-"),
  );
  await page
    .getByRole("button", { name: "Driver profile", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".driver-profile-layout summary")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const detail = await (
    await context.request.get(
      base +
        `/api/v1/tenants/${fixture.company_id}/drivers/${fixture.drivers[0]}`,
    )
  ).json();
  const record = await post(`/tenants/${fixture.company_id}/drivers`, {
    command_id: randomUUID(),
    reference: "PROFILE-" + Date.now(),
    first_name: "Alexandria Catherine",
    last_name: "Montgomery-Reynolds Synthetic Training",
    start_date: "2026-11-18",
    branch_id: detail.engagements.find((e) => !e.end_date)?.branch_id || null,
  });
  await profile(record.id);
  await page
    .getByRole("heading", { name: "A clear starting point", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("progressbar").count(), 0);
  await capture("empty-long-name");
  const catalog = await (
    await context.request.get(
      base + `/api/v1/tenants/${fixture.company_id}/requirements`,
    )
  ).json();
  await post(
    `/tenants/${fixture.company_id}/drivers/${record.id}/file/requirements`,
    {
      definition_id: catalog.items[0].id,
      engagement_id: record.engagements[0].id,
    },
  );
  await profile(record.id);
  await page
    .getByRole("button", { name: "Refresh driver profile", exact: true })
    .click();
  await page.locator(".driver-onboarding-tasks li").waitFor();
  assert.equal(await page.locator(".driver-onboarding-tasks li").count(), 1);
  await capture("single-requirement");
  await page.route("**/drivers/" + record.id + "/file", (route) =>
    route.abort(),
  );
  await profile(record.id);
  await page
    .getByRole("button", { name: "Refresh driver profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry evidence summary", exact: true })
    .waitFor();
  await page.screenshot({
    path: resolve(out, "error-1440.png"),
    fullPage: true,
  });
  await page.unroute("**/drivers/" + record.id + "/file");
  await page
    .getByRole("button", { name: "Retry evidence summary", exact: true })
    .click();
  await page.getByRole("progressbar").waitFor();
  writeFileSync(
    resolve(out, "results.json"),
    JSON.stringify(
      {
        results,
        errors,
        keyboard: true,
        reducedMotion: true,
        requirementFocus: true,
        errorRecovery: true,
      },
      null,
      2,
    ),
  );
  assert(results.every((r) => !r.overflow && !r.violations.length));
  assert(!errors.length);
  console.log(
    "Driver profile: 12 responsive/axe captures, real empty/single/multiple records, keyboard, focused file navigation, reduced motion and error recovery passed.",
  );
} catch (error) {
  await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
