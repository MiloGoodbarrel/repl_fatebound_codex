import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
export const itemsCustom = pgTable("items_custom", itemColumns);

export const insertItem5eSchema = createInsertSchema(items5e).omit({ id: true });
export const insertItemCustomSchema = createInsertSchema(itemsCustom).omit({ id: true });

export type Item = typeof items5e.$inferSelect;
export type InsertItem = z.infer<typeof insertItem5eSchema>;

export const drawOptionsSchema = z.object({
  source: z.enum(["5e", "custom"]),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  rarities: z.array(z.string()).min(1, "Select at least one rarity"),
  count: z.coerce.number().min(1, "Draw at least one card").max(100, "Max 100 cards at a time"),
});

export type DrawOptions = z.infer<typeof drawOptionsSchema>;

export const SOURCES = ["5e", "custom"] as const;
export type Source = typeof SOURCES[number];
