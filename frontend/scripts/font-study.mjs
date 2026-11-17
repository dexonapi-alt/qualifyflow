import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
const root = resolve(".."),
  out = resolve(root, "docs/design/visual-craft/font-study");
mkdirSync(out, { recursive: true });
const account = JSON.parse(
  readFileSync(resolve(root, ".local/ui-qa-accounts.json"), "utf8"),
).client;
function code(secret) {
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
    offset = hash[19] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const browser = await chromium.launch(),
  context = await browser.newContext(),
  page = await context.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:5174");
await page.getByLabel("Email address", { exact: true }).fill(account.email);
await page.getByLabel("Password", { exact: true }).fill(account.password);
await page.locator("input[name=code]").fill(code(account.secret));
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.locator(".single-company").waitFor();
await page.waitForLoadState("networkidle");
for (const family of ["inter", "geist"]) {
  const data = readFileSync(
    resolve(
      `node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`,
    ),
  ).toString("base64");
  const style = await page.addStyleTag({
    content: `@font-face{font-family:'Candidate';src:url(data:font/woff2;base64,${data});font-weight:100 900;font-display:swap}:root{--qf-font:'Candidate',Arial,sans-serif}`,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: resolve(out, `${family}.png`),
    fullPage: true,
  });
  await style.evaluate((el) => el.remove());
}
await browser.close();
console.log(
  "Inter and Geist rendered on identical actual client data for comparison.",
);
