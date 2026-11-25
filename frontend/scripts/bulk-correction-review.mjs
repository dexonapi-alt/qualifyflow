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
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
const staffAccounts = JSON.parse(
  readFileSync(resolve(root, ".local/e2e-accounts.json"), "utf8"),
);
const out = resolve(root, "docs/design/bulk-corrections");
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
async function capture(name) {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    if (name === "mixed-preview")
      await page.locator(".bulk-preview").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.activeElement?.blur();
      return document.fonts.ready;
    });
    await page.screenshot({
      path: resolve(out, `${name}-${width}.png`),
      fullPage: !(await page.getByRole("dialog").count()),
      animations: "disabled",
    });
    const a = await new AxeBuilder({ page }).analyze();
    scans.push({
      name,
      width,
      violations: a.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function post(path, data) {
  const csrf = (await context.cookies()).find(
    (c) => c.name === "qf_csrf",
  ).value;
  const response = await context.request.post(base + "/api/v1" + path, {
    headers: { Origin: base, "X-CSRF-Token": csrf },
    data,
  });
  assert(response.ok(), "API request failed: " + response.status());
  return response.json();
}
try {
  await page.goto(base);
  const account = accounts.product_specialist;
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totp(account.secret));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: /^(Companies|Your work, in focus\.)$/ })
    .waitFor();
  const apiBase = "/tenants/" + fixture.company_id + "/intake-batches";
  const runKey = Date.now();
  const csv =
    "Driver,Report,Kind,When\nWRONG1,BULK-" +
    runKey +
    "-1,background_screening,2026-11-17\nWRONG2,BULK-" +
    runKey +
    "-2,background_screening,tomorrow\nUNCHANGED,BULK-" +
    runKey +
    "-3,background_screening,2026-11-17\n";
  const receipt = await post(apiBase + "/spreadsheet/receive", {
    command_id: randomUUID(),
    filename: "bulk-synthetic.csv",
    content_base64: Buffer.from(csv).toString("base64"),
    mapping: {
      client_ref: -1,
      external_driver_ref: 0,
      external_report_ref: 1,
      report_type: 2,
      reported_at: 3,
    },
  });
  const driverResponse = await context.request.get(
    base +
      "/api/v1/tenants/" +
      fixture.company_id +
      "/drivers/" +
      fixture.drivers[0],
  );
  assert(driverResponse.ok());
  const driver = await driverResponse.json();
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({
        company: fixture.company_id,
        view: "intake",
        batch: receipt.id,
      }),
  );
  await page.getByLabel("Select source row 1", { exact: true }).waitFor();
  await capture("receipt-before");
  for (const n of [1, 2, 3])
    await page.getByLabel("Select source row " + n, { exact: true }).check();
  await page
    .getByRole("button", { name: "Correct selected rows", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await capture("editor");
  await page
    .getByLabel("Row 1 Driver reference", { exact: true })
    .fill(driver.reference);
  await page
    .getByLabel("Row 2 Reported date (YYYY-MM-DD)", { exact: true })
    .fill("still-wrong");
  await page
    .getByLabel("Verified basis for these corrections")
    .fill(
      "Synthetic QA verified the preserved client handoff and corrected only the stated metadata fields.",
    );
  await page
    .getByRole("button", { name: "Preview corrections", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Correction preview" })
    .getByText(/1 ready/)
    .waitFor();
  await page
    .getByRole("heading", { name: "Check each outcome" })
    .scrollIntoViewIfNeeded();
  await capture("mixed-preview");
  const requestPromise = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/correction-runs"),
  );
  await page
    .getByRole("button", { name: "Record corrections", exact: true })
    .click();
  const originalRequest = (await requestPromise).postDataJSON();
  await page
    .getByRole("region", { name: "Recorded correction outcomes" })
    .waitFor();
  await page
    .locator(".work-detail-surface")
    .evaluate((el) => el.scrollTo(0, 0));
  await capture("recorded-outcomes");
  const replay = await post(
    apiBase + "/" + receipt.id + "/correction-runs",
    originalRequest,
  );
  assert(replay.replayed);
  assert.deepEqual(
    replay.items.map((r) => r.outcome),
    ["corrected", "blocked", "unchanged"],
  );
  await page
    .getByRole("button", { name: "Return to receipt", exact: true })
    .click();
  assert(
    await page.getByLabel("Select source row 1", { exact: true }).isDisabled(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("Select source row 2", { exact: true }).focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Correct selected rows", exact: true })
    .click();
  await page
    .getByLabel("Row 2 Reported date (YYYY-MM-DD)", { exact: true })
    .fill("2026-11-18");
  await page
    .getByLabel("Verified basis for these corrections")
    .fill(
      "Synthetic QA verified the missing report date using the original source handoff.",
    );
  await page
    .getByRole("button", { name: "Preview corrections", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record corrections", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Recorded correction outcomes" })
    .waitFor();
  await page
    .getByRole("button", { name: "Return to receipt", exact: true })
    .click();
  await page.getByText("Recent correction runs (2)", { exact: true }).click();
  await page.locator(".bulk-history > details > summary").first().click();
  await capture("persisted-history");
  const historyResponse = await context.request.get(
    base + "/api/v1" + apiBase + "/" + receipt.id + "/correction-runs",
  );
  assert(historyResponse.ok());
  assert.equal((await historyResponse.json()).items.length, 2);
  await page
    .getByRole("button", { name: "Open replacement for row 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review source row", exact: true })
    .waitFor();
  assert(
    await page.getByText("BULK-" + runKey + "-2", { exact: false }).count(),
  );
  assert.equal(errors.length, 0);
  writeFileSync(
    resolve(out, "results.json"),
    JSON.stringify({ scans, errors }, null, 2),
  );
  assert(
    scans.every((x) => !x.overflow && !x.violations.length),
    "Accessibility/reflow findings",
  );
  console.log(
    "Bulk correction preview/partial receipt/replay/failed-row retry/history/replacement journey passed; " +
      scans.length +
      " responsive checks.",
  );
} catch (e) {
  await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true });
  console.log(
    "Visible errors:",
    await page.getByRole("alert").allTextContents(),
  );
  throw e;
} finally {
  await browser.close();
}
