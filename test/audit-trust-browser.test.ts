import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect, type Page } from "@playwright/test";
import { WORKSPACE_DEMO_KEY } from "../client/src/demo/workspaceData";

test("two real demo tabs reject stale combat saves and recover; journal dates, titles and protection copy", {
  skip: process.env.TRUST_BROWSER_TEST !== "1", timeout: 180000,
}, async () => {
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Denver" });
    context.setDefaultTimeout(10000);
    const errors: string[] = [], privateRequests: string[] = [];
    context.on("page", page => {
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith("/api/") || path.includes("/__clerk")) privateRequests.push(path);
      });
    });
    await context.addInitScript(expectedOrigin => {
      if (location.origin === expectedOrigin)
        sessionStorage.setItem("fatebound:campaign-selection:demo:v3", "1");
    }, origin);
    const a = await context.newPage();
    await a.goto(`${origin}/dev/campaigns`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(a).toHaveTitle("Campaigns | Fatebound Codex Demo");
    const heroId = await a.evaluate(async () => {
      const prepared = await (await fetch("/api/campaigns/1/prepared-encounters")).json();
      const hero = prepared[0].data.combatants.find((c: any) => c.combatantType === "pc");
      hero.hp = 12; hero.maxHp = 12; hero.conditions = [];
      const response = await fetch("/api/campaigns/1/encounter", {
        method: "PUT", headers: { "Content-Type": "application/json", "X-Encounter-Revision": "none" },
        body: JSON.stringify({ combatants: [hero], round: 1, activeIndex: 0, combatState: "active",
          selectedVersions: ["5e"], loadedPreparedEncounter: false, rescuedCaptives: 0 }),
      });
      if (!response.ok) throw new Error(await response.text());
      return hero.id as string;
    });
    const saved = () => a.evaluate(key => JSON.parse(localStorage.getItem(key)!).encounters["1"], WORKSPACE_DEMO_KEY);
    async function openCombat(page: Page) {
      await page.goto(`${origin}/dev/initiative`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await expect(page).toHaveTitle("Initiative Tracker | Fatebound Codex Demo");
      await expect(page.locator('[aria-label="Active campaign: Lost Mine of Phandelver"]')).toBeVisible();
      // Resuming restores the saved ruleset; a fresh-setup version choice is unnecessary.
      await page.getByRole("dialog").press("Escape");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByTestId(`input-hp-${heroId}`)).toBeVisible();
    }
    await openCombat(a);
    const b = await context.newPage();
    await openCombat(b);
    const originalRevision = (await saved()).data.saveRevision;
    // Restoring is a read, not a reason to claim ownership with an unnecessary autosave.
    await a.waitForTimeout(700);
    assert.equal((await saved()).data.saveRevision, originalRevision);
    const damage = async (page: Page, amount: number) => {
      await page.getByTestId(`input-hp-${heroId}`).fill(String(amount));
      await page.getByTestId(`button-damage-${heroId}`).click();
    };
    await damage(b, 5);
    await expect.poll(async () => (await saved()).data.combatants[0].hp).toBe(7);
    await damage(a, 1);
    const conflict = a.getByRole("alert").filter({ hasText: "Encounter changed in another tab or device" });
    await expect(conflict).toBeVisible();
    assert.equal((await saved()).data.combatants[0].hp, 7);
    assert.ok(await a.getByTestId(`input-hp-${heroId}`).isVisible(), "local combat is retained");
    const downloadPromise = a.waitForEvent("download");
    await a.getByRole("button", { name: "Download this tab's draft", exact: true }).click();
    assert.equal((await downloadPromise).suggestedFilename(), "fatebound-encounter-draft.json");
    await a.setViewportSize({ width: 390, height: 844 });
    await expect(a.getByRole("button", { name: "Reload latest encounter", exact: true })).toBeVisible();
    assert.ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await a.screenshot({ path: "/tmp/fatebound-conflict-mobile.png" });
    await a.getByRole("button", { name: "Reload latest encounter", exact: true }).click();
    await expect(conflict).toHaveCount(0);
    await a.setViewportSize({ width: 1280, height: 900 });
    await damage(a, 1);
    await expect.poll(async () => (await saved()).data.combatants[0].hp).toBe(6);
    await b.getByTestId("button-reset-all").click();
    await b.getByRole("dialog").getByRole("button", { name: "Proceed", exact: true }).click();
    await expect(b.getByRole("alert").filter({ hasText: "Encounter changed in another tab or device" })).toBeVisible();
    assert.equal((await saved()).data.combatants[0].hp, 6);
    await expect(b.getByTestId(`input-hp-${heroId}`)).toBeVisible();
    // Continue the DM workflow into notes. A late-Mountain evening is already tomorrow in UTC.
    await a.clock.setFixedTime(new Date("2026-10-30T02:51:00Z"));
    const nav = a.getByRole("navigation", { name: "Campaign tools" });
    await nav.getByRole("link", { name: "Sessions", exact: true }).click();
    await expect(a).toHaveTitle("Session Journal | Fatebound Codex Demo");
    await expect(a.locator("#session-date")).toHaveValue("2026-10-29");
    await a.getByLabel("Session name", { exact: true }).fill("QA trust protections");
    await a.getByRole("button", { name: "Create session", exact: true }).click();
    const summary = a.getByLabel("Session Overview editable summary", { exact: true });
    await summary.fill("Manual notes remain editable.");
    await a.getByLabel("Lock Session Overview from future automatic updates", { exact: true }).check();
    await expect(a.getByText("Automatic updates will leave this section unchanged. You can still edit it manually.", { exact: true })).toBeVisible();
    await expect(a.locator('label[for="summary-lock-overview"]')).toHaveText("Protect from automatic updates");
    await expect(summary).toBeEnabled();
    await summary.fill("A deliberate manual edit after protection.");
    await a.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(a.getByText("Draft · rev 1", { exact: true }).first()).toBeVisible();
    await expect.poll(() => a.evaluate(key => Object.values(JSON.parse(localStorage.getItem(key)!).summaries)
      .flat().some((v: any) => v.sections.some((s: any) => s.id === "overview" && s.locked
        && s.text === "A deliberate manual edit after protection.")), WORKSPACE_DEMO_KEY)).toBe(true);
    await nav.getByRole("link", { name: "Loot", exact: true }).click();
    await expect(a).toHaveTitle("Deck of Loot | Fatebound Codex Demo");
    await nav.getByRole("link", { name: "Roll Tables", exact: true }).click();
    await expect(a).toHaveTitle("Roll Tables | Fatebound Codex Demo");
    assert.deepEqual(errors, []);
    assert.deepEqual(privateRequests, [], "all demo writes remain browser-only");
    await context.close();
  } finally { await browser.close(); }
});
