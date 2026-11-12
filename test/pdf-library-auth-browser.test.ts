import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Page } from "@playwright/test";
import { clerkClient } from "@clerk/express";
import { pdf } from "./document-fixtures";

// Opt-in: creates two disposable Clerk development users and real database rows.
// No auth injection, API mocks, saved sessions, or real campaign content.
test("signed-in PDF imports persist and stay in their owner's campaign", {
  skip: process.env.PDF_AUTH_BROWSER_TEST !== "1", timeout: 240_000,
}, async t => {
  assert.ok(process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev"), "Development preview required");
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const accounts: { id: string; email: string; password: string }[] = [];
  const created: { page: Page; id: number }[] = [];
  const { pool } = await import("../server/db");
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const page = await ownerContext.newPage();
  const second = await otherContext.newPage();
  page.on("pageerror", error => t.diagnostic(`Browser error: ${error.message}`));
  const run = randomUUID();
  const api = async (page: Page, path: string, method = "GET", body?: unknown, headers?: Record<string, string>) =>
    page.evaluate(async ({ path, method, body, headers }) => {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() };
    }, { path, method, body, headers });
  const ok = async (page: Page, path: string, method = "GET", body?: unknown) => {
    const result = await api(page, path, method, path.endsWith("/pdf-import/commit") && body
      ? { idempotencyKey: randomUUID(), ...body as object } : body);
    assert.equal(result.status, 200, `${method} ${path} failed (${result.status})`);
    return result.data;
  };
  const signIn = async (page: Page, account: typeof accounts[number]) => {
    await page.goto(`${origin}/sign-in`);
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    const codeSent = page.waitForResponse(response =>
      /\/prepare_/.test(new URL(response.url()).pathname) && response.ok(), { timeout: 15_000 });
    // Input rendering can precede Clerk sending the device-verification code.
    // Observe completion before entering the OTP instead of using a fixed delay.
    void codeSent.catch(() => {});
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // Clerk's normal new-device verification, using its documented test mailbox.
    const otp = page.locator('input[autocomplete="one-time-code"]');
    await Promise.race([otp.waitFor({ state: "visible" }), page.waitForURL("**/campaigns")]);
    if (await otp.isVisible()) {
      await codeSent;
      await otp.fill("424242");
    }
    await page.waitForURL("**/campaigns").catch(async () => {
      throw new Error(`Sign-in did not finish at ${new URL(page.url()).pathname}: ${
        (await page.locator("body").innerText()).replaceAll(account.email, "[test email]").slice(-1800)}`);
    });
    await expect(page.getByTestId("button-toggle-campaigns")).toBeVisible();
  };
  const campaign = async (page: Page, suffix: string) => {
    const value = await ok(page, "/api/campaigns", "POST", {
      name: `PDF QA ${run} ${suffix}`, edition: "5e", description: "Disposable fictional PDF test",
    });
    created.push({ page, id: value.id });
    return value;
  };
  const select = async (page: Page, id: number) => {
    await page.goto(`${origin}/campaigns`);
    const button = page.getByTestId(`button-select-campaign-${id}`);
    if (!await button.isVisible()) await page.getByTestId("button-toggle-campaigns").click();
    await expect(button).toBeVisible();
    if ((await button.innerText()).includes("Select")) await button.click();
  };
  const library = async (page: Page, kind: "items" | "creatures") => {
    await page.goto(`${origin}/${kind === "items" ? "loot" : "initiative"}`);
    if (kind === "creatures") {
      await page.getByRole("dialog").getByRole("checkbox", { name: "D&D 5e (2014)", exact: true }).check();
      await page.getByRole("button", { name: "Start Combat Setup", exact: true }).click();
      await page.getByRole("button", { name: /Homebrew Bestiary/ }).click({ timeout: 10_000 }).catch(async () => {
        throw new Error(`Creature library unavailable: ${(await page.locator("body").innerText()).slice(0, 2500)}`);
      });
    }
    await expect(page.getByRole("button", { name: "Import PDF", exact: true })).toBeVisible();
  };
  const upload = async (page: Page, kind: "items" | "creatures", text: string) => {
    const input = page.locator('input[type="file"][accept*=".pdf"]');
    await input.setInputFiles({ name: "fictional-module.pdf", mimeType: "application/pdf", buffer: pdf(text) });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name", { exact: false }).first()).toHaveValue(
      kind === "items" ? "Moon Lantern" : "Frost Watcher");
    return dialog;
  };
  const itemText = "Moon Lantern\nWondrous item, uncommon\nIt shines with blue light.";
  const npcText = "Frost Watcher\nMedium humanoid, neutral\nArmor Class 14\nHit Points 22 (4d8 + 4)\nChallenge 1/2 (100 XP)\nActions\nSpear. Hit: 5 piercing damage.";
  const baselineItem = { name: "Existing Lantern", category: "Wondrous Items", rarity: "Common", description: "Keep this original.", source: "Fictional baseline" };
  const baselineNpc = { index: "existing-watcher", name: "Existing Watcher", hp: 10, ac: 12, cr: "0", type: "humanoid", size: "Medium", source: "Fictional baseline" };
  try {
    await page.goto(`${origin}/sign-in`);
    await page.waitForFunction(() => (window as any).Clerk?.loaded);
    assert.equal(await page.evaluate(() => (window as any).Clerk.publishableKey.startsWith("pk_test_")), true,
      "Never create QA users in production");
    for (const suffix of ["owner", "other"]) {
      const email = `pdf-qa-${run}-${suffix}+clerk_test@example.com`;
      const password = `${randomBytes(32).toString("base64url")}!aA9`;
      const user = await clerkClient.users.createUser({ emailAddress: [email], password });
      accounts.push({ id: user.id, email, password });
    }
    await signIn(page, accounts[0]);
    await signIn(second, accounts[1]);
    const a = await campaign(page, "A");
    const b = await campaign(page, "B");
    const other = await campaign(second, "Other");
    await ok(page, `/api/campaigns/${a.id}/pdf-import/commit`, "POST", { kind: "items", entries: [baselineItem] });
    await ok(page, `/api/campaigns/${a.id}/pdf-import/commit`, "POST", { kind: "creatures", entries: [baselineNpc] });
    const initialItems = await ok(page, `/api/campaigns/${a.id}/items`);
    const initialNpcs = await ok(page, `/api/campaigns/${a.id}/homebrew-bestiary`);
    await select(page, a.id);
    await library(page, "items");
    let dialog = await upload(page, "items", itemText);
    assert.deepEqual(await ok(page, `/api/campaigns/${a.id}/items`), initialItems, "Preview must not write");
    await dialog.getByLabel("Name", { exact: false }).first().fill("Reviewed Moon Lantern");
    await dialog.getByLabel("Description", { exact: false }).fill("Reviewed blue light.");
    await dialog.getByLabel("Source page", { exact: true }).fill("7");
    // Commit for real, then interrupt only the response reaching the browser.
    let interruptedBody: any;
    let committedResult: any;
    await page.route(`**/api/campaigns/${a.id}/pdf-import/commit`, async route => {
      interruptedBody = route.request().postDataJSON();
      const token = await page.evaluate(async () => (window as any).Clerk.session.getToken());
      const actual = await route.fetch({
        headers: { ...await route.request().allHeaders(), Authorization: `Bearer ${token}` },
      });
      assert.equal(actual.status(), 200);
      committedResult = await actual.json();
      await route.abort("connectionreset");
    }, { times: 1 });
    await dialog.getByRole("button", { name: "Save 1 item", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Retry Save");
    await expect(dialog.getByLabel("Name", { exact: false }).first()).toBeDisabled();
    const afterInterrupted = await ok(page, `/api/campaigns/${a.id}/items`);
    assert.equal(afterInterrupted.length, 2, "Server committed before the response was lost");
    const retried = page.waitForResponse(response => response.url().endsWith(`/api/campaigns/${a.id}/pdf-import/commit`));
    await dialog.getByRole("button", { name: "Save 1 item", exact: true }).click();
    const retryResponse = await retried;
    assert.deepEqual(retryResponse.request().postDataJSON(), interruptedBody, "Retry must retain the exact operation");
    assert.deepEqual(await retryResponse.json(), committedResult, "Retry returns the original result");
    await expect(dialog).not.toBeVisible();
    await page.reload();
    const items = await ok(page, `/api/campaigns/${a.id}/items`);
    assert.deepEqual(items, afterInterrupted, "Retry added no extra rows");
    assert.deepEqual(items.find((entry: any) => entry.id === initialItems[0].id), initialItems[0]);
    const reviewed = items.find((entry: any) => entry.name === "Reviewed Moon Lantern");
    assert.equal(reviewed.description, "Reviewed blue light.");
    assert.equal(reviewed.source, "fictional-module.pdf · p. 7");
    const storedItem = await pool.query("SELECT description, source FROM campaign_items WHERE id=$1 AND campaign_id=$2", [reviewed.id, a.id]);
    assert.equal(storedItem.rows[0].source, reviewed.source);
    assert.equal(storedItem.rows[0].description, reviewed.description);
    t.diagnostic("Reviewed item and source/page survived reload in the real database; existing item unchanged.");

    await library(page, "creatures");
    dialog = await upload(page, "creatures", npcText);
    await dialog.getByLabel("Name", { exact: false }).first().fill("Reviewed Frost Watcher");
    await dialog.getByLabel("Description", { exact: false }).fill("Reviewed fictional guardian.");
    await dialog.getByLabel("Source page", { exact: true }).fill("3");
    await dialog.getByRole("button", { name: "Save 1 creature", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    const npcs = await ok(page, `/api/campaigns/${a.id}/homebrew-bestiary`);
    assert.deepEqual(npcs.find((entry: any) => entry.id === initialNpcs[0].id), initialNpcs[0]);
    const npc = npcs.find((entry: any) => entry.name === "Reviewed Frost Watcher");
    assert.equal(npc.profileData.description, "Reviewed fictional guardian.");
    assert.equal(npc.profileData.source, "fictional-module.pdf");
    assert.equal(npc.profileData.sourcePage, 3);
    assert.match(npc.actions[0].actionDescription, /Spear/);
    const storedNpc = await pool.query("SELECT profile_data FROM campaign_homebrew_monsters WHERE campaign_id=$1 AND name=$2", [a.id, npc.name]);
    assert.equal(storedNpc.rows[0].profile_data.sourcePage, 3);
    t.diagnostic("Reviewed creature, actions and source/page survived reload; existing NPC unchanged.");

    // Duplicate review must block saving and reset acknowledgement after an edit.
    await library(page, "items");
    dialog = await upload(page, "items", itemText);
    await dialog.getByLabel("Name", { exact: false }).first().fill("Reviewed Moon Lantern");
    const save = dialog.getByRole("button", { name: "Save 1 item", exact: true });
    await expect(save).toBeDisabled();
    const acknowledge = dialog.getByRole("checkbox", { name: "Acknowledge importing duplicate names" });
    await acknowledge.check();
    await expect(save).toBeEnabled();
    await dialog.getByLabel("Description", { exact: false }).fill("Explicit duplicate.");
    await expect(save).toBeDisabled();
    await acknowledge.check();
    const deliberate = page.waitForRequest(request => request.url().endsWith(`/api/campaigns/${a.id}/pdf-import/commit`));
    await save.click();
    assert.notEqual((await deliberate).postDataJSON().idempotencyKey, interruptedBody.idempotencyKey);
    await expect(dialog).not.toBeVisible();
    assert.equal((await ok(page, `/api/campaigns/${a.id}/items`)).length, 3);
    assert.equal((await api(second, `/api/campaigns/${a.id}/pdf-import/commit`, "POST", interruptedBody)).status, 404,
      "Another owner cannot replay a receipt");
    t.diagnostic("Duplicate acknowledgement is required and is invalidated when the reviewed entry changes.");

    for (const path of ["items", "homebrew-bestiary", "pdf-import/preview?kind=items&filename=fictional.pdf", "pdf-import/commit"]) {
      const method = path.startsWith("pdf-import/") ? "POST" : "GET";
      assert.equal((await api(second, `/api/campaigns/${a.id}/${path}`, method,
        method === "POST" ? { kind: "items", entries: [baselineItem] } : undefined)).status, 404);
    }
    assert.equal((await api(page, `/api/campaigns/${other.id}/items`)).status, 404);
    // Cookie-authenticated direct request preserves the deliberately stale header;
    // the app's guarded window.fetch correctly replaces it with the active user.
    const stale = await page.context().request.post(`${origin}/api/campaigns/${a.id}/pdf-import/commit`, {
      headers: { Origin: origin, "X-Workspace-User": accounts[1].id },
      data: { kind: "items", entries: [baselineItem] },
    });
    assert.equal(stale.status(), 409);

    // Change campaigns while a browser preview request is pending. Delay only;
    // never replace API responses or inject authentication.
    await library(page, "items");
    let release!: () => void;
    let received!: () => void;
    let navigated = false;
    const held = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { received = resolve; });
    await page.route("**/pdf-import/preview?**", async route => {
      received();
      await held;
      await route.continue().catch(error => {
        // A document navigation cancels the original browser request.
        if (!navigated || !/already handled/.test(error.message)) throw error;
      });
    });
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
      name: "fictional-module.pdf", mimeType: "application/pdf", buffer: pdf(itemText),
    });
    await Promise.race([reached, new Promise((_, reject) => setTimeout(() => reject(new Error("Preview request was not observed")), 10_000))]);
    // The modal prevents ordinary navigation; a same-origin document navigation
    // is the browser's normal way of changing workspace while a request runs.
    await select(page, b.id);
    navigated = true;
    release();
    await page.unrouteAll({ behavior: "wait" });
    await library(page, "items");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    assert.equal((await ok(page, `/api/campaigns/${b.id}/items`)).length, 0);

    // Sign out in another tab while a review is open, then sign in as the
    // other real account. Clerk's account listener must destroy the old draft.
    await select(page, a.id);
    await library(page, "items");
    await upload(page, "items", itemText);
    const sibling = await page.context().newPage();
    await sibling.goto(`${origin}/campaigns`);
    await sibling.waitForFunction(() => (window as any).Clerk?.loaded);
    await sibling.getByRole("button", { name: "Sign out", exact: true }).click();
    await sibling.waitForURL(origin + "/");
    // A background tab can defer provider session synchronization until focused.
    await page.bringToFront();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.waitForURL(origin + "/");
    await signIn(page, accounts[1]);
    assert.deepEqual((await ok(page, "/api/campaigns")).map((entry: any) => entry.id), [other.id]);
    await expect(page.getByRole("dialog")).not.toBeVisible();
    assert.equal((await ok(page, `/api/campaigns/${other.id}/items`)).length, 0);
    assert.equal((await api(page, `/api/campaigns/${a.id}/items`)).status, 404);
    // Sign back into the original account and confirm the originals/imports.
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(origin + "/");
    await signIn(page, accounts[0]);
    assert.equal((await ok(page, `/api/campaigns/${a.id}/items`)).length, 3);
    assert.deepEqual(await ok(page, `/api/campaigns/${a.id}/homebrew-bestiary`), npcs);
    assert.equal((await ok(page, `/api/campaigns/${b.id}/items`)).length, 0);
    t.diagnostic("Owner-only access, stale identity rejection, campaign change and cross-tab sign-out verified without auth bypass.");
  } finally {
    // Only remove resources created by this invocation, even after a failed check.
    // Scoped database cleanup also works if the browser's login changed mid-test.
    try {
      for (const { id } of created) {
        const owners = accounts.map(account => account.id);
        const owned = await pool.query("SELECT id FROM campaigns WHERE id=$1 AND owner_user_id = ANY($2::text[])", [id, owners]);
        if (!owned.rowCount) continue;
        await pool.query("DELETE FROM campaign_items WHERE campaign_id=$1", [id]);
        await pool.query("DELETE FROM campaign_homebrew_actions WHERE monster_ref_id IN (SELECT id FROM campaign_homebrew_monsters WHERE campaign_id=$1)", [id]);
        await pool.query("DELETE FROM campaign_homebrew_monsters WHERE campaign_id=$1", [id]);
        await pool.query("DELETE FROM campaigns WHERE id=$1 AND owner_user_id = ANY($2::text[])", [id, owners]);
      }
      for (const account of accounts) {
        await pool.query("DELETE FROM app_accounts WHERE user_id=$1", [account.id]);
        await clerkClient.users.deleteUser(account.id);
      }
    } finally {
      await browser.close();
      await pool.end();
    }
  }
});
