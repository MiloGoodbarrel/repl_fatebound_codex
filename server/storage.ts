import { db } from "./db";
import {
  items5e, homebrewItems, campaignItems, campaigns, campaignCharacters,
  bestiaryMonsters, bestiaryMonsterTraits, bestiaryMonsterActions,
  campaignHomebrewMonsters, campaignHomebrewActions, campaignSavedEncounters,
  rollTables, rollTableEntries,
  type InsertItem, type Item,
  type HomebrewItem, type InsertHomebrewItem,
  type Campaign, type InsertCampaign,
  type CampaignItem, type InsertCampaignItem,
  type CampaignCharacter, type InsertCampaignCharacter,
  type DrawOptions,
} from "@shared/schema";
import { eq, inArray, sql, and, ilike, asc } from "drizzle-orm";
import { getEncounterSaveRevision } from "@shared/encounterRecovery";
import { encounterRevisionConflictPredicate } from "./encounterPersistence";

export interface IStorage {
  // 5e compendium
  getItems5e(): Promise<Item[]>;
  createItems5e(items: InsertItem[]): Promise<Item[]>;
  clearItems5e(): Promise<void>;

  // Homebrew
  getHomebrewItems(): Promise<HomebrewItem[]>;
  addHomebrewItems(items: Omit<InsertHomebrewItem, "source">[]): Promise<HomebrewItem[]>;
  clearHomebrewItems(): Promise<void>;

  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;

  // Campaign items
  getCampaignItems(campaignId: number): Promise<CampaignItem[]>;
  importCampaignItems(campaignId: number, items: Omit<InsertCampaignItem, "campaignId">[]): Promise<CampaignItem[]>;
  clearCampaignItems(campaignId: number): Promise<void>;

  // Campaign characters
  getCampaignCharacters(campaignId: number): Promise<CampaignCharacter[]>;
  upsertCampaignCharacter(character: InsertCampaignCharacter): Promise<CampaignCharacter>;
  updateCampaignCharacter(id: number, data: Partial<InsertCampaignCharacter>): Promise<CampaignCharacter>;
  deleteCampaignCharacter(id: number): Promise<void>;

  // Draw
  getSources5e(): Promise<string[]>;
  drawItems(options: DrawOptions): Promise<(Item | HomebrewItem | CampaignItem)[]>;

  // Bestiary
  getBestiaryTypes(): Promise<string[]>;
  searchBestiary(search: string, types: string[], limit?: number): Promise<any[]>;
  getBestiaryMonsterDetail(monsterId: string): Promise<any | null>;

  // Campaign homebrew bestiary
  getCampaignHomebrew(campaignId: number): Promise<any[]>;
  importCampaignHomebrew(campaignId: number, parsed: { monster: any; actions: any[] }[]): Promise<number>;
  clearCampaignHomebrew(campaignId: number): Promise<void>;

  // Campaign saved encounters
  getSavedEncounter(campaignId: number): Promise<{ data: any; savedAt: Date } | null>;
  saveEncounter(campaignId: number, data: any): Promise<void>;
  clearSavedEncounter(campaignId: number): Promise<void>;

