import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { emptySummarySections } from "../shared/sessionSummary";

test("PostgreSQL summary history survives reload, serializes writes, isolates sessions and cascades", {
  skip: process.env.SUMMARY_DATABASE_TEST !== "1",
}, async () => {
  const { db, pool } = await import("../server/db");
  const { campaigns, journalSessions, journalSummaryVersions } = await import("../shared/schema");
  const { DatabaseSummaryRepository } = await import("../server/journal/summaryDatabase");
  const repo = new DatabaseSummaryRepository();
  let campaignId: number | undefined;
  try {
    const [campaign] = await db.insert(campaigns).values({ name: `SYNTHETIC SUMMARY TEST ${randomUUID()}`, edition: "5e" }).returning();
    campaignId = campaign.id;
    const sid = randomUUID();
    await db.insert(journalSessions).values({ id: sid, campaignId, title: "Synthetic", date: "2026-10-29", notes: "Original note", updatedAt: new Date().toISOString() });
    const initial = await repo.load(campaignId, sid), sections = emptySummarySections();
    sections[0].text = "Real persisted summary"; sections[0].locked = true; sections[0].annotation = "Keep this";
    sections[0].sourceIds = [initial.sources[0].id];
    const mutation = { expectedRevision: 0, sourceFingerprint: initial.sourceFingerprint, action: "save" as const, sections };
    const competing = await Promise.allSettled([repo.write(campaignId, sid, mutation), repo.write(campaignId, sid, mutation)]);
    assert.equal(competing.filter(value => value.status === "fulfilled").length, 1);
    assert.equal((competing.find(value => value.status === "rejected") as PromiseRejectedResult).reason.status, 409);
    const saved = await new DatabaseSummaryRepository().load(campaignId, sid);
    assert.deepEqual(saved.current?.sections, sections);
    assert.equal(saved.current?.sources[0].text, "Original note");
    await repo.write(campaignId, sid, { ...mutation, expectedRevision: 1, action: "approve" });
    await db.update(journalSessions).set({ notes: "Changed", revision: 1 }).where(eq(journalSessions.id, sid));
    const fresh = await repo.load(campaignId, sid);
    assert.equal(fresh.stale, true);
    assert.equal(fresh.approved?.sources[0].text, "Original note");
    await assert.rejects(repo.load(campaignId + 1, sid), (e: any) => e.status === 404);
    await assert.rejects(repo.write(campaignId + 1, sid, mutation), (e: any) => e.status === 404);
    await assert.rejects(repo.write(campaignId, sid, { ...mutation, expectedRevision: 2 }), (e: any) => e.status === 409);
    const restored = await repo.write(campaignId, sid, { expectedRevision: 2, sourceFingerprint: fresh.sourceFingerprint, action: "restore", restoreRevision: 1 });
    assert.equal(restored.current?.status, "draft");
    assert.equal(restored.approved?.revision, 2);
    assert.equal(restored.current?.revision, 3);
    await db.delete(journalSessions).where(eq(journalSessions.id, sid));
    assert.equal((await db.select().from(journalSummaryVersions).where(eq(journalSummaryVersions.sessionId, sid))).length, 0);
  } finally {
    if (campaignId) await db.delete(campaigns).where(eq(campaigns.id, campaignId));
    await pool.end();
  }
});
