import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const root = resolve(".."),
  base = "http://localhost:5174";
const output = resolve(root, "docs/design/managed-product");
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
  const client = await login("client");
  await client.page
    .getByRole("heading", { name: "Your company, at a glance.", exact: true })
    .waitFor();
  await captures(client.page, "client-overview");
  await client.page.locator('.overview-context-details > summary').focus();
  await client.page.keyboard.press('Enter');
  assert.equal(await client.page.locator('.overview-context-details').getAttribute('open'), '');
  await client.page.screenshot({path:resolve(output,'expanded-context-1440.png'),fullPage:true});
  await client.page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await client.page.locator('.managed-overview').evaluate(el=>getComputedStyle(el).animationName),'none');
  await client.page.emulateMedia({reducedMotion:'no-preference'});
  await client.page.setViewportSize({ width: 1440, height: 960 });
  await client.page
    .getByLabel("Find a driver", { exact: true })
    .fill("PRODUCT-001");
  await client.page
    .locator(".workspace-search-results button")
    .first()
    .waitFor();
  await client.page.screenshot({
    path: resolve(output, "driver-search-1440.png"),
    fullPage: true,
  });
  await client.page
    .getByLabel("Find a driver", { exact: true })
    .press("Escape");
  await nav(client.page, "Drivers");
  await client.page
    .getByRole("heading", { name: "Driver registry", exact: true })
    .waitFor();
  await captures(client.page, "drivers");
  await nav(client.page, "Requests");
  await client.page
    .getByRole("heading", { name: "Client correspondence", exact: true })
    .waitFor();
  await client.page.locator(".message-record").first().waitFor();
  await captures(client.page, "client-requests");
  await nav(client.page, "Decisions");
  await client.page.locator(".approval-item").first().waitFor();
  await captures(client.page, "client-decisions");
  await nav(client.page, "Company settings", true);
  await client.page
    .getByRole("navigation", { name: "Company sections" })
    .waitFor();
  await captures(client.page, "company-settings");
  await client.page.setViewportSize({width:375,height:960});
  await client.page.getByRole('button',{name:'Open navigation',exact:true}).click();
  assert.equal(await client.page.locator('dialog[open]').count(),1);
  await client.page.keyboard.press('Escape');
  assert.equal(await client.page.locator('dialog[open]').count(),0);
  await client.page.locator('.header-account > summary').focus();
  await client.page.keyboard.press('Enter');
  await client.page.getByRole('button',{name:'Sign out',exact:true}).click();
  await client.page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  assert.equal((await client.page.request.get(base+'/api/v1/auth/me')).status(),401);
  await client.context.close();
  const specialist = await login("product_specialist");
  await specialist.page.goto(
    base +
      "/#" +
      new URLSearchParams({ company: fixture.company_id, view: "home" }),
  );
  await specialist.page
    .getByRole("heading", { name: "Your work, in focus.", exact: true })
    .waitFor();
  await captures(specialist.page, "specialist-overview");
  await nav(specialist.page, "Review queue");
  await specialist.page
    .getByRole("heading", { name: "File review", exact: true })
    .waitFor();
  await captures(specialist.page, "review-queue");
  await nav(specialist.page, "Cases");
  await specialist.page
    .getByRole("heading", { name: "Exceptions", exact: true })
    .last()
    .waitFor();
  await captures(specialist.page, "cases");
  await nav(specialist.page, "Screening inbox");
  await specialist.page
    .getByRole("heading", { name: "Screening intake", exact: true })
    .last()
    .waitFor();
  await captures(specialist.page, "screening-inbox");
  await specialist.context.close();
  writeFileSync(
    resolve(output, "results.json"),
    JSON.stringify({ results, failures, errors }, null, 2),
  );
} finally {
  writeFileSync(
    resolve(output, "results.json"),
    JSON.stringify({ results, failures, errors }, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    cases: results.length,
    violations: results.reduce((n, r) => n + r.violations.length, 0),
    overflows: results.filter((r) => r.overflow).length,
    requestFailures: failures.length,
    pageErrors: errors.length,
  }),
);
