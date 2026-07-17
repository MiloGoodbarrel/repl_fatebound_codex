import { db } from "./db";
import {
  items5e, homebrewItems, campaignItems, campaigns, campaignCharacters,
  type InsertItem, type Item,
  type HomebrewItem, type InsertHomebrewItem,
  type Campaign, type InsertCampaign,
  type CampaignItem, type InsertCampaignItem,
  type CampaignCharacter, type InsertCampaignCharacter,
  type DrawOptions,
} from "@shared/schema";
import { eq, inArray, sql, and } from "drizzle-orm";

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

  async drawItems(options: DrawOptions): Promise<(Item | HomebrewItem | CampaignItem)[]> {
    const { source, campaignId, editions, categories, rarities, sources, count } = options;

    // ── Campaign draw ──────────────────────────────────────────────────────
    if (source === "campaign" && campaignId != null) {
      return await db
        .select()
        .from(campaignItems)
        .where(
          and(
            eq(campaignItems.campaignId, campaignId),
            inArray(campaignItems.category, categories),
            inArray(campaignItems.rarity, rarities)
          )
        )
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

    // Decide whether we need official items at all
    const needOfficial = !sources || officialSources === null || (officialSources && officialSources.length > 0);

    const officialItems: Item[] = needOfficial
      ? await db
          .select()
          .from(items5e)
          .where(and(editionFilter, sourceFilter, inArray(items5e.category, categories), inArray(items5e.rarity, rarities)))
          .orderBy(sql`RANDOM()`)
          .limit(count)
      : [];

    const brewed: HomebrewItem[] = includeHomebrew
      ? await db
          .select()
          .from(homebrewItems)
          .where(and(inArray(homebrewItems.category, categories), inArray(homebrewItems.rarity, rarities)))
          .orderBy(sql`RANDOM()`)
          .limit(count)
      : [];

    // Combine, shuffle, and trim to count
    const combined = [...officialItems, ...brewed].sort(() => Math.random() - 0.5);
    return combined.slice(0, count);
  }
}

export const storage = new DatabaseStorage();
