// Captures genuine application screens with synthetic, in-memory API data.
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import express from "express";
import { once } from "node:events";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { STOCK_ROLL_TABLES } from "../../shared/rollTables";

const output = "generated-artifacts/demo-reel";
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const campaign = { id: 71001, name: "The Lantern Coast", edition: "5e", description: "A fictional adventure for this product tour." };
const session = {
  id: "demo-session", campaignId: campaign.id, title: "The Lighthouse Signal", date: "2026-10-28",
  notes: "The party reached the old lighthouse at dusk.\n\nA coded signal appeared offshore. The keeper knows more than she admits.",
  revision: 0, updatedAt: "2026-10-28T18:00:00Z",
};
const fixture = await build({
  entryPoints: ["scripts/demo-reel/fixture.tsx"], bundle: true, write: false,
  format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  tsconfig: "tsconfig.json",
});
const assets = (await readdir("dist/public/assets")).filter(file => file.endsWith(".css"));
if (!assets.length) throw new Error("Run npm run build before recording");
const css = (await Promise.all(assets.map(file => readFile(path.join("dist/public/assets", file), "utf8")))).join("\n")
  + await readFile("scripts/demo-reel/shell.css", "utf8");
const app = express();
app.get("/", (_req, res) => res.type("html").send('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'));
app.get("/fixture.js", (_req, res) => res.type("js").send(fixture.outputFiles[0].text));
app.get("/style.css", (_req, res) => res.type("css").send(css));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
  recordVideo: { dir: output, size: { width: 1600, height: 900 } },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("requestfailed", request => { if (request.url().startsWith(origin)) errors.push(request.url() + " " + request.failure()?.errorText); });

const respond = async (route: import("@playwright/test").Route) => {
  const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
  const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  if (pathname === "/api/account/appearance") {
    return json(request.method() === "GET" ? { skin: "classic", mode: "dark" } : request.postDataJSON());
  }
  if (pathname === "/api/account") return json({ environment: "demo", legacyOwnershipStatus: "not_applicable" });
  if (pathname === "/api/campaigns" && request.method() === "GET") return json([campaign]);
  if (pathname === "/api/items/draw" && request.method() === "POST") return json([
    { id: 701, name: "Compass of the Long Road", category: "Wondrous Items", itemType: "Wondrous Item", rarity: "Rare", description: "A traveler’s compass whose needle points toward the next important choice.", edition: "5e", source: "Demo" },
    { id: 702, name: "Potion of Starlight", category: "Potions", itemType: "Potion", rarity: "Uncommon", description: "A faint glow swirls inside this bottle of midnight-blue glass.", edition: "5e", source: "Demo" },
    { id: 703, name: "Lantern of Lost Tides", category: "Wondrous Items", itemType: "Wondrous Item", rarity: "Legendary", description: "Its light reveals hidden paths above the waves.", edition: "5e", source: "Demo" },
  ]);
  if (pathname === "/api/roll-tables") return json(STOCK_ROLL_TABLES);
  if (pathname === "/api/items/5e/sources") return json([]);
  if (pathname === `/api/campaigns/${campaign.id}/encounter`) return json(null);
  if (pathname === `/api/campaigns/${campaign.id}/prepared-encounters`) return json([]);
  if (pathname === `/api/campaigns/${campaign.id}/characters`) return json([]);
  if (pathname === `/api/campaigns/${campaign.id}/homebrew-bestiary`) return json([]);
  if (pathname === "/api/bestiary/types" || pathname === "/api/bestiary/cr-values" || pathname === "/api/bestiary/sources") return json([]);
  if (pathname === "/api/bestiary/monsters") return json([]);
  const journal = `/api/campaigns/${campaign.id}/journal`;
  if (pathname === journal + "/capabilities") return json({ available: true, reason: "", audio: true });
  if (pathname === journal + "/sessions") return json([session]);
  if (pathname === journal + "/references" || pathname === journal + "/aliases") return json([]);
  if (pathname === journal + "/sessions/" + session.id) return json({ session, imports: [], recordings: [] });
  if (pathname === journal + "/sessions/" + session.id + "/notes" && request.method() === "PUT") {
    const next = request.postDataJSON();
    session.notes = next.notes;
    session.revision++;
    return json(session);
  }
  errors.push(`Unexpected demo request: ${request.method()} ${pathname}`);
  return json({ message: "Unsupported demo request" }, 404);
};
await page.route("**/api/**", respond);
const video = page.video();
if (!video) throw new Error("Recording did not start");
const tab = async (name: string) => {
  await page.locator(`[data-tab="${name}"]`).click();
  await pause(650);
};
const caption = async (number: string, title: string, detail: string) =>
  page.evaluate(next => (window as any).reelCaption(next), { number, title, detail });
