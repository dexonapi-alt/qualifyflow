import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { driverJourney } from "./driver-journey";

const root = resolve("..");
const accounts = JSON.parse(
  readFileSync(resolve(root, ".local/e2e-accounts.json"), "utf8"),
);
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret)
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest(),
    offset = hash[19] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}

test("persisted onboarding, local delivery, MFA acceptance, activation and scoped client portal", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const stamp = Date.now().toString(),
    ref = "E2E" + stamp,
    email = "client-" + stamp + "@example.com";
  await page.goto("/");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(accounts.admin.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(accounts.admin.password);
  await page.getByLabel("Authenticator code").fill(totp(accounts.admin.secret));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Operations console", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await page
    .getByLabel("Legal company name")
    .fill("E2E Synthetic Carrier " + stamp);
  await page.getByLabel("Display name").fill("E2E Carrier " + stamp);
  await page.getByLabel("Customer reference (uppercase)").fill(ref);
  await page
    .getByLabel("Region / jurisdiction metadata")
    .fill("Synthetic test region");
  await page.getByLabel("Primary contact email").fill(email);
  await page.getByLabel("Service effective date").fill("2026-11-17");
  await page.getByRole("button", { name: "Create draft company" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E Carrier " + stamp, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Locations", exact: true }).click();
  await page.getByLabel("Branch name").fill("Main");
  await page.getByLabel("Branch reference (uppercase)").fill("MAIN");
  await page.getByRole("button", { name: "Add branch", exact: true }).click();
  await expect(page.getByText("Main", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("form", { name: "Add branch", exact: true })
      .getByRole("status"),
  ).toContainText("Branch added.");
  await page.getByRole("form", { name: "Add branch", exact: true }).screenshot({
    path: resolve(
      root,
      "docs/design/final-product-polish/after/branch-confirmation.png",
    ),
  });
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page.getByLabel("Approved client policy reference").waitFor();
  await page.getByRole("button", { name: "Locations", exact: true }).click();
  await expect(
    page
      .getByRole("form", { name: "Add branch", exact: true })
      .getByRole("status"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page
    .getByLabel("Approved client policy reference")
    .fill("SYNTHETIC-SOP-E2E");
  await page
    .getByLabel("Configuration rationale")
    .fill("Approved synthetic responsibility mapping");
  await page.getByRole("button", { name: "Save responsibilities" }).click();
  await expect(
    page.getByRole("button", { name: "Review configuration", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("State change rationale")
    .fill("Review before all prerequisites present");
  await page
    .getByRole("button", { name: "Review configuration", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("administrator");
  await page
    .getByRole("button", { name: "Service assignment", exact: true })
    .click();
  await page
    .getByLabel("Eligible specialist")
    .selectOption({ label: accounts.specialist.email });
  await page
    .getByLabel("Assignment rationale")
    .fill("Synthetic managed service owner");
  await page
    .getByRole("button", { name: "Assign specialist", exact: true })
    .click();
  await expect(
    page.getByText(accounts.specialist.email, { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "People & access", exact: true })
    .click();
  await page.getByLabel("Invitee email address").fill(email);
  await page.getByRole("button", { name: "Invite user", exact: true }).click();
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
  execFileSync(
    resolve(
      root,
      process.platform === "win32"
        ? "backend/.venv/Scripts/python.exe"
        : "backend/.venv/bin/python",
    ),
    ["-m", "app.worker"],
    { cwd: resolve(root, "backend"), env: process.env },
  );
  const mail = readdirSync(resolve(root, ".local/mail"))
    .map((f) =>
      JSON.parse(readFileSync(resolve(root, ".local/mail", f), "utf8")),
    )
    .find((m) => m.to.includes(email));
  expect(mail).toBeTruthy();
  const url = mail.body.match(/http:\/\/localhost:\d+\/#invite=\S+/)[0];
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(url);
  await clientPage
    .getByRole("button", { name: "Set up administrator authenticator" })
    .click();
  const secret = (await clientPage.locator(".setup code").innerText()).trim();
  await clientPage
    .getByLabel("New password (at least 12 characters)")
    .fill("Synthetic-client-password-123");
  await clientPage
    .getByLabel("Authenticator verification code")
    .fill(totp(secret));
  await clientPage
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await expect(
    clientPage.getByText(
      "Invitation accepted. Your scoped membership is active.",
    ),
  ).toBeVisible();
  await clientPage.getByRole("link", { name: "Continue to sign in" }).click();
  await clientPage.getByLabel("Email address", { exact: true }).fill(email);
  await clientPage
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-client-password-123");
  await clientPage.getByLabel("Authenticator code").fill(totp(secret));
  await clientPage
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    clientPage.getByText("Client portal", { exact: true }),
  ).toBeVisible();
  await expect(
    clientPage.getByRole("button", { name: "Create company", exact: true }),
  ).toHaveCount(0);
  await expect(clientPage.locator(".single-company")).toHaveCount(1);
  await expect(clientPage.locator(".profile-identity h2")).toHaveText(
    "E2E Carrier " + stamp,
  );
  const clientSections = clientPage.getByRole("navigation", {
    name: "Company sections",
  });
  await clientSections
    .getByRole("button", { name: "Locations", exact: true })
    .click();
  await clientPage.getByLabel("Search locations", { exact: true }).fill("MAIN");
  await expect(clientPage.locator(".locations-table tbody tr")).toHaveCount(1);
  await clientSections
    .getByRole("button", { name: "People & access", exact: true })
    .click();
  const teammate = "teammate-" + stamp + "@example.com";
  await clientPage.getByLabel("Invitee email address").fill(teammate);
  await clientPage
    .getByLabel("Role", { exact: true })
    .selectOption("client_viewer");
  await clientPage
    .getByRole("button", { name: "Invite user", exact: true })
    .click();
  await expect(
    clientPage.locator(".invitation-row").filter({ hasText: teammate }),
  ).toBeVisible();
  await expect(
    clientPage
      .getByRole("form", { name: "Invite user", exact: true })
      .getByRole("status"),
  ).toContainText("Invitation queued for local delivery.");
  await clientPage
    .getByRole("form", { name: "Invite user", exact: true })
    .screenshot({
      path: resolve(
        root,
        "docs/design/final-product-polish/after/invitation-confirmation.png",
      ),
    });
  await clientPage.getByLabel("Invitee email address").fill(teammate);
  await clientPage
    .getByLabel("Role", { exact: true })
    .selectOption("client_viewer");
  await clientPage
    .getByRole("button", { name: "Invite user", exact: true })
    .click();
  const inviteForm = clientPage.getByRole("form", {
    name: "Invite user",
    exact: true,
  });
  await expect(inviteForm.getByRole("alert")).toContainText(
    "A pending invitation already exists.",
  );
  await expect(inviteForm.getByRole("status")).toHaveCount(0);
  await inviteForm.screenshot({
    path: resolve(
      root,
      "docs/design/final-product-polish/after/invitation-error.png",
    ),
  });
  await clientPage.reload();
  await clientPage
    .getByRole("navigation", { name: "Company sections" })
    .getByRole("button", { name: "People & access", exact: true })
    .click();
  const invitation = clientPage
    .locator(".invitation-row")
    .filter({ hasText: teammate });
  await expect(invitation).toBeVisible();
  await invitation.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(invitation.locator(".state")).toHaveText("revoked");
  await expect(clientPage.locator(".section-confirmation")).toContainText(
    "Invitation revoke recorded.",
  );
  await clientPage
    .getByRole("navigation", { name: "Company sections" })
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await expect(
    clientPage.getByText("SYNTHETIC-SOP-E2E", { exact: true }),
  ).toBeVisible();
  await expect(
    clientPage.getByRole("form", {
      name: "Save responsibilities",
      exact: true,
    }),
  ).toHaveCount(0);
  await clientPage
    .getByRole("navigation", { name: "Company sections" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page
    .getByLabel("State change rationale")
    .fill("Review synthetic company settings");
  await page
    .getByRole("button", { name: "Review configuration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Activate company", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("State change rationale")
    .fill("Activate complete synthetic onboarding");
  await page
    .getByRole("button", { name: "Activate company", exact: true })
    .click();
  await expect(page.locator(".heading .state")).toHaveText("active");
  await page.reload();
  await page
    .getByRole("button", { name: new RegExp("E2E Carrier " + stamp) })
    .click();
  await expect(page.locator(".heading .state")).toHaveText("active");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("heading", { name: "E2E Carrier " + stamp, exact: true }),
    ).toBeVisible();
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(violations.map((v) => v.id + ": " + v.description)).toEqual([]);
    await page.screenshot({
      path: resolve(root, `.local/screenshots/onboarding-${width}.png`),
      fullPage: true,
    });
  }
  await driverJourney(clientPage, root, stamp);
  await clientContext.close();
});
