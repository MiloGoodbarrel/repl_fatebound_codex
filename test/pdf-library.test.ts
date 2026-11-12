import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { recognizePdfLibrary, pdfCommitSchema } from "../server/pdfLibraryParser";
import { registerPdfLibraryRoutes } from "../server/pdfLibraryRoutes";
import { extractJournalDocument } from "../server/journal/documents";
import { apiPolicy } from "../server/auth/policy";
import { pdf } from "./document-fixtures";
import { insertCampaignItemSchema } from "../shared/schema";

const block = `[[Page 3]]
Frost Watcher
Medium humanoid, neutral
Armor Class 14
Hit Points 22 (4d8 + 4)
STR DEX CON INT WIS CHA
12 (+1) 14 (+2) 12 (+1) 10 (+0) 13 (+1) 8 (-1)
Challenge 1/2 (100 XP)
Actions
Spear. Melee Weapon Attack: +4 to hit. Hit: 5 piercing damage.`;

test("PDF recognition retains page, source, raw rules and only observed stats", () => {
  const result = recognizePdfLibrary(block, "winter.pdf", "creatures");
  assert.equal(result.candidates.length, 1);
  const profile = result.candidates[0];
  assert.equal(profile.name, "Frost Watcher");
  assert.equal(profile.hp, 22); assert.equal(profile.ac, 14);
  assert.equal(profile.dex, 14); assert.equal(profile.sourcePage, 3);
  assert.equal(profile.source, "winter.pdf");
  assert.match(String(profile.description), /Spear/);
  assert.ok(pdfCommitSchema.safeParse({ kind: "creatures", entries: [profile] }).success);
  const incomplete = recognizePdfLibrary(block.replace("Hit Points 22 (4d8 + 4)", ""), "winter.pdf", "creatures");
  assert.equal(incomplete.candidates.length, 0);
  assert.ok(incomplete.warnings.some(w => /required combat/.test(w)));
});

test("PDF items keep text, rarity and source; invalid commits are rejected", () => {
  const result = recognizePdfLibrary("[[Page 7]]\nMoon Lantern\nWondrous item, uncommon\nIt shines with blue light.", "loot.pdf", "items");
  assert.equal(result.candidates[0].category, "Wondrous Items");
  assert.equal(result.candidates[0].rarity, "Uncommon");
  assert.equal(result.candidates[0].sourcePage, 7);
  assert.equal(insertCampaignItemSchema.parse({
    ...result.candidates[0], campaignId: 1, source: "loot.pdf · p. 7",
  }).source, "loot.pdf · p. 7", "Campaign storage must retain PDF provenance");
  assert.ok(pdfCommitSchema.safeParse({ kind: "items", entries: result.candidates }).success);
  assert.equal(pdfCommitSchema.safeParse({ kind: "items", entries: [{ name: "Bad" }] }).success, false);
  assert.equal(pdfCommitSchema.safeParse({ kind: "creatures", entries: [{ ...recognizePdfLibrary(block, "a.pdf", "creatures").candidates[0], hp: -1 }] }).success, false);
});

test("PDF extraction adds page markers only for library preview", async () => {
  const bytes = pdf("A fictional module");
  assert.match((await extractJournalDocument(bytes, "module.pdf", { pageMarkers: true })).text, /\[\[Page 1\]\]/);
  assert.doesNotMatch((await extractJournalDocument(bytes, "module.pdf")).text, /\[\[Page/);
});

test("PDF endpoints enforce ownership, preview without saving, and append only reviewed entries", async () => {
  const items: any[] = [{ name: "Existing Item" }];
  const monsters: any[] = [{ name: "Existing NPC" }];
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiPolicy(async req => req.get("x-test-user") ? { userId: req.get("x-test-user")!, admin: false } : null, {
    campaignOwner: async id => id === 1 ? "owner" : null,
    characterCampaign: async () => null, tableCampaign: async () => null,
  }));
  registerPdfLibraryRoutes(app, {
    getCampaignItems: async () => items,
    getCampaignHomebrew: async () => monsters,
    importCampaignItems: async (_id, entries) => { items.push(...entries); return entries as any; },
    importCampaignHomebrew: async (_id, entries) => { monsters.push(...entries); return entries.length; },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, body: any, user = "owner", type = "application/json", origin = base) =>
    fetch(`${base}/api/campaigns/1/pdf-import/${path}`, { method: "POST",
      headers: { "Content-Type": type, Origin: origin, ...(user ? { "x-test-user": user } : {}) },
      body: type === "application/json" ? JSON.stringify(body) : body });
  try {
    assert.equal((await call("commit", {}, "")).status, 401);
    assert.equal((await call("commit", {}, "other")).status, 404);
    assert.equal((await call("commit", {}, "owner", "application/json", "https://evil.example")).status, 403);
    const preview = await call("preview?kind=items&filename=module.pdf", pdf("Reference notes"), "owner", "application/pdf");
    assert.equal(preview.status, 200);
    const data = await preview.json();
    assert.deepEqual(data.existingNames, ["Existing Item"]);
    assert.equal(data.candidates.length, 0); assert.equal(items.length, 1);
    assert.equal((await call("preview?kind=items&filename=bad.pdf", Buffer.from("fake"), "owner", "application/pdf")).status, 400);
    assert.equal((await call("preview?kind=items&filename=scan.pdf", pdf(), "owner", "application/pdf")).status, 400);
    assert.equal((await call("commit", { kind: "items", entries: [] })).status, 400);
    const commit = await call("commit", { kind: "items", entries: [{ name: "Lantern", category: "Wondrous Items", rarity: "Common", description: "Blue light", source: "module.pdf", sourcePage: 7 }] });
    assert.equal(commit.status, 200); assert.equal(items.length, 2);
    assert.equal(items[0].name, "Existing Item"); assert.equal(items[1].source, "module.pdf · p. 7");
    const creatures = recognizePdfLibrary(block, "winter.pdf", "creatures").candidates;
    assert.equal((await call("commit", { kind: "creatures", entries: creatures })).status, 200);
    assert.equal(monsters.length, 2); assert.equal(monsters[1].monster.profileData.sourcePage, 3);
    assert.match(monsters[1].actions[0].actionDescription, /Spear/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