  // Roll tables
  getRollTables(campaignId: number): Promise<any[]>;
  createRollTable(data: any): Promise<any>;
  updateRollTable(id: number, data: any): Promise<any | null>;
  deleteRollTable(id: number, campaignId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {

  // ── 5e compendium ─────────────────────────────────────────────────────────

  async getItems5e(): Promise<Item[]> {
    return await db.select().from(items5e);
  }

  async createItems5e(insertItems: InsertItem[]): Promise<Item[]> {
    if (insertItems.length === 0) return [];
    return await db.insert(items5e).values(insertItems).returning();
  }

  async clearItems5e(): Promise<void> {
    await db.delete(items5e);
  }

  // ── Homebrew ───────────────────────────────────────────────────────────────

  async getHomebrewItems(): Promise<HomebrewItem[]> {
    return await db.select().from(homebrewItems);
  }

  async addHomebrewItems(items: Omit<InsertHomebrewItem, "source">[]): Promise<HomebrewItem[]> {
    if (items.length === 0) return [];
    const withSource = items.map(i => ({ ...i, source: "Homebrew" as const }));
    return await db.insert(homebrewItems).values(withSource).returning();
  }

  async clearHomebrewItems(): Promise<void> {
    await db.delete(homebrewItems);
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(campaigns.name);
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values(campaign).returning();
    return created;
  }

  async deleteCampaign(id: number): Promise<void> {
    await db.delete(campaignItems).where(eq(campaignItems.campaignId, id));
    await db.delete(campaignCharacters).where(eq(campaignCharacters.campaignId, id));
    await this.clearCampaignHomebrew(id);
    await db.delete(campaignSavedEncounters).where(eq(campaignSavedEncounters.campaignId, id));
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  // ── Campaign items ─────────────────────────────────────────────────────────

  async getCampaignItems(campaignId: number): Promise<CampaignItem[]> {
    return await db
      .select()
      .from(campaignItems)
      .where(eq(campaignItems.campaignId, campaignId));
  }

  async importCampaignItems(
    campaignId: number,
    items: Omit<InsertCampaignItem, "campaignId">[]
  ): Promise<CampaignItem[]> {
    if (items.length === 0) return [];
    const withId = items.map(i => ({ ...i, campaignId }));
    return await db.insert(campaignItems).values(withId).returning();
  }

  async clearCampaignItems(campaignId: number): Promise<void> {
    await db.delete(campaignItems).where(eq(campaignItems.campaignId, campaignId));
  }

  // ── Campaign characters ────────────────────────────────────────────────────

  async getCampaignCharacters(campaignId: number): Promise<CampaignCharacter[]> {
    return await db
      .select()
      .from(campaignCharacters)
      .where(eq(campaignCharacters.campaignId, campaignId))
      .orderBy(campaignCharacters.name);
  }

  async upsertCampaignCharacter(character: InsertCampaignCharacter): Promise<CampaignCharacter> {
    const [created] = await db.insert(campaignCharacters).values(character).returning();
    return created;
  }

  async updateCampaignCharacter(
    id: number,
    data: Partial<InsertCampaignCharacter>
  ): Promise<CampaignCharacter> {
    const [updated] = await db
      .update(campaignCharacters)
      .set(data)
      .where(eq(campaignCharacters.id, id))
      .returning();
    return updated;
  }

  async deleteCampaignCharacter(id: number): Promise<void> {
    await db.delete(campaignCharacters).where(eq(campaignCharacters.id, id));
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  async getSources5e(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ source: items5e.source })
      .from(items5e)
      .orderBy(items5e.source);
    return rows.map(r => r.source).filter((s): s is string => s != null);
  }

  // ── Bestiary ───────────────────────────────────────────────────────────────

  async getBestiaryTypes(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ creatureType: bestiaryMonsters.creatureType })
      .from(bestiaryMonsters)
      .where(sql`creature_type IS NOT NULL AND printed_average_hp IS NOT NULL`);
    return rows.map(r => r.creatureType).filter((t): t is string => t != null).sort();
  }

