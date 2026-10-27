import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

test("feature tabs preserve local combat and filters; mobile controls remain reachable", {
  skip: process.env.FEATURE_BROWSER_TEST !== "1", timeout: 120_000,
}, async () => {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      // No campaign is selected; synthetic combatants stay in browser memory.
      await page.route("**/api/**", async route => {
        assert.equal(route.request().method(), "GET", "navigation must not modify saved campaign data");
        await route.continue();
      });
      await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/loot`);
      const navigation = page.getByRole("navigation", { name: "Campaign tools", includeHidden: true });
      const go = async (label: string) => {
        await navigation.getByRole("link", { name: label, exact: true }).click();
        await expect(navigation.getByRole("link", { name: label, exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
      };
      await page.getByTestId("input-search").fill("sword");
      await page.getByTestId("button-draw-cards").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("button-draw-cards")).toBeInViewport();
      await go("Initiative");
      await page.getByText("D&D 5e (2014)", { exact: true }).click();
      await page.getByRole("button", { name: "Start Combat Setup" }).click();
      await page.getByTestId("input-pc-name").fill("Tab Test Hero");
      await page.getByTestId("input-pc-hp").fill("20");
      await page.getByTestId("button-add-pc").click();
      await go("Roll Tables");
      await page.getByTestId("button-draw-roll-table").click();
      await expect(page.getByTestId("button-reroll-roll-table")).toBeVisible();
      await go("Initiative");
      if (viewport.width < 768) await page.getByTestId("tab-combat").click();
      await expect(page.getByText("Tab Test Hero", { exact: true })).toBeVisible();
      await go("Loot");
      await expect(page.getByTestId("input-search")).toHaveValue("sword");
      await go("Roll Tables");
      await expect(page.getByTestId("button-reroll-roll-table")).toBeVisible();
      await go("Sessions");
      await expect(page.getByRole("heading", { name: "Select a campaign first" })).toBeVisible();
      await page.goBack();
      await expect(navigation.getByRole("link", { name: "Roll Tables", exact: true })).toHaveAttribute("aria-current", "page");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
});
