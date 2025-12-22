import { db } from "./db";
import { items, type InsertItem, type Item, type DrawOptions } from "@shared/schema";
import { eq, inArray, sql, and } from "drizzle-orm";

export interface IStorage {
  getItems(): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  createItems(items: InsertItem[]): Promise<Item[]>;
  drawItems(options: DrawOptions): Promise<Item[]>;
  clearItems(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async createItems(insertItems: InsertItem[]): Promise<Item[]> {
    if (insertItems.length === 0) return [];
    return await db.insert(items).values(insertItems).returning();
  }

  async drawItems(options: DrawOptions): Promise<Item[]> {
    const { categories, rarities, versions, count } = options;
    
    // Select random items matching criteria
    const drawnItems = await db
      .select()
      .from(items)
      .where(
        and(
          inArray(items.category, categories),
          inArray(items.rarity, rarities),
          inArray(items.version, versions)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(count);

    return drawnItems;
  }

  async clearItems(): Promise<void> {
    // Delete all items from the table
    await db.delete(items);
  }
}

export const storage = new DatabaseStorage();
