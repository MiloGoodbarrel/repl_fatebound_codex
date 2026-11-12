import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { recognizePdfLibrary, pdfCommitSchema } from "../server/pdfLibraryParser";
import { registerPdfLibraryRoutes } from "../server/pdfLibraryRoutes";
import { extractJournalDocument } from "../server/journal/documents";
import { apiPolicy } from "../server/auth/policy";
import { pdf } from "./document-fixtures";
import { insertCampaignItemSchema } from "../shared/schema";
import { randomUUID } from "node:crypto";
import { profileLibraryColumns } from "../shared/creatureProfiles";
import { MAX_DOCUMENT_BYTES } from "../shared/journal";

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
  assert.ok(pdfCommitSchema.safeParse({ idempotencyKey: randomUUID(), kind: "creatures", entries: [profile] }).success);
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
  assert.ok(pdfCommitSchema.safeParse({ idempotencyKey: randomUUID(), kind: "items", entries: result.candidates }).success);
  assert.equal(pdfCommitSchema.safeParse({ kind: "items", entries: result.candidates }).success, false);
  assert.equal(pdfCommitSchema.safeParse({ idempotencyKey: "bad", kind: "items", entries: result.candidates }).success, false);
  assert.equal(pdfCommitSchema.safeParse({ idempotencyKey: randomUUID(), kind: "items", entries: [{ name: "Bad" }] }).success, false);
  assert.equal(pdfCommitSchema.safeParse({ idempotencyKey: randomUUID(), kind: "creatures", entries: [{ ...recognizePdfLibrary(block, "a.pdf", "creatures").candidates[0], hp: -1 }] }).success, false);
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
    commitPdfImport: async (_id, data) => {
      if (data.kind === "items") items.push(...data.entries.map(({ sourcePage, source, ...item }) => ({
        ...item, source: sourcePage ? `${source} · p. ${sourcePage}` : source,
      })));
      else monsters.push(...data.entries.map(profile => ({
        monster: profileLibraryColumns(profile),
        actions: (profile.actions ?? []).map(action => ({ actionDescription: action.desc })),
      })));
      return { count: data.entries.length, message: "Added reviewed entries." };
    },
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
    const commit = await call("commit", { idempotencyKey: randomUUID(), kind: "items", entries: [{ name: "Lantern", category: "Wondrous Items", rarity: "Common", description: "Blue light", source: "module.pdf", sourcePage: 7 }] });
    assert.equal(commit.status, 200); assert.equal(items.length, 2);
    assert.equal(items[0].name, "Existing Item"); assert.equal(items[1].source, "module.pdf · p. 7");
    const creatures = recognizePdfLibrary(block, "winter.pdf", "creatures").candidates;
    assert.equal((await call("commit", { idempotencyKey: randomUUID(), kind: "creatures", entries: creatures })).status, 200);
    assert.equal(monsters.length, 2); assert.equal(monsters[1].monster.profileData.sourcePage, 3);
    assert.match(monsters[1].actions[0].actionDescription, /Spear/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("every rejected PDF leaves the processing slot available and never commits rows", async () => {
  const app = express();
  let commits = 0;
  registerPdfLibraryRoutes(app, {
    getCampaignItems: async () => [],
    getCampaignHomebrew: async () => [],
    commitPdfImport: async () => { commits++; throw new Error("Preview must never commit"); },
  });
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ message: error.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const preview = (bytes: Buffer, kind: string, filename = "fictional.pdf", type = "application/pdf") =>
    fetch(`${base}/api/campaigns/1/pdf-import/preview?kind=${kind}&filename=${filename}`, {
      method: "POST", headers: { "Content-Type": type }, body: bytes,
    });
  try {
    const failures = [
      { bytes: Buffer.from("not a PDF"), status: 400, message: /not a valid PDF/ },
      { bytes: Buffer.from("%PDF-1.4\nbroken"), status: 400, message: /Could not read this PDF/ },
      { bytes: pdf(undefined, { imageOnly: true }), status: 400, message: /OCR/ },
      { bytes: Buffer.alloc(MAX_DOCUMENT_BYTES + 1), status: 413, message: /too large/i },
      { bytes: pdf("Fictional notes", { pages: 101 }), status: 400, message: /100 pages/ },
      { bytes: pdf(Array(40).fill("x".repeat(90)).join("\n"), { pages: 80 }), status: 400, message: /256 KiB/ },
    ];
    for (const kind of ["items", "creatures"]) {
      for (const failure of failures) {
        const response = await preview(failure.bytes, kind);
        assert.equal(response.status, failure.status, `${kind}: ${failure.message}`);
        assert.match((await response.json()).message, failure.message);
        const recovery = await preview(pdf("Fictional recovery notes"), kind);
        assert.equal(recovery.status, 200, `Lock must be released after ${failure.message}`);
        await recovery.arrayBuffer();
      }
    }
    assert.equal((await preview(Buffer.from("wrong media"), "items", "notes.pdf", "text/plain")).status, 415);
    assert.equal((await preview(pdf("Notes"), "invalid")).status, 400);
    assert.equal(commits, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("a concurrent preview gets recoverable 429 and a repository failure also releases the slot", async () => {
  const app = express();
  let entered!: () => void;
  let release!: () => void;
  const reached = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  registerPdfLibraryRoutes(app, {
    getCampaignItems: async () => {
      entered();
      await held;
      if (fail) throw new Error("Synthetic library read failure");
      return [];
    },
    getCampaignHomebrew: async () => [],
    commitPdfImport: async () => { throw new Error("Preview must never commit"); },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const preview = (campaign: number, kind: string) =>
    fetch(`${base}/api/campaigns/${campaign}/pdf-import/preview?kind=${kind}&filename=fictional.pdf`, {
      method: "POST", headers: { "Content-Type": "application/pdf" }, body: pdf("Fictional notes"),
    });
  try {
    const first = preview(1, "items");
    await reached;
    const blocked = await preview(2, "creatures");
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).message, /retry shortly/i);
    release();
    assert.equal((await first).status, 400);
    fail = false;
    assert.equal((await preview(2, "creatures")).status, 200);
    assert.equal((await preview(1, "items")).status, 200);
  } finally {
    release();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
