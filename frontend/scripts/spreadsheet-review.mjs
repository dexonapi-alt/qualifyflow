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
const out = resolve(root, "docs/design/spreadsheet-intake");
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
    await page.evaluate(() => document.fonts.ready);
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
  const xlsx = execFileSync(
    resolve(root, "backend/.venv/Scripts/python.exe"),
    [
      "-c",
      "import io,base64; from openpyxl import Workbook; w=Workbook(); w.active.append(['Driver','Report','Kind','Date']); w.active.append(['0007','SYN-XLSX','background_screening','2026-11-17']); b=io.BytesIO(); w.save(b); print(base64.b64encode(b.getvalue()).decode())",
    ],
    { encoding: "utf8" },
  ).trim();
  const csrf = (await context.cookies()).find(
    (c) => c.name === "qf_csrf",
  ).value;
  const inspected = await context.request.post(
    base +
      "/api/v1/tenants/" +
      fixture.company_id +
      "/intake-batches/spreadsheet/inspect",
    {
      headers: { Origin: base, "X-CSRF-Token": csrf },
      data: { filename: "synthetic.xlsx", content_base64: xlsx },
    },
  );
  assert(inspected.ok(), "Real XLSX scanner/inspection failed");
  assert.equal((await inspected.json()).sample[0][0], "0007");
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({ company: fixture.company_id, view: "intake" }),
  );
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .waitFor();
  await capture("receipt-list");
  await page
    .getByRole("button", { name: "Import spreadsheet", exact: true })
    .click();
  const csv =
    "Person ID,Report ID,Kind,Date\nNO-MATCH,SYN-MAPPED-" +
    Date.now() +
    ",background_screening,2026-11-17\n";
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-client-handoff.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page
    .getByRole("button", { name: "Inspect spreadsheet", exact: true })
    .click();
  await page
    .getByLabel("Source column for Company reference")
    .selectOption("-1");
  for (const [label, value] of [
    ["Driver reference", "0"],
    ["Report reference", "1"],
    ["Report type", "2"],
    ["Reported date", "3"],
  ])
    await page.getByLabel("Source column for " + label).selectOption(value);
  await capture("column-mapping");
  await page
    .getByRole("button", { name: "Preview mapped rows", exact: true })
    .click();
  await page.getByRole("heading", { name: "Check before recording" }).waitFor();
  await capture("mapped-preview");
  await page
    .getByRole("button", { name: "Confirm mapped receipt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review source row", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Review source row", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await capture("source-review");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  const driverResponse = await context.request.get(
    base +
      "/api/v1/tenants/" +
      fixture.company_id +
      "/drivers/" +
      fixture.drivers[0],
  );
  assert(driverResponse.ok());
  const driver = await driverResponse.json();
  await page
    .getByRole("button", { name: "Review source row", exact: true })
    .click();
  await page.getByText("Correct source metadata", { exact: true }).click();
  await page
    .getByLabel("Driver reference", { exact: true })
    .fill(driver.reference);
  await page
    .getByLabel("Verified basis for this correction", { exact: true })
    .fill(
      "Synthetic QA: verified stable reference against the preserved training source.",
    );
  await page
    .getByRole("button", { name: "Record corrected receipt", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Review source row", exact: true })
    .click();
  await page.locator(".intake-driver-choices button").first().click();
  await page
    .getByLabel("Type the verified company driver reference")
    .fill(driver.reference);
  await page
    .getByLabel("Evidence used to verify this match")
    .fill(
      "Synthetic QA: confirmed stable reference and current employer engagement.",
    );
  await page
    .getByRole("button", { name: "Confirm reviewed driver match", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Open driver file", exact: true })
    .waitFor();
  await capture("reviewed-match");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Open driver file", exact: true })
    .click();
  await page.locator(".qualification-workspace").waitFor();
  await page.keyboard.press("Tab");
  assert(
    await page
      .locator("body")
      .evaluate((el) => el.contains(document.activeElement)),
  );
  await page.keyboard.press("Escape");
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
    "Mapped CSV browser journey passed; " +
      scans.length +
      " responsive accessibility captures.",
  );
} finally {
  await browser.close();
}