  async getBestiarySources(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ sourceBook: bestiaryMonsters.sourceBook })
      .from(bestiaryMonsters)
      .where(sql`source_book IS NOT NULL AND printed_average_hp IS NOT NULL`);
    return rows.map(r => r.sourceBook).filter((s): s is string => s != null).sort();
  }

  async getBestiaryCRs(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ cr: bestiaryMonsters.challengeRating })
      .from(bestiaryMonsters)
      .where(sql`challenge_rating IS NOT NULL AND printed_average_hp IS NOT NULL`);
    const crOrder: Record<string, number> = {
      '0': 0, '1/8': 1, '1/4': 2, '1/2': 3,
    };
    for (let i = 1; i <= 35; i++) crOrder[String(i)] = i + 3;
    return rows
      .map(r => r.cr)
      .filter((c): c is string => c != null)
      .sort((a, b) => (crOrder[a] ?? 999) - (crOrder[b] ?? 999));
  }

  async searchBestiary(search: string, types: string[], limit = 20, cr?: string, sources?: string[]): Promise<any[]> {
    const conditions: any[] = [sql`printed_average_hp IS NOT NULL`];
    if (search.trim()) conditions.push(ilike(bestiaryMonsters.name, `%${search.trim()}%`));
    if (types.length > 0) conditions.push(inArray(bestiaryMonsters.creatureType, types));
    if (sources && sources.length > 0) conditions.push(inArray(bestiaryMonsters.sourceBook, sources));
    if (cr) conditions.push(sql`challenge_rating = ${cr}`);
    return await db
      .select()
      .from(bestiaryMonsters)
      .where(and(...conditions))
      .orderBy(asc(bestiaryMonsters.name))
      .limit(limit);
  }

  async getRandomBestiaryMonster(types: string[], cr?: string, sources?: string[]): Promise<any | null> {
    const conditions: any[] = [sql`printed_average_hp IS NOT NULL`];
    if (types.length > 0) conditions.push(inArray(bestiaryMonsters.creatureType, types));
    if (sources && sources.length > 0) conditions.push(inArray(bestiaryMonsters.sourceBook, sources));
    if (cr) conditions.push(sql`challenge_rating = ${cr}`);
    const rows = await db
      .select()
      .from(bestiaryMonsters)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return rows[0] ?? null;
  }

  async getEncounterGroup(targetCr: string, types: string[], sources: string[], search: string): Promise<any[]> {
    function crToUnits(cr: string): number {
      if (!cr || cr === '0') return 0;
      if (cr === '1/8') return 1;
      if (cr === '1/4') return 2;
      if (cr === '1/2') return 4;
      const n = parseInt(cr, 10);
      return isNaN(n) ? 0 : n * 8;
    }
    function unitsToValidCr(units: number): string | null {
      if (units === 0) return '0';
      if (units === 1) return '1/8';
      if (units === 2) return '1/4';
      if (units === 4) return '1/2';
      if (units >= 8 && units % 8 === 0) return String(units / 8);
      return null;
    }

    const targetUnits = crToUnits(targetCr);
    const baseConditions: any[] = [sql`printed_average_hp IS NOT NULL`, sql`challenge_rating IS NOT NULL`];
    if (types.length > 0) baseConditions.push(inArray(bestiaryMonsters.creatureType, types));
    if (sources.length > 0) baseConditions.push(inArray(bestiaryMonsters.sourceBook, sources));
    if (search.trim()) baseConditions.push(ilike(bestiaryMonsters.name, `%${search.trim()}%`));

    // Enriches a list of bare monster rows with their traits + actions
    const enrich = async (monsters: any[]) => {
      return Promise.all(monsters.map(async (m) => {
        const traits = await db
          .select()
          .from(bestiaryMonsterTraits)
          .where(eq(bestiaryMonsterTraits.monsterId, m.monsterId))
          .orderBy(asc(bestiaryMonsterTraits.traitOrder));
        const actions = await db
          .select()
          .from(bestiaryMonsterActions)
          .where(eq(bestiaryMonsterActions.monsterId, m.monsterId))
          .orderBy(asc(bestiaryMonsterActions.actionOrder));
        return { ...m, traits, actions };
      }));
    };

    // For CR 0 or very low, just return a single monster
    const doCombo = targetUnits >= 8 && Math.random() < 0.5;

    if (!doCombo) {
      // Single exact-CR monster
      const rows = await db.select().from(bestiaryMonsters)
        .where(and(...baseConditions, sql`challenge_rating = ${targetCr}`))
        .orderBy(sql`RANDOM()`).limit(1);
      return enrich(rows);
    }

    // Combo mode: pick monsters whose CR units sum to targetUnits (no cap on count)
    const group: any[] = [];
    let remaining = targetUnits;

    while (remaining > 0) {
      // Get distinct available CRs in pool that are ≤ remaining and > 0
      const crRows = await db
        .selectDistinct({ cr: bestiaryMonsters.challengeRating })
        .from(bestiaryMonsters)
        .where(and(...baseConditions));

      const eligible = crRows
        .map(r => r.cr)
        .filter((c): c is string => c != null && crToUnits(c) > 0 && crToUnits(c) <= remaining);

      if (eligible.length === 0) break;

      // Weight toward larger CRs using their unit value as weight
      const totalWeight = eligible.reduce((sum, c) => sum + crToUnits(c), 0);
      let rand = Math.random() * totalWeight;
      let pickedCr = eligible[eligible.length - 1];
      for (const c of eligible) {
        rand -= crToUnits(c);
        if (rand <= 0) { pickedCr = c; break; }
      }

      // Pick a random monster with that CR
      const rows = await db.select().from(bestiaryMonsters)
        .where(and(...baseConditions, sql`challenge_rating = ${pickedCr}`))
        .orderBy(sql`RANDOM()`).limit(1);

      if (rows.length === 0) break;
      group.push(rows[0]);
      remaining -= crToUnits(pickedCr);

      // If remaining can't be filled by any standard CR, stop
      if (unitsToValidCr(remaining) === null && remaining < 1) break;
    }

    return group.length > 0 ? enrich(group) : [];
  }

  async getBestiaryMonsterDetail(monsterId: string): Promise<any | null> {
    const [monster] = await db
      .select()
      .from(bestiaryMonsters)
      .where(eq(bestiaryMonsters.monsterId, monsterId));
    if (!monster) return null;
    const traits = await db
      .select()
      .from(bestiaryMonsterTraits)
      .where(eq(bestiaryMonsterTraits.monsterId, monsterId))
      .orderBy(asc(bestiaryMonsterTraits.traitOrder));
    const actions = await db
      .select()
      .from(bestiaryMonsterActions)
      .where(eq(bestiaryMonsterActions.monsterId, monsterId))
      .orderBy(asc(bestiaryMonsterActions.actionOrder));
    return { ...monster, traits, actions };
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  async drawItems(options: DrawOptions): Promise<(Item | HomebrewItem | CampaignItem)[]> {
    const { source, campaignId, editions, categories, rarities, sources, count, search } = options;
    const searchTerm = search?.trim();

    // ── Campaign draw ──────────────────────────────────────────────────────
    if (source === "campaign" && campaignId != null) {
      const conditions: any[] = [
        eq(campaignItems.campaignId, campaignId),
        inArray(campaignItems.category, categories),
        inArray(campaignItems.rarity, rarities),
      ];
      if (searchTerm) conditions.push(ilike(campaignItems.name, `%${searchTerm}%`));
      return await db
        .select()
        .from(campaignItems)
        .where(and(...conditions))
        .orderBy(sql`RANDOM()`)
        .limit(count);
    }

    // ── Compendium draw ────────────────────────────────────────────────────
    const includeHomebrew = !sources || sources.includes("Homebrew");
    const officialSources = sources
      ? sources.filter(s => s !== "Homebrew")
      : null; // null = no filter

    const editionFilter = editions && editions.length > 0
      ? inArray(items5e.edition, editions)
      : undefined;
    const sourceFilter = officialSources && officialSources.length > 0
      ? inArray(items5e.source, officialSources)
      : undefined;
    const officialNameFilter = searchTerm ? ilike(items5e.name, `%${searchTerm}%`) : undefined;

    // Decide whether we need official items at all
    const needOfficial = !sources || officialSources === null || (officialSources && officialSources.length > 0);

    // Normalise rarity to lowercase for case-insensitive matching (DB stores "Very rare", client sends "Very Rare" etc.)
    const raritiesLower = rarities.map(r => r.toLowerCase());
    const officialRarityFilter = raritiesLower.length > 0
      ? sql`lower(${items5e.rarity}) IN (${sql.join(raritiesLower.map(r => sql`${r}`), sql`, `)})`
      : undefined;
    const homebrewRarityFilter = raritiesLower.length > 0
      ? sql`lower(${homebrewItems.rarity}) IN (${sql.join(raritiesLower.map(r => sql`${r}`), sql`, `)})`
      : undefined;

    const officialItems: Item[] = needOfficial
      ? await db
          .select()
          .from(items5e)
          .where(and(editionFilter, sourceFilter, officialNameFilter, inArray(items5e.category, categories), officialRarityFilter))
          .orderBy(sql`RANDOM()`)
          .limit(count)
      : [];

    const homebrewNameFilter = searchTerm ? ilike(homebrewItems.name, `%${searchTerm}%`) : undefined;
    const brewed: HomebrewItem[] = includeHomebrew
      ? await db
          .select()
          .from(homebrewItems)
          .where(and(homebrewNameFilter, inArray(homebrewItems.category, categories), homebrewRarityFilter))
          .orderBy(sql`RANDOM()`)
          .limit(count)
      : [];

    // Combine, shuffle, and trim to count
    const combined = [...officialItems, ...brewed].sort(() => Math.random() - 0.5);
    return combined.slice(0, count);
  }

  // ── Campaign Homebrew Bestiary ─────────────────────────────────────────────

  async getCampaignHomebrew(campaignId: number): Promise<any[]> {
    const monsters = await db
      .select()
      .from(campaignHomebrewMonsters)
      .where(eq(campaignHomebrewMonsters.campaignId, campaignId))
      .orderBy(asc(campaignHomebrewMonsters.name));
    const results: any[] = [];
    for (const m of monsters) {
      const actions = await db
        .select()
        .from(campaignHomebrewActions)
        .where(eq(campaignHomebrewActions.monsterRefId, m.id))
        .orderBy(asc(campaignHomebrewActions.actionOrder));
      results.push({ ...m, actions });
    }
    return results;
  }

  async importCampaignHomebrew(
    campaignId: number,
    parsed: { monster: any; actions: any[] }[]
  ): Promise<number> {
    await this.clearCampaignHomebrew(campaignId);
    let count = 0;
    for (const { monster, actions } of parsed) {
      const [inserted] = await db
        .insert(campaignHomebrewMonsters)
        .values({ ...monster, campaignId })
        .returning();
      for (const action of actions) {
        await db.insert(campaignHomebrewActions).values({
          ...action,
          monsterRefId: inserted.id,
        });
      }
      count++;
    }
    return count;
  }

  async clearCampaignHomebrew(campaignId: number): Promise<void> {
    const monsterIds = await db
      .select({ id: campaignHomebrewMonsters.id })
      .from(campaignHomebrewMonsters)
      .where(eq(campaignHomebrewMonsters.campaignId, campaignId));
    if (monsterIds.length > 0) {
      await db
        .delete(campaignHomebrewActions)
        .where(inArray(campaignHomebrewActions.monsterRefId, monsterIds.map(m => m.id)));
    }
    await db
      .delete(campaignHomebrewMonsters)
      .where(eq(campaignHomebrewMonsters.campaignId, campaignId));
  }

  // ── Campaign saved encounters ──────────────────────────────────────────────

  async getSavedEncounter(campaignId: number): Promise<{ data: any; savedAt: Date } | null> {
    const [row] = await db
      .select()
      .from(campaignSavedEncounters)
      .where(eq(campaignSavedEncounters.campaignId, campaignId));
    if (!row) return null;
    try {
      return { data: JSON.parse(row.encounterData), savedAt: row.savedAt };
    } catch {
      return null;
    }
  }

  async saveEncounter(campaignId: number, data: any): Promise<void> {
    const json = JSON.stringify(data);
    const saveRevision = getEncounterSaveRevision(data);
    await db
      .insert(campaignSavedEncounters)
      .values({ campaignId, encounterData: json })
      .onConflictDoUpdate({
        target: campaignSavedEncounters.campaignId,
        set: { encounterData: json, savedAt: new Date() },
        setWhere: encounterRevisionConflictPredicate(saveRevision),
      });
  }

  async clearSavedEncounter(campaignId: number): Promise<void> {
    await db
      .delete(campaignSavedEncounters)
      .where(eq(campaignSavedEncounters.campaignId, campaignId));
  }

  // ── Roll tables ────────────────────────────────────────────────────────────

  async getRollTables(campaignId: number): Promise<any[]> {
    const rows = await db
      .select()
      .from(rollTables)
      .where(eq(rollTables.campaignId, campaignId))
      .orderBy(asc(rollTables.name));
    return Promise.all(rows.map(async row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      mode: row.mode,
      source: "campaign" as const,
      campaignId: row.campaignId ?? undefined,
      entries: await db
        .select()
        .from(rollTableEntries)
        .where(eq(rollTableEntries.tableId, row.id))
        .orderBy(asc(rollTableEntries.entryOrder)),
    })));
  }

  async createRollTable(data: any): Promise<any> {
    const created = await db.transaction(async tx => {
      const [row] = await tx
        .insert(rollTables)
        .values({
          campaignId: data.campaignId,
          name: data.name,
          description: data.description,
          category: data.category,
          mode: data.mode,
        })
        .returning();
      await tx.insert(rollTableEntries).values(data.entries.map((entry: any, index: number) => ({
        tableId: row.id,
        entryOrder: index,
        text: entry.text,
        minRoll: entry.minRoll ?? null,
        maxRoll: entry.maxRoll ?? null,
        weight: entry.weight ?? null,
      })));
      return row;
    });
    const tables = await this.getRollTables(data.campaignId);
    return tables.find(table => table.id === created.id);
  }

  async updateRollTable(id: number, data: any): Promise<any | null> {
    const updated = await db.transaction(async tx => {
      const [row] = await tx
        .update(rollTables)
        .set({
          name: data.name,
          description: data.description,
          category: data.category,
          mode: data.mode,
        })
        .where(and(eq(rollTables.id, id), eq(rollTables.campaignId, data.campaignId)))
        .returning();
      if (!row) return null;
      await tx.delete(rollTableEntries).where(eq(rollTableEntries.tableId, id));
      await tx.insert(rollTableEntries).values(data.entries.map((entry: any, index: number) => ({
        tableId: id,
        entryOrder: index,
        text: entry.text,
        minRoll: entry.minRoll ?? null,
        maxRoll: entry.maxRoll ?? null,
        weight: entry.weight ?? null,
      })));
      return row;
    });
    if (!updated) return null;
    const tables = await this.getRollTables(data.campaignId);
    return tables.find(table => table.id === id) ?? null;
  }

  async deleteRollTable(id: number, campaignId: number): Promise<boolean> {
    return db.transaction(async tx => {
      const [owned] = await tx
        .select({ id: rollTables.id })
        .from(rollTables)
        .where(and(eq(rollTables.id, id), eq(rollTables.campaignId, campaignId)));
      if (!owned) return false;
      await tx.delete(rollTables).where(eq(rollTables.id, id));
      return true;
    });
  }
}

export const storage = new DatabaseStorage();
