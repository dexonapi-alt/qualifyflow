import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";

const phase = process.argv[2] || "after",
  base = "http://localhost:5174",
  root = resolve("..");
const directory = resolve(
  root,
  process.env.QF_REVIEW_OUTPUT || "docs/design/ui-refinement",
  phase,
);
mkdirSync(directory, { recursive: true });
const accounts = JSON.parse(
  readFileSync(resolve(root, ".local/ui-qa-accounts.json"), "utf8"),
);
function code(secret) {
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
const browser = await chromium.launch();
const results = [];
async function captures(page, name) {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.mouse.move(1, 1);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: resolve(directory, `${name}-${width}.png`),
      fullPage: true,
    });
    if (
      ["operations", "client-one", "client-long-identity"].includes(name) &&
      (await page.locator(".sidebar").count())
    ) {
      await page.locator(".sidebar").screenshot({
        path: resolve(directory, `sidebar-${name}-${width}.png`),
      });
    }
    if (phase === "after") {
      const scan = await new AxeBuilder({ page }).analyze();
      results.push({
        name,
        width,
        violations: scan.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
    }
  }
}
const anonContext = await browser.newContext();
const anon = await anonContext.newPage();
await anon.goto(base);
await anon.getByRole("button", { name: "Sign in", exact: true }).waitFor();
await anon.evaluate(() => document.fonts.ready);
if (phase === "after") {
  const typography = await anon.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: document.fonts.check('14px "Inter Variable"'),
  }));
  results.push({ name: "interface-font", ...typography });
  const contrast = await anon.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    function lum(value) {
      let h = value.trim().replace("#", "");
      if (h.length === 3)
        h = h
          .split("")
          .map((x) => x + x)
          .join("");
      const rgb = [0, 2, 4]
        .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    }
    return [
      ["body", "--qf-ink", "--qf-canvas", 4.5],
      ["secondary", "--qf-secondary", "--qf-canvas", 4.5],
      ["muted", "--qf-muted", "--qf-table-head", 4.5],
      ["primary action", "--qf-canvas", "--qf-action-primary", 4.5],
      ["focus", "--qf-focus", "--qf-canvas", 3],
      ["input border", "--qf-border-strong", "--qf-canvas", 3],
    ].map(([pair, fg, bg, minimum]) => {
      const a = lum(style.getPropertyValue(fg)),
        b = lum(style.getPropertyValue(bg));
      return {
        pair,
        ratio:
          Math.round(
            ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100,
          ) / 100,
        minimum,
      };
    });
  });
  if (
    contrast.some(
      (pair) => !Number.isFinite(pair.ratio) || pair.ratio < pair.minimum,
    )
  )
    throw new Error("Semantic token contrast regression");
  results.push({ name: "semantic-token-contrast", pairs: contrast });
}
await captures(anon, "login");
await anon
  .getByLabel("Email address", { exact: true })
  .fill("unknown@example.com");
