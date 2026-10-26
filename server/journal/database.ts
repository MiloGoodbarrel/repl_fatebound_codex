import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { campaigns, campaignCharacters, campaignItems, campaignHomebrewMonsters, campaignResourceLinks, bestiaryMonsterSpells, journalSessions, journalImports, journalAliases, journalRecordings } from "@shared/schema";
import { nameKey, type Alias, type JournalSession, type Reference } from "@shared/journal";
import type { JournalRepository, StoredImport, StoredRecording } from "./repository";

const sessionScope = (campaignId: number, id: string) => and(eq(journalSessions.campaignId, campaignId), eq(journalSessions.id, id));
const importScope = (sessionId: string, id: string) => and(eq(journalImports.sessionId, sessionId), eq(journalImports.id, id));
const audioScope = (sessionId: string, id: string) => and(eq(journalRecordings.sessionId, sessionId), eq(journalRecordings.id, id));
const audioMetadata = { id: journalRecordings.id, sessionId: journalRecordings.sessionId, name: journalRecordings.name, type: journalRecordings.type, size: journalRecordings.size };

export class DatabaseJournalRepository implements JournalRepository {
  async hasPrivateData(campaignId: number) {
    const [sessions, aliases] = await Promise.all([
      db.select({ id: journalSessions.id }).from(journalSessions).where(eq(journalSessions.campaignId, campaignId)).limit(1),
      db.select({ id: journalAliases.id }).from(journalAliases).where(eq(journalAliases.campaignId, campaignId)).limit(1),
    ]);
    return sessions.length > 0 || aliases.length > 0;
  }
  async listSessions(campaignId: number) {
    return db.select().from(journalSessions).where(eq(journalSessions.campaignId, campaignId)).orderBy(desc(journalSessions.date), asc(journalSessions.id));
  }
  async getSession(campaignId: number, id: string) {
    return (await db.select().from(journalSessions).where(sessionScope(campaignId, id)))[0];
  }
  async createSession(value: JournalSession) { return (await db.insert(journalSessions).values(value).returning())[0]; }
  async updateSession(campaignId: number, id: string, data: { title: string; date: string }) {
    return (await db.update(journalSessions).set({ ...data, updatedAt: new Date().toISOString() }).where(sessionScope(campaignId, id)).returning())[0];
  }
  async saveNotes(campaignId: number, id: string, revision: number, notes: string) {
    return (await db.update(journalSessions).set({ notes, revision: revision + 1, updatedAt: new Date().toISOString() })
      .where(and(sessionScope(campaignId, id), eq(journalSessions.revision, revision))).returning())[0];
  }
  async deleteSession(campaignId: number, id: string) { await db.delete(journalSessions).where(sessionScope(campaignId, id)); }
  async listImports(sessionId: string) {
    return await db.select().from(journalImports).where(eq(journalImports.sessionId, sessionId)) as StoredImport[];
  }
  async getImport(sessionId: string, id: string) {
    return (await db.select().from(journalImports).where(importScope(sessionId, id)))[0] as StoredImport | undefined;
  }
  async createImport(value: StoredImport) { return (await db.insert(journalImports).values(value).returning())[0] as StoredImport; }
  async updateImport(sessionId: string, id: string, revision: number, data: Pick<StoredImport, "decisions" | "editedText">) {
    return (await db.update(journalImports).set({ ...data, revision: revision + 1 })
      .where(and(importScope(sessionId, id), eq(journalImports.revision, revision))).returning())[0] as StoredImport | undefined;
  }
  async listAliases(campaignId: number) {
    return db.select({ id: journalAliases.id, phrase: journalAliases.phrase, referenceKey: journalAliases.referenceKey })
      .from(journalAliases).where(eq(journalAliases.campaignId, campaignId));
  }
  async saveAlias(campaignId: number, alias: Alias, existing: boolean) {
    const value = { ...alias, campaignId, phraseKey: nameKey(alias.phrase) };
    try {
      const rows = existing ? await db.update(journalAliases).set(value)
        .where(and(eq(journalAliases.campaignId, campaignId), eq(journalAliases.id, alias.id))).returning() :
        await db.insert(journalAliases).values(value).onConflictDoNothing().returning();
      return rows.length ? alias : undefined;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return undefined;
      throw error;
    }
  }
  async deleteAlias(campaignId: number, id: string) {
    await db.delete(journalAliases).where(and(eq(journalAliases.campaignId, campaignId), eq(journalAliases.id, id)));
  }
  async references(campaignId: number): Promise<Reference[]> {
    // Linked resources require direct, current identity matches. No chained links or other party rosters.
    const [characters, items, creatures, spells] = await Promise.all([
      db.select().from(campaignCharacters).where(eq(campaignCharacters.campaignId, campaignId)),
      db.select({ id: campaignItems.id, name: campaignItems.name, campaignId: campaignItems.campaignId, owner: campaigns.name })
        .from(campaignItems).innerJoin(campaigns, eq(campaignItems.campaignId, campaigns.id)).where(sql`
          ${campaignItems.campaignId} = ${campaignId} OR EXISTS (
            SELECT 1 FROM ${campaignResourceLinks} l WHERE l.campaign_id = ${campaignId}
            AND l.item_id = ${campaignItems.id} AND l.source_campaign_id = ${campaignItems.campaignId})`),
      db.select({ id: campaignHomebrewMonsters.id, name: campaignHomebrewMonsters.name, campaignId: campaignHomebrewMonsters.campaignId, owner: campaigns.name })
        .from(campaignHomebrewMonsters).innerJoin(campaigns, eq(campaignHomebrewMonsters.campaignId, campaigns.id)).where(sql`
          ${campaignHomebrewMonsters.campaignId} = ${campaignId} OR EXISTS (
            SELECT 1 FROM ${campaignResourceLinks} l WHERE l.campaign_id = ${campaignId}
            AND l.npc_id = ${campaignHomebrewMonsters.id} AND l.source_campaign_id = ${campaignHomebrewMonsters.campaignId})`),
      db.selectDistinct({ name: bestiaryMonsterSpells.spellName }).from(bestiaryMonsterSpells).where(sql`${bestiaryMonsterSpells.spellName} IS NOT NULL`),
    ]);
    return [
      ...characters.map(c => ({ key: `character:${c.id}`, name: c.name, source: "Party character", campaignId })),
      ...items.map(i => ({ key: `item:${i.id}`, name: i.name, source: `Item · ${i.owner}`, campaignId: i.campaignId })),
      ...creatures.map(c => ({ key: `creature:${c.id}`, name: c.name, source: `NPC/creature · ${c.owner}`, campaignId: c.campaignId })),
      ...spells.filter(s => s.name).map(s => ({ key: `spell:${s.name}`, name: s.name!, source: "Existing stock spell name" })),
    ];
  }
  async listRecordings(sessionId: string) { return db.select(audioMetadata).from(journalRecordings).where(eq(journalRecordings.sessionId, sessionId)); }
  async getRecording(sessionId: string, id: string) { return (await db.select().from(journalRecordings).where(audioScope(sessionId, id)))[0]; }
  async createRecording(value: StoredRecording) { return (await db.insert(journalRecordings).values(value).onConflictDoNothing().returning())[0]; }
  async deleteRecording(sessionId: string, id: string) { await db.delete(journalRecordings).where(audioScope(sessionId, id)); }
}
