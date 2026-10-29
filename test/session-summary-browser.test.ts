import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { registerJournalRoutes } from "../server/journal/routes";
import { MemoryJournalRepository } from "./journal-fixtures";
import { MemorySummaryRepository } from "./summary-fixtures";

test("real summary component handles drafts, approvals, citations, conflicts and restoration at desktop and mobile sizes", {
  skip: process.env.SUMMARY_BROWSER_TEST !== "1", timeout: 150_000,
}, async () => {
  const bundle = await build({
    entryPoints: ["test/session-summary-browser-fixture.tsx"], bundle: true, write: false,
    format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    tsconfig: "tsconfig.json",
  });
  const css = (await Promise.all((await readdir("dist/public/assets")).filter(name => name.endsWith(".css"))
    .map(name => readFile(path.join("dist/public/assets", name), "utf8")))).join("\n");
  const repo = new MemoryJournalRepository(), summaries = new MemorySummaryRepository(repo);
  await repo.createSession({
    id: "demo-session", campaignId: 1, title: "The Lighthouse Signal", date: "2026-10-29",
    notes: "Arden promised the keeper to relight the beacon.", revision: 0, updatedAt: "",
  });
  const app = express();
  app.get("/", (_req, res) => res.type("html").send('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'));
  app.get("/style.css", (_req, res) => res.type("css").send(css));
  app.get("/fixture.js", (_req, res) => res.type("js").send(bundle.outputFiles[0].text));
  registerJournalRoutes(app, repo, { authorizeCampaign: async (_req, id) => id === 1 }, summaries);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const [index, viewport] of [{ width: 1280, height: 900 }, { width: 390, height: 844 }].entries()) {
      if (index) {
        await repo.deleteSession(1, "demo-session");
        summaries.versions.delete("demo-session");
        await repo.createSession({
          id: "demo-session", campaignId: 1, title: "The Lighthouse Signal", date: "2026-10-29",
          notes: "Arden promised the keeper to relight the beacon.", revision: 0, updatedAt: "",
        });
      }
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("dialog", dialog => dialog.accept());
      await page.goto(origin);
      await expect(page.getByText("Automatic summary generation is unavailable.")).toBeVisible();
      const editor = page.getByRole("textbox", { name: "Session Overview editable summary" });
      await expect(editor).toBeVisible();
      await editor.fill("Arden agreed to relight the beacon.");
      await page.getByRole("textbox", { name: "Session Overview annotation" }).fill("Keeper's secret remains GM-only.");
      await page.getByRole("checkbox", { name: "Lock Session Overview" }).check();
      await page.getByRole("checkbox", { name: "Cite Live notes for Session Overview" }).check();
      await expect(page.getByRole("status")).toHaveText("Unsaved summary draft");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft · rev 1")).toBeVisible();
      await page.reload();
      await expect(page.getByText("Arden agreed to relight the beacon.")).toBeVisible();
      await expect(page.getByText("Keeper's secret remains GM-only.")).toBeVisible();
      await page.getByRole("button", { name: "Approve version" }).click();
      await expect(page.getByText("Approved · rev 2")).toBeVisible();
      await page.getByRole("button", { name: "Edit summary" }).click();
      await editor.fill("Unsaved change that must survive conflict.");
      await repo.saveNotes(1, "demo-session", 0, "New saved notes from another tab.");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByRole("alert")).toContainText("sources changed");
      await expect(editor).toHaveValue("Unsaved change that must survive conflict.");
      await expect(page.getByRole("button", { name: "I reviewed the latest summary and sources" })).toBeEnabled();
      await page.getByRole("button", { name: "I reviewed the latest summary and sources" }).click();
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft · rev 3")).toBeVisible();
      await page.getByText("Sources & review").first().click();
      await page.getByRole("button", { name: "Restore as draft" }).first().click();
      await expect(page.getByText("Draft · rev 4")).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
