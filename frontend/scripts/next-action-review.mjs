import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const root = resolve(".."),
  base = "http://localhost:5174";
const output = resolve(root, "docs/design/next-action");
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
  const client = await login("no_locations");
  await client.page
    .getByRole("heading", { name: "Your company, at a glance.", exact: true })
    .waitFor();
  const company = new URLSearchParams(
    new URL(client.page.url()).hash.slice(1),
  ).get("company");
  const csrf = (await client.context.cookies()).find(
    (c) => c.name === "qf_csrf",
  ).value;
  const path = `${base}/api/v1/tenants/${company}/drivers`;
  const search = await client.page.request.post(path + "/search", {
    headers: { Origin: base, "X-CSRF-Token": csrf },
    data: { q: "NEXTSTEP-QA" },
  });
  assert.equal(search.status(), 200);
  if ((await search.json()).total === 0) {
    const created = await client.page.request.post(path, {
      headers: { Origin: base, "X-CSRF-Token": csrf },
      data: {
        command_id: crypto.randomUUID(),
        reference: "NEXTSTEP-QA",
        first_name: "Synthetic",
        last_name: "Nextstep",
        start_date: "2026-11-01",
        branch_id: null,
      },
    });
    assert.equal(created.status(), 201);
    await client.page.reload();
  }
  await client.page
    .locator(".overview-driver-table tbody tr")
    .waitFor();
  assert.equal(await client.page.locator('.driver-next-step').count(),0);
  assert.equal(await client.page.locator('.driver-overview-panel > footer').count(),0);
  assert.equal(await client.page.locator(".activation-blockers").count(), 0);
  assert.equal(
    await client.page
      .getByRole("button", { name: "Add driver", exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  for (const width of [375, 768, 1024, 1440]) {
    await client.page.setViewportSize({ width, height: 960 });
    const scan = await new AxeBuilder({ page: client.page }).analyze();
    assert.deepEqual(
      scan.violations.map((v) => v.id),
      [],
    );
    const overflow = await client.page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false);
    await client.page.screenshot({
      path: resolve(output, `client-next-step-${width}.png`),
      fullPage: true,
    });
    results.push({ surface: "client", width, violations: [], overflow });
  }
  await client.page
    .getByRole("button", {
      name: "View file for driver NEXTSTEP-QA",
      exact: true,
    })
    .click();
  await client.page
    .getByRole("navigation", { name: "Driver sections", exact: true })
    .waitFor();
  await client.page
    .getByRole("heading", { name: "No requirements assigned", exact: true })
    .waitFor();
  await client.context.close();
  const admin = await login("admin");
  await admin.page.goto(
    base + "/#" + new URLSearchParams({ company, view: "home" }),
  );
  await admin.page.locator(".metadata-overview .activation-blockers").waitFor();
  await admin.page.locator(".account-status > summary").click();
  await admin.page
    .locator(".account-status-popover .activation-blockers")
    .waitFor();
  await admin.page.screenshot({
    path: resolve(output, "administrator-blockers-1440.png"),
    fullPage: true,
  });
  assert.deepEqual(
    (await new AxeBuilder({ page: admin.page }).analyze()).violations.map(
      (v) => v.id,
    ),
    [],
  );
  await admin.context.close();
  const employee=await login('product_specialist');
  await employee.page.goto(base+'/#'+new URLSearchParams({company:fixture.company_id,view:'home'}));
  await employee.page.getByRole('heading',{name:'Your work, in focus.',exact:true}).waitFor();
  for(const width of [375,1440]) {
    await employee.page.setViewportSize({width,height:960});
    assert.deepEqual((await new AxeBuilder({page:employee.page}).analyze()).violations.map(v=>v.id),[]);
    assert.equal(await employee.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await employee.page.screenshot({path:resolve(output,`employee-workspace-${width}.png`),fullPage:true});
    results.push({surface:'employee',width,violations:[],overflow:false});
  }
  await employee.context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({
      viewports: 4,
      violations: 0,
      overflow: 0,
      duplicateCTA: "absent",
      driverFileNavigation: "passed",
      adminBlockerPrivacy: "passed",
    }),
  );
} finally {
  writeFileSync(
    resolve(output, "results.json"),
    JSON.stringify({ results, failures, errors }, null, 2),
  );
  await browser.close();
}
