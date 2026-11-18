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
const fixture = JSON.parse(
  readFileSync(resolve(root, ".local/product-review-context.json"), "utf8"),
);
const out = resolve(root, "docs/design/profile-center");
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
const scans = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function profile(p) {
  await p.goto(
    base +
      "/#" +
      new URLSearchParams({
        company: fixture.company_id,
        view: "drivers",
        driver: fixture.drivers[1],
      }),
  );
  await p.getByRole("button", { name: "Driver profile", exact: true }).click();
  await p.locator(".profile-focus-source").waitFor();
  await p.getByText(/Loading this driver/).waitFor({ state: "hidden" });
  await p.evaluate(() => {
    scrollTo(0, 0);
    document.activeElement?.blur();
  });
  await p.mouse.move(1, 1);
}
async function centered(p) {
  await p.locator(".profile-center-dialog[open]").waitFor();
  await p.waitForFunction(() => {
    const e = document.querySelector(".profile-center-card");
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return (
      Math.abs(r.x + r.width / 2 - innerWidth / 2) < 2 &&
      Math.abs(r.y + r.height / 2 - innerHeight / 2) < 2
    );
  });
}
async function scan(p, name) {
  const result = await new AxeBuilder({ page: p }).analyze();
  scans.push({
    name,
    overflow: await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
}
async function closed(p, automatic = false) {
  await p.locator(".profile-center-dialog").waitFor({ state: "detached" });
  if (automatic) {
    await p.waitForFunction(
      () =>
        !document
          .querySelector(".profile-focus-source")
          ?.contains(document.activeElement),
    );
    return;
  }
  await p.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Expand driver profile",
  );
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
  await page
    .getByRole("heading", { name: "Your company, at a glance.", exact: true })
    .waitFor();
  await profile(page);
  const background = await page.locator(".driver-profile-work").boundingBox(),
    overflow = await page.evaluate(() => document.body.style.overflow);
  const home = await page.locator(".profile-focus-source").boundingBox();
  await page.screenshot({
    path: resolve(out, "resting-1440.png"),
    fullPage: true,
  });
  const flightPromise = page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let first = 0;
        const deadline = performance.now() + 4000;
        function sample() {
          const now = performance.now(),
            card = document.querySelector(".profile-center-card");
          if (card) {
            if (!first) first = now;
            const r = card.getBoundingClientRect();
            frames.push({
              x: r.x,
              y: r.y,
              opacity: getComputedStyle(card).opacity,
              backgroundOpacity: getComputedStyle(
                document.querySelector(".product"),
              ).opacity,
            });
          }
          if ((first && now - first > 450) || now > deadline) resolve(frames);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),
  );
  await page.locator(".profile-focus-source .driver-person-cover").hover();
  await page.locator(".profile-center-dialog[open]").waitFor();
  assert.equal(
    await page
      .locator(".profile-center-card")
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  await centered(page);
  const flight = await flightPromise;
  assert(
    new Set(flight.map((frame) => Math.round(frame.x))).size > 3,
    "Card must travel through intermediate positions",
  );
  assert(
    flight.every(
      (frame) => frame.opacity === "1" && frame.backgroundOpacity === "1",
    ),
    "No content fades during flight",
  );
  assert.equal(
    await page
      .locator(".product")
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  assert.equal(
    await page
      .locator(".driver-profile-work")
      .evaluate((el) => getComputedStyle(el).visibility),
    "visible",
  );
  const after = await page.locator(".driver-profile-work").boundingBox();
  assert(
    Math.abs(background.x - after.x) < 1 &&
      Math.abs(background.y - after.y) < 1,
  );
  await page.screenshot({
    path: resolve(out, "centered-1440.png"),
    fullPage: true,
  });
  await scan(page, "desktop-centered");
  assert.equal(
    await page.locator(".profile-center-close").count(),
    0,
    "No visible X control",
  );
  await page.mouse.move(720, 480, { steps: 12 });
  await page.waitForTimeout(200);
  assert(
    await page.locator(".profile-center-dialog[open]").count(),
    "Centered card retains pointer",
  );
  await page.mouse.move(home.x + 20, home.y + 25, { steps: 12 });
  await page.waitForTimeout(200);
  assert(
    await page.locator(".profile-center-dialog[open]").count(),
    "Invisible original footprint retains pointer",
  );
  await page.mouse.click(home.x + 20, home.y + 25);
  assert(
    await page.locator(".profile-center-dialog[open]").count(),
    "Original footprint remains a safe pointer region",
  );
  await page.mouse.move(1430, 950, { steps: 8 });
  await closed(page, true);
  await page.locator(".profile-focus-source .driver-person-cover").hover();
  await centered(page);
  await page.mouse.move(1430, 950, { steps: 8 });
  await page.locator(".profile-center-dialog[data-closing]").waitFor();
  await page.mouse.move(720, 480, { steps: 4 });
  await centered(page);
  assert.equal(
    await page.locator(".profile-center-dialog[data-closing]").count(),
    0,
    "Reentry reverses an automatic return",
  );
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    assert(
      await page
        .locator(".profile-center-dialog")
        .evaluate((el) => el.contains(document.activeElement)),
    );
  }
  await page.keyboard.press("Escape");
  await closed(page);
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    overflow,
  );
  assert(await page.locator(".profile-focus-source").isVisible());
  await page
    .getByRole("button", { name: "Expand driver profile", exact: true })
    .click();
  await centered(page);
  await page.mouse.move(1430, 950, { steps: 8 });
  await closed(page, true);
  if (!(await page.locator(".profile-center-dialog[open]").count())) {
    await page
      .getByRole("button", { name: "Expand driver profile", exact: true })
      .focus();
    await page.keyboard.press("Enter");
  }
  await centered(page);
  await page
    .locator(".profile-center-dialog")
    .click({ position: { x: 4, y: 4 } });
  await closed(page);
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 960 });
    if (!(await page.locator(".profile-center-dialog[open]").count())) {
      await page
        .getByRole("button", { name: "Expand driver profile", exact: true })
        .focus();
      await page.keyboard.press("Enter");
    }
    await centered(page);
    await scan(page, "width-" + width);
    await page.keyboard.press("Escape");
    await closed(page);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (!(await page.locator(".profile-center-dialog[open]").count())) {
    await page
      .getByRole("button", { name: "Expand driver profile", exact: true })
      .focus();
    await page.keyboard.press("Enter");
  }
  await centered(page);
  await scan(page, "reduced-motion");
  await page.keyboard.press("Escape");
  await closed(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  if (!(await page.locator(".profile-center-dialog[open]").count())) {
    await page
      .getByRole("button", { name: "Expand driver profile", exact: true })
      .focus();
    await page.keyboard.press("Enter");
  }
  await centered(page);
  await page
    .locator(".profile-center-dialog")
    .getByRole("button", { name: /Open qualification file/ })
    .click();
  await page
    .getByRole("heading", { name: "Qualification file", exact: true })
    .waitFor();
  assert.equal(await page.locator(".profile-center-dialog").count(), 0);
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    overflow,
  );
  const touch = await browser.newContext({
    viewport: { width: 375, height: 900 },
    isMobile: true,
    hasTouch: true,
    storageState: await context.storageState(),
  });
  const mobile = await touch.newPage();
  await profile(mobile);
  await mobile.locator(".profile-focus-source .driver-person-cover").tap();
  assert.equal(await mobile.locator(".profile-center-dialog").count(), 0);
  await mobile
    .getByRole("button", { name: "Expand driver profile", exact: true })
    .tap();
  await centered(mobile);
  await scan(mobile, "touch-375");
  await mobile.screenshot({
    path: resolve(out, "centered-375.png"),
    fullPage: true,
  });
  await mobile
    .locator(".profile-center-dialog")
    .tap({ position: { x: 4, y: 4 } });
  await closed(mobile);
  await touch.close();
  assert(!errors.length);
  assert(scans.every((s) => !s.overflow && !s.violations.length));
  writeFileSync(
    resolve(out, "results.json"),
    JSON.stringify(
      {
        scans,
        errors,
        noContentFade: true,
        originalFootprintRetains: true,
        automaticReturn: true,
        interruptibleReturn: true,
        noVisibleCloseButton: true,
        stableBackground: true,
        focusTrap: true,
        escapeAndBackdrop: true,
        focusRestoration: true,
        realFileAction: true,
        touch: true,
        reducedMotion: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Centered Motion profile passed: hover travel, no content fade, stable background, dismissal, focus, touch, reduced motion and real file navigation.",
  );
} catch (error) {
  await page.evaluate(() =>
    document.querySelectorAll("input").forEach((e) => (e.value = "")),
  );
  await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
