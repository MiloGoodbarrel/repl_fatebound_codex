import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import express from "express";
import { once } from "node:events";
import { build } from "esbuild";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { registerJournalRoutes } from "../server/journal/routes";
import { MemoryJournalRepository } from "./journal-fixtures";
import { MemorySummaryRepository } from "./summary-fixtures";

test("full journal keeps unsaved summary mounted during campaign switches and keeps notes and sources reachable", {
  skip: process.env.SUMMARY_JOURNAL_BROWSER_TEST !== "1", timeout: 120000,
}, async () => {
  const bundle = await build({ entryPoints: ["test/session-summary-journal-fixture.tsx"], bundle: true, write: false,
    format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, tsconfig: "tsconfig.json" });
  const css = (await Promise.all((await readdir("dist/public/assets")).filter(file => file.endsWith(".css"))
    .map(file => readFile(path.join("dist/public/assets", file), "utf8")))).join("\n");
  const repo = new MemoryJournalRepository(), summaries = new MemorySummaryRepository(repo);
  const app = express();
  app.get("/", (_req, res) => res.type("html").send('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'));
  app.get("/style.css", (_req, res) => res.type("css").send(css));
  app.get("/fixture.js", (_req, res) => res.type("js").send(bundle.outputFiles[0].text));
  registerJournalRoutes(app, repo, { authorizeCampaign: async (_req, id) => id === 1 || id === 2 }, summaries);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      repo.sessions.clear(); repo.imports.clear(); summaries.versions.clear();
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("dialog", dialog => dialog.accept());
      await page.goto(origin);
      await expect(page.getByRole("heading", { name: "New session" })).toBeVisible();
      await page.getByLabel("Session name", { exact: true }).fill("The Lighthouse Signal");
      await page.getByRole("button", { name: "Create session" }).click();
      await expect(page.getByRole("heading", { name: "Session summary" })).toBeVisible();
      const editor = page.getByRole("textbox", { name: "Session Overview editable summary" });
      await expect(editor).toBeVisible();
      await page.screenshot({ path: `generated-artifacts/journal/structured-summary-${viewport.width}.png` });
      await editor.fill("The party promised the lighthouse keeper to relight the beacon.");
      await page.getByRole("button", { name: "Select another campaign" }).click();
      await expect(page.getByText("Unsaved journal edits are holding this campaign switch")).toBeVisible();
      await expect(editor).toHaveValue("The party promised the lighthouse keeper to relight the beacon.");
      await expect(page.getByText("Finish the previous campaign’s summary below.")).toBeVisible();
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Selected: The Glass March")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Session summary" })).toHaveCount(0);
      const previous = Array.from(repo.sessions.values()).find(value => value.campaignId === 1)!;
      await expect.poll(async () => (await summaries.load(1, previous.id)).current?.revision).toBe(1);
      assert.equal((await summaries.load(1, previous.id)).current?.sections[0].text, "The party promised the lighthouse keeper to relight the beacon.");
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
