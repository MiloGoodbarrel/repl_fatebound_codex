import { db } from "./db";
import { items, type InsertItem, type Item, type DrawOptions } from "@shared/schema";
import { eq, inArray, sql, and } from "drizzle-orm";

export interface IStorage {
  getItems(): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  createItems(items: InsertItem[]): Promise<Item[]>;
  drawItems(options: DrawOptions): Promise<Item[]>;
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
    return await db.insert(items).values(insertItems).returning();
  }

  async drawItems(options: DrawOptions): Promise<Item[]> {
    const { categories, rarities, count } = options;
    
    // Select random items matching criteria
    // Postgres random() is simple enough for this use case
    const drawnItems = await db
      .select()
      .from(items)
      .where(
        and(
          inArray(items.category, categories),
          inArray(items.rarity, rarities)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(count);

    return drawnItems;
  }
}

export const storage = new DatabaseStorage();
