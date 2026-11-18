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
const out = resolve(root, "docs/design/driver-portal");
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

const browser = await chromium.launch();
const companyContext = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const companyPage = await companyContext.newPage();
const driverContext = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const driverPage = await driverContext.newPage();
const opsContext = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const opsPage = await opsContext.newPage();
const scans = [],
  errors = [];
let stage = "login";
const driverEmail = "driver-ux-" + Date.now() + "@example.com",
  driverPassword = "Synthetic-" + randomUUID();
for (const p of [companyPage, driverPage, opsPage]) {
  p.setDefaultTimeout(20000);
  p.on("pageerror", (e) => errors.push(e.message));
}
async function login(page, account, heading) {
  await page.goto(base);
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  if (account.secret)
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(totp(account.secret));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (heading === "staff")
    await page
      .getByRole("heading", { name: /^(Companies|Your work, in focus\.)$/ })
      .waitFor();
  else
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}
async function post(ctx, path, data) {
  const csrf = (await ctx.cookies()).find((c) => c.name === "qf_csrf")?.value;
  const r = await ctx.request.post(base + "/api/v1" + path, {
    data,
    headers: { Origin: base, "X-CSRF-Token": csrf },
  });
  assert(r.ok(), `API failed (${r.status()}) at ${stage}`);
  return r.json();
}
async function capture(name, page = driverPage) {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.mouse.move(1, 1);
    await page.evaluate(async () => {
      scrollTo(0, 0);
      await document.fonts.ready;
      document.activeElement?.blur();
    });
    await page.screenshot({
      path: resolve(out, `${name}-${width}.png`),
      fullPage: true,
    });
    const a = await new AxeBuilder({ page }).analyze();
    scans.push({
      name,
      width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      violations: a.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
}
async function filePage(page, driver) {
  await page.goto(
    base +
      "/#" +
      new URLSearchParams({
        company: fixture.company_id,
        view: "drivers",
        driver,
      }),
  );
  await page
    .getByRole("navigation", { name: "Driver sections" })
    .getByRole("button", { name: "Qualification file", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Qualification file", exact: true })
    .waitFor();
}
try {
  await login(companyPage, accounts.client, "Your company, at a glance.");
  const original = await (
    await companyContext.request.get(
      base +
        `/api/v1/tenants/${fixture.company_id}/drivers/${fixture.drivers[1]}`,
    )
  ).json();
  const driver = await post(
    companyContext,
    `/tenants/${fixture.company_id}/drivers`,
    {
      command_id: randomUUID(),
      reference: "PERSONAL-" + Date.now(),
      first_name: "Alexandria",
      last_name: "Montgomery-Reynolds Synthetic",
      branch_id: original.engagements.find((e) => !e.end_date).branch_id,
      start_date: "2026-11-19",
    },
  );
  const staffBase = `/tenants/${fixture.company_id}/drivers/${driver.id}`,
    fileBase = staffBase + "/file",
    eid = driver.engagements[0].id;
  stage = "company invitation";
  await filePage(companyPage, driver.id);
  await companyPage
    .getByRole("button", { name: "Driver profile", exact: true })
    .click();
  await companyPage.mouse.move(1, 1);
  await companyPage.getByText("Invite this driver", { exact: true }).click();
  await companyPage
    .getByLabel("Driver email address", { exact: true })
    .fill(driverEmail);
  await companyPage
    .getByRole("button", { name: "Send driver invitation", exact: true })
    .click();
  await companyPage
    .getByRole("status")
    .filter({ hasText: "Driver invitation queued" })
    .waitFor();
  execFileSync(
    resolve(root, "backend/.venv/Scripts/python.exe"),
    ["-m", "app.worker"],
    {
      cwd: resolve(root, "backend"),
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql+psycopg://qualifyflow@127.0.0.1:55432/qualifyflow_ui_test",
        PUBLIC_APP_ORIGIN: base,
      },
      stdio: "pipe",
    },
  );
  const mail = readdirSync(resolve(root, ".local/mail"))
    .map((f) =>
      JSON.parse(readFileSync(resolve(root, ".local/mail", f), "utf8")),
    )
    .find((m) => m.to.includes(driverEmail));
  assert(mail, "Actual local invitation mail required");
  const inviteUrl = mail.body.match(/http:\/\/localhost:\d+\/#invite=\S+/)[0];
  stage = "driver acceptance";
  await driverPage.goto(inviteUrl);
  await driverPage
    .getByRole("heading", { name: "Your onboarding starts here", exact: true })
    .waitFor();
  assert.equal(
    await driverPage
      .getByRole("button", { name: "Set up administrator authenticator" })
      .count(),
    0,
  );
  await driverPage
    .getByLabel("New password (at least 12 characters)", { exact: true })
    .fill(driverPassword);
  await driverPage
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await driverPage
    .getByRole("status")
    .filter({ hasText: "Your personal onboarding access is ready" })
    .waitFor();
  await driverPage
    .getByRole("link", { name: "Continue to sign in", exact: true })
    .click();
  await login(
    driverPage,
    { email: driverEmail, password: driverPassword },
    "My onboarding",
  );
  assert.equal(
    await driverPage
      .getByRole("navigation", { name: "Main navigation" })
      .count(),
    0,
  );
  await driverPage
    .getByRole("heading", { name: "You're connected", exact: true })
    .waitFor();
  await capture("connected-empty");
  stage = "shared request";
  const catalog = await (
    await companyContext.request.get(
      base + `/api/v1/tenants/${fixture.company_id}/requirements`,
    )
  ).json();
  const definition = catalog.items.find((d) => !d.requires_expiry);
  const assigned = await post(companyContext, fileBase + "/requirements", {
    definition_id: definition.id,
    engagement_id: eid,
  });
  await filePage(companyPage, driver.id);
  await companyPage
    .getByText("Request this document from the driver", { exact: true })
    .click();
  await companyPage
    .getByLabel("Driver visibility", { exact: true })
    .selectOption("visible");
  await companyPage
    .getByLabel("Instructions for the driver", { exact: true })
    .fill(
      "Upload a readable synthetic training document. Show every page and use the document requested by your company. No real driver information.",
    );
  await companyPage
    .getByRole("button", { name: "Save driver document request", exact: true })
    .click();
  await companyPage
    .getByRole("status")
    .filter({ hasText: "Driver document request saved" })
    .waitFor();
  await driverPage
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await driverPage
    .getByRole("heading", { name: definition.title, exact: true })
    .waitFor();
  await capture("document-request");
  stage = "driver upload";
  const failedPattern =
    "**/driver-portal/" + eid + "/requirements/*/submissions";
  await driverPage.route(failedPattern, (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          message: "Synthetic interruption. Retry your selected document.",
        },
      }),
    }),
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const selectedFile = {
    name: "synthetic-personal-document.png",
    mimeType: "image/png",
    buffer: png,
  };
  await driverPage
    .getByLabel("Choose a document", { exact: false })
    .setInputFiles(selectedFile);
  await driverPage
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await driverPage
    .getByRole("alert")
    .filter({ hasText: "Synthetic interruption" })
    .waitFor();
  assert.equal(await driverPage.locator(".personal-confirmation").count(), 0);
  await driverPage.unroute(failedPattern);
  await driverPage
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await driverPage
    .getByRole("status")
    .filter({ hasText: "Document received privately" })
    .waitFor();
  await driverPage
    .getByText("Waiting for review", { exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal(
    await driverPage.getByRole("progressbar").getAttribute("value"),
    "0",
  );
  await capture("submitted-for-review");
  stage = "specialist assignment";
  await login(opsPage, accounts.admin, "staff");
  const staff = await (
    await opsContext.request.get(base + "/api/v1/staff")
  ).json();
  const specialist = staff.items.find(
    (s) => s.email === staffAccounts.specialist.email,
  );
  assert(specialist);
  const grants = await (
    await opsContext.request.get(
      base + `/api/v1/tenants/${fixture.company_id}/operator-assignments`,
    )
  ).json();
  if (
    !grants.items.some(
      (g) => g.user_id === specialist.id && g.status === "active",
    )
  )
    await post(
      opsContext,
      `/tenants/${fixture.company_id}/operator-assignments`,
      {
        user_id: specialist.id,
        branch_id: null,
        reason: "Synthetic personal-driver workflow verification.",
      },
    );
  await post(opsContext, "/auth/logout", {});
  await login(opsPage, staffAccounts.specialist, "staff");
  await filePage(opsPage, driver.id);
  await opsPage
    .getByText("Submitted by driver: " + driverEmail, { exact: true })
    .waitFor();
  const version1 = opsPage.locator(".evidence-versions > li").first();
  await version1
    .getByText("Review evidence version 1", { exact: true })
    .click();
  await version1
    .getByLabel("Review outcome", { exact: true })
    .selectOption("needs_more_information");
  await version1
    .getByLabel("Review findings and verified basis", { exact: true })
    .fill(
      "Internal synthetic review note: request a clearer second version. This text is not driver-facing.",
    );
  await version1
    .getByRole("button", { name: "Record evidence review", exact: true })
    .click();
  await opsPage
    .getByRole("status")
    .filter({ hasText: "Evidence review recorded" })
    .waitFor();
  await opsPage
    .getByText("Update driver instructions", { exact: true })
    .click();
  await opsPage
    .getByLabel("Instructions for the driver", { exact: true })
    .fill(
      "Please upload a clearer copy of the synthetic training document with all pages visible.",
    );
  await opsPage
    .getByRole("button", { name: "Save driver document request", exact: true })
    .click();
  await opsPage
    .getByRole("status")
    .filter({ hasText: "Driver document request saved" })
    .waitFor();
  await driverPage
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await driverPage.getByText("Changes requested", { exact: true }).waitFor();
  assert(
    !(await driverPage.locator("main").innerText()).includes(
      "Internal synthetic review note",
    ),
  );
  await capture("changes-requested");
  stage = "replacement and acceptance";
  await driverPage.getByText("Upload another version", { exact: true }).click();
  await driverPage
    .getByLabel("Choose a document", { exact: false })
    .setInputFiles(selectedFile);
  await driverPage
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await driverPage
    .getByRole("status")
    .filter({ hasText: "Document received privately" })
    .waitFor();
  await driverPage
    .getByText("Waiting for review", { exact: true })
    .waitFor({ timeout: 60000 });
  await opsPage
    .getByRole("button", { name: "Refresh file", exact: true })
    .click();
  const latest = opsPage.locator(".evidence-versions > li").first();
  await latest.getByText("Review evidence version 2", { exact: true }).click();
  await latest
    .getByLabel("Review outcome", { exact: true })
    .selectOption("verified_evidence");
  for (const n of [
    "Driver identity and employer engagement agree",
    "Evidence matches this requirement category",
    "Evidence is readable and complete",
  ])
    await latest.getByLabel(n, { exact: true }).check();
  await latest
    .getByLabel("Review findings and verified basis", { exact: true })
    .fill(
      "Verified synthetic identity, category and completeness. No legal eligibility conclusion.",
    );
  await latest
    .getByRole("button", { name: "Record evidence review", exact: true })
    .click();
  await opsPage
    .getByRole("status")
    .filter({ hasText: "Evidence review recorded" })
    .waitFor();
  await driverPage
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await driverPage.getByText("Evidence accepted", { exact: true }).waitFor();
  assert.equal(
    await driverPage.getByRole("progressbar").getAttribute("value"),
    "1",
  );
  await capture("evidence-accepted");
  await companyPage
    .getByRole("button", { name: "Refresh file", exact: true })
    .click();
  await companyPage
    .locator(".requirement-record > .intake-heading .state.verified")
    .first()
    .waitFor();
  stage = "keyboard reduced motion and revocation";
  await driverPage.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await driverPage
      .locator(".personal-request")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
    "0s",
  );
  await driverPage
    .getByRole("button", { name: "Sign out", exact: true })
    .focus();
  assert(
    await driverPage
      .getByRole("button", { name: "Sign out", exact: true })
      .evaluate((e) => e === document.activeElement),
  );
  await companyPage
    .getByRole("button", { name: "Driver profile", exact: true })
    .click();
  await companyPage.mouse.move(1, 1);
  await companyPage
    .getByText("Revoke personal access", { exact: true })
    .click();
  await companyPage
    .getByLabel("Reason for revocation", { exact: true })
    .fill(
      "Synthetic completed workflow; revoke personal access for isolation verification.",
    );
  await companyPage
    .getByRole("button", { name: "Revoke driver access", exact: true })
    .click();
  await companyPage
    .getByRole("status")
    .filter({ hasText: "Driver access revoked" })
    .waitFor();
  await driverPage
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await driverPage
    .getByRole("heading", { name: "No active onboarding access", exact: true })
    .waitFor();
  assert.equal(await driverPage.locator(".personal-request").count(), 0);
  await driverPage
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await driverPage
    .getByRole("button", { name: "Sign in", exact: true })
    .waitFor();
  assert.equal(
    (await driverContext.request.get(base + "/api/v1/driver-portal")).status(),
    401,
  );
  writeFileSync(
    resolve(out, "results.json"),
    JSON.stringify(
      {
        scans,
        errors,
        actualLocalInvitation: true,
        personalAccount: true,
        realDriverUploadScanSpecialistReview: true,
        correctionAndReplacement: true,
        companyVisibility: true,
        revocation: true,
        logout: true,
        reducedMotion: true,
        failedUploadRecovery: true,
      },
      null,
      2,
    ),
  );
  assert(
    scans.every((s) => !s.overflow && !s.violations.length),
    JSON.stringify(scans.filter((s) => s.overflow || s.violations.length)),
  );
  assert.equal(errors.length, 0);
  console.log(
    "Driver workspace: actual local invitation, scoped account, upload/scan, specialist correction and acceptance, company progress, revocation/logout and responsive accessibility passed.",
  );
} catch (error) {
  await driverPage.screenshot({
    path: resolve(out, "failure.png"),
    fullPage: true,
    mask: [driverPage.locator("input")],
  });
  const message = String(error.message)
    .replaceAll(driverPassword, "[redacted]")
    .replace(/#invite=\S+/g, "#invite=[redacted]");
  writeFileSync(resolve(out, "failure.txt"), `Stage: ${stage}\n${message}`);
  console.error(
    `Driver workspace verification failed at: ${stage}. See sanitized local failure artifact.`,
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
