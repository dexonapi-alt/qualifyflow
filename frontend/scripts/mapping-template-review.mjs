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
const out = resolve(root, "docs/design/mapping-templates");
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

const name = "Weekly synthetic handoff " + Date.now();
async function newImport(reordered = false) {
  if (
    await page
      .getByRole("button", { name: "Back to receipts", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Back to receipts", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  const headers = reordered
    ? "Report,Driver,Kind,When"
    : "Driver,Report,Kind,When";
  const values = reordered
    ? "R-" + Date.now() + ",NO-MATCH"
    : "NO-MATCH,R-" + Date.now();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "weekly-synthetic.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        headers + "\n" + values + ",background_screening,2026-11-17\n",
      ),
    });
  await page
    .getByRole("button", { name: "Inspect spreadsheet", exact: true })
    .click();
  await page.getByRole("heading", { name: "Connect your columns" }).waitFor();
}
async function choose(version) {
  const select = page.getByLabel("Saved mapping", { exact: true });
  await select.selectOption({
    label: name + " " + String.fromCharCode(183) + " v" + version,
  });
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
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({ company: fixture.company_id, view: "intake" }),
  );
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .waitFor();
  await newImport();
  for (const [label, value] of [
    ["Company reference", "-1"],
    ["Driver reference", "0"],
    ["Report reference", "1"],
    ["Report type", "2"],
    ["Reported date", "3"],
  ])
    await page.getByLabel("Source column for " + label).selectOption(value);
  await page
    .getByRole("button", { name: "Preview mapped rows", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm mapped receipt", exact: true })
    .click();
  await page
    .getByText("Original file & column mapping", { exact: true })
    .click();
  await page.getByText("Save this column mapping", { exact: true }).click();
  await page.getByLabel("Mapping name", { exact: true }).fill(name);
  await page
    .getByLabel("Why this mapping is suitable", { exact: true })
    .fill(
      "Synthetic QA confirmed stable column names and ordering from the recorded client handoff.",
    );
  await page
    .getByRole("button", { name: "Save reusable mapping", exact: true })
    .click();
  await page
    .getByText("Mapping saved for this company and intake location.", {
      exact: true,
    })
    .waitFor();
  await capture("saved-from-receipt");
  await newImport();
  await choose(1);
  await page.getByLabel("Saved mapping", { exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Apply mapping",
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getByLabel("Source column for Driver reference").inputValue(),
    "0",
  );
  await capture("reuse-mapping");
  await page
    .getByRole("button", { name: "Preview mapped rows", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm mapped receipt", exact: true })
    .click();
  await page
    .getByText("Original file & column mapping", { exact: true })
    .click();
  await page.getByText("Save this column mapping", { exact: true }).click();
  await page
    .getByLabel("Save as", { exact: true })
    .selectOption({
      label: "New revision of " + name + " " + String.fromCharCode(183) + " v1",
    });
  await page.getByLabel("Mapping name", { exact: true }).fill(name);
  await page
    .getByLabel("Why this mapping is suitable", { exact: true })
    .fill(
      "Synthetic QA reviewed and reconfirmed the next saved mapping revision.",
    );
  await page
    .getByRole("button", { name: "Save reusable mapping", exact: true })
    .click();
  await page
    .getByText("Mapping saved for this company and intake location.", {
      exact: true,
    })
    .waitFor();
  await newImport(true);
  await choose(2);
  assert(
    await page
      .getByRole("button", { name: "Apply mapping", exact: true })
      .isDisabled(),
  );
  await capture("layout-change-blocked");
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  await newImport();
  await choose(2);
  await page
    .getByRole("button", { name: "Apply mapping", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview mapped rows", exact: true })
    .click();
  await page.getByText("Retire this mapping", { exact: true }).click();
  await page
    .getByLabel("Reason for retiring this mapping")
    .fill(
      "Synthetic QA retired this layout to verify stale import protection and preserved history.",
    );
  await page
    .getByRole("button", { name: "Retire saved mapping", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retire saved mapping", exact: true })
    .waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Confirm mapped receipt", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "changed or was retired" })
    .waitFor();
  await capture("retired-import-blocked");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Use manual mapping", exact: true })
    .click();
  await page.keyboard.press("Tab");
  await page
    .getByRole("button", { name: "Preview mapped rows", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm mapped receipt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to receipts", exact: true })
    .waitFor();
  writeFileSync(
    resolve(out, "results.json"),
    JSON.stringify({ scans, errors }, null, 2),
  );
  assert.equal(errors.length, 0);
  assert(
    scans.every((x) => !x.overflow && !x.violations.length),
    "Accessibility/reflow findings",
  );
  console.log(
    "Saved mapping creation/reuse/revision/layout mismatch/retirement/recovery passed; " +
      scans.length +
      " responsive checks.",
  );
} catch (e) {
  await page.screenshot({ path: resolve(out, "failure.png"), fullPage: true });
  console.log(
    "Visible intake errors:",
    await page.getByRole("alert").allTextContents(),
  );
  throw e;
} finally {
  await browser.close();
}
