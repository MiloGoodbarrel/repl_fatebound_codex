import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Weapons, Armor, etc.
  rarity: text("rarity").notNull(), // Common, Uncommon, etc.
  description: text("description").notNull(),
  version: text("version").notNull().default("5e"), // OD&D, AD&D, 3e, 4e, 5e, One D&D
  attunement: text("attunement"), // e.g., "Requires Attunement", "Requires Attunement by Wizard"
  weaponType: text("weapon_type"), // Simple/Martial for weapons
  meta: text("meta"), // Additional metadata
});

export const insertItemSchema = createInsertSchema(items).omit({ id: true });

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export const drawOptionsSchema = z.object({
  categories: z.array(z.string()).min(1, "Select at least one category"),
  rarities: z.array(z.string()).min(1, "Select at least one rarity"),
  versions: z.array(z.string()).min(1, "Select at least one D&D version"),
  count: z.coerce.number().min(1, "Draw at least one card").max(100, "Max 100 cards at a time"),
});

export type DrawOptions = z.infer<typeof drawOptionsSchema>;
