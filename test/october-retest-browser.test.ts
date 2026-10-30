import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { WORKSPACE_DEMO_KEY } from "../client/src/demo/workspaceData";

test("October retest: rolled-group healing, native-free duplication, campaign/draft recovery and linked loot", {
  skip: process.env.RETEST_BROWSER_TEST !== "1", timeout: 240000,
}, async () => {
  const origin = process.env.PUBLIC_DEMO_ORIGIN ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const viewport of [{ width: 1363, height: 936 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      context.setDefaultTimeout(15000);
      // Deterministic hit-die rolls make the original above-average HP defect reproducible.
      await context.addInitScript(() => { Math.random = () => 0.8; });
      const page = await context.newPage(), errors: string[] = [], native: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("dialog", async dialog => {
        if (dialog.type() !== "beforeunload") native.push(dialog.message());
        await dialog.accept();
      });
      await page.goto(`${origin}/dev/campaigns`);
      await page.getByTestId("button-toggle-campaigns").click();
      await page.getByTestId("button-select-campaign-1").click();
      const nav = page.getByRole("navigation", { name: "Campaign tools" });
      await nav.getByRole("link", { name: "Initiative", exact: true }).click();
      await page.getByRole("dialog").getByLabel("D&D 5e (2014)", { exact: true }).click();
      await page.getByRole("button", { name: "Start Combat Setup", exact: true }).click();

      // Duplicate and rename must be regular DOM dialogs and leave the original intact.
      const before = await page.evaluate(async () => (await fetch("/api/campaigns/1/prepared-encounters")).json());
      const original = before.find((e: any) => e.id === 400);
      await page.getByRole("button", { name: `Duplicate ${original.name}`, exact: true }).click();
      await page.getByRole("textbox", { name: "Encounter name", exact: true }).fill("QA-RETEST Goblin Ambush");
      await page.getByRole("button", { name: "Create duplicate", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const after = await page.evaluate(async () => (await fetch("/api/campaigns/1/prepared-encounters")).json());
      assert.deepEqual(after.find((e: any) => e.id === 400), original);
      assert.equal(after.filter((e: any) => e.name === "QA-RETEST Goblin Ambush").length, 1);
      await page.getByRole("button", { name: "Rename QA-RETEST Goblin Ambush", exact: true }).click();
      await page.getByRole("textbox", { name: "Encounter name", exact: true }).fill("QA-RETEST Renamed Ambush");
      await page.getByRole("button", { name: "Save name", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Fresh stock group, not the fixed-average module fixture.
      await page.getByTestId("input-monster-search").fill("Goblin");
      await page.getByTestId("monster-result-dnd_5e2014_mm_goblin").click();
      await page.getByRole("button", { name: "Increase monster count", exact: true }).click();
      await page.getByTestId("button-add-monster").click();
      await page.getByTestId("button-roll-monster-initiative").click();
      await page.getByTestId("button-start-combat").click();
      await page.getByTestId("button-save-encounter").click();
      const state = async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), WORKSPACE_DEMO_KEY);
      await expect.poll(async () => !!(await state()).encounters["1"]).toBe(true);
      let saved = await state();
      const group = saved.encounters["1"].data.combatants.find((c: any) => c.isGroup);
      assert.ok(group.memberHp[0] > group.maxHp);
      assert.deepEqual(group.memberMaxHp, group.memberHp);
      if (viewport.width < 768) await page.getByRole("button", { name: /^Combat/ }).click();
      await page.getByTestId(`input-hp-${group.id}`).fill("1");
      await page.getByTestId(`button-damage-${group.id}`).click();
      await page.getByTestId(`input-hp-${group.id}`).fill("1");
      await page.getByTestId(`button-heal-${group.id}`).click();
      await expect(page.getByText(new RegExp(`Focus: G1.*${group.memberMaxHp[0]}/${group.memberMaxHp[0]}`))).toBeVisible();
      if (viewport.width < 768) await page.getByRole("button", { name: "Controls", exact: true }).click();
      await page.getByTestId("button-save-encounter").click();
      saved = await state();
      assert.equal(saved.encounters["1"].data.combatants.find((c: any) => c.id === group.id).memberHp[0], group.memberMaxHp[0]);

      await nav.getByRole("link", { name: "Roll Tables", exact: true }).click();
      await page.getByTestId("button-new-roll-table").click();
      await page.getByTestId("input-roll-table-name").fill("QA-RETEST unsaved draft");
      await page.reload();
      await expect(page.getByTestId("input-roll-table-name")).toHaveValue("QA-RETEST unsaved draft");
      await expect(page.getByText("No campaign selected", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Discard draft", exact: true }).click();
      const cached = await page.evaluate(() => sessionStorage.getItem("fatebound:table-draft:demo:v3:1"));
      assert.equal(cached, null);

      // Create the source link through the demo API; perform the actual draw in the UI.
      await page.evaluate(async () => {
        const response = await fetch("/api/campaigns/1/resources/links", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceCampaignId: 2, itemIds: [301], npcIds: [] }) });
        if (!response.ok) throw new Error("Could not establish QA resource link");
      });
      await page.getByRole("navigation", { name: "Campaign tools" }).getByRole("link", { name: "Loot", exact: true }).click();
      await page.getByTestId("input-search").fill("Star Chart Compass");
      await page.getByTestId("button-draw-cards").click();
      await expect(page.getByRole("heading", { name: "Star Chart Compass", exact: true }).first()).toBeVisible();
      await expect(page.getByTestId("button-upload-csv")).toBeDisabled();
      await page.getByTestId("input-search").fill("QA-NO-SUCH-ITEM");
      await page.getByTestId("button-draw-cards").click();
      await expect(page.getByRole("heading", { name: "No matching items", exact: true })).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(native, [], "Ordinary encounter operations must not require native prompts");
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});
