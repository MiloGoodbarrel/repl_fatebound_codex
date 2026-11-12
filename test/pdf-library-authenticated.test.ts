import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect, type Page, type BrowserContext, type Route } from "@playwright/test";
import { clerkClient } from "@clerk/express";

/** Two-page, fictional text PDF. No user-provided modules or copyrighted fixtures. */
function fictionalPdf(tag: string) {
  const pages = [
    [`${tag} Watcher`, "Medium humanoid, neutral", "Armor Class 14", "Hit Points 22 (4d8 + 4)",
      "Challenge 1/2 (100 XP)", "Actions", "Spear. Melee Weapon Attack: +4 to hit. Hit: 5 piercing damage."],
    [`${tag} Lantern`, "Wondrous item, uncommon", "A fictional blue lantern used only for automated testing."],
  ];
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  for (const lines of pages) {
    const stream = "BT /F1 12 Tf 72 740 Td 18 TL " +
      lines.map((line, i) => `${i ? "T* " : ""}(${line.replace(/[\\()]/g, "\\$&")}) Tj`).join("\n") + " ET";
    const contentId = objects.length + 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

test("real Clerk sessions preserve reviewed PDF libraries and isolate owners, campaign switches and accounts", {
  skip: process.env.PDF_AUTH_E2E !== "1", timeout: 240000,
}, async () => {
  // Refuse live identity stores; never dump keys, tokens, cookies or browser storage.
  assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"), "This test requires a development Clerk instance.");
  const { pool } = await import("../server/db");
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const tag = `PDF-QA-${randomUUID().slice(0, 8)}`;
  const users: string[] = [], campaigns: number[] = [];
  const contexts: BrowserContext[] = [];
  const releasePreviews: Array<() => void> = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let ownerPage: Page | undefined;
  const api = async (page: Page, path: string, method = "GET", body?: unknown) => {
    return page.evaluate(async ({ path, method, body }) => {
      const response = await fetch(path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await response.text();
      let data: any; try { data = JSON.parse(text); } catch { data = text; }
      return { status: response.status, data };
    }, { path, method, body });
  };
  try {
    // Only accounts created by this run are ever signed in or removed.
    for (const role of ["owner", "other"]) {
      const user = await clerkClient.users.createUser({
        emailAddress: [`${tag.toLowerCase()}-${role}@example.com`],
        firstName: "PDF Test", lastName: role, skipPasswordRequirement: true,
        privateMetadata: { e2eTestUser: true, pdfQaRun: tag },
      });
      users.push(user.id);
    }
    browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
    const signIn = async (userId: string) => {
      const context = await browser!.newContext({ viewport: { width: 1280, height: 900 } });
      contexts.push(context);
      const page = await context.newPage();
      await page.goto(origin + "/sign-in", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window as any).Clerk?.loaded === true);
      const ticket = await clerkClient.signInTokens.createSignInToken({ userId, expiresInSeconds: 60 });
      const status = await page.evaluate(async token => {
        const clerk = (window as any).Clerk;
        const result = await clerk.client.signIn.create({ strategy: "ticket", ticket: token });
        if (result.status !== "complete") return result.status;
        await clerk.setActive({ session: result.createdSessionId });
        return result.status;
      }, ticket.token);
      assert.equal(status, "complete", "Provider sign-in must complete without an app bypass.");
      // setActive triggers the app's normal signed-in redirect. Do not race it with a second navigation.
      await expect(page.getByTestId("button-toggle-campaigns")).toBeVisible();
      const verified = await api(page, "/api/account");
      assert.equal(verified.status, 200); assert.equal(verified.data.admin, false);
      return page;
    };
    ownerPage = await signIn(users[0]);
    const otherPage = await signIn(users[1]);
    for (const suffix of ["A", "B"]) {
      const created = await api(ownerPage, "/api/campaigns", "POST", { name: `${tag} ${suffix}`, edition: "5e", description: "Synthetic PDF QA only." });
      if (typeof created.data?.id === "number") campaigns.push(created.data.id);
      assert.equal(created.status, 200);
    }
    const [a, b] = campaigns;
    // Baselines are fictional fixtures created by this run, not existing campaign content.
    assert.equal((await api(ownerPage, `/api/campaigns/${a}/pdf-import/commit`, "POST", { kind: "items",
      idempotencyKey: randomUUID(), entries: [{ name: `${tag} Baseline Item`, category: "Wondrous Items", rarity: "Common", description: "Keep this fixture." }] })).status, 200);
    assert.equal((await api(ownerPage, `/api/campaigns/${a}/pdf-import/commit`, "POST", { kind: "creatures",
      idempotencyKey: randomUUID(), entries: [{ index: "qa-baseline", name: `${tag} Baseline NPC`, hp: 7, ac: 11, cr: "0", type: "humanoid", size: "Medium" }] })).status, 200);
    const select = async (id: number) => {
      await ownerPage!.goto(origin + "/campaigns", { waitUntil: "domcontentloaded" });
      const selectButton = ownerPage!.getByTestId(`button-select-campaign-${id}`);
      if (!await selectButton.isVisible()) await ownerPage!.getByTestId("button-toggle-campaigns").click();
      await expect(selectButton).toBeVisible();
      const active = ownerPage!.locator(`[aria-label="Active campaign: ${tag} ${id === a ? "A" : "B"}"]`);
      // Selecting an already active card toggles it off; preserve the actual DM selection behavior.
      if (!await active.isVisible()) await selectButton.click();
      await expect(active).toBeVisible();
    };
    const upload = async (kind: "items" | "creatures") => {
      const input = ownerPage!.getByLabel(`Choose a PDF for ${kind} import`);
      await input.setInputFiles({ name: `${tag}.pdf`, mimeType: "application/pdf", buffer: fictionalPdf(tag) });
      await expect(ownerPage!.getByRole("dialog").filter({ hasText: /Import .* from PDF/ })).toBeVisible();
      await expect(ownerPage!.getByRole("textbox", { name: /^Name \*$/ }).first()).toHaveValue(`${tag} ${kind === "items" ? "Lantern" : "Watcher"}`);
    };
    await select(a);
    await ownerPage.getByRole("link", { name: "Loot", exact: true }).click();
    await upload("items");
    await ownerPage.getByRole("textbox", { name: /^Name \*$/ }).fill(`${tag} Reviewed Lantern`);
    await ownerPage.getByRole("textbox", { name: /^Description \*$/ }).fill("Reviewed fictional light.");
    await ownerPage.getByRole("button", { name: "Save 1 item", exact: true }).click();
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    const savedItems = await api(ownerPage, `/api/campaigns/${a}/items`);
    assert.equal(savedItems.status, 200);
    assert.ok(savedItems.data.some((i: any) => i.name === `${tag} Baseline Item`));
    const item = savedItems.data.find((i: any) => i.name === `${tag} Reviewed Lantern`);
    assert.equal(item.description, "Reviewed fictional light."); assert.equal(item.source, `${tag}.pdf · p. 2`);
    await upload("items");
    await ownerPage.getByRole("textbox", { name: /^Name \*$/ }).fill(`${tag} Reviewed Lantern`);
    await expect(ownerPage.getByText(/Existing campaign entry:/)).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: "Save 1 item", exact: true })).toBeDisabled();
    await ownerPage.getByLabel("Acknowledge importing duplicate names").check();
    await expect(ownerPage.getByRole("button", { name: "Save 1 item", exact: true })).toBeEnabled();
    // Do not actually save a redundant duplicate; acknowledgement behavior is the requirement.
    await ownerPage.getByRole("dialog").press("Escape");
    await ownerPage.getByRole("link", { name: "Initiative", exact: true }).click();
    // Select the ruleset through the same setup dialog a DM uses.
    await ownerPage.getByRole("dialog", { name: "Select D&D Version" }).getByRole("checkbox", { name: "D&D 5e (2014)", exact: true }).check();
    await ownerPage.getByRole("button", { name: "Start Combat Setup", exact: true }).click();
    const homebrewToggle = ownerPage.getByRole("button", { name: /Homebrew Bestiary/i });
    await expect(homebrewToggle).toBeVisible();
    if (!await ownerPage.getByLabel("Choose a PDF for creatures import").count()) await homebrewToggle.click();
    await upload("creatures");
    await ownerPage.getByRole("textbox", { name: /^Name \*$/ }).fill(`${tag} Reviewed Watcher`);
    await ownerPage.getByRole("spinbutton", { name: /^Hit points \(HP\) \*$/ }).fill("31");
    await ownerPage.getByRole("button", { name: "Save 1 creature", exact: true }).click();
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
    await ownerPage.reload({ waitUntil: "domcontentloaded" });
    const savedNPCs = await api(ownerPage, `/api/campaigns/${a}/homebrew-bestiary`);
    assert.equal(savedNPCs.status, 200);
    assert.ok(savedNPCs.data.some((n: any) => n.name === `${tag} Baseline NPC`));
    const npc = savedNPCs.data.find((n: any) => n.name === `${tag} Reviewed Watcher`);
    assert.equal(npc.profileData.hp, 31); assert.equal(npc.profileData.sourcePage, 1);
    assert.equal(npc.profileData.source, `${tag}.pdf`);
    // Actual database verification is restricted to this run's campaign IDs.
    const dbItems = await pool.query("SELECT name, description, source FROM campaign_items WHERE campaign_id=$1", [a]);
    assert.equal(dbItems.rows.length, 2); assert.ok(dbItems.rows.some(i => i.name === item.name && i.source === item.source));
    const dbNPCs = await pool.query("SELECT name, profile_data FROM campaign_homebrew_monsters WHERE campaign_id=$1", [a]);
    assert.equal(dbNPCs.rows.length, 2);
    assert.ok(dbNPCs.rows.some(n => n.name === npc.name && n.profile_data.hp === 31 && n.profile_data.sourcePage === 1));
    for (const path of ["items", "homebrew-bestiary"]) assert.equal((await api(otherPage, `/api/campaigns/${a}/${path}`)).status, 404);
    assert.equal((await api(otherPage, `/api/campaigns/${a}/pdf-import/commit`, "POST", { kind: "items",
      entries: [{ name: "Forbidden fixture", category: "Wondrous Items", rarity: "Common", description: "" }] })).status, 404);
    assert.equal((await api(otherPage, `/api/campaigns/${a}/pdf-import/preview?kind=items&filename=qa.pdf`, "POST")).status, 404);
    // Hold a genuine server response, never replace its payload or authentication.
    // This deterministically exercises slow preview responses across navigation/account changes.
    const holdPreview = async () => {
      let start!: () => void, rejectStart!: (error: Error) => void, release!: () => void, finish!: () => void;
      const started = new Promise<void>((resolve, reject) => { start = resolve; rejectStart = reject; });
      const gate = new Promise<void>(resolve => { release = resolve; });
      releasePreviews.push(release);
      const finished = new Promise<void>(resolve => { finish = resolve; });
      await ownerPage!.route("**/api/campaigns/*/pdf-import/preview?**", async (route: Route) => {
        try {
          // APIRequestContext does not perform Clerk's browser handshake. Supply a genuine
          // provider-issued bearer token from the already authenticated test session.
          const token = await ownerPage!.evaluate(async () => (window as any).Clerk.session.getToken());
          const actual = await route.fetch({ headers: { ...await route.request().allHeaders(), Authorization: `Bearer ${token}` } });
          assert.equal(actual.status(), 200);
          start();
          await gate;
          // The browser may cancel an old request during navigation/sign-out.
          await route.fulfill({ response: actual }).catch(() => {});
        } catch (error) {
          rejectStart(error instanceof Error ? error : new Error("Could not hold authenticated preview."));
          await route.abort().catch(() => {});
        } finally { finish(); }
      }, { times: 1 });
      return { started, release: async () => { release(); await finished; } };
    };
    await select(a);
    await ownerPage.getByRole("link", { name: "Loot", exact: true }).click();
    const campaignRace = await holdPreview();
    await ownerPage.getByLabel("Choose a PDF for items import").setInputFiles({ name: `${tag}.pdf`, mimeType: "application/pdf", buffer: fictionalPdf(tag) });
    await campaignRace.started;
    // Navigate normally while extraction is pending, then select the other campaign.
    await select(b);
    await ownerPage.getByRole("link", { name: "Loot", exact: true }).click();
    await campaignRace.release();
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
    assert.equal((await api(ownerPage, `/api/campaigns/${b}/items`)).data.length, 0);
    const accountRace = await holdPreview();
    await ownerPage.getByLabel("Choose a PDF for items import").setInputFiles({ name: `${tag}.pdf`, mimeType: "application/pdf", buffer: fictionalPdf(tag) });
    await accountRace.started;
    const signOutPage = await ownerPage.context().newPage();
    await signOutPage.goto(origin + "/campaigns", { waitUntil: "domcontentloaded" });
    await signOutPage.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(signOutPage.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
    await accountRace.release();
    const denied = await ownerPage.context().request.post(`${origin}/api/campaigns/${b}/pdf-import/commit`, {
      headers: { Origin: origin }, data: { kind: "items",
        entries: [{ name: "Must not save", category: "Wondrous Items", rarity: "Common", description: "" }] },
    });
    assert.equal(denied.status(), 401);
    // Change to the second real account in the very same browser context.
    await ownerPage.goto(origin + "/sign-in", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForFunction(() => (window as any).Clerk?.loaded === true);
    const switchTicket = await clerkClient.signInTokens.createSignInToken({ userId: users[1], expiresInSeconds: 60 });
    const switched = await ownerPage.evaluate(async token => {
      const clerk = (window as any).Clerk;
      const result = await clerk.client.signIn.create({ strategy: "ticket", ticket: token });
      if (result.status === "complete") await clerk.setActive({ session: result.createdSessionId });
      return result.status;
    }, switchTicket.token);
    assert.equal(switched, "complete");
    await expect(ownerPage.getByTestId("button-toggle-campaigns")).toBeVisible();
    await expect(ownerPage.getByRole("dialog")).not.toBeVisible();
    assert.equal((await api(ownerPage, `/api/campaigns/${a}/items`)).status, 404);
    assert.equal((await api(ownerPage, `/api/campaigns/${b}/items`)).status, 404);
    const bRows = await pool.query("SELECT count(*)::int AS count FROM campaign_items WHERE campaign_id=$1", [b]);
    assert.equal(bRows.rows[0].count, 0);
    console.log("Verified real Clerk sessions, database reload persistence, source/page fidelity, append-only baselines, duplicate acknowledgement, owner isolation and signed-out write denial.");
  } finally {
    for (const release of releasePreviews) release();
    // Cleanup ONLY fixtures tracked by this test; never enumerate or delete real campaign/account data.
    for (const id of campaigns) {
      await pool.query("DELETE FROM campaign_homebrew_actions WHERE monster_ref_id IN (SELECT id FROM campaign_homebrew_monsters WHERE campaign_id=$1)", [id]);
      await pool.query("DELETE FROM campaign_homebrew_monsters WHERE campaign_id=$1", [id]);
      await pool.query("DELETE FROM campaign_items WHERE campaign_id=$1", [id]);
      await pool.query("DELETE FROM campaign_saved_encounters WHERE campaign_id=$1", [id]);
      await pool.query("DELETE FROM campaigns WHERE id=$1 AND owner_user_id = ANY($2::text[])", [id, users]);
    }
    for (const context of contexts) await context.close();
    await browser?.close();
    for (const id of users) {
      const user = await clerkClient.users.getUser(id);
      if (user.privateMetadata.pdfQaRun === tag) await clerkClient.users.deleteUser(id);
      await pool.query("DELETE FROM app_accounts WHERE user_id=$1 AND is_admin=false", [id]);
    }
    await pool.end();
  }
});
