import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

test("PDF review supports corrections, duplicate acknowledgement, errors and mobile layout", {
  skip: process.env.PDF_BROWSER_TEST !== "1", timeout: 90000,
}, async () => {
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    const page = await context.newPage();
    page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
    page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
    // A browser-local component harness, not an app route or an authentication bypass.
    await page.route("**/__pdf-component-test", route => route.fulfill({
      contentType: "text/html", body: `<html><head><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
</script></head><body><div id="root"></div><script type="module">
import React from '/@fs/home/runner/workspace/node_modules/.vite/deps/react.js';
import ReactDOM from '/@fs/home/runner/workspace/node_modules/.vite/deps/react-dom_client.js';
import {PdfLibraryImport} from '/src/components/PdfLibraryImport.tsx';
import '/src/index.css';
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(PdfLibraryImport,{campaignId:1,kind:'items'}));
</script></body></html>`,
    }));
    let saves = 0, lastBody: any;
    await page.route("**/api/campaigns/1/pdf-import/**", async route => {
      if (route.request().url().includes("/preview?")) {
        await route.fulfill({ json: { text: "[[Page 4]]\nMoon Lantern\nWondrous item, common\nBlue light.",
          candidates: [{ name: "Moon Lantern", category: "Wondrous Items", rarity: "Common",
            description: "Blue light.", source: "module.pdf", sourcePage: 4 }],
          warnings: ["Review the detected entries."], existingNames: ["Existing Lantern"] } });
      } else {
        saves++; lastBody = route.request().postDataJSON();
        await route.fulfill(saves === 1 ? { status: 400, json: { message: "Review failed; keep your draft." } } :
          { json: { count: 1, message: "Added entry" } });
      }
    });
    await page.goto(`${origin}/__pdf-component-test`);
    await page.locator('input[type="file"]').setInputFiles({ name: "module.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture") });
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Review the detected entries.", { exact: true })).toBeVisible();
    // Edit the current entry via advanced JSON, then confirm duplicate detection sees the edited name.
    await page.getByText("Advanced JSON", { exact: false }).click();
    const editor = page.getByLabel(/JSON/i).first();
    await editor.fill(JSON.stringify({ name: "Existing Lantern", category: "Wondrous Items", rarity: "Rare",
      description: "Corrected light.", source: "module.pdf", sourcePage: 4 }));
    await expect(page.getByText(/Existing campaign entry: Existing Lantern/)).toBeVisible();
    assert.equal(saves, 0);
    await page.getByRole("checkbox").last().check();
    const save = page.getByRole("button", { name: "Save 1 item", exact: true });
    await save.click();
    await expect(page.getByText("Review failed; keep your draft.", { exact: true })).toBeVisible();
    assert.equal(lastBody.entries[0].description, "Corrected light.");
    assert.equal(lastBody.entries[0].sourcePage, 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await save.click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    assert.equal(saves, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
