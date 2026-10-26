import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

// Opt-in database integration test; creates only clearly labelled synthetic rows,
// then deletes exactly those identities. Never runs against production.
test("PostgreSQL journal persists binary files and immutable originals; current direct links only; atomic revisions and cascades", {
  skip: process.env.JOURNAL_DATABASE_TEST !== "1",
}, async () => {
  const { db, pool } = await import("../server/db");
  const schema = await import("../shared/schema");
  const { DatabaseJournalRepository } = await import("../server/journal/database");
  const repo = new DatabaseJournalRepository();
  const ids: number[] = [];
  try {
    const tag = `SYNTHETIC JOURNAL TEST ${randomUUID()}`;
    const created = await db.insert(schema.campaigns).values([0, 1, 2].map(n => ({ name: `${tag} ${n}`, edition: "5e" }))).returning();
    ids.push(...created.map(c => c.id));
    const [a, b, c] = ids;
    const [pc] = await db.insert(schema.campaignCharacters).values({ campaignId: a, name: "Synthetic Quill" }).returning();
    const [foreignPc] = await db.insert(schema.campaignCharacters).values({ campaignId: b, name: "Synthetic private party" }).returning();
    const items = await db.insert(schema.campaignItems).values([
      { campaignId: a, name: "Synthetic owned item", category: "Magical" },
      { campaignId: b, name: "Synthetic linked item", category: "Magical" },
      { campaignId: c, name: "Synthetic unlinked item", category: "Magical" },
    ]).returning();
    const [npc] = await db.insert(schema.campaignHomebrewMonsters).values({ campaignId: b, name: "Synthetic linked NPC" }).returning();
    await db.insert(schema.campaignResourceLinks).values([
      { campaignId: a, sourceCampaignId: b, itemId: items[1].id },
      { campaignId: a, sourceCampaignId: b, npcId: npc.id },
      { campaignId: b, sourceCampaignId: c, itemId: items[2].id },
    ]);
    const refs = await repo.references(a), keys = new Set(refs.map(r => r.key));
    assert.ok(keys.has(`character:${pc.id}`)); assert.ok(!keys.has(`character:${foreignPc.id}`));
    assert.ok(keys.has(`item:${items[0].id}`)); assert.ok(keys.has(`item:${items[1].id}`));
    assert.ok(keys.has(`creature:${npc.id}`)); assert.ok(!keys.has(`item:${items[2].id}`));
    const sid = randomUUID();
    await repo.createSession({ id: sid, campaignId: a, title: "Synthetic session", date: "2026-10-26", notes: "", revision: 0, updatedAt: new Date().toISOString() });
    assert.equal(await repo.getSession(b, sid), undefined);
    const saves = await Promise.all(["first", "second"].map(notes => repo.saveNotes(a, sid, 0, notes)));
    assert.equal(saves.filter(Boolean).length, 1);
    assert.equal((await new DatabaseJournalRepository().getSession(a, sid))?.revision, 1);
    const iid = randomUUID(), original = "Quil met Quil.";
    await repo.createImport({ id: iid, sessionId: sid, title: "Source", kind: "transcript", format: "text", original, suggestions: [], decisions: [], revision: 0, editedText: null });
    await repo.updateImport(sid, iid, 0, { editedText: "Reviewed separately", decisions: [] });
    assert.equal((await repo.getImport(sid, iid))?.original, original);
    const alias = { id: randomUUID(), phrase: "kwil", referenceKey: `character:${pc.id}` };
    assert.ok(await repo.saveAlias(a, alias, false));
    assert.equal(await repo.saveAlias(a, { ...alias, id: randomUUID(), phrase: "KWIL" }, false), undefined);
    const bytes = Buffer.from("RIFF0000WAVEfmt synthetic");
    const audio = { id: randomUUID(), sessionId: sid, name: "synthetic.wav", type: "audio/wav", size: bytes.length, bytes, digest: createHash("sha256").update(bytes).digest("hex") };
    await repo.createRecording(audio);
    assert.deepEqual((await new DatabaseJournalRepository().getRecording(sid, audio.id))?.bytes, bytes);
    assert.equal("bytes" in (await repo.listRecordings(sid))[0], false);
    await db.delete(schema.campaignResourceLinks).where(and(eq(schema.campaignResourceLinks.campaignId, a), eq(schema.campaignResourceLinks.itemId, items[1].id)));
    assert.ok(!(await repo.references(a)).some(r => r.key === `item:${items[1].id}`));
    await repo.deleteSession(a, sid);
    assert.equal(await repo.getRecording(sid, audio.id), undefined);
    assert.equal(await repo.getImport(sid, iid), undefined);
    assert.equal(await repo.hasPrivateData(a), true); // campaign aliases are independent of sessions
  } finally {
    if (ids.length) {
      await db.delete(schema.campaignCharacters).where(inArray(schema.campaignCharacters.campaignId, ids));
      await db.delete(schema.campaignItems).where(inArray(schema.campaignItems.campaignId, ids));
      await db.delete(schema.campaignHomebrewMonsters).where(inArray(schema.campaignHomebrewMonsters.campaignId, ids));
      await db.delete(schema.campaigns).where(inArray(schema.campaigns.id, ids));
    }
    await pool.end();
  }
});
