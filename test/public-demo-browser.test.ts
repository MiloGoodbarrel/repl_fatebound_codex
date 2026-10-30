import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { WORKSPACE_DEMO_KEY, type WorkspaceDemoData } from "../client/src/demo/workspaceData";

test("real-screen public demo supports desktop/mobile tools without private API or Clerk requests", {
  skip: process.env.PUBLIC_DEMO_BROWSER_TEST !== "1", timeout: 240000,
}, async () => {
  const origin = process.env.PUBLIC_DEMO_ORIGIN ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      context.setDefaultTimeout(10000);
      const page = await context.newPage(), errors: string[] = [], privateRequests: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("request", req => {
        const u = new URL(req.url());
        if (u.pathname.startsWith("/api/") || u.pathname.includes("/__clerk") || /clerk\.(accounts|com)/.test(u.hostname)) privateRequests.push(u.pathname);
      });
      page.on("dialog", dialog => void dialog.accept());
      const snapshot = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as WorkspaceDemoData, WORKSPACE_DEMO_KEY);
      const nav = page.getByRole("navigation", { name: "Campaign tools" });
      await page.goto(`${origin}/dev`);
      await expect(page.getByRole("heading", { name: "D&D DM Toolkit" })).toBeVisible();
      await expect(page.getByLabel("Public demo notice")).toBeVisible();
      await page.evaluate(() => localStorage.setItem("activeCampaign", "PRIVATE_SENTINEL"));
      await page.getByTestId("button-toggle-campaigns").click();
      await page.getByTestId("button-select-campaign-1").click();
      await page.getByTestId("button-link-resources-1").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Linked resources for The Lantern Coast" })).toBeVisible();
      await page.getByTestId("select-resource-source").click();
      await page.getByRole("option", { name: "The Ashen Observatory" }).click();
      await dialog.locator("label").filter({ hasText: "Star Chart Compass" }).click();
      await page.getByTestId("button-confirm-link-resources").click();
      await expect(dialog.getByText("Currently linked (1)")).toBeVisible();
      await dialog.getByRole("button", { name: "Close", exact: true }).first().click();

      await nav.getByRole("link", { name: "Initiative", exact: true }).click();
      await page.getByRole("dialog").getByLabel("D&D 5e (2014)", { exact: true }).click();
      await page.getByRole("button", { name: "Start Combat Setup", exact: true }).click();
      await expect(page.getByTestId("button-load-prepared-400")).toBeVisible();
      await page.getByTestId("button-load-prepared-400").click();
      await expect(page.getByTestId("text-combatant-name-demo-combat-guardians")).toContainText("Shorebound Sentinels");
      if (viewport.width < 768) await page.getByRole("button", { name: "Controls", exact: true }).click();
      await page.getByTestId("button-start-combat").click();
      await expect(page.getByTestId("button-next-turn")).toBeVisible();
      await page.getByTestId("button-next-turn").click();
      await page.getByTestId("button-save-encounter").click();
      await expect.poll(async () => !!(await snapshot()).encounters["1"]).toBe(true);
      // Feature tabs retain the very same mounted combat screen.
      await nav.getByRole("link", { name: "Loot", exact: true }).click();
      await expect(page.getByText("Deck of Loot", { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("checkbox-source-PHB")).toBeVisible();
      await page.getByTestId("input-source-search").fill("Player");
      const phb = page.locator('[data-sourcebook="PHB"]').first();
      await expect(phb).toBeVisible();
      if (viewport.width >= 768) await phb.hover();
      else await phb.focus();
      await expect(page.getByRole("tooltip")).toContainText("Player's Handbook");
      await phb.press("Escape");
      await page.getByTestId("input-source-search").fill("DMG");
      await page.getByTestId("button-clear-all-sources").click();
      await page.getByTestId("checkbox-source-DMG").click();
      await page.getByTestId("input-search").fill("Bag of Holding");
      await page.getByTestId("button-draw-cards").click();
      await expect(page.getByText("Bag of Holding", { exact: true }).first()).toBeVisible();
      await nav.getByRole("link", { name: "Initiative", exact: true }).click();
      await expect(page.getByTestId("button-next-turn")).toBeVisible();
      await nav.getByRole("link", { name: "Roll Tables", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Roll Tables", exact: true })).toBeVisible();

      await nav.getByRole("link", { name: "Sessions", exact: true }).click();
      await page.getByLabel("Session name", { exact: true }).fill(`QA session ${viewport.width}`);
      await page.getByRole("button", { name: "Create session", exact: true }).click();
      const notes = page.getByRole("textbox", { name: "Session notes", exact: true });
      await notes.fill("Fictional notes written with the real journal screen.");
      await expect.poll(async () => (await snapshot()).sessions[0].session.notes).toBe("Fictional notes written with the real journal screen.");
      // A brand-new session starts directly in the real summary editor.
      await page.getByLabel("Session Overview editable summary", { exact: true }).fill("The party found a lens.");
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await expect.poll(async () => Object.values((await snapshot()).summaries).flat().length).toBe(1);
      await nav.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByRole("button", { name: "Light", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
      await expect(page.getByRole("button", { name: "Delete workspace data", exact: true })).toBeDisabled();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
      assert.ok((await snapshot()).sessions.some(s => s.session.notes.includes("Fictional notes written")));
      await page.getByRole("button", { name: "Reset demo", exact: true }).click();
      await expect.poll(async () => (await snapshot()).sessions.length).toBe(1);
      assert.equal(await page.evaluate(() => localStorage.getItem("activeCampaign")), "PRIVATE_SENTINEL");
      await page.evaluate(key => localStorage.setItem(key, "{broken"), WORKSPACE_DEMO_KEY);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Demo storage needs attention" })).toBeVisible();
      await page.getByRole("button", { name: "Reset demo", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Account & privacy" })).toBeVisible();
      assert.deepEqual(privateRequests, [], "Demo UI must never contact real APIs or identity services");
      assert.deepEqual(errors, [], "Shared screens should render without errors");
      const realApi = await page.request.get(`${origin}/api/campaigns`);
      assert.equal(realApi.status(), 401, "Real APIs still require authentication");
      const stockItems = await (await page.request.get(`${origin}/demo-library/items/5e`)).json();
      const stockSources = await (await page.request.get(`${origin}/demo-library/items/5e/sources`)).json();
      const monsterSources = await (await page.request.get(`${origin}/demo-library/bestiary/sources`)).json();
      assert.ok(stockItems.length > 1000, "Full stock deck, not a demo-sized substitute");
      assert.ok(stockSources.length > 20 && stockSources.includes("PHB"));
      assert.ok(monsterSources.length > 10 && monsterSources.includes("Monster Manual"));
      const stockMonster = await (await page.request.get(`${origin}/demo-library/bestiary/monsters?search=aboleth`)).json();
      assert.ok(stockMonster.length > 0);
      const detail = await (await page.request.get(`${origin}/demo-library/bestiary/monsters/${stockMonster[0].index}`)).json();
      assert.ok(detail.detailedActions.length > 0, "Real monster statblock retains its actions");
      for (const method of ["POST", "DELETE"])
        assert.equal((await page.request.fetch(`${origin}/demo-library/items/5e`, { method })).status(), 405);
      assert.equal((await page.request.get(`${origin}/demo-library/campaigns/1`)).status(), 404);
      console.log(`Stock library: ${stockItems.length} items, ${stockSources.length} item sources, ${monsterSources.length} monster sources`);
      const response = await page.request.get(`${origin}/dev/sessions`);
      assert.match(response.headers()["x-robots-tag"], /noindex/);
      await context.close();
    }
  } finally { await browser.close(); }
});