await anon.getByLabel("Password", { exact: true }).fill("invalid-password");
let releaseLogin;
if (phase === "after") {
  const pendingLogin = new Promise((resolve) => {
    releaseLogin = resolve;
  });
  await anon.route("**/api/v1/auth/login", async (route) => {
    await pendingLogin;
    await route.continue();
  });
}
await anon.getByRole("button", { name: "Sign in", exact: true }).click();
if (phase === "after") {
  await anon.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  await captures(anon, "login-pending");
  releaseLogin();
}
await anon.getByRole("alert").waitFor();
await captures(anon, "login-error");
for (const role of [
  "admin",
  "client",
  "empty",
  ...(phase === "after" && accounts.long ? ["long"] : []),
  ...(phase === "after" && accounts.no_locations ? ["no_locations"] : []),
]) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const a = accounts[role];
  let releaseDetail;
  if (phase === "after" && role === "client") {
    const pendingDetail = new Promise((resolve) => {
      releaseDetail = resolve;
    });
    await page.route(/\/api\/v1\/tenants\/[^/?]+$/, async (route) => {
      await pendingDetail;
      await route.continue();
    });
  }
  await page.goto(base);
  await page.getByLabel("Email address", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.locator("input[name=code]").fill(code(a.secret));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByText(role === "admin" ? "Operations console" : "Client portal", {
      exact: true,
    })
    .waitFor();
  if (releaseDetail) {
    await page.getByText("Loading company...", { exact: true }).waitFor();
    await captures(page, "client-loading");
    releaseDetail();
  }
  await page.waitForLoadState("networkidle");
  if (phase === "after") {
    const composition = await page.evaluate(() => {
      const title = document.querySelector("main h1");
      const breadcrumb = document.querySelector("main .workspace-breadcrumb");
      const company = document.querySelector(".single-company");
      return {
        noAppBar: !document.querySelector(".product-header"),
        titleAboveBreadcrumb:
          title.getBoundingClientRect().bottom <=
          breadcrumb.getBoundingClientRect().top,
        noRepeatedSidebarLabels: !document.querySelector(
          ".workspace-identity,.nav-group",
        ),
        noCompanyFrame:
          !company ||
          (getComputedStyle(company).borderTopWidth === "0px" &&
            getComputedStyle(company).paddingTop === "0px"),
      };
    });
    if (Object.values(composition).some((value) => !value))
      throw new Error("Shell composition regression");
    results.push({ name: role + "-shell-composition", ...composition });
    if (await page.locator(".sidebar .brand-mark,.sidebar .nav-count").count())
      throw new Error("Sidebar restored decorative logo or count");
    const identity = await page
      .locator(".sidebar .user-identity strong")
      .evaluate((el) => ({
        text: el.textContent,
        wraps: getComputedStyle(el).whiteSpace !== "nowrap",
        unclipped:
          el.scrollHeight <= el.clientHeight + 1 &&
          getComputedStyle(el).textOverflow !== "ellipsis",
      }));
    if (identity.text !== a.email || !identity.wraps || !identity.unclipped)
      throw new Error("Sidebar account identity is clipped or fabricated");
    results.push({
      name: role + "-sidebar-brand-and-readable-identity",
      passed: true,
    });
  }
  await captures(
    page,
    role === "admin"
      ? "operations"
      : role === "client"
        ? "client-one"
        : role === "long"
          ? "client-long-identity"
          : role === "no_locations"
            ? "client-no-locations"
            : "client-empty",
  );
  if (role === "admin") {
    if (phase === "after") {
      const search = page.getByLabel("Search displayed companies");
      await search.fill("Meridian");
      if ((await page.locator(".company-row").count()) !== 1)
        throw new Error("Company search failed");
      await search.fill("not-a-company");
      await captures(page, "operations-no-results");
      await page.getByRole("button", { name: "Clear filters" }).click();
      await page.getByLabel("Filter company status").selectOption("suspended");
      if ((await page.locator(".company-row").count()) !== 1)
        throw new Error("Company status filtering failed");
      await page.getByLabel("Filter company status").selectOption("all");
      await page.getByLabel("Sort companies").selectOption("status");
      const states = await page
        .locator(".company-row .state")
        .allTextContents();
      if (JSON.stringify(states) !== JSON.stringify([...states].sort()))
        throw new Error("Company sorting failed");
      await page.getByLabel("Sort companies").selectOption("name");
      results.push({ name: "company-search-filter-sort", passed: true });
      const activeRecord = page
        .locator(".company-row")
        .filter({ has: page.locator(".state.active") })
        .first();
      if (await activeRecord.count()) {
        await activeRecord.click();
        await page
          .getByRole("navigation", { name: "Company sections" })
          .waitFor();
        await captures(page, "company-active");
        if (!(await page.locator(".readiness-signal.is-active").count()))
          throw new Error(
            "Active account readiness must render the persisted active state",
          );
        await page
          .getByRole("navigation", { name: "Company sections" })
          .getByRole("button", { name: "People & access", exact: true })
          .click();
        await page.waitForLoadState("networkidle");
        await page.locator(".invitations-table tbody tr").first().waitFor();
        await captures(page, "operations-invitations");
        await page
          .getByRole("navigation", { name: "Company sections" })
          .getByRole("button", { name: "Audit history", exact: true })
          .click();
        await page.waitForLoadState("networkidle");
        await page.locator(".audit-table tbody tr").first().waitFor();
        await captures(page, "operations-audit");
        await page.locator(".back").click();
        await page.locator(".company-row").first().waitFor();
      }
    }
    await page.locator(".company-row").filter({ hasText: "Northline" }).click();
    await page.getByRole("navigation", { name: "Company sections" }).waitFor();
    if (phase === "after") {
      await captures(page, "company-summary");
      await page
        .getByRole("navigation", { name: "Company sections" })
        .getByRole("button", { name: "Configuration", exact: true })
        .click();
    }
    await captures(page, "company-detail");
    await page
      .getByRole("button", { name: "People & access", exact: true })
      .click();
    await page.waitForLoadState("networkidle");
    await captures(page, "people");
    if (phase === "after") {
      await page
        .getByRole("navigation", { name: "Company sections" })
        .getByRole("button", { name: "Service assignment", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Assigned specialists", exact: true })
        .waitFor();
      await page.waitForLoadState("networkidle");
      await captures(page, "service-assignment");
    }
  }
  if (phase === "after") {
    if (role === "no_locations") {
      await page
        .getByRole("navigation", { name: "Company sections" })
        .getByRole("button", { name: "Locations", exact: true })
        .click();
      await page
        .getByText("No locations in your scope.", { exact: false })
        .waitFor();
      await captures(page, "client-empty-locations");
      if (
        !(await page
          .getByRole("form", { name: "Add branch", exact: true })
          .count())
      )
        throw new Error("Empty locations lost authorized creation form");
      if (await page.locator(".locations-table").count())
        throw new Error("Empty locations fabricated a table");
      results.push({ name: "actual-empty-location-state", passed: true });
    }
    if (role === "client" || role === "long") {
      const signal = page.locator(".readiness-signal");
      if (!(await signal.count()) || /\d+\s*%/.test(await signal.innerText()))
        throw new Error(
          "Account readiness must show a real state, never fabricated progress",
        );
      const scopedLocations = await page.request.get(base + "/api/v1/tenants");
      const tenants = (await scopedLocations.json()).items;
      const detailResponse = await page.request.get(
        base + "/api/v1/tenants/" + tenants[0].id,
      );
      const actualDetail = await detailResponse.json();
      if (
        (await page.locator(".location-preview li").count()) !==
        Math.min(2, actualDetail.branches.length)
      )
        throw new Error(
          "Location preview must contain only returned scoped records",
        );
      await page.locator(".profile-config").focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Company configuration", exact: true })
        .waitFor();
      await page
        .getByRole("navigation", { name: "Company sections" })
        .getByRole("button", { name: "Overview", exact: true })
        .click();
      if (
        !(await page.locator(".locations-module").innerText()).includes(
          String(actualDetail.branches.length) + " location",
        )
      )
        throw new Error(
          "Location summary differs from authorized backend scope",
        );
      await page.locator(".location-summary").focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Locations", exact: true })
        .waitFor();
      await page
        .getByRole("navigation", { name: "Company sections" })
        .getByRole("button", { name: "Overview", exact: true })
        .click();
      results.push({
        name: role + "-visual-information-real-scope-and-action",
        passed: true,
      });
      if (await page.locator(".summary-grid,.summary-value").count())
        throw new Error("Rejected summary cards returned");
      if (
        (await page
          .locator(".overview-workspace > .overview-module")
          .count()) !== 3
      )
        throw new Error(
          "Overview must have profile, readiness and locations modules",
        );
      if ((await page.locator(".profile-identity > .state").count()) !== 1)
        throw new Error("Overview duplicates account status");
      const sections = page.getByRole("navigation", {
        name: "Company sections",
      });
      await sections
        .getByRole("button", { name: "Locations", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      if (
        (await sections
          .getByRole("button", { name: "Locations", exact: true })
          .getAttribute("aria-current")) !== "page"
      )
        throw new Error("Location section navigation failed");
      await captures(
        page,
        role === "client" ? "client-locations" : "viewer-locations",
      );
      if (
        (await page.locator(".locations-table tbody tr").count()) !==
        (role === "client" ? 2 : 1)
      )
        throw new Error("Location scope mismatch");
      if (role === "client") {
        await page.getByLabel("Search locations", { exact: true }).fill("EAST");
        if ((await page.locator(".locations-table tbody tr").count()) !== 1)
          throw new Error("Location search failed");
        await page
          .getByLabel("Search locations", { exact: true })
          .fill("no-matching-location");
        await page
          .getByRole("button", { name: "Clear search", exact: true })
          .click();
        if ((await page.locator(".locations-table tbody tr").count()) !== 2)
          throw new Error("Location search recovery failed");
        await sections
          .getByRole("button", { name: "People & access", exact: true })
          .click();
        await page.waitForLoadState("networkidle");
        await captures(page, "client-people");
        if (
          !(await page
            .getByRole("form", { name: "Invite user", exact: true })
            .count())
        )
          throw new Error("Client invitation form missing");
      } else {
        if (
          await sections
            .getByRole("button", { name: "People & access", exact: true })
            .count()
        )
          throw new Error("Viewer received user management section");
        if (
          await page
            .getByRole("form", { name: "Add branch", exact: true })
            .count()
        )
          throw new Error("Viewer received branch form");
      }
      await sections
        .getByRole("button", { name: "Configuration", exact: true })
        .click();
      await captures(
        page,
        role === "client" ? "client-configuration" : "viewer-configuration",
      );
      if (
        await page
          .getByRole("form", { name: "Save responsibilities", exact: true })
          .count()
      )
        throw new Error("Client received service-only configuration controls");
      await sections
        .getByRole("button", { name: "Overview", exact: true })
        .click();
      results.push({
        name: role + "-management-sections-scope-navigation",
        passed: true,
      });
    }
    if (role === "long") {
      await page.setViewportSize({ width: 1440, height: 900 });
      const account = page.locator(".account-menu summary");
      await account.focus();
      await page.keyboard.press("Enter");
      if (!(await page.locator(".account-menu").evaluate((el) => el.open)))
        throw new Error("Keyboard account disclosure failed");
      if (
        (await page.locator(".account-popover strong").innerText()) !== a.email
      )
        throw new Error("Full account email unavailable");
      if (
        !(await page.locator(".account-popover").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.right - 8, r.top + 8));
        }))
      )
        throw new Error("Account disclosure is covered by workspace content");
      await page.screenshot({
        path: resolve(directory, "account-disclosure-1440.png"),
        fullPage: true,
      });
      await page.keyboard.press("Enter");
      if (
        await page
          .getByRole("button", { name: "Manage users", exact: true })
          .count()
      )
        throw new Error("Viewer received administrator action");
      results.push({
        name: "long-identity-disclosure-and-viewer-scope",
        passed: true,
      });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    results.push({
      name: role + "-reduced-motion",
      animations: await page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => ({
      tag: document.activeElement.tagName,
      visible: getComputedStyle(document.activeElement).outlineStyle !== "none",
    }));
    results.push({ name: role + "-keyboard", focused });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("html").evaluate((el) => (el.style.zoom = "2"));
    results.push({
      name: role + "-200-percent-zoom",
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await page.screenshot({
      path: resolve(directory, `${role}-zoom-200.png`),
      fullPage: true,
    });
    await page.locator("html").evaluate((el) => (el.style.zoom = ""));
    await page.setViewportSize({ width: 375, height: 900 });
    const accountControl = page.locator(".account-menu summary");
    await accountControl.focus();
    await page.keyboard.press("Enter");
    const signOut = page.getByRole("button", { name: "Sign out", exact: true });
    await signOut.waitFor();
    if (role === "admin" || role === "client")
      await captures(page, "account-menu-" + role);
    await page.keyboard.press("Escape");
    if (await page.locator(".account-menu").evaluate((el) => el.open))
      throw new Error("Account menu Escape failed");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    if (!(await signOut.evaluate((el) => el === document.activeElement)))
      throw new Error("Account menu keyboard order failed");
    const priorCookies = (await context.cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    const revoked = await context.request.get(base + "/api/v1/auth/me", {
      headers: { Cookie: priorCookies },
    });
    if (revoked.status() !== 401)
      throw new Error("Logout failed to revoke prior session");
    await page.reload();
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    results.push({
      name: role + "-sidebar-keyboard-logout-session-revocation",
      passed: true,
    });
  }
  await context.close();
}
if (phase === "after") {
  await anon.emulateMedia({ reducedMotion: "reduce" });
  await anon.goto(base);
  await anon.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  await anon.keyboard.press("Tab");
  results.push({
    name: "login-first-focus",
    nameAttribute: await anon.locator(":focus").getAttribute("name"),
  });
  const focusOrder = [];
  for (let i = 0; i < 4; i++) {
    focusOrder.push(
      await anon
        .locator(":focus")
        .evaluate((el) => el.getAttribute("name") || el.textContent),
    );
    await anon.keyboard.press("Tab");
  }
  if (
    JSON.stringify(focusOrder) !==
    JSON.stringify(["email", "password", "code", "Sign in"])
  )
    throw new Error("Incorrect sign-in focus order");
  results.push({ name: "login-focus-order", order: focusOrder });
  await anon.emulateMedia({ reducedMotion: "reduce" });
  results.push({
    name: "login-reduced-motion",
    animations: await anon.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  });
  await anon.setViewportSize({ width: 1440, height: 800 });
  results.push({
    name: "login-viewport",
    fits: await anon
      .getByRole("button", { name: "Sign in", exact: true })
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  });
}
writeFileSync(
  resolve(directory, "results.json"),
  JSON.stringify(results, null, 2),
);
await browser.close();
console.log(
  `${phase}: screenshots captured; ${results.filter((r) => r.violations?.length || r.overflow).length} accessibility/overflow failures`,
);
if (
  phase === "after" &&
  results.some((r) => r.violations?.length || r.overflow)
)
  process.exitCode = 1;
