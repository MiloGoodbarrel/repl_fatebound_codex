import { db } from "./db";
import { items5e, itemsCustom, type InsertItem, type Item, type DrawOptions } from "@shared/schema";
import { inArray, sql, and } from "drizzle-orm";

const TABLE_MAP = {
  "5e": items5e,
  "custom": itemsCustom,
} as const;

export interface IStorage {
  getItems(source: "5e" | "custom"): Promise<Item[]>;
  createItems(source: "5e" | "custom", items: InsertItem[]): Promise<Item[]>;
  drawItems(options: DrawOptions): Promise<Item[]>;
  clearItems(source: "5e" | "custom"): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getItems(source: "5e" | "custom"): Promise<Item[]> {
    const table = TABLE_MAP[source];
    return await db.select().from(table);
  }

  async createItems(source: "5e" | "custom", insertItems: InsertItem[]): Promise<Item[]> {
    if (insertItems.length === 0) return [];
    const table = TABLE_MAP[source];
    return await db.insert(table).values(insertItems).returning();
  }

  async drawItems(options: DrawOptions): Promise<Item[]> {
    const { source, categories, rarities, count } = options;
    const table = TABLE_MAP[source];

    return await db
      .select()
      .from(table)
      .where(
        and(
          inArray(table.category, categories),
          inArray(table.rarity, rarities)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(count);
  }

  async clearItems(source: "5e" | "custom"): Promise<void> {
    const table = TABLE_MAP[source];
    await db.delete(table);
  }
}

export const storage = new DatabaseStorage();
