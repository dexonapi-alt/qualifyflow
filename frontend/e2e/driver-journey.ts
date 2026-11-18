import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export async function driverJourney(page: Page, root: string, stamp: string) {
  const output = resolve(root, "docs/design/milestone-resumption/drivers");
  mkdirSync(output, { recursive: true });
  const results: object[] = [];
  async function capture(name: string) {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      const scan = await new AxeBuilder({ page }).analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      expect(overflow).toBe(false);
      await page.screenshot({
        path: resolve(output, `${name}-${width}.png`),
        fullPage: true,
      });
      results.push({ name, width, violations: [], overflow });
    }
  }
  async function companySection(name: string) {
    if (name === "Drivers") {
      if (page.viewportSize()!.width <= 760)
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
      await page
        .locator("#workspace-navigation")
        .getByRole("button", { name, exact: true })
        .click();
      return;
    }
    await page
      .getByRole("navigation", { name: "Company sections" })
      .getByRole("button", { name, exact: true })
      .click();
  }
  await page.reload();
  await companySection("Locations");
  await page.getByLabel("Branch name").fill("East depot");
  await page.getByLabel("Branch reference (uppercase)").fill("EAST");
  await page.getByRole("button", { name: "Add branch", exact: true }).click();
  await expect(page.getByText("East depot", { exact: true })).toBeVisible();
  await companySection("Drivers");
  await expect(
    page.getByRole("heading", { name: "No drivers registered", exact: true }),
  ).toBeVisible();
  await capture("empty");
  await page
    .getByRole("button", { name: "Register driver", exact: true })
    .click();
  await page
    .getByLabel("Company driver reference", { exact: true })
    .fill("SYN-" + stamp);
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last name", { exact: true }).fill("Rowan");
  await page
    .getByLabel("Engagement start date", { exact: true })
    .fill("2026-11-01");
  await page
    .getByLabel("Location", { exact: true })
    .selectOption({ label: "Main" });
  await capture("registration");
  await page
    .getByRole("button", { name: "Create driver record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic Rowan", exact: true }),
  ).toBeVisible();
  await capture("record");
  await page
    .getByRole("navigation", { name: "Driver sections" })
    .getByRole("button", { name: "Manage engagement", exact: true })
    .click();
  await page
    .getByLabel("New engagement state", { exact: true })
    .selectOption("active");
  await page
    .getByLabel("State change reason", { exact: true })
    .fill("Employer confirmed synthetic onboarding");
  await page
    .getByRole("button", { name: "Record state change", exact: true })
    .click();
  await expect(page.locator(".driver-record-heading .state")).toHaveText(
    "active",
  );
  await page
    .getByLabel("Destination location", { exact: true })
    .selectOption({ label: "East depot" });
  await page
    .getByLabel("Transfer effective date", { exact: true })
    .fill("2026-11-10");
  await page
    .getByLabel("Transfer reason", { exact: true })
    .fill("Confirmed synthetic employer branch move");
  await capture("management");
  await page
    .getByRole("button", { name: "Transfer driver location", exact: true })
    .click();
  await expect(page.locator(".engagement-history tbody tr")).toHaveCount(2);
  await expect(
    page
      .locator(".engagement-history tbody tr")
      .filter({ hasText: "Main" })
      .locator(".state"),
  ).toHaveText("ended");
  await expect(
    page
      .locator(".engagement-history tbody tr")
      .filter({ hasText: "East depot" })
      .locator(".state"),
  ).toHaveText("active");
  await page
    .getByRole("navigation", { name: "Driver sections" })
    .getByRole("button", { name: "Identity correction", exact: true })
    .click();
  await page
    .getByLabel("Correct last name", { exact: true })
    .fill("Rowan Corrected");
  await page
    .getByLabel("Verified source or basis", { exact: true })
    .fill("Confirmed against synthetic employer registration");
  await page
    .getByLabel("Correction reason", { exact: true })
    .fill("Reviewed synthetic employer name correction");
  await page
    .getByRole("button", { name: "Record identity correction", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic Rowan Corrected",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Driver sections" })
    .getByRole("button", { name: "Record history", exact: true })
    .click();
  await expect(page.locator(".driver-history > li")).toHaveCount(4);
  await page.locator(".driver-history summary").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".driver-history details").first()).toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(".driver-history pre").first()).toContainText(
    "Rowan",
  );
  await capture("history");
  await page.reload();
  await companySection("Drivers");
  await page.getByLabel("Search drivers", { exact: true }).fill("SYN-" + stamp);
  await expect(page.locator(".driver-table tbody tr")).toHaveCount(1);
  await expect(
    page.getByText("Synthetic Rowan Corrected", { exact: true }),
  ).toBeVisible();
  await capture("roster");
  await page
    .getByLabel("Search drivers", { exact: true })
    .fill("no-such-driver");
  await expect(
    page.getByRole("heading", { name: "No matching drivers", exact: true }),
  ).toBeVisible();
  await capture("no-results");
  await page.getByLabel("Search drivers", { exact: true }).fill("");
  await expect(page.locator(".driver-table tbody tr")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const animations = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  expect(animations).toBe(0);
  results.push({ name: "reduced-motion", animations });
  writeFileSync(
    resolve(output, "results.json"),
    JSON.stringify(results, null, 2),
  );
}