const showCursor = async (locator: import("@playwright/test").Locator) => {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ x, y }) => {
    let cursor = document.getElementById("reel-cursor");
    if (!cursor) { cursor = document.createElement("div"); cursor.id = "reel-cursor"; document.body.append(cursor); }
    cursor.style.left = x + "px"; cursor.style.top = y + "px"; cursor.style.opacity = "1";
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await pause(360);
};
const click = async (locator: import("@playwright/test").Locator) => {
  await locator.scrollIntoViewIfNeeded();
  await showCursor(locator);
  await locator.click();
};
const still = async (name: string) => page.screenshot({ path: `${output}/${name}.jpg`, type: "jpeg", quality: 85 });
try {
  await page.goto(origin);
  await page.getByRole("status").first().waitFor({ state: "visible", timeout: 6000 }).catch(() => {});
  await pause(2500);
  await page.evaluate(() => (window as any).reelCard(null));
  await caption("01 / 06", "Give every story its own space.", "Choose a campaign, then keep your DM tools close at hand.");
  await click(page.getByRole("button", { name: /Campaigns— optional, for persistent play/i }));
  await expect(page.getByTestId("card-campaign-71001")).toBeVisible();
  await still("01-campaigns");
  await pause(1200);
  await click(page.getByTestId("button-select-campaign-71001"));
  await pause(2300);

  await tab("Initiative");
  await caption("02 / 06", "Keep the battle moving.", "Build encounters, track turns, HP, and conditions.");
  await page.getByText("D&D 5e (2014)", { exact: true }).click();
  await click(page.getByRole("button", { name: "Start Combat Setup" }));
  await page.getByTestId("input-pc-name").fill("Arden");
  await page.getByTestId("input-pc-initiative").fill("14");
  await page.getByTestId("input-pc-hp").fill("34");
  await page.getByTestId("input-pc-ac").fill("16");
  await click(page.getByTestId("button-add-pc"));
  await page.getByTestId("input-npc-name").fill("Lantern Warden");
  await page.getByTestId("input-npc-hp").fill("24");
  await page.getByTestId("input-npc-ac").fill("13");
  await click(page.getByTestId("button-add-npc"));
  await click(page.getByTestId("button-roll-monster-initiative"));
  await click(page.getByTestId("button-start-combat"));
  await pause(1200);
  await still("02-initiative");
  await click(page.getByTestId("button-next-turn"));
  await pause(2900);

  await tab("Loot");
  await caption("03 / 06", "Reveal the unexpected.", "Draw loot and keep your rewards ready.");
  await page.getByTestId("button-draw-cards").scrollIntoViewIfNeeded();
  await click(page.getByTestId("button-draw-cards"));
  await expect(page.getByTestId("card-item-701")).toBeVisible();
  await still("03-loot");
  await pause(4200);

  await tab("Roll Tables");
  await caption("04 / 06", "Find a spark for the next scene.", "Roll on ready-made tables or build your own.");
  await click(page.locator('[data-testid^="button-select-roll-table-"]').first());
  await pause(1000);
  await click(page.getByTestId("button-draw-roll-table"));
  await expect(page.getByTestId("card-roll-result-0")).toBeVisible();
  await still("04-tables");
  await pause(4000);

  await tab("Sessions");
  await caption("05 / 06", "Remember every session.", "Keep notes beside the action and import source documents.");
  await page.getByRole("button", { name: /^The Lighthouse Signal/ }).click();
  await expect(page.getByLabel("Session notes", { exact: true })).toBeVisible();
  await still("05-sessions");
  await pause(4500);

  await tab("Appearance");
  await caption("06 / 06", "Make the workspace yours.", "Choose light or dark and explore class and setting skins.");
  await still("06-appearance");
  await pause(1000);
  await click(page.getByRole("button", { name: "Light", exact: true }));
  await pause(2000);
  await page.getByLabel("Find a skin").fill("illuskian");
  await click(page.getByRole("button", { name: "Illuskian, Settings" }));
  await still("07-illuskian");
  await pause(2600);
  await page.evaluate(() => (window as any).reelCard("outro"));
  await pause(3800);
  if (errors.length) throw new Error("Demo browser errors:\n" + errors.join("\n"));
} finally {
  await page.close();
  await video.saveAs(`${output}/capture.webm`);
  await context.close();
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y", "-i", `${output}/capture.webm`,
  "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
  "-c:v", "libx264", "-preset", "fast", "-crf", "22",
  "-an", "-movflags", "+faststart", `${output}/fatebound-feature-reel-silent.mp4`,
], { stdio: "inherit", timeout: 300000 });
console.log(`Silent reel: ${output}/fatebound-feature-reel-silent.mp4`);
