import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect, type Page } from "@playwright/test";
import { DEMO_STORAGE_KEY, type DemoState } from "../client/src/demo/model";

test("public demo is accountless, local-only, persistent, resettable and usable on desktop/mobile", {
  skip: process.env.PUBLIC_DEMO_BROWSER_TEST !== "1", timeout: 180000,
}, async () => {
  const origin = process.env.PUBLIC_DEMO_ORIGIN ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const snapshot = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as DemoState, DEMO_STORAGE_KEY);
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage(), errors: string[] = [], privateRequests: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("request", req => {
        const url = new URL(req.url());
        if (url.pathname.startsWith("/api/") || url.pathname.includes("/__clerk") || /clerk\.(accounts|com)/.test(url.hostname)) privateRequests.push(url.pathname);
      });
      await page.goto(`${origin}/dev`);
      await expect(page.getByRole("heading", { name: "Campaign workspace" })).toBeVisible();
      await expect(page.getByText("PUBLIC DEMO · FICTIONAL DATA", { exact: true })).toBeVisible();
      await page.evaluate(() => localStorage.setItem("activeCampaign", "PRIVATE_WORKSPACE_SENTINEL"));
      const campaignName = `QA Coast ${viewport.width}`;
      await page.getByRole("button", { name: "New campaign" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.getByLabel("Campaign name", { exact: true }).fill(campaignName);
      for (let n = 0; n < 8; n++) await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true);
      await page.getByRole("button", { name: "Save campaign", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByLabel("Active campaign")).toHaveValue(/demo-/);
      assert.equal((await snapshot(page)).campaigns.some(c => c.name === campaignName), true);
      await page.getByRole("button", { name: "Add person" }).click();
      await page.getByLabel("Name", { exact: true }).fill("Fictional QA scout");
      await page.getByRole("button", { name: "Save person" }).click();
      await expect(page.getByText("Fictional QA scout")).toBeVisible();
      await page.getByLabel("Active campaign").selectOption("demo-lantern");
      await expect(page.getByText("Fictional QA scout")).toHaveCount(0);
      await page.getByRole("link", { name: "Initiative", exact: true }).click();
      await page.getByLabel("Shorebound Sentinels group count").fill("5");
      await page.getByLabel("Shorebound Sentinels shared HP", { exact: true }).fill("12");
      await page.getByLabel("Shorebound Sentinels conditions").fill("prone, restrained");
      await page.getByRole("button", { name: "Start", exact: true }).click();
      await page.getByRole("button", { name: "Next turn", exact: true }).click();
      const combat = (await snapshot(page)).encounters.find(e => e.id === "demo-caves")!;
      assert.equal(combat.members.find(m => m.name === "Shorebound Sentinels")?.count, 5);
      assert.equal(combat.members.find(m => m.name === "Shorebound Sentinels")?.hp, 12);
      assert.deepEqual(combat.members.find(m => m.name === "Shorebound Sentinels")?.conditions, ["prone", "restrained"]);
      assert.equal(combat.running, true);
      assert.equal(combat.turn, 1);
      await page.getByRole("link", { name: "Loot", exact: true }).click();
      await page.getByRole("button", { name: "Draw item" }).click();
      await page.getByRole("button", { name: "Save to campaign loot" }).click();
      assert.equal((await snapshot(page)).loot.reduce((n, item) => n + item.quantity, 0), 2);
      await page.getByRole("link", { name: "Roll tables", exact: true }).click();
      await page.getByRole("button", { name: "Roll", exact: true }).click();
      assert.equal((await snapshot(page)).lastRoll?.tableId, "demo-coast-table");
      await page.getByRole("link", { name: "Sessions", exact: true }).click();
      const notes = page.getByLabel("Fictional session notes");
      await notes.fill("Fictional QA notes survived a reload.");
      await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
      await page.getByRole("button", { name: "Approve snapshot", exact: true }).click();
      await page.getByRole("button", { name: "Restore as new draft", exact: true }).last().click();
      await page.getByRole("button", { name: "Restore as new snapshot", exact: true }).click();
      assert.deepEqual((await snapshot(page)).sessions[0].versions.map(v => v.status), ["approved", "draft", "approved", "draft"]);
      await page.reload();
      await expect(notes).toHaveValue("Fictional QA notes survived a reload.");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reset Demo", exact: true }).click();
      assert.equal((await snapshot(page)).campaigns.length, 2);
      assert.equal((await snapshot(page)).sessions[0].versions.length, 1);
      assert.equal(await page.evaluate(() => localStorage.getItem("activeCampaign")), "PRIVATE_WORKSPACE_SENTINEL");
      await page.evaluate(key => localStorage.setItem(key, "{broken demo data"), DEMO_STORAGE_KEY);
      await page.reload();
      await expect(page.getByRole("alert")).toContainText("Stored demo data could not be read");
      await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reset Demo", exact: true }).click();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.goto(`${origin}/dev/initiative`);
      await expect(page.getByRole("heading", { name: "Initiative", exact: true })).toBeVisible();
      assert.deepEqual(privateRequests, [], "Demo UI must never contact real account/API services");
      assert.deepEqual(errors, []);
      const privateAPI = await page.request.get(`${origin}/api/campaigns`);
      assert.equal(privateAPI.status(), 401, "Demo mode does not bypass real API authorization");
      const headers = await page.request.get(`${origin}/dev/sessions`);
      assert.match(headers.headers()["x-robots-tag"], /noindex/);
      await context.close();
    }
  } finally { await browser.close(); }
});
