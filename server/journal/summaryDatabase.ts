import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { journalSessions, journalImports, journalSummaryVersions } from "@shared/schema";
import type { SummaryVersion, SummaryState } from "@shared/sessionSummary";
import { SummaryError, nextSummaryVersion, summarySources, summaryState, type SummaryMutation, type SummaryRepository } from "./summary";
import type { StoredImport } from "./repository";

const scoped = (campaignId: number, sid: string) => and(eq(journalSessions.campaignId, campaignId), eq(journalSessions.id, sid));
export class DatabaseSummaryRepository implements SummaryRepository {
  async load(campaignId: number, sid: string): Promise<SummaryState> {
    // One repeatable-read transaction keeps revisions and freshness consistent.
    return db.transaction(async tx => {
      const [session] = await tx.select().from(journalSessions).where(scoped(campaignId, sid));
      if (!session) throw new SummaryError(404, "Session not found in this campaign.");
      const imports = await tx.select().from(journalImports).where(eq(journalImports.sessionId, sid));
      const [current] = await tx.select().from(journalSummaryVersions).where(eq(journalSummaryVersions.sessionId, sid)).orderBy(desc(journalSummaryVersions.revision)).limit(1);
      const [approved] = await tx.select().from(journalSummaryVersions).where(and(eq(journalSummaryVersions.sessionId, sid), eq(journalSummaryVersions.status, "approved"))).orderBy(desc(journalSummaryVersions.revision)).limit(1);
      return summaryState(current as SummaryVersion ?? null, approved as SummaryVersion ?? null, summarySources(session, imports as StoredImport[]));
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
  async history(campaignId: number, sid: string) {
    const rows = await db.select({
      sessionId: journalSummaryVersions.sessionId, revision: journalSummaryVersions.revision,
      status: journalSummaryVersions.status, action: journalSummaryVersions.action,
      createdAt: journalSummaryVersions.createdAt, restoredFrom: journalSummaryVersions.restoredFrom,
    }).from(journalSummaryVersions).innerJoin(journalSessions, eq(journalSummaryVersions.sessionId, journalSessions.id))
      .where(scoped(campaignId, sid)).orderBy(desc(journalSummaryVersions.revision)).limit(100);
    return rows;
  }
  async version(campaignId: number, sid: string, revision: number) {
    const [row] = await db.select({ value: journalSummaryVersions }).from(journalSummaryVersions)
      .innerJoin(journalSessions, eq(journalSummaryVersions.sessionId, journalSessions.id))
      .where(and(scoped(campaignId, sid), eq(journalSummaryVersions.revision, revision)));
    return row?.value as SummaryVersion | undefined;
  }
  async write(campaignId: number, sid: string, mutation: SummaryMutation) {
    await db.transaction(async tx => {
      // Serialize competing summary writes and block notes/session edits.
      // Import updates lock their rows; new imports need an FK key-share lock
      // on this session, which conflicts with the session FOR UPDATE lock.
      const [session] = await tx.select().from(journalSessions).where(scoped(campaignId, sid)).for("update");
      if (!session) throw new SummaryError(404, "Session not found in this campaign.");
      const imports = await tx.select().from(journalImports).where(eq(journalImports.sessionId, sid)).for("update");
      const [current] = await tx.select().from(journalSummaryVersions).where(eq(journalSummaryVersions.sessionId, sid)).orderBy(desc(journalSummaryVersions.revision)).limit(1);
      const [restore] = mutation.restoreRevision ? await tx.select().from(journalSummaryVersions)
        .where(and(eq(journalSummaryVersions.sessionId, sid), eq(journalSummaryVersions.revision, mutation.restoreRevision))).limit(1) : [];
      const next = nextSummaryVersion(sid, mutation, current as SummaryVersion ?? null, summarySources(session, imports as StoredImport[]), restore as SummaryVersion | undefined);
      await tx.insert(journalSummaryVersions).values(next);
    });
    return this.load(campaignId, sid);
  }
}
