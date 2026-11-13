import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Page } from "@playwright/test";
import { clerkClient } from "@clerk/express";
import { pdf } from "./document-fixtures";

// Opt-in real development accounts, database and private App Storage. Never
// inject authentication or replace APIs/storage in this test.
test("authenticated module library and private reader", {
  skip: process.env.MODULE_AUTH_BROWSER_TEST !== "1", timeout: 360_000,
}, async t => {
  assert.ok(process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev"));
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const accounts: { id: string; email: string; password: string }[] = [];
  const campaignIds: number[] = [], uploadedIds: string[] = [];
  const { pool } = await import("../server/db");
  const { ModuleRepository } = await import("../server/modules/repository");
  const { PrivateModuleObjects } = await import("../server/modules/storage");
  const repo = new ModuleRepository(pool), objects = new PrivateModuleObjects();
  const errors: string[] = [];
  pages.forEach(page => page.on("pageerror", error => errors.push(error.message)));
  const call = (page: Page, path: string, method = "GET", body?: unknown) => page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }) });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }, { path, method, body });
  const ok = async (page: Page, path: string, method = "GET", body?: unknown) => {
    const response = await call(page, path, method, body);
    assert.ok([200, 201, 204].includes(response.status), `${method} ${path}: ${response.status}`);
    return response.data;
  };
  const upload = (page: Page, campaign: number, bytes: Buffer) => page.evaluate(async ({ campaign, encoded }) => {
    const response = await fetch(`/api/campaigns/${campaign}/modules?filename=synthetic.pdf`, {
      method: "POST", headers: { "Content-Type": "application/pdf" },
      body: Uint8Array.from(atob(encoded), c => c.charCodeAt(0)),
    });
    return { status: response.status, data: await response.json() };
  }, { campaign, encoded: bytes.toString("base64") });
  const signIn = async (page: Page, account: typeof accounts[number]) => {
    await page.goto(`${origin}/sign-in`);
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    const codeSent = page.waitForResponse(response => /\/prepare_/.test(new URL(response.url()).pathname) && response.ok(), { timeout: 15_000 });
    void codeSent.catch(() => {});
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const otp = page.locator('input[autocomplete="one-time-code"]');
    await Promise.race([otp.waitFor({ state: "visible" }), page.waitForURL("**/campaigns")]);
    if (await otp.isVisible()) { await codeSent; await otp.fill("424242"); }
    await page.waitForURL("**/campaigns");
    await expect(page.getByTestId("button-toggle-campaigns")).toBeVisible();
  };
  const select = async (page: Page, id: number) => {
    await page.goto(`${origin}/campaigns`);
    const button = page.getByTestId(`button-select-campaign-${id}`);
    if (!await button.isVisible()) await page.getByTestId("button-toggle-campaigns").click();
    if ((await button.innerText()).includes("Select")) await button.click();
  };
  const open = async (page: Page) => {
    if (!await page.getByRole("heading", { name: "Adventure folio" }).isVisible())
      await page.getByRole("button", { name: "Toggle adventure module reference" }).click();
    await expect(page.getByRole("heading", { name: "Adventure folio" })).toBeVisible();
  };
  try {
    await pages[0].goto(`${origin}/sign-in`);
    await pages[0].waitForFunction(() => (window as any).Clerk?.loaded);
    assert.equal(await pages[0].evaluate(() => (window as any).Clerk.publishableKey.startsWith("pk_test_")), true);
    const run = randomUUID();
    for (const suffix of ["owner", "other"]) {
      const email = `module-qa-${run}-${suffix}+clerk_test@example.com`;
      const password = `${randomBytes(32).toString("base64url")}!aA9`;
      const user = await clerkClient.users.createUser({ emailAddress: [email], password });
      accounts.push({ id: user.id, email, password });
    }
    await signIn(pages[0], accounts[0]); await signIn(pages[1], accounts[1]);
    const [page, other] = pages;
    for (const [client, name] of [[page, "A"], [page, "B"], [other, "Other"]] as const) {
      const campaign = await ok(client, "/api/campaigns", "POST", {
        name: `Module QA ${run} ${name}`, edition: "5e", description: "Synthetic private module regression",
      });
      campaignIds.push(campaign.id);
    }
    const [a, b, c] = campaignIds, base = `/api/campaigns/${a}/modules`;
    await ok(page, `/api/campaigns/${a}/characters`, "POST", { name: "Synthetic party member", maxHp: 20, ac: 14 });
    await ok(page, `/api/campaigns/${a}/pdf-import/commit`, "POST", {
      idempotencyKey: randomUUID(), kind: "items", entries: [{ name: "Synthetic compass", category: "Wondrous Items", rarity: "Common", description: "Keep unchanged." }],
    });
    const baseline = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ["campaign_characters", "campaign_items", "campaign_homebrew_monsters", "campaign_saved_encounters", "campaign_prepared_encounters", "journal_sessions"]) {
        result[table] = (await pool.query(`SELECT * FROM ${table} WHERE campaign_id=$1 ORDER BY id`, [a])).rows;
      }
      return result;
    };
    const before = await baseline();
    await t.test("real owners, same-origin checks, rejected PDFs and empty reader", async () => {
      assert.equal((await call(other, base)).status, 404);
      for (const bytes of [Buffer.from("not PDF"), Buffer.from("%PDF-1.4\nbroken")]) {
        assert.equal((await upload(page, a, bytes)).status, 400);
        assert.equal((await pool.query("SELECT count(*)::int n FROM campaign_modules WHERE campaign_id=$1", [a])).rows[0].n, 0);
      }
      const csrf = await contexts[0].request.post(`${origin}${base}?filename=synthetic.pdf`, {
        headers: { Origin: "https://other.example", "Content-Type": "application/pdf" }, data: pdf("Synthetic"),
      });
      assert.equal(csrf.status(), 403);
      await select(page, a); await open(page);
      await expect(page.getByText("No adventures in this campaign yet.")).toBeVisible();
      await page.locator('input[aria-label="Choose PDF to add"]').setInputFiles({
        name: "invalid.pdf", mimeType: "application/pdf", buffer: Buffer.from("not pdf"),
      });
      await expect(page.getByRole("alert")).toContainText(/Could not read this PDF/);
      await page.getByRole("button", { name: "Close adventure reference" }).click();
      await expect(page.getByRole("heading", { name: "Adventure folio" })).not.toBeVisible();
      assert.deepEqual(await baseline(), before);
    });

    // Storage is a separate infrastructure prerequisite, not a mock fallback.
    const bucket = await fetch("http://127.0.0.1:1106/object-storage/default-bucket").then(r => r.json()).catch(() => ({})) as { bucketId?: string };
    if (!bucket.bucketId) {
      await t.test("valid upload reports missing App Storage and rolls back its reservation", async () => {
        const result = await upload(page, a, pdf("Synthetic valid module"));
        assert.equal(result.status, 503);
        assert.match(result.data.message, /storage/i);
        assert.equal((await pool.query("SELECT count(*)::int n FROM campaign_modules WHERE campaign_id=$1", [a])).rows[0].n, 0);
        assert.deepEqual(await baseline(), before);
      });
    }
    await t.test("real App Storage reload, ranges, reader, mobile and scope transitions", {
      skip: !bucket.bucketId && "BLOCKED: create a default private App Storage bucket, then rerun this regression.",
    }, async () => {
      await select(page, a); await open(page);
      const file = pdf("Synthetic gate scene\nA secret door opens.", { pages: 3 });
      await page.locator('input[aria-label="Choose PDF to add"]').setInputFiles({ name: "synthetic.pdf", mimeType: "application/pdf", buffer: file });
      await expect(page.locator("canvas[aria-label='PDF page 1']")).toBeVisible({ timeout: 40_000 });
      const list = await ok(page, base);
      assert.equal(list.modules.length, 1);
      const id = list.modules[0].id; uploadedIds.push(id);
      assert.equal(list.selectedId, id);
      await page.getByLabel("Page number", { exact: true }).fill("2");
      await page.getByLabel("Page number", { exact: true }).press("Enter");
      await expect(page.locator("canvas[aria-label='PDF page 2']")).toBeVisible();
      await page.getByLabel("Bookmark name").fill("Gate scene");
      await page.getByRole("button", { name: /Bookmark page|Add bookmark/ }).click();
      await expect(page.getByText("Gate scene", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Rename synthetic", exact: true }).click();
      await page.getByLabel("Module name", { exact: true }).fill("Reviewed synthetic module");
      await page.getByRole("button", { name: "Save module name" }).click();
      await page.reload(); await open(page);
      await expect(page.locator("canvas[aria-label='PDF page 2']")).toBeVisible();
      const stored = (await pool.query("SELECT * FROM campaign_modules WHERE id=$1", [id])).rows[0];
      assert.equal(stored.page, 2);
      assert.equal(stored.name, "Reviewed synthetic module");
      assert.equal(stored.bookmarks[0].name, "Gate scene");
      const range = await page.evaluate(async path => {
        const r = await fetch(path, { headers: { Range: "bytes=10-29" } });
        return { status: r.status, bytes: Array.from(new Uint8Array(await r.arrayBuffer())), range: r.headers.get("content-range") };
      }, `${base}/${id}/content`);
      assert.equal(range.status, 206); assert.deepEqual(range.bytes, [...file.subarray(10, 30)]);
      assert.equal(range.range, `bytes 10-29/${file.length}`);
      for (const path of [base, `${base}/${id}/content`]) assert.equal((await call(other, path)).status, 404);
      assert.equal((await call(other, `${base}/${id}`, "PATCH", { page: 3 })).status, 404);
      assert.equal((await call(other, `${base}/${id}`, "DELETE")).status, 404);
      assert.equal((await call(page, `/api/campaigns/${b}/modules/selection`, "PATCH", { selectedId: id })).status, 404);
      // Opening/closing reference never remounts the active tool.
      await page.getByRole("link", { name: "Loot", exact: true }).click();
      await expect(page.locator("canvas[aria-label='PDF page 2']")).toBeVisible();
      await page.screenshot({ path: "generated-artifacts/modules/desktop.png" });
      await page.getByRole("button", { name: "Close adventure reference" }).click();
      await page.setViewportSize({ width: 390, height: 844 }); await open(page);
      await expect(page.getByRole("dialog", { name: "Adventure reference" })).toBeVisible();
      await expect(page.locator("canvas[aria-label='PDF page 2']")).toBeVisible();
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), true);
      await page.screenshot({ path: "generated-artifacts/modules/mobile.png" });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Adventure reference" })).not.toBeVisible();
      await page.setViewportSize({ width: 1400, height: 900 });

      const scan = await upload(page, a, pdf(undefined, { imageOnly: true }));
      assert.equal(scan.status, 201); uploadedIds.push(scan.data.id);
      await ok(page, base + "/selection", "PATCH", { selectedId: scan.data.id });
      await page.reload(); await open(page);
      await expect(page.locator("canvas[aria-label='PDF page 1']")).toBeVisible();
      await expect(page.getByText(/No selectable text detected/)).toBeVisible();
      // Large viewer file does not change the importer limit.
      const large = pdf("Large synthetic module", { paddingBytes: 46 * 1024 * 1024 });
      const big = await upload(page, a, large);
      assert.equal(big.status, 201); uploadedIds.push(big.data.id);
      assert.equal(big.data.size, large.length);
      assert.deepEqual(await baseline(), before);

      // Pause (do not mock) an upload, then leave its campaign.
      let release!: () => void, reached!: () => void;
      const hold = new Promise<void>(r => { release = r; }), observed = new Promise<void>(r => { reached = r; });
      await page.route(`**/api/campaigns/${a}/modules?**`, async route => {
        reached(); await hold; await route.continue().catch(() => {});
      }, { times: 1 });
      await page.locator('input[aria-label="Choose PDF to add"]').setInputFiles({
        name: "pending.pdf", mimeType: "application/pdf", buffer: pdf("Never cross a campaign boundary"),
      });
      await observed; await select(page, b); release(); await page.unrouteAll({ behavior: "wait" }); await open(page);
      assert.deepEqual(await ok(page, `/api/campaigns/${b}/modules`), { modules: [], selectedId: null });
      await expect(page.locator("canvas")).not.toBeVisible();

      // A second real owner can import independently after the first owner's work.
      const otherUpload = await upload(other, c, pdf("Other owner's synthetic notes"));
      assert.equal(otherUpload.status, 201); uploadedIds.push(otherUpload.data.id);
      await select(page, a); await open(page);
      const sibling = await contexts[0].newPage(); await sibling.goto(`${origin}/campaigns`);
      await sibling.getByRole("button", { name: "Sign out", exact: true }).click(); await sibling.waitForURL(origin + "/");
      await page.bringToFront(); await page.waitForURL(origin + "/");
      await expect(page.locator("canvas")).not.toBeVisible();
      await signIn(page, accounts[1]); await select(page, c); await open(page);
      assert.equal((await call(page, base)).status, 404);
      await expect(page.getByText("Reviewed synthetic module", { exact: true })).not.toBeVisible();
      assert.deepEqual(await baseline(), before);
    });
    assert.deepEqual(errors, [], "No unhandled browser errors");
  } finally {
    // Cleanup only this invocation's synthetic resources. Also catches an upload
    // whose successful response was lost before the test learned its id.
    try {
      for (const id of campaignIds) {
        const owned = await pool.query("SELECT id FROM campaigns WHERE id=$1 AND owner_user_id=ANY($2::text[])", [id, accounts.map(a => a.id)]);
        if (!owned.rowCount) continue;
        const modules = await pool.query("SELECT * FROM campaign_modules WHERE campaign_id=$1", [id]);
        for (const row of modules.rows) {
          await repo.tombstone(row.id);
          try {
            await objects.delete(row.object_key);
            await repo.remove(row.id);
          } catch {
            t.diagnostic("Storage cleanup unavailable; retained a private deletion tombstone for automatic retry.");
          }
        }
        await pool.query("DELETE FROM campaign_items WHERE campaign_id=$1", [id]);
        await pool.query("DELETE FROM campaign_characters WHERE campaign_id=$1", [id]);
        await pool.query("DELETE FROM campaigns WHERE id=$1", [id]);
      }
      for (const account of accounts) {
        await pool.query("DELETE FROM app_accounts WHERE user_id=$1", [account.id]);
        await clerkClient.users.deleteUser(account.id);
      }
      t.diagnostic("Removed disposable accounts and synthetic campaign records.");
    } finally { await browser.close(); await pool.end(); }
  }
});
