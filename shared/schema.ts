import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── 5e Compendium ────────────────────────────────────────────────────────────

const itemColumns = {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  itemType: text("item_type"),
  rarity: text("rarity").notNull().default("Common"),
  description: text("description").notNull().default(""),
  damage: text("damage"),
  weight: text("weight"),
  cost: text("cost"),
  properties: text("properties"),
  attunement: text("attunement"),
};

export const items5e = pgTable("items_5e", itemColumns);

export const insertItem5eSchema = createInsertSchema(items5e).omit({ id: true });
export type Item = typeof items5e.$inferSelect;
export type InsertItem = z.infer<typeof insertItem5eSchema>;

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  edition: text("edition").notNull().default("5e"),
  description: text("description"),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

// ─── Campaign Items (homebrew) ─────────────────────────────────────────────────

export const campaignItems = pgTable("campaign_items", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  itemType: text("item_type"),
  rarity: text("rarity").notNull().default("Common"),
  description: text("description").notNull().default(""),
  damage: text("damage"),
  weight: text("weight"),
  cost: text("cost"),
  properties: text("properties"),
  attunement: text("attunement"),
});

export const insertCampaignItemSchema = createInsertSchema(campaignItems).omit({ id: true });
export type CampaignItem = typeof campaignItems.$inferSelect;
export type InsertCampaignItem = z.infer<typeof insertCampaignItemSchema>;

// ─── Campaign Characters (PCs) ─────────────────────────────────────────────────

export const campaignCharacters = pgTable("campaign_characters", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  playerClass: text("player_class"),
  maxHp: integer("max_hp").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  healingSurgesMax: integer("healing_surges_max"),
  initiativeBonus: integer("initiative_bonus").default(0),
});

export const insertCampaignCharacterSchema = createInsertSchema(campaignCharacters).omit({ id: true });
export type CampaignCharacter = typeof campaignCharacters.$inferSelect;
export type InsertCampaignCharacter = z.infer<typeof insertCampaignCharacterSchema>;

// ─── Draw Options ─────────────────────────────────────────────────────────────

export const drawOptionsSchema = z.object({
  source: z.enum(["5e", "campaign"]),
  campaignId: z.number().optional(),
  editions: z.array(z.string()).optional(),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  rarities: z.array(z.string()).min(1, "Select at least one rarity"),
  count: z.coerce.number().min(1).max(100),
});

export type DrawOptions = z.infer<typeof drawOptionsSchema>;
