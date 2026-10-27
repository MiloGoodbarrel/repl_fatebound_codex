import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

test("public landing, private-route gates and embedded Google sign-in work on desktop and mobile", {
  skip: process.env.ACCOUNT_BROWSER_TEST !== "1",
}, async () => {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      await page.goto(base + "/");
      await page.getByRole("link", { name: "Sign in", exact: true }).click();
      await page.getByRole("button", { name: /Continue with Google/i }).waitFor();
      assert.ok(await page.getByRole("textbox", { name: /Email address/i }).isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.getByRole("link", { name: "Privacy & data", exact: true }).click();
      await page.getByRole("heading", { name: /Privacy/i }).first().waitFor();
      for (const path of ["/campaigns", "/sessions", "/initiative"]) {
        await page.goto(base + path);
        await page.getByRole("heading", { name: /Every world deserves/i }).waitFor();
        assert.equal(await page.getByRole("navigation", { name: "Campaign tools" }).count(), 0);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});
