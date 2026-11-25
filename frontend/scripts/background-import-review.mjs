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
const out = resolve(root, "docs/design/background-imports");
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
page.setDefaultTimeout(30000);
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

const stamp = Date.now(),
  filename = "synthetic-background-" + stamp + ".xlsx";
async function chooseFile(name, buffer) {
  await page.getByLabel("Spreadsheet file", { exact: true }).setInputFiles({
    name,
    mimeType: name.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv",
    buffer,
  });
  await page
    .getByRole("button", { name: "Queue private file", exact: true })
    .click();
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
    .getByRole("button", { name: "Background imports", exact: true })
    .click();
  await capture("upload");
  const driverResponse = await context.request.get(
    base +
      "/api/v1/tenants/" +
      fixture.company_id +
      "/drivers/" +
      fixture.drivers[0],
  );
  assert(driverResponse.ok());
  const driver = await driverResponse.json();
  const encoded = execFileSync(
    resolve(root, "backend/.venv/Scripts/python.exe"),
    [
      "-c",
      "import io,base64,sys; from openpyxl import Workbook; w=Workbook(); w.active.append(['Driver','Report','Kind','When']); [(w.active.append([sys.argv[1] if i==0 else 'NO-MATCH-'+str(i),'BG-'+sys.argv[2]+'-'+str(0 if i==119 else i),'background_screening','bad-date' if i==5 else '2026-11-17'])) for i in range(125)]; b=io.BytesIO(); w.save(b); print(base64.b64encode(b.getvalue()).decode())",
      driver.reference,
      String(stamp),
    ],
    { encoding: "utf8" },
  ).trim();
  await chooseFile(filename, Buffer.from(encoded, "base64"));
  await page
    .getByRole("heading", { name: "Map the inspected columns", exact: true })
    .waitFor({ timeout: 60000 });
  for (const [label, index] of [
    ["Company reference", "-1"],
    ["Driver reference", "0"],
    ["Report reference", "1"],
    ["Report type", "2"],
    ["Reported date", "3"],
  ])
    await page
      .getByLabel("Background column for " + label, { exact: true })
      .selectOption(index);
  await capture("mapping");
  await page
    .getByRole("button", {
      name: "Validate mapped rows in background",
      exact: true,
    })
    .click();
  await page
    .getByRole("region", { name: "Validated import preview" })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Change column mapping", exact: true })
    .click();
  await page
    .getByLabel("Background column for Driver reference", { exact: true })
    .selectOption("2");
  assert(
    await page
      .getByRole("button", { name: "Confirm receipt processing", exact: true })
      .isDisabled(),
  );
  await page
    .getByLabel("Background column for Driver reference", { exact: true })
    .selectOption("0");
  await page
    .getByRole("button", { name: "Keep validated mapping", exact: true })
    .click();
  await page.getByRole("button", { name: "Next rows", exact: true }).click();
  await page.getByText(/Rows 26.50 of 125/).waitFor();
  await capture("validated-preview");
  await page
    .getByRole("button", { name: "Confirm receipt processing", exact: true })
    .click();
  await page
    .getByText("Metadata receipts recorded", { exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal(
    await page.getByRole("button", { name: /^Open receipt for rows / }).count(),
    3,
  );
  await capture("completed");
  await page
    .getByRole("button", { name: "View all imports", exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(filename) }).click();
  await page.getByText("Metadata receipts recorded", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Open receipt for rows 51/ }).click();
  await page
    .getByText("Original file & column mapping", { exact: true })
    .click();
  await page.getByText(/Background source data rows 51 to 100/).waitFor();
  await capture("recorded-part");
  await page
    .getByRole("button", { name: "Back to receipts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Background imports", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await chooseFile(
    "cancel-" + stamp + ".csv",
    Buffer.from(
      "Driver,Report,Kind,When\nSYN,CANCEL-" +
        stamp +
        ",background_screening,2026-11-17\n",
    ),
  );
  await page
    .getByRole("heading", { name: "Map the inspected columns", exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Stop remaining processing", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByText("Remaining processing stopped", { exact: true })
    .waitFor();
  await capture("canceled");
  await page
    .getByRole("button", { name: "View all imports", exact: true })
    .click();
  const tooMany =
    "Driver,Report,Kind,When\n" +
    Array.from(
      { length: 1001 },
      (_, i) =>
        "SYN,BG-TOO-MANY-" +
        stamp +
        "-" +
        i +
        ",background_screening,2026-11-17",
    ).join("\n");
  await chooseFile("too-many-" + stamp + ".csv", Buffer.from(tooMany));
  await page
    .getByText("Processing needs attention", { exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("alert")
    .filter({ hasText: "could not be read safely" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Retry interrupted phase", exact: true })
      .count(),
    0,
  );
  await capture("error");
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
    "Real worker/XLSX scan/mapping/preview/125-row recording/receipt provenance/cancel/error journey passed; " +
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
