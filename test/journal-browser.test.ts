import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { registerJournalRoutes } from "../server/journal/routes";
import { MemoryJournalRepository } from "./journal-fixtures";

// Browser-only transport interception uses a separate synthetic server. The real
// app remains fail-closed; no test principal, bypass or fixture route is installed there.
test("synthetic browser journey on desktop/mobile: notes, imports, corrections, aliases, audio and combat panel", {
  skip: process.env.JOURNAL_BROWSER_TEST !== "1", timeout: 120_000,
}, async () => {
  const repo = new MemoryJournalRepository();
  repo.refs = [{ key: "character:1", name: "Quill", source: "Synthetic party character", campaignId: 1 }];
  const app = express();
  registerJournalRoutes(app, repo, { authorizeCampaign: async (_r, id) => id === 1 });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const apiOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    await mkdir("generated-artifacts/journal", { recursive: true });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      repo.sessions.clear(); repo.imports.clear(); repo.aliases.clear(); repo.audio.clear();
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => localStorage.setItem("activeCampaign", JSON.stringify({ id: 1, name: "Synthetic journal campaign", edition: "5e" })));
      const page = await context.newPage();
      let failNotes = false;
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("dialog", d => d.accept());
      const origin = process.env.JOURNAL_BROWSER_ORIGIN ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
      await page.goto(`${origin}/sessions`);
      await expect(page.getByRole("heading", { name: "Private by design" })).toBeVisible();
      await expect(page.getByLabel("Session notes", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: `generated-artifacts/journal/privacy-lock-${viewport.width}.png` });
      await page.route("**/api/**", async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (path.includes("/journal")) {
          if (failNotes && path.endsWith("/notes") && req.method() === "PUT") {
            await route.fulfill({ status: 503, json: { message: "Synthetic failed save" } });
            return;
          }
          const body = req.postDataBuffer();
          const headers = req.headers();
          delete headers.host; delete headers["content-length"];
          const response = await fetch(apiOrigin + path, { method: req.method(), headers, ...(body ? { body } : {}) });
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
        } else if (path === "/api/campaigns") {
          await route.fulfill({ json: [{ id: 1, name: "Synthetic journal campaign", edition: "5e" }] });
        } else if (path.endsWith("/encounter")) await route.fulfill({ json: null });
        else await route.fulfill({ json: [] });
      });
      // Establish real same-document history so Back exercises popstate rather
      // than a cross-document unload/confirmation.
      await page.goto(`${origin}/`);
      await page.locator('a[href="/sessions"]').click();
      await page.getByLabel("Session name", { exact: true }).fill("Synthetic session");
      await page.getByRole("button", { name: "Create session", exact: true }).click();
      const notes = page.getByLabel("Session notes", { exact: true });
      await notes.fill("Live synthetic notes alongside combat.");
      await expect(page.getByText("All notes saved", { exact: true })).toBeVisible();
      assert.equal(Array.from(repo.sessions.values())[0].notes, "Live synthetic notes alongside combat.");
      failNotes = true;
      await notes.fill("Preserved draft after failed Back navigation.");
      await expect(page.getByText("Save failed", { exact: true })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/sessions$/);
      await expect(notes).toHaveValue("Preserved draft after failed Back navigation.");
      await expect(page.getByRole("button", { name: "Download my draft", exact: true })).toBeVisible();
      // Non-anchor route changes must be blocked too, retaining the same editor.
      await page.evaluate(() => window.history.pushState({}, "", "/loot"));
      await expect(page).toHaveURL(/\/sessions$/);
      await expect(notes).toHaveValue("Preserved draft after failed Back navigation.");
      failNotes = false;
      await page.getByRole("button", { name: "Retry save", exact: true }).click();
      await expect(page.getByText("All notes saved", { exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: /Synthetic session.*2026/ }).click();
      await expect(notes).toHaveValue("Preserved draft after failed Back navigation.");
      await page.getByLabel("Import title").fill("Echo synthetic transcript");
      await page.getByPlaceholder("Paste UTF-8 notes or an exported summary…").fill("Quil met Quil. Unknown Xyzzy stayed intact.");
      await page.getByRole("button", { name: "Add immutable source" }).click();
      await expect(page.getByRole("button", { name: "Accept occurrence", exact: true })).toHaveCount(2);
      await page.getByRole("button", { name: "Accept occurrence", exact: true }).first().click();
      await expect(page.getByRole("button", { name: "Accept occurrence", exact: true })).toHaveCount(1);
      await page.getByRole("button", { name: "Accept all matching", exact: true }).first().click();
      await expect(page.locator("pre").filter({ hasText: /^Quill met Quill\./ })).toHaveCount(1);
      await page.getByRole("button", { name: "Undo all matching", exact: true }).first().click();
      await expect(page.getByRole("button", { name: "Accept occurrence", exact: true })).toHaveCount(2);
      const manual = page.getByLabel("Manual reviewed edit for Echo synthetic transcript");
      await manual.fill("Manual reviewed draft");
      await page.getByRole("link", { name: "Toolkit", exact: true }).click();
      assert.match(page.url(), /\/sessions$/);
      await page.evaluate(() => window.history.replaceState({}, "", "/tables"));
      await expect(page).toHaveURL(/\/sessions$/);
      await expect(manual).toHaveValue("Manual reviewed draft");
      await page.getByRole("button", { name: "Discard unsaved draft", exact: true }).click();
      await page.getByLabel("Alias phrase", { exact: true }).fill("kwil");
      await page.getByLabel("Alias target", { exact: true }).selectOption("character:1");
      await page.getByRole("button", { name: "Approve alias", exact: true }).click();
      await expect(page.getByLabel("Alias kwil", { exact: true })).toHaveValue("kwil");
      await page.getByLabel("Alias kwil", { exact: true }).fill("kweel");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByLabel("Alias kweel", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Delete alias kweel", exact: true }).click();
      const wav = Buffer.alloc(44 + 8000);
      wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32);
      wav.writeUInt16LE(8, 34); wav.write("data", 36); wav.writeUInt32LE(8000, 40); wav.fill(128, 44);
      await page.locator('input[type="file"][accept="audio/*"]').setInputFiles({ name: "synthetic.wav", mimeType: "audio/wav", buffer: wav });
      await expect(page.getByRole("button", { name: "Delete synthetic.wav", exact: true })).toBeVisible();
      await page.locator("audio").evaluate(async (audio: HTMLAudioElement) => { await audio.play(); audio.pause(); });
      await page.getByRole("button", { name: "Delete synthetic.wav", exact: true }).click();
      assert.equal(repo.audio.size, 0);
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      assert.equal(horizontalOverflow, false, `No horizontal overflow at ${viewport.width}px`);
      await page.screenshot({ path: `generated-artifacts/journal/synthetic-${viewport.width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Delete Synthetic session", exact: true }).click();
      await expect(notes).toHaveCount(0);
      assert.equal(repo.sessions.size, 0); assert.equal(repo.imports.size, 0);
      await page.goto(`${origin}/initiative`);
      await page.getByLabel("D&D 5e (2014)", { exact: true }).check();
      await page.getByRole("button", { name: "Start Combat Setup" }).click();
      await page.getByTestId("input-pc-name").fill("Synthetic hero");
      const addPc = page.getByRole("button", { name: /^Add PC/ }).last();
      await addPc.click();
      await page.getByRole("button", { name: "Open campaign journal" }).click();
      await expect(page.getByRole("region", { name: "Campaign session journal" })).toBeVisible();
      if (viewport.width < 768) await page.getByRole("button", { name: /Combat Order/ }).click();
      await expect(page.getByText("Synthetic hero", { exact: true }).first()).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(page.getByText("Synthetic hero", { exact: true }).first()).toBeVisible();
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
