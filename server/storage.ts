import { db } from "./db";
import {
  items5e, campaignItems, campaigns, campaignCharacters,
  type InsertItem, type Item,
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
  drawItems(options: DrawOptions): Promise<Item[] | CampaignItem[]>;
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
    return await db.select().from(campaignItems).where(eq(campaignItems.campaignId, campaignId));
  }

  async importCampaignItems(
    campaignId: number,
    items: Omit<InsertCampaignItem, "campaignId">[]
  ): Promise<CampaignItem[]> {
    if (items.length === 0) return [];
    const withId = items.map(item => ({ ...item, campaignId }));
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

  async drawItems(options: DrawOptions): Promise<Item[] | CampaignItem[]> {
    const { source, campaignId, categories, rarities, count } = options;

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

    return await db
      .select()
      .from(items5e)
      .where(
        and(
          inArray(items5e.category, categories),
          inArray(items5e.rarity, rarities)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(count);
  }
}

export const storage = new DatabaseStorage();
