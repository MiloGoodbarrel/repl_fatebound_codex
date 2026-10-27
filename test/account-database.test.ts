import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { once } from "node:events";
import express from "express";

test("real account storage and routes isolate legacy cross-owner links, homebrew, journals and direct child IDs", {
  skip: process.env.ACCOUNT_DATABASE_TEST !== "1",
}, async () => {
  const { db, pool } = await import("../server/db");
  const s = await import("../shared/schema");
  const { storage } = await import("../server/storage");
  const { actorContext, requestActors } = await import("../server/auth/context");
  const { apiPolicy } = await import("../server/auth/policy");
  const { accessRepository } = await import("../server/auth/access");
  const { registerRoutes } = await import("../server/routes");
  const { registerJournalRoutes } = await import("../server/journal/routes");
  const { DatabaseJournalRepository } = await import("../server/journal/database");
  const tag = `SYNTHETIC ACCOUNT ${randomUUID()}`;
  const alice = `${tag}:alice`, bob = `${tag}:bob`;
  const ids: number[] = [];
  let server: ReturnType<typeof express.prototype.listen> | undefined;
  try {
    const cs = await db.insert(s.campaigns).values([
      { name: tag + " A", ownerUserId: alice }, { name: tag + " B", ownerUserId: bob },
      { name: tag + " A2", ownerUserId: alice },
    ]).returning();
    ids.push(...cs.map(c => c.id));
    const [a, b, a2] = ids;
    const rows = await db.insert(s.campaignItems).values([
      { campaignId: a, name: tag + " own", category: "Magical" },
      { campaignId: b, name: tag + " foreign", category: "Magical" },
      { campaignId: a2, name: tag + " linked", category: "Magical" },
    ]).returning();
    const npcs = await db.insert(s.campaignHomebrewMonsters).values([
      { campaignId: b, name: tag + " foreign NPC" }, { campaignId: a2, name: tag + " linked NPC" },
    ]).returning();
    await db.insert(s.campaignResourceLinks).values([
      { campaignId: a, sourceCampaignId: b, itemId: rows[1].id },
      { campaignId: a, sourceCampaignId: a2, itemId: rows[2].id },
      { campaignId: a, sourceCampaignId: b, npcId: npcs[0].id },
      { campaignId: a, sourceCampaignId: a2, npcId: npcs[1].id },
    ]);
    await db.insert(s.homebrewItems).values([
      { ownerUserId: alice, name: tag + " private brew", category: "Magical" },
      { ownerUserId: bob, name: tag + " foreign brew", category: "Magical" },
      { name: tag + " unclaimed brew", category: "Magical" },
    ]);
    const [pc] = await db.insert(s.campaignCharacters).values({ campaignId: b, name: tag }).returning();
    await actorContext.run({ userId: alice, admin: false }, async () => {
      assert.equal((await storage.getCampaigns()).length, 2);
      assert.equal(await storage.getCampaign(b), undefined);
      assert.deepEqual((await storage.getCampaignItems(a)).map(i => i.id).sort(), [rows[0].id, rows[2].id].sort());
      assert.deepEqual((await storage.getCampaignHomebrew(a)).map(n => n.id), [npcs[1].id]);
      const draws = await storage.drawItems({ source: "campaign", campaignId: a, sources: ["Homebrew"], categories: ["Magical"], rarities: ["Common"], count: 100 });
      assert.equal(draws.length, 3);
      assert.ok(draws.every(i => !i.name.includes("foreign") && !i.name.includes("unclaimed")));
    });
    const app = express();
    app.use((req, res, next) => req.path.includes("/journal") ? next() : express.json()(req, res, next));
    app.use("/api", apiPolicy(async req => {
      const userId = req.get("test-identity");
      return userId ? { userId, admin: false } : null;
    }, accessRepository));
    const repo = new DatabaseJournalRepository();
    registerJournalRoutes(app, repo, { authorizeCampaign: async (req, id) => {
      const actor = requestActors.get(req);
      return !!actor && await accessRepository.campaignOwner(id) === actor.userId;
    } });
    server = app.listen(0, "127.0.0.1"); await once(server!, "listening");
    await registerRoutes(server!, app);
    const origin = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
    const call = (path: string, method = "GET", body?: unknown, userId = alice, headers: Record<string,string> = {}) =>
      fetch(origin + "/api" + path, { method, headers: { Origin: origin, "test-identity": userId,
        ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined });
    assert.equal((await call(`/campaigns/characters/${pc.id}`, "PATCH", { name: "stolen" })).status, 404);
    const links = await (await call(`/campaigns/${a}/resources`)).json();
    assert.equal(links.links.length, 2);
    assert.ok(JSON.stringify(links).includes("linked"));
    assert.ok(!JSON.stringify(links).includes("foreign"));
    assert.equal((await call(`/campaigns/${a}/resources/links`, "POST", { sourceCampaignId: b, itemIds: [rows[1].id], npcIds: [] })).status, 404);
    const created = await call(`/campaigns/${a}/journal/sessions`, "POST", { title: tag, date: "2026-10-27" });
    assert.equal(created.status, 201);
    const session = await created.json();
    assert.equal((await call(`/campaigns/${a}/journal/sessions/${session.id}`, "GET", undefined, bob)).status, 404);
    const refs = await (await call(`/campaigns/${a}/journal/references`)).json();
    assert.ok(!JSON.stringify(refs).includes("foreign"));
    assert.ok(JSON.stringify(refs).includes("linked NPC"));
    const audio = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(50)]);
    const rid = randomUUID();
    const uploaded = await fetch(origin + `/api/campaigns/${a}/journal/sessions/${session.id}/recordings`, {
      method: "POST", headers: { Origin: origin, "test-identity": alice, "Content-Type": "audio/mpeg", "x-file-name": "test.mp3", "x-upload-id": rid }, body: audio,
    });
    assert.equal(uploaded.status, 201, await uploaded.text());
    assert.equal((await call(`/campaigns/${a}/journal/sessions/${session.id}/recordings/${rid}`, "GET", undefined, bob, { Range: "bytes=0-3" })).status, 404);
    assert.equal((await call(`/campaigns/${a}/journal/sessions/${session.id}/recordings/${rid}`, "GET", undefined, alice, { Range: "bytes=0-3" })).status, 206);
    // Legitimate campaign deletion still cascades through private journal data.
    assert.equal((await call(`/campaigns/${a}`, "DELETE")).status, 200);
    assert.equal(await repo.getSession(a, session.id), undefined);
    assert.ok(await db.select().from(s.campaigns).where(eq(s.campaigns.id, b)));
  } finally {
    if (server) { server.closeAllConnections(); await new Promise<void>(r => server!.close(() => r())); }
    if (ids.length) {
      await db.delete(s.campaignResourceLinks).where(inArray(s.campaignResourceLinks.campaignId, ids));
      const monsters = await db.select().from(s.campaignHomebrewMonsters).where(inArray(s.campaignHomebrewMonsters.campaignId, ids));
      if (monsters.length) await db.delete(s.campaignHomebrewActions).where(inArray(s.campaignHomebrewActions.monsterRefId, monsters.map(m => m.id)));
      await db.delete(s.campaignHomebrewMonsters).where(inArray(s.campaignHomebrewMonsters.campaignId, ids));
      await db.delete(s.campaignItems).where(inArray(s.campaignItems.campaignId, ids));
      await db.delete(s.campaignCharacters).where(inArray(s.campaignCharacters.campaignId, ids));
      await db.delete(s.campaigns).where(inArray(s.campaigns.id, ids));
    }
    await db.delete(s.homebrewItems).where(inArray(s.homebrewItems.ownerUserId, [alice, bob]));
    await db.delete(s.homebrewItems).where(eq(s.homebrewItems.name, tag + " unclaimed brew"));
    await pool.end();
  }
});
